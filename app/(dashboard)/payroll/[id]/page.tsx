"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/contexts/toast-context";
import { PayslipDetailResponse, PayslipStatus } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

function statusLabel(status: PayslipStatus): string {
  if(status===PayslipStatus.REVERSED)return "Đã đảo";
  return status === PayslipStatus.PAID ? "Đã thanh toán" : "Chờ thanh toán";
}

function statusClass(status: PayslipStatus): string {
  if(status===PayslipStatus.REVERSED)return "border-rose-200 bg-rose-50 text-rose-700";
  return status === PayslipStatus.PAID
    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
    : "bg-amber-50 border-amber-200 text-amber-700";
}

function getPayDate(payslip: PayslipDetailResponse): string {
  if (payslip.status !== PayslipStatus.PAID) return "—";
  return `Tháng ${payslip.month}/${payslip.year}`;
}

export default function PayslipDetailPage({ params }: PageProps) {
  const router = useRouter();
  const toast = useToast();
  const { id } = use(params);

  const [payslip, setPayslip] = useState<PayslipDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadPayslip = async () => {
      setLoading(true);

      try {
        const res = await api.get<PayslipDetailResponse>(`/api/v1/payslips/${id}`);

        if (cancelled) return;
        setPayslip(res.data);
      } catch (err) {
        if (cancelled) return;

        if (err instanceof ApiError) {
          toast.error(err.apiMessage);
        } else {
          toast.error("Không thể tải chi tiết phiếu lương.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadPayslip();

    return () => {
      cancelled = true;
    };
  }, [id, toast]);

  if (loading) {
    return (
      <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-cyan-600 text-white shadow-xl shadow-blue-900/15">
        <div className="relative p-6 sm:p-8">
          <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 right-10 h-24 w-24 rounded-full bg-cyan-300/20 blur-2xl" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">IFMS workspace</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Payslip detail</h1>
            <p className="mt-3 text-sm leading-6 text-blue-100">Review salary components, deductions, payment status and payroll period.</p>
          </div>
        </div>
      </section>

        <div className="h-9 w-36 rounded bg-white animate-pulse" />
        <div className="h-28 rounded-2xl bg-white animate-pulse" />
        <div className="h-64 rounded-2xl bg-white animate-pulse" />
      </div>
    );
  }

  if (!payslip) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <button
          type="button"
          onClick={() => router.push("/payroll")}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          Quay lại danh sách
        </button>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-slate-500">
          Không tìm thấy phiếu lương.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-6 print:p-0 print:m-0 print:bg-white">
      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-cyan-600 text-white shadow-xl shadow-blue-900/15">
        <div className="relative p-6 sm:p-8">
          <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 right-10 h-24 w-24 rounded-full bg-cyan-300/20 blur-2xl" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">IFMS workspace</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Payslip detail</h1>
            <p className="mt-3 text-sm leading-6 text-blue-100">Review salary components, deductions, payment status and payroll period.</p>
          </div>
        </div>
      </section>
      {payslip.status===PayslipStatus.REVERSED&&<p role="status" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">Phiếu lương đã đảo. Các số tiền bên dưới là số gốc để truy vết, không được cộng vào tổng thực lĩnh còn hiệu lực.</p>}


        <div className="print:hidden">
          <button
            type="button"
            onClick={() => router.push("/payroll")}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
            Quay lại
          </button>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 print:bg-white print:border-gray-300">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 print:text-gray-900">{payslip.employee.fullName}</h1>
              <p className="text-slate-500 print:text-gray-700 mt-1">
                {payslip.periodName} • {payslip.employee.employeeCode}
              </p>
              <p className="text-xs text-slate-500 print:text-gray-600 mt-1">
                Chức danh: {payslip.employee.jobTitle} • Phòng ban: {payslip.employee.departmentName}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex px-3 py-1.5 rounded-full border text-sm ${statusClass(payslip.status)}`}>
                {statusLabel(payslip.status)}
              </span>
              <span className="inline-flex px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-600 text-sm print:border-gray-300 print:bg-white print:text-gray-700">
                Ngày chi: {getPayDate(payslip)}
              </span>
              <button
                type="button"
                onClick={() => window.print()}
                className="print:hidden inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2m-12 0h12v4H6v-4z"
                  />
                </svg>
                In phiếu lương
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3 print:bg-white print:border-gray-300">
            <h2 className="text-lg font-semibold text-slate-900 print:text-gray-900">Earnings</h2>

            <LineRow label="Lương cơ bản" value={payslip.baseSalary} positive />
            {payslip.allowance > 0 && (
              <LineRow label="Phụ cấp" value={payslip.allowance} positive />
            )}
            <LineRow label="Thưởng" value={payslip.bonus} positive />

            <div className="pt-2 border-t border-slate-200 print:border-gray-300">
              <LineRow label="Tổng thu nhập (Gross)" value={payslip.totalEarnings} positive strong />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3 print:bg-white print:border-gray-300">
            <h2 className="text-lg font-semibold text-slate-900 print:text-gray-900">Deductions</h2>

            {payslip.deduction > 0 ? (
              <LineRow label="Khấu trừ cố định" value={payslip.deduction} negative />
            ) : (
              <p className="text-sm text-slate-500 print:text-gray-600">Không có khấu trừ cố định.</p>
            )}

            <LineRow label="Khấu trừ tạm ứng (Netting)" value={payslip.advanceDeduct} negative />

            <div className="pt-2 border-t border-slate-200 print:border-gray-300">
              <LineRow label="Tổng khấu trừ" value={payslip.totalDeduction} negative strong />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-4 print:bg-white print:border-gray-300">
          <h2 className="text-lg font-semibold text-slate-900 print:text-gray-900">Tổng hợp thanh toán</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <MetricCard title="Gross Salary" value={payslip.totalEarnings} tone="normal" />
            <MetricCard title="Total Deductions" value={payslip.totalDeduction} tone="negative" />
            <MetricCard title="Net Salary" value={payslip.finalNetSalary} tone="highlight" />
          </div>
        </div>

        {payslip.advanceDeduct > 0 && (
          <div className="border bg-white border-blue-200 rounded-3xl p-5 print:bg-white print:border-gray-300">
            <h2 className="text-lg font-semibold text-slate-900 print:text-gray-900">Netting</h2>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <MetricCard title="Debt Offset Applied" value={payslip.advanceDeduct} tone="negative" />
              <MetricCard title="Final Paid" value={payslip.finalNetSalary} tone="highlight" />
            </div>
          </div>
        )}

      </div>
    </>
  );
}

function LineRow({
  label,
  value,
  positive,
  negative,
  strong,
}: {
  label: string;
  value: number;
  positive?: boolean;
  negative?: boolean;
  strong?: boolean;
}) {
  const toneClass = positive
    ? "text-emerald-700 print:text-emerald-700"
    : negative
      ? "text-rose-700 print:text-rose-700"
      : "text-slate-700 print:text-gray-900";

  return (
    <div className="flex items-center justify-between gap-4">
      <p className={`text-sm ${strong ? "font-semibold text-slate-900 print:text-gray-900" : "text-slate-600 print:text-gray-700"}`}>
        {label}
      </p>
      <p className={`${toneClass} ${strong ? "font-bold" : "font-medium"}`}>{formatCurrency(value)}</p>
    </div>
  );
}

function MetricCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: number;
  tone: "normal" | "negative" | "highlight";
}) {
  const toneClass =
    tone === "highlight"
      ? "text-blue-700 print:text-blue-700"
      : tone === "negative"
        ? "text-rose-700 print:text-rose-700"
        : "text-slate-100 print:text-gray-900";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 print:bg-white print:border-gray-300">
      <p className="text-xs text-slate-500 print:text-gray-600">{title}</p>
      <p className={`text-xl font-bold mt-1 ${toneClass}`}>{formatCurrency(value)}</p>
    </div>
  );
}
