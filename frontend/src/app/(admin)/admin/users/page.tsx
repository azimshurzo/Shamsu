"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.users().then((d) => setUsers(d.users)).finally(() => setLoading(false));
  }, []);

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      ACTIVE: "text-[#00ff88] bg-[rgba(0,255,136,0.1)] border-[rgba(0,255,136,0.2)]",
      FREE: "text-[#64748b] bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)]",
      EXPIRED: "text-[#ff3366] bg-[rgba(255,51,102,0.1)] border-[rgba(255,51,102,0.2)]",
    };
    return colors[s] || colors.FREE;
  };

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-[#e2e8f0] mb-1">Users</h1>
      <p className="text-[#64748b] text-sm mb-8">All registered users and their activity.</p>

      {loading ? <p className="text-[#64748b]">Loading...</p> : (
        <div className="card-neon border-glow-purple overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(124,58,237,0.15)]">
                  <th className="text-left px-5 py-4 text-[#94a3b8] font-medium">Name</th>
                  <th className="text-left px-5 py-4 text-[#94a3b8] font-medium">Email</th>
                  <th className="text-left px-5 py-4 text-[#94a3b8] font-medium">Role</th>
                  <th className="text-left px-5 py-4 text-[#94a3b8] font-medium">Status</th>
                  <th className="text-left px-5 py-4 text-[#94a3b8] font-medium">APIs</th>
                  <th className="text-left px-5 py-4 text-[#94a3b8] font-medium">Workflows</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-[rgba(124,58,237,0.05)] hover:bg-[rgba(124,58,237,0.03)]">
                    <td className="px-5 py-4 text-[#e2e8f0] font-medium">{u.name}</td>
                    <td className="px-5 py-4 text-[#94a3b8]">{u.email}</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2 py-1 rounded ${u.role === "ADMIN" ? "text-[#7c3aed] bg-[rgba(124,58,237,0.1)]" : "text-[#94a3b8] bg-[rgba(255,255,255,0.05)]"}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2 py-1 rounded border ${statusBadge(u.subscriptionStatus)}`}>
                        {u.subscriptionStatus}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[#94a3b8]">{u._count?.apis || 0}</td>
                    <td className="px-5 py-4 text-[#94a3b8]">{u._count?.workflows || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
