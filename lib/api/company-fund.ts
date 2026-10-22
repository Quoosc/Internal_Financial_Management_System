// =============================================================
// Company Fund API — khớp với CompanyFundController (/api/v1/company-fund)
// =============================================================

import { api } from "@/lib/api-client";
import type {
  CompanyFundResponse,
  ReconciliationReportResponse,
  SystemTopupRequest,
  UpdateBankStatementRequest,
} from "@/types";
import type { TransactionResponse } from "@/types";

/** GET /api/v1/company-fund — Xem thông tin quỹ công ty */
export async function getCompanyFund() {
  return api.get<CompanyFundResponse>("/api/v1/company-fund");
}

/** POST /api/v1/company-fund/topup — Nạp tiền vào quỹ */
export async function topupCompanyFund(data: SystemTopupRequest) {
  return api.post<TransactionResponse>("/api/v1/company-fund/topup", data);
}

/** PUT /api/v1/company-fund/bank-statement — Cập nhật sao kê ngân hàng */
export async function updateBankStatement(data: UpdateBankStatementRequest) {
  return api.put<CompanyFundResponse>(
    "/api/v1/company-fund/bank-statement",
    data
  );
}

/** GET /api/v1/company-fund/reconciliation — Báo cáo đối soát */
export async function getReconciliationReport() {
  return api.get<ReconciliationReportResponse>(
    "/api/v1/company-fund/reconciliation"
  );
}
