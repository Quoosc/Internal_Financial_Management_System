"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useWallet } from "@/contexts/wallet-context";
import { ApiError, api } from "@/lib/api-client";
import { useToast } from "@/contexts/toast-context";
import { formatCurrency, formatRelativeTime, getBurnClass } from "@/lib/format";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  ManagerApprovalListItem,
  ManagerDashboardResponse,
  ManagerProjectListItem,
  PaginatedResponse,
  RequestStatus,
  RequestType,
} from "@/types";

function parseItems<T>(payload: PaginatedResponse<T> | T[]): T[] {
  return Array.isArray(payload) ? payload : payload.items;
}

function projectStatusLabel(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "Đang hoạt động";
    case "PLANNING":
      return "Lập kế hoạch";
    case "PAUSED":
      return "Tạm dừng";
    case "CLOSED":
      return "Đã đóng";
    default:
      return status;
  }
}

function projectStatusClass(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-100 border-emerald-200 text-emerald-700";
    case "PLANNING":
      return "bg-sky-100 border-sky-200 text-sky-700";
    case "PAUSED":
      return "bg-amber-100 border-amber-200 text-amber-700";
    case "CLOSED":
      return "bg-slate-100 border-slate-200 text-slate-600";
    default:
      return "bg-slate-100 border-slate-200 text-slate-600";
  }
}

function burnPercent(project: ManagerProjectListItem): number {
  if (project.totalBudget <= 0) return 0;
  return Math.min(
    100,
    Math.round((project.totalSpent / project.totalBudget) * 100),
  );
}

const ACCENT_TO_GRADIENT: Record<string, string> = {
  "text-blue-700": "bg-linear-to-br from-blue-500 to-blue-600",
  "text-emerald-700": "bg-linear-to-br from-emerald-500 to-emerald-600",
  "text-amber-700": "bg-linear-to-br from-amber-500 to-orange-500",
  "text-violet-700": "bg-linear-to-br from-violet-500 to-purple-600",
  "text-indigo-700": "bg-linear-to-br from-indigo-500 to-indigo-600",
  "text-rose-700": "bg-linear-to-br from-rose-500 to-rose-600",
  "text-teal-700": "bg-linear-to-br from-teal-500 to-teal-600",
  "text-cyan-700": "bg-linear-to-br from-cyan-500 to-cyan-600",
};

function StatCard({
  title,
  value,
  sub,
  href,
  accent,
  icon,
}: {
  title: string;
  value: string;
  sub?: string;
  href: string;
  accent: string;
  icon: React.ReactNode;
}) {
  const iconGradient =
    ACCENT_TO_GRADIENT[accent] ?? "bg-linear-to-br from-slate-400 to-slate-500";
  return (
    <Link
      href={href}
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-900/10"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className={`mt-2 text-2xl font-bold ${accent}`}>{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconGradient} text-white shadow-sm`}
        >
          {icon}
        </span>
      </div>
    </Link>
  );
}

