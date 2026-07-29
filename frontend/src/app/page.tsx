import Link from "next/link";
import { InspectionRecord, Severity } from "@/types";

// Mock data for dashboard (will be replaced by real API calls)
const kpiData = {
  totalInspections: 1248,
  totalImagesProcessed: "14.2k",
  totalDetectedCracks: 3892,
  criticalCracks: 142,
  totalVideos: 342,
  avgConfidence: "94.2%",
  avgLength: "142.5mm",
  avgWidth: "4.2mm",
};

const severityData = [
  { label: "Critical", value: 142, total: 3892, color: "bg-[#ba1a1a]", textColor: "text-[#ba1a1a]" },
  { label: "High", value: 845, total: 3892, color: "bg-[#a33500]", textColor: "text-[#a33500]" },
  { label: "Medium", value: 1532, total: 3892, color: "bg-[#4f5f7b]", textColor: "text-[#4f5f7b]" },
  { label: "Low", value: 1373, total: 3892, color: "bg-[#737685]", textColor: "text-[#434654]" },
];

const recentInspections: InspectionRecord[] = [
  {
    id: "1",
    date: "2023-11-11 14:32",
    filename: "bridge_deck_north_42.jpg",
    inputType: "Image",
    crackCount: 12,
    severity: "Critical",
    confidence: 0.98,
  },
  {
    id: "2",
    date: "2023-11-11 11:15",
    filename: "pier_support_scan_v2.mp4",
    inputType: "Video",
    crackCount: 45,
    severity: "High",
    confidence: 0.84,
  },
  {
    id: "3",
    date: "2023-11-10 09:45",
    filename: "tunnel_wall_sec_A.jpg",
    inputType: "Image",
    crackCount: 3,
    severity: "Low",
    confidence: 0.91,
  },
];

