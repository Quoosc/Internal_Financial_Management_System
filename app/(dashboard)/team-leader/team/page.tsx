"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ApiError, api } from "@/lib/api-client";
import { useToast } from "@/contexts/toast-context";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  PaginatedResponse,
  RequestType,
  TLTeamMemberDetailResponse,
  TLTeamMemberListItem,
} from "@/types";
import { SideDrawer } from "@/components/ui/side-drawer";

const PAGE_LIMIT = 20;



function parsePage(v: string | null): number {
  const n = Number(v ?? "1");
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function initials(name: string): string {
  return name.split(/\s+/).slice(-2).map((x) => x[0]?.toUpperCase() ?? "").join("");
}

function avatarColor(id: number): string {
  const colors = ["bg-sky-600", "bg-emerald-600", "bg-amber-600", "bg-indigo-600", "bg-rose-600"];
  return colors[id % colors.length];
}

function typeBadge(type: RequestType): string {
  if (type === RequestType.ADVANCE) return "bg-violet-100 border-violet-200 text-violet-700";
  if (type === RequestType.EXPENSE) return "bg-sky-100 border-sky-200 text-sky-700";
  return "bg-amber-100 border-amber-200 text-amber-700";
}

function statusBadge(status: string): string {
  if (status === "ACTIVE") return "bg-emerald-100 border-emerald-200 text-emerald-700";
  if (status === "LOCKED") return "bg-rose-100 border-rose-200 text-rose-700";
  return "bg-slate-100 border-slate-200 text-slate-600";
}


export default function TLTeamPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();

  const searchParamsString = searchParams.toString();
  const search = searchParams.get("search") ?? "";
  const projectFilter = searchParams.get("projectId") ?? "";
  const page = parsePage(searchParams.get("page"));

  const [members, setMembers] = useState<TLTeamMemberListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [selectedMember, setSelectedMember] = useState<TLTeamMemberDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const [searchInput, setSearchInput] = useState(search);

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
      if (value && value.trim()) params.set(key, value.trim());
      else params.delete(key);
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
    const t = window.setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed === search) return;
      updateParam("search", trimmed || undefined);
    }, 300);
    return () => {
      window.clearTimeout(t);
    };
  }, [searchInput, search, updateParam]);

  useEffect(() => {
    let cancelled = false;
    const loadMembers = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        if (search.trim()) query.set("search", search.trim());
        if (projectFilter) query.set("projectId", projectFilter);
        query.set("page", String(page));
        query.set("limit", String(PAGE_LIMIT));

        const res = await api.get<PaginatedResponse<TLTeamMemberListItem>>(`/api/v1/team-leader/team-members?${query.toString()}`);
        if (cancelled) return;
        setMembers(res.data.items);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
      } catch (err) {
        if (cancelled) return;
        setMembers([]);
        setTotal(0);
        setTotalPages(1);
        if (err instanceof ApiError) toast.error(err.apiMessage);
        else toast.error("Không thể tải danh sách thành viên.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadMembers();
    return () => {
      cancelled = true;
    };
  }, [goToPage, page, projectFilter, search, toast]);

  const projectOptions = useMemo(() => {
    const map = new Map<number, string>();
    members.forEach((m) => {
      m.projects.forEach((p) => map.set(p.projectId, `${p.projectCode} - ${p.projectName}`));
    });
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  }, [members]);
  const filtered = Boolean(search || projectFilter);
  const debtMembers = members.filter((member) => member.debtBalance > 0).length;
  const pendingRequests = members.reduce((sum, member) => sum + member.pendingRequestsCount, 0);
  const projectCount = projectOptions.length;

  const loadMemberDetail = async (userId: number) => {
    setShowDetail(true);
    setDetailLoading(true);
    try {
      const res = await api.get<TLTeamMemberDetailResponse>(`/api/v1/team-leader/team-members/${userId}`);
      setSelectedMember(res.data);
    } catch (err) {
      setSelectedMember(null);
      setShowDetail(false);
      toast.error(err instanceof ApiError ? err.apiMessage : "Không thể tải thông tin thành viên.");
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-violet-200 bg-linear-to-br from-violet-700 via-indigo-600 to-blue-600 text-white shadow-xl shadow-violet-900/15">
        <div className="relative px-6 py-7 sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.28),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(191,219,254,0.22),_transparent_34%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-100">Team directory</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Thành viên nhóm</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-violet-100">
                Theo dõi thông tin, dự án tham gia, yêu cầu gần đây và tình trạng tài chính của từng thành viên.
              </p>
            </div>

            <div className="inline-flex w-fit items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              {total.toLocaleString("vi-VN")} thành viên
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Tổng thành viên" value={total.toLocaleString("vi-VN")} helper={`${members.length} đang hiển thị`} tone="indigo" />
        <MetricCard label="Có dư nợ" value={String(debtMembers)} helper="Trên trang hiện tại, cần theo dõi hoàn ứng" tone="rose" />
        <MetricCard label="Chờ duyệt" value={String(pendingRequests)} helper="Tổng pending trên trang" tone="amber" />
        <MetricCard label="Dự án liên quan" value={String(projectCount)} helper="Từ danh sách hiện tại" tone="blue" />
      </section>

      <section className="rounded-3xl border border-violet-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Bộ lọc thành viên</h2>
            <p className="mt-1 text-sm text-slate-500">Tra cứu theo tên, mã nhân viên, email hoặc dự án đang tham gia.</p>
          </div>
          {filtered && (
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams(searchParamsString);
                params.delete("search");
                params.delete("projectId");
                params.delete("page");
                pushWithParams(params);
              }}
              className="rounded-xl bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-4.35-4.35m1.6-5.65a7.25 7.25 0 11-14.5 0 7.25 7.25 0 0114.5 0z" />
            </svg>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm theo tên, mã, email..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
            />
          </div>
        <select value={projectFilter} onChange={(e) => updateParam("projectId", e.target.value || undefined)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-500/10">
          <option value="">Tất cả dự án</option>
          {projectOptions.map((opt) => (
            <option key={opt.id} value={String(opt.id)}>{opt.label}</option>
          ))}
        </select>
        </div>
      </section>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, idx) => <div key={idx} className="h-48 animate-pulse rounded-3xl bg-white" />)}
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20h10M12 7a3 3 0 110 6 3 3 0 010-6z" />
            </svg>
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">Không có thành viên phù hợp</h3>
          <p className="mt-1 text-sm text-slate-500">Thử thay đổi từ khóa hoặc bộ lọc dự án.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {members.map((m) => (
            <button key={m.id} type="button" onClick={() => loadMemberDetail(m.id)} className="rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-900/10">
              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${avatarColor(m.id)} text-sm font-bold text-white shadow-sm`}>{initials(m.fullName)}</div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-950">{m.fullName}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{m.jobTitle ?? "—"} • {m.employeeCode}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadge(m.status)}`}>{m.status}</span>
                {m.debtBalance > 0 && <span className="inline-flex rounded-full border border-rose-200 bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">Dư nợ {formatCurrency(m.debtBalance)}</span>}
                {m.pendingRequestsCount > 0 && <span className="inline-flex rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">{m.pendingRequestsCount} chờ duyệt</span>}
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-100 pt-4">
                {m.projects.slice(0, 2).map((p) => (
                  <span key={p.projectId} className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">{p.projectCode}</span>
                ))}
                {m.projects.length > 2 && <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500">... +{m.projects.length - 2}</span>}
              </div>
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
          <button onClick={() => goToPage(page - 1)} disabled={page <= 1} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-violet-200 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50">Trước</button>
          <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-violet-200 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50">Sau</button>
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
            <div className="rounded-3xl border border-violet-100 bg-violet-50/70 p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${avatarColor(selectedMember.id)} text-sm font-bold text-white`}>
                  {initials(selectedMember.fullName)}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-950">{selectedMember.fullName}</p>
                  <p className="mt-1 text-sm text-slate-600">{selectedMember.email}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoTile label="Điện thoại" value={selectedMember.phoneNumber ?? "Chưa cập nhật"} />
                <InfoTile
                  label="Dư nợ"
                  value={formatCurrency(selectedMember.debtBalance)}
                  tone={selectedMember.debtBalance > 0 ? "rose" : "emerald"}
                />
              </div>
            </div>

            <section className="space-y-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Dự án tham gia</h4>
                <p className="mt-1 text-sm text-slate-500">Vai trò và thời điểm tham gia từng dự án.</p>
              </div>
              {selectedMember.projects.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                  Chưa có dự án được gán.
                </div>
              ) : (
                selectedMember.projects.map((p) => (
                  <div key={`${p.projectId}-${p.position}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">{p.projectCode} • {p.projectName}</p>
                    <p className="mt-1 text-xs text-slate-500">{p.position} • {formatDateTime(p.joinedAt)}</p>
                  </div>
                ))
              )}
            </section>

            <section className="space-y-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Yêu cầu gần đây</h4>
                <p className="mt-1 text-sm text-slate-500">Các yêu cầu mới nhất để nắm nhanh lịch sử chi tiêu.</p>
              </div>
              {selectedMember.recentRequests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                  Chưa có yêu cầu gần đây.
                </div>
              ) : (
                selectedMember.recentRequests.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-600">{r.requestCode}</span>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${typeBadge(r.type)}`}>{r.type}</span>
                    </div>
                    <p className="mt-3 text-sm font-bold text-slate-900">{formatCurrency(r.amount)}</p>
                    <p className="mt-1 text-xs text-slate-500">{r.status} • {formatDateTime(r.createdAt)}</p>
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

function MetricCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: "indigo" | "rose" | "amber" | "blue";
}) {
  const toneClassName = {
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
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
