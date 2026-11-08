"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ApiError, api } from "@/lib/api-client";
import {
  PaginatedResponse,
  RequestStatus,
  RequestType,
  TLApprovalListItem,
} from "@/types";
import { formatCurrency, formatRelativeTime as formatSharedRelativeTime } from "@/lib/format";
import { CardListSkeleton } from "@/components/ui/skeleton";
import { normalizeTLApprovalListItem } from "@/lib/adapters/team-leader";
import { useToast } from "@/contexts/toast-context";
import { useAuth } from "@/contexts/auth-context";

const PAGE_LIMIT = 10;

type ApprovalTab = "pending" | "approved";

function parseApprovalTab(value: string | null): ApprovalTab {
  return value === "approved" ? "approved" : "pending";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(-2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function getTypeClass(type: RequestType): string {
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

function getTypeLabel(type: RequestType): string {
  switch (type) {
    case RequestType.ADVANCE:
      return "Tạm ứng";
    case RequestType.EXPENSE:
      return "Chi phí";
    case RequestType.REIMBURSE:
      return "Hoàn ứng";
    default:
      return type;
  }
}

function getStatusLabel(status: RequestStatus): string {
  if (status === RequestStatus.PAID) return "Đã giải ngân";
  if (status === RequestStatus.APPROVED_BY_TEAM_LEADER) return "Đã duyệt";
  return "Chờ duyệt";
}

function getStatusClass(status: RequestStatus): string {
  if (status === RequestStatus.PAID) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === RequestStatus.APPROVED_BY_TEAM_LEADER) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function parseType(value: string | null): RequestType | undefined {
  if (!value) return undefined;
  const valid = [
    RequestType.ADVANCE,
    RequestType.EXPENSE,
    RequestType.REIMBURSE,
  ];
  return valid.includes(value as RequestType)
    ? (value as RequestType)
    : undefined;
}

function parsePage(value: string | null): number {
  const page = Number(value ?? "1");
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function pickItems<T>(payload: PaginatedResponse<T> | T[]): T[] {
  return Array.isArray(payload) ? payload : payload.items;
}


export default function TLApprovalsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { user } = useAuth();

  const searchParamsString = searchParams.toString();
  const typeFilter = useMemo(
    () => parseType(searchParams.get("type")),
    [searchParams],
  );
  const search = useMemo(
    () => searchParams.get("search") ?? "",
    [searchParams],
  );
  const page = useMemo(
    () => parsePage(searchParams.get("page")),
    [searchParams],
  );
  const approvalTab = useMemo(
    () => parseApprovalTab(searchParams.get("tab")),
    [searchParams],
  );
  const approvalStatus =
    approvalTab === "approved"
      ? RequestStatus.APPROVED_BY_TEAM_LEADER
      : RequestStatus.PENDING;
  const isApprovedTab = approvalTab === "approved";

  const [items, setItems] = useState<TLApprovalListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const pushWithParams = useCallback(
    (params: URLSearchParams) => {
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router],
  );

  const updateParam = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParamsString);
      if (value && value.trim()) {
        params.set(key, value.trim());
      } else {
        params.delete(key);
      }
      if (key !== "page") params.delete("page");
      pushWithParams(params);
    },
    [pushWithParams, searchParamsString],
  );

  const goToPage = useCallback(
    (nextPage: number) => {
      const params = new URLSearchParams(searchParamsString);
      if (nextPage <= 1) {
        params.delete("page");
      } else {
        params.set("page", String(nextPage));
      }
      pushWithParams(params);
    },
    [pushWithParams, searchParamsString],
  );

  const handleTabChange = useCallback(
    (nextTab: ApprovalTab) => {
      const params = new URLSearchParams(searchParamsString);
      if (nextTab === "pending") params.delete("tab");
      else params.set("tab", nextTab);
      params.delete("page");
      pushWithParams(params);
    },
    [pushWithParams, searchParamsString],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed === search) return;
      updateParam("search", trimmed || undefined);
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchInput, search, updateParam]);

  useEffect(() => {
    let cancelled = false;

    const loadApprovals = async () => {
      setLoading(true);

      try {
        const query = new URLSearchParams();
        if (typeFilter) query.set("type", typeFilter);
        query.set("status", approvalStatus);
        if (search.trim()) query.set("search", search.trim());
        query.set("page", String(Math.max(0, page - 1)));
        query.set("size", String(PAGE_LIMIT));

        const res = await api.get<PaginatedResponse<unknown> | unknown[]>(
          `/api/v1/team-leader/approvals?${query.toString()}`,
        );

        if (cancelled) return;

        const normalizedItems = pickItems(res.data).map((item) =>
          normalizeTLApprovalListItem(item),
        );

        const apiTotal = Array.isArray(res.data)
          ? normalizedItems.length
          : res.data.total;
        const apiTotalPages = Array.isArray(res.data)
          ? Math.max(1, Math.ceil(apiTotal / PAGE_LIMIT))
          : res.data.totalPages;

        setItems(normalizedItems);
        setTotal(apiTotal);
        setTotalPages(apiTotalPages);
      } catch (err) {
        if (cancelled) return;
        setItems([]);
        setTotal(0);
        setTotalPages(1);
        toast.error(err instanceof ApiError ? err.apiMessage : "Không thể tải danh sách yêu cầu.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadApprovals();

    return () => {
      cancelled = true;
    };
  }, [approvalStatus, goToPage, page, search, typeFilter, toast, user?.id]);

  const typeTabs: { label: string; value?: RequestType }[] = [
    { label: "Tất cả" },
    { label: "Tạm ứng", value: RequestType.ADVANCE },
    { label: "Chi phí", value: RequestType.EXPENSE },
    { label: "Hoàn ứng", value: RequestType.REIMBURSE },
  ];
  const filtered = Boolean(typeFilter || search);
  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const overBudgetCount = items.filter((item) => {
    const phaseCurrentSpent = item.phase.currentSpent ?? 0;
    const phaseBudgetLimit = item.phase.budgetLimit ?? 0;
    return phaseBudgetLimit > 0 && phaseCurrentSpent + item.amount > phaseBudgetLimit;
  }).length;
  const uniqueRequesters = new Set(items.map((item) => item.requester.id)).size;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-indigo-200 bg-linear-to-br from-indigo-700 via-blue-600 to-cyan-600 text-white shadow-xl shadow-indigo-900/15">
        <div className="relative px-6 py-7 sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.28),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(103,232,249,0.22),_transparent_34%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-100">Trung tâm phê duyệt</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Duyệt yêu cầu</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100">
                Rà soát yêu cầu, kiểm tra ngân sách giai đoạn và xử lý các đề xuất từ thành viên trong nhóm.
              </p>
            </div>

            <div className="inline-flex w-fit items-center gap-2 rounded-2xl border border-white/25 bg-white/15 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-white" />
              {total.toLocaleString("vi-VN")} {isApprovedTab ? "đã duyệt" : "chờ duyệt"}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={isApprovedTab ? "Đã duyệt" : "Hàng chờ"} value={total.toLocaleString("vi-VN")} helper={`${items.length} yêu cầu đang hiển thị`} tone="blue" />
        <MetricCard label={isApprovedTab ? "Tổng đã duyệt" : "Tổng tiền"} value={formatCurrency(totalAmount)} helper="Giá trị trên trang hiện tại" tone="blue" />
        <MetricCard label="Nhân sự gửi" value={String(uniqueRequesters)} helper={isApprovedTab ? "Người có yêu cầu đã duyệt" : "Người đang chờ phê duyệt"} tone="indigo" />
        <MetricCard label="Cần kiểm tra" value={String(overBudgetCount)} helper="Có nguy cơ vượt ngân sách giai đoạn" tone="rose" />
      </section>

      <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Bộ lọc duyệt yêu cầu</h2>
            <p className="mt-1 text-sm text-slate-500">Lọc theo loại yêu cầu hoặc tìm nhanh theo mã và nhân viên.</p>
          </div>
          {filtered && (
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams(searchParamsString);
                params.delete("type");
                params.delete("search");
                params.delete("page");
                pushWithParams(params);
              }}
              className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleTabChange("pending")}
            className={`rounded-2xl border px-4 py-2.5 text-sm font-semibold transition ${
              !isApprovedTab
                ? "border-blue-200 bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50"
            }`}
          >
            Chưa duyệt
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("approved")}
            className={`rounded-2xl border px-4 py-2.5 text-sm font-semibold transition ${
              isApprovedTab
                ? "border-blue-200 bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50"
            }`}
          >
            Đã duyệt
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {typeTabs.map((tab) => {
            const active =
              typeFilter === tab.value || (!typeFilter && !tab.value);
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => updateParam("type", tab.value)}
                className={`rounded-2xl border px-4 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "border-blue-200 bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative mt-4">
          <svg
            className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-4.35-4.35m1.6-5.65a7.25 7.25 0 11-14.5 0 7.25 7.25 0 0114.5 0z"
            />
          </svg>
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Tìm mã YC, tên nhân viên..."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
          />
        </div>
      </section>

      {loading ? (
        <CardListSkeleton rows={5} height="h-36" />
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <svg
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0l-2 7H6l-2-7m16 0H4"
              />
            </svg>
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">
            {isApprovedTab
              ? "Chưa có yêu cầu nào đã duyệt"
              : "Không có yêu cầu nào đang chờ duyệt"}
          </h3>
          <p className="mt-1 text-sm text-slate-500">Hàng chờ đang trống hoặc bộ lọc chưa có dữ liệu phù hợp.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const phaseCurrentSpent = item.phase.currentSpent ?? 0;
            const phaseBudgetLimit = item.phase.budgetLimit ?? 0;
            const projectedSpent = phaseCurrentSpent + item.amount;
            const overBudget =
              phaseBudgetLimit > 0 && projectedSpent > phaseBudgetLimit;
            const projectLabel = item.project.name ?? item.project.projectCode;
            const phaseLabel = item.phase.name ?? item.phase.phaseCode;
            const categoryLabel =
              item.category?.name ?? item.categoryName ?? "Chưa phân loại";
            const isOwnRequest = item.requester.id === user?.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => router.push(`/team-leader/approvals/${item.id}`)}
                className="group w-full rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-900/10"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 font-semibold ${getTypeClass(item.type)}`}
                    >
                      {getTypeLabel(item.type)}
                    </span>
                    <span className="font-mono font-semibold text-slate-600">
                      {item.requestCode}
                    </span>
                    <span className="text-slate-500">
                      {formatSharedRelativeTime(item.createdAt)}
                    </span>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 font-semibold ${getStatusClass(item.status)}`}
                    >
                      {getStatusLabel(item.status)}
                    </span>
                    {isOwnRequest && (
                      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
                        Yêu cầu của bạn · không thể tự duyệt
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-xs font-bold text-white">
                      {getInitials(item.requester.fullName)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {item.requester.fullName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {item.requester.employeeCode}
                      </p>
                    </div>
                  </div>

                  <p className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    {projectLabel} <span className="text-slate-500">/</span>{" "}
                    {phaseLabel} <span className="text-slate-500">/</span>{" "}
                    {categoryLabel}
                  </p>

                  <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      {phaseBudgetLimit <= 0 ? (
                        <p className="text-sm text-slate-500">
                          Chưa có dữ liệu ngân sách giai đoạn
                        </p>
                      ) : overBudget ? (
                        <p className="text-sm text-rose-700 font-medium">
                          Vượt ngân sách giai đoạn
                        </p>
                      ) : (
                        <p className="text-sm text-emerald-700">
                          Ngân sách giai đoạn còn an toàn
                        </p>
                      )}
                      <p className="text-xs text-slate-500 mt-1">
                        {formatCurrency(phaseCurrentSpent)} +{" "}
                        {formatCurrency(item.amount)} /{" "}
                        {formatCurrency(phaseBudgetLimit)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <p className="text-lg font-semibold text-slate-900">
                        {formatCurrency(item.amount)}
                      </p>
                      <span className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition group-hover:border-blue-200">
                        Xem chi tiết →
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Hiển thị <span className="font-semibold text-slate-900">{items.length}</span> trong tổng{" "}
          <span className="font-semibold text-slate-900">{total.toLocaleString("vi-VN")}</span> yêu cầu
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Trước
          </button>
          <button
            type="button"
            onClick={() => goToPage(page + 1)}
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
  tone: "blue" | "indigo" | "rose";
}) {
  const toneClassName = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
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
