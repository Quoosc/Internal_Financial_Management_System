"use client";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
type Candidate={id:number;label:string};
type Result={items:Candidate[];total:number;totalPages:number};
const field="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm";
export function BankCandidatePicker({endpoint,value,onChange,disabled=false,topup=false}:{endpoint:string;value:string;onChange:(id:string)=>void;disabled?:boolean;topup?:boolean}){
 const [search,setSearch]=useState("");const [from,setFrom]=useState("");const [to,setTo]=useState("");const [amount,setAmount]=useState("");const [page,setPage]=useState(1);
 const [result,setResult]=useState<Result|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [reload,setReload]=useState(0);const [selected,setSelected]=useState("");
 useEffect(()=>{setPage(1);setSelected("");},[endpoint]);
 useEffect(()=>{if(!value)setSelected("");},[value]);
 useEffect(()=>{let active=true;setLoading(true);setError("");setResult(null);const timer=setTimeout(()=>{
  const q=new URLSearchParams({page:String(page),limit:"20"});if(search.trim())q.set("search",search.trim());if(from)q.set("from",from);if(to)q.set("to",to);if(topup&&amount)q.set("amount",amount);
  api.get<Result>(`${endpoint}?${q}`).then(r=>{if(active)setResult(r.data);}).catch(e=>{if(active)setError(e instanceof ApiError?e.apiMessage:"Không tải được ứng viên đối chiếu.");}).finally(()=>{if(active)setLoading(false);});
 },250);return()=>{active=false;clearTimeout(timer);};},[endpoint,search,from,to,amount,page,reload,topup]);
 return <div className="space-y-3"><input aria-label="Tìm mã chứng từ hoặc giao dịch" placeholder="Tìm theo mã chứng từ / giao dịch" className={field} value={search} disabled={disabled} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>
 <div className="grid grid-cols-2 gap-2"><label className="text-xs text-slate-500">Từ ngày<input aria-label="Từ ngày ứng viên" type="date" className={field} value={from} disabled={disabled} onChange={e=>{setFrom(e.target.value);setPage(1);}}/></label><label className="text-xs text-slate-500">Đến ngày<input aria-label="Đến ngày ứng viên" type="date" className={field} value={to} disabled={disabled} onChange={e=>{setTo(e.target.value);setPage(1);}}/></label></div>
 {topup&&<input aria-label="Lọc đúng số tiền chứng từ" type="number" min="1" placeholder="Lọc đúng số tiền" className={field} disabled={disabled} value={amount} onChange={e=>{setAmount(e.target.value);setPage(1);}}/>}
 {value&&<p className="rounded-xl bg-blue-50 p-3 text-xs text-blue-800">Đã chọn: {selected||value}<button type="button" disabled={disabled} className="ml-3 underline" onClick={()=>onChange("")}>Bỏ chọn</button></p>}
 {loading?<p role="status" className="text-xs text-slate-500">Đang tải ứng viên…</p>:error?<div role="alert" className="text-sm text-rose-700">{error}<button type="button" className="ml-3 underline" onClick={()=>setReload(n=>n+1)}>Thử lại</button></div>:result&&<><div role="listbox" aria-label="Ứng viên đối chiếu" className="max-h-64 overflow-auto rounded-xl border border-slate-200">{result.items.length?result.items.map(row=><button type="button" role="option" aria-selected={String(row.id)===value} disabled={disabled} key={row.id} className="block w-full border-b border-slate-100 p-3 text-left text-sm hover:bg-blue-50 disabled:opacity-50" onClick={()=>{setSelected(row.label);onChange(String(row.id));}}>{row.label}</button>):<p className="p-3 text-xs text-slate-500">Không có ứng viên phù hợp với bộ lọc.</p>}</div><div className="flex justify-between text-xs text-slate-500"><span>{result.total} kết quả · Trang {page}/{Math.max(1,result.totalPages)}</span><div className="flex gap-3"><button type="button" disabled={disabled||page<=1} onClick={()=>setPage(n=>n-1)}>Trước</button><button type="button" disabled={disabled||page>=result.totalPages} onClick={()=>setPage(n=>n+1)}>Sau</button></div></div></>}
 </div>;
}
