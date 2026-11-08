"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ApiError, api } from "@/lib/api-client";
import { useToast } from "@/contexts/toast-context";
import {
  AdminUserFilterParams,
  AdminUserListItem,
  CreateUserBody,
  CreateUserResponse,
  DepartmentListItem,
  LockUserResponse,
  PaginatedResponse,
  RoleName,
  UnlockUserResponse,
  UserStatus,
} from "@/types";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { TableRowSkeleton } from "@/components/ui/skeleton";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { SideDrawer } from "@/components/ui/side-drawer";
import { ExcelImportPanel } from "@/components/data-exchange/excel-import-panel";

const PAGE_LIMIT = 10;

const ROLE_OPTIONS: { value: RoleName; label: string; roleId: number }[] = [
  { value: RoleName.EMPLOYEE, label: "Nhân viên", roleId: 1 },
  { value: RoleName.TEAM_LEADER, label: "Trưởng nhóm", roleId: 2 },
  { value: RoleName.MANAGER, label: "Manager", roleId: 3 },
  { value: RoleName.ACCOUNTANT, label: "Kế toán", roleId: 4 },
  { value: RoleName.CFO, label: "CFO", roleId: 5 },
  { value: RoleName.ADMIN, label: "Admin", roleId: 6 },
];

function parsePage(value: string | null): number {
  const page = Number(value ?? "1");
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function pickItems<T>(payload: PaginatedResponse<T> | T[]): T[] {
  return Array.isArray(payload) ? payload : payload.items;
}

function getTotal<T>(payload: PaginatedResponse<T> | T[]): number {
  return Array.isArray(payload) ? payload.length : payload.total;
}

function roleLabel(role: string): string {
  const match = ROLE_OPTIONS.find((item) => item.value === role);
  return match?.label ?? role;
}

function roleBadgeClass(role: string): string {
  switch (role) {
    case RoleName.ADMIN:
      return "bg-rose-100 border-rose-200 text-rose-700";
    case RoleName.CFO:
      return "bg-violet-100 border-violet-200 text-violet-700";
    case RoleName.ACCOUNTANT:
      return "bg-amber-100 border-amber-200 text-amber-700";
    case RoleName.MANAGER:
      return "bg-blue-100 border-blue-200 text-blue-700";
    case RoleName.TEAM_LEADER:
      return "bg-indigo-100 border-indigo-200 text-indigo-700";
    default:
      return "bg-slate-100 border-slate-200 text-slate-600";
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case UserStatus.ACTIVE:
      return "bg-emerald-100 border-emerald-200 text-emerald-700";
    case UserStatus.LOCKED:
      return "bg-rose-100 border-rose-200 text-rose-700";
    case UserStatus.PENDING:
      return "bg-amber-100 border-amber-200 text-amber-700";
    default:
      return "bg-slate-100 border-slate-200 text-slate-600";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case UserStatus.ACTIVE:
      return "Đang hoạt động";
    case UserStatus.LOCKED:
      return "Đã khóa";
    case UserStatus.PENDING:
      return "Chờ kích hoạt";
    default:
      return status;
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "U";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

export default function AdminUsersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();

  const searchParamsString = searchParams.toString();
  const roleFilter = useMemo(() => searchParams.get("role") ?? "", [searchParams]);
  const statusFilter = useMemo(() => searchParams.get("status") ?? "", [searchParams]);
  const search = useMemo(() => searchParams.get("search") ?? "", [searchParams]);
  const page = useMemo(() => parsePage(searchParams.get("page")), [searchParams]);

  const [items, setItems] = useState<AdminUserListItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentListItem[]>([]);
  const [sortBy, setSortBy] = useState<"fullName" | "role" | "status" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(search);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<RoleName>(RoleName.EMPLOYEE);
  const [newDepartmentId, setNewDepartmentId] = useState("");

  const [processingUserId, setProcessingUserId] = useState<number | null>(null);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    message: string;
    onConfirm: () => void;
  }>({ open: false, message: "", onConfirm: () => {} });

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const pushWithParams = useCallback(
    (params: URLSearchParams) => {
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router]
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
    [pushWithParams, searchParamsString]
  );

  const goToPage = useCallback(
    (nextPage: number) => {
      const params = new URLSearchParams(searchParamsString);
      if (nextPage <= 1) params.delete("page");
      else params.set("page", String(nextPage));
      pushWithParams(params);
    },
    [pushWithParams, searchParamsString]
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

    const loadDepartments = async () => {
      try {
        const res = await api.get<PaginatedResponse<DepartmentListItem> | DepartmentListItem[]>(
          "/api/v1/admin/departments?page=1&limit=100"
        );
        if (cancelled) return;
        setDepartments(pickItems(res.data));
      } catch {
        if (cancelled) return;
        setDepartments([]);
      }
    };

    void loadDepartments();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadUsers = async () => {
      setLoading(true);

      try {
        const filters: AdminUserFilterParams = {
          role: roleFilter || undefined,
          status: statusFilter || undefined,
          search: search.trim() || undefined,
          page,
          limit: PAGE_LIMIT,
        };

        const query = new URLSearchParams();
        if (filters.role) query.set("role", filters.role);
        if (filters.status) query.set("status", filters.status);
        if (filters.search) query.set("search", filters.search);
        query.set("page", String(filters.page ?? 1));
        query.set("limit", String(filters.limit ?? PAGE_LIMIT));

        const res = await api.get<PaginatedResponse<AdminUserListItem> | AdminUserListItem[]>(
          `/api/v1/admin/users?${query.toString()}`
        );

        if (cancelled) return;

        setItems(pickItems(res.data));
        setTotal(getTotal(res.data));
        setTotalPages(Array.isArray(res.data) ? Math.max(1, Math.ceil(getTotal(res.data) / PAGE_LIMIT)) : res.data.totalPages);
      } catch (err) {
        if (cancelled) return;
        setItems([]);
        setTotal(0);
        setTotalPages(1);
        toast.error(err instanceof ApiError ? err.apiMessage : "Không thể tải danh sách người dùng.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, [page, roleFilter, search, statusFilter, toast]);

  const handleCreateUser = async () => {
    const selectedRole = ROLE_OPTIONS.find((option) => option.value === newRole);
    if (!selectedRole) {
      toast.error("Không xác định được role hợp lệ.");
      return;
    }

    if (!newFullName.trim()) {
      toast.error("Họ tên là bắt buộc.");
      return;
    }

    if (!newEmail.trim() || !newEmail.includes("@")) {
      toast.error("Email không hợp lệ.");
      return;
    }

    setCreating(true);

    const departmentIdNumber = Number(newDepartmentId);

    const body: CreateUserBody = {
      fullName: newFullName.trim(),
      email: newEmail.trim(),
      roleId: selectedRole.roleId,
      departmentId: Number.isFinite(departmentIdNumber) && departmentIdNumber > 0 ? departmentIdNumber : undefined,
    };

    try {
      const res = await api.post<CreateUserResponse>("/api/v1/admin/users", body);

      const createdItem: AdminUserListItem = {
        id: res.data.id,
        fullName: res.data.fullName,
        email: res.data.email,
        employeeCode: null,
        role: res.data.role,
        departmentId: res.data.departmentId,
        departmentName: res.data.departmentName,
        jobTitle: null,
        avatar: null,
        debtBalance: 0,
        status: res.data.status,
        createdAt: res.data.createdAt,
      };

      setItems((prev) => [createdItem, ...prev].slice(0, PAGE_LIMIT));
      setTotal((prev) => prev + 1);
      toast.success("Đã tạo user mới và gửi email onboarding.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.apiMessage : "Không thể tạo người dùng. Vui lòng thử lại.");
    } finally {
      setCreating(false);
      setShowCreateModal(false);
      setNewFullName("");
      setNewEmail("");
      setNewRole(RoleName.EMPLOYEE);
      setNewDepartmentId("");
    }
  };

  const handleToggleLock = (user: AdminUserListItem) => {
    const isLocked = user.status === UserStatus.LOCKED;
    setConfirmState({
      open: true,
      message: isLocked ? `Mở khóa tài khoản ${user.fullName}?` : `Khóa tài khoản ${user.fullName}?`,
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, open: false }));
        setProcessingUserId(user.id);
        try {
          if (isLocked) {
            const res = await api.post<UnlockUserResponse>(`/api/v1/admin/users/${user.id}/unlock`);
            setItems((prev) => prev.map((item) => (item.id === user.id ? { ...item, status: res.data.status } : item)));
            toast.success(`Đã mở khóa ${user.fullName}.`);
          } else {
            const res = await api.post<LockUserResponse>(`/api/v1/admin/users/${user.id}/lock`);
            setItems((prev) => prev.map((item) => (item.id === user.id ? { ...item, status: res.data.status } : item)));
            toast.success(`Đã khóa ${user.fullName}.`);
          }
        } catch (err) {
          toast.error(err instanceof ApiError ? err.apiMessage : "Không thể thực hiện thao tác. Vui lòng thử lại.");
        } finally {
          setProcessingUserId(null);
        }
      },
    });
  };

  const handleResetPassword = (user: AdminUserListItem) => {
    setConfirmState({
      open: true,
      message: `Reset mật khẩu tạm cho ${user.fullName}?`,
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, open: false }));
        setProcessingUserId(user.id);
        try {
          await api.post<{ message: string }>(`/api/v1/admin/users/${user.id}/reset-password`);
          toast.success(`Đã reset mật khẩu và gửi email cho ${user.email}.`);
        } catch (err) {
          toast.error(err instanceof ApiError ? err.apiMessage : "Không thể reset mật khẩu. Vui lòng thử lại.");
        } finally {
          setProcessingUserId(null);
        }
      },
    });
  };

  const activeOnPage = items.filter((user) => user.status === UserStatus.ACTIVE).length;
  const lockedOnPage = items.filter((user) => user.status === UserStatus.LOCKED).length;
  const filtered = Boolean(roleFilter || statusFilter || search);

  const sortedItems = useMemo(() => {
    if (!sortBy) return items;
    return [...items].sort((a, b) => {
      const av = a[sortBy] ?? "";
      const bv = b[sortBy] ?? "";
      const cmp = String(av).localeCompare(String(bv), "vi");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, sortBy, sortDir]);

  const handleSort = (col: "fullName" | "role" | "status") => {
    if (sortBy === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: "fullName" | "role" | "status" }) => (
    <span className="ml-1 inline-flex opacity-50">
      {sortBy === col ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-indigo-700 p-6 text-white shadow-xl shadow-blue-900/10">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-50">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Admin workspace
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Quản lý nhân sự</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
              Theo dõi tài khoản, phân quyền truy cập và trạng thái vận hành của toàn bộ nhân sự trong hệ thống IFMS.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-lg shadow-blue-950/10 transition hover:bg-blue-50"
          >
            Tạo người dùng
          </button>
        </div>
      </section>

      <details className="group">
        <summary className="cursor-pointer rounded-2xl border border-blue-200 bg-white px-5 py-3 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50">Nhập danh sách nhân sự từ Excel</summary>
        <div className="mt-3"><ExcelImportPanel datasetCode="employees" title="Nhập nhân sự" /></div>
      </details>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard label="Tổng người dùng" value={total.toLocaleString("vi-VN")} tone="blue" />
        <MetricCard label="Đang hoạt động" value={String(activeOnPage)} tone="emerald" />
        <MetricCard label="Đã khóa" value={String(lockedOnPage)} tone="rose" />
        <MetricCard label="Bộ lọc" value={filtered ? "Đang áp dụng" : "Tất cả"} tone="indigo" />
      </section>

      <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Bộ lọc nhân sự</h2>
            <p className="mt-1 text-sm text-slate-500">Lọc nhanh theo vai trò, trạng thái hoặc thông tin định danh.</p>
          </div>
          {filtered && (
            <button
              type="button"
              onClick={() => pushWithParams(new URLSearchParams())}
              className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <select
            value={roleFilter}
            onChange={(event) => updateParam("role", event.target.value || undefined)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">Tất cả vai trò</option>
            {ROLE_OPTIONS.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => updateParam("status", event.target.value || undefined)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">Tất cả trạng thái</option>
            <option value={UserStatus.ACTIVE}>Đang hoạt động</option>
            <option value={UserStatus.LOCKED}>Đã khóa</option>
            <option value={UserStatus.PENDING}>Chờ kích hoạt</option>
          </select>

          <div className="relative md:col-span-2">
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
              placeholder="Tìm theo tên, email, mã nhân viên..."
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-1 border-b border-slate-200 bg-blue-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Danh sách người dùng</h2>
            <p className="text-sm text-slate-500">Mỗi dòng có menu thao tác nhanh ở cột cuối.</p>
          </div>
          <span className="text-sm font-medium text-blue-700">Trang {page}/{totalPages}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-200 bg-white">
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer select-none hover:text-slate-600" onClick={() => handleSort("fullName")}>Nhân sự<SortIcon col="fullName" /></th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Mã NV</th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer select-none hover:text-slate-600" onClick={() => handleSort("role")}>Vai trò<SortIcon col="role" /></th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Phòng ban</th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer select-none hover:text-slate-600" onClick={() => handleSort("status")}>Trạng thái<SortIcon col="status" /></th>
                <th className="px-5 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableRowSkeleton colSpan={6} rows={6} />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center text-sm text-slate-500">
                    Không có người dùng phù hợp bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                sortedItems.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100 last:border-b-0 transition hover:bg-blue-50/40">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-sm font-bold text-blue-700">
                          {initials(user.fullName)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{user.fullName}</p>
                          <p className="mt-1 text-xs text-slate-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-slate-600">{user.employeeCode ?? "Chưa gán"}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${roleBadgeClass(user.role)}`}>
                        {roleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{user.departmentName ?? "Chưa gán"}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(user.status)}`}>
                        {statusLabel(user.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {processingUserId === user.id ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 px-2">
                          <svg className="animate-spin h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                          Đang xử lý...
                        </span>
                      ) : (
                        <KebabMenu
                          items={[
                            {
                              label: "Xem chi tiết",
                              onClick: () => router.push(`/admin/users/${user.id}`),
                            },
                            {
                              label: user.status === UserStatus.LOCKED ? "Mở khóa" : "Khóa tài khoản",
                              onClick: () => handleToggleLock(user),
                              tone: user.status === UserStatus.LOCKED ? "default" : "danger",
                            },
                            {
                              label: "Reset mật khẩu",
                              onClick: () => handleResetPassword(user),
                              tone: "warning",
                            },
                          ]}
                        />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Hiển thị {items.length} trong tổng {total.toLocaleString("vi-VN")} người dùng
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
        title="Tạo người dùng mới"
        description="Hệ thống sẽ tạo mật khẩu tạm và gửi email onboarding cho người dùng."
        onClose={() => setShowCreateModal(false)}
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
              onClick={handleCreateUser}
              disabled={creating}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? "Đang tạo..." : "Tạo user"}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-800">
            Tài khoản mới cần email công ty hợp lệ. Phòng ban có thể để trống nếu nhân sự chưa được phân công.
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Họ tên</label>
            <input
              value={newFullName}
              onChange={(event) => setNewFullName(event.target.value)}
              placeholder="Nhập họ tên"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Email công ty</label>
            <input
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              placeholder="name@ifms.vn"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Vai trò</label>
              <select
                value={newRole}
                onChange={(event) => setNewRole(event.target.value as RoleName)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Phòng ban</label>
              <select
                value={newDepartmentId}
                onChange={(event) => setNewDepartmentId(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">Không gán phòng ban</option>
                {departments.map((department) => (
                  <option key={department.id} value={String(department.id)}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
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
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "emerald" | "rose" | "indigo";
}) {
  const toneClassName = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
  }[tone];

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`mb-4 h-2 w-12 rounded-full border ${toneClassName}`} />
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
