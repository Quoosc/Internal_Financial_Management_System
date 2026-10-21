// =============================================================
// Accounting Types - khớp với backend modules/accounting (v3.0)
// Cập nhật: SystemFund → CompanyFundResponse
//           Thêm ReconciliationReportResponse, SystemTopupRequest
// =============================================================

// --- Enums ---

/** khớp với accounting.entity.PayrollStatus */
export enum PayrollStatus {
  DRAFT = "DRAFT",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
}

/** khớp với accounting.entity.PayslipStatus */
export enum PayslipStatus {
  REVERSED = "REVERSED",
  DRAFT = "DRAFT",
  PAID = "PAID",
}

// --- Employee Payslip DTOs ---

/** GET /payslips — response item (Employee view) */
export interface PayslipListItem {
  id: number;
  payslipCode: string;
  periodId: number;
  periodName: string;
  month: number;
  year: number;
  status: PayslipStatus;
  finalNetSalary: number;
}

/** GET /payslips/:id — response (Employee payslip detail) */
export interface PayslipDetailResponse {
  id: number;
  payslipCode: string;
  periodId: number;
  periodName: string;
  month: number;
  year: number;
  status: PayslipStatus;
  baseSalary: number;
  bonus: number;
  allowance: number;
  totalEarnings: number;       // computed: baseSalary + bonus + allowance
  deduction: number;
  advanceDeduct: number;
  totalDeduction: number;      // computed: deduction + advanceDeduct
  finalNetSalary: number;
  employee: {
    id: number;
    fullName: string;
    employeeCode: string;
    departmentName: string;
    jobTitle: string;
    bankName: string;
    bankAccountNum: string;    // masked: ****6789
  };
}

// --- Accountant Payroll DTOs ---

/** GET /accountant/payroll — response item (danh sách kỳ lương) */
export interface PayrollPeriodListItem {
  id: number;
  periodCode: string;
  name: string;
  month: number;
  year: number;
  startDate: string;
  endDate: string;
  status: PayrollStatus;
  employeeCount: number;
  totalNetPayroll: number;
  createdAt: string;
  updatedAt: string;
}

/** Entry trong bảng lương (payslip trong payroll detail) */
export interface PayrollEntry {
  id: number;
  payslipCode: string;
  userId: number;
  fullName: string;
  avatar: string | null;
  employeeCode: string;
  jobTitle: string | null;
  baseSalary: number;
  bonus: number;
  allowance: number;
  deduction: number;
  advanceDeduct: number;
  finalNetSalary: number;
  status: PayslipStatus;
}

/** GET /accountant/payroll/:periodId — response (chi tiết bảng lương) */
export interface PayrollDetailResponse {
  id: number;
  periodCode: string;
  name: string;
  month: number;
  year: number;
  startDate: string;
  endDate: string;
  status: PayrollStatus;
  nettingApplied: boolean;
  employeeCount: number;
  totalNetPayroll: number;
  entries: PayrollEntry[];
  createdAt: string;
  updatedAt: string;
}

/** POST /accountant/payroll/:periodId/import — response */
export interface PayrollImportResponse {
  periodId: number;
  periodCode: string;
  status: string;           // backend returns String, not PayrollStatus enum
  totalRows: number;
  successCount: number;
  errorCount: number;
  entries: PayrollImportEntry[];
  errors: PayrollImportError[];
  totalNetPayroll: number;
}

/** Per-row result for the payroll import (khớp PayrollImportEntryResponse) */
export interface PayrollImportEntry {
  id: number | null;             // null for error rows
  payslipCode: string | null;    // null for error rows
  userId: number | null;         // null for error rows
  fullName: string;
  employeeCode: string;
  baseSalary: number;
  bonus: number;
  allowance: number;
  deduction: number;
  advanceDeduct: number;
  finalNetSalary: number;
  status: string | null;         // PayslipStatus as string, null for error rows
  importStatus: "ok" | "error";
  importError: string | null;
}

