const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface FetchOptions extends RequestInit {
  noAuth?: boolean;
}

async function request<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { noAuth, ...fetchOptions } = options;
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...fetchOptions,
    credentials: noAuth ? "omit" : "include",
    headers: { "Content-Type": "application/json", ...fetchOptions.headers },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

export const api = {
  auth: {
    register: (body: { name: string; email: string; password: string }) =>
      request<{ user: any }>("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
    login: (body: { email: string; password: string }) =>
      request<{ user: any }>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
    logout: () => request("/api/auth/logout", { method: "POST" }),
    me: () => request<{ user: any }>("/api/auth/me"),
  },
  users: {
    list: () => request<{ users: any[] }>("/api/users"),
    stats: () => request<{ apiCount: number; callCount: number; apiCreationAttempts: number; subscriptionStatus: string }>("/api/users/stats"),
  },
  workflows: {
    list: () => request<{ workflows: any[] }>("/api/workflows"),
    get: (id: string) => request<{ workflow: any }>(`/api/workflows/${id}`),
    import: (body: { name: string; steps: any[] }) =>
      request<{ workflow: any }>("/api/workflows/import", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: any) =>
      request<{ workflow: any }>(`/api/workflows/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    delete: (id: string) => request(`/api/workflows/${id}`, { method: "DELETE" }),
  },
  apis: {
    list: () => request<{ apis: any[] }>("/api/apis"),
    get: (id: string) => request<{ api: any }>(`/api/apis/${id}`),
    create: (body: { workflowId: string; apiName: string; description?: string }) =>
      request<{ api: any }>("/api/apis", { method: "POST", body: JSON.stringify(body) }),
    delete: (id: string) => request(`/api/apis/${id}`, { method: "DELETE" }),
  },
  execution: {
    run: (apiId: string, variables: Record<string, string>) =>
      request<{ executionId: string; status: string; result: any }>(`/api/execution/${apiId}/run`, {
        method: "POST",
        body: JSON.stringify({ variables }),
      }),
    history: (apiId: string) => request<{ calls: any[] }>(`/api/execution/${apiId}/history`),
  },
  payments: {
    submit: (body: { planId: string; transactionId: string; bkashNumber: string }) =>
      request<{ payment: any }>("/api/payments", { method: "POST", body: JSON.stringify(body) }),
    my: () => request<{ payments: any[] }>("/api/payments/my"),
  },
  admin: {
    users: () => request<{ users: any[] }>("/api/admin/users"),
    pendingPayments: () => request<{ payments: any[] }>("/api/admin/payments/pending"),
    approvePayment: (id: string) => request(`/api/admin/payments/${id}/approve`, { method: "PUT" }),
    rejectPayment: (id: string) => request(`/api/admin/payments/${id}/reject`, { method: "PUT" }),
    pricing: () => request<{ settings: any[] }>("/api/admin/pricing"),
    updatePricing: (settings: Record<string, string>) =>
      request("/api/admin/pricing", { method: "PUT", body: JSON.stringify({ settings }) }),
    settings: () => request<{ settings: any[] }>("/api/admin/settings"),
    updateSettings: (settings: Record<string, string>) =>
      request("/api/admin/settings", { method: "PUT", body: JSON.stringify({ settings }) }),
    stats: () => request<any>("/api/admin/stats"),
    plans: () => request<{ plans: any[] }>("/api/admin/plans"),
    createPlan: (data: { planName: string; priceBdt: number; durationDays: number }) =>
      request<{ plan: any }>("/api/admin/plans", { method: "POST", body: JSON.stringify(data) }),
    updatePlan: (id: string, data: any) =>
      request<{ plan: any }>(`/api/admin/plans/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deletePlan: (id: string) => request(`/api/admin/plans/${id}`, { method: "DELETE" }),
  },
};
