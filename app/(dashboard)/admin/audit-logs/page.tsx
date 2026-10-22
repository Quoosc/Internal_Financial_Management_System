"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ApiError, api, downloadFile } from "@/lib/api-client";
import { useToast } from "@/contexts/toast-context";
import {
  AuditAction,
  AuditLogFilterParams,
  AuditLogResponse,
  PaginatedResponse,
} from "@/types";
import { formatDateTime } from "@/lib/format";
import { TableRowSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/loading-skeleton";
import { DiffViewer } from "@/components/ui/diff-viewer";

const PAGE_LIMIT = 20;

type AuditTone = "security" | "access" | "finance" | "configuration" | "data" | "neutral";

// Backend sends generic CRUD actions (INSERT / UPDATE / DELETE), not semantic ones.
// This map translates (action + entityName) → Vietnamese business label.
const ENTITY_ACTION_LABEL: Record<string, Record<string, string>> = {
  INSERT: {
    User: "Tạo người dùng", Department: "Tạo phòng ban", Project: "Tạo dự án",
    Request: "Tạo yêu cầu", Notification: "Tạo thông báo", LedgerEntry: "Ghi sổ cái",
    Transaction: "Giao dịch mới", SystemConfig: "Thêm cấu hình", DepositLog: "Ghi nạp tiền",
  },
  UPDATE: {
    User: "Cập nhật người dùng", Department: "Cập nhật phòng ban", Project: "Cập nhật dự án",
    Request: "Cập nhật yêu cầu", Wallet: "Cập nhật ví", SystemConfig: "Cập nhật cấu hình",
    PhaseCategoryBudget: "Cập nhật ngân sách hạng mục", AdvanceBalance: "Cập nhật tạm ứng",
    UserProfile: "Cập nhật hồ sơ", RequestHistory: "Ghi lịch sử yêu cầu",
  },
  DELETE: {
    User: "Xóa người dùng", Department: "Xóa phòng ban", Project: "Xóa dự án",
    Request: "Xóa yêu cầu",
  },
};

const BACKEND_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "INSERT", label: "Thêm mới (INSERT)" },
  { value: "UPDATE", label: "Cập nhật (UPDATE)" },
  { value: "DELETE", label: "Xóa (DELETE)" },
];

function derivedActionMeta(
  action: string,
  entityName: string
): { label: string; description: string; tone: AuditTone } {
  const entityMap = ENTITY_ACTION_LABEL[action];
  const label = entityMap?.[entityName] ?? humanizeToken(`${action} ${entityName}`);
  const tone: AuditTone =
    action === "DELETE" ? "security" :
    action === "INSERT" ? "access" :
    "neutral";
  return { label, description: label, tone };
}

