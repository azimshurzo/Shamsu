export interface User {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  subscriptionStatus: "FREE" | "ACTIVE" | "EXPIRED";
  subscriptionExpiresAt?: string;
  apiCreationAttempts: number;
  createdAt: string;
}

export interface Plan {
  id: string;
  planName: string;
  priceBdt: number;
  durationDays: number;
  active: boolean;
}

export interface Workflow {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  steps: WorkflowStep[];
  variables: WorkflowVariable[];
}

export interface WorkflowStep {
  id: string;
  workflowId: string;
  stepOrder: number;
  actionType: string;
  selector: string;
  value?: string;
  url?: string;
  context?: string;
  text?: string;
  isConstant: boolean;
  isExtractionTarget: boolean;
  containerSelector?: string;
  fieldSelector?: string;
  fieldName?: string;
  extractAll: boolean;
}

export interface WorkflowVariable {
  id: string;
  workflowId: string;
  stepId?: string;
  variableName: string;
  defaultValue?: string;
  required: boolean;
}

export interface Api {
  id: string;
  userId: string;
  apiName: string;
  description?: string;
  workflowId: string;
  workflow: Workflow;
  complexityLevel: number;
  pricePerCall: number;
  isActive: boolean;
  createdAt: string;
  _count?: { apiCalls: number };
}

export interface ApiCall {
  id: string;
  apiId: string;
  userId: string;
  callCost: number;
  status: "SUCCESS" | "FAILED" | "PENDING";
  resultJson?: any;
  createdAt: string;
}

export interface PaymentRequest {
  id: string;
  userId: string;
  planId?: string;
  plan?: Plan;
  transactionId: string;
  bkashNumber: string;
  amount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  user?: { id: string; name: string; email: string };
}

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
}

export interface DashboardStats {
  apiCount: number;
  callCount: number;
  apiCreationAttempts: number;
  subscriptionStatus: string;
}

export interface AdminStats {
  totalUsers: number;
  totalApis: number;
  totalCalls: number;
  pendingPayments: number;
  totalRevenue: number;
}
