"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, api } from "@/lib/api-client";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { useToast } from "@/contexts/toast-context";
import { useAuth } from "@/contexts/auth-context";
import {
  RequestStatusBadge,
  RequestTypeBadge,
} from "@/components/ui/status-badge";
import {
  PaginatedResponse,
  RequestFilterParams,
  RequestListItem,
  RequestStatus,
  RequestSummaryResponse,
  RequestType,
  RoleName,
} from "@/types";

const PAGE_LIMIT = 8;

const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  [RequestStatus.PENDING]: "Chờ duyệt",
  [RequestStatus.APPROVED_BY_TEAM_LEADER]: "TL đã duyệt — chờ giải ngân",
  [RequestStatus.ACCOUNTANT_VERIFIED]: "Chứng từ đã xác nhận — chờ hoàn tiền",
  [RequestStatus.APPROVED_BY_MANAGER]: "Manager đã duyệt",
  [RequestStatus.APPROVED_BY_CFO]: "CFO đã duyệt",
  [RequestStatus.PAID]: "Đã xử lý",
  [RequestStatus.REJECTED]: "Từ chối",
  [RequestStatus.CANCELLED]: "Đã hủy",
  [RequestStatus.REVERSED]: "Đã đảo nghiệp vụ",
};

const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  [RequestType.ADVANCE]: "Tạm ứng",
  [RequestType.EXPENSE]: "Hoàn chi nhân viên",
  [RequestType.REIMBURSE]: "Quyết toán tạm ứng",
  [RequestType.PROJECT_TOPUP]: "Cấp vốn dự án",
  [RequestType.DEPARTMENT_TOPUP]: "Cấp vốn phòng ban",
};

const CREATE_ACTION_BY_ROLE: Partial<
  Record<RoleName, { href: string; label: string; description: string }>
> = {
  [RoleName.EMPLOYEE]: {
    href: "/requests/new",
    label: "Tạo yêu cầu mới",
    description: "Theo dõi tạm ứng, hoàn chi nhân viên và quyết toán tạm ứng theo từng bước xử lý.",
  },
  [RoleName.TEAM_LEADER]: {
    href: "/team-leader/projects",
    label: "Xin cấp vốn dự án",
    description: "Theo dõi các yêu cầu bạn đã tạo; Trưởng nhóm tạo yêu cầu cấp vốn từ màn hình chi tiết dự án.",
  },
  [RoleName.MANAGER]: {
    href: "/dashboard",
    label: "Xin cấp vốn phòng ban",
    description: "Theo dõi các yêu cầu bạn đã tạo; Manager tạo yêu cầu cấp vốn phòng ban từ dashboard.",
  },
};

function requestTypesForRole(role: RoleName | undefined): RequestType[] {
  if (role === RoleName.EMPLOYEE) {
    return [RequestType.ADVANCE, RequestType.EXPENSE, RequestType.REIMBURSE];
  }
  if (role === RoleName.TEAM_LEADER) {
    return [RequestType.PROJECT_TOPUP];
  }
  if (role === RoleName.MANAGER) {
    return [RequestType.DEPARTMENT_TOPUP];
  }
  return [];
}

function parseStatus(value: string | null): RequestStatus | undefined {
  if (!value) return undefined;
  const valid = new Set<string>(Object.values(RequestStatus));
  return valid.has(value) ? (value as RequestStatus) : undefined;
}

function parseType(value: string | null): RequestType | undefined {
  if (!value) return undefined;
  const valid = new Set<string>(Object.values(RequestType));
  return valid.has(value) ? (value as RequestType) : undefined;
}

