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
  const dataset = datasets.find(d => d.code === code);
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
  return <div className="space-y-5 pb-8">
    <header className="rounded-3xl bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 p-6 text-white shadow-lg sm:p-8"><p className="text-xs font-bold uppercase tracking-widest text-blue-100">IFMS · dữ liệu theo quyền của bạn</p><h1 className="mt-2 text-3xl font-bold">Nhập / xuất Excel</h1><p className="mt-2 text-sm leading-6 text-blue-100">Tải mẫu, kiểm tra dữ liệu rồi xác nhận. Xuất báo cáo từ server, gồm tất cả các trang trong phạm vi cho phép.</p></header>
    {loading ? <p className="p-12 text-center text-slate-500">Đang tải danh mục…</p> : <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5 text-xs text-slate-500">Bộ dữ liệu<select className={field} value={code} disabled={busy} onChange={e => { setCode(e.target.value); setScope(""); setFilters({}); setError(""); }}>{datasets.length === 0 && <option value="">Chưa có bộ dữ liệu được cấp quyền</option>}{datasets.map(d => <option key={d.code} value={d.code}>{d.label}</option>)}</select></label>
        {dataset?.scopeLabel && <label className="grid gap-1.5 text-xs text-slate-500">{dataset.scopeLabel}<select className={field} value={scope} disabled={busy || scopeLoading} onChange={e => { setScope(e.target.value); setPreview(null); }}><option value="">{scopeLoading ? "Đang tải…" : "Chọn phạm vi"}</option>{scopes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}</div>
      {dataset?.importEnabled && <>
        {code === "requests" && <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Chuẩn bị chứng từ trước khi điền Excel</p>
          <p className="text-xs leading-5 text-amber-900">Upload chứng từ của bạn, dùng ID hệ thống trả về ở cột documentIds. Một file chỉ gắn vào một yêu cầu; nhiều ID ngăn cách bằng dấu ;.</p>
          <input type="file" multiple accept="image/*,application/pdf" disabled={busy} onChange={e => {
            const selected = Array.from(e.target.files || []);
            void run(async () => { for (const file of selected) { const document = await uploadRegisteredDocument(file); setDocuments(previous => [...previous, document]); } });
            e.target.value = "";
          }} className="text-sm" />
          {documents.length > 0 && <ul className="space-y-2 text-xs">{documents.map(doc => <li key={doc.id}><span className="mr-3 rounded bg-white px-2 py-1 font-mono font-bold text-blue-700">ID {doc.id}</span><a className="text-blue-700 underline" href={doc.url} target="_blank" rel="noopener noreferrer">{doc.fileName}</a></li>)}</ul>}
        </div>}
        <div className="flex flex-wrap items-center gap-3"><button disabled={busy || !scopeReady} className={button} onClick={() => void run(() => downloadFile(`/api/v1/spreadsheets/${code}/template?${params()}`, `${code}-template.xlsx`))}>1. Tải mẫu .xlsx</button><label className="text-sm text-slate-600">2. Chọn file<input type="file" accept=".xlsx" disabled={busy || !scopeReady} className="ml-3 max-w-full text-sm" onChange={e => { setFile(e.target.files?.[0] || null); setPreview(null); }} /></label><button disabled={busy || !file || !scopeReady} className={button} onClick={() => void inspect()}>3. Xem trước</button></div>
        <p className="rounded-xl bg-blue-50 p-4 text-xs leading-5 text-blue-900">Sheet Data chứa dữ liệu nhập. Sheet ThamChieu lấy từ hệ thống; ô mã và ngày dùng Text, ngày YYYY-MM-DD. Không nhập mật khẩu, PIN hay số dư ví. Việc nhập không tự duyệt hoặc giải ngân yêu cầu.</p>
      </>}
      {dimensionFields.length > 0 && <div className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
        {accountingFilters && <label className="grid gap-1 text-xs text-slate-500">Tài khoản kế toán<select className={field} value={filters.account||""} onChange={e=>setFilters(current=>({...current,account:e.target.value}))}><option value="">Tất cả tài khoản</option>{Object.entries({ADVANCE_RECEIVABLE:"Tạm ứng còn phải quyết toán",PROJECT_EXPENSE:"Chi phí dự án",EMPLOYEE_REIMBURSEMENT_PAYABLE:"Khoản phải hoàn nhân viên",PAYROLL_EXPENSE:"Chi phí lương",PAYROLL_DEDUCTION_CLEARING:"Khấu trừ lương",COMPANY_FUND_WALLET:"Quỹ công ty",EXTERNAL_BANK_CASH:"Nguồn tiền ngân hàng",DEPARTMENT_WALLET:"Ví phòng ban",PROJECT_WALLET:"Ví dự án",OPENING_BALANCE_CLEARING:"Đối ứng mở sổ"}).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>}
        {accountingFilters && <label className="grid gap-1 text-xs text-slate-500">Loại nghiệp vụ<select className={field} value={filters.event || ""} onChange={e => setFilters(current => ({ ...current, event: e.target.value }))}><option value="">Tất cả nghiệp vụ</option>{["ADVANCE_DISBURSED", "EXPENSE_VERIFIED", "EXPENSE_PAID", "REIMBURSE_SETTLED", "ADVANCE_RETURNED", "PAYROLL_SETTLEMENT", "SYSTEM_TOPUP", "DEPARTMENT_ALLOCATION", "PROJECT_ALLOCATION", "REVERSAL", "OPENING_BALANCE"].map(value => <option key={value} value={value}>{accountingEventLabels[value]||value}</option>)}</select></label>}
        {dimensionFields.map(key => <ReferencePicker key={key} kind={key.replace("Id","")} label={({employeeId:"Nhân viên",projectId:"Dự án",departmentId:"Phòng ban",phaseId:"Giai đoạn",categoryId:"Danh mục",requestId:"Yêu cầu"} as Record<string,string>)[key]} value={filters[key] || ""} parent={key==="phaseId"?filters.projectId:key==="categoryId"?filters.phaseId:undefined} onChange={value=>setFilters(current=>{const next={...current,[key]:value};if(key==="projectId"){next.phaseId="";next.categoryId="";}if(key==="phaseId")next.categoryId="";return next;})}/>)}
      </div>}
      {auditFilters && <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs text-slate-500">Người thao tác<input className={field} value={filters.actor || ""} onChange={e=>setFilters(v=>({...v,actor:e.target.value}))}/></label><label className="grid gap-1 text-xs text-slate-500">Thao tác<select className={field} value={filters.action || ""} onChange={e=>setFilters(v=>({...v,action:e.target.value}))}><option value="">Tất cả</option>{["INSERT","UPDATE","DELETE"].map(v=><option key={v}>{v}</option>)}</select></label></div>}
      <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">{dataset?.supportsDateFilter ? <><label className="grid gap-1 text-xs text-slate-500">Từ ngày theo bộ dữ liệu<input type="date" className={field} value={from} onChange={e => setFrom(e.target.value)} /></label><label className="grid gap-1 text-xs text-slate-500">Đến ngày theo bộ dữ liệu<input type="date" className={field} value={to} onChange={e => setTo(e.target.value)} /></label></> : <p className="text-xs text-slate-500">Bộ này xuất trạng thái hiện tại tại thời điểm tải file.</p>}<button disabled={busy || !dataset || !scopeReady} className={button} onClick={() => void run(async () => { await downloadFile(`/api/v1/spreadsheets/${code}/export?${params()}`, `${code}-export.xlsx`); setHistoryVersion(n=>n+1); })}>Xuất Excel theo phạm vi</button></div>
      {busy && <p role="status" className="text-sm text-blue-700">Đang xử lý…</p>}
    </section>}
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{error}</div>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h2 className="font-bold text-slate-900">Lịch sử xuất của bạn</h2><p className="mt-1 text-xs text-slate-500">Lưu bộ dữ liệu, phạm vi, bộ lọc, số dòng và mã kiểm tra của từng file đã xuất.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-blue-50 text-slate-500"><tr>{["Thời điểm", "Bộ dữ liệu", "Phạm vi", "Số dòng", "SHA-256"].map(label => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{historyLoading ? <tr><td colSpan={5} className="p-6 text-center text-slate-500">Đang tải lịch sử xuất…</td></tr> : historyError ? <tr><td colSpan={5} className="p-6 text-rose-700" role="alert">{historyError}<button className="ml-3 underline" onClick={()=>setHistoryVersion(n=>n+1)}>Thử lại</button></td></tr> : exportHistory.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-slate-500">Chưa có file nào được xuất.</td></tr> : exportHistory.map(log => <tr key={log.id} className="border-t border-slate-100"><td className="px-4 py-3">{formatDateTime(log.createdAt)}</td><td className="px-4 py-3 font-semibold">{log.datasetCode}</td><td className="max-w-56 truncate px-4 py-3" title={`${log.scopeKey} · ${log.filterSnapshot}`}>{log.scopeKey} · {log.filterSnapshot}</td><td className="px-4 py-3">{log.rowCount}</td><td className="max-w-56 truncate px-4 py-3 font-mono" title={log.fileSha256}>{log.fileSha256}</td></tr>)}</tbody></table></div></section>
    {preview && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5"><div><h2 className="font-bold text-slate-900">{preview.state === "COMMITTED" ? "Lô đã được ghi" : "Kết quả kiểm tra"}</h2><p className="mt-1 text-sm text-slate-500">{preview.totalRows} dòng · {preview.validRows} hợp lệ · {preview.errorRows} có lỗi</p></div><div className="flex gap-2">{preview.errors.length > 0 && <button className={button} disabled={busy} onClick={() => void run(() => downloadFile(`/api/v1/spreadsheets/batches/${preview.batchId}/errors`, "excel-errors.xlsx"))}>Tải báo cáo lỗi</button>}<button className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" disabled={busy || preview.errorRows > 0 || preview.state === "COMMITTED"} onClick={() => setConfirm(true)}>4. Xác nhận ghi toàn lô</button></div></div>
      {preview.errors.length > 0 && <ul className="max-h-60 space-y-1 overflow-auto bg-rose-50 p-5 text-xs text-rose-800">{preview.errors.map((e, i) => <li key={i}>Dòng {e.row}{e.column ? ` · ${e.column}` : ""}: {e.message}</li>)}</ul>}
      <div className="max-h-[500px] overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-blue-50 text-slate-500"><tr><th className="p-3">Dòng Excel</th>{dataset?.columns.map(c => <th key={c.key} className="whitespace-nowrap p-3">{c.label}</th>)}</tr></thead><tbody>{preview.rows.slice(0, 100).map(row => <tr key={row.row} className="border-t border-slate-100"><td className="p-3 text-slate-500">{row.row}</td>{dataset?.columns.map(c => <td key={c.key} className="max-w-72 truncate p-3 text-slate-700" title={row.values[c.key]}>{row.values[c.key] || "—"}</td>)}</tr>)}</tbody></table></div>
      {preview.totalRows > 100 && <p className="p-4 text-xs text-slate-500">Hiển thị 100 dòng đầu; backend đã kiểm tra toàn bộ {preview.totalRows} dòng.</p>}
    </section>}
    <ConfirmModal open={confirm} message={`Xác nhận ghi toàn bộ ${preview?.totalRows || 0} dòng? ${code === "payroll" ? "Dữ liệu này thay thế toàn bộ phiếu lương nháp trong kỳ đã chọn." : "Dữ liệu sẽ được tạo theo quy trình nghiệp vụ hiện tại."}`} onConfirm={commit} onCancel={() => setConfirm(false)} />
  </div>;
}
