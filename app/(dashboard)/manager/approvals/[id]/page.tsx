"use client";

import Link from "next/link";
import React, { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api-client";
import { useToast } from "@/contexts/toast-context";
import {
  ManagerApprovalDetailResponse,
  ManagerApproveBody,
  ManagerApproveResponse,
  ManagerRejectBody,
  ManagerRejectResponse,
  ProjectStatus,
  RequestAction,
  RequestStatus,
} from "@/types";
import { formatCurrency, formatDateTime, parseApiDate } from "@/lib/format";
import { CurrencyInput } from "@/components/ui/currency-input";

interface PageProps {
  params: Promise<{ id: string }>;
}


const REJECT_REASON_SUGGESTIONS = [
  "Thiếu căn cứ sử dụng vốn",
  "Mức đề xuất chưa phù hợp",
  "Cần bổ sung kế hoạch chi tiết",
  "Quỹ PB chưa đủ",
];

function statusClass(status: RequestStatus): string {
  switch (status) {
    case RequestStatus.PENDING:
      return "bg-amber-100 border-amber-200 text-amber-700";
    case RequestStatus.PAID:
      return "bg-emerald-100 border-emerald-200 text-emerald-700";
    case RequestStatus.REJECTED:
      return "bg-rose-100 border-rose-200 text-rose-700";
    default:
      return "bg-slate-100 border-slate-200 text-slate-600";
  }
}

function statusLabel(status: RequestStatus): string {
  switch (status) {
    case RequestStatus.PENDING:
      return "Chờ duyệt";
    case RequestStatus.PAID:
      return "Đã cấp vốn";
    case RequestStatus.REJECTED:
      return "Đã từ chối";
    default:
      return status;
  }
}

function timelineActionLabel(action: RequestAction): string {
  switch (action) {
    case RequestAction.APPROVE:
      return "Duyệt";
    case RequestAction.REJECT:
      return "Từ chối";
    case RequestAction.PAYOUT:
      return "Giải ngân";
    case RequestAction.CANCEL:
      return "Hủy";
    default:
      return action;
  }
}

function timelineIcon(action: RequestAction): React.ReactNode {
  switch (action) {
    case RequestAction.APPROVE:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
        </svg>
      );
    case RequestAction.REJECT:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
  }
}

