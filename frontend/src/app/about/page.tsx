"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────
interface GalleryImage {
  src: string;
  title: string;
  subtitle: string;
  description: string;
  badge?: { label: string; color: string };
}

// ── Image data ────────────────────────────────────────────────────────────────
const trainingImages: GalleryImage[] = [
  {
    src: "/project-images/train_batch0.jpg",
    title: "Training Batch 1",
    subtitle: "SDNET Dataset Samples",
    description:
      "Sample from the first training batch showing multiple concrete surface types (Walls W, Decks D, Pavements P) with ground truth bounding boxes marked in blue. Diverse lighting, angles, and texture are evident.",
    badge: { label: "Training Data", color: "bg-[#003d9b]/10 text-[#003d9b] border-[#003d9b]/20" },
  },
  {
    src: "/project-images/train_batch1.jpg",
    title: "Training Batch 2",
    subtitle: "Augmented Concrete Surfaces",
    description:
      "Second training batch highlights SDNET data diversity in concrete colors (gray, brown, white) and crack types. The model learns features generalizable to various real‑world conditions.",
    badge: { label: "Training Data", color: "bg-[#003d9b]/10 text-[#003d9b] border-[#003d9b]/20" },
  },
  {
    src: "/project-images/train_batch2.jpg",
    title: "Training Batch 3",
    subtitle: "Multi-surface Variety",
    description:
      "Third batch shows the three SDNET sections: Decks (D), Pavements (P), and Walls (W), including images without cracks (negative samples) to help the model learn not to raise false alerts.",
    badge: { label: "Training Data", color: "bg-[#003d9b]/10 text-[#003d9b] border-[#003d9b]/20" },
  },
];

const validationImages: GalleryImage[] = [
  {
    src: "/project-images/val_batch0_pred.jpg",
    title: "Validation Batch 1 — Predictions",
    subtitle: "Model Output on Unseen Data",
    description:
      "Model results on the validation set. Blue boxes with confidence scores appear above each detected crack. Notice detection accuracy even on subtle cracks and the model’s ability to ignore intact surfaces.",
    badge: { label: "Val Predictions", color: "bg-[#4f5f7b]/10 text-[#4f5f7b] border-[#4f5f7b]/20" },
  },
  {
    src: "/project-images/val_batch1_pred.jpg",
    title: "Validation Batch 2 — Predictions",
    subtitle: "High-confidence Detections",
    description:
      "Second validation batch shows high‑confidence detections (0.7 – 1.0). The model successfully distinguishes cracks from other surface defects, reflecting quality training on SDNET.",
    badge: { label: "Val Predictions", color: "bg-[#4f5f7b]/10 text-[#4f5f7b] border-[#4f5f7b]/20" },
  },
  {
    src: "/project-images/val_batch2_pred.jpg",
    title: "Validation Batch 3 — Predictions",
    subtitle: "Complex Scene Detection",
    description:
      "Complex scenes including uneven lighting and various surface colors. The model demonstrates its ability to detect subtle cracks even in difficult conditions, while maintaining a low false-positive rate.",
    badge: { label: "Val Predictions", color: "bg-[#4f5f7b]/10 text-[#4f5f7b] border-[#4f5f7b]/20" },
  },
];

