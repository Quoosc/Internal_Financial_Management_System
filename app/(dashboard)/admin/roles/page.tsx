"use client";

import React from "react";
import { Permission, RoleName } from "@/types";

const ROLE_ORDER: RoleName[] = [
  RoleName.EMPLOYEE,
  RoleName.TEAM_LEADER,
  RoleName.MANAGER,
  RoleName.ACCOUNTANT,
  RoleName.CFO,
  RoleName.ADMIN,
];

const ROLE_LABEL: Record<RoleName, string> = {
  [RoleName.EMPLOYEE]: "Nhân viên",
  [RoleName.TEAM_LEADER]: "Trưởng nhóm",
  [RoleName.MANAGER]: "Trưởng phòng",
  [RoleName.ACCOUNTANT]: "Kế toán",
  [RoleName.CFO]: "Giám đốc tài chính (CFO)",
  [RoleName.ADMIN]: "Quản trị hệ thống",
};

const ROLE_DESCRIPTION: Record<RoleName, string> = {
  [RoleName.EMPLOYEE]: "Tạo yêu cầu chi tiêu cá nhân, theo dõi ví và phiếu lương.",
  [RoleName.TEAM_LEADER]: "Duyệt Flow 1 và quản lý dự án, nhóm được phân công.",
  [RoleName.MANAGER]: "Duyệt Flow 2, quản lý dự án và quỹ phòng ban.",
  [RoleName.ACCOUNTANT]: "Giải ngân, vận hành bảng lương và theo dõi sổ cái.",
  [RoleName.CFO]: "Duyệt Flow 3 và giám sát ngân sách cấp công ty.",
  [RoleName.ADMIN]: "Quản trị IAM, cấu hình hệ thống và nhật ký kiểm toán.",
};

const PERMISSION_GROUPS: Array<{
  groupName: string;
  permissions: Permission[];
}> = [
  {
    groupName: "IAM & Bảo mật",
    permissions: [
      Permission.USER_PROFILE_VIEW,
      Permission.USER_PROFILE_UPDATE,
      Permission.USER_PIN_UPDATE,
      Permission.USER_VIEW_LIST,
      Permission.USER_CREATE,
      Permission.USER_UPDATE,
      Permission.USER_LOCK,
      Permission.ROLE_MANAGE,
      Permission.NOTIFICATION_VIEW,
    ],
  },
  {
    groupName: "Ví & giao dịch",
    permissions: [
      Permission.WALLET_VIEW_SELF,
      Permission.WALLET_DEPOSIT,
      Permission.WALLET_WITHDRAW,
      Permission.WALLET_TRANSACTION_VIEW,
      Permission.WALLET_VIEW_ALL,
      Permission.TRANSACTION_APPROVE_WITHDRAW,
    ],
  },
  {
    groupName: "Yêu cầu & phê duyệt",
    permissions: [
      Permission.REQUEST_CREATE,
      Permission.REQUEST_VIEW_SELF,
      Permission.REQUEST_VIEW_DEPT,
      Permission.REQUEST_APPROVE_TEAM_LEADER,
      Permission.REQUEST_APPROVE_PROJECT_TOPUP,
      Permission.REQUEST_APPROVE_DEPT_TOPUP,
      Permission.REQUEST_REJECT,
      Permission.REQUEST_VIEW_ALL,
      Permission.REQUEST_VIEW_APPROVED,
      Permission.REQUEST_PAYOUT,
    ],
  },
  {
    groupName: "Dự án & phòng ban",
    permissions: [
      Permission.PROJECT_VIEW_ACTIVE,
      Permission.PROJECT_CREATE,
      Permission.PROJECT_UPDATE,
      Permission.PROJECT_PHASE_MANAGE,
      Permission.PROJECT_MEMBER_MANAGE,
      Permission.PROJECT_STATUS_MANAGE,
      Permission.PROJECT_VIEW_ALL,
      Permission.PROJECT_CATEGORY_MANAGE,
      Permission.PROJECT_BUDGET_ALLOCATE,
      Permission.PROJECT_ASSIGN_LEADER,
      Permission.DEPT_VIEW_DASHBOARD,
      Permission.DEPT_MANAGE,
      Permission.DEPT_BUDGET_ALLOCATE,
    ],
  },
  {
    groupName: "Kế toán & hệ thống",
    permissions: [
      Permission.PAYROLL_VIEW_SELF,
      Permission.PAYROLL_DOWNLOAD,
      Permission.PAYROLL_MANAGE,
      Permission.PAYROLL_EXECUTE,
      Permission.COMPANY_FUND_VIEW,
      Permission.COMPANY_FUND_TOPUP,
      Permission.SYSTEM_CONFIG_MANAGE,
      Permission.DASHBOARD_VIEW_GLOBAL,
      Permission.AUDIT_LOG_VIEW,
    ],
  },
];