function SeverityBadge({ severity }: { severity: Severity }) {
  const styles: Record<Severity, string> = {
    Critical: "bg-[#ba1a1a]/10 text-[#ba1a1a] border-[#ba1a1a]/20",
    High: "bg-[#a33500]/10 text-[#a33500] border-[#a33500]/20",
    Moderate: "bg-[#4f5f7b]/10 text-[#4f5f7b] border-[#4f5f7b]/20",
    Low: "bg-[#737685]/10 text-[#434654] border-[#737685]/20",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styles[severity]}`}
    >
      {severity}
    </span>
  );
}

export default function DashboardPage() {
  return (
    <>
      {/* Header */}
      <header className="flex justify-between items-center w-full px-6 h-16 z-30 sticky top-0 bg-[#ffffff] border-b border-[#c3c6d6] shadow-sm">
        <div className="flex items-center gap-4">
          <h2 className="font-headline-md text-[#191c1d] hidden md:block">System Dashboard</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden sm:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#434654] text-sm">
              search
            </span>
            <input
              className="w-64 bg-[#f3f4f5] border border-[#c3c6d6] rounded-full pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b] transition-all font-body-sm"
              placeholder="Search inspections..."
              type="text"
            />
          </div>
          <div className="flex items-center gap-1">
            <button className="p-2 text-[#434654] hover:bg-[#f3f4f5] rounded-full transition-colors">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="p-2 text-[#434654] hover:bg-[#f3f4f5] rounded-full transition-colors">
              <span className="material-symbols-outlined">help</span>
            </button>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#cdddff] text-[#51617e] flex items-center justify-center font-bold font-body-sm cursor-pointer ml-2 border border-[#c3c6d6]">
            JD
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <div className="p-6 flex flex-col gap-6 max-w-[1440px] mx-auto w-full pb-12">
        
        {/* Date/Filter Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2 text-[#434654]">
            <span className="material-symbols-outlined text-sm">calendar_today</span>
            <span className="font-data-mono">Last 30 Days (Oct 12 – Nov 11, 2023)</span>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 border border-[#c3c6d6] rounded bg-[#ffffff] text-[#191c1d] text-sm font-medium hover:bg-[#f3f4f5] flex items-center gap-2 transition-colors">
              <span className="material-symbols-outlined text-sm">filter_list</span> Filter
            </button>
            <button className="px-3 py-1.5 border border-[#c3c6d6] rounded bg-[#ffffff] text-[#191c1d] text-sm font-medium hover:bg-[#f3f4f5] flex items-center gap-2 transition-colors">
              <span className="material-symbols-outlined text-sm">download</span> Export
            </button>
          </div>
        </div>

        {/* KPI Grid — Primary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#ffffff] p-4 rounded-lg border border-[#c3c6d6]/50 shadow-sm flex flex-col gap-2 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center">
              <span className="font-label-caps uppercase tracking-wider text-[#737685]">Total Inspections</span>
              <span className="material-symbols-outlined text-[#003d9b] text-sm">fact_check</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display-lg text-[#191c1d]">{kpiData.totalInspections.toLocaleString()}</span>
              <span className="text-xs text-[#003d9b] font-medium flex items-center">
                <span className="material-symbols-outlined text-[10px]">arrow_upward</span> 12%
              </span>
            </div>
          </div>

          <div className="bg-[#ffffff] p-4 rounded-lg border border-[#c3c6d6]/50 shadow-sm flex flex-col gap-2 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center">
              <span className="font-label-caps uppercase tracking-wider text-[#737685]">Images Processed</span>
              <span className="material-symbols-outlined text-[#003d9b] text-sm">image</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display-lg text-[#191c1d]">{kpiData.totalImagesProcessed}</span>
            </div>
          </div>

          <div className="bg-[#ffffff] p-4 rounded-lg border border-[#c3c6d6]/50 shadow-sm flex flex-col gap-2 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center">
              <span className="font-label-caps uppercase tracking-wider text-[#737685]">Detected Cracks</span>
              <span className="material-symbols-outlined text-[#ba1a1a] text-sm">broken_image</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display-lg text-[#191c1d]">{kpiData.totalDetectedCracks.toLocaleString()}</span>
              <span className="text-xs text-[#ba1a1a] font-medium flex items-center">
                <span className="material-symbols-outlined text-[10px]">arrow_upward</span> 5%
              </span>
            </div>
          </div>

          <div className="bg-[#ffffff] p-4 rounded-lg border border-[#ffdad6] shadow-sm flex flex-col gap-2 hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="absolute right-0 top-0 w-16 h-16 bg-[#ba1a1a]/5 rounded-bl-full z-0"></div>
            <div className="flex justify-between items-center relative z-10">
              <span className="font-label-caps uppercase tracking-wider text-[#ba1a1a]">Critical Cracks</span>
              <span className="material-symbols-outlined text-[#ba1a1a] text-sm">warning</span>
            </div>
            <div className="flex items-baseline gap-2 relative z-10">
              <span className="font-display-lg text-[#ba1a1a]">{kpiData.criticalCracks}</span>
            </div>
          </div>
        </div>

        {/* KPI Grid — Secondary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Videos", value: kpiData.totalVideos, color: "text-[#191c1d]" },
            { label: "Avg Confidence", value: kpiData.avgConfidence, color: "text-[#003d9b]" },
            { label: "Avg Length", value: kpiData.avgLength, color: "text-[#191c1d]" },
            { label: "Avg Width", value: kpiData.avgWidth, color: "text-[#191c1d]" },
          ].map((item) => (
            <div key={item.label} className="bg-[#ffffff] px-4 py-3 rounded-lg border border-[#c3c6d6]/30 flex justify-between items-center">
              <span className="font-body-sm text-[#434654]">{item.label}</span>
              <span className={`font-data-mono font-semibold ${item.color}`}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trend Chart */}
          <div className="bg-[#ffffff] rounded-lg border border-[#c3c6d6]/50 shadow-sm p-5 lg:col-span-2 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-title-sm text-[#191c1d]">Monthly Inspection Trend</h3>
              <button className="text-[#434654] hover:text-[#191c1d] p-1">
                <span className="material-symbols-outlined text-sm">more_vert</span>
              </button>
            </div>
            <div className="flex-1 chart-grid relative min-h-[250px] mt-2 border-l border-b border-[#c3c6d6]/30 flex items-end px-2 pt-4">
              <div className="absolute inset-0 flex items-end pb-[1px] pl-[1px] overflow-hidden">
                <svg className="w-full h-[80%] opacity-20 text-[#003d9b] fill-current" preserveAspectRatio="none" viewBox="0 0 100 40">
                  <path d="M0,40 L0,30 C10,25 20,35 30,20 C40,5 50,15 60,10 C70,5 80,15 90,5 L100,0 L100,40 Z" />
                </svg>
                <svg className="w-full h-[80%] absolute inset-0 text-[#003d9b] stroke-current fill-none" preserveAspectRatio="none" strokeWidth="0.5" viewBox="0 0 100 40">
                  <path d="M0,30 C10,25 20,35 30,20 C40,5 50,15 60,10 C70,5 80,15 90,5 L100,0" />
                </svg>
              </div>
              <div className="absolute bottom-[-20px] left-0 w-full flex justify-between font-data-mono text-[10px] text-[#737685] px-2">
                {["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"].map((m) => <span key={m}>{m}</span>)}
              </div>
            </div>
          </div>

          {/* Severity Distribution */}
          <div className="bg-[#ffffff] rounded-lg border border-[#c3c6d6]/50 shadow-sm p-5 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-title-sm text-[#191c1d]">Severity Distribution</h3>
            </div>
            <div className="flex-1 flex flex-col justify-center gap-4">
              {severityData.map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between font-data-mono text-xs mb-1">
                    <span className={`${item.textColor} font-semibold`}>{item.label}</span>
                    <span className="text-[#191c1d]">{item.value.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-[#edeeef] h-2 rounded-full overflow-hidden">
                    <div
                      className={`${item.color} h-full rounded-full`}
                      style={{ width: `${(item.value / item.total) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Inspections Table */}
        <div className="bg-[#ffffff] rounded-lg border border-[#c3c6d6]/50 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-[#c3c6d6]/30 flex justify-between items-center bg-[#f8f9fa]">
            <h3 className="font-title-sm text-[#191c1d]">Recent Inspections</h3>
            <Link href="/results" className="text-[#003d9b] text-sm font-medium hover:underline">
              View All
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#c3c6d6]/30 bg-[#ffffff] font-label-caps text-[#737685] uppercase tracking-wider">
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium">File Name</th>
                  <th className="py-3 px-4 font-medium">Input Type</th>
                  <th className="py-3 px-4 font-medium text-right">No. Cracks</th>
                  <th className="py-3 px-4 font-medium">Severity</th>
                  <th className="py-3 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="font-data-mono text-[#191c1d]">
                {recentInspections.map((insp) => (
                  <tr
                    key={insp.id}
                    className="border-b border-[#c3c6d6]/10 hover:bg-[#f3f4f5]/50 transition-colors group"
                  >
                    <td className="py-3 px-4 text-[#434654]">{insp.date}</td>
                    <td className="py-3 px-4 font-medium text-[#003d9b]">{insp.filename}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-[#737685]">
                          {insp.inputType === "Image" ? "image" : "videocam"}
                        </span>
                        {insp.inputType}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">{insp.crackCount}</td>
                    <td className="py-3 px-4">
                      <SeverityBadge severity={insp.severity} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href="/results"
                        className="text-[#003d9b] hover:text-[#0052cc] text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
