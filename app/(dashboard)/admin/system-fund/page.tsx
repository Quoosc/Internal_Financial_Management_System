"use client";

import Link from "next/link";
import { BankCandidatePicker } from "@/components/accounting/bank-candidate-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/contexts/toast-context";
import {
  getCompanyFund,
  getReconciliationReport,
  topupCompanyFund,
  updateBankStatement,
} from "@/lib/api";
import { CompanyFundResponse, ReconciliationReportResponse, RoleName } from "@/types";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { CurrencyInput } from "@/components/ui/currency-input";
import { SideDrawer } from "@/components/ui/side-drawer";


export default function AdminSystemFundPage() {
  const { hasAnyRole } = useAuth();
  const toast = useToast();
  const canManageFund = hasAnyRole([RoleName.ACCOUNTANT, RoleName.CFO]);
  const [companyFund, setCompanyFund] = useState<CompanyFundResponse | null>(null);
  const [reconciliation, setReconciliation] = useState<ReconciliationReportResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError,setLoadError]=useState("");

  const [showTopupModal, setShowTopupModal] = useState(false);
  const [showStatementModal, setShowStatementModal] = useState(false);

  const [topupAmount, setTopupAmount] = useState("");
  const [topupDescription, setTopupDescription] = useState("");
  const [topupEvidenceId, setTopupEvidenceId] = useState("");
  const [statementBalance, setStatementBalance] = useState("");
  const [statementTime, setStatementTime] = useState("");
  const [statementEvidence, setStatementEvidence] = useState("");

  const [topupSubmitting, setTopupSubmitting] = useState(false);
  const [statementSubmitting, setStatementSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!canManageFund) return;

    setLoading(true); setLoadError(""); setCompanyFund(null); setReconciliation(null);

    try {
      const [fundRes, reconRes] = await Promise.all([
        getCompanyFund(),
        getReconciliationReport(),
      ]);

      setCompanyFund(fundRes.data);
      setReconciliation(reconRes.data);
      setStatementBalance(String(fundRes.data.externalBankBalance ?? 0));
    } catch (err) {
      setLoadError(err instanceof ApiError?err.apiMessage:"Không thể tải dữ liệu quỹ hệ thống.");
    } finally {
      setLoading(false);
    }
  }, [canManageFund, toast]);

  useEffect(() => {
    if (!canManageFund) return;
    void loadData();
  }, [canManageFund, loadData]);

  const handleTopup = async () => {
    if (!topupEvidenceId) { toast.error("Cần chọn dòng sao kê IN/BOOKED chưa sử dụng."); return; }
    const amount = Number(topupAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Số tiền nạp không hợp lệ.");
      return;
    }

    setTopupSubmitting(true);

    try {
      await topupCompanyFund({
        amount,
        bankEvidenceId: Number(topupEvidenceId),
        description: topupDescription.trim() || undefined,
      });
      setShowTopupModal(false);
      setTopupAmount("");
      setTopupDescription("");
      setTopupEvidenceId("");
      toast.success("Đã nạp tiền vào quỹ hệ thống.");
      await loadData();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.apiMessage);
      } else {
        toast.error("Không thể nạp tiền vào quỹ hệ thống.");
      }
    } finally {
      setTopupSubmitting(false);
    }
  };

  const handleUpdateStatement = async () => {
    const bankBalance = Number(statementBalance.replace(/\D/g, ""));
    if (!Number.isFinite(bankBalance) || bankBalance < 0) {
      toast.error("Số dư ngân hàng không hợp lệ.");
      return;
    }

    if (!statementTime || !statementEvidence.trim()) { toast.error("Cần thời điểm chốt và mã/tài liệu sao kê."); return; }
    setStatementSubmitting(true);

    try {
      await updateBankStatement({
        externalBankBalance: bankBalance,
        lastStatementDate: statementTime.slice(0, 10),
        asOf: new Date(statementTime).toISOString(), evidenceRef: statementEvidence.trim(),
      });
      setShowStatementModal(false);
      toast.success("Đã cập nhật số dư ngân hàng.");
      await loadData();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.apiMessage);
      } else {
        toast.error("Không thể cập nhật số dư ngân hàng.");
      }
    } finally {
      setStatementSubmitting(false);
    }
  };

  const reconEntries = useMemo(() => {
    if (!reconciliation) return [];

    const raw = reconciliation as ReconciliationReportResponse & {
      entries?: Array<{ label?: string; description?: string; amount?: number }>;
    };

    return raw.entries ?? [];
  }, [reconciliation]);
  const discrepancy = companyFund?.bankDiscrepancy ?? 0;
  const reconciled = companyFund?.bankDiscrepancy != null && Math.abs(discrepancy) === 0;

  if (!canManageFund) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        <h1 className="text-lg font-bold">Không có quyền truy cập quỹ hệ thống</h1>
        <p className="mt-2 text-sm">
          Màn hình này thuộc nghiệp vụ Kế toán/CFO, không nằm trong nhóm quyền quản trị hệ thống.
        </p>
      </div>
    );
  }

  if(loading)return <p role="status" className="rounded-2xl bg-white p-10 text-center text-slate-500">Đang tải quỹ hệ thống…</p>;
  if(loadError||!companyFund||!reconciliation)return <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">{loadError||"Dữ liệu quỹ chưa được trả về đầy đủ."}<button className="ml-3 underline" onClick={()=>void loadData()}>Thử lại</button></div>;
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-indigo-700 p-6 text-white shadow-xl shadow-blue-900/10">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-50">
              <span className={`h-1.5 w-1.5 rounded-full ${reconciled ? "bg-emerald-300" : "bg-amber-300"}`} />
              Quỹ công ty
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Quỹ hệ thống</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
              Quản trị nguồn quỹ nội bộ, cập nhật sao kê ngân hàng và đối soát chênh lệch toàn hệ thống.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {setTopupEvidenceId("");setShowTopupModal(true);}}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-lg shadow-blue-950/10 transition hover:bg-blue-50"
            >
              Nạp tiền từ ngân hàng
            </button>
            <button
              type="button"
              onClick={() => setShowStatementModal(true)}
              className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/20"
            >
              Cập nhật sao kê
            </button>
          </div>
        </div>
      </section>

      <div className="hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quỹ hệ thống</h1>
          <p className="text-slate-500 mt-1">Quản lý quỹ hệ thống và đối soát ngân hàng.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {setTopupEvidenceId("");setShowTopupModal(true);}}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
          >
            Nạp tiền từ ngân hàng
          </button>
          <button
            type="button"
            onClick={() => setShowStatementModal(true)}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold"
          >
            Cập nhật số dư ngân hàng
          </button>
        </div>
      </div>

      <a href={canManageFund ? "/accountant/ledger/reconciliation" : "#"} className="inline-flex rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">Đối soát sao kê và xác nhận phạm vi tài khoản →</a>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Số dư hệ thống"
          value={formatCurrency(companyFund?.currentWalletBalance ?? 0)}
          tone="text-slate-900"
        />
        <StatCard
          title="Số dư ngân hàng"
          value={formatCurrency(companyFund?.externalBankBalance ?? 0)}
          tone="text-slate-700"
        />
        <StatCard
          title="Chênh lệch đối soát"
          value={companyFund?.bankDiscrepancy != null ? formatCurrency(companyFund.bankDiscrepancy) : "Thiếu căn cứ"}
          tone={Math.abs(companyFund?.bankDiscrepancy ?? 0) > 0 ? "text-rose-700" : "text-emerald-700"}
        />
      </div>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-blue-50/50 px-5 py-4">
          <h2 className="text-base font-bold text-slate-900">Báo cáo đối soát</h2>
          <p className="mt-1 text-sm text-slate-500">Đối chiếu tiền công ty (quỹ, phòng ban, dự án) tại thời điểm sao kê; không cộng ví USER. Phân bổ nội bộ không làm đổi tổng tiền công ty.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-5">
          <InfoRow
            label="Số dư IFMS"
            value={reconciliation?.corporateBalanceAtStatement != null ? formatCurrency(reconciliation.corporateBalanceAtStatement) : "Chưa có thời điểm chốt"}
          />
          <InfoRow
            label="Số dư ngân hàng"
            value={formatCurrency(reconciliation?.externalBankBalance ?? 0)}
          />
          <InfoRow
            label="Chênh lệch đối soát"
            value={reconciliation?.bankDiscrepancy != null ? formatCurrency(reconciliation.bankDiscrepancy) : "Thiếu căn cứ"}
          />
          <InfoRow
            label="Lần đối soát gần nhất"
            value={reconciliation?.generatedAt ? formatDateTime(reconciliation.generatedAt) : "-"}
          />
        </div>

        {reconEntries.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
            <p className="text-sm text-slate-900 font-medium">Chi tiết đối soát</p>
            {reconEntries.map((entry, index) => (
              <div key={`${entry.label ?? "entry"}-${index}`} className="text-sm text-slate-600 flex items-center justify-between gap-2">
                <span>{entry.label ?? entry.description ?? `Entry ${index + 1}`}</span>
                <span>{typeof entry.amount === "number" ? formatCurrency(entry.amount) : "-"}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Truy cập nhanh</h2>
        <div className="mt-3">
          <Link
            href="/accountant/ledger"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors"
          >
            Xem sổ cái
          </Link>
        </div>
      </div>

      <SideDrawer
        open={showTopupModal}
        title="Nạp tiền từ ngân hàng"
        description="Ghi nhận giao dịch nạp tiền vào quỹ hệ thống từ tài khoản ngân hàng đối ứng."
        onClose={() => setShowTopupModal(false)}
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowTopupModal(false)}
              className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => void handleTopup()}
              disabled={topupSubmitting}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {topupSubmitting ? "Đang xử lý..." : "Xác nhận nạp"}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Số tiền</label>
            <CurrencyInput
              value={topupAmount ? Number(topupAmount) : null}
              onChange={(value) => setTopupAmount(value ? String(value) : "")}
              placeholder="Nhập số tiền"
            />
          </div>
          <InputField label="Ghi chú" value={topupDescription} onChange={setTopupDescription} placeholder="Mô tả giao dịch" />
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Dòng sao kê tiền vào đã ghi nhận</label>
            {showTopupModal&&<BankCandidatePicker endpoint="/api/v1/accountant/ledger/bank-evidence/topup-candidates" value={topupEvidenceId} onChange={setTopupEvidenceId} topup disabled={topupSubmitting}/>}

          </div>
        </div>
      </SideDrawer>

      <SideDrawer
        open={showStatementModal}
        title="Cập nhật số dư ngân hàng"
        description="Nhập số dư thực tế theo sao kê gần nhất để hệ thống tính chênh lệch đối soát."
        onClose={() => setShowStatementModal(false)}
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowStatementModal(false)}
              className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => void handleUpdateStatement()}
              disabled={statementSubmitting}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {statementSubmitting ? "Đang cập nhật..." : "Lưu số dư"}
            </button>
          </div>
        }
      >
        <div>
          <p className="mb-4 text-xs text-slate-500">Trước khi cập nhật, xác nhận tài khoản tiền vận hành công ty tại trang Đối soát ngân hàng.</p>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Thời điểm chốt sao kê<input type="datetime-local" className="mt-2 block w-full rounded-xl border border-slate-200 p-3" value={statementTime} onChange={e => setStatementTime(e.target.value)} /></label>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Mã / tài liệu sao kê<input className="mt-2 block w-full rounded-xl border border-slate-200 p-3" value={statementEvidence} onChange={e => setStatementEvidence(e.target.value)} /></label>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Số dư ngân hàng thực tế</label>
          <CurrencyInput
            value={statementBalance ? Number(statementBalance.replace(/\D/g, "")) : null}
            onChange={(value) => setStatementBalance(value ? String(value) : "")}
            placeholder="Nhập số dư"
          />
        </div>
      </SideDrawer>
    </div>
  );
}

function StatCard({ title, value, tone }: { title: string; value: string; tone: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
      <p className="text-xs text-slate-500">{title}</p>
      <p className={`text-xl font-bold mt-1 ${tone}`}>{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-900 mt-2 break-all">{value}</p>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}
