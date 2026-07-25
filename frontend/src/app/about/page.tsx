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
      "عينة من الدفعة الأولى للتدريب تُظهر أنواعاً متعددة من أسطح الخرسانة (جدران W، أسطح D، أرصفة P) مع صناديق Bounding Boxes الحقيقية (Ground Truth) المعلَّمة باللون الأزرق. يتضح تنوع الإضاءة والزوايا والملمس.",
    badge: { label: "Training Data", color: "bg-[#003d9b]/10 text-[#003d9b] border-[#003d9b]/20" },
  },
  {
    src: "/project-images/train_batch1.jpg",
    title: "Training Batch 2",
    subtitle: "Augmented Concrete Surfaces",
    description:
      "دفعة تدريب ثانية تُبرز تنوع بيانات SDNET من حيث ألوان الخرسانة (رمادي، بني، أبيض) وأنواع التشققات. يستخدم النموذج هذا التنوع لتعلّم ميزات قابلة للتعميم على ظروف حقيقية مختلفة.",
    badge: { label: "Training Data", color: "bg-[#003d9b]/10 text-[#003d9b] border-[#003d9b]/20" },
  },
  {
    src: "/project-images/train_batch2.jpg",
    title: "Training Batch 3",
    subtitle: "Multi-surface Variety",
    description:
      "الدفعة الثالثة تُظهر أقسام SDNET الثلاثة: Decks (D) وPavements (P) وWalls (W)، مع صور لا تشققات فيها (Negative samples) تساعد النموذج على تعلّم عدم إعطاء إنذارات كاذبة.",
    badge: { label: "Training Data", color: "bg-[#003d9b]/10 text-[#003d9b] border-[#003d9b]/20" },
  },
];

const validationImages: GalleryImage[] = [
  {
    src: "/project-images/val_batch0_pred.jpg",
    title: "Validation Batch 1 — Predictions",
    subtitle: "Model Output on Unseen Data",
    description:
      "نتائج النموذج على مجموعة التحقق. تظهر الصناديق الزرقاء مع نسبة الثقة (Confidence) فوق كل تشقق مكتشف. لاحظ دقة الاكتشاف حتى على التشققات الخفية وكيفية تجاهل النموذج للأسطح السليمة.",
    badge: { label: "Val Predictions", color: "bg-[#4f5f7b]/10 text-[#4f5f7b] border-[#4f5f7b]/20" },
  },
  {
    src: "/project-images/val_batch1_pred.jpg",
    title: "Validation Batch 2 — Predictions",
    subtitle: "High-confidence Detections",
    description:
      "الدفعة الثانية من التحقق تُظهر اكتشافات بثقة عالية (0.7 – 1.0). يُلاحظ أن النموذج نجح في تمييز التشققات عن العيوب السطحية الأخرى، مما يعكس جودة التدريب على SDNET.",
    badge: { label: "Val Predictions", color: "bg-[#4f5f7b]/10 text-[#4f5f7b] border-[#4f5f7b]/20" },
  },
  {
    src: "/project-images/val_batch2_pred.jpg",
    title: "Validation Batch 3 — Predictions",
    subtitle: "Complex Scene Detection",
    description:
      "مشاهد معقدة تتضمن إضاءة غير متجانسة وأسطح ذات ألوان مختلفة. يُثبت النموذج قدرته على اكتشاف التشققات الدقيقة حتى في الظروف الصعبة، مع الحفاظ على نسبة منخفضة من الإيجابيات الكاذبة.",
    badge: { label: "Val Predictions", color: "bg-[#4f5f7b]/10 text-[#4f5f7b] border-[#4f5f7b]/20" },
  },
];

