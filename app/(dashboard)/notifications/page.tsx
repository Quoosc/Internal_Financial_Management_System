"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api-client";
import { getNotifications, markAllAsRead, markAsRead } from "@/lib/api";
import { useToast } from "@/contexts/toast-context";
import { NotificationResponse, NotificationType } from "@/types";
import { getNotificationTarget } from "@/lib/adapters/notification-routing";
import { formatRelativeTime } from "@/lib/format";

const PAGE_SIZE = 20;

type NotificationFilterTab = "ALL" | "UNREAD";

function getTypeIcon(type: string): React.ReactNode {
  switch (type) {
    case NotificationType.REQUEST_SUBMITTED:
    case NotificationType.REQUEST_APPROVED_BY_TL:
    case NotificationType.REQUEST_PAID:
    case NotificationType.EXPENSE_VERIFIED:
    case NotificationType.EXPENSE_PAID:
    case NotificationType.PROJECT_TOPUP_APPROVED:
    case NotificationType.DEPT_TOPUP_APPROVED:
      return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case NotificationType.REQUEST_REJECTED:
    case NotificationType.PROJECT_TOPUP_REJECTED:
    case NotificationType.DEPT_TOPUP_REJECTED:
      return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    case NotificationType.SALARY_PAID:
      return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
        </svg>
      );
    case NotificationType.SECURITY_ALERT:
      return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 9v2m0 4h.01M10.29 3.86l-8.03 14A2 2 0 004 21h16a2 2 0 001.74-3.14l-8.03-14a2 2 0 00-3.48 0z" />
        </svg>
      );
    default:
      return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 17h5l-1.4-1.4A2 2 0 0118 14.16V11a6 6 0 00-4-5.66V5a2 2 0 10-4 0v.34A6 6 0 006 11v3.16c0 .53-.21 1.04-.6 1.43L4 17h5" />
        </svg>
      );
  }
}

function getTypeIconClass(type: string): string {
  switch (type) {
    case NotificationType.REQUEST_SUBMITTED:
    case NotificationType.REQUEST_APPROVED_BY_TL:
    case NotificationType.REQUEST_PAID:
    case NotificationType.EXPENSE_VERIFIED:
    case NotificationType.EXPENSE_PAID:
    case NotificationType.PROJECT_TOPUP_APPROVED:
    case NotificationType.DEPT_TOPUP_APPROVED:
      return "border-emerald-100 bg-emerald-50 text-emerald-700";
    case NotificationType.REQUEST_REJECTED:
    case NotificationType.PROJECT_TOPUP_REJECTED:
    case NotificationType.DEPT_TOPUP_REJECTED:
      return "border-rose-100 bg-rose-50 text-rose-700";
    case NotificationType.SALARY_PAID:
      return "border-blue-100 bg-blue-50 text-blue-700";
    case NotificationType.SECURITY_ALERT:
      return "border-amber-100 bg-amber-50 text-amber-700";
    default:
      return "border-blue-100 bg-blue-50 text-blue-700";
  }
}

function toUserFacingText(value: string): string {
  return value
    .replaceAll("DEPARTMENT_TOPUP", "cấp ngân sách phòng ban")
    .replaceAll("PROJECT_TOPUP", "cấp vốn dự án")
    .replaceAll("ADVANCE", "tạm ứng")
    .replaceAll("EXPENSE", "thanh toán chi phí")
    .replaceAll("REIMBURSE", "hoàn ứng");
}

