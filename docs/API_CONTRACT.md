# API_CONTRACT.md - Frontend/Backend Contract

> **Phụ lục sổ cái 23/10/2026:** các contract kế toán/Excel bên dưới cập nhật
> các mục lịch sử của file này. Xem [báo cáo triển khai](bao-cao-chi-tiet-tuan-vua-roi.md)
> về mức kiểm chứng.

## Contract sổ cái và Excel hiện hành

Base path là `/api/v1`. Các API JSON dùng `ApiResponse<T>`; `PageResponse<T>`
gồm `items`, `total`, `page`, `size`, `totalPages` và nhóm API dưới đây dùng
**page bắt đầu từ 1**. File export trả XLSX.

| API | Tham số chính | Kết quả / lưu ý |
|---|---|---|
| `GET /accountant/ledger/bank-evidence/topup-candidates` | `search` theo mã sao kê, `from`, `to`, `amount` đúng số tiền, `page=1`, `limit=20` (tối đa 100) | `PageResponse<BankCandidateResponse>`; chỉ tài khoản đang đối soát, IN/BOOKED chưa dùng, gồm xác nhận BOOKED cho dòng PENDING. |
| `GET /accountant/ledger/bank-evidence/{id}/candidates` | `search` theo mã giao dịch IFMS, `from`, `to`, `page=1`, `limit=20` (tối đa 100) | `PageResponse<BankCandidateResponse>`; số tiền/chiều tự lấy từ sao kê id; lọc biến động công ty ròng trước phân trang, loại giao dịch đã khớp và phân bổ nội bộ. |
| `GET /accountant/ledger/advances/outstanding` | `search`, `page=1`, `limit=20` | `PageResponse<AdvanceEmployeeSummaryResponse>`; nhóm theo nhân viên, mỗi nhân viên có từng khoản còn mở. |
| `GET /accountant/ledger/budget-exposure` | `search`, `page=1`, `limit=20` | `PageResponse<LedgerProjectBudgetResponse>`; một dự án gồm giai đoạn và danh mục. |
| `GET /accountant/ledger/journals` | `event`, `from`, `to`, `employeeId`, `projectId`, `requestId`, `page`, `limit` | `PageResponse<AccountingJournalItemResponse>`. |
| `GET /accountant/ledger/accounts` | `account`, `event`, `from`, `to`, `employeeId`, `projectId`, `departmentId`, `phaseId`, `categoryId`, `page`, `limit` | `AccountLedgerResponse`; event áp dụng cả đầu kỳ, phát sinh và số dư chạy trong phạm vi đang lọc. |
| `GET /admin/audit` | `actorId`, `actor` (tên/email), `action`, `entityName`, `from`, `to`, `page`, `limit` | `PageResponse<AuditLogResponse>`; cùng bộ lọc với file xuất. |
| `GET /spreadsheets/lookups/{kind}` | `kind` = `employee`, `project`, `department`, `phase`, `category`, `request`; `search`, `id`, `parent`, `page=1`, `limit=20` | `PageResponse<{id,label}>`; quyền và phạm vi được áp dụng tại server, `id` dùng để khôi phục nhãn lựa chọn từ URL, `parent` giới hạn giai đoạn/danh mục/yêu cầu. |
| `GET /spreadsheets/{dataset}/export` | `scope` và các bộ lọc dataset hỗ trợ | XLSX của toàn bộ kết quả phù hợp trong giới hạn server; vượt giới hạn báo lỗi, không cắt âm thầm. `audit-history` nhận bộ lọc audit, `account-balances` nhận `event`, `journals` nhận `requestId`. |
| `GET /spreadsheets/exports/history` | — | Lịch sử xuất có kiểm soát quyền. |

`BankCandidateResponse` gồm `id`, `label`, `referenceCode`, `date` (YYYY-MM-DD),
`amount` (signed ở giao dịch, dương ở chứng từ nạp). Hai endpoint chỉ CFO/ACCOUNTANT;
ngày đảo chiều, page/limit/số tiền không hợp lệ trả 400. `from`/`to` bao gồm
hai đầu; không truyền ngày thì tìm toàn lịch sử. Contract này thay mảng cũ,
cần triển khai frontend và backend cùng phiên bản. Chọn một ứng viên không tự
chuyển tiền/khớp sao kê; khi xác nhận, server vẫn khóa và kiểm lại chứng cứ.

Bốn dataset báo cáo mới: `department-employees` và `department-budgets`
(MANAGER/CFO/ACCOUNTANT); `project-cost-details`
(MANAGER/TEAM_LEADER/CFO/ACCOUNTANT); `bank-reconciliation-summary`
(CFO/ACCOUNTANT). Đây là **ảnh chụp số liệu hiện tại**, không nhận `from`/`to`.
Bộ chọn tên/mã chỉ là cách nhập ID có kiểm soát, server vẫn kiểm tra scope khi xuất.

---

> Version: 4.0 (2026-05-31)
> Source priority: backend runtime source code > backend docs > frontend docs
> Roles: EMPLOYEE, TEAM_LEADER, MANAGER, ACCOUNTANT, CFO, ADMIN
>
> **Thay đổi v4.0 (Sprint 16):**
> - `POST /users/me/pin/verify` — response thêm `attemptsRemaining?: number`; sai PIN trả HTTP 200 `{ valid: false }` thay vì HTTP 401
> - `GET /wallet/deposit/my` — thêm params filter `status`, `from`, `to`
> - Thêm §17: Analytics endpoints `GET /dashboard/analytics/cashflow` + `GET /dashboard/admin/analytics`
> - CFO dashboard URL đổi: `/cfo/dashboard` → `/dashboard/cfo`
> - Admin dashboard URL đổi: `/admin/dashboard` → `/dashboard/admin`
>
> **Thay đổi v3.6 (Sprint 13–15):** `GET /wallet/deposit/my` — FE page implemented. `GET /dashboard/cfo` + `/dashboard/admin` — backend expose. MVP 100% complete.
> **Thay đổi v3.4:** Thêm §16 Dashboard endpoints. SSE transport.

## Base URL

