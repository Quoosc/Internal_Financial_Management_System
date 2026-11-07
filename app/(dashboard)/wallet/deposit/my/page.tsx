"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api-client";
import { getMyDeposits } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { useToast } from "@/contexts/toast-context";
import { DepositLogResponse, DepositStatus } from "@/types";

const PAGE_SIZE = 10;

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "",                      label: "Tất cả" },
  { value: DepositStatus.COMPLETED, label: "Thành công" },
  { value: DepositStatus.PENDING,   label: "Đang chờ" },
  { value: DepositStatus.FAILED,    label: "Thất bại" },
];

function getStatusLabel(status: DepositStatus): string {
  switch (status) {
    case DepositStatus.COMPLETED:
      return "Thành công";
    case DepositStatus.PENDING:
      return "Đang chờ";
    case DepositStatus.FAILED:
      return "Thất bại";
    default:
      return status;
  }
}

function getStatusClass(status: DepositStatus): string {
  switch (status) {
    case DepositStatus.COMPLETED:
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case DepositStatus.PENDING:
      return "bg-amber-50 text-amber-700 border-amber-200";
    case DepositStatus.FAILED:
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-500/15 text-slate-600 border-slate-500/30";
  }
}

export default function DepositHistoryPage() {
  const toast = useToast();
  const [deposits, setDeposits] = useState<DepositLogResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const [filterStatus, setFilterStatus] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const loadDeposits = useCallback(async (nextPage: number, status: string, from: string, to: string) => {
    setLoading(true);

    try {
      const res = await getMyDeposits(nextPage, PAGE_SIZE, {
        status: status || undefined,
        from: from || undefined,
        to: to || undefined,
      });

      setDeposits(res.data.items ?? []);
      setTotal(res.data.total);
      setTotalPages(Math.max(1, res.data.totalPages));
      setPage(res.data.page);
    } catch (err) {
      setDeposits([]);
      setTotal(0);
      setTotalPages(1);

      if (err instanceof ApiError) {
        toast.error(err.apiMessage);
      } else {
        toast.error("Không thể tải lịch sử nạp tiền.");
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadDeposits(0, filterStatus, filterFrom, filterTo);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadDeposits]);

  const applyFilters = () => {
    void loadDeposits(0, filterStatus, filterFrom, filterTo);
  };

  const resetFilters = () => {
    setFilterStatus("");
    setFilterFrom("");
    setFilterTo("");
    void loadDeposits(0, "", "", "");
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 0 || nextPage >= totalPages || nextPage === page) return;
    void loadDeposits(nextPage, filterStatus, filterFrom, filterTo);
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-cyan-600 text-white shadow-xl shadow-blue-900/15">
        <div className="relative p-6 sm:p-8">
          <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 right-10 h-24 w-24 rounded-full bg-cyan-300/20 blur-2xl" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">Ví cá nhân · IFMS</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Lịch sử nạp tiền</h1>
            <p className="mt-3 text-sm leading-6 text-blue-100">Tra cứu các lần nạp VNPay theo trạng thái và thời gian thanh toán.</p>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Link
          href="/wallet/deposit"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          Quay lại
        </Link>
      </div>

      {/* Filters */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Trạng thái</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Từ ngày</label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="px-3 py-2 rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Đến ngày</label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="px-3 py-2 rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          <button
            type="button"
            onClick={applyFilters}
            disabled={loading}
            className="px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            Lọc
          </button>

          <button
            type="button"
            onClick={resetFilters}
            disabled={loading}
            className="px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed text-slate-700 text-sm font-medium transition-colors"
          >
            Xóa lọc
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-200">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-slate-200 bg-blue-50/60">
                <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                  Mã nạp tiền
                </th>
                <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-slate-400">
                  Số tiền
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                  Trạng thái
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                  Mã giao dịch VNPay
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                  Thời gian thanh toán
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                  Ngày tạo
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500 text-sm">
                    Đang tải lịch sử nạp tiền...
                  </td>
                </tr>
              ) : deposits.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500 text-sm">
                    Chưa có lịch sử nạp tiền.
                  </td>
                </tr>
              ) : (
                deposits.map((deposit) => (
                  <tr
                    key={deposit.id}
                    className="border-b border-slate-200 hover:bg-blue-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-slate-900">{deposit.depositCode}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold text-emerald-700">
                        +{formatCurrency(deposit.amount)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full border text-xs ${getStatusClass(deposit.status)}`}
                        >
                          {getStatusLabel(deposit.status)}
                        </span>
                        {deposit.status === DepositStatus.PENDING && deposit.paymentUrl && (
                          <button
                            type="button"
                            onClick={() => window.open(deposit.paymentUrl!, "_blank", "noopener,noreferrer")}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Thanh toán
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {deposit.vnpTransactionNo ? (
                        <span className="font-mono text-xs text-slate-700">{deposit.vnpTransactionNo}</span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {formatDateTime(deposit.paidAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {formatDateTime(deposit.createdAt)}
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
              disabled={page <= 0 || loading}
              className="px-3 py-1.5 rounded-xl bg-blue-100 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 text-sm transition-colors"
            >
              Trước
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages - 1 || loading}
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
