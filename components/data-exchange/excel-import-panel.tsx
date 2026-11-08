"use client";

import { useEffect, useState } from "react";
import { ApiError, api, downloadFile } from "@/lib/api-client";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useToast } from "@/contexts/toast-context";
import { uploadRegisteredDocument } from "@/lib/upload-document";

type Column = { key: string; label: string; type: string; required: boolean };
type Dataset = { code: string; label: string; columns: Column[] };
type Preview = {
  batchId: string;
  state: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  rows: { row: number; values: Record<string, string> }[];
  errors: { row: number; column: string; message: string }[];
};

type Props = {
  datasetCode: string;
  scope?: number | string;
  title: string;
  description?: string;
  onImported?: () => void | Promise<void>;
};

function ExcelIcon({ kind, className = "h-4 w-4" }: { kind: "download" | "upload" | "file" | "check"; className?: string }) {
  const common = { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  if (kind === "download") return <svg {...common}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>;
  if (kind === "upload") return <svg {...common}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/></svg>;
  if (kind === "check") return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg>;
  return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2"/></svg>;
}

export function ExcelImportPanel({ datasetCode, scope, title, description, onImported }: Props) {
  const toast = useToast();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [documents, setDocuments] = useState<{ id: number; fileName: string; url: string }[]>([]);

  useEffect(() => {
    let active = true;
    api.get<Dataset[]>("/api/v1/spreadsheets")
      .then(response => {
        if (!active) return;
        const match = response.data.find(item => item.code === datasetCode);
        if (match) setDataset(match);
        else setError("Bạn không có quyền nhập bộ dữ liệu này.");
      })
      .catch(err => { if (active) setError(err instanceof ApiError ? err.apiMessage : "Không tải được cấu trúc Excel."); });
    return () => { active = false; };
  }, [datasetCode]);

  useEffect(() => { setDataset(null); setFile(null); setPreview(null); setError(""); }, [datasetCode]);
  useEffect(() => { setFile(null); setPreview(null); setError(""); }, [scope]);

  const scopeQuery = scope === undefined ? "" : `?scope=${encodeURIComponent(String(scope))}`;
  const message = (err: unknown, fallback: string) => err instanceof ApiError ? err.apiMessage : fallback;

  const downloadTemplate = async () => {
    setBusy(true); setError("");
    try {
      await downloadFile(`/api/v1/spreadsheets/${datasetCode}/template${scopeQuery}`, `${datasetCode}-template.xlsx`);
    } catch (err) { setError(message(err, "Không tải được file mẫu.")); }
    finally { setBusy(false); }
  };

  const inspectFile = async (selected: File) => {
    setFile(selected); setPreview(null); setError(""); setBusy(true);
    try {
      const body = new FormData(); body.append("file", selected);
      const response = await api.post<Preview>(`/api/v1/spreadsheets/${datasetCode}/preview${scopeQuery}`, body, { headers: {} });
      setPreview(response.data);
    } catch (err) { setError(message(err, "Không kiểm tra được file Excel.")); }
    finally { setBusy(false); }
  };

  const commit = async () => {
    if (!preview || preview.errorRows > 0) return;
    setConfirm(false); setBusy(true); setError("");
    try {
      const response = await api.post<Preview>(`/api/v1/spreadsheets/batches/${preview.batchId}/commit`);
      setPreview(response.data);
      if (response.data.state !== "COMMITTED") return;
      toast.success(`Đã nhập ${response.data.totalRows} dòng vào ${title.toLowerCase()}.`);
      if (onImported) {
        try { await onImported(); }
        catch { setError("Dữ liệu đã được nhập, nhưng chưa tải lại màn hình. Hãy tải lại trang để xem kết quả."); }
      } else window.location.reload();
    } catch (err) { setError(message(err, "Không ghi được dữ liệu Excel.")); }
    finally { setBusy(false); }
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{description || "Chọn file Excel theo mẫu. Hệ thống kiểm tra từng dòng trước khi bạn xác nhận nhập."}</p>
      </div>
      <div className="space-y-5 p-5">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Nếu file mẫu có dòng ví dụ tô màu vàng, hãy thay hoặc xóa dòng đó trước khi xem trước và xác nhận nhập dữ liệu thật.
        </div>
        {datasetCode === "requests" && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="font-semibold">Chứng từ cho yêu cầu chi</p>
            <p className="mt-1 text-xs leading-5">Tải chứng từ trước, sau đó điền ID vào cột documentIds trong Excel. Nhiều ID cách nhau bằng dấu chấm phẩy (;).</p>
            <input type="file" multiple accept="image/*,application/pdf" disabled={busy} className="mt-3 block w-full text-xs" onChange={event => {
              const selected = Array.from(event.target.files || []);
              event.target.value = "";
              void (async () => {
                setBusy(true); setError("");
                try { for (const item of selected) { const document = await uploadRegisteredDocument(item); setDocuments(previous => [...previous, document]); } }
                catch (err) { setError(message(err, "Không tải được chứng từ.")); }
                finally { setBusy(false); }
              })();
            }} />
            {documents.length > 0 && <ul className="mt-3 space-y-1">{documents.map(doc => <li key={doc.id}>ID {doc.id} · <a href={doc.url} target="_blank" rel="noopener noreferrer" className="underline">{doc.fileName}</a></li>)}</ul>}
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">1</span>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-slate-900">Tải file mẫu</h3>
                <p className="mt-1 text-sm leading-5 text-slate-500">Mẫu có sẵn tiêu đề cột, hướng dẫn và định dạng tiền tệ.</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button type="button" disabled={busy} onClick={() => void downloadTemplate()} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"><ExcelIcon kind="download" />Tải mẫu Excel</button>
                  {dataset && <span className="text-xs text-slate-500">{dataset.columns.length} cột · tối đa 2.000 dòng</span>}
                </div>
              </div>
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">2</span>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-slate-900">Chọn file cần nhập</h3>
                <p className="mt-1 text-sm leading-5 text-slate-500">Chọn file .xlsx để kiểm tra dữ liệu trước khi ghi vào hệ thống.</p>
                <label className="mt-4 flex min-h-24 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-blue-300 bg-blue-50/60 p-4 transition hover:border-blue-500 hover:bg-blue-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                  <input type="file" accept=".xlsx" disabled={busy} className="sr-only" onClick={event => { event.currentTarget.value = ""; }} onChange={event => {
                    const selected = event.target.files?.[0];
                    if (selected) void inspectFile(selected);
                  }} />
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm"><ExcelIcon kind={file ? "check" : "upload"} className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{file ? file.name : "Chọn file Excel từ thiết bị"}</span>
                    <span className="mt-1 block text-xs text-slate-500">{file ? "Chọn lại file nếu cần thay đổi" : "Định dạng .xlsx · xem trước tự động sau khi chọn"}</span>
                  </span>
                  <ExcelIcon kind="file" className="h-5 w-5 shrink-0 text-blue-600" />
                </label>
              </div>
            </div>
          </section>
        </div>
        {busy && <p role="status" className="text-sm font-medium text-blue-700">Đang xử lý file…</p>}
        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {preview && <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4">
            <div><p className="font-semibold text-slate-900">{file?.name}</p><p className="mt-1 text-sm text-slate-600">{preview.totalRows} dòng · {preview.validRows} hợp lệ · {preview.errorRows} có lỗi</p></div>
            <div className="flex gap-2">
              {preview.errors.length > 0 && <button type="button" disabled={busy} onClick={() => void downloadFile(`/api/v1/spreadsheets/batches/${preview.batchId}/errors`, "excel-errors.xlsx").catch(err => setError(message(err, "Không tải được danh sách lỗi.")))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-blue-700">Tải danh sách lỗi</button>}
              <button type="button" disabled={busy || preview.errorRows > 0 || preview.state === "COMMITTED"} onClick={() => setConfirm(true)} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">{preview.state === "COMMITTED" ? "Đã nhập" : `Nhập ${preview.validRows} dòng`}</button>
            </div>
          </div>
          {preview.errors.length > 0 && <ul role="alert" className="max-h-48 overflow-auto border-t border-rose-100 bg-rose-50 p-4 text-sm text-rose-800">{preview.errors.map((item, index) => <li key={index}>Dòng {item.row}{item.column ? ` · ${item.column}` : ""}: {item.message}</li>)}</ul>}
          <div className="max-h-80 overflow-auto"><table className="min-w-full text-left text-xs"><thead className="sticky top-0 bg-blue-50 text-slate-700"><tr><th className="whitespace-nowrap p-3">Dòng</th>{dataset?.columns.map(col => <th key={col.key} className="whitespace-nowrap p-3">{col.label}</th>)}</tr></thead><tbody>{preview.rows.slice(0, 30).map(row => <tr key={row.row} className="border-t border-slate-100"><td className="p-3 text-slate-500">{row.row}</td>{dataset?.columns.map(col => <td key={col.key} className="whitespace-nowrap p-3">{row.values[col.key] || "—"}</td>)}</tr>)}</tbody></table></div>
          {preview.totalRows > 30 && <p className="border-t border-slate-100 p-3 text-xs text-slate-500">Hiển thị 30 dòng đầu; hệ thống đã kiểm tra toàn bộ file.</p>}
        </div>}
      </div>
      <ConfirmModal open={confirm} message={datasetCode === "payroll" ? `Nhập ${preview?.totalRows || 0} dòng và thay thế toàn bộ phiếu lương nháp của kỳ này?` : `Xác nhận nhập ${preview?.totalRows || 0} dòng ${title.toLowerCase()}?`} confirmLabel="Nhập dữ liệu" onConfirm={() => void commit()} onCancel={() => setConfirm(false)} />
    </section>
  );
}
