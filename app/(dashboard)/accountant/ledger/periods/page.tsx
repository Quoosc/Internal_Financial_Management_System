"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { ConfirmModal } from "@/components/ui/confirm-modal";
type Period = { period: string; closed: boolean; closedAt: string | null; closedBy: number | null; reason: string | null };
type CloseIssue = { code: string; severity: string; journalId: number | null; journalCode: string | null; eventType: string | null; sourceType: string | null; sourceId: string | null; amount: number | null; message: string; actionHint: string };
type ClosePreview = { period: string; eligible: boolean; journalCount: number; invalidJournalCount: number; missingSourceCount: number; unmatchedTopupCount: number; invalidSourceLinkCount: number; sourceAmountMismatchCount: number; invalidAdvanceBalanceCount: number; issueTotal: number; issuePage: number; issueSize: number; issues: CloseIssue[]; blockingIssues: string[]; carryForwardNotes: string[] };
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
  const [issuePage, setIssuePage] = useState(1);
  const previewRequest = useRef(0);
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
  const checkClose = useCallback(async (requestedPage = issuePage) => {
    if (!selected) return;
    const requestId = ++previewRequest.current;
    const requestedPeriod = selected;
    setPreviewBusy(true); setError(""); setPreview(null);
    try {
      const result = await api.get<ClosePreview>(`/api/v1/accountant/ledger/periods/${requestedPeriod}/close-preview?issuePage=${requestedPage}&issueSize=20`);
      if (requestId === previewRequest.current) setPreview(result.data);
    } catch (err) {
      if (requestId === previewRequest.current) setError(err instanceof ApiError ? err.apiMessage : "Không kiểm tra được kỳ trước khi đóng.");
    } finally {
      if (requestId === previewRequest.current) setPreviewBusy(false);
    }
  }, [issuePage, selected]);
  const sourceHref = (issue: CloseIssue) => {
    if (!issue.sourceId) return null;
    if (issue.sourceType === "REQUEST") return `/accountant/ledger/sources/requests/${issue.sourceId}`;
    if (issue.sourceType === "PAYSLIP") return `/accountant/payslips/${issue.sourceId}`;
    if (issue.sourceType === "TRANSACTION") return `/accountant/ledger/${issue.sourceId}`;
    return null;
  };
  const money = (amount: number | null) => amount == null ? "—" : `${new Intl.NumberFormat("vi-VN").format(amount)} ₫`;
  const issuePages = Math.max(1, Math.ceil((preview?.issueTotal ?? 0) / (preview?.issueSize ?? 20)));
  return <div className="space-y-5 pb-8"><Link href="/accountant/ledger?tab=journal" className="text-sm font-semibold text-blue-700">← Sổ cái kế toán</Link>
    <header className="rounded-3xl bg-gradient-to-r from-blue-700 to-indigo-700 p-7 text-white"><p className="text-xs uppercase tracking-widest text-blue-100">Kế toán · kiểm soát ngày ghi sổ</p><h1 className="mt-2 text-3xl font-bold">Kỳ kế toán</h1><p className="mt-2 text-sm text-blue-100">Kỳ đã đóng không nhận thêm bút toán. Tạm ứng còn mở được theo dõi tiếp ở kỳ sau.</p></header>
    <form className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={e => { e.preventDefault(); void checkClose(); }}>
      <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-xs text-slate-500">Kỳ cần đóng<input type="month" required value={selected} onChange={e => { previewRequest.current++; setSelected(e.target.value); setPreview(null); setIssuePage(1); }} className="rounded-xl border border-slate-200 px-3 py-3 text-sm" /></label><label className="grid gap-1 text-xs text-slate-500">Lý do / căn cứ đối chiếu<input required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-3 text-sm" /></label></div>
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={busy || previewBusy || !selected} className="rounded-xl border border-blue-200 px-5 py-3 text-sm font-semibold text-blue-700 disabled:opacity-40">{previewBusy ? "Đang kiểm tra…" : "Kiểm tra trước khi đóng"}</button>{preview?.eligible && preview.period === selected && <button type="button" disabled={busy || !reason.trim()} onClick={() => setConfirm(true)} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">Đóng kỳ đã kiểm tra</button>}</div>
      {preview && preview.period === selected && <div className={`space-y-3 rounded-xl p-4 text-sm ${preview.eligible ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}><p className="font-semibold">{preview.eligible ? "Đủ điều kiện đóng kỳ" : "Chưa đủ điều kiện đóng kỳ"} · {preview.journalCount} bút toán</p><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"><p>Bút toán mất cân bằng: <b>{preview.invalidJournalCount}</b></p><p>Thiếu hồ sơ nguồn: <b>{preview.missingSourceCount}</b></p><p>Liên kết sai: <b>{preview.invalidSourceLinkCount}</b></p><p>Số tiền/chứng từ sai: <b>{preview.sourceAmountMismatchCount}</b></p><p>Số dư tạm ứng sai: <b>{preview.invalidAdvanceBalanceCount}</b></p><p>Nạp quỹ chưa đối chiếu: <b>{preview.unmatchedTopupCount}</b></p></div>{preview.blockingIssues.map(item => <p key={item} className="font-medium">• {item}</p>)}{preview.carryForwardNotes.map(item => <p key={item} className="text-slate-600">{item}</p>)}
        {preview.issueTotal > 0 && <section className="overflow-hidden rounded-xl border border-amber-200 bg-white text-slate-800"><div className="border-b border-slate-100 px-4 py-3"><h2 className="font-semibold">Ngoại lệ cần xử lý · {preview.issueTotal}</h2><p className="mt-1 text-xs text-slate-500">Mở journal hoặc hồ sơ nguồn để kiểm tra. Các mục này được kiểm tra lại khi đóng kỳ.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{["Mã / nguồn", "Số tiền", "Vấn đề", "Hướng xử lý"].map(x => <th key={x} className="px-4 py-3">{x}</th>)}</tr></thead><tbody>{preview.issues.map((issue, index) => <tr key={`${issue.code}-${issue.journalId ?? issue.sourceId}-${index}`} className="border-t border-slate-100 align-top"><td className="space-y-1 px-4 py-3"><p className="font-semibold text-rose-700">{issue.code}</p>{issue.journalId && <Link className="block text-blue-700 underline" href={`/accountant/ledger/journals/${issue.journalId}`}>{issue.journalCode || `Journal #${issue.journalId}`}</Link>}{sourceHref(issue) && <Link className="block text-blue-700 underline" href={sourceHref(issue)!}>{issue.sourceType} · {issue.sourceId}</Link>}<p className="text-slate-500">{issue.eventType || ""}</p></td><td className="whitespace-nowrap px-4 py-3">{money(issue.amount)}</td><td className="max-w-sm px-4 py-3">{issue.message}</td><td className="max-w-sm px-4 py-3 text-slate-600">{issue.actionHint}</td></tr>)}</tbody></table></div><div className="flex items-center justify-between border-t border-slate-100 px-4 py-3"><button type="button" disabled={previewBusy || issuePage <= 1} onClick={() => { const next = issuePage - 1; setIssuePage(next); void checkClose(next); }} className="rounded-lg border border-slate-200 px-3 py-2 font-semibold disabled:opacity-40">Trang trước</button><span className="text-xs text-slate-500">Trang {preview.issuePage} / {issuePages}</span><button type="button" disabled={previewBusy || issuePage >= issuePages} onClick={() => { const next = issuePage + 1; setIssuePage(next); void checkClose(next); }} className="rounded-lg border border-slate-200 px-3 py-2 font-semibold disabled:opacity-40">Trang sau</button></div></section>}
      </div>}
    </form>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-5 text-sm text-rose-800">{error}</p>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{busy ? <p className="p-10 text-center text-slate-500">Đang tải…</p> : <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-blue-50 text-xs text-slate-500"><tr>{["Kỳ", "Trạng thái", "Thời điểm đóng", "Căn cứ"].map(v => <th key={v} className="px-5 py-3">{v}</th>)}</tr></thead><tbody>{periods.length === 0 ? <tr><td colSpan={4} className="p-10 text-center text-slate-500">Chưa có kỳ được ghi sổ.</td></tr> : periods.map(p => <tr key={p.period} className="border-t border-slate-100"><td className="px-5 py-4 font-semibold">{p.period}</td><td className="px-5 py-4">{p.closed ? "Đã đóng" : "Đang mở"}</td><td className="px-5 py-4">{formatDateTime(p.closedAt)}</td><td className="px-5 py-4 text-slate-500">{p.reason || "—"}</td></tr>)}</tbody></table></div>}</section>
    <ConfirmModal open={confirm} message={`Đóng kỳ ${selected}? Sau khi đóng, các nghiệp vụ sửa sai phải ghi ở kỳ đang mở và giữ liên kết với hồ sơ gốc.`} onConfirm={() => void close()} onCancel={() => setConfirm(false)} />
  </div>;
}
