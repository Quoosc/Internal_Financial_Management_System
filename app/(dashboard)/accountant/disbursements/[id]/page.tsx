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

function getTypeClass(type: RequestType): string {
  switch (type) {
    case RequestType.ADVANCE:
      return "bg-violet-50 border-violet-200 text-violet-700";
    case RequestType.EXPENSE:
      return "bg-sky-100 border-sky-200 text-sky-700";
    case RequestType.REIMBURSE:
      return "bg-amber-50 border-amber-200 text-amber-700";
    default:
      return "bg-slate-500/15 border-slate-500/30 text-slate-600";
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

  const [checklist, setChecklist] = useState({
    identityVerified: false,
    amountVerified: false,
    attachmentsReviewed: false,
    budgetAvailable: false,
    approvalChainComplete: false,
  });

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
  const allChecked = useMemo(
    () => Object.entries(checklist).every(([key, checked]) =>
      (isVerifiedExpenseWaitingForPayment && key === "budgetAvailable") || checked),
    [checklist, isVerifiedExpenseWaitingForPayment],
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

  const budgetStillAvailable = useMemo(() => {
    if (isVerifiedExpenseWaitingForPayment) return true;
    if (!detail) return false;

    const budgetLimit = detail.phase.budgetLimit ?? 0;
    const currentSpent = detail.phase.currentSpent ?? 0;
    const remaining = budgetLimit - currentSpent;
    return remaining >= detail.approvedAmount;
  }, [detail, isVerifiedExpenseWaitingForPayment]);

  const handleChecklistChange = (key: keyof typeof checklist) => {
    setChecklist((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

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
    if (!allChecked) {
      setPinError("Vui lòng hoàn tất checklist trước khi giải ngân.");
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
      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-cyan-600 text-white shadow-xl shadow-blue-900/15">
        <div className="relative p-6 sm:p-8">
          <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 right-10 h-24 w-24 rounded-full bg-cyan-300/20 blur-2xl" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">Trung tâm giải ngân</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Chi tiết giải ngân</h1>
            <p className="mt-3 text-sm leading-6 text-blue-100">Kiểm tra người nhận, chứng từ, luồng phê duyệt và xác nhận chuyển tiền.</p>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link
          href="/accountant/disbursements"
          className="hover:text-slate-700 transition-colors"
        >
          Giải ngân
        </Link>
        <span>/</span>
        <span className="text-slate-600 font-mono">{detail.requestCode}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <InfoCard label="Mã yêu cầu" value={detail.requestCode} mono />
        <InfoCard label="Người nhận" value={detail.requester.fullName} />
        <InfoCard label={isVerifyingExpense || isVerifiedExpenseWaitingForPayment ? "Số tiền hoàn chi" : "Số tiền tạm ứng"} value={formatCurrency(detail.approvedAmount)} tone="text-amber-700" />
        <InfoCard label="Trạng thái xử lý" value={processingStatusLabel} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-6">
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500">Mã yêu cầu</p>
                <h1 className="text-2xl font-bold text-slate-900 font-mono mt-1">
                  {detail.requestCode}
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Tạo lúc {formatDateTime(detail.createdAt)}
                </p>
              </div>
              <div className="flex flex-col items-start lg:items-end gap-2">
                <span
                  className={`inline-flex px-3 py-1.5 rounded-full border text-sm ${getTypeClass(detail.type)}`}
                >
                  {getTypeLabel(detail.type)}
                </span>
                <p className="text-2xl font-bold text-amber-700">
                  {formatCurrency(detail.approvedAmount)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Luồng phê duyệt
            </h2>

            <div className="space-y-3">
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
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Thông tin người nhận
            </h2>

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

          <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Thông tin yêu cầu
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <InfoCard
                label="Dự án"
                value={`${detail.project.projectCode} • ${detail.project.name}`}
              />
              <InfoCard
                label="Giai đoạn"
                value={`${detail.phase.phaseCode} • ${detail.phase.name}`}
              />
              <InfoCard
                label="Ngân sách phase"
                value={`${formatCurrency(detail.phase.currentSpent ?? 0)} / ${formatCurrency(detail.phase.budgetLimit ?? 0)}`}
              />
              <InfoCard
                label="Số tiền giải ngân"
                value={formatCurrency(detail.approvedAmount)}
                tone="text-amber-700"
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Mô tả</p>
              <p className="text-sm text-slate-700 mt-1 whitespace-pre-line">
                {detail.description ?? "Không có mô tả"}
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Checklist kiểm tra
            </h2>

            <ChecklistItem
              checked={checklist.identityVerified}
              onToggle={() => handleChecklistChange("identityVerified")}
              label="Đã xác nhận danh tính người nhận"
            />

            <ChecklistItem
              checked={checklist.amountVerified}
              onToggle={() => handleChecklistChange("amountVerified")}
              label={`Số tiền khớp chứng từ (${formatCurrency(detail.approvedAmount)})`}
            />

            <ChecklistItem
              checked={checklist.attachmentsReviewed}
              onToggle={() => handleChecklistChange("attachmentsReviewed")}
              label="Đã xem xét tất cả chứng từ đính kèm"
            />

            <ChecklistItem
              checked={checklist.budgetAvailable}
              onToggle={() => handleChecklistChange("budgetAvailable")}
              label={isVerifyingExpense ? "Ngân sách dự án còn đủ cho khoản chi" : "Ngân sách dự án còn đủ cho khoản này"}
              hint={
                budgetStillAvailable
                  ? "Ngân sách khả dụng"
                  : "Ngân sách đang sát ngưỡng"
              }
            />

            <ChecklistItem
              checked={checklist.approvalChainComplete}
              onToggle={() => handleChecklistChange("approvalChainComplete")}
              label="Chuỗi phê duyệt đầy đủ và hợp lệ"
            />
          </div>
        </div>

        <div className="flex flex-col gap-6 xl:sticky xl:top-6 xl:self-start">
          {!isVerifiedExpenseWaitingForPayment && (detail.type === "EXPENSE" || detail.type === "REIMBURSE") && <FinancialDocumentEditor documents={documentDrafts} amount={detail.approvedAmount ?? detail.amount} onChange={setDocumentDrafts} />}
          <div className="order-2 rounded-3xl border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Chứng từ đính kèm
            </h2>

            {detail.attachments.length === 0 ? (
              <p className="text-sm text-slate-500">
                Không có chứng từ đính kèm.
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

          <div className="order-1 rounded-3xl border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">
              {!canProcessDisbursement ? processingStatusLabel : isVerifyingExpense ? "Xác nhận chứng từ hoàn chi" : isVerifiedExpenseWaitingForPayment ? "Thanh toán hoàn chi" : "Xác nhận giải ngân tạm ứng"}
            </h2>
            <p className="text-sm text-slate-500">
              {!canProcessDisbursement ? "Yêu cầu này đã kết thúc; không cần thao tác thêm." : isVerifyingExpense ? "Nhập mã PIN để xác nhận chứng từ hợp lệ và ghi nhận chi phí." : isVerifiedExpenseWaitingForPayment ? "Nhập mã PIN để chuyển khoản hoàn chi đã được xác nhận." : "Nhập mã PIN để xác nhận giải ngân tạm ứng."}
            </p>

            <div
              className={`rounded-2xl border p-4 ${allChecked ? "border-emerald-200 bg-emerald-500/5" : "border-slate-200 bg-white"}`}
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
                disabled={!canProcessDisbursement || !allChecked || submitting}
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
              {!allChecked && (
                <p className="text-xs text-amber-700 mt-2">
                  Cần hoàn tất checklist trước khi nhập PIN.
                </p>
              )}
              {pinError && (
                <p className="text-xs text-rose-700 mt-2">{pinError}</p>
              )}
            </div>

            <button
              type="button"
              onClick={handleDisburse}
              disabled={!canProcessDisbursement || pin.length < 5 || submitting || !allChecked}
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
        </div>
      </div>

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

function ChecklistItem({
  checked,
  onToggle,
  label,
  hint,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 cursor-pointer hover:border-slate-200 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 rounded border-slate-200 bg-white text-emerald-500 focus:ring-emerald-500/50"
      />
      <span className="text-sm text-slate-700">
        {label}
        {hint && (
          <span className="block text-xs text-slate-500 mt-1">{hint}</span>
        )}
      </span>
    </label>
  );
}
