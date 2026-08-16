"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Api } from "@/types";
import { toast } from "sonner";

export default function ApiExecutePage() {
  const params = useParams();
  const router = useRouter();
  const [apiData, setApiData] = useState<Api | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    api.apis.get(params.id as string).then((d) => {
      setApiData(d.api);
      const vars: Record<string, string> = {};
      d.api.workflow.variables.forEach((v: any) => { vars[v.variableName] = v.defaultValue || ""; });
      setVariables(vars);
    }).catch(() => toast.error("API not found"));
  }, [params.id]);

  const handleExecute = async () => {
    if (!apiData) return;
    setExecuting(true);
    setResult(null);
    try {
      const res = await api.execution.run(apiData.id, variables);
      setResult(res.result);
      toast.success("Execution complete");
    } catch (err: any) {
      toast.error(err.message || "Execution failed");
    } finally {
      setExecuting(false);
    }
  };

  const resultArray = (() => {
    const d = result?.data || result;
    if (Array.isArray(d)) return d;
    if (d && typeof d === "object" && !Array.isArray(d)) {
      const keys = Object.keys(d).filter((k) => Array.isArray(d[k]));
      if (keys.length === 0) return null;
      const maxLen = Math.max(...keys.map((k) => d[k].length));
      return Array.from({ length: maxLen }, (_, i) => {
        const row: Record<string, any> = {};
        keys.forEach((k) => { row[k] = d[k][i] ?? null; });
        return row;
      });
    }
    return null;
  })();

  return (
    <div className="animate-fade-in max-w-3xl">
      <button onClick={() => router.back()} className="text-sm text-[#64748b] hover:text-[#00d4ff] mb-4 transition-colors">
        ← Back
      </button>

      <h1 className="text-2xl font-bold text-[#e2e8f0] mb-1">{apiData?.apiName || "Loading..."}</h1>
      {apiData?.description && <p className="text-[#64748b] text-sm mb-6">{apiData.description}</p>}

      {apiData && (
        <div className="card-neon p-6 mb-6">
          <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wider mb-4">Variables</h2>
          {Object.keys(variables).length === 0 ? (
            <p className="text-[#64748b] text-sm">No variables — this API has only constant steps.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(variables).map(([key, val]) => (
                <div key={key}>
                  <label className="block text-sm text-[#e2e8f0] mb-1">{key}</label>
                  {val && <p className="text-xs text-[#64748b] mb-1">Sample: {val}</p>}
                  <input
                    value={val}
                    onChange={(e) => setVariables((p) => ({ ...p, [key]: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-[#0a0a0f] border border-[rgba(0,212,255,0.12)] rounded-lg text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[#00d4ff] transition-all"
                    placeholder={`Enter ${key}`}
                  />
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleExecute}
            disabled={executing}
            className="mt-6 px-6 py-3 rounded-lg gradient-neon text-[#0a0a0f] font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50"
          >
            {executing ? "Executing..." : "Run API"}
          </button>
        </div>
      )}

      {result && (
        <div className="card-neon p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wider">Results</h2>
            <div className="flex gap-2">
              <button
                onClick={() => { navigator.clipboard.writeText(JSON.stringify(result, null, 2)); toast.success("Copied!"); }}
                className="px-3 py-1.5 rounded text-xs border border-[rgba(0,212,255,0.2)] text-[#00d4ff] hover:bg-[rgba(0,212,255,0.08)] transition-all"
              >
                Copy JSON
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = "result.json"; a.click();
                }}
                className="px-3 py-1.5 rounded text-xs border border-[rgba(0,255,136,0.2)] text-[#00ff88] hover:bg-[rgba(0,255,136,0.08)] transition-all"
              >
                Download
              </button>
            </div>
          </div>

          {resultArray ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgba(0,212,255,0.1)]">
                    {resultArray.length > 0 && Object.keys(resultArray[0]).map((k) => (
                      <th key={k} className="text-left px-4 py-3 text-[#94a3b8] font-medium">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultArray.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-[rgba(0,212,255,0.05)] hover:bg-[rgba(0,212,255,0.03)]">
                      {Object.values(row).map((val: any, j: number) => (
                        <td key={j} className="px-4 py-3 text-[#e2e8f0]">{String(val ?? "—")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : result?.data?.message ? (
            <div className="bg-[rgba(255,200,50,0.06)] border border-[rgba(255,200,50,0.15)] rounded-lg p-4">
              <p className="text-[#f0c040] text-sm font-medium">
                {Array.isArray(result.data.message) ? result.data.message[0] : result.data.message}
              </p>
            </div>
          ) : (
            <pre className="text-sm text-[#94a3b8] overflow-x-auto">{JSON.stringify(result, null, 2)}</pre>
          )}
        </div>
      )}
    </div>
  );
}
