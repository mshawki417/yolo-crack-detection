import Link from "next/link";

export default function ComingSoonPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
      <div className="w-20 h-20 bg-[#dae2ff] rounded-full flex items-center justify-center">
        <span className="material-symbols-outlined text-4xl text-[#003d9b]">construction</span>
      </div>
      <h2 className="font-headline-md text-[#191c1d]">{title}</h2>
      <p className="font-body-md text-[#434654] text-center max-w-md">
        This page is under development. Start by uploading an image for crack detection.
      </p>
      <Link
        href="/inspection"
        className="bg-[#003d9b] text-white px-6 py-3 rounded-xl font-title-sm hover:bg-[#0052cc] transition-colors flex items-center gap-2"
      >
        <span className="material-symbols-outlined">add_box</span>
        New Inspection
      </Link>
    </div>
  );
}
