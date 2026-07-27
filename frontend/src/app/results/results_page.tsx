"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { DetectionResult, Prediction, Severity } from "@/types";

// ─── Helpers ───────────────────────────────────────────────────────────────

function getSeverity(confidence: number): Severity {
  if (confidence >= 0.9) return "Critical";
  if (confidence >= 0.75) return "High";
  if (confidence >= 0.5) return "Moderate";
  return "Low";
}

function getSeverityStyle(severity: Severity) {
  switch (severity) {
    case "Critical": return { badge: "bg-[#ba1a1a]/10 text-[#ba1a1a] border-[#ba1a1a]/20", box: "#ba1a1a" };
    case "High":     return { badge: "bg-[#a33500]/10 text-[#a33500] border-[#a33500]/20", box: "#a33500" };
    case "Moderate": return { badge: "bg-[#4f5f7b]/10 text-[#4f5f7b] border-[#4f5f7b]/20", box: "#4f5f7b" };
    default:         return { badge: "bg-[#737685]/10 text-[#434654] border-[#737685]/20", box: "#737685" };
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface AnnotatedPrediction extends Prediction {
  id: string;
  severity: Severity;
  lengthMm: number;
  widthMm: number;
  areaCm2: number;
  isFalsePositive: boolean;
  note: string;
}

const mockResult: DetectionResult = {
  filename: "bridge_span_04_hd.jpg",
  predictions: [
    { box: [0.30 * 800, 0.20 * 600, 0.45 * 800, 0.78 * 600], confidence: 0.98, class: "crack" },
    { box: [0.60 * 800, 0.45 * 600, 0.72 * 800, 0.70 * 600], confidence: 0.84, class: "crack" },
  ],
};

// ─── Component ─────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const imgRef       = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [imageUrl, setImageUrl]               = useState<string | null>(null);
  const [result, setResult]                   = useState<DetectionResult>(mockResult);
  const [selectedId, setSelectedId]           = useState<string | null>(null);
  const [showBoxes, setShowBoxes]             = useState(true);
  const [imageDimensions, setImageDimensions] = useState({ w: 800, h: 600 });
  const [annotations, setAnnotations]         = useState<AnnotatedPrediction[]>([]);

  // Zoom & Pan
  const [zoom, setZoom]           = useState(1);
  const [pan, setPan]             = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart]   = useState({ x: 0, y: 0 });
  const [panMode, setPanMode]     = useState(false);

  // Modals
  const [noteModal, setNoteModal]     = useState<{ open: boolean; id: string; text: string }>({ open: false, id: "", text: "" });
  const [exportModal, setExportModal] = useState(false);

  // ── Load sessionStorage ──
  useEffect(() => {
    const storedResult = sessionStorage.getItem("detectionResult");
    const storedImage  = sessionStorage.getItem("detectionImageUrl");
    if (storedResult) setResult(JSON.parse(storedResult));
    if (storedImage)  setImageUrl(storedImage);
  }, []);

  // ── Build annotations ──
  useEffect(() => {
    const annotated = result.predictions.map((p, i) => {
      const [x1, y1, x2, y2] = p.box;
      const w = x2 - x1;
      const h = y2 - y1;
      const lengthMm = Math.round(Math.sqrt(w * w + h * h) * 0.3);
      const widthMm  = Math.round(Math.min(w, h) * 0.15);
      return {
        ...p,
        id: `C-${String(i + 1).padStart(3, "0")}`,
        severity: getSeverity(p.confidence),
        lengthMm,
        widthMm,
        areaCm2: parseFloat(((lengthMm * widthMm) / 100).toFixed(1)),
        isFalsePositive: false,
        note: "",
      };
    });
    setAnnotations(annotated);
    if (annotated.length > 0) setSelectedId(annotated[0].id);
  }, [result]);

  // ── Draw bounding boxes (letterbox-aware) ──
  const drawBoxes = useCallback(() => {
    const canvas    = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width  = container.clientWidth;
    canvas.height = container.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!showBoxes) return;

    const containerW = canvas.width;
    const containerH = canvas.height;
    const imgAspect  = imageDimensions.w / imageDimensions.h;
    const conAspect  = containerW / containerH;

    let renderedW: number, renderedH: number, offsetX: number, offsetY: number;
    if (imgAspect > conAspect) {
      renderedW = containerW;
      renderedH = containerW / imgAspect;
      offsetX   = 0;
      offsetY   = (containerH - renderedH) / 2;
    } else {
      renderedH = containerH;
      renderedW = containerH * imgAspect;
      offsetX   = (containerW - renderedW) / 2;
      offsetY   = 0;
    }

    const scaleX = renderedW / imageDimensions.w;
    const scaleY = renderedH / imageDimensions.h;

    annotations
      .filter((a) => !a.isFalsePositive)
      .forEach((ann) => {
        const [x1, y1, x2, y2] = ann.box;
        const style      = getSeverityStyle(ann.severity);
        const isSelected = ann.id === selectedId;

        const bx = offsetX + x1 * scaleX;
        const by = offsetY + y1 * scaleY;
        const bw = (x2 - x1) * scaleX;
        const bh = (y2 - y1) * scaleY;

        ctx.strokeStyle = style.box;
        ctx.lineWidth   = isSelected ? 3 : 2;
        if (isSelected) { ctx.shadowColor = style.box; ctx.shadowBlur = 6; }
        ctx.strokeRect(bx, by, bw, bh);
        ctx.shadowBlur = 0;

        const label = `${ann.id} ${(ann.confidence * 100).toFixed(0)}%`;
        ctx.font = "bold 11px 'JetBrains Mono', monospace";
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = style.box;
        ctx.fillRect(bx - 1, by - 22, tw + 12, 20);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, bx + 5, by - 6);
      });
  }, [annotations, showBoxes, imageDimensions, selectedId]);

  useEffect(() => { drawBoxes(); }, [drawBoxes]);

  useEffect(() => {
    const ro = new ResizeObserver(() => drawBoxes());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [drawBoxes]);

  // ── Zoom & Pan ──
  const handleZoomIn  = () => setZoom((z) => Math.min(z + 0.25, 4));
  const handleZoomOut = () => setZoom((z) => { const n = Math.max(z - 0.25, 1); if (n === 1) setPan({ x: 0, y: 0 }); return n; });
  const handleResetZoom = () => { setZoom(1); setPan({ x: 0, y: 0 }); setPanMode(false); };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!panMode) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  };
  const handleMouseUp = () => setIsPanning(false);

  // ── Export ──
  const handleExport = (format: "json" | "csv") => {
    const active = annotations.filter((a) => !a.isFalsePositive);
    let content: string, filename: string, type: string;
    if (format === "json") {
      content  = JSON.stringify({ filename: result.filename, detections: active }, null, 2);
      filename = `${result.filename}_results.json`;
      type     = "application/json";
    } else {
      const rows = [
        ["ID", "Class", "Severity", "Confidence", "x1", "y1", "x2", "y2", "Length(mm)", "Width(mm)", "Area(cm2)", "Note"],
        ...active.map((a) => [a.id, a.class, a.severity, `${(a.confidence * 100).toFixed(1)}%`, ...a.box.map((v) => Math.round(v)), a.lengthMm, a.widthMm, a.areaCm2, a.note]),
      ];
      content  = rows.map((r) => r.join(",")).join("\n");
      filename = `${result.filename}_results.csv`;
      type     = "text/csv";
    }
    const blob = new Blob([content], { type });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    setExportModal(false);
  };

  // ── False Positive ──
  const handleMarkFalsePositive = (id: string) =>
    setAnnotations((prev) => prev.map((a) => a.id === id ? { ...a, isFalsePositive: !a.isFalsePositive } : a));

  // ── Save Note ──
  const handleSaveNote = () => {
    setAnnotations((prev) => prev.map((a) => a.id === noteModal.id ? { ...a, note: noteModal.text } : a));
    setNoteModal({ open: false, id: "", text: "" });
  };

  // ── Derived ──
  const selectedAnnotation = annotations.find((a) => a.id === selectedId);
  const activeAnnotations  = annotations.filter((a) => !a.isFalsePositive);
  const maxSeverity = activeAnnotations.length > 0
    ? activeAnnotations.reduce((max, a) => {
        const order: Severity[] = ["Low", "Moderate", "High", "Critical"];
        return order.indexOf(a.severity) > order.indexOf(max) ? a.severity : max;
      }, "Low" as Severity)
    : "Low" as Severity;
  const totalLengthM = (activeAnnotations.reduce((sum, a) => sum + a.lengthMm, 0) / 1000).toFixed(2);

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden">

      {/* Mobile Header */}
      <div className="md:hidden flex justify-between items-center w-full px-6 h-16 z-50 bg-white border-b border-[#c3c6d6] shadow-sm">
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
          <div className="bg-white/10 backdrop-blur-md border border-[#c3c6d6]/30 text-white rounded-lg px-4 py-2 flex items-center gap-4 shadow-sm">
            <span className="font-data-mono font-bold truncate max-w-[180px]">{result.filename}</span>
            <span className="w-px h-4 bg-[#c3c6d6]/50" />
            <span className="font-body-sm text-[#d9dadb]">{activeAnnotations.length} detection(s)</span>
          </div>
          <div className="flex gap-2">
            <button onClick={handleZoomIn} title="Zoom In"
              className="w-10 h-10 rounded-lg bg-white/10 backdrop-blur-md border border-[#c3c6d6]/30 text-white flex items-center justify-center hover:bg-white/20 transition-colors">
              <span className="material-symbols-outlined">zoom_in</span>
            </button>
            <button onClick={handleZoomOut} title="Zoom Out"
              className="w-10 h-10 rounded-lg bg-white/10 backdrop-blur-md border border-[#c3c6d6]/30 text-white flex items-center justify-center hover:bg-white/20 transition-colors">
              <span className="material-symbols-outlined">zoom_out</span>
            </button>
            <button
              onClick={() => zoom > 1 ? setPanMode((p) => !p) : handleResetZoom()}
              title={panMode ? "Exit Pan" : zoom > 1 ? "Pan Mode" : "Reset View"}
              className={`w-10 h-10 rounded-lg backdrop-blur-md border border-[#c3c6d6]/30 text-white flex items-center justify-center transition-colors ${panMode ? "bg-[#003d9b]" : "bg-white/10 hover:bg-white/20"}`}>
              <span className="material-symbols-outlined">{zoom > 1 ? "pan_tool" : "fit_screen"}</span>
            </button>
          </div>
        </div>

        {zoom > 1 && (
          <div className="absolute top-16 right-4 z-10 bg-black/50 text-white text-xs px-2 py-1 rounded font-data-mono">
            {Math.round(zoom * 100)}%
          </div>
        )}

        {/* Image + Canvas */}
        <div
          ref={containerRef}
          className="relative w-full h-full flex items-center justify-center overflow-hidden"
          style={{ cursor: panMode ? (isPanning ? "grabbing" : "grab") : "default" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: isPanning ? "none" : "transform 0.15s ease",
            width: "100%", height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={imgRef}
                src={imageUrl}
                alt="Inspection"
                className="max-w-full max-h-full object-contain select-none"
                draggable={false}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setImageDimensions({ w: img.naturalWidth, h: img.naturalHeight });
                }}
              />
            ) : (
              <div className="absolute inset-0 bg-cover bg-center opacity-60"
                style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBVhkVqJrtxeekFSJJMJgUXeEtE_kpmYKCHxzexBQmeVl0UASUjGjxi-L5UlBGr9S8zg2NUo-WZzgrI_fjKD06s5FL2V_3-zhLRBsZNikdrs7ayHCLLs8hFzFOs9rQn7v1ajkteKxHLdNHFGkoc1yOckpMqDIzwJiozztqko0haH9rPlzY4dkkGcDUu47fkKsJEdfx_Gb4sHVl_fh8B04FdneUudRWomvQyvuakNyuscag5LRYH89cGU2BGt6W_ExTYwp_A7kjhbDQc')" }}
              />
            )}
          </div>
          <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ width: "100%", height: "100%" }} />
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-4 bg-white/10 backdrop-blur-md border border-[#c3c6d6]/30 rounded-full px-6 py-2 shadow-sm">
          <label className="flex items-center gap-2 text-white font-body-sm cursor-pointer select-none">
            <input type="checkbox" checked={showBoxes} onChange={(e) => setShowBoxes(e.target.checked)}
              className="rounded border-[#c3c6d6]/50 bg-transparent text-[#003d9b] focus:ring-[#003d9b]" />
            Show Bounding Boxes
          </label>
          {zoom > 1 && (
            <button onClick={handleResetZoom} className="text-white/70 hover:text-white text-xs underline">Reset View</button>
          )}
        </div>
      </section>

      {/* ─── Right: Data Panel ─── */}
      <aside className="w-full md:w-[450px] lg:w-[500px] h-[50vh] md:h-full bg-white border-l border-[#c3c6d6] flex flex-col flex-shrink-0 z-20 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)]">

        {/* Panel Header */}
        <div className="px-6 py-4 border-b border-[#c3c6d6] flex justify-between items-center bg-[#f8f9fa]">
          <div>
            <h2 className="font-title-sm font-semibold text-[#191c1d]">Detected Anomalies</h2>
            <p className="font-body-sm text-[#434654]">{activeAnnotations.length} instance(s) found</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setExportModal(true)}
              className="text-[#003d9b] hover:bg-[#003d9b]/10 p-2 rounded-lg transition-colors flex items-center gap-1 font-body-md">
              <span className="material-symbols-outlined text-[20px]">download</span> Export
            </button>
            <Link href="/inspection"
              className="text-[#003d9b] hover:bg-[#003d9b]/10 p-2 rounded-lg transition-colors flex items-center gap-1 font-body-md">
              <span className="material-symbols-outlined text-[20px]">add</span> New
            </Link>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-px bg-[#c3c6d6]/30 border-b border-[#c3c6d6]">
          <div className="bg-white p-4">
            <div className="font-label-caps text-[#434654] uppercase mb-1">Total Crack Length</div>
            <div className="font-display-lg font-bold text-[#191c1d] flex items-baseline gap-1">
              {totalLengthM}<span className="font-body-sm text-[#434654] font-normal">m</span>
            </div>
          </div>
          <div className="bg-white p-4">
            <div className="font-label-caps text-[#434654] uppercase mb-1">Max Severity</div>
            <div className={`font-title-sm font-bold flex items-center gap-2 ${getSeverityStyle(maxSeverity).badge.split(" ").find((c) => c.startsWith("text-")) || "text-[#191c1d]"}`}>
              <span className="material-symbols-outlined text-[20px]">{maxSeverity === "Critical" ? "warning" : "info"}</span>
              {maxSeverity}
            </div>
          </div>
        </div>

        {/* Detection Table */}
        <div className="flex-1 overflow-auto bg-white">
          {annotations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[#434654] gap-4 p-8">
              <span className="material-symbols-outlined text-5xl text-[#c3c6d6]">search_off</span>
              <p className="font-title-sm text-center">No cracks detected</p>
              <p className="font-body-sm text-center">Try lowering the confidence threshold.</p>
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
                  const style      = getSeverityStyle(ann.severity);
                  const isSelected = ann.id === selectedId;
                  return (
                    <tr key={ann.id} onClick={() => setSelectedId(ann.id)}
                      className={`cursor-pointer transition-colors border-l-4 ${ann.isFalsePositive ? "opacity-40" : ""} ${isSelected ? "bg-[#003d9b]/5 border-l-[#003d9b] hover:bg-[#003d9b]/10" : "border-l-transparent hover:bg-[#f3f4f5]"}`}>
                      <td className={`px-4 py-3 font-data-mono font-medium ${isSelected ? "text-[#003d9b]" : "text-[#434654]"}`}>{ann.id}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${style.badge}`}>{ann.severity}</span>
                      </td>
                      <td className={`px-4 py-3 font-data-mono text-right ${isSelected ? "text-[#191c1d]" : "text-[#434654]"}`}>{(ann.confidence * 100).toFixed(0)}%</td>
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
          <div className="border-t border-[#c3c6d6] p-4 flex flex-col bg-[#f8f9fa]" style={{ height: "240px" }}>
            <h3 className="font-title-sm font-semibold text-[#191c1d] mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#003d9b]">info</span>
              Details: {selectedAnnotation.id}
              {selectedAnnotation.isFalsePositive && (
                <span className="ml-auto text-xs bg-[#ba1a1a]/10 text-[#ba1a1a] px-2 py-0.5 rounded">False Positive</span>
              )}
            </h3>
            <div className="flex-1 overflow-auto pr-2 space-y-2">
              {[
                { label: "Detection Model",            value: "YOLOv11-SDNET-v1" },
                { label: "Class",                      value: selectedAnnotation.class },
                { label: "Coordinates (x1,y1,x2,y2)", value: selectedAnnotation.box.map((v) => Math.round(v)).join(", ") },
                { label: "Confidence Score",           value: `${(selectedAnnotation.confidence * 100).toFixed(1)}%` },
                { label: "Severity Level",             value: selectedAnnotation.severity },
                ...(selectedAnnotation.note ? [{ label: "Note", value: selectedAnnotation.note }] : []),
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center py-1 border-b border-[#c3c6d6]/30">
                  <span className="font-body-sm text-[#434654]">{row.label}</span>
                  <span className="font-data-mono text-[#191c1d] text-right max-w-[60%] truncate">{row.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => handleMarkFalsePositive(selectedAnnotation.id)}
                className={`flex-1 border py-2 rounded-lg font-body-md transition-colors ${selectedAnnotation.isFalsePositive ? "bg-[#003d9b] text-white border-[#003d9b]" : "bg-white border-[#c3c6d6] text-[#191c1d] hover:bg-[#f3f4f5]"}`}>
                {selectedAnnotation.isFalsePositive ? "Restore Detection" : "Mark False Positive"}
              </button>
              <button
                onClick={() => setNoteModal({ open: true, id: selectedAnnotation.id, text: selectedAnnotation.note })}
                className="flex-1 bg-[#003d9b] text-white py-2 rounded-lg font-body-md hover:opacity-90 transition-opacity">
                {selectedAnnotation.note ? "Edit Note" : "Add Note"}
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* ─── Export Modal ─── */}
      {exportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm flex flex-col gap-4">
            <h3 className="font-title-sm font-semibold text-[#191c1d]">Export Results</h3>
            <p className="font-body-sm text-[#434654]">Choose format:</p>
            <div className="flex gap-3">
              <button onClick={() => handleExport("json")}
                className="flex-1 border border-[#c3c6d6] rounded-lg py-3 font-title-sm text-[#191c1d] hover:bg-[#f3f4f5] transition-colors flex flex-col items-center gap-1">
                <span className="material-symbols-outlined text-[#003d9b]">data_object</span>JSON
              </button>
              <button onClick={() => handleExport("csv")}
                className="flex-1 border border-[#c3c6d6] rounded-lg py-3 font-title-sm text-[#191c1d] hover:bg-[#f3f4f5] transition-colors flex flex-col items-center gap-1">
                <span className="material-symbols-outlined text-[#003d9b]">table_view</span>CSV
              </button>
            </div>
            <button onClick={() => setExportModal(false)} className="font-body-sm text-[#434654] hover:text-[#191c1d] underline text-center">Cancel</button>
          </div>
        </div>
      )}

      {/* ─── Note Modal ─── */}
      {noteModal.open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm flex flex-col gap-4">
            <h3 className="font-title-sm font-semibold text-[#191c1d]">Note — {noteModal.id}</h3>
            <textarea
              value={noteModal.text}
              onChange={(e) => setNoteModal((m) => ({ ...m, text: e.target.value }))}
              placeholder="Add inspection notes, maintenance recommendations..."
              className="w-full border border-[#c3c6d6] rounded-lg p-3 font-body-md text-[#191c1d] resize-none focus:outline-none focus:ring-2 focus:ring-[#003d9b]"
              rows={4}
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setNoteModal({ open: false, id: "", text: "" })}
                className="flex-1 border border-[#c3c6d6] rounded-lg py-2 font-body-md text-[#191c1d] hover:bg-[#f3f4f5] transition-colors">Cancel</button>
              <button onClick={handleSaveNote}
                className="flex-1 bg-[#003d9b] text-white rounded-lg py-2 font-body-md hover:opacity-90 transition-opacity">Save Note</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
