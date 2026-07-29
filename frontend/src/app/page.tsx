"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Severity } from "@/types";
import { getDashboardStats, getInspectionHistory } from "@/services/api";

function SeverityBadge({ severity }: { severity: Severity }) {
  const styles: Record<Severity, string> = {
    Critical: "bg-[#ba1a1a]/10 text-[#ba1a1a] border-[#ba1a1a]/20",
    High: "bg-[#a33500]/10 text-[#a33500] border-[#a33500]/20",
    Moderate: "bg-[#4f5f7b]/10 text-[#4f5f7b] border-[#4f5f7b]/20",
    Low: "bg-[#737685]/10 text-[#434654] border-[#737685]/20",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styles[severity] || styles.Low}`}>
      {severity}
    </span>
  );
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [dbError, setDbError] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const [statsData, historyData] = await Promise.all([
        getDashboardStats(),
        getInspectionHistory(5) // Get latest 5
      ]);

      if (statsData?.error || historyData?.error) {
        setDbError(true);
      } else {
        setStats(statsData);
        setHistory(historyData?.inspections || []);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const totalInspections = stats?.total_inspections || 0;
  const totalCracks = stats?.total_cracks || 0;

  // Process severity distribution
  const severityDistribution = stats?.severity_distribution || {};
  const severityData = [
    { label: "Critical", value: severityDistribution.Critical || 0, total: totalInspections, color: "bg-[#ba1a1a]", textColor: "text-[#ba1a1a]" },
    { label: "High", value: severityDistribution.High || 0, total: totalInspections, color: "bg-[#a33500]", textColor: "text-[#a33500]" },
    { label: "Moderate", value: severityDistribution.Moderate || 0, total: totalInspections, color: "bg-[#4f5f7b]", textColor: "text-[#4f5f7b]" },
    { label: "Low", value: severityDistribution.Low || 0, total: totalInspections, color: "bg-[#737685]", textColor: "text-[#434654]" },
  ];

  return (
    <>
      <header className="flex justify-between items-center w-full px-6 h-16 z-30 sticky top-0 bg-[#ffffff] border-b border-[#c3c6d6] shadow-sm">
        <div className="flex items-center gap-4">
          <h2 className="font-headline-md text-[#191c1d] hidden md:block">System Dashboard</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button className="p-2 text-[#434654] hover:bg-[#f3f4f5] rounded-full transition-colors">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="p-2 text-[#434654] hover:bg-[#f3f4f5] rounded-full transition-colors">
              <span className="material-symbols-outlined">help</span>
            </button>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#cdddff] text-[#51617e] flex items-center justify-center font-bold font-body-sm border border-[#c3c6d6]">
            JD
          </div>
        </div>
      </header>

      <div className="p-6 flex flex-col gap-6 max-w-[1440px] mx-auto w-full pb-12">
        {dbError && (
          <div className="bg-[#ffdad6] text-[#93000a] p-4 rounded-lg flex items-center gap-3 border border-[#ba1a1a]/20">
            <span className="material-symbols-outlined">database</span>
            <span>MongoDB is not connected to the backend. The dashboard is showing empty data. Add MONGO_URL to your backend to enable history.</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2 text-[#434654]">
            <span className="material-symbols-outlined text-sm">calendar_today</span>
            <span className="font-data-mono">All Time History</span>
          </div>
          <div className="flex gap-2">
            <Link href="/inspection" className="px-3 py-1.5 rounded bg-[#003d9b] text-white text-sm font-medium hover:bg-[#0052cc] flex items-center gap-2 transition-colors">
              <span className="material-symbols-outlined text-sm">add</span> New Scan
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <span className="material-symbols-outlined animate-spin text-4xl text-[#003d9b]">sync</span>
            <span className="font-body-md text-[#434654]">Loading dashboard data...</span>
          </div>
        ) : (
          <>
            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#ffffff] p-4 rounded-lg border border-[#c3c6d6]/50 shadow-sm flex flex-col gap-2 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-center">
                  <span className="font-label-caps uppercase tracking-wider text-[#737685]">Total Inspections</span>
                  <span className="material-symbols-outlined text-[#003d9b] text-sm">fact_check</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-display-lg text-[#191c1d]">{totalInspections}</span>
                </div>
              </div>

              <div className="bg-[#ffffff] p-4 rounded-lg border border-[#c3c6d6]/50 shadow-sm flex flex-col gap-2 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-center">
                  <span className="font-label-caps uppercase tracking-wider text-[#737685]">Detected Cracks</span>
                  <span className="material-symbols-outlined text-[#ba1a1a] text-sm">broken_image</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-display-lg text-[#191c1d]">{totalCracks}</span>
                </div>
              </div>

              <div className="bg-[#ffffff] p-4 rounded-lg border border-[#c3c6d6]/50 shadow-sm flex flex-col gap-2 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-center">
                  <span className="font-label-caps uppercase tracking-wider text-[#737685]">Avg Cracks/Scan</span>
                  <span className="material-symbols-outlined text-[#003d9b] text-sm">analytics</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-display-lg text-[#191c1d]">
                    {totalInspections > 0 ? (totalCracks / totalInspections).toFixed(1) : 0}
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
                  <span className="font-display-lg text-[#ba1a1a]">{severityDistribution.Critical || 0}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Severity Distribution */}
              <div className="bg-[#ffffff] rounded-lg border border-[#c3c6d6]/50 shadow-sm p-5 lg:col-span-1 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-title-sm text-[#191c1d]">Severity Distribution</h3>
                </div>
                <div className="flex-1 flex flex-col justify-center gap-4">
                  {severityData.map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between font-data-mono text-xs mb-1">
                        <span className={`${item.textColor} font-semibold`}>{item.label}</span>
                        <span className="text-[#191c1d]">{item.value}</span>
                      </div>
                      <div className="w-full bg-[#edeeef] h-2 rounded-full overflow-hidden">
                        <div
                          className={`${item.color} h-full rounded-full transition-all duration-500`}
                          style={{ width: `${item.total > 0 ? (item.value / item.total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Inspections Table */}
              <div className="bg-[#ffffff] rounded-lg border border-[#c3c6d6]/50 shadow-sm overflow-hidden flex flex-col lg:col-span-2">
                <div className="p-4 border-b border-[#c3c6d6]/30 flex justify-between items-center bg-[#f8f9fa]">
                  <h3 className="font-title-sm text-[#191c1d]">Recent Inspections</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#c3c6d6]/30 bg-[#ffffff] font-label-caps text-[#737685] uppercase tracking-wider">
                        <th className="py-3 px-4 font-medium">Date</th>
                        <th className="py-3 px-4 font-medium">File Name</th>
                        <th className="py-3 px-4 font-medium text-right">Cracks</th>
                        <th className="py-3 px-4 font-medium">Severity</th>
                      </tr>
                    </thead>
                    <tbody className="font-data-mono text-[#191c1d]">
                      {history.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-[#737685] font-body-sm">
                            No inspections found.
                          </td>
                        </tr>
                      ) : (
                        history.map((insp, i) => (
                          <tr key={i} className="border-b border-[#c3c6d6]/10 hover:bg-[#f3f4f5]/50 transition-colors">
                            <td className="py-3 px-4 text-[#434654]">
                              {new Date(insp.timestamp).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 font-medium text-[#003d9b] truncate max-w-[200px]" title={insp.filename}>
                              {insp.filename}
                            </td>
                            <td className="py-3 px-4 text-right">{insp.count}</td>
                            <td className="py-3 px-4">
                              <SeverityBadge severity={insp.max_severity as Severity} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
