"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { ConfirmModal } from "@/components/ui/confirm-modal";
type Period = { period: string; closed: boolean; closedAt: string | null; closedBy: number | null; reason: string | null };
type ClosePreview = { period: string; eligible: boolean; journalCount: number; invalidJournalCount: number; missingSourceCount: number; unmatchedTopupCount: number; blockingIssues: string[]; carryForwardNotes: string[] };
export default function AccountingPeriodsPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selected, setSelected] = useState("");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<ClosePreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true; setBusy(true); setError("");
    api.get<Period[]>("/api/v1/accountant/ledger/periods").then(res => { if (active) setPeriods(res.data); })
      .catch(err => { if (active) setError(err instanceof ApiError ? err.apiMessage : "Không tải được kỳ kế toán."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [reload]);
  const close = async () => {
    setConfirm(false); setBusy(true); setError("");
    try { await api.post(`/api/v1/accountant/ledger/periods/${selected}/close`, { reason, reviewAcknowledged: true }); setReason(""); setSelected(""); setPreview(null); setReload(n => n + 1); }
    catch (err) { setError(err instanceof ApiError ? err.apiMessage : "Không đóng được kỳ."); }
    finally { setBusy(false); }
  };
  const checkClose = async () => {
    if (!selected) return;
    setPreviewBusy(true); setError(""); setPreview(null);
    try { setPreview((await api.get<ClosePreview>(`/api/v1/accountant/ledger/periods/${selected}/close-preview`)).data); }
    catch (err) { setError(err instanceof ApiError ? err.apiMessage : "Không kiểm tra được kỳ trước khi đóng."); }
    finally { setPreviewBusy(false); }
  };
  return <div className="space-y-5 pb-8"><Link href="/accountant/ledger?tab=journal" className="text-sm font-semibold text-blue-700">← Sổ cái kế toán</Link>
    <header className="rounded-3xl bg-gradient-to-r from-blue-700 to-indigo-700 p-7 text-white"><p className="text-xs uppercase tracking-widest text-blue-100">Kế toán · kiểm soát ngày ghi sổ</p><h1 className="mt-2 text-3xl font-bold">Kỳ kế toán</h1><p className="mt-2 text-sm text-blue-100">Kỳ đã đóng không nhận thêm bút toán. Tạm ứng còn mở được theo dõi tiếp ở kỳ sau.</p></header>
    <form className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={e => { e.preventDefault(); void checkClose(); }}>
      <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-xs text-slate-500">Kỳ cần đóng<input type="month" required value={selected} onChange={e => { setSelected(e.target.value); setPreview(null); }} className="rounded-xl border border-slate-200 px-3 py-3 text-sm" /></label><label className="grid gap-1 text-xs text-slate-500">Lý do / căn cứ đối chiếu<input required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-3 text-sm" /></label></div>
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={busy || previewBusy || !selected} className="rounded-xl border border-blue-200 px-5 py-3 text-sm font-semibold text-blue-700 disabled:opacity-40">{previewBusy ? "Đang kiểm tra…" : "Kiểm tra trước khi đóng"}</button>{preview?.eligible && preview.period === selected && <button type="button" disabled={busy || !reason.trim()} onClick={() => setConfirm(true)} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">Đóng kỳ đã kiểm tra</button>}</div>
      {preview && preview.period === selected && <div className={`space-y-2 rounded-xl p-4 text-sm ${preview.eligible ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}><p className="font-semibold">{preview.eligible ? "Đủ điều kiện đóng kỳ" : "Chưa đủ điều kiện đóng kỳ"} · {preview.journalCount} bút toán</p><p>Bút toán lỗi: {preview.invalidJournalCount} · Thiếu nguồn: {preview.missingSourceCount} · Nạp quỹ chưa khớp sao kê: {preview.unmatchedTopupCount}</p>{preview.blockingIssues.map(item => <p key={item}>• {item}</p>)}{preview.carryForwardNotes.map(item => <p key={item} className="text-slate-600">{item}</p>)}</div>}
    </form>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-5 text-sm text-rose-800">{error}</p>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{busy ? <p className="p-10 text-center text-slate-500">Đang tải…</p> : <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-blue-50 text-xs text-slate-500"><tr>{["Kỳ", "Trạng thái", "Thời điểm đóng", "Căn cứ"].map(v => <th key={v} className="px-5 py-3">{v}</th>)}</tr></thead><tbody>{periods.length === 0 ? <tr><td colSpan={4} className="p-10 text-center text-slate-500">Chưa có kỳ được ghi sổ.</td></tr> : periods.map(p => <tr key={p.period} className="border-t border-slate-100"><td className="px-5 py-4 font-semibold">{p.period}</td><td className="px-5 py-4">{p.closed ? "Đã đóng" : "Đang mở"}</td><td className="px-5 py-4">{formatDateTime(p.closedAt)}</td><td className="px-5 py-4 text-slate-500">{p.reason || "—"}</td></tr>)}</tbody></table></div>}</section>
    <ConfirmModal open={confirm} message={`Đóng kỳ ${selected}? Sau khi đóng, các nghiệp vụ sửa sai phải ghi ở kỳ đang mở và giữ liên kết với hồ sơ gốc.`} onConfirm={() => void close()} onCancel={() => setConfirm(false)} />
  </div>;
}