const metricsImages: GalleryImage[] = [
  {
    src: "/project-images/results.png",
    title: "Training & Validation Curves",
    subtitle: "60 Epochs — Full Training History",
    description:
      "Comprehensive plots for 60 training epochs. Box Loss, Classification Loss, and DFL Loss steadily decrease indicating proper learning. Precision and Recall rise consistently to 0.88+ and 0.85+, while mAP@0.5 reaches 0.947 and mAP@0.5:0.95 reaches 0.94+.",
    badge: { label: "Key Metric: mAP@0.5 = 94.7%", color: "bg-[#003d9b]/10 text-[#003d9b] border-[#003d9b]/20" },
  },
  {
    src: "/project-images/BoxPR_curve.png",
    title: "Precision-Recall Curve",
    subtitle: "mAP@0.5 = 0.947",
    description:
      "Precision‑Recall curve shows exceptional performance: the model maintains Precision = 1.0 up to Recall ≈ 0.4, then gradually drops as Recall increases. Area under curve (mAP@0.5) = 0.947, an excellent result for crack detection.",
    badge: { label: "mAP@0.5 = 94.7%", color: "bg-[#003d9b]/10 text-[#003d9b] border-[#003d9b]/20" },
  },
  {
    src: "/project-images/BoxF1_curve.png",
    title: "F1-Confidence Curve",
    subtitle: "Best F1 = 0.87 at Conf. = 0.454",
    description:
      "F1‑Confidence curve. The model reaches its best F1‑Score = 0.87 at Confidence Threshold = 0.454, providing an optimal balance between Precision and Recall for production.",
    badge: { label: "Best F1 = 0.87 @ 0.454", color: "bg-[#7b2600]/10 text-[#7b2600] border-[#7b2600]/20" },
  },
  {
    src: "/project-images/confusion_matrix_normalized.png",
    title: "Confusion Matrix (Normalized)",
    subtitle: "Perfect Classification Rate",
    description:
      "Normalized confusion matrix shows perfect performance: 1.00 on both axes (crack←crack, background←background). The model makes no classification errors, resulting in 0% false‑positive rate.",
    badge: { label: "Accuracy = 100%", color: "bg-[#ba1a1a]/10 text-[#ba1a1a] border-[#ba1a1a]/20" },
  },
];

