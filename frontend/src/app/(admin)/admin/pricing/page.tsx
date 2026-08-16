"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { Plan } from "@/types";

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<Partial<Plan> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.admin.plans().then((d) => setPlans(d.plans)).catch(() => toast.error("Failed to load")).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const startCreate = () => setEditingPlan({ planName: "", priceBdt: 0, durationDays: 30, active: true });
  const startEdit = (p: Plan) => setEditingPlan({ ...p });

  const handleSave = async () => {
    if (!editingPlan?.planName) { toast.error("Plan name required"); return; }
    setSaving(true);
    try {
      if (editingPlan.id) {
        await api.admin.updatePlan(editingPlan.id, editingPlan);
        toast.success("Plan updated");
      } else {
        await api.admin.createPlan({ planName: editingPlan.planName!, priceBdt: editingPlan.priceBdt || 0, durationDays: editingPlan.durationDays || 30 });
        toast.success("Plan created");
      }
      setEditingPlan(null);
      load();
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this plan?")) return;
    try { await api.admin.deletePlan(id); toast.success("Deleted"); load(); }
    catch { toast.error("Failed"); }
  };

  const handleToggle = async (p: Plan) => {
    try { await api.admin.updatePlan(p.id, { active: !p.active }); load(); }
    catch { toast.error("Failed"); }
  };

  const planLabel = (days: number) => {
    if (days <= 7) return `${days} day${days > 1 ? "s" : ""}`;
    if (days <= 31) return `${Math.ceil(days / 7)} week${Math.ceil(days / 7) > 1 ? "s" : ""}`;
    if (days <= 365) return `${Math.round(days / 30)} month${Math.round(days / 30) > 1 ? "s" : ""}`;
    return `${Math.round(days / 365)} year${Math.round(days / 365) > 1 ? "s" : ""}`;
  };

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#e2e8f0] mb-1">Subscription Plans</h1>
          <p className="text-[#64748b] text-sm">Create, edit, and manage user subscription plans.</p>
        </div>
        <button onClick={startCreate} className="px-4 py-2 rounded-lg gradient-neon text-[#0a0a0f] font-bold text-sm hover:opacity-90">
          + New Plan
        </button>
      </div>

      {editingPlan && (
        <div className="card-neon border-glow-purple p-6 mb-6 animate-fade-in">
          <h2 className="text-lg font-semibold text-[#e2e8f0] mb-4">{editingPlan.id ? "Edit Plan" : "New Plan"}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-[#94a3b8] mb-1">Plan Name</label>
              <input value={editingPlan.planName || ""} onChange={(e) => setEditingPlan((p) => ({ ...p!, planName: e.target.value }))} className="w-full px-4 py-2.5 bg-[#0a0a0f] border border-[rgba(124,58,237,0.12)] rounded-lg text-[#e2e8f0] focus:outline-none focus:border-[#7c3aed]" placeholder="e.g. Monthly" />
            </div>
            <div>
              <label className="block text-sm text-[#94a3b8] mb-1">Price (BDT)</label>
              <input type="number" value={editingPlan.priceBdt || ""} onChange={(e) => setEditingPlan((p) => ({ ...p!, priceBdt: parseFloat(e.target.value) || 0 }))} className="w-full px-4 py-2.5 bg-[#0a0a0f] border border-[rgba(124,58,237,0.12)] rounded-lg text-[#e2e8f0] focus:outline-none focus:border-[#7c3aed]" />
            </div>
            <div>
              <label className="block text-sm text-[#94a3b8] mb-1">Duration (Days)</label>
              <input type="number" value={editingPlan.durationDays || ""} onChange={(e) => setEditingPlan((p) => ({ ...p!, durationDays: parseInt(e.target.value) || 0 }))} className="w-full px-4 py-2.5 bg-[#0a0a0f] border border-[rgba(124,58,237,0.12)] rounded-lg text-[#e2e8f0] focus:outline-none focus:border-[#7c3aed]" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-lg bg-[#7c3aed] text-white font-bold text-sm hover:opacity-90 disabled:opacity-50">
              {saving ? "Saving..." : editingPlan.id ? "Update" : "Create"}
            </button>
            <button onClick={() => setEditingPlan(null)} className="px-5 py-2.5 rounded-lg border border-[rgba(255,255,255,0.1)] text-[#94a3b8] text-sm hover:bg-[rgba(255,255,255,0.05)]">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <p className="text-[#64748b]">Loading...</p> : plans.length === 0 ? (
        <p className="text-[#64748b] text-sm">No plans created yet.</p>
      ) : (
        <div className="space-y-3">
          {plans.map((p) => (
            <div key={p.id} className="card-neon p-4 flex items-center justify-between">
              <div>
                <h3 className="text-[#e2e8f0] font-semibold">{p.planName}</h3>
                <p className="text-sm text-[#64748b]">৳{p.priceBdt} · {planLabel(p.durationDays)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.active ? "bg-[rgba(0,255,136,0.1)] text-[#00ff88]" : "bg-[rgba(255,51,102,0.1)] text-[#ff3366]"}`}>
                  {p.active ? "Active" : "Inactive"}
                </span>
                <button onClick={() => handleToggle(p)} className="text-xs text-[#64748b] hover:text-[#e2e8f0] transition-all">{p.active ? "Disable" : "Enable"}</button>
                <button onClick={() => startEdit(p)} className="text-xs text-[#00d4ff] hover:text-[#00ff88] transition-all">Edit</button>
                <button onClick={() => handleDelete(p.id)} className="text-xs text-[#ff3366] hover:opacity-80 transition-all">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