function buildInitialState(searchParams: {
  get: (key: string) => string | null;
}): {
  filters: RequestFilterParams;
  fromDate: string;
  toDate: string;
  page: number;
} {
  const pageRaw = Number(searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  return {
    filters: {
      status: parseStatus(searchParams.get("status")),
      type: parseType(searchParams.get("type")),
      page,
      limit: PAGE_LIMIT,
    },
    fromDate: searchParams.get("from") ?? "",
    toDate: searchParams.get("to") ?? "",
    page,
  };
}


export default function RequestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const currentRole = user?.role as RoleName | undefined;
  const createAction = currentRole ? CREATE_ACTION_BY_ROLE[currentRole] : undefined;
  const requestTypeOptions = requestTypesForRole(currentRole);

  const initial = useMemo(
    () => buildInitialState(searchParams),
    [searchParams],
  );

  const [requests, setRequests] = useState<RequestListItem[]>([]);
  const [summary, setSummary] = useState<RequestSummaryResponse | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(initial.page);
  const [totalPages, setTotalPages] = useState(1);
  const [sseVersion, setSseVersion] = useState(0);
  const [filters, setFilters] = useState<RequestFilterParams>(initial.filters);
  const [fromDate, setFromDate] = useState(initial.fromDate);
  const [toDate, setToDate] = useState(initial.toDate);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const next = buildInitialState(searchParams);
    setFilters(next.filters);
    setFromDate(next.fromDate);
    setToDate(next.toDate);
    setPage(next.page);
  }, [searchParams]);

  const syncUrl = useCallback(
    (
      nextFilters: RequestFilterParams,
      nextPage: number,
      nextFrom: string,
      nextTo: string,
    ) => {
      const params = new URLSearchParams();
      if (nextFilters.status) params.set("status", nextFilters.status);
      if (nextFilters.type) params.set("type", nextFilters.type);
      if (nextFrom) params.set("from", nextFrom);
      if (nextTo) params.set("to", nextTo);
      if (nextPage > 1) params.set("page", String(nextPage));

      const query = params.toString();
      router.replace(query ? `/requests?${query}` : "/requests");
    },
    [router],
  );

  useEffect(() => {
    const handleNotification = (event: Event) => {
      const n = (event as CustomEvent).detail as { refType?: string | null };
      if (n?.refType === "REQUEST") setSseVersion((v) => v + 1);
    };
    window.addEventListener("notifications:new", handleNotification);
    return () => window.removeEventListener("notifications:new", handleNotification);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);

      try {
        const query = new URLSearchParams();
        if (filters.status) query.set("status", filters.status);
        if (filters.type) query.set("type", filters.type);
        if (fromDate) query.set("from", fromDate);
        if (toDate) query.set("to", toDate);
        query.set("page", String(page));
        query.set("limit", String(PAGE_LIMIT));

        const [reqRes, sumRes] = await Promise.all([
          api.get<PaginatedResponse<RequestListItem>>(
            `/api/v1/requests?${query.toString()}`,
          ),
          api.get<RequestSummaryResponse>("/api/v1/requests/summary"),
        ]);

        if (cancelled) return;

        setRequests(reqRes.data.items);
        setTotal(reqRes.data.total);
        setTotalPages(reqRes.data.totalPages);
        setSummary(sumRes.data);
      } catch (err) {
        if (cancelled) return;

        setRequests([]);
        setTotal(0);
        setTotalPages(1);
        setSummary(null);

        if (err instanceof ApiError) {
          toast.error(err.apiMessage);
        } else {
          toast.error("Không thể tải danh sách yêu cầu.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [filters, page, fromDate, toDate, syncUrl, toast, sseVersion]);

  const handleStatusChange = (value: string) => {
    const nextFilters: RequestFilterParams = {
      ...filters,
      status: value === "ALL" ? undefined : (value as RequestStatus),
      page: 1,
      limit: PAGE_LIMIT,
    };
    setFilters(nextFilters);
    setPage(1);
    syncUrl(nextFilters, 1, fromDate, toDate);
  };

  const handleTypeChange = (value: string) => {
    const nextFilters: RequestFilterParams = {
      ...filters,
      type: value === "ALL" ? undefined : (value as RequestType),
      page: 1,
      limit: PAGE_LIMIT,
    };
    setFilters(nextFilters);
    setPage(1);
    syncUrl(nextFilters, 1, fromDate, toDate);
  };

  const handleDateChange = (key: "from" | "to", value: string) => {
    if (key === "from") {
      setFromDate(value);
      syncUrl(filters, 1, value, toDate);
    } else {
      setToDate(value);
      syncUrl(filters, 1, fromDate, value);
    }

    const nextFilters: RequestFilterParams = {
      ...filters,
      page: 1,
      limit: PAGE_LIMIT,
    };
    setFilters(nextFilters);
    setPage(1);
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    setPage(nextPage);
    syncUrl(filters, nextPage, fromDate, toDate);
  };

  const pendingCount = summary?.totalPendingApproval ?? 0;
  const approvedCount = summary?.totalApproved ?? 0;
  const rejectedCount = summary?.totalRejected ?? 0;
  const totalCount =
    (summary?.totalPendingApproval ?? 0) +
    (summary?.totalApproved ?? 0) +
    (summary?.totalPaid ?? 0) +
    (summary?.totalRejected ?? 0) +
    (summary?.totalCancelled ?? 0);
  const paidCount = summary?.totalPaid ?? 0;
  const cancelledCount = summary?.totalCancelled ?? 0;
  const filtered = Boolean(filters.status || filters.type || fromDate || toDate);

  const clearFilters = () => {
    const nextFilters: RequestFilterParams = {
      page: 1,
      limit: PAGE_LIMIT,
    };
    setFilters(nextFilters);
    setFromDate("");
    setToDate("");
    setPage(1);
    syncUrl(nextFilters, 1, "", "");
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-cyan-600 text-white shadow-xl shadow-blue-900/15">
        <div className="relative px-6 py-7 sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.28),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(125,211,252,0.24),_transparent_34%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">Personal requests</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Yêu cầu của tôi</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100">
                {createAction?.description ??
                  "Theo dõi các yêu cầu liên quan đến tài khoản của bạn với trạng thái xử lý rõ ràng theo từng bước phê duyệt."}
              </p>
            </div>

            {createAction && (
              <Link
                href={createAction.href}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-lg shadow-blue-950/20 transition hover:bg-blue-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v12m6-6H6" />
                </svg>
                {createAction.label}
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Tổng yêu cầu" value={totalCount.toLocaleString("vi-VN")} helper={`${paidCount} đã chi trả`} tone="blue" />
        <MetricCard label="Đang chờ" value={String(pendingCount)} helper="Cần phê duyệt hoặc giải ngân" tone="amber" />
        <MetricCard label="Đã duyệt" value={String(approvedCount)} helper="Đã qua bước phê duyệt" tone="emerald" />
        <MetricCard label="Đóng luồng" value={String(rejectedCount + cancelledCount)} helper={`${rejectedCount} từ chối, ${cancelledCount} hủy`} tone="rose" />
      </section>

      <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Bộ lọc yêu cầu</h2>
            <p className="mt-1 text-sm text-slate-500">Lọc nhanh theo trạng thái, loại yêu cầu hoặc khoảng thời gian tạo.</p>
          </div>
          {filtered && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select
            value={filters.status ?? "ALL"}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          >
            <option value="ALL">Tất cả trạng thái</option>
            {Object.values(RequestStatus).map((status) => (
              <option key={status} value={status}>
                {REQUEST_STATUS_LABELS[status]}
              </option>
            ))}
          </select>

          <select
            value={filters.type ?? "ALL"}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          >
            <option value="ALL">Tất cả loại</option>
            {requestTypeOptions.map((type) => (
              <option key={type} value={type}>
                {REQUEST_TYPE_LABELS[type]}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={fromDate}
            onChange={(e) => handleDateChange("from", e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />

          <input
            type="date"
            value={toDate}
            onChange={(e) => handleDateChange("to", e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-1 border-b border-slate-200 bg-blue-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Danh sách yêu cầu</h2>
            <p className="text-sm text-slate-500">Bấm vào một dòng để xem chi tiết luồng xử lý.</p>
          </div>
          <span className="text-sm font-medium text-blue-700">Trang {page}/{totalPages}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Mã yêu cầu
                </th>
                <th className="px-4 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Loại
                </th>
                <th className="px-4 py-3.5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Số tiền
                </th>
                <th className="px-4 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-4 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Dự án
                </th>
                <th className="px-4 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Ngày tạo
                </th>
                <th className="px-4 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-14 text-center text-sm text-slate-500"
                  >
                    <span className="inline-flex items-center gap-2">
                      <svg
                        className="animate-spin h-5 w-5 text-blue-500"
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
                      Đang tải dữ liệu yêu cầu...
                    </span>
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-14 text-center text-sm text-slate-500"
                  >
                    Không có yêu cầu phù hợp bộ lọc.
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr
                    key={request.id}
                    className="cursor-pointer border-b border-slate-100 transition hover:bg-blue-50/40 last:border-b-0"
                    onClick={() => router.push(`/requests/${request.id}`)}
                  >
                    <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                      {request.requestCode}
                    </td>
                    <td className="px-4 py-3">
                      <RequestTypeBadge type={request.type} />
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                      {formatCurrency(request.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <RequestStatusBadge status={request.status} type={request.type} />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {request.projectName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {formatDateTime(request.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/requests/${request.id}`);
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50"
                      >
                        Xem chi tiết
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Hiển thị <span className="font-semibold text-slate-900">{requests.length}</span> trong tổng{" "}
            <span className="font-semibold text-slate-900">{total.toLocaleString("vi-VN")}</span> yêu cầu
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Trước
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sau
            </button>
          </div>
        </div>

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
  tone: "blue" | "amber" | "emerald" | "rose";
}) {
  const toneClassName = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
  }[tone];

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`mb-4 h-2 w-12 rounded-full border ${toneClassName}`} />
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{helper}</p>
    </div>
  );
}
