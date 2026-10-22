"use client";

import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { ReferencePicker } from "@/components/accounting/reference-picker";
import { StatusBadge } from "@/components/ui/status-badge";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api-client";
import { useToast } from "@/contexts/toast-context";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  AccountantWalletTransactionResponse,
  AccountingJournalEvent,
  AccountingJournalItem,
  AdvanceEmployeeSummary,
  LedgerSummaryResponse,
  LedgerProjectBudget,
  PaginatedResponse,
  ReferenceType,
  TransactionStatus,
  TransactionType,
  WalletOwnerType,
} from "@/types";

type LedgerTab = "wallet" | "journal" | "advances" | "budget";
const PAGE_SIZE = 20;

const transactionTypes = Object.values(TransactionType);
const transactionStatuses = Object.values(TransactionStatus);
const referenceTypes = Object.values(ReferenceType);
const journalEvents: AccountingJournalEvent[] = [
  "ADVANCE_DISBURSED", "EXPENSE_VERIFIED", "EXPENSE_PAID", "REIMBURSE_SETTLED", "ADVANCE_RETURNED", "PAYROLL_SETTLEMENT",
  "SYSTEM_TOPUP", "DEPARTMENT_ALLOCATION", "PROJECT_ALLOCATION", "REVERSAL", "OPENING_BALANCE",
];

const transactionLabels: Record<string, string> = {
  REQUEST_PAYMENT: "Chuyển tiền theo yêu cầu",
  PAYSLIP_PAYMENT: "Trả lương",
  SYSTEM_TOPUP: "Nạp quỹ công ty",
  DEPOSIT: "Nạp tiền vào ví",
  WITHDRAW: "Rút tiền về ngân hàng",
  DEPT_QUOTA_ALLOCATION: "Cấp ngân sách phòng ban",
  PROJECT_QUOTA_ALLOCATION: "Cấp vốn dự án",
  ADVANCE_RETURN: "Nhân viên hoàn tiền tạm ứng",
  REVERSAL: "Đảo giao dịch",
  SYSTEM_ADJUSTMENT: "Điều chỉnh số dư",
};

const eventLabels: Record<AccountingJournalEvent, string> = {
  ADVANCE_DISBURSED: "Giải ngân tạm ứng",
  EXPENSE_VERIFIED: "Xác nhận chứng từ hoàn chi",
  EXPENSE_PAID: "Thanh toán hoàn chi",
  REIMBURSE_SETTLED: "Quyết toán tạm ứng",
  ADVANCE_RETURNED: "Hoàn tiền tạm ứng",
  PAYROLL_SETTLEMENT: "Trả lương và khấu trừ tạm ứng",
  SYSTEM_TOPUP: "Nạp quỹ công ty",
  DEPARTMENT_ALLOCATION: "Cấp ngân sách phòng ban",
  PROJECT_ALLOCATION: "Cấp vốn dự án",
  REVERSAL: "Đảo nghiệp vụ đã ghi",
  OPENING_BALANCE: "Mở sổ có chứng từ",
};

const referenceLabels: Record<string, string> = {
  REQUEST: "Yêu cầu chi tiền",
  PAYSLIP: "Phiếu lương",
  PROJECT: "Dự án",
  DEPARTMENT: "Phòng ban",
  ADVANCE_BALANCE: "Khoản tạm ứng",
  SYSTEM: "Quỹ hệ thống",
  WITHDRAWAL: "Yêu cầu rút tiền",
  DEPOSIT: "Nạp tiền",
};

function getPage<T>(payload: PaginatedResponse<T> | T[]) {
  if (Array.isArray(payload)) return { items: payload, total: payload.length, totalPages: 1 };
  return { items: payload.items ?? [], total: payload.total ?? 0, totalPages: Math.max(1, payload.totalPages ?? 1) };
}

function addFilters(params: URLSearchParams, filters: { type?: string; status?: string; referenceType?: string; event?: string; from: string; to: string }) {
  if (filters.type) params.set("type", filters.type);
  if (filters.status) params.set("status", filters.status);
  if (filters.referenceType) params.set("referenceType", filters.referenceType);
  if (filters.event) params.set("event", filters.event);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return params;
}

function walletOwnerLabel(type: WalletOwnerType, id: number) {
  const labels: Record<string, string> = {
    USER: "Ví nhân viên",
    PROJECT: "Ví dự án",
    DEPARTMENT: "Ví phòng ban",
    COMPANY_FUND: "Quỹ công ty",
    FLOAT_MAIN: "Ví kiểm soát tổng",
  };
  return `${labels[type] ?? type} #${id}`;
}

function statusLabel(status: TransactionStatus) {
  const labels: Record<string, string> = { SUCCESS: "Thành công", PENDING: "Đang xử lý", FAILED: "Thất bại", CANCELLED: "Đã hủy" };
  return labels[status] ?? status;
}

