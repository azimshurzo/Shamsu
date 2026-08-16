"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import type { AdminStats } from "@/types";

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    api.admin.stats().then(setStats).catch(() => {});
  }, []);

  const cards = [
    { label: "Total Users", value: stats?.totalUsers ?? "—", icon: "◇", color: "#00d4ff" },
    { label: "Total APIs", value: stats?.totalApis ?? "—", icon: "⬡", color: "#7c3aed" },
    { label: "API Calls", value: stats?.totalCalls ?? "—", icon: "▶", color: "#00ff88" },
    { label: "Pending Payments", value: stats?.pendingPayments ?? "—", icon: "◎", color: "#ffaa00" },
    { label: "Revenue (BDT)", value: stats?.totalRevenue ?? "—", icon: "৳", color: "#00ff88" },
  ];

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-[#e2e8f0] mb-1">Admin Overview</h1>
      <p className="text-[#64748b] text-sm mb-8">System-wide metrics and management.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-5 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="card-neon p-5 border-glow-purple hover:border-[rgba(124,58,237,0.3)]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xl" style={{ color: c.color }}>{c.icon}</span>
            </div>
            <div className="text-2xl font-bold text-[#e2e8f0]">{c.value}</div>
            <p className="text-xs text-[#64748b] mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Link href="/admin/payments" className="card-neon p-6 border-glow-purple hover:border-[rgba(124,58,237,0.3)] transition-all">
          <h3 className="text-[#7c3aed] text-lg font-semibold mb-2">Payment Queue</h3>
          <p className="text-[#64748b] text-sm">Review and process pending payment requests from users.</p>
        </Link>
        <Link href="/admin/users" className="card-neon p-6 border-glow-purple hover:border-[rgba(124,58,237,0.3)] transition-all">
          <h3 className="text-[#7c3aed] text-lg font-semibold mb-2">User Management</h3>
          <p className="text-[#64748b] text-sm">View all registered users and their activity.</p>
        </Link>
      </div>
    </div>
  );
}
