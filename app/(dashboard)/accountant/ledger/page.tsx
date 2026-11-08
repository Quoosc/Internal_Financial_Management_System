"use client";

import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { ReferencePicker } from "@/components/accounting/reference-picker";
import { StatusBadge } from "@/components/ui/status-badge";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api-client";
import { useToast } from "@/contexts/toast-context";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { withLedgerReturnTo } from "@/lib/ledger-navigation";
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
      setTab(requested && ["wallet", "journal", "advances"].includes(requested) ? requested as LedgerTab : "wallet");
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
    const activeFilters = tab === "wallet" ? { type, status, referenceType, from, to }
      : tab === "journal" ? { event, from, to, employeeId: journalEmployeeId, projectId: journalProjectId, requestId: journalRequestId }
      : { search };
    Object.entries(activeFilters).forEach(([key, value]) => { if (value) params.set(key, value); });
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
    const filters = { type, status, referenceType, event: "", from, to };
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
  }, [from, page, referenceType, status, to, toast, type]);

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
  const openDetail = (path: string) => router.push(withLedgerReturnTo(path, `${window.location.pathname}${window.location.search}`));
  const totalDebit = useMemo(() => journalRows.reduce((sum, row) => sum + row.totalAmount, 0), [journalRows]);
  const balancedCount = useMemo(() => journalRows.filter((row) => row.balanced).length, [journalRows]);
  const totalOutstanding = useMemo(() => advanceRows.reduce((sum, row) => sum + row.totalRemaining, 0), [advanceRows]);
  const totalAdvanceDisbursed = useMemo(() => advanceRows.reduce((sum, row) => sum + row.totalDisbursed, 0), [advanceRows]);
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

      <nav aria-label="Các sổ kế toán" className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:grid-cols-3">
        <TabButton active={tab === "wallet"} onClick={() => setTabAndReset("wallet")} tone="green">
          <span className="flex items-center gap-3"><span className={`grid h-10 w-10 place-items-center rounded-xl ${tab === "wallet" ? "bg-white/15 text-white" : "bg-emerald-50 text-emerald-700"}`}><WalletIcon /></span><span className="text-left"><span className="block">Giao dịch ví</span><span className={`mt-0.5 block text-xs font-normal ${tab === "wallet" ? "text-emerald-50" : "text-slate-500"}`}>Tiền thực tế di chuyển giữa các ví</span></span></span>
        </TabButton>
        <TabButton active={tab === "journal"} onClick={() => setTabAndReset("journal")} tone="blue">
          <span className="flex items-center gap-3"><span className={`grid h-10 w-10 place-items-center rounded-xl ${tab === "journal" ? "bg-white/15 text-white" : "bg-blue-50 text-blue-700"}`}><JournalIcon /></span><span className="text-left"><span className="block">Sổ cái kế toán</span><span className={`mt-0.5 block text-xs font-normal ${tab === "journal" ? "text-blue-50" : "text-slate-500"}`}>Bút toán và tài khoản kế toán</span></span></span>
        </TabButton>
        <TabButton active={tab === "advances"} onClick={() => setTabAndReset("advances")} tone="amber">
          <span className="flex items-center gap-3"><span className={`grid h-10 w-10 place-items-center rounded-xl ${tab === "advances" ? "bg-white/15 text-white" : "bg-amber-50 text-amber-700"}`}><AdvanceIcon /></span><span className="text-left"><span className="block">Tạm ứng cần quyết toán</span><span className={`mt-0.5 block text-xs font-normal ${tab === "advances" ? "text-amber-50" : "text-slate-500"}`}>Theo dõi số còn lại theo nhân viên</span></span></span>
        </TabButton>
      </nav>

      {(tab === "wallet" || tab === "journal") && <div className={`flex items-start gap-3 rounded-2xl border p-4 ${tab === "wallet" ? "border-emerald-200 bg-emerald-50/70 text-emerald-950" : "border-blue-200 bg-blue-50/70 text-blue-950"}`}>
        <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tab === "wallet" ? "bg-white text-emerald-700" : "bg-white text-blue-700"}`}>{tab === "wallet" ? <WalletIcon /> : <JournalIcon />}</span>
        <div><p className="text-sm font-bold">{tab === "wallet" ? "Đang xem dòng tiền thực tế" : "Đang xem ghi nhận kế toán"}</p><p className="mt-1 text-xs leading-5 text-slate-700">{tab === "wallet" ? "Mỗi dòng là một giao dịch ví. Chọn “Xem chi tiết” để biết ví nào tăng/giảm, số dư trước–sau và bút toán liên quan nếu có." : "Mỗi dòng là một bút toán kế toán. Mở chi tiết để xem từng tài khoản, số tiền ghi nhận, nguồn nghiệp vụ và trạng thái cân bằng. Một bút toán không đồng nghĩa một lần chuyển ví."}</p></div>
      </div>}

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
          <SectionHeading title="Danh sách giao dịch ví" subtitle="Một dòng cho một giao dịch. Các ví bị tác động được gom trong cùng dòng để dễ lần theo." badge={`${total} giao dịch`} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left">
              <thead className="bg-emerald-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                <tr><th className="px-5 py-3">Mã giao dịch</th><th className="px-5 py-3">Nghiệp vụ</th><th className="px-5 py-3">Ví liên quan</th><th className="px-5 py-3 text-right">Số tiền</th><th className="px-5 py-3">Trạng thái</th><th className="px-5 py-3">Thời gian</th><th className="px-5 py-3 text-right">Thao tác</th></tr>
              </thead>
              <tbody>
                {loading ? <LoadingRow columns={7} /> : walletRows.length === 0 ? <EmptyRow columns={7} text="Không có giao dịch phù hợp với bộ lọc." /> : walletRows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 transition hover:bg-emerald-50/40">
                    <td className="px-5 py-4"><span className="font-mono text-xs font-semibold text-blue-700">{row.transactionCode}</span><p className="mt-1 max-w-64 truncate text-xs text-slate-500">{row.description || "Không có mô tả"}</p></td>
                    <td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${typeColor(row.type)}`}>{transactionLabels[row.type] ?? row.type}</span><p className="mt-1 text-[11px] text-slate-400">{row.referenceType ? `${referenceLabels[row.referenceType] ?? row.referenceType} · #${row.referenceId ?? "—"}` : "Không có tham chiếu"}</p></td>
                    <td className="px-5 py-4"><div className="flex flex-wrap gap-1.5">{row.walletMovements.map((movement) => <span key={movement.id} className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-600">{walletOwnerLabel(movement.walletOwnerType, movement.walletOwnerId)}</span>)}</div></td>
                    <td className="px-5 py-4 text-right text-sm font-bold text-slate-900">{formatCurrency(row.amount)}</td>
                    <td className="px-5 py-4"><StatusBadge variant={row.status === "SUCCESS" ? "emerald" : row.status === "PENDING" ? "amber" : row.status === "FAILED" ? "rose" : "slate"} label={statusLabel(row.status)} /></td>
                    <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-600">{formatDateTime(row.timestamp)}</td>
                    <td className="px-5 py-4 text-right"><button type="button" onClick={() => openDetail(`/accountant/ledger/${row.id}`)} className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100">Xem chi tiết <span aria-hidden="true">→</span></button></td>
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
          <MetricCard label="Giá trị ghi nhận · trang hiện tại" value={formatCurrency(totalDebit)} note="Tổng giá trị mỗi bút toán một lần; không cộng cả hai phía ghi sổ." tone="green" />
          <MetricCard label="Bút toán cân bằng" value={`${balancedCount} / ${journalRows.length}`} note="So sánh hai phía của từng bút toán đang hiển thị." tone="slate" />
        </div>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <SectionHeading title="Danh sách bút toán kế toán" subtitle="Bút toán ghi nhận nghiệp vụ vào các tài khoản kế toán; đây không phải danh sách từng lần ví tăng hoặc giảm." badge={`${total} bút toán`} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead className="bg-blue-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Mã và ngày ghi sổ</th><th className="px-5 py-3">Nghiệp vụ · nguồn</th><th className="px-5 py-3">Nhân viên / dự án</th><th className="px-5 py-3 text-right">Giá trị ghi nhận</th><th className="px-5 py-3 text-center">Cân bằng</th><th className="px-5 py-3 text-right">Thao tác</th></tr></thead>
              <tbody>
                {loading ? <LoadingRow columns={6} /> : journalRows.length === 0 ? <EmptyRow columns={6} text="Chưa có bút toán kế toán khớp với bộ lọc." /> : journalRows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 transition hover:bg-blue-50/50">
                    <td className="px-5 py-4"><span className="font-mono text-xs font-semibold text-blue-700">{row.journalCode}</span><p className="mt-1 text-xs text-slate-500">{row.postingDate} · kỳ {row.postingPeriod}</p><p className="mt-1 text-[11px] text-slate-400">Tạo bởi {row.createdByName || "Dữ liệu cũ"}</p></td>
                    <td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${typeColor(row.eventType)}`}>{eventLabels[row.eventType]}</span><p className="mt-1 max-w-72 truncate text-xs text-slate-500">{row.description}</p></td>
                    <td className="px-5 py-4 text-xs text-slate-600">{row.employeeName || "—"}<p className="mt-1 text-slate-400">{row.projectName || "Không gắn dự án"}</p></td>
                    <td className="px-5 py-4 text-right text-sm font-bold text-slate-900">{formatCurrency(row.totalAmount)}</td>
                    <td className="px-5 py-4 text-center"><BalanceBadge balanced={row.balanced} /></td>
                    <td className="px-5 py-4 text-right"><button type="button" onClick={() => openDetail(`/accountant/ledger/journals/${row.id}`)} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-800 transition hover:bg-blue-100">Mở bút toán <span aria-hidden="true">→</span></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
        </section>
      </>}

      {!loadError && tab === "advances" && <>
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Nhân viên còn tạm ứng" value={String(total)} note="Tổng nhân viên theo điều kiện tìm kiếm." tone="blue" />
        <MetricCard label="Đã giải ngân · trang hiện tại" value={formatCurrency(totalAdvanceDisbursed)} note="Tổng tiền đã ứng cho các nhân viên trên trang này." tone="slate" />
        <MetricCard label="Còn phải quyết toán · trang hiện tại" value={formatCurrency(totalOutstanding)} note="Giảm khi chứng từ được duyệt, nhân viên hoàn tiền hoặc khấu trừ qua lương." tone="rose" />
      </div>
      <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
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
                    <td className="px-5 py-4 text-right"><button type="button" aria-expanded={expanded} onClick={() => setExpandedEmployee(expanded ? null : employee.employeeId)} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50">{expanded ? "Thu gọn ↑" : "Xem các khoản ↓"}</button></td>
                  </tr>
                  {expanded && <tr className="border-t border-amber-100 bg-amber-50/30"><td colSpan={5} className="p-4 sm:p-5"><div className="space-y-4">{employee.advances.map((advance) => <AdvanceDetailCard key={advance.id} advance={advance} onOpenJournal={(journalId) => openDetail(`/accountant/ledger/journals/${journalId}`)} onOpenRequest={(requestId) => openDetail(`/accountant/ledger/sources/requests/${requestId}`)} />)}</div></td></tr>}
                </React.Fragment>;
              })}
            </tbody>
          </table>
        </div>
        {!loading && advanceRows.length > 0 && <div className="border-t border-amber-100 bg-amber-50/50 px-5 py-3 text-sm text-slate-600">Tổng dư tạm ứng trên trang này: <strong className="text-amber-800">{formatCurrency(totalOutstanding)}</strong></div>}
      </section>
      </>}

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

function TabButton({ active, onClick, children, tone }: { active: boolean; onClick: () => void; children: React.ReactNode; tone: "green" | "blue" | "amber" }) {
  const activeClass = { green: "bg-emerald-700 text-white shadow-sm", blue: "bg-blue-700 text-white shadow-sm", amber: "bg-amber-700 text-white shadow-sm" }[tone];
  const hoverClass = { green: "hover:bg-emerald-50", blue: "hover:bg-blue-50", amber: "hover:bg-amber-50" }[tone];
  return <button type="button" aria-pressed={active} onClick={onClick} className={`rounded-xl px-3 py-3 text-sm font-semibold transition sm:px-4 ${active ? activeClass : `text-slate-700 ${hoverClass}`}`}>{children}</button>;
}

function AdvanceIcon() {
  return <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3.5 19 7v5.5c0 4.2-2.9 7-7 8-4.1-1-7-3.8-7-8V7l7-3.5Z"/><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6"/></svg>;
}

function WalletIcon() {
  return <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="15" rx="2.5"/><path strokeLinecap="round" d="M3 9h18M16 14h2"/><path strokeLinecap="round" strokeLinejoin="round" d="M6 5V3.5h12V5"/></svg>;
}

function JournalIcon() {
  return <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M6 3.5h9l4 4V21H6a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z"/><path strokeLinecap="round" strokeLinejoin="round" d="M14 3.5V8h5M8 12h8M8 16h8"/></svg>;
}

function FilterPanel(props: {
  tab: LedgerTab; type: string; setType: (v: string) => void; status: string; setStatus: (v: string) => void;
  referenceType: string; setReferenceType: (v: string) => void; event: string; setEvent: (v: string) => void;
  employeeId: string; setEmployeeId: (v: string) => void; projectId: string; setProjectId: (v: string) => void;
  requestId: string; setRequestId: (v: string) => void;
  from: string; setFrom: (v: string) => void; to: string; setTo: (v: string) => void; onFilter: () => void;
}) {
  const isWallet = props.tab === "wallet";
  const selectedCount = (isWallet
    ? [props.type, props.status, props.referenceType, props.from, props.to]
    : [props.event, props.employeeId, props.projectId, props.requestId, props.from, props.to]).filter(Boolean).length;
  const clearFilters = () => {
    if (isWallet) {
      props.setType(""); props.setStatus(""); props.setReferenceType("");
    } else {
      props.setEvent(""); props.setEmployeeId(""); props.setProjectId(""); props.setRequestId("");
    }
    props.setFrom(""); props.setTo(""); props.onFilter();
  };
  const dateClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4">
      <div><h2 className="text-base font-bold text-slate-900">Bộ lọc {isWallet ? "giao dịch ví" : "bút toán kế toán"}</h2><p className="mt-1 text-xs text-slate-600">Danh sách tự cập nhật khi thay đổi điều kiện.</p></div>
      <div className="flex items-center gap-2"><span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{selectedCount ? `${selectedCount} điều kiện đang chọn` : "Đang xem tất cả"}</span><button type="button" onClick={clearFilters} disabled={selectedCount === 0} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Xóa bộ lọc</button></div>
    </div>
    <div className="space-y-5 p-5">
      <div><p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">{isWallet ? "Phân loại giao dịch" : "Nghiệp vụ và đối tượng liên quan"}</p>
        <div className={`grid gap-3 sm:grid-cols-2 ${isWallet ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}>
          {isWallet ? <>
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">Nghiệp vụ<Select value={props.type} onChange={(e) => { props.setType(e.target.value); props.onFilter(); }}><option value="">Tất cả nghiệp vụ</option>{transactionTypes.map((value) => <option key={value} value={value}>{transactionLabels[value] ?? value}</option>)}</Select></label>
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">Trạng thái<Select value={props.status} onChange={(e) => { props.setStatus(e.target.value); props.onFilter(); }}><option value="">Tất cả trạng thái</option>{transactionStatuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</Select></label>
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">Nguồn tham chiếu<Select value={props.referenceType} onChange={(e) => { props.setReferenceType(e.target.value); props.onFilter(); }}><option value="">Tất cả nguồn</option>{referenceTypes.map((value) => <option key={value} value={value}>{referenceLabels[value] ?? value}</option>)}</Select></label>
          </> : <>
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">Loại bút toán<Select value={props.event} onChange={(e) => { props.setEvent(e.target.value); props.onFilter(); }}><option value="">Tất cả bút toán</option>{journalEvents.map((value) => <option key={value} value={value}>{eventLabels[value]}</option>)}</Select></label>
            <ReferencePicker kind="employee" label="Nhân viên" value={props.employeeId} onChange={v=>{props.setEmployeeId(v);props.onFilter();}}/>
            <ReferencePicker kind="project" label="Dự án" value={props.projectId} onChange={v=>{props.setProjectId(v);props.onFilter();}}/>
            <ReferencePicker kind="request" label="Yêu cầu" value={props.requestId} onChange={v=>{props.setRequestId(v);props.onFilter();}}/>
          </>}
        </div>
      </div>
      <div className="border-t border-slate-100 pt-4"><p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">{isWallet ? "Khoảng thời gian giao dịch" : "Khoảng ngày ghi sổ"}</p>
        <div className="grid gap-3 sm:max-w-[680px] sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">Từ ngày<input type="date" value={props.from} max={props.to || undefined} onChange={(e) => { props.setFrom(e.target.value); props.onFilter(); }} className={dateClass} /></label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">Đến ngày<input type="date" value={props.to} min={props.from || undefined} onChange={(e) => { props.setTo(e.target.value); props.onFilter(); }} className={dateClass} /></label>
        </div>
      </div>
    </div>
  </section>;
}

function Select({ value, onChange, children }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select value={value} onChange={onChange} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">{children}</select>;
}

function MetricCard({ label, value, note, tone }: { label: string; value: string; note: string; tone: "blue" | "green" | "rose" | "slate" }) {
  const styles = {
    blue: { line: "bg-blue-600", value: "text-blue-800", surface: "bg-blue-50/40" },
    green: { line: "bg-emerald-500", value: "text-emerald-800", surface: "bg-emerald-50/40" },
    rose: { line: "bg-rose-500", value: "text-rose-700", surface: "bg-rose-50/40" },
    slate: { line: "bg-slate-400", value: "text-slate-900", surface: "bg-white" },
  }[tone];
  return <div className={`overflow-hidden rounded-2xl border border-slate-200 ${styles.surface} shadow-sm`}><div className={`h-1 ${styles.line}`} /><div className="p-4"><p className="text-xs font-medium text-slate-500">{label}</p><p className={`mt-1 text-xl font-bold ${styles.value}`}>{value}</p><p className="mt-2 text-[11px] leading-4 text-slate-500">{note}</p></div></div>;
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

function AdvanceDetailCard({ advance, onOpenJournal, onOpenRequest }: { advance: AdvanceEmployeeSummary["advances"][number]; onOpenJournal: (journalId: number) => void; onOpenRequest: (requestId: number) => void }) {
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
    <div className="mt-4 border-t border-slate-100 pt-4"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Hồ sơ và lịch sử ghi sổ</h3><div className="mt-2 flex flex-wrap gap-2">{advance.requestId && <button type="button" onClick={() => onOpenRequest(advance.requestId!)} className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800 hover:bg-violet-100">Xem yêu cầu và chứng từ {advance.requestCode} →</button>}{advance.activities.map((activity) => <button key={activity.journalId} type="button" onClick={() => onOpenJournal(activity.journalId)} className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-left text-xs font-semibold text-blue-700 hover:bg-blue-100"><span>{eventLabels[activity.eventType]}</span><span className="ml-2 font-mono">{activity.journalCode}</span><span className="ml-2 font-normal text-slate-500">{formatCurrency(activity.amount)}</span></button>)}</div>{advance.activities.length === 0 && <p className="mt-2 text-xs text-slate-500">Chưa có bút toán kế toán liên kết; hãy xem hồ sơ nguồn trước khi kết luận khoản này đã được ghi sổ.</p>}</div>
  </article>;
}

function SettlementMetric({ label, amount, color }: { label: string; amount: number; color: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[11px] text-slate-500">{label}</p><p className={`mt-1 text-sm font-bold ${color}`}>{formatCurrency(amount)}</p></div>;
}
