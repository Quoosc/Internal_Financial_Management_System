// =============================================================
// Notification Types - khớp với backend modules/notification (v3.0)
// Cập nhật: NotificationType enum, thêm referenceLink, API dùng PATCH
// =============================================================

// --- Enums ---

/**
 * khớp với notification.entity.NotificationType
 *
 * Cập nhật theo NotificationType của backend:
 *   Flow 1: REQUEST_SUBMITTED → REQUEST_APPROVED_BY_TL → REQUEST_PAID / REQUEST_REJECTED
 *   Nhân viên tự chi: EXPENSE_VERIFIED → EXPENSE_PAID
 *   Flow 2: PROJECT_TOPUP_APPROVED / PROJECT_TOPUP_REJECTED
 *   Flow 3: DEPT_TOPUP_APPROVED / DEPT_TOPUP_REJECTED
 *   Payroll: SALARY_PAID
 *   System: SYSTEM, SECURITY_ALERT
 */
export enum NotificationType {
  // Flow 1: Personal Expense (Member → Team Leader → Accountant)
  REQUEST_SUBMITTED = "REQUEST_SUBMITTED",
  REQUEST_APPROVED_BY_TL = "REQUEST_APPROVED_BY_TL",
  REQUEST_REJECTED = "REQUEST_REJECTED",
  REQUEST_PAID = "REQUEST_PAID",
  EXPENSE_VERIFIED = "EXPENSE_VERIFIED",
  EXPENSE_PAID = "EXPENSE_PAID",

  // Flow 2: Project Fund Top-up
  PROJECT_TOPUP_APPROVED = "PROJECT_TOPUP_APPROVED",
  PROJECT_TOPUP_REJECTED = "PROJECT_TOPUP_REJECTED",

  // Flow 3: Department Quota Top-up
  DEPT_TOPUP_APPROVED = "DEPT_TOPUP_APPROVED",
  DEPT_TOPUP_REJECTED = "DEPT_TOPUP_REJECTED",

  // Payroll
  SALARY_PAID = "SALARY_PAID",

  // System
  SYSTEM = "SYSTEM",
  SECURITY_ALERT = "SECURITY_ALERT",
}

// --- Response DTOs ---

/**
 * GET /notifications — response item
 * khớp với notification.dto.response.NotificationDto
 */
export interface NotificationResponse {
  id: number;
  type: string;                     // NotificationType enum value
  title: string;
  message: string;
  refId: number | null;
  refType: string | null;           // "REQUEST", "PAYSLIP", etc.
  referenceLink: string | null;
  isRead: boolean;
  createdAt: string;
}

/**
 * GET /notifications — response wrapper
 * khớp với notification.dto.response.NotificationListResponse
 */
export interface NotificationListResponse {
  items: NotificationResponse[];
  unreadCount: number;
  total: number;
  page: number;       // 1-indexed
  limit: number;
  totalPages: number;
}

/**
 * PATCH /notifications/{id}/read — response
 * Backend trả về NotificationDto sau khi đánh dấu đọc
 */
export type MarkReadResponse = NotificationResponse;

/**
 * PATCH /notifications/read-all — response
 * Backend trả về null data (ApiResponse<Void>)
 */
export type MarkAllReadResponse = void;

// --- Filter Params ---

/**
 * GET /notifications — query params
 * Backend: ?isRead=false&type=TYPE&page=1&limit=20 (1-indexed)
 */
export interface NotificationFilterParams {
  isRead?: boolean;
  type?: string;
  page?: number;       // 1-indexed
  limit?: number;      // default: 20
}

// --- SSE Event Payloads ---
// Backend streams qua GET /api/v1/users/stream (text/event-stream).
// SSE event `notification` — data JSON là NotificationResponse trực tiếp.
// Xem docs/API_CONTRACT.md §15.

/** SSE event `notification` — payload = full NotificationResponse (prepend vào list) */
export type NotificationEvent = NotificationResponse;