const PERMISSION_COPY: Record<Permission, { label: string; description: string }> = {
  [Permission.USER_PROFILE_VIEW]: {
    label: "Xem hồ sơ cá nhân",
    description: "Cho phép người dùng xem thông tin hồ sơ, phòng ban và thông tin ngân hàng của chính mình.",
  },
  [Permission.USER_PROFILE_UPDATE]: {
    label: "Cập nhật hồ sơ cá nhân",
    description: "Cho phép chỉnh sửa thông tin cá nhân như số điện thoại, địa chỉ, ngân hàng và ảnh đại diện.",
  },
  [Permission.USER_PIN_UPDATE]: {
    label: "Thiết lập hoặc đổi PIN giao dịch",
    description: "Cho phép tạo mới hoặc thay đổi PIN dùng khi rút tiền và xác nhận giao dịch nhạy cảm.",
  },
  [Permission.NOTIFICATION_VIEW]: {
    label: "Xem thông báo",
    description: "Cho phép xem thông báo hệ thống, thông báo duyệt yêu cầu và cập nhật giao dịch.",
  },
  [Permission.USER_VIEW_LIST]: {
    label: "Xem danh sách người dùng",
    description: "Cho phép xem, tìm kiếm và lọc danh sách tài khoản nhân sự trong hệ thống.",
  },
  [Permission.USER_CREATE]: {
    label: "Tạo tài khoản người dùng",
    description: "Cho phép tạo tài khoản mới và gán vai trò, phòng ban ban đầu.",
  },
  [Permission.USER_UPDATE]: {
    label: "Cập nhật thông tin người dùng",
    description: "Cho phép chỉnh sửa thông tin tài khoản, vai trò, trạng thái và phòng ban của người dùng.",
  },
  [Permission.USER_LOCK]: {
    label: "Khóa hoặc mở khóa tài khoản",
    description: "Cho phép tạm khóa, mở khóa tài khoản và kiểm soát trạng thái đăng nhập.",
  },
  [Permission.ROLE_MANAGE]: {
    label: "Quản lý vai trò và phân quyền",
    description: "Cho phép xem ma trận quyền và quản trị phạm vi truy cập của các vai trò.",
  },
  [Permission.WALLET_VIEW_SELF]: {
    label: "Xem ví cá nhân",
    description: "Cho phép xem số dư, số tiền khả dụng và thông tin ví nội bộ của chính mình.",
  },
  [Permission.WALLET_DEPOSIT]: {
    label: "Nạp tiền vào ví",
    description: "Cho phép tạo giao dịch nạp tiền qua cổng thanh toán được tích hợp.",
  },
  [Permission.WALLET_WITHDRAW]: {
    label: "Tạo yêu cầu rút tiền",
    description: "Cho phép gửi yêu cầu rút tiền từ ví nội bộ về tài khoản ngân hàng cá nhân.",
  },
  [Permission.WALLET_TRANSACTION_VIEW]: {
    label: "Xem lịch sử giao dịch ví",
    description: "Cho phép xem các giao dịch nạp, rút, nhận lương và chi trả phát sinh trên ví.",
  },
  [Permission.WALLET_VIEW_ALL]: {
    label: "Xem các ví của tổ chức",
    description: "Cho phép xem số dư và lịch sử giao dịch của ví dự án, phòng ban và quỹ công ty.",
  },
  [Permission.TRANSACTION_APPROVE_WITHDRAW]: {
    label: "Xử lý yêu cầu rút tiền",
    description: "Cho phép kế toán duyệt, từ chối hoặc thực thi yêu cầu rút tiền qua ngân hàng.",
  },
  [Permission.REQUEST_CREATE]: {
    label: "Tạo yêu cầu chi tiêu",
    description: "Cho phép tạo yêu cầu tạm ứng, chi phí, hoàn ứng hoặc xin cấp vốn theo vai trò.",
  },
  [Permission.REQUEST_VIEW_SELF]: {
    label: "Xem yêu cầu của mình",
    description: "Cho phép theo dõi danh sách, trạng thái và chi tiết các yêu cầu do chính mình tạo.",
  },
  [Permission.REQUEST_VIEW_DEPT]: {
    label: "Xem yêu cầu trong phạm vi phòng ban",
    description: "Cho phép xem các yêu cầu thuộc nhóm, dự án hoặc phòng ban mình phụ trách.",
  },
  [Permission.REQUEST_APPROVE_TEAM_LEADER]: {
    label: "Duyệt yêu cầu chi tiêu của thành viên",
    description: "Cho phép Trưởng nhóm duyệt hoặc từ chối yêu cầu tạm ứng, chi phí và hoàn ứng.",
  },
  [Permission.REQUEST_APPROVE_PROJECT_TOPUP]: {
    label: "Duyệt cấp vốn dự án",
    description: "Cho phép Quản lý duyệt yêu cầu bổ sung ngân sách dự án từ Trưởng nhóm.",
  },
  [Permission.REQUEST_APPROVE_DEPT_TOPUP]: {
    label: "Duyệt cấp vốn phòng ban",
    description: "Cho phép CFO duyệt yêu cầu bổ sung ngân sách phòng ban từ Manager.",
  },
  [Permission.REQUEST_REJECT]: {
    label: "Từ chối yêu cầu",
    description: "Cho phép từ chối yêu cầu trong phạm vi phê duyệt của vai trò và ghi lý do.",
  },
  [Permission.REQUEST_VIEW_ALL]: {
    label: "Xem tất cả yêu cầu",
    description: "Cho phép xem toàn bộ yêu cầu phục vụ kiểm soát tài chính và giám sát cấp cao.",
  },
  [Permission.REQUEST_VIEW_APPROVED]: {
    label: "Xem yêu cầu đã được duyệt",
    description: "Cho phép xem các yêu cầu đã qua bước phê duyệt và đang chờ xử lý tiếp theo.",
  },
  [Permission.REQUEST_PAYOUT]: {
    label: "Giải ngân yêu cầu",
    description: "Cho phép kế toán chi trả yêu cầu đã được duyệt và ghi nhận giao dịch ví.",
  },
  [Permission.PROJECT_VIEW_ACTIVE]: {
    label: "Xem dự án đang hoạt động",
    description: "Cho phép xem các dự án đang triển khai mà người dùng có liên quan.",
  },
  [Permission.PROJECT_CREATE]: {
    label: "Tạo dự án",
    description: "Cho phép tạo dự án mới trong phạm vi phòng ban hoặc phạm vi quản lý.",
  },
  [Permission.PROJECT_UPDATE]: {
    label: "Cập nhật thông tin dự án",
    description: "Cho phép chỉnh sửa tên, mô tả, ngân sách và thông tin vận hành của dự án.",
  },
  [Permission.PROJECT_PHASE_MANAGE]: {
    label: "Quản lý giai đoạn dự án",
    description: "Cho phép tạo, sửa và quản lý các phase trong dự án.",
  },
  [Permission.PROJECT_MEMBER_MANAGE]: {
    label: "Quản lý thành viên dự án",
    description: "Cho phép thêm, xóa hoặc điều chỉnh vai trò thành viên trong dự án.",
  },
  [Permission.PROJECT_STATUS_MANAGE]: {
    label: "Quản lý trạng thái dự án",
    description: "Cho phép thay đổi trạng thái dự án như lập kế hoạch, đang hoạt động, tạm dừng hoặc đóng.",
  },
  [Permission.PROJECT_VIEW_ALL]: {
    label: "Xem tất cả dự án",
    description: "Cho phép xem toàn bộ dự án trong phạm vi quản trị hoặc phòng ban.",
  },
  [Permission.PROJECT_CATEGORY_MANAGE]: {
    label: "Quản lý hạng mục chi phí dự án",
    description: "Cho phép tạo và chỉnh sửa danh mục chi phí dùng khi lập yêu cầu chi tiêu.",
  },
  [Permission.PROJECT_BUDGET_ALLOCATE]: {
    label: "Phân bổ ngân sách dự án",
    description: "Cho phép phân bổ ngân sách cho phase, hạng mục hoặc đề xuất bổ sung ngân sách dự án.",
  },
  [Permission.PROJECT_ASSIGN_LEADER]: {
    label: "Chỉ định Trưởng nhóm cho dự án",
    description: "Cho phép Manager gán hoặc thay đổi người phụ trách dự án.",
  },
  [Permission.DEPT_VIEW_DASHBOARD]: {
    label: "Xem tổng quan phòng ban",
    description: "Cho phép xem ngân sách, thành viên, dư nợ và tình trạng hoạt động của phòng ban.",
  },
  [Permission.DEPT_MANAGE]: {
    label: "Quản lý phòng ban",
    description: "Cho phép tạo, cập nhật phòng ban và gán người quản lý phòng ban.",
  },
  [Permission.DEPT_BUDGET_ALLOCATE]: {
    label: "Phân bổ ngân sách phòng ban",
    description: "Cho phép kiểm soát hoặc phân bổ ngân sách từ phòng ban xuống dự án.",
  },
  [Permission.PAYROLL_VIEW_SELF]: {
    label: "Xem phiếu lương cá nhân",
    description: "Cho phép xem các kỳ lương và chi tiết phiếu lương của chính mình.",
  },
  [Permission.PAYROLL_DOWNLOAD]: {
    label: "Tải phiếu lương",
    description: "Cho phép tải hoặc xuất thông tin phiếu lương cá nhân.",
  },
  [Permission.PAYROLL_MANAGE]: {
    label: "Quản lý bảng lương",
    description: "Cho phép kế toán tạo kỳ lương, nhập dữ liệu lương và kiểm tra kết quả tính lương.",
  },
  [Permission.PAYROLL_EXECUTE]: {
    label: "Chạy trả lương",
    description: "Cho phép xác nhận kỳ lương và thực hiện chi trả lương vào ví người dùng.",
  },
  [Permission.COMPANY_FUND_VIEW]: {
    label: "Xem quỹ hệ thống",
    description: "Cho phép xem số dư quỹ công ty, dòng tiền và thông tin đối soát.",
  },
  [Permission.COMPANY_FUND_TOPUP]: {
    label: "Nạp hoặc điều chỉnh quỹ hệ thống",
    description: "Cho phép thực hiện thao tác bổ sung hoặc cập nhật nguồn tiền cho quỹ hệ thống.",
  },
  [Permission.SYSTEM_CONFIG_MANAGE]: {
    label: "Quản lý cấu hình hệ thống",
    description: "Cho phép cập nhật hạn mức, tham số vận hành và các quy tắc chung của hệ thống.",
  },
  [Permission.DASHBOARD_VIEW_GLOBAL]: {
    label: "Xem dashboard toàn hệ thống",
    description: "Cho phép xem số liệu tổng hợp cấp công ty hoặc cấp quản trị.",
  },
  [Permission.AUDIT_LOG_VIEW]: {
    label: "Xem nhật ký hệ thống",
    description: "Cho phép xem lịch sử thao tác, thay đổi dữ liệu và sự kiện kiểm toán.",
  },
};

