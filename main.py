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
app = FastAPI(title="YOLO Crack Detection API", version="2.0")

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
model_imgsz = 640

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
    model_imgsz = session.get_inputs()[0].shape[2]
    print(f"ONNX model loaded — input: {model_imgsz}x{model_imgsz}")

except Exception as e:
    print("ONNX LOAD ERROR:", e)

# =====================================
# Class Names
# =====================================
CLASS_NAMES = {0: "crack", 1: "no-crack"}

# =====================================
# Allowed image types
# =====================================
ALLOWED_IMAGE_TYPES = {
    "image/jpeg", "image/jpg", "image/png",
    "image/webp", "image/tiff",
}

# =====================================
# Helpers
# =====================================
def memory_usage() -> float:
    return round(
        psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024, 2
    )


def letterbox(img: np.ndarray, target_size: int):
    orig_h, orig_w = img.shape[:2]
    scale  = target_size / max(orig_h, orig_w)
    new_w  = int(orig_w * scale)
    new_h  = int(orig_h * scale)

    img_resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

    pad_w = (target_size - new_w) / 2
    pad_h = (target_size - new_h) / 2

    top    = int(round(pad_h - 0.1))
    bottom = int(round(pad_h + 0.1))
    left   = int(round(pad_w - 0.1))
    right  = int(round(pad_w + 0.1))

    img_padded = cv2.copyMakeBorder(
        img_resized, top, bottom, left, right,
        cv2.BORDER_CONSTANT, value=(114, 114, 114),
    )

    return img_padded, scale, (pad_w, pad_h)


def preprocess(img_bgr: np.ndarray, imgsz: int):
    img_padded, scale, (pad_w, pad_h) = letterbox(img_bgr, imgsz)
    img = cv2.cvtColor(img_padded, cv2.COLOR_BGR2RGB)
    img = img.astype(np.float32) / 255.0
    img = np.transpose(img, (2, 0, 1))
    img = np.expand_dims(img, 0)
    return img, scale, (pad_w, pad_h)


def postprocess(outputs, orig_h, orig_w, conf_thresh, iou_thresh, scale, pad_w, pad_h):
    preds = outputs[0][0].T

    boxes_xywh, scores_list, class_ids_list = [], [], []

    for pred in preds:
        cx, cy, w, h = pred[:4]
        class_scores = pred[4:]
        class_id     = int(np.argmax(class_scores))
        confidence   = float(class_scores[class_id])

        if confidence < conf_thresh:
            continue

        cx_orig = (cx - pad_w) / scale
        cy_orig = (cy - pad_h) / scale
        w_orig  = w / scale
        h_orig  = h / scale

        x1 = int(cx_orig - w_orig / 2)
        y1 = int(cy_orig - h_orig / 2)
        x2 = int(cx_orig + w_orig / 2)
        y2 = int(cy_orig + h_orig / 2)

        x1 = max(0, min(orig_w, x1))
        y1 = max(0, min(orig_h, y1))
        x2 = max(0, min(orig_w, x2))
        y2 = max(0, min(orig_h, y2))

        if x2 <= x1 or y2 <= y1:
            continue

        boxes_xywh.append([x1, y1, x2 - x1, y2 - y1])
        scores_list.append(confidence)
        class_ids_list.append(class_id)

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

# =====================================
# Routes
# =====================================
@app.get("/")
def root():
    return {
        "status":       "running",
        "model_loaded": session is not None,
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
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    nparr = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Invalid image")

    orig_h, orig_w = image.shape[:2]

    # ── scale_factor لو الصورة اتعملها resize ──
    scale_factor = 1.0
    if max(orig_h, orig_w) > 1280:
        scale_factor = 1280 / max(orig_h, orig_w)
        image = cv2.resize(
            image, None, fx=scale_factor, fy=scale_factor,
            interpolation=cv2.INTER_AREA
        )
        orig_h, orig_w = image.shape[:2]

    # ── Inference ──
    tensor = None
    try:
        tensor, scale, (pad_w, pad_h) = preprocess(image, model_imgsz)
        outputs = session.run(None, {input_name: tensor})
        boxes, scores, class_ids = postprocess(
            outputs, orig_h, orig_w,
            confidence, iou,
            scale, pad_w, pad_h,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {e}")
    finally:
        del image, nparr, contents
        if tensor is not None:
            del tensor
        gc.collect()

    # ── Response ──
    detections = [
        {
            "box":        box,
            "confidence": score,
            "class_id":   cid,
            "class_name": CLASS_NAMES.get(cid, "unknown"),
        }
        for box, score, cid in zip(boxes, scores, class_ids)
    ]

    return {
        "detections":   detections,
        "count":        len(detections),
        "image_size":   {"width": orig_w, "height": orig_h},
        "scale_factor": scale_factor,   # ← للـ frontend لعكس الـ resize
        "memory_mb":    memory_usage(),
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
