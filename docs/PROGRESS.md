# Tiến độ phát triển Frontend

> **Sau sửa 23/10 — F20–F24:** xác nhận/PIN đối chiếu theo dự án được xóa khi
> đổi phạm vi; chi tiết tách lỗi tải/404; đối soát ngân hàng có retry và chặn
> kết luận khi API lỗi; nhãn cân bằng theo phạm vi; bộ chọn ngân hàng phân trang,
> tìm mã/ngày/số tiền. 20 test backend + 12 browser qua, build production qua.
> Xem [review mới nhất](ledger-implementation-review.md).

> **Cập nhật sổ cái 23/10/2026:** đã nối API thật cho journal, sổ tài khoản,
> tạm ứng/ngân sách phân trang và các bộ Excel theo quyền; hoàn thiện URL bộ
> lọc, audit XLSX, báo cáo theo vai trò và trạng thái lỗi. Kết quả và phạm vi
> còn lại xem [báo cáo chi tiết tuần](bao-cao-chi-tiet-tuan-vua-roi.md).
> Bảng Sprint 16 bên dưới là ảnh chụp tháng 5, không mô tả đầy đủ phần sổ cái.

> File này được cập nhật sau **mỗi lần hoàn thành task**.
> Cập nhật lần cuối: **2026-05-31** (Sprint 16)

---

## Tổng quan nhanh

| Hạng mục | Số lượng | Ghi chú |
|---|---|---|
| Auth pages LIVE | 3 | login, change-password, forgot-password |
| Dashboard pages LIVE (API thật / hoàn chỉnh) | 48 | Sprint 16: xóa tất cả mock chart data Admin/Accountant dashboard |
| Dashboard pages mock (backend chưa có) | 0 | — tất cả đã wired |
| **Tổng pages** | **51** | không tính 2 orphaned đã xóa |

---

## ✅ LIVE — Auth Pages

| Page | Endpoint chính | Ghi chú |
|---|---|---|
| `(auth)/login/page.tsx` | `POST /api/v1/auth/login` | Role selector UI, handle `?reset=success` banner |
| `(auth)/change-password/page.tsx` | `POST /api/v1/auth/first-login/complete` | setupToken flow, 1 bước (MK + PIN) |
| `(auth)/forgot-password/page.tsx` | `POST /auth/forgot-password` + `POST /auth/verify-password-reset` | 2-step OTP flow — Sprint 8 |

---

## ✅ LIVE — Dashboard Pages (API thật + UI đúng)

