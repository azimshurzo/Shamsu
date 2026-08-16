"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.admin.settings().then((d) => {
      const map: Record<string, string> = {};
      d.settings.forEach((s: any) => { map[s.key] = s.value; });
      setSettings(map);
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.admin.updateSettings(settings);
      toast.success("Settings saved");
    } catch { toast.error("Failed"); }
    finally { setSaving(false); }
  };

  const displaySettings = Object.entries(settings).filter(([k]) => !k.startsWith("pricing_"));

  return (
    <div className="animate-fade-in max-w-2xl">
      <h1 className="text-2xl font-bold text-[#e2e8f0] mb-1">System Settings</h1>
      <p className="text-[#64748b] text-sm mb-8">General system configuration.</p>

      {loading ? <p className="text-[#64748b]">Loading...</p> : (
        <div className="card-neon border-glow-purple p-6">
          <div className="space-y-5">
            {displaySettings.length === 0 ? (
              <p className="text-[#64748b] text-sm">No additional settings configured.</p>
            ) : (
              displaySettings.map(([key, val]) => (
                <div key={key}>
                  <label className="block text-sm text-[#94a3b8] mb-1 font-mono">{key}</label>
                  <input
                    value={val}
                    onChange={(e) => setSettings((p) => ({ ...p, [key]: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-[#0a0a0f] border border-[rgba(124,58,237,0.12)] rounded-lg text-[#e2e8f0] font-mono text-sm focus:outline-none focus:border-[#7c3aed] transition-all"
                  />
                </div>
              ))
            )}
          </div>
          <div className="mt-6 p-4 rounded-lg border border-[rgba(124,58,237,0.15)] bg-[rgba(124,58,237,0.03)]">
            <h3 className="text-sm font-medium text-[#7c3aed] mb-2">Extension Connection</h3>
            <p className="text-xs text-[#64748b]">Backend API URL: <code className="text-[#94a3b8]">http://localhost:4000</code></p>
            <p className="text-xs text-[#64748b] mt-1">The browser extension should be configured to connect to this URL.</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-6 px-6 py-3 rounded-lg bg-[#7c3aed] text-white font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      )}
    </div>
  );
}
