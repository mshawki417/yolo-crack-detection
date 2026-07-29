"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface NavItem {
  label: string;
  icon: string;
  href: string;
}

const mainNavItems: NavItem[] = [
  { label: "Dashboard", icon: "dashboard", href: "/" },
  { label: "New Inspection", icon: "add_box", href: "/inspection" },
  { label: "Detection Results", icon: "visibility", href: "/results" },
  { label: "Project Details", icon: "info", href: "/about" },
];

const bottomNavItems: NavItem[] = [];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = pathname === item.href;
    return (
      <Link
        href={item.href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 scale-98 active:scale-95 ${
          isActive
            ? "bg-[#cdddff] text-[#51617e] font-semibold"
            : "text-[#434654] hover:text-[#191c1d] hover:bg-[#e1e3e4]"
        }`}
        onClick={() => setMobileOpen(false)}
      >
        <span
          className="material-symbols-outlined"
          style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
        >
          {item.icon}
        </span>
        <span className="font-body-md">{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 flex items-center justify-center bg-[#ffffff] rounded-lg shadow-md border border-[#c3c6d6]"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle sidebar"
      >
        <span className="material-symbols-outlined text-[#003d9b]">
          {mobileOpen ? "close" : "menu"}
        </span>
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-30"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <nav
        className={`
          flex flex-col h-full py-6 px-4 fixed left-0 top-0 z-40
          bg-[#edeeef] w-[280px] transition-transform duration-300
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-10 h-10 bg-[#003d9b] rounded-lg flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-white">polyline</span>
          </div>
          <div>
            <h1 className="font-title-sm text-[#003d9b] tracking-tight">CrackDetect AI</h1>
            <p className="font-body-sm text-[#434654]">Enterprise SHM Platform</p>
          </div>
        </div>

        {/* New Scan CTA */}
        <Link
          href="/inspection"
          className="w-full bg-[#003d9b] text-white rounded-lg py-3 px-4 mb-6 font-title-sm flex items-center justify-center gap-2 hover:bg-[#0052cc] transition-colors shadow-sm"
          onClick={() => setMobileOpen(false)}
        >
          <span className="material-symbols-outlined">add</span>
          Start New Scan
        </Link>

        {/* Main Nav */}
        <div className="flex-1 flex flex-col gap-1 overflow-y-auto">
          {mainNavItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>

        {/* Bottom Nav */}
        {bottomNavItems.length > 0 && (
          <div className="mt-auto pt-4 border-t border-[#c3c6d6]/30 flex flex-col gap-1">
            {bottomNavItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>
        )}
      </nav>
    </>
  );
}
