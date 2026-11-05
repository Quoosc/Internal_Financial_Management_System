"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api-client";
import { useToast } from "@/contexts/toast-context";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { PayslipDetailResponse, PayslipStatus } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

function getStatusLabel(status: PayslipStatus): string {
  if(status===PayslipStatus.REVERSED)return "Đã đảo";
  return status === PayslipStatus.PAID ? "Đã chi trả" : "Nháp";
}

function getStatusClass(status: PayslipStatus): string {
  if(status===PayslipStatus.REVERSED)return "border-rose-200 bg-rose-50 text-rose-700";
  return status === PayslipStatus.PAID
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-50 text-slate-600";
}

export default function AccountantPayslipDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const toast = useToast();

  const [payslip, setPayslip] = useState<PayslipDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get<PayslipDetailResponse>(`/api/v1/accountant/payslips/${id}`);
        if (cancelled) return;
        setPayslip(res.data);
      } catch (err) {
        if (cancelled) return;
        toast.error(err instanceof ApiError ? err.apiMessage : "Không thể tải phiếu lương.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, toast]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-48 rounded-3xl bg-blue-100 animate-pulse" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="h-28 rounded-3xl bg-white animate-pulse" />
          <div className="h-28 rounded-3xl bg-white animate-pulse" />
          <div className="h-28 rounded-3xl bg-white animate-pulse" />
        </div>
        <div className="h-72 rounded-3xl bg-white animate-pulse" />
      </div>
    );
  }

  if (!payslip) {
    return (
      <div className="space-y-6">
        <Link href="/accountant/payroll" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-600">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 19l-7-7 7-7" />
          </svg>
          Quay lại bảng lương
        </Link>
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 14h6m-6 4h6m2 4H7a2 2 0 01-2-2V4a2 2 0 012-2h6l6 6v12a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-950">Không tìm thấy phiếu lương</h1>
          <p className="mt-2 text-sm text-slate-500">Phiếu lương này không tồn tại hoặc bạn không có quyền xem.</p>
        </div>
      </div>
    );
  }

  const totalEarnings = payslip.totalEarnings ?? payslip.baseSalary + payslip.bonus + payslip.allowance;
  const totalDeduction = payslip.totalDeduction ?? payslip.deduction + payslip.advanceDeduct;
  const deductionRate = totalEarnings > 0 ? Math.round((totalDeduction / totalEarnings) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <Link href="/accountant/payroll" className="font-medium hover:text-blue-700 transition-colors">
          Bảng lương
        </Link>
        <span>/</span>
        <Link href={`/accountant/payroll/${payslip.periodId}`} className="font-medium hover:text-blue-700 transition-colors">
          {payslip.periodName}
        </Link>
        <span>/</span>
        <span className="font-mono text-slate-700">{payslip.payslipCode}</span>
      </div>

      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-cyan-600 p-6 text-white shadow-xl shadow-blue-900/10">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-50">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Payroll detail
            </div>
            <p className="font-mono text-sm text-blue-100">{payslip.payslipCode}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{payslip.periodName}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
              Phiếu lương tháng {payslip.month}/{payslip.year} của {payslip.employee.fullName}.
            </p>
          </div>
          <span className={`inline-flex w-fit rounded-full border px-4 py-2 text-sm font-bold ${getStatusClass(payslip.status)}`}>
            {getStatusLabel(payslip.status)}
          </span>
        </div>
      </section>
      {payslip.status===PayslipStatus.REVERSED&&<p role="status" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">Phiếu lương đã đảo. Các số tiền bên dưới là số gốc để truy vết, không được cộng vào tổng thực lĩnh còn hiệu lực.</p>}


      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Tổng thu nhập" value={formatCurrency(totalEarnings)} helper="Lương, thưởng và phụ cấp" tone="blue" />
        <MetricCard label="Tổng khấu trừ" value={formatCurrency(totalDeduction)} helper={`${deductionRate}% tổng thu nhập`} tone="rose" />
        <MetricCard label="Thực lĩnh" value={formatCurrency(payslip.finalNetSalary)} helper="Số tiền chuyển khoản" tone="emerald" />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Thông tin nhân viên</h2>
              <p className="mt-1 text-sm text-slate-500">Thông tin nhận lương và phòng ban.</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5.121 17.804A9 9 0 1118.879 6.196M15 11a3 3 0 11-6 0 3 3 0 016 0zm-7.5 8a6.5 6.5 0 019 0" />
              </svg>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-1">
            <InfoCard label="Họ tên" value={payslip.employee.fullName} />
            <InfoCard label="Mã nhân viên" value={payslip.employee.employeeCode} mono />
            <InfoCard label="Phòng ban" value={payslip.employee.departmentName} />
            <InfoCard label="Chức danh" value={payslip.employee.jobTitle || "Chưa cập nhật"} />
            <InfoCard label="Ngân hàng" value={payslip.employee.bankName || "Chưa cập nhật"} />
            <InfoCard label="Số tài khoản" value={payslip.employee.bankAccountNum || "Chưa cập nhật"} mono />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Chi tiết lương</h2>
              <p className="mt-1 text-sm text-slate-500">Các khoản thu nhập, khấu trừ và thực lĩnh.</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 10v-1m9-4a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full">
              <tbody>
                <SalaryRow label="Lương cơ bản" value={payslip.baseSalary} />
                <SalaryRow label="Thưởng" value={payslip.bonus} />
                <SalaryRow label="Phụ cấp" value={payslip.allowance} />
                <SalaryRow label="Tổng thu nhập" value={totalEarnings} highlight="income" />
                <SalaryRow label="Khấu trừ" value={-payslip.deduction} negative />
                <SalaryRow label="Khấu trừ tạm ứng" value={-payslip.advanceDeduct} negative />
                <SalaryRow label="Tổng khấu trừ" value={-totalDeduction} highlight="deduction" />
              </tbody>
            </table>
          </div>

          <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-sm font-semibold text-emerald-800">Thực lĩnh</p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">{formatCurrency(payslip.finalNetSalary)}</p>
            <p className="mt-1 text-xs text-emerald-700/80">Cập nhật: {formatDateTime(new Date().toISOString())}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: "blue" | "emerald" | "rose";
}) {
  const toneClass = {
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
    rose: "border-rose-100 bg-rose-50 text-rose-700",
  }[tone];

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-75">{label}</p>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{helper}</p>
    </div>
  );
}

function InfoCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold text-slate-950 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function SalaryRow({
  label,
  value,
  negative,
  highlight,
}: {
  label: string;
  value: number;
  negative?: boolean;
  highlight?: "income" | "deduction";
}) {
  const rowClass = highlight === "income"
    ? "bg-blue-50 border-b border-blue-100"
    : highlight === "deduction"
    ? "bg-rose-50 border-b border-rose-100"
    : "border-b border-slate-100 last:border-b-0";

  const valueClass = negative
    ? "text-rose-700"
    : highlight === "income"
    ? "text-blue-700 font-bold"
    : highlight === "deduction"
    ? "text-rose-700 font-bold"
    : "text-slate-950";

  return (
    <tr className={rowClass}>
      <td className="px-4 py-3 text-sm text-slate-700">{label}</td>
      <td className={`px-4 py-3 text-right text-sm font-semibold ${valueClass}`}>
        {negative && value !== 0 ? `- ${formatCurrency(Math.abs(value))}` : formatCurrency(Math.abs(value))}
      </td>
    </tr>
  );
}
