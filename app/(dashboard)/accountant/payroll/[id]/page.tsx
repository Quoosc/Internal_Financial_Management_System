"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { ApiError, api, downloadFile } from "@/lib/api-client";
import { useToast } from "@/contexts/toast-context";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  AutoNettingResponse,
  PayrollDetailResponse,
  PayrollEntry,
  PayrollImportResponse,
  PayrollRunResponse,
  PayrollStatus,
  PayslipStatus,
  UpdatePayslipEntryBody,
} from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}


function getStatusLabel(status: PayrollStatus): string {
  if (status === PayrollStatus.DRAFT) return "Đang chuẩn bị";
  if (status === PayrollStatus.PROCESSING) return "Đang chi lương";
  return "Đã hoàn tất";
}

function sumNet(entries: PayrollEntry[]): number {
  return entries.reduce((sum, e) => sum + e.finalNetSalary, 0);
}

function recalcNet(entry: Pick<PayrollEntry, "baseSalary" | "bonus" | "allowance" | "deduction" | "advanceDeduct">): number {
  return Math.max(0, entry.baseSalary + entry.bonus + entry.allowance - entry.deduction - entry.advanceDeduct);
}

function getStepDescription(step: 1 | 2 | 3 | 4): string {
  switch (step) {
    case 1:
      return "Tải file mẫu, điền dữ liệu lương và nhập lại file Excel vào kỳ lương.";
    case 2:
      return "Kiểm tra từng nhân viên, chỉnh sửa số tiền trước khi chốt.";
    case 3:
      return "Tự động trừ các khoản tạm ứng còn tồn của nhân viên.";
    case 4:
      return "Xác nhận chuyển tiền lương vào ví nhân viên.";
  }
}