export default function ManagerApprovalDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = use(params);
  const toast = useToast();

  const [request, setRequest] = useState<ManagerApprovalDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const [approvedAmount, setApprovedAmount] = useState("");
  const [approveComment, setApproveComment] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadDetail = async () => {
      setLoading(true);

      try {
        const res = await api.get<ManagerApprovalDetailResponse>(`/api/v1/manager/approvals/${id}`);

        if (cancelled) return;

        setRequest(res.data);
      } catch (err) {
        if (cancelled) return;

        setRequest(null);

        if (err instanceof ApiError) {
          toast.error(err.apiMessage);
        } else {
          toast.error("Không thể tải chi tiết yêu cầu.");
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

  const maxApprovable = useMemo(() => {
    if (!request) return 0;
    return Math.max(0, Math.min(request.amount, request.department.totalAvailableBalance));
  }, [request]);

  const previewApprovedAmount = useMemo(() => {
    if (!request) return 0;

    const fromInput = Number(approvedAmount);
    if (!Number.isFinite(fromInput) || fromInput <= 0) {
      return Math.min(request.amount, maxApprovable || request.amount);
    }

    return Math.min(fromInput, maxApprovable || request.amount);
  }, [approvedAmount, maxApprovable, request]);

  const canTakeAction = request?.status === RequestStatus.PENDING;

  const openApproveModal = () => {
    if (!request) return;
    setApprovedAmount(String(Math.min(request.amount, maxApprovable || request.amount)));
    setApproveComment("");
    setActionError(null);
    setShowApproveModal(true);
  };

  const openRejectModal = () => {
    setRejectReason("");
    setActionError(null);
    setShowRejectModal(true);
  };

  const handleApprove = async () => {
    if (!request) return;

    const numericAmount = Number(approvedAmount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setActionError("Số tiền duyệt phải lớn hơn 0.");
      return;
    }

    if (numericAmount > maxApprovable) {
      setActionError("Số tiền duyệt vượt mức quỹ phòng ban khả dụng.");
      return;
    }

    setSubmitting(true);
    setActionError(null);

    const body: ManagerApproveBody = {
      approvedAmount: numericAmount,
      comment: approveComment.trim() || undefined,
    };

    try {
      await api.post<ManagerApproveResponse>(`/api/v1/manager/approvals/${id}/approve`, body);
      toast.success("Đã duyệt yêu cầu thành công.");
      router.replace("/manager/approvals?tab=approved");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.apiMessage);
      } else {
        setActionError("Không thể duyệt yêu cầu. Vui lòng thử lại.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!request) return;

    if (rejectReason.trim().length < 10) {
      setActionError("Lý do từ chối cần ít nhất 10 ký tự.");
      return;
    }

    setSubmitting(true);
    setActionError(null);

    const body: ManagerRejectBody = { reason: rejectReason.trim() };

    try {
      await api.post<ManagerRejectResponse>(`/api/v1/manager/approvals/${id}/reject`, body);
      toast.success("Đã từ chối yêu cầu.");
      router.push("/manager/approvals");
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.apiMessage);
      } else {
        setActionError("Không thể từ chối yêu cầu. Vui lòng thử lại.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 rounded bg-white animate-pulse" />
        <div className="h-36 rounded-2xl bg-white animate-pulse" />
        <div className="h-72 rounded-2xl bg-white animate-pulse" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="space-y-4">
        <Link href="/manager/approvals" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          Quay lại danh sách
        </Link>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center text-slate-500">
          Không tìm thấy yêu cầu.
        </div>
      </div>
    );
  }

  const overDeptBudget = request.amount > request.department.totalAvailableBalance;
  // See isOverBudget() in manager/approvals/page.tsx for why this proxy
  // (totalBudget - availableBudget) is used instead of the backend's exact
  // availableBudget + totalSpent + amount > totalBudget check: totalSpent
  // isn't exposed on this DTO, and this conservative proxy avoids false
  // "over budget" warnings while the backend remains authoritative.
  const overProjectBudget = request.amount > request.project.totalBudget - request.project.availableBudget;
  const projectInactive = request.project.status !== ProjectStatus.ACTIVE;

  const sortedTimeline = [...request.timeline].sort(
    (a, b) => (parseApiDate(a.createdAt)?.getTime() ?? 0) - (parseApiDate(b.createdAt)?.getTime() ?? 0)
  );
  const remainingDeptBudget = Math.max(0, request.department.totalAvailableBalance - previewApprovedAmount);
  const projectAfterApproval = request.project.availableBudget + previewApprovedAmount;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-indigo-200 bg-linear-to-br from-indigo-700 via-blue-600 to-cyan-600 text-white shadow-xl shadow-indigo-900/15">
        <div className="relative px-6 py-7 sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.28),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(103,232,249,0.22),_transparent_34%)]" />
          <div className="relative">
            <Link
              href="/manager/approvals"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 19l-7-7 7-7" />
              </svg>
              Quay lại danh sách
            </Link>

            <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-indigo-100">{request.requestCode}</p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Chi tiết cấp vốn dự án</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-100">
                  Xem xét nhu cầu cấp vốn, ngân sách phòng ban và tác động sau phê duyệt.
                </p>
              </div>

              <div className="flex flex-col items-start gap-3 lg:items-end">
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">
                    Cấp vốn DA
                  </span>
                  <span className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${statusClass(request.status)}`}>
                    {statusLabel(request.status)}
                  </span>
                  {projectInactive && (
                    <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-700">
                      Dự án không còn hoạt động
                    </span>
                  )}
                </div>
                <p className="text-3xl font-bold">{formatCurrency(request.amount)}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Số tiền yêu cầu" value={formatCurrency(request.amount)} helper={`Tạo lúc ${formatDateTime(request.createdAt)}`} tone="blue" />
        <MetricCard label="Có thể duyệt" value={formatCurrency(maxApprovable)} helper="Theo quỹ phòng ban khả dụng" tone="emerald" />
        <MetricCard label="Quỹ PB sau duyệt" value={formatCurrency(remainingDeptBudget)} helper="Sau khi trừ số tiền duyệt" tone={overDeptBudget ? "rose" : "indigo"} />
        <MetricCard label="Dự án sau duyệt" value={formatCurrency(projectAfterApproval)} helper={request.project.projectCode} tone="cyan" />
      </section>

      <div className="rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm font-medium text-blue-800">
        Phê duyệt sẽ tự động trích {formatCurrency(previewApprovedAmount)} từ Quỹ Phòng ban sang Dự án, không qua Kế toán.
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900">Người gửi yêu cầu</h2>
              <p className="mt-1 text-sm text-slate-500">Thông tin Trưởng nhóm tạo đề xuất cấp vốn.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <InfoCard label="Họ tên" value={request.requester.fullName} />
              <InfoCard label="Mã nhân viên" value={request.requester.employeeCode} />
              <InfoCard label="Chức danh" value={request.requester.jobTitle ?? "—"} />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900">Ngân sách dự án</h2>
              <p className="mt-1 text-sm text-slate-500">So sánh ngân sách hiện tại và ngân sách sau khi duyệt.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <InfoCard
                label="Dự án"
                value={`${request.project.projectCode} • ${request.project.name}`}
              />
              <InfoCard label="Tổng ngân sách DA" value={formatCurrency(request.project.totalBudget)} />
              <InfoCard label="Ngân sách hiện tại" value={formatCurrency(request.project.availableBudget)} />
              <InfoCard label="Yêu cầu thêm" value={formatCurrency(request.amount)} />
              <InfoCard
                label="Sau phê duyệt"
                value={formatCurrency(request.project.availableBudget + previewApprovedAmount)}
              />
            </div>
            {projectInactive && (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                Dự án hiện không ở trạng thái <strong>Đang hoạt động</strong>. Hệ thống sẽ từ chối phê duyệt cấp vốn cho dự án này.
              </div>
            )}
            {!projectInactive && overProjectBudget && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Số tiền yêu cầu có thể vượt ngân sách kế hoạch (tổng ngân sách) của dự án. Hệ thống sẽ kiểm tra lại chính xác khi phê duyệt.
              </div>
            )}
          </div>

          <div
            className={`rounded-3xl border p-5 ${
              overDeptBudget
                ? "border-rose-200 bg-rose-50"
                : "border-emerald-200 bg-emerald-50"
            }`}
          >
            <p className={`text-sm ${overDeptBudget ? "text-rose-700" : "text-emerald-700"}`}>
              Số dư ví phòng ban hiện tại: {formatCurrency(request.department.totalAvailableBalance)}
            </p>
            {overDeptBudget && (
              <p className="text-xs text-rose-700 mt-2">Yêu cầu hiện vượt mức quỹ phòng ban đang khả dụng.</p>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Nội dung yêu cầu</h2>
            <p className="text-sm text-slate-600 whitespace-pre-line">{request.description || "Không có mô tả"}</p>
          </div>

          {canTakeAction && (
            <div className="rounded-3xl border border-blue-100 bg-blue-50/60 p-5">
              <h2 className="text-lg font-bold text-slate-900">Thao tác phê duyệt</h2>
              <p className="mt-1 text-sm text-slate-500">Sau khi duyệt, quỹ sẽ được chuyển sang dự án ngay.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={openApproveModal}
                  className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/15 transition hover:bg-blue-500"
                >
                  Duyệt
                </button>

                <button
                  type="button"
                  onClick={openRejectModal}
                  className="rounded-2xl border border-rose-200 bg-white px-5 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-50"
                >
                  Từ chối
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">Lịch sử xử lý</h2>
            <p className="mt-1 text-sm text-slate-500">Lịch sử xử lý cấp vốn.</p>
          </div>

          {sortedTimeline.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có lịch sử xử lý.</p>
          ) : (
            <div className="space-y-3">
              {sortedTimeline.map((entry, index) => (
                <div key={entry.id} className="relative pl-8">
                  {index < sortedTimeline.length - 1 && (
                    <span className="absolute left-3 top-7 bottom-[-10px] w-px bg-slate-200" />
                  )}

                  <span className="absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-700">
                    {timelineIcon(entry.action)}
                  </span>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <p className="text-sm font-bold text-slate-900">{timelineActionLabel(entry.action)}</p>
                    <p className="text-xs text-slate-500 mt-1">{entry.actorName}</p>
                    {entry.comment && <p className="text-xs text-slate-600 mt-1">{entry.comment}</p>}
                    <p className="text-xs text-slate-500 mt-1">{formatDateTime(entry.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showApproveModal && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            onClick={() => setShowApproveModal(false)}
            aria-label="Đóng modal duyệt"
          />

          <div className="absolute inset-x-0 top-10 mx-auto w-[calc(100%-2rem)] max-w-xl rounded-3xl border border-blue-100 bg-white p-6 shadow-2xl shadow-slate-950/20">
            <div className="mb-5">
              <h3 className="text-xl font-bold text-slate-900">Xác nhận duyệt yêu cầu</h3>
              <p className="mt-1 text-sm text-slate-500">{request.requestCode}</p>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">Số tiền duyệt</label>
              <CurrencyInput
                value={Number(approvedAmount) || null}
                onChange={(value) => setApprovedAmount(value ? String(value) : "")}
                error={actionError ?? undefined}
                max={maxApprovable}
                className="focus:ring-blue-500/40"
              />
              <p className="text-xs text-slate-500 mt-1">Tối đa {formatCurrency(maxApprovable)}</p>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">Ghi chú</label>
              <textarea
                rows={4}
                value={approveComment}
                onChange={(event) => setApproveComment(event.target.value)}
                placeholder="Nhận xét của bạn (tuỳ chọn)"
                className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span className="font-semibold">⚠ Tự động chuyển tiền:</span>{" "}
              Sau khi duyệt, hệ thống sẽ <strong>ngay lập tức</strong> trích{" "}
              {formatCurrency(Number(approvedAmount) || 0)} từ quỹ phòng ban vào quỹ dự án — không thể hoàn tác.
            </div>

            {actionError && (
              <div className="px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-sm">
                {actionError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={submitting || maxApprovable <= 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting && <svg className="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                {submitting ? "Đang xử lý..." : "Xác nhận duyệt"}
              </button>
            </div>
          </div>
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

          <div className="absolute inset-x-0 top-10 mx-auto w-[calc(100%-2rem)] max-w-xl rounded-3xl border border-rose-100 bg-white p-6 shadow-2xl shadow-slate-950/20">
            <div className="mb-5">
              <h3 className="text-xl font-bold text-slate-900">Từ chối yêu cầu - {request.requestCode}</h3>
              <p className="mt-1 text-sm text-slate-500">Lý do từ chối sẽ được ghi vào timeline xử lý.</p>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">Lý do từ chối</label>
              <textarea
                rows={4}
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-500/10"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {REJECT_REASON_SUGGESTIONS.map(
                (chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() =>
                      setRejectReason((prev) => (prev.trim() ? `${prev.trim()}. ${chip}` : chip))
                    }
                    className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs text-slate-600 hover:bg-slate-100"
                  >
                    {chip}
                  </button>
                )
              )}
            </div>

            {actionError && (
              <div className="px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-sm">
                {actionError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={rejectReason.trim().length < 10 || submitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting && <svg className="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                {submitting ? "Đang xử lý..." : "Xác nhận từ chối"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: "blue" | "emerald" | "indigo" | "cyan" | "rose";
}) {
  const toneClassName = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
    cyan: "bg-cyan-50 text-cyan-700 border-cyan-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
  }[tone];

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`mb-4 h-2 w-12 rounded-full border ${toneClassName}`} />
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{helper}</p>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
