"use client";
import { accountingEventLabels } from "@/lib/accounting-labels";

import { useEffect, useState } from "react";
import { api, ApiError, downloadFile } from "@/lib/api-client";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useToast } from "@/contexts/toast-context";
import { uploadRegisteredDocument } from "@/lib/upload-document";
import { ReferencePicker } from "@/components/accounting/reference-picker";
import { formatDateTime } from "@/lib/format";

type Column = { key: string; label: string; type: string; required: boolean };
type Dataset = { code: string; label: string; importEnabled: boolean; supportsDateFilter: boolean; scopeLabel: string | null; schemaVersion: number; columns: Column[] };
type Preview = { batchId: string; dataset: string; state: string; totalRows: number; validRows: number; errorRows: number; rows: { row: number; values: Record<string, string> }[]; errors: { row: number; column: string; message: string }[]; results: string[] };
type ExportLog = { id: number; datasetCode: string; scopeKey: string; filterSnapshot: string; rowCount: number; fileSha256: string; createdAt: string };
const field = "h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
const button = "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40";

function exampleFor(column: Column): string {
  const key = column.key.toLowerCase();
  if (key === "type") return "EXPENSE";
  if (key === "employeecode") return "NV-2026-001";
  if (key === "employeename" || key === "fullname") return "Nguyễn Minh An";
  if (key === "bankaccount") return "Tài khoản công ty";
  if (key === "bankreference") return "FT2601150001";
  if (key === "direction") return "IN";
  if (key === "state") return "BOOKED";
  if (key === "documentids") return "ID chứng từ đã tải lên";
  if (key === "advancebalanceid") return "ID tạm ứng trong ThamChieu";
  if (key.endsWith("id")) return "ID trong sheet ThamChieu";
  if (key.includes("code")) return "SAMPLE-001";
  if (key.includes("name")) return "Dữ liệu minh họa";
  if (key.includes("quota") || column.type.includes("MONEY")) return "25.000.000 ₫";
  if (key.includes("email")) return "nhanvien.mau@congty.vn";
  if (key.includes("date") || key.endsWith("at")) return "15/01/2026";
  if (key.includes("status")) return "Đang hoạt động";
  if (key.includes("description") || key.includes("note")) return "Chi phí hoạt động theo kế hoạch";
  return column.required ? "Giá trị minh họa" : "—";
}

function friendlyType(type: string): string {
  if (type.includes("MONEY")) return "Số tiền (VND)";
  if (type === "DATE") return "Ngày";
  if (type === "NUMBER") return "Số";
  return "Văn bản";
}

const compactExportColumns: Record<string, string[]> = {
  "my-requests-history": ["code", "type", "status", "project", "amount", "approvedAmount", "reservedAmount", "createdAt"],
  "my-advances": ["request", "project", "original", "receipts", "cashReturned", "payrollOffset", "legacyUnknown", "remaining", "status"],
  "my-payslips": ["code", "period", "status", "base", "bonus", "allowance", "deduction", "advanceOffset", "effectiveNet"],
  journals: ["journal", "date", "event", "employeeId", "project", "account", "accountName", "debit", "credit", "effect"],
  "advance-balances": ["request", "employee", "project", "original", "reimbursed", "returned", "payrollOffset", "unclassified", "remaining", "status"],
  "employee-advances": ["employee", "request", "project", "original", "receipts", "cashReturned", "payrollOffset", "legacyUnknown", "remaining", "status"],
  "department-employees": ["code", "name", "department", "status", "outstanding"],
  "bank-reconciliation-summary": ["asOf", "status", "corporate", "pending", "bank", "difference"],
};

function primaryColumns(dataset: Dataset): Column[] {
  if (dataset.importEnabled && dataset.code !== "payroll") return dataset.columns.filter(column => column.required);
  const keys = compactExportColumns[dataset.code];
  return keys ? dataset.columns.filter(column => keys.includes(column.key)) : dataset.columns;
}

