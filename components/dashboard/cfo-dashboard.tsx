"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { ApiError, api } from "@/lib/api-client";
import { formatCurrency, formatRelativeTime, getFundHealthStyle } from "@/lib/format";
import {
  AdminApprovalListItem,
  CfoDashboardResponse,
  CompanyFundResponse,
  PaginatedResponse,
} from "@/types";


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
  return (
    <Link
      href={href}
      className="rounded-3xl border border-slate-200 bg-white shadow-sm p-4 hover:bg-blue-50 hover:border-slate-300 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">{title}</p>
          <p className={`text-3xl font-bold mt-1 ${accent}`}>{value}</p>
        </div>
        <span className="w-9 h-9 rounded-2xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center">
          {icon}
        </span>
      </div>
    </Link>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors"
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
          d="M5 12h14m-7-7l7 7-7 7"
        />
      </svg>
      {label}
    </Link>
  );
}

export function CfoDashboard() {
  const { user } = useAuth();

  const [dashboard, setDashboard] = useState<CfoDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDegraded, setIsDegraded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      setLoading(true);
      setError(null);
      setIsDegraded(false);

      try {
        const res = await api.get<CfoDashboardResponse>(
          "/api/v1/dashboard/cfo",
        );
        if (cancelled) return;
        setDashboard(res.data);
      } catch (dashboardErr) {
        // Fallback: compose from existing endpoints
        try {
          const [fundRes, approvalsRes] = await Promise.all([
            api.get<CompanyFundResponse>("/api/v1/company-fund"),
            api.get<
              PaginatedResponse<AdminApprovalListItem> | AdminApprovalListItem[]
            >("/api/v1/cfo/approvals?status=PENDING&page=0&size=5"),
          ]);

          if (cancelled) return;

          const items = Array.isArray(approvalsRes.data)
            ? approvalsRes.data
            : approvalsRes.data.items;

          const total = Array.isArray(approvalsRes.data)
            ? approvalsRes.data.length
            : approvalsRes.data.total;

          setIsDegraded(true);
          setDashboard({
            companyFundBalance: fundRes.data.currentWalletBalance,
            fundHealth: fundRes.data.fundHealth,
            pendingApprovalsCount: total,
            monthlyApprovedAmount: 0,
            monthlyRejectedCount: 0,
            recentApprovals: items.slice(0, 5).map((item) => ({
              id: item.id,
              requestCode: item.requestCode,
              departmentName: item.department?.name ?? "-",
              amount: item.amount,
              status: item.status,
              createdAt: item.createdAt,
            })),
          });
        } catch (composeErr) {
          if (cancelled) return;

          setDashboard(null);

          if (dashboardErr instanceof ApiError) {
            setError(dashboardErr.apiMessage);
          } else if (composeErr instanceof ApiError) {
            setError(composeErr.apiMessage);
          } else {
            setError("Không thể tải dữ liệu dashboard.");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

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

  const health = useMemo(
    () => getFundHealthStyle(dashboard?.fundHealth ?? "CRITICAL"),
    [dashboard?.fundHealth],
  );

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-cyan-600 text-white shadow-xl shadow-blue-900/15">
        <div className="relative p-6 sm:p-8">
          <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 right-10 h-24 w-24 rounded-full bg-cyan-300/20 blur-2xl" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">IFMS workspace</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">CFO dashboard</h1>
            <p className="mt-3 text-sm leading-6 text-blue-100">Review system fund health, department budget approvals and executive finance indicators.</p>
          </div>
        </div>
      </section>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Quản lý tài chính
          </h1>
          <p className="text-slate-500 mt-1">
            Xin chào, {user?.fullName ?? "CFO"} • {todayLabel}
          </p>
        </div>

        <span className="inline-flex w-fit px-3 py-1.5 rounded-full border border-violet-300 bg-violet-100 text-violet-700 text-sm font-medium">
          CFO
        </span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {loading ? (
          [...Array(4)].map((_, index) => (
            <div
              key={`cfo-stat-skeleton-${index}`}
              className="h-24 rounded-2xl bg-white animate-pulse"
            />
          ))
        ) : (
          <>
            <StatCard
              title="Số dư quỹ hệ thống"
              value={formatCurrency(dashboard?.companyFundBalance ?? 0)}
              href="/cfo/system-fund"
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
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
              }
            />

            <StatCard
              title="Chờ duyệt cap quota"
              value={String(dashboard?.pendingApprovalsCount ?? 0)}
              href="/cfo/approvals"
              accent="text-rose-700"
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
                    d="M9 12h6m-3-3v6m9 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
            />

            <StatCard
              title={isDegraded ? "Đã duyệt tháng này (dữ liệu tạm thời)" : "Đã duyệt tháng này"}
              value={isDegraded ? "—" : formatCurrency(dashboard?.monthlyApprovedAmount ?? 0)}
              href="/cfo/approvals"
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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
            />

            <StatCard
              title={isDegraded ? "Từ chối tháng này (dữ liệu tạm thời)" : "Từ chối tháng này"}
              value={isDegraded ? "—" : String(dashboard?.monthlyRejectedCount ?? 0)}
              href="/cfo/approvals"
              accent="text-slate-600"
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
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
            />
          </>
        )}
      </div>

      {/* Main section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pending approvals list */}
        <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">
              Yêu cầu chờ duyệt
            </h2>
            <Link
              href="/cfo/approvals"
              className="text-sm text-blue-700 hover:text-blue-600"
            >
              Xem tất cả →
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, index) => (
                <div
                  key={`approval-skeleton-${index}`}
                  className="h-20 rounded-2xl bg-white animate-pulse"
                />
              ))}
            </div>
          ) : (dashboard?.recentApprovals.length ?? 0) === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-blue-50/60 p-8 text-center text-sm text-slate-500">
              Không có yêu cầu nào đang chờ duyệt.
            </div>
          ) : (
            <div className="space-y-3">
              {dashboard?.recentApprovals.map((item) => (
                <Link
                  key={item.id}
                  href={`/cfo/approvals/${item.id}`}
                  className="block rounded-2xl border border-slate-200 bg-white p-3 hover:bg-blue-50/80 hover:border-slate-300 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {item.requestCode}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {item.departmentName}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-amber-700">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    {formatRelativeTime(item.createdAt)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Company fund health */}
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-4 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Sức khỏe quỹ</h2>

          {loading ? (
            <div className="h-32 rounded-2xl bg-white animate-pulse" />
          ) : (
            <>
              <div
                className={`rounded-2xl border p-4 text-center space-y-1 ${health.borderTone} ${health.bgTone}`}
              >
                <p
                  className={`text-xs font-semibold uppercase tracking-wide ${health.tone}`}
                >
                  {health.label}
                </p>
                <p className="text-lg font-bold text-slate-900">
                  {formatCurrency(dashboard?.companyFundBalance ?? 0)}
                </p>
                <p className="text-xs text-slate-500">Số dư COMPANY_FUND</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-500 space-y-1">
                <p>
                  <span className="text-emerald-700 font-medium">HEALTHY</span>{" "}
                  — ≥ 500 triệu
                </p>
                <p>
                  <span className="text-amber-700 font-medium">LOW</span> — 100
                  → 500 triệu
                </p>
                <p>
                  <span className="text-rose-700 font-medium">CRITICAL</span> —
                  dưới 100 triệu
                </p>
              </div>

              <Link
                href="/cfo/system-fund"
                className="block text-center px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors"
              >
                Xem chi tiết quỹ →
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-4">
        <h2 className="text-lg font-semibold text-slate-900">Truy cập nhanh</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <QuickLink href="/cfo/approvals" label="Duyệt cap quota" />
          <QuickLink href="/cfo/system-fund" label="Quỹ hệ thống" />
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-2xl border border-amber-200 bg-amber-50 text-amber-700 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
