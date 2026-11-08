"use client";

import { useEffect, useState } from "react";
import { accountingEventLabels } from "@/lib/accounting-labels";
import { ApiError, api, downloadFile } from "@/lib/api-client";
import { ReferencePicker } from "@/components/accounting/reference-picker";
import { formatDateTime } from "@/lib/format";

type Dataset = { code: string; label: string; supportsDateFilter: boolean; scopeLabel: string | null };
type ExportLog = { id: number; datasetCode: string; scopeKey: string; filterSnapshot: string; rowCount: number; createdAt: string };
type Scope = { id: number; label: string };
const field = "h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
const filterKeys = ["account", "event", "employeeId", "projectId", "departmentId", "phaseId", "categoryId", "requestId", "actor", "action", "search"];
const dimensions: Record<string, string[]> = {
  journals: ["employeeId", "projectId", "departmentId", "phaseId", "categoryId", "requestId"],
  "account-balances": ["employeeId", "projectId", "departmentId", "phaseId", "categoryId"],
  "advance-balances": ["employeeId", "projectId", "departmentId", "phaseId", "categoryId"],
  "department-employees": ["employeeId", "departmentId"],
  "department-budgets": ["departmentId"],
  "project-cost-details": ["projectId", "departmentId", "phaseId", "categoryId"],
  "project-financial-summary": ["projectId", "departmentId"],
};
const dimensionLabels: Record<string, string> = {
  employeeId: "Nhân viên", projectId: "Dự án", departmentId: "Phòng ban", phaseId: "Giai đoạn", categoryId: "Danh mục", requestId: "Yêu cầu",
};

