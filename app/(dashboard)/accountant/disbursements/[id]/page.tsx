"use client";
import { FinancialDocumentEditor, type DocumentVerificationDraft, validDocumentAllocation, verifiedDocumentPayload } from "@/components/accounting/financial-document-editor";

import Link from "next/link";
import React, { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api-client";
import { useToast } from "@/contexts/toast-context";
import {
  DisburseBody,
  DisburseResponse,
  DisbursementDetailResponse,
  DisbursementRejectBody,
  RequestAction,
  RequestStatus,
  RequestType,
  VerifyPinResponse,
} from "@/types";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { isAccountantQueueStatus } from "@/lib/adapters/request-status";

interface DisbursementBudgetScope {
  budgetLimit: number;
  recognizedExpense: number;
  reservedForOtherRequests: number;
  openAdvance: number;
  availableNow: number;
  availableAfterThisRequest: number;
}

interface DisbursementBudgetContext {
  projectCode: string;
  projectName: string;
  phaseCode: string;
  phaseName: string;
  categoryName: string | null;
  approvedAmount: number;
  calculatedAt: string;
  project: DisbursementBudgetScope;
  phase: DisbursementBudgetScope;
  category: DisbursementBudgetScope | null;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

// DisburseResponse v3.0: id, requestCode, status, transactionCode, amount, disbursedAt
type DisburseSuccessView = DisburseResponse;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getTypeLabel(type: RequestType): string {
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

function getAttachmentIcon(fileType: string): React.ReactNode {
  const lower = fileType.toLowerCase();

  if (lower.includes("pdf")) {
    return (
      <svg
        className="w-5 h-5 text-rose-700"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M7 3h7l5 5v13H7V3zm7 0v5h5"
        />
      </svg>
    );
  }

  if (lower.includes("image")) {
    return (
      <svg
        className="w-5 h-5 text-emerald-700"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M8 11l3 3 2-2 4 4"
        />
      </svg>
    );
  }

  return (
    <svg
      className="w-5 h-5 text-slate-600"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M7 3h10l4 4v14H7V3zm10 0v4h4"
      />
    </svg>
  );
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(-2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function AccountantDisbursementDetailPage({
  params,
}: PageProps) {
  const router = useRouter();
  const { id } = use(params);
  const toast = useToast();

  const [detail, setDetail] = useState<DisbursementDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [budgetContext, setBudgetContext] = useState<DisbursementBudgetContext | null>(null);
  const [budgetContextOpen, setBudgetContextOpen] = useState(false);
  const [budgetContextLoading, setBudgetContextLoading] = useState(false);
  const [budgetContextError, setBudgetContextError] = useState<string | null>(null);

  const [documentDrafts, setDocumentDrafts] = useState<DocumentVerificationDraft[]>([]);
  useEffect(() => {
    setDocumentDrafts((detail?.attachments || []).map(file => ({ fileId: file.fileId, fileName: file.fileName,
      issuerCode: "", documentNumber: "", documentDate: "", totalAmount: null, allocatedAmount: null })));
  }, [detail]);
  const [pin, setPin] = useState("");
  const [disburseNote, setDisburseNote] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [disburseStage, setDisburseStage] = useState<"verifying" | "disbursing" | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState<DisburseSuccessView | null>(
    null,
  );

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadDetail = async () => {
      setLoading(true);

      try {
        const res = await api.get<DisbursementDetailResponse>(
          `/api/v1/accountant/disbursements/${id}`,
        );

        if (cancelled) return;
        setDetail(res.data);
      } catch (err) {
        if (cancelled) return;

        setDetail(null);

        if (err instanceof ApiError) {
          toast.error(err.apiMessage);
        } else {
          toast.error("Không thể tải dữ liệu giải ngân.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [id, toast]);

  const canProcessDisbursement = useMemo(
    () => (detail ? isAccountantQueueStatus(detail.status) : false),
    [detail],
  );
  const isVerifiedExpenseWaitingForPayment = Boolean(
    detail?.type === RequestType.EXPENSE && detail.status === RequestStatus.ACCOUNTANT_VERIFIED,
  );
  const isVerifyingExpense = Boolean(
    detail?.type === RequestType.EXPENSE && detail.status === RequestStatus.APPROVED_BY_TEAM_LEADER,
  );
  const tlApprovalEntry = useMemo(() => {
    if (!detail) return null;

    return detail.timeline.find(
      (entry) =>
        entry.action === RequestAction.APPROVE &&
        isAccountantQueueStatus(entry.statusAfterAction),
    );
  }, [detail]);

  const accountantActionEntry = useMemo(() => {
    if (!detail) return null;
    return [...detail.timeline].reverse().find((entry) =>
      entry.action === RequestAction.VERIFY ||
      entry.action === RequestAction.PAYOUT ||
      entry.action === RequestAction.REJECT,
    ) ?? null;
  }, [detail]);

  const accountantStepTitle = isVerifyingExpense
    ? "Bước 3: Kế toán xác nhận chứng từ"
    : isVerifiedExpenseWaitingForPayment
      ? "Bước 4: Kế toán thanh toán hoàn chi"
      : detail?.type === RequestType.EXPENSE
        ? "Bước 4: Kế toán thanh toán hoàn chi"
        : detail?.type === RequestType.REIMBURSE
          ? "Bước 3: Kế toán quyết toán tạm ứng"
          : "Bước 3: Kế toán giải ngân tạm ứng";

  const processingStatusLabel = isVerifiedExpenseWaitingForPayment
    ? "Chứng từ đã xác nhận · chờ thanh toán"
    : canProcessDisbursement
      ? "Chờ Kế toán xử lý"
      : detail?.status === RequestStatus.PAID
        ? detail?.type === RequestType.REIMBURSE ? "Đã quyết toán chứng từ" : "Đã hoàn tất"
        : detail?.status === RequestStatus.REJECTED ? "Đã từ chối" : "Đã xử lý";

  const loadBudgetContext = async () => {
    if (!detail) return;
    setBudgetContextOpen(true);
    setBudgetContextLoading(true);
    setBudgetContextError(null);
    setBudgetContext(null);
    try {
      const response = await api.get<DisbursementBudgetContext>(
        `/api/v1/accountant/disbursements/${id}/budget-context`,
      );
      setBudgetContext(response.data);
    } catch (error) {
      const message = error instanceof ApiError ? error.apiMessage : "Không tải được số liệu ngân sách mới nhất.";
      setBudgetContextError(message);
      setBudgetContext(null);
    } finally {
      setBudgetContextLoading(false);
    }
  };

  useEffect(() => {
    if (!budgetContextOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setBudgetContextOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [budgetContextOpen]);

  const handlePinChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "").slice(0, 5);
    setPin(digitsOnly);
    setPinError(null);
  };

  async function handleDisburse() {
    if (!detail) return;
    if (!canProcessDisbursement) {
      setPinError("Yêu cầu không còn ở trạng thái chờ giải ngân.");
      return;
    }
    if (detail && !isVerifiedExpenseWaitingForPayment && (detail.type === "EXPENSE" || detail.type === "REIMBURSE")
        && !validDocumentAllocation(documentDrafts, detail.approvedAmount ?? detail.amount)) {
      setPinError("Cần nhập đủ thông tin chứng từ và phân bổ đúng tổng tiền được duyệt."); return;
    }
    if (pin.length < 5) {
      setPinError("Vui lòng nhập đủ 5 chữ số PIN.");
      return;
    }

    setSubmitting(true);
    setDisburseStage("verifying");
    setPinError(null);

    try {
      // Pre-verify PIN trước khi thực hiện giải ngân
      const verifyRes = await api.post<VerifyPinResponse>("/api/v1/users/me/pin/verify", { pin });
      if (!verifyRes.data.valid) {
        const remaining = verifyRes.data.attemptsRemaining;
        setPinError(
          remaining !== undefined && remaining > 0
            ? `Mã PIN không đúng. Còn ${remaining} lần thử.`
            : "Mã PIN không đúng. Vui lòng kiểm tra lại.",
        );
        setSubmitting(false);
        setDisburseStage(null);
        return;
      }

      setDisburseStage("disbursing");
      const body: DisburseBody = {
        pin,
        note: disburseNote.trim() || undefined,
        documents: isVerifiedExpenseWaitingForPayment ? undefined : verifiedDocumentPayload(documentDrafts),
      };
      const actionPath = isVerifiedExpenseWaitingForPayment ? "pay" : "disburse";
      const res = await api.post<DisburseResponse>(
        `/api/v1/accountant/disbursements/${id}/${actionPath}`,
        body,
      );
      setSuccessData(res.data);
      setShowSuccess(true);
      setDisburseNote("");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400 || err.status === 401 || err.status === 423) {
          setPinError(err.apiMessage);
        } else {
          setPinError("Đã có lỗi xảy ra. Vui lòng thử lại.");
        }
      } else {
        setPinError("Đã có lỗi xảy ra. Vui lòng thử lại.");
      }
    } finally {
      setSubmitting(false);
      setDisburseStage(null);
    }
  }

  async function handleReject() {
    if (rejectReason.trim().length < 10) {
      setRejectError("Lý do từ chối phải có ít nhất 10 ký tự.");
      return;
    }

    setRejectSubmitting(true);
    setRejectError(null);

    try {
      const body: DisbursementRejectBody = {
        reason: rejectReason.trim(),
      };
      await api.post(`/api/v1/accountant/disbursements/${id}/reject`, body);
      router.push("/accountant/disbursements");
    } catch (err) {
      if (err instanceof ApiError) {
        setRejectError(err.apiMessage);
      } else {
        setRejectError("Không thể từ chối giải ngân, vui lòng thử lại.");
      }
    } finally {
      setRejectSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-cyan-600 text-white shadow-xl shadow-blue-900/15">
        <div className="relative p-6 sm:p-8">
          <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 right-10 h-24 w-24 rounded-full bg-cyan-300/20 blur-2xl" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">Kế toán · xử lý yêu cầu</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Chi tiết yêu cầu</h1>
            <p className="mt-3 text-sm leading-6 text-blue-100">Kiểm tra phê duyệt, chứng từ và thực hiện đúng bước xác nhận hoặc thanh toán.</p>
          </div>
        </div>
      </section>

        <div className="h-8 w-60 rounded bg-white animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-120 rounded-2xl bg-white animate-pulse" />
          <div className="h-120 rounded-2xl bg-white animate-pulse" />
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <Link
          href="/accountant/disbursements"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Quay lại danh sách
        </Link>
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          Không tìm thấy yêu cầu giải ngân.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-indigo-700 text-white shadow-xl shadow-blue-900/10">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">Hồ sơ giải ngân · {getTypeLabel(detail.type)}</p>
            <h1 className="mt-2 break-all font-mono text-2xl font-bold tracking-tight sm:text-3xl">{detail.requestCode}</h1>
            <p className="mt-2 text-sm text-blue-100">Yêu cầu tạo lúc {formatDateTime(detail.createdAt)} · Người nhận: {detail.requester.fullName}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-sm font-semibold">{processingStatusLabel}</span>
            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5">
              <p className="text-xs text-blue-100">{isVerifyingExpense || isVerifiedExpenseWaitingForPayment ? "Số tiền hoàn chi" : "Số tiền đã duyệt"}</p>
              <p className="mt-1 text-lg font-bold">{formatCurrency(detail.approvedAmount)}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-6">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <SectionHeading number="1" title="Luồng phê duyệt" description="Ai đã xử lý yêu cầu và yêu cầu đang ở bước nào." />
            <div className="space-y-3 p-5">
              <TimelineStep
                title="Bước 1: Nhân viên tạo yêu cầu"
                subtitle={detail.requester.fullName}
                time={formatDateTime(detail.createdAt)}
                completed
              />

              <TimelineStep
                title="Bước 2: Trưởng nhóm duyệt"
                subtitle={tlApprovalEntry?.actorName ?? "Trưởng nhóm"}
                time={
                  tlApprovalEntry
                    ? formatDateTime(tlApprovalEntry.createdAt)
                    : "Chưa có dữ liệu"
                }
                note={tlApprovalEntry?.comment ?? undefined}
                completed={Boolean(tlApprovalEntry)}
              />

              <TimelineStep
                title={accountantStepTitle}
                subtitle={isVerifiedExpenseWaitingForPayment ? "Chứng từ đã hợp lệ; khoản hoàn chi đang chờ thanh toán" : canProcessDisbursement ? "Đang chờ xử lý" : detail.status === RequestStatus.REJECTED ? "Yêu cầu đã bị từ chối" : processingStatusLabel}
                time={accountantActionEntry ? formatDateTime(accountantActionEntry.createdAt) : "Hiện tại"}
                completed={detail.status === RequestStatus.PAID}
                current={canProcessDisbursement}
              />
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <SectionHeading number="2" title="Thông tin người nhận" description="Đối chiếu người thụ hưởng và tài khoản nhận tiền." />
            <div className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full border border-slate-200 bg-white text-slate-900 flex items-center justify-center text-sm font-semibold">
                {getInitials(detail.requester.fullName)}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {detail.requester.fullName}
                </p>
                <p className="text-xs text-slate-500">
                  {detail.requester.employeeCode} •{" "}
                  {detail.requester.departmentName}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <InfoCard label="Ngân hàng" value={detail.requester.bankName} />
              <InfoCard
                label="Số tài khoản"
                value={detail.requester.bankAccountNum}
                mono
              />
              <InfoCard
                label="Chủ tài khoản"
                value={detail.requester.bankAccountOwner}
              />
              <InfoCard
                label="Chức danh"
                value={detail.requester.jobTitle ?? "—"}
              />
            </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <SectionHeading number="3" title="Thông tin yêu cầu" description="Dự án, giai đoạn, khoản tiền và mục đích đã được duyệt." />
            <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2">
              <InfoCard
                label="Dự án"
                value={`${detail.project.projectCode} • ${detail.project.name}`}
              />
              <InfoCard
                label="Giai đoạn"
                value={`${detail.phase.phaseCode} • ${detail.phase.name}`}
              />
              <InfoCard
                label={isVerifyingExpense || isVerifiedExpenseWaitingForPayment ? "Số tiền hoàn chi đã duyệt" : "Số tiền đã duyệt"}
                value={formatCurrency(detail.approvedAmount)}
                tone="text-blue-700"
              />
              <div className="flex flex-col justify-center rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-xs font-medium text-blue-800">Ngân sách giai đoạn</p>
                <p className="mt-1 text-sm text-slate-700">Chi phí đã ghi nhận: {formatCurrency(detail.phase.currentSpent ?? 0)} / hạn mức {formatCurrency(detail.phase.budgetLimit ?? 0)}</p>
                <button type="button" onClick={() => void loadBudgetContext()} className="mt-3 inline-flex w-fit items-center gap-2 rounded-xl bg-blue-700 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-blue-800">
                  Xem chi tiết ngân sách
                  <span aria-hidden="true">↗</span>
                </button>
              </div>
            </div>

            <div className="mx-5 mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-500">Nội dung đề nghị</p>
              <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-800">{detail.description ?? "Không có mô tả"}</p>
            </div>

          </section>
        </div>

        <div className="flex flex-col gap-6 xl:sticky xl:top-6 xl:self-start">
          {!isVerifiedExpenseWaitingForPayment && (detail.type === "EXPENSE" || detail.type === "REIMBURSE") && <FinancialDocumentEditor documents={documentDrafts} amount={detail.approvedAmount ?? detail.amount} onChange={setDocumentDrafts} />}
          <section className="order-2 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <SectionHeading number="4" title={detail.type === RequestType.ADVANCE ? "Căn cứ dự toán đính kèm" : "Hóa đơn / chứng từ đính kèm"} description="Tài liệu dùng để đối chiếu trước khi xác nhận." />
            <div className="space-y-4 p-5">

            <p className="text-xs leading-5 text-slate-500">
              {detail.type === RequestType.ADVANCE
                ? "Tạm ứng là khoản tiền cấp trước khi chi. Báo giá/dự toán giúp xem xét mục đích và mức tiền; không phải hóa đơn và không bắt buộc có hóa đơn trước giải ngân."
                : "Hồ sơ chi thực tế cần có hóa đơn/biên nhận và thông tin đủ để đối chiếu số tiền, ngày, đơn vị bán, nội dung chi và yêu cầu liên quan."}
            </p>

            {detail.attachments.length === 0 ? (
              <p className={`rounded-xl border px-3 py-2 text-sm ${detail.type === RequestType.ADVANCE ? "border-blue-200 bg-blue-50 text-blue-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                {detail.type === RequestType.ADVANCE ? "Chưa có tài liệu dự toán đính kèm. Có thể xem xét dựa trên nội dung yêu cầu và thông tin ngân sách." : "Thiếu hóa đơn/chứng từ đính kèm. Cần bổ sung hồ sơ hợp lệ trước khi xác nhận."}
              </p>
            ) : (
              <div className="space-y-3">
                {detail.attachments.map((file) => (
                  <div
                    key={file.fileId}
                    className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5">
                        {getAttachmentIcon(file.fileType)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-slate-900 truncate">
                          {file.fileName}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>

                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-blue-700 hover:text-blue-700"
                    >
                      Xem
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M14 3h7m0 0v7m0-7L10 14"
                        />
                      </svg>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
          </section>

          <section className="order-1 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <SectionHeading number="5" title={!canProcessDisbursement ? processingStatusLabel : isVerifyingExpense ? "Xác nhận chứng từ hoàn chi" : isVerifiedExpenseWaitingForPayment ? "Thanh toán hoàn chi" : "Xác nhận giải ngân tạm ứng"} description="Nhập PIN sau khi đối chiếu thông tin và chứng từ liên quan." />
            <div className="space-y-4 p-5">
            <p className="text-sm text-slate-500">
              {!canProcessDisbursement ? "Yêu cầu này đã kết thúc; không cần thao tác thêm." : isVerifyingExpense ? "Nhập mã PIN để xác nhận chứng từ hợp lệ và ghi nhận chi phí." : isVerifiedExpenseWaitingForPayment ? "Nhập mã PIN để chuyển khoản hoàn chi đã được xác nhận." : "Nhập mã PIN để xác nhận giải ngân tạm ứng."}
            </p>

            <div
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <label className="block text-sm text-slate-600 mb-2">
                Mã PIN (5 chữ số)
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={5}
                value={pin}
                onChange={(event) => handlePinChange(event.target.value)}
                disabled={!canProcessDisbursement || submitting}
                placeholder="•••••"
                className="w-full px-4 py-3 rounded-2xl bg-blue-50 border border-slate-200 text-slate-900 tracking-[0.35em] text-center text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-50"
              />
              <textarea
                rows={2}
                value={disburseNote}
                onChange={(event) => setDisburseNote(event.target.value)}
                disabled={!canProcessDisbursement || submitting}
                placeholder={isVerifyingExpense ? "Ghi chú xác nhận chứng từ (không bắt buộc)" : "Ghi chú thanh toán (không bắt buộc)"}
                className="mt-3 w-full px-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-slate-900 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-50"
              />
              {pinError && (
                <p className="text-xs text-rose-700 mt-2">{pinError}</p>
              )}
            </div>

            <button
              type="button"
              onClick={handleDisburse}
              disabled={!canProcessDisbursement || pin.length < 5 || submitting}
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              {submitting && canProcessDisbursement && <svg className="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
              {!canProcessDisbursement ? processingStatusLabel : disburseStage === "verifying"
                ? "Đang xác thực PIN..."
                : disburseStage === "disbursing"
                  ? isVerifyingExpense ? "Đang xác nhận chứng từ..." : "Đang thanh toán..."
                  : isVerifyingExpense ? `Xác nhận chứng từ ${formatCurrency(detail.approvedAmount)}`
                    : isVerifiedExpenseWaitingForPayment ? `Thanh toán ${formatCurrency(detail.approvedAmount)}`
                      : `Giải ngân ${formatCurrency(detail.approvedAmount)}`}
            </button>

            {canProcessDisbursement && !isVerifiedExpenseWaitingForPayment && (
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(true);
                  setRejectReason("");
                  setRejectError(null);
                }}
                className="w-full px-4 py-3 rounded-2xl border border-rose-300 text-rose-700 hover:bg-rose-50 text-sm font-semibold transition-colors"
              >
                Từ chối giải ngân
              </button>
            )}
            </div>
          </section>
        </div>
      </div>

      {budgetContextOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
          <button type="button" className="absolute inset-0 bg-slate-950/65" aria-label="Đóng thông tin ngân sách" onClick={() => setBudgetContextOpen(false)} />
          <section role="dialog" aria-modal="true" aria-labelledby="budget-dialog-title" className="relative max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 shadow-2xl">
            <div className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-7 sm:py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Đối chiếu trước khi xử lý</p>
                <h2 id="budget-dialog-title" className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">Ngân sách của yêu cầu {detail.requestCode}</h2>
                <p className="mt-1 text-sm text-slate-500">Số liệu theo dự án, giai đoạn và hạng mục chi phí liên quan.</p>
              </div>
              <button type="button" autoFocus onClick={() => setBudgetContextOpen(false)} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">Đóng ×</button>
            </div>

            <div className="space-y-5 p-5 sm:p-7">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <PopupFact label="Dự án" value={`${detail.project.projectCode} · ${detail.project.name}`} />
                <PopupFact label="Giai đoạn" value={`${detail.phase.phaseCode} · ${detail.phase.name}`} />
                <PopupFact label="Hạng mục chi phí" value={budgetContext?.categoryName || detail.categoryName || "Chưa có hạng mục"} />
                <PopupFact label="Khoản đang xem" value={formatCurrency(detail.approvedAmount)} accent />
              </div>

              {budgetContextLoading && <div role="status" className="rounded-2xl border border-blue-200 bg-blue-50 p-6 text-center text-sm font-medium text-blue-800">Đang lấy ngân sách mới nhất…</div>}

              {!budgetContextLoading && budgetContextError && (
                <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
                  <p className="font-semibold">Không tải được ngân sách</p>
                  <p className="mt-1">{budgetContextError}</p>
                  <button type="button" onClick={() => void loadBudgetContext()} className="mt-3 rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800">Thử tải lại</button>
                </div>
              )}

              {!budgetContextLoading && budgetContext && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                    <p>Số liệu tính lúc <strong>{formatDateTime(budgetContext.calculatedAt)}</strong>. Khi xác nhận, hệ thống kiểm tra lại ngân sách mới nhất.</p>
                    <button type="button" onClick={() => void loadBudgetContext()} className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100">Làm mới</button>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-3">
                    <BudgetScopeCard title="Toàn dự án" scope={budgetContext.project} />
                    <BudgetScopeCard title={`Giai đoạn · ${budgetContext.phaseCode}`} scope={budgetContext.phase} />
                    {budgetContext.category ? <BudgetScopeCard title={`Hạng mục · ${budgetContext.categoryName ?? "Chi phí"}`} scope={budgetContext.category} /> : <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Yêu cầu chưa có ngân sách hạng mục để đối chiếu. Cần làm rõ trước khi xử lý.</div>}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
                    <p className="font-bold text-slate-900">Cách đọc số liệu</p>
                    <p className="mt-1">Khả dụng trước yêu cầu = hạn mức − chi phí đã ghi nhận − tiền giữ cho yêu cầu khác − tạm ứng chưa quyết toán. “Còn sau xử lý” cho thấy tác động dự kiến của yêu cầu này.</p>
                    <p className="mt-2">{detail.type === RequestType.ADVANCE ? "Tạm ứng được giải ngân trước khi có chi phí thực tế. Khoản còn treo tiếp tục chiếm ngân sách đến khi quyết toán hoặc hoàn trả." : detail.type === RequestType.REIMBURSE ? "Quyết toán chuyển tiền tạm ứng còn treo thành chi phí được xác nhận, không chuyển thêm tiền và không trừ ngân sách lần hai." : isVerifiedExpenseWaitingForPayment ? "Chi phí đã được ghi khi chứng từ hợp lệ được xác nhận. Thanh toán hoàn chi vào ví nhân viên không ghi thêm chi phí." : "Khoản nhân viên đã tự chi được ghi nhận là chi phí khi chứng từ được Kế toán xác nhận."}</p>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            onClick={() => setShowRejectModal(false)}
            aria-label="Đóng modal từ chối"
          />

          <div className="absolute inset-x-0 top-10 mx-auto w-[calc(100%-2rem)] max-w-xl rounded-3xl border border-slate-200 bg-white p-6 space-y-4">
            <h3 className="text-xl font-bold text-slate-900">
              Từ chối giải ngân - {detail.requestCode}
            </h3>

            <div>
              <label className="block text-sm text-slate-600 mb-2">
                Lý do từ chối
              </label>
              <textarea
                rows={4}
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-rose-500/40"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                "Thiếu chứng từ",
                "Số tiền không hợp lý",
                "Không đúng danh mục",
                "Vượt ngân sách",
              ].map((reasonChip) => (
                <button
                  key={reasonChip}
                  type="button"
                  onClick={() =>
                    setRejectReason((prev) =>
                      prev.trim()
                        ? `${prev.trim()}. ${reasonChip}`
                        : reasonChip,
                    )
                  }
                  className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs text-slate-600 hover:bg-blue-50"
                >
                  {reasonChip}
                </button>
              ))}
            </div>

            {rejectError && (
              <div className="px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-sm">
                {rejectError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void handleReject()}
                disabled={rejectReason.trim().length < 10 || rejectSubmitting}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold"
              >
                {rejectSubmitting && <svg className="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                {rejectSubmitting ? "Đang xử lý..." : "Xác nhận từ chối"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccess && successData && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/70" />
          <div className="absolute inset-x-0 top-16 mx-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-emerald-200 bg-white p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </span>
              <h3 className="text-xl font-bold text-slate-900">
                Giao dịch đã được xử lý thành công
              </h3>
            </div>

            <div className="space-y-2 rounded-2xl border border-slate-200 bg-blue-50 p-4">
              {successData.transactionCode && <p className="text-sm text-slate-600">
                Mã giao dịch:{" "}
                <span className="font-mono text-slate-900">
                  {successData.transactionCode}
                </span>
              </p>}
              <p className="text-sm text-slate-600">
                Số tiền:{" "}
                <span className="font-semibold text-emerald-700">
                  {formatCurrency(successData.amount)}
                </span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push("/accountant/disbursements")}
              className="w-full px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
            >
              Quay lại danh sách
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineStep({
  title,
  subtitle,
  time,
  note,
  completed,
  current,
}: {
  title: string;
  subtitle: string;
  time: string;
  note?: string;
  completed?: boolean;
  current?: boolean;
}) {
  return (
    <div className="relative pl-8">
      <span
        className={`absolute left-0 top-1 w-5 h-5 rounded-full border flex items-center justify-center ${
          current
            ? "border-amber-300 bg-amber-100 text-amber-700 animate-pulse"
            : completed
              ? "border-emerald-300 bg-emerald-100 text-emerald-700"
              : "border-slate-500/50 bg-slate-500/20 text-slate-600"
        }`}
      >
        {completed ? (
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M5 13l4 4L19 7"
            />
          </svg>
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
        )}
      </span>
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        {note && <p className="text-xs text-slate-600 mt-1">{note}</p>}
        <p className="text-xs text-slate-500 mt-1">{time}</p>
      </div>
    </div>
  );
}

function InfoCard({
  label,
  value,
  tone,
  mono,
}: {
  label: string;
  value: string;
  tone?: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`text-sm mt-1 ${tone ?? "text-slate-900"} ${mono ? "font-mono" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function SectionHeading({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-xs font-bold text-blue-800">{number}</span>
      <div><h2 className="text-base font-bold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div>
    </div>
  );
}

function PopupFact({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`min-w-0 rounded-2xl border p-4 ${accent ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"}`}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 break-words text-sm font-semibold ${accent ? "text-blue-800" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

function BudgetScopeCard({ title, scope }: { title: string; scope: DisbursementBudgetScope }) {
  const additionalExposure = scope.availableNow - scope.availableAfterThisRequest;
  const items = [
    ["Hạn mức", scope.budgetLimit],
    ["Chi phí đã ghi nhận", scope.recognizedExpense],
    ["Đang giữ cho yêu cầu khác", scope.reservedForOtherRequests],
    ["Tạm ứng chưa quyết toán", scope.openAdvance],
  ] as const;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-bold text-slate-900">{title}</h4>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${scope.availableAfterThisRequest < 0 ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>
          {scope.availableAfterThisRequest < 0 ? "Cần xem lại hạn mức" : "Trong hạn mức"}
        </span>
      </div>
      <dl className="mt-3 space-y-2">
        {items.map(([label, amount]) => <div key={label} className="flex items-start justify-between gap-3 text-xs"><dt className="text-slate-500">{label}</dt><dd className="text-right font-semibold tabular-nums text-slate-800">{formatCurrency(amount)}</dd></div>)}
      </dl>
      <div className="mt-4 border-t border-slate-100 pt-3">
        <div className="flex items-center justify-between gap-3 text-xs"><span className="text-slate-500">Khả dụng trước yêu cầu</span><strong className="tabular-nums text-slate-800">{formatCurrency(scope.availableNow)}</strong></div>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs"><span className="text-slate-500">Yêu cầu này chiếm thêm</span><strong className="tabular-nums text-slate-800">{formatCurrency(additionalExposure)}</strong></div>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><span className="text-xs font-semibold text-slate-700">Còn sau xử lý</span><strong className={`text-base font-bold tabular-nums ${scope.availableAfterThisRequest < 0 ? "text-rose-700" : "text-emerald-700"}`}>{formatCurrency(scope.availableAfterThisRequest)}</strong></div>
      </div>
    </div>
  );
}
