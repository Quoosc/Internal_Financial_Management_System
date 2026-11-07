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
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">Phiếu lương · IFMS</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Chi tiết phiếu lương</h1>
            <p className="mt-3 text-sm leading-6 text-blue-100">Xem các khoản lương, phụ cấp, khấu trừ và trạng thái thanh toán của kỳ lương.</p>
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
        <div className="print:hidden">
          <button
            type="button"
            onClick={() => router.push("/payroll")}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-blue-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
            Danh sách phiếu lương
          </button>
        </div>

        <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-indigo-700 text-white shadow-xl shadow-blue-900/10 print:hidden">
          <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">Hồ sơ lương · IFMS</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Phiếu lương {payslip.periodName}</h1>
              <p className="mt-2 text-sm text-blue-100">Xem thu nhập, khấu trừ và số tiền thực lĩnh của kỳ lương.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-sm font-semibold">{statusLabel(payslip.status)}</span>
              <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5">
                <p className="text-xs text-blue-100">Thực lĩnh</p>
                <p className="mt-1 text-lg font-bold">{formatCurrency(payslip.finalNetSalary)}</p>
              </div>
            </div>
          </div>
        </section>

        {payslip.status === PayslipStatus.REVERSED && <p role="status" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">Phiếu lương đã đảo. Các số tiền bên dưới là số gốc để truy vết, không được cộng vào tổng thực lĩnh còn hiệu lực.</p>}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm print:border-gray-300 print:shadow-none">
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between print:bg-white">
            <div>
              <h2 className="text-lg font-bold text-slate-900 print:text-gray-900">Thông tin nhân viên</h2>
              <p className="mt-1 text-sm text-slate-500">Phiếu lương được lập cho người nhận dưới đây.</p>
            </div>
            <div className="print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
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
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div><p className="text-xs text-slate-500">Nhân viên</p><p className="mt-1 text-base font-bold text-slate-900">{payslip.employee.fullName}</p><p className="mt-1 text-sm text-slate-500">{payslip.employee.employeeCode}</p></div>
            <div><p className="text-xs text-slate-500">Chức danh / phòng ban</p><p className="mt-1 text-sm font-semibold text-slate-800">{payslip.employee.jobTitle}</p><p className="mt-1 text-sm text-slate-500">{payslip.employee.departmentName}</p></div>
            <div><p className="text-xs text-slate-500">Kỳ lương</p><p className="mt-1 text-sm font-semibold text-slate-800">{payslip.periodName}</p></div>
            <div><p className="text-xs text-slate-500">Trạng thái thanh toán</p><p className="mt-1 text-sm font-semibold text-slate-800">{statusLabel(payslip.status)}</p></div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm print:border-gray-300 print:shadow-none">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 print:bg-white">
            <h2 className="text-lg font-bold text-slate-900">Tổng hợp thanh toán</h2>
            <p className="mt-1 text-sm text-slate-500">Từ tổng thu nhập đến số tiền cuối cùng được nhận.</p>
          </div>
          <div className="grid gap-3 p-5 md:grid-cols-3">
            <MetricCard title="Tổng thu nhập" value={payslip.totalEarnings} tone="normal" />
            <MetricCard title="Tổng khấu trừ" value={payslip.totalDeduction} tone="negative" />
            <MetricCard title="Thực lĩnh" value={payslip.finalNetSalary} tone="highlight" />
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm print:border-gray-300 print:shadow-none">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 print:bg-white"><h2 className="text-lg font-bold text-slate-900">Khoản thu nhập</h2></div>
            <div className="space-y-3 p-5">
            <LineRow label="Lương cơ bản" value={payslip.baseSalary} positive />
            {payslip.allowance > 0 && (
              <LineRow label="Phụ cấp" value={payslip.allowance} positive />
            )}
            <LineRow label="Thưởng" value={payslip.bonus} positive />

            <div className="pt-2 border-t border-slate-200 print:border-gray-300">
              <LineRow label="Tổng thu nhập (Gross)" value={payslip.totalEarnings} positive strong />
            </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm print:border-gray-300 print:shadow-none">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 print:bg-white"><h2 className="text-lg font-bold text-slate-900">Các khoản khấu trừ</h2></div>
            <div className="space-y-3 p-5">
            {payslip.deduction > 0 ? (
              <LineRow label="Khấu trừ cố định" value={payslip.deduction} negative />
            ) : (
              <p className="text-sm text-slate-500 print:text-gray-600">Không có khấu trừ cố định.</p>
            )}

            <LineRow label="Khấu trừ tạm ứng" value={payslip.advanceDeduct} negative />

            <div className="pt-2 border-t border-slate-200 print:border-gray-300">
              <LineRow label="Tổng khấu trừ" value={payslip.totalDeduction} negative strong />
            </div>
            {payslip.advanceDeduct > 0 && <p className="rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900">Khoản tạm ứng đã nhận được đối trừ vào lương kỳ này.</p>}
            </div>
          </section>
        </div>

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
        : "text-slate-900 print:text-gray-900";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 print:bg-white print:border-gray-300">
      <p className="text-xs text-slate-500 print:text-gray-600">{title}</p>
      <p className={`text-xl font-bold mt-1 ${toneClass}`}>{formatCurrency(value)}</p>
    </div>
  );
}
