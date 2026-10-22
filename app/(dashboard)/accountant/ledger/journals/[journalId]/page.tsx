"use client";

import { JournalActions } from "@/components/accounting/journal-actions";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api-client";

import { formatCurrency, formatDateTime, formatDate } from "@/lib/format";
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
  const params = useParams<{ journalId: string }>();
  const router = useRouter();
  const [error,setError]=useState("");
  const [reload,setReload]=useState(0);
  const [journal, setJournal] = useState<AccountingJournalDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);setJournal(null);setError("");
    api.get<AccountingJournalDetail>(`/api/v1/accountant/ledger/journals/${params.journalId}`)
      .then((response) => { if (active) setJournal(response.data); })
      .catch((error) => { if (active) setError(error instanceof ApiError && error.status===404 ? "Không tìm thấy bút toán." : error instanceof ApiError ? error.apiMessage : "Không tải được chi tiết bút toán."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params.journalId, reload]);

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Đang tải bút toán…</div>;
  if(error)return <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-800">{error}<button className="ml-4 underline" onClick={()=>setReload(n=>n+1)}>Thử lại</button></div>;
  if (!journal) return <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-8 text-center"><p className="text-sm text-slate-600">Không tìm thấy bút toán.</p><Link href="/accountant/ledger" className="text-sm font-semibold text-blue-700">Quay lại sổ cái</Link></div>;

  return <div className="space-y-5 pb-8">
    <div className="flex items-center justify-between"><div className="text-xs text-slate-500"><Link href="/accountant/ledger" className="hover:text-blue-700">Sổ cái</Link><span className="mx-2">/</span>Chi tiết bút toán</div><button type="button" onClick={() => router.back()} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Quay lại</button></div>
    <section className="rounded-3xl bg-gradient-to-r from-blue-700 to-indigo-700 p-6 text-white shadow-lg sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-100">Sổ cái kế toán · Chi tiết</p><div className="mt-2 flex flex-wrap items-center justify-between gap-4"><div><h1 className="font-mono text-2xl font-bold">{journal.journalCode}</h1><p className="mt-2 text-sm text-blue-100">{labels[journal.eventType]} · ghi sổ {formatDate(journal.postingDate)} · kỳ {journal.postingPeriod}</p></div><span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${journal.balanced ? "border-emerald-200/50 bg-emerald-300/20 text-emerald-50" : "border-rose-200/50 bg-rose-300/20 text-rose-50"}`}>{journal.balanced ? "Bút toán cân bằng" : "Cần kiểm tra"}</span></div></section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Info label="Nghiệp vụ" value={labels[journal.eventType]} /><Info label="Nhân viên" value={journal.employeeName || "—"} /><Info label="Dự án" value={journal.projectName || "—"} /><Info label="Tham chiếu" value={`${journal.sourceType} · ${journal.sourceId}`} /></div><p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{journal.description}</p><p className="mt-3 text-xs text-slate-500">Người tạo: <span className="font-medium text-slate-700">{journal.createdByName || "Không có thông tin người tạo"}</span> · Thời điểm tạo: <span className="font-medium text-slate-700">{journal.createdAt ? formatDateTime(journal.createdAt) : "Không rõ (bút toán lịch sử)"}</span></p><div className="mt-4 flex flex-wrap gap-2">{journal.requestId && <Link className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700" href={`/accountant/ledger/sources/requests/${journal.requestId}`}>Mở yêu cầu #{journal.requestId}</Link>}{journal.walletTransactionId && <Link className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700" href={`/accountant/ledger/${journal.walletTransactionId}`}>Mở giao dịch ví #{journal.walletTransactionId}</Link>}</div></section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-900">Các tài khoản bị ảnh hưởng</h2><p className="mt-1 text-xs text-slate-500">Mỗi dòng giải thích tài khoản nào thay đổi và vì sao. Tổng hai phía phải bằng nhau.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="bg-blue-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Tài khoản</th><th className="px-5 py-3">Tác động</th><th className="px-5 py-3 text-right">Ghi nhận</th><th className="px-5 py-3 text-right">Đối ứng</th></tr></thead><tbody>{journal.lines.map((line) => <tr key={line.id} className="border-t border-slate-100"><td className="px-5 py-4"><p className="text-sm font-semibold text-slate-900">{line.accountName}</p><p className="mt-1 font-mono text-[11px] text-slate-400">{line.accountCode}</p></td><td className="px-5 py-4 text-xs leading-5 text-slate-600">{line.effectDescription}</td><td className="px-5 py-4 text-right text-sm font-semibold text-slate-900">{line.debitAmount > 0 ? formatCurrency(line.debitAmount) : "—"}</td><td className="px-5 py-4 text-right text-sm font-semibold text-slate-900">{line.creditAmount > 0 ? formatCurrency(line.creditAmount) : "—"}</td></tr>)}</tbody><tfoot className="border-t-2 border-slate-200 bg-slate-50"><tr><td colSpan={2} className="px-5 py-3 text-sm font-bold text-slate-700">Tổng bút toán</td><td className="px-5 py-3 text-right text-sm font-bold text-slate-900">{formatCurrency(journal.totalDebit)}</td><td className="px-5 py-3 text-right text-sm font-bold text-slate-900">{formatCurrency(journal.totalCredit)}</td></tr></tfoot></table></div></section>

    {journal.originalJournalId && <Link href={`/accountant/ledger/journals/${journal.originalJournalId}`} className="inline-flex rounded-xl border border-blue-200 bg-white px-4 py-3 text-xs font-semibold text-blue-700">Mở bút toán gốc</Link>}
    <JournalActions journal={journal} />
    <p className="px-1 text-xs leading-5 text-slate-500">Ngày ghi sổ: {formatDate(journal.postingDate)} · Kỳ kế toán: {journal.postingPeriod}</p>
  </div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-slate-800">{value}</p></div>;
}
