"""
YOLO Crack Detection API — v7
==============================
Pipeline مبني على حقائق الـ training notebook:

  • الموديل اتدرب على SDNet2018 patches حجمها 256×256 px
  • كل patch اتـletterbox لـ 640×640 قبل الـ inference
  • best_conf = 0.50  (MCC-optimised على الـ val set)
  • الـ ONNX output: [1, 5, 8400]  (cx, cy, w, h, conf_crack)
  • val mAP50=0.947 | Precision=0.90 | Recall=0.832

Flow:
  1. صورة أصلية (أي حجم)
  2. scale down لـ INFER_DIM بس لو أكبر منه  →  display_scale
  3. tile بـ TILE_SIZE=256 مع OVERLAP=32
  4. كل tile: letterbox 256→640 → inference → unletterbox
  5. remap coordinates من tile space → processed image space
  6. global NMS
  7. remap مرة تانية من processed → original image space
     (بالـ display_scale المحفوظ)
"""

# ── Standard library ──────────────────────────────────────────────────────────
import gc
import logging
import os
import time
import threading
from datetime import datetime, timezone
from pathlib import Path

# ── Third-party ───────────────────────────────────────────────────────────────
import certifi
import cv2
import numpy as np
import onnxruntime as ort
import psutil
import requests as req
import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo import MongoClient
from pymongo.errors import PyMongoError

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# App + CORS
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(title="YOLO Crack Detection API", version="7.0")

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

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    origin = request.headers.get("origin", "*")
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers={"Access-Control-Allow-Origin": origin},
    )

# ─────────────────────────────────────────────────────────────────────────────
# MongoDB
# ─────────────────────────────────────────────────────────────────────────────
inspections_col = None
_mongo_client   = None

MONGO_URI = os.environ.get("MONGO_URI", "")

if MONGO_URI:
    try:
        _mongo_client = MongoClient(
            MONGO_URI,
            maxPoolSize=1,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            tlsCAFile=certifi.where(),
        )
        db = _mongo_client["crack_db"]
        inspections_col = db["inspections"]
        inspections_col.create_index([("timestamp",  -1)])
        inspections_col.create_index([("session_id",  1)])
        logger.info("MongoDB connected")
    except Exception as e:
        logger.warning(f"MongoDB unavailable: {e}")
else:
    logger.warning("MONGO_URI not set — running without DB")

# ─────────────────────────────────────────────────────────────────────────────
# Model — loaded once at startup
# ─────────────────────────────────────────────────────────────────────────────
# تقليل RAM لـ threading libraries قبل تحميل الموديل
os.environ.setdefault("OMP_NUM_THREADS",      "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS",      "1")
os.environ.setdefault("NUMEXPR_NUM_THREADS",  "1")

MODEL_DIR  = Path("model")
MODEL_URL  = os.environ.get("MODEL_URL", "")
MODEL_PATH = MODEL_DIR / "best.onnx"

session     = None
input_name  = None
model_imgsz = 640   # ONNX fixed input size

