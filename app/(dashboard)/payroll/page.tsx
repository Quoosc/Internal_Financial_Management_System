"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/contexts/toast-context";
import { PaginatedResponse, PayslipListItem, PayslipStatus } from "@/types";

interface PayrollFilters {
  year?: number;
  status?: PayslipStatus;
}

const PAGE_LIMIT = 12;


function getStatusClass(status: PayslipStatus): string {
  if (status === PayslipStatus.PAID) {
    return "bg-emerald-50 border-emerald-200 text-emerald-700";
  }
  return "bg-amber-50 border-amber-200 text-amber-700";
}

function getStatusLabel(status: PayslipStatus): string {
  return status === PayslipStatus.PAID ? "Đã chi" : "Nháp";
}

function getPayDate(item: PayslipListItem): string {
  if (item.status !== PayslipStatus.PAID) return "—";
  return `Tháng ${item.month}/${item.year}`;
}

const MONTH_COLORS = [
  "bg-blue-50 text-blue-700",
  "bg-indigo-50 text-indigo-700",
  "bg-violet-50 text-violet-700",
  "bg-purple-50 text-purple-700",
  "bg-rose-50 text-rose-700",
  "bg-orange-50 text-orange-700",
  "bg-amber-50 text-amber-700",
  "bg-yellow-50 text-yellow-700",
  "bg-lime-50 text-lime-700",
  "bg-emerald-50 text-emerald-700",
  "bg-teal-50 text-teal-700",
  "bg-cyan-50 text-cyan-700",
];

const MONTH_SHORT = ["T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12"];

function parseStatus(value: string | null): PayslipStatus | undefined {
  if (!value) return undefined;
  if (value === PayslipStatus.DRAFT || value === PayslipStatus.PAID) {
    return value;
  }
  return undefined;
}