| Page | Endpoint chính | Ghi chú |
|---|---|---|
| `wallet/page.tsx` | `GET /api/v1/wallet` + transactions | WalletContext |
| `wallet/transactions/page.tsx` | `GET /api/v1/wallet/transactions` | Filter, pagination |
| `wallet/transactions/[id]/page.tsx` | `GET /api/v1/wallet/transactions/{id}` | — |
| `wallet/deposit/page.tsx` | `POST /api/v1/wallet/deposit` | VNPay flow — DepositController (Sprint 11); link → lịch sử |
| `wallet/deposit/my/page.tsx` | `GET /api/v1/wallet/deposit/my` | Lịch sử nạp tiền — Spring Page 0-indexed, pagination, status badge — Sprint 13 |
| `wallet/withdraw/page.tsx` | `POST /api/v1/wallet/withdraw` + lịch sử | Form + cancel |
| `profile/page.tsx` | `GET/PUT /api/v1/users/me` | Avatar upload Cloudinary |
| `projects/page.tsx` | `GET /api/v1/projects` | Read-only, all roles |
| `projects/[id]/page.tsx` | `GET /api/v1/projects/{id}/phases` | — |
| `requests/page.tsx` | `GET /api/v1/requests` + summary | Employee, filter + pagination |
| `requests/new/page.tsx` | `POST /api/v1/requests` | Cascading project/phase/category |
| `requests/[id]/page.tsx` | `GET/PUT/DELETE /api/v1/requests/{id}` | Timeline, cancel, edit |
| `payroll/page.tsx` | `GET /api/v1/payslips` | Employee payslip list |
| `payroll/[id]/page.tsx` | `GET /api/v1/payslips/{id}` | Employee payslip detail |
| `notifications/page.tsx` | `GET /api/v1/notifications` | SSE prepend, mark-read |
| `team-leader/approvals/page.tsx` | `GET /api/v1/team-leader/approvals` | Flow 1 queue |
| `team-leader/approvals/[id]/page.tsx` | `POST approve/reject` | — |
| `team-leader/projects/page.tsx` | `GET /api/v1/team-leader/projects` | — |
| `team-leader/projects/[id]/page.tsx` | CRUD phases, members, budgets | 3 tabs |
| `team-leader/team/page.tsx` | `GET /api/v1/team-leader/team-members` | Wired Sprint 6 |
| `manager/approvals/page.tsx` | `GET /api/v1/manager/approvals` | PROJECT_TOPUP queue |
| `manager/approvals/[id]/page.tsx` | `POST approve/reject` | — |
| `manager/projects/page.tsx` | `GET /api/v1/manager/projects` | Wired Sprint 6 |
| `manager/projects/[id]/page.tsx` | `GET/PUT /api/v1/manager/projects/{id}` | Wired Sprint 6 |
| `manager/department/page.tsx` | `GET /api/v1/manager/department/members` | Wired Sprint 6 |
| `accountant/disbursements/page.tsx` | `GET /api/v1/accountant/disbursements` | Hàng đợi Kế toán: tạm ứng, hoàn chi cần xác nhận/thanh toán, quyết toán tạm ứng |
| `accountant/disbursements/[id]/page.tsx` | `POST disburse/pay/reject` (PIN) | EXPENSE tách xác nhận chứng từ và thanh toán hoàn chi |
| `accountant/withdrawals/page.tsx` | `GET/PUT /api/v1/wallet/withdraw` | Quản lý rút tiền của user — Sprint 9 |
| `accountant/payroll/page.tsx` | `GET /api/v1/accountant/payroll` + `POST` | List + tạo kỳ lương + tải template — Sprint 10 |
| `accountant/payroll/[id]/page.tsx` | `GET/PUT/POST import/auto-netting/run` | 4-step workflow, FormData import, 409 overwrite — Sprint 10 |
| `accountant/payslips/[id]/page.tsx` | `GET /api/v1/accountant/payslips/{id}` | Chi tiết phiếu lương kế toán — breadcrumb, salary breakdown table — Sprint 15 |
| `accountant/ledger/page.tsx` | `GET /accountant/ledger/wallet-transactions`, `/journals`, `/advances/outstanding`, `/budget-exposure`, `/summary` | Giao dịch ví, journal kế toán, tạm ứng và ngân sách theo đối tượng |
| `accountant/ledger/[id]/page.tsx` | `GET /accountant/ledger/{id}` | Chi tiết giao dịch và biến động từng ví; tách khỏi journal |
| `accountant/ledger/journals/[journalId]/page.tsx` | `GET /accountant/ledger/journals/{journalId}` | Chi tiết dòng tài khoản, cân bằng và tham chiếu nguồn |
| `accountant/ledger/demo/page.tsx` | Mock data cục bộ | Demo tĩnh độc lập, không phải dữ liệu thật |
| `admin/users/page.tsx` | `GET/POST /api/v1/admin/users` | Lock/unlock/reset-password |
| `admin/users/[id]/page.tsx` | `GET/PUT /api/v1/admin/users/{id}` | Role + dept edit |
| `admin/departments/page.tsx` | `GET /api/v1/admin/departments` | CRUD |
| `admin/departments/[id]/page.tsx` | `GET/PUT/DELETE /api/v1/admin/departments/{id}` | — |
| `admin/audit-logs/page.tsx` | `GET /api/v1/admin/audit` | Filter, pagination, detail modal |
| `admin/settings/page.tsx` | `GET/PUT /api/v1/admin/settings` | AdminSettingsController, batch update `{configs:[]}`, evict cache — migrated Sprint 15 |
| `admin/system-fund/page.tsx` | `GET /api/v1/company-fund` + topup | Fixed diacritics Sprint 7 |
| `admin/roles/page.tsx` | — | Static permission matrix, no API needed |
| `admin/approvals/page.tsx` | — | Redirect → `/dashboard` (by design) |
| `cfo/approvals/page.tsx` | `GET /api/v1/cfo/approvals` | DEPARTMENT_TOPUP queue |
| `cfo/approvals/[id]/page.tsx` | `POST approve/reject` | — |
| `cfo/system-fund/page.tsx` | `GET /api/v1/company-fund` + topup | Fixed diacritics Sprint 7 |
| `cfo/audit-logs/page.tsx` | — | Re-export từ `admin/audit-logs/page` |
| `cfo/settings/page.tsx` | — | Re-export từ `admin/settings/page` |
| `dashboard/page.tsx` | Composite + dedicated endpoints — Sprint 12/16 | Employee/TL: compose từ API có sẵn. Manager: `/api/v1/dashboard/manager`. Accountant: `/api/v1/dashboard/accountant`. CFO: `/api/v1/dashboard/cfo`. Admin: `/api/v1/dashboard/admin` |

