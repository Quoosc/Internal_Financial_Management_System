"use client";
import { CurrencyInput } from "@/components/ui/currency-input";
import { formatCurrency } from "@/lib/format";
export type DocumentVerificationDraft = {
  fileId: number; fileName: string; issuerCode: string; documentNumber: string; documentDate: string;
  totalAmount: number | null; allocatedAmount: number | null;
};
export function validDocumentAllocation(documents: DocumentVerificationDraft[], amount: number) {
  const used = documents.filter(d => (d.allocatedAmount ?? 0) > 0);
  return used.length > 0 && used.every(d => d.issuerCode.trim() && d.documentNumber.trim() && d.documentDate &&
    d.totalAmount != null && d.totalAmount > 0 && d.allocatedAmount! <= d.totalAmount) &&
    Math.abs(used.reduce((sum, d) => sum + d.allocatedAmount!, 0) - amount) < 0.001;
}
export function verifiedDocumentPayload(documents: DocumentVerificationDraft[]) {
  return documents.filter(d => (d.allocatedAmount ?? 0) > 0).map(d => ({
    fileId: d.fileId, issuerCode: d.issuerCode.trim(), documentNumber: d.documentNumber.trim(),
    documentDate: d.documentDate, totalAmount: d.totalAmount!, allocatedAmount: d.allocatedAmount!,
  }));
}
export function FinancialDocumentEditor({ documents, amount, onChange }: {
  documents: DocumentVerificationDraft[]; amount: number; onChange: (documents: DocumentVerificationDraft[]) => void;
}) {
  const update = (index: number, values: Partial<DocumentVerificationDraft>) => onChange(documents.map((doc, i) => i === index ? { ...doc, ...values } : doc));
  return <section className="space-y-4 rounded-3xl border border-blue-200 bg-white p-5">
    <div><h2 className="text-lg font-semibold text-slate-900">Xác nhận số tiền trên chứng từ</h2><p className="mt-2 text-xs leading-5 text-slate-500">Nhập mã nhà cung cấp/MST, số và ngày chứng từ. Tổng số tiền sử dụng phải bằng {formatCurrency(amount)}. File chỉ để tham khảo có thể để trống số tiền sử dụng.</p></div>
    {documents.map((doc, index) => <div key={doc.fileId} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="break-words text-sm font-semibold text-slate-800">{doc.fileName}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {(["issuerCode", "documentNumber", "documentDate"] as const).map((key) => <label key={key} className="grid gap-1 text-xs text-slate-500">{key === "issuerCode" ? "Mã nhà cung cấp / MST" : key === "documentNumber" ? "Số chứng từ" : "Ngày chứng từ"}<input type={key === "documentDate" ? "date" : "text"} maxLength={100} value={doc[key]} onChange={e => update(index, { [key]: e.target.value })} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" /></label>)}
        <label className="grid gap-1 text-xs text-slate-500">Tổng tiền chứng từ<CurrencyInput value={doc.totalAmount} onChange={value => update(index, { totalAmount: value })} /></label>
        <label className="grid gap-1 text-xs text-slate-500">Số tiền dùng cho yêu cầu này<CurrencyInput value={doc.allocatedAmount} onChange={value => update(index, { allocatedAmount: value })} /></label>
      </div>
    </div>)}
    <p className={`text-xs font-semibold ${validDocumentAllocation(documents, amount) ? "text-emerald-700" : "text-amber-800"}`}>Đã phân bổ: {formatCurrency(documents.reduce((sum, doc) => sum + (doc.allocatedAmount ?? 0), 0))} / {formatCurrency(amount)}</p>
  </section>;
}
