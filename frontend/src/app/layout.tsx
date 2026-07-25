import "./globals.css";
import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "CrackDetect AI — Enterprise SHM Platform",
  description:
    "AI-powered structural crack detection and analysis platform using YOLOv11 trained on SDNET dataset.",
  keywords: ["crack detection", "YOLO", "structural health monitoring", "concrete analysis", "AI"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" />
      </head>
      <body className="h-full bg-[#f8f9fa] text-[#191c1d] antialiased flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 md:ml-[280px] h-full overflow-y-auto bg-[#f8f9fa]">
          {children}
        </main>
      </body>
    </html>
  );
}
