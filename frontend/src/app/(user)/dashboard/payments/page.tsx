"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Plan, PaymentRequest } from "@/types";
import { toast } from "sonner";

export default function PaymentsPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [bkashNumber, setBkashNumber] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.payments.my().then((d) => setPayments(d.payments)).catch(() => {});
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/payments/plans`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setPlans(d.plans || []))
      .catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!selectedPlan || !bkashNumber.trim() || !transactionId.trim()) {
      toast.error("Fill all fields"); return;
    }
    setSubmitting(true);
    try {
      const { payment } = await api.payments.submit({ planId: selectedPlan.id, bkashNumber, transactionId });
      setPayments((p) => [payment, ...p]);
      setSelectedPlan(null); setBkashNumber(""); setTransactionId("");
      toast.success("Payment submitted! Awaiting admin approval.");
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally { setSubmitting(false); }
  };

  const statusColor = (s: string) => {
    if (s === "APPROVED") return "text-[#00ff88]";
    if (s === "REJECTED") return "text-[#ff3366]";
    return "text-[#ffaa00]";
  };

  const planDuration = (days: number) => {
    if (days <= 7) return `${days} days`;
    if (days <= 31) return `${Math.ceil(days / 7)} weeks`;
    if (days <= 365) return `${Math.round(days / 30)} months`;
    return `${Math.round(days / 365)} year`;
  };

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-[#e2e8f0] mb-1">Payments</h1>
      <p className="text-[#64748b] text-sm mb-8">Subscribe to a plan and manage payments.</p>

      <div className="card-neon p-6 mb-6">
        <h2 className="text-lg font-semibold text-[#e2e8f0] mb-4">Choose a Plan</h2>
        {plans.length === 0 ? (
          <p className="text-[#64748b] text-sm">No plans available.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPlan(p)}
                className={`p-5 rounded-xl text-left transition-all ${
                  selectedPlan?.id === p.id
                    ? "border-2 border-[#00d4ff] bg-[rgba(0,212,255,0.05)] glow-cyan"
                    : "border border-[rgba(0,212,255,0.1)] hover:border-[rgba(0,212,255,0.3)]"
                }`}
              >
                <h3 className="text-[#e2e8f0] font-semibold">{p.planName}</h3>
                <p className="text-2xl font-bold gradient-neon-text mt-2">৳{p.priceBdt}</p>
                <p className="text-[#64748b] text-xs mt-1">{planDuration(p.durationDays)} access</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedPlan && (
        <div className="card-neon p-6 mb-6 animate-fade-in">
          <h2 className="text-lg font-semibold text-[#e2e8f0] mb-4">Complete Payment — {selectedPlan.planName}</h2>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="text-center">
              <div className="w-48 h-48 bg-white rounded-xl flex items-center justify-center mx-auto mb-3">
                <img src="/images/bkash-qr.png" alt="bKash QR" className="w-44 h-44 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
              <p className="text-[#64748b] text-xs">Scan to pay ৳{selectedPlan.priceBdt}</p>
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm text-[#94a3b8] mb-1">bKash Number</label>
                <input value={bkashNumber} onChange={(e) => setBkashNumber(e.target.value)} className="w-full px-4 py-2.5 bg-[#0a0a0f] border border-[rgba(0,212,255,0.12)] rounded-lg text-[#e2e8f0] focus:outline-none focus:border-[#00d4ff] transition-all" placeholder="01XXXXXXXXX" />
              </div>
              <div>
                <label className="block text-sm text-[#94a3b8] mb-1">Transaction ID</label>
                <input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} className="w-full px-4 py-2.5 bg-[#0a0a0f] border border-[rgba(0,212,255,0.12)] rounded-lg text-[#e2e8f0] focus:outline-none focus:border-[#00d4ff] transition-all" placeholder="Transaction reference" />
              </div>
              <button onClick={handleSubmit} disabled={submitting} className="px-6 py-3 rounded-lg gradient-neon text-[#0a0a0f] font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50">
                {submitting ? "Submitting..." : "Submit Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card-neon p-6">
        <h2 className="text-lg font-semibold text-[#e2e8f0] mb-4">Payment History</h2>
        {payments.length === 0 ? (
          <p className="text-[#64748b] text-sm">No payment history.</p>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-[rgba(255,255,255,0.05)]">
                <div>
                  <p className="text-sm text-[#e2e8f0]">৳{p.amount} — {p.plan?.planName || "Plan"}</p>
                  <p className="text-xs text-[#64748b]">Txn: {p.transactionId} · {new Date(p.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={`text-sm font-medium ${statusColor(p.status)}`}>{p.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
