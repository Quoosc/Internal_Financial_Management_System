// =============================================================
// Manager Types - khớp với backend API_Spec.md v2.0
// Endpoints prefix: /manager/*
// =============================================================

import type { RequestTimelineEntry, RequestStatus } from "./request";
import type { ApprovalRequester } from "./team-leader";
import type { ProjectStatus } from "./project";

// --- Manager Approvals (Flow 2 — PROJECT_TOPUP) ---

/** Project info trong Manager approval cards */
export interface ManagerApprovalProject {
  id: number;
  projectCode: string;
  name: string;
  availableBudget: number;
  totalBudget: number;
  status: ProjectStatus;
}

/** GET /manager/approvals — response item */
export interface ManagerApprovalListItem {
  id: number;
  requestCode: string;
  type: "PROJECT_TOPUP";
  status: RequestStatus;
  amount: number;
  description: string | null;
  requester: ApprovalRequester;
  project: ManagerApprovalProject;
  createdAt: string;
}

/** GET /manager/approvals/:id — response (chi tiết) */
export interface ManagerApprovalDetailResponse {
  id: number;
  requestCode: string;
  type: "PROJECT_TOPUP";
  status: RequestStatus;
  amount: number;
  approvedAmount: number | null;
  description: string | null;
  rejectReason: string | null;
  requester: ApprovalRequester & {
    departmentName: string;
  };
  project: ManagerApprovalProject;
  department: {
    id: number;
    name: string;
    totalAvailableBalance: number;
  };
  timeline: RequestTimelineEntry[];
  createdAt: string;
  updatedAt: string;
}

/** POST /manager/approvals/:id/approve — body */
export interface ManagerApproveBody {
  comment?: string;
  approvedAmount?: number;
}

/** POST /manager/approvals/:id/reject — body */
export interface ManagerRejectBody {
  reason: string;
}

/** POST /manager/approvals/:id/approve — response */
export interface ManagerApproveResponse {
  id: number;
  requestCode: string;
  status: "PAID"; // auto PAID cho PROJECT_TOPUP
  approvedAmount: number;
  comment: string | null;
}

/** POST /manager/approvals/:id/reject — response */
export interface ManagerRejectResponse {
  id: number;
  requestCode: string;
  status: "REJECTED";
  rejectReason: string;
}

// --- Manager Projects ---

/** GET /manager/projects — response item */
export interface ManagerProjectListItem {
  id: number;
  projectCode: string;
  name: string;
  status: string;
  totalBudget: number;
  availableBudget: number;
  totalSpent: number;
  memberCount: number;
  currentPhaseId: number | null;
  currentPhaseName: string | null;
  teamLeaderId: number | null;
  teamLeaderName: string | null;
  createdAt: string;
}

// --- Manager Department Members ---

/** GET /manager/department/members — response item */
export interface ManagerDeptMemberListItem {
  id: number;
  fullName: string;
  email: string;
  employeeCode: string;
  avatar: string | null;
  jobTitle: string | null;
  role?: "TEAM_LEADER" | "EMPLOYEE" | string | null;
  status: string;
  pendingRequestsCount: number;
  debtBalance: number;
  projectsCount: number;
}

/** GET /manager/department/members/:id — response */
export interface ManagerDeptMemberDetailResponse {
  id: number;
  fullName: string;
  email: string;
  employeeCode: string;
  avatar: string | null;
  jobTitle: string | null;
  phoneNumber: string | null;
  status: string;
  debtBalance: number;
  pendingRequestsCount: number;
  assignedProjects: {
    projectId: number;
    projectCode: string;
    projectName: string;
    projectRole: string;
    position: string;
  }[];
}

// --- Filter Params ---

/** GET /manager/approvals — query params */
export interface ManagerApprovalFilterParams {
  status?: RequestStatus;
  search?: string;
  page?: number;
  size?: number;
  limit?: number;
}

/** GET /manager/projects — query params */
export interface ManagerProjectFilterParams {
  status?: string;
  search?: string;
  page?: number;
  size?: number;
  limit?: number;
}

/** GET /manager/department/members — query params */
export interface ManagerDeptMemberFilterParams {
  search?: string;
  page?: number;
  size?: number;
  limit?: number;
}