**Trạng thái sổ cái kế toán (10/10/2026):** đã nối journal cho ADVANCE/EXPENSE/REIMBURSE/hoàn tạm ứng/payroll, SYSTEM_TOPUP và phân bổ nội bộ; bổ sung audit V20, bộ lọc đối tượng, báo cáo ngân sách tách chi phí/tiền khóa/tạm ứng và giao diện nhân viên hoàn tạm ứng tại /wallet. Backend compile và frontend build thành công. Chưa áp dụng V19/V20 hoặc chạy end-to-end vì DATABASE_URL chưa cấu hình và Docker Engine chưa chạy; xem [`ledger-accounting.md`](ledger-accounting.md) và [`ledger-redesign-plan.md`](ledger-redesign-plan.md).

---

## Nhật ký thay đổi

### Sprint 16 — 2026-05-31

**Mục tiêu:** Implement analytics API (thay mock data), fix dashboard URLs, filter nạp tiền, PIN attempts

| Task | Kết quả |
|---|---|
| Backend: thêm `GET /dashboard/cfo` + `GET /dashboard/admin` | `DashboardController` expose 2 endpoint còn thiếu (service đã có, chưa có controller) |
| Fix URL CFO dashboard | `cfo-dashboard.tsx`: `/api/v1/cfo/dashboard` → `/api/v1/dashboard/cfo` |
| Fix URL Admin dashboard | `admin-dashboard.tsx`: `/api/v1/admin/dashboard` → `/api/v1/dashboard/admin` |
| Backend: `PinVerifyResponse` thêm `attemptsRemaining` | Nhập sai PIN trả HTTP 200 `{ valid: false, attemptsRemaining: N }` thay vì HTTP 401 |
| Frontend: hiển thị số lần thử PIN còn lại | `disbursements/[id]/page.tsx`: "Còn N lần thử" dưới ô PIN |
| Backend: filter deposit history | `GET /wallet/deposit/my` nhận thêm `status`, `from`, `to` |
| Frontend: filter UI deposit history | `wallet/deposit/my/page.tsx`: dropdown status + date range + nút Lọc/Xóa lọc |
| Backend: 2 analytics endpoints mới | `GET /dashboard/analytics/cashflow` (period + unit) + `GET /dashboard/admin/analytics` (dept spending + top debtors) |
| Frontend: xóa mock `CASHFLOW` (accountant) | `accountant-dashboard.tsx` gọi `getCashFlowAnalytics(period, "million")`, skeleton loading |
| Frontend: xóa 3 mock (admin) | `admin-dashboard.tsx` xóa `CASHFLOW`, `DEPT_SPENDING`, `TOP_DEBTORS` — gọi real API song song, empty/loading states |
| Tạo `lib/api/analytics.ts` | `getCashFlowAnalytics()` + `getAdminAnalytics()` |
| Thêm types analytics | `types/dashboard.ts`: `CashFlowPoint`, `CashFlowAnalyticsResponse`, `AdminAnalyticsResponse` |
| `npm run lint` | ✅ 0 errors |

**Lưu ý kỹ thuật Sprint 16:**
- `DashboardController` mount tại `/api/v1/dashboard` — CFO/Admin phải gọi `/dashboard/cfo` và `/dashboard/admin`, KHÔNG phải `/cfo/dashboard` hay `/admin/dashboard`
- `getCashFlowAnalytics` với `unit=million`: backend chia cho 1_000_000 với `setScale(2, HALF_UP)` — chart Accountant nhận số triệu, không cần FE chia
- `getAdminAnalytics` lấy dept spending MTD (từ đầu tháng đến hiện tại) từ DEBIT của DEPARTMENT wallet
- `findTopDebtorsSystemWide` group theo user, lấy `MIN(createdAt)` làm ngày advance lâu nhất — `daysSinceDisbursement` tính từ đó
- `attemptsRemaining` chỉ có trong response khi `valid: false` (null khi valid = true)
- Deposit filter: backend dùng JPQL với nullable params (`:status IS NULL OR d.status = :status`)

