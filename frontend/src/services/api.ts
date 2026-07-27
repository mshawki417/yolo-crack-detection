import { DetectionResult, AnalysisParams } from "@/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Raw shape coming from the FastAPI backend ──
interface BackendDetection {
  box: [number, number, number, number]; // [x1, y1, x2, y2]
  confidence: number;
  class_id: number;
  class_name: string;
}

interface BackendResponse {
  detections: BackendDetection[];
  count: number;
  image_size: { width: number; height: number };
  memory_mb: number;
}

// ── Transform backend → frontend shape ──
function transformResponse(
  data: BackendResponse,
  filename: string
): DetectionResult {
  return {
    filename,
    predictions: data.detections.map((d) => ({
      box: d.box,
      confidence: d.confidence,
      class: d.class_name,
    })),
    imageWidth: data.image_size.width,
    imageHeight: data.image_size.height,
  };
}

export async function detectCracks(
  file: File,
  params?: Partial<AnalysisParams>
): Promise<DetectionResult> {
  const formData = new FormData();
  formData.append("file", file);

  if (params?.confidence !== undefined)
    formData.append("confidence", params.confidence.toString());
  if (params?.iou !== undefined)
    formData.append("iou", params.iou.toString());

  const response = await fetch(`${API_BASE_URL}/predict`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API Error: ${response.statusText}`);
  }

  const raw: BackendResponse = await response.json();
  return transformResponse(raw, file.name);
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/`, { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}

export async function warmupBackend(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/`, { method: "GET" });
  } catch {
    // ignore
  }
}
interface BackendResponse {
  detections: BackendDetection[];
  count: number;
  image_size: { width: number; height: number };
  scale_factor: number;   // ← أضف
  memory_mb: number;
}
export async function detectCracks(
  file: File,
  params?: Partial<AnalysisParams>
): Promise<DetectionResult> {
  const formData = new FormData();
  formData.append("file", file);
  if (params?.confidence !== undefined)
    formData.append("confidence", params.confidence.toString());
  if (params?.iou !== undefined)
    formData.append("iou", params.iou.toString());

  // retry مرتين في حالة فشل الـ request
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(`${API_BASE_URL}/predict`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `API Error: ${response.statusText}`);
      }
      const raw: BackendResponse = await response.json();
      return transformResponse(raw, file.name);
    } catch (err) {
      if (attempt === 2) throw err;
      await new Promise(r => setTimeout(r, 1000)); // انتظر ثانية قبل الـ retry
    }
  }
  throw new Error("Failed after retries");
}
function transformResponse(data: BackendResponse, filename: string): DetectionResult {
  const s = data.scale_factor ?? 1.0;  // ← اعكس الـ scale
  return {
    filename,
    predictions: data.detections.map((d) => ({
      box: [
        d.box[0] / s,   // x1
        d.box[1] / s,   // y1
        d.box[2] / s,   // x2
        d.box[3] / s,   // y2
      ] as [number, number, number, number],
      confidence: d.confidence,
      class: d.class_name,
    })),
    imageWidth:  Math.round(data.image_size.width  / s),
    imageHeight: Math.round(data.image_size.height / s),
  };
}
