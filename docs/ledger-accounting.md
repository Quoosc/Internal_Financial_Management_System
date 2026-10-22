# Sổ cái kế toán IFMS — tài liệu frontend

> **Sau sửa 23/10 — F20–F24:** xác nhận/PIN đối chiếu theo dự án được xóa khi
> đổi phạm vi; chi tiết tách lỗi tải/404; đối soát ngân hàng có retry và chặn
> kết luận khi API lỗi; nhãn cân bằng theo phạm vi; bộ chọn ngân hàng phân trang,
> tìm mã/ngày/số tiền. 20 test backend + 12 browser qua, build production qua.
> Xem [review mới nhất](ledger-implementation-review.md).

> **Trạng thái 23/10/2026:** Màn hình sổ tài khoản nhận lọc nghiệp vụ, nhân viên,
> dự án, phòng ban, giai đoạn và danh mục; trang Excel khôi phục bộ lọc từ URL.
> Danh sách tạm ứng và ngân sách dùng phân trang từ server; bộ chọn tham chiếu
> hiển thị tên/mã theo quyền truy cập. Audit xuất XLSX theo toàn bộ điều kiện lọc.
> Xem [báo cáo tuần](bao-cao-chi-tiet-tuan-vua-roi.md) về kết quả kiểm chứng và
> bốn phần plan chưa nghiệm thu hết. Các ghi chú ngày 10–21/10 dưới đây là
> bối cảnh của giai đoạn triển khai trước.