- Backend: `http://localhost:8080/api/v1`
- Frontend call: `/api/v1/...` via Next.js proxy

## Response Wrapper

```json
{
  "success": true,
  "message": "Success",
  "data": {},
  "timestamp": "2026-04-08T10:30:00"
}
```

TypeScript: `ApiResponse<T>`

## Pagination

Hầu hết endpoints mới dùng `PageResponse<T>`:

```json
{ "items": [], "total": 0, "page": 0, "size": 20, "totalPages": 0 }
```

Một số endpoint cũ hơn dùng `page`/`limit` (1-indexed). Xem từng endpoint cụ thể.

---

## 1. Authentication (`/auth`)

| Method | Endpoint                      | Body                            | Response        | Auth |
| ------ | ----------------------------- | ------------------------------- | --------------- | :--: |
| POST   | `/auth/login`                 | `LoginRequest`                  | `LoginResponse` |  No  |
| POST   | `/auth/logout`                | -                               | `{ message }`   | Yes  |
| POST   | `/auth/refresh-token`         | `RefreshTokenRequest`           | `LoginResponse` | Yes  |
| POST   | `/auth/first-login/complete`  | `FirstLoginSetupRequest`        | `LoginResponse` |  No  |
| POST   | `/auth/change-password`       | `ChangePasswordRequest`         | `{ message }`   | Yes  |
| POST   | `/auth/forgot-password`       | `ForgotPasswordRequest`         | `{ message }`   |  No  |
| POST   | `/auth/verify-password-reset` | `VerifyOtpPasswordResetRequest` | `{ message }`   |  No  |
| GET    | `/auth/me`                    | -                               | `AuthUser`      | Yes  |

Notes:

- `LoginResponse` gồm `{ accessToken, refreshToken, requiresSetup, setupToken, user: AuthUser }`
- First-login: `requiresSetup = true` → `setupToken` cấp, không có `accessToken/refreshToken`
- Forgot-password flow 2 bước: `/auth/forgot-password` (gửi OTP email) → `/auth/verify-password-reset` (nhập OTP + MK mới)

---

## 2. Profile and Security (`/users/me`, `/banks`, `/users/stream`)

| Method | Endpoint               | Body                    | Response              |
| ------ | ---------------------- | ----------------------- | --------------------- |
| GET    | `/users/me/profile`    | -                       | `UserProfileResponse` |
| PUT    | `/users/me/profile`    | `UpdateProfileRequest`  | `UserProfileResponse` |
| PUT    | `/users/me/avatar`     | `UpdateAvatarRequest`   | `{ avatar: string }`  |
| PUT    | `/users/me/bank-info`  | `UpdateBankInfoRequest` | `BankInfo`            |
| PUT    | `/users/me/pin`        | `UpdatePinRequest`      | `{ message }`         |
| POST   | `/users/me/pin/verify` | `VerifyPinRequest`      | `{ valid: boolean, attemptsRemaining?: number }` |
| GET    | `/banks`               | -                       | `BankOption[]`        |
| GET    | `/users/stream`        | -                       | SSE stream — xem §15  |

Notes:

- Avatar là Signed URL Cloudinary (hết hạn 15 phút)
- PIN: 5 chữ số. Nhập sai > 5 lần → khoá 30 phút (`423 Locked`)
- `POST /users/me/pin/verify` khi sai PIN: HTTP 200 `{ valid: false, attemptsRemaining: N }` — KHÔNG throw 401. Chỉ throw 401 khi format PIN sai (không phải 5 chữ số). Throw 423 khi PIN đã bị khóa.
- `PUT /users/me/pin` body: `{ currentPin, newPin }` — đổi PIN khi đã có PIN
- `GET /users/stream` là endpoint realtime duy nhất (SSE). Mở 1 connection cho cả session để nhận mọi event của user hiện tại.

---

## 3. File Storage (`/uploads`)

| Method | Endpoint                                    | Response                                              |
| ------ | ------------------------------------------- | ----------------------------------------------------- |
| GET    | `/uploads/signature?folder=AVATAR\|REQUEST` | `{ signature, timestamp, cloudName, apiKey, folder }` |

Client-direct upload flow:

1. Lấy signature từ backend
2. Upload file trực tiếp lên Cloudinary với signature
3. Gửi metadata (`fileName`, `cloudinaryPublicId`, `url`, `fileType`, `size`) đến API nghiệp vụ

---

## 4. Wallet, Transactions, Deposit, Withdraw

### Wallet (`/wallet`)

| Method | Endpoint                               | Params                      | Response                            |
| ------ | -------------------------------------- | --------------------------- | ----------------------------------- |
| GET    | `/wallet`                              | -                           | `WalletResponse`                    |
| GET    | `/wallet/transactions`                 | `?from=&to=&page=0&size=20` | `PageResponse<LedgerEntryResponse>` |
| GET    | `/wallet/transactions/{transactionId}` | -                           | `TransactionResponse`               |

**WalletResponse:**

```json
{
  "id": 1,
  "ownerType": "USER",
  "ownerId": 1,
  "balance": 10250000,
  "lockedBalance": 2000000,
  "availableBalance": 8250000
}
```

> `availableBalance = balance - lockedBalance` (computed field)

**LedgerEntryResponse** (trong danh sách giao dịch):

```json
{
  "id": 101,
  "transactionCode": "TXN-8829145A",
  "direction": "CREDIT",
  "amount": 15000000,
  "balanceAfter": 15250000,
  "createdAt": "2026-02-10T09:00:00Z"
}
```

> `direction`: `DEBIT | CREDIT` — CREDIT là tiền vào, DEBIT là tiền ra

**TransactionResponse** (chi tiết 1 giao dịch):

```json
{
  "id": 102,
  "transactionCode": "TXN-9A33BC21",
  "amount": 2000000,
  "type": "WITHDRAW",
  "status": "SUCCESS",
  "referenceType": "WITHDRAWAL",
  "referenceId": 12,
  "description": "Rut tien - VCB20260405103000000001",
  "createdAt": "2026-02-22T10:05:00"
}
```

### Deposit (`/wallet/deposit`) — DepositController

