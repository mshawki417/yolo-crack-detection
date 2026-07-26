"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { detectCracks } from "@/services/api";
import { AnalysisParams, DetectionResult } from "@/types";

type InputMode = "image" | "video";
type UploadStatus = "idle" | "dragging" | "uploading" | "ready" | "analyzing" | "error";

export default function InspectionPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inputMode, setInputMode] = useState<InputMode>("image");
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState(0);

  const [params, setParams] = useState<AnalysisParams>({
    confidence: 0.75,
    iou: 0.45,
    resolution: "1024",
    enableSAM: true,
  });

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const acceptedTypes = inputMode === "image"
    ? "image/jpeg,image/png,image/tiff,image/webp"
    : "video/mp4,video/avi,video/mov";

  const handleFile = useCallback((file: File) => {
    const maxSizeMB = 500;
    if (file.size > maxSizeMB * 1024 * 1024) {
      setErrorMsg(`File too large. Max size: ${maxSizeMB}MB`);
      setUploadStatus("error");
      return;
    }
    setErrorMsg("");
    setSelectedFile(file);

    // Create preview URL
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));

    // Simulate upload progress to backend (fast local connection)
    setUploadStatus("uploading");
    let progress = 0;
    const timer = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(timer);
        setUploadStatus("ready");
      }
      setUploadProgress(Math.min(progress, 100));
    }, 100);
  }, [previewUrl]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setUploadStatus("idle");
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setUploadStatus("idle");
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleStartAnalysis = async () => {
    if (!selectedFile) return;
    setUploadStatus("analyzing");
    setErrorMsg("");

    try {
      const result: DetectionResult = await detectCracks(selectedFile, {
        confidence: params.confidence,
        iou: params.iou,
      });
      // Store result in sessionStorage, navigate to results page
      sessionStorage.setItem("detectionResult", JSON.stringify(result));
      sessionStorage.setItem("detectionImageUrl", base64Image);
      router.push("/results");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analysis failed. Check if the backend server is running.";
      setErrorMsg(msg);
      setUploadStatus("error");
    }
  };

  return (
    <>
      {/* Mobile Header */}
      <header className="md:hidden flex justify-between items-center w-full px-4 h-16 z-50 bg-[#ffffff] shadow-sm">
        <h1 className="font-title-sm text-[#003d9b]">CrackDetect AI</h1>
        <span className="material-symbols-outlined cursor-pointer text-[#003d9b]">notifications</span>
      </header>

      {/* Main Content with grid background */}
      <div className="flex-1 bg-grid-pattern flex flex-col">
        <div className="p-4 md:p-6 flex-1 flex flex-col lg:flex-row gap-6 max-w-[1440px] mx-auto w-full">
          
          {/* ─── Left Column: Upload & Preview ─── */}
          <div className="flex-1 flex flex-col gap-6">
            {/* Page Header */}
            <div className="flex flex-col gap-1">
              <h2 className="font-headline-md text-[#191c1d]">New Inspection Media</h2>
              <p className="font-body-md text-[#434654]">
                Upload drone imagery or video for structural crack analysis.
              </p>
            </div>

            {/* Upload Card */}
            <div className="bg-[#ffffff] rounded-xl shadow-sm p-6 flex flex-col flex-1 border border-[#c3c6d6]/50">
              
              {/* Image / Video Toggle */}
              <div className="flex bg-[#edeeef] rounded-lg p-1 w-fit mb-6">
                {(["image", "video"] as InputMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => { setInputMode(mode); handleRemoveFile(); }}
                    className={`px-4 py-1.5 rounded font-title-sm flex items-center gap-2 transition-all ${
                      inputMode === mode
                        ? "bg-[#ffffff] shadow-sm text-[#191c1d]"
                        : "text-[#434654] hover:text-[#191c1d]"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {mode === "image" ? "image" : "videocam"}
                    </span>
                    {mode === "image" ? "Image" : "Video"}
                  </button>
                ))}
              </div>

              {/* Drag & Drop Zone */}
              {uploadStatus === "idle" && (
                <div
                  className="border-2 border-dashed border-[#c3c6d6] rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-[#003d9b] hover:bg-[#f3f4f5] transition-colors cursor-pointer group mb-6 flex-1 min-h-[240px]"
                  onDragOver={(e) => { e.preventDefault(); setUploadStatus("dragging"); }}
                  onDragLeave={() => setUploadStatus("idle")}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-16 h-16 bg-[#0052cc]/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-3xl text-[#003d9b]">cloud_upload</span>
                  </div>
                  <h3 className="font-title-sm text-[#191c1d] mb-2">Drag & Drop Media</h3>
                  <p className="font-body-sm text-[#434654] max-w-[250px]">
                    Supported formats: {inputMode === "image" ? "JPG, PNG, TIFF" : "MP4, AVI, MOV"}. Max size: 500MB.
                  </p>
                  <button className="mt-4 px-4 py-2 border border-[#737685] text-[#191c1d] rounded-lg font-title-sm hover:bg-[#edeeef] transition-colors">
                    Browse Files
                  </button>
                </div>
              )}

              {/* Dragging state */}
              {uploadStatus === "dragging" && (
                <div
                  className="border-2 border-dashed border-[#003d9b] bg-[#dae2ff]/30 rounded-xl p-8 flex flex-col items-center justify-center text-center mb-6 flex-1 min-h-[240px]"
                  onDragOver={(e) => e.preventDefault()}
                  onDragLeave={() => setUploadStatus("idle")}
                  onDrop={handleDrop}
                >
                  <span className="material-symbols-outlined text-5xl text-[#003d9b] mb-2">file_present</span>
                  <p className="font-title-sm text-[#003d9b]">Drop to upload</p>
                </div>
              )}

              {/* Preview & Progress */}
              {(uploadStatus === "uploading" || uploadStatus === "ready" || uploadStatus === "analyzing") && selectedFile && previewUrl && (
                <div className="mb-6 flex flex-col gap-3">
                  {/* File Preview */}
                  <div className="rounded-lg overflow-hidden border border-[#c3c6d6] relative group">
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 z-10">
                      <button
                        onClick={handleRemoveFile}
                        className="w-10 h-10 bg-[#ffffff] rounded-full flex items-center justify-center text-[#191c1d] hover:text-[#ba1a1a] transition-colors shadow-md"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                    <div className="h-48 w-full bg-[#e7e8e9] relative">
                      {inputMode === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previewUrl}
                          alt={selectedFile.name}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-6xl text-[#737685]">play_circle</span>
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2 bg-[#2e3132]/80 text-[#f0f1f2] font-data-mono px-2 py-1 rounded text-xs">
                        {selectedFile.name}
                      </div>
                    </div>
                    {/* Progress Bar */}
                    {uploadStatus === "uploading" && (
                      <div className="h-1.5 w-full bg-[#e1e3e4] relative">
                        <div
                          className="h-full bg-[#003d9b] transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        >
                          <div className="absolute right-0 -top-6 bg-[#003d9b] text-white font-data-mono text-[10px] px-1 rounded transform translate-x-1/2">
                            {Math.round(uploadProgress)}%
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  {uploadStatus === "ready" && (
                    <div className="flex items-center gap-2 text-[#4f5f7b]">
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      <span className="font-body-sm">Ready to Analyze</span>
                    </div>
                  )}
                  {uploadStatus === "analyzing" && (
                    <div className="flex items-center gap-2 text-[#003d9b]">
                      <span className="material-symbols-outlined text-sm animate-spin">autorenew</span>
                      <span className="font-body-sm">Running AI Analysis…</span>
                    </div>
                  )}

                  {/* Drop another file */}
                  <button
                    onClick={() => { handleRemoveFile(); }}
                    className="text-sm text-[#003d9b] hover:underline self-start"
                  >
                    Change file
                  </button>
                </div>
              )}

              {/* Error state */}
              {uploadStatus === "error" && (
                <div className="mb-6 p-4 rounded-lg bg-[#ffdad6] border border-[#ba1a1a]/20 flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#ba1a1a]">error</span>
                  <div>
                    <p className="font-body-sm font-semibold text-[#93000a]">Error</p>
                    <p className="font-body-sm text-[#93000a]">{errorMsg}</p>
                  </div>
                  <button onClick={() => { setUploadStatus("idle"); setErrorMsg(""); }} className="ml-auto text-[#93000a]">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept={acceptedTypes}
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          {/* ─── Right Column: Analysis Parameters ─── */}
          <div className="w-full lg:w-[320px] xl:w-[380px] flex flex-col gap-6">
            <div className="bg-[#ffffff] rounded-xl shadow-sm p-6 border border-[#c3c6d6]/50 flex flex-col">
              
              {/* Panel Header */}
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-[#c3c6d6]/50">
                <span className="material-symbols-outlined text-[#434654]">tune</span>
                <h3 className="font-title-sm text-[#191c1d]">Analysis Parameters</h3>
              </div>

              <div className="space-y-6 flex-1">
                {/* Confidence Threshold */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="font-label-caps text-[#434654]">CONFIDENCE THRESHOLD</label>
                    <span className="font-data-mono text-[#003d9b] bg-[#0052cc]/10 px-1.5 py-0.5 rounded">
                      {params.confidence.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={params.confidence}
                    onChange={(e) => setParams({ ...params, confidence: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-[#e1e3e4] rounded-lg appearance-none cursor-pointer accent-[#003d9b]"
                  />
                  <div className="flex justify-between mt-1 font-body-sm text-[10px] text-[#737685]">
                    <span>Loose</span><span>Strict</span>
                  </div>
                </div>

                {/* IoU Threshold */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="font-label-caps text-[#434654]">IOU THRESHOLD</label>
                    <span className="font-data-mono text-[#003d9b] bg-[#0052cc]/10 px-1.5 py-0.5 rounded">
                      {params.iou.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={params.iou}
                    onChange={(e) => setParams({ ...params, iou: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-[#e1e3e4] rounded-lg appearance-none cursor-pointer accent-[#003d9b]"
                  />
                  <div className="flex justify-between mt-1 font-body-sm text-[10px] text-[#737685]">
                    <span>Overlap</span><span>Distinct</span>
                  </div>
                </div>

                {/* Resolution */}
                <div>
                  <label className="font-label-caps text-[#434654] block mb-2">INFERENCE RESOLUTION</label>
                  <div className="relative">
                    <select
                      value={params.resolution}
                      onChange={(e) => setParams({ ...params, resolution: e.target.value as AnalysisParams["resolution"] })}
                      className="w-full bg-[#f8f9fa] appearance-none border border-[#c3c6d6] text-[#191c1d] font-body-md rounded-lg focus:ring-[#003d9b] focus:border-[#003d9b] block p-2.5"
                    >
                      <option value="native">Native (Original)</option>
                      <option value="1024">1024px (Optimized)</option>
                      <option value="640">640px (Fast)</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#434654]">
                      <span className="material-symbols-outlined text-sm">expand_more</span>
                    </div>
                  </div>
                </div>

                {/* SAM Toggle */}
                <div className="flex items-center justify-between pt-4">
                  <span className="font-body-md text-[#191c1d]">Enable Segment Anything (SAM)</span>
                  <button
                    onClick={() => setParams({ ...params, enableSAM: !params.enableSAM })}
                    className={`w-9 h-5 rounded-full relative transition-colors ${
                      params.enableSAM ? "bg-[#003d9b]" : "bg-[#c3c6d6]"
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] shadow-sm transition-transform ${
                        params.enableSAM ? "right-[3px]" : "left-[3px]"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Start Analysis Button */}
              <div className="mt-8 pt-6 border-t border-[#c3c6d6]/50">
                <button
                  onClick={handleStartAnalysis}
                  disabled={uploadStatus !== "ready"}
                  className={`w-full py-3.5 px-4 rounded-xl font-title-sm flex items-center justify-center gap-2 shadow-sm transition-all ${
                    uploadStatus === "ready"
                      ? "bg-[#003d9b] hover:bg-[#003d9b]/90 text-white hover:shadow-md active:scale-95"
                      : "bg-[#c3c6d6] text-[#737685] cursor-not-allowed"
                  }`}
                >
                  <span className="material-symbols-outlined">memory</span>
                  {uploadStatus === "analyzing" ? "Analyzing…" : "Start AI Analysis"}
                </button>
                {uploadStatus !== "ready" && uploadStatus !== "analyzing" && (
                  <p className="text-center font-body-sm text-[#737685] mt-2">
                    Upload a file first to enable analysis
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