function typeColor(type: string) {
  if (type === "ADVANCE_RETURN" || type === "SYSTEM_TOPUP" || type === "DEPOSIT") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (type === "WITHDRAW" || type === "REVERSAL") return "border-rose-200 bg-rose-50 text-rose-700";
  if (type === "REQUEST_PAYMENT") return "border-violet-200 bg-violet-50 text-violet-700";
  if (type.includes("ALLOCATION")) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

export default function AccountantLedgerPage() {
  const router = useRouter();
  const toast = useToast();
  const [search,setSearch] = useState("");
  const [tab, setTab] = useState<LedgerTab>("wallet");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [referenceType, setReferenceType] = useState("");
  const [event, setEvent] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [journalEmployeeId, setJournalEmployeeId] = useState("");
  const [journalProjectId, setJournalProjectId] = useState("");
  const [journalRequestId, setJournalRequestId] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [reload, setReload] = useState(0);
  const requestEpoch = useRef(0);

  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get("tab");
      setTab(requested && ["wallet", "journal", "advances", "budget"].includes(requested) ? requested as LedgerTab : "wallet");
      setSearch(params.get("search") || "");
      setType(params.get("type") || ""); setStatus(params.get("status") || "");
      setReferenceType(params.get("referenceType") || ""); setEvent(params.get("event") || "");
      setFrom(params.get("from") || ""); setTo(params.get("to") || "");
      setJournalEmployeeId(params.get("employeeId") || ""); setJournalProjectId(params.get("projectId") || "");
      setJournalRequestId(params.get("requestId") || "");
      setPage(Math.max(1, Number(params.get("page")) || 1));
      setReady(true);
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams({ tab, page: String(page) });
    Object.entries({ search, type, status, referenceType, event, from, to, employeeId: journalEmployeeId,
      projectId: journalProjectId, requestId: journalRequestId }).forEach(([key, value]) => { if (value) params.set(key, value); });
    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${params}`);
  }, [ready, tab, page, search, type, status, referenceType, event, from, to, journalEmployeeId, journalProjectId, journalRequestId]);
  const [walletSummary, setWalletSummary] = useState<LedgerSummaryResponse | null>(null);
  const [walletRows, setWalletRows] = useState<AccountantWalletTransactionResponse[]>([]);
  const [journalRows, setJournalRows] = useState<AccountingJournalItem[]>([]);
  const [advanceRows, setAdvanceRows] = useState<AdvanceEmployeeSummary[]>([]);
  const [budgetRows, setBudgetRows] = useState<LedgerProjectBudget[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedEmployee, setExpandedEmployee] = useState<number | null>(null);
  const [expandedBudgetProject, setExpandedBudgetProject] = useState<number | null>(null);

  const loadWallet = useCallback(async () => {
    const epoch = ++requestEpoch.current;
    setLoading(true); setLoadError(null); setTotal(0); setTotalPages(1);
    setWalletSummary(null); setWalletRows([]); setJournalRows([]); setAdvanceRows([]); setBudgetRows([]);
    const filters = { type, status, referenceType, event, from, to };
    try {
      const query = addFilters(new URLSearchParams(), filters);
      query.set("page", String(page));
      query.set("limit", String(PAGE_SIZE));
      const summaryQuery = addFilters(new URLSearchParams(), filters);
      const [listResponse, summaryResponse] = await Promise.all([
        api.get<PaginatedResponse<AccountantWalletTransactionResponse>>(`/api/v1/accountant/ledger/wallet-transactions?${query}`),
        api.get<LedgerSummaryResponse>(`/api/v1/accountant/ledger/summary?${summaryQuery}`),
      ]);
      if (epoch !== requestEpoch.current) return;
      const result = getPage(listResponse.data);
      setWalletRows(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setWalletSummary(summaryResponse.data);
    } catch (error) {
      if (epoch !== requestEpoch.current) return;
      setLoadError(error instanceof ApiError ? error.apiMessage : "Không tải được dữ liệu. Vui lòng thử lại.");
      setTotal(0); setTotalPages(1);
      setWalletRows([]);
      setWalletSummary(null);
      toast.error(error instanceof ApiError ? error.apiMessage : "Không tải được giao dịch ví.");
    } finally {
      if (epoch === requestEpoch.current) setLoading(false);
    }
  }, [event, from, page, referenceType, status, to, toast, type]);

  const loadJournals = useCallback(async () => {
    const epoch = ++requestEpoch.current;
    setLoading(true); setLoadError(null); setTotal(0); setTotalPages(1);
    setWalletSummary(null); setWalletRows([]); setJournalRows([]); setAdvanceRows([]); setBudgetRows([]);
    try {
      const query = addFilters(new URLSearchParams(), { type: "", status: "", referenceType: "", event, from, to });
      if (journalEmployeeId) query.set("employeeId", journalEmployeeId);
      if (journalProjectId) query.set("projectId", journalProjectId);
      if (journalRequestId) query.set("requestId", journalRequestId);
      query.set("page", String(page));
      query.set("limit", String(PAGE_SIZE));
      const response = await api.get<PaginatedResponse<AccountingJournalItem>>(`/api/v1/accountant/ledger/journals?${query}`);
      if (epoch !== requestEpoch.current) return;
      const result = getPage(response.data);
      setJournalRows(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (error) {
      if (epoch !== requestEpoch.current) return;
      setLoadError(error instanceof ApiError ? error.apiMessage : "Không tải được dữ liệu. Vui lòng thử lại.");
      setTotal(0); setTotalPages(1);
      setJournalRows([]);
      toast.error(error instanceof ApiError ? error.apiMessage : "Không tải được sổ cái kế toán.");
    } finally {
      if (epoch === requestEpoch.current) setLoading(false);
    }
  }, [event, from, journalEmployeeId, journalProjectId, journalRequestId, page, to, toast]);

  const loadAdvances = useCallback(async () => {
    const epoch = ++requestEpoch.current;
    setLoading(true); setLoadError(null); setTotal(0); setTotalPages(1);
    setWalletSummary(null); setWalletRows([]); setJournalRows([]); setAdvanceRows([]); setBudgetRows([]);
    try {
      const response = await api.get<PaginatedResponse<AdvanceEmployeeSummary>>(`/api/v1/accountant/ledger/advances/outstanding?page=${page}&limit=${PAGE_SIZE}&search=${encodeURIComponent(search)}`);
      if (epoch !== requestEpoch.current) return;
      const result=getPage(response.data); setAdvanceRows(result.items); setTotal(result.total); setTotalPages(result.totalPages);
    } catch (error) {
      if (epoch !== requestEpoch.current) return;
      setLoadError(error instanceof ApiError ? error.apiMessage : "Không tải được dữ liệu. Vui lòng thử lại.");
      setTotal(0); setTotalPages(1);
      setAdvanceRows([]);
      toast.error(error instanceof ApiError ? error.apiMessage : "Không tải được các khoản tạm ứng còn mở.");
    } finally {
      if (epoch === requestEpoch.current) setLoading(false);
    }
  }, [toast,page,search]);

  const loadBudgetExposure = useCallback(async () => {
    const epoch = ++requestEpoch.current;
    setLoading(true); setLoadError(null); setTotal(0); setTotalPages(1);
    setWalletSummary(null); setWalletRows([]); setJournalRows([]); setAdvanceRows([]); setBudgetRows([]);
    try {
      const response = await api.get<PaginatedResponse<LedgerProjectBudget>>(`/api/v1/accountant/ledger/budget-exposure?page=${page}&limit=${PAGE_SIZE}&search=${encodeURIComponent(search)}`);
      if (epoch !== requestEpoch.current) return;
      const result=getPage(response.data); setBudgetRows(result.items); setTotal(result.total); setTotalPages(result.totalPages);
    } catch (error) {
      if (epoch !== requestEpoch.current) return;
      setLoadError(error instanceof ApiError ? error.apiMessage : "Không tải được dữ liệu. Vui lòng thử lại.");
      setTotal(0); setTotalPages(1);
      setBudgetRows([]);
      toast.error(error instanceof ApiError ? error.apiMessage : "Không tải được tổng hợp ngân sách dự án.");
    } finally {
      if (epoch === requestEpoch.current) setLoading(false);
    }
  }, [toast,page,search]);

  useEffect(() => {
    if (!ready) return;
    if (tab === "wallet") void loadWallet();
    if (tab === "journal") void loadJournals();
    if (tab === "advances") void loadAdvances();
    if (tab === "budget") void loadBudgetExposure();
    return () => { requestEpoch.current++; };
  }, [ready, reload, tab, loadWallet, loadJournals, loadAdvances, loadBudgetExposure]);

  const setTabAndReset = (next: LedgerTab) => {
    setPage(1);
    setTab(next);
  };
  const totalDebit = useMemo(() => journalRows.reduce((sum, row) => sum + row.totalAmount, 0), [journalRows]);
  const balancedCount = useMemo(() => journalRows.filter((row) => row.balanced).length, [journalRows]);
  const totalOutstanding = useMemo(() => advanceRows.reduce((sum, row) => sum + row.totalRemaining, 0), [advanceRows]);
  const currentRows = tab === "wallet" ? walletRows : tab === "journal" ? journalRows : [];

  return (
    <div className="space-y-5 pb-8">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-100">Kế toán · tra cứu tài chính</p>
            <h1 className="mt-2 text-3xl font-bold">Sổ cái</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">Theo dõi tiền thực tế qua ví, bút toán theo tài khoản và số tạm ứng còn phải quyết toán.</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 sm:min-w-44">
            <p className="text-[11px] font-bold uppercase tracking-widest text-blue-100">{tab === "wallet" ? "Giao dịch tìm thấy" : tab === "journal" ? "Bút toán tìm thấy" : tab === "advances" ? "Nhân viên còn tạm ứng" : "Dự án theo dõi"}</p>
            <p className="mt-1 text-3xl font-bold">{total}</p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <TabButton active={tab === "wallet"} onClick={() => setTabAndReset("wallet")}>Giao dịch ví</TabButton>
        <TabButton active={tab === "journal"} onClick={() => setTabAndReset("journal")}>Sổ cái kế toán</TabButton>
        <Link href="/accountant/ledger/accounts" className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-700">Sổ theo tài khoản</Link>
        <Link href="/accountant/ledger/cost-reconciliation" className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-700">Đối chiếu chi phí</Link>
        <Link href="/accountant/ledger/history" className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-700">Lịch sử và mở sổ</Link>
        <Link href="/accountant/ledger/periods" className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-700">Kỳ kế toán</Link>
        <Link href="/accountant/ledger/reconciliation" className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-700">Đối soát ngân hàng</Link>
        <TabButton active={tab === "budget"} onClick={() => setTabAndReset("budget")}>Ngân sách & tạm ứng</TabButton>
        <button
          type="button"
          onClick={() => setTabAndReset("advances")}
          title="Tạm ứng còn phải quyết toán theo nhân viên"
          aria-label="Mở danh sách nhân viên còn tạm ứng phải quyết toán"
          className={`ml-auto inline-flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${tab === "advances" ? "border-blue-600 bg-blue-600 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-700"}`}
        >
          <AdvanceIcon />
          <span className="hidden sm:inline">Tạm ứng còn mở</span>
          {advanceRows.length > 0 && <span className={`min-w-5 rounded-full px-1.5 py-0.5 text-[11px] ${tab === "advances" ? "bg-white/20" : "bg-amber-100 text-amber-800"}`}>{advanceRows.length}</span>}
        </button>
      </div>

      {(tab === "advances" || tab === "budget") && <label className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-5 text-xs text-slate-500">{tab === "advances" ? "Tìm tên nhân viên" : "Tìm tên hoặc mã dự án"}<input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} className="h-11 rounded-xl border border-slate-200 px-3 text-sm"/></label>}
      {(tab === "wallet" || tab === "journal") && <FilterPanel
        tab={tab} type={type} setType={setType} status={status} setStatus={setStatus}
        referenceType={referenceType} setReferenceType={setReferenceType} event={event} setEvent={setEvent}
        employeeId={journalEmployeeId} setEmployeeId={setJournalEmployeeId}
        projectId={journalProjectId} setProjectId={setJournalProjectId}
        requestId={journalRequestId} setRequestId={setJournalRequestId}
        from={from} setFrom={setFrom} to={to} setTo={setTo}
        onFilter={() => setPage(1)}
      />}

      {loadError && <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800"><p>{loadError}</p><button onClick={() => setReload(value => value + 1)} className="shrink-0 rounded-lg border border-rose-300 bg-white px-4 py-2 font-semibold">Thử lại</button></div>}
      {!loadError && tab === "wallet" && <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Giao dịch trong kết quả" value={String(total)} note="Mỗi dòng là một giao dịch; các ví liên quan nằm trong chi tiết." tone="blue" />
          <MetricCard label="Số dư quỹ công ty hiện tại" value={walletSummary ? formatCurrency(walletSummary.currentBalance) : "?"} note="Ảnh chụp số dư hiện tại, không bị giới hạn theo khoảng ngày." tone="slate" />
          <MetricCard label="Tiền vào quỹ công ty" value={walletSummary ? formatCurrency(walletSummary.totalInflow) : "?"} note="Theo bộ lọc đang chọn; chỉ tính biến động của quỹ công ty." tone="green" />
          <MetricCard label="Tiền ra quỹ công ty" value={walletSummary ? formatCurrency(walletSummary.totalOutflow) : "?"} note="Theo bộ lọc đang chọn; chỉ tính biến động của quỹ công ty." tone="rose" />
        </div>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <SectionHeading title="Giao dịch ví" subtitle="Một giao dịch chỉ xuất hiện một lần. Chọn dòng để xem số dư trước và sau ở từng ví." />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="bg-blue-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr><th className="px-5 py-3">Mã giao dịch</th><th className="px-5 py-3">Nghiệp vụ</th><th className="px-5 py-3">Ví liên quan</th><th className="px-5 py-3 text-right">Số tiền</th><th className="px-5 py-3">Trạng thái</th><th className="px-5 py-3">Thời gian</th></tr>
              </thead>
              <tbody>
                {loading ? <LoadingRow columns={6} /> : walletRows.length === 0 ? <EmptyRow columns={6} text="Không có giao dịch phù hợp với bộ lọc." /> : walletRows.map((row) => (
                  <tr key={row.id} tabIndex={0} onClick={() => router.push(`/accountant/ledger/${row.id}`)} onKeyDown={(e) => e.key === "Enter" && router.push(`/accountant/ledger/${row.id}`)} className="cursor-pointer border-t border-slate-100 hover:bg-blue-50/60">
                    <td className="px-5 py-4"><span className="font-mono text-xs font-semibold text-blue-700">{row.transactionCode}</span><p className="mt-1 max-w-64 truncate text-xs text-slate-500">{row.description || "Không có mô tả"}</p></td>
                    <td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${typeColor(row.type)}`}>{transactionLabels[row.type] ?? row.type}</span><p className="mt-1 text-[11px] text-slate-400">{row.referenceType ? `${referenceLabels[row.referenceType] ?? row.referenceType} · #${row.referenceId ?? "—"}` : "Không có tham chiếu"}</p></td>
                    <td className="px-5 py-4"><div className="flex flex-wrap gap-1.5">{row.walletMovements.map((movement) => <span key={movement.id} className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-600">{walletOwnerLabel(movement.walletOwnerType, movement.walletOwnerId)}</span>)}</div></td>
                    <td className="px-5 py-4 text-right text-sm font-bold text-slate-900">{formatCurrency(row.amount)}</td>
                    <td className="px-5 py-4"><StatusBadge variant={row.status === "SUCCESS" ? "emerald" : row.status === "PENDING" ? "amber" : row.status === "FAILED" ? "rose" : "slate"} label={statusLabel(row.status)} /></td>
                    <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-600">{formatDateTime(row.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
        </section>
      </>}

      {!loadError && tab === "journal" && <>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Bút toán trong kết quả" value={String(total)} note="Mỗi bút toán gắn với một sự kiện nghiệp vụ cụ thể." tone="blue" />
          <MetricCard label="Giá trị bút toán ở trang này" value={formatCurrency(totalDebit)} note="Cộng các dòng bút toán ở trang hiện tại." tone="green" />
          <MetricCard label="Bút toán cân bằng" value={`${balancedCount} / ${journalRows.length}`} note="So sánh hai phía của từng bút toán đang hiển thị." tone="slate" />
        </div>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <SectionHeading title="Sổ cái kế toán" subtitle="Các dòng tác động lên tài khoản kế toán; khác với dòng biến động số dư ví." />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left">
              <thead className="bg-blue-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Mã và ngày ghi sổ</th><th className="px-5 py-3">Nghiệp vụ · nguồn</th><th className="px-5 py-3">Nhân viên / dự án</th><th className="px-5 py-3 text-right">Số tiền</th><th className="px-5 py-3 text-right">Đối chiếu</th></tr></thead>
              <tbody>
                {loading ? <LoadingRow columns={5} /> : journalRows.length === 0 ? <EmptyRow columns={5} text="Chưa có bút toán kế toán khớp với bộ lọc." /> : journalRows.map((row) => (
                  <tr key={row.id} tabIndex={0} onClick={() => router.push(`/accountant/ledger/journals/${row.id}`)} onKeyDown={(e) => e.key === "Enter" && router.push(`/accountant/ledger/journals/${row.id}`)} className="cursor-pointer border-t border-slate-100 hover:bg-blue-50/60">
                    <td className="px-5 py-4"><span className="font-mono text-xs font-semibold text-blue-700">{row.journalCode}</span><p className="mt-1 text-xs text-slate-500">{row.postingDate} · kỳ {row.postingPeriod}</p><p className="mt-1 text-[11px] text-slate-400">Tạo bởi {row.createdByName || "Dữ liệu cũ"}</p></td>
                    <td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${typeColor(row.eventType)}`}>{eventLabels[row.eventType]}</span><p className="mt-1 max-w-72 truncate text-xs text-slate-500">{row.description}</p></td>
                    <td className="px-5 py-4 text-xs text-slate-600">{row.employeeName || "—"}<p className="mt-1 text-slate-400">{row.projectName || "Không gắn dự án"}</p></td>
                    <td className="px-5 py-4 text-right text-sm font-bold text-slate-900">{formatCurrency(row.totalAmount)}</td>
                    <td className="px-5 py-4 text-right"><BalanceBadge balanced={row.balanced} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
        </section>
      </>}

      {!loadError && tab === "advances" && <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
        <SectionHeading title="Tạm ứng còn phải quyết toán theo nhân viên" subtitle="Mỗi dòng là một nhân viên. Mở rộng để xem từng khoản tạm ứng, chứng từ đã xác nhận, tiền hoàn thật và phần bù trừ lương." badge={`${total} nhân viên`} amber />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[740px] text-left">
            <thead className="bg-amber-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Nhân viên</th><th className="px-5 py-3">Khoản đang mở</th><th className="px-5 py-3 text-right">Đã giải ngân</th><th className="px-5 py-3 text-right">Còn phải quyết toán</th><th className="px-5 py-3 text-right">Chi tiết</th></tr></thead>
            <tbody>
              {loading ? <LoadingRow columns={5} /> : advanceRows.length === 0 ? <EmptyRow columns={5} text="Không có nhân viên nào còn khoản tạm ứng phải quyết toán." /> : advanceRows.map((employee) => {
                const expanded = expandedEmployee === employee.employeeId;
                return <React.Fragment key={employee.employeeId}>
                  <tr className="border-t border-slate-100 hover:bg-amber-50/30">
                    <td className="px-5 py-4"><p className="font-semibold text-slate-900">{employee.employeeName}</p><p className="mt-1 text-xs text-slate-500">{employee.departmentName || "Chưa có phòng ban"}</p></td>
                    <td className="px-5 py-4 text-sm text-slate-700">{employee.openAdvanceCount} khoản</td>
                    <td className="px-5 py-4 text-right text-sm text-slate-700">{formatCurrency(employee.totalDisbursed)}</td>
                    <td className="px-5 py-4 text-right text-sm font-bold text-amber-800">{formatCurrency(employee.totalRemaining)}</td>
                    <td className="px-5 py-4 text-right"><button type="button" onClick={() => setExpandedEmployee(expanded ? null : employee.employeeId)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50">{expanded ? "Thu gọn" : "Mở"}</button></td>
                  </tr>
                  {expanded && <tr className="border-t border-amber-100 bg-amber-50/30"><td colSpan={5} className="p-4 sm:p-5"><div className="space-y-4">{employee.advances.map((advance) => <AdvanceDetailCard key={advance.id} advance={advance} onOpenJournal={(journalId) => router.push(`/accountant/ledger/journals/${journalId}`)} />)}</div></td></tr>}
                </React.Fragment>;
              })}
            </tbody>
          </table>
        </div>
        {!loading && advanceRows.length > 0 && <div className="border-t border-amber-100 bg-amber-50/50 px-5 py-3 text-sm text-slate-600">Tổng dư tạm ứng trên trang này: <strong className="text-amber-800">{formatCurrency(totalOutstanding)}</strong></div>}
      </section>}

      {!loadError && tab === "budget" && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <SectionHeading title="Theo dõi ngân sách theo dự án" subtitle="Xem riêng chi phí đã xác nhận, tiền đang khóa cho yêu cầu và tạm ứng còn mở; các khoản này không cộng chồng lên nhau." badge={`${total} dự án`} />
        <div className="border-b border-blue-100 bg-blue-50/60 px-5 py-3 text-xs leading-5 text-blue-900">Chi phí đã xác nhận lấy từ số liệu ngân sách hiện có. Tạm ứng đang mở là số còn phải quyết toán. Tiền đang khóa chỉ gồm phần giữ cho yêu cầu đã được duyệt hoặc đã xác nhận chứng từ.</div>
        {loading ? <div className="px-5 py-12 text-center text-sm text-slate-500">Đang tải ngân sách…</div> : budgetRows.length === 0 ? <div className="px-5 py-12 text-center text-sm text-slate-500">Chưa có dữ liệu ngân sách dự án.</div> : <div className="divide-y divide-slate-100">{budgetRows.map((project) => {
          const expanded = expandedBudgetProject === project.projectId;
          return <article key={project.projectId}>
            <div className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0"><p className="font-mono text-xs font-semibold text-blue-700">{project.projectCode}</p><h3 className="mt-1 text-base font-bold text-slate-900">{project.projectName}</h3><p className="mt-1 text-xs text-slate-500">Ngân sách dự án: {formatCurrency(project.totalBudget)} · Số dư quỹ dự án: {formatCurrency(project.projectFundBalance)}</p></div>
              <div className="grid flex-1 gap-2 sm:grid-cols-3">
                <BudgetMetric label="Chi phí đã xác nhận" value={project.recognizedExpense} tone="blue" />
                <BudgetMetric label="Đang khóa cho yêu cầu" value={project.lockedForRequests} tone="amber" />
                <BudgetMetric label="Tạm ứng còn mở" value={project.openAdvance} tone="rose" />
              </div>
              <button type="button" onClick={() => setExpandedBudgetProject(expanded ? null : project.projectId)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50">{expanded ? "Thu gọn" : "Xem giai đoạn"}</button>
            </div>
            {expanded && <div className="space-y-4 border-t border-slate-100 bg-slate-50/60 p-4 sm:p-5">{project.phases.length === 0 ? <p className="text-sm text-slate-500">Dự án chưa có giai đoạn.</p> : project.phases.map((phase) => <div key={phase.phaseId} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="grid gap-3 p-4 sm:grid-cols-4"><div><p className="text-xs text-slate-500">Giai đoạn</p><p className="mt-1 font-semibold text-slate-900">{phase.phaseName}</p></div><BudgetMetric label="Hạn mức" value={phase.budgetLimit} tone="slate"/><BudgetMetric label="Chi phí đã xác nhận" value={phase.recognizedExpense} tone="blue"/><div className="grid gap-2 sm:grid-cols-2"><BudgetMetric label="Đang khóa" value={phase.lockedForRequests} tone="amber"/><BudgetMetric label="Tạm ứng mở" value={phase.openAdvance} tone="rose"/></div></div>
              {phase.categories.length > 0 && <div className="overflow-x-auto border-t border-slate-100"><table className="w-full min-w-[650px] text-left text-xs"><thead className="bg-slate-50 uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Danh mục</th><th className="px-4 py-3 text-right">Hạn mức</th><th className="px-4 py-3 text-right">Chi phí đã xác nhận</th><th className="px-4 py-3 text-right">Đang khóa</th><th className="px-4 py-3 text-right">Tạm ứng mở</th></tr></thead><tbody>{phase.categories.map((category) => <tr key={category.categoryId} className="border-t border-slate-100"><td className="px-4 py-3 font-medium text-slate-800">{category.categoryName}</td><td className="px-4 py-3 text-right">{formatCurrency(category.budgetLimit)}</td><td className="px-4 py-3 text-right">{formatCurrency(category.recognizedExpense)}</td><td className="px-4 py-3 text-right text-amber-800">{formatCurrency(category.lockedForRequests)}</td><td className="px-4 py-3 text-right text-rose-700">{formatCurrency(category.openAdvance)}</td></tr>)}</tbody></table></div>}
            </div>)}</div>}
          </article>;
        })}</div>}
      </section>}

      {(tab === "advances" || tab === "budget") && !loadError && <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage}/>}
      <span className="sr-only">{currentRows.length} dòng đang hiển thị</span>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${active ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"}`}>{children}</button>;
}

function AdvanceIcon() {
  return <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3.5 19 7v5.5c0 4.2-2.9 7-7 8-4.1-1-7-3.8-7-8V7l7-3.5Z"/><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6"/></svg>;
}

function FilterPanel(props: {
  tab: LedgerTab; type: string; setType: (v: string) => void; status: string; setStatus: (v: string) => void;
  referenceType: string; setReferenceType: (v: string) => void; event: string; setEvent: (v: string) => void;
  employeeId: string; setEmployeeId: (v: string) => void; projectId: string; setProjectId: (v: string) => void;
  requestId: string; setRequestId: (v: string) => void;
  from: string; setFrom: (v: string) => void; to: string; setTo: (v: string) => void; onFilter: () => void;
}) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="mb-3"><h2 className="text-sm font-bold text-slate-900">Bộ lọc {props.tab === "wallet" ? "giao dịch ví" : "bút toán"}</h2><p className="mt-1 text-xs text-slate-500">Các chỉ số cùng loại nghiệp vụ và khoảng thời gian đang chọn.</p></div>
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
      {props.tab === "wallet" ? <>
        <Select value={props.type} onChange={(e) => { props.setType(e.target.value); props.onFilter(); }}><option value="">Tất cả nghiệp vụ</option>{transactionTypes.map((value) => <option key={value} value={value}>{transactionLabels[value] ?? value}</option>)}</Select>
        <Select value={props.status} onChange={(e) => { props.setStatus(e.target.value); props.onFilter(); }}><option value="">Tất cả trạng thái</option>{transactionStatuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</Select>
        <Select value={props.referenceType} onChange={(e) => { props.setReferenceType(e.target.value); props.onFilter(); }}><option value="">Tất cả nguồn</option>{referenceTypes.map((value) => <option key={value} value={value}>{referenceLabels[value] ?? value}</option>)}</Select>
      </> : <>
        <Select value={props.event} onChange={(e) => { props.setEvent(e.target.value); props.onFilter(); }}><option value="">Tất cả bút toán</option>{journalEvents.map((value) => <option key={value} value={value}>{eventLabels[value]}</option>)}</Select>
        <ReferencePicker kind="employee" label="Nhân viên" value={props.employeeId} onChange={v=>{props.setEmployeeId(v);props.onFilter();}}/>
        <ReferencePicker kind="project" label="Dự án" value={props.projectId} onChange={v=>{props.setProjectId(v);props.onFilter();}}/>
        <ReferencePicker kind="request" label="Yêu cầu" value={props.requestId} onChange={v=>{props.setRequestId(v);props.onFilter();}}/>
      </>}
      <input type="date" value={props.from} onChange={(e) => { props.setFrom(e.target.value); props.onFilter(); }} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" aria-label="Từ ngày" />
      <input type="date" value={props.to} onChange={(e) => { props.setTo(e.target.value); props.onFilter(); }} className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" aria-label="Đến ngày" />
    </div>
  </section>;
}

function Select({ value, onChange, children }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select value={value} onChange={onChange} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">{children}</select>;
}

function MetricCard({ label, value, note, tone }: { label: string; value: string; note: string; tone: "blue" | "green" | "rose" | "slate" }) {
  const valueColor = { blue: "text-blue-700", green: "text-emerald-700", rose: "text-rose-700", slate: "text-slate-900" }[tone];
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 text-xl font-bold ${valueColor}`}>{value}</p><p className="mt-2 text-[11px] leading-4 text-slate-500">{note}</p></div>;
}

function BudgetMetric({ label, value, tone }: { label: string; value: number; tone: "blue" | "amber" | "rose" | "slate" }) {
  const color = { blue: "text-blue-700", amber: "text-amber-800", rose: "text-rose-700", slate: "text-slate-900" }[tone];
  return <div className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-[11px] text-slate-500">{label}</p><p className={`mt-1 text-sm font-bold ${color}`}>{formatCurrency(value)}</p></div>;
}

function SectionHeading({ title, subtitle, badge, amber = false }: { title: string; subtitle: string; badge?: string; amber?: boolean }) {
  return <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 ${amber ? "border-amber-100 bg-amber-50/50" : "border-slate-100"}`}><div><h2 className="text-base font-bold text-slate-900">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div>{badge && <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${amber ? "border-amber-200 bg-white text-amber-800" : "border-blue-100 bg-blue-50 text-blue-700"}`}>{badge}</span>}</div>;
}

function BalanceBadge({ balanced }: { balanced: boolean }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${balanced ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{balanced ? "Cân bằng" : "Cần kiểm tra"}</span>;
}

function LoadingRow({ columns }: { columns: number }) {
  return <tr><td colSpan={columns} className="px-5 py-12 text-center text-sm text-slate-500">Đang tải dữ liệu…</td></tr>;
}

function EmptyRow({ columns, text }: { columns: number; text: string }) {
  return <tr><td colSpan={columns} className="px-5 py-12 text-center text-sm text-slate-500">{text}</td></tr>;
}

function Pagination({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (value: number) => void }) {
  return <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3"><p className="text-xs text-slate-500">Trang {page}/{totalPages} · {total} kết quả</p><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40">Trước</button><button type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40">Sau</button></div></div>;
}

function AdvanceDetailCard({ advance, onOpenJournal }: { advance: AdvanceEmployeeSummary["advances"][number]; onOpenJournal: (journalId: number) => void }) {
  const accountedLegacy = advance.legacyUnclassifiedAmount ?? 0;
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-xs font-bold text-blue-700">{advance.requestCode} · Khoản #{advance.id}</p><p className="mt-1 text-sm font-semibold text-slate-900">{advance.projectName || "Chưa gắn dự án"}</p><p className="mt-1 text-xs text-slate-500">{advance.phaseName || "—"} · {advance.categoryName || "Chưa phân loại"} · Giải ngân {advance.disbursedDate || "—"}</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Còn {formatCurrency(advance.remainingAmount)}</span></div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
      <SettlementMetric label="Đã giải ngân" amount={advance.originalAmount} color="text-blue-700" />
      <SettlementMetric label="Chứng từ đã duyệt" amount={advance.reimbursedAmount} color="text-violet-700" />
      <SettlementMetric label="Đã hoàn tiền thật" amount={advance.cashReturnedAmount} color="text-emerald-700" />
      <SettlementMetric label="Đã khấu trừ qua lương" amount={advance.payrollOffsetAmount} color="text-slate-700" />
      <SettlementMetric label="Khoản cũ chưa phân loại" amount={accountedLegacy} color="text-orange-700" />
    </div>
    <p className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-700">{formatCurrency(advance.originalAmount)} đã giải ngân − {formatCurrency(advance.reimbursedAmount)} chứng từ − {formatCurrency(advance.cashReturnedAmount)} hoàn thật − {formatCurrency(advance.payrollOffsetAmount)} khấu trừ lương − {formatCurrency(accountedLegacy)} khoản lịch sử chưa phân loại = <strong className="text-amber-800">{formatCurrency(advance.remainingAmount)} còn phải quyết toán</strong>.</p>
    <div className="mt-4"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Lịch sử bút toán của khoản này</h3>{advance.activities.length === 0 ? <p className="mt-2 text-xs text-slate-500">Chưa có journal kế toán mới. Khoản có thể được tạo trước khi hệ thống ghi journal được triển khai.</p> : <div className="mt-2 flex flex-wrap gap-2">{advance.activities.map((activity) => <button key={activity.journalId} type="button" onClick={() => onOpenJournal(activity.journalId)} className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-left text-xs font-semibold text-blue-700 hover:bg-blue-100"><span>{eventLabels[activity.eventType]}</span><span className="ml-2 font-mono">{activity.journalCode}</span><span className="ml-2 font-normal text-slate-500">{formatCurrency(activity.amount)}</span></button>)}</div>}</div>
  </article>;
}

function SettlementMetric({ label, amount, color }: { label: string; amount: number; color: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[11px] text-slate-500">{label}</p><p className={`mt-1 text-sm font-bold ${color}`}>{formatCurrency(amount)}</p></div>;
}
