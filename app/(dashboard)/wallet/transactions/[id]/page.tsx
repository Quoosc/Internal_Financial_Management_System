"use client";

import Link from "next/link";
import React, { use, useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api-client";
import { useToast } from "@/contexts/toast-context";
import { TransactionResponse, TransactionStatus, TransactionType } from "@/types";
import { formatCurrency, formatDateTime } from "@/lib/format";

interface TransactionDetailPageProps {
  params: Promise<{ id: string }>;
}

function getTypeLabel(type: TransactionType): string {
  switch (type) {
    case TransactionType.DEPOSIT:
      return "Nạp tiền";
    case TransactionType.WITHDRAW:
      return "Rút tiền";
    case TransactionType.SYSTEM_TOPUP:
      return "Nạp quỹ công ty";
    case TransactionType.REQUEST_PAYMENT:
      return "Thanh toán yêu cầu";
    case TransactionType.PAYSLIP_PAYMENT:
      return "Nhận lương";
    case TransactionType.ADVANCE_RETURN:
      return "Hoàn tạm ứng";
    case TransactionType.REVERSAL:
      return "Hoàn tiền";
    case TransactionType.DEPT_QUOTA_ALLOCATION:
      return "Cấp quỹ phòng ban";
    case TransactionType.PROJECT_QUOTA_ALLOCATION:
      return "Cấp quỹ dự án";
    case TransactionType.SYSTEM_ADJUSTMENT:
      return "Điều chỉnh hệ thống";
    default:
      return type;
  }
}

function getStatusLabel(status: TransactionStatus): string {
  switch (status) {
    case TransactionStatus.SUCCESS:
      return "Thành công";
    case TransactionStatus.PENDING:
      return "Đang chờ";
    case TransactionStatus.FAILED:
      return "Thất bại";
    case TransactionStatus.CANCELLED:
      return "Đã hủy";
    default:
      return status;
  }
}

function getStatusClass(status: TransactionStatus): string {
  switch (status) {
    case TransactionStatus.SUCCESS:
      return "bg-emerald-50 border-emerald-200 text-emerald-700";
    case TransactionStatus.PENDING:
      return "bg-amber-50 border-amber-200 text-amber-700";
    case TransactionStatus.FAILED:
      return "bg-rose-50 border-rose-200 text-rose-700";
    case TransactionStatus.CANCELLED:
      return "bg-slate-100 border-slate-200 text-slate-600";
    default:
      return "bg-slate-100 border-slate-200 text-slate-600";
  }
}

export default function TransactionDetailPage({ params }: TransactionDetailPageProps) {
  const { id } = use(params);
  const toast = useToast();

  const [transaction, setTransaction] = useState<TransactionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadTransaction = async () => {
      setLoading(true);

      try {
        const res = await api.get<TransactionResponse>(`/api/v1/wallet/transactions/${id}`);
        if (cancelled) return;
        setTransaction(res.data);
      } catch (err) {
        if (cancelled) return;

        if (err instanceof ApiError) {
          toast.error(err.apiMessage);
        } else {
          toast.error("Không thể tải chi tiết giao dịch.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadTransaction();

    return () => {
      cancelled = true;
    };
  }, [id, toast]);

  return (
    <div className="max-w-3xl space-y-6">
      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-cyan-600 text-white shadow-xl shadow-blue-900/15">
        <div className="relative p-6 sm:p-8">
          <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 right-10 h-24 w-24 rounded-full bg-cyan-300/20 blur-2xl" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">Ví cá nhân · IFMS</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Chi tiết giao dịch</h1>
            <p className="mt-3 text-sm leading-6 text-blue-100">Kiểm tra số tiền, hướng tiền, trạng thái và thời gian xử lý.</p>
          </div>
        </div>
      </section>

      <Link
        href="/wallet/transactions"
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
        </svg>
        Quay lại
      </Link>

      {loading ? (
        <div className="h-64 rounded-2xl bg-white animate-pulse" />
      ) : transaction ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-900">{transaction.transactionCode}</span>
            <span className={`inline-flex px-3 py-1 rounded-full border text-xs font-medium ${getStatusClass(transaction.status)}`}>
              {getStatusLabel(transaction.status)}
            </span>
          </div>

          <DetailRow label="Loại giao dịch" value={getTypeLabel(transaction.type)} />
          <DetailRow
            label="Số tiền"
            value={`${transaction.amount >= 0 ? "+" : ""}${formatCurrency(transaction.amount)}`}
            highlight={transaction.amount >= 0 ? "positive" : "negative"}
          />
          <DetailRow label="Mô tả" value={transaction.description || "—"} />
          <DetailRow label="Thời gian tạo" value={formatDateTime(transaction.createdAt)} />
          {transaction.referenceId != null && (
            <DetailRow label="Reference ID" value={String(transaction.referenceId)} />
          )}
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-slate-500">
          Không tìm thấy giao dịch.
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "positive" | "negative";
}) {
  const valueClass = highlight === "positive"
    ? "text-emerald-700 font-semibold"
    : highlight === "negative"
      ? "text-rose-700 font-semibold"
      : "text-slate-900 font-medium";

  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-50 last:border-0">
      <p className="text-sm text-slate-500 shrink-0">{label}</p>
      <p className={`text-sm text-right break-all ${valueClass}`}>{value}</p>
    </div>
  );
}