export default function DataExchangePage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [code, setCode] = useState("");
  const [scope, setScope] = useState("");
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<ExportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [historyVersion, setHistoryVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const dataset = datasets.find(item => item.code === code);
  const accounting = code === "journals" || code === "account-balances";
  const audit = code === "audit-history";
  const dimensionFields = dimensions[code] || [];
  const scopeReady = !dataset?.scopeLabel || !!scope;
  useEffect(() => {
    let active = true;
    api.get<Dataset[]>("/api/v1/spreadsheets").then(response => {
      if (!active) return;
      const items = response.data;
      setDatasets(items);
      const query = new URLSearchParams(window.location.search);
      const requested = query.get("dataset");
      setCode(items.some(item => item.code === requested) ? requested! : items[0]?.code || "");
      setScope(query.get("scope") || "");
      setFrom(query.get("from") || ""); setTo(query.get("to") || "");
      setFilters(Object.fromEntries(filterKeys.map(key => [key, query.get(key) || ""])));
      setReady(true);
    }).catch(err => { if (active) setError(err instanceof ApiError ? err.apiMessage : "Không tải được danh mục báo cáo."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (datasets.length === 0) return;
    const restore = () => {
      const query = new URLSearchParams(window.location.search);
      const requested = query.get("dataset");
      setCode(datasets.some(item => item.code === requested) ? requested! : datasets[0].code);
      setScope(query.get("scope") || "");
      setFrom(query.get("from") || ""); setTo(query.get("to") || "");
      setFilters(Object.fromEntries(filterKeys.map(key => [key, query.get(key) || ""])));
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [datasets]);

  useEffect(() => {
    let active = true;
    setScopes([]);
    if (!code) return () => { active = false; };
    setScopeLoading(true);
    api.get<Scope[]>(`/api/v1/spreadsheets/${code}/scopes`).then(response => {
      if (!active) return;
      setScopes(response.data);
      setScope(current => response.data.some(item => String(item.id) === current) ? current : "");
    }).catch(err => { if (active) setError(err instanceof ApiError ? err.apiMessage : "Không tải được phạm vi báo cáo."); })
      .finally(() => { if (active) setScopeLoading(false); });
    return () => { active = false; };
  }, [code]);

  useEffect(() => {
    let active = true;
    setHistoryLoading(true); setHistoryError("");
    api.get<ExportLog[]>("/api/v1/spreadsheets/exports/history").then(response => { if (active) setHistory(response.data); })
      .catch(err => { if (active) setHistoryError(err instanceof ApiError ? err.apiMessage : "Không tải được lịch sử xuất."); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [historyVersion]);

  useEffect(() => {
    if (!ready || scopeLoading || !code) return;
    const query = new URLSearchParams(); query.set("dataset", code);
    if (scope) query.set("scope", scope);
    if (from) query.set("from", from); if (to) query.set("to", to);
    for (const [key, value] of Object.entries(filters)) if (value.trim()) query.set(key, value.trim());
    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${query}`);
  }, [ready, scopeLoading, code, scope, from, to, filters]);

  const updateFilter = (key: string, value: string) => setFilters(current => ({ ...current, [key]: value }));
  const exportReport = async () => {
    if (!dataset || !scopeReady) return;
    const query = new URLSearchParams();
    if (scope) query.set("scope", scope);
    if (dataset.supportsDateFilter) { if (from) query.set("from", from); if (to) query.set("to", to); }
    const keys = [...dimensionFields, ...(accounting ? ["account", "event"] : []), ...(audit ? ["actor", "action"] : [])];
    if (["department-employees", "department-budgets", "project-cost-details", "project-financial-summary"].includes(code)) keys.push("search");
    for (const key of keys) if (filters[key]?.trim()) query.set(key, filters[key].trim());
    setBusy(true); setError("");
    try {
      await downloadFile(`/api/v1/spreadsheets/${code}/export?${query}`, `${code}-export.xlsx`);
      setHistoryVersion(version => version + 1);
    } catch (err) { setError(err instanceof ApiError ? err.apiMessage : "Không xuất được báo cáo Excel."); }
    finally { setBusy(false); }
  };

  return <div className="space-y-6 pb-10">
    <header className="rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-indigo-700 p-6 text-white shadow-xl shadow-blue-900/10 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">Báo cáo · IFMS</p>
      <h1 className="mt-2 text-3xl font-bold">Dữ liệu &amp; báo cáo</h1>
      <p className="mt-2 text-sm leading-6 text-blue-100">Xuất dữ liệu theo vai trò, phạm vi và bộ lọc đang chọn. Nhập Excel nằm tại màn hình nghiệp vụ tương ứng.</p>
    </header>
    {error && <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    {loading ? <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-500">Đang tải danh mục báo cáo…</div> : <>
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4"><h2 className="text-lg font-bold text-slate-900">Chọn dữ liệu cần xuất</h2><p className="mt-1 text-sm text-slate-500">Hệ thống chỉ hiển thị nội dung bạn được phép xem.</p></div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">Bộ dữ liệu
            <select className={field} value={code} disabled={busy} onChange={event => { setCode(event.target.value); setScope(""); setFilters({}); setError(""); }}>
              {datasets.length === 0 && <option value="">Chưa có bộ dữ liệu</option>}
              {datasets.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}
            </select>
          </label>
          {dataset?.scopeLabel && <label className="grid gap-2 text-sm font-semibold text-slate-700">{dataset.scopeLabel}
            <select className={field} value={scope} disabled={busy || scopeLoading} onChange={event => setScope(event.target.value)}>
              <option value="">{scopeLoading ? "Đang tải…" : "Chọn phạm vi"}</option>
              {scopes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>}
        </div>
      </section>
      {dataset && <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4"><h2 className="text-lg font-bold text-slate-900">Bộ lọc báo cáo</h2><p className="mt-1 text-sm text-slate-500">Để trống để xuất toàn bộ dữ liệu trong phạm vi được phép.</p></div>
        <div className="space-y-5 p-5">
          {(accounting || dimensionFields.length > 0) && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {accounting && <label className="grid gap-1 text-xs text-slate-500">Tài khoản kế toán
              <select className={field} value={filters.account || ""} onChange={event => updateFilter("account", event.target.value)}>
                <option value="">Tất cả tài khoản</option>
                {Object.entries({ ADVANCE_RECEIVABLE: "Tạm ứng còn phải quyết toán", PROJECT_EXPENSE: "Chi phí dự án", EMPLOYEE_REIMBURSEMENT_PAYABLE: "Khoản phải hoàn nhân viên", PAYROLL_EXPENSE: "Chi phí lương", PAYROLL_DEDUCTION_CLEARING: "Khấu trừ lương", COMPANY_FUND_WALLET: "Quỹ công ty", EXTERNAL_BANK_CASH: "Nguồn tiền ngân hàng", DEPARTMENT_WALLET: "Ví phòng ban", PROJECT_WALLET: "Ví dự án", OPENING_BALANCE_CLEARING: "Đối ứng mở sổ" }).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>}
            {accounting && <label className="grid gap-1 text-xs text-slate-500">Loại nghiệp vụ
              <select className={field} value={filters.event || ""} onChange={event => updateFilter("event", event.target.value)}>
                <option value="">Tất cả nghiệp vụ</option>
                {["ADVANCE_DISBURSED", "EXPENSE_VERIFIED", "EXPENSE_PAID", "REIMBURSE_SETTLED", "ADVANCE_RETURNED", "PAYROLL_SETTLEMENT", "SYSTEM_TOPUP", "DEPARTMENT_ALLOCATION", "PROJECT_ALLOCATION", "REVERSAL", "OPENING_BALANCE"].map(value => <option key={value} value={value}>{accountingEventLabels[value] || value}</option>)}
              </select>
            </label>}
            {dimensionFields.map(key => <ReferencePicker key={key} kind={key.replace("Id", "")} label={dimensionLabels[key]} value={filters[key] || ""} parent={key === "phaseId" ? filters.projectId : key === "categoryId" ? filters.phaseId : undefined} onChange={value => setFilters(current => {
              const next = { ...current, [key]: value };
              if (key === "projectId") { next.phaseId = ""; next.categoryId = ""; }
              if (key === "phaseId") next.categoryId = "";
              return next;
            })} />)}
          </div>}
          {audit && <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs text-slate-500">Người thao tác<input className={field} value={filters.actor || ""} onChange={event => updateFilter("actor", event.target.value)} /></label><label className="grid gap-1 text-xs text-slate-500">Thao tác<select className={field} value={filters.action || ""} onChange={event => updateFilter("action", event.target.value)}><option value="">Tất cả</option>{["INSERT", "UPDATE", "DELETE"].map(value => <option key={value} value={value}>{value}</option>)}</select></label></div>}
          {["department-employees", "department-budgets", "project-cost-details", "project-financial-summary"].includes(code) && <label className="grid gap-1 text-xs text-slate-500">Tìm kiếm<input className={field} value={filters.search || ""} onChange={event => updateFilter("search", event.target.value)} /></label>}
          <div className="flex flex-wrap items-end justify-between gap-4 border-t border-slate-100 pt-4">
            {dataset.supportsDateFilter ? <div className="flex flex-wrap gap-3"><label className="grid gap-1 text-xs text-slate-600">Từ ngày<input type="date" className={field} value={from} onChange={event => setFrom(event.target.value)} /></label><label className="grid gap-1 text-xs text-slate-600">Đến ngày<input type="date" className={field} value={to} onChange={event => setTo(event.target.value)} /></label></div> : <p className="text-xs text-slate-500">Báo cáo phản ánh trạng thái tại thời điểm tải file.</p>}
            <button type="button" disabled={busy || !scopeReady} onClick={() => void exportReport()} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Đang xuất…" : "Xuất Excel"}</button>
          </div>
        </div>
      </section>}
    </>}
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4"><h2 className="text-lg font-bold text-slate-900">Lịch sử xuất báo cáo</h2><p className="mt-1 text-sm text-slate-500">Các file đã xuất trong phạm vi tài khoản của bạn.</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-blue-50 text-xs font-semibold uppercase text-slate-500"><tr>{["Thời điểm", "Bộ dữ liệu", "Phạm vi", "Số dòng"].map(label => <th key={label} className="px-5 py-3">{label}</th>)}</tr></thead><tbody>
        {historyLoading ? <tr><td colSpan={4} className="p-6 text-center text-slate-500">Đang tải lịch sử…</td></tr> : historyError ? <tr><td colSpan={4} className="p-6 text-rose-700" role="alert">{historyError}<button type="button" className="ml-3 underline" onClick={() => setHistoryVersion(version => version + 1)}>Thử lại</button></td></tr> : history.length === 0 ? <tr><td colSpan={4} className="p-6 text-center text-slate-500">Chưa có file nào được xuất.</td></tr> : history.map(item => <tr key={item.id} className="border-t border-slate-100"><td className="whitespace-nowrap px-5 py-3">{formatDateTime(item.createdAt)}</td><td className="px-5 py-3 font-semibold text-slate-800">{datasets.find(dataset => dataset.code === item.datasetCode)?.label || item.datasetCode}</td><td className="px-5 py-3 text-slate-600" title={item.filterSnapshot}>{item.scopeKey}</td><td className="px-5 py-3">{item.rowCount}</td></tr>)}
      </tbody></table></div>
    </section>
  </div>;
}