---

### Sprint 15 — 2026-05-30

**Mục tiêu:** Tích hợp tất cả 5 endpoint chưa wired (TODO_IMPROVEMENTS §5.1–5.5) + fix ESLint

| Task | Kết quả |
|---|---|
| 5.1 — Migrate `admin/settings` → `AdminSettingsController` | Đổi `getAllConfigs/updateConfig` → `getAdminSettings/updateAdminSettings`; fix field `items→configs` trong `UpdateSettingsBody` |
| 5.2 — Tạo `accountant/payslips/[id]/page.tsx` | Trang chi tiết phiếu lương kế toán; breadcrumb, salary table, net salary highlight; link "Chi tiết" từ payroll detail Step 2 |
| 5.3 — Pre-verify PIN trước disburse | `handleDisburse()` gọi `POST /users/me/pin/verify` trước `POST /disbursements/{id}/disburse` — block sớm khi PIN sai |
| 5.4 — Delete category trong TL project detail | Nút "Xóa" per row trong budget tab; confirm modal; disabled khi `currentSpent>0`; body `{phaseId,categoryId}` |
| 5.5 — Create custom expense category trong TL project detail | Nút "+ Thêm danh mục"; modal tạo category (name, description, budgetLimit); auto-refresh list |
| Fix ESLint `scripts/admin-smoke.spec.cjs` | Thêm `scripts/**` + `logs/**` vào `globalIgnores` trong `eslint.config.mjs` |
| Thêm types `RemoveCategoryBody`, `CreateExpenseCategoryBody` | Vào `types/project.ts` |
| `npm run lint` | ✅ 0 errors |

**Lưu ý kỹ thuật Sprint 15:**
- `api.delete(url, options)` không auto-serialize body — phải dùng `{ body: JSON.stringify(obj) }` thủ công
- `api.post/put(url, body)` auto-serialize qua `JSON.stringify` — không cần wrap thủ công
- `AdminSettingsController.GET /admin/settings` trả `{ items: SystemConfigResponse[] }` (wrapper `SettingsListResponse`)
- `AdminSettingsController.PUT /admin/settings` nhận `{ configs: [{key,value}][] }` (không phải `items`)

---

### Sprint 14 — 2026-05-11

**Mục tiêu:** Code quality & UX improvements — xóa duplicate, thêm tính năng nhỏ

| Task | Kết quả |
|---|---|
| Xóa stale TODO comment `accountant/payroll/page.tsx:77` | 1 comment stale xóa |
| Dedup `formatCurrency` + `formatRelativeTime` | Xóa 11 local function defs trong 5 dashboard components — import từ `@/lib/format` |
| Dedup `formatDateTime` trong `admin-dashboard.tsx` | Xóa local def, import từ `@/lib/format` |
| Rename `formatDate→formatDateTime` trong `employee-dashboard.tsx` | Local `formatDate` (behavior của `formatDateTime`) → import thật |
| Link "Lịch sử nạp" từ `wallet/page.tsx` | Thêm button cạnh nút "Nạp tiền" trong hero card |
| Re-open VNPay cho PENDING deposits | `wallet/deposit/my`: row PENDING + `paymentUrl` non-null hiện nút "Thanh toán" |
| Tạo `docs/TODO_IMPROVEMENTS.md` | Ghi nhận 4 feature cần backend: charts analytics, export CSV/PDF, date filter deposit, PIN attempt count |
| `npm run lint` | ✅ 0 errors |

---

### Sprint 13 — 2026-05-11

**Mục tiêu:** Implement trang lịch sử nạp tiền VNPay — lỗ hổng cuối cùng của MVP

| Task | Kết quả |
|---|---|
| Tạo `app/(dashboard)/wallet/deposit/my/page.tsx` | `GET /api/v1/wallet/deposit/my` — Spring Page 0-indexed, bảng 6 cột, pagination, status badge |
| Thêm import `Link` vào `wallet/deposit/page.tsx` | Link "Lịch sử nạp tiền" → `/wallet/deposit/my` trong header của trang deposit |
| Cập nhật docs (PROGRESS.md, API_CONTRACT.md) | Tổng pages: 49→50; LIVE: 46→47; completion 96%→100% |
| `npm run lint` | ✅ 0 errors |

