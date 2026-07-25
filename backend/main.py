from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
import uvicorn
import io
import cv2
import numpy as np

app = FastAPI(title="YOLO Crack Detection API")

# Allow CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins, adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the YOLO model (ensure you place best.pt in the model folder)
try:
    model = YOLO("model/sdnet2018_crack_detect_yolov11m_best.pt")
except Exception as e:
    print(f"Warning: Model not found or failed to load. {e}")
    model = None

@app.get("/")
def read_root():
    return {"message": "YOLO Crack Detection API is running. Send POST request to /predict."}

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if model is None:
        raise HTTPException(status_code=500, detail="Model is not loaded.")
        
    try:
        # Read the image file
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Run inference (Using optimal confidence threshold 0.454 ~ 0.45)
        results = model.predict(source=img, conf=0.45)
        
        # Extract predictions
        predictions = []
        for result in results:
            boxes = result.boxes
            for box in boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                cls = int(box.cls[0])
                label = model.names[cls]
                
                predictions.append({
                    "box": [x1, y1, x2, y2],
                    "confidence": conf,
                    "class": label
                })
                
        return {"filename": file.filename, "predictions": predictions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