> **Breaking change v3.4 (2026-05-02):** Endpoint nạp tiền chuyển từ `POST /payments` (PaymentController) sang `POST /wallet/deposit` (DepositController). Backend giờ tự sinh `depositCode` — FE không gửi.

| Method | Endpoint                                                      | Body / Params          | Response                         | Auth |
| ------ | ------------------------------------------------------------- | ---------------------- | -------------------------------- | :--: |
| POST   | `/wallet/deposit`                                             | `CreateDepositRequest` | `DepositLogResponse`             | Yes  |
| GET    | `/wallet/deposit/my?page=0&size=10&status=&from=&to=`         | —                      | `PageResponse<DepositLogResponse>` | Yes  |

**CreateDepositRequest body:**

```json
{
  "amount": 500000,
  "bankCode": "NCB",
  "locale": "vn"
}
```

> `amount` bắt buộc, min 10.000 VND. `bankCode` và `locale` optional. Backend tự sinh `depositCode`.

**DepositLogResponse:**

```json
{
  "id": 1,
  "depositCode": "DEP-20260502-XXXX",
  "amount": 500000,
  "status": "PENDING",
  "paymentUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?...",
  "vnpTransactionNo": null,
  "paidAt": null,
  "createdAt": "2026-05-02T10:00:00"
}
```

> `DepositStatus`: `PENDING | COMPLETED | FAILED`
> `paymentUrl`: non-null khi vừa tạo — FE mở URL này để user thanh toán.
> `vnpTransactionNo`, `paidAt`: `null` khi chưa hoàn thành.
> Khi VNPay IPN callback về, backend cập nhật `status → COMPLETED` + credit wallet. SSE `wallet.updated` tự push về FE.
> `GET /wallet/deposit/my` trả `PageResponse<T>` chuẩn (0-indexed): `{ items[], total, page, size, totalPages }`.
> Filter params: `status=PENDING|COMPLETED|FAILED` (optional), `from=YYYY-MM-DD` (optional), `to=YYYY-MM-DD` (optional).
> FE page: `wallet/deposit/my` — có dropdown status + date range filter.

**IPN / Return callbacks (server-to-server, FE không gọi trực tiếp):**

| Method | Endpoint                     | Auth |
| ------ | ---------------------------- | :--: |
| GET    | `/payments/{gateway}/ipn`    |  No  |
| GET    | `/payments/{gateway}/return` |  No  |

---

### Withdraw (`/wallet/withdraw`) — User endpoints

⚠️ Endpoint prefix thay đổi từ `/withdrawals` → `/wallet/withdraw`

| Method | Endpoint                             | Body                        | Response                                |
| ------ | ------------------------------------ | --------------------------- | --------------------------------------- |
| POST   | `/wallet/withdraw`                   | `{ amount, userNote, pin }` | `WithdrawRequestResponse`               |
| DELETE | `/wallet/withdraw/{id}`              | -                           | `WithdrawRequestResponse`               |
| GET    | `/wallet/withdraw/my?page=0&size=10` | -                           | `PageResponse<WithdrawRequestResponse>` |

**WithdrawRequestResponse:**

```json
{
  "id": 102,
  "withdrawCode": "WD-2026-000012",
  "userId": 1,
  "amount": 2000000,
  "userNote": "Rut tien thang 04",
  "status": "PENDING",
  "accountantNote": null,
  "failureReason": null,
  "createdAt": "2026-02-22T10:05:00",
  "updatedAt": "2026-02-22T10:05:00"
}
```

> `status`: `WithdrawStatus` = `PENDING | COMPLETED | FAILED | REJECTED | CANCELLED`
> DELETE chỉ được phép khi `status = PENDING`

---

## 5. Company Fund (`/company-fund`)

| Method | Endpoint                       | Body                         | Response                       |
| ------ | ------------------------------ | ---------------------------- | ------------------------------ |
| GET    | `/company-fund`                | -                            | `CompanyFundResponse`          |
| POST   | `/company-fund/topup`          | `SystemTopupRequest`         | `TransactionResponse`          |
| PUT    | `/company-fund/bank-statement` | `UpdateBankStatementRequest` | `CompanyFundResponse`          |
| GET    | `/company-fund/reconciliation` | -                            | `ReconciliationReportResponse` |

Notes:

- `CompanyFund` entity chỉ lưu metadata (bank info, external balance)
- Balance thực tế lưu trong `Wallet(COMPANY_FUND, ownerId=1)`
- `reconciliation` kiểm tra invariant: `FLOAT_MAIN.balance = SUM(all other wallets)`

---

## 6. System Config (`/system-configs`)

| Method | Endpoint                     |
| ------ | ---------------------------- |
| GET    | `/system-configs`            |
| GET    | `/system-configs/:key`       |
| PUT    | `/system-configs/:key`       |
| POST   | `/system-configs/:key`       |
| DELETE | `/system-configs/:key/cache` |
| DELETE | `/system-configs/cache`      |

---

## 7. Notifications (`/notifications`)

| Method | Endpoint                      | Params                                                          |
| ------ | ----------------------------- | --------------------------------------------------------------- |
| GET    | `/notifications`              | `?isRead={true\|false}&type={NotificationType}&page=1&limit=20` |
| GET    | `/notifications/unread-count` | -                                                               |
| PATCH  | `/notifications/{id}/read`    | -                                                               |
| PATCH  | `/notifications/read-all`     | -                                                               |

> ⚠ `page` là **1-indexed** (khác `/wallet/transactions` dùng 0-indexed). `isRead`, `type` đều optional.

**NotificationListResponse:**

