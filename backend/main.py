from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
import uvicorn
import cv2
import numpy as np
import os
import urllib.request
from pathlib import Path

app = FastAPI(title="YOLO Crack Detection API")

# ==========================
# Enable CORS
# ==========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # عدّلها لاحقًا إلى رابط Vercel
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================
# Model Configuration
# ==========================
MODEL_DIR = Path("model")
MODEL_NAME = "sdnet2018_crack_detect_yolov11m_best.pt"
MODEL_PATH = MODEL_DIR / MODEL_NAME

MODEL_DIR.mkdir(parents=True, exist_ok=True)

MODEL_URL = os.getenv("MODEL_URL")

# ==========================
# Download model if missing
# ==========================
if not MODEL_PATH.exists():

    if not MODEL_URL:
        raise RuntimeError(
            "MODEL_URL environment variable is not configured."
        )

    print("Downloading YOLO model...")

    urllib.request.urlretrieve(
        MODEL_URL,
        MODEL_PATH
    )

    print("Model downloaded successfully.")

# ==========================
# Load Model
# ==========================
try:
    model = YOLO(str(MODEL_PATH))
    print("YOLO model loaded successfully.")

except Exception as e:
    print(f"Failed to load model: {e}")
    model = None

# ==========================
# Health Check
# ==========================
@app.get("/")
def root():
    return {
        "status": "running",
        "message": "YOLO Crack Detection API"
    }

# ==========================
# Prediction Endpoint
# ==========================
@app.post("/predict")
async def predict(file: UploadFile = File(...)):

    if model is None:
        raise HTTPException(
            status_code=500,
            detail="Model is not loaded."
        )

    try:

        contents = await file.read()

        image = np.frombuffer(
            contents,
            np.uint8
        )

        image = cv2.imdecode(
            image,
            cv2.IMREAD_COLOR
        )

        results = model.predict(
            source=image,
            conf=0.45,
            verbose=False
        )

        predictions = []

        for result in results:

            if result.boxes is None:
                continue

            for box in result.boxes:

                x1, y1, x2, y2 = box.xyxy[0].tolist()

                confidence = float(box.conf[0])

                class_id = int(box.cls[0])

                label = model.names[class_id]

                predictions.append(
                    {
                        "box": [
                            round(x1, 2),
                            round(y1, 2),
                            round(x2, 2),
                            round(y2, 2),
                        ],
                        "confidence": round(confidence, 4),
                        "class": label,
                    }
                )

        return {
            "filename": file.filename,
            "detections": len(predictions),
            "predictions": predictions,
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

# ==========================
# Run Server
# ==========================
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