**Lưu ý kỹ thuật Sprint 13:**
- Endpoint trả Spring Page (0-indexed): `content[]`, `totalElements`, `totalPages`, `number`, `size`
- `DepositStatus`: `PENDING` (amber), `COMPLETED` (emerald), `FAILED` (rose)
- `paidAt` có thể `null` khi giao dịch chưa hoàn thành — dùng `formatDateTime(null)` → "—"
- `vnpTransactionNo` có thể `null` — hiển thị "—" khi trống

---

### Sprint 12 — 2026-05-11

**Mục tiêu:** Sync với backend commit `bf67900` — Dashboard API cho Manager, Accountant, CFO, Admin

| Task | Kết quả |
|---|---|
| Phân tích backend commit `bf67900` | `DashboardController` + `CfoDashboardController` + `AdminDashboardController` confirmed live — 4 dedicated endpoints |
| Fix type `types/dashboard.ts` | `AccountantDashboardResponse.payrollStatus` → nullable (`\| null`) — backend trả `null` khi chưa có kỳ lương nào |
| Fix optional chaining `accountant-dashboard.tsx` | 2 chỗ `payrollStatus.status`/`payrollStatus.latestPeriod` → `payrollStatus?.status`/`payrollStatus?.latestPeriod` |
| Xóa TODO sprint comments | Xóa 7 comment `// TODO: Replace when Sprint X is complete` trong 4 dashboard components |
| `npm run lint` | ✅ 0 errors |

**Lưu ý kỹ thuật Sprint 12:**
- Tất cả 4 component dashboard đã gọi đúng endpoint từ trước — mock chỉ là fallback khi API down. Không cần thay đổi logic gọi API.
- Backend `getAccountantDashboard()` có thể trả `payrollStatus: null` khi chưa có kỳ lương nào (`.orElse(null)` trong Java)
- Manager dashboard dùng `Promise.all` — nếu bất kỳ 1 trong 3 API fail thì toàn bộ fallback mock
- CFO/Admin dùng: dedicated endpoint → fallback compose từ endpoints có sẵn → fallback mock
- Employee/TL không có dedicated endpoint, compose từ nhiều API song song (`Promise.allSettled`)

---

### Sprint 11 — 2026-05-02

**Mục tiêu:** Sync với backend commit `2a1d198` — DepositController redesign (breaking API change)

| Task | Kết quả |
|---|---|
| Phân tích backend commit `2a1d198` | `DepositController` mới tại `/wallet/deposit`; `POST /payments` không còn là endpoint nạp tiền |
| Thêm types vào `types/wallet.ts` | `DepositStatus` enum, `DepositLogResponse` interface, `CreateDepositRequest` interface |
| Rewrite `lib/api/payment.ts` | Đổi endpoint `POST /payments` → `POST /wallet/deposit`; xóa `generateDepositCode()`, `getPaymentStatus()`; thêm `getMyDeposits()` |
| Rewrite `app/(dashboard)/wallet/deposit/page.tsx` | Đổi type `PaymentCreateResponse` → `DepositLogResponse`; xóa countdown timer (không còn `expiredAt`); xóa check-status (không còn `transactionRef`); copy `depositCode` thay vì `transactionRef` |
| Fix `DepositModal` trong `wallet/page.tsx` | Tương tự — xóa `formatSecondsToClock`, countdown, check-status; cập nhật type và field |
| `npm run lint` | ✅ 0 errors |

**Lưu ý kỹ thuật Sprint 11:**
- Backend tự sinh `depositCode` — FE không gửi lên nữa
- `DepositLogResponse` không có `expiredAt`, `transactionRef`, `qrCode`, `message` — các field này bị xóa khỏi UI
- Wallet tự cập nhật qua SSE `wallet.updated` khi VNPay IPN callback thành công — không cần FE poll
- `GET /wallet/deposit/my` endpoint mới (lịch sử nạp) — API function `getMyDeposits()` đã thêm, chưa có UI page

---

### Sprint 10 — 2026-05-01

**Mục tiêu:** Unblock 4 accountant pages blocked từ Sprint 1 — backend commit `d3b30aa`

