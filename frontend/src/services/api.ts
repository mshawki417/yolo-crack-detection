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
  display_scale?: number;
  scale_factor?: number;    // ← backward compat
  memory_mb: number;
}

// ── Transform backend → frontend shape ──
// display_scale = نسبة الـ resize في الـ backend (مثلاً 0.5 لو الصورة اتقسمت لنص)
// الـ boxes بتيجي بـ coordinates الصورة الـ resized
// عشان نرسمهم صح على الصورة الـ original نضرب في (1 / display_scale)
function transformResponse(
  data: BackendResponse,
  filename: string
): DetectionResult {
  const rawScale = data.display_scale ?? data.scale_factor ?? 1.0;
  const factor = 1 / rawScale;
  return {
    filename,
    predictions: data.detections.map((d) => ({
      box: [
        d.box[0] * factor,
        d.box[1] * factor,
        d.box[2] * factor,
        d.box[3] * factor,
      ] as [number, number, number, number],
      confidence: d.confidence,
      class: d.class_name,
    })),
    // dimensions الصورة الـ original (قبل أي resize في الـ backend)
    imageWidth:  Math.round(data.image_size.width  * factor),
    imageHeight: Math.round(data.image_size.height * factor),
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