export default function DataExchangePage() {
  const toast = useToast();
  const [ready, setReady] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(true);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [code, setCode] = useState("");
  const [scope, setScope] = useState("");
  const [scopes, setScopes] = useState<{ id: number; label: string }[]>([]);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [documents, setDocuments] = useState<{ id: number; fileName: string; url: string }[]>([]);
  const [exportHistory, setExportHistory] = useState<ExportLog[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showAllColumns, setShowAllColumns] = useState(false);
  const dataset = datasets.find(d => d.code === code);
  const primary = dataset ? primaryColumns(dataset) : [];
  const hasCollapsedColumns = !!dataset && primary.length < dataset.columns.length;
  const visibleColumns = dataset && (showAllColumns || !hasCollapsedColumns) ? dataset.columns : primary;
  const scopeReady = !dataset?.scopeLabel || !!scope;
  const accountingFilters = code === "journals" || code === "account-balances";
  const auditFilters = code === "audit-history";
  const dimensionKeys:Record<string,string[]>={journals:["employeeId","projectId","departmentId","phaseId","categoryId","requestId"],"account-balances":["employeeId","projectId","departmentId","phaseId","categoryId"],"advance-balances":["employeeId","projectId","departmentId","phaseId","categoryId"],"department-employees":["employeeId","departmentId"],"department-budgets":["departmentId"],"project-cost-details":["projectId","departmentId","phaseId","categoryId"],"project-financial-summary":["projectId","departmentId"]};
  const dimensionFields=dimensionKeys[code]||[];
  useEffect(() => {
    let active = true;
    api.get<Dataset[]>("/api/v1/spreadsheets").then(res => {
      if (!active) return;
      setDatasets(res.data);

    }).catch(err => { if (active) setError(err instanceof ApiError ? err.apiMessage : "Không tải được danh mục Excel."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    setHistoryLoading(true); setHistoryError("");
    api.get<ExportLog[]>("/api/v1/spreadsheets/exports/history").then(res => { if (active) setExportHistory(res.data); })
      .catch(err => { if (active) setHistoryError(err instanceof ApiError ? err.apiMessage : "Không tải được lịch sử xuất."); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [historyVersion]);
  useEffect(() => {
    if (!code) return;
    let active = true;
    setScopes([]); setPreview(null); setFile(null); setScopeLoading(true);
    api.get<{ id: number; label: string }[]>(`/api/v1/spreadsheets/${code}/scopes`).then(res => {
      if (!active) return;
      setScopes(res.data);
      setScope(previous => res.data.some(item => String(item.id) === previous) ? previous : "");
    }).catch(err => { if (active) setError(err instanceof ApiError ? err.apiMessage : "Không tải được phạm vi dữ liệu."); })
      .finally(() => { if (active) setScopeLoading(false); });
    return () => { active = false; };
  }, [code]);
  useEffect(() => {
    if (!datasets.length) return;
    const restore = () => {
      const query = new URLSearchParams(window.location.search);
      setCode(datasets.some(d => d.code === query.get("dataset")) ? query.get("dataset")! : datasets[0].code);
      setScope(query.get("scope") || ""); setFrom(query.get("from") || ""); setTo(query.get("to") || "");
      const next: Record<string,string> = {};
      for (const key of ["account","event","employeeId","projectId","departmentId","phaseId","categoryId","requestId","actor","action","search"]) next[key] = query.get(key) || "";
      setFilters(next); setReady(true);
    };
    restore(); window.addEventListener("popstate",restore);
    return () => window.removeEventListener("popstate",restore);
  }, [datasets]);
  useEffect(() => {
    if (!ready || scopeLoading) return;
    const query = new URLSearchParams(); query.set("dataset", code);
    if (scope) query.set("scope", scope);
    if (from) query.set("from", from); if (to) query.set("to", to);
    for (const [key, value] of Object.entries(filters)) if (value.trim()) query.set(key, value.trim());
    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${query}`);
  }, [ready, scopeLoading, code, scope, from, to, filters]);
  const params = () => {
    const query=new URLSearchParams();if(scope)query.set("scope",scope);
    if(dataset?.supportsDateFilter){if(from)query.set("from",from);if(to)query.set("to",to);}
    const keys=[...dimensionFields,...(accountingFilters?["account","event"]:[]),...(auditFilters?["actor","action"]:[])];
    if(["department-employees","department-budgets","project-cost-details","project-financial-summary"].includes(code))keys.push("search");
    for(const key of keys)if(filters[key]?.trim())query.set(key,filters[key].trim());return query;
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await action(); } catch (err) { setError(err instanceof ApiError ? err.apiMessage : "Không thực hiện được thao tác Excel."); }
    finally { setBusy(false); }
  };
  const inspect = () => run(async () => {
    if (!file || !dataset || !scopeReady) return;
    setPreview(null);
    const body = new FormData(); body.append("file", file);
    const response = await api.post<Preview>(`/api/v1/spreadsheets/${code}/preview?${params()}`, body, { headers: {} });
    setPreview(response.data);
  });
  const commit = () => {
    setConfirm(false);
    void run(async () => {
      if (!preview) return;
      const response = await api.post<Preview>(`/api/v1/spreadsheets/batches/${preview.batchId}/commit`);
      setPreview(response.data);
      if (response.data.state === "COMMITTED") toast.success("Đã ghi toàn bộ lô dữ liệu.");
    });
  };
  return <div className="space-y-6 pb-10">
    <header className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-indigo-700 text-white shadow-xl shadow-blue-900/10">
      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="max-w-3xl"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">Dữ liệu · IFMS</p><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Dữ liệu &amp; báo cáo</h1><p className="mt-2 text-sm leading-6 text-blue-100">Chọn nội dung cần làm việc. Hệ thống chỉ hiển thị thao tác nhập hoặc xuất được cấp cho vai trò của bạn.</p></div>
        <div className="w-fit rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5"><p className="text-xs text-blue-100">Bộ dữ liệu</p><p className="mt-1 text-lg font-bold">{loading ? "—" : datasets.length}</p></div>
      </div>
    </header>
    {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
    {loading ? <p className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-500">Đang tải danh mục…</p> : <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4"><h2 className="text-lg font-bold text-slate-900">1. Chọn bộ dữ liệu</h2><p className="mt-1 text-sm text-slate-500">Danh sách và phạm vi được cấp theo tài khoản hiện tại.</p></div>
        <div className="grid gap-4 p-5 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold text-slate-700">Bộ dữ liệu<select className={field} value={code} disabled={busy} onChange={e => { setCode(e.target.value); setScope(""); setFilters({}); setShowAllColumns(false); setError(""); }}>{datasets.length === 0 && <option value="">Chưa có bộ dữ liệu được cấp quyền</option>}{datasets.map(d => <option key={d.code} value={d.code}>{d.label}</option>)}</select></label>
          {dataset?.scopeLabel && <label className="grid gap-2 text-sm font-semibold text-slate-700">{dataset.scopeLabel}<select className={field} value={scope} disabled={busy || scopeLoading} onChange={e => { setScope(e.target.value); setPreview(null); }}><option value="">{scopeLoading ? "Đang tải…" : "Chọn phạm vi"}</option>{scopes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}</div>
      </section>
      {dataset && <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4"><div><h2 className="text-lg font-bold text-slate-900">2. Cấu trúc dữ liệu</h2><p className="mt-1 text-sm text-slate-500">{dataset.label} · {dataset.columns.length} cột · Phiên bản mẫu {dataset.schemaVersion}</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">{dataset.importEnabled ? "Có thể nhập" : "Chỉ xuất báo cáo"}</span><span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">Xuất Excel</span></div></div>
        <div className="space-y-4 p-5"><div><div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-sm font-bold text-slate-800">Cấu trúc cột</h4><p className="mt-0.5 text-xs text-slate-500">Đang xem {visibleColumns.length}/{dataset.columns.length} cột chính cho bộ dữ liệu này.</p></div>{hasCollapsedColumns && <button type="button" onClick={() => setShowAllColumns(value => !value)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50">{showAllColumns ? "Thu gọn" : `Xem thêm ${dataset.columns.length - primary.length} cột`}</button>}</div><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{visibleColumns.map((column,index)=><div key={column.key} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xs font-bold text-blue-700">{String(index+1).padStart(2,"0")}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{column.label}</p><p className="truncate font-mono text-[11px] text-slate-400">{column.key}</p></div><div className="shrink-0 text-right"><p className="text-[10px] text-slate-500">{friendlyType(column.type)}</p><p className={column.required?"text-[10px] font-bold text-rose-600":"text-[10px] text-slate-400"}>{column.required?"Bắt buộc":"Tùy chọn"}</p></div></div>)}</div>{hasCollapsedColumns && !showAllColumns && <p className="text-xs text-slate-500">{dataset.importEnabled ? "Các cột tùy chọn vẫn có trong mẫu Excel và có thể mở rộng khi cần." : "Đã ẩn các cột bổ sung khỏi phần xem nhanh; file xuất vẫn giữ thông tin phục vụ đối chiếu."}</p>}</div>
          {dataset.importEnabled && <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3"><div><h4 className="text-sm font-bold text-slate-800">Ví dụ dữ liệu</h4><p className="text-xs text-slate-500">Minh họa cách điền; không được ghi vào hệ thống.</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">DỮ LIỆU MẪU</span></div><div className="overflow-x-auto"><table className="w-full min-w-max text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{visibleColumns.map(column=><th key={column.key} className="whitespace-nowrap px-4 py-3 font-semibold">{column.label}<span className="ml-1 text-rose-500">{column.required?"*":""}</span></th>)}</tr></thead><tbody><tr className="divide-x divide-slate-100">{visibleColumns.map(column=><td key={column.key} className="whitespace-nowrap px-4 py-3 text-slate-700">{exampleFor(column)}</td>)}</tr></tbody></table></div></div>}
          {dataset.importEnabled && <p className="text-xs leading-5 text-slate-500">File mẫu có sheet <b>Data</b> để nhập, sheet <b>HuongDan</b> có ví dụ riêng và sheet <b>ThamChieu</b> (nếu có). Chỉ sao chép dữ liệu phù hợp vào Data; không nhập dòng ví dụ.</p>}
        </div>
      </section>}
      {dataset?.importEnabled && <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4"><h2 className="text-lg font-bold text-slate-900">3. Nhập dữ liệu</h2><p className="mt-1 text-sm text-slate-500">Tải mẫu, điền dữ liệu, kiểm tra lỗi rồi mới xác nhận ghi.</p></div>
        <div className="space-y-5 p-5">
          {code === "requests" && <div className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div><h3 className="text-sm font-bold text-blue-900">Chứng từ cho yêu cầu chi</h3><p className="mt-1 text-xs leading-5 text-blue-900">Tải chứng từ lên trước khi điền file. Sao chép ID trả về vào cột documentIds; mỗi file chỉ gắn với một yêu cầu, nhiều ID ngăn cách bằng dấu chấm phẩy (;).</p></div>
            <label className="block text-xs font-semibold text-blue-900">Chọn chứng từ (ảnh hoặc PDF)
              <input type="file" multiple accept="image/*,application/pdf" disabled={busy} onChange={e => {
                const selected = Array.from(e.target.files || []);
                void run(async () => { for (const file of selected) { const document = await uploadRegisteredDocument(file); setDocuments(previous => [...previous, document]); } });
                e.target.value = "";
              }} className="mt-2 block w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-white" />
            </label>
            {documents.length > 0 && <ul className="grid gap-2 text-xs sm:grid-cols-2">{documents.map(doc => <li key={doc.id} className="min-w-0 rounded-xl border border-blue-100 bg-white p-3"><span className="mr-2 rounded bg-blue-50 px-2 py-1 font-mono font-bold text-blue-700">ID {doc.id}</span><a className="break-all text-blue-700 underline" href={doc.url} target="_blank" rel="noopener noreferrer">{doc.fileName}</a></li>)}</ul>}
          </div>}
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 p-4"><p className="mb-3 text-sm font-bold text-slate-800">1. Tải biểu mẫu</p><button type="button" disabled={busy || !scopeReady} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => void run(() => downloadFile(`/api/v1/spreadsheets/${code}/template?${params()}`, `${code}-template.xlsx`))}>Tải mẫu .xlsx</button></div>
            <label className="rounded-2xl border border-slate-200 p-4 text-sm font-bold text-slate-800">2. Chọn file đã điền<input type="file" accept=".xlsx" disabled={busy || !scopeReady} className="mt-3 block w-full max-w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-normal" onChange={e => { setFile(e.target.files?.[0] || null); setPreview(null); }} />{file && <span className="mt-2 block break-all text-xs font-normal text-slate-500">{file.name}</span>}</label>
            <div className="rounded-2xl border border-slate-200 p-4"><p className="mb-3 text-sm font-bold text-slate-800">3. Kiểm tra trước khi ghi</p><button type="button" disabled={busy || !file || !scopeReady} className={button} onClick={() => void inspect()}>Xem kết quả kiểm tra</button></div>
          </div>
          <p className="rounded-xl bg-blue-50 p-4 text-xs leading-5 text-blue-900">Sheet Data chứa dữ liệu nhập; sheet ThamChieu lấy từ hệ thống. Mã và ngày dùng kiểu Text, ngày theo YYYY-MM-DD. Không nhập mật khẩu, PIN hay số dư ví. Dữ liệu yêu cầu sau khi nhập vẫn theo luồng duyệt thông thường.</p>
        </div>
      </section>}
      {preview && <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-lg font-bold text-slate-900">{preview.state === "COMMITTED" ? "Dữ liệu đã được ghi" : "Kết quả kiểm tra file"}</h2><p className="mt-1 text-sm text-slate-500">{preview.totalRows} dòng · {preview.validRows} hợp lệ · {preview.errorRows} có lỗi</p></div>
          <div className="flex flex-wrap gap-2">{preview.errors.length > 0 && <button type="button" className={button} disabled={busy} onClick={() => void run(() => downloadFile(`/api/v1/spreadsheets/batches/${preview.batchId}/errors`, "excel-errors.xlsx"))}>Tải báo cáo lỗi</button>}<button type="button" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40" disabled={busy || preview.errorRows > 0 || preview.state === "COMMITTED"} onClick={() => setConfirm(true)}>Xác nhận ghi dữ liệu</button></div>
        </div>
        {preview.errors.length > 0 && <ul className="max-h-60 space-y-1 overflow-auto border-b border-rose-100 bg-rose-50 p-5 text-xs text-rose-800">{preview.errors.map((e, i) => <li key={i}>Dòng {e.row}{e.column ? ` · ${e.column}` : ""}: {e.message}</li>)}</ul>}
        <div className="max-h-[500px] overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-blue-50 text-slate-600"><tr><th className="whitespace-nowrap p-3">Dòng Excel</th>{dataset?.columns.map(c => <th key={c.key} className="whitespace-nowrap p-3">{c.label}</th>)}</tr></thead><tbody>{preview.rows.slice(0, 100).map(row => <tr key={row.row} className="border-t border-slate-100 hover:bg-blue-50/40"><td className="p-3 text-slate-500">{row.row}</td>{dataset?.columns.map(c => <td key={c.key} className="max-w-72 truncate p-3 text-slate-700" title={row.values[c.key]}>{row.values[c.key] || "—"}</td>)}</tr>)}</tbody></table></div>
        {preview.totalRows > 100 && <p className="border-t border-slate-100 p-4 text-xs text-slate-500">Hiển thị 100 dòng đầu; hệ thống đã kiểm tra toàn bộ {preview.totalRows} dòng.</p>}
      </section>}
      {dataset && <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4"><h2 className="text-lg font-bold text-slate-900">{dataset.importEnabled ? "4" : "3"}. Xuất báo cáo</h2><p className="mt-1 text-sm text-slate-500">Chọn bộ lọc phù hợp rồi tải dữ liệu trong phạm vi được phép.</p></div>
        <div className="space-y-5 p-5">
      {dimensionFields.length > 0 && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {accountingFilters && <label className="grid gap-1 text-xs text-slate-500">Tài khoản kế toán<select className={field} value={filters.account||""} onChange={e=>setFilters(current=>({...current,account:e.target.value}))}><option value="">Tất cả tài khoản</option>{Object.entries({ADVANCE_RECEIVABLE:"Tạm ứng còn phải quyết toán",PROJECT_EXPENSE:"Chi phí dự án",EMPLOYEE_REIMBURSEMENT_PAYABLE:"Khoản phải hoàn nhân viên",PAYROLL_EXPENSE:"Chi phí lương",PAYROLL_DEDUCTION_CLEARING:"Khấu trừ lương",COMPANY_FUND_WALLET:"Quỹ công ty",EXTERNAL_BANK_CASH:"Nguồn tiền ngân hàng",DEPARTMENT_WALLET:"Ví phòng ban",PROJECT_WALLET:"Ví dự án",OPENING_BALANCE_CLEARING:"Đối ứng mở sổ"}).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>}
        {accountingFilters && <label className="grid gap-1 text-xs text-slate-500">Loại nghiệp vụ<select className={field} value={filters.event || ""} onChange={e => setFilters(current => ({ ...current, event: e.target.value }))}><option value="">Tất cả nghiệp vụ</option>{["ADVANCE_DISBURSED", "EXPENSE_VERIFIED", "EXPENSE_PAID", "REIMBURSE_SETTLED", "ADVANCE_RETURNED", "PAYROLL_SETTLEMENT", "SYSTEM_TOPUP", "DEPARTMENT_ALLOCATION", "PROJECT_ALLOCATION", "REVERSAL", "OPENING_BALANCE"].map(value => <option key={value} value={value}>{accountingEventLabels[value]||value}</option>)}</select></label>}
        {dimensionFields.map(key => <ReferencePicker key={key} kind={key.replace("Id","")} label={({employeeId:"Nhân viên",projectId:"Dự án",departmentId:"Phòng ban",phaseId:"Giai đoạn",categoryId:"Danh mục",requestId:"Yêu cầu"} as Record<string,string>)[key]} value={filters[key] || ""} parent={key==="phaseId"?filters.projectId:key==="categoryId"?filters.phaseId:undefined} onChange={value=>setFilters(current=>{const next={...current,[key]:value};if(key==="projectId"){next.phaseId="";next.categoryId="";}if(key==="phaseId")next.categoryId="";return next;})}/>)}
      </div>}
      {auditFilters && <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs text-slate-500">Người thao tác<input className={field} value={filters.actor || ""} onChange={e=>setFilters(v=>({...v,actor:e.target.value}))}/></label><label className="grid gap-1 text-xs text-slate-500">Thao tác<select className={field} value={filters.action || ""} onChange={e=>setFilters(v=>({...v,action:e.target.value}))}><option value="">Tất cả</option>{["INSERT","UPDATE","DELETE"].map(v=><option key={v}>{v}</option>)}</select></label></div>}
      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-slate-100 pt-4">{dataset.supportsDateFilter ? <div className="flex flex-wrap gap-3"><label className="grid gap-1 text-xs font-medium text-slate-600">Từ ngày<input type="date" className={field} value={from} onChange={e => setFrom(e.target.value)} /></label><label className="grid gap-1 text-xs font-medium text-slate-600">Đến ngày<input type="date" className={field} value={to} onChange={e => setTo(e.target.value)} /></label></div> : <p className="text-xs text-slate-500">Báo cáo phản ánh trạng thái tại thời điểm tải file.</p>}<button type="button" disabled={busy || !scopeReady} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => void run(async () => { await downloadFile(`/api/v1/spreadsheets/${code}/export?${params()}`, `${code}-export.xlsx`); setHistoryVersion(n=>n+1); })}>Tải báo cáo Excel</button></div>
      {busy && <p role="status" className="text-sm text-blue-700">Đang xử lý…</p>}
        </div>
      </section>}
    </div>}
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4"><h2 className="text-lg font-bold text-slate-900">Lịch sử xuất báo cáo</h2><p className="mt-1 text-sm text-slate-500">Các file bạn đã xuất và phạm vi dữ liệu tương ứng.</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-blue-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr>{["Thời điểm", "Bộ dữ liệu", "Phạm vi", "Số dòng"].map(label => <th key={label} className="px-5 py-3">{label}</th>)}</tr></thead><tbody>{historyLoading ? <tr><td colSpan={4} className="p-6 text-center text-slate-500">Đang tải lịch sử xuất…</td></tr> : historyError ? <tr><td colSpan={4} className="p-6 text-rose-700" role="alert">{historyError}<button type="button" className="ml-3 underline" onClick={()=>setHistoryVersion(n=>n+1)}>Thử lại</button></td></tr> : exportHistory.length === 0 ? <tr><td colSpan={4} className="p-6 text-center text-slate-500">Chưa có file nào được xuất.</td></tr> : exportHistory.map(log => <tr key={log.id} className="border-t border-slate-100 hover:bg-blue-50/40"><td className="whitespace-nowrap px-5 py-3">{formatDateTime(log.createdAt)}</td><td className="px-5 py-3 font-semibold text-slate-800">{datasets.find(item => item.code === log.datasetCode)?.label || log.datasetCode}</td><td className="max-w-64 truncate px-5 py-3 text-slate-600" title={`${log.scopeKey} · ${log.filterSnapshot}`}>{log.scopeKey} · {log.filterSnapshot}</td><td className="px-5 py-3 text-slate-700">{log.rowCount}</td></tr>)}</tbody></table></div>
    </section>
    <ConfirmModal open={confirm} message={`Xác nhận ghi toàn bộ ${preview?.totalRows || 0} dòng? ${code === "payroll" ? "Dữ liệu này thay thế toàn bộ phiếu lương nháp trong kỳ đã chọn." : "Dữ liệu sẽ được tạo theo quy trình nghiệp vụ hiện tại."}`} onConfirm={commit} onCancel={() => setConfirm(false)} />
  </div>;
}
