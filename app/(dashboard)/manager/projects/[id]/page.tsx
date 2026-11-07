"use client";

import React, { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api-client";
import { useToast } from "@/contexts/toast-context";
import {
  PhaseStatus,
  ProjectDetailResponse,
  ProjectRole,
  ProjectStatus,
  TeamLeaderOptionResponse,
  UpdateProjectBody,
} from "@/types";
import { formatCurrency, formatDate, getBurnClass } from "@/lib/format";
import { MetricLabel } from "@/components/ui/metric-label";
import { CurrencyInput } from "@/components/ui/currency-input";

interface PageProps {
  params: Promise<{ id: string }>;
}


function statusClass(status: string): string {
  switch (status) {
    case ProjectStatus.ACTIVE:
      return "bg-emerald-100 border-emerald-200 text-emerald-700";
    case ProjectStatus.PLANNING:
      return "bg-sky-100 border-sky-200 text-sky-700";
    case ProjectStatus.PAUSED:
      return "bg-amber-100 border-amber-200 text-amber-700";
    case ProjectStatus.CLOSED:
      return "bg-slate-100 border-slate-200 text-slate-600";
    default:
      return "bg-slate-100 border-slate-200 text-slate-600";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case ProjectStatus.ACTIVE:
      return "Đang hoạt động";
    case ProjectStatus.PLANNING:
      return "Lập kế hoạch";
    case ProjectStatus.PAUSED:
      return "Tạm dừng";
    case ProjectStatus.CLOSED:
      return "Đã đóng";
    default:
      return status;
  }
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

function burnPercent(totalSpent: number, totalBudget: number): number {
  if (totalBudget <= 0) return 0;
  return Math.min(100, Math.round((totalSpent / totalBudget) * 100));
}



export default function ManagerProjectDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();

  const [project, setProject] = useState<ProjectDetailResponse | null>(null);
  const [teamLeaders, setTeamLeaders] = useState<TeamLeaderOptionResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTotalBudget, setEditTotalBudget] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState<ProjectStatus>(ProjectStatus.PLANNING);
  const [editTeamLeaderId, setEditTeamLeaderId] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadProject = async () => {
      setLoading(true);

      try {
        const res = await api.get<ProjectDetailResponse>(`/api/v1/manager/projects/${id}`);
        if (cancelled) return;
        setProject(res.data);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          toast.error(err.apiMessage);
        } else {
          toast.error("Không thể tải thông tin dự án.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadProject();

    return () => {
      cancelled = true;
    };
  }, [id, toast]);

  useEffect(() => {
    let cancelled = false;

    const loadTeamLeaders = async () => {
      try {
        const res = await api.get<TeamLeaderOptionResponse[]>("/api/v1/manager/department/team-leaders");
        if (cancelled) return;
        setTeamLeaders(res.data);
      } catch (err) {
        if (cancelled) return;
        setTeamLeaders([]);
        if (err instanceof ApiError) {
          toast.error(err.apiMessage);
        } else {
          toast.error("Không thể tải danh sách Trưởng nhóm.");
        }
      }
    };

    void loadTeamLeaders();

    return () => {
      cancelled = true;
    };
  }, [toast]);

  const leader = useMemo(
    () => project?.members.find((member) => member.projectRole === ProjectRole.LEADER) ?? null,
    [project]
  );

  const overallBurn = useMemo(() => {
    if (!project) return 0;
    return burnPercent(project.totalSpent, project.totalBudget);
  }, [project]);

  const openEditModal = () => {
    if (!project) return;

    setEditName(project.name);
    setEditDescription(project.description ?? "");
    setEditTotalBudget(project.totalBudget);
    setEditStatus(project.status);
    setEditTeamLeaderId(leader ? String(leader.userId) : "");
    setShowEditModal(true);
  };

  const handleSaveChanges = async () => {
    if (!project) return;

    const totalBudgetNumber = editTotalBudget ?? 0;
    const teamLeaderId = Number(editTeamLeaderId);

    if (!editName.trim()) {
      toast.error("Tên dự án là bắt buộc.");
      return;
    }

    if (totalBudgetNumber <= 0) {
      toast.error("Tổng ngân sách phải lớn hơn 0.");
      return;
    }

    if (!Number.isFinite(teamLeaderId) || teamLeaderId <= 0) {
      toast.error("Vui lòng chọn Trưởng nhóm.");
      return;
    }

    setSaving(true);

    const body: UpdateProjectBody = {
      name: editName.trim(),
      description: editDescription.trim() || undefined,
      totalBudget: totalBudgetNumber,
      status: editStatus,
      teamLeaderId,
    };

    try {
      const res = await api.put<ProjectDetailResponse>(`/api/v1/manager/projects/${project.id}`, body);
      setProject(res.data);
      toast.success("Đã cập nhật thông tin dự án.");
      setShowEditModal(false);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.apiMessage);
      } else {
        toast.error("Không thể cập nhật dự án. Vui lòng thử lại.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-48 animate-pulse rounded-3xl bg-white" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-3xl bg-white" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-3xl bg-white" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7h18M3 12h18M3 17h18" />
          </svg>
        </div>
        <h2 className="mt-4 text-base font-bold text-slate-900">Không tìm thấy dự án</h2>
        <p className="mt-1 text-sm text-slate-500">Dự án có thể đã bị xóa hoặc bạn không còn quyền truy cập.</p>
      </div>
    );
  }

  const remainingPercent = project.totalBudget > 0
    ? Math.round((project.availableBudget / project.totalBudget) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-indigo-200 bg-linear-to-br from-indigo-700 via-blue-600 to-cyan-600 text-white shadow-xl shadow-indigo-900/15">
        <div className="relative px-6 py-7 sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.28),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(103,232,249,0.22),_transparent_34%)]" />
          <div className="relative">
            <button
              type="button"
              onClick={() => router.push("/manager/projects")}
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
                <span className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${statusClass(project.status)}`}>
                  {statusLabel(project.status)}
                </span>
                <button
                  type="button"
                  onClick={openEditModal}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-lg shadow-blue-950/20 transition hover:bg-blue-50"
                >
                  Sửa thông tin
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={<MetricLabel label="Hạn mức dự án" description="Mức ngân sách kế hoạch tối đa của dự án, không phải số tiền đã được cấp." />} value={formatCurrency(project.totalBudget)} helper="Ngân sách kế hoạch" tone="blue" />
        <MetricCard label={<MetricLabel label="Đã chi" description="Tổng giá trị các giao dịch đã hoàn tất và được ghi nhận cho dự án." />} value={formatCurrency(project.totalSpent)} helper={`${overallBurn}% ngân sách đã sử dụng`} tone={overallBurn >= 85 ? "rose" : "indigo"} />
        <MetricCard label={<MetricLabel label="Quỹ khả dụng" description="Số tiền thực tế dự án đang có thể sử dụng cho các yêu cầu mới." />} value={formatCurrency(project.availableBudget)} helper={`${remainingPercent}% khả dụng`} tone="emerald" />
        <MetricCard label="Thành viên" value={String(project.members.length)} helper={`${project.phases.length} giai đoạn`} tone="cyan" />
      </section>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">Tổng quan ngân sách</h2>
          <p className="mt-1 text-sm text-slate-500">Theo dõi hạn mức kế hoạch và phần quỹ đã được cấp còn khả dụng của dự án.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <InfoCard label="Hạn mức kế hoạch" value={formatCurrency(project.totalBudget)} tone="text-slate-900" />
          <InfoCard label="Đã chi" value={formatCurrency(project.totalSpent)} tone="text-rose-700" />
          <InfoCard label="Quỹ khả dụng" value={formatCurrency(project.availableBudget)} tone="text-emerald-700" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Tỷ lệ sử dụng ngân sách</span>
            <span>{overallBurn}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${getBurnClass(overallBurn)}`} style={{ width: `${overallBurn}%` }} />
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">Thông tin dự án</h2>
          <p className="mt-1 text-sm text-slate-500">Thông tin quản trị và người phụ trách.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <InfoCard label="Trưởng nhóm" value={leader?.fullName ?? "Chưa gán"} />
          <InfoCard label="Phòng ban" value={project.departmentName} />
          <InfoCard label="Ngày tạo" value={formatDate(project.createdAt)} />
          <InfoCard label="Mô tả" value={project.description ?? "Không có mô tả"} />
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">Các giai đoạn</h2>
          <p className="mt-1 text-sm text-slate-500">Các giai đoạn triển khai của dự án.</p>
        </div>

        {project.phases.length === 0 ? (
          <p className="text-sm text-slate-500">Dự án chưa có giai đoạn.</p>
        ) : (
          <div className="space-y-3">
            {project.phases.map((phase) => {
              const phaseBurn = burnPercent(phase.currentSpent, phase.budgetLimit);
              return (
                <div key={phase.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-slate-500 font-mono">{phase.phaseCode}</p>
                      <p className="text-sm font-semibold text-slate-900 mt-1">{phase.name}</p>
                    </div>
                    <span
                      className={`inline-flex px-2 py-1 rounded-full border text-xs ${phaseStatusClass(phase.status)}`}
                    >
                      {phaseStatusLabel(phase.status)}
                    </span>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${getBurnClass(phaseBurn)}`} style={{ width: `${phaseBurn}%` }} />
                  </div>

                  <div className="mt-3 flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      {formatCurrency(phase.currentSpent)} / {formatCurrency(phase.budgetLimit)}
                    </span>
                    <span>
                      {formatDate(phase.startDate)} - {formatDate(phase.endDate)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">Members</h2>
          <p className="mt-1 text-sm text-slate-500">Thành viên đang tham gia dự án.</p>
        </div>

        {project.members.length === 0 ? (
          <p className="text-sm text-slate-500">Dự án chưa có thành viên.</p>
        ) : (
          <div className="space-y-2">
            {project.members.map((member) => (
              <div
                key={member.userId}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{member.fullName}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {member.employeeCode} • {member.position}
                  </p>
                </div>

                <span
                  className={`inline-flex px-2 py-1 rounded-full border text-xs ${
                    member.projectRole === ProjectRole.LEADER
                      ? "bg-indigo-100 border-indigo-200 text-indigo-700"
                      : "bg-slate-100 border-slate-200 text-slate-600"
                  }`}
                >
                  {member.projectRole}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showEditModal && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            onClick={() => setShowEditModal(false)}
            aria-label="Đóng modal chỉnh sửa dự án"
          />

          <div className="absolute inset-x-0 top-10 mx-auto w-[calc(100%-2rem)] max-w-xl rounded-3xl border border-blue-100 bg-white p-6 shadow-2xl shadow-slate-950/20">
            <div className="mb-5">
              <h3 className="text-xl font-bold text-slate-900">Sửa thông tin dự án</h3>
              <p className="mt-1 text-sm text-slate-500">Cập nhật cấu hình quản trị, ngân sách và Trưởng nhóm phụ trách.</p>
            </div>

            <div className="space-y-5">
            <div>
              <label className="block text-sm text-slate-600 mb-2">Tên dự án</label>
              <input
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">Mô tả</label>
              <textarea
                rows={4}
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-600 mb-2">Tổng ngân sách (VND)</label>
                <CurrencyInput value={editTotalBudget} onChange={setEditTotalBudget} />
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-2">Trạng thái</label>
                <select
                  value={editStatus}
                  onChange={(event) => setEditStatus(event.target.value as ProjectStatus)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10"
                >
                  <option value={ProjectStatus.PLANNING}>Lập kế hoạch</option>
                  <option value={ProjectStatus.ACTIVE}>Đang hoạt động</option>
                  <option value={ProjectStatus.PAUSED}>Tạm dừng</option>
                  <option value={ProjectStatus.CLOSED}>Đã đóng</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">Trưởng nhóm</label>
              <select
                value={editTeamLeaderId}
                onChange={(event) => setEditTeamLeaderId(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10"
              >
                <option value="">Chọn Trưởng nhóm</option>
                {teamLeaders.map((option) => (
                  <option key={option.id} value={String(option.id)}>
                    {option.fullName} ({option.employeeCode})
                  </option>
                ))}
              </select>
            </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-5">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={saving}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Đang lưu..." : "Lưu thay đổi"}
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