```json
{
  "items": [
    /* NotificationResponse[] */
  ],
  "unreadCount": 3,
  "total": 42,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

> `unreadCount` trả kèm để FE cập nhật badge mà không cần gọi thêm `/unread-count`.

**Realtime push:** server tự đẩy notification mới qua SSE event `notification` trên kênh `GET /users/stream` (xem §15). FE prepend vào list + tăng badge, không cần poll lại.

**NotificationType enum** (Java source):

```
REQUEST_SUBMITTED         — Member tạo request → notify TL
REQUEST_APPROVED_BY_TL    — TL duyệt → notify Accountant
REQUEST_REJECTED          — Bị từ chối → notify requester
REQUEST_PAID              — Accountant giải ngân → notify requester
PROJECT_TOPUP_APPROVED    — Manager duyệt + auto-pay → notify TL
PROJECT_TOPUP_REJECTED    — Manager từ chối → notify TL
DEPT_TOPUP_APPROVED       — CFO duyệt + auto-pay → notify Manager
DEPT_TOPUP_REJECTED       — CFO từ chối → notify Manager
SALARY_PAID               — Lương đã chuyển → notify employee
SYSTEM                    — Thông báo hệ thống chung
SECURITY_ALERT            — Cảnh báo bảo mật (PIN bị khoá, v.v.)
```

---

## 8. Common: Projects & Payslips

### Projects (dùng để populate dropdown khi tạo request)

| Method | Endpoint                           | Params                                     | Response                                 |
| ------ | ---------------------------------- | ------------------------------------------ | ---------------------------------------- |
| GET    | `/projects`                        | `?status=PLANNING\|ACTIVE\|PAUSED\|CLOSED` | `{ items: [{id, projectCode, name}] }`   |
| GET    | `/projects/:id/phases`             | `?status=ACTIVE\|CLOSED`                   | `{ projectId, projectName, phases: [] }` |
| GET    | `/projects/{phaseId}` (categories) | -                                          | `{ items: [{id, name}] }`                |

### Payslips (Employee xem phiếu lương của mình)

| Method | Endpoint        | Params                                      | Response                                    |
| ------ | --------------- | ------------------------------------------- | ------------------------------------------- |
| GET    | `/payslips`     | `?year=&status=DRAFT\|PAID&page=1&limit=12` | `{ items, total, page, limit, totalPages }` |
| GET    | `/payslips/:id` | -                                           | `PayslipDetailResponse`                     |

---

## 9. Employee Requests (`/requests`)

| Method | Endpoint            | Params/Body                              | Response                        |
| ------ | ------------------- | ---------------------------------------- | ------------------------------- |
| GET    | `/requests`         | `?type=&status=&search=&page=1&limit=20` | `PageResponse<RequestListItem>` |
| GET    | `/requests/summary` | -                                        | `RequestSummaryResponse`        |
| GET    | `/requests/:id`     | -                                        | `RequestDetailResponse`         |
| POST   | `/requests`         | `CreateRequestBody`                      | `RequestDetailResponse`         |
| PUT    | `/requests/:id`     | `UpdateRequestBody`                      | `RequestDetailResponse`         |
| DELETE | `/requests/:id`     | -                                        | `{ message }`                   |

**Enums:**

```
RequestType:   ADVANCE | EXPENSE | REIMBURSE | PROJECT_TOPUP | DEPARTMENT_TOPUP

RequestStatus: PENDING | APPROVED_BY_TEAM_LEADER | ACCOUNTANT_VERIFIED |
               APPROVED_BY_MANAGER | APPROVED_BY_CFO | PAID | REJECTED | CANCELLED
               ⚠ Mỗi status là flow-specific — xem financial-architecture.md

