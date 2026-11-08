// =============================================================
// Dashboard Types - khớp với backend API_Spec.md v2.0
// Endpoints: GET /dashboard/{role}
// =============================================================

// --- Employee Dashboard ---

/** GET /dashboard/employee — response */
export interface EmployeeDashboardResponse {
  wallet: {
    balance: number;
    lockedBalance: number;
    availableBalance: number;
    // Legacy fallback fields (for older mock data)
    pendingBalance?: number;
    debtBalance?: number;
  };
  pendingRequestsCount: number;
  recentTransactions: {
    id: number;
    transactionId: number;
    transactionCode: string;
    direction: string;
    amount: number;
    createdAt: string;
  }[];
  recentPayslip: {
    id: number;
    payslipCode: string;
    periodName: string;
    finalNetSalary: number;
    status: string;
  } | null;
}

// --- Manager Dashboard ---

/** GET /dashboard/manager — response */
export interface ManagerDashboardResponse {
  department?: {
    id: number;
    name: string;
    code: string;
  };
  departmentBudget: {
    totalProjectQuota: number;
    totalAvailableBalance: number;
    totalSpent: number;
  };
  projectStatusSummary: {
    active: number;
    planning: number;
    paused: number;
    closed: number;
  };
  pendingApprovalsCount: number;
  teamDebtSummary: {
    totalDebt: number;
    employeesWithDebt: number;
  };
}

// --- Accountant Dashboard ---

/** GET /dashboard/accountant — response */
export interface AccountantDashboardResponse {
  systemFundBalance: number;
  fundHealth: "HEALTHY" | "LOW" | "CRITICAL";
  pendingDisbursementsCount: number;
  monthlyInflow: number;
  monthlyOutflow: number;
  payrollStatus: {
    latestPeriod: string | null;
    status: string | null;
  } | null;
}

// --- CFO Dashboard ---

/** GET /dashboard/cfo — response */
export interface CfoDashboardResponse {
  companyFundBalance: number;
  fundHealth: "HEALTHY" | "LOW" | "CRITICAL";
  pendingApprovalsCount: number;
  monthlyApprovedAmount: number;
  monthlyRejectedCount: number;
  recentApprovals: {
    id: number;
    requestCode: string;
    departmentName: string;
    amount: number;
    status: string;
    createdAt: string;
  }[];
}

// --- Admin Dashboard ---

/** GET /dashboard/admin — response */
export interface AdminDashboardResponse {
  totalUsers: number;
  totalDepartments: number;
  totalWalletBalance: number;
  recentAuditEvents: {
    id: number;
    actorName: string | null;
    action: string;
    entityName: string;
    createdAt: string;
  }[];
}

// --- Analytics (shared) ---

export interface CashFlowPoint {
  label: string;
  inflow: number;
  outflow: number;
}

/** GET /dashboard/analytics/cashflow?period=...&unit=... */
export interface CashFlowAnalyticsResponse {
  period: string;
  points: CashFlowPoint[];
  totalInflow: number;
  totalOutflow: number;
}

// --- Admin Analytics ---

/** GET /dashboard/admin/analytics */
export interface AdminAnalyticsResponse {
  deptSpending: {
    deptId: number;
    deptName: string;
    spent: number;
  }[];
  topDebtors: {
    userId: number;
    fullName: string;
    deptName: string;
    outstandingAmount: number;
    daysSinceDisbursement: number;
  }[];
}
