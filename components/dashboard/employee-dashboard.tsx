"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useAuth } from "@/contexts/auth-context";
import { api } from "@/lib/api-client";
import { formatCurrency, formatDateTime, formatRelativeTime } from "@/lib/format";
import {
  PaginatedResponse,
  EmployeeDashboardResponse,
  LedgerEntryResponse,
  TransactionDirection,
  PayslipListItem,
  RequestListItem,
  RequestSummaryResponse,
  RequestType,
  RequestStatus,
  WalletResponse,
} from "@/types";

interface SpendingPoint {
  label: string;
  chiTieu: number;
  tamUng: number;
}

function mapWalletResponse(wallet: WalletResponse): EmployeeDashboardResponse["wallet"] {
  return {
    balance: wallet.balance,
    lockedBalance: wallet.lockedBalance,
    availableBalance: wallet.availableBalance,
  };
}

function mapRecentPayslip(
  payload: PaginatedResponse<PayslipListItem> | null,
): EmployeeDashboardResponse["recentPayslip"] {
  const item = payload?.items[0];

  if (!item) {
    return null;
  }

  return {
    id: item.id,
    payslipCode: item.payslipCode,
    periodName: item.periodName,
    finalNetSalary: item.finalNetSalary,
    status: item.status,
  };
}

function mapRecentTransactions(
  payload:
    | PaginatedResponse<LedgerEntryResponse>
    | { content: LedgerEntryResponse[]; items?: LedgerEntryResponse[] }
    | LedgerEntryResponse[]
    | null,
): EmployeeDashboardResponse["recentTransactions"] {
  const items = Array.isArray(payload)
    ? payload
    : payload && "content" in payload
      ? payload.content
      : (payload as PaginatedResponse<LedgerEntryResponse> | null)?.items;

  if (!items?.length) {
    return [];
  }

  return items.map((item) => ({
    id: item.id,
    transactionId: item.transactionId,
    transactionCode: item.transactionCode,
    direction: item.direction,
    amount: item.amount,
    createdAt: item.createdAt,
  }));
}


// ─── Helpers ─────────────────────────────────────────────────


const REQUEST_TYPE_CONFIG: Record<
  RequestType,
  { label: string; badgeCls: string }
> = {
  [RequestType.ADVANCE]: {
    label: "Tạm ứng",
    badgeCls: "bg-purple-100 text-purple-700 border border-purple-200",
  },
  [RequestType.EXPENSE]: {
    label: "Hoàn chi nhân viên",
    badgeCls: "bg-blue-50 text-blue-700 border border-blue-200",
  },
  [RequestType.REIMBURSE]: {
    label: "Quyết toán tạm ứng",
    badgeCls: "bg-teal-500/20 text-teal-700 border border-teal-200",
  },
  [RequestType.PROJECT_TOPUP]: {
    label: "Nạp DA",
    badgeCls: "bg-amber-50 text-amber-700 border border-amber-200",
  },
  [RequestType.DEPARTMENT_TOPUP]: {
    label: "Nạp Quota",
    badgeCls: "bg-rose-50 text-rose-700 border border-rose-200",
  },
};

const REQUEST_STATUS_CONFIG: Record<
  RequestStatus,
  { label: string; cls: string }
> = {
  [RequestStatus.PENDING]: {
    label: "Chờ duyệt",
    cls: "text-amber-700",
  },
  [RequestStatus.APPROVED_BY_TEAM_LEADER]: {
    label: "Chờ giải ngân",
    cls: "text-blue-600",
  },
  [RequestStatus.ACCOUNTANT_VERIFIED]: {
    label: "Chứng từ đã xác nhận, chờ hoàn tiền",
    cls: "text-teal-700",
  },
  [RequestStatus.APPROVED_BY_MANAGER]: {
    label: "Manager đã duyệt",
    cls: "text-emerald-700",
  },
  [RequestStatus.APPROVED_BY_CFO]: {
    label: "CFO đã duyệt",
    cls: "text-emerald-700",
  },
  [RequestStatus.PAID]: { label: "Đã xử lý", cls: "text-emerald-700" },
  [RequestStatus.REJECTED]: { label: "Từ chối", cls: "text-rose-700" },
  [RequestStatus.CANCELLED]: { label: "Đã hủy", cls: "text-slate-500" },
  [RequestStatus.REVERSED]: { label: "Đã đảo nghiệp vụ", cls: "text-rose-700" },
};


// ─── Sub-components ───────────────────────────────────────────

