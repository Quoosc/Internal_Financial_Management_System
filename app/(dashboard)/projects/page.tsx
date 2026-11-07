"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, api } from "@/lib/api-client";
import { PaginatedResponse, ProjectListItem, ProjectStatus } from "@/types";
import { formatCurrency, getBurnClass } from "@/lib/format";
import { useToast } from "@/contexts/toast-context";

const PAGE_LIMIT = 9;


function getStatusLabel(status: ProjectStatus): string {
  switch (status) {
    case ProjectStatus.ACTIVE:
      return "Đang triển khai";
    case ProjectStatus.PLANNING:
      return "Lên kế hoạch";
    case ProjectStatus.PAUSED:
      return "Tạm dừng";
    case ProjectStatus.CLOSED:
      return "Đã đóng";
    default:
      return status;
  }
}

function getStatusClass(status: ProjectStatus): string {
  switch (status) {
    case ProjectStatus.ACTIVE:
      return "bg-emerald-50 border-emerald-200 text-emerald-700";
    case ProjectStatus.PLANNING:
      return "bg-blue-50 border-blue-200 text-blue-700";
    case ProjectStatus.PAUSED:
      return "bg-amber-50 border-amber-200 text-amber-700";
    case ProjectStatus.CLOSED:
      return "bg-slate-500/15 border-slate-500/30 text-slate-600";
    default:
      return "bg-slate-500/15 border-slate-500/30 text-slate-600";
  }
}


type StatusFilter = "ALL" | ProjectStatus;
type ProjectListPayload =
  | PaginatedResponse<ProjectListItem>
  | { content?: ProjectListItem[]; totalElements?: number; totalPages?: number }
  | ProjectListItem[];
function getProjectBudget(item: ProjectListItem): number {
  const budget = Number(item.totalBudget);
  return Number.isFinite(budget) ? budget : 0;
}

function getProjectSpent(item: ProjectListItem): number {
  const spent = Number(item.totalSpent);
  return Number.isFinite(spent) ? spent : 0;
}

function getProjectRemaining(item: ProjectListItem): number {
  const available = Number(item.availableBudget);
  return Number.isFinite(available)
    ? available
    : Math.max(0, getProjectBudget(item) - getProjectSpent(item));
}

function getSpentPercent(item: ProjectListItem): number {
  const budget = getProjectBudget(item);
  if (budget <= 0) return 0;
  return Math.min(100, Math.round((getProjectSpent(item) / budget) * 100));
}

function parseStatus(value: string | null): StatusFilter {
  if (!value) return "ALL";
  const valid = new Set<string>(Object.values(ProjectStatus));
  return valid.has(value) ? (value as ProjectStatus) : "ALL";
}

function parseSearch(value: string | null): string {
  return value ?? "";
}