export interface PayrollImportError {
  row: number;
  field: string;
  message: string;
}

/** POST /accountant/payroll/:periodId/auto-netting — response */
export interface AutoNettingResponse {
  periodId: number;
  periodCode: string;
  totalAdvanceDeducted: number;
  summary: AutoNettingSummaryItem[];
}

export interface AutoNettingSummaryItem {
  userId: number;
  employeeCode: string;
  fullName: string;
  outstandingDebt: number;
  deductedAmount: number;
  remainingDebt: number;
  note: string;
}

/** POST /accountant/payroll/:periodId/run — response */
export interface PayrollRunResponse {
  periodId: number;
  periodCode: string;
  status: PayrollStatus;
  payslipsGenerated: number;
  totalNetPayroll: number;
}

// --- Request DTOs ---

/** POST /accountant/payroll — body */
export interface CreatePayrollPeriodBody {
  name: string;
  month: number;
  year: number;
  startDate: string;
  endDate: string;
}

/** PUT /accountant/payroll/:periodId/entries/:payslipId — body */
export interface UpdatePayslipEntryBody {
  baseSalary?: number;
  bonus?: number;
  allowance?: number;
  deduction?: number;
  advanceDeduct?: number;
}

// --- Company Fund (thay thế SystemFund cũ) ---

/**
 * GET /api/v1/company-fund — response
 * khớp với accounting.dto.response.CompanyFundResponse
 *
 * Balance tracking bởi Wallet(COMPANY_FUND) — entity này chỉ là metadata.
 */
export interface CompanyFundResponse {
  bankComparisonStatus: "VERIFIED_SCOPE" | "MISSING_EVIDENCE";
  bankScopeConfirmed: boolean;
  corporateBalanceAtStatement: number | null;
  pendingCorporateAmount: number | null;
  statementAsOf: string | null;
  statementEvidenceRef: string | null;
  id: number;
  bankName: string;
  bankAccount: string;
  /** Current balance tracked by Wallet(COMPANY_FUND) — authoritative */
  currentWalletBalance: number;
  /** Last known external bank balance entered by Accountant */
  externalBankBalance: number;
  /** currentWalletBalance − externalBankBalance (expected = 0) */
  bankDiscrepancy: number | null;
  lastStatementDate: string | null;    // "YYYY-MM-DD"
  lastStatementUpdatedBy: string | null;
}

/**
 * GET /api/v1/company-fund/reconciliation — response
 * khớp với accounting.dto.response.ReconciliationReportResponse
 *
 * Kiểm tra 2 điều:
 *   1. FLOAT_MAIN invariant (internal integrity)
 *   2. Bank statement match (external reconciliation)
 */
export interface ReconciliationReportResponse {
  bankComparisonStatus: "VERIFIED_SCOPE" | "MISSING_EVIDENCE";
  corporateBalanceAtStatement: number | null;
  pendingCorporateAmount: number | null;
  statementAsOf: string | null;
  statementEvidenceRef: string | null;
  generatedAt: string;

  // System Integrity Check (FLOAT_MAIN invariant)
  floatMainBalance: number;
  computedWalletSum: number;
  systemDiscrepancy: number;         // Expected = 0
  systemIntegrityValid: boolean;

  // Wallet Breakdown
  companyFundBalance: number;
  totalDeptWallets: number;
  totalProjectWallets: number;
  totalUserWallets: number;

  // Bank Statement Check (external reconciliation)
  externalBankBalance: number;
  lastStatementDate: string | null;
  bankDiscrepancy: number | null;           // Expected = 0
}

/**
 * POST /api/v1/company-fund/topup — body
 * khớp với accounting.dto.request.SystemTopupRequest
 */
export interface SystemTopupRequest {
  amount: number;
  paymentRef?: string;
  description?: string;
}

/**
 * PUT /api/v1/company-fund/bank-statement — body
 * khớp với accounting.dto.request.UpdateBankStatementRequest
 */
