"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/api-client";
import { createDeposit } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { CurrencyInput } from "@/components/ui/currency-input";
import { useToast } from "@/contexts/toast-context";
import { DepositLogResponse } from "@/types";
import { BackButton } from "@/components/ui/back-button";

const MIN_AMOUNT = 10_000;

export default function DepositPage() {
  const toast = useToast();

  const [amount, setAmount] = useState<number | null>(null);
  const [paymentData, setPaymentData] = useState<DepositLogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const amountNumber = useMemo(() => amount ?? 0, [amount]);

  const handleGeneratePayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCopied(false);

    if (amountNumber < MIN_AMOUNT) {
      toast.error("Số tiền nạp tối thiểu là 10.000 ₫.");
      return;
    }

    setLoading(true);

    try {
      const res = await createDeposit({ amount: amountNumber });
      setPaymentData(res.data);
    } catch (err) {
      setPaymentData(null);
      if (err instanceof ApiError) {
        toast.error(err.apiMessage);
      } else {
        toast.error("Không thể tạo liên kết thanh toán VNPay.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!paymentData) return;
    try {
      await navigator.clipboard.writeText(paymentData.depositCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Không thể sao chép mã nạp tiền.");
    }
  };

  const handleOpenVnpay = () => {
    if (!paymentData?.paymentUrl) return;
    window.open(paymentData.paymentUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-cyan-600 text-white shadow-xl shadow-blue-900/15">
        <div className="relative p-6 sm:p-8">
          <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 right-10 h-24 w-24 rounded-full bg-cyan-300/20 blur-2xl" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">Ví cá nhân · IFMS</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Nạp tiền qua VNPay</h1>
            <p className="mt-3 text-sm leading-6 text-blue-100">Tạo yêu cầu nạp vào ví cá nhân qua VNPay và tra cứu trạng thái thanh toán.</p>
          </div>
        </div>
      </section>

      <BackButton fallbackHref="/wallet" />

      <div className="flex justify-end">
        <Link
          href="/wallet/deposit/my"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Lịch sử nạp tiền
        </Link>
      </div>

      <form onSubmit={handleGeneratePayment} className="rounded-3xl border border-slate-200 bg-white p-6 space-y-4">
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-slate-600 mb-2">
            Số tiền nạp
          </label>
          <CurrencyInput
            id="amount"
            value={amount}
            onChange={setAmount}
            placeholder="Nhập số tiền"
          />
          <div className="mt-2 space-y-1 text-xs">
            <p className="text-slate-500">Tối thiểu: {formatCurrency(MIN_AMOUNT)}</p>
            {amountNumber > 0 && (
              <p className="font-semibold text-blue-700" aria-live="polite">
                Số tiền đã nhập: {formatCurrency(amountNumber)}
              </p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold transition-colors"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Đang tạo liên kết thanh toán...
            </>
          ) : (
            "Tạo thanh toán"
          )}
        </button>
      </form>

      {paymentData && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Thông tin thanh toán</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <InfoRow label="Mã nạp tiền" value={paymentData.depositCode} mono />
            <InfoRow label="Số tiền" value={formatCurrency(paymentData.amount)} />
            <InfoRow label="Trạng thái" value={paymentData.status} />
          </div>

          {paymentData.paymentUrl && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 text-sm text-blue-700">
              Nhấn nút bên dưới để thanh toán qua VNPay. Số dư ví sẽ tự động cập nhật sau khi giao dịch thành công.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleOpenVnpay}
              disabled={!paymentData.paymentUrl}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              Thanh toán qua VNPay
            </button>

            <button
              type="button"
              onClick={() => void handleCopyCode()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors"
            >
              {copied ? "Đã sao chép mã" : "Sao chép mã nạp tiền"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-sm text-slate-900 mt-1 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
