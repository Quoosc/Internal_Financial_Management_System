"use client";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { RoleName } from "@/types";
import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api-client";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { CompanyFundResponse, ReconciliationReportResponse } from "@/types";
import { SideDrawer } from "@/components/ui/side-drawer";
type BankLine = { id: number; bankReference: string; bookingDate: string; direction: string; amount: number; state: string; transactionId: number | null; matchingStatus: string };
type Candidate = { id: number; code: string; type: string; signedAmount: number; createdAt: string };
const field = "w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-blue-400";
export default function BankReconciliation() {
  const { hasAnyRole } = useAuth();
  const [fund, setFund] = useState<CompanyFundResponse | null>(null);
  const [report, setReport] = useState<ReconciliationReportResponse | null>(null);
  const [lines, setLines] = useState<BankLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [account, setAccount] = useState("");
  const [name, setName] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<BankLine | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [transaction, setTransaction] = useState("");
  const [reason, setReason] = useState("");
  const [matchError, setMatchError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  useEffect(() => {
    let active = true; setLoading(true); setError(""); setLines([]); setFund(null); setReport(null);
    const load = async () => {
      try {
        const [fundResult, reportResult] = await Promise.all([api.get<CompanyFundResponse>("/api/v1/company-fund"), api.get<ReconciliationReportResponse>("/api/v1/company-fund/reconciliation")]);
        if (!active) return;
        setFund(fundResult.data); setReport(reportResult.data); setAccount(fundResult.data.bankAccount || ""); setName(fundResult.data.bankName || "");
        if (fundResult.data.bankAccount) {
          const query = new URLSearchParams(); if (from) query.set("from", from); if (to) query.set("to", to);
          const result = await api.get<BankLine[]>(`/api/v1/accountant/ledger/bank-evidence?${query}`); if (active) setLines(result.data);
        }
      } catch (err) { if (active) setError(err instanceof ApiError ? err.apiMessage : "Không tải được báo cáo đối soát."); }
      finally { if (active) setLoading(false); }
    };
    void load(); return () => { active = false; };
  }, [reload, from, to]);
  const configure = async () => {
    setBusy(true); setError("");
    try { await api.post("/api/v1/accountant/ledger/bank-evidence/account", { account, bankName: name, evidenceRef: evidence, purpose: "CORPORATE_OPERATING_POOL" }); setEvidence(""); setReload(n => n + 1); }
    catch (err) { setError(err instanceof ApiError ? err.apiMessage : "Không lưu được phạm vi ngân hàng."); } finally { setBusy(false); }
  };
  const startMatch = async (line: BankLine) => {
    setSelected(line); setCandidates([]); setTransaction(""); setReason(""); setMatchError(""); setBusy(true);
    try { setCandidates((await api.get<Candidate[]>(`/api/v1/accountant/ledger/bank-evidence/${line.id}/candidates`)).data); }
    catch (err) { setMatchError(err instanceof ApiError ? err.apiMessage : "Không tải được giao dịch để đối chiếu."); } finally { setBusy(false); }
  };
  const match = async () => {
    if (!selected || !transaction || !reason.trim()) return;
    setBusy(true); setMatchError("");
    try { await api.post(`/api/v1/accountant/ledger/bank-evidence/${selected.id}/match`, { transactionId: Number(transaction), reason: reason.trim() }); setSelected(null); setReload(n => n + 1); }
    catch (err) { setMatchError(err instanceof ApiError ? err.apiMessage : "Không ghi nhận được đối chiếu."); } finally { setBusy(false); }
  };
  return <div className="space-y-5 pb-8"><header className="rounded-3xl bg-gradient-to-r from-blue-700 to-indigo-700 p-7 text-white"><p className="text-xs uppercase tracking-widest text-blue-100">IFMS · chứng cứ ngân hàng</p><h1 className="mt-2 text-3xl font-bold">Đối soát ngân hàng</h1><p className="mt-2 text-sm leading-6 text-blue-100">Tiền vận hành công ty = quỹ công ty + ví phòng ban + ví dự án. Ví USER được theo dõi riêng.</p></header>
    <div className="flex flex-wrap gap-3"><Link href="/data-exchange?dataset=bank-statements" className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white">Nhập / xuất sao kê Excel</Link><Link href={hasAnyRole([RoleName.CFO]) ? "/cfo/system-fund" : "/accountant/system-fund"} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-blue-700">Quỹ và số dư chốt sao kê</Link></div>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    {loading ? <p className="p-10 text-center text-slate-500">Đang tải đối soát…</p> : <>
      {!fund?.bankScopeConfirmed && <section className="space-y-4 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-900">Xác nhận phạm vi tài khoản</h2><p className="text-xs leading-5 text-slate-500">Chọn tài khoản thực sự nắm giữ tiền vận hành của IFMS. Đây là căn cứ để so sánh số dư, không tự thay đổi tiền ví.</p><div className="grid gap-3 sm:grid-cols-2"><input className={field} placeholder="Số tài khoản công ty" aria-label="Số tài khoản công ty" value={account} onChange={e => setAccount(e.target.value)} /><input className={field} placeholder="Tên ngân hàng" aria-label="Tên ngân hàng" value={name} onChange={e => setName(e.target.value)} /><input className={field} placeholder="Tài liệu xác nhận tài khoản và phạm vi tiền" aria-label="Căn cứ tài khoản" value={evidence} onChange={e => setEvidence(e.target.value)} /></div><button disabled={busy || !account.trim() || !name.trim() || !evidence.trim()} onClick={() => void configure()} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">Xác nhận tài khoản tiền vận hành công ty</button></section>}
      {report && <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-900">{fund?.bankName} · {fund?.bankAccount || "Chưa cấu hình"}</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
        ["Tiền công ty tại thời điểm chốt", report.corporateBalanceAtStatement],
        ["Biến động IFMS đang chuyển", report.pendingCorporateAmount],
        ["Số dư ngân hàng đã khai báo", report.statementAsOf ? report.externalBankBalance : null],
        ["Chênh lệch sau khoản đang chuyển", report.bankDiscrepancy],
      ].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-lg font-bold text-slate-900">{typeof value === "number" ? formatCurrency(value) : "Chưa đủ căn cứ"}</p></div>)}</div><p className="text-xs text-slate-500">Thời điểm chốt: {formatDateTime(report.statementAsOf)} · Căn cứ: {report.statementEvidenceRef || "Chưa có"}</p><p className="text-xs text-slate-500">Kiểm tra tổng ví: {report.systemIntegrityValid ? "Khớp FLOAT_MAIN" : "Có chênh lệch với FLOAT_MAIN"}. Đây là kiểm tra nội bộ, độc lập với ngân hàng.</p></section>}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><h2 className="font-bold text-slate-900">Dòng sao kê và kết quả đối chiếu</h2><div className="flex gap-2"><input aria-label="Từ ngày sao kê" type="date" className={field} value={from} onChange={e => setFrom(e.target.value)} /><input aria-label="Đến ngày sao kê" type="date" className={field} value={to} onChange={e => setTo(e.target.value)} /></div></div><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-blue-50 text-xs text-slate-500"><tr>{["Ngày / mã ngân hàng", "Chiều", "Số tiền", "Ngân hàng", "Đối chiếu", "Thao tác"].map(label => <th className="px-5 py-3" key={label}>{label}</th>)}</tr></thead><tbody>{lines.length === 0 ? <tr><td colSpan={6} className="p-10 text-center text-slate-500">Chưa có dòng sao kê trong khoảng đã chọn.</td></tr> : lines.map(line => <tr key={line.id} className="border-t border-slate-100"><td className="px-5 py-4 font-mono text-xs text-blue-700">{line.bankReference}<p className="mt-1 text-slate-500">{formatDate(line.bookingDate)}</p></td><td className="px-5 py-4">{line.direction === "IN" ? "Tiền vào" : "Tiền ra"}</td><td className="px-5 py-4 font-semibold">{formatCurrency(line.amount)}</td><td className="px-5 py-4">{line.state === "BOOKED" ? "Đã ghi nhận" : "Đang xử lý"}</td><td className="px-5 py-4">{line.matchingStatus === "MATCHED" ? "Đã khớp" : line.matchingStatus === "IN_TRANSIT" ? "Khớp, đang chuyển" : "Chưa khớp"}</td><td className="px-5 py-4">{!line.transactionId && <button className="text-xs font-semibold text-blue-700" onClick={() => void startMatch(line)}>Đối chiếu</button>}</td></tr>)}</tbody></table></div></section>
    </>}
    <SideDrawer open={!!selected} title="Xác nhận đối chiếu" description={selected?.bankReference} onClose={() => { if (!busy) setSelected(null); }} footer={<button disabled={busy || !transaction || !reason.trim()} className="w-full rounded-xl bg-blue-600 p-3 text-sm font-semibold text-white disabled:opacity-40" onClick={() => void match()}>Xác nhận khớp</button>}><div className="space-y-4"><p className="text-xs leading-5 text-slate-500">Danh sách gợi ý cùng số tiền và chiều tiền. Kiểm tra mã nguồn và chứng từ trước khi xác nhận; hệ thống không tự chọn thay bạn.</p><select className={field} value={transaction} onChange={e => setTransaction(e.target.value)}><option value="">Chọn giao dịch IFMS đã kiểm tra</option>{candidates.map(c => <option key={c.id} value={c.id}>{c.code} · {formatCurrency(c.signedAmount)} · {formatDateTime(c.createdAt)}</option>)}</select><textarea className={field} value={reason} onChange={e => setReason(e.target.value)} placeholder="Căn cứ đối chiếu mã chuyển khoản / chứng từ" />{matchError && <p role="alert" className="text-xs text-rose-700">{matchError}</p>}</div></SideDrawer>
  </div>;
}