def _download_model() -> bool:
    if MODEL_PATH.exists():
        return True
    if not MODEL_URL:
        logger.error("MODEL_URL not set and model file missing")
        return False
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    logger.info(f"Downloading model from {MODEL_URL} …")
    try:
        r = req.get(MODEL_URL, timeout=120, stream=True)
        r.raise_for_status()
        with open(MODEL_PATH, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
        logger.info(f"Model saved → {MODEL_PATH}")
        return True
    except Exception as e:
        logger.error(f"Model download failed: {e}")
        return False

if _download_model():
    try:
        opts = ort.SessionOptions()
        opts.graph_optimization_level  = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
        opts.intra_op_num_threads      = 1
        opts.inter_op_num_threads      = 1
        opts.enable_mem_pattern        = False
        opts.enable_mem_reuse          = True
        opts.enable_cpu_mem_arena      = False    # يوفر ~50-80 MB
        opts.execution_mode            = ort.ExecutionMode.ORT_SEQUENTIAL

        session    = ort.InferenceSession(
            str(MODEL_PATH),
            sess_options=opts,
            providers=["CPUExecutionProvider"],
        )
        input_name  = session.get_inputs()[0].name
        model_imgsz = session.get_inputs()[0].shape[2]   # 640
        gc.collect()

        ram = round(psutil.Process(os.getpid()).memory_info().rss / 1024**2, 1)
        logger.info(f"ONNX loaded — input {model_imgsz}×{model_imgsz} | RAM={ram} MB")
    except Exception as e:
        logger.error(f"ONNX load failed: {e}")

# ─────────────────────────────────────────────────────────────────────────────
# Constants  (derived from the training notebook)
# ─────────────────────────────────────────────────────────────────────────────
# SDNet2018 patches = 256×256 → الموديل اتدرب عليهم
TILE_SIZE     = 256

# overlap بين الـ tiles — يضمن إن الـ cracks على الحدود بتتشاف من الجانبين
OVERLAP       = 64

# resize الصورة الكبيرة قبل الـ tiling
# 1024 → ~16 tiles (4×4) لصورة مربعة = توازن جيد بين دقة وسرعة
INFER_DIM     = 1024

MAX_FILE_SIZE = 10 * 1024 * 1024   # 10 MB

# best_conf من الـ MCC sweep في الـ notebook = 0.50
# الـ frontend ممكن يبعت قيمة تانية — ده هو الـ default لو مبعتش
DEFAULT_CONF  = 0.50

# NMS IOU threshold
DEFAULT_IOU   = 0.45

CLASS_NAMES = {0: "crack"}

SEVERITY_THRESHOLDS = {
    "Critical": 0.90,
    "High":     0.75,
    "Moderate": 0.50,
}

ALLOWED_IMAGE_TYPES = {
    "image/jpeg", "image/jpg", "image/png",
    "image/webp", "image/bmp", "image/tiff",
}

# Semaphore — يمنع أكتر من inference في نفس الوقت
# (لو requestين جم مع بعض ممكن يعدوا الـ 512 MB)
_inference_lock = threading.Semaphore(1)

# Session state
current_session_id: str | None = None

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def memory_usage() -> float:
    return round(psutil.Process(os.getpid()).memory_info().rss / 1024**2, 2)


def get_severity(conf: float) -> str:
    if conf >= SEVERITY_THRESHOLDS["Critical"]:
        return "Critical"
    if conf >= SEVERITY_THRESHOLDS["High"]:
        return "High"
    if conf >= SEVERITY_THRESHOLDS["Moderate"]:
        return "Moderate"
    return "Low"


def verify_image_magic(data: bytes) -> bool:
    if data[:3] == b"\xff\xd8\xff":
        return True   # JPEG
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return True   # PNG
    if data[:4] in (b"RIFF", b"WEBP"):
        return True   # WebP
    if data[:2] in (b"BM",):
        return True   # BMP
    return False


def letterbox(img_bgr: np.ndarray, target: int = 640):
    """
    Letterbox الصورة لـ target×target بدون تشويه.
    يرجع: (tensor NCHW float32, letterbox_scale, pad_left, pad_top)
    """
    h, w = img_bgr.shape[:2]
    scale = target / max(h, w)
    new_w = int(w * scale)
    new_h = int(h * scale)

    resized = cv2.resize(img_bgr, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

    pad_left = (target - new_w) / 2
    pad_top  = (target - new_h) / 2
    top    = int(round(pad_top  - 0.1))
    bottom = int(round(pad_top  + 0.1))
    left   = int(round(pad_left - 0.1))
    right  = int(round(pad_left + 0.1))

    canvas = cv2.copyMakeBorder(
        resized, top, bottom, left, right,
        cv2.BORDER_CONSTANT, value=(114, 114, 114),
    )
    tensor = canvas[:, :, ::-1].transpose(2, 0, 1).astype(np.float32) / 255.0
    tensor = tensor[np.newaxis]   # [1, 3, H, W]
    return tensor, scale, pad_left, pad_top


def decode_tile(outputs, tile_h, tile_w, conf_thresh, lb_scale, pad_left, pad_top):
    """
    Decode YOLO output لـ tile واحد.
    يرجع الـ boxes بـ coordinates الـ tile (pixel space).
    """
    raw = outputs[0][0]               # [5, 8400] أو [8400, 5]
    if raw.shape[0] < raw.shape[1]:
        raw = raw.T                   # normalize → [8400, 5]

    boxes, scores = [], []
    for pred in raw:
        conf = float(pred[4])
        if conf < conf_thresh:
            continue

        cx, cy, bw, bh = pred[:4]

        # ── unletterbox: من 640-space إلى tile-space ──
        cx_t = (cx - pad_left) / lb_scale
        cy_t = (cy - pad_top)  / lb_scale
        bw_t = bw / lb_scale
        bh_t = bh / lb_scale

        x1 = int(cx_t - bw_t / 2)
        y1 = int(cy_t - bh_t / 2)
        x2 = int(cx_t + bw_t / 2)
        y2 = int(cy_t + bh_t / 2)

        # clamp داخل الـ tile
        x1 = max(0, min(tile_w, x1))
        y1 = max(0, min(tile_h, y1))
        x2 = max(0, min(tile_w, x2))
        y2 = max(0, min(tile_h, y2))

        if x2 <= x1 or y2 <= y1:
            continue

        # فلتر بسيط جداً — الـ YOLO confidence هو الفلتر الرئيسي
        area      = (x2 - x1) * (y2 - y1)
        tile_area = tile_h * tile_w
        if area < 30:                       # ضوضاء صغيرة جداً
            continue
        if area > tile_area * 0.95:         # يغطي الـ tile كله → FP
            continue

        boxes.append([x1, y1, x2, y2])
        scores.append(round(conf, 4))

    return boxes, scores

# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "status":       "running",
        "model_loaded": session is not None,
        "tile_size":    TILE_SIZE,
        "infer_dim":    INFER_DIM,
        "default_conf": DEFAULT_CONF,
        "memory_mb":    memory_usage(),
    }


@app.get("/debug")
def debug():
    return {
        "model_loaded": session is not None,
        "model_path":   str(MODEL_PATH),
        "memory_mb":    memory_usage(),
        "tile_size":    TILE_SIZE,
        "overlap":      OVERLAP,
        "infer_dim":    INFER_DIM,
    }


@app.get("/history")
def get_history(limit: int = 20):
    if inspections_col is None:
        return {"inspections": [], "total": 0}
    try:
        docs = list(
            inspections_col.find(
                {}, {"_id": 0}
            ).sort("timestamp", -1).limit(limit)
        )
        for d in docs:
            if isinstance(d.get("timestamp"), datetime):
                d["timestamp"] = d["timestamp"].isoformat()
        return {"inspections": docs, "total": inspections_col.count_documents({})}
    except PyMongoError as e:
        logger.error(f"History fetch error: {e}")
        return {"inspections": [], "total": 0}


@app.get("/stats")
def get_stats():
    if inspections_col is None:
        return {"total_inspections": 0, "db_connected": False}
    try:
        total = inspections_col.count_documents({})
        pipeline = [
            {"$group": {
                "_id":           None,
                "avg_count":     {"$avg": "$count"},
                "max_severity_counts": {"$push": "$max_severity"},
            }}
        ]
        agg = list(inspections_col.aggregate(pipeline))
        return {
            "total_inspections": total,
            "db_connected":      True,
            "avg_detections":    round(agg[0]["avg_count"], 2) if agg else 0,
        }
    except PyMongoError as e:
        logger.error(f"Stats error: {e}")
        return {"total_inspections": 0, "db_connected": False}


@app.post("/inspection/new")
def new_inspection():
    """
    يبدأ inspection جديد:
    - يحذف كل الداتا القديمة من MongoDB
    - يولد session_id جديد
    """
    import uuid
    global current_session_id

    new_sid = str(uuid.uuid4())

    if inspections_col is not None:
        try:
            result = inspections_col.delete_many({})
            logger.info(f"Cleared {result.deleted_count} old inspections")
        except PyMongoError as e:
            logger.error(f"MongoDB clear error: {e}")
            raise HTTPException(status_code=500, detail="Failed to clear old data")

    current_session_id = new_sid
    logger.info(f"New inspection started: {new_sid}")
    return {"session_id": new_sid, "message": "New inspection started. Old data cleared."}


@app.post("/predict")
async def predict(
    file:       UploadFile = File(...),
    confidence: float      = Form(DEFAULT_CONF, ge=0.0, le=1.0),
    iou:        float      = Form(DEFAULT_IOU,  ge=0.0, le=1.0),
):
    if session is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}",
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")
    if not verify_image_magic(contents):
        raise HTTPException(status_code=400, detail="Invalid image file")

    nparr = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    del contents, nparr
    gc.collect()

    if image is None:
        raise HTTPException(status_code=400, detail="Cannot decode image")

    original_h, original_w = image.shape[:2]

    # ── Step 1: scale down الصورة الكبيرة ──────────────────────────────────
    # نحتفظ بـ display_scale عشان نـremap الـ boxes للصورة الأصلية بعدين
    display_scale = 1.0
    if max(original_h, original_w) > INFER_DIM:
        display_scale = INFER_DIM / max(original_h, original_w)
        new_w = int(original_w * display_scale)
        new_h = int(original_h * display_scale)
        image = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
        logger.info(f"Resized {original_w}×{original_h} → {new_w}×{new_h} (scale={display_scale:.3f})")

    proc_h, proc_w = image.shape[:2]
    start_time = time.time()

    # ── Semaphore ────────────────────────────────────────────────────────────
    if not _inference_lock.acquire(blocking=False):
        del image
        gc.collect()
        raise HTTPException(status_code=429, detail="Server busy. Try again in a moment.")

    try:
        # ── Step 2: Tiling 256×256 ──────────────────────────────────────────
        stride = TILE_SIZE - OVERLAP
        all_boxes, all_scores = [], []

        for ty in range(0, proc_h, stride):
            for tx in range(0, proc_w, stride):
                # حواف الـ tile (نأخذ من الأخر لو الصورة أصغر من TILE_SIZE)
                ty2 = min(ty + TILE_SIZE, proc_h)
                tx2 = min(tx + TILE_SIZE, proc_w)
                ty1 = max(0, ty2 - TILE_SIZE)
                tx1 = max(0, tx2 - TILE_SIZE)

                tile = image[ty1:ty2, tx1:tx2]
                tile_h, tile_w = tile.shape[:2]

                # ── Step 3: Letterbox tile → 640×640 ────────────────────────
                tensor, lb_scale, pad_left, pad_top = letterbox(tile, model_imgsz)

                # ── Step 4: Inference ────────────────────────────────────────
                outputs = session.run(None, {input_name: tensor})

                # ── Step 5: Decode في tile-space ────────────────────────────
                t_boxes, t_scores = decode_tile(
                    outputs, tile_h, tile_w,
                    confidence, lb_scale, pad_left, pad_top,
                )

                # ── Step 6: Remap من tile-space → processed image space ─────
                for box in t_boxes:
                    all_boxes.append([
                        box[0] + tx1,
                        box[1] + ty1,
                        box[2] + tx1,
                        box[3] + ty1,
                    ])
                all_scores.extend(t_scores)

                del tensor, outputs, tile
            gc.collect()   # بعد كل row من الـ tiles

        # ── Step 7: Global NMS على الصورة الـ processed ─────────────────────
        boxes_final, scores_final = [], []
        if all_boxes:
            # IOU=0.30 صارم — يدمج الـ boxes المتداخلة من tiles متجاورة
            # لو استخدمنا iou الـ user (0.45) بيفضل boxes كتير لنفس الـ crack
            NMS_IOU = min(iou, 0.30)
            nms_in = [
                [b[0], b[1], b[2] - b[0], b[3] - b[1]]
                for b in all_boxes
            ]
            indices = cv2.dnn.NMSBoxes(nms_in, all_scores, confidence, NMS_IOU)
            if len(indices) > 0:
                for i in indices.flatten():
                    boxes_final.append(all_boxes[i])
                    scores_final.append(all_scores[i])

        del all_boxes, all_scores
        logger.info(f"Tiling done: {len(boxes_final)} detections after NMS")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Inference error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Inference failed. Please try again.")
    finally:
        _inference_lock.release()
        del image
        gc.collect()

    processing_ms = round((time.time() - start_time) * 1000)

    # ── Step 8: Remap من processed → original image space ───────────────────
    # display_scale = processed / original
    # لو display_scale=0.5 → الـ boxes بتيجي بنص الحجم → نضرب في (1/0.5)=2
    inv_scale = 1.0 / display_scale
    orig_boxes = []
    orig_scores_filtered = []
    for b, s in zip(boxes_final, scores_final):
        x1 = int(b[0] * inv_scale)
        y1 = int(b[1] * inv_scale)
        x2 = int(b[2] * inv_scale)
        y2 = int(b[3] * inv_scale)

        # clamp داخل حدود الصورة الأصلية
        x1 = max(0, min(original_w, x1))
        y1 = max(0, min(original_h, y1))
        x2 = max(0, min(original_w, x2))
        y2 = max(0, min(original_h, y2))

        # تجاهل الـ boxes اللي اتقلصت بعد الـ clamp
        if x2 <= x1 or y2 <= y1:
            continue

        orig_boxes.append([x1, y1, x2, y2])
        orig_scores_filtered.append(s)

    scores_final = orig_scores_filtered

    # ── Build detections ─────────────────────────────────────────────────────
    detections = [
        {
            "box":        box,
            "confidence": score,
            "class_id":   0,
            "class_name": "crack",
            "severity":   get_severity(score),
        }
        for box, score in zip(orig_boxes, scores_final)
    ]
    logger.info(f"Final detections after remap+clamp: {len(detections)}")

    severity_order = ["Low", "Moderate", "High", "Critical"]
    max_severity   = "Low"
    for d in detections:
        if severity_order.index(d["severity"]) > severity_order.index(max_severity):
            max_severity = d["severity"]

    # ── Save to MongoDB ───────────────────────────────────────────────────────
    if inspections_col is not None:
        try:
            inspections_col.insert_one({
                "session_id":           current_session_id,
                "timestamp":            datetime.now(timezone.utc),
                "filename":             file.filename or "unknown",
                "image_size":           {"width": original_w, "height": original_h},
                "display_scale":        display_scale,
                "count":                len(detections),
                "max_severity":         max_severity,
                "confidence_threshold": confidence,
                "iou_threshold":        iou,
                "processing_time_ms":   processing_ms,
                "detections":           detections,
            })
        except PyMongoError as e:
            logger.error(f"MongoDB save error: {e}")

    return {
        "detections":    detections,
        "count":         len(detections),
        "max_severity":  max_severity,
        "image_size":    {"width": original_w, "height": original_h},
        # display_scale=1.0 دايماً لأن الـ boxes اتـremap للصورة الأصلية هنا
        # الـ frontend مش محتاج يعمل أي تعديل
        "display_scale": 1.0,
        "session_id":    current_session_id,
        "memory_mb":     memory_usage(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Run
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False, workers=1)
