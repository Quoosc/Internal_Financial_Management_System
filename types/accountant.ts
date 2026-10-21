// =============================================================
// Accountant Types - khớp với backend API_Spec.md v2.0
// Endpoints prefix: /accountant/*
// =============================================================

import type {
  RequestAttachmentResponse,
  RequestTimelineEntry,
  RequestStatus,
  RequestType,
} from "./request";
import type { ApprovalPhase } from "./team-leader";

// --- Disbursement DTOs ---

/** Requester info trong disbursement (có bank info đầy đủ) */
export interface DisbursementRequester {
  id: number;
  fullName: string;
  avatar: string | null;
  employeeCode: string;
  jobTitle: string | null;
  departmentName: string;
  bankName: string;
  bankAccountNum: string; // unmasked cho Accountant
  bankAccountOwner: string;
}

/** GET /accountant/disbursements — response item */
export interface DisbursementListItem {
  id: number;
  requestCode: string;
  type: RequestType;
  status: RequestStatus;
  amount: number;
  approvedAmount: number;
  description: string | null;
  requester: DisbursementRequester;
  project: {
    id: number;
    projectCode: string;
    name: string;
  };
  phase: {
    id: number;
    phaseCode: string;
    name: string;
  };
  attachments: RequestAttachmentResponse[];
  createdAt: string;
}

/** GET /accountant/disbursements/:id — response (chi tiết) */
export interface DisbursementDetailResponse {
  id: number;
  requestCode: string;
  type: RequestType;
  status: RequestStatus;
  amount: number;
  approvedAmount: number;
  description: string | null;
  rejectReason: string | null;
  requester: DisbursementRequester;
  project: {
    id: number;
    projectCode: string;
    name: string;
  };
  phase: ApprovalPhase;
  attachments: RequestAttachmentResponse[];
  timeline: RequestTimelineEntry[];
  createdAt: string;
  updatedAt: string;
}

/** POST /accountant/disbursements/:id/disburse — body */
export interface DisburseBody {
  documents?: { fileId: number; issuerCode: string; documentNumber: string; documentDate: string; totalAmount: number; allocatedAmount: number }[];
  pin: string;
  note?: string;
}

/** POST /accountant/disbursements/:id/disburse — response */
export interface DisburseResponse {
  id: number;
  requestCode: string;
  status: "PAID";
  transactionCode: string;
  amount: number;
  disbursedAt: string;
}

/** POST /accountant/disbursements/:id/reject — body */
export interface DisbursementRejectBody {
  reason: string;
}

/** POST /accountant/disbursements/:id/reject — response */
export interface DisbursementRejectResponse {
  id: number;
  requestCode: string;
  status: "REJECTED";
  rejectReason: string;
}

// --- Accountant Request View ---

/** GET /accountant/requests/:requestId — response (xem bất kỳ request) */
export interface AccountantRequestDetailResponse {
  id: number;
  requestCode: string;
  type: RequestType;
  status: RequestStatus;
  amount: number;
  approvedAmount: number | null;
  description: string | null;
  rejectReason: string | null;
  requester: DisbursementRequester;
  project: {
    id: number;
    projectCode: string;
    name: string;
  } | null;
  phase: ApprovalPhase | null;
  attachments: RequestAttachmentResponse[];
  timeline: RequestTimelineEntry[];
  createdAt: string;
  updatedAt: string;
}

// --- Filter Params ---

/** GET /accountant/disbursements — query params */
export interface DisbursementFilterParams {
  type?: RequestType;
  search?: string;
  page?: number;
  size?: number;
  limit?: number;
}
