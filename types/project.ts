// =============================================================
// Project Types - khớp với backend API_Spec.md v2.0
// Cập nhật: thêm availableBudget, ProjectRole enum,
// fields mới cho member, phase
// =============================================================

// --- Enums ---

/** khớp với project.entity.ProjectStatus */
export enum ProjectStatus {
  PLANNING = "PLANNING",
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
  CLOSED = "CLOSED",
}

/** khớp với project.entity.PhaseStatus */
export enum PhaseStatus {
  PLANNED = "PLANNED",
  ACTIVE = "ACTIVE",
  CLOSED = "CLOSED",
}

/** project_members.project_role */
export enum ProjectRole {
  LEADER = "LEADER",
  MEMBER = "MEMBER",
}

// --- Response DTOs ---

/**
 * GET /projects — response item (Employee view)
 *
 * > Dùng populate dropdown khi tạo request
 */
export interface ProjectListItem {
  id: number;
  projectCode: string;
  name: string;
  status: ProjectStatus;
  departmentId: number;
  totalBudget: number;
  availableBudget: number;
  totalSpent: number;
  currentPhaseId: number | null;
  currentPhaseName: string | null;
}

/**
 * GET /projects/:id/phases — response item
 */
export interface ProjectPhaseResponse {
  id: number;
  phaseCode: string;
  name: string;
  budgetLimit: number;
  currentSpent: number;
  status: PhaseStatus;
  startDate: string | null;
  endDate: string | null;
}

/** GET /projects/:id/phases — full response wrapper */
export interface ProjectPhasesResponse {
  projectId: number;
  projectName: string;
  status: ProjectStatus;
  totalBudget: number;
  totalSpent: number;
  availableBudget: number;
  currentPhaseId: number | null;
  currentPhaseName: string | null;
  phases: ProjectPhaseResponse[];
}

/**
 * Member trong project (dùng chung cho TL/Manager project detail)
 */
export interface ProjectMemberResponse {
  userId: number;
  fullName: string;
  avatar: string | null;
  employeeCode: string;
  projectRole: ProjectRole;
  position: string;
  joinedAt: string;
}

/**
 * Project detail (dùng chung cho TL/Manager project detail)
 */
export interface ProjectDetailResponse {
  id: number;
  projectCode: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  totalBudget: number;
  availableBudget: number;
  totalSpent: number;
  departmentId: number;
  departmentName: string;
  managerId: number;
  currentPhaseId: number | null;
  phases: ProjectPhaseResponse[];
  members: ProjectMemberResponse[];
  createdAt: string;
  updatedAt: string;
}

// --- Expense Category ---

/** GET /team-leader/expense-categories?projectId={id} — response item */
export interface ExpenseCategoryResponse {
  id: number;
  name: string;
  description: string | null;
  isSystemDefault: boolean;
}

/**
 * Category budget trong phase
 * GET /team-leader/projects/:id/categories — categories[].item
 */
export interface CategoryBudgetResponse {
  categoryId: number;
  categoryName: string;
  budgetLimit: number;
  currentSpent: number;
  remaining: number;
}

/** GET /team-leader/projects/:id/categories — full response wrapper */
export interface PhaseCategoriesResponse {
  projectId: number;
  phaseId: number;
  phaseName: string;
  categories: CategoryBudgetResponse[];
}

// --- Request DTOs ---

/** POST /team-leader/projects/:id/phases — body */
export interface CreatePhaseBody {
  name: string;
  budgetLimit: number;
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD"
}

/** PUT /team-leader/projects/:id/phases/:phaseId — body */
export interface UpdatePhaseBody {
  name?: string;
  budgetLimit?: number;
  endDate?: string;
  status?: PhaseStatus;
}

/** POST /team-leader/projects/:id/members — body */
export interface AddMemberBody {
  userId: number;
  position: string;
}

/** PUT /team-leader/projects/:id/members/:userId — body */
export interface UpdateMemberBody {
  position: string;
}

/** PUT /team-leader/projects/:id/categories — body */
export interface UpdateCategoryBudgetBody {
  phaseId: number;
  categoryId: number;
  budgetLimit: number;
}

/** DELETE /team-leader/projects/:id/categories — body */
export interface RemoveCategoryBody {
  phaseId: number;
  categoryId: number;
}

/** POST /team-leader/projects/:id/expense-categories — body */
export interface CreateExpenseCategoryBody {
  name: string;
  description?: string;
  phaseId: number;
  budgetLimit: number;
}

/** POST /manager/projects — body */
export interface CreateProjectBody {
  name: string;
  description?: string;
  totalBudget: number;
  teamLeaderId: number;
}

/** PUT /manager/projects/:id — body */
export interface UpdateProjectBody {
  name?: string;
  description?: string;
  totalBudget?: number;
  status?: ProjectStatus;
  teamLeaderId?: number;
}

/** Available member for dropdown (GET /team-leader/projects/:id/available-members) */
export interface AvailableMemberResponse {
  id: number;
  fullName: string;
  employeeCode: string;
  avatar: string | null;
  email: string;
  jobTitle: string | null;
}

/** Team leader option for dropdown (GET /manager/department/team-leaders) */
export interface TeamLeaderOptionResponse {
  id: number;
  fullName: string;
  employeeCode: string;
  avatar: string | null;
  email: string;
  jobTitle: string | null;
}
