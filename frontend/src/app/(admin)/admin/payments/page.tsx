"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { PaymentRequest } from "@/types";
import { toast } from "sonner";

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = () => {
    api.admin.pendingPayments().then((d) => setPayments(d.payments)).finally(() => setLoading(false));
  };

  useEffect(() => { fetchPayments(); }, []);

  const handleApprove = async (id: string) => {
    try { await api.admin.approvePayment(id); toast.success("Approved"); fetchPayments(); }
    catch { toast.error("Failed"); }
  };

  const handleReject = async (id: string) => {
    if (!confirm("Reject this payment?")) return;
    try { await api.admin.rejectPayment(id); toast.success("Rejected"); fetchPayments(); }
    catch { toast.error("Failed"); }
  };

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-[#e2e8f0] mb-1">Payment Queue</h1>
      <p className="text-[#64748b] text-sm mb-8">Review pending payment requests.</p>

      {loading ? <p className="text-[#64748b]">Loading...</p> : payments.length === 0 ? (
        <div className="card-neon border-glow-purple p-12 text-center">
          <p className="text-[#64748b]">No pending payments.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((p) => (
            <div key={p.id} className="card-neon border-glow-purple p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-[#e2e8f0] font-semibold">{p.user?.name || "Unknown"}</h3>
                  <p className="text-[#64748b] text-xs mt-1">{p.user?.email}</p>
                  <div className="mt-3 space-y-1">
                    <p className="text-sm text-[#94a3b8]">Amount: <span className="text-[#e2e8f0]">৳{p.amount}</span></p>
                    <p className="text-sm text-[#94a3b8]">Plan: <span className="text-[#e2e8f0]">{p.plan?.planName || "N/A"}</span></p>
                    <p className="text-sm text-[#94a3b8]">bKash: <span className="text-[#e2e8f0]">{p.bkashNumber}</span></p>
                    <p className="text-sm text-[#94a3b8]">Txn ID: <span className="text-[#e2e8f0] font-mono">{p.transactionId}</span></p>
                    <p className="text-xs text-[#475569]">{new Date(p.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleApprove(p.id)} className="px-4 py-2 rounded-lg bg-[rgba(0,255,136,0.1)] text-[#00ff88] text-sm font-medium hover:bg-[rgba(0,255,136,0.2)] border border-[rgba(0,255,136,0.2)] transition-all">
                    Approve
                  </button>
                  <button onClick={() => handleReject(p.id)} className="px-4 py-2 rounded-lg bg-[rgba(255,51,102,0.1)] text-[#ff3366] text-sm font-medium hover:bg-[rgba(255,51,102,0.2)] border border-[rgba(255,51,102,0.2)] transition-all">
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
