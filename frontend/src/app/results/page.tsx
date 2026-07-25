"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { DetectionResult, Prediction, Severity } from "@/types";

// Determine severity from confidence
function getSeverity(confidence: number): Severity {
  if (confidence >= 0.9) return "Critical";
  if (confidence >= 0.75) return "High";
  if (confidence >= 0.5) return "Moderate";
  return "Low";
}

// Map severity to colors
function getSeverityStyle(severity: Severity) {
  switch (severity) {
    case "Critical": return { badge: "bg-[#ba1a1a]/10 text-[#ba1a1a] border-[#ba1a1a]/20", box: "#ba1a1a", label: "#ba1a1a" };
    case "High": return { badge: "bg-[#a33500]/10 text-[#a33500] border-[#a33500]/20", box: "#a33500", label: "#a33500" };
    case "Moderate": return { badge: "bg-[#4f5f7b]/10 text-[#4f5f7b] border-[#4f5f7b]/20", box: "#4f5f7b", label: "#4f5f7b" };
    default: return { badge: "bg-[#737685]/10 text-[#434654] border-[#737685]/20", box: "#737685", label: "#434654" };
  }
}

interface AnnotatedPrediction extends Prediction {
  id: string;
  severity: Severity;
  lengthMm: number;
  widthMm: number;
  areaCm2: number;
}

// Mock data for when no backend result is available
const mockResult: DetectionResult = {
  filename: "bridge_span_04_hd.jpg",
  predictions: [
    { box: [0.30 * 800, 0.20 * 600, 0.45 * 800, 0.78 * 600], confidence: 0.98, class: "crack" },
    { box: [0.60 * 800, 0.45 * 600, 0.72 * 800, 0.70 * 600], confidence: 0.84, class: "crack" },
  ],
};

