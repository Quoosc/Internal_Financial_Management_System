"use client";

import React, { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api-client";
import { useToast } from "@/contexts/toast-context";
import { formatCurrency, formatDate, getBurnClass } from "@/lib/format";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { SideDrawer } from "@/components/ui/side-drawer";
import { CurrencyInput } from "@/components/ui/currency-input";
import { MetricLabel } from "@/components/ui/metric-label";
import {
  AddMemberBody,
  AvailableMemberResponse,
  CreateExpenseCategoryBody,
  CreatePhaseBody,
  ExpenseCategoryResponse,
  PhaseCategoriesResponse,
  PhaseStatus,
  ProjectPhaseResponse,
  ProjectRole,
  ProjectStatus,
  RemoveCategoryBody,
  RequestType,
  TLProjectDetailResponse,
  UpdateCategoryBudgetBody,
  UpdateMemberBody,
  UpdatePhaseBody,
} from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

type TabKey = "phases" | "budget" | "members";


function burn(spent: number, budget: number): number {
  if (budget <= 0) return 0;
  return Math.min(100, Math.round((spent / budget) * 100));
}


function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(-2)
    .map((x) => x[0]?.toUpperCase() ?? "")
    .join("");
}

function statusBadge(status: ProjectStatus): string {
  if (status === ProjectStatus.ACTIVE)
    return "bg-emerald-100 border-emerald-200 text-emerald-700";
  if (status === ProjectStatus.PLANNING)
    return "bg-sky-100 border-sky-200 text-sky-700";
  if (status === ProjectStatus.PAUSED)
    return "bg-amber-100 border-amber-200 text-amber-700";
  return "bg-slate-100 border-slate-200 text-slate-600";
}

function statusLabel(status: ProjectStatus): string {
  if (status === ProjectStatus.ACTIVE) return "Đang hoạt động";
  if (status === ProjectStatus.PLANNING) return "Lập kế hoạch";
  if (status === ProjectStatus.PAUSED) return "Tạm dừng";
  if (status === ProjectStatus.CLOSED) return "Đã đóng";
  return status;
}

function phaseStatusLabel(status: PhaseStatus): string {
  if (status === PhaseStatus.PLANNED) return "Chưa bắt đầu";
  if (status === PhaseStatus.ACTIVE) return "Đang thực hiện";
  return "Đã kết thúc";
}

function phaseStatusClass(status: PhaseStatus): string {
  if (status === PhaseStatus.PLANNED) {
    return "bg-blue-50 border-blue-200 text-blue-700";
  }
  if (status === PhaseStatus.ACTIVE) {
    return "bg-emerald-100 border-emerald-200 text-emerald-700";
  }
  return "bg-slate-100 border-slate-200 text-slate-600";
}

function localDateValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function roleBadge(role: ProjectRole): string {
  return role === ProjectRole.LEADER
    ? "bg-indigo-100 border-indigo-200 text-indigo-700"
    : "bg-slate-100 border-slate-200 text-slate-600";
}

