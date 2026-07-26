from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from ultralytics import YOLO

import uvicorn
import cv2
import numpy as np
import os
import urllib.request
import gc
import torch
import psutil

from pathlib import Path


# =====================================
# Optimize CPU Memory
# =====================================

torch.set_num_threads(1)


app = FastAPI(
    title="YOLO Crack Detection API",
    version="1.0"
)


# =====================================
# CORS
# =====================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "https://yolo-crack-detection.vercel.app",
    ],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)



# =====================================
# Model Setup
# =====================================

MODEL_DIR = Path("model")

MODEL_NAME = "sdnet2018_crack_detect_yolov11m_best.pt"

MODEL_PATH = MODEL_DIR / MODEL_NAME


MODEL_DIR.mkdir(
    exist_ok=True
)


MODEL_URL = os.getenv(
    "MODEL_URL"
)



# =====================================
# Download Model
# =====================================

if not MODEL_PATH.exists():

    if not MODEL_URL:

        raise RuntimeError(
            "MODEL_URL is missing"
        )


    print("Downloading model...")


    urllib.request.urlretrieve(
        MODEL_URL,
        MODEL_PATH
    )


    print("Model downloaded")



# =====================================
# Load Model Once
# =====================================

model = None


try:

    model = YOLO(
        str(MODEL_PATH)
    )


    model.model.eval()


    print(
        "YOLO model loaded successfully"
    )


except Exception as e:

    print(
        "MODEL LOAD ERROR:",
        e
    )



# =====================================
# Limits
# =====================================

MAX_FILE_SIZE = 5 * 1024 * 1024

MAX_IMAGE_SIZE = 1280



# =====================================
# Memory Logger
# =====================================

def memory_usage():

    process = psutil.Process(
        os.getpid()
    )

    return round(
        process.memory_info().rss / 1024 / 1024,
        2
    )



# =====================================
# Health
# =====================================

@app.get("/")
def root():

    return {

        "status": "running",

        "model_loaded": model is not None,

        "memory_mb": memory_usage()

    }



# =====================================
# Prediction
# =====================================

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    print("PREDICT ENDPOINT REACHED")
    return {
        "message": "Endpoint works"
    }


# =====================================
# Run Production
# =====================================

if __name__ == "__main__":


    uvicorn.run(

        "main:app",

        host="0.0.0.0",

        port=8000,

        reload=False,

        workers=1,

        timeout_keep_alive=120

    )