const ROLE_PERMISSION_SET: Record<RoleName, Set<Permission>> = {
  [RoleName.EMPLOYEE]: new Set<Permission>([
    Permission.USER_PROFILE_VIEW,
    Permission.USER_PROFILE_UPDATE,
    Permission.USER_PIN_UPDATE,
    Permission.NOTIFICATION_VIEW,
    Permission.WALLET_VIEW_SELF,
    Permission.WALLET_DEPOSIT,
    Permission.WALLET_WITHDRAW,
    Permission.WALLET_TRANSACTION_VIEW,
    Permission.PROJECT_VIEW_ACTIVE,
    Permission.REQUEST_CREATE,
    Permission.REQUEST_VIEW_SELF,
    Permission.PAYROLL_VIEW_SELF,
    Permission.PAYROLL_DOWNLOAD,
  ]),
  [RoleName.TEAM_LEADER]: new Set<Permission>([
    Permission.USER_PROFILE_VIEW,
    Permission.USER_PROFILE_UPDATE,
    Permission.USER_PIN_UPDATE,
    Permission.NOTIFICATION_VIEW,
    Permission.WALLET_VIEW_SELF,
    Permission.WALLET_DEPOSIT,
    Permission.WALLET_WITHDRAW,
    Permission.WALLET_TRANSACTION_VIEW,
    Permission.PROJECT_VIEW_ACTIVE,
    Permission.REQUEST_CREATE,
    Permission.REQUEST_VIEW_SELF,
    Permission.PROJECT_CATEGORY_MANAGE,
    Permission.PROJECT_BUDGET_ALLOCATE,
    Permission.PROJECT_PHASE_MANAGE,
    Permission.PROJECT_MEMBER_MANAGE,
    Permission.PAYROLL_VIEW_SELF,
    Permission.PAYROLL_DOWNLOAD,
    Permission.REQUEST_APPROVE_TEAM_LEADER,
  ]),
  [RoleName.MANAGER]: new Set<Permission>([
    Permission.USER_PROFILE_VIEW,
    Permission.USER_PROFILE_UPDATE,
    Permission.USER_PIN_UPDATE,
    Permission.NOTIFICATION_VIEW,
    Permission.WALLET_VIEW_SELF,
    Permission.WALLET_DEPOSIT,
    Permission.WALLET_WITHDRAW,
    Permission.WALLET_TRANSACTION_VIEW,
    Permission.PROJECT_VIEW_ACTIVE,
    Permission.REQUEST_CREATE,
    Permission.REQUEST_VIEW_SELF,
    Permission.PAYROLL_VIEW_SELF,
    Permission.PAYROLL_DOWNLOAD,
    Permission.PROJECT_CREATE,
    Permission.PROJECT_UPDATE,
    Permission.PROJECT_STATUS_MANAGE,
    Permission.PROJECT_ASSIGN_LEADER,
    Permission.REQUEST_VIEW_DEPT,
    Permission.REQUEST_APPROVE_PROJECT_TOPUP,
    Permission.REQUEST_REJECT,
    Permission.DEPT_VIEW_DASHBOARD,
  ]),
  [RoleName.ACCOUNTANT]: new Set<Permission>([
    Permission.USER_PROFILE_VIEW,
    Permission.USER_PROFILE_UPDATE,
    Permission.USER_PIN_UPDATE,
    Permission.NOTIFICATION_VIEW,
    Permission.WALLET_VIEW_SELF,
    Permission.WALLET_DEPOSIT,
    Permission.WALLET_WITHDRAW,
    Permission.WALLET_TRANSACTION_VIEW,
    Permission.PROJECT_VIEW_ACTIVE,
    Permission.REQUEST_CREATE,
    Permission.REQUEST_VIEW_SELF,
    Permission.PAYROLL_VIEW_SELF,
    Permission.PAYROLL_DOWNLOAD,
    Permission.PROJECT_VIEW_ALL,
    Permission.REQUEST_VIEW_APPROVED,
    Permission.REQUEST_PAYOUT,
    Permission.TRANSACTION_APPROVE_WITHDRAW,
    Permission.WALLET_VIEW_ALL,
    Permission.PAYROLL_MANAGE,
    Permission.PAYROLL_EXECUTE,
    Permission.COMPANY_FUND_VIEW,
    Permission.COMPANY_FUND_TOPUP,
  ]),
  [RoleName.CFO]: new Set<Permission>([
    Permission.USER_PROFILE_VIEW,
    Permission.USER_PROFILE_UPDATE,
    Permission.USER_PIN_UPDATE,
    Permission.NOTIFICATION_VIEW,
    Permission.WALLET_VIEW_SELF,
    Permission.WALLET_DEPOSIT,
    Permission.WALLET_WITHDRAW,
    Permission.WALLET_TRANSACTION_VIEW,
    Permission.PROJECT_VIEW_ACTIVE,
    Permission.REQUEST_CREATE,
    Permission.REQUEST_VIEW_SELF,
    Permission.PAYROLL_VIEW_SELF,
    Permission.PAYROLL_DOWNLOAD,
    Permission.PROJECT_VIEW_ALL,
    Permission.REQUEST_VIEW_ALL,
    Permission.REQUEST_APPROVE_DEPT_TOPUP,
    Permission.REQUEST_REJECT,
    Permission.TRANSACTION_APPROVE_WITHDRAW,
    Permission.WALLET_VIEW_ALL,
    Permission.COMPANY_FUND_VIEW,
    Permission.COMPANY_FUND_TOPUP,
    Permission.DEPT_BUDGET_ALLOCATE,
    Permission.DASHBOARD_VIEW_GLOBAL,
  ]),
  [RoleName.ADMIN]: new Set<Permission>([
    Permission.USER_PROFILE_VIEW,
    Permission.USER_PROFILE_UPDATE,
    Permission.USER_PIN_UPDATE,
    Permission.NOTIFICATION_VIEW,
    Permission.WALLET_VIEW_SELF,
    Permission.WALLET_DEPOSIT,
    Permission.WALLET_WITHDRAW,
    Permission.WALLET_TRANSACTION_VIEW,
    Permission.USER_VIEW_LIST,
    Permission.USER_CREATE,
    Permission.USER_UPDATE,
    Permission.USER_LOCK,
    Permission.ROLE_MANAGE,
    Permission.PROJECT_VIEW_ACTIVE,
    Permission.DEPT_MANAGE,
    Permission.REQUEST_CREATE,
    Permission.REQUEST_VIEW_SELF,
    Permission.PAYROLL_VIEW_SELF,
    Permission.PAYROLL_DOWNLOAD,
    Permission.SYSTEM_CONFIG_MANAGE,
    Permission.AUDIT_LOG_VIEW,
  ]),
};