| Task | Kết quả |
|---|---|
| Phân tích backend commit `d3b30aa` (87 files, 4665 lines) | `AccountantPayrollController` + `AccountantLedgerController` confirmed live |
| Fix `types/accounting.ts` | `PayrollImportResponse.status: string`; redesign `PayrollImportEntry` standalone (bỏ `extends PayrollEntry`, nullable id/payslipCode/userId) |
| Thêm types vào `types/wallet.ts` | `AccountantLedgerItemResponse`, `AccountantLedgerEntryItem`, `AccountantTransactionDetailResponse`, `AccountantLedgerFilterParams` |
| Wire `accountant/payroll/page.tsx` | Xóa `ENDPOINT_BLOCKED`; filter: `year`+`status`+`page`+`limit`; POST type: `PayrollDetailResponse`; thêm "Tải template" button |
| Wire `accountant/payroll/[id]/page.tsx` | Xóa 4 mock guards; import real với `FormData`, 409 → `POST /confirm-overwrite` → retry; auto-netting + run thật |
| Wire `accountant/ledger/page.tsx` | Thay `TransactionResponse` → `AccountantLedgerItemResponse`; cột mới: direction, walletOwnerType, balanceAfter; filter: type+status+referenceType+from+to |
| Wire `accountant/ledger/[id]/page.tsx` | Thay `TransactionResponse` → `AccountantTransactionDetailResponse`; thêm bảng bút toán kép; import `formatDateTime` từ lib |
| `npm run lint` | ✅ 0 errors |

**Lưu ý kỹ thuật Sprint 10:**
- Ledger list không trả `description`/`referenceCode` → bỏ 2 cột đó, thêm `direction`+`walletOwnerType`
- `POST /accountant/payroll` trả `PayrollPeriodDetailResponse` (không phải `PayrollPeriodListItem`)
- Import 409 = period đã có payslip → gọi `POST /confirm-overwrite` rồi retry (không phải local check)
- `PayrollImportEntryResponse` không có `avatar`/`jobTitle` — map thành `avatar: null, jobTitle: null`
- Backend `PayrollImportResultResponse.status` là `String` (không phải `PayrollStatus` enum)

---

### Sprint 9 — 2026-04-30

**Mục tiêu:** Cleanup + UX gap fixes + cập nhật docs

| Task | Kết quả |
|---|---|
| Fix `login/page.tsx` handle `?reset=success` | Banner emerald "Đặt lại mật khẩu thành công" hiển thị sau forgot-password |
| Xác nhận `accountant/withdrawals` đã trong sidebar | Sidebar layout đã có "Yêu cầu rút tiền" → `/accountant/withdrawals` từ trước |
| Thêm `accountant/withdrawals/page.tsx` vào PROGRESS tracking | `GET/PUT /api/v1/wallet/withdraw` — 41 LIVE dashboard pages |
| Xóa orphaned pages | `register/page.tsx` + `create-pin/page.tsx` — không có backend endpoint |
| Cập nhật toàn bộ docs | PROGRESS, CODEX_INTEGRATION_PLAN, CODEX_UI_COMPLETION, PROJECT_STRUCTURE |

---

### Sprint 8 — 2026-04-30

**Mục tiêu:** Implement forgot-password flow (2 bước: request OTP → verify OTP)

| Task | Kết quả |
|---|---|
| Phân tích backend `ForgotPasswordRequest.java` | `{ email, newPassword, confirmPassword }` — không phải chỉ `email` |
| Phân tích backend `ForgotPasswordOtpData.java` | Redis cache lưu `{ email, newPassword, otp }` — mật khẩu mới ở step 1 |
| Cập nhật `types/auth.ts` | Fix `ForgotPasswordRequest` thêm `newPassword` + `confirmPassword`; thêm `VerifyOtpPasswordResetRequest` |
| Cập nhật `lib/auth.ts` | Thêm `verifyPasswordReset()` → `POST /api/v1/auth/verify-password-reset` |
| Tạo `app/(auth)/forgot-password/page.tsx` | 2-step state machine: Step 1 nhập email+MK mới → Step 2 nhập OTP → redirect /login |
| Cập nhật `app/(auth)/login/page.tsx` | Thêm link "Quên mật khẩu?" → `/forgot-password` |

**Flow xác nhận:**
- Step 1: `POST /auth/forgot-password { email, newPassword, confirmPassword }` → backend lưu MK mới vào Redis + gửi OTP email
- Step 2: `POST /auth/verify-password-reset { email, otp }` → backend áp dụng MK mới từ Redis → user đăng nhập lại

---

### Sprint 7 — 2026-04-29

