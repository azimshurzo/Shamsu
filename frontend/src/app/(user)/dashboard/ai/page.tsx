"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface AIHealth {
  status: string;
  url: string;
  models: Array<{
    name: string;
    size: number;
    parameterSize?: string;
  }>;
  capabilities: {
    textAnalysis: boolean;
    visionHealing: boolean;
    agentHealing: boolean;
  };
  recommendations: string[];
}

export default function AISettingsPage() {
  const [health, setHealth] = useState<AIHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:4000/api/ai/health");
      const data = await response.json();
      setHealth(data);
    } catch (err) {
      setError("Failed to connect to backend");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  };

  return (
    <div className="animate-fade-in max-w-3xl">
      <h1 className="text-2xl font-bold text-[#e2e8f0] mb-1">AI Settings</h1>
      <p className="text-[#64748b] text-sm mb-8">
        Configure Ollama integration for AI-powered workflow analysis and
        self-healing.
      </p>

      {loading ? (
        <div className="card-neon border-glow-orange p-6">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-[#ff6b00] border-t-transparent rounded-full animate-spin" />
            <span className="text-[#94a3b8]">Checking Ollama status...</span>
          </div>
        </div>
      ) : error ? (
        <div className="card-neon border-glow-red p-6">
          <h3 className="text-[#ef4444] font-medium mb-2">Connection Error</h3>
          <p className="text-[#64748b] text-sm">{error}</p>
          <button
            onClick={fetchHealth}
            className="mt-4 px-4 py-2 bg-[#ef4444] text-white rounded-lg text-sm font-medium hover:opacity-90"
          >
            Retry Connection
          </button>
        </div>
      ) : health ? (
        <div className="space-y-6">
          {/* Status Card */}
          <div
            className={`card-neon p-6 ${
              health.status === "connected"
                ? "border-glow-green"
                : "border-glow-red"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[#e2e8f0] font-medium">Ollama Status</h3>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  health.status === "connected"
                    ? "bg-[rgba(34,197,94,0.1)] text-[#22c55e] border border-[rgba(34,197,94,0.3)]"
                    : "bg-[rgba(239,68,68,0.1)] text-[#ef4444] border border-[rgba(239,68,68,0.3)]"
                }`}
              >
                {health.status === "connected" ? "Connected" : "Disconnected"}
              </span>
            </div>
            <p className="text-[#64748b] text-sm">
              URL:{" "}
              <code className="text-[#94a3b8]">{health.url}</code>
            </p>
          </div>

          {/* Capabilities Card */}
          <div className="card-neon border-glow-orange p-6">
            <h3 className="text-[#e2e8f0] font-medium mb-4">AI Capabilities</h3>
            <div className="grid grid-cols-3 gap-4">
              <CapabilityItem
                label="Text Analysis"
                available={health.capabilities.textAnalysis}
                model="llama3.2"
              />
              <CapabilityItem
                label="Vision Healing"
                available={health.capabilities.visionHealing}
                model="llava"
              />
              <CapabilityItem
                label="Agent Healing"
                available={health.capabilities.agentHealing}
                model="llama3.2"
              />
            </div>
          </div>

          {/* Models Card */}
          {health.models.length > 0 && (
            <div className="card-neon border-glow-purple p-6">
              <h3 className="text-[#e2e8f0] font-medium mb-4">
                Installed Models
              </h3>
              <div className="space-y-3">
                {health.models.map((model) => (
                  <div
                    key={model.name}
                    className="flex items-center justify-between p-3 bg-[#0a0a0f] rounded-lg border border-[rgba(124,58,237,0.12)]"
                  >
                    <div>
                      <p className="text-[#e2e8f0] font-medium text-sm">
                        {model.name}
                      </p>
                      <p className="text-[#64748b] text-xs">
                        {model.parameterSize || "Unknown size"}
                      </p>
                    </div>
                    <span className="text-[#94a3b8] text-sm">
                      {formatSize(model.size)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations Card */}
          {health.recommendations.length > 0 && (
            <div className="card-neon border-glow-yellow p-6">
              <h3 className="text-[#e2e8f0] font-medium mb-4">
                Setup Recommendations
              </h3>
              <div className="space-y-2">
                {health.recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 bg-[#0a0a0f] rounded-lg"
                  >
                    <span className="text-[#f59e0b] mt-0.5">!</span>
                    <code className="text-[#94a3b8] text-sm">{rec}</code>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={fetchHealth}
            className="px-6 py-3 bg-[#ff6b00] text-white rounded-lg text-sm font-bold hover:opacity-90 transition-all"
          >
            Refresh Status
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CapabilityItem({
  label,
  available,
  model,
}: {
  label: string;
  available: boolean;
  model: string;
}) {
  return (
    <div className="p-4 bg-[#0a0a0f] rounded-lg border border-[rgba(255,107,0,0.12)]">
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-2 h-2 rounded-full ${
            available ? "bg-[#22c55e]" : "bg-[#ef4444]"
          }`}
        />
        <span className="text-[#e2e8f0] text-sm font-medium">{label}</span>
      </div>
      <p className="text-[#64748b] text-xs">
        Model: <code className="text-[#94a3b8]">{model}</code>
      </p>
      <p className="text-[#64748b] text-xs mt-1">
        {available ? "Ready" : "Not installed"}
      </p>
    </div>
  );
}
