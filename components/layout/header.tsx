"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { getUnreadCount } from "@/lib/api";
import { RoleName } from "@/types";

const BREADCRUMB_MAP: Record<string, string[]> = {
  "/dashboard": ["Tổng quan"],
  "/wallet": ["Ví của tôi"],
  "/wallet/deposit": ["Ví của tôi", "Nạp tiền"],
  "/wallet/deposit/my": ["Ví của tôi", "Lịch sử nạp tiền"],
  "/wallet/withdraw": ["Ví của tôi", "Rút tiền"],
  "/wallet/transactions": ["Ví của tôi", "Lịch sử giao dịch"],
  "/notifications": ["Thông báo"],
  "/requests": ["Yêu cầu của tôi"],
  "/requests/new": ["Yêu cầu của tôi", "Tạo mới"],
  "/payroll": ["Phiếu lương"],
  "/projects": ["Dự án"],
  "/profile": ["Hồ sơ cá nhân"],
  "/team-leader/approvals": ["Trưởng nhóm", "Duyệt yêu cầu"],
  "/team-leader/projects": ["Trưởng nhóm", "Dự án"],
  "/team-leader/team": ["Trưởng nhóm", "Nhóm của tôi"],
  "/manager/approvals": ["Manager", "Duyệt nạp quỹ"],
  "/manager/projects": ["Manager", "Dự án"],
  "/manager/department": ["Manager", "Phòng ban"],
  "/accountant/disbursements": ["Kế toán", "Giải ngân"],
  "/accountant/payroll": ["Kế toán", "Bảng lương"],
  "/accountant/payslips": ["Kế toán", "Phiếu lương"],
  "/data-exchange": ["IFMS", "Nhập / xuất Excel"],
  "/accountant/ledger": ["Kế toán", "Sổ cái"],
  "/accountant/withdrawals": ["Kế toán", "Rút tiền"],
  "/accountant/system-fund": ["Kế toán", "Quỹ hệ thống"],
  "/admin/users": ["Quản trị", "Nhân sự"],
  "/admin/departments": ["Quản trị", "Phòng ban"],
  "/admin/settings": ["Quản trị", "Cấu hình"],
  "/admin/audit-logs": ["Quản trị", "Nhật ký hệ thống"],
  "/admin/roles": ["Quản trị", "Phân quyền"],
  "/admin/system-fund": ["Quản trị", "Quỹ hệ thống"],
  "/cfo/approvals": ["CFO", "Duyệt ngân sách"],
  "/cfo/system-fund": ["CFO", "Quỹ hệ thống"],
  "/cfo/settings": ["CFO", "Cấu hình"],
  "/cfo/audit-logs": ["CFO", "Nhật ký hệ thống"],
};

const ROLE_LABELS: Partial<Record<RoleName, string>> = {
  [RoleName.EMPLOYEE]: "Nhân viên",
  [RoleName.TEAM_LEADER]: "Trưởng nhóm",
  [RoleName.MANAGER]: "Manager",
  [RoleName.ACCOUNTANT]: "Kế toán",
  [RoleName.CFO]: "CFO",
  [RoleName.ADMIN]: "Quản trị viên",
};

function getBreadcrumbs(pathname: string): string[] {
  if (BREADCRUMB_MAP[pathname]) return BREADCRUMB_MAP[pathname];

  const exactParent = Object.keys(BREADCRUMB_MAP)
    .filter((path) => pathname.startsWith(`${path}/`))
    .sort((a, b) => b.length - a.length)[0];

  if (exactParent) return [...BREADCRUMB_MAP[exactParent], "Chi tiết"];
  return ["Tổng quan"];
}

function BellIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-4-5.659V5a2 2 0 10-4 0v.341A6 6 0 006 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h11zm0 0v1a3 3 0 11-6 0v-1"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5.121 17.804A9 9 0 1118.879 6.196M15 11a3 3 0 11-6 0 3 3 0 016 0zm-7.5 8a6.5 6.5 0 019 0" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

