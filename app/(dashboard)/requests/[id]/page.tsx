"use client";

import React, { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api-client";
import { formatCurrency, formatDate, formatDateTime, parseApiDate } from "@/lib/format";
import {
  RequestStatusBadge,
  RequestTypeBadge,
} from "@/components/ui/status-badge";
import { useToast } from "@/contexts/toast-context";
import { ConfirmModal } from "@/components/ui/confirm-modal";

import {
  RequestAction,
  RequestDetailResponse,
  RequestStatus,
  UpdateRequestBody,
} from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface ParsedDescription {
  title: string;
  expenseDate: string;
  body: string;
}

interface TimelineRow {
  title: string;
  subtitle: string;
  time: string;
  tone: "done" | "current" | "pending" | "rejected" | "cancelled";
}


function parseDescription(description: string | null): ParsedDescription {
  if (!description) {
    return { title: "", expenseDate: "", body: "" };
  }

  const lines = description.split("\n").map((line) => line.trim());
  const titleLine = lines.find((line) => line.startsWith("Tiêu đề:"));
  const expenseDateLine = lines.find((line) =>
    line.startsWith("Ngày chi tiêu:"),
  );

  const bodyLines = lines.filter(
    (line) =>
      !line.startsWith("Tiêu đề:") && !line.startsWith("Ngày chi tiêu:"),
  );

  return {
    title: titleLine ? titleLine.replace("Tiêu đề:", "").trim() : "",
    expenseDate: expenseDateLine
      ? expenseDateLine.replace("Ngày chi tiêu:", "").trim()
      : "",
    body: bodyLines.join("\n").trim(),
  };
}

function composeDescription(input: ParsedDescription): string {
  const rows = [
    `Tiêu đề: ${input.title.trim()}`,
    `Ngày chi tiêu: ${input.expenseDate.trim()}`,
    input.body.trim(),
  ].filter((line) => Boolean(line && line.trim()));

  return rows.join("\n");
}

function buildTimelineRows(request: RequestDetailResponse): TimelineRow[] {
  const rows: TimelineRow[] = [
    {
      title: "Yêu cầu đã được tạo",
      subtitle: `Người tạo: ${request.requesterName}`,
      time: formatDateTime(request.createdAt),
      tone: "done",
    },
  ];

  const sortedTimeline = [...request.timeline].sort(
    (a, b) => (parseApiDate(a.createdAt)?.getTime() ?? 0) - (parseApiDate(b.createdAt)?.getTime() ?? 0),
  );

  sortedTimeline.forEach((entry) => {
    rows.push({
      title:
        entry.action === RequestAction.APPROVE
          ? "Đã duyệt"
          : entry.action === RequestAction.REJECT
            ? "Đã từ chối"
          : entry.action === RequestAction.PAYOUT
              ? "Đã chi tiền"
              : entry.action === RequestAction.VERIFY
                ? "Kế toán đã xác nhận chứng từ"
              : entry.action === RequestAction.CANCEL
                ? "Đã hủy yêu cầu"
                : entry.action,
      subtitle: `${entry.actorName}${entry.comment ? ` • ${entry.comment}` : ""}`,
      time: formatDateTime(entry.createdAt),
      tone:
        entry.action === RequestAction.REJECT
          ? "rejected"
          : entry.action === RequestAction.CANCEL
            ? "cancelled"
            : "done",
    });
  });

  switch (request.status) {
    case RequestStatus.PENDING:
      rows.push({
        title: "Đang chờ Trưởng nhóm duyệt",
        subtitle: "Chưa có quyết định phê duyệt",
        time: "Hiện tại",
        tone: "current",
      });
      break;
    case RequestStatus.APPROVED_BY_TEAM_LEADER:
      rows.push({
        title: "Trưởng nhóm đã duyệt",
        subtitle: "Đang chờ Accountant xử lý giải ngân",
        time: "Hiện tại",
        tone: "current",
      });
      break;
    case RequestStatus.ACCOUNTANT_VERIFIED:
      rows.push({
        title: "Kế toán đã xác nhận chứng từ hoàn chi",
        subtitle: "Đang chờ chuyển khoản hoàn tiền cho nhân viên",
        time: "Hiện tại",
        tone: "current",
      });
      break;
    case RequestStatus.APPROVED_BY_MANAGER:
      rows.push({
        title: "Manager đã duyệt — đang xử lý",
        subtitle: "Hệ thống sẽ tự động cấp vốn",
        time: "Hiện tại",
        tone: "current",
      });
      break;
    case RequestStatus.APPROVED_BY_CFO:
      rows.push({
        title: "CFO đã duyệt — đang xử lý",
        subtitle: "Hệ thống sẽ tự động cấp quota",
        time: "Hiện tại",
        tone: "current",
      });
      break;
    case RequestStatus.PAID:
      rows.push({
        title: "Yêu cầu đã xử lý đầy đủ",
        subtitle: "Khoản tiền đã được chi",
        time: "Hiện tại",
        tone: "done",
      });
      break;
    case RequestStatus.REJECTED:
      rows.push({
        title: "Yêu cầu kết thúc với trạng thái từ chối",
        subtitle: request.rejectReason
          ? `Lý do: ${request.rejectReason}`
          : "Không có lý do chi tiết",
        time: "Hiện tại",
        tone: "rejected",
      });
      break;
    case RequestStatus.CANCELLED:
      rows.push({
        title: "Yêu cầu đã bị hủy",
        subtitle: "Không tiếp tục xử lý",
        time: "Hiện tại",
        tone: "cancelled",
      });
      break;
    default:
      rows.push({
        title: "Đang xử lý",
        subtitle: "Vui lòng theo dõi cập nhật mới",
        time: "Hiện tại",
        tone: "pending",
      });
  }

  return rows;
}

function getTimelineToneClass(tone: TimelineRow["tone"]): string {
  switch (tone) {
    case "done":
      return "bg-emerald-500 border-emerald-400";
    case "current":
      return "bg-blue-500 border-blue-400";
    case "pending":
      return "bg-amber-500 border-amber-400";
    case "rejected":
      return "bg-rose-500 border-rose-400";
    case "cancelled":
      return "bg-slate-500 border-slate-400";
    default:
      return "bg-slate-500 border-slate-400";
  }
}

function getTimelineCardClass(tone: TimelineRow["tone"]): string {
  switch (tone) {
    case "done":
      return "border-emerald-200 bg-emerald-500/5";
    case "current":
      return "border-blue-200 bg-blue-500/5";
    case "pending":
      return "border-amber-200 bg-amber-500/5";
    case "rejected":
      return "border-rose-200 bg-rose-500/5";
    case "cancelled":
      return "border-slate-500/20 bg-slate-500/5";
    default:
      return "border-slate-200 bg-white";
  }
}

function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function RequestDetailPage({ params }: PageProps) {
  const router = useRouter();
  const toast = useToast();
  const { id } = use(params);

  const [request, setRequest] = useState<RequestDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [sseVersion, setSseVersion] = useState(0);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    message: string;
    onConfirm: () => void;
  }>({ open: false, message: "", onConfirm: () => {} });

  const [editAmount, setEditAmount] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editExpenseDate, setEditExpenseDate] = useState("");
  const [editDescription, setEditDescription] = useState("");

  useEffect(() => {
    const numId = Number(id);
    const handleNotification = (event: Event) => {
      const n = (event as CustomEvent).detail as { refType?: string | null; refId?: number | null };
      if (n?.refType === "REQUEST" && n?.refId === numId) setSseVersion((v) => v + 1);
    };
    window.addEventListener("notifications:new", handleNotification);
    return () => window.removeEventListener("notifications:new", handleNotification);
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    const loadDetail = async () => {
      setLoading(true);

      try {
        const res = await api.get<RequestDetailResponse>(
          `/api/v1/requests/${id}`,
        );

        if (cancelled) return;
        setRequest(res.data);
      } catch (err) {
        if (cancelled) return;
        setRequest(null);
        if (err instanceof ApiError && err.status === 404) {
          toast.error("Yêu cầu không tồn tại hoặc không thuộc về bạn.");
        } else {
          toast.error(err instanceof ApiError ? err.apiMessage : "Không thể tải chi tiết yêu cầu.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [id, toast, sseVersion]);

  const parsed = useMemo(
    () => parseDescription(request?.description ?? ""),
    [request],
  );
  const timelineRows = useMemo(
    () => (request ? buildTimelineRows(request) : []),
    [request],
  );

  const canEditOrCancel = request?.status === RequestStatus.PENDING;

  const openEdit = () => {
    if (!request) return;

    const parsedLocal = parseDescription(request.description);
    setEditAmount(String(request.amount));
    setEditTitle(parsedLocal.title);
    setEditExpenseDate(parsedLocal.expenseDate);
    setEditDescription(parsedLocal.body);
    setEditing(true);
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!request) return;

    const amountNumber = Number(editAmount.replace(/\D/g, ""));
    if (!amountNumber || amountNumber <= 0) {
      toast.error("Số tiền cập nhật không hợp lệ.");
      return;
    }

    if (!editTitle.trim()) {
      toast.error("Vui lòng nhập tiêu đề.");
      return;
    }

    if (!editDescription.trim()) {
      toast.error("Vui lòng nhập mô tả.");
      return;
    }

    if (!editExpenseDate.trim()) {
      toast.error("Vui lòng chọn ngày chi tiêu.");
      return;
    }

    const mergedDescription = composeDescription({
      title: editTitle,
      expenseDate: editExpenseDate,
      body: editDescription,
    });

    const updateBody: UpdateRequestBody = {
      amount: amountNumber,
      description: mergedDescription,
      attachments: request.attachments.map((file) => ({
        fileName: file.fileName,
        cloudinaryPublicId: file.cloudinaryPublicId || undefined,
        url: file.url,
        fileType: file.fileType,
        size: file.size,
      })),
    };

    setActionLoading(true);

    try {
      const res = await api.put<RequestDetailResponse>(
        `/api/v1/requests/${id}`,
        updateBody,
      );
      setRequest(res.data);
      setEditing(false);
      toast.success("Yêu cầu đã được cập nhật thành công!");
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.apiMessage);
      } else {
        toast.error("Không thể cập nhật yêu cầu. Vui lòng thử lại.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRequest = () => {
    if (!request) return;
    setConfirmState({
      open: true,
      message: "Bạn chắc chắn muốn hủy yêu cầu này?",
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, open: false }));
        setActionLoading(true);
        try {
          await api.delete(`/api/v1/requests/${id}`);
          toast.success("Đã hủy yêu cầu thành công.");
          router.push("/requests");
        } catch (err) {
          if (err instanceof ApiError) {
            toast.error(err.apiMessage);
          } else {
            toast.error("Không thể hủy yêu cầu. Vui lòng thử lại.");
          }
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-9 w-40 rounded bg-white animate-pulse" />
        <div className="h-32 rounded-2xl bg-white animate-pulse" />
        <div className="h-64 rounded-2xl bg-white animate-pulse" />
        <div className="h-64 rounded-2xl bg-white animate-pulse" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <button
          type="button"
          onClick={() => router.push("/requests")}
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
        </button>
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 text-center text-slate-500">
          Không tìm thấy yêu cầu.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <button
        type="button"
        onClick={() => router.push("/requests")}
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-blue-700"
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
        Danh sách yêu cầu
      </button>

      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-indigo-700 text-white shadow-xl shadow-blue-900/10">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">Hồ sơ yêu cầu · IFMS</p>
            <h1 className="mt-2 break-all text-2xl font-bold tracking-tight sm:text-3xl">{request.requestCode}</h1>
            <p className="mt-2 text-sm text-blue-100">Theo dõi nội dung, chứng từ và các bước xử lý của yêu cầu.</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm">
            <p className="text-xs text-blue-100">Ngày tạo</p>
            <p className="mt-1 text-sm font-semibold">{formatDateTime(request.createdAt)}</p>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Tổng quan yêu cầu</h2>
          <p className="mt-1 text-sm text-slate-500">Số tiền và trạng thái xử lý hiện tại.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Số tiền đề nghị</p>
            <p className="mt-2 text-xl font-bold text-slate-900">{formatCurrency(request.amount)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2 text-xs text-slate-500">Loại yêu cầu</p>
            <RequestTypeBadge type={request.type} />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2 text-xs text-slate-500">Trạng thái</p>
            <RequestStatusBadge status={request.status} type={request.type} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">Nội dung đề nghị</h2>
              <p className="mt-1 text-sm text-slate-500">Dự án, giai đoạn và nội dung sử dụng tiền.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
              <DetailCell label="Tiêu đề" value={parsed.title || "—"} />
              <DetailCell
                label="Dự án"
                value={
                  `${request.projectCode ?? ""} ${request.projectName ?? ""}`.trim() ||
                  "—"
                }
              />
              <DetailCell
                label="Giai đoạn"
                value={
                  `${request.phaseCode ?? ""} ${request.phaseName ?? ""}`.trim() ||
                  "—"
                }
              />
              <DetailCell
                label="Hạng mục chi phí"
                value={request.categoryName ?? "—"}
              />
              <DetailCell
                label="Ngày chi tiêu"
                value={
                  parsed.expenseDate ? formatDate(parsed.expenseDate) : "—"
                }
              />
            </div>

            <div className="mx-5 mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Mô tả</p>
              <p className="text-sm text-slate-900 mt-1 whitespace-pre-line">
                {parsed.body || request.description || "Không có mô tả"}
              </p>
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">Tệp đính kèm</h2>
              <p className="mt-1 text-sm text-slate-500">Chứng từ và tài liệu tham chiếu của yêu cầu.</p>
            </div>
            <div className="p-5">
            {request.attachments.length === 0 ? (
              <p className="text-sm text-slate-500">Không có tệp đính kèm.</p>
            ) : (
              <div className="space-y-3">
                {request.attachments.map((file) => (
                  <div
                    key={file.fileId}
                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3 rounded-2xl border border-slate-200 bg-white"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-slate-900 truncate">
                        {file.fileName}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {file.fileType} • {formatAttachmentSize(file.size)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
                      >
                        Xem trước
                      </a>
                      <a
                        href={file.url}
                        download
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                      >
                        Tải xuống
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </section>

          {canEditOrCancel && (
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-4"><h2 className="text-lg font-bold text-slate-900">Thao tác</h2><p className="mt-1 text-sm text-slate-500">Chỉnh sửa hoặc hủy yêu cầu khi còn trong trạng thái cho phép.</p></div>
              <div className="flex flex-wrap gap-3 p-5">
                <button
                  type="button"
                  onClick={openEdit}
                  disabled={actionLoading}
                  className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
                >
                  Chỉnh sửa
                </button>

                <button
                  type="button"
                  onClick={handleCancelRequest}
                  disabled={actionLoading}
                  className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
                >
                  Hủy yêu cầu
                </button>
              </div>
            </section>
          )}
        </div>

        <section className="h-fit overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">Lịch sử xử lý</h2>
            <p className="mt-1 text-sm text-slate-500">Các bước đã được thực hiện trên yêu cầu.</p>
          </div>
          <div className="space-y-3 p-5">
            {timelineRows.map((row, index) => (
              <div key={`${row.title}-${index}`} className="relative pl-8">
                {index < timelineRows.length - 1 && (
                  <span className="absolute left-[11px] top-6 bottom-[-14px] w-px bg-slate-200" />
                )}
                <span
                  className={`absolute left-0 top-1 w-[22px] h-[22px] rounded-full border-2 ${getTimelineToneClass(row.tone)}`}
                />
                <div
                  className={`rounded-2xl border p-3 ${getTimelineCardClass(row.tone)}`}
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {row.title}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">{row.subtitle}</p>
                  <p className="text-xs text-slate-500 mt-1">{row.time}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setEditing(false)}
            aria-label="Đóng form chỉnh sửa"
          />

          <div className="absolute inset-x-0 top-8 mx-auto w-[calc(100%-2rem)] max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-sm shadow-2xl p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">
              Chỉnh sửa yêu cầu
            </h3>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Số tiền
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={
                    editAmount
                      ? formatCurrency(Number(editAmount.replace(/\D/g, "")))
                      : ""
                  }
                  onChange={(e) =>
                    setEditAmount(e.target.value.replace(/\D/g, ""))
                  }
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Tiêu đề
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Ngày chi tiêu
                </label>
                <input
                  type="date"
                  value={editExpenseDate}
                  onChange={(e) => setEditExpenseDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Mô tả
                </label>
                <textarea
                  rows={4}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors"
                >
                  Hủy
                </button>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
                >
                  {actionLoading ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal
        open={confirmState.open}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm text-slate-900 font-medium mt-1">{value}</p>
    </div>
  );
}
