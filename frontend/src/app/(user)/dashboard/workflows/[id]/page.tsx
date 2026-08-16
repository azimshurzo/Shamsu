"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Workflow, WorkflowStep } from "@/types";
import { toast } from "sonner";

export default function WorkflowReviewPage() {
  const params = useParams();
  const router = useRouter();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [saving, setSaving] = useState(false);
  const [apiName, setApiName] = useState("");
  const [apiDesc, setApiDesc] = useState("");
  const [fieldNamePopup, setFieldNamePopup] = useState<{ stepIdx: number } | null>(null);
  const [fieldNameValue, setFieldNameValue] = useState("");

  useEffect(() => {
    api.workflows.get(params.id as string).then((d) => {
      setWorkflow(d.workflow);
      setSteps(d.workflow.steps);
    }).catch(() => toast.error("Workflow not found"));
  }, [params.id]);

  const toggleConstant = (idx: number) => {
    setSteps((prev) => prev.map((s, i) => i === idx ? { ...s, isConstant: !s.isConstant } : s));
  };

  const removeStep = (idx: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, stepOrder: i + 1 })));
  };

  const toggleExtraction = (idx: number) => {
    setSteps((prev) => prev.map((s, i) => {
      if (i !== idx) return s;
      const newVal = !s.isExtractionTarget;
      return { ...s, isExtractionTarget: newVal, extractAll: newVal };
    }));
  };

  const openFieldNamePopup = (idx: number) => {
    setFieldNamePopup({ stepIdx: idx });
    setFieldNameValue(steps[idx].fieldName || steps[idx].selector);
  };

  const saveFieldName = () => {
    if (!fieldNamePopup) return;
    setSteps((prev) => prev.map((s, i) =>
      i === fieldNamePopup.stepIdx ? { ...s, fieldName: fieldNameValue } : s
    ));
    setFieldNamePopup(null);
  };

  const handleSaveAndGenerate = async () => {
    if (!workflow || !apiName.trim()) { toast.error("Enter an API name"); return; }
    setSaving(true);
    try {
      await api.workflows.update(workflow.id, {
        steps: steps.map((s) => ({
          id: s.id, stepOrder: s.stepOrder, isConstant: s.isConstant,
          isExtractionTarget: s.isExtractionTarget, containerSelector: s.containerSelector,
          fieldSelector: s.fieldSelector, fieldName: s.fieldName, extractAll: s.extractAll,
          context: s.context, text: s.text,
        })),
        variables: steps.filter((s) => !s.isConstant && !s.isExtractionTarget).map((s) => ({
          stepId: s.id, variableName: s.fieldName || s.context || `field_${s.stepOrder}`,
          defaultValue: s.value || "", required: true,
        })),
      });
      const { api: newApi } = await api.apis.create({ workflowId: workflow.id, apiName, description: apiDesc });
      toast.success("API generated!");
      router.push(`/dashboard/apis/${newApi.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally { setSaving(false); }
  };

  if (!workflow) return <p className="text-[#64748b]">Loading workflow...</p>;

  return (
    <div className="animate-fade-in max-w-3xl">
      <button onClick={() => router.back()} className="text-sm text-[#64748b] hover:text-[#00d4ff] mb-4 transition-colors">← Back</button>
      <h1 className="text-2xl font-bold text-[#e2e8f0] mb-1">Review: {workflow.name}</h1>
      <p className="text-[#64748b] text-sm mb-6">Mark each step as Constant or Variable. Click on extraction targets to mark data fields.</p>

      <div className="space-y-2 mb-8">
        {steps.map((step, idx) => (
          <div key={step.id} className={`card-neon p-4 transition-all ${step.isExtractionTarget ? "border-[rgba(0,255,136,0.3)] glow-green" : step.isConstant ? "" : "border-[rgba(124,58,237,0.3)] glow-purple"}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-2 py-0.5 rounded bg-[rgba(0,212,255,0.1)] text-[#00d4ff] font-mono">#{step.stepOrder}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-[rgba(255,255,255,0.05)] text-[#94a3b8] font-mono">{step.actionType}</span>
                  {step.isExtractionTarget && (
                    <span className="text-xs px-2 py-0.5 rounded bg-[rgba(0,255,136,0.1)] text-[#00ff88]">Extract</span>
                  )}
                </div>
                {step.actionType === "NAVIGATE" ? (
                  <p className="text-sm text-[#e2e8f0]">Navigate to <span className="text-[#00d4ff]">{step.value?.replace(/https?:\/\//, "").split("?")[0]}</span></p>
                ) : step.actionType === "INPUT" ? (
                  <div>
                    <p className="text-sm text-[#e2e8f0]">Type in <span className="text-[#00d4ff]">{step.context || "input field"}</span></p>
                    {step.value && <p className="text-xs text-[#64748b] mt-0.5">Value: {step.isConstant && !step.isExtractionTarget ? "••••••" : step.value}</p>}
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-[#e2e8f0]">Click <span className="text-[#00d4ff]">{step.context || "element"}</span></p>
                    {step.text && step.text !== step.context && <p className="text-xs text-[#64748b] mt-0.5">Text: "{step.text.slice(0, 80)}"</p>}
                  </div>
                )}
                {step.fieldName && <p className="text-xs text-[#7c3aed] mt-1">Field: {step.fieldName}</p>}
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={() => toggleConstant(idx)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                    step.isConstant
                      ? "bg-[rgba(0,212,255,0.15)] text-[#00d4ff] border border-[rgba(0,212,255,0.3)]"
                      : "bg-[rgba(124,58,237,0.15)] text-[#7c3aed] border border-[rgba(124,58,237,0.3)]"
                  }`}
                >
                  {step.isConstant ? "Constant" : "Variable"}
                </button>
                <button
                  onClick={() => toggleExtraction(idx)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                    step.isExtractionTarget
                      ? "bg-[rgba(0,255,136,0.15)] text-[#00ff88] border border-[rgba(0,255,136,0.3)]"
                      : "bg-[rgba(255,255,255,0.05)] text-[#64748b] border border-[rgba(255,255,255,0.1)]"
                  }`}
                >
                  {step.isExtractionTarget ? "✓ Extract" : "Mark Extract"}
                </button>
                {!step.isConstant && (
                  <button onClick={() => openFieldNamePopup(idx)} className="px-3 py-1.5 rounded text-xs text-[#94a3b8] border border-[rgba(255,255,255,0.1)] hover:border-[rgba(0,212,255,0.3)] transition-all">
                    Name Field
                  </button>
                )}
                <button
                  onClick={() => removeStep(idx)}
                  className="px-3 py-1.5 rounded text-xs text-[#ff3366] border border-[rgba(255,51,102,0.2)] hover:bg-[rgba(255,51,102,0.1)] transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card-neon p-6">
        <h2 className="text-lg font-semibold text-[#e2e8f0] mb-4">Generate API</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[#94a3b8] mb-1">API Name (3-50 chars)</label>
            <input
              value={apiName}
              onChange={(e) => setApiName(e.target.value)}
              maxLength={50}
              className="w-full px-4 py-2.5 bg-[#0a0a0f] border border-[rgba(0,212,255,0.12)] rounded-lg text-[#e2e8f0] focus:outline-none focus:border-[#00d4ff] transition-all"
              placeholder="e.g., Hotel Search API"
            />
            {apiName.length > 0 && (apiName.length < 3 || apiName.length > 50) && (
              <p className="text-xs text-[#ff3366] mt-1">3-50 characters required</p>
            )}
          </div>
          <div>
            <label className="block text-sm text-[#94a3b8] mb-1">Description (optional)</label>
            <textarea
              value={apiDesc}
              onChange={(e) => setApiDesc(e.target.value)}
              maxLength={500}
              rows={2}
              className="w-full px-4 py-2.5 bg-[#0a0a0f] border border-[rgba(0,212,255,0.12)] rounded-lg text-[#e2e8f0] focus:outline-none focus:border-[#00d4ff] transition-all"
            />
          </div>
          <button
            onClick={handleSaveAndGenerate}
            disabled={saving || apiName.length < 3}
            className="px-6 py-3 rounded-lg gradient-neon text-[#0a0a0f] font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50"
          >
            {saving ? "Generating..." : "Generate API"}
          </button>
        </div>
      </div>

      {fieldNamePopup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setFieldNamePopup(null)}>
          <div className="card-neon p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[#e2e8f0] mb-4">Name this field</h3>
            <input
              value={fieldNameValue}
              onChange={(e) => setFieldNameValue(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#0a0a0f] border border-[rgba(0,212,255,0.12)] rounded-lg text-[#e2e8f0] focus:outline-none focus:border-[#00d4ff] transition-all mb-4"
              placeholder="e.g., Hotel Name, Price, Rating"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={saveFieldName} className="px-5 py-2 rounded-lg gradient-neon text-[#0a0a0f] font-semibold text-sm">Save</button>
              <button onClick={() => setFieldNamePopup(null)} className="px-5 py-2 rounded-lg border border-[rgba(255,255,255,0.1)] text-[#64748b] text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