**Mục tiêu:** Phát hiện và sửa các lỗi chất lượng UI trên pages đã LIVE

| Task | Kết quả |
|---|---|
| Phát hiện: nhiều pages STATIC/TODO đã thực ra LIVE | `payroll/page`, `wallet/withdraw`, tất cả CFO/Admin pages |
| Fix diacritics `cfo/system-fund/page.tsx` | ~20 chuỗi tiếng Việt không dấu → đúng chuẩn |
| Fix diacritics `admin/system-fund/page.tsx` | ~20 chuỗi tiếng Việt không dấu → đúng chuẩn |
| Fix diacritics `admin/audit-logs/page.tsx` | ~15 chuỗi tiếng Việt không dấu → đúng chuẩn |
| Fix color bug `cfo/approvals/page.tsx` | 2 chỗ `text-slate-100` → `text-slate-900` (text vô hình) |
| Fix color bug `admin/audit-logs/page.tsx` (InfoCard) | `text-slate-100` → `text-slate-900` trong modal chi tiết |
| Cập nhật `PROGRESS.md` | Sửa lại trạng thái thực tế: 40/45 pages LIVE (~89%) |

**Lưu ý:** `text-slate-100` trên `bg-white` = text gần như vô hình. Luôn kiểm tra color contrast khi render số tiền.

---

### Sprint 6 — 2026-04-29

**Mục tiêu:** Unblock + wire 4 pages Manager/TL vừa có backend endpoint

| Task | Kết quả |
|---|---|
| Fix type mismatch `ManagerDeptMemberDetailResponse` | Xóa field `recentRequests` không tồn tại ở backend |
| Wire `team-leader/team/page.tsx` | Xóa `TL_TEAM_ENDPOINT_BLOCKED`, fix `projectOptions` mock contamination |
| Wire `manager/projects/page.tsx` | Xóa block flag, fix pagination `toApiPage` → 1-indexed + `limit` param |
| Wire `manager/projects/[id]/page.tsx` | Xóa block flag + xóa 90 dòng dead code |
| Wire `manager/department/page.tsx` | Xóa block flag, fix pagination, xóa UI "Yêu cầu gần đây" |
| Cập nhật `docs/CODEX_INTEGRATION_PLAN.md` | Thêm Sprint 6, cập nhật coverage matrix |

**Lưu ý kỹ thuật:**
- Endpoints TL/Manager mới: `page` 1-indexed + `limit` param (≠ Spring Data `page`/`size` 0-indexed)

---

### Sprint 5 — 2026-04-28 (tóm tắt)

Wire `notifications`, `cfo/system-fund`, `admin/settings`, `cfo/approvals/[id]`, nhiều pages nhóm A+B.

---

## Backend còn thiếu (blocker cho FE)

Không còn blocker. 48/51 dashboard pages dùng API thật. 3 pages static: `admin/roles`, `admin/approvals` (redirect), `cfo/audit-logs` + `cfo/settings` (re-export từ admin).

**Sprint 16 đã giải quyết:** analytics charts (Admin + Accountant), deposit filter, PIN attempts, dashboard URL fixes.

**Còn tồn đọng:** Export CSV/PDF (chưa có backend endpoint) — xem `TODO_IMPROVEMENTS.md §2`. ~~`MOCK_MONTHLY` trong `employee-dashboard.tsx`~~ đã thay bằng API thật `GET /api/v1/dashboard/analytics/employee` (Sprint 17).

---

## Ghi chú conventions quan trọng

- **Pagination mới** (TL/Manager): `page=1` (1-indexed) + `limit=N` — KHÔNG dùng `toApiPage()`
- **Pagination cũ** (Spring Data): `page=0` (0-indexed) + `size=N` — dùng `toApiPage()`
- **Mock fallback trong catch**: là OK — defensive UX. BLOCKED = có constant `ENDPOINT_BLOCKED = true`
- **Color**: không dùng `text-slate-100`/`text-slate-200` cho text trên nền trắng
- **API client**: chỉ dùng `api` từ `@/lib/api-client`
- **Types**: chỉ import từ `@/types` barrel
- **Auth pages**: không kể vào tổng dashboard pages — tracking riêng
- **Orphaned pages đã xóa**: `register/page.tsx`, `create-pin/page.tsx` — middleware vẫn để `/register` + `/create-pin` trong PUBLIC_ROUTES (vô hại, route 404)
