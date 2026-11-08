"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/format";
import { safeLedgerReturnTo } from "@/lib/ledger-navigation";
type Source = { approvedAmount?:number; requestCode: string; type: string; status: string; businessDate: string; employeeName: string; departmentName: string | null; projectName: string | null; phaseName: string | null; categoryName: string | null; description: string | null; documents: { id: number; name: string; url: string }[] };
const typeLabels:Record<string,string>={ADVANCE:"Tạm ứng",EXPENSE:"Chi phí nhân viên tự chi",REIMBURSE:"Quyết toán tạm ứng",PROJECT_TOPUP:"Cấp vốn dự án",DEPARTMENT_TOPUP:"Cấp ngân sách phòng ban"};
const statusLabels:Record<string,string>={PENDING:"Chờ duyệt",APPROVED_BY_TEAM_LEADER:"Trưởng nhóm đã duyệt",ACCOUNTANT_VERIFIED:"Kế toán đã xác nhận chứng từ",APPROVED_BY_MANAGER:"Quản lý đã duyệt",APPROVED_BY_CFO:"Giám đốc tài chính đã duyệt",PAID:"Đã thanh toán",REJECTED:"Đã từ chối",REVERSED:"Đã đảo",CANCELLED:"Đã hủy"};
export default function SourceRequestPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const [data, setData] = useState<Source | null>(null);
  const [error, setError] = useState("");
  const [reload,setReload]=useState(0);
  const [returnTo, setReturnTo] = useState("/accountant/ledger?tab=journal&page=1");
  useEffect(() => {
    setReturnTo(safeLedgerReturnTo(new URLSearchParams(window.location.search).get("returnTo"), "/accountant/ledger?tab=journal&page=1"));
  }, []);
  useEffect(() => {
    let active = true;
    setData(null); setError("");
    api.get<Source>(`/api/v1/accountant/ledger/sources/requests/${requestId}`)
      .then(res => { if (active) setData(res.data); })
      .catch(err => { if (active) setError(err instanceof ApiError ? err.apiMessage : "Không tải được hồ sơ nguồn."); });
    return () => { active = false; };
  }, [requestId,reload]);
  return <div className="mx-auto w-full max-w-6xl space-y-5 pb-8">
    <Link href={returnTo} className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">← Quay lại màn hình trước</Link>
    <header className="rounded-3xl bg-gradient-to-r from-blue-700 to-indigo-700 p-7 text-white"><p className="text-xs uppercase tracking-widest text-blue-100">Hồ sơ nguồn · chỉ xem</p><h1 className="mt-2 text-2xl font-bold">{data?.requestCode || "Yêu cầu nghiệp vụ"}</h1></header>
    {error ? <p role="alert" className="rounded-xl bg-rose-50 p-5 text-rose-800">{error}<button className="ml-3 underline" onClick={()=>setReload(n=>n+1)}>Thử lại</button></p> : !data ? <p className="p-10 text-center text-slate-500">Đang tải hồ sơ…</p> : <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Object.entries({ "Số tiền được duyệt": typeof data.approvedAmount==="number"&&Number.isFinite(data.approvedAmount)?formatCurrency(data.approvedAmount):"—", "Nhân viên": data.employeeName, "Phòng ban": data.departmentName, "Dự án": data.projectName, "Giai đoạn": data.phaseName, "Danh mục": data.categoryName, "Ngày gửi": formatDate(data.businessDate), "Loại yêu cầu": typeLabels[data.type]||data.type, "Trạng thái hiện tại": statusLabels[data.status]||data.status }).map(([label, value]) => <div key={label}><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-slate-800">{value || "—"}</p></div>)}</div>
      <p className="my-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">{data.description || "Không có mô tả"}</p>
      <Link href={`/accountant/ledger?tab=journal&requestId=${requestId}`} className="mb-5 inline-flex rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">Xem các bút toán của yêu cầu</Link><h2 className="font-semibold text-slate-900">Chứng từ đính kèm</h2>
      {data.documents.length === 0 ? <p className="mt-2 text-sm text-slate-500">Không có chứng từ đính kèm.</p> : <ul className="mt-3 space-y-2">{data.documents.map(doc => <li key={doc.id}><a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-700 underline">{doc.name}</a></li>)}</ul>}
    </section>}
  </div>;
}
