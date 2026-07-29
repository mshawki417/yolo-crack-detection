// Types for YOLOv11 detection API responses

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Prediction {
  box: [number, number, number, number]; // [x1, y1, x2, y2]
  confidence: number;
  class: string;
}

export interface DetectionResult {
  filename: string;
  predictions: Prediction[];
  imageWidth?: number;
  imageHeight?: number;
  sessionId?: string;
}

export type Severity = "Critical" | "High" | "Moderate" | "Low";

export interface CrackAnnotation extends Prediction {
  id: string;
  severity: Severity;
  length_mm?: number;
  width_mm?: number;
  area_cm2?: number;
}

export interface InspectionRecord {
  id: string;
  date: string;
  filename: string;
  inputType: "Image" | "Video";
  crackCount: number;
  severity: Severity;
  confidence: number;
}

export interface AnalysisParams {
  confidence: number;
  iou: number;
  resolution: "native" | "1024" | "640";
  enableSAM: boolean;
}