export interface UpdateBankStatementRequest {
  evidenceRef: string;
  asOf: string;
  externalBankBalance: number;
  lastStatementDate: string;     // "YYYY-MM-DD"
}

// --- Ledger DTOs ---

/** GET /accountant/ledger/summary — response */
export interface LedgerSummaryResponse {
  currentBalance: number;
  totalInflow: number;
  totalOutflow: number;
  transactionCount: number;
}

export type AccountingJournalEvent =
  | "ADVANCE_DISBURSED"
  | "EXPENSE_VERIFIED"
  | "EXPENSE_PAID"
  | "REIMBURSE_SETTLED"
  | "ADVANCE_RETURNED"
  | "PAYROLL_SETTLEMENT"
  | "SYSTEM_TOPUP"
  | "DEPARTMENT_ALLOCATION"
  | "PROJECT_ALLOCATION"
  | "REVERSAL"
  | "OPENING_BALANCE";

export interface AccountingJournalItem {
  id: number;
  journalCode: string;
  eventType: AccountingJournalEvent;
  postingDate: string;
  postingPeriod: string;
  description: string;
  sourceType: string;
  sourceId: string;
  requestId: number | null;
  advanceBalanceId: number | null;
  employeeId: number | null;
  employeeName: string | null;
  projectId: number | null;
  projectName: string | null;
  walletTransactionId: number | null;
  totalAmount: number;
  balanced: boolean;
  createdByUserId: number | null;
  createdByName: string | null;
  createdAt: string | null;
}

export interface AccountingJournalLine {
  id: number;
  accountCode: string;
  accountName: string;
  debitAmount: number;
  creditAmount: number;
  effectDescription: string;
  advanceBalanceId: number | null;
  requestId: number | null;
  employeeId: number | null;
  projectId: number | null;
}

export interface AccountingJournalDetail extends AccountingJournalItem {
  businessDate: string | null; departmentName: string | null; phaseName: string | null; categoryName: string | null;
  sourceSnapshot: string | null; originalJournalId: number | null; reversalJournalId?: number | null;
  totalDebit: number;
  totalCredit: number;
  lines: AccountingJournalLine[];
}

export interface AdvanceActivity {
  journalId: number;
  journalCode: string;
  eventType: AccountingJournalEvent;
  postingDate: string;
  description: string;
  amount: number;
}

export interface AdvanceBalanceDetail {
  id: number;
  requestCode: string;
  disbursedDate: string | null;
  projectId: number | null;
  projectName: string | null;
  phaseName: string | null;
  categoryName: string | null;
  originalAmount: number;
  reimbursedAmount: number;
  cashReturnedAmount: number;
  payrollOffsetAmount: number;
  legacyUnclassifiedAmount: number;
  remainingAmount: number;
  status: "OUTSTANDING" | "PARTIALLY_SETTLED" | "SETTLED";
  activities: AdvanceActivity[];
}

export interface AdvanceEmployeeSummary {
  employeeId: number;
  employeeName: string;
  departmentName: string | null;
  openAdvanceCount: number;
  totalDisbursed: number;
  totalRemaining: number;
  advances: AdvanceBalanceDetail[];
}

export interface LedgerCategoryBudget {
  categoryId: number;
  categoryName: string;
  budgetLimit: number;
  recognizedExpense: number;
  lockedForRequests: number;
  openAdvance: number;
}

export interface LedgerPhaseBudget {
  phaseId: number;
  phaseName: string;
  budgetLimit: number;
  recognizedExpense: number;
  lockedForRequests: number;
  openAdvance: number;
  categories: LedgerCategoryBudget[];
}

export interface LedgerProjectBudget {
  projectId: number;
  projectCode: string;
  projectName: string;
  totalBudget: number;
  projectFundBalance: number;
  recognizedExpense: number;
  lockedForRequests: number;
  openAdvance: number;
  phases: LedgerPhaseBudget[];
}
