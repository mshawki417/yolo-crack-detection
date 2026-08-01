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
import logging
import time
from pathlib import Path
from datetime import datetime, timezone
from pymongo import MongoClient
from pymongo.errors import PyMongoError
import certifi

# =====================================
# Logging
# =====================================
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =====================================
# App
# =====================================
app = FastAPI(title="YOLO Crack Detection API", version="4.1")

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
    # سجّل الـ error داخلياً بدون كشفه للمستخدم
    logger.error(f"Unhandled error: {type(exc).__name__}: {exc}")
    response = JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again."}
    )
    response.headers["Access-Control-Allow-Origin"]      = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

# =====================================
# MongoDB
# =====================================
MONGO_URL = os.getenv("MONGO_URL")
db_client        = None
inspections_col  = None

if MONGO_URL:
    try:
        db_client = MongoClient(
            MONGO_URL,
            tls=True,
            tlsCAFile=certifi.where(),
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=10000,
        )
        db              = db_client["crackdetect"]
        inspections_col = db["inspections"]
        # index على timestamp للـ queries السريعة
        inspections_col.create_index([("timestamp", -1)])
        logger.info("MongoDB connected successfully")
    except PyMongoError as e:
        logger.error(f"MongoDB connection failed: {e}")
        db_client       = None
        inspections_col = None

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
    logger.info(f"Downloading model...")
    try:
        response = req.get(MODEL_URL, stream=True, timeout=120, allow_redirects=True)
        if response.status_code != 200:
            raise RuntimeError(f"Download failed — HTTP {response.status_code}")
        with open(MODEL_PATH, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        size_mb = MODEL_PATH.stat().st_size / 1024 / 1024
        logger.info(f"Model downloaded — {size_mb:.1f} MB")
        if size_mb < 1:
            MODEL_PATH.unlink()
            raise RuntimeError("Downloaded file too small")
    except Exception as e:
        if MODEL_PATH.exists():
            MODEL_PATH.unlink()
        raise RuntimeError(str(e))

# =====================================
# Load ONNX Session Once — Memory-optimized for Render 512 MB
# =====================================
session     = None
input_name  = None
model_imgsz = 640

try:
    opts = ort.SessionOptions()
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    opts.intra_op_num_threads = 1
    opts.inter_op_num_threads = 1

    # ── Memory optimizations for Render free-tier (512 MB RAM) ──
    opts.enable_mem_pattern = True
    opts.enable_mem_reuse   = True
    opts.enable_cpu_mem_arena = False   # تقليل الـ RAM: بدل ما يحجز arena كبير

    session = ort.InferenceSession(
        str(MODEL_PATH),
        sess_options=opts,
        providers=["CPUExecutionProvider"],
    )
    input_name  = session.get_inputs()[0].name
    model_imgsz = session.get_inputs()[0].shape[2]
    logger.info(f"ONNX model loaded — input: {model_imgsz}x{model_imgsz}")

    # ── تنظيف بعد التحميل ──
    gc.collect()
    logger.info(f"Memory after model load: {round(psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024, 1)} MB")

except Exception as e:
    logger.error(f"ONNX LOAD ERROR: {e}")

# =====================================
# Config — ثابت بغض النظر عن الموديل
# =====================================
CLASS_NAMES = {0: "crack"}  # Model has 1 class only

SEVERITY_THRESHOLDS = {
    "Critical": 0.9,
    "High":     0.75,
    "Moderate": 0.5,
}

ALLOWED_IMAGE_TYPES = {
    "image/jpeg", "image/jpg", "image/png",
    "image/webp", "image/tiff",
}

# Magic bytes للتحقق من نوع الملف الحقيقي
MAGIC_BYTES: dict[bytes, str] = {
    b'\xff\xd8\xff': "jpeg",
    b'\x89PNG':      "png",
    b'RIFF':         "webp",
    b'II*\x00':      "tiff",
    b'MM\x00*':      "tiff",
}

# Inference parameters
PATCH_SIZE    = 640   # model input size — ثابت 640×640
CROP_SIZE     = 640   # crop window = نفس الـ patch size
OVERLAP       = 64    # overlap صغير — يكفي لمنع miss على الحواف
MAX_INPUT_DIM = 960   # downscale قبل الـ tiling (أسرع + أقل patches)
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

# =====================================
# Helpers
# =====================================
def memory_usage() -> float:
    return round(
        psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024, 2
    )


def get_severity(confidence: float) -> str:
    if confidence >= SEVERITY_THRESHOLDS["Critical"]: return "Critical"
    if confidence >= SEVERITY_THRESHOLDS["High"]:     return "High"
    if confidence >= SEVERITY_THRESHOLDS["Moderate"]: return "Moderate"
    return "Low"


def verify_image_magic(contents: bytes) -> bool:
    """تحقق من الـ magic bytes الفعلية للملف"""
    for magic, _ in MAGIC_BYTES.items():
        if contents[:len(magic)] == magic:
            return True
    return False


def preprocess_patch(patch_bgr: np.ndarray, imgsz: int):
    orig_h, orig_w = patch_bgr.shape[:2]
    scale  = imgsz / max(orig_h, orig_w)
    new_w  = int(orig_w * scale)
    new_h  = int(orig_h * scale)

    resized = cv2.resize(patch_bgr, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

    pad_w  = (imgsz - new_w) / 2
    pad_h  = (imgsz - new_h) / 2
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


def postprocess_patch(
    outputs, patch_h, patch_w,
    conf_thresh, iou_thresh,
    scale, pad_w, pad_h
):
    """
    Decode YOLOv11 ONNX output.
    Output shape: [1, 5, 8400]  ->  5 = 4 box coords + 1 class score (crack)
    """
    raw = outputs[0][0]   # shape [5, 8400]
    if raw.shape[0] < raw.shape[1]:
        raw = raw.T       # [8400, 5]

    boxes_xywh, scores_list, class_ids_list = [], [], []

    for pred in raw:
        cx, cy, w, h = pred[:4]
        confidence   = float(pred[4])   # single-class score
        class_id     = 0                # only class: crack

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

        x1 = max(0, min(patch_w, x1))
        y1 = max(0, min(patch_h, y1))
        x2 = max(0, min(patch_w, x2))
        y2 = max(0, min(patch_h, y2))

        if x2 <= x1 or y2 <= y1:
            continue

        box_w = x2 - x1
        box_h = y2 - y1
        area  = box_w * box_h
        patch_area = patch_h * patch_w

        # ── فلتر الـ boxes الغلط ──
        # 1. صغير جداً (ضوضاء) أو كبير جداً (خلفية مش crack)
        if area < 100 or area > (patch_area * 0.15):
            continue

        # 2. aspect ratio: الـ crack دايماً مستطيلة ممدودة
        #    لو width ≈ height (مربع) → على الأرجح مش crack
        aspect = max(box_w, box_h) / (min(box_w, box_h) + 1e-6)
        if aspect < 1.5:
            continue

        boxes_xywh.append([x1, y1, box_w, box_h])
        scores_list.append(confidence)
        class_ids_list.append(class_id)

    # ← بدون NMS هنا — الـ NMS بيتعمل مرة واحدة globally بعد كل الـ patches
    final_boxes     = [[x, y, x + bw, y + bh] for x, y, bw, bh in boxes_xywh]
    final_scores    = [round(s, 4) for s in scores_list]
    final_class_ids = class_ids_list

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
        "patch_size":       PATCH_SIZE,
        "overlap":          OVERLAP,
        "mongodb":          inspections_col is not None,
    }


@app.get("/history")
def get_history(limit: int = 20):
    if inspections_col is None:
        return {"inspections": [], "error": "MongoDB not connected"}
    try:
        limit = max(1, min(limit, 100))  # بين 1 و100
        docs  = list(
            inspections_col
            .find({}, {"_id": 0})
            .sort("timestamp", -1)
            .limit(limit)
        )
        return {"inspections": docs, "count": len(docs)}
    except PyMongoError as e:
        logger.error(f"MongoDB query error: {e}")
        return {"inspections": [], "error": "Database query failed"}


@app.get("/stats")
def get_stats():
    """إحصائيات للـ Dashboard"""
    if inspections_col is None:
        return {"error": "MongoDB not connected"}
    try:
        total        = inspections_col.count_documents({})
        total_cracks = list(inspections_col.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$count"}}}
        ]))
        severity_dist = list(inspections_col.aggregate([
            {"$group": {"_id": "$max_severity", "count": {"$sum": 1}}}
        ]))
        return {
            "total_inspections": total,
            "total_cracks":      total_cracks[0]["total"] if total_cracks else 0,
            "severity_distribution": {
                item["_id"]: item["count"]
                for item in severity_dist
                if item["_id"]
            },
        }
    except PyMongoError as e:
        logger.error(f"MongoDB stats error: {e}")
        return {"error": "Stats query failed"}


