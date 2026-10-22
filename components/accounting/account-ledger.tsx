"use client";
import { accountingEventLabels } from "@/lib/accounting-labels";

import Link from "next/link";
import { ReferencePicker } from "./reference-picker";
import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api-client";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

type Balance = { accountCode: string; accountName: string; normalSide: string; openingBalance: number; debitAmount: number; creditAmount: number; closingBalance: number };
type Entry = { journalId: number; journalCode: string; postingDate: string; description: string; employeeId: number | null; projectName: string | null; phaseName: string | null; categoryName: string | null; debitAmount: number; creditAmount: number };
type Ledger = { from: string; to: string; generatedAt: string; coverage: string; accounts: Balance[]; totalDebit: number; totalCredit: number; balanced: boolean; balanceBeforePage: number; entries: { items: Entry[]; total: number; totalPages: number } };
const inputClass = "h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

export default function AccountLedger() {
  const [ready,setReady]=useState(false);
  const [dimensions,setDimensions]=useState<Record<string,string>>({});
  const [event,setEvent]=useState("");
  const [account, setAccount] = useState("");
  const [options, setOptions] = useState<Balance[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Ledger | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  useEffect(()=>{
    const restore=()=>{const q=new URLSearchParams(window.location.search);setAccount(q.get("account")||"");setEvent(q.get("event")||"");setFrom(q.get("from")||"");setTo(q.get("to")||"");setPage(Math.max(1,Number(q.get("page"))||1));const dims:Record<string,string>={};for(const k of ["employeeId","projectId","departmentId","phaseId","categoryId"])dims[k]=q.get(k)||"";setDimensions(dims);setReady(true);};
    restore();window.addEventListener("popstate",restore);return()=>window.removeEventListener("popstate",restore);
  },[]);
  useEffect(()=>{if(!ready)return;const q=new URLSearchParams({page:String(page)});for(const [k,v] of Object.entries({account,event,from,to,...dimensions}))if(v)q.set(k,v);window.history.replaceState(window.history.state,"",`${window.location.pathname}?${q}`);},[ready,page,account,event,from,to,dimensions]);
  const exportParams=new URLSearchParams({dataset:"account-balances"});for(const [k,v] of Object.entries({account,event,from,to,...dimensions}))if(v)exportParams.set(k,v);
  useEffect(() => {
    if(!ready)return;
    let active = true;
    setLoading(true); setError(""); setData(null);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (account) params.set("account", account);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if(event)params.set("event",event);for(const [k,v] of Object.entries(dimensions))if(v)params.set(k,v);
    api.get<Ledger>(`/api/v1/accountant/ledger/accounts?${params}`)
      .then(res => { if (active) { setData(res.data); setOptions(previous=>!account||!previous.length?res.data.accounts:previous); } })
      .catch(err => { if (active) setError(err instanceof ApiError ? err.apiMessage : "Không tải được sổ tài khoản."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ready, account, event, dimensions, from, to, page, reload]);
  let running = data?.balanceBeforePage ?? 0;
  return <div className="space-y-5 pb-8">
    <Link href="/accountant/ledger?tab=journal" className="text-sm font-semibold text-blue-700">← Về nhật ký bút toán</Link>
    <header className="rounded-3xl bg-gradient-to-r from-blue-700 to-indigo-700 p-6 text-white shadow-lg sm:p-8">
      <p className="text-xs font-bold uppercase tracking-widest text-blue-100">Kế toán · tài khoản nội bộ IFMS</p>
      <h1 className="mt-2 text-3xl font-bold">Sổ theo tài khoản</h1>
      <p className="mt-2 text-sm text-blue-100">Xem số đầu kỳ, phát sinh và cuối kỳ; chọn tài khoản để truy từng bút toán.</p>
    </header>
    <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3">
      <label className="grid gap-1 text-xs text-slate-500">Tài khoản<select className={inputClass} value={account} onChange={e => { setAccount(e.target.value); setPage(1); }}><option value="">Bảng đối chiếu tất cả tài khoản</option>{options.map(a => <option key={a.accountCode} value={a.accountCode}>{a.accountName}</option>)}</select></label>
      <label className="grid gap-1 text-xs text-slate-500">Từ ngày<input type="date" className={inputClass} value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} /></label>
      <label className="grid gap-1 text-xs text-slate-500">Đến ngày<input type="date" className={inputClass} value={to} onChange={e => { setTo(e.target.value); setPage(1); }} /></label>
    </section>
    <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-3"><label className="grid gap-1 text-xs text-slate-500">Nghiệp vụ<select className={inputClass} value={event} onChange={e=>{setEvent(e.target.value);setPage(1);}}><option value="">Tất cả nghiệp vụ</option>{["ADVANCE_DISBURSED","EXPENSE_VERIFIED","EXPENSE_PAID","REIMBURSE_SETTLED","ADVANCE_RETURNED","PAYROLL_SETTLEMENT","SYSTEM_TOPUP","DEPARTMENT_ALLOCATION","PROJECT_ALLOCATION","REVERSAL","OPENING_BALANCE"].map(v=><option key={v} value={v}>{accountingEventLabels[v]||v}</option>)}</select></label>{["employeeId","projectId","departmentId","phaseId","categoryId"].map(key=><ReferencePicker key={key} kind={key.replace("Id","")} label={({employeeId:"Nhân viên",projectId:"Dự án",departmentId:"Phòng ban",phaseId:"Giai đoạn",categoryId:"Danh mục"} as Record<string,string>)[key]} value={dimensions[key]||""} parent={key==="phaseId"?dimensions.projectId:key==="categoryId"?dimensions.phaseId:undefined} onChange={v=>{setDimensions(old=>{const next={...old,[key]:v};if(key==="projectId"){next.phaseId="";next.categoryId="";}if(key==="phaseId")next.categoryId="";return next;});setPage(1);}}/>)}<Link href={`/data-exchange?${exportParams}`} className="self-end rounded-xl bg-blue-600 p-3 text-center text-sm font-semibold text-white">Xuất Excel cùng bộ lọc</Link></section>
    <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">Số dư được tính từ các bút toán đã ghi trong IFMS. Khi lọc nghiệp vụ hoặc đối tượng, số dư chỉ phản ánh các bút toán trong phạm vi đó. Lịch sử chưa có chứng từ hoặc chưa mở sổ không được tự bổ sung. Số âm là số dư bên đối ứng; hai cột ghi sổ không đồng nghĩa tiền vào / tiền ra.</p>
    {loading ? <p className="rounded-2xl bg-white p-12 text-center text-sm text-slate-500">Đang tải sổ tài khoản…</p> : error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{error}<button className="ml-4 font-semibold underline" onClick={() => setReload(n => n + 1)}>Thử lại</button></div> : data && <>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500"><span>{formatDate(data.from)} – {formatDate(data.to)} · Chốt dữ liệu {formatDateTime(data.generatedAt)}</span><span>{!account && (Object.values(dimensions).some(Boolean) ? "Tổng phát sinh trong phạm vi lọc; xem bút toán đầy đủ để kiểm tra cân bằng" : data.balanced ? "Tổng hai phía cân bằng" : "Tổng hai phía chưa cân bằng")}</span></div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm">
        <thead className="bg-blue-50 text-xs text-slate-500"><tr>{["Tài khoản", "Đầu kỳ", "Phát sinh ghi nhận", "Phát sinh đối ứng", "Cuối kỳ"].map(label => <th key={label} className="px-5 py-3">{label}</th>)}</tr></thead>
        <tbody>{data.accounts.map(a => <tr key={a.accountCode} className="border-t border-slate-100"><td className="px-5 py-4"><button className="font-semibold text-blue-700 hover:underline" onClick={() => { setAccount(a.accountCode); setPage(1); }}>{a.accountName}</button><p className="mt-1 font-mono text-[10px] text-slate-400">{a.accountCode}</p></td>{[a.openingBalance, a.debitAmount, a.creditAmount, a.closingBalance].map((value, i) => <td key={i} className="px-5 py-4 tabular-nums">{formatCurrency(value)}</td>)}</tr>)}</tbody>
      </table></div></section>
      {account && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 p-5 font-bold text-slate-900">Chi tiết phát sinh · {data.entries.total} dòng</h2>
        <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["Ngày / bút toán", "Diễn giải / phạm vi", "Ghi nhận", "Đối ứng", "Số dư"].map(label => <th key={label} className="px-5 py-3">{label}</th>)}</tr></thead>
          <tbody>{data.entries.items.length === 0 ? <tr><td colSpan={5} className="p-10 text-center text-slate-500">Không có phát sinh trong khoảng ngày đã chọn.</td></tr> : data.entries.items.map((entry, index) => {
            running += entry.debitAmount - entry.creditAmount;
            return <tr key={`${entry.journalId}-${index}`} className="border-t border-slate-100"><td className="px-5 py-4"><Link href={`/accountant/ledger/journals/${entry.journalId}`} className="font-mono text-xs font-semibold text-blue-700">{entry.journalCode}</Link><p className="mt-1 text-xs text-slate-500">{formatDate(entry.postingDate)}</p></td><td className="px-5 py-4 text-xs text-slate-600">{entry.description}<p className="mt-1 text-slate-400">{[entry.projectName, entry.phaseName, entry.categoryName].filter(Boolean).join(" · ") || "Không gắn dự án"}</p></td><td className="px-5 py-4">{formatCurrency(entry.debitAmount)}</td><td className="px-5 py-4">{formatCurrency(entry.creditAmount)}</td><td className="px-5 py-4 font-semibold">{formatCurrency(running)}</td></tr>;
          })}</tbody></table></div>
        <div className="flex justify-between border-t border-slate-100 p-4 text-xs"><span>Trang {page}/{Math.max(1, data.entries.totalPages)}</span><div className="flex gap-3"><button disabled={page <= 1} className="text-blue-700 disabled:opacity-40" onClick={() => setPage(n => n - 1)}>Trước</button><button disabled={page >= data.entries.totalPages} className="text-blue-700 disabled:opacity-40" onClick={() => setPage(n => n + 1)}>Sau</button></div></div>
      </section>}
    </>}
  </div>;
}