const metricsImages: GalleryImage[] = [
  {
    src: "/project-images/results.png",
    title: "Training & Validation Curves",
    subtitle: "60 Epochs — Full Training History",
    description:
      "رسومات بيانية شاملة لـ 60 Epoch من التدريب. تُظهر Box Loss وClassification Loss وDFL Loss انخفاضاً متواصلاً يدل على تعلّم صحيح. أما Precision وRecall فترتفع بثبات إلى 0.88+ و0.85+، بينما يصل mAP@0.5 إلى 0.947 ومAP@0.5:0.95 إلى 0.94+.",
    badge: { label: "Key Metric: mAP@0.5 = 94.7%", color: "bg-[#003d9b]/10 text-[#003d9b] border-[#003d9b]/20" },
  },
  {
    src: "/project-images/BoxPR_curve.png",
    title: "Precision-Recall Curve",
    subtitle: "mAP@0.5 = 0.947",
    description:
      "منحنى Precision-Recall يُظهر أداءً استثنائياً: يحافظ النموذج على Precision = 1.0 حتى Recall ≈ 0.4، ثم ينخفض تدريجياً مع ارتفاع Recall. المساحة تحت المنحنى (mAP@0.5) = 0.947، وهي نتيجة ممتازة لمهمة اكتشاف التشققات.",
    badge: { label: "mAP@0.5 = 94.7%", color: "bg-[#003d9b]/10 text-[#003d9b] border-[#003d9b]/20" },
  },
  {
    src: "/project-images/BoxF1_curve.png",
    title: "F1-Confidence Curve",
    subtitle: "Best F1 = 0.87 at Conf. = 0.454",
    description:
      "منحنى F1 مقابل عتبة الثقة. يصل النموذج إلى أفضل F1-Score = 0.87 عند Confidence Threshold = 0.454. هذا يعني توازناً مثالياً بين Precision وRecall عند هذه العتبة — وهي العتبة الموصى بها للاستخدام في الإنتاج.",
    badge: { label: "Best F1 = 0.87 @ 0.454", color: "bg-[#7b2600]/10 text-[#7b2600] border-[#7b2600]/20" },
  },
  {
    src: "/project-images/confusion_matrix_normalized.png",
    title: "Confusion Matrix (Normalized)",
    subtitle: "Perfect Classification Rate",
    description:
      "مصفوفة الالتباس المعيارية تُظهر أداءً مثالياً: 1.00 على كلا المحورين (crack ← crack، background ← background). يعني ذلك أن النموذج لا يخطئ في تصنيف التشققات كـ background والعكس — معدل إيجابيات كاذبة = 0%.",
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
          <p className="font-body-md text-[#434654] leading-relaxed" dir="rtl">
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
            عرض بالحجم الكامل
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
        <p className="font-body-sm text-[#737685] line-clamp-2" dir="rtl">
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
    { id: "overview" as const, label: "نظرة عامة", icon: "info" },
    { id: "training" as const, label: "بيانات التدريب", icon: "school" },
    { id: "validation" as const, label: "نتائج التحقق", icon: "verified" },
    { id: "metrics" as const, label: "مقاييس الأداء", icon: "bar_chart" },
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
                نظام ذكاء اصطناعي متقدم لاكتشاف وتحليل التشققات في الهياكل الخرسانية باستخدام أحدث
                إصدار من YOLO (v11) المدرَّب على مجموعة بيانات SDNET المعيارية للهياكل الخرسانية.
              </p>
              {/* Stats Row */}
              <div className="flex flex-wrap gap-6">
                {[
                  { value: "94.7%", label: "mAP@0.5" },
                  { value: "0.87", label: "F1-Score" },
                  { value: "60", label: "Epochs" },
                  { value: "3 Classes", label: "SDNET Surfaces" },
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
                    <h3 className="font-title-sm text-[#191c1d]">ملخص المشروع</h3>
                  </div>
                  <div className="space-y-4 font-body-md text-[#434654] leading-relaxed" dir="rtl">
                    <p>
                      يهدف هذا المشروع إلى بناء نظام متكامل للكشف التلقائي عن التشققات في الهياكل الخرسانية
                      (الجسور، الأنفاق، الجدران، الأرصفة) باستخدام نموذج <strong className="text-[#191c1d]">YOLOv11</strong>،
                      وهو أحدث إصدار من عائلة نماذج YOLO للكشف عن الأجسام في الوقت الفعلي.
                    </p>
                    <p>
                      تم تدريب النموذج على مجموعة بيانات <strong className="text-[#191c1d]">SDNET2018</strong>
                      (Structural Defects Network) التي تحتوي على أكثر من 56,000 صورة لأسطح خرسانية
                      تم جمعها من ثلاثة أنواع من الهياكل: Decks (أسطح) وPavements (أرصفة) وWalls (جدران).
                    </p>
                    <p>
                      حقق النموذج <strong className="text-[#003d9b]">mAP@0.5 = 94.7%</strong> وF1-Score = 0.87،
                      مما يجعله مناسباً للاستخدام في تطبيقات المراقبة الهيكلية الفعلية (Structural Health Monitoring).
                    </p>
                  </div>
                </div>

                {/* Tech Stack */}
                <div className="bg-[#ffffff] rounded-xl border border-[#c3c6d6]/50 shadow-sm p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-[#003d9b]">memory</span>
                    <h3 className="font-title-sm text-[#191c1d]">التقنيات المستخدمة</h3>
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
                  مقاييس الأداء الرئيسية
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
                  <h3 className="font-title-sm text-[#191c1d]">عن مجموعة بيانات SDNET2018</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {[
                    { label: "Deck (D) — أسطح", count: "~17,000 صورة", desc: "أسطح خرسانية للجسور والطرق العلوية", icon: "view_in_ar" },
                    { label: "Pavement (P) — أرصفة", count: "~16,000 صورة", desc: "أرصفة وأسطح خرسانية على الأرض", icon: "view_quilt" },
                    { label: "Wall (W) — جدران", count: "~20,000 صورة", desc: "جدران خرسانية عمودية وأسطح داخلية", icon: "wall" },
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
                <p className="font-body-sm text-[#434654]" dir="rtl">
                  تم تقسيم البيانات إلى صور تحتوي على تشققات (Cracked) وصور بدون تشققات (Uncracked)،
                  مما يساعد النموذج على تعلّم التمييز الدقيق بين العيوب الهيكلية والأسطح السليمة.
                </p>
              </div>

              {/* Architecture Pipeline */}
              <div className="bg-[#ffffff] rounded-xl border border-[#c3c6d6]/50 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-5">
                  <span className="material-symbols-outlined text-[#003d9b]">account_tree</span>
                  <h3 className="font-title-sm text-[#191c1d]">معمارية النظام</h3>
                </div>
                <div className="flex flex-col md:flex-row items-center gap-3 flex-wrap justify-center">
                  {[
                    { icon: "image", label: "صورة الإدخال", sub: "JPG / PNG / TIFF", color: "bg-[#dae2ff] text-[#003d9b]" },
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
                <div dir="rtl">
                  <h3 className="font-title-sm text-[#191c1d] mb-1">بيانات التدريب</h3>
                  <p className="font-body-md text-[#434654]">
                    تُظهر هذه الصور دُفعات التدريب (Training Batches) مع صناديق Bounding Boxes الحقيقية (Ground Truth Labels)
                    باللون الأزرق. هذه البيانات هي ما يتعلم منها النموذج التعرف على التشققات في ظروف متنوعة.
                  </p>
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
                  توزيع التصنيفات والحجوم (Labels Distribution)
                </h3>
                <p className="font-body-sm text-[#434654] mb-4" dir="rtl">
                  يُظهر هذا الرسم البياني توزيع أحجام وتوضع Bounding Boxes في مجموعة بيانات SDNET.
                  يُلاحظ أن معظم التشققات تقع في مناطق متوسطة من الصورة مع تباين كبير في الأحجام.
                </p>
                <div
                  className="rounded-lg overflow-hidden border border-[#c3c6d6]/50 cursor-pointer"
                  onClick={() => setLightboxImage({
                    src: "/project-images/labels.jpg",
                    title: "Labels Distribution",
                    subtitle: "SDNET Dataset Statistics",
                    description: "يُظهر هذا الرسم البياني توزيع أحجام وتوضع Bounding Boxes في مجموعة بيانات SDNET. يُلاحظ أن معظم التشققات تقع في مناطق متوسطة من الصورة مع تباين كبير في الأحجام يعكس تنوع أنواع وأعماق التشققات.",
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
                <div dir="rtl">
                  <h3 className="font-title-sm text-[#191c1d] mb-1">نتائج التحقق (Validation Results)</h3>
                  <p className="font-body-md text-[#434654]">
                    هذه الصور تُظهر أداء النموذج على بيانات لم يرها خلال التدريب. الصناديق الزرقاء هي تنبؤات النموذج
                    مع نسبة الثقة. كلما ارتفعت نسبة الثقة واتطابقت الصناديق مع التشققات الفعلية، كان النموذج أفضل.
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
                <div dir="rtl">
                  <h3 className="font-title-sm text-[#191c1d] mb-1">مقاييس الأداء التفصيلية</h3>
                  <p className="font-body-md text-[#434654]">
                    رسومات بيانية تُظهر تطور أداء النموذج خلال التدريب ونتائجه النهائية. تشمل:
                    منحنيات Loss وPrecision وRecall وF1 ومصفوفة الالتباس.
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
                  <h3 className="font-title-sm text-[#191c1d]">جدول مقاييس الأداء النهائية</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#f3f4f5] border-b border-[#c3c6d6]/30">
                        {["المقياس", "القيمة", "التفسير", "الحكم"].map((h) => (
                          <th key={h} className="px-5 py-3 font-label-caps text-[#737685] uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#c3c6d6]/30 font-body-md">
                      {[
                        { metric: "mAP@0.5", value: "94.7%", interp: "متوسط الدقة عند IoU=0.5", verdict: "ممتاز", vClass: "text-[#003d9b]" },
                        { metric: "mAP@0.5:0.95", value: "94.0%", interp: "متوسط الدقة الصارم", verdict: "ممتاز", vClass: "text-[#003d9b]" },
                        { metric: "F1-Score", value: "0.87", interp: "توازن Precision-Recall @ 0.454", verdict: "جيد جداً", vClass: "text-[#4f5f7b]" },
                        { metric: "Box Precision", value: "88%+", interp: "دقة مواضع الصناديق", verdict: "جيد جداً", vClass: "text-[#4f5f7b]" },
                        { metric: "Box Recall", value: "85%+", interp: "نسبة اكتشاف التشققات", verdict: "جيد", vClass: "text-[#4f5f7b]" },
                        { metric: "Confusion Matrix", value: "1.00 / 1.00", interp: "لا أخطاء تصنيف نهائياً", verdict: "مثالي", vClass: "text-[#003d9b]" },
                        { metric: "Training Epochs", value: "60", interp: "عدد دورات التدريب الكاملة", verdict: "مناسب", vClass: "text-[#737685]" },
                        { metric: "Optimal Conf.", value: "0.454", interp: "أفضل عتبة ثقة للإنتاج", verdict: "موصى به", vClass: "text-[#7b2600]" },
                      ].map((row) => (
                        <tr key={row.metric} className="hover:bg-[#f8f9fa] transition-colors">
                          <td className="px-5 py-3 font-data-mono text-[#191c1d] font-semibold">{row.metric}</td>
                          <td className="px-5 py-3 font-data-mono text-[#003d9b] font-semibold">{row.value}</td>
                          <td className="px-5 py-3 text-[#434654]" dir="rtl">{row.interp}</td>
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