export function ManagerDashboard() {
  const { user } = useAuth();
  const { fetchWallet } = useWallet();
  const toast = useToast();

  const [dashboard, setDashboard] = useState<ManagerDashboardResponse | null>(
    null,
  );
  const [approvals, setApprovals] = useState<ManagerApprovalListItem[]>([]);
  const [projects, setProjects] = useState<ManagerProjectListItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [quotaAmount, setQuotaAmount] = useState<number | null>(null);
  const [quotaDescription, setQuotaDescription] = useState("");
  const [quotaSubmitting, setQuotaSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      void fetchWallet();

      try {
        const [dashRes, approvalsRes, projectsRes] = await Promise.all([
          api.get<ManagerDashboardResponse>("/api/v1/dashboard/manager"),
          api.get<
            | PaginatedResponse<ManagerApprovalListItem>
            | ManagerApprovalListItem[]
          >("/api/v1/manager/approvals?page=0&size=3"),
          api.get<
            PaginatedResponse<ManagerProjectListItem> | ManagerProjectListItem[]
          >("/api/v1/manager/projects?page=1&limit=4"),
        ]);

        if (cancelled) return;

        const pendingItems = parseItems(approvalsRes.data)
          .filter(
            (item) =>
              item.type === RequestType.PROJECT_TOPUP &&
              item.status === RequestStatus.PENDING,
          )
          .slice(0, 3);

        setDashboard(dashRes.data);
        setApprovals(pendingItems);
        setProjects(parseItems(projectsRes.data).slice(0, 4));
      } catch (err) {
        if (cancelled) return;

        setDashboard(null);
        setApprovals([]);
        setProjects([]);

        if (err instanceof ApiError) {
          setError(err.apiMessage);
        } else {
          setError("Không thể tải dữ liệu dashboard.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [fetchWallet]);

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("vi-VN", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  const activeProjects =
    dashboard?.projectStatusSummary.active ??
    projects.filter((p) => p.status === "ACTIVE").length;
  const pendingCount = dashboard?.pendingApprovalsCount ?? approvals.length;
  const deptBalance = dashboard?.departmentBudget.totalAvailableBalance ?? 0;
  const teamDebt = dashboard?.teamDebtSummary.totalDebt ?? 0;
  const debtUsers = dashboard?.teamDebtSummary.employeesWithDebt ?? 0;
  const pendingAmount = approvals.reduce((sum, item) => sum + item.amount, 0);

  const handleOpenQuotaModal = () => {
    setQuotaAmount(null);
    setQuotaDescription("");
    setShowQuotaModal(true);
  };

  const handleCreateQuotaTopup = async () => {
    const amountNumber = quotaAmount ?? 0;
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      toast.error("Số tiền xin cấp vốn phải lớn hơn 0.");
      return;
    }

    if (quotaDescription.trim().length < 10) {
      toast.error("Mô tả cần ít nhất 10 ký tự.");
      return;
    }

    setQuotaSubmitting(true);

    try {
      await api.post("/api/v1/requests", {
        type: RequestType.DEPARTMENT_TOPUP,
        amount: amountNumber,
        description: quotaDescription.trim(),
      });
      setShowQuotaModal(false);
      setQuotaAmount(null);
      setQuotaDescription("");
      toast.success("Đã gửi yêu cầu xin cấp vốn phòng ban.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.apiMessage : "Không thể gửi yêu cầu cấp vốn. Vui lòng thử lại.");
    } finally {
      setQuotaSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-indigo-200 bg-linear-to-br from-indigo-700 via-blue-600 to-cyan-600 text-white shadow-xl shadow-indigo-900/15">
        <div className="relative px-6 py-7 sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.28),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(103,232,249,0.22),_transparent_34%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-100">Manager dashboard</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Xin chào, {user?.fullName ?? "Quản lý"}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100">
                Hôm nay là {todayLabel}. Theo dõi quỹ phòng ban, dự án, cấp vốn và dư nợ trong một màn hình.
              </p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              Quản lý
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          [...Array(4)].map((_, index) => (
            <div
              key={`manager-stat-skeleton-${index}`}
              className="h-28 animate-pulse rounded-3xl bg-white"
            />
          ))
        ) : (
          <>
            <StatCard
              title="Số dư ví PB"
              value={formatCurrency(deptBalance)}
              sub="Có thể dùng để cấp vốn"
              href="/manager/department"
              accent="text-blue-700"
              icon={
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                  />
                </svg>
              }
            />

            <StatCard
              title="Chờ duyệt"
              value={String(pendingCount)}
              sub="Cấp vốn dự án"
              href="/manager/approvals"
              accent="text-amber-700"
              icon={
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
            />

            <StatCard
              title="Dự án đang hoạt động"
              value={String(activeProjects)}
              sub="Đang triển khai"
              href="/manager/projects"
              accent="text-emerald-700"
              icon={
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3 7h18M3 12h18M3 17h18"
                  />
                </svg>
              }
            />

            <StatCard
              title="Dư nợ nhóm"
              value={formatCurrency(teamDebt)}
              sub={`${debtUsers} nhân viên`}
              href="/manager/department"
              accent={teamDebt > 0 ? "text-rose-700" : "text-slate-600"}
              icon={
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20h10M12 7a3 3 0 110 6 3 3 0 010-6z"
                  />
                </svg>
              }
            />
          </>
        )}
      </div>

      {!loading && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-blue-100 bg-blue-50/70 p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-bold text-blue-900">Số dư ví phòng ban</p>
                <p className="mt-1 text-sm text-blue-700">Khả dụng để duyệt cấp vốn dự án</p>
              </div>
              <p className="text-2xl font-bold text-blue-900">{formatCurrency(deptBalance)}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-indigo-100 bg-indigo-50/70 p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-bold text-indigo-900">Đề xuất cấp vốn dự án đang chờ</p>
                <p className="mt-1 text-sm text-indigo-700">Tổng giá trị đề xuất cấp vốn mới nhất</p>
              </div>
              <p className="text-2xl font-bold text-indigo-900">{formatCurrency(pendingAmount)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Yêu cầu cấp vốn dự án chờ duyệt</h2>
              <p className="mt-1 text-sm text-slate-500">Các đề xuất cấp vốn mới từ Trưởng nhóm.</p>
            </div>
            <Link
              href="/manager/approvals"
              className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              Xem tất cả
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, index) => (
                <div
                  key={`manager-approval-skeleton-${index}`}
                  className="h-24 animate-pulse rounded-2xl bg-slate-100"
                />
              ))}
            </div>
          ) : approvals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center text-sm text-slate-500">
              Không có yêu cầu cấp vốn dự án đang chờ duyệt.
            </div>
          ) : (
            <div className="space-y-3">
              {approvals.map((item) => (
                <Link
                  key={item.id}
                  href={`/manager/approvals/${item.id}`}
                  className="block rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-blue-200 hover:bg-blue-50/30"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="inline-flex px-2 py-1 rounded-full border border-blue-200 bg-blue-50 text-blue-700">
                          Cấp vốn DA
                        </span>
                        <span className="text-slate-500 font-mono">
                          {item.requestCode}
                        </span>
                        <span className="text-slate-500">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>

                      <p className="text-sm text-slate-900 truncate">
                        <span className="font-medium text-slate-900">
                          {item.project.name}
                        </span>{" "}
                        • {item.requester.fullName}
                      </p>
                    </div>

                    <p className="text-sm font-semibold text-slate-900">
                      {formatCurrency(item.amount)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Dự án phòng ban</h2>
              <p className="mt-1 text-sm text-slate-500">Tóm tắt mức tiêu hao ngân sách.</p>
            </div>
            <Link
              href="/manager/projects"
              className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              Xem tất cả
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, index) => (
                <div
                  key={`manager-project-skeleton-${index}`}
                  className="h-24 animate-pulse rounded-2xl bg-slate-100"
                />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center text-sm text-slate-500">
              Chưa có dự án trong phòng ban.
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => {
                const burn = burnPercent(project);
                return (
                  <Link
                    key={project.id}
                    href={`/manager/projects/${project.id}`}
                    className="block rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-blue-200 hover:bg-blue-50/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {project.name}
                      </p>
                      <span
                        className={`shrink-0 inline-flex px-2 py-1 rounded-full border text-[11px] ${projectStatusClass(project.status)}`}
                      >
                        {projectStatusLabel(project.status)}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Tỷ lệ sử dụng ngân sách</span>
                        <span>{burn}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white border border-slate-200 overflow-hidden">
                        <div
                          className={`h-full ${getBurnClass(burn)}`}
                          style={{ width: `${burn}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}

              <div className="pt-1 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  Thấp (&lt;65%)
                </span>
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  Trung bình (65–85%)
                </span>
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                  Cao (&gt;85%)
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Thao tác nhanh</h2>
          <p className="mt-1 text-sm text-slate-500">Đi thẳng tới các workflow quản lý thường dùng.</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleOpenQuotaModal}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-900/15 transition hover:bg-blue-500"
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
                d="M12 5v14m7-7H5"
              />
            </svg>
            Xin cấp vốn PB
          </button>

          <Link
            href="/wallet"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50"
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
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
            Ví cá nhân
          </Link>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-sm">
          {error}
        </div>
      )}

      {showQuotaModal && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            onClick={() => setShowQuotaModal(false)}
            aria-label="Đóng modal xin cấp vốn phòng ban"
          />

          <div className="absolute inset-x-0 top-10 mx-auto w-[calc(100%-2rem)] max-w-xl rounded-3xl border border-blue-100 bg-white p-6 shadow-2xl shadow-slate-950/20">
            <div className="mb-5">
              <h3 className="text-xl font-bold text-slate-900">
                Xin cấp vốn phòng ban
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Yêu cầu này sẽ được gửi đến CFO để phê duyệt ngân sách phòng ban.
              </p>
            </div>

            <div className="space-y-5">
            <div>
              <label className="block text-sm text-slate-600 mb-2">
                Số tiền cần cấp
              </label>
              <CurrencyInput
                value={quotaAmount}
                onChange={setQuotaAmount}
                placeholder="Ví dụ: 100000000"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">
                Mô tả nhu cầu
              </label>
              <textarea
                rows={4}
                value={quotaDescription}
                onChange={(event) => setQuotaDescription(event.target.value)}
                placeholder="Mô tả lý do xin cấp vốn..."
                className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-5">
              <button
                type="button"
                onClick={() => setShowQuotaModal(false)}
                className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleCreateQuotaTopup}
                disabled={quotaSubmitting}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {quotaSubmitting ? "Đang gửi..." : "Gửi yêu cầu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
