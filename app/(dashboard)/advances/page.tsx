"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@/contexts/wallet-context";
import { useToast } from "@/contexts/toast-context";
import { ApiError, api } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/format";
import type { AdvanceBalanceItem, AdvanceReturnResponse } from "@/types";

export default function EmployeeAdvancesPage() {
  const { wallet, fetchWallet } = useWallet();
  const toast = useToast();
  const [items, setItems] = useState<AdvanceBalanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdvanceBalanceItem | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const returnOperation = useRef<{ payload: string; key: string } | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<AdvanceBalanceItem[]>("/api/v1/requests/my-advance-balances");
      setItems(response.data ?? []);
    } catch (err) {
      setItems([]);
      toast.error(err instanceof ApiError ? err.apiMessage : "Không tải được các khoản tạm ứng.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadItems();
    void fetchWallet();
  }, [fetchWallet, loadItems]);

  async function handleReturn() {
    if (!selected) return;
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Nhập số tiền hoàn lớn hơn 0.");
      return;
    }
    if (parsedAmount > selected.remainingAmount) {
      setError("Số tiền hoàn không được vượt quá khoản còn phải quyết toán.");
      return;
    }
    if (parsedAmount > (wallet?.availableBalance ?? 0)) {
      setError("Số dư khả dụng trong ví không đủ để hoàn khoản tiền này.");
      return;
    }

    const payload = JSON.stringify([selected.id, parsedAmount, note.trim()]);
    if (returnOperation.current?.payload !== payload) {
      returnOperation.current = { payload, key: crypto.randomUUID() };
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await api.post<AdvanceReturnResponse>(
        `/api/v1/requests/my-advance-balances/${selected.id}/return`,
        { amount: parsedAmount, note: note.trim() || undefined, idempotencyKey: returnOperation.current.key },
      );
      toast.success(`Đã hoàn ${formatCurrency(response.data.returnedAmount)} về quỹ dự án. Mã giao dịch: ${response.data.transactionCode}`);
      returnOperation.current = null;
      setSelected(null);
      setAmount("");
      setNote("");
      await Promise.all([fetchWallet(), loadItems()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.apiMessage : "Không thể hoàn tiền tạm ứng. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  const totalOutstanding = items.reduce((sum, item) => sum + item.remainingAmount, 0);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-indigo-700 p-6 text-white shadow-xl shadow-blue-900/10 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">Theo dõi khoản đã nhận</p>
        <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tạm ứng &amp; quyết toán</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">Theo dõi từng khoản tạm ứng, số tiền đã nhận và phần còn cần quyết toán bằng chứng từ hoặc hoàn tiền thật.</p>
          </div>
          <Link href="/requests" className="inline-flex w-fit rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20">Xem yêu cầu của tôi</Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Số khoản chưa hoàn tất</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{loading ? "—" : items.length}</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 shadow-sm">
          <p className="text-sm text-blue-800">Tổng còn phải quyết toán</p>
          <p className="mt-2 text-2xl font-bold text-blue-900">{loading ? "Đang tải…" : formatCurrency(totalOutstanding)}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-2 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Các khoản tạm ứng đang mở</h2>
            <p className="mt-1 text-sm text-slate-500">Mỗi dòng tương ứng một khoản tạm ứng đã giải ngân cho bạn.</p>
          </div>
          {!loading && <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">{items.length} khoản</span>}
        </div>
        {loading ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">Đang tải khoản tạm ứng…</div>
        ) : items.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-semibold text-slate-800">Bạn không có khoản tạm ứng cần quyết toán.</p>
            <p className="mt-1 text-sm text-slate-500">Khi có khoản tạm ứng được giải ngân, thông tin sẽ hiển thị tại đây.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <article key={item.id} className="grid gap-4 px-5 py-5 lg:grid-cols-[1.2fr_1.4fr_repeat(3,minmax(130px,0.8fr))_auto] lg:items-center">
                <div><p className="text-xs text-slate-500">Mã tạm ứng</p><p className="mt-1 font-mono text-sm font-bold text-blue-700">{item.requestCode}</p></div>
                <div><p className="text-xs text-slate-500">Dự án / giai đoạn</p><p className="mt-1 text-sm font-semibold text-slate-800">{item.projectName || "Không có dự án"}</p><p className="text-xs text-slate-500">{item.phaseName || "Chưa xác định giai đoạn"}</p></div>
                <div><p className="text-xs text-slate-500">Ngày giải ngân</p><p className="mt-1 text-sm text-slate-700">{item.disbursedDate ? formatDate(item.disbursedDate) : "—"}</p></div>
                <div><p className="text-xs text-slate-500">Đã nhận</p><p className="mt-1 text-sm font-medium text-slate-800">{formatCurrency(item.originalAmount)}</p></div>
                <div><p className="text-xs text-slate-500">Còn phải quyết toán</p><p className="mt-1 text-sm font-bold text-blue-800">{formatCurrency(item.remainingAmount)}</p></div>
                <div><p className="text-xs text-slate-500">Trạng thái</p><span className="mt-1 inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">Đang mở</span></div>
                <button type="button" onClick={() => { setSelected(item); setAmount(""); setNote(""); setError(null); }} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Hoàn tiền</button>
              </article>
            ))}
          </div>
        )}
      </section>

      <aside className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-sm leading-6 text-blue-900">
        Quyết toán khoản đã chi bằng cách gửi yêu cầu “Quyết toán tạm ứng” kèm hóa đơn/chứng từ tại mục <Link className="font-semibold underline" href="/requests/new">Tạo yêu cầu</Link>. Chỉ dùng nút “Hoàn tiền” khi bạn thực sự chuyển phần tiền chưa sử dụng từ ví cá nhân về quỹ dự án.
      </aside>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="advance-return-title" className="w-full max-w-lg space-y-5 rounded-3xl bg-white p-6 shadow-2xl">
            <div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Hoàn tiền thật về quỹ dự án</p><h2 id="advance-return-title" className="mt-1 text-xl font-bold text-slate-900">{selected.requestCode}</h2><p className="mt-2 text-sm leading-6 text-slate-600">Số tiền hoàn không được vượt số còn phải quyết toán và số dư khả dụng trong ví.</p></div>
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4 text-sm"><div><p className="text-xs text-slate-500">Ví khả dụng</p><p className="mt-1 font-semibold text-slate-900">{formatCurrency(wallet?.availableBalance ?? 0)}</p></div><div><p className="text-xs text-slate-500">Còn phải quyết toán</p><p className="mt-1 font-semibold text-blue-800">{formatCurrency(selected.remainingAmount)}</p></div></div>
            <label className="block text-sm font-medium text-slate-700">Số tiền muốn hoàn<input type="number" min="1" step="1" value={amount} onChange={(event) => { setAmount(event.target.value); setError(null); }} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="Nhập số tiền" /></label>
            <label className="block text-sm font-medium text-slate-700">Ghi chú (không bắt buộc)<textarea rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="Ví dụ: Hoàn phần tiền chưa sử dụng" /></label>
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            <div className="flex justify-end gap-3"><button type="button" disabled={submitting} onClick={() => setSelected(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Hủy</button><button type="button" disabled={submitting || !amount} onClick={() => void handleReturn()} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Đang xử lý…" : "Xác nhận hoàn tiền"}</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
