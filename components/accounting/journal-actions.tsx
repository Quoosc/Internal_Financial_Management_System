"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { AccountingJournalDetail } from "@/types";
import { SideDrawer } from "@/components/ui/side-drawer";
import { CurrencyInput } from "@/components/ui/currency-input";
import { formatCurrency } from "@/lib/format";

export function JournalActions({ journal }: { journal: AccountingJournalDetail }) {
  const router = useRouter();
  const [open, setOpen] = useState<"reverse" | "replace" | null>(null);
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [date, setDate] = useState(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date()));
  const [bankLines, setBankLines] = useState<{ id: number; bankReference: string; direction: string; amount: number; state: string; matchingStatus: string }[]>([]);
  const [bankId, setBankId] = useState("");
  const [evidence, setEvidence] = useState("");
  const [salary, setSalary] = useState<Record<"baseSalary" | "bonus" | "allowance" | "deduction", number | null>>({ baseSalary: null, bonus: null, allowance: null, deduction: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (journal.eventType === "REVERSAL" || journal.eventType === "OPENING_BALANCE") return null;
  const start = async (mode: "reverse" | "replace") => {
    setOpen(mode); setReason(""); setPin(""); setError(""); setBankId(""); setEvidence("");
    if (mode === "replace") {
      try {
        const source = JSON.parse(journal.sourceSnapshot || "{}") as Record<string, unknown>;
        setSalary({ baseSalary: typeof source.baseSalary === "number" ? source.baseSalary : null, bonus: typeof source.bonus === "number" ? source.bonus : null,
          allowance: typeof source.allowance === "number" ? source.allowance : null, deduction: typeof source.deduction === "number" ? source.deduction : null });
      } catch { setError("Nguồn lịch sử thiếu số liệu lương. Cần đối chiếu phiếu lương gốc."); }
    }
    if (journal.eventType === "SYSTEM_TOPUP") {
      try { setBankLines((await api.get<typeof bankLines>("/api/v1/accountant/ledger/bank-evidence")).data); }
      catch (err) { setError(err instanceof ApiError ? err.apiMessage : "Không tải được chứng cứ ngân hàng."); }
    }
  };
  const submit = async () => {
    if (reason.trim().length < 10 || !pin || (open === "replace" && (!evidence.trim() || Object.values(salary).some(value => value == null)))) {
      setError("Nhập lý do tối thiểu 10 ký tự, PIN và đầy đủ căn cứ/số liệu cần điều chỉnh."); return;
    }
    setBusy(true); setError("");
    try {
      if (open === "replace") {
        await api.post<number>(`/api/v1/accountant/ledger/journals/${journal.id}/replace-payslip`, { ...salary, reason: reason.trim(), pin, evidenceRef: evidence.trim() });
        router.push(`/accountant/ledger?tab=journal&employeeId=${journal.employeeId || ""}`);
      } else {
        const response = await api.post<AccountingJournalDetail[]>(`/api/v1/accountant/ledger/journals/${journal.id}/reverse`, {
          reason: reason.trim(), pin, postingDate: date, bankEvidenceId: bankId ? Number(bankId) : undefined,
        });
        router.push(`/accountant/ledger/journals/${response.data[0].id}`);
      }
      setOpen(null); router.refresh();
    } catch (err) { setError(err instanceof ApiError ? err.apiMessage : "Không thực hiện được điều chỉnh."); }
    finally { setBusy(false); }
  };
  return <>
    <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void start("reverse")} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700">Đảo toàn phần nghiệp vụ</button>
      {journal.eventType === "PAYROLL_SETTLEMENT" && <button type="button" onClick={() => void start("replace")} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700">Điều chỉnh phiếu lương</button>}
    </div>
    <SideDrawer open={open !== null} title={open === "replace" ? "Đảo và thay thế phiếu lương" : "Đảo toàn phần nghiệp vụ"} onClose={() => { if (!busy) setOpen(null); }}
      description="Hệ thống tạo hồ sơ đảo liên kết với bản gốc và cập nhật tiền, công nợ, ngân sách tương ứng trong cùng thao tác."
      footer={<button disabled={busy} onClick={() => void submit()} className="w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Đang xử lý…" : "Xác nhận thực hiện"}</button>}>
      <div className="space-y-4">
        <p className="rounded-xl bg-amber-50 p-4 text-xs leading-5 text-amber-900">{journal.journalCode} · {formatCurrency(journal.totalAmount)}. Khoản đã chuyển tới nhân viên chỉ đảo được khi có đủ tiền khả dụng để hoàn lại. EXPENSE đã trả sẽ đảo cả thanh toán và chi phí. Các nghiệp vụ phụ thuộc phải được xử lý trước.</p>
        {open === "replace" ? <><div className="grid gap-3 sm:grid-cols-2">{(["baseSalary", "bonus", "allowance", "deduction"] as const).map(key => <label key={key} className="grid gap-1 text-xs text-slate-500">{{ baseSalary: "Lương cơ bản", bonus: "Thưởng", allowance: "Phụ cấp", deduction: "Khấu trừ khác" }[key]}<CurrencyInput value={salary[key]} onChange={value => setSalary(previous => ({ ...previous, [key]: value }))} /></label>)}</div><label className="grid gap-1 text-xs text-slate-500">Mã / tài liệu điều chỉnh<input value={evidence} onChange={e => setEvidence(e.target.value)} className="rounded-xl border border-slate-200 p-3 text-sm" /></label><p className="text-xs text-slate-500">Phiếu cũ giữ nguyên số liệu và chuyển trạng thái đã đảo. Phiếu thay thế tính lại khấu trừ tạm ứng theo FIFO và giới hạn hiện tại.</p></> : <label className="grid gap-1 text-xs text-slate-500">Ngày ghi bút toán đảo<input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-xl border border-slate-200 p-3 text-sm" /></label>}
        {journal.eventType === "SYSTEM_TOPUP" && <label className="grid gap-1 text-xs text-slate-500">Chứng cứ tiền đã trả ra ngân hàng<select value={bankId} onChange={e => setBankId(e.target.value)} className="rounded-xl border border-slate-200 p-3 text-sm"><option value="">Chọn dòng sao kê OUT đã ghi nhận</option>{bankLines.filter(line => line.direction === "OUT" && line.state === "BOOKED" && line.matchingStatus === "UNMATCHED" && line.amount === journal.totalAmount).map(line => <option key={line.id} value={line.id}>{line.bankReference} · {formatCurrency(line.amount)}</option>)}</select></label>}
        <label className="grid gap-1 text-xs text-slate-500">Lý do<textarea maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} className="min-h-24 rounded-xl border border-slate-200 p-3 text-sm" /></label>
        <label className="grid gap-1 text-xs text-slate-500">PIN giao dịch<input type="password" inputMode="numeric" autoComplete="off" maxLength={5} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} className="rounded-xl border border-slate-200 p-3 text-sm" /></label>
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}
      </div>
    </SideDrawer>
  </>;
}