const ACTION_META: Record<AuditAction, { label: string; description: string; tone: AuditTone }> = {
  [AuditAction.USER_CREATED]: {
    label: "Tạo người dùng",
    description: "Tài khoản mới được khởi tạo trong hệ thống.",
    tone: "access",
  },
  [AuditAction.USER_UPDATED]: {
    label: "Cập nhật người dùng",
    description: "Thông tin hồ sơ hoặc phân quyền người dùng đã thay đổi.",
    tone: "access",
  },
  [AuditAction.USER_LOCKED]: {
    label: "Khóa tài khoản",
    description: "Tài khoản bị khóa để kiểm soát truy cập.",
    tone: "security",
  },
  [AuditAction.USER_UNLOCKED]: {
    label: "Mở khóa tài khoản",
    description: "Tài khoản được khôi phục quyền truy cập.",
    tone: "access",
  },
  [AuditAction.BANK_INFO_UPDATED]: {
    label: "Cập nhật ngân hàng",
    description: "Thông tin tài khoản ngân hàng của người dùng đã thay đổi.",
    tone: "finance",
  },
  [AuditAction.ROLE_ASSIGNED]: {
    label: "Gán vai trò",
    description: "Người dùng được gán vai trò mới.",
    tone: "security",
  },
  [AuditAction.ROLE_REVOKED]: {
    label: "Thu hồi vai trò",
    description: "Vai trò của người dùng đã bị thu hồi.",
    tone: "security",
  },
  [AuditAction.PERMISSION_GRANTED]: {
    label: "Cấp quyền",
    description: "Quyền hệ thống được cấp cho vai trò hoặc người dùng.",
    tone: "security",
  },
  [AuditAction.PERMISSION_REVOKED]: {
    label: "Thu hồi quyền",
    description: "Quyền hệ thống bị thu hồi.",
    tone: "security",
  },
  [AuditAction.DEPARTMENT_CREATED]: {
    label: "Tạo phòng ban",
    description: "Phòng ban mới được tạo.",
    tone: "data",
  },
  [AuditAction.DEPARTMENT_UPDATED]: {
    label: "Cập nhật phòng ban",
    description: "Thông tin phòng ban đã thay đổi.",
    tone: "data",
  },
  [AuditAction.DEPARTMENT_DELETED]: {
    label: "Xóa phòng ban",
    description: "Phòng ban bị xóa hoặc vô hiệu hóa.",
    tone: "data",
  },
  [AuditAction.DEPARTMENT_TOPUP]: {
    label: "Cấp quỹ phòng ban",
    description: "Ngân sách phòng ban được cấp thêm.",
    tone: "finance",
  },
  [AuditAction.QUOTA_ADJUSTED]: {
    label: "Điều chỉnh hạn mức",
    description: "Hạn mức hoặc quota đã được điều chỉnh.",
    tone: "finance",
  },
  [AuditAction.PROJECT_TOPUP]: {
    label: "Cấp quỹ dự án",
    description: "Ngân sách dự án được cấp thêm.",
    tone: "finance",
  },
  [AuditAction.CATEGORY_BUDGET_UPDATED]: {
    label: "Cập nhật ngân sách hạng mục",
    description: "Ngân sách của hạng mục dự án đã thay đổi.",
    tone: "finance",
  },
  [AuditAction.CONFIG_UPDATED]: {
    label: "Cập nhật cấu hình",
    description: "Thông số vận hành hệ thống đã thay đổi.",
    tone: "configuration",
  },
  [AuditAction.SYSTEM_FUND_ADJUSTED]: {
    label: "Điều chỉnh quỹ hệ thống",
    description: "Số dư hoặc trạng thái quỹ hệ thống đã thay đổi.",
    tone: "finance",
  },
  [AuditAction.PIN_RESET]: {
    label: "Đặt lại PIN",
    description: "PIN giao dịch được đặt lại.",
    tone: "security",
  },
  [AuditAction.PIN_LOCKED]: {
    label: "Khóa PIN",
    description: "PIN giao dịch bị khóa do chính sách bảo mật.",
    tone: "security",
  },
  [AuditAction.USER_LOGIN_SUCCESS]: {
    label: "Đăng nhập thành công",
    description: "Người dùng đăng nhập hợp lệ.",
    tone: "access",
  },
  [AuditAction.USER_LOGIN_FAILED]: {
    label: "Đăng nhập thất bại",
    description: "Có lần đăng nhập không hợp lệ.",
    tone: "security",
  },
  [AuditAction.DATA_EXPORTED]: {
    label: "Xuất dữ liệu",
    description: "Dữ liệu hệ thống được xuất ra bên ngoài.",
    tone: "data",
  },
  [AuditAction.MANUAL_ADJUSTMENT]: {
    label: "Điều chỉnh thủ công",
    description: "Dữ liệu được điều chỉnh thủ công bởi người có thẩm quyền.",
    tone: "neutral",
  },
};

const ENTITY_LABELS: Record<string, string> = {
  users: "Người dùng",
  roles: "Vai trò",
  role_permissions: "Quyền vai trò",
  departments: "Phòng ban",
  projects: "Dự án",
  categories: "Hạng mục",
  system_configs: "Cấu hình hệ thống",
  company_fund: "Quỹ hệ thống",
  wallets: "Ví nội bộ",
  transactions: "Giao dịch",
  requests: "Yêu cầu",
};

