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

from pathlib import Path


# Reduce PyTorch memory usage
torch.set_num_threads(1)


app = FastAPI(
    title="YOLO Crack Detection API"
)


# ==========================
# CORS
# ==========================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://yolo-crack-detection.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================
# Model Configuration
# ==========================

MODEL_DIR = Path("model")

MODEL_NAME = (
    "sdnet2018_crack_detect_yolov11m_best.pt"
)

MODEL_PATH = MODEL_DIR / MODEL_NAME


MODEL_DIR.mkdir(
    parents=True,
    exist_ok=True
)


MODEL_URL = os.getenv("MODEL_URL")


# ==========================
# Download Model
# ==========================

if not MODEL_PATH.exists():

    if not MODEL_URL:
        raise RuntimeError(
            "MODEL_URL environment variable is missing"
        )

    print("Downloading model...")

    urllib.request.urlretrieve(
        MODEL_URL,
        MODEL_PATH
    )

    print("Model downloaded successfully")


# ==========================
# Load YOLO
# ==========================

try:

    model = YOLO(
        str(MODEL_PATH)
    )

    # Evaluation mode
    model.model.eval()

    print(
        "YOLO model loaded successfully"
    )


except Exception as e:

    print(
        f"Model loading error: {e}"
    )

    model = None



# ==========================
# Limits
# ==========================

MAX_FILE_SIZE = (
    5 * 1024 * 1024
)

MAX_IMAGE_SIZE = 1280



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
# Prediction
# ==========================

@app.post("/predict")
async def predict(
    file: UploadFile = File(...)
):

    image = None
    contents = None
    results = None


    try:


        if model is None:

            raise HTTPException(
                status_code=500,
                detail="Model not loaded"
            )


        # Read file

        contents = await file.read()


        if len(contents) > MAX_FILE_SIZE:

            raise HTTPException(
                status_code=400,
                detail="Image size too large. Max 5MB"
            )


        # Decode image

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


        # Resize large images

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



        # YOLO inference

        results = model.predict(

            source=image,

            conf=0.45,

            imgsz=640,

            device="cpu",

            verbose=False

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


                label = model.names[
                    class_id
                ]



                predictions.append(

                    {
                        "box": [

                            round(x1, 2),

                            round(y1, 2),

                            round(x2, 2),

                            round(y2, 2)

                        ],

                        "confidence": round(
                            confidence,
                            4
                        ),

                        "class": label

                    }

                )



        return {

            "filename": file.filename,

            "detections": len(
                predictions
            ),

            "predictions": predictions

        }



    except HTTPException:

        raise



    except Exception as e:

        raise HTTPException(

            status_code=500,

            detail=str(e)

        )


    finally:


        # Release memory

        del image
        del contents
        del results


        gc.collect()



# ==========================
# Run
# ==========================

if __name__ == "__main__":


    uvicorn.run(

        "main:app",

        host="0.0.0.0",

        port=8000,

        reload=False,

        workers=1

    )