export function Header() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  const breadcrumbs = React.useMemo(() => getBreadcrumbs(pathname), [pathname]);
  const pageTitle = breadcrumbs[breadcrumbs.length - 1] ?? "Tổng quan";
  const sectionLabel = breadcrumbs.length > 1 ? breadcrumbs.slice(0, -1).join(" / ") : "IFMS Workspace";
  const initials = user?.fullName?.charAt(0)?.toUpperCase() ?? "U";
  const roleLabel = user?.role ? ROLE_LABELS[user.role as RoleName] ?? user.role : "Người dùng";
  const teamLabel = user?.departmentName ?? roleLabel;

  React.useEffect(() => {
    let mounted = true;

    async function fetchCount() {
      try {
        const res = await getUnreadCount();
        if (mounted) setUnreadCount(Math.max(0, res.data));
      } catch {
        // keep previous count when notification service is temporarily unavailable
      }
    }

    void fetchCount();
    const id = window.setInterval(() => void fetchCount(), 60_000);
    const onChanged = () => void fetchCount();
    window.addEventListener("notifications:changed", onChanged);

    return () => {
      mounted = false;
      window.clearInterval(id);
      window.removeEventListener("notifications:changed", onChanged);
    };
  }, []);

  React.useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  React.useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-blue-200/80 bg-linear-to-r from-white via-blue-100/75 to-cyan-50/70 shadow-lg shadow-blue-950/10 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-blue-400/80 to-transparent" />
      <div className="flex min-h-20 items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center">
          <div className="min-w-0">
            <div className="mb-1 flex min-w-0 items-center gap-2 text-xs font-semibold text-blue-700">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-sm shadow-emerald-500/40" />
              <span className="truncate">{sectionLabel}</span>
            </div>
            <div className="flex min-w-0 items-center gap-3">
              <h1 className="truncate text-xl font-bold text-slate-950 sm:text-2xl">{pageTitle}</h1>
              <div className="hidden rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 md:block">
                {roleLabel}
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/notifications"
            className="group relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md"
            aria-label="Thông báo"
          >
            <BellIcon />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white shadow-lg shadow-rose-500/30">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
            <span className="absolute inset-0 rounded-2xl ring-2 ring-blue-400/0 transition group-hover:ring-blue-400/15" />
          </Link>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="group flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-2.5 pr-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:shadow-md"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <Avatar initials={initials} avatar={user?.avatar ?? null} name={user?.fullName ?? "User"} />
              <span className="hidden min-w-0 text-left lg:block">
                <span className="block max-w-40 truncate text-sm font-bold leading-5 text-slate-950">
                  {user?.fullName ?? "User"}
                </span>
                <span className="block max-w-40 truncate text-xs leading-4 text-slate-500">{teamLabel}</span>
              </span>
              <span className={`hidden text-slate-400 transition duration-200 group-hover:text-blue-700 sm:block ${menuOpen ? "rotate-180" : ""}`}>
                <ChevronDownIcon />
              </span>
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-3 w-72 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/15"
              >
                <div className="bg-linear-to-br from-blue-600 via-blue-600 to-cyan-500 p-4 text-white">
                  <div className="flex items-center gap-3">
                    <Avatar initials={initials} avatar={user?.avatar ?? null} name={user?.fullName ?? "User"} large />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{user?.fullName ?? "User"}</p>
                      <p className="truncate text-xs text-blue-100">{user?.email ?? roleLabel}</p>
                    </div>
                  </div>
                </div>

                <div className="p-2">
                  <Link
                    href="/profile"
                    className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                    role="menuitem"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      <UserIcon />
                    </span>
                    Hồ sơ cá nhân
                  </Link>
                  <Link
                    href="/notifications"
                    className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                    role="menuitem"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      <BellIcon />
                    </span>
                    Thông báo
                    {unreadCount > 0 && (
                      <span className="ml-auto rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold text-white">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </Link>
                </div>

                <div className="border-t border-slate-100 p-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                    role="menuitem"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
                      <LogoutIcon />
                    </span>
                    Đăng xuất
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function Avatar({
  initials,
  avatar,
  name,
  large,
}: {
  initials: string;
  avatar: string | null;
  name: string;
  large?: boolean;
}) {
  const sizeClass = large ? "h-12 w-12" : "h-9 w-9";

  return (
    <span className={`${sizeClass} shrink-0 overflow-hidden rounded-2xl ring-2 ring-white/70`}>
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-linear-to-br from-blue-500 to-fuchsia-500 text-sm font-bold text-white">
          {initials}
        </span>
      )}
    </span>
  );
}
