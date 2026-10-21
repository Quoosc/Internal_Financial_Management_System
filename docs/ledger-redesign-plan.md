# IFMS — trạng thái triển khai và phần việc còn lại của sổ cái

> **Cập nhật 21/10/2026:** Tài liệu dưới đây giữ trạng thái lịch sử ngày 10/10. Xem [mục 9 của kế hoạch hoàn thiện](ledger-completion-and-excel-plan.md#9-nhật-ký-triển-khai-sau-khi-duyệt--cập-nhật-21102026) để biết code đã triển khai, kết quả kiểm chứng và việc còn lại.

**Cập nhật:** 10/10/2026
**Phạm vi:** Frontend financial-wallet-frontend và backend IFMS.
**Trạng thái:** Đã bổ sung chức năng và tài liệu theo quyết định đã chốt. Chưa nghiệm thu chạy với database.

## Quyết định nghiệp vụ đã chốt

| Nội dung | Quyết định |
|---|---|
| Nạp quỹ và phân bổ nội bộ | Lập journal cho tiền vào quỹ công ty từ nguồn bên ngoài, cấp ngân sách phòng ban và cấp vốn dự án. Đây là biến động tài sản/quỹ, không tự ghi thành chi phí. |
| Ví cá nhân | Nạp/rút ví cá nhân (DEPOSIT/WITHDRAW) chỉ theo dõi trong sổ giao dịch ví; không xem là tiền công ty giữ hộ và không lập journal của công ty. |
| Dữ liệu lịch sử | Chỉ lập journal bù khi có đủ chứng từ và thông tin đối chiếu. Không đủ căn cứ thì giữ nhãn giao dịch lịch sử chưa có journal. |
| Khấu trừ tạm ứng qua lương | Giữ cách FIFO hiện tại; khấu trừ làm giảm dư tạm ứng, không tạo giao dịch hoàn tiền giả. |
| Nhân viên hoàn tạm ứng | Chỉ ghi giảm dư tạm ứng khi có tiền thật chuyển từ ví nhân viên về đúng ví dự án. |
| Nhân viên tự chi | Chi phí được ghi khi Kế toán xác nhận chứng từ hợp lệ; chuyển tiền vào ví nhân viên là thanh toán hoàn chi riêng. |

## 1. Đã thực hiện

### Frontend

Trang thật /accountant/ledger hiện có bốn khu vực:

1. **Giao dịch ví:** một dòng cho mỗi giao dịch, bộ lọc và phân trang; chi tiết hiển thị các ví bị tác động và journal liên quan nếu có.
2. **Sổ cái kế toán:** danh sách và chi tiết journal, gồm nghiệp vụ nguồn, tài khoản, ngày/kỳ ghi sổ, cân bằng, người tạo và thời điểm tạo.
3. **Tạm ứng còn mở:** nhóm theo nhân viên; từng khoản cho biết đã quyết toán bằng chứng từ, tiền hoàn thật, khấu trừ lương, phần lịch sử chưa phân loại và số còn lại.
4. **Ngân sách & tạm ứng:** tổng hợp theo dự án, giai đoạn và danh mục; trình bày riêng chi phí đã xác nhận, tiền đang khóa cho yêu cầu, tạm ứng còn mở và ngân sách khả dụng.

Ở trang /wallet, nhân viên xem các khoản tạm ứng của chính mình và có thể nhập số tiền, ghi chú rồi hoàn tiền thật về ví dự án. Sau khi hoàn, trang tải lại số dư ví, lịch sử giao dịch và dư tạm ứng. Backend vẫn kiểm tra quyền sở hữu, số dư tạm ứng còn lại và số tiền khả dụng.

Route `/accountant/ledger/demo` đã nghỉ dùng và chuyển về trang sổ cái thật. Phần còn lại của tài liệu này ghi trạng thái trước triển khai, không phải backlog hiện hành.

### Backend IFMS

- Journal được tạo cùng transaction nghiệp vụ, kiểm tra tổng hai phía và có khóa duy nhất theo loại sự kiện/nguồn để hạn chế ghi trùng.
- Journal bao phủ ADVANCE, xác nhận và thanh toán EXPENSE, REIMBURSE, ADVANCE_RETURN, payroll, SYSTEM_TOPUP, cấp ngân sách phòng ban và cấp vốn dự án.
- Journal mới lưu người/tác vụ tạo và thời điểm tạo. Migration V20 thêm các trường audit và chặn UPDATE/DELETE trực tiếp trên journal cùng các dòng journal. Bút toán lịch sử có thể không có người tạo/thời điểm gốc; các trường đó để trống thay vì đoán.
- API danh sách journal lọc theo sự kiện, ngày, nhân viên, dự án và ID yêu cầu; API chi tiết trả dấu vết audit.
- API GET /api/v1/accountant/ledger/budget-exposure tổng hợp theo dự án/giai đoạn/danh mục.
- API nhân viên hoàn tạm ứng đã tồn tại; giao diện /wallet nay đã nối vào API đó.
- Các migration hiện có tới V20. V19 tạo bảng journal và tách tiền hoàn thật, khấu trừ lương, dữ liệu lịch sử chưa phân loại. V20 bổ sung audit và tính bất biến ở database.

### Mapping journal hiện được dùng

Các mã dưới đây là mapping quản trị nội bộ cho IFMS, chưa được GVHD xác nhận là danh mục tài khoản chính thức.

| Nghiệp vụ | Tác động được ghi |
|---|---|
| SYSTEM_TOPUP | Tăng quỹ công ty; giảm tài khoản nguồn ngân hàng/nguồn bên ngoài. Có mã giao dịch và payment reference để đối chiếu. |
| DEPARTMENT_ALLOCATION | Tăng quỹ phòng ban; giảm quỹ công ty. |
| PROJECT_ALLOCATION | Tăng quỹ dự án; giảm quỹ phòng ban. |
| DEPOSIT/WITHDRAW cá nhân | Không lập journal công ty; vẫn có transaction và biến động ví cá nhân. |

Các luồng ADVANCE, EXPENSE, REIMBURSE, ADVANCE_RETURN và payroll tiếp tục dùng quy tắc ghi nhận tại docs/project_2/ledger-accounting-implementation.md trong repo backend.

### Các chỉ tiêu ngân sách được tách riêng

API và giao diện không cộng các chỉ tiêu sau thành một số “đã chi” chung:

- **Chi phí đã xác nhận:** số đang lưu ở project/phase/category totalSpent hoặc currentSpent; EXPENSE ghi khi xác nhận chứng từ và REIMBURSE ghi khi quyết toán.
- **Đang khóa cho yêu cầu:** tổng reservedAmount của yêu cầu đã được duyệt hoặc đã xác nhận chứng từ.
- **Tạm ứng còn mở:** tổng dư AdvanceBalance.remainingAmount.
- **Số dư ví dự án:** lấy từ `Wallet.balance`; **ngân sách còn khả dụng:** lấy từ `Project.availableBudget`. Khoản đang khóa và tạm ứng còn mở hiển thị riêng.

ADVANCE không được tính thành chi phí ngay khi giải ngân. Các chỉ tiêu là những góc nhìn khác nhau và không được cộng chồng lên nhau.

## 2. Chưa nghiệm thu hoặc còn phụ thuộc

### Chạy với database và dữ liệu thật

- Chưa áp dụng V19/V20 trên database thử nghiệm hoặc bản sao dữ liệu, chưa kiểm tra chuyển đổi dữ liệu cũ.
- Lúc kiểm tra, DATABASE_URL không được cấu hình và Docker Engine không chạy; vì vậy chưa khởi động tích hợp backend/frontend với database.
- Chưa kiểm tra quyền và các luồng nghiệp vụ thật với tài khoản Kế toán/nhân viên; chưa xác minh số dư trước/sau trên database.
- Đã chạy compile backend và production build frontend thành công. Chưa chạy bộ test hoặc kiểm thử API/end-to-end.

### Backfill và mapping

- Chưa backfill journal cho dữ liệu lịch sử. Chỉ thực hiện sau khi có dữ liệu/chứng từ đủ căn cứ và database mục tiêu để đối chiếu.
- Cần GVHD/người phụ trách nghiệp vụ duyệt tên tài khoản và mapping. Mã tài khoản hiện tại là mapping nội bộ IFMS, không tuyên bố là hệ thống tài khoản pháp định.
- Với giao dịch không có journal, chi tiết hiện phân biệt khả năng là loại chỉ theo dõi ở sổ ví (như DEPOSIT/WITHDRAW cá nhân) hoặc giao dịch cũ chưa có đủ hồ sơ; cần kiểm tra nguồn trước khi kết luận đã hạch toán.

### Kỳ kế toán và sửa sai

- Chưa có thao tác đóng kỳ kế toán, lựa chọn ngày nghiệp vụ/ngày ghi sổ, hoặc quy trình đảo journal có liên kết và chống đảo trùng.
- Journal đã bị chặn sửa/xóa ở database. Trước khi mở chức năng sửa sai cần chốt cách xử lý ngày/kỳ khi phát hiện sai sau khi đóng kỳ, quyền thực hiện và cách gắn lý do/chứng từ. Không sửa trực tiếp dữ liệu gốc.

## 3. Plan còn lại

| Mục | Trạng thái | Việc tiếp theo |
|---|---|---|
| A1 — kiểm tra V19/V20 trên database thử nghiệm/bản sao | Chưa làm | Chạy migration và đối chiếu schema, số dư tạm ứng, reservations, journal và dữ liệu lịch sử trước/sau. |
| A2 — chạy tích hợp và kiểm tra phân quyền | Chưa làm | Cần cấu hình database thử nghiệm; kiểm tra tài khoản Kế toán và nhân viên. |
| A3 — đi qua các luồng ADVANCE, EXPENSE, REIMBURSE, hoàn tiền và payroll | Chưa làm | Xác nhận ví, số dư tạm ứng, chi phí và journal khớp sau từng bước. |
| A4 — kiểm tra lọc, phân trang và liên kết dữ liệu | Chưa làm | Kiểm tra trên API/database thật; xác nhận giao dịch cũ không bị hiểu nhầm là đã có journal. |
| B1 — giao diện nhân viên hoàn tạm ứng | Hoàn tất phần code | Màn hình /wallet nối API; còn cần kiểm tra runtime với database. |
| B2/B3 — mapping và journal nạp quỹ/phân bổ | Đã triển khai code | Đã có ba event journal và liên kết transaction/request; cần GVHD duyệt mapping và chạy tích hợp. |
| B4 — backfill có chứng từ | Chưa làm, phụ thuộc dữ liệu | Chỉ lập journal cho từng giao dịch có hồ sơ và số liệu đối chiếu; không suy đoán cho dữ liệu thiếu. |
| B5 — báo cáo ngân sách tách biệt | Đã triển khai code | Có API và tab theo dự án/giai đoạn/danh mục; cần đối chiếu số liệu thật. |
| C1 — duyệt mapping tài khoản | Còn chờ nghiệp vụ | GVHD/người phụ trách duyệt tên và ý nghĩa các tài khoản nội bộ. |
| C2 — đóng kỳ và đảo/điều chỉnh | Chưa triển khai | Cần chốt ngày/kỳ ghi đảo khi kỳ cũ đã đóng, quyền đóng/mở kỳ và trường hợp điều chỉnh. |
| C3 — audit và bất biến | Đã triển khai code | V20 thêm người tạo/thời điểm và ngăn sửa/xóa journal ở database; legacy có thể thiếu audit gốc. |
| C4 — FIFO payroll | Đã có trong code, chưa kiểm chứng runtime | Code kiểm tra tổng phân bổ bằng advanceDeduct, lấy các khoản tạm ứng theo createdAt, id và gắn từng dòng journal với khoản tương ứng. |

## 4. Kiểm chứng trong lượt triển khai này

- Backend IFMS: mvnw.cmd -q -DskipTests compile — thành công.
- Frontend: npm run build — thành công; route sổ cái, chi tiết journal, trang ví và demo đều được build.
- Không chạy test suite.
- Không chạy migration vì môi trường hiện không có DATABASE_URL và Docker Engine chưa sẵn sàng.

**Chưa thể xác nhận hệ thống đã được nghiệm thu hoặc sẵn sàng dùng trên dữ liệu thật cho đến khi hoàn thành A1–A4.**
