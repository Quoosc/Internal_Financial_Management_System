"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useRef } from "react";
import { useWallet } from "@/contexts/wallet-context";
import { ApiError, api } from "@/lib/api-client";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { useToast } from "@/contexts/toast-context";
import {
  AdvanceBalanceItem,
  AdvanceReturnResponse,
  LedgerEntryResponse,
  TransactionDirection,
} from "@/types";




type WalletTransactionsResponse =
  | { items: LedgerEntryResponse[]; total?: number }
  | { content: LedgerEntryResponse[] }
  | LedgerEntryResponse[];

function normalizeTransactions(payload: WalletTransactionsResponse): LedgerEntryResponse[] {
  if (Array.isArray(payload)) return payload;
  if ("content" in payload) return payload.content;
  return payload.items;
}


function MetricCard({ label, value, tone = "blue" }: { label: string; value: string; tone?: "blue" | "amber" | "emerald" }) {
  const toneClass = {
    blue: "bg-blue-600",
    amber: "bg-amber-500",
    emerald: "bg-emerald-500",
  }[tone];

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`mb-4 h-2 w-12 rounded-full ${toneClass}`} />
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

export default function WalletPage() {
  const router = useRouter();
  const { wallet, isLoading: walletLoading, fetchWallet } = useWallet();

  const [transactions, setTransactions] = useState<LedgerEntryResponse[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [advances, setAdvances] = useState<AdvanceBalanceItem[]>([]);
  const [advancesLoading, setAdvancesLoading] = useState(true);
  const [selectedAdvance, setSelectedAdvance] = useState<AdvanceBalanceItem | null>(null);
  const [returnAmount, setReturnAmount] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const toast = useToast();

  const loadRecentTransactions = useCallback(async () => {
    setTransactionsLoading(true);

    try {
      const res = await api.get<WalletTransactionsResponse>(
        "/api/v1/wallet/transactions?page=0&size=5"
      );
      setTransactions(normalizeTransactions(res.data).slice(0, 5));
    } catch (err) {
      setTransactions([]);
      if (err instanceof ApiError) {
        toast.error(err.apiMessage);
      } else {
        toast.error("Không thể tải giao dịch gần đây.");
      }
    } finally {
      setTransactionsLoading(false);
    }
  }, [toast]);

  const loadAdvanceBalances = useCallback(async () => {
    setAdvancesLoading(true);
    try {
      const response = await api.get<AdvanceBalanceItem[]>("/api/v1/requests/my-advance-balances");
      setAdvances(response.data ?? []);
    } catch (err) {
      setAdvances([]);
      if (err instanceof ApiError) toast.error(err.apiMessage);
      else toast.error("Không tải được danh sách tạm ứng còn phải quyết toán.");
    } finally {
      setAdvancesLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchWallet();
    void loadRecentTransactions();
    void loadAdvanceBalances();
  }, [fetchWallet, loadAdvanceBalances, loadRecentTransactions]);

  const returnOperation = useRef<{ payload: string; key: string } | null>(null);
  async function handleAdvanceReturn() {
    if (!selectedAdvance) return;
    const amount = Number(returnAmount);
    const availableBalance = wallet?.availableBalance ?? 0;
    if (!Number.isFinite(amount) || amount <= 0) {
      setReturnError("Nhập số tiền hoàn lớn hơn 0.");
      return;
    }
    if (amount > selectedAdvance.remainingAmount) {
      setReturnError("Số tiền hoàn không được vượt quá khoản còn phải quyết toán.");
      return;
    }
    if (amount > availableBalance) {
      setReturnError("Số dư khả dụng trong ví không đủ để hoàn khoản tiền này.");
      return;
    }

    const payload = JSON.stringify([selectedAdvance.id, amount, returnNote.trim()]);
    if (returnOperation.current?.payload !== payload) returnOperation.current = { payload, key: crypto.randomUUID() };
    setReturnSubmitting(true);
    setReturnError(null);
    try {
      const response = await api.post<AdvanceReturnResponse>(
        "/api/v1/requests/my-advance-balances/" + selectedAdvance.id + "/return",
        { amount, note: returnNote.trim() || undefined, idempotencyKey: returnOperation.current.key },
      );
      toast.success("Đã hoàn " + formatCurrency(response.data.returnedAmount) + " về quỹ dự án. Mã giao dịch: " + response.data.transactionCode);
      returnOperation.current = null;
      setSelectedAdvance(null);
      setReturnAmount("");
      setReturnNote("");
      await Promise.all([fetchWallet(), loadRecentTransactions(), loadAdvanceBalances()]);
    } catch (err) {
      setReturnError(err instanceof ApiError ? err.apiMessage : "Không thể hoàn tiền tạm ứng. Vui lòng thử lại.");
    } finally {
      setReturnSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-indigo-700 p-6 text-white shadow-xl shadow-blue-900/10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-50">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Personal wallet
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Ví của tôi</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
              Theo dõi số dư, giao dịch cá nhân và thực hiện nạp/rút tiền từ một màn hình thống nhất.
            </p>
          </div>

        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Số dư khả dụng" value={walletLoading ? "Đang tải..." : formatCurrency(wallet?.availableBalance ?? 0)} tone="blue" />
        <MetricCard label="Tổng số dư" value={walletLoading ? "Đang tải..." : formatCurrency(wallet?.balance ?? 0)} tone="emerald" />
        <MetricCard label="Đang khóa" value={walletLoading ? "Đang tải..." : formatCurrency(wallet?.lockedBalance ?? 0)} tone="amber" />
      </section>

      {(advancesLoading || advances.length > 0) && (
        <section className="overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-2 border-b border-amber-100 bg-amber-50/70 px-5 py-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Tạm ứng còn phải quyết toán</h2>
              <p className="mt-1 text-sm text-slate-600">Chọn đúng khoản tạm ứng để hoàn tiền thật từ ví của bạn về ví dự án.</p>
            </div>
            {!advancesLoading && <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-semibold text-amber-800">{advances.length} khoản đang mở</span>}
          </div>
          <div className="divide-y divide-slate-100">
            {advancesLoading ? (
              <div className="px-5 py-8 text-center text-sm text-slate-500">Đang tải các khoản tạm ứng…</div>
            ) : advances.map((advance) => (
              <div key={advance.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="grid flex-1 gap-3 sm:grid-cols-4">
                  <div><p className="text-xs text-slate-500">Mã tạm ứng</p><p className="mt-1 font-mono text-sm font-semibold text-blue-700">{advance.requestCode}</p></div>
                  <div><p className="text-xs text-slate-500">Dự án</p><p className="mt-1 text-sm font-medium text-slate-800">{advance.projectName || "Không có thông tin"}</p></div>
                  <div><p className="text-xs text-slate-500">Đã nhận</p><p className="mt-1 text-sm text-slate-700">{formatCurrency(advance.originalAmount)}</p></div>
                  <div><p className="text-xs text-slate-500">Còn phải quyết toán</p><p className="mt-1 text-sm font-bold text-amber-800">{formatCurrency(advance.remainingAmount)}</p></div>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedAdvance(advance); setReturnAmount(""); setReturnNote(""); setReturnError(null); }}
                  className="inline-flex shrink-0 items-center justify-center rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700"
                >
                  Hoàn tiền tạm ứng
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Hero wallet card */}
      <div
        className="relative overflow-hidden rounded-3xl border border-blue-200 shadow-xl shadow-blue-900/10"
        style={{
          background: "linear-gradient(135deg, rgba(30,58,138,0.95) 0%, rgba(30,64,175,0.85) 100%), linear-gradient(180deg, #1e3a8a 0%, #1d4ed8 100%)",
        }}
      >
        {/* SVG decorative pattern overlay */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.04]"
          viewBox="0 0 400 200"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <pattern id="wallet-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#wallet-grid)" />
          <circle cx="350" cy="-30" r="120" fill="white" opacity="0.06" />
          <circle cx="380" cy="160" r="80" fill="white" opacity="0.04" />
        </svg>

        <div className="relative p-8 md:p-10">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            {/* Left: balance + actions */}
            <div className="flex-1 space-y-6">
              <div>
                <p className="text-blue-200 text-sm font-medium mb-2">Số dư khả dụng</p>
                {walletLoading ? (
                  <div className="h-12 w-64 rounded-lg bg-white/10 animate-pulse" />
                ) : (
                  <p className="text-white text-4xl md:text-5xl font-bold tabular-nums">
                    {formatCurrency(wallet?.availableBalance ?? 0)}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-blue-300 text-xs mb-1">Tổng số dư</p>
                  <p className="text-blue-100 font-semibold tabular-nums">
                    {wallet ? formatCurrency(wallet.balance) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-blue-300 text-xs mb-1">Đang khóa</p>
                  <p className="text-amber-300 font-semibold tabular-nums">
                    {wallet ? formatCurrency(wallet.lockedBalance) : "—"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href="/wallet/withdraw"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-900 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Rút tiền
                </Link>
                <Link
                  href="/wallet/deposit"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-xl font-semibold hover:bg-white/20 transition-all text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
                  </svg>
                  Nạp tiền
                </Link>
                <Link
                  href="/wallet/deposit/my"
                  className="inline-flex items-center gap-2 px-5 py-3 bg-white/10 backdrop-blur-sm text-white/80 border border-white/10 rounded-xl text-sm hover:bg-white/15 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Lịch sử nạp
                </Link>
              </div>
            </div>

            {/* Right: wallet info panel */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 lg:min-w-[240px]">
              <p className="text-blue-200 text-xs font-medium mb-4 uppercase tracking-wider">Thông tin ví</p>
              <div className="space-y-4">
                <div>
                  <p className="text-blue-300 text-xs mb-1">Loại ví</p>
                  <p className="text-white font-semibold text-sm">
                    {wallet?.ownerType === "USER" ? "Ví cá nhân" : wallet?.ownerType ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-blue-300 text-xs mb-1">Trạng thái</p>
                  <span className="inline-flex items-center gap-1.5 text-emerald-300 text-sm font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    Hoạt động
                  </span>
                </div>
                <div>
                  <p className="text-blue-300 text-xs mb-1">Tỷ lệ khả dụng</p>
                  <p className="text-white font-semibold text-sm">
                    {wallet && wallet.balance > 0
                      ? Math.round((wallet.availableBalance / wallet.balance) * 100) + "%"
                      : "100%"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-blue-50/50 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Giao dịch gần đây</h2>
            <p className="mt-1 text-sm text-slate-500">5 giao dịch mới nhất trên ví cá nhân của bạn.</p>
          </div>
          <Link
            href="/wallet/transactions"
            className="text-sm font-semibold text-blue-700 transition-colors hover:text-blue-600"
          >
            Xem tất cả
          </Link>
        </div>

        <div className="p-6">
        {transactionsLoading ? (
          <div className="flex items-center justify-center py-10">
            <svg className="animate-spin h-7 w-7 text-blue-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-8 text-center text-slate-500">Chưa có giao dịch nào.</div>
        ) : (
          <div className="space-y-2">
            {transactions.map((transaction) => {
              const isCredit = transaction.direction === TransactionDirection.CREDIT;
              return (
                <button
                  key={transaction.id}
                  type="button"
                  onClick={() => router.push(`/wallet/transactions/${transaction.transactionId}`)}
                  className="w-full flex items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 hover:border-slate-200 hover:bg-blue-100/40 transition-all text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {isCredit ? "Tiền vào" : "Tiền ra"}
                    </p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{transaction.transactionCode}</p>
                    <p className="text-xs text-slate-500 mt-1">{formatDateTime(transaction.createdAt)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${isCredit ? "text-emerald-700" : "text-rose-700"}`}>
                      {isCredit ? "+" : "-"}
                      {formatCurrency(transaction.amount)}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Số dư: {formatCurrency(transaction.balanceAfter)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        </div>

      </div>

      {selectedAdvance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="advance-return-title" className="w-full max-w-lg space-y-5 rounded-3xl bg-white p-6 shadow-2xl">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Hoàn tiền thật về ví dự án</p>
              <h2 id="advance-return-title" className="mt-1 text-xl font-bold text-slate-900">{selectedAdvance.requestCode}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Số dư khoản còn phải quyết toán là <strong>{formatCurrency(selectedAdvance.remainingAmount)}</strong>. Tiền hoàn sẽ được trừ từ số dư khả dụng trong ví của bạn.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4 text-sm">
              <div><p className="text-xs text-slate-500">Ví khả dụng</p><p className="mt-1 font-semibold text-slate-900">{formatCurrency(wallet?.availableBalance ?? 0)}</p></div>
              <div><p className="text-xs text-slate-500">Còn phải quyết toán</p><p className="mt-1 font-semibold text-amber-800">{formatCurrency(selectedAdvance.remainingAmount)}</p></div>
            </div>
            <label className="block text-sm font-medium text-slate-700">
              Số tiền muốn hoàn
              <input type="number" min="0.01" step="1" value={returnAmount} onChange={(event) => { setReturnAmount(event.target.value); setReturnError(null); }} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="Nhập số tiền" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Ghi chú (không bắt buộc)
              <textarea rows={2} maxLength={500} value={returnNote} onChange={(event) => setReturnNote(event.target.value)} className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="Ví dụ: Hoàn phần tiền chưa sử dụng" />
            </label>
            {returnError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{returnError}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" disabled={returnSubmitting} onClick={() => setSelectedAdvance(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Hủy</button>
              <button type="button" disabled={returnSubmitting || !returnAmount} onClick={() => void handleAdvanceReturn()} className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50">{returnSubmitting ? "Đang xử lý…" : "Xác nhận hoàn tiền"}</button>
            </div>
          </section>
        </div>
      )}

    </div>
  );
}