const FIELD_LABELS: Record<string, string> = {
  email: "Email",
  fullName: "Họ tên",
  role: "Vai trò",
  roleId: "Vai trò",
  status: "Trạng thái",
  value: "Giá trị",
  name: "Tên",
  code: "Mã",
  amount: "Số tiền",
  balance: "Số dư",
  availableBalance: "Số dư khả dụng",
  lockedBalance: "Số dư khóa",
  totalProjectQuota: "Quota dự án",
  totalAvailableBalance: "Ngân sách khả dụng",
  departmentId: "Phòng ban",
  bankName: "Ngân hàng",
  bankAccountNum: "Số tài khoản",
  bankAccountOwner: "Chủ tài khoản",
};

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

function actionMeta(action: string, entityName?: string) {
  // Try semantic lookup first (for legacy/future semantic audit values)
  const semantic = ACTION_META[action as AuditAction];
  if (semantic) return semantic;
  // Fall back to (action + entityName) derived label for generic CRUD from backend
  if (entityName) return derivedActionMeta(action, entityName);
  return {
    label: humanizeToken(action),
    description: "Hành động hệ thống được ghi nhận.",
    tone: "neutral" as AuditTone,
  };
}

function humanizeToken(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/^\w/, (char) => char.toUpperCase());
}

function entityLabel(entityName: string): string {
  return ENTITY_LABELS[entityName] ?? humanizeToken(entityName);
}

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? humanizeToken(field);
}

function toneClass(tone: AuditTone): string {
  switch (tone) {
    case "security":
      return "bg-rose-50 border-rose-200 text-rose-700";
    case "access":
      return "bg-blue-50 border-blue-200 text-blue-700";
    case "finance":
      return "bg-emerald-50 border-emerald-200 text-emerald-700";
    case "configuration":
      return "bg-violet-50 border-violet-200 text-violet-700";
    case "data":
      return "bg-amber-50 border-amber-200 text-amber-700";
    default:
      return "bg-slate-100 border-slate-200 text-slate-700";
  }
}

function changedFields(log: AuditLogResponse): string[] {
  const keys = new Set<string>();
  Object.keys(log.oldValues ?? {}).forEach((key) => keys.add(key));
  Object.keys(log.newValues ?? {}).forEach((key) => keys.add(key));
  return Array.from(keys);
}

function summarizeChange(log: AuditLogResponse): string {
  const fields = changedFields(log);
  if (fields.length === 0) return actionMeta(log.action, log.entityName).description;

  const readable = fields.slice(0, 3).map(fieldLabel).join(", ");
  const suffix = fields.length > 3 ? ` +${fields.length - 3} trường khác` : "";
  return `Thay đổi: ${readable}${suffix}`;
}