@app.post("/predict")
async def predict(
    file:       UploadFile = File(...),
    confidence: float      = Form(0.40, ge=0.0, le=1.0),  # رفعنا من 0.25 → 0.40
    iou:        float      = Form(0.45, ge=0.0, le=1.0),
):
    if session is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    # ── تحقق من نوع الملف بالـ Content-Type ──
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Images only."
        )

    # ── Read ──
    contents = await file.read()

    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 5 MB)")

    # ── تحقق من الـ magic bytes الفعلية ──
    if not verify_image_magic(contents):
        raise HTTPException(status_code=400, detail="Invalid image file")

    nparr = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    del contents, nparr  # ← تنظيف مبكر لتوفير RAM
    gc.collect()

    if image is None:
        raise HTTPException(status_code=400, detail="Cannot decode image")

    original_h, original_w = image.shape[:2]

    # ── Resize لو الصورة كبيرة جداً ──
    display_scale = 1.0
    if max(original_h, original_w) > MAX_INPUT_DIM:
        display_scale = MAX_INPUT_DIM / max(original_h, original_w)
        image = cv2.resize(
            image, None,
            fx=display_scale, fy=display_scale,
            interpolation=cv2.INTER_AREA
        )

    start_time = time.time()
    proc_h, proc_w = image.shape[:2]

    try:
        # ── Sliding Window inference ──
        # Crop CROP_SIZE windows from original image (preserve crack detail),
        # letterbox each crop to PATCH_SIZE (640) before inference.
        stride = CROP_SIZE - OVERLAP
        all_boxes, all_scores, all_class_ids = [], [], []

        for y in range(0, proc_h, stride):
            for x in range(0, proc_w, stride):
                y2 = min(y + CROP_SIZE, proc_h)
                x2 = min(x + CROP_SIZE, proc_w)
                y1 = max(0, y2 - CROP_SIZE)
                x1 = max(0, x2 - CROP_SIZE)

                patch = image[y1:y2, x1:x2]
                # Letterbox crop → 640×640 for inference
                tensor, scale, (pad_w, pad_h) = preprocess_patch(patch, PATCH_SIZE)
                outputs = session.run(None, {input_name: tensor})
                p_boxes, p_scores, p_class_ids = postprocess_patch(
                    outputs, patch.shape[0], patch.shape[1],
                    confidence, iou, scale, pad_w, pad_h
                )
                # Remap to full image coords
                for box in p_boxes:
                    box[0] += x1; box[1] += y1
                    box[2] += x1; box[3] += y1
                all_boxes.extend(p_boxes)
                all_scores.extend(p_scores)
                all_class_ids.extend(p_class_ids)
                del tensor, outputs, patch

        # Global NMS — مرة واحدة بعد كل الـ patches
        boxes, scores, class_ids = [], [], []
        if all_boxes:
            # all_boxes هنا x1,y1,x2,y2 — نحولها لـ x,y,w,h للـ NMS
            nms_in = [
                [b[0], b[1], b[2] - b[0], b[3] - b[1]]
                for b in all_boxes
            ]
            # IOU=0.3 صارم → يحذف الـ duplicates بقوة
            indices = cv2.dnn.NMSBoxes(nms_in, all_scores, confidence, 0.3)
            if len(indices) > 0:
                for i in indices.flatten():
                    boxes.append(all_boxes[i])
                    scores.append(all_scores[i])
                    class_ids.append(all_class_ids[i])
        del all_boxes, all_scores, all_class_ids

        logger.info(f"Sliding window done: {len(boxes)} detections")

    except Exception as e:
        logger.error(f"Inference error: {e}")
        raise HTTPException(status_code=500, detail="Inference failed. Please try again.")
    finally:
        del image
        gc.collect()

    processing_ms = round((time.time() - start_time) * 1000)

    # ── Build detections ──
    detections = [
        {
            "box":        box,
            "confidence": score,
            "class_id":   cid,
            "class_name": CLASS_NAMES.get(cid, "unknown"),
            "severity":   get_severity(score),
        }
        for box, score, cid in zip(boxes, scores, class_ids)
    ]

    # ── Max severity ──
    severity_order = ["Low", "Moderate", "High", "Critical"]
    max_severity   = "Low"
    for d in detections:
        if severity_order.index(d["severity"]) > severity_order.index(max_severity):
            max_severity = d["severity"]

    # ── حفظ في MongoDB (non-blocking) ──
    if inspections_col is not None:
        try:
            inspections_col.insert_one({
                "timestamp":            datetime.now(timezone.utc),
                "filename":             file.filename or "unknown",
                "image_size":           {"width": original_w, "height": original_h},
                "count":                len(detections),
                "max_severity":         max_severity,
                "confidence_threshold": confidence,
                "iou_threshold":        iou,
                "processing_time_ms":   processing_ms,
                "detections":           detections,
            })
        except PyMongoError as e:
            logger.error(f"MongoDB save error: {e}")
            # مش بيوقف الـ response

    # FIX: الـ frontend بيقرأ display_scale مش scale_factor
    return {
        "detections":    detections,
        "count":         len(detections),
        "max_severity":  max_severity,
        "image_size":    {"width": original_w, "height": original_h},
        "display_scale": display_scale,
        "memory_mb":     memory_usage(),
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