export default function ResultsPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [result, setResult] = useState<DetectionResult>(mockResult);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showBoxes, setShowBoxes] = useState(true);
  const [imageDimensions, setImageDimensions] = useState({ w: 800, h: 600 });

  // Annotated predictions derived from raw
  const [annotations, setAnnotations] = useState<AnnotatedPrediction[]>([]);

  useEffect(() => {
    // Load result from sessionStorage (set by inspection page)
    const storedResult = sessionStorage.getItem("detectionResult");
    const storedImage = sessionStorage.getItem("detectionImageUrl");
    if (storedResult) {
      setResult(JSON.parse(storedResult));
    }
    if (storedImage) {
      setImageUrl(storedImage);
    }
  }, []);

  // Build annotated predictions when result changes
  useEffect(() => {
    const annotated = result.predictions.map((p, i) => {
      const [x1, y1, x2, y2] = p.box;
      const w = x2 - x1;
      const h = y2 - y1;
      const lengthMm = Math.round(Math.sqrt(w * w + h * h) * 0.3);
      const widthMm = Math.round(Math.min(w, h) * 0.15);
      return {
        ...p,
        id: `C-${String(i + 1).padStart(3, "0")}`,
        severity: getSeverity(p.confidence),
        lengthMm,
        widthMm,
        areaCm2: parseFloat(((lengthMm * widthMm) / 100).toFixed(1)),
      };
    });
    setAnnotations(annotated);
    if (annotated.length > 0) setSelectedId(annotated[0].id);
  }, [result]);

  // Draw bounding boxes on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!showBoxes) return;

    annotations.forEach((ann) => {
      const [x1, y1, x2, y2] = ann.box;
      const style = getSeverityStyle(ann.severity);
      const scaleX = canvas.width / imageDimensions.w;
      const scaleY = canvas.height / imageDimensions.h;

      ctx.strokeStyle = style.box;
      ctx.lineWidth = 2;
      ctx.strokeRect(x1 * scaleX, y1 * scaleY, (x2 - x1) * scaleX, (y2 - y1) * scaleY);

      // Label background
      ctx.fillStyle = style.box;
      const label = `${ann.id} ${(ann.confidence * 100).toFixed(0)}%`;
      ctx.font = "bold 11px 'JetBrains Mono', monospace";
      const tw = ctx.measureText(label).width;
      ctx.fillRect(x1 * scaleX - 1, y1 * scaleY - 22, tw + 12, 20);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, x1 * scaleX + 5, y1 * scaleY - 6);
    });
  }, [annotations, showBoxes, imageDimensions]);

  const selectedAnnotation = annotations.find((a) => a.id === selectedId);
  const maxSeverity = annotations.length > 0
    ? annotations.reduce((max, a) => {
        const order: Severity[] = ["Low", "Moderate", "High", "Critical"];
        return order.indexOf(a.severity) > order.indexOf(max) ? a.severity : max;
      }, "Low" as Severity)
    : ("Low" as Severity);
  const totalLengthM = (annotations.reduce((sum, a) => sum + a.lengthMm, 0) / 1000).toFixed(2);

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden flex justify-between items-center w-full px-6 h-16 z-50 bg-[#ffffff] border-b border-[#c3c6d6] shadow-sm">
        <div className="font-title-sm font-bold text-[#003d9b]">CrackDetect AI</div>
        <div className="flex items-center gap-2 text-[#003d9b]">
          <span className="material-symbols-outlined cursor-pointer">notifications</span>
          <span className="material-symbols-outlined cursor-pointer">help</span>
        </div>
      </div>

      {/* ─── Left: Image Viewer ─── */}
      <section className="flex-1 flex flex-col bg-[#2e3132] h-[50vh] md:h-full relative overflow-hidden">
        {/* Toolbar */}
        <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-center">
          <div className="bg-[#ffffff]/10 backdrop-blur-md border border-[#c3c6d6]/30 text-white rounded-lg px-4 py-2 flex items-center gap-4 shadow-sm">
            <span className="font-data-mono font-bold">{result.filename}</span>
            <span className="w-px h-4 bg-[#c3c6d6]/50"></span>
            <span className="font-body-sm text-[#d9dadb]">{annotations.length} detection(s)</span>
          </div>
          <div className="flex gap-2">
            {["zoom_in", "zoom_out", "pan_tool"].map((icon) => (
              <button
                key={icon}
                className="w-10 h-10 rounded-lg bg-[#ffffff]/10 backdrop-blur-md border border-[#c3c6d6]/30 text-white flex items-center justify-center hover:bg-[#ffffff]/20 transition-colors"
              >
                <span className="material-symbols-outlined">{icon}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Image + Canvas Overlay */}
        <div className="relative w-full h-full flex items-center justify-center" id="viewer-container">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="Inspection"
              className="max-w-full max-h-full object-contain"
              onLoad={(e) => {
                const img = e.currentTarget;
                setImageDimensions({ w: img.naturalWidth, h: img.naturalHeight });
              }}
            />
          ) : (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage:
                  "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBVhkVqJrtxeekFSJJMJgUXeEtE_kpmYKCHxzexBQmeVl0UASUjGjxi-L5UlBGr9S8zg2NUo-WZzgrI_fjKD06s5FL2V_3-zhLRBsZNikdrs7ayHCLLs8hFzFOs9rQn7v1ajkteKxHLdNHFGkoc1yOckpMqDIzwJiozztqko0haH9rPlzY4dkkGcDUu47fkKsJEdfx_Gb4sHVl_fh8B04FdneUudRWomvQyvuakNyuscag5LRYH89cGU2BGt6W_ExTYwp_A7kjhbDQc')",
              }}
            />
          )}
          <canvas
            ref={canvasRef}
            width={imageDimensions.w}
            height={imageDimensions.h}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-4 bg-[#ffffff]/10 backdrop-blur-md border border-[#c3c6d6]/30 rounded-full px-6 py-2 shadow-sm">
          <label className="flex items-center gap-2 text-white font-body-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showBoxes}
              onChange={(e) => setShowBoxes(e.target.checked)}
              className="rounded border-[#c3c6d6]/50 bg-transparent text-[#003d9b] focus:ring-[#003d9b]"
            />
            Show Bounding Boxes
          </label>
        </div>
      </section>

      {/* ─── Right: Data Panel ─── */}
      <aside className="w-full md:w-[450px] lg:w-[500px] h-[50vh] md:h-full bg-[#ffffff] border-l border-[#c3c6d6] flex flex-col flex-shrink-0 z-20 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)]">
        {/* Panel Header */}
        <div className="px-6 py-4 border-b border-[#c3c6d6] flex justify-between items-center bg-[#f8f9fa]">
          <div>
            <h2 className="font-title-sm font-semibold text-[#191c1d]">Detected Anomalies</h2>
            <p className="font-body-sm text-[#434654]">
              {annotations.length} instance(s) found
            </p>
          </div>
          <div className="flex gap-2">
            <button className="text-[#003d9b] hover:bg-[#003d9b]/10 p-2 rounded-lg transition-colors flex items-center gap-1 font-body-md">
              <span className="material-symbols-outlined text-[20px]">download</span> Export
            </button>
            <Link
              href="/inspection"
              className="text-[#003d9b] hover:bg-[#003d9b]/10 p-2 rounded-lg transition-colors flex items-center gap-1 font-body-md"
            >
              <span className="material-symbols-outlined text-[20px]">add</span> New
            </Link>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-px bg-[#c3c6d6]/30 border-b border-[#c3c6d6]">
          <div className="bg-[#ffffff] p-4">
            <div className="font-label-caps text-[#434654] uppercase mb-1">Total Crack Length</div>
            <div className="font-display-lg font-bold text-[#191c1d] flex items-baseline gap-1">
              {totalLengthM} <span className="font-body-sm text-[#434654] font-normal">m</span>
            </div>
          </div>
          <div className="bg-[#ffffff] p-4">
            <div className="font-label-caps text-[#434654] uppercase mb-1">Max Severity</div>
            <div className={`font-title-sm font-bold flex items-center gap-2 ${getSeverityStyle(maxSeverity).badge.split(" ").find(c => c.startsWith("text-")) || "text-[#191c1d]"}`}>
              <span className="material-symbols-outlined text-[20px]">
                {maxSeverity === "Critical" ? "warning" : "info"}
              </span>
              {maxSeverity}
            </div>
          </div>
        </div>

        {/* Detection Table */}
        <div className="flex-1 overflow-auto bg-[#ffffff]">
          {annotations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[#434654] gap-4 p-8">
              <span className="material-symbols-outlined text-5xl text-[#c3c6d6]">search_off</span>
              <p className="font-title-sm text-center">No cracks detected</p>
              <p className="font-body-sm text-center">Try lowering the confidence threshold and running the analysis again.</p>
              <Link href="/inspection" className="text-[#003d9b] font-body-md hover:underline">← Back to Inspection</Link>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#f3f4f5] border-b border-[#c3c6d6] z-10">
                <tr>
                  {["ID", "Severity", "Conf.", "L (mm)", "W (mm)", "Area (cm²)"].map((h, i) => (
                    <th key={h} className={`px-4 py-3 font-label-caps text-[#434654] uppercase ${i >= 2 ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-body-md divide-y divide-[#c3c6d6]/50">
                {annotations.map((ann) => {
                  const style = getSeverityStyle(ann.severity);
                  const isSelected = ann.id === selectedId;
                  return (
                    <tr
                      key={ann.id}
                      onClick={() => setSelectedId(ann.id)}
                      className={`cursor-pointer transition-colors border-l-4 ${
                        isSelected
                          ? "bg-[#003d9b]/5 border-l-[#003d9b] hover:bg-[#003d9b]/10"
                          : "border-l-transparent hover:bg-[#f3f4f5]"
                      }`}
                    >
                      <td className={`px-4 py-3 font-data-mono font-medium ${isSelected ? "text-[#003d9b]" : "text-[#434654]"}`}>{ann.id}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${style.badge}`}>
                          {ann.severity}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-data-mono text-right ${isSelected ? "text-[#191c1d]" : "text-[#434654]"}`}>
                        {(ann.confidence * 100).toFixed(0)}%
                      </td>
                      <td className={`px-4 py-3 font-data-mono text-right ${isSelected ? "text-[#191c1d]" : "text-[#434654]"}`}>{ann.lengthMm}</td>
                      <td className={`px-4 py-3 font-data-mono text-right ${isSelected ? "text-[#191c1d]" : "text-[#434654]"}`}>{ann.widthMm}</td>
                      <td className={`px-4 py-3 font-data-mono text-right ${isSelected ? "text-[#191c1d]" : "text-[#434654]"}`}>{ann.areaCm2}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Property Inspector */}
        {selectedAnnotation && (
          <div className="border-t border-[#c3c6d6] p-4 flex flex-col bg-[#f8f9fa]" style={{ height: "220px" }}>
            <h3 className="font-title-sm font-semibold text-[#191c1d] mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#003d9b]">info</span>
              Details: {selectedAnnotation.id}
            </h3>
            <div className="flex-1 overflow-auto pr-2 space-y-2">
              {[
                { label: "Detection Model", value: "YOLOv11-SDNET-v1" },
                { label: "Class", value: selectedAnnotation.class },
                { label: "Coordinates (x1,y1,x2,y2)", value: selectedAnnotation.box.map(v => Math.round(v)).join(", ") },
                { label: "Confidence Score", value: `${(selectedAnnotation.confidence * 100).toFixed(1)}%` },
                { label: "Severity Level", value: selectedAnnotation.severity },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center py-1 border-b border-[#c3c6d6]/30">
                  <span className="font-body-sm text-[#434654]">{row.label}</span>
                  <span className="font-data-mono text-[#191c1d]">{row.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button className="flex-1 bg-[#ffffff] border border-[#c3c6d6] text-[#191c1d] py-2 rounded-lg font-body-md hover:bg-[#f3f4f5] transition-colors">
                Mark False Positive
              </button>
              <button className="flex-1 bg-[#003d9b] text-white py-2 rounded-lg font-body-md hover:opacity-90 transition-opacity">
                Add Note
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