export default function AuditLogsPage() {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const searchParamsString = searchParams.toString();
  const actorFilter = useMemo(() => searchParams.get("actor") ?? "", [searchParams]);
  const actionFilter = useMemo(() => searchParams.get("action") ?? "", [searchParams]);
  const startDate = useMemo(() => searchParams.get("startDate") ?? "", [searchParams]);
  const endDate = useMemo(() => searchParams.get("endDate") ?? "", [searchParams]);
  const page = useMemo(() => parsePage(searchParams.get("page")), [searchParams]);

  const [items, setItems] = useState<AuditLogResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [loadError,setLoadError]=useState("");
  const [reload,setReload]=useState(0);
  const [actorInput, setActorInput] = useState(actorFilter);
  const [selectedLog, setSelectedLog] = useState<AuditLogResponse | null>(null);

  useEffect(() => {
    setActorInput(actorFilter);
  }, [actorFilter]);

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

  const clearFilters = useCallback(() => {
    setActorInput("");
    pushWithParams(new URLSearchParams());
  }, [pushWithParams]);

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
      const trimmed = actorInput.trim();
      if (trimmed === actorFilter) return;
      updateParam("actor", trimmed || undefined);
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [actorInput, actorFilter, updateParam]);

  useEffect(() => {
    let cancelled = false;

    const loadAudits = async () => {
      setLoading(true); setLoadError("");

      try {
        const filters: AuditLogFilterParams = {
          actor: actorFilter.trim() || undefined,
          action: actionFilter ? (actionFilter as unknown as AuditAction) : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          page,
          limit: PAGE_LIMIT,
        };

        const query = new URLSearchParams();
        if (filters.actor) query.set("actor", filters.actor);
        if (filters.action) query.set("action", filters.action);
        if (filters.startDate) query.set("from", filters.startDate);
        if (filters.endDate) query.set("to", filters.endDate);
        query.set("page", String(filters.page ?? 1));
        query.set("limit", String(filters.limit ?? PAGE_LIMIT));

        const res = await api.get<PaginatedResponse<AuditLogResponse> | AuditLogResponse[]>(
          `/api/v1/admin/audit?${query.toString()}`
        );

        if (cancelled) return;

        const list = pickItems(res.data);
        const apiTotal = getTotal(res.data);
        const apiTotalPages = Array.isArray(res.data)
          ? Math.max(1, Math.ceil(apiTotal / PAGE_LIMIT))
          : res.data.totalPages;

        setItems(Array.isArray(res.data) ? list.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT) : list);
        setTotal(apiTotal);
        setTotalPages(apiTotalPages);
      } catch (err) {
        if (cancelled) return;

        setLoadError(err instanceof ApiError?err.apiMessage:"Không tải được nhật ký kiểm toán.");
        setItems([]);
        setTotal(0);
        setTotalPages(1);

        if (err instanceof ApiError) {
          toast.error(err.apiMessage);
        } else {
          toast.error("Không thể tải nhật ký kiểm toán. Vui lòng thử lại sau.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadAudits();

    return () => {
      cancelled = true;
    };
  }, [actionFilter, actorFilter, endDate, page, startDate, toast, reload]);

  const filtered = Boolean(actorFilter || actionFilter || startDate || endDate);

  const [exporting,setExporting] = useState(false);
  const handleExport = async () => {
    const query=new URLSearchParams();
    if(actorFilter.trim())query.set("actor",actorFilter.trim());
    if(actionFilter)query.set("action",actionFilter);
    if(startDate)query.set("from",startDate);
    if(endDate)query.set("to",endDate);
    setExporting(true);
    try { await downloadFile(`/api/v1/spreadsheets/audit-history/export?${query}`,"ifms-audit-history.xlsx"); toast.success("Đã xuất toàn bộ nhật ký theo bộ lọc."); }
    catch(err) { toast.error(err instanceof ApiError ? err.apiMessage : "Không xuất được nhật ký."); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-6">
      {loadError&&<div role="alert" className="rounded-xl bg-rose-50 p-5 text-sm text-rose-800">{loadError}<button className="ml-3 underline" onClick={()=>setReload(n=>n+1)}>Thử lại</button></div>}
      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-indigo-700 p-6 text-white shadow-xl shadow-blue-900/10">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-50">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            Nhật ký chỉ đọc
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Nhật ký kiểm toán</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100">
              Theo dõi các thay đổi quan trọng về tài khoản, phân quyền, ngân sách và cấu hình hệ thống.
              Dữ liệu được trình bày để phục vụ kiểm soát nội bộ và truy vết vận hành.
            </p>
          </div>
        </div>

        <div className="grid min-w-full grid-cols-3 gap-2 xl:min-w-[420px]">
          <SummaryCard label="Tổng bản ghi" value={total.toLocaleString("vi-VN")} />
          <SummaryCard label="Trang hiện tại" value={`${items.length}/${PAGE_LIMIT}`} />
          <SummaryCard label="Bộ lọc" value={filtered ? "Đang áp dụng" : "Tất cả"} />
        </div>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Bộ lọc truy vết</h2>
            <p className="text-xs text-slate-500 mt-1">Lọc theo người thực hiện, loại hành động và khoảng thời gian phát sinh.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {filtered && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                Xóa bộ lọc
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={exporting || loading || !!loadError}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Xuất Excel theo bộ lọc
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={actorInput}
            onChange={(event) => setActorInput(event.target.value)}
            placeholder="Tên hoặc ID người thực hiện"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />

          <select
            value={actionFilter}
            onChange={(event) => updateParam("action", event.target.value || undefined)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">Tất cả hành động</option>
            {BACKEND_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(event) => updateParam("startDate", event.target.value || undefined)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />

          <input
            type="date"
            value={endDate}
            onChange={(event) => updateParam("endDate", event.target.value || undefined)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-blue-50/50 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Dòng sự kiện</h2>
            <p className="text-xs text-slate-500 mt-0.5">Bấm vào một bản ghi để xem chi tiết trước và sau thay đổi.</p>
          </div>
          <span className="text-xs text-slate-500">Trang {page}/{totalPages}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-200 bg-white">
                <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-3.5">Thời gian</th>
                <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-3.5">Người thực hiện</th>
                <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-3.5">Hành động</th>
                <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-3.5">Đối tượng</th>
                <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-3.5">Tóm tắt nghiệp vụ</th>
                <th className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-3.5">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableRowSkeleton colSpan={6} rows={8} />
              ) : loadError ? (<tr><td colSpan={6} className="p-6 text-center text-rose-700">Không thể hiển thị dữ liệu; hãy thử tải lại.</td></tr>) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8">
                    <EmptyState message="Không tìm thấy bản ghi kiểm toán phù hợp." />
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const meta = actionMeta(item.action, item.entityName);
                  return (
                    <tr
                      key={item.id}
                      className="cursor-pointer border-b border-slate-100 transition last:border-b-0 hover:bg-blue-50/40"
                      onClick={() => setSelectedLog(item)}
                    >
                      <td className="px-4 py-4 text-sm text-slate-600 whitespace-nowrap">{formatDateTime(item.createdAt)}</td>
                      <td className="px-4 py-4">
                        <p className="text-sm font-medium text-slate-900">{item.actorName ?? "Hệ thống"}</p>
                        <p className="text-xs text-slate-500 mt-1">ID: {item.actorId ?? "system"}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full border text-xs font-medium ${toneClass(meta.tone)}`}>
                          {meta.label}
                        </span>
                        <p className="text-xs text-slate-500 mt-2">{meta.description}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm font-medium text-slate-900">{entityLabel(item.entityName)}</p>
                        <p className="text-xs text-slate-500 mt-1 font-mono">{item.entityId}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600 max-w-[280px]">
                        {summarizeChange(item)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedLog(item);
                          }}
                          className="rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                        >
                          Xem bản ghi
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Hiển thị {items.length} trong tổng {total.toLocaleString("vi-VN")} bản ghi
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

      {selectedLog && (
        <AuditDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur">
      <p className="text-xs font-medium text-blue-100">{label}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function AuditDetailModal({ log, onClose }: { log: AuditLogResponse; onClose: () => void }) {
  const meta = actionMeta(log.action, log.entityName);

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/70"
        onClick={onClose}
        aria-label="Đóng chi tiết nhật ký kiểm toán"
      />

      <section className="absolute inset-y-0 right-0 w-full max-w-4xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-blue-200 bg-linear-to-r from-blue-700 to-indigo-700 px-6 py-5 text-white">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex px-2.5 py-1 rounded-full border text-xs font-medium ${toneClass(meta.tone)}`}>
                {meta.label}
              </span>
              <span className="text-xs text-blue-100">Audit #{log.id}</span>
            </div>
            <h3 className="mt-3 text-xl font-bold text-white">Chi tiết bản ghi kiểm toán</h3>
            <p className="mt-1 text-sm text-blue-100">{meta.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-lg text-blue-100 transition hover:bg-white/10 hover:text-white"
            aria-label="Đóng"
          >
            X
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <InfoCard label="Thời gian" value={formatDateTime(log.createdAt)} />
            <InfoCard label="Người thực hiện" value={log.actorName ?? "Hệ thống"} />
            <InfoCard label="Đối tượng" value={entityLabel(log.entityName)} />
            <InfoCard label="Mã đối tượng" value={log.entityId} mono />
          </div>

          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
              <h4 className="text-sm font-semibold text-slate-900">Các trường thay đổi</h4>
              <p className="text-xs text-slate-500 mt-1">So sánh giá trị trước và sau khi thao tác được ghi nhận.</p>
            </div>

            <div className="p-4">
              <DiffViewer
                oldValues={log.oldValues}
                newValues={log.newValues}
                fieldLabels={FIELD_LABELS}
                emptyMessage="Bản ghi này không có snapshot trước/sau từ backend."
              />
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}

function InfoCard({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-sm text-slate-900 mt-1 break-words ${mono ? "font-mono" : "font-medium"}`}>{value}</p>
    </div>
  );
}