export default function TLProjectDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();

  const [project, setProject] = useState<TLProjectDetailResponse | null>(null);
  const [phaseCategories, setPhaseCategories] =
    useState<PhaseCategoriesResponse | null>(null);
  const [availableMembers, setAvailableMembers] = useState<
    AvailableMemberResponse[]
  >([]);
  const [expenseCategories, setExpenseCategories] = useState<
    ExpenseCategoryResponse[]
  >([]);
  const [selectedPhaseId, setSelectedPhaseId] = useState<number | null>(null);
  const [tab, setTab] = useState<TabKey>("phases");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState<number | null>(null);
  const [topupNote, setTopupNote] = useState("");

  const [showCreatePhase, setShowCreatePhase] = useState(false);
  const [phaseName, setPhaseName] = useState("");
  const [phaseBudget, setPhaseBudget] = useState<number | null>(null);
  const [phaseStart, setPhaseStart] = useState("");
  const [phaseEnd, setPhaseEnd] = useState("");

  const [showEditPhase, setShowEditPhase] = useState(false);
  const [editingPhaseId, setEditingPhaseId] = useState<number | null>(null);
  const [editPhaseName, setEditPhaseName] = useState("");
  const [editPhaseBudget, setEditPhaseBudget] = useState<number | null>(null);
  const [editPhaseEnd, setEditPhaseEnd] = useState("");
  const [editPhaseStatus, setEditPhaseStatus] = useState<PhaseStatus>(
    PhaseStatus.ACTIVE,
  );

  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState<Record<number, number | null>>({});

  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [memberPosition, setMemberPosition] = useState("");

  const [showEditMember, setShowEditMember] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [editingPosition, setEditingPosition] = useState("");

  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [newCatBudget, setNewCatBudget] = useState<number | null>(null);

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    message: string;
    onConfirm: () => void;
  }>({ open: false, message: "", onConfirm: () => {} });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get<TLProjectDetailResponse>(
          `/api/v1/team-leader/projects/${id}`,
        );
        if (cancelled) return;
        setProject(res.data);
        setSelectedPhaseId(
          res.data.currentPhaseId ?? res.data.phases[0]?.id ?? null,
        );
      } catch (err) {
        if (cancelled) return;
        setProject(null);
        toast.error(err instanceof ApiError ? err.apiMessage : "Không thể tải thông tin dự án.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, toast]);

  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    const loadAux = async () => {
      try {
        const [mRes, cRes] = await Promise.all([
          api.get<AvailableMemberResponse[]>(
            `/api/v1/team-leader/projects/${project.id}/available-members`,
          ),
          api.get<ExpenseCategoryResponse[]>(
            `/api/v1/team-leader/expense-categories?projectId=${project.id}`,
          ),
        ]);
        if (cancelled) return;
        setAvailableMembers(mRes.data);
        setExpenseCategories(cRes.data);
      } catch {
        if (cancelled) return;
        setAvailableMembers([]);
        setExpenseCategories([]);
      }
    };
    void loadAux();
    return () => {
      cancelled = true;
    };
  }, [project]);

  useEffect(() => {
    if (!project || !selectedPhaseId) {
      setPhaseCategories(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await api.get<PhaseCategoriesResponse>(
          `/api/v1/team-leader/projects/${project.id}/categories?phaseId=${selectedPhaseId}`,
        );
        if (!cancelled) setPhaseCategories(res.data);
      } catch {
        if (cancelled) return;
        setPhaseCategories(null);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [project, selectedPhaseId, expenseCategories]);

  const budgetSummary = useMemo(() => {
    if (!project) {
      return {
        totalSpent: 0,
        availableBudget: 0,
        burnPercent: 0,
        remainingPercent: 0,
      };
    }

    const phaseSpentFromDetail = project.phases.reduce(
      (sum, phase) => sum + phase.currentSpent,
      0,
    );
    const selectedPhaseSpentFromDetail =
      project.phases.find((phase) => phase.id === selectedPhaseId)?.currentSpent ?? 0;
    const selectedPhaseCategorySpent =
      phaseCategories?.phaseId === selectedPhaseId
        ? phaseCategories.categories.reduce(
            (sum, category) => sum + category.currentSpent,
            0,
          )
        : 0;

    const normalizedSpent =
      phaseSpentFromDetail -
      selectedPhaseSpentFromDetail +
      selectedPhaseCategorySpent;
    const totalSpent = Math.max(project.totalSpent, normalizedSpent, 0);
    const fundedBudget = Math.max(0, project.availableBudget + project.totalSpent);
    const availableBudget = Math.max(0, fundedBudget - totalSpent);

    return {
      totalSpent,
      availableBudget,
      burnPercent: burn(totalSpent, project.totalBudget),
      remainingPercent:
        project.totalBudget > 0
          ? Math.max(0, Math.round((availableBudget / project.totalBudget) * 100))
          : 0,
    };
  }, [project, phaseCategories, selectedPhaseId]);

  const overallBurn = budgetSummary.burnPercent;

  const filteredAvailable = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return availableMembers;
    return availableMembers.filter((m) =>
      `${m.fullName} ${m.employeeCode}`.toLowerCase().includes(q),
    );
  }, [availableMembers, memberSearch]);

  const openEditPhase = (phase: ProjectPhaseResponse) => {
    setEditingPhaseId(phase.id);
    setEditPhaseName(phase.name);
    setEditPhaseBudget(phase.budgetLimit);
    setEditPhaseEnd(phase.endDate ?? "");
    setEditPhaseStatus(phase.status);
    setShowEditPhase(true);
  };

  const openEditMember = (userId: number, position: string) => {
    setEditingMemberId(userId);
    setEditingPosition(position);
    setShowEditMember(true);
  };

  const onCreatePhase = async () => {
    if (!project) return;
    if (
      !phaseName.trim() ||
      !phaseStart ||
      !phaseEnd ||
      (phaseBudget ?? 0) <= 0
    ) {
      toast.error("Vui lòng nhập đầy đủ thông tin giai đoạn hợp lệ.");
      return;
    }
    setSubmitting(true);
    const body: CreatePhaseBody = {
      name: phaseName.trim(),
      budgetLimit: phaseBudget ?? 0,
      startDate: phaseStart,
      endDate: phaseEnd,
    };
    try {
      const res = await api.post<ProjectPhaseResponse>(
        `/api/v1/team-leader/projects/${project.id}/phases`,
        body,
      );
      setProject((prev) =>
        prev
          ? {
              ...prev,
              currentPhaseId:
                res.data.status === PhaseStatus.ACTIVE
                  ? res.data.id
                  : prev.currentPhaseId,
              phases: [...prev.phases, res.data],
            }
          : prev,
      );
      setSelectedPhaseId(res.data.id);
      setShowCreatePhase(false);
      setPhaseName("");
      setPhaseBudget(null);
      setPhaseStart("");
      setPhaseEnd("");
      toast.success("Đã tạo giai đoạn mới.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.apiMessage : "Không thể tạo giai đoạn. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const updatePhase = async (
    projectId: number,
    phaseId: number,
    body: UpdatePhaseBody,
  ) => {
    setSubmitting(true);
    try {
      const res = await api.put<ProjectPhaseResponse>(
        `/api/v1/team-leader/projects/${projectId}/phases/${phaseId}`,
        body,
      );
      const transitionDate = localDateValue();
      setProject((prev) =>
        prev
          ? {
              ...prev,
              currentPhaseId:
                res.data.status === PhaseStatus.ACTIVE
                  ? res.data.id
                  : prev.currentPhaseId === res.data.id
                    ? null
                    : prev.currentPhaseId,
              phases: prev.phases.map((p) => {
                if (p.id === phaseId) return res.data;
                if (
                  res.data.status === PhaseStatus.ACTIVE &&
                  p.status === PhaseStatus.ACTIVE
                ) {
                  return {
                    ...p,
                    status: PhaseStatus.CLOSED,
                    endDate: transitionDate,
                  };
                }
                return p;
              }),
            }
          : prev,
      );
      setShowEditPhase(false);
      setEditingPhaseId(null);
      toast.success("Đã cập nhật giai đoạn.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.apiMessage : "Không thể cập nhật giai đoạn. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const onUpdatePhase = () => {
    if (
      !project ||
      !editingPhaseId ||
      !editPhaseName.trim() ||
      (editPhaseBudget ?? 0) <= 0
    ) {
      toast.error("Thông tin cập nhật giai đoạn chưa hợp lệ.");
      return;
    }

    const body: UpdatePhaseBody = {
      name: editPhaseName.trim(),
      budgetLimit: editPhaseBudget ?? 0,
      endDate: editPhaseEnd || undefined,
      status: editPhaseStatus,
    };
    const currentPhase = project.phases.find(
      (phase) =>
        phase.id === project.currentPhaseId &&
        phase.status === PhaseStatus.ACTIVE,
    );
    const isSwitchingPhase =
      editPhaseStatus === PhaseStatus.ACTIVE &&
      currentPhase != null &&
      currentPhase.id !== editingPhaseId;

    if (isSwitchingPhase) {
      const transitionDate = localDateValue();
      const plannedEnd = currentPhase.endDate
        ? formatDate(currentPhase.endDate)
        : "chưa xác định";
      const isEndingEarly =
        currentPhase.endDate != null &&
        currentPhase.endDate > transitionDate;
      const transitionDescription = isEndingEarly
        ? `sẽ kết thúc sớm vào ${formatDate(transitionDate)}`
        : `sẽ được ghi nhận kết thúc vào ${formatDate(transitionDate)}`;
      setConfirmState({
        open: true,
        message:
          `Giai đoạn "${currentPhase.name}" vẫn đang thực hiện và có ngày kết thúc dự kiến ${plannedEnd}. ` +
          `Nếu tiếp tục, giai đoạn này ${transitionDescription} và ` +
          `"${editPhaseName.trim()}" sẽ trở thành giai đoạn đang thực hiện. Bạn có chắc muốn chuyển không?`,
        onConfirm: () => {
          setConfirmState((prev) => ({ ...prev, open: false }));
          void updatePhase(project.id, editingPhaseId, body);
        },
      });
      return;
    }

    void updatePhase(project.id, editingPhaseId, body);
  };

  const startEditBudget = () => {
    if (!phaseCategories) return;
    const next: Record<number, number | null> = {};
    phaseCategories.categories.forEach((c) => {
      next[c.categoryId] = c.budgetLimit;
    });
    setBudgetDraft(next);
    setEditingBudget(true);
  };

  const onSaveBudget = async () => {
    if (!project || !selectedPhaseId || !phaseCategories) return;
    setSubmitting(true);
    const updates: UpdateCategoryBudgetBody[] = phaseCategories.categories.map(
      (c) => ({
        phaseId: selectedPhaseId,
        categoryId: c.categoryId,
        budgetLimit:
          (budgetDraft[c.categoryId] ?? 0) > 0
            ? (budgetDraft[c.categoryId] as number)
            : c.budgetLimit,
      }),
    );
    try {
      const results = await Promise.allSettled(
        updates.map((body) =>
          api.put(
            `/api/v1/team-leader/projects/${project.id}/categories`,
            body,
          ),
        ),
      );

      const total = updates.length;
      const succeededIds = new Set<number>();
      const failedIds: number[] = [];

      results.forEach((result, idx) => {
        const categoryId = updates[idx].categoryId;
        if (result.status === "fulfilled") {
          succeededIds.add(categoryId);
        } else {
          failedIds.push(categoryId);
        }
      });

      const successCount = succeededIds.size;
      const failedCount = failedIds.length;

      if (successCount > 0) {
        try {
          const refreshed = await api.get<PhaseCategoriesResponse>(
            `/api/v1/team-leader/projects/${project.id}/categories?phaseId=${selectedPhaseId}`,
          );
          setPhaseCategories(refreshed.data);
        } catch {
          setPhaseCategories({
            ...phaseCategories,
            categories: phaseCategories.categories.map((c) => {
              if (!succeededIds.has(c.categoryId)) return c;
              const match = updates.find((x) => x.categoryId === c.categoryId);
              const budgetLimit = match ? match.budgetLimit : c.budgetLimit;
              return {
                ...c,
                budgetLimit,
                remaining: budgetLimit - c.currentSpent,
              };
            }),
          });
        }
      }

      if (failedCount === 0) {
        setEditingBudget(false);
        toast.success("Đã cập nhật ngân sách.");
        return;
      }

      if (successCount === 0) {
        toast.error("Không thể cập nhật ngân sách. Vui lòng thử lại.");
        return;
      }

      setEditingBudget(false);
      toast.success(`Đã cập nhật ${successCount}/${total} danh mục ngân sách.`);
      toast.error(
        `Có ${failedCount}/${total} danh mục cập nhật thất bại. Vui lòng kiểm tra và thử lại.`,
      );
    } catch {
      toast.error("Không thể cập nhật ngân sách. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const onAddMember = async () => {
    if (!project || !selectedMemberId || !memberPosition.trim()) {
      toast.error("Vui lòng chọn thành viên và nhập vị trí.");
      return;
    }
    const selected = availableMembers.find((m) => m.id === selectedMemberId);
    if (!selected) return;
    setSubmitting(true);
    const body: AddMemberBody = {
      userId: selected.id,
      position: memberPosition.trim(),
    };
    try {
      await api.post(
        `/api/v1/team-leader/projects/${project.id}/members`,
        body,
      );
      setProject((prev) =>
        prev
          ? {
              ...prev,
              members: [
                ...prev.members,
                {
                  userId: selected.id,
                  fullName: selected.fullName,
                  avatar: selected.avatar,
                  employeeCode: selected.employeeCode,
                  projectRole: ProjectRole.MEMBER,
                  position: body.position,
                  joinedAt: new Date().toISOString(),
                },
              ],
            }
          : prev,
      );
      setAvailableMembers((prev) => prev.filter((m) => m.id !== selected.id));
      setShowAddMember(false);
      setSelectedMemberId(null);
      setMemberSearch("");
      setMemberPosition("");
      toast.success("Đã thêm thành viên.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.apiMessage : "Không thể thêm thành viên. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const onUpdateMember = async () => {
    if (!project || !editingMemberId || !editingPosition.trim()) {
      toast.error("Vị trí thành viên không hợp lệ.");
      return;
    }
    setSubmitting(true);
    const body: UpdateMemberBody = { position: editingPosition.trim() };
    try {
      await api.put(
        `/api/v1/team-leader/projects/${project.id}/members/${editingMemberId}`,
        body,
      );
      setProject((prev) =>
        prev
          ? {
              ...prev,
              members: prev.members.map((m) =>
                m.userId === editingMemberId
                  ? { ...m, position: body.position }
                  : m,
              ),
            }
          : prev,
      );
      setShowEditMember(false);
      setEditingMemberId(null);
      toast.success("Đã cập nhật vị trí.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.apiMessage : "Không thể cập nhật vị trí. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const onRemoveMember = async (userId: number) => {
    if (!project) return;
    const target = project.members.find((m) => m.userId === userId);
    if (!target) return;
    if (target.projectRole === ProjectRole.LEADER) {
      toast.error("Không thể xóa LEADER.");
      return;
    }
    setConfirmState({
      open: true,
      message: `Bạn có chắc muốn xóa thành viên ${target.fullName}?`,
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, open: false }));
        setSubmitting(true);
        try {
          await api.delete(
            `/api/v1/team-leader/projects/${project.id}/members/${userId}`,
          );
          setProject((prev) =>
            prev
              ? {
                  ...prev,
                  members: prev.members.filter((m) => m.userId !== userId),
                }
              : prev,
          );
          toast.success("Đã xóa thành viên.");
        } catch (err) {
          toast.error(err instanceof ApiError ? err.apiMessage : "Không thể xóa thành viên. Vui lòng thử lại.");
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  const onTopup = async () => {
    if (!project || (topupAmount ?? 0) <= 0) {
      toast.error("Số tiền xin cấp vốn không hợp lệ.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/v1/requests", {
        type: RequestType.PROJECT_TOPUP,
        projectId: project.id,
        amount: topupAmount ?? 0,
        description:
          topupNote.trim() || `Xin cấp vốn cho ${project.projectCode}`,
      });
      setShowTopup(false);
      setTopupAmount(null);
      setTopupNote("");
      toast.success("Đã gửi yêu cầu xin cấp vốn.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.apiMessage : "Không thể gửi yêu cầu. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const onDeleteCategory = (categoryId: number, categoryName: string, currentSpent: number) => {
    if (!project || !selectedPhaseId) return;
    if (currentSpent > 0) {
      toast.error(`Không thể xóa danh mục "${categoryName}" vì đã có chi tiêu (${formatCurrency(currentSpent)}).`);
      return;
    }
    setConfirmState({
      open: true,
      message: `Bạn có chắc muốn xóa danh mục "${categoryName}" khỏi giai đoạn này?`,
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, open: false }));
        setSubmitting(true);
        const body: RemoveCategoryBody = { phaseId: selectedPhaseId, categoryId };
        try {
          await api.delete(`/api/v1/team-leader/projects/${project.id}/categories`, {
            body: JSON.stringify(body),
          });
          setPhaseCategories((prev) =>
            prev ? { ...prev, categories: prev.categories.filter((c) => c.categoryId !== categoryId) } : prev,
          );
          toast.success(`Đã xóa danh mục "${categoryName}".`);
        } catch {
          toast.error("Không thể xóa danh mục. Vui lòng thử lại.");
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  const onCreateCategory = async () => {
    if (!project || !selectedPhaseId) return;
    if (!newCatName.trim()) {
      toast.error("Tên danh mục không được để trống.");
      return;
    }
    if ((newCatBudget ?? 0) <= 0) {
      toast.error("Ngân sách danh mục phải lớn hơn 0.");
      return;
    }
    setSubmitting(true);
    const body: CreateExpenseCategoryBody = {
      name: newCatName.trim(),
      description: newCatDesc.trim() || undefined,
      phaseId: selectedPhaseId,
      budgetLimit: newCatBudget ?? 0,
    };
    try {
      await api.post<ExpenseCategoryResponse>(
        `/api/v1/team-leader/projects/${project.id}/expense-categories`,
        body,
      );
      const refreshed = await api.get<PhaseCategoriesResponse>(
        `/api/v1/team-leader/projects/${project.id}/categories?phaseId=${selectedPhaseId}`,
      );
      setPhaseCategories(refreshed.data);
      const catRefreshed = await api.get<ExpenseCategoryResponse[]>(
        `/api/v1/team-leader/expense-categories?projectId=${project.id}`,
      );
      setExpenseCategories(catRefreshed.data);
      toast.success(`Đã thêm danh mục "${body.name}" vào giai đoạn.`);
    } catch {
      toast.error("Không thể tạo danh mục. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
      setShowCreateCategory(false);
      setNewCatName("");
      setNewCatDesc("");
      setNewCatBudget(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-52 rounded bg-white animate-pulse" />
        <div className="h-24 rounded-2xl bg-white animate-pulse" />
        <div className="h-72 rounded-2xl bg-white animate-pulse" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-lg font-bold text-slate-900">Không tìm thấy dự án</p>
        <p className="mt-2 text-sm text-slate-500">Dự án này không tồn tại hoặc bạn không có quyền truy cập.</p>
        <button
          type="button"
          onClick={() => router.push("/team-leader/projects")}
          className="mt-5 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-500"
        >
          Quay lại danh sách
        </button>
      </div>
    );
  }

  const currentPhase =
    project.phases.find((p) => p.id === project.currentPhaseId) ?? null;
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-indigo-700 to-cyan-600 text-white shadow-xl shadow-blue-950/20">
        <div className="relative p-6 sm:p-8">
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 right-10 h-28 w-28 rounded-full bg-cyan-300/20 blur-2xl" />

          <div className="relative">
            <button
              type="button"
              onClick={() => router.push("/team-leader/projects")}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 19l-7-7 7-7" />
              </svg>
              Quay lại danh sách
            </button>

            <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-indigo-100">{project.projectCode}</p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{project.name}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-100">{project.description ?? "Không có mô tả"}</p>
              </div>

              <div className="flex flex-col items-start gap-3 lg:items-end">
                <span className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${statusBadge(project.status)}`}>
                  {statusLabel(project.status)}
                </span>
                <button
                  type="button"
                  onClick={() => setShowTopup(true)}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-lg shadow-blue-950/20 transition hover:bg-blue-50"
                >
                  Xin cấp vốn
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={<MetricLabel label="Hạn mức dự án" description="Mức ngân sách kế hoạch tối đa của dự án, không phải số tiền đã được cấp." />} value={formatCurrency(project.totalBudget)} helper="Ngân sách kế hoạch" tone="blue" />
        <MetricCard label={<MetricLabel label="Đã chi" description="Tổng giá trị các giao dịch đã hoàn tất và được ghi nhận cho dự án." />} value={formatCurrency(budgetSummary.totalSpent)} helper={`${overallBurn}% ngân sách đã sử dụng`} tone={overallBurn >= 85 ? "rose" : "indigo"} />
        <MetricCard label={<MetricLabel label="Ngân sách còn theo chi phí" description="Ngân sách đã cấp trừ chi phí đã xác nhận; số dư ví và tiền đang giữ được theo dõi riêng." />} value={formatCurrency(budgetSummary.availableBudget)} helper={`${budgetSummary.remainingPercent}% ngân sách còn lại`} tone="emerald" />
        <MetricCard label="Thành viên" value={String(project.members.length)} helper={`${project.phases.length} giai đoạn`} tone="cyan" />
      </section>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Tổng quan ngân sách</h2>
            <p className="mt-1 text-sm text-slate-500">Theo dõi mức tiêu hao và phần quỹ đã được cấp còn khả dụng của dự án.</p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
            Giai đoạn hiện tại: {currentPhase?.name ?? "Chưa có"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <InfoCard label="Hạn mức kế hoạch" value={formatCurrency(project.totalBudget)} />
          <InfoCard label="Đã chi" value={formatCurrency(budgetSummary.totalSpent)} tone="text-rose-700" />
          <InfoCard label="Ngân sách còn theo chi phí" value={formatCurrency(budgetSummary.availableBudget)} tone="text-emerald-700" />
        </div>

        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Tỷ lệ sử dụng ngân sách</span>
            <span>{overallBurn}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${getBurnClass(overallBurn)}`} style={{ width: `${overallBurn}%` }} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
        {(
          [
            ["phases", "Giai đoạn"],
            ["budget", "Ngân sách danh mục"],
            ["members", "Thành viên"],
          ] as [TabKey, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
              tab === key
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "phases" && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-bold text-slate-900">
              Danh sách giai đoạn
            </h3>
            <button
              onClick={() => setShowCreatePhase(true)}
              className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-500"
            >
              + Tạo giai đoạn
            </button>
          </div>
          {project.phases.map((p) => {
            const pct = burn(p.currentSpent, p.budgetLimit);
            return (
              <div
                key={p.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500 font-mono">
                      {p.phaseCode}
                    </p>
                    <p className="text-base text-slate-900 font-bold mt-1">
                      {p.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex px-2 py-1 rounded-full border text-xs ${phaseStatusClass(p.status)}`}
                    >
                      {phaseStatusLabel(p.status)}
                    </span>
                    <button
                      onClick={() => openEditPhase(p)}
                      className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
                    >
                      Sửa
                    </button>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${getBurnClass(pct)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-slate-500 gap-2">
                  <span>
                    {formatCurrency(p.currentSpent)} /{" "}
                    {formatCurrency(p.budgetLimit)}
                  </span>
                  <span>
                    {formatDate(p.startDate)} - {formatDate(p.endDate)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "budget" && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-lg font-bold text-slate-900">
                Ngân sách theo danh mục
              </h3>
              <select
                value={selectedPhaseId ?? ""}
                onChange={(e) => setSelectedPhaseId(Number(e.target.value))}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10"
              >
                {project.phases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setShowCreateCategory(true)}
                disabled={!selectedPhaseId || editingBudget}
                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
              >
                + Thêm danh mục
              </button>
              {editingBudget ? (
                <>
                  <button
                    onClick={() => setEditingBudget(false)}
                    className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={onSaveBudget}
                    disabled={submitting}
                    className="rounded-2xl bg-blue-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-blue-500 disabled:opacity-60"
                  >
                    Lưu
                  </button>
                </>
              ) : (
                <button
                  onClick={startEditBudget}
                  className="rounded-2xl bg-blue-600 px-3 py-2 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-500"
                >
                  Cập nhật ngân sách
                </button>
              )}
            </div>
          </div>

          {!phaseCategories ? (
            <p className="text-sm text-slate-500">
              Không có dữ liệu danh mục cho giai đoạn này.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[860px]">
                <thead className="sticky top-0 z-10 bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                      Danh mục
                    </th>
                    <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-slate-400">
                      Ngân sách
                    </th>
                    <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-slate-400">
                      Đã dùng
                    </th>
                    <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-slate-400">
                      Còn lại
                    </th>
                    <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-slate-400">
                      Tỷ lệ dùng
                    </th>
                    <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-slate-400">
                      Xóa
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {phaseCategories.categories.map((c) => {
                    const pct = burn(c.currentSpent, c.budgetLimit);
                    return (
                      <tr
                        key={c.categoryId}
                        className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-blue-50/40"
                      >
                        <td className="px-4 py-3 text-sm text-slate-900">
                          {c.categoryName}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-slate-900">
                          {editingBudget ? (
                            <CurrencyInput
                              value={budgetDraft[c.categoryId] ?? null}
                              onChange={(val) =>
                                setBudgetDraft((prev) => ({
                                  ...prev,
                                  [c.categoryId]: val,
                                }))
                              }
                              className="w-32 text-right"
                            />
                          ) : (
                            formatCurrency(c.budgetLimit)
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-rose-700">
                          {formatCurrency(c.currentSpent)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right text-sm ${c.remaining < 0 ? "text-rose-700 font-semibold" : "text-emerald-700"}`}
                        >
                          {formatCurrency(c.remaining)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-slate-600">
                          {pct}%
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => onDeleteCategory(c.categoryId, c.categoryName, c.currentSpent)}
                            disabled={submitting || editingBudget}
                            title={c.currentSpent > 0 ? "Không thể xóa khi đã có chi tiêu" : "Xóa danh mục"}
                            className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Xóa
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "members" && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-bold text-slate-900">
              Thành viên dự án
            </h3>
            <button
              onClick={() => setShowAddMember(true)}
              className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-500"
            >
              Thêm thành viên
            </button>
          </div>
          <div className="space-y-2">
            {project.members.map((m) => (
              <div
                key={m.userId}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-sm font-bold text-white shadow-sm">
                    {initials(m.fullName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {m.fullName}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {m.employeeCode} • {m.position}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex px-2 py-1 rounded-full border text-xs ${roleBadge(m.projectRole)}`}
                  >
                    {m.projectRole}
                  </span>
                  <button
                    onClick={() => openEditMember(m.userId, m.position)}
                    className="rounded-xl bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
                  >
                    Sửa
                  </button>
                  <button
                    onClick={() => onRemoveMember(m.userId)}
                    disabled={submitting}
                    className="rounded-xl bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-rose-500 disabled:opacity-60"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <SideDrawer
        open={showTopup}
        title="Xin cấp vốn dự án"
        onClose={() => setShowTopup(false)}
        footer={
          <ModalActions
            onClose={() => setShowTopup(false)}
            onConfirm={onTopup}
            confirmText={submitting ? "Đang gửi..." : "Gửi yêu cầu"}
          />
        }
      >
        <div className="space-y-4">
          <CurrencyInput
            value={topupAmount}
            onChange={setTopupAmount}
            placeholder="Số tiền cần cấp"
          />
          <textarea
            rows={4}
            value={topupNote}
            onChange={(e) => setTopupNote(e.target.value)}
            placeholder="Lý do (tuỳ chọn)"
            className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 resize-none"
          />
        </div>
      </SideDrawer>

      <SideDrawer
        open={showCreatePhase}
        title="Tạo giai đoạn mới"
        onClose={() => setShowCreatePhase(false)}
        footer={
          <ModalActions
            onClose={() => setShowCreatePhase(false)}
            onConfirm={onCreatePhase}
            confirmText={submitting ? "Đang lưu..." : "Tạo giai đoạn"}
          />
        }
      >
        <div className="space-y-4">
          <input
            value={phaseName}
            onChange={(e) => setPhaseName(e.target.value)}
            placeholder="Tên giai đoạn"
            className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900"
          />
          <CurrencyInput
            value={phaseBudget}
            onChange={setPhaseBudget}
            placeholder="Ngân sách"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="date"
              value={phaseStart}
              onChange={(e) => setPhaseStart(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900"
            />
            <input
              type="date"
              value={phaseEnd}
              onChange={(e) => setPhaseEnd(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900"
            />
          </div>
        </div>
      </SideDrawer>

      <SideDrawer
        open={showEditPhase}
        title="Cập nhật giai đoạn"
        onClose={() => setShowEditPhase(false)}
        footer={
          <ModalActions
            onClose={() => setShowEditPhase(false)}
            onConfirm={onUpdatePhase}
            confirmText={submitting ? "Đang lưu..." : "Lưu cập nhật"}
          />
        }
      >
        <div className="space-y-4">
          <input
            value={editPhaseName}
            onChange={(e) => setEditPhaseName(e.target.value)}
            placeholder="Tên giai đoạn"
            className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900"
          />
          <CurrencyInput
            value={editPhaseBudget}
            onChange={setEditPhaseBudget}
            placeholder="Ngân sách"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="date"
              value={editPhaseEnd}
              onChange={(e) => setEditPhaseEnd(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900"
            />
            <select
              value={editPhaseStatus}
              onChange={(e) =>
                setEditPhaseStatus(e.target.value as PhaseStatus)
              }
              className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900"
            >
              <option value={PhaseStatus.PLANNED}>Chưa bắt đầu</option>
              <option value={PhaseStatus.ACTIVE}>Đang thực hiện</option>
              <option value={PhaseStatus.CLOSED}>Đã kết thúc</option>
            </select>
          </div>
        </div>
      </SideDrawer>

      <SideDrawer
        open={showAddMember}
        title="Thêm thành viên"
        onClose={() => setShowAddMember(false)}
        footer={
          <ModalActions
            onClose={() => setShowAddMember(false)}
            onConfirm={onAddMember}
            confirmText={submitting ? "Đang thêm..." : "Thêm"}
            disabled={!selectedMemberId}
          />
        }
      >
        <div className="space-y-4">
          <input
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder="Tìm theo tên hoặc mã..."
            className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900"
          />
          <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white">
            {filteredAvailable.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-500">
                Không có thành viên phù hợp.
              </p>
            ) : (
              filteredAvailable.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMemberId(m.id)}
                  className={`w-full px-4 py-3 text-left border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors ${selectedMemberId === m.id ? "bg-blue-100 text-blue-700" : "text-slate-900 hover:bg-slate-100"}`}
                >
                  <p className="text-sm font-medium">{m.fullName}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {m.employeeCode}
                  </p>
                </button>
              ))
            )}
          </div>
          <input
            value={memberPosition}
            onChange={(e) => setMemberPosition(e.target.value)}
            placeholder="Vị trí trong dự án"
            className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900"
          />
        </div>
      </SideDrawer>

      <SideDrawer
        open={showEditMember}
        title="Cập nhật vị trí"
        onClose={() => setShowEditMember(false)}
        footer={
          <ModalActions
            onClose={() => setShowEditMember(false)}
            onConfirm={onUpdateMember}
            confirmText={submitting ? "Đang lưu..." : "Lưu"}
          />
        }
      >
        <div className="space-y-4">
          <input
            value={editingPosition}
            onChange={(e) => setEditingPosition(e.target.value)}
            placeholder="Vị trí"
            className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900"
          />
        </div>
      </SideDrawer>
      <SideDrawer
        open={showCreateCategory}
        title="Thêm danh mục chi phí"
        onClose={() => setShowCreateCategory(false)}
        footer={
          <ModalActions
            onClose={() => setShowCreateCategory(false)}
            onConfirm={onCreateCategory}
            confirmText={submitting ? "Đang tạo..." : "Tạo danh mục"}
            disabled={submitting || !newCatName.trim() || (newCatBudget ?? 0) <= 0}
          />
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">Tên danh mục *</label>
            <input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="VD: Chi phí vận chuyển"
              className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Mô tả (tùy chọn)</label>
            <textarea
              rows={2}
              value={newCatDesc}
              onChange={(e) => setNewCatDesc(e.target.value)}
              placeholder="Mô tả danh mục..."
              className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Ngân sách cho giai đoạn này *</label>
            <CurrencyInput
              value={newCatBudget}
              onChange={setNewCatBudget}
              placeholder="Ngân sách (VNĐ)"
            />
          </div>
        </div>
      </SideDrawer>

      <ConfirmModal
        open={confirmState.open}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone,
}: {
  label: React.ReactNode;
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

function InfoCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className={`mt-2 text-sm font-semibold ${tone ?? "text-slate-900"}`}>{value}</p>
    </div>
  );
}

function ModalActions({
  onClose,
  onConfirm,
  confirmText,
  disabled,
}: {
  onClose: () => void;
  onConfirm: () => void;
  confirmText: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-3 pt-2">
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm"
      >
        Hủy
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={disabled}
        className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm"
      >
        {confirmText}
      </button>
    </div>
  );
}
