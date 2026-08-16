"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import type { Api } from "@/types";
import { toast } from "sonner";

export default function ApisPage() {
  const [apis, setApis] = useState<Api[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.apis.list().then((d) => setApis(d.apis)).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this API?")) return;
    try {
      await api.apis.delete(id);
      setApis((prev) => prev.filter((a) => a.id !== id));
      toast.success("API deleted");
    } catch { toast.error("Failed to delete"); }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#e2e8f0]">My APIs</h1>
          <p className="text-[#64748b] text-sm mt-1">Manage and execute your generated APIs.</p>
        </div>
      </div>

      {loading ? (
        <p className="text-[#64748b]">Loading...</p>
      ) : apis.length === 0 ? (
        <div className="card-neon p-12 text-center">
          <p className="text-[#64748b] mb-4">No APIs yet. Record a workflow and generate your first API.</p>
          <Link             href="/dashboard/workflows" className="px-5 py-2.5 rounded-lg gradient-neon text-[#0a0a0f] font-semibold text-sm">
            Go to Workflows
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {apis.map((apiItem) => (
            <div key={apiItem.id} className="card-neon p-5 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-[#e2e8f0] font-semibold truncate">{apiItem.apiName}</h3>
                <p className="text-[#64748b] text-xs mt-1">
                  {apiItem.complexityLevel} steps · ৳{apiItem.pricePerCall}/call ·{" "}
                  {apiItem._count?.apiCalls ?? 0} calls
                </p>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <Link
                  href={`/dashboard/apis/${apiItem.id}`}
                  className="px-4 py-2 rounded-lg bg-[rgba(0,212,255,0.08)] text-[#00d4ff] text-sm font-medium hover:bg-[rgba(0,212,255,0.15)] transition-all"
                >
                  Execute
                </Link>
                <button
                  onClick={() => handleDelete(apiItem.id)}
                  className="px-4 py-2 rounded-lg text-[#ff3366] text-sm hover:bg-[rgba(255,51,102,0.08)] transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
