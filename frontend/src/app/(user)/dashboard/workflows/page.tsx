"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Workflow } from "@/types";
import { toast } from "sonner";
import Link from "next/link";

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [importMode, setImportMode] = useState(false);
  const [importName, setImportName] = useState("");
  const [importJson, setImportJson] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    api.workflows.list().then((d) => setWorkflows(d.workflows)).finally(() => setLoading(false));
  }, []);

  const handleImport = async () => {
    if (!importName.trim() || !importJson.trim()) { toast.error("Fill all fields"); return; }
    setImporting(true);
    try {
      const parsed = JSON.parse(importJson);
      const { workflow } = await api.workflows.import({ name: importName, steps: parsed.steps || parsed });
      setWorkflows((prev) => [workflow, ...prev]);
      setImportMode(false); setImportName(""); setImportJson("");
      toast.success("Workflow imported!");
    } catch (err: any) {
      toast.error(err.message || "Import failed — check JSON format");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#e2e8f0]">Workflows</h1>
          <p className="text-[#64748b] text-sm mt-1">Import and manage your recorded workflows.</p>
        </div>
        <button
          onClick={() => setImportMode(true)}
          className="px-5 py-2.5 rounded-lg gradient-neon text-[#0a0a0f] font-semibold text-sm"
        >
          Import Workflow
        </button>
      </div>

      {importMode && (
        <div className="card-neon p-6 mb-6 animate-fade-in">
          <h2 className="text-lg font-semibold text-[#e2e8f0] mb-4">Import from Browser Extension</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[#94a3b8] mb-1">Workflow Name</label>
              <input
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0a0a0f] border border-[rgba(0,212,255,0.12)] rounded-lg text-[#e2e8f0] focus:outline-none focus:border-[#00d4ff] transition-all"
                placeholder="e.g., Booking.com Hotel Search"
              />
            </div>
            <div>
              <label className="block text-sm text-[#94a3b8] mb-1">Workflow JSON</label>
              <textarea
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                rows={8}
                className="w-full px-4 py-2.5 bg-[#0a0a0f] border border-[rgba(0,212,255,0.12)] rounded-lg text-[#e2e8f0] font-mono text-sm focus:outline-none focus:border-[#00d4ff] transition-all"
                placeholder='{"steps":[{"actionType":"NAVIGATE","selector":"url","value":"https://..."}]}'
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleImport}
                disabled={importing}
                className="px-5 py-2.5 rounded-lg gradient-neon text-[#0a0a0f] font-semibold text-sm disabled:opacity-50"
              >
                {importing ? "Importing..." : "Import"}
              </button>
              <button
                onClick={() => { setImportMode(false); setImportName(""); setImportJson(""); }}
                className="px-5 py-2.5 rounded-lg border border-[rgba(0,212,255,0.2)] text-[#64748b] text-sm hover:text-[#e2e8f0] transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-[#64748b]">Loading...</p>
      ) : workflows.length === 0 ? (
        <div className="card-neon p-12 text-center">
          <p className="text-[#64748b] mb-3">No workflows recorded yet.</p>
          <p className="text-[#475569] text-xs">Install the Shamsu browser extension to start recording.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workflows.map((wf) => (
            <div key={wf.id} className="card-neon p-5 flex items-center justify-between">
              <div>
                <h3 className="text-[#e2e8f0] font-semibold">{wf.name}</h3>
                <p className="text-[#64748b] text-xs mt-1">
                  {wf.steps.length} steps · {wf.variables.length} variables ·{" "}
                  {new Date(wf.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-3">
                <Link
                  href={`/dashboard/workflows/${wf.id}`}
                  className="px-4 py-2 rounded-lg bg-[rgba(0,212,255,0.08)] text-[#00d4ff] text-sm font-medium hover:bg-[rgba(0,212,255,0.15)] transition-all"
                >
                  Review
                </Link>
                <button
                  onClick={async () => {
                    if (!confirm("Delete this workflow?")) return;
                    await api.workflows.delete(wf.id);
                    setWorkflows((p) => p.filter((w) => w.id !== wf.id));
                    toast.success("Deleted");
                  }}
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
