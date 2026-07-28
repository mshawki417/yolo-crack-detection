from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import onnxruntime as ort
import uvicorn
import cv2
import numpy as np
import os
import requests as req
import gc
import psutil
from pathlib import Path

# =====================================
# App
# =====================================
app = FastAPI(title="YOLO Crack Detection API", version="3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://yolo-crack-detection.vercel.app",
        "https://yolo-crack-detection-taupe.vercel.app",
        "http://localhost:3000",
    ],
    allow_origin_regex=r"https://yolo-crack-detection-.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================
# CORS على الـ error responses
# =====================================
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    origin = request.headers.get("origin", "*")
    response = JSONResponse(
        status_code=500,
        content={"detail": str(exc)}
    )
    response.headers["Access-Control-Allow-Origin"]      = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

# =====================================
# Model Setup
# =====================================
MODEL_DIR  = Path("model")
MODEL_NAME = "sdnet2018_crack_detect_yolov11m_best.onnx"
MODEL_PATH = MODEL_DIR / MODEL_NAME
MODEL_DIR.mkdir(exist_ok=True)

MODEL_URL = os.getenv("MODEL_URL")

if not MODEL_PATH.exists():
    if not MODEL_URL:
        raise RuntimeError("MODEL_URL is missing")
    print(f"Downloading model from:\n{MODEL_URL}")
    try:
        response = req.get(MODEL_URL, stream=True, timeout=120, allow_redirects=True)
        if response.status_code != 200:
            raise RuntimeError(f"Download failed — HTTP {response.status_code}")
        with open(MODEL_PATH, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        size_mb = MODEL_PATH.stat().st_size / 1024 / 1024
        print(f"Model downloaded — {size_mb:.1f} MB")
        if size_mb < 1:
            MODEL_PATH.unlink()
            raise RuntimeError("Downloaded file too small — URL probably wrong")
    except Exception as e:
        if MODEL_PATH.exists():
            MODEL_PATH.unlink()
        raise RuntimeError(str(e))

# =====================================
# Load ONNX Session Once
# =====================================
session     = None
input_name  = None
model_imgsz = 256  # SDNET2018 patch size

try:
    opts = ort.SessionOptions()
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    opts.intra_op_num_threads = 1
    opts.inter_op_num_threads = 1

    session = ort.InferenceSession(
        str(MODEL_PATH),
        sess_options=opts,
        providers=["CPUExecutionProvider"],
    )
    input_name  = session.get_inputs()[0].name
    model_imgsz = session.get_inputs()[0].shape[2]  # تلقائي من الموديل
    print(f"ONNX model loaded — input: {model_imgsz}x{model_imgsz}")

except Exception as e:
    print("ONNX LOAD ERROR:", e)

# =====================================
# Config
# =====================================
CLASS_NAMES = {0: "crack", 1: "no-crack"}

ALLOWED_IMAGE_TYPES = {
    "image/jpeg", "image/jpg", "image/png",
    "image/webp", "image/tiff",
}

PATCH_SIZE = model_imgsz  # نفس حجم input الموديل
OVERLAP    = PATCH_SIZE // 4  # 25% overlap

# =====================================
# Helpers
# =====================================
def memory_usage() -> float:
    return round(
        psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024, 2
    )


def preprocess_patch(patch_bgr: np.ndarray, imgsz: int):
    """
    Patch صغير → letterbox → normalize → tensor
    """
    orig_h, orig_w = patch_bgr.shape[:2]
    scale = imgsz / max(orig_h, orig_w)
    new_w = int(orig_w * scale)
    new_h = int(orig_h * scale)

    resized = cv2.resize(patch_bgr, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

    pad_w = (imgsz - new_w) / 2
    pad_h = (imgsz - new_h) / 2
    top    = int(round(pad_h - 0.1))
    bottom = int(round(pad_h + 0.1))
    left   = int(round(pad_w - 0.1))
    right  = int(round(pad_w + 0.1))

    padded = cv2.copyMakeBorder(
        resized, top, bottom, left, right,
        cv2.BORDER_CONSTANT, value=(114, 114, 114)
    )

    img = cv2.cvtColor(padded, cv2.COLOR_BGR2RGB)
    img = img.astype(np.float32) / 255.0
    img = np.transpose(img, (2, 0, 1))
    img = np.expand_dims(img, 0)

    return img, scale, (pad_w, pad_h)


def postprocess_patch(outputs, patch_h, patch_w, conf_thresh, iou_thresh, scale, pad_w, pad_h):
    """
    YOLO output → boxes في إحداثيات الـ patch
    """
    preds = outputs[0][0].T  # [num_anchors, 4+num_classes]

    boxes_xywh, scores_list, class_ids_list = [], [], []

    for pred in preds:
        cx, cy, w, h = pred[:4]
        class_scores = pred[4:]
        class_id     = int(np.argmax(class_scores))
        confidence   = float(class_scores[class_id])

        if confidence < conf_thresh:
            continue

        # عكس الـ letterbox
        cx_orig = (cx - pad_w) / scale
        cy_orig = (cy - pad_h) / scale
        w_orig  = w / scale
        h_orig  = h / scale

        x1 = int(cx_orig - w_orig / 2)
        y1 = int(cy_orig - h_orig / 2)
        x2 = int(cx_orig + w_orig / 2)
        y2 = int(cy_orig + h_orig / 2)

        x1 = max(0, min(patch_w, x1))
        y1 = max(0, min(patch_h, y1))
        x2 = max(0, min(patch_w, x2))
        y2 = max(0, min(patch_h, y2))

        if x2 <= x1 or y2 <= y1:
            continue

        boxes_xywh.append([x1, y1, x2 - x1, y2 - y1])
        scores_list.append(confidence)
        class_ids_list.append(class_id)

    # NMS على الـ patch
    final_boxes, final_scores, final_class_ids = [], [], []
    if boxes_xywh:
        indices = cv2.dnn.NMSBoxes(boxes_xywh, scores_list, conf_thresh, iou_thresh)
        if len(indices) > 0:
            for i in indices.flatten():
                x, y, bw, bh = boxes_xywh[i]
                final_boxes.append([x, y, x + bw, y + bh])
                final_scores.append(round(scores_list[i], 4))
                final_class_ids.append(class_ids_list[i])

    return final_boxes, final_scores, final_class_ids


def run_tiled_inference(image, conf_thresh, iou_thresh):
    """
    Sliding Window Tiling:
    - تقطيع الصورة لـ patches بحجم PATCH_SIZE مع OVERLAP
    - inference على كل patch
    - تحويل الإحداثيات للصورة الأصلية
    - NMS شاملة لإزالة التكرار
    """
    orig_h, orig_w = image.shape[:2]
    stride = PATCH_SIZE - OVERLAP

    all_boxes, all_scores, all_class_ids = [], [], []

    for y in range(0, orig_h, stride):
        for x in range(0, orig_w, stride):
            # حدود الـ patch
            x2_patch = min(x + PATCH_SIZE, orig_w)
            y2_patch = min(y + PATCH_SIZE, orig_h)
            x1_patch = max(0, x2_patch - PATCH_SIZE)
            y1_patch = max(0, y2_patch - PATCH_SIZE)

            patch = image[y1_patch:y2_patch, x1_patch:x2_patch]
            ph, pw = patch.shape[:2]

            # padding لو الـ patch أصغر
            if ph < PATCH_SIZE or pw < PATCH_SIZE:
                padded_patch = np.full(
                    (PATCH_SIZE, PATCH_SIZE, 3), 114, dtype=np.uint8
                )
                padded_patch[:ph, :pw] = patch
                patch = padded_patch
                ph, pw = PATCH_SIZE, PATCH_SIZE

            # preprocess وinference
            tensor, scale, (pad_w, pad_h) = preprocess_patch(patch, PATCH_SIZE)
            outputs = session.run(None, {input_name: tensor})
            boxes, scores, class_ids = postprocess_patch(
                outputs, ph, pw,
                conf_thresh, iou_thresh,
                scale, pad_w, pad_h
            )

            # تحويل إحداثيات الـ patch للصورة الأصلية
            for box in boxes:
                bx1 = box[0] + x1_patch
                by1 = box[1] + y1_patch
                bx2 = box[2] + x1_patch
                by2 = box[3] + y1_patch

                bx1 = max(0, min(orig_w, bx1))
                by1 = max(0, min(orig_h, by1))
                bx2 = max(0, min(orig_w, bx2))
                by2 = max(0, min(orig_h, by2))

                if bx2 > bx1 and by2 > by1:
                    all_boxes.append([bx1, by1, bx2, by2])

            all_scores.extend(scores)
            all_class_ids.extend(class_ids)

            # تنظيف الذاكرة بعد كل patch
            del tensor, outputs, patch
            gc.collect()

    # NMS شاملة على كل الصورة لإزالة التكرار بين الـ patches
    final_boxes, final_scores, final_class_ids = [], [], []
    if all_boxes:
        boxes_xywh = [
            [b[0], b[1], b[2] - b[0], b[3] - b[1]]
            for b in all_boxes
        ]
        indices = cv2.dnn.NMSBoxes(
            boxes_xywh, all_scores, conf_thresh, iou_thresh
        )
        if len(indices) > 0:
            for i in indices.flatten():
                final_boxes.append(all_boxes[i])
                final_scores.append(round(all_scores[i], 4))
                final_class_ids.append(all_class_ids[i])

    return final_boxes, final_scores, final_class_ids

# =====================================
# Routes
# =====================================
@app.get("/")
def root():
    return {
        "status":       "running",
        "model_loaded": session is not None,
        "patch_size":   PATCH_SIZE,
        "overlap":      OVERLAP,
        "memory_mb":    memory_usage(),
    }


@app.get("/debug")
def debug():
    vm = psutil.virtual_memory()
    return {
        "memory_used_mb":   memory_usage(),
        "available_ram_mb": round(vm.available / 1024 / 1024, 2),
        "total_ram_mb":     round(vm.total     / 1024 / 1024, 2),
        "cpu_percent":      psutil.cpu_percent(interval=0.5),
        "model_loaded":     session is not None,
        "model_input_size": model_imgsz,
        "patch_size":       PATCH_SIZE,
        "overlap":          OVERLAP,
    }


@app.post("/predict")
async def predict(
    file:       UploadFile = File(...),
    confidence: float      = Form(0.25),
    iou:        float      = Form(0.45),
):
    if session is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    # ── تحقق من نوع الملف ──
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Images only (JPEG, PNG, WEBP, TIFF)."
        )

    # ── Read ──
    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 20 MB)")

    nparr = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Invalid image")

    original_h, original_w = image.shape[:2]

    # ── اختار Strategy حسب حجم الصورة ──
    # صورة صغيرة (أقل من PATCH_SIZE): inference مباشر بدون tiling
    # صورة كبيرة: tiling
    try:
        if max(original_h, original_w) <= PATCH_SIZE:
            # inference مباشر
            tensor, scale, (pad_w, pad_h) = preprocess_patch(image, PATCH_SIZE)
            outputs = session.run(None, {input_name: tensor})
            boxes, scores, class_ids = postprocess_patch(
                outputs, original_h, original_w,
                confidence, iou, scale, pad_w, pad_h
            )
            del tensor, outputs
        else:
            # Sliding Window Tiling
            boxes, scores, class_ids = run_tiled_inference(
                image, confidence, iou
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {e}")
    finally:
        del image, nparr, contents
        gc.collect()

    # ── Response ──
    detections = [
        {
            "box":        box,           # [x1, y1, x2, y2] بإحداثيات الصورة الأصلية
            "confidence": score,
            "class_id":   cid,
            "class_name": CLASS_NAMES.get(cid, "unknown"),
        }
        for box, score, cid in zip(boxes, scores, class_ids)
    ]

    return {
        "detections":  detections,
        "count":       len(detections),
        "image_size":  {"width": original_w, "height": original_h},
        "scale_factor": 1.0,   # الإحداثيات دايماً على الصورة الأصلية
        "memory_mb":   memory_usage(),
    }

# =====================================
# Run
# =====================================
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        workers=1,
    )
