"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { JournalActions } from "@/components/accounting/journal-actions";
import { ApiError, api } from "@/lib/api-client";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { ledgerReturnLabel, safeLedgerReturnTo, withLedgerReturnTo } from "@/lib/ledger-navigation";
import { AccountingJournalDetail, AccountingJournalEvent } from "@/types";

const labels: Record<AccountingJournalEvent, string> = {
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

export default function AccountantJournalDetailPage() {
  const { journalId } = useParams<{ journalId: string }>();
  const [returnTo, setReturnTo] = useState("/accountant/ledger?tab=journal&page=1");
  const [journal, setJournal] = useState<AccountingJournalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    setReturnTo(safeLedgerReturnTo(new URLSearchParams(window.location.search).get("returnTo"), "/accountant/ledger?tab=journal&page=1"));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setJournal(null);
    setError("");
    api.get<AccountingJournalDetail>(`/api/v1/accountant/ledger/journals/${journalId}`)
      .then((response) => { if (active) setJournal(response.data); })
      .catch((reason) => { if (active) setError(reason instanceof ApiError && reason.status === 404 ? "Không tìm thấy bút toán." : reason instanceof ApiError ? reason.apiMessage : "Không tải được chi tiết bút toán."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [journalId, reload]);

  if (loading) return <div className="mx-auto w-full max-w-6xl space-y-4"><div className="h-32 animate-pulse rounded-3xl bg-blue-100" /><div className="h-52 animate-pulse rounded-2xl bg-white" /><div className="h-64 animate-pulse rounded-2xl bg-white" /></div>;
  if (error) return <div role="alert" className="mx-auto w-full max-w-6xl rounded-2xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-800">{error}<button type="button" className="ml-4 font-semibold underline" onClick={() => setReload((value) => value + 1)}>Thử lại</button><Link href={returnTo} className="ml-4 font-semibold underline">Về danh sách</Link></div>;
  if (!journal) return <div className="mx-auto w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-8 text-center"><p>Không tìm thấy bút toán.</p><Link href={returnTo} className="mt-3 inline-block font-semibold text-blue-700">Về danh sách</Link></div>;

  const currentDetail = withLedgerReturnTo(`/accountant/ledger/journals/${journal.id}`, returnTo);
  const hasRelatedLinks = Boolean(journal.requestId || journal.walletTransactionId || journal.advanceBalanceId || journal.originalJournalId || journal.reversalJournalId);

  return <div className="mx-auto w-full max-w-6xl space-y-5 pb-8">
    <nav aria-label="Đường dẫn sổ cái" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2 text-slate-500"><Link href={returnTo} className="font-semibold text-blue-700 hover:underline">{ledgerReturnLabel(returnTo)}</Link><span>/</span><span className="font-mono text-slate-700">{journal.journalCode}</span></div>
      <Link href={returnTo} className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">← Quay lại màn hình trước</Link>
    </nav>

    <header className="overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 p-6 text-white shadow-lg sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-100">Sổ cái kế toán · chi tiết bút toán</p>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="font-mono text-2xl font-bold sm:text-3xl">{journal.journalCode}</h1><p className="mt-2 text-sm text-blue-100">{labels[journal.eventType]}</p></div>
        <span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${journal.balanced ? "border-emerald-200/50 bg-emerald-300/20 text-emerald-50" : "border-rose-200/50 bg-rose-300/20 text-rose-50"}`}>{journal.balanced ? "Hai phía cân bằng" : "Cần kiểm tra cân bằng"}</span>
      </div>
    </header>

    <section aria-label="Tóm tắt bút toán" className="grid gap-3 sm:grid-cols-3">
      <SummaryCard label="Giá trị nghiệp vụ" value={formatCurrency(journal.totalAmount)} note="Giá trị bút toán được tính một lần" tone="blue" />
      <SummaryCard label="Ngày ghi sổ" value={formatDate(journal.postingDate)} note={journal.businessDate ? `Ngày nghiệp vụ: ${formatDate(journal.businessDate)}` : "Theo kỳ kế toán hiện hành"} tone="slate" />
      <SummaryCard label="Kỳ kế toán" value={journal.postingPeriod} note="Kỳ dùng để tổng hợp sổ kế toán" tone="slate" />
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-blue-100 bg-blue-50/60 px-5 py-4"><h2 className="text-base font-bold text-slate-900">Căn cứ và đối tượng ghi nhận</h2><p className="mt-1 text-xs text-slate-600">Dùng thông tin này để đối chiếu bút toán với yêu cầu, nhân viên và dự án.</p></div>
      <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Info label="Nghiệp vụ" value={labels[journal.eventType]} />
        <Info label="Nguồn dữ liệu" value={`${journal.sourceType} · ${journal.sourceId}`} />
        <Info label="Nhân viên" value={journal.employeeName || "—"} />
        <Info label="Dự án" value={journal.projectName || "—"} />
        <Info label="Phòng ban" value={journal.departmentName || "—"} />
        <Info label="Giai đoạn" value={journal.phaseName || "—"} />
        <Info label="Danh mục chi" value={journal.categoryName || "—"} />
        <Info label="Tạm ứng liên quan" value={journal.advanceBalanceId ? `Khoản #${journal.advanceBalanceId}` : "—"} />
      </div>
      <div className="mx-5 mb-5 rounded-xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">Nội dung ghi sổ</p><p className="mt-1 text-sm leading-6 text-slate-800">{journal.description || "Chưa có mô tả."}</p></div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-base font-bold text-slate-900">Tài khoản bị ảnh hưởng</h2><p className="mt-1 text-xs text-slate-600">Mỗi dòng cho biết tài khoản và tác động của nghiệp vụ. Tổng hai phía cần bằng nhau.</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="bg-blue-50/70 text-xs font-bold text-slate-600"><tr><th className="px-5 py-3">Tài khoản</th><th className="px-5 py-3">Tác động</th><th className="px-5 py-3 text-right">Ghi nhận</th><th className="px-5 py-3 text-right">Đối ứng</th></tr></thead><tbody>{journal.lines.map((line) => <tr key={line.id} className="border-t border-slate-100"><td className="px-5 py-4"><p className="text-sm font-semibold text-slate-900">{line.accountName}</p><p className="mt-1 font-mono text-xs text-slate-500">{line.accountCode}</p></td><td className="px-5 py-4 text-xs leading-5 text-slate-600">{line.effectDescription}</td><td className="px-5 py-4 text-right text-sm font-bold text-emerald-700">{line.debitAmount > 0 ? formatCurrency(line.debitAmount) : "—"}</td><td className="px-5 py-4 text-right text-sm font-bold text-blue-700">{line.creditAmount > 0 ? formatCurrency(line.creditAmount) : "—"}</td></tr>)}</tbody><tfoot className="border-t-2 border-slate-200 bg-slate-50"><tr><td colSpan={2} className="px-5 py-4 text-sm font-bold text-slate-800">Tổng hai phía</td><td className="px-5 py-4 text-right text-sm font-bold text-emerald-700">{formatCurrency(journal.totalDebit)}</td><td className="px-5 py-4 text-right text-sm font-bold text-blue-700">{formatCurrency(journal.totalCredit)}</td></tr></tfoot></table></div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-base font-bold text-slate-900">Liên kết kiểm tra chéo</h2><p className="mt-1 text-xs text-slate-600">Mở hồ sơ nguồn hoặc giao dịch tiền tương ứng, sau đó quay lại bút toán này.</p></div>
      <div className="flex flex-wrap gap-2 p-5">
        {journal.requestId && <Link href={withLedgerReturnTo(`/accountant/ledger/sources/requests/${journal.requestId}`, currentDetail)} className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-800 hover:bg-violet-100">Yêu cầu nguồn #{journal.requestId} →</Link>}
        {journal.walletTransactionId && <Link href={withLedgerReturnTo(`/accountant/ledger/${journal.walletTransactionId}`, currentDetail)} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100">Giao dịch ví #{journal.walletTransactionId} →</Link>}
        {journal.advanceBalanceId && journal.employeeName && <Link href={`/accountant/ledger?tab=advances&search=${encodeURIComponent(journal.employeeName)}`} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-100">Tạm ứng của {journal.employeeName} →</Link>}
        {journal.originalJournalId && <Link href={withLedgerReturnTo(`/accountant/ledger/journals/${journal.originalJournalId}`, currentDetail)} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 hover:bg-blue-100">Bút toán gốc →</Link>}
        {journal.reversalJournalId && <Link href={withLedgerReturnTo(`/accountant/ledger/journals/${journal.reversalJournalId}`, currentDetail)} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 hover:bg-blue-100">Bút toán đảo →</Link>}
        {!hasRelatedLinks && <p className="text-sm text-slate-600">Bút toán này chưa có liên kết khác để mở trực tiếp.</p>}
      </div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 text-xs text-slate-600 shadow-sm"><h2 className="text-sm font-bold text-slate-900">Dấu vết ghi sổ</h2><p className="mt-2">Người tạo: <strong>{journal.createdByName || "Không có thông tin người tạo"}</strong> · Thời điểm tạo: <strong>{journal.createdAt ? formatDateTime(journal.createdAt) : "Không rõ (bút toán lịch sử)"}</strong></p></section>
    <JournalActions key={journal.id} journal={journal} />
  </div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</p></div>;
}

function SummaryCard({ label, value, note, tone }: { label: string; value: string; note: string; tone: "blue" | "slate" }) {
  return <div className={`rounded-2xl border p-4 shadow-sm ${tone === "blue" ? "border-blue-200 bg-blue-50/60" : "border-slate-200 bg-white"}`}><p className="text-xs text-slate-600">{label}</p><p className={`mt-1 text-xl font-bold ${tone === "blue" ? "text-blue-800" : "text-slate-900"}`}>{value}</p><p className="mt-2 text-xs text-slate-500">{note}</p></div>;
}