function StatCard({
  title,
  value,
  sub,
  icon,
  gradient,
  iconBg,
  tooltip,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  gradient: string;
  iconBg: string;
  tooltip?: string;
}) {
  const [showTip, setShowTip] = useState(false);
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm p-5 hover:border-slate-300 transition-all ${gradient}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center shadow-sm`}
        >
          <span className="text-white">{icon}</span>
        </div>
        {tooltip && (
          <div className="relative">
            <button
              type="button"
              onMouseEnter={() => setShowTip(true)}
              onMouseLeave={() => setShowTip(false)}
              className="w-5 h-5 rounded-full bg-slate-50 flex items-center justify-center text-xs text-slate-500 hover:bg-white/20 transition-colors"
            >
              i
            </button>
            {showTip && (
              <div className="absolute right-0 top-7 w-56 border border-slate-200 bg-white text-slate-900 text-xs rounded-lg p-3 z-20 shadow-xl">
                {tooltip}
              </div>
            )}
          </div>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-1">{title}</p>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {subtitle && (
            <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export function EmployeeDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<EmployeeDashboardResponse | null>(null);
  const [pendingRequests, setPendingRequests] = useState<RequestListItem[]>([]);
  const [spendingData, setSpendingData] = useState<SpendingPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [
          walletResult,
          summaryResult,
          requestsResult,
          payslipResult,
          transactionsResult,
          spendingResult,
        ] =
          await Promise.allSettled([
            api.get<WalletResponse>("/api/v1/wallet"),
            api.get<RequestSummaryResponse>("/api/v1/requests/summary"),
            api.get<PaginatedResponse<RequestListItem>>("/api/v1/requests?status=PENDING&page=1&limit=3"),
            api.get<PaginatedResponse<PayslipListItem>>("/api/v1/payslips?page=1&limit=1"),
            api.get<
              PaginatedResponse<LedgerEntryResponse>
              | { content: LedgerEntryResponse[] }
              | LedgerEntryResponse[]
            >("/api/v1/wallet/transactions?page=0&size=5"),
            api.get<{ points: SpendingPoint[] }>("/api/v1/dashboard/analytics/employee"),
          ]);

        const wallet = walletResult.status === "fulfilled" ? walletResult.value.data : null;
        const summary = summaryResult.status === "fulfilled" ? summaryResult.value.data : null;
        const pendingItems = requestsResult.status === "fulfilled" ? requestsResult.value.data.items : null;
        const pendingCount = requestsResult.status === "fulfilled" ? requestsResult.value.data.total : null;
        const recentPayslip = payslipResult.status === "fulfilled" ? payslipResult.value.data : null;
        const recentTransactions =
          transactionsResult.status === "fulfilled"
            ? transactionsResult.value.data
            : null;

        if (spendingResult.status === "fulfilled") {
          setSpendingData(spendingResult.value.data.points ?? []);
        }

        setData({
          wallet: wallet ? mapWalletResponse(wallet) : { balance: 0, lockedBalance: 0, availableBalance: 0 },
          pendingRequestsCount:
            summary?.totalPendingApproval ?? pendingCount ?? 0,
          recentTransactions: mapRecentTransactions(recentTransactions),
          recentPayslip: mapRecentPayslip(recentPayslip),
        });
        setPendingRequests(pendingItems ?? []);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const availableBalance = data
    ? (data.wallet.availableBalance ??
      data.wallet.balance -
        (data.wallet.lockedBalance ?? data.wallet.pendingBalance ?? 0))
    : 0;
  const lockedBalance = data
    ? (data.wallet.lockedBalance ?? data.wallet.pendingBalance ?? 0)
    : 0;

  const today = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="animate-spin h-8 w-8 text-blue-500"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-slate-500 text-sm">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-cyan-600 text-white shadow-xl shadow-blue-900/15">
        <div className="relative p-6 sm:p-8">
          <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 right-10 h-24 w-24 rounded-full bg-cyan-300/20 blur-2xl" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">IFMS workspace</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Xin chào, {user?.fullName || "Bạn"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-blue-100">
              Hôm nay là {today}. Theo dõi ví cá nhân, yêu cầu, phiếu lương và hoạt động gần đây tại một nơi.
            </p>
          </div>
        </div>
      </section>

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Thao tác nhanh
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Tạo yêu cầu mới hoặc theo dõi các luồng tài chính cá nhân.
          </p>
        </div>
        <Link
          href="/requests/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
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
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Tạo yêu cầu mới
        </Link>
      </div>

      {/* ── Section A: Stats Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          title="Số dư khả dụng"
          value={formatCurrency(availableBalance)}
          sub="Số dư hiện tại trừ tiền treo"
          gradient="hover:shadow-blue-500/10 hover:shadow-lg"
          iconBg="bg-linear-to-br from-blue-500 to-blue-600"
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
                strokeWidth={2}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
          }
        />
        <StatCard
          title="Tiền đang khóa"
          value={formatCurrency(lockedBalance)}
          sub="Đang chờ xử lý"
          gradient="hover:shadow-amber-500/10 hover:shadow-lg"
          iconBg="bg-linear-to-br from-amber-500 to-orange-500"
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
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
        <StatCard
          title="Yêu cầu đang chờ"
          value={String(data?.pendingRequestsCount ?? 0).padStart(2, "0")}
          sub={
            data?.recentPayslip
              ? `Lương ${data.recentPayslip.periodName}: ${formatCurrency(data.recentPayslip.finalNetSalary)}`
              : "Chưa có phiếu lương"
          }
          gradient="hover:shadow-purple-500/10 hover:shadow-lg"
          iconBg="bg-linear-to-br from-violet-500 to-purple-600"
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
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          }
        />
      </div>

      {/* ── Section B: Spending Chart ── */}
      <SectionCard
        title="Chi tiêu theo tháng"
        subtitle="6 tháng gần nhất — chi phí & tạm ứng đã thanh toán"
      >
        {spendingData.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
            Chưa có dữ liệu chi tiêu.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240} debounce={100}>
            <BarChart data={spendingData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}M`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  color: "#1e293b",
                  fontSize: "12px",
                }}
                formatter={(value, name) => [
                  formatCurrency(Number(value)),
                  name === "chiTieu" ? "Chi phí" : "Tạm ứng",
                ]}
                labelStyle={{ color: "#94a3b8", marginBottom: 4 }}
              />
              <Legend
                wrapperStyle={{ paddingTop: 16, fontSize: 12, color: "#94a3b8" }}
                formatter={(value: string) => (value === "chiTieu" ? "Chi phí" : "Tạm ứng")}
                iconType="circle"
              />
              <Bar dataKey="chiTieu" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="tamUng" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      {/* ── Section C: Activity ── */}
      <div>
        {/* Recent Transactions Activity Feed */}
        <SectionCard
          title="Hoạt động gần đây"
          subtitle="Giao dịch mới nhất"
          action={
            <Link
              href="/wallet/transactions"
              className="text-xs text-blue-600 hover:text-blue-700 transition-colors font-medium"
            >
              Xem tất cả →
            </Link>
          }
        >
          <div className="space-y-3">
            {(data?.recentTransactions ?? []).map((tx) => {
              const isCredit = tx.direction === TransactionDirection.CREDIT;
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isCredit
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {isCredit
                          ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
                          : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />}
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {isCredit ? "Tiền vào" : "Tiền ra"}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{tx.transactionCode}</p>
                      <p className="text-xs text-slate-500">{formatRelativeTime(tx.createdAt)}</p>
                    </div>
                  </div>
                  <span
                    className={`text-sm font-bold shrink-0 ${
                      isCredit ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {isCredit ? "+" : "-"}
                    {formatCurrency(tx.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      {/* ── Section C: Pending Requests + Quick Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Requests List */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Yêu cầu đang xử lý"
            subtitle="Cần theo dõi"
            action={
              <Link
                href="/requests"
                className="text-xs text-blue-600 hover:text-blue-700 transition-colors font-medium"
              >
                Xem tất cả →
              </Link>
            }
          >
            {pendingRequests.length === 0 ? (
              <div className="text-center py-8">
                <svg
                  className="w-10 h-10 text-slate-600 mx-auto mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <p className="text-slate-500 text-sm">
                  Không có yêu cầu nào đang chờ xử lý
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map((req) => {
                  const typeConf = REQUEST_TYPE_CONFIG[req.type];
                  const statusConf = REQUEST_STATUS_CONFIG[req.status];
                  return (
                    <Link
                      key={req.id}
                      href={`/requests/${req.id}`}
                      className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 hover:border-slate-200 hover:bg-blue-50 transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${typeConf.badgeCls}`}
                        >
                          {typeConf.label}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate group-hover:text-blue-700 transition-colors">
                            {req.description ?? req.requestCode}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {req.projectName} • {formatDateTime(req.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-slate-900">
                          {formatCurrency(req.amount)}
                        </p>
                        <p
                          className={`text-xs font-medium mt-0.5 ${statusConf.cls}`}
                        >
                          {statusConf.label}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Quick Actions */}
        <SectionCard
          title="Thao tác nhanh"
          subtitle="Các chức năng thường dùng"
        >
          <div className="flex flex-col gap-2.5">
            <QuickAction
              href="/requests/new"
              label="Tạo yêu cầu mới"
              sub="Tạm ứng / Hoàn chi / Quyết toán tạm ứng"
              iconBg="bg-linear-to-br from-violet-500 to-purple-600"
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
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              }
            />
            <QuickAction
              href="/wallet/withdraw"
              label="Rút tiền"
              sub="Chuyển về tài khoản ngân hàng"
              iconBg="bg-linear-to-br from-blue-500 to-blue-600"
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
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              }
            />
            <QuickAction
              href="/wallet/deposit"
              label="Nạp tiền"
              sub="Nạp tiền vào ví qua QR"
              iconBg="bg-linear-to-br from-emerald-500 to-teal-600"
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
                    d="M12 6v12m6-6H6"
                  />
                </svg>
              }
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ─── Quick Action Button ──────────────────────────────────────

function QuickAction({
  href,
  label,
  sub,
  icon,
  iconBg,
}: {
  href: string;
  label: string;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 hover:border-slate-300 hover:bg-blue-50 transition-all group"
    >
      <div
        className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center shrink-0 text-white shadow-sm group-hover:scale-105 transition-transform`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900 group-hover:text-blue-700 transition-colors">
          {label}
        </p>
        {sub && <p className="text-xs text-slate-500 mt-0.5 truncate">{sub}</p>}
      </div>
      <svg
        className="w-4 h-4 text-slate-400 ml-auto shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5l7 7-7 7"
        />
      </svg>
    </Link>
  );
}
