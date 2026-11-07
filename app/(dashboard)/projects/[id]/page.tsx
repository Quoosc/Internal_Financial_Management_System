"use client";

import React, { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api-client";
import {
  PhaseStatus,
  ProjectPhasesResponse,
  ProjectPhaseResponse,
} from "@/types";
import { MetricLabel } from "@/components/ui/metric-label";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/contexts/toast-context";

interface PageProps {
  params: Promise<{ id: string }>;
}

function getPhaseStatusClass(status: PhaseStatus): string {
  if (status === PhaseStatus.PLANNED) {
    return "bg-blue-50 border-blue-200 text-blue-700";
  }
  if (status === PhaseStatus.ACTIVE) {
    return "bg-emerald-50 border-emerald-200 text-emerald-700";
  }
  return "bg-slate-100 border-slate-200 text-slate-600";
}

function getPhaseStatusLabel(status: PhaseStatus): string {
  if (status === PhaseStatus.PLANNED) return "Chưa bắt đầu";
  if (status === PhaseStatus.ACTIVE) return "Đang thực hiện";
  return "Đã kết thúc";
}

export default function ProjectDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = use(params);

  const toast = useToast();
  const [data, setData] = useState<ProjectPhasesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);

      try {
        const res = await api.get<ProjectPhasesResponse>(
          `/api/v1/projects/${id}/phases`,
        );
        if (cancelled) return;
        setData(res.data);
      } catch (err) {
        if (cancelled) return;

        setData(null);
        if (err instanceof ApiError) {
          toast.error(err.apiMessage);
        } else {
          toast.error("Không thể tải chi tiết dự án.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [id, toast]);

  const phases = useMemo<ProjectPhaseResponse[]>(
    () => data?.phases ?? [],
    [data?.phases],
  );

  const budgetStats = useMemo(() => {
    const totalBudget = data?.totalBudget ?? 0;
    const spentAmount = data?.totalSpent ?? 0;
    const remainingBudget = data?.availableBudget ?? 0;
    const spentPercent =
      totalBudget > 0
        ? Math.min(100, Math.round((spentAmount / totalBudget) * 100))
        : 0;

    return {
      totalBudget,
      spentAmount,
      remainingBudget,
      spentPercent,
    };
  }, [data?.availableBudget, data?.totalBudget, data?.totalSpent]);

  const projectStatusText = useMemo(() => {
    if (data?.status) {
      if (data.status === "ACTIVE") return "Đang triển khai";
      if (data.status === "PLANNING") return "Lên kế hoạch";
      if (data.status === "PAUSED") return "Tạm dừng";
      return "Đã đóng";
    }
    if (phases.some((phase) => phase.status === PhaseStatus.ACTIVE)) {
      return "Đang triển khai";
    }
    if (phases.length > 0 && phases.every((phase) => phase.status === PhaseStatus.CLOSED)) {
      return "Đã đóng";
    }
    if (phases.some((phase) => phase.status === PhaseStatus.PLANNED)) {
      return "Chưa bắt đầu";
    }
    return "Chưa có giai đoạn";
  }, [data?.status, phases]);

  if (loading) {
    return (
      <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-cyan-600 text-white shadow-xl shadow-blue-900/15">
        <div className="relative p-6 sm:p-8">
          <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 right-10 h-24 w-24 rounded-full bg-cyan-300/20 blur-2xl" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">Không gian IFMS</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Chi tiết dự án</h1>
            <p className="mt-3 text-sm leading-6 text-blue-100">Theo dõi ngân sách, trạng thái thực hiện và tiến độ chi tiêu của từng giai đoạn.</p>
          </div>
        </div>
      </section>

        <div className="h-9 w-40 rounded bg-white animate-pulse" />
        <div className="h-28 rounded-2xl bg-white animate-pulse" />
        <div className="h-64 rounded-2xl bg-white animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => router.push("/projects")}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Quay lại danh sách dự án
        </button>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-slate-500">
          Không tìm thấy dự án hoặc bạn không có quyền truy cập.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button type="button" onClick={() => router.push("/projects")} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-blue-700">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 19l-7-7 7-7" /></svg>
        Danh sách dự án
      </button>

      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-indigo-700 text-white shadow-xl shadow-blue-900/10">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">Hồ sơ dự án · #{data.projectId}</p>
            <h1 className="mt-2 truncate text-2xl font-bold tracking-tight sm:text-3xl">{data.projectName}</h1>
            <p className="mt-2 text-sm text-blue-100">Theo dõi ngân sách và các giai đoạn triển khai của dự án.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-sm font-semibold text-white">{projectStatusText}</span>
            <span className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-center">
              <span className="block text-[11px] font-medium text-blue-100">Giai đoạn</span>
              <span className="text-lg font-bold">{phases.length}</span>
            </span>
          </div>
        </div>
      </section>

      <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="text-lg font-bold text-slate-900">Tổng quan ngân sách</h2><p className="mt-1 text-sm text-slate-500">Số liệu tổng hợp từ ngân sách và chi tiêu của các giai đoạn.</p></div>
          <span className="text-sm font-semibold text-slate-600">Đã sử dụng {budgetStats.spentPercent}%</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <BudgetCard
            title={<MetricLabel label="Hạn mức giai đoạn" description="Mức ngân sách kế hoạch tối đa của các giai đoạn, không phải số tiền hiện có." />}
            value={budgetStats.totalBudget}
            tone="text-slate-900"
          />
          <BudgetCard
            title={<MetricLabel label="Đã chi" description="Tổng giá trị giao dịch đã hoàn tất trong các giai đoạn." />}
            value={budgetStats.spentAmount}
            tone="text-rose-700"
          />
          <BudgetCard
            title={<MetricLabel label="Quỹ khả dụng" description="Số tiền thực tế còn có thể sử dụng trong các giai đoạn." />}
            value={budgetStats.remainingBudget}
            tone="text-emerald-700"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Tiến độ sử dụng ngân sách</span>
            <span>{formatCurrency(budgetStats.spentAmount)} / {formatCurrency(budgetStats.totalBudget)}</span>
          </div>
          <div className="h-2 rounded-full border border-slate-200 bg-white overflow-hidden">
            <div
              className="h-full bg-rose-500"
              style={{ width: `${budgetStats.spentPercent}%` }}
            />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-1 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div><h2 className="text-lg font-bold text-slate-900">Các giai đoạn</h2><p className="mt-1 text-sm text-slate-500">Ngân sách, mức đã sử dụng và thời gian của từng giai đoạn.</p></div>
          <span className="text-sm font-medium text-slate-500">{phases.length} giai đoạn</span>
        </div>

        {phases.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-500">
            Dự án chưa có giai đoạn.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-215">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="bg-blue-50 border-b border-slate-200">
                  <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                    Giai đoạn
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                    Thời gian
                  </th>
                  <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-slate-400">
                    Ngân sách
                  </th>
                  <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-slate-400">
                    Đã chi
                  </th>
                  <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-slate-400">
                    Còn lại
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                    Trạng thái
                  </th>
                </tr>
              </thead>
              <tbody>
                {phases.map((phase) => {
                  const remaining = Math.max(
                    0,
                    phase.budgetLimit - phase.currentSpent,
                  );
                  return (
                    <tr
                      key={phase.id}
                      className="border-b border-slate-200 hover:bg-blue-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="text-xs text-slate-500">
                          {phase.phaseCode}
                        </p>
                        <p className="text-sm text-slate-900 font-medium mt-0.5">
                          {phase.name}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {formatDate(phase.startDate)} -{" "}
                        {formatDate(phase.endDate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-slate-700">
                        {formatCurrency(phase.budgetLimit)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-rose-700">
                        {formatCurrency(phase.currentSpent)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-emerald-700">
                        {formatCurrency(remaining)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full border text-xs ${getPhaseStatusClass(phase.status)}`}
                        >
                          {getPhaseStatusLabel(phase.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  );
}

function BudgetCard({
  title,
  value,
  tone,
}: {
  title: React.ReactNode;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wide">{title}</p>
      <p className={`text-lg font-bold mt-2 ${tone}`}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}
