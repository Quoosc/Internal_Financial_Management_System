"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useWallet } from "@/contexts/wallet-context";
import { ApiError, api } from "@/lib/api-client";
import { formatCurrency, formatRelativeTime, getBurnClass } from "@/lib/format";
import {
  PaginatedResponse,
  RequestType,
  TLApprovalListItem,
  TLProjectListItem,
} from "@/types";
import { normalizeTLApprovalListItem } from "@/lib/adapters/team-leader";

function getApprovalTypeClass(type: RequestType): string {
  switch (type) {
    case RequestType.ADVANCE:
      return "bg-violet-100 border-violet-200 text-violet-700";
    case RequestType.EXPENSE:
      return "bg-sky-100 border-sky-200 text-sky-700";
    case RequestType.REIMBURSE:
      return "bg-amber-100 border-amber-200 text-amber-700";
    default:
      return "bg-slate-100 border-slate-200 text-slate-600";
  }
}

function getApprovalTypeLabel(type: RequestType): string {
  switch (type) {
    case RequestType.ADVANCE:
      return "Tạm ứng";
    case RequestType.EXPENSE:
      return "Hoàn chi nhân viên";
    case RequestType.REIMBURSE:
      return "Quyết toán tạm ứng";
    default:
      return type;
  }
}

function getProjectStatusClass(status: string): string {
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

function getProjectStatusLabel(status: string): string {
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

function getBurnPercent(project: TLProjectListItem): number {
  if (project.totalBudget <= 0) return 0;
  return Math.min(
    100,
    Math.round((project.totalSpent / project.totalBudget) * 100),
  );
}

function pickItems<T>(payload: PaginatedResponse<T> | T[]): T[] {
  return Array.isArray(payload) ? payload : payload.items;
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
  href,
  accent,
  icon,
}: {
  title: string;
  value: string;
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

export function TeamLeaderDashboard() {
  const { user } = useAuth();
  const { wallet, fetchWallet } = useWallet();

  const [approvals, setApprovals] = useState<TLApprovalListItem[]>([]);
  const [projects, setProjects] = useState<TLProjectListItem[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [projectsTotal, setProjectsTotal] = useState(0);
  const [activeProjectsTotal, setActiveProjectsTotal] = useState(0);
  const [membersTotal, setMembersTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      void fetchWallet();

      try {
        const [approvalRes, projectRes, activeProjectRes, memberRes] =
          await Promise.all([
            api.get<PaginatedResponse<unknown> | unknown[]>(
              "/api/v1/team-leader/approvals?page=0&size=3&status=PENDING",
            ),
            api.get<PaginatedResponse<TLProjectListItem> | TLProjectListItem[]>(
              "/api/v1/team-leader/projects?page=1&limit=3",
            ),
            api.get<PaginatedResponse<unknown> | unknown[]>(
              "/api/v1/team-leader/projects?page=1&limit=1&status=ACTIVE",
            ),
            api.get<PaginatedResponse<unknown> | unknown[]>(
              "/api/v1/team-leader/team-members?page=1&limit=1",
            ),
          ]);

        if (cancelled) return;

        setApprovals(
          pickItems(approvalRes.data)
            .map((item) => normalizeTLApprovalListItem(item))
            .slice(0, 3),
        );
        setProjects(pickItems(projectRes.data).slice(0, 3));

        setPendingTotal(
          Array.isArray(approvalRes.data)
            ? pickItems(approvalRes.data).length
            : approvalRes.data.total,
        );
        setProjectsTotal(
          Array.isArray(projectRes.data)
            ? pickItems(projectRes.data).length
            : projectRes.data.total,
        );
        setActiveProjectsTotal(
          Array.isArray(activeProjectRes.data)
            ? pickItems(activeProjectRes.data).length
            : activeProjectRes.data.total,
        );
        setMembersTotal(
          Array.isArray(memberRes.data)
            ? pickItems(memberRes.data).length
            : memberRes.data.total,
        );
      } catch (err) {
        if (cancelled) return;

        setApprovals([]);
        setProjects([]);
        setPendingTotal(0);
        setProjectsTotal(0);
        setActiveProjectsTotal(0);
        setMembersTotal(0);

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

  const pendingAmount = useMemo(
    () => approvals.reduce((sum, item) => sum + item.amount, 0),
    [approvals],
  );

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

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-indigo-200 bg-linear-to-br from-indigo-700 via-blue-600 to-cyan-600 text-white shadow-xl shadow-indigo-900/15">
        <div className="relative px-6 py-7 sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.28),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(103,232,249,0.22),_transparent_34%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-100">Tổng quan Trưởng nhóm</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Xin chào, {user?.fullName ?? "Trưởng nhóm"}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100">
                Hôm nay là {todayLabel}. Theo dõi hàng chờ duyệt, dự án phụ trách và các thao tác ví cá nhân tại một nơi.
              </p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              Trưởng nhóm
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          [...Array(4)].map((_, index) => (
            <div
              key={`stat-skeleton-${index}`}
              className="h-28 animate-pulse rounded-3xl bg-white"
            />
          ))
        ) : (
          <>
            <StatCard
              title="Số dư ví"
              value={formatCurrency(wallet?.balance ?? 0)}
              href="/wallet"
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
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
              }
            />
            <StatCard
              title="Chờ duyệt"
              value={String(pendingTotal)}
              href="/team-leader/approvals"
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
                    d="M20 13V7a2 2 0 00-2-2h-3m-4 0H6a2 2 0 00-2 2v6m16 0l-2 7H6l-2-7m16 0H4"
                  />
                </svg>
              }
            />
            <StatCard
              title="Dự án"
              value={`${activeProjectsTotal}/${projectsTotal}`}
              href="/team-leader/projects"
              accent="text-sky-700"
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
              title="Thành viên"
              value={String(membersTotal)}
              href="/team-leader/team"
              accent="text-indigo-700"
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
        <div className="rounded-3xl border border-amber-100 bg-amber-50/70 p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-bold text-amber-900">Tổng giá trị đang chờ duyệt</p>
              <p className="mt-1 text-sm text-amber-700">Ưu tiên kiểm tra các yêu cầu có ảnh hưởng trực tiếp tới ngân sách giai đoạn.</p>
            </div>
            <p className="text-2xl font-bold text-amber-900">{formatCurrency(pendingAmount)}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Yêu cầu đang chờ duyệt</h2>
              <p className="mt-1 text-sm text-slate-500">Các yêu cầu Flow 1 mới nhất cần xử lý.</p>
            </div>
            <Link
              href="/team-leader/approvals"
              className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              Xem tất cả
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, index) => (
                <div
                  key={`approval-skeleton-${index}`}
                  className="h-20 animate-pulse rounded-2xl bg-slate-100"
                />
              ))}
            </div>
          ) : approvals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center text-sm text-slate-500">
              Không có yêu cầu nào đang chờ duyệt.
            </div>
          ) : (
            <div className="space-y-3">
              {approvals.map((item) => (
                <Link
                  key={item.id}
                  href={`/team-leader/approvals/${item.id}`}
                  className="block rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-amber-200 hover:bg-amber-50/30"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full border text-xs ${getApprovalTypeClass(item.type)}`}
                        >
                          {getApprovalTypeLabel(item.type)}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">
                          {item.requestCode}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>

                      <p className="text-sm text-slate-900 truncate">
                        <span className="font-medium text-slate-900">
                          {item.requester.fullName}
                        </span>{" "}
                        • {item.project.name ?? item.project.projectCode}
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
              <h2 className="text-lg font-bold text-slate-900">Dự án của tôi</h2>
              <p className="mt-1 text-sm text-slate-500">Tóm tắt sức khỏe ngân sách.</p>
            </div>
            <Link
              href="/team-leader/projects"
              className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              Xem tất cả
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, index) => (
                <div
                  key={`project-skeleton-${index}`}
                  className="h-24 animate-pulse rounded-2xl bg-slate-100"
                />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center text-sm text-slate-500">
              Bạn chưa được phân công dự án.
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => {
                const burn = getBurnPercent(project);
                return (
                  <Link
                    key={project.id}
                    href={`/team-leader/projects/${project.id}`}
                    className="block rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-blue-200 hover:bg-blue-50/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {project.name}
                      </p>
                      <span
                        className={`shrink-0 inline-flex px-2 py-1 rounded-full border text-[11px] ${getProjectStatusClass(project.status)}`}
                      >
                        {getProjectStatusLabel(project.status)}
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
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Thao tác nhanh</h2>
          <p className="mt-1 text-sm text-slate-500">Đi thẳng tới các workflow ví thường dùng.</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/wallet/deposit"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
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
            Nạp tiền
          </Link>

          <Link
            href="/wallet/withdraw"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
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
                d="M5 12h14"
              />
            </svg>
            Rút tiền
          </Link>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
