import { DetectionResult, AnalysisParams } from "@/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Raw shape coming from the FastAPI backend ──
interface BackendDetection {
  box: [number, number, number, number];
  confidence: number;
  class_id: number;
  class_name: string;
}

interface BackendResponse {
  detections: BackendDetection[];
  count: number;
  image_size: { width: number; height: number };
  scale_factor: number;
  memory_mb: number;
}

// ── Transform backend → frontend shape ──
function transformResponse(
  data: BackendResponse,
  filename: string
): DetectionResult {
  const s = data.scale_factor ?? 1.0;
  return {
    filename,
    predictions: data.detections.map((d) => ({
      box: [
        d.box[0] / s,
        d.box[1] / s,
        d.box[2] / s,
        d.box[3] / s,
      ] as [number, number, number, number],
      confidence: d.confidence,
      class: d.class_name,
    })),
    imageWidth:  Math.round(data.image_size.width  / s),
    imageHeight: Math.round(data.image_size.height / s),
  };
}

// ── Detect cracks with retry ──
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
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error("Failed after retries");
}

// ── Health check ──
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/`, { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}

// ── Warmup ──
export async function warmupBackend(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/`, { method: "GET" });
  } catch {
    // ignore
  }
}