function allPermissions(): Permission[] {
  return Array.from(new Set(PERMISSION_GROUPS.flatMap((group) => group.permissions)));
}

function roleTone(role: RoleName): string {
  switch (role) {
    case RoleName.ADMIN:
      return "from-rose-500 to-pink-600";
    case RoleName.CFO:
      return "from-violet-500 to-indigo-600";
    case RoleName.ACCOUNTANT:
      return "from-amber-500 to-orange-600";
    case RoleName.MANAGER:
      return "from-blue-500 to-cyan-600";
    case RoleName.TEAM_LEADER:
      return "from-indigo-500 to-blue-600";
    default:
      return "from-slate-500 to-blue-600";
  }
}

export default function AdminRolesPage() {
  const permissions = allPermissions();
  const adminPermissionCount = ROLE_PERMISSION_SET[RoleName.ADMIN].size;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-indigo-700 p-6 text-white shadow-xl shadow-blue-900/10">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-50">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            RBAC policy
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Vai trò hệ thống</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
            Ma trận quyền mặc định được đồng bộ với cấu hình khởi tạo backend IFMS. Đây là cấu hình nền để tham chiếu, không phản ánh các thay đổi quyền riêng đã lưu trực tiếp trong cơ sở dữ liệu.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Role hệ thống" value={String(ROLE_ORDER.length)} />
        <StatCard label="Nhóm quyền" value={String(PERMISSION_GROUPS.length)} />
        <StatCard label="Permission duy nhất" value={String(permissions.length)} />
        <StatCard label="Quyền Admin" value={String(adminPermissionCount)} />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {ROLE_ORDER.map((role) => {
          const count = ROLE_PERMISSION_SET[role].size;
          const coverage = Math.round((count / permissions.length) * 100);

          return (
            <article key={role} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className={`h-2 bg-linear-to-r ${roleTone(role)}`} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs font-semibold text-blue-600">{role}</p>
                    <h2 className="mt-1 text-lg font-bold text-slate-900">{ROLE_LABEL[role]}</h2>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                    {count} quyền
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{ROLE_DESCRIPTION[role]}</p>
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>Độ phủ permission</span>
                    <span>{coverage}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full bg-linear-to-r ${roleTone(role)}`} style={{ width: `${coverage}%` }} />
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-blue-50/60 px-5 py-4">
          <h2 className="text-base font-bold text-slate-900">Ma trận quyền mặc định theo nhóm chức năng</h2>
          <p className="mt-1 text-sm text-slate-500">Dấu tích thể hiện role đang được cấp permission tương ứng.</p>
        </div>

        <div className="space-y-5 p-5">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.groupName} className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h3 className="text-sm font-bold text-slate-900">{group.groupName}</h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                  {group.permissions.length} chức năng
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px]">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-slate-200 bg-white">
                      <th className="px-4 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Chức năng
                      </th>
                      {ROLE_ORDER.map((role) => (
                        <th key={role} className="px-3 py-3.5 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {ROLE_LABEL[role]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.permissions.map((permission) => (
                      <tr key={permission} className="border-b border-slate-100 last:border-b-0 hover:bg-blue-50/40">
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-slate-900">{PERMISSION_COPY[permission].label}</p>
                          <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">{PERMISSION_COPY[permission].description}</p>
                        </td>
                        {ROLE_ORDER.map((role) => {
                          const allowed = ROLE_PERMISSION_SET[role].has(permission);
                          return (
                            <td key={`${permission}-${role}`} className="px-3 py-3 text-center">
                              <span
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold ${
                                  allowed
                                    ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                                    : "border-slate-200 bg-slate-50 text-slate-300"
                                }`}
                              >
                                {allowed ? "✓" : "-"}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 h-2 w-12 rounded-full bg-blue-600" />
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
