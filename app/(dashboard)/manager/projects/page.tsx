"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ApiError, api } from "@/lib/api-client";
import { useToast } from "@/contexts/toast-context";
import {
  CreateProjectBody,
  ManagerProjectFilterParams,
  ManagerProjectListItem,
  PaginatedResponse,
  ProjectStatus,
  TeamLeaderOptionResponse,
} from "@/types";
import { formatCurrency, getBurnClass } from "@/lib/format";
import { CurrencyInput } from "@/components/ui/currency-input";
import { SideDrawer } from "@/components/ui/side-drawer";
import { ExcelImportPanel } from "@/components/data-exchange/excel-import-panel";

const PAGE_LIMIT = 9;
type ManagerProjectViewItem = ManagerProjectListItem & {
  teamLeaderName?: string | null;
};

function parsePage(value: string | null): number {
  const page = Number(value ?? "1");
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function parseStatus(value: string | null): ProjectStatus | undefined {
  if (!value) return undefined;
  const values = Object.values(ProjectStatus);
  return values.includes(value as ProjectStatus)
    ? (value as ProjectStatus)
    : undefined;
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

function burnPercent(project: ManagerProjectListItem): number {
  if (project.totalBudget <= 0) return 0;
  return Math.min(
    100,
    Math.round((project.totalSpent / project.totalBudget) * 100),
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
  tone: "blue" | "emerald" | "cyan" | "rose";
}) {
  const toneClassName = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
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

function pickItems<T>(payload: PaginatedResponse<T> | T[]): T[] {
  return Array.isArray(payload) ? payload : payload.items;
}

function normalizeProject(
  item: ManagerProjectListItem,
): ManagerProjectViewItem {
  const withLeader = item as ManagerProjectListItem & {
    teamLeaderName?: string | null;
  };
  return {
    ...item,
    teamLeaderName: withLeader.teamLeaderName ?? null,
  };
}

export default function ManagerProjectsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();

  const searchParamsString = searchParams.toString();
  const statusFilter = useMemo(
    () => parseStatus(searchParams.get("status")),
    [searchParams],
  );
  const search = useMemo(
    () => searchParams.get("search") ?? "",
    [searchParams],
  );
  const page = useMemo(
    () => parsePage(searchParams.get("page")),
    [searchParams],
  );

  const [items, setItems] = useState<ManagerProjectViewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(search);

  const [teamLeaderOptions, setTeamLeaderOptions] = useState<
    TeamLeaderOptionResponse[]
  >([]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectBudget, setProjectBudget] = useState<number | null>(null);
  const [teamLeaderId, setTeamLeaderId] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const pushWithParams = useCallback(
    (params: URLSearchParams) => {
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router],
  );

  const updateParam = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParamsString);
      if (value && value.trim()) {
        params.set(key, value.trim());
      } else {
        params.delete(key);
      }
      if (key !== "page") params.delete("page");
      pushWithParams(params);
    },
    [pushWithParams, searchParamsString],
  );

  const goToPage = useCallback(
    (nextPage: number) => {
      const params = new URLSearchParams(searchParamsString);
      if (nextPage <= 1) params.delete("page");
      else params.set("page", String(nextPage));
      pushWithParams(params);
    },
    [pushWithParams, searchParamsString],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed === search) return;
      updateParam("search", trimmed || undefined);
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchInput, search, updateParam]);

  useEffect(() => {
    let cancelled = false;

    const loadTeamLeaders = async () => {
      try {
        const res = await api.get<TeamLeaderOptionResponse[]>(
          "/api/v1/manager/department/team-leaders",
        );
        if (cancelled) return;
        setTeamLeaderOptions(res.data);
      } catch (err) {
        if (cancelled) return;
        setTeamLeaderOptions([]);
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

  useEffect(() => {
    let cancelled = false;

    const loadProjects = async () => {
      setLoading(true);

      try {
        const filters: ManagerProjectFilterParams = {
          status: statusFilter,
          search: search.trim() || undefined,
          page,
          limit: PAGE_LIMIT,
        };

        const query = new URLSearchParams();
        if (filters.status) query.set("status", filters.status);
        if (filters.search) query.set("search", filters.search);
        query.set("page", String(filters.page ?? 1));
        query.set("limit", String(filters.limit ?? PAGE_LIMIT));

        const res = await api.get<
          PaginatedResponse<ManagerProjectListItem> | ManagerProjectListItem[]
        >(`/api/v1/manager/projects?${query.toString()}`);

        if (cancelled) return;

        const normalized = pickItems(res.data).map(normalizeProject);
        const apiTotal = Array.isArray(res.data)
          ? normalized.length
          : res.data.total;
        const apiTotalPages = Array.isArray(res.data)
          ? Math.max(1, Math.ceil(apiTotal / PAGE_LIMIT))
          : res.data.totalPages;

        setItems(normalized);
        setTotal(apiTotal);
        setTotalPages(apiTotalPages);
      } catch (err) {
        if (cancelled) return;
        setItems([]);
        setTotal(0);
        setTotalPages(1);
        toast.error(err instanceof ApiError ? err.apiMessage : "Không thể tải danh sách dự án.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadProjects();

    return () => {
      cancelled = true;
    };
  }, [page, search, statusFilter, toast]);

  const statusTabs: { label: string; value?: ProjectStatus }[] = [
    { label: "Tất cả" },
    { label: "Đang hoạt động", value: ProjectStatus.ACTIVE },
    { label: "Lập kế hoạch", value: ProjectStatus.PLANNING },
    { label: "Tạm dừng", value: ProjectStatus.PAUSED },
    { label: "Đã đóng", value: ProjectStatus.CLOSED },
  ];
  const filtered = Boolean(statusFilter || search);
  const activeOnPage = items.filter((project) => project.status === ProjectStatus.ACTIVE).length;
  const atRiskOnPage = items.filter((project) => burnPercent(project) >= 85).length;
  const availableOnPage = items.reduce((sum, project) => sum + project.availableBudget, 0);

  const openCreateModal = () => {
    setProjectName("");
    setProjectDescription("");
    setProjectBudget(null);
    setTeamLeaderId("");
    setShowCreateModal(true);
  };

  const handleCreateProject = async () => {
    const budgetNumber = projectBudget ?? 0;
    const selectedTl = Number(teamLeaderId);

    if (!projectName.trim()) {
      toast.error("Tên dự án là bắt buộc.");
      return;
    }

    if (budgetNumber <= 0) {
      toast.error("Tổng ngân sách phải lớn hơn 0.");
      return;
    }

    if (!Number.isFinite(selectedTl) || selectedTl <= 0) {
      toast.error("Vui lòng chọn Trưởng nhóm.");
      return;
    }

    setCreating(true);

    const body: CreateProjectBody = {
      name: projectName.trim(),
      description: projectDescription.trim() || undefined,
      totalBudget: budgetNumber,
      teamLeaderId: selectedTl,
    };

    const selectedTlName =
      teamLeaderOptions.find((option) => option.id === selectedTl)?.fullName ??
      "Trưởng nhóm";

    try {
      const res = await api.post<ManagerProjectListItem>(
        "/api/v1/manager/projects",
        body,
      );

      const created = normalizeProject(res.data);
      created.teamLeaderName = created.teamLeaderName ?? selectedTlName;

      setItems((prev) => [created, ...prev].slice(0, PAGE_LIMIT));
      setTotal((prev) => prev + 1);
      toast.success("Đã tạo dự án mới.");
      setShowCreateModal(false);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.apiMessage);
      } else {
        toast.error("Không thể tạo dự án. Vui lòng thử lại.");
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-indigo-200 bg-linear-to-br from-indigo-700 via-blue-600 to-cyan-600 text-white shadow-xl shadow-indigo-900/15">
        <div className="relative px-6 py-7 sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.28),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(103,232,249,0.22),_transparent_34%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-100">Manager projects</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Dự án phòng ban</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100">
                Quản lý danh sách dự án, ngân sách, Trưởng nhóm phụ trách và mức sử dụng trong phòng ban.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-lg shadow-blue-950/20 transition hover:bg-blue-50"
            >
              Tạo dự án
            </button>
          </div>
        </div>
      </section>

      <details className="group">
        <summary className="cursor-pointer rounded-2xl border border-blue-200 bg-white px-5 py-3 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50">Nhập dự án từ Excel</summary>
        <div className="mt-3"><ExcelImportPanel datasetCode="projects" title="Nhập dự án" /></div>
      </details>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Tổng dự án" value={total.toLocaleString("vi-VN")} helper={`${items.length} đang hiển thị`} tone="blue" />
        <MetricCard label="Đang chạy" value={String(activeOnPage)} helper="Dự án đang hoạt động trên trang" tone="emerald" />
        <MetricCard label="Ngân sách còn lại" value={formatCurrency(availableOnPage)} helper="Tổng khả dụng trên trang" tone="cyan" />
        <MetricCard label="Cần chú ý" value={String(atRiskOnPage)} helper="Tỷ lệ sử dụng từ 85% trở lên" tone="rose" />
      </section>

      <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Bộ lọc dự án</h2>
            <p className="mt-1 text-sm text-slate-500">Lọc theo trạng thái hoặc tìm nhanh bằng mã và tên dự án.</p>
          </div>
          {filtered && (
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams(searchParamsString);
                params.delete("status");
                params.delete("search");
                params.delete("page");
                pushWithParams(params);
              }}
              className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {statusTabs.map((tab) => {
            const active =
              statusFilter === tab.value || (!statusFilter && !tab.value);

            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => updateParam("status", tab.value)}
                className={`rounded-2xl border px-4 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "border-blue-200 bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative mt-4">
          <svg
            className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-4.35-4.35m1.6-5.65a7.25 7.25 0 11-14.5 0 7.25 7.25 0 0114.5 0z"
            />
          </svg>
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Tìm mã hoặc tên dự án..."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
          />
        </div>
      </section>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, index) => (
            <div
              key={`manager-project-skeleton-${index}`}
              className="h-56 animate-pulse rounded-3xl bg-white"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <svg
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 7h18M3 12h18M3 17h18"
              />
            </svg>
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">Không có dự án phù hợp</h3>
          <p className="mt-1 text-sm text-slate-500">Thử thay đổi trạng thái hoặc từ khóa tìm kiếm.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((project) => {
            const burn = burnPercent(project);

            return (
              <div
                key={project.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-900/10"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold text-blue-600">
                      {project.projectCode}
                    </p>
                    <p className="mt-2 truncate text-base font-bold text-slate-950">
                      {project.name}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(project.status)}`}
                  >
                    {statusLabel(project.status)}
                  </span>
                </div>

                <p className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Trưởng nhóm: {project.teamLeaderName ?? "Chưa gán"}
                </p>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">Tỷ lệ sử dụng ngân sách</span>
                    <span>{burn}% sử dụng</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${getBurnClass(burn)}`}
                      style={{ width: `${burn}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      {formatCurrency(project.totalSpent)} /{" "}
                      {formatCurrency(project.totalBudget)}
                    </span>
                    <span className="text-emerald-700">
                      {formatCurrency(project.availableBudget)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => router.push(`/manager/projects/${project.id}`)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50"
                >
                  Xem chi tiết
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Hiển thị <span className="font-semibold text-slate-900">{items.length}</span> trong tổng{" "}
          <span className="font-semibold text-slate-900">{total.toLocaleString("vi-VN")}</span> dự án
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Trước
          </button>
          <button
            type="button"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sau
          </button>
        </div>
      </div>

      <SideDrawer
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Tạo dự án mới"
        description="Điền thông tin để tạo dự án mới cho phòng ban."
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleCreateProject}
              disabled={creating}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? "Đang tạo..." : "Tạo dự án"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-2">
              Tên dự án
            </label>
            <input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="Nhập tên dự án"
              className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-2">Mô tả</label>
            <textarea
              rows={4}
              value={projectDescription}
              onChange={(event) => setProjectDescription(event.target.value)}
              placeholder="Mô tả dự án (tuỳ chọn)"
              className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-2">
              Tổng ngân sách (VND)
            </label>
            <CurrencyInput value={projectBudget} onChange={setProjectBudget} placeholder="Ví dụ: 100.000.000" />
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-2">
              Trưởng nhóm phụ trách
            </label>
            <select
              value={teamLeaderId}
              onChange={(event) => setTeamLeaderId(event.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="">Chọn Trưởng nhóm</option>
              {teamLeaderOptions.map((option) => (
                <option key={option.id} value={String(option.id)}>
                  {option.fullName} ({option.employeeCode})
                </option>
              ))}
            </select>
          </div>
        </div>
      </SideDrawer>
    </div>
  );
}
