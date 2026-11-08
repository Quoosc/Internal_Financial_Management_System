// =============================================================
// Admin Types - khớp với backend API_Spec.md v2.0
// Endpoints prefix: /admin/*
// =============================================================

import type { RequestTimelineEntry, RequestStatus } from "./request";
import type { ApprovalRequester } from "./team-leader";

// --- Admin/CFO Approvals (Flow 3 — DEPARTMENT_TOPUP) ---

/** GET /admin/approvals — response item */
export interface AdminApprovalListItem {
  id: number;
  requestCode: string;
  type: "DEPARTMENT_TOPUP";
  status: RequestStatus;
  amount: number;
  approvedAmount?: number | null;
  description: string | null;
  requester: ApprovalRequester;
  department: {
    id: number;
    name: string;
    code: string;
    totalAvailableBalance: number;
  };
  createdAt: string;
}

/** GET /admin/approvals/:id — response (chi tiết) */
export interface AdminApprovalDetailResponse {
  id: number;
  requestCode: string;
  type: "DEPARTMENT_TOPUP";
  status: RequestStatus;
  amount: number;
  approvedAmount: number | null;
  description: string | null;
  rejectReason: string | null;
  requester: ApprovalRequester & {
    departmentName: string;
  };
  department: {
    id: number;
    name: string;
    code: string;
    totalProjectQuota: number;
    totalAvailableBalance: number;
  };
  companyFund?: {
    balance?: number;
  };
  timeline: RequestTimelineEntry[];
  createdAt: string;
  updatedAt: string;
}

/** POST /admin/approvals/:id/approve — body */
export interface AdminApproveBody {
  comment?: string;
  approvedAmount?: number;
}

/** POST /admin/approvals/:id/reject — body */
export interface AdminRejectBody {
  reason: string;
}

/** POST /admin/approvals/:id/approve — response */
export interface AdminApproveResponse {
  id: number;
  requestCode: string;
  status: "PAID";          // auto PAID cho DEPARTMENT_TOPUP
  approvedAmount: number;
  comment: string | null;
}

/** POST /admin/approvals/:id/reject — response */
export interface AdminRejectResponse {
  id: number;
  requestCode: string;
  status: "REJECTED";
  rejectReason: string;
}

// --- Admin User Management ---

/** GET /admin/users — response item */
export interface AdminUserListItem {
  id: number;
  fullName: string;
  email: string;
  employeeCode: string | null;
  role: string;
  departmentId: number | null;
  departmentName: string | null;
  jobTitle: string | null;
  avatar: string | null;
  debtBalance: number;
  status: string;
  createdAt: string;
}

/** GET /admin/users/:id — response (chi tiết) */
export interface AdminUserDetailResponse {
  id: number;
  fullName: string;
  email: string;
  employeeCode: string | null;
  role: string;
  departmentId: number | null;
  departmentName: string | null;
  jobTitle: string | null;
  phoneNumber: string | null;
  dateOfBirth: string | null;
  citizenId: string | null;
  address: string | null;
  avatar: string | null;
  status: string;
  isFirstLogin: boolean;
  bankInfo: {
    bankName: string | null;
    accountNumber: string | null;
    accountOwner: string | null;
  } | null;
  wallet: {
    balance: number;
    pendingBalance: number;
    debtBalance: number;
  } | null;
  securitySettings: {
    hasPIN: boolean | null;
    pinLockedUntil: string | null;
    retryCount: number | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

/** POST /admin/users — body */
export interface CreateUserBody {
  fullName: string;
  email: string;
  roleId: number;
  departmentId?: number;
}

/** PUT /admin/users/:id — body */
export interface UpdateUserBody {
  fullName?: string;
  roleId?: number;
  departmentId?: number;
}

/** POST /admin/users — response */
export interface CreateUserResponse {
  id: number;
  fullName: string;
  email: string;
  role: string;
  departmentId: number | null;
  departmentName: string | null;
  status: string;
  isFirstLogin: true;
  createdAt: string;
}

/** POST /admin/users/:id/lock — response */
export interface LockUserResponse {
  id: number;
  status: "LOCKED";
}

/** POST /admin/users/:id/unlock — response */
export interface UnlockUserResponse {
  id: number;
  status: "ACTIVE";
}

// --- System Config (khớp /api/v1/system-configs) ---

/**
 * GET /api/v1/system-configs — response item
 * GET /api/v1/system-configs/{key} — response
 * khớp với config.dto.response.SystemConfigResponse
 */
export interface SystemConfigResponse {
  key: string;
  value: string;
  description: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * PUT/POST /api/v1/system-configs/{key} — body
 * khớp với config.dto.request.SystemConfigRequest
 */
export interface SystemConfigRequest {
  value: string;
  description?: string;
}

/** GET /api/v1/admin/settings — config item */
export interface SystemConfigItem {
  key: string;
  value: string;
  description: string | null;
  category: "SECURITY" | "MAIL" | "SYSTEM";
  createdAt: string | null;
  updatedAt: string | null;
}

/** GET /api/v1/admin/settings — response */
export interface SystemSettingsResponse {
  items: SystemConfigItem[];
}

/** PUT /api/v1/admin/settings — body (khớp với UpdateSettingsRequest.configs) */
export interface UpdateSettingsBody {
  configs: Array<{
    key: string;
    value: string;
  }>;
}

// --- Filter Params ---

/** GET /admin/approvals — query params */
export interface AdminApprovalFilterParams {
  status?: RequestStatus;
  search?: string;
  page?: number;
  limit?: number;
}

/** GET /admin/users — query params */
export interface AdminUserFilterParams {
  role?: string;
  departmentId?: number;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}