function buildInitialState(searchParams: {
  get: (key: string) => string | null;
}): {
  filters: PayrollFilters;
  page: number;
} {
  const pageRaw = Number(searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const yearRaw = Number(searchParams.get("year") ?? "");

  return {
    filters: {
      year: Number.isFinite(yearRaw) && yearRaw > 0 ? yearRaw : undefined,
      status: parseStatus(searchParams.get("status")),
    },
    page,
  };
}

export default function PayrollPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const initial = useMemo(
    () => buildInitialState(searchParams),
    [searchParams],
  );

  const [payslips, setPayslips] = useState<PayslipListItem[]>([]);
  const [summaryItems, setSummaryItems] = useState<PayslipListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(initial.page);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState<PayrollFilters>(initial.filters);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const next = buildInitialState(searchParams);
    setFilters(next.filters);
    setPage(next.page);
  }, [searchParams]);

  const syncUrl = useCallback(
    (nextFilters: PayrollFilters, nextPage: number) => {
      const params = new URLSearchParams();
      if (nextFilters.year) params.set("year", String(nextFilters.year));
      if (nextFilters.status) params.set("status", nextFilters.status);
      if (nextPage > 1) params.set("page", String(nextPage));

      const query = params.toString();
      router.replace(query ? `/payroll?${query}` : "/payroll");
    },
    [router],
  );

  useEffect(() => {
    let cancelled = false;

    const loadPayslips = async () => {
      setLoading(true);

      try {
        const query = new URLSearchParams();
        if (filters.year) query.set("year", String(filters.year));
        if (filters.status) query.set("status", filters.status);
        query.set("page", String(page));
        query.set("limit", String(PAGE_LIMIT));

        const summaryQuery = new URLSearchParams();
        if (filters.year) summaryQuery.set("year", String(filters.year));
        if (filters.status) summaryQuery.set("status", filters.status);
        summaryQuery.set("page", "1");
        summaryQuery.set("limit", "200");

        const [res, summaryRes] = await Promise.all([
          api.get<PaginatedResponse<PayslipListItem>>(
            `/api/v1/payslips?${query.toString()}`,
          ),
          api.get<PaginatedResponse<PayslipListItem>>(
            `/api/v1/payslips?${summaryQuery.toString()}`,
          ),
        ]);

        if (cancelled) return;

        setPayslips(res.data.items);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
        setSummaryItems(summaryRes.data.items);
      } catch (err) {
        if (cancelled) return;

        setPayslips([]);
        setSummaryItems([]);
        setTotal(0);
        setTotalPages(1);

        if (err instanceof ApiError) {
          toast.error(err.apiMessage);
        } else {
          toast.error("Không thể tải danh sách phiếu lương.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadPayslips();

    return () => {
      cancelled = true;
    };
  }, [filters, page, syncUrl, toast]);

  const handleFilterChange = (key: keyof PayrollFilters, value: string) => {
    let parsed: number | PayslipStatus | undefined;

    if (!value) {
      parsed = undefined;
    } else if (key === "status") {
      parsed = value as PayslipStatus;
    } else {
      const num = Number(value);
      parsed = Number.isFinite(num) ? num : undefined;
    }

    const nextFilters: PayrollFilters = {
      ...filters,
      [key]: parsed,
    };

    setFilters(nextFilters);
    setPage(1);
    syncUrl(nextFilters, 1);
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    setPage(nextPage);
    syncUrl(filters, nextPage);
  };

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const totalEarned = summaryItems
    .filter((item) => item.status === PayslipStatus.PAID)
    .reduce((sum, item) => sum + item.finalNetSalary, 0);

  const currentMonthAmount = summaryItems
    .filter((item) => item.year === currentYear && item.month === currentMonth)
    .reduce((sum, item) => sum + item.finalNetSalary, 0);

  const yearOptions = useMemo(() => {
    const years = new Set<number>([currentYear]);
    summaryItems.forEach((item) => years.add(item.year));
    return Array.from(years).sort((a, b) => b - a);
  }, [currentYear, summaryItems]);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-indigo-700 p-6 text-white shadow-xl shadow-blue-900/10">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-50">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Phiếu lương · Cá nhân
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Phiếu lương</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
              Xem lịch sử chi lương cá nhân, số tiền đã nhận và trạng thái từng kỳ lương.
            </p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">Đã nhận</p>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(totalEarned)}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <span className="w-9 h-9 rounded-lg bg-linear-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </span>
          </div>
          <p className="text-sm text-slate-500">Tổng đã nhận</p>
          <p className="text-3xl font-bold text-emerald-700 mt-1">
            {formatCurrency(totalEarned)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <span className="w-9 h-9 rounded-lg bg-linear-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </span>
          </div>
          <p className="text-sm text-slate-500">Số tiền tháng hiện tại</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">
            {formatCurrency(currentMonthAmount)}
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-bold text-slate-900">Bộ lọc phiếu lương</h2>
          <p className="mt-1 text-sm text-slate-500">Lọc theo năm phát sinh và trạng thái chi trả.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select
            value={filters.year ?? ""}
            onChange={(e) => handleFilterChange("year", e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">Tất cả năm</option>
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          <select
            value={filters.status ?? ""}
            onChange={(e) => handleFilterChange("status", e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">Tất cả trạng thái</option>
            <option value={PayslipStatus.DRAFT}>Chờ thanh toán</option>
            <option value={PayslipStatus.PAID}>Đã thanh toán</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-230">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-slate-200 bg-blue-50/80">
                <th className="px-4 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Kỳ lương
                </th>
                <th className="px-4 py-3.5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Thực lĩnh (Net)
                </th>
                <th className="px-4 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-4 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Ngày chi
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-slate-500 text-sm"
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
                      Đang tải phiếu lương...
                    </span>
                  </td>
                </tr>
              ) : payslips.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-slate-500 text-sm"
                  >
                    Không có phiếu lương phù hợp bộ lọc.
                  </td>
                </tr>
              ) : (
                payslips.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-slate-100 hover:bg-blue-50/60 transition-colors cursor-pointer"
                    onClick={() => router.push(`/payroll/${item.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${MONTH_COLORS[(item.month - 1) % 12]}`}>
                          {MONTH_SHORT[item.month - 1]}
                        </div>
                        <div>
                          <p className="text-sm text-slate-900 font-medium">
                            {item.periodName}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {item.payslipCode}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-900 font-semibold">
                      {formatCurrency(item.finalNetSalary)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full border text-xs ${getStatusClass(item.status)}`}
                      >
                        {getStatusLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {getPayDate(item)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 flex items-center justify-between border-t border-slate-200 bg-blue-50">
          <p className="text-sm text-slate-500">
            Tổng {total} phiếu lương • Trang {page}/{totalPages}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 text-sm transition-colors"
            >
              Trước
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 text-sm transition-colors"
            >
              Sau
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