> **Cập nhật 21/10/2026:** Các mô tả bên dưới là nền nghiệp vụ ngày 10/10. Xem [trạng thái triển khai mới nhất](ledger-completion-and-excel-plan.md#9-nhật-ký-triển-khai-sau-khi-duyệt--cập-nhật-21102026) cho migration, kỳ, đối chiếu, Excel và phần chưa nghiệm thu.

> [Review bổ sung F01–F11](ledger-implementation-review.md) ghi các lỗi và khoảng
> trống mới xác định trong code. Chưa coi triển khai là hoàn thành toàn bộ plan.

**Cập nhật:** 10/10/2026
**Trạng thái:** Giao diện thật đã nối API sổ cái, ngân sách, hoàn tạm ứng, mở sổ, đối chiếu, đóng kỳ và Excel. Đã kiểm tra kiểu frontend và integration backend trên database cô lập; chưa nghiệm thu UI sáu vai trò và database chính.

## Mục đích và bố cục

Trang /accountant/ledger có bốn khu vực độc lập:

1. **Giao dịch ví:** từng transaction hiện một lần; mở chi tiết để xem những ví bị tác động.
2. **Sổ cái kế toán:** journal theo tài khoản; có danh sách, bộ lọc, chi tiết hai phía và thông tin tạo journal.
3. **Tạm ứng còn phải quyết toán:** tổng hợp theo nhân viên, mở từng AdvanceBalance và xem chứng từ, tiền hoàn thật, khấu trừ lương, lịch sử chưa phân loại và phần còn lại.
4. **Ngân sách & tạm ứng:** xem riêng số liệu theo dự án, giai đoạn và danh mục chi.

Trang /wallet cho nhân viên xem các khoản tạm ứng còn mở của chính mình và thực hiện hoàn tiền thật về ví dự án. Đây là một thao tác có chuyển tiền, khác với trang sổ cái kế toán vốn chỉ phục vụ tra cứu.

Route `/accountant/ledger/demo` đã nghỉ dùng và chuyển về `/accountant/ledger`; các trang sổ cái đang hoạt động đọc API.

## Quy tắc nghiệp vụ thể hiện trên giao diện

| Nghiệp vụ | Khi ghi nhận chi phí | Chuyển tiền và số dư |
|---|---|---|
| Tạm ứng (ADVANCE) | Không ghi chi phí khi giải ngân. | Ví dự án → ví nhân viên; tăng số tạm ứng còn phải quyết toán. |
| Nhân viên tự chi (EXPENSE) | Khi Kế toán xác nhận chứng từ hợp lệ. | Nhân viên đã dùng tiền cá nhân; xác nhận chứng từ chưa chuyển tiền. |
| Thanh toán hoàn chi | Không ghi chi phí lần hai. | Sau xác nhận, ví dự án → ví nhân viên; thanh toán khoản phải hoàn. |
| Quyết toán tạm ứng (REIMBURSE) | Khi chứng từ được chấp nhận. | Không phát sinh giao dịch ví; giảm đúng khoản tạm ứng đã liên kết. |
| Nhân viên hoàn tiền (ADVANCE_RETURN) | Không ghi chi phí mới. | Tiền thật từ ví nhân viên về đúng ví dự án, làm giảm số còn phải quyết toán. |
| Khấu trừ qua lương | Không tạo chi phí mới ngoài dữ liệu payroll hiện có. | Không chuyển tiền hoàn; giảm dư tạm ứng theo FIFO. |
| Nạp quỹ công ty (SYSTEM_TOPUP) | Không phải doanh thu/chi phí của dự án. | Nguồn ngân hàng/ngoài hệ thống → quỹ công ty; có journal để đối chiếu. |
| Cấp ngân sách phòng ban/dự án | Không tự tạo chi phí. | Chuyển giữa các quỹ nội bộ; có journal theo nguồn và đích. |
| Nạp/rút ví cá nhân (DEPOSIT/WITHDRAW) | Không ghi vào sổ kế toán công ty theo quyết định đã chốt. | Chỉ xuất hiện trong sổ giao dịch ví cá nhân. |

Số dư ví nhân viên, số tạm ứng còn phải quyết toán, ngân sách đang khả dụng và chi phí đã xác nhận là các số liệu khác nhau.

## Giao dịch ví

- API: GET /api/v1/accountant/ledger/wallet-transactions.
- Danh sách gộp theo transaction, lọc theo loại, trạng thái, nguồn tham chiếu và khoảng ngày.
- Chi tiết GET /api/v1/accountant/ledger/{transactionId} hiển thị biến động từng ví và các journal được liên kết.
- Tổng vào/ra phản ánh biến động của ví COMPANY_FUND; số dư là ảnh chụp hiện tại, không bị giới hạn theo khoảng ngày.
- Khi chưa có journal, giao diện nói rõ đó có thể là giao dịch chỉ theo dõi ở sổ ví hoặc dữ liệu lịch sử thiếu hồ sơ; không mặc định giao dịch đã được hạch toán.

## Sổ cái kế toán

- Danh sách: GET /api/v1/accountant/ledger/journals.
- Bộ lọc: loại sự kiện, từ ngày/đến ngày, ID nhân viên, ID dự án, ID yêu cầu.
- Chi tiết: GET /api/v1/accountant/ledger/journals/{journalId}; hiển thị nghiệp vụ nguồn, tài khoản, hai phía, số tổng và trạng thái cân bằng.
- Journal mới hiển thị người/tác vụ tạo và thời điểm tạo. Journal cũ có thể để trống vì hệ thống không biết chính xác actor hoặc thời gian ban đầu.
- Bút toán payroll chỉ dùng các trường đang có trong payslip; deduction không tự được gọi là thuế hoặc bảo hiểm.
- LedgerEntry là biến động ví, không phải dòng tài khoản kế toán.

## Tạm ứng còn mở

- Kế toán tra cứu danh sách theo nhân viên qua GET /api/v1/accountant/ledger/advances/outstanding.
- Nhân viên tra cứu khoản của mình qua GET /api/v1/requests/my-advance-balances.
- Hoàn tiền thật qua POST /api/v1/requests/my-advance-balances/{advanceBalanceId}/return, body gồm amount và note.
- Backend xác thực nhân viên sở hữu khoản, khóa khoản tạm ứng khi cập nhật, kiểm tra số tiền còn phải quyết toán và số dư ví khi chuyển.
- Công thức hiển thị:

      Còn lại = Đã giải ngân
              − Chứng từ quyết toán tạm ứng
              − Tiền thật đã hoàn
              − Khấu trừ lương
              − Lịch sử cũ chưa phân loại

## Theo dõi ngân sách

API: GET /api/v1/accountant/ledger/budget-exposure.

Mỗi dự án/giai đoạn/danh mục trình bày riêng:

- Chi phí đã xác nhận từ các bộ đếm ngân sách hiện có.
- Tiền đang khóa cho các yêu cầu ở trạng thái được duyệt/chờ xử lý.
- Tạm ứng còn mở lấy từ AdvanceBalance.
- Số dư ví dự án lấy từ `Wallet.balance`; ngân sách còn khả dụng lấy từ `Project.availableBudget`. Tiền đang khóa và tạm ứng còn mở hiển thị ở chỉ tiêu riêng.

Không cộng các khoản trên thành “đã chi”. Đặc biệt, tạm ứng chưa quyết toán không tự thành chi phí; khoản EXPENSE chờ thanh toán đã ghi chi phí khi xác nhận chứng từ.

## Mapping và giới hạn

- Journal cho SYSTEM_TOPUP, DEPARTMENT_ALLOCATION và PROJECT_ALLOCATION sử dụng tài khoản quản trị nội bộ IFMS. Mapping cần GVHD/người phụ trách duyệt; chưa phải bộ tài khoản pháp định.
- Giao dịch lịch sử chỉ được backfill khi có chứng từ và đối chiếu đủ căn cứ.
- Ngày nghiệp vụ và ngày ghi sổ được lưu riêng; journal được ghi vào kỳ ứng với ngày ghi sổ. Kỳ đã đóng từ chối bút toán mới.
- Journal đã ghi không được sửa/xóa. Sửa sai bằng bút toán đảo toàn phần có liên kết và chống đảo trùng; dữ liệu nguồn/counter chỉ cập nhật qua quy trình tương ứng.
- Đã kiểm tra production build frontend và integration backend trên PostgreSQL cô lập. Chưa nghiệm thu database triển khai chính hoặc browser flow đủ sáu vai trò; xem [kế hoạch hoàn thiện](ledger-completion-and-excel-plan.md).