RequestAction: APPROVE | REJECT | VERIFY | PAYOUT | CANCEL
```

**RequestSummaryResponse:**

```json
{
  "totalPendingApproval": 2,
  "totalApproved": 12,
  "totalRejected": 2,
  "totalPaid": 8,
  "totalCancelled": 1
}
```

**CreateRequestBody notes:**

- Flow 1 (`ADVANCE/EXPENSE/REIMBURSE`): cần `projectId`, `phaseId`, `categoryId`
- `REIMBURSE` cần thêm `advanceBalanceId` — lấy từ `GET /requests/my-advance-balances` (xem §9.1)
- `EXPENSE`/`REIMBURSE`: bắt buộc có `attachments[]` (FE validate client-side trước khi submit)
- Flow 2 (`PROJECT_TOPUP`): cần `projectId`; `phaseId`/`categoryId` = null
- Flow 3 (`DEPARTMENT_TOPUP`): `projectId`/`phaseId`/`categoryId` = null

**PUT `/requests/:id`:** Chỉ được phép khi `status = PENDING`. `attachments` ghi đè toàn bộ.

**DELETE `/requests/:id`:** Chỉ được phép khi `status = PENDING`. Chuyển sang `CANCELLED`.

---

### 9.1 Employee Advance Balances (cho REIMBURSE)

| Method | Endpoint                       | Auth                | Response                      |
| ------ | ------------------------------ | ------------------- | ----------------------------- |
| GET    | `/requests/my-advance-balances`| `REQUEST_VIEW_SELF` | `AdvanceBalanceItem[]`        |

Trả về danh sách các khoản tạm ứng **chưa hoàn toàn hoàn trả** (`OUTSTANDING` hoặc `PARTIALLY_SETTLED`) của user hiện tại. Dùng để populate dropdown khi tạo REIMBURSE request.

**`AdvanceBalanceItem`:**
```json
{
  "id": 1,
  "requestCode": "REQ-IT-0526-001",
  "originalAmount": 500000,
  "remainingAmount": 500000,
  "status": "OUTSTANDING"
}
```

⚠ `id` là `AdvanceBalance.id` — dùng trực tiếp làm `advanceBalanceId` trong `CreateRequestBody`.

---

## 10. Team Leader (`/team-leader`)

### Projects

| Method | Endpoint                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------ |
| GET    | `/team-leader/projects?status=&search=&page=0&size=20`                                           |
| GET    | `/team-leader/projects/:id`                                                                      |
| POST   | `/team-leader/projects/:id/members` — body: `{ userId, position }`                               |
| PUT    | `/team-leader/projects/:id/members/:userId` — body: `{ position }`                               |
| DELETE | `/team-leader/projects/:id/members/:userId`                                                      |
| GET    | `/team-leader/projects/:id/available-members?search=`                                            |
| POST   | `/team-leader/projects/:id/phases` — body: `{ name, budgetLimit, startDate, endDate }`           |
| PUT    | `/team-leader/projects/:id/phases/:phaseId` — body: `{ name?, budgetLimit?, endDate?, status? }` |
| GET    | `/team-leader/projects/:id/categories?phaseId=`                                                  |
| PUT    | `/team-leader/projects/:id/categories` — body: `{ phaseId, categoryId, budgetLimit }`            |
| DELETE | `/team-leader/projects/:id/categories` — body: `{ phaseId, categoryId }` — disabled khi `currentSpent > 0` |
| GET    | `/team-leader/expense-categories?projectId=`                                                     |

### Team Members

| Method | Endpoint                                                      |
| ------ | ------------------------------------------------------------- |
| GET    | `/team-leader/team-members?projectId=&search=&page=0&size=20` |
| GET    | `/team-leader/team-members/:userId`                           |

### Approvals (Flow 1: ADVANCE/EXPENSE/REIMBURSE)

| Method | Endpoint                                                                    |
| ------ | --------------------------------------------------------------------------- |
| GET    | `/team-leader/approvals?type=&projectId=&search=&page=0&size=20`            |
| GET    | `/team-leader/approvals/:id`                                                |
| POST   | `/team-leader/approvals/:id/approve` — body: `{ comment?, approvedAmount }` |
| POST   | `/team-leader/approvals/:id/reject` — body: `{ reason }`                    |

Notes:

- TL chỉ thấy requests trong projects mình là LEADER
- Sau approve: `PENDING → APPROVED_BY_TEAM_LEADER` (chờ Kế toán xử lý theo loại yêu cầu)
- TL chỉ **decision** (approve/reject), không execute payout (SoD)

---

## 11. Manager (`/manager`)

### Approvals (Flow 2: PROJECT_TOPUP)

| Method | Endpoint                                                                |
| ------ | ----------------------------------------------------------------------- |
| GET    | `/manager/approvals?search=&page=0&size=20`                             |
| GET    | `/manager/approvals/:id`                                                |
| POST   | `/manager/approvals/:id/approve` — body: `{ comment?, approvedAmount }` |
| POST   | `/manager/approvals/:id/reject` — body: `{ reason }`                    |

Notes:

- Manager chỉ duyệt `PROJECT_TOPUP` thuộc department của mình
- Sau approve: auto-transition `APPROVED_BY_MANAGER → PAID` (scheduler 1 phút)
- Không có `MANAGER_LIMIT` — chỉ bị chặn bởi `Department Fund balance`

### Projects

| Method | Endpoint                                                                                        |
| ------ | ----------------------------------------------------------------------------------------------- |
| GET    | `/manager/projects?status=&search=&page=0&size=20`                                              |
| GET    | `/manager/projects/:id`                                                                         |
| POST   | `/manager/projects` — body: `{ name, description?, totalBudget, teamLeaderId }`                 |
| PUT    | `/manager/projects/:id` — body: `{ name?, description?, totalBudget?, status?, teamLeaderId? }` |
| GET    | `/manager/department/team-leaders`                                                              |

### Department Members

| Method | Endpoint                                             |
| ------ | ---------------------------------------------------- |
| GET    | `/manager/department/members?search=&page=0&size=20` |
| GET    | `/manager/department/members/:id`                    |

---

## 12. Accountant (`/accountant`)

### Disbursements (Flow 1 execution)

| Method | Endpoint                                                          |
| ------ | ----------------------------------------------------------------- |
| GET    | `/accountant/disbursements?type=&search=&page=0&size=20`          |
| GET    | `/accountant/disbursements/:id`                                   |
| POST   | `/accountant/disbursements/:id/disburse` — body: `{ pin, note? }` |
| POST   | `/accountant/disbursements/:id/pay` — body: `{ pin, note? }`      |
| POST   | `/accountant/disbursements/:id/reject` — body: `{ reason }`       |

Notes:

- Hàng đợi có `APPROVED_BY_TEAM_LEADER` và EXPENSE đã `ACCOUNTANT_VERIFIED` đang chờ thanh toán.
- `disburse` yêu cầu PIN 5 số: ADVANCE chuyển PROJECT → USER; EXPENSE xác nhận chứng từ, ghi chi phí/khoản phải hoàn rồi chờ thanh toán; REIMBURSE ghi chi phí và giảm đúng khoản AdvanceBalance, không chuyển ví.
- `pay` chỉ thanh toán EXPENSE đã xác nhận: PROJECT → USER; không ghi chi phí lần hai.
- Accountant chỉ từ chối khi request còn ở `APPROVED_BY_TEAM_LEADER`; request đã xác nhận chứng từ chờ thanh toán không còn nút từ chối.
- Với REIMBURSE, trạng thái `PAID` biểu thị đã xử lý chứng từ và giảm dư tạm ứng; không có nghĩa tiền vừa chuyển qua ví.

### Payroll

| Method | Endpoint                                                                     |
| ------ | ---------------------------------------------------------------------------- |
| GET    | `/accountant/payroll?year=&status=&page=1&limit=12`                          |
| GET    | `/accountant/payroll/:periodId`                                              |
| POST   | `/accountant/payroll` — body: `{ name, month, year, startDate, endDate }`    |
| GET    | `/accountant/payroll/template` — tải file Excel mẫu                          |
| POST   | `/accountant/payroll/:periodId/import` — `multipart/form-data`, field `file` |
| POST   | `/accountant/payroll/:periodId/confirm-overwrite` — xác nhận ghi đè          |
| POST   | `/accountant/payroll/:periodId/auto-netting` — tính `advanceDeduct` tự động  |
| POST   | `/accountant/payroll/:periodId/run` — chạy tính lương chính thức             |
| PUT    | `/accountant/payroll/:periodId/entries/:payslipId` — sửa 1 payslip           |

Notes:

- Thứ tự bắt buộc: `import` → `auto-netting` → `run`
- `auto-netting`: tính khấu trừ tạm ứng, đảm bảo nhân viên nhận ≥ 50% lương
- Nguồn chi trả: `Wallet(COMPANY_FUND)` — không dùng `system_funds`

### Ledger hiện tại (giao dịch và biến động ví)

| Method | Endpoint                                                                    |
| ------ | --------------------------------------------------------------------------- |
| GET    | `/accountant/ledger/wallet-transactions?type=&status=&referenceType=&from=&to=&page=1&limit=20` |
| GET    | `/accountant/ledger/journals?event=&from=&to=&employeeId=&projectId=&requestId=&page=1&limit=20` |
| GET    | `/accountant/ledger/journals/:journalId` |
| GET    | `/accountant/ledger/advances/outstanding` |
| GET    | `/accountant/ledger/budget-exposure` |
| GET    | `/accountant/ledger?type=&status=&referenceType=&from=&to=&page=1&limit=20` (endpoint tương thích cũ) |
| GET    | `/accountant/ledger/summary?type=&status=&referenceType=&from=&to=` |
| GET    | `/accountant/ledger/:transactionId` |
| GET    | `/accountant/payslips/:payslipId`                                           |

Các endpoint `/accountant/ledger` hiện trả về giao dịch ví và các dòng `LedgerEntry` gắn với ví. Đây là nhật ký biến động tiền trong IFMS; các dòng chi tiết đang hiển thị không phải journal theo tài khoản kế toán. `LedgerSummaryResponse.currentBalance` là số dư `COMPANY_FUND`; tổng tiền vào/ra phụ thuộc phạm vi thời gian được yêu cầu.

**Cập nhật 10/10/2026:** API journal có bộ lọc theo event/ngày/nhân viên/dự án/yêu cầu, đồng thời trả người tạo và thời điểm tạo. Bổ sung tổng hợp ngân sách dự án/giai đoạn/danh mục. Journal được tạo cho SYSTEM_TOPUP và các lần phân bổ nội bộ; DEPOSIT/WITHDRAW của ví cá nhân vẫn chỉ nằm trong sổ giao dịch ví. Migration V20 bổ sung audit và chặn sửa/xóa journal ở database. Xem quy tắc, response và giới hạn trong [`ledger-accounting.md`](ledger-accounting.md).

`AccountingJournalItemResponse` và `AccountingJournalDetailResponse` có thêm `createdByUserId`, `createdByName`, `createdAt`; các trường này có thể null với journal cũ vì không thể khôi phục actor/thời điểm gốc. Endpoint `budget-exposure` trả các chỉ số riêng cho từng project, phase và category: budget, recognized expense, locked request amount và open advance. Các giá trị này mô tả trạng thái khác nhau và không được cộng thành một tổng “đã chi”.

**LedgerSummaryResponse:**

```json
{
  "currentBalance": 1250000000,
  "totalInflow": 3500000000,
  "totalOutflow": 2250000000,
  "transactionCount": 156
}
```

---

## 13. CFO (`/cfo`)

| Method | Endpoint                                                            |
| ------ | ------------------------------------------------------------------- |
| GET    | `/cfo/approvals?search=&page=0&size=20`                             |
| GET    | `/cfo/approvals/:id`                                                |
| POST   | `/cfo/approvals/:id/approve` — body: `{ comment?, approvedAmount }` |
| POST   | `/cfo/approvals/:id/reject` — body: `{ reason }`                    |

Notes:

- CFO chỉ duyệt `DEPARTMENT_TOPUP`
- Sau approve: status = `APPROVED_BY_CFO` → scheduler auto-pay → `PAID` (COMPANY_FUND → DEPARTMENT)
- Detail response bao gồm `department.totalAvailableBalance` và `companyFund.balance`

---

## 14. Admin (`/admin`)

### Users

| Method | Endpoint                                                            |
| ------ | ------------------------------------------------------------------- |
| GET    | `/admin/users?role=&departmentId=&status=&search=&page=1&limit=20`  |
| GET    | `/admin/users/:id`                                                  |
| POST   | `/admin/users` — body: `{ fullName, email, roleId, departmentId? }` |
| PUT    | `/admin/users/:id` — body: `{ fullName?, roleId?, departmentId? }`  |
| POST   | `/admin/users/:id/lock`                                             |
| POST   | `/admin/users/:id/unlock`                                           |
| POST   | `/admin/users/:id/reset-password`                                   |

Notes:

- Tạo user → backend tự generate mật khẩu tạm, gửi email ONBOARD
- `reset-password` → set `is_first_login = true`, gửi mật khẩu tạm qua email
- Admin user detail kèm `wallet`, `securitySettings`

### Departments

| Method | Endpoint                                                                       |
| ------ | ------------------------------------------------------------------------------ |
| GET    | `/admin/departments?search=&page=1&limit=20`                                   |
| GET    | `/admin/departments/:id`                                                       |
| POST   | `/admin/departments` — body: `{ name, code?, managerId?, totalProjectQuota? }` |
| PUT    | `/admin/departments/:id` — body: `{ name?, managerId?, totalProjectQuota? }`   |

### Audit

| Method | Endpoint                                                              |
| ------ | --------------------------------------------------------------------- |
| GET    | `/admin/audit?actorId=&action=&entityName=&from=&to=&page=1&limit=50` |

**AuditAction values:**

```
USER_CREATED | USER_UPDATED | USER_LOCKED | USER_UNLOCKED | BANK_INFO_UPDATED |
ROLE_ASSIGNED | ROLE_REVOKED | PERMISSION_GRANTED | PERMISSION_REVOKED |
DEPARTMENT_CREATED | DEPARTMENT_UPDATED | DEPARTMENT_DELETED |
QUOTA_TOPUP | QUOTA_ADJUSTED | CONFIG_UPDATED | SYSTEM_FUND_ADJUSTED |
PROJECT_TOPUP | CATEGORY_BUDGET_UPDATED | PIN_RESET | PIN_LOCKED |
USER_LOGIN_SUCCESS | USER_LOGIN_FAILED | DATA_EXPORTED | MANUAL_ADJUSTMENT
```

### Settings

| Method | Endpoint          |
| ------ | ----------------- | ---------------------------------------------- |
| GET    | `/admin/settings` | — trả `{ items: [{key, value, description}] }` |
| PUT    | `/admin/settings` | — body: `{ configs: [{key, value}] }`          |

Known system config keys: `WITHDRAWAL_LIMIT`, `MINIMUM_WITHDRAWAL`, `MAX_FILE_SIZE_MB`,
`MAX_FILES_PER_REQUEST`, `MINIMUM_REQUEST_AMOUNT`, `PIN_MAX_RETRY`,
`PIN_LOCK_DURATION_MINUTES`, `REQUIRE_PIN_FOR_WITHDRAWAL`

⚠️ `MANAGER_APPROVAL_LIMIT` **không còn** — hệ thống dùng Balance Limit (số dư quỹ) làm chốt chặn duy nhất

---

## 15. Realtime — Server-Sent Events (SSE)

> **Transport:** Server-Sent Events (SSE) qua HTTP — **đã thay** STOMP/WebSocket (trước v3.3).
> **Endpoint duy nhất:** `GET /api/v1/users/stream` (media type `text/event-stream`).
> **Auth:** `Authorization: Bearer <accessToken>` header — giống mọi REST endpoint khác.
> **Thư viện FE:** `@microsoft/fetch-event-source` (native `EventSource` **không** hỗ trợ custom header, nên không dùng được).

### Kết nối

- Mở **đúng 1 connection** cho cả session (không mở nhiều trên nhiều tab — để backend phân phối theo `userId`, dùng localStorage broadcast nếu cần chia sẻ giữa tab).
- Khi đăng xuất / token hết hạn → đóng stream, refresh token, mở lại.

### Event types

Backend enum `SseEventType` (source of truth):

| Event name            | Payload data type                        | Khi nào backend push                                                                 |
| --------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `connected`           | `string` — `"SSE connected"`             | Ngay sau khi stream open thành công                                                  |
| `wallet.updated`      | `WalletResponse` (raw, không wrap)       | Bất kỳ khi số dư user wallet thay đổi (disbursement, payroll run, withdraw, deposit) |
| `transaction.created` | `LedgerEntryResponse` (raw, không wrap)  | Sau khi ledger entry cho wallet của user được tạo                                    |
| `notification`        | `NotificationResponse` (raw, không wrap) | Mọi notification mới tạo cho user                                                    |

> ⚠ **Không còn wrapper `{ type, data, timestamp }`** như thời STOMP. Mỗi SSE event name đã chính là "type", và `data:` là payload JSON trực tiếp của DTO tương ứng.

### Ví dụ raw stream

```
event: connected
data: "SSE connected"

