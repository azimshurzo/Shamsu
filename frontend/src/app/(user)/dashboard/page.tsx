"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import type { DashboardStats } from "@/types";

export default function UserDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api.users.stats().then(setStats).catch(() => {});
  }, []);

  const cards = [
    { label: "Total APIs", value: stats?.apiCount ?? "—", icon: "⬡", href: "/dashboard/apis" },
    { label: "API Calls", value: stats?.callCount ?? "—", icon: "▶", href: "/dashboard/apis" },
    { label: "Attempts Today", value: stats?.apiCreationAttempts ?? "—", icon: "◉", href: "/dashboard/workflows" },
  ];

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-[#e2e8f0] mb-1">Dashboard</h1>
      <p className="text-[#64748b] text-sm mb-8">Welcome back. Here&apos;s your overview.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="card-neon p-5 group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[#00d4ff] text-xl">{c.icon}</span>
              <span className="text-xs text-[#64748b]">{c.label}</span>
            </div>
            <div className="text-3xl font-bold text-[#e2e8f0] group-hover:text-[#00d4ff] transition-colors">
              {c.value}
            </div>
          </Link>
        ))}
      </div>

      <div className="card-neon p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#e2e8f0]">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Link
            href="/dashboard/workflows"
            className="flex items-center gap-3 p-4 rounded-lg border border-[rgba(0,212,255,0.1)] hover:border-[rgba(0,212,255,0.3)] hover:bg-[rgba(0,212,255,0.04)] transition-all"
          >
            <span className="text-[#00d4ff] text-lg">◉</span>
            <div>
              <p className="text-sm font-medium text-[#e2e8f0]">New Workflow</p>
              <p className="text-xs text-[#64748b]">Import a recorded workflow</p>
            </div>
          </Link>
          <Link
            href="/dashboard/apis"
            className="flex items-center gap-3 p-4 rounded-lg border border-[rgba(124,58,237,0.1)] hover:border-[rgba(124,58,237,0.3)] hover:bg-[rgba(124,58,237,0.04)] transition-all"
          >
            <span className="text-[#7c3aed] text-lg">⬡</span>
            <div>
              <p className="text-sm font-medium text-[#e2e8f0]">My APIs</p>
              <p className="text-xs text-[#64748b]">View and execute your APIs</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
