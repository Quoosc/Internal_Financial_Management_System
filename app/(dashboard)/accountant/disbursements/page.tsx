"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ApiError, api } from "@/lib/api-client";
import { useToast } from "@/contexts/toast-context";
import {
  CompanyFundResponse,
  DisbursementFilterParams,
  DisbursementListItem,
  PaginatedResponse,
  RequestType,
} from "@/types";
import { formatCurrency, formatDateTime, getFundHealthClass } from "@/lib/format";
import { CardListSkeleton } from "@/components/ui/skeleton";
import { isAccountantQueueStatus } from "@/lib/adapters/request-status";
import { toApiPage } from "@/lib/adapters/pagination";

interface DisbursementApprover {
  fullName: string;
  approvedAt: string;
}

interface DisbursementListViewItem extends DisbursementListItem {
  approver?: DisbursementApprover;
}

const PAGE_LIMIT = 10;


function parsePage(value: string | null): number {
  const page = Number(value ?? "1");
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function parseTypeQuery(value: string | null): RequestType | undefined {
  if (!value) return undefined;

  if (value === RequestType.ADVANCE) return RequestType.ADVANCE;
  if (value === RequestType.EXPENSE) return RequestType.EXPENSE;
  if (value === RequestType.REIMBURSE) return RequestType.REIMBURSE;

  return undefined;
}

function pickItems<T>(payload: PaginatedResponse<T> | T[]): T[] {
  return Array.isArray(payload) ? payload : payload.items;
}

function getRequestTypeLabel(type: RequestType): string {
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

function getRequestTypeClass(type: RequestType): string {
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


export default function AccountantDisbursementsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();

  const searchParamsString = searchParams.toString();
  const search = useMemo(
    () => searchParams.get("search") ?? "",
    [searchParams],
  );
  const page = useMemo(
    () => parsePage(searchParams.get("page")),
    [searchParams],
  );
  const type = useMemo(
    () => parseTypeQuery(searchParams.get("type")),
    [searchParams],
  );

  const [items, setItems] = useState<DisbursementListViewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [systemFundBalance, setSystemFundBalance] = useState(0);
  const [fundHealth, setFundHealth] = useState<"HEALTHY" | "LOW" | "CRITICAL">("CRITICAL");
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
      if (nextPage <= 1) params.delete("page");
      else params.set("page", String(nextPage));
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

    const loadDisbursements = async () => {
      setLoading(true);

      try {
        const filters: DisbursementFilterParams = {
          type,
          search: search.trim() || undefined,
          page,
          size: PAGE_LIMIT,
        };

        const query = new URLSearchParams();
        if (filters.type) query.set("type", filters.type);
        if (filters.search) query.set("search", filters.search);
        query.set("page", String(toApiPage(filters.page ?? 1)));
        query.set("size", String(filters.size ?? PAGE_LIMIT));

        const [res, fundRes] = await Promise.all([
          api.get<PaginatedResponse<DisbursementListItem> | DisbursementListItem[]>(
            `/api/v1/accountant/disbursements?${query.toString()}`,
          ),
          api.get<CompanyFundResponse>("/api/v1/company-fund"),
        ]);

        if (cancelled) return;

        const apiItems = pickItems(res.data)
          .filter((item) => isAccountantQueueStatus(item.status))
          .map((item) => ({ ...item }));

        const apiTotal = Array.isArray(res.data) ? apiItems.length : res.data.total;
        const apiTotalPages = Array.isArray(res.data)
          ? Math.max(1, Math.ceil(apiTotal / PAGE_LIMIT))
          : res.data.totalPages;

        setItems(apiItems);
        setTotal(apiTotal);
        setTotalPages(apiTotalPages);
        setSystemFundBalance(fundRes.data.currentWalletBalance);
        setFundHealth(fundRes.data.fundHealth);
      } catch (err) {
        if (cancelled) return;
        setItems([]);
        setTotal(0);
        setTotalPages(1);
        setSystemFundBalance(0);
        setFundHealth("CRITICAL");
        toast.error(err instanceof ApiError ? err.apiMessage : "Không thể tải danh sách giải ngân.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadDisbursements();

    return () => {
      cancelled = true;
    };
  }, [goToPage, page, search, type, toast]);

  const pageApprovedTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.approvedAmount, 0),
    [items],
  );

  const tabs: Array<{ label: string; value?: RequestType }> = [
    { label: "Tất cả" },
    { label: "Tạm ứng", value: RequestType.ADVANCE },
    { label: "Hoàn chi nhân viên", value: RequestType.EXPENSE },
    { label: "Quyết toán tạm ứng", value: RequestType.REIMBURSE },
  ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-indigo-700 p-6 text-white shadow-xl shadow-blue-900/10">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-50">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
              Accountant disbursement desk
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Giải ngân</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
              Theo dõi các yêu cầu đã được phê duyệt và chuẩn bị giải ngân từ quỹ hệ thống.
            </p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">Đang chờ xử lý</p>
            <p className="mt-2 text-3xl font-bold">{total}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Quỹ hệ thống" value={formatCurrency(systemFundBalance)} helper={`Trạng thái: ${fundHealth}`} tone="blue" />
        <MetricCard label="Giá trị trang hiện tại" value={formatCurrency(pageApprovedTotal)} helper={`${items.length} yêu cầu đang hiển thị`} tone="emerald" />
        <MetricCard label="Bộ lọc hiện tại" value={type ? getRequestTypeLabel(type) : "Tất cả"} helper={search ? `Từ khóa: ${search}` : "Không giới hạn từ khóa"} tone="violet" />
      </section>

      <div className="hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Giải ngân</h1>
          <p className="text-slate-500 mt-1">
            Danh sách yêu cầu đã được Trưởng nhóm duyệt và chờ Kế toán xử lý.
          </p>
        </div>
        <span className="inline-flex w-fit px-3 py-1.5 rounded-full border border-amber-300 bg-amber-100 text-amber-700 text-sm font-medium">
          {total} chờ xử lý
        </span>
      </div>

      <div className="hidden">
        <p className="text-sm text-slate-900">
          Quỹ hệ thống:{" "}
          <span className="font-semibold text-slate-900">
            {formatCurrency(systemFundBalance)}
          </span>
        </p>
        <span
          className={`inline-flex w-fit px-2.5 py-1 rounded-full border text-xs font-medium ${getFundHealthClass(fundHealth)}`}
        >
          {fundHealth}
        </span>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Bộ lọc giải ngân</h2>
          <p className="mt-1 text-sm text-slate-500">Lọc nhanh theo loại yêu cầu hoặc mã, nhân viên, dự án.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const active = type === tab.value || (!type && !tab.value);
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => updateParam("type", tab.value)}
                className={`px-3 py-1.5 rounded-xl border text-sm transition-colors ${
                  active
                    ? "bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-600/20"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
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
            placeholder="Tìm theo mã yêu cầu, nhân viên, dự án..."
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
        </div>
      </div>

      {loading ? (
        <CardListSkeleton rows={4} height="h-48" />
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-12 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
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
                d="M3 7h18M3 12h18M3 17h18"
              />
            </svg>
          </div>
          <p className="text-slate-600 mt-4">
            Không có yêu cầu chờ giải ngân theo bộ lọc hiện tại.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const changedAmount = item.approvedAmount !== item.amount;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  router.push(`/accountant/disbursements/${item.id}`)
                }
                className="w-full rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`inline-flex px-2 py-1 rounded-full border ${getRequestTypeClass(item.type)}`}
                    >
                      {getRequestTypeLabel(item.type)}
                    </span>
                    <span className="font-mono text-slate-600">
                      {item.requestCode}
                    </span>
                    <span className="text-slate-500">
                      Tạo lúc {formatDateTime(item.createdAt)}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {item.requester.fullName}{" "}
                      <span className="text-slate-500">
                        ({item.requester.employeeCode})
                      </span>
                    </p>
                    <p className="text-sm text-slate-600">
                      {item.project.name}{" "}
                      <span className="text-slate-500">
                        ({item.project.projectCode})
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Duyệt bởi: {item.approver?.fullName ?? "Trưởng nhóm"}
                      {item.approver?.approvedAt
                        ? ` • ${formatDateTime(item.approver.approvedAt)}`
                        : ""}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                      <p className="text-xs text-slate-500">Số tiền yêu cầu</p>
                      <p className="text-sm font-semibold text-slate-900 mt-1">
                        {formatCurrency(item.amount)}
                      </p>
                    </div>

                    <div
                      className={`rounded-2xl border px-4 py-3 ${
                        changedAmount
                          ? "border-amber-200 bg-amber-50"
                          : "border-blue-100 bg-blue-50/50"
                      }`}
                    >
                      <p
                        className={`text-xs ${changedAmount ? "text-amber-700" : "text-slate-500"}`}
                      >
                        Số tiền giải ngân
                      </p>
                      <p
                        className={`text-sm font-semibold mt-1 ${changedAmount ? "text-amber-700" : "text-slate-900"}`}
                      >
                        {formatCurrency(item.approvedAmount)}
                      </p>
                    </div>

                    <div className="flex items-center md:justify-end">
                      <span className="inline-flex w-fit rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-600/20">
                        Xử lý →
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Trang {page}/{totalPages} • Tổng {total} yêu cầu
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 text-sm transition-colors"
          >
            Trước
          </button>
          <button
            type="button"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 text-sm transition-colors"
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
  tone: "blue" | "emerald" | "violet";
}) {
  const toneClass = {
    blue: "from-blue-50 to-indigo-50 border-blue-100 text-blue-700",
    emerald: "from-emerald-50 to-teal-50 border-emerald-100 text-emerald-700",
    violet: "from-violet-50 to-fuchsia-50 border-violet-100 text-violet-700",
  }[tone];

  return (
    <div className={`rounded-2xl border bg-linear-to-br ${toneClass} p-4 shadow-sm`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-75">{label}</p>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{helper}</p>
    </div>
  );
}
