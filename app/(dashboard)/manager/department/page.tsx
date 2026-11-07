"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ApiError, api } from "@/lib/api-client";
import { useToast } from "@/contexts/toast-context";
import {
  ManagerDashboardResponse,
  ManagerDeptMemberDetailResponse,
  ManagerDeptMemberFilterParams,
  ManagerDeptMemberListItem,
  PaginatedResponse,
} from "@/types";
import { formatCurrency } from "@/lib/format";
import { SideDrawer } from "@/components/ui/side-drawer";

const PAGE_LIMIT = 12;
type MemberRole = "TEAM_LEADER" | "EMPLOYEE";

type ManagerMemberView = ManagerDeptMemberListItem & {
  role: MemberRole;
};


function parsePage(value: string | null): number {
  const page = Number(value ?? "1");
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function parseRole(value: string | null): MemberRole | undefined {
  if (value === "TEAM_LEADER" || value === "EMPLOYEE") return value;
  return undefined;
}

function inferRole(member: ManagerDeptMemberListItem): MemberRole {
  const role = member.role?.toUpperCase();
  if (role === "TEAM_LEADER" || role === "TEAMLEADER") {
    return "TEAM_LEADER";
  }
  if (role === "EMPLOYEE") {
    return "EMPLOYEE";
  }

  const jobTitle = member.jobTitle?.toLowerCase() ?? "";
  return jobTitle.includes("team leader") || jobTitle.includes("technical lead")
    ? "TEAM_LEADER"
    : "EMPLOYEE";
}

function normalizeMember(member: ManagerDeptMemberListItem): ManagerMemberView {
  return {
    ...member,
    role: inferRole(member),
  };
}


function roleBadgeClass(role: MemberRole): string {
  return role === "TEAM_LEADER"
    ? "bg-indigo-100 border-indigo-200 text-indigo-700"
    : "bg-slate-100 border-slate-200 text-slate-600";
}

function statusBadgeClass(status: string): string {
  if (status === "ACTIVE")
    return "bg-emerald-100 border-emerald-200 text-emerald-700";
  if (status === "LOCKED") return "bg-rose-100 border-rose-200 text-rose-700";
  return "bg-slate-100 border-slate-200 text-slate-600";
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
  tone: "blue" | "indigo" | "rose" | "cyan";
}) {
  const toneClassName = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
    cyan: "bg-cyan-50 text-cyan-700 border-cyan-100",
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

function InfoTile({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "rose" | "emerald";
}) {
  const valueClassName = {
    slate: "text-slate-900",
    rose: "text-rose-700",
    emerald: "text-emerald-700",
  }[tone];

  return (
    <div className="rounded-2xl border border-white/80 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className={`mt-2 text-sm font-bold ${valueClassName}`}>{value}</p>
    </div>
  );
}

export default function ManagerDepartmentPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();

  const searchParamsString = searchParams.toString();
  const search = useMemo(
    () => searchParams.get("search") ?? "",
    [searchParams],
  );
  const roleFilter = useMemo(
    () => parseRole(searchParams.get("role")),
    [searchParams],
  );
  const page = useMemo(
    () => parsePage(searchParams.get("page")),
    [searchParams],
  );

  const [deptDashboard, setDeptDashboard] =
    useState<ManagerDashboardResponse | null>(null);

  const [members, setMembers] = useState<ManagerMemberView[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(search);

  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedMember, setSelectedMember] =
    useState<ManagerDeptMemberDetailResponse | null>(null);

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

    const loadDeptBudget = async () => {
      try {
        const res = await api.get<ManagerDashboardResponse>(
          "/api/v1/dashboard/manager",
        );
        if (cancelled) return;
        setDeptDashboard(res.data);
      } catch (err) {
        if (cancelled) return;
        setDeptDashboard(null);
        if (err instanceof ApiError) {
          toast.error(err.apiMessage);
        } else {
          toast.error("Không thể tải số liệu ngân sách phòng ban.");
        }
      }
    };

    void loadDeptBudget();

    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    let cancelled = false;

    const loadMembers = async () => {
      setLoading(true);

      try {
        const filters: ManagerDeptMemberFilterParams = {
          search: search.trim() || undefined,
          page,
          limit: PAGE_LIMIT,
        };

        const query = new URLSearchParams();
        if (filters.search) query.set("search", filters.search);
        if (roleFilter) query.set("role", roleFilter);
        query.set("page", String(filters.page ?? 1));
        query.set("limit", String(filters.limit ?? PAGE_LIMIT));

        const res = await api.get<
          | PaginatedResponse<ManagerDeptMemberListItem>
          | ManagerDeptMemberListItem[]
        >(`/api/v1/manager/department/members?${query.toString()}`);

        if (cancelled) return;

        const normalized = (
          Array.isArray(res.data) ? res.data : res.data.items
        ).map(normalizeMember);
        const filtered = roleFilter
          ? normalized.filter((item) => item.role === roleFilter)
          : normalized;

        const apiTotal = Array.isArray(res.data)
          ? filtered.length
          : res.data.total;
        const apiTotalPages = Array.isArray(res.data)
          ? Math.max(1, Math.ceil(apiTotal / PAGE_LIMIT))
          : res.data.totalPages;

        setMembers(filtered);
        setTotal(apiTotal);
        setTotalPages(apiTotalPages);
      } catch (err) {
        if (cancelled) return;
        setMembers([]);
        setTotal(0);
        setTotalPages(1);
        if (err instanceof ApiError) {
          toast.error(err.apiMessage);
        } else {
          toast.error("Không thể tải danh sách thành viên.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadMembers();

    return () => {
      cancelled = true;
    };
  }, [goToPage, page, roleFilter, search, toast]);

  const roleTabs: { label: string; value?: MemberRole }[] = [
    { label: "Tất cả" },
    { label: "Trưởng nhóm", value: "TEAM_LEADER" },
    { label: "Nhân viên", value: "EMPLOYEE" },
  ];

  const loadMemberDetail = async (memberId: number) => {
    setShowDetail(true);
    setDetailLoading(true);

    try {
      const res = await api.get<ManagerDeptMemberDetailResponse>(
        `/api/v1/manager/department/members/${memberId}`,
      );
      setSelectedMember(res.data);
    } catch (err) {
      setSelectedMember(null);
      toast.error(err instanceof ApiError ? err.apiMessage : "Không thể tải thông tin thành viên.");
    } finally {
      setDetailLoading(false);
    }
  };

  const totalQuota = deptDashboard?.departmentBudget.totalProjectQuota ?? 0;
  const availableBudget =
    deptDashboard?.departmentBudget.totalAvailableBalance ?? 0;
  const availablePercent =
    totalQuota > 0 ? Math.round((availableBudget / totalQuota) * 100) : 0;
  const filtered = Boolean(search || roleFilter);
  const debtMembers = members.filter((member) => member.debtBalance > 0).length;
  const pendingRequests = members.reduce((sum, member) => sum + member.pendingRequestsCount, 0);
  const teamLeaderCount = members.filter((member) => member.role === "TEAM_LEADER").length;
  const currentDepartment = deptDashboard?.department;
  const currentDepartmentLabel = currentDepartment
    ? `${currentDepartment.name}${currentDepartment.code ? ` (${currentDepartment.code})` : ""}`
    : "Phòng ban đang quản lý";

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-indigo-200 bg-linear-to-br from-indigo-700 via-blue-600 to-cyan-600 text-white shadow-xl shadow-indigo-900/15">
        <div className="relative px-6 py-7 sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.28),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(103,232,249,0.22),_transparent_34%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-100">Department workspace</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Phòng ban của tôi</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100">
                Theo dõi ngân sách phòng ban, thành viên, dư nợ và yêu cầu đang chờ xử lý.
              </p>
              <div className="mt-4 inline-flex w-fit items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-cyan-200" />
                Đang xem: {currentDepartmentLabel}
              </div>
            </div>

            <div className="inline-flex w-fit items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              {total.toLocaleString("vi-VN")} thành viên
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Số dư ví PB" value={formatCurrency(availableBudget)} helper="Có thể dùng để cấp vốn dự án" tone="blue" />
        <MetricCard label="Thành viên" value={total.toLocaleString("vi-VN")} helper="Nhân sự trong phòng" tone="indigo" />
        <MetricCard label="Có dư nợ" value={String(debtMembers)} helper="Thành viên cần theo dõi" tone="rose" />
        <MetricCard label="Chờ xử lý" value={String(pendingRequests)} helper={`${teamLeaderCount} Trưởng nhóm trên trang`} tone="cyan" />
      </section>

      <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-700">Tỷ lệ khả dụng ví phòng ban</span>
            <span className="font-medium text-blue-700">{availablePercent}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, availablePercent)}%` }} />
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Bộ lọc thành viên</h2>
            <p className="mt-1 text-sm text-slate-500">Tra cứu theo vai trò, tên, mã nhân viên hoặc email.</p>
          </div>
          {filtered && (
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams(searchParamsString);
                params.delete("role");
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
          {roleTabs.map((tab) => {
            const active =
              roleFilter === tab.value || (!roleFilter && !tab.value);
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => updateParam("role", tab.value)}
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
            placeholder="Tìm theo tên, mã nhân viên, email..."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
          />
        </div>
      </section>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, index) => (
            <div
              key={`manager-members-skeleton-${index}`}
              className="h-48 animate-pulse rounded-3xl bg-white"
            />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20h10M12 7a3 3 0 110 6 3 3 0 010-6z" />
            </svg>
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">Không có thành viên phù hợp</h3>
          <p className="mt-1 text-sm text-slate-500">Thử thay đổi từ khóa hoặc bộ lọc vai trò.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {members.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => loadMemberDetail(member.id)}
              className="rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-900/10"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-950">
                    {member.fullName}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {member.jobTitle ?? "—"} • {member.employeeCode}
                  </p>
                </div>

                <span
                  className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${roleBadgeClass(member.role)}`}
                >
                  {member.role === "TEAM_LEADER" ? "Trưởng nhóm" : "Nhân viên"}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(member.status)}`}
                >
                  {member.status}
                </span>

                {member.debtBalance > 0 && (
                  <span className="inline-flex rounded-full border border-rose-200 bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                    Dư nợ {formatCurrency(member.debtBalance)}
                  </span>
                )}
              </div>

              <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
                {member.projectsCount} dự án • {member.pendingRequestsCount} yêu
                cầu chờ xử lý
              </p>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Hiển thị <span className="font-semibold text-slate-900">{members.length}</span> trong tổng{" "}
          <span className="font-semibold text-slate-900">{total.toLocaleString("vi-VN")}</span> thành viên
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
        open={showDetail}
        onClose={() => setShowDetail(false)}
        title={selectedMember?.fullName ?? "Chi tiết thành viên"}
        description={selectedMember ? `${selectedMember.employeeCode} • ${selectedMember.jobTitle ?? "Chưa cập nhật chức danh"}` : "Đang tải hồ sơ thành viên."}
        widthClassName="max-w-2xl"
      >
        {detailLoading || !selectedMember ? (
          <div className="space-y-4">
            <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-3xl border border-blue-100 bg-blue-50/70 p-4">
              <p className="font-bold text-slate-950">{selectedMember.fullName}</p>
              <p className="mt-1 text-sm text-slate-600">{selectedMember.email}</p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoTile label="Điện thoại" value={selectedMember.phoneNumber ?? "Chưa cập nhật"} />
                <InfoTile
                  label="Dư nợ"
                  value={formatCurrency(selectedMember.debtBalance)}
                  tone={selectedMember.debtBalance > 0 ? "rose" : "emerald"}
                />
                <InfoTile label="Yêu cầu chờ" value={String(selectedMember.pendingRequestsCount)} />
                <InfoTile label="Trạng thái" value={selectedMember.status} />
              </div>
            </div>

            <section className="space-y-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Dự án tham gia</h4>
                <p className="mt-1 text-sm text-slate-500">Vai trò và vị trí của thành viên trong từng dự án.</p>
              </div>
              {selectedMember.assignedProjects.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                  Chưa có dữ liệu dự án.
                </div>
              ) : (
                selectedMember.assignedProjects.map((project) => (
                  <div
                    key={`${project.projectId}-${project.projectRole}`}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {project.projectCode} • {project.projectName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {project.projectRole} • {project.position}
                    </p>
                  </div>
                ))
              )}
            </section>
          </div>
        )}
      </SideDrawer>
    </div>
  );
}