event: wallet.updated
data: {"id":1,"ownerType":"USER","ownerId":1,"balance":20000000,"lockedBalance":0,"availableBalance":20000000}

event: transaction.created
data: {"id":501,"transactionCode":"TXN-8829145A","direction":"CREDIT","amount":15000000,"balanceAfter":20000000,"createdAt":"2026-02-25T10:00:00"}

event: notification
data: {"id":55,"type":"REQUEST_APPROVED_BY_TL","title":"Request Approved","message":"Your request REQ-IT-2602-001 has been approved","refId":101,"refType":"REQUEST","referenceLink":null,"isRead":false,"createdAt":"2026-02-25T10:30:00"}
```

### FE pattern khuyến nghị

```ts
import { fetchEventSource } from "@microsoft/fetch-event-source";
import {
  WalletResponse,
  LedgerEntryResponse,
  NotificationResponse,
} from "@/types";

const ctrl = new AbortController();

await fetchEventSource("/api/v1/users/stream", {
  method: "GET",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    Accept: "text/event-stream",
  },
  signal: ctrl.signal,
  openWhenHidden: true,

  onopen: async (res) => {
    if (!res.ok) throw new Error(`SSE failed: ${res.status}`);
  },

  onmessage: (msg) => {
    switch (msg.event) {
      case "connected":
        // optional: log
        break;
      case "wallet.updated":
        updateWalletFromSse(JSON.parse(msg.data) as WalletResponse);
        break;
      case "transaction.created":
        prependTransaction(JSON.parse(msg.data) as LedgerEntryResponse);
        break;
      case "notification":
        prependNotification(JSON.parse(msg.data) as NotificationResponse);
        break;
    }
  },

  onerror: (err) => {
    // fetch-event-source tự reconnect — ném error để tùy biến backoff nếu cần
    console.warn("[SSE] connection error", err);
  },
});
```

### Reconnect & sync

- `@microsoft/fetch-event-source` **tự reconnect** khi connection drop.
- Khi reconnect thành công → gọi lại `GET /wallet` + `GET /notifications` (1 lần) để phòng lỡ event trong lúc mất kết nối.
- Không còn channel dành riêng cho request status (`REQUEST_STATUS_CHANGED` đã bỏ) — sau mọi action approve/reject/disburse trên UI, caller tự `refetch` list/detail.

---

## 16. Dashboard (`/dashboard`)

> Tất cả endpoint dashboard đều mount tại `/dashboard`. `DashboardController` xử lý.
> Employee + Team Leader dùng chiến lược **Composition** — không có dedicated endpoint.
> ⚠ **v4.0:** CFO dùng `/dashboard/cfo` (không phải `/cfo/dashboard`). Admin dùng `/dashboard/admin` (không phải `/admin/dashboard`).

### Manager

| Method | Endpoint | Response |
| ------ | -------- | -------- |
| GET | `/dashboard/manager` | `ManagerDashboardResponse` |

```json
{
  "departmentBudget": {
    "totalProjectQuota": 800000000,
    "totalAvailableBalance": 524500000,
    "totalSpent": 275500000
  },
  "projectStatusSummary": { "active": 3, "planning": 2, "paused": 1, "closed": 0 },
  "pendingApprovalsCount": 2,
  "teamDebtSummary": { "totalDebt": 5200000, "employeesWithDebt": 3 }
}
```

### Accountant

| Method | Endpoint | Response |
| ------ | -------- | -------- |
| GET | `/dashboard/accountant` | `AccountantDashboardResponse` |

```json
{
  "systemFundBalance": 1248500000,
  "pendingDisbursementsCount": 4,
  "monthlyInflow": 320000000,
  "monthlyOutflow": 187500000,
  "payrollStatus": {
    "latestPeriod": "Tháng 03/2026",
    "status": "COMPLETED"
  }
}
```

> ⚠ `payrollStatus` có thể là `null` khi chưa có kỳ lương nào trong hệ thống.

### CFO

| Method | Endpoint | Response |
| ------ | -------- | -------- |
| GET | `/dashboard/cfo` | `CfoDashboardResponse` |

```json
{
  "companyFundBalance": 1248500000,
  "pendingApprovalsCount": 2,
  "monthlyApprovedAmount": 500000000,
  "monthlyRejectedCount": 1,
  "recentApprovals": [
    {
      "id": 20,
      "requestCode": "REQ-2026-0060",
      "departmentName": "Phòng Công nghệ thông tin",
      "amount": 200000000,
      "status": "PENDING",
      "createdAt": "2026-04-02T09:00:00"
    }
  ]
}
```

### Admin

| Method | Endpoint | Response |
| ------ | -------- | -------- |
| GET | `/dashboard/admin` | `AdminDashboardResponse` |

```json
{
  "totalUsers": 64,
  "totalDepartments": 8,
  "totalWalletBalance": 2450000000,
  "recentAuditEvents": [
    {
      "id": 1,
      "actorName": "Admin System",
      "action": "USER_CREATED",
      "entityName": "users",
      "createdAt": "2026-04-09T08:15:00"
    }
  ]
}
```

### FE strategy

| Role | Strategy | Endpoint(s) |
|---|---|---|
| EMPLOYEE | Composition | `GET /wallet` + `GET /requests/summary` + `GET /requests?status=PENDING` + `GET /payslips?page=1&limit=1` + `GET /wallet/transactions?page=0&size=5` + `GET /dashboard/analytics/employee` |
| TEAM_LEADER | Composition | `GET /team-leader/approvals?page=0&size=3&status=PENDING` + `GET /team-leader/projects?page=0&size=3` |
| MANAGER | Dedicated | `GET /dashboard/manager` + sub-lists |
| ACCOUNTANT | Dedicated | `GET /dashboard/accountant` + sub-lists |
| CFO | Dedicated | `GET /dashboard/cfo` |
| ADMIN | Dedicated | `GET /dashboard/admin` |

---

## 17. Analytics (`/dashboard/analytics`)

> Implement Sprint 16. Thay thế mock data trong Admin + Accountant dashboard.

### `GET /dashboard/analytics/cashflow`

**Auth:** `PAYROLL_MANAGE` (Accountant) hoặc `USER_VIEW_LIST` (Admin)

| Param | Type | Mặc định | Mô tả |
|---|---|---|---|
| `period` | string | `last6m` | `ytd` / `last6m` / `fy{year}` (ví dụ `fy2025`) |
| `unit` | string | `raw` | `raw` (VND đầy đủ) / `million` (chia 1_000_000, scale 2) |

**Response:** `CashFlowAnalyticsResponse`

```json
{
  "period": "last6m",
  "points": [
    { "label": "T11/25", "inflow": 240000000, "outflow": 130000000 },
    { "label": "T12/25", "inflow": 290000000, "outflow": 155000000 }
  ],
  "totalInflow": 840000000,
  "totalOutflow": 450000000
}
```

> Label format: `T{m}/{2-digit-year}` cho `ytd`/`last6m`, `T{m}` cho `fy{year}`.
> Inflow = CREDIT vào COMPANY_FUND wallet. Outflow = DEBIT từ COMPANY_FUND wallet.
> FE Accountant dùng `unit=million` — chart nhận số triệu, `fmtM(v)` format thành `${v}M`.

---

### `GET /dashboard/admin/analytics`

**Auth:** `USER_VIEW_LIST` (Admin only)

**Response:** `AdminAnalyticsResponse`

```json
{
  "deptSpending": [
    { "deptId": 1, "deptName": "Engineering", "spent": 60200000 }
  ],
  "topDebtors": [
    {
      "userId": 5,
      "fullName": "Nguyễn Văn A",
      "deptName": "Infrastructure",
      "outstandingAmount": 12750000,
      "daysSinceDisbursement": 45
    }
  ]
}
```

> `deptSpending`: MTD (từ đầu tháng hiện tại đến hiện tại), DEBIT từ DEPARTMENT wallet, sorted descending by spent.
> `topDebtors`: tổng tạm ứng chưa hoàn (`remainingAmount > 0`, `status != SETTLED`), top 10 sorted by amount desc.
> `daysSinceDisbursement`: số ngày từ advance cũ nhất của user chưa được settle.
> FE gán màu từ palette cố định: `["#6366f1","#f59e0b","#0ea5e9","#14b8a6","#8b5cf6","#ec4899",...]`.

---

### `GET /dashboard/analytics/employee`

> Implement Sprint 17 (2026-05-31). Thay thế `MOCK_MONTHLY` trong Employee dashboard.

**Auth:** `REQUEST_VIEW_SELF` (Employee — và tất cả role có permission này)

**Response:** `EmployeeSpendingAnalyticsResponse`

```json
{
  "points": [
    { "label": "T12/25", "chiTieu": 0, "tamUng": 0 },
    { "label": "T1/26",  "chiTieu": 0, "tamUng": 0 },
    { "label": "T5/26",  "chiTieu": 0, "tamUng": 1300000 }
  ]
}
```

> `points`: 6 tháng gần nhất (kể cả tháng hiện tại), chronological order.
> `chiTieu`: tổng `approvedAmount` của EXPENSE + REIMBURSE có `status = PAID` trong tháng.
> `tamUng`: tổng `approvedAmount` của ADVANCE có `status = PAID` trong tháng.
> Tháng không có giao dịch → `chiTieu = 0`, `tamUng = 0` (vẫn hiện trong chart).

---

## 18. Maintenance Mode

Khi Admin bật `SYSTEM_MAINTENANCE_MODE = true` (qua `POST /admin/settings`):

- Backend `MaintenanceInterceptor` trả `503 Service Unavailable` cho **tất cả `/api/v1/**`**
- Exempt: `/api/v1/auth/**`, `/api/v1/health`
- Response body: `{ "success": false, "message": "Hệ thống đang trong chế độ bảo trì..." }`
- Frontend `api-client.ts` bắt 503 → redirect tự động sang `/maintenance`
- Page `/maintenance` là public route (không cần auth)