export default function AccountantPayrollDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const toast = useToast();

  const [period, setPeriod] = useState<PayrollDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [importResult, setImportResult] = useState<PayrollImportResponse | null>(null);
  const [nettingResult, setNettingResult] = useState<AutoNettingResponse | null>(null);
  const [runResult, setRunResult] = useState<PayrollRunResponse | null>(null);

  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [uploading, setUploading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [netting, setNetting] = useState(false);
  const [running, setRunning] = useState(false);
  const [showRunConfirm, setShowRunConfirm] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    message: string;
    onConfirm: () => void;
  }>({ open: false, message: "", onConfirm: () => {} });

  const [editingEntry, setEditingEntry] = useState<PayrollEntry | null>(null);
  const [baseSalary, setBaseSalary] = useState<number | null>(0);
  const [bonus, setBonus] = useState<number | null>(0);
  const [allowance, setAllowance] = useState<number | null>(0);
  const [deduction, setDeduction] = useState<number | null>(0);
  const [advanceDeduct, setAdvanceDeduct] = useState<number | null>(0);
  const [entryError, setEntryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get<PayrollDetailResponse>(`/api/v1/accountant/payroll/${id}`);
        if (cancelled) return;
        setPeriod(res.data);
        setActiveStep(res.data.status === PayrollStatus.COMPLETED ? 4 : res.data.entries.length > 0 ? 2 : 1);
      } catch (err) {
        if (cancelled) return;
        setPeriod(null);
        toast.error(err instanceof ApiError ? err.apiMessage : "Không thể tải dữ liệu kỳ lương.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [id, toast]);

  const hasEntries = (period?.entries.length ?? 0) > 0;
  const hasNetting = period?.nettingApplied === true;
  const isCompleted = period?.status === PayrollStatus.COMPLETED;
  const netTotal = useMemo(() => sumNet(period?.entries ?? []), [period?.entries]);
  const totalEmployees = period?.entries.length ?? 0;

  const canOpenStep = (step: 1 | 2 | 3 | 4): boolean => {
    if (step === 1) return true;
    if (step === 2) return hasEntries;
    if (step === 3) return hasEntries;
    return hasEntries && (hasNetting || isCompleted);
  };

  const openEdit = (entry: PayrollEntry) => {
    setEditingEntry(entry);
    setBaseSalary(entry.baseSalary);
    setBonus(entry.bonus);
    setAllowance(entry.allowance);
    setDeduction(entry.deduction);
    setAdvanceDeduct(entry.advanceDeduct);
    setEntryError(null);
  };

  const closeEdit = () => {
    setEditingEntry(null);
    setEntryError(null);
  };

  const handleSaveEntry = async () => {
    if (!period || !editingEntry) return;
    const nextBase = baseSalary ?? editingEntry.baseSalary;
    const nextBonus = bonus ?? editingEntry.bonus;
    const nextAllowance = allowance ?? editingEntry.allowance;
    const nextDeduction = deduction ?? editingEntry.deduction;
    const nextAdvance = advanceDeduct ?? editingEntry.advanceDeduct;

    if (nextBase + nextBonus + nextAllowance < nextDeduction + nextAdvance) {
      setEntryError("Tổng lương không thể nhỏ hơn tổng khấu trừ.");
      return;
    }

    setUploading(true);
    setEntryError(null);

    const body: UpdatePayslipEntryBody = {
      baseSalary: nextBase,
      bonus: nextBonus,
      allowance: nextAllowance,
      deduction: nextDeduction,
      advanceDeduct: nextAdvance,
    };

    try {
      const res = await api.put<PayrollEntry>(
        `/api/v1/accountant/payroll/${period.id}/entries/${editingEntry.id}`,
        body
      );
      setPeriod((prev) => {
        if (!prev) return prev;
        const entries = prev.entries.map((e) => (e.id === editingEntry.id ? res.data : e));
        return { ...prev, entries, nettingApplied: false, totalNetPayroll: sumNet(entries) };
      });
    } catch {
      // Optimistic update on error
      setPeriod((prev) => {
        if (!prev) return prev;
        const entries = prev.entries.map((e) =>
          e.id === editingEntry.id
            ? { ...e, baseSalary: nextBase, bonus: nextBonus, allowance: nextAllowance, deduction: nextDeduction, advanceDeduct: nextAdvance, finalNetSalary: recalcNet({ baseSalary: nextBase, bonus: nextBonus, allowance: nextAllowance, deduction: nextDeduction, advanceDeduct: nextAdvance }) }
            : e
        );
        return { ...prev, entries, nettingApplied: false, totalNetPayroll: sumNet(entries) };
      });
    } finally {
      setUploading(false);
      closeEdit();
    }
  };

  const handleNetting = async () => {
    if (!period || period.entries.length === 0) return;
    setNetting(true);

    try {
      const res = await api.post<AutoNettingResponse>(`/api/v1/accountant/payroll/${period.id}/auto-netting`);
      setPeriod((await api.get<PayrollDetailResponse>(`/api/v1/accountant/payroll/${period.id}`)).data);
      setNettingResult(res.data);
      setActiveStep(3);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.apiMessage : "Tính khoản tạm ứng cần trừ thất bại.");
    } finally {
      setNetting(false);
    }
  };

  const handleRun = async () => {
    if (!period) return;
    setRunning(true);

    try {
      const res = await api.post<PayrollRunResponse>(`/api/v1/accountant/payroll/${period.id}/run`);
      setRunResult(res.data);
      setPeriod((await api.get<PayrollDetailResponse>(`/api/v1/accountant/payroll/${period.id}`)).data);
      setActiveStep(4);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.apiMessage : "Chi lương thất bại.");
    } finally {
      setRunning(false);
      setShowRunConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 rounded bg-slate-200 animate-pulse" />
        <div className="h-32 rounded-2xl bg-white animate-pulse" />
        <div className="h-96 rounded-2xl bg-white animate-pulse" />
      </div>
    );
  }

  if (!period) {
    return (
      <div className="space-y-4">
        <Link href="/accountant/payroll" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          Quay lại danh sách kỳ lương
        </Link>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center text-slate-500">
          Không tìm thấy kỳ lương.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-indigo-700 p-6 text-white shadow-xl shadow-blue-900/10">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-50">
              <span className={`h-1.5 w-1.5 rounded-full ${isCompleted ? "bg-emerald-300" : "bg-amber-300"}`} />
              Quy trình chi lương
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">{period.periodCode}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{period.name}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
              Nhập bảng lương, rà soát từng nhân viên, trừ tạm ứng và chuyển lương vào ví nội bộ.
            </p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">Tổng tiền sẽ chi</p>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(netTotal)}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryStat label="Nhân viên" value={`${totalEmployees} người`} />
        <SummaryStat label="Trạng thái" value={getStatusLabel(period.status)} tone={isCompleted ? "text-emerald-700" : "text-amber-700"} />
        <SummaryStat label="Tháng lương" value={`${period.month}/${period.year}`} />
        <SummaryStat label="Cập nhật gần nhất" value={formatDateTime(period.updatedAt)} />
      </section>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/accountant/payroll" className="hover:text-slate-900 transition-colors">Bảng lương</Link>
        <span>/</span>
        <span className="text-slate-600 font-mono">{period.periodCode}</span>
      </div>

      {/* Step navigator */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm px-6 py-5">
        <div className="flex items-center justify-between gap-2">
          {([
            { step: 1 as const, title: "Nhập bảng lương", sub: "File Excel", done: hasEntries },
            { step: 2 as const, title: "Rà soát", sub: "Từng nhân viên", done: hasEntries },
            { step: 3 as const, title: "Trừ tạm ứng", sub: "Tự động", done: hasNetting || isCompleted },
            { step: 4 as const, title: "Chi lương", sub: "Chuyển vào ví", done: isCompleted },
          ] as const).map((item, index, arr) => {
            const active = activeStep === item.step;
            const enabled = canOpenStep(item.step);
            const isLast = index === arr.length - 1;
            return (
              <div key={item.step} className="flex items-center flex-1">
                <button
                  type="button"
                  disabled={!enabled}
                  onClick={() => setActiveStep(item.step)}
                  className="flex flex-col items-center gap-1.5 min-w-0 flex-1 group disabled:cursor-not-allowed"
                >
                  <span className={`w-9 h-9 rounded-full border-2 text-sm font-bold flex items-center justify-center transition-all ${
                    item.done
                      ? "border-emerald-400 bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
                      : active
                        ? "border-blue-400 bg-blue-500 text-white shadow-sm shadow-blue-500/30"
                        : enabled
                          ? "border-slate-300 bg-white text-slate-500 group-hover:border-slate-400"
                          : "border-slate-200 bg-slate-50 text-slate-400"
                  }`}>
                    {item.done ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                    ) : item.step}
                  </span>
                  <span className={`text-xs font-semibold text-center leading-tight ${active ? "text-blue-700" : item.done ? "text-emerald-700" : "text-slate-500"}`}>{item.title}</span>
                  <span className="text-[10px] text-slate-400 text-center hidden sm:block">{item.sub}</span>
                </button>
                {!isLast && (
                  <div className={`h-0.5 flex-1 mx-2 rounded-full transition-colors ${item.done ? "bg-emerald-300" : "bg-slate-200"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {activeStep === 1 && <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Nhập bảng lương qua Excel</h2>
        <p className="text-sm leading-6 text-slate-600">T?i m?u ??ng k?, xem tr??c c?c d?ng v? x?c nh?n to?n l? ? trang Nhập / xuất Excel. File sai kh?ng x?a d? li?u ?ang c?. Ch? k? nh?p ???c ph?p thay th?.</p>
        <div className="flex flex-wrap gap-3"><Link href={`/data-exchange?dataset=payroll&scope=${id}`} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white">Mở nhập / xuất bảng lương</Link>{hasEntries && <button onClick={() => setActiveStep(2)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-blue-700">Xem bảng lương hiện có</button>}</div>
      </section>}

      {activeStep === 2 && (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Bước 2: Rà soát bảng lương</h2>
            <p className="mt-1 text-sm text-slate-500">{getStepDescription(2)}</p>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="bg-blue-50/80 border-b border-slate-200">
                  <th className="px-4 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Mã NV</th>
                  <th className="px-4 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Họ tên</th>
                  <th className="px-4 py-3.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Lương cơ bản</th>
                  <th className="px-4 py-3.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Phụ cấp</th>
                  <th className="px-4 py-3.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Khấu trừ</th>
                  <th className="px-4 py-3.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Thực lĩnh</th>
                  <th className="px-4 py-3.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {period.entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100 last:border-b-0 hover:bg-blue-50/60 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-900 font-mono">{entry.employeeCode}</td>
                    <td className="px-4 py-3 text-sm text-slate-900">{entry.fullName}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-900">{formatCurrency(entry.baseSalary)}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-900">{formatCurrency(entry.bonus + entry.allowance)}</td>
                    <td className="px-4 py-3 text-right text-sm text-rose-700">{formatCurrency(entry.deduction + entry.advanceDeduct)}</td>
                    <td className="px-4 py-3 text-right text-sm text-emerald-700 font-semibold">{formatCurrency(entry.finalNetSalary)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/accountant/payslips/${entry.id}`}
                          className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs"
                        >
                          Phiếu lương
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEdit(entry)}
                          disabled={isCompleted}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 text-xs"
                        >
                          Sửa tiền
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SummaryStat label="Tổng thực lĩnh" value={formatCurrency(netTotal)} tone="text-emerald-700" />

          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setActiveStep(1)} className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm">
              Quay lại nhập Excel
            </button>
            <button type="button" onClick={() => setActiveStep(3)} className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold">
              Sang bước trừ tạm ứng
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Tru tam ung */}
      {activeStep === 3 && (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Bước 3: Trừ tạm ứng còn tồn</h2>
            <p className="mt-1 text-sm text-slate-500">{getStepDescription(3)}</p>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleNetting()}
              disabled={netting || isCompleted || period.entries.length === 0}
              className="px-4 py-2.5 rounded-xl bg-amber-500/80 hover:bg-amber-500 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 text-sm font-semibold"
            >
              {netting ? "Đang tính..." : "Tính khoản tạm ứng cần trừ"}
            </button>
          </div>

          {!nettingResult ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-10 text-center text-slate-500 text-sm">
              Chưa tính khoản tạm ứng cần trừ. Bấm nút bên trên để hệ thống kiểm tra các khoản tạm ứng còn tồn của từng nhân viên.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full min-w-[920px]">
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr className="bg-blue-50/80 border-b border-slate-200">
                      <th className="px-4 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Mã NV</th>
                      <th className="px-4 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Họ tên</th>
                      <th className="px-4 py-3.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Dư nợ tạm ứng</th>
                      <th className="px-4 py-3.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Khấu trừ</th>
                      <th className="px-4 py-3.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Thực lĩnh</th>
                      <th className="px-4 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nettingResult.summary.map((item) => {
                      const netSalary = period.entries.find((e) => e.userId === item.userId)?.finalNetSalary ?? 0;
                      return (
                        <tr
                          key={item.userId}
                          className={`border-b border-slate-100 last:border-b-0 hover:bg-blue-50/60 transition-colors ${item.deductedAmount > 0 ? "bg-amber-50" : ""}`}
                        >
                          <td className="px-4 py-3 text-sm text-slate-900 font-mono">{item.employeeCode}</td>
                          <td className="px-4 py-3 text-sm text-slate-900">{item.fullName}</td>
                          <td className="px-4 py-3 text-right text-sm text-rose-700">{formatCurrency(item.outstandingDebt)}</td>
                          <td className="px-4 py-3 text-right text-sm text-amber-700">{formatCurrency(item.deductedAmount)}</td>
                          <td className="px-4 py-3 text-right text-sm text-emerald-700 font-semibold">{formatCurrency(netSalary)}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{item.note}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <SummaryStat label="Tổng tạm ứng đã trừ" value={formatCurrency(nettingResult.totalAdvanceDeducted)} tone="text-amber-700" />
                <SummaryStat label="Tổng thực lĩnh" value={formatCurrency(netTotal)} tone="text-emerald-700" />
              </div>
            </>
          )}

          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setActiveStep(2)} className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm">
              Quay lại rà soát
            </button>
            <button
              type="button"
              onClick={() => setActiveStep(4)}
              disabled={!nettingResult && !isCompleted}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold"
            >
              Sang bước chi lương
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Run */}
      {activeStep === 4 && (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Bước 4: Chi lương vào ví nhân viên</h2>
            <p className="mt-1 text-sm text-slate-500">{getStepDescription(4)}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SummaryStat label="Số nhân viên" value={`${totalEmployees} người`} />
            <SummaryStat label="Tổng thực lĩnh" value={formatCurrency(netTotal)} tone="text-emerald-700" />
          </div>

          {isCompleted ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
              <p className="text-emerald-700 font-semibold">Đã chi lương thành công</p>
              <p className="text-sm text-slate-900">Kỳ {period.periodCode} đã hoàn tất. Nhân viên có thể xem phiếu lương và số dư ví đã được cập nhật.</p>
              <p className="text-sm text-slate-600">
                {runResult
                  ? `Đã tạo ${runResult.payslipsGenerated} phiếu lương · Tổng chi ${formatCurrency(runResult.totalNetPayroll)}`
                  : `Tổng chi: ${formatCurrency(period.totalNetPayroll)}`}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700 text-sm">
                Sau khi xác nhận, hệ thống sẽ trừ tiền từ quỹ hệ thống và cộng lương vào ví của {totalEmployees} nhân viên. Phiếu đã chi được giữ nguyên lịch sử; sửa sai qua bút toán đảo có lý do.
              </div>
              <button
                type="button"
                onClick={() => setShowRunConfirm(true)}
                className="px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold"
              >
                Xác nhận chi lương
              </button>
            </>
          )}

          <button type="button" onClick={() => setActiveStep(3)} className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm">
            Quay lại bước trừ tạm ứng
          </button>
        </div>
      )}

      {/* Edit entry modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-50">
          <button type="button" className="absolute inset-0 bg-black/70" onClick={closeEdit} aria-label="Đóng" />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-y-auto bg-white border-l border-slate-200 p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900">Sửa dòng lương - {editingEntry.employeeCode}</h3>
            <p className="mt-1 mb-5 text-sm text-slate-500">{editingEntry.fullName}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-600 mb-2">Lương cơ bản</label>
                <CurrencyInput value={baseSalary} onChange={setBaseSalary} />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-2">Thưởng</label>
                <CurrencyInput value={bonus} onChange={setBonus} />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-2">Phụ cấp</label>
                <CurrencyInput value={allowance} onChange={setAllowance} />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-2">Khấu trừ</label>
                <CurrencyInput value={deduction} onChange={setDeduction} />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-2">Khấu trừ tạm ứng</label>
                <CurrencyInput value={advanceDeduct} onChange={setAdvanceDeduct} />
              </div>
            </div>
            {entryError && (
              <div className="px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-sm">
                {entryError}
              </div>
            )}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={closeEdit} className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm">
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void handleSaveEntry()}
                disabled={uploading}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold"
              >
                {uploading ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Run confirm modal */}
      {showRunConfirm && (
        <div className="fixed inset-0 z-50">
          <button type="button" className="absolute inset-0 bg-black/70" onClick={() => setShowRunConfirm(false)} aria-label="Đóng" />
          <div className="absolute inset-x-0 top-20 mx-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
            <h3 className="text-xl font-bold text-slate-900">Xác nhận chi lương</h3>
            <p className="text-sm text-slate-600">
              Hệ thống sẽ chuyển lương vào ví của{" "}
              <span className="font-semibold text-slate-900">{totalEmployees} nhân viên</span> với tổng số tiền{" "}
              <span className="font-semibold text-emerald-700">{formatCurrency(netTotal)}</span>.
            </p>
            <p className="text-sm text-rose-700">Phiếu đã chi được giữ nguyên lịch sử; sửa sai qua bút toán đảo có lý do.</p>
            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={() => setShowRunConfirm(false)} className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm">
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void handleRun()}
                disabled={running}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold"
              >
                {running ? "Đang chi lương..." : "Xác nhận chi lương"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmState.open}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-sm font-semibold mt-1 ${tone ?? "text-slate-900"}`}>{value}</p>
    </div>
  );
}