export default function NotificationsPage() {
  const router = useRouter();
  const toast = useToast();

  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<NotificationFilterTab>("ALL");
  const [loading, setLoading] = useState(false);
  const seenSseNotificationIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    void markAllAsRead().then(() => {
      setUnreadCount(0);
      window.dispatchEvent(new Event("notifications:changed"));
    }).catch(() => {});
  }, []);

  const prependNotificationFromSse = useCallback(
    (incoming: NotificationResponse) => {
      if (!incoming || typeof incoming.id !== "number") return;
      if (seenSseNotificationIds.current.has(incoming.id)) return;
      seenSseNotificationIds.current.add(incoming.id);

      if (!incoming.isRead) {
        setUnreadCount((prev) => prev + 1);
      }

      const affectsCurrentFilter = filter === "ALL" || (filter === "UNREAD" && !incoming.isRead);

      if (affectsCurrentFilter) {
        setTotal((prevTotal) => {
          const nextTotal = prevTotal + 1;
          setTotalPages(Math.max(1, Math.ceil(nextTotal / PAGE_SIZE)));
          return nextTotal;
        });
      }

      if (!affectsCurrentFilter || page !== 1) return;

      setNotifications((prev) => {
        if (prev.some((item) => item.id === incoming.id)) return prev;
        return [incoming, ...prev].slice(0, PAGE_SIZE);
      });
    },
    [filter, page]
  );

  useEffect(() => {
    let cancelled = false;

    const loadNotifications = async () => {
      setLoading(true);

      try {
        const res = await getNotifications(filter === "UNREAD" ? false : undefined, page, PAGE_SIZE);

        if (cancelled) return;

        setNotifications(res.data.items);
        setTotal(res.data.total);
        setUnreadCount(res.data.unreadCount);
        setTotalPages(Math.max(1, res.data.totalPages));
      } catch (err) {
        if (cancelled) return;
        setNotifications([]);
        setTotal(0);
        setTotalPages(1);

        if (err instanceof ApiError) {
          toast.error(err.apiMessage);
        } else {
          toast.error("Không thể tải thông báo từ API.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadNotifications();

    return () => {
      cancelled = true;
    };
  }, [filter, page, toast]);

  useEffect(() => {
    const onSseNotification = (event: Event) => {
      const custom = event as CustomEvent<NotificationResponse | undefined>;
      if (!custom.detail) return;
      prependNotificationFromSse(custom.detail);
    };

    window.addEventListener("notifications:new", onSseNotification as EventListener);

    return () => {
      window.removeEventListener("notifications:new", onSseNotification as EventListener);
    };
  }, [prependNotificationFromSse]);

  const handleTabChange = (nextFilter: NotificationFilterTab) => {
    if (nextFilter === filter) return;
    setFilter(nextFilter);
    setPage(1);
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      window.dispatchEvent(new Event("notifications:changed"));
    } catch {
      // keep optimistic behavior
    }

    if (filter === "UNREAD") {
      setNotifications([]);
      setTotal(0);
      setUnreadCount(0);
      setTotalPages(1);
      setPage(1);
      return;
    }

    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleOpenNotification = async (item: NotificationResponse) => {
    if (!item.isRead) {
      try {
        await markAsRead(item.id);
        window.dispatchEvent(new Event("notifications:changed"));
      } catch {
        // keep optimistic behavior
      }

      setUnreadCount((prev) => Math.max(0, prev - 1));

      if (filter === "UNREAD") {
        setNotifications((prev) => prev.filter((n) => n.id !== item.id));
        setTotal((prevTotal) => {
          const nextTotal = Math.max(0, prevTotal - 1);
          const nextPages = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE));
          setTotalPages(nextPages);
          setPage((prevPage) => Math.min(prevPage, nextPages));
          return nextTotal;
        });
      } else {
        setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
      }
    }

    const target = getNotificationTarget(item);
    if (target) router.push(target);
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    setPage(nextPage);
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-indigo-700 p-6 text-white shadow-xl shadow-blue-900/10">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-50">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Notification center
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Thông báo</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
              Theo dõi cập nhật yêu cầu, lương, dự án và cảnh báo hệ thống trong một luồng thông báo thống nhất.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleMarkAllRead()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-lg shadow-blue-950/10 transition hover:bg-blue-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M5 13l4 4L19 7" />
            </svg>
            Đánh dấu tất cả đã đọc
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Tổng thông báo" value={total.toLocaleString("vi-VN")} />
        <MetricCard label="Chưa đọc" value={unreadCount.toLocaleString("vi-VN")} />
        <MetricCard label="Trang hiện tại" value={`${page}/${totalPages}`} />
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-blue-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Luồng thông báo</h2>
            <p className="mt-1 text-sm text-slate-500">Thông báo mới được cập nhật theo thời gian thực khi hệ thống phát sự kiện.</p>
          </div>
          <div className="flex items-center gap-2">
            <TabButton active={filter === "ALL"} onClick={() => handleTabChange("ALL")}>
              Tất cả
            </TabButton>
            <TabButton active={filter === "UNREAD"} onClick={() => handleTabChange("UNREAD")}>
              Chưa đọc ({unreadCount})
            </TabButton>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">Đang tải thông báo...</div>
        ) : notifications.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">Không có thông báo phù hợp.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {notifications.map((item) => {
              const target = getNotificationTarget(item);
              const isDemoDataNotice = item.type === NotificationType.SYSTEM && item.refType === "DEMO_DATASET";
              const displayTitle = isDemoDataNotice ? "Cập nhật hệ thống" : toUserFacingText(item.title);
              const displayMessage = isDemoDataNotice
                ? "Hệ thống có thông tin mới. Truy cập các trang chức năng để xem nội dung liên quan."
                : toUserFacingText(item.message);
              const rowClassName = `w-full px-5 py-4 text-left transition ${
                item.isRead
                  ? target
                    ? "bg-white hover:bg-blue-50/40"
                    : "bg-white"
                  : target
                    ? "bg-blue-50/70 hover:bg-blue-100/70"
                    : "bg-blue-50/50"
              }`;
              const rowContent = (
                <div className="flex items-start gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${getTypeIconClass(item.type)}`}>
                    {getTypeIcon(item.type)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900 md:text-base">{displayTitle}</p>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{displayMessage}</p>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-slate-500">{formatRelativeTime(item.createdAt)}</span>
                    </div>
                  </div>

                  {!item.isRead && <span className="mt-2 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />}
                </div>
              );

              return (
                <li key={item.id}>
                  {target ? (
                    <button
                      type="button"
                      onClick={() => void handleOpenNotification(item)}
                      className={rowClassName}
                    >
                      {rowContent}
                    </button>
                  ) : (
                    <div className={rowClassName}>{rowContent}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-col gap-3 border-t border-slate-200 bg-blue-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Tổng {total.toLocaleString("vi-VN")} thông báo
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Trước
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sau
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 h-2 w-12 rounded-full bg-blue-600" />
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
        active
          ? "border-blue-200 bg-blue-600 text-white shadow-sm shadow-blue-900/10"
          : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
      }`}
    >
      {children}
    </button>
  );
}