// ── Lightbox Component ────────────────────────────────────────────────────────
function Lightbox({
  image,
  onClose,
}: {
  image: GalleryImage;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#ffffff] rounded-2xl overflow-hidden max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start p-5 border-b border-[#c3c6d6]">
          <div>
            <h3 className="font-title-sm text-[#191c1d]">{image.title}</h3>
            <p className="font-body-sm text-[#434654] mt-0.5">{image.subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[#f3f4f5] text-[#434654] transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {/* Image */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-[#f8f9fa] p-4" style={{ minHeight: 300 }}>
          <img
            src={image.src}
            alt={image.title}
            className="max-w-full max-h-[55vh] object-contain rounded-lg"
          />
        </div>
        {/* Description */}
        <div className="p-5 border-t border-[#c3c6d6] bg-[#f8f9fa]">
          {image.badge && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border mb-3 ${image.badge.color}`}>
              {image.badge.label}
            </span>
          )}
          <p className="font-body-md text-[#434654] leading-relaxed">
            {image.description}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Image Card ────────────────────────────────────────────────────────────────
function ImageCard({
  image,
  onClick,
}: {
  image: GalleryImage;
  onClick: () => void;
}) {
  return (
    <div
      className="bg-[#ffffff] rounded-xl border border-[#c3c6d6]/50 shadow-sm overflow-hidden hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer group"
      onClick={onClick}
    >
      <div className="relative h-52 bg-[#edeeef] overflow-hidden">
        <img
          src={image.src}
          alt={image.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
          <span className="text-white font-body-sm flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">zoom_in</span>
            View Full Size
          </span>
        </div>
      </div>
      <div className="p-4">
        {image.badge && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border mb-2 ${image.badge.color}`}>
            {image.badge.label}
          </span>
        )}
        <h4 className="font-title-sm text-[#191c1d] mb-1 text-base">{image.title}</h4>
        <p className="font-body-sm text-[#434654] mb-2">{image.subtitle}</p>
        <p className="font-body-sm text-[#737685] line-clamp-2">
          {image.description}
        </p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AboutPage() {
  const [lightboxImage, setLightboxImage] = useState<GalleryImage | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "training" | "validation" | "metrics">(
    "overview"
  );

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: "info" },
    { id: "training" as const, label: "Training Data", icon: "school" },
    { id: "validation" as const, label: "Validation Results", icon: "verified" },
    { id: "metrics" as const, label: "Performance Metrics", icon: "bar_chart" },
  ];

  return (
    <>
      {/* Lightbox */}
      {lightboxImage && (
        <Lightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
      )}

      {/* Page Header */}
      <header className="flex justify-between items-center w-full px-6 h-16 z-30 sticky top-0 bg-[#ffffff] border-b border-[#c3c6d6] shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-lg hover:bg-[#f3f4f5] text-[#434654] transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h2 className="font-headline-md text-[#191c1d] hidden md:block">Project Details</h2>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/inspection"
            className="bg-[#003d9b] text-white px-4 py-2 rounded-lg font-body-md hover:bg-[#0052cc] transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">add_box</span>
            Try It Now
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* ── Hero Banner ─────────────────────────────────────────────────────── */}
        <div className="relative bg-[#003d9b] text-white overflow-hidden">
          {/* Background pattern */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.2) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          <div className="relative z-10 max-w-[1440px] mx-auto px-6 py-14 flex flex-col lg:flex-row gap-10 items-center">
            {/* Left text */}
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-6">
                <span className="material-symbols-outlined text-sm">science</span>
                <span className="font-label-caps">AI Research Project</span>
              </div>
              <h1 className="font-display-lg mb-4 leading-tight">
                Concrete Crack Detection<br />
                <span className="text-[#b2c5ff]">Using YOLOv11 + SDNET</span>
              </h1>
              <p className="font-body-md text-[#dae2ff] max-w-xl leading-relaxed mb-6">
                An advanced AI system for detecting and analyzing cracks in concrete structures using the latest YOLOv11 model trained on the standardized SDNET dataset.
              </p>
              {/* Stats Row */}
              <div className="flex flex-wrap gap-6">
                {[
                  { value: "94.7%", label: "mAP@0.5" },
                  { value: "0.87", label: "F1-Score" },
                  { value: "60", label: "Epochs" },
                  { value: "2", label: "Classes" },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <div className="font-display-lg text-white">{stat.value}</div>
                    <div className="font-label-caps text-[#b2c5ff]">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Right preview image */}
            <div className="w-full lg:w-[400px] rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl flex-shrink-0">
              <img
                src="/project-images/val_batch0_pred.jpg"
                alt="Model predictions preview"
                className="w-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* ── Tab Navigation ────────────────────────────────────────────────── */}
        <div className="sticky top-16 z-20 bg-[#ffffff] border-b border-[#c3c6d6] shadow-sm">
          <div className="max-w-[1440px] mx-auto px-6">
            <div className="flex gap-1 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-4 font-body-md whitespace-nowrap border-b-2 transition-all ${
                    activeTab === tab.id
                      ? "border-[#003d9b] text-[#003d9b] font-semibold"
                      : "border-transparent text-[#434654] hover:text-[#191c1d] hover:border-[#c3c6d6]"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Tab Content ───────────────────────────────────────────────────── */}
        <div className="max-w-[1440px] mx-auto px-6 py-8 pb-16">

          {/* ─ Overview Tab ─ */}
          {activeTab === "overview" && (
            <div className="flex flex-col gap-8">

              {/* Project Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-[#ffffff] rounded-xl border border-[#c3c6d6]/50 shadow-sm p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-[#003d9b]">description</span>
                    <h3 className="font-title-sm text-[#191c1d]">Project Summary</h3>
                  </div>
                  <div className="space-y-4 font-body-md text-[#434654] leading-relaxed">
                    <p>
                      This project aims to build a comprehensive system for automatic crack detection in concrete structures (bridges, tunnels, walls, pavements) using the <strong className="text-[#191c1d]">YOLOv11</strong> model, the latest real‑time object detection architecture.
                    </p>
                    <p>
                      The model was trained on the <strong className="text-[#191c1d]">SDNET2018</strong> dataset (Structural Defects Network) containing over 56,000 images of concrete surfaces, collected from two classes (crack and background) across three surface types: Decks, Pavements, and Walls.
                    </p>
                    <p>
                      The model achieved <strong className="text-[#003d9b]">mAP@0.5 = 94.7%</strong> and an F1‑Score of 0.87, making it suitable for real‑world Structural Health Monitoring applications.
                    </p>
                  </div>
                </div>

                {/* Tech Stack */}
                <div className="bg-[#ffffff] rounded-xl border border-[#c3c6d6]/50 shadow-sm p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-[#003d9b]">memory</span>
                    <h3 className="font-title-sm text-[#191c1d]">Tech Stack</h3>
                  </div>
                  <div className="space-y-3">
                    {[
                      { icon: "smart_toy", label: "AI Model", value: "YOLOv11 (Ultralytics)" },
                      { icon: "dataset", label: "Dataset", value: "SDNET2018" },
                      { icon: "fitness_center", label: "Epochs", value: "60 Epochs" },
                      { icon: "api", label: "Backend", value: "FastAPI + Python" },
                      { icon: "web", label: "Frontend", value: "Next.js 16 + TypeScript" },
                      { icon: "palette", label: "UI", value: "Tailwind CSS v4 + MD3" },
                      { icon: "cloud_upload", label: "Deployment", value: "Vercel + Railway" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-3 py-2 border-b border-[#c3c6d6]/30 last:border-0">
                        <span className="material-symbols-outlined text-sm text-[#003d9b]">{item.icon}</span>
                        <div className="flex-1">
                          <span className="font-label-caps text-[#737685] block">{item.label}</span>
                          <span className="font-data-mono text-[#191c1d] text-xs">{item.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Model Performance Cards */}
              <div>
                <h3 className="font-title-sm text-[#191c1d] mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#003d9b]">leaderboard</span>
                  Key Performance Metrics
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "mAP@0.5", value: "94.7%", icon: "target", color: "text-[#003d9b]", bg: "bg-[#dae2ff]", desc: "Mean Average Precision" },
                    { label: "mAP@0.5:0.95", value: "94.0%", icon: "analytics", color: "text-[#003d9b]", bg: "bg-[#dae2ff]", desc: "Strict AP Metric" },
                    { label: "F1-Score", value: "0.87", icon: "balance", color: "text-[#7b2600]", bg: "bg-[#ffdbcf]", desc: "@ Conf = 0.454" },
                    { label: "Precision", value: "88%+", icon: "verified", color: "text-[#4f5f7b]", bg: "bg-[#cdddff]", desc: "Peak Precision" },
                  ].map((m) => (
                    <div key={m.label} className="bg-[#ffffff] rounded-xl border border-[#c3c6d6]/50 shadow-sm p-5 flex flex-col gap-2">
                      <div className={`w-10 h-10 ${m.bg} rounded-lg flex items-center justify-center mb-1`}>
                        <span className={`material-symbols-outlined ${m.color}`}>{m.icon}</span>
                      </div>
                      <div className={`font-display-lg ${m.color}`}>{m.value}</div>
                      <div className="font-label-caps text-[#737685] uppercase">{m.label}</div>
                      <div className="font-body-sm text-[#434654]">{m.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SDNET Dataset Info */}
              <div className="bg-[#f3f4f5] rounded-xl border border-[#c3c6d6]/50 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-[#003d9b]">dataset</span>
                  <h3 className="font-title-sm text-[#191c1d]">About SDNET2018 Dataset</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {[
                    { label: "Deck (D) — Surfaces", count: "~17,000 images", desc: "Concrete deck surfaces for bridges and overpasses", icon: "view_in_ar" },
                    { label: "Pavement (P) — Pavements", count: "~16,000 images", desc: "Ground‑level concrete pavements", icon: "view_quilt" },
                    { label: "Wall (W) — Walls", count: "~20,000 images", desc: "Vertical concrete walls and interior surfaces", icon: "wall" },
                  ].map((cat) => (
                    <div key={cat.label} className="bg-[#ffffff] rounded-lg p-4 border border-[#c3c6d6]/50">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-sm text-[#003d9b]">{cat.icon}</span>
                        <span className="font-label-caps text-[#434654]">{cat.label}</span>
                      </div>
                      <div className="font-data-mono text-[#191c1d] font-semibold mb-1">{cat.count}</div>
                      <p className="font-body-sm text-[#737685]">{cat.desc}</p>
                    </div>
                  ))}
                </div>
                <p className="font-body-sm text-[#434654]">
                  The data was divided into images containing cracks (Cracked) and images without cracks (Uncracked),
                  helping the model learn to distinguish accurately between structural defects and intact surfaces.
                </p>
              </div>

              {/* Architecture Pipeline */}
              <div className="bg-[#ffffff] rounded-xl border border-[#c3c6d6]/50 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-5">
                  <span className="material-symbols-outlined text-[#003d9b]">account_tree</span>
                  <h3 className="font-title-sm text-[#191c1d]">System Architecture</h3>
                </div>
                <div className="flex flex-col md:flex-row items-center gap-3 flex-wrap justify-center">
                  {[
                    { icon: "image", label: "Input Image", sub: "JPG / PNG / TIFF", color: "bg-[#dae2ff] text-[#003d9b]" },
                    { icon: "arrow_forward", label: "", sub: "", color: "" },
                    { icon: "upload_file", label: "FastAPI Backend", sub: "/predict endpoint", color: "bg-[#edeeef] text-[#434654]" },
                    { icon: "arrow_forward", label: "", sub: "", color: "" },
                    { icon: "smart_toy", label: "YOLOv11 Model", sub: "best.pt (SDNET)", color: "bg-[#003d9b] text-white" },
                    { icon: "arrow_forward", label: "", sub: "", color: "" },
                    { icon: "data_object", label: "JSON Response", sub: "boxes + confidence", color: "bg-[#edeeef] text-[#434654]" },
                    { icon: "arrow_forward", label: "", sub: "", color: "" },
                    { icon: "web", label: "Next.js UI", sub: "Canvas Overlay", color: "bg-[#cdddff] text-[#4f5f7b]" },
                  ].map((step, i) =>
                    step.label === "" ? (
                      <span key={i} className="material-symbols-outlined text-[#c3c6d6] text-2xl hidden md:block">arrow_forward</span>
                    ) : (
                      <div key={i} className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl min-w-[120px] text-center ${step.color}`}>
                        <span className="material-symbols-outlined text-2xl">{step.icon}</span>
                        <span className="font-body-sm font-semibold">{step.label}</span>
                        <span className="font-label-caps opacity-70">{step.sub}</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ─ Training Data Tab ─ */}
          {activeTab === "training" && (
            <div className="flex flex-col gap-6">
              <div className="bg-[#f3f4f5] rounded-xl p-5 border border-[#c3c6d6]/50 flex items-start gap-3">
                <span className="material-symbols-outlined text-[#003d9b] mt-0.5">info</span>
                <div>
                  <h3 className="font-title-sm text-[#191c1d] mb-1">Training Data</h3>
                  <p className="font-body-md text-[#434654]">These images display the training batches with ground‑truth bounding boxes marked in blue. This data teaches the model to recognize cracks under diverse conditions.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {trainingImages.map((img) => (
                  <ImageCard key={img.src} image={img} onClick={() => setLightboxImage(img)} />
                ))}
              </div>
              {/* Labels image */}
              <div className="bg-[#ffffff] rounded-xl border border-[#c3c6d6]/50 shadow-sm p-6">
                <h3 className="font-title-sm text-[#191c1d] mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#003d9b]">label</span>
                  Labels Distribution
                </h3>
                <p className="font-body-sm text-[#434654] mb-4">
                  This chart shows the distribution of bounding box sizes and positions in the SDNET dataset.
                  Most cracks are located in mid-image regions with significant variation in sizes.
                </p>
                <div
                  className="rounded-lg overflow-hidden border border-[#c3c6d6]/50 cursor-pointer"
                  onClick={() => setLightboxImage({
                    src: "/project-images/labels.jpg",
                    title: "Labels Distribution",
                    subtitle: "SDNET Dataset Statistics",
                    description: "This chart shows the distribution of bounding box sizes and positions in the SDNET dataset. Most cracks are located in mid-image regions with significant size variation reflecting the diversity of crack types and depths.",
                  })}
                >
                  <img src="/project-images/labels.jpg" alt="Labels distribution" className="w-full object-contain max-h-64" />
                </div>
              </div>
            </div>
          )}

          {/* ─ Validation Tab ─ */}
          {activeTab === "validation" && (
            <div className="flex flex-col gap-6">
              <div className="bg-[#f3f4f5] rounded-xl p-5 border border-[#c3c6d6]/50 flex items-start gap-3">
                <span className="material-symbols-outlined text-[#4f5f7b] mt-0.5">verified</span>
                <div>
                  <h3 className="font-title-sm text-[#191c1d] mb-1">Validation Results</h3>
                  <p className="font-body-md text-[#434654]">
                    These images show the model's performance on unseen data. Blue boxes represent the model's predictions
                    with confidence scores. Higher confidence and accurate box alignment indicate better model performance.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {validationImages.map((img) => (
                  <ImageCard key={img.src} image={img} onClick={() => setLightboxImage(img)} />
                ))}
              </div>
            </div>
          )}

          {/* ─ Metrics Tab ─ */}
          {activeTab === "metrics" && (
            <div className="flex flex-col gap-6">
              <div className="bg-[#f3f4f5] rounded-xl p-5 border border-[#c3c6d6]/50 flex items-start gap-3">
                <span className="material-symbols-outlined text-[#7b2600] mt-0.5">bar_chart</span>
                <div>
                  <h3 className="font-title-sm text-[#191c1d] mb-1">Detailed Performance Metrics</h3>
                  <p className="font-body-md text-[#434654]">
                    Charts showing the model's performance progression during training and final results, including
                    Loss, Precision, Recall, F1 curves, and the Confusion Matrix.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {metricsImages.map((img) => (
                  <ImageCard key={img.src} image={img} onClick={() => setLightboxImage(img)} />
                ))}
              </div>

              {/* Detailed metrics table */}
              <div className="bg-[#ffffff] rounded-xl border border-[#c3c6d6]/50 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-[#c3c6d6]/30 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#003d9b]">table_chart</span>
                  <h3 className="font-title-sm text-[#191c1d]">Final Performance Metrics Table</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#f3f4f5] border-b border-[#c3c6d6]/30">
                        {["Metric", "Value", "Interpretation", "Verdict"].map((h) => (
                          <th key={h} className="px-5 py-3 font-label-caps text-[#737685] uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#c3c6d6]/30 font-body-md">
                      {[
                        { metric: "mAP@0.5", value: "94.7%", interp: "Mean Average Precision at IoU=0.5", verdict: "Excellent", vClass: "text-[#003d9b]" },
                        { metric: "mAP@0.5:0.95", value: "94.0%", interp: "Strict Average Precision", verdict: "Excellent", vClass: "text-[#003d9b]" },
                        { metric: "F1-Score", value: "0.87", interp: "Precision-Recall balance @ 0.454", verdict: "Very Good", vClass: "text-[#4f5f7b]" },
                        { metric: "Box Precision", value: "88%+", interp: "Bounding box position accuracy", verdict: "Very Good", vClass: "text-[#4f5f7b]" },
                        { metric: "Box Recall", value: "85%+", interp: "Crack detection rate", verdict: "Good", vClass: "text-[#4f5f7b]" },
                        { metric: "Confusion Matrix", value: "1.00 / 1.00", interp: "Zero classification errors", verdict: "Perfect", vClass: "text-[#003d9b]" },
                        { metric: "Training Epochs", value: "60", interp: "Total training cycles completed", verdict: "Adequate", vClass: "text-[#737685]" },
                        { metric: "Optimal Conf.", value: "0.454", interp: "Best confidence threshold for production", verdict: "Recommended", vClass: "text-[#7b2600]" },
                      ].map((row) => (
                        <tr key={row.metric} className="hover:bg-[#f8f9fa] transition-colors">
                          <td className="px-5 py-3 font-data-mono text-[#191c1d] font-semibold">{row.metric}</td>
                          <td className="px-5 py-3 font-data-mono text-[#003d9b] font-semibold">{row.value}</td>
                          <td className="px-5 py-3 text-[#434654]">{row.interp}</td>
                          <td className={`px-5 py-3 font-semibold ${row.vClass}`}>{row.verdict}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