function parsePage(value: string | null): number {
  const n = Number(value ?? "1");
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function getProjectItems(payload: ProjectListPayload): ProjectListItem[] {
  if (Array.isArray(payload)) return payload;
  if ("items" in payload && Array.isArray(payload.items)) return payload.items;
  if ("content" in payload && Array.isArray(payload.content)) return payload.content;
  return [];
}

function getProjectTotal(payload: ProjectListPayload, itemCount: number): number {
  if (Array.isArray(payload)) return itemCount;
  if ("total" in payload && typeof payload.total === "number") return payload.total;
  if ("totalElements" in payload && typeof payload.totalElements === "number") return payload.totalElements;
  return itemCount;
}

function getProjectTotalPages(payload: ProjectListPayload, totalItems: number): number {
  if (!Array.isArray(payload) && typeof payload.totalPages === "number") {
    return Math.max(1, payload.totalPages);
  }
  return Math.max(1, Math.ceil(totalItems / PAGE_LIMIT));
}

export default function ProjectsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() =>
    parseStatus(searchParams.get("status"))
  );
  const [search, setSearch] = useState(() => parseSearch(searchParams.get("search")));
  const [searchInput, setSearchInput] = useState(() => parseSearch(searchParams.get("search")));
  const [page, setPage] = useState(() => parsePage(searchParams.get("page")));

  const syncUrl = useCallback(
    (nextStatus: StatusFilter, nextSearch: string, nextPage: number) => {
      const params = new URLSearchParams();
      if (nextStatus !== "ALL") params.set("status", nextStatus);
      if (nextSearch) params.set("search", nextSearch);
      if (nextPage > 1) params.set("page", String(nextPage));
      const query = params.toString();
      router.replace(query ? `/projects?${query}` : "/projects");
    },
    [router]
  );

  useEffect(() => {
    let cancelled = false;

    const loadProjects = async () => {
      setLoading(true);

      try {
        const query = new URLSearchParams();
        if (statusFilter !== "ALL") query.set("status", statusFilter);
        if (search) query.set("search", search);
        query.set("page", String(page));
        query.set("limit", String(PAGE_LIMIT));

        const res = await api.get<ProjectListPayload>(
          `/api/v1/projects?${query.toString()}`
        );

        if (cancelled) return;
        const items = getProjectItems(res.data);
        const nextTotal = getProjectTotal(res.data, items.length);
        setProjects(items);
        setTotal(nextTotal);
        setTotalPages(getProjectTotalPages(res.data, nextTotal));
      } catch (err) {
        if (cancelled) return;

        setProjects([]);
        setTotal(0);
        setTotalPages(1);

        if (err instanceof ApiError) {
          toast.error(err.apiMessage);
        } else {
          toast.error("Không thể tải danh sách dự án.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadProjects();

    return () => {
      cancelled = true;
    };
  }, [statusFilter, search, page, syncUrl, toast]);

  const statusTabs = useMemo<{ label: string; value: StatusFilter }[]>(
    () => [
      { label: "Tất cả", value: "ALL" },
      { label: "Đang triển khai", value: ProjectStatus.ACTIVE },
      { label: "Lên kế hoạch", value: ProjectStatus.PLANNING },
      { label: "Tạm dừng", value: ProjectStatus.PAUSED },
      { label: "Đã đóng", value: ProjectStatus.CLOSED },
    ],
    []
  );

  const handleStatusChange = (value: StatusFilter) => {
    setStatusFilter(value);
    setPage(1);
    syncUrl(value, search, 1);
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    setSearch(trimmed);
    setPage(1);
    syncUrl(statusFilter, trimmed, 1);
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    setPage(nextPage);
    syncUrl(statusFilter, search, nextPage);
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-indigo-700 text-white shadow-xl shadow-blue-900/10">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">Không gian IFMS</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Dự án</h1>
            <p className="mt-3 text-sm leading-6 text-blue-100">Theo dõi các dự án bạn tham gia, giai đoạn hiện tại và tình hình sử dụng ngân sách.</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 backdrop-blur-sm">
            <p className="text-xs font-medium text-blue-100">Dự án trong kết quả</p>
            <p className="mt-1 text-2xl font-bold">{loading ? "—" : total}</p>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div><h2 className="text-base font-bold text-slate-900">Lọc danh sách</h2><p className="mt-1 text-sm text-slate-500">Tìm nhanh theo tên, mã dự án hoặc trạng thái.</p></div>
          <form onSubmit={handleSearchSubmit} className="flex w-full gap-2 xl:max-w-xl">
            <input type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Tìm theo mã hoặc tên dự án..." className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            <button type="submit" className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">Tìm kiếm</button>
          </form>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {statusTabs.map((tab) => (
            <button key={tab.value} type="button" onClick={() => handleStatusChange(tab.value)} className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${statusFilter === tab.value ? "border-blue-600 bg-blue-600 text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="font-semibold text-slate-800">Không tìm thấy dự án phù hợp</p>
          <p className="mt-1 text-sm text-slate-500">Thử đổi trạng thái hoặc từ khóa tìm kiếm.</p>
        </div>
      ) : (
        <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-bold text-slate-900">Danh sách dự án</h2>
          <span className="text-sm text-slate-500">{projects.length} kết quả trên trang này</span>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const spentPercent = getSpentPercent(project);
            const budget = getProjectBudget(project);
            const remaining = getProjectRemaining(project);

            return (
              <button
                key={project.id}
                type="button"
                onClick={() => router.push(`/projects/${project.id}`)}
                className="group rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-900/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold tracking-wide text-blue-700">{project.projectCode}</p>
                    <p className="mt-1.5 truncate text-base font-bold text-slate-900 group-hover:text-blue-800">{project.name}</p>
                  </div>
                  <span
                    className={`shrink-0 inline-flex px-2.5 py-1 rounded-full border text-xs font-medium ${getStatusClass(project.status)}`}
                  >
                    {getStatusLabel(project.status)}
                  </span>
                </div>

                <div className="rounded-2xl bg-slate-50 px-3.5 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Giai đoạn hiện tại</p>
                  <p className="mt-1 truncate text-sm font-medium text-slate-800">{project.currentPhaseName || "Chưa xác định"}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-600">Ngân sách đã sử dụng</span>
                    <span className="font-bold text-slate-800">{spentPercent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full transition-all ${getBurnClass(spentPercent)}`}
                      style={{ width: `${spentPercent}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
                  <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                    <p className="text-[11px] text-slate-500">Hạn mức</p>
                    <p className="text-xs font-semibold text-slate-900 mt-0.5">{formatCurrency(budget)}</p>
                  </div>
                  <div className="rounded-xl bg-rose-50/70 px-3 py-2.5">
                    <p className="text-[11px] text-slate-500">Đã chi</p>
                    <p className="text-xs font-semibold text-rose-700 mt-0.5">{formatCurrency(getProjectSpent(project))}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50/70 px-3 py-2.5">
                    <p className="text-[11px] text-slate-500">Khả dụng</p>
                    <p className="text-xs font-semibold text-emerald-700 mt-0.5">{formatCurrency(remaining)}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        </section>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Tổng {total} dự án • Trang {page}/{totalPages}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Trước
          </button>
          <button
            type="button"
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Sau
          </button>
        </div>
      </div>

    </div>
  );
}
