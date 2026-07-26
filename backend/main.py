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
async def predict(
    file: UploadFile = File(...)
):

    image = None

    contents = None

    results = None


    print(
        "REQUEST START",
        memory_usage(),
        "MB"
    )


    try:


        if model is None:

            raise HTTPException(

                status_code=500,

                detail="Model not loaded"

            )



        # Read image

        contents = await file.read()


        print(
            "IMAGE SIZE:",
            len(contents),
            "bytes"
        )



        if len(contents) > MAX_FILE_SIZE:

            raise HTTPException(

                status_code=400,

                detail="Image larger than 5MB"

            )



        # Decode

        image_array = np.frombuffer(

            contents,

            np.uint8

        )


        image = cv2.imdecode(

            image_array,

            cv2.IMREAD_COLOR

        )


        if image is None:

            raise HTTPException(

                status_code=400,

                detail="Invalid image"

            )



        # Resize

        height, width = image.shape[:2]


        if max(height, width) > MAX_IMAGE_SIZE:


            scale = (

                MAX_IMAGE_SIZE /

                max(height, width)

            )


            image = cv2.resize(

                image,

                None,

                fx=scale,

                fy=scale,

                interpolation=cv2.INTER_AREA

            )



        print(
            "BEFORE YOLO:",
            memory_usage(),
            "MB"
        )



        # Inference

        with torch.no_grad():

            results = model.predict(

                source=image,

                conf=0.45,

                imgsz=416,

                device="cpu",

                verbose=False,

                half=False

            )



        print(
            "AFTER YOLO:",
            memory_usage(),
            "MB"
        )



        predictions = []



        for result in results:


            if result.boxes is None:

                continue



            for box in result.boxes:


                x1, y1, x2, y2 = (

                    box.xyxy[0]

                    .tolist()

                )


                confidence = float(

                    box.conf[0]

                )


                class_id = int(

                    box.cls[0]

                )



                predictions.append({

                    "box":[

                        round(x1,2),

                        round(y1,2),

                        round(x2,2),

                        round(y2,2)

                    ],

                    "confidence":round(

                        confidence,

                        4

                    ),

                    "class":model.names[class_id]

                })



        return {

            "filename":file.filename,

            "detections":len(predictions),

            "predictions":predictions

        }



    except HTTPException:

        raise



    except Exception as e:


        print(
            "PREDICT ERROR:",
            e
        )


        raise HTTPException(

            status_code=500,

            detail=str(e)

        )



    finally:


        image = None

        contents = None

        results = None


        gc.collect()


        print(

            "REQUEST END",

            memory_usage(),

            "MB"

        )



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
