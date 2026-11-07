"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, api } from "@/lib/api-client";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { useToast } from "@/contexts/toast-context";
import {
  LedgerEntryResponse,
  TransactionDirection,
} from "@/types";

const PAGE_SIZE = 10;

interface SpringPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

interface LegacyPaginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type WalletTransactionsApi =
  | SpringPage<LedgerEntryResponse>
  | LegacyPaginated<LedgerEntryResponse>
  | LedgerEntryResponse[];

interface TransactionFiltersState {
  from?: string;
  to?: string;
}

function getDirectionLabel(direction: TransactionDirection): string {
  return direction === TransactionDirection.CREDIT ? "Tiền vào" : "Tiền ra";
}

function getDirectionBadgeClass(direction: TransactionDirection): string {
  return direction === TransactionDirection.CREDIT
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-rose-50 text-rose-700 border-rose-200";
}

function getInitialState(searchParams: {
  get: (key: string) => string | null;
}) {
  const pageParam = Number(searchParams.get("page") ?? "1");
  const parsedPage =
    Number.isFinite(pageParam) && pageParam > 0 ? pageParam - 1 : 0;

  return {
    filters: {
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    } as TransactionFiltersState,
    page: parsedPage,
  };
}

function normalizeList(payload: WalletTransactionsApi, fallbackPage: number) {
  if (Array.isArray(payload)) {
    const total = payload.length;
    return {
      items: payload,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      page: fallbackPage,
    };
  }

  if ("content" in payload) {
    return {
      items: payload.content,
      total: payload.totalElements,
      totalPages: Math.max(1, payload.totalPages),
      page: payload.number,
    };
  }

  return {
    items: payload.items,
    total: payload.total,
    totalPages: Math.max(1, payload.totalPages),
    page: Math.max(0, payload.page - 1),
  };
}

export default function TransactionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const initialState = useMemo(
    () => getInitialState(searchParams),
    [searchParams],
  );

  const [transactions, setTransactions] = useState<LedgerEntryResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(initialState.page);
  const [totalPages, setTotalPages] = useState(1);

  const [filters, setFilters] = useState<TransactionFiltersState>(
    initialState.filters,
  );

  const [loading, setLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const syncUrl = useCallback(
    (nextFilters: TransactionFiltersState, nextPage: number) => {
      const params = new URLSearchParams();

      if (nextFilters.from) params.set("from", nextFilters.from);
      if (nextFilters.to) params.set("to", nextFilters.to);
      if (nextPage > 0) params.set("page", String(nextPage + 1));

      const query = params.toString();
      router.replace(
        query ? `/wallet/transactions?${query}` : "/wallet/transactions",
      );
    },
    [router],
  );

  useEffect(() => {
    let cancelled = false;

    const loadTransactions = async () => {
      setLoading(true);

      try {
        const query = new URLSearchParams();
        if (filters.from) query.set("from", filters.from);
        if (filters.to) query.set("to", filters.to);
        query.set("page", String(page));
        query.set("size", String(PAGE_SIZE));

        const res = await api.get<WalletTransactionsApi>(
          `/api/v1/wallet/transactions?${query.toString()}`,
        );

        if (cancelled) return;

        const normalized = normalizeList(res.data, page);
        setTransactions(normalized.items);
        setTotal(normalized.total);
        setTotalPages(normalized.totalPages);
      } catch (err) {
        if (cancelled) return;

        setTransactions([]);
        setTotal(0);
        setTotalPages(1);

        if (err instanceof ApiError) {
          toast.error(err.apiMessage);
        } else {
          toast.error("Không thể tải dữ liệu giao dịch.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadTransactions();

    return () => {
      cancelled = true;
    };
  }, [filters, page, refreshTick, syncUrl, toast]);

  useEffect(() => {
    if (page !== 0) return;

    const onTransactionCreated = () => {
      setRefreshTick((prev) => prev + 1);
    };

    window.addEventListener(
      "wallet:transaction-created",
      onTransactionCreated
    );

    return () => {
      window.removeEventListener(
        "wallet:transaction-created",
        onTransactionCreated
      );
    };
  }, [page]);

  const handleDateChange = (key: "from" | "to", value: string) => {
    const nextFilters: TransactionFiltersState = {
      ...filters,
      [key]: value || undefined,
    };

    setFilters(nextFilters);
    setPage(0);
    syncUrl(nextFilters, 0);
  };

  const handleResetFilters = () => {
    const resetFilters: TransactionFiltersState = {};
    setFilters(resetFilters);
    setPage(0);
    syncUrl(resetFilters, 0);
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 0 || nextPage >= totalPages || nextPage === page) return;
    setPage(nextPage);
    syncUrl(filters, nextPage);
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-cyan-600 text-white shadow-xl shadow-blue-900/15">
        <div className="relative p-6 sm:p-8">
          <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 right-10 h-24 w-24 rounded-full bg-cyan-300/20 blur-2xl" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">Ví cá nhân · IFMS</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Lịch sử giao dịch</h1>
            <p className="mt-3 text-sm leading-6 text-blue-100">Tra cứu các khoản tiền vào, tiền ra, trạng thái và mã giao dịch trên ví của bạn.</p>
          </div>
        </div>
      </section>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 md:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Từ ngày</label>
            <input
              type="date"
              value={filters.from ?? ""}
              onChange={(e) => handleDateChange("from", e.target.value)}
              className="px-3 py-2.5 rounded-2xl border border-slate-200 bg-white text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Đến ngày</label>
            <input
              type="date"
              value={filters.to ?? ""}
              onChange={(e) => handleDateChange("to", e.target.value)}
              className="px-3 py-2.5 rounded-2xl border border-slate-200 bg-white text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-3 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors"
          >
            Xóa bộ lọc
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-215">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-slate-200 bg-blue-50/60">
                <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                  Ngày
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                  Loại
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                  Mã giao dịch
                </th>
                <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-slate-400">
                  Số tiền
                </th>
                <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-slate-400">
                  Số dư sau
                </th>
                <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-slate-400">
                  Chi tiết
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-slate-500 text-sm"
                  >
                    Đang tải giao dịch...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-slate-500 text-sm"
                  >
                    Không có giao dịch phù hợp bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-b border-slate-200 hover:bg-blue-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {formatDateTime(tx.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full border text-xs ${getDirectionBadgeClass(tx.direction)}`}
                      >
                        {getDirectionLabel(tx.direction)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-slate-900 font-mono">{tx.transactionCode}</p>
                    </td>
                    <td
                      className={`px-4 py-3 text-right text-sm font-semibold ${tx.direction === TransactionDirection.CREDIT ? "text-emerald-700" : "text-rose-700"}`}
                    >
                      {tx.direction === TransactionDirection.CREDIT ? "+" : "-"}
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-600">
                      {formatCurrency(tx.balanceAfter)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/wallet/transactions/${tx.transactionId}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-100 border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-50 transition-colors"
                      >
                        Xem chi tiết
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 flex items-center justify-between border-t border-slate-200 bg-blue-50">
          <p className="text-sm text-slate-500">
            Tổng {total} giao dịch • Trang {page + 1}/{totalPages}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 0}
              className="px-3 py-1.5 rounded-xl bg-blue-100 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 text-sm transition-colors"
            >
              Trước
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-xl bg-blue-100 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 text-sm transition-colors"
            >
              Sau
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
