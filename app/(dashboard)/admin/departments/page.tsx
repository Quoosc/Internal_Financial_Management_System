"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ApiError, api } from "@/lib/api-client";
import { useToast } from "@/contexts/toast-context";
import {
  AdminUserListItem,
  CreateDepartmentBody,
  DepartmentListItem,
  PaginatedResponse,
  UpdateDepartmentBody,
} from "@/types";
import { formatCurrency } from "@/lib/format";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { CurrencyInput } from "@/components/ui/currency-input";
import { SideDrawer } from "@/components/ui/side-drawer";
import { ExcelImportPanel } from "@/components/data-exchange/excel-import-panel";

const PAGE_LIMIT = 10;

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

function quotaUsagePercent(department: DepartmentListItem): number {
  if (!department.totalProjectQuota || department.totalProjectQuota <= 0) return 0;
  const used = Math.max(0, department.totalProjectQuota - department.totalAvailableBalance);
  return Math.min(100, Math.round((used / department.totalProjectQuota) * 100));
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function StatCard({
  label,
  value,
  helper,
  tone = "blue",
}: {
  label: string;
  value: string;
  helper: string;
  tone?: "blue" | "emerald" | "violet" | "amber";
}) {
  const toneClass = {
    blue: "from-blue-50 to-indigo-50 text-blue-700 border-blue-100",
    emerald: "from-emerald-50 to-teal-50 text-emerald-700 border-emerald-100",
    violet: "from-violet-50 to-fuchsia-50 text-violet-700 border-violet-100",
    amber: "from-amber-50 to-orange-50 text-amber-700 border-amber-100",
  }[tone];

  return (
    <div className={`rounded-2xl border bg-linear-to-br ${toneClass} p-4 shadow-sm`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-75">{label}</p>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{helper}</p>
    </div>
  );
}

export default function AdminDepartmentsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();

  const searchParamsString = searchParams.toString();
  const search = useMemo(() => searchParams.get("search") ?? "", [searchParams]);
  const page = useMemo(() => parsePage(searchParams.get("page")), [searchParams]);

  const [items, setItems] = useState<DepartmentListItem[]>([]);
  const [managers, setManagers] = useState<AdminUserListItem[]>([]);

  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(search);

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingDepartmentId, setEditingDepartmentId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState("");
  const [formNameError, setFormNameError] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formManagerId, setFormManagerId] = useState("");
  const [formQuota, setFormQuota] = useState<number | null>(null);
  const [formQuotaError, setFormQuotaError] = useState("");

  const metrics = useMemo(() => {
    const totalQuota = items.reduce((sum, item) => sum + (item.totalProjectQuota ?? 0), 0);
    const available = items.reduce((sum, item) => sum + (item.totalAvailableBalance ?? 0), 0);
    const employees = items.reduce((sum, item) => sum + (item.employeeCount ?? 0), 0);
    const assignedManagers = items.filter((item) => item.manager).length;
    const utilization = totalQuota > 0 ? Math.round(((totalQuota - available) / totalQuota) * 100) : 0;

    return {
      totalQuota,
      available,
      employees,
      assignedManagers,
      utilization: Math.max(0, Math.min(100, utilization)),
    };
  }, [items]);

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

    const loadManagers = async () => {
      try {
        const res = await api.get<PaginatedResponse<AdminUserListItem> | AdminUserListItem[]>(
          "/api/v1/admin/users?role=MANAGER&page=1&limit=100"
        );
        if (cancelled) return;
        setManagers(pickItems(res.data));
      } catch {
        if (cancelled) return;
        setManagers([]);
      }
    };

    void loadManagers();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDepartments = async () => {
      setLoading(true);

      try {
        const query = new URLSearchParams();
        if (search.trim()) query.set("search", search.trim());
        query.set("page", String(page));
        query.set("limit", String(PAGE_LIMIT));

        const res = await api.get<PaginatedResponse<DepartmentListItem> | DepartmentListItem[]>(
          `/api/v1/admin/departments?${query.toString()}`
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
        toast.error(err instanceof ApiError ? err.apiMessage : "Không thể tải danh sách phòng ban.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadDepartments();

    return () => {
      cancelled = true;
    };
  }, [page, search, toast]);

  const openCreateModal = () => {
    setIsEditing(false);
    setEditingDepartmentId(null);
    setFormName("");
    setFormNameError("");
    setFormCode("");
    setFormManagerId("");
    setFormQuota(null);
    setFormQuotaError("");
    setShowModal(true);
  };

  const openEditModal = (department: DepartmentListItem) => {
    setIsEditing(true);
    setEditingDepartmentId(department.id);
    setFormName(department.name);
    setFormNameError("");
    setFormCode(department.code);
    setFormManagerId(department.manager?.id ? String(department.manager.id) : "");
    setFormQuota(department.totalProjectQuota);
    setFormQuotaError("");
    setShowModal(true);
  };

  const handleSaveDepartment = async () => {
    const quotaNumber = formQuota ?? 0;
    const managerIdNumber = Number(formManagerId);

    if (!formName.trim()) {
      setFormNameError("Tên phòng ban là bắt buộc.");
      toast.error("Tên phòng ban là bắt buộc.");
      return;
    }

    if (formQuota !== null && quotaNumber < 0) {
      setFormQuotaError("Quota phải là số không âm.");
      toast.error("Quota phải là số không âm.");
      return;
    }

    setSaving(true);

    try {
      if (!isEditing) {
        const body: CreateDepartmentBody = {
          name: formName.trim(),
          code: formCode.trim() || undefined,
          managerId: Number.isFinite(managerIdNumber) && managerIdNumber > 0 ? managerIdNumber : undefined,
          totalProjectQuota: formQuota !== null ? quotaNumber : undefined,
        };

        const res = await api.post<DepartmentListItem>("/api/v1/admin/departments", body);
        setItems((prev) => [res.data, ...prev].slice(0, PAGE_LIMIT));
        setTotal((prev) => prev + 1);
        toast.success("Đã tạo phòng ban mới.");
      } else {
        if (!editingDepartmentId) return;

        const body: UpdateDepartmentBody = {
          name: formName.trim(),
          managerId: Number.isFinite(managerIdNumber) && managerIdNumber > 0 ? managerIdNumber : undefined,
          clearManager: !(Number.isFinite(managerIdNumber) && managerIdNumber > 0),
          totalProjectQuota: formQuota !== null ? quotaNumber : undefined,
        };

        const res = await api.put<DepartmentListItem>(`/api/v1/admin/departments/${editingDepartmentId}`, body);
        setItems((prev) => prev.map((item) => (item.id === editingDepartmentId ? res.data : item)));
        toast.success("Đã cập nhật phòng ban.");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.apiMessage : "Không thể lưu phòng ban. Vui lòng thử lại.");
    } finally {
      setSaving(false);
      setShowModal(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-cyan-600 text-white shadow-xl shadow-blue-900/15">
        <div className="relative px-6 py-7 sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.28),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(125,211,252,0.24),_transparent_34%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">Administration</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Quản lý phòng ban</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                Kiểm soát cơ cấu phòng ban, phân quyền trưởng phòng và theo dõi quota ngân sách trong một màn hình.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void updateParam("search", undefined)}
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/15"
              >
                Xóa bộ lọc
              </button>
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-blue-700 shadow-lg shadow-blue-950/20 hover:bg-blue-50"
              >
                + Tạo phòng ban
              </button>
            </div>
          </div>
        </div>
      </section>

      <details className="group">
        <summary className="cursor-pointer rounded-2xl border border-blue-200 bg-white px-5 py-3 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50">Nhập danh sách phòng ban từ Excel</summary>
        <div className="mt-3"><ExcelImportPanel datasetCode="departments" title="Nhập phòng ban" /></div>
      </details>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tổng phòng ban" value={String(total)} helper={`${items.length} đang hiển thị`} tone="blue" />
        <StatCard label="Tổng quota" value={formatCurrency(metrics.totalQuota)} helper="Tổng ngân sách phân bổ" tone="violet" />
        <StatCard label="Khả dụng" value={formatCurrency(metrics.available)} helper={`Đã dùng ${metrics.utilization}% quota`} tone="emerald" />
        <StatCard label="Nhân sự" value={String(metrics.employees)} helper={`${metrics.assignedManagers}/${items.length} có trưởng phòng`} tone="amber" />
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-950">Danh sách phòng ban</h2>
            <p className="mt-1 text-sm text-slate-500">Tra cứu nhanh theo mã, tên phòng ban hoặc trưởng phòng.</p>
          </div>

          <div className="relative w-full lg:max-w-md">
            <svg
              className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M21 21l-4.35-4.35m1.6-5.65a7.25 7.25 0 11-14.5 0 7.25 7.25 0 0114.5 0z"
              />
            </svg>
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Tìm kiếm phòng ban..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="divide-y divide-slate-100">
            {[...Array(6)].map((_, index) => (
              <div key={`department-skeleton-${index}`} className="grid grid-cols-12 gap-4 px-5 py-5">
                <div className="col-span-5 h-12 animate-pulse rounded-2xl bg-slate-100" />
                <div className="col-span-2 h-12 animate-pulse rounded-2xl bg-slate-100" />
                <div className="col-span-3 h-12 animate-pulse rounded-2xl bg-slate-100" />
                <div className="col-span-2 h-12 animate-pulse rounded-2xl bg-slate-100" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9h.01M9 13h.01M9 17h.01M13 9h.01M13 13h.01M13 17h.01" />
              </svg>
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-950">Không có phòng ban phù hợp</h3>
            <p className="mt-1 text-sm text-slate-500">Thử thay đổi từ khóa tìm kiếm hoặc tạo phòng ban mới.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur">
                <tr className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  <th className="px-5 py-4">Phòng ban</th>
                  <th className="px-5 py-4">Trưởng phòng</th>
                  <th className="px-5 py-4">Nhân sự</th>
                  <th className="px-5 py-4">Quota sử dụng</th>
                  <th className="px-5 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((department) => {
                  const usage = quotaUsagePercent(department);
                  const usedAmount = Math.max(0, department.totalProjectQuota - department.totalAvailableBalance);

                  return (
                    <tr key={department.id} className="group transition hover:bg-slate-50/80">
                      <td className="px-5 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold text-white shadow-sm">
                            {initials(department.code || department.name)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-950">{department.name}</p>
                            <p className="mt-1 font-mono text-xs text-slate-500">{department.code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-5">
                        {department.manager ? (
                          <div>
                            <p className="text-sm font-medium text-slate-900">{department.manager.fullName}</p>
                            <p className="mt-1 text-xs text-emerald-600">Đã phân quyền quản lý</p>
                          </div>
                        ) : (
                          <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                            Chưa gán
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-5">
                        <p className="text-sm font-semibold text-slate-950">{department.employeeCount}</p>
                        <p className="mt-1 text-xs text-slate-500">nhân sự</p>
                      </td>
                      <td className="px-5 py-5">
                        <div className="min-w-56 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700">{usage}% sử dụng</span>
                            <span className="text-slate-500">{formatCurrency(department.totalAvailableBalance)} còn lại</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${usage >= 85 ? "bg-rose-500" : usage >= 65 ? "bg-amber-500" : "bg-emerald-500"}`}
                              style={{ width: `${usage}%` }}
                            />
                          </div>
                          <p className="text-xs text-slate-500">
                            Đã dùng {formatCurrency(usedAmount)} / {formatCurrency(department.totalProjectQuota)}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-5 text-right">
                        <KebabMenu
                          items={[
                            {
                              label: "Xem chi tiết",
                              onClick: () => router.push(`/admin/departments/${department.id}`),
                            },
                            {
                              label: "Chỉnh sửa",
                              onClick: () => openEditModal(department),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Trang <span className="font-semibold text-slate-900">{page}</span>/{totalPages} · Tổng{" "}
          <span className="font-semibold text-slate-900">{total}</span> phòng ban
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Trước
          </button>
          <button
            type="button"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sau
          </button>
        </div>
      </div>

      <SideDrawer
        open={showModal}
        onClose={() => setShowModal(false)}
        title={isEditing ? "Cập nhật phòng ban" : "Tạo phòng ban mới"}
        description="Quản lý thông tin, trưởng phòng và quota ngân sách."
        widthClassName="max-w-2xl"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSaveDepartment}
              disabled={saving}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-slate-950/15 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Đang lưu..." : isEditing ? "Lưu cập nhật" : "Tạo phòng ban"}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">{isEditing ? "Chỉnh sửa cấu hình phòng ban" : "Thiết lập phòng ban mới"}</p>
            <p className="mt-1 text-sm text-blue-700">
              Quota sẽ được dùng làm giới hạn ngân sách dự án thuộc phòng ban này.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Tên phòng ban <span className="text-rose-500">*</span>
              </label>
              <input
                value={formName}
                onChange={(event) => {
                  setFormName(event.target.value);
                  if (formNameError) setFormNameError("");
                }}
                onBlur={() => {
                  if (!formName.trim()) setFormNameError("Tên phòng ban là bắt buộc.");
                }}
                placeholder="Ví dụ: Phòng Công nghệ thông tin"
                className={`w-full rounded-2xl border bg-white px-4 py-3 text-slate-900 outline-none transition focus:ring-4 focus:ring-blue-500/10 ${
                  formNameError ? "border-rose-300" : "border-slate-200 focus:border-blue-300"
                }`}
              />
              {formNameError && <p className="mt-1 text-xs text-rose-600">{formNameError}</p>}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Mã phòng ban</label>
              <input
                value={formCode}
                disabled={isEditing}
                onChange={(event) => setFormCode(event.target.value.toUpperCase())}
                placeholder="IT, FIN, OPS..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Trưởng phòng</label>
              <select
                value={formManagerId}
                onChange={(event) => setFormManagerId(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10"
              >
                <option value="">Chưa gán trưởng phòng</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={String(manager.id)}>
                    {manager.fullName} ({manager.employeeCode ?? manager.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-700">Tổng quota</label>
              <CurrencyInput
                value={formQuota}
                onChange={(value) => {
                  setFormQuota(value);
                  if (formQuotaError) setFormQuotaError("");
                }}
                error={formQuotaError}
                placeholder="0"
              />
            </div>
          </div>
        </div>
      </SideDrawer>
    </div>
  );
}
