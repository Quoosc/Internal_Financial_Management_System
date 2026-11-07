# Kế hoạch hoàn tất sổ cái IFMS và các luồng liên quan sáu vai trò

**Ngày lập 06/11/2026**

**Trạng thái: Đang thực hiện theo phê duyệt ngày 06/11/2026**

Kế hoạch này tiếp nối `ledger-completion-and-excel-plan.md`, tập trung vào các
phần còn thiếu được xác nhận sau lượt kiểm tra gần nhất. Phạm vi gồm G3.1,
G4.2, V1, kiểm nội dung Excel và đối chiếu dữ liệu lịch sử.

## 1. Cơ sở và mục tiêu bàn giao

### Tiến độ thực hiện ngày 06/11/2026

| Gói | Trạng thái hiện tại | Bằng chứng / phần còn lại |
|---|---|---|
| P0 — Ma trận nguồn | Hoàn thành | Ma trận event/nguồn/tài khoản/role và U01–U12 tại [`ledger-event-source-matrix.md`](ledger-event-source-matrix.md). |
| P1 — Đóng kỳ | Đã triển khai và có hồi quy backend; UAT tổng thể còn mở | Backend trả ngoại lệ có phân trang, liên kết journal/nguồn; close kiểm tra lại dưới cùng khóa với writer. Test PostgreSQL xác nhận close chờ transaction giữ khóa, ghi journal vào kỳ vừa đóng bị chặn; kiểm cả đảo EXPENSE toàn phần và thay phiếu lương/idempotent retry. Còn UAT giao diện và các chuỗi nghiệp vụ sáu vai trò. |
| P2 — UI và URL | Hoàn thành một phần | 19/19 browser fixture đạt; trên bản sao DB local, sáu role mở trang tài chính theo quyền, Accountant mở các nhánh sổ cái và hai liên kết giao dịch ví → nguồn thật. UAT live còn thiếu các trạng thái ghi/sửa và toàn bộ màn hình. |
| P3 — Excel | Đã kiểm thử ma trận; còn đối chiếu báo cáo sâu | Backend integration đạt 20/20: export từng dataset theo catalog/role, schema file, số dòng, tổng tiền; preview/commit mọi dataset nhập hiện có. Live browser xuất hơn 50 workbook theo sáu role, xác nhận HTTP/XLSX. Còn đối chiếu mọi báo cáo với API độc lập cùng snapshot và kiểm đầy đủ các giới hạn dữ liệu. |
| P4 — Lịch sử | Đã kiểm kê; chuyển đổi đang chờ chứng từ | [`ledger-legacy-data-inventory-2026-11-06.md`](ledger-legacy-data-inventory-2026-11-06.md) ghi số tổng hợp. Không backfill các EXPENSE thiếu chứng từ, payroll thiếu giao dịch hoặc bất kỳ nguồn chưa được xác minh. |
| P5 — UAT sáu vai trò | Đã bắt đầu; chưa hoàn tất | Trên bản sao V36, 8/8 ca live mở trang sáu role, nhánh sổ cái và export; thêm 2/2 ca link giao dịch ví → request/payslip. Còn thao tác ghi đầu cuối, đối chiếu số dư và bằng chứng riêng từng U01–U12. |
| P6 — Tài liệu | Tài liệu/contract đã cập nhật; bàn giao tổng thể còn mở | Review, plan, tài liệu UI, inventory, backend implementation doc và hợp đồng API kỳ kế toán đã đồng bộ. Chốt bàn giao cuối phụ thuộc P2–P5. |

**Kết luận tiến độ:** P0 và phần triển khai/kiểm thử hồi quy P1 đã hoàn tất.
P2–P3 còn nghiệm thu luồng ghi và đối chiếu sâu; P4 chưa ghi bù vì các nguồn thiếu
chứng từ; P5 mới kiểm đọc/điều hướng theo sáu vai trò. Chưa thể tuyên bố
toàn bộ plan hoàn tất. Không có dữ liệu tài chính lịch sử nào được sửa.

Mốc baseline trước đợt hoàn thiện này: frontend `42167ff`, backend `c285b22`;
các lỗi F25–F30 đã push. Mốc đó có 24 ca backend, 15 ca UI cô lập và 7 ca
browser live, nhưng chưa bao phủ đầy đủ nội dung file export. Kết quả hiện tại
được ghi riêng theo từng gói bên dưới, không thay đổi các số liệu lịch sử này.

DB Docker local đã nâng V18 lên V36. Tại thời điểm kiểm tra, DB có 24 giao dịch
ví cũ, 0 journal và 0 dòng sao kê. Các số lượng này là mốc kiểm tra, phải đọc lại
trước khi chuyển đổi dữ liệu thực tế.

Mục tiêu bàn giao gồm các điều kiện sau.

- Báo cáo trước đóng kỳ phát hiện ngoại lệ nguồn và có đường dẫn xử lý.
- Kết quả sửa sai khớp ví, công nợ, ngân sách, journal và báo cáo của vai trò liên quan.
- Bộ lọc và điều hướng ở các trang liên quan giữ đúng phạm vi.
- File Excel có số dòng, nội dung và tổng tiền khớp API trong cùng mốc dữ liệu.
- Có kết quả UAT từ giao diện của cả sáu vai trò.
- Dữ liệu lịch sử được phân loại theo căn cứ và có báo cáo phần còn thiếu.

## 2. Các quy tắc nghiệp vụ tiếp tục áp dụng

| Nghiệp vụ | Quy tắc nghiệm thu |
|---|---|
| Nhân viên tự chi (EXPENSE) | Kế toán xác nhận chứng từ hợp lệ mới ghi chi phí và khoản phải thanh toán. Chuyển vào USER thanh toán khoản hoàn chi, chi phí được ghi một lần. |
| Tạm ứng (ADVANCE) | Giải ngân tạo khoản nhân viên còn phải quyết toán. Tiền giải ngân và chi phí được theo dõi riêng. |
| Quyết toán tạm ứng (REIMBURSE) | Chứng từ được xác nhận làm giảm tạm ứng, tăng chi phí tương ứng và giữ nguyên số tiền ví. |
| Hoàn tiền tạm ứng (ADVANCE_RETURN) | Chuyển tiền USER về PROJECT, giảm đúng khoản tạm ứng được chọn. |
| Khấu trừ lương | Giữ cách phân bổ/giới hạn hiện tại. Bù trừ tạm ứng có liên kết phiếu lương, khoản tạm ứng và journal. |
| Phân bổ quỹ | COMPANY_FUND → DEPARTMENT → PROJECT là phân bổ nội bộ. |
| Nạp/rút cá nhân | Áp dụng phạm vi đã chốt, tiền nạp/rút cá nhân thuộc phạm vi cá nhân. |
| Đảo và thay thế | Đảo toàn phần có liên kết nguồn, lý do và chống trùng. Phiếu thay thế có lịch sử của bản cũ. |
| Dữ liệu lịch sử | Chỉ ghi bù khi đủ căn cứ. Phần chênh lệch mở sổ cần xác nhận số dư và mốc chuyển đổi. |

Quyền thao tác tiếp tục theo permission hiện hành. Mọi link và nút mới phải
kiểm lại quyền ở backend. Quyền xem và quyền ghi được ghi riêng trong ma trận UAT.

## 3. P0 — Chốt ma trận nguồn và ma trận ảnh hưởng

### Công việc

1. Liệt kê từng event journal, nguồn chính, transaction ví nếu có, chứng từ,
   request/advance/payslip và các chỉ tiêu bị tác động.
2. Liệt kê trạng thái hợp lệ của nguồn trước/sau xử lý và sau khi đảo.
3. Phân biệt snapshot tại thời điểm ghi sổ với trạng thái hiện tại của nguồn.
   Nhân viên đã quyết toán tiếp hoặc phiếu đã thay thế cần được truy theo chuỗi
   hiệu lực để tránh báo sai journal lịch sử.
4. Gắn từng event với màn hình bị ảnh hưởng ở Employee, Team Leader, Manager,
   Accountant, CFO, Admin và từng báo cáo Excel.
5. Chuyển ma trận thành danh sách ca kiểm thử có ID và kết quả mong đợi.

### Đầu ra và điều kiện hoàn thành

- Một bảng nguồn bao phủ ADVANCE_DISBURSED, REIMBURSE_SETTLED, ADVANCE_RETURNED,
  EXPENSE_VERIFIED, EXPENSE_PAID, PAYROLL_SETTLEMENT, SYSTEM_TOPUP,
  DEPARTMENT_ALLOCATION, PROJECT_ALLOCATION, REVERSAL và OPENING_BALANCE.
- Mỗi dòng có nguồn đối chiếu, công thức, quyền và ca UAT tương ứng.
- Có danh sách ngoại lệ chặn đóng kỳ và danh sách cảnh báo cần xác nhận.

Ma trận event, nguồn, ảnh hưởng tài khoản và vai trò đã được lập tại
[`ledger-event-source-matrix.md`](ledger-event-source-matrix.md). Nội dung này là
chuẩn để triển khai kiểm tra trước đóng kỳ và thiết kế UAT.

## 4. P1 — Hoàn thiện kiểm soát trước đóng kỳ và sửa sai

### Backend

Mở rộng `AccountingPeriodService` và DTO preview hiện có theo ma trận P0.
Giữ các trường response đang được frontend sử dụng, thêm danh sách ngoại lệ
có mã, mức độ, journal/source ID, mô tả, số tiền liên quan và hướng xử lý.
Danh sách ngoại lệ lớn cần lọc và phân trang từ server.

| Nhóm kiểm tra | Nội dung cần bổ sung |
|---|---|
| Nguồn có thật | Kiểm tra nguồn tồn tại, đúng loại event, đúng chủ thể và phạm vi. |
| Số tiền và liên kết | Đối chiếu số tiền được ghi với nghiệp vụ nguồn, transaction ví và journal liên quan theo từng loại event. |
| Chứng từ chi phí | Kiểm khoản phân bổ chứng từ đang có hiệu lực, tổng phân bổ và liên kết EXPENSE/REIMBURSE. |
| Tạm ứng | Kiểm số đã ứng, chứng từ đã quyết toán, tiền hoàn và khấu trừ lương theo từng khoản, kể cả nghiệp vụ đảo. |
| Payroll | Kiểm phiếu PAID/REVERSED, phiếu thay thế, chi lương và phân bổ advanceDeduct. |
| Ngân hàng | Đối chiếu tài khoản, chiều, số tiền, BOOKED/PENDING và liên kết matching theo phạm vi doanh nghiệp đã xác nhận. |
| Sửa sai | Kiểm chuỗi journal gốc/đảo/thay thế, chống đảo trùng và cập nhật đầy đủ nguồn nghiệp vụ. |
| Ngoại lệ có số dư chuyển tiếp | Thể hiện tạm ứng còn mở, hoàn chi chưa thanh toán và khoản đang chuyển theo bản chất đã chốt. |

Ngoại lệ chặn gồm nguồn mất/sai, số tiền hoặc liên kết không khớp, chuỗi đảo
không hợp lệ và thiếu chứng từ bắt buộc của nghiệp vụ đã ghi nhận. Khoản tạm ứng
còn mở được chuyển kỳ. Các khoản hợp lệ chưa thanh toán và sao kê chưa khớp cần
được phân loại theo loại nghiệp vụ, thời điểm và phạm vi trước khi quyết định
chặn hoặc cảnh báo.

`close` phải chạy lại các điều kiện chặn trong cùng cơ chế khóa với writer.
Kiểm tình huống nguồn thay đổi giữa preview và xác nhận. Thống nhất thứ tự khóa
với request, advance, payroll và correction để tránh deadlock. Cách truy vấn
phải xử lý được dữ liệu nhiều dòng và tránh đọc lặp từng nguồn.

### Frontend

- Trang kỳ kế toán hiển thị tổng từng nhóm lỗi/cảnh báo và danh sách chi tiết.
- Mỗi ngoại lệ mở được journal và nguồn theo quyền người dùng.
- Có hướng dẫn xử lý cụ thể và nút tải lại preview sau khi sửa nguồn.
- Nút đóng kỳ phản ánh kết quả kiểm tra mới nhất, lỗi server được giữ rõ trên UI.
- Hiển thị các khoản chuyển tiếp để kế toán hiểu lý do kỳ vẫn đủ điều kiện đóng.

### Điều kiện hoàn thành

- Các nguồn sai trong ma trận P0 bị phát hiện và truy vết được.
- Chuỗi quyết toán/đảo/thay thế hợp lệ vượt qua kiểm tra.
- Ca đồng thời ghi sổ/đóng kỳ cho kết quả nhất quán và rollback đầy đủ khi lỗi.
- Kỳ đã đóng chặn ghi lùi, correction ghi vào kỳ phù hợp theo quy tắc hiện tại.
- Tổng tiền ví, advance, budget và sổ tài khoản khớp sau mỗi correction.

## 5. P2 — Hoàn thiện UI truy vết, bộ lọc và trạng thái qua các vai trò

### Danh sách màn hình cần rà soát

- Accountant gồm giao dịch ví, journal, nguồn yêu cầu/phiếu lương, sổ tài khoản,
  tạm ứng, ngân sách, quỹ, đối soát ngân hàng/chi phí, lịch sử/mở sổ, kỳ và payroll.
- Employee gồm danh sách/chi tiết yêu cầu, tạm ứng, ví/giao dịch, phiếu lương và thông báo.
- Team Leader gồm duyệt yêu cầu, dự án, giai đoạn, danh mục và nhân viên.
- Manager gồm duyệt cấp vốn, dự án, phòng ban và số liệu nhân sự/ngân sách.
- CFO gồm duyệt cấp quỹ, quỹ hệ thống và báo cáo theo quyền hiện hành.
- Admin gồm import nhân sự/phòng ban, audit và lịch sử import/export.

### Công việc

1. Chuẩn hóa query URL cho tab, từ khóa, filter, page, kích thước trang và nguồn
   đang chọn. Giữ tham số không liên quan khi cập nhật filter.
2. Áp dụng cho các trang phụ còn dùng state cục bộ, ưu tiên lịch sử/mở sổ,
   đối chiếu chi phí và danh sách theo dõi. Chỉ lưu trạng thái điều hướng cần thiết
   vào URL. PIN, chứng từ nhập dở và xác nhận giao dịch được quản lý trong phiên.
3. Đổi nguồn phải xóa các xác nhận gắn với nguồn cũ. Request cũ trả muộn được bỏ
   qua. Kiểm response của thao tác ghi trước khi cho phép đổi phạm vi.
4. Làm rõ loading, lỗi, 403, 404 và dữ liệu rỗng. Retry giữ bộ lọc và xóa kết luận
   tài chính cũ khi dữ liệu mới chưa tải thành công.
5. Kiểm link nguồn ở trạng thái đã duyệt, xác nhận, thanh toán, hủy, từ chối,
   đảo và thay thế. Điều hướng về danh sách giữ bộ lọc/vị trí.
6. Đồng bộ nhãn tiếng Việt, số tiền, ngày, status và chỉ tiêu tổng hợp theo cùng
   phạm vi dữ liệu. Kiểm màn hình hẹp và thao tác bàn phím cho filter/modal.

### Điều kiện hoàn thành

- Reload, back/forward và mở deep link khôi phục đúng trạng thái điều hướng.
- Link của mỗi vai trò mở đúng hồ sơ được cấp quyền.
- Các ca đổi nguồn nhanh, lỗi API và retry giữ số liệu đúng phạm vi.
- Bảng, thẻ tổng hợp và đường dẫn xuất Excel dùng cùng điều kiện lọc.

## 6. P3 — Kiểm chứng nội dung Excel và phạm vi dữ liệu

### Công việc

1. Lấy catalog dataset và quyền từ backend để lập ma trận hiện hành. Phủ từng
   loại scope gồm tự xem, dự án, phòng ban và toàn hệ thống theo quyền.
2. Với export, đọc workbook để kiểm header, kiểu ô, số dòng dữ liệu, tổng tiền,
   trạng thái, số dư đầu/cuối và các chiều lọc có liên quan.
3. So sánh với API nguồn tại cùng mốc dữ liệu. Ưu tiên tạo bộ dữ liệu cố định
   trong DB cô lập cho phép đối chiếu chính xác. Nếu phát hiện API/export chưa
   bảo đảm cùng mốc báo cáo khi đang có ghi mới, bổ sung contract cutoff phù hợp.
4. Kiểm đủ mọi trang, nhiều scope, không có kết quả, dữ liệu sát/vượt giới hạn
   export và filter theo ngày/event/nhân viên/dự án/phòng ban/giai đoạn/danh mục.
5. Kiểm quyền bằng cả UI và gọi API trực tiếp với scope thuộc đơn vị khác.
6. Với import, kiểm template → preview → commit → màn hình đích → audit.
   Phủ header sai, mã sai/trùng, ô công thức, số tiền/ngày sai, scope sai, retry
   commit, lô lỗi và dữ liệu thay đổi sau preview.
7. Kiểm riêng import sao kê PENDING → BOOKED và payroll sau khi đã chi/thay phiếu.

### Điều kiện hoàn thành

- Nội dung file khớp API/DB theo từng ca, cả số dòng và số tiền.
- Toàn bộ dataset trong ma trận có kết quả kiểm nội dung hoặc lý do không áp dụng.
- Export và import bị chặn đúng quyền, lỗi giới hạn được hiển thị rõ.
- Import tài chính có retry/idempotency và rollback đúng quy tắc từng lô.

## 7. P4 — Đối chiếu và chuyển đổi dữ liệu lịch sử

### Công việc

1. Chụp mốc dữ liệu, sao lưu và xác nhận Flyway/schema ở môi trường đích.
2. Lập bảng kiểm kê từng nguồn với số tiền, chủ thể, trạng thái, transaction,
   chứng từ, journal đã có và phần thiếu cần bổ sung.
3. Phân loại nguồn đủ căn cứ ghi bù, thiếu căn cứ cần xác minh và số dư cần mở sổ.
4. Thực hiện preview/commit từng lô có chứng từ trên DB sao chép. Kiểm chống trùng,
   thứ tự các sự kiện phụ thuộc và tổng theo nhân viên/dự án/phòng ban.
5. Đối chiếu số dư sau ghi bù, xác nhận phần mở sổ và mốc chuyển đổi theo quyền.
6. Lưu báo cáo nguồn chưa xác minh, người phụ trách và căn cứ còn thiếu.

### Điều kiện hoàn thành

- Mỗi nguồn có kết quả phân loại và đường dẫn truy vết.
- Các lô đủ căn cứ ghi một lần, tiền ví và bộ đếm giữ đúng tác động của nghiệp vụ.
- Sổ sau chuyển đổi khớp số dư đã được người có quyền xác nhận.
- Báo cáo bàn giao nêu rõ nguồn còn thiếu chứng từ. Nghiệm thu chuyển đổi dữ liệu
  thực tế phụ thuộc hồ sơ được cung cấp và xác nhận của nhóm dự án.

## 8. P5 — UAT đầu cuối bằng giao diện sáu vai trò

Mỗi ca có ID, role, dữ liệu đầu vào, bước thao tác UI, kết quả API/DB, số liệu
trước/sau, ảnh chụp và trạng thái đạt/lỗi. Fixture tồn tại trong DB cô lập và
được tạo bằng nghiệp vụ/API hoặc đánh dấu rõ phần mô phỏng chứng từ ngoài hệ thống.

| Mã | Chuỗi thao tác | Vai trò và số liệu phải đối chiếu |
|---|---|---|
| U01 | Tạo tạm ứng → duyệt → giải ngân → quyết toán nhiều lần → hoàn tiền | Employee, TL, Accountant cùng nhìn đúng số còn phải quyết toán; Manager thấy đúng ngân sách/chi phí. |
| U02 | Tự chi → duyệt → xác nhận chứng từ → thanh toán | Employee nhận đúng tiền; Accountant ghi chi phí một lần; TL/Manager thấy đúng danh mục/giai đoạn. |
| U03 | Yêu cầu bị từ chối/hủy ở các bước hợp lệ | Tiền giữ được nhả đúng yêu cầu, số liệu theo dõi ở các role khớp. |
| U04 | Cấp quỹ phòng ban → dự án, thử vượt hạn mức | Manager, CFO, TL, Accountant thấy đúng phân bổ, số dư và ngân sách khả dụng. |
| U05 | Import lương → sửa dòng → netting → chi → thay phiếu | Accountant, Employee và báo cáo liên quan khớp lương hiệu lực, khấu trừ và dư tạm ứng. |
| U06 | Nhập sao kê → matching → nạp quỹ → đảo | CFO/Accountant thấy đúng phạm vi ngân hàng và tiền đang chuyển; journal/tiền khớp. |
| U07 | Đảo từng loại nguồn theo quan hệ phụ thuộc | Các role liên quan thấy đúng trạng thái, chi phí, công nợ và ngân sách sau đảo. |
| U08 | Preview → đóng kỳ → correction sau đóng kỳ | Kiểm trường hợp hợp lệ, ngoại lệ nguồn, kỳ đang chạy và ngày ghi sổ. |
| U09 | Ghi bù → chạy lại → mở sổ → kiểm mốc chuyển đổi | Accountant truy được căn cứ và đối chiếu được số dư. |
| U10 | Nhập nhân sự/phòng ban và báo cáo theo role | Admin, Manager, TL thấy đúng dữ liệu được cấp quyền, audit có đủ kết quả. |
| U11 | Sổ tài khoản/báo cáo/Excel sau các ca U01–U10 | Số dư đầu + phát sinh = số dư cuối; file và UI cùng phạm vi, cùng mốc. |
| U12 | Lỗi API, retry, back/forward, đổi nguồn nhanh, mở link trực tiếp | Mỗi role nhận đúng dữ liệu và thông báo lỗi theo quyền. |

Kiểm đồng thời bổ sung cho giải ngân, quyết toán/hoàn tiền/netting cùng khoản,
chi/thay phiếu, xác nhận lô Excel và ghi sổ/đóng kỳ. Các lỗi phát hiện trong UAT
được gắn ca tái hiện, sửa rồi chạy lại ca lỗi cùng các nhánh bị ảnh hưởng.

**Kết quả live ngày 06/11/2026:** chạy trên bản sao cô lập từ DB Docker local,
backend V36 và frontend production build, phản hồi API thật. Sáu role đăng nhập
và mở trang tài chính theo quyền; Accountant mở các tab sổ cái, sổ tài khoản,
quỹ, đối soát, lịch sử, kỳ và Excel; hai link nguồn từ giao dịch ví mở đúng
request/payslip. Bộ chọn lọc đạt 8/8 ca, bộ link đạt 2/2 ca. Xuất Excel sáu role
trả workbook XLSX thật. Đây là nghiệm thu đọc/điều hướng, chưa phải kết quả
U01–U12 cho các thao tác tài chính. Tài khoản thử chỉ được chuẩn hóa trên bản
sao; bản DB gốc không bị sửa, token tạm đã xóa và dịch vụ kiểm thử đã dừng.

## 9. P6 — Tài liệu và bàn giao

- Cập nhật `ledger-accounting.md`, `API_CONTRACT.md`, review triển khai, plan
  tổng và tài liệu backend theo contract/nghiệp vụ thực tế sau sửa.
- Báo cáo riêng trạng thái triển khai code, nghiệm thu trên DB cô lập và chuyển
  đổi dữ liệu thật. Tỷ lệ hoàn thành chỉ tính từ danh sách task có tiêu chí đạt.
- Lưu kết quả test gắn commit frontend/backend và Flyway version, kèm giới hạn
  dịch vụ bên ngoài được kiểm bằng fixture.
- Nếu schema cần thay đổi, tạo version mới sau V36 và kiểm DB trống/bản sao cũ.
  Các V đã áp dụng được giữ nguyên để Flyway xác minh lịch sử.
- Khi được yêu cầu phát hành, chia commit theo nhóm thay đổi và kiểm lại trước push.

## 10. Thứ tự triển khai và điều kiện chốt

| Thứ tự | Gói | Phụ thuộc | Đầu ra cần duyệt/kiểm |
|---|---|---|---|
| 1 | P0 | Code và nghiệp vụ đã chốt | Ma trận event/nguồn/ảnh hưởng/ngoại lệ |
| 2 | P1 | P0 | API preview đóng kỳ, UI ngoại lệ và kiểm correction |
| 3 | P2 | P0, contract P1 | Điều hướng, state và link nguồn qua sáu role |
| 4 | P3 | P1–P2, dataset hiện hành | Báo cáo kiểm nội dung import/export từng dataset |
| 5 | P4 | P0–P1, hồ sơ lịch sử | Báo cáo phân loại/chuyển đổi và số dư đối chiếu |
| 6 | P5 | P1–P4 | Ma trận UAT có kết quả, lỗi đã xử lý và ca chạy lại |
| 7 | P6 | Kết quả các gói | Tài liệu đồng bộ và báo cáo bàn giao |

### Checklist nghiệm thu cuối

- [x] P0 có ma trận đủ mọi event và vai trò liên quan.
- [x] P1 phát hiện ngoại lệ nguồn và phân trang; preview/close kiểm tra lại dưới khóa; có hồi quy tranh chấp close/writer và chuỗi đảo EXPENSE/thay phiếu lương trên PostgreSQL.
- [ ] P2 đạt deep link, back/forward, retry và đổi nguồn trên các trang trong phạm vi.
- [ ] P3 kiểm nội dung tất cả dataset/scope theo ma trận quyền đã lập.
- [ ] P4 hoàn tất kiểm kê và xử lý nguồn có đủ chứng từ, có báo cáo nguồn còn thiếu.
- [ ] P5 có kết quả UI đầu cuối của sáu vai trò, các ca tài chính đồng thời và regression.
- [ ] P6 cập nhật đồng bộ toàn bộ tài liệu/contract, phiên bản và kết quả nghiệm thu sau P2–P5.
- [ ] Các lỗi nghiêm trọng/cao ảnh hưởng tiền, công nợ, chi phí, quyền và dữ liệu đã đóng.
- [ ] Các lỗi còn lại nếu có được liệt kê với mức ảnh hưởng và xác nhận xử lý của nhóm.

P0 và P1 đã hoàn tất theo phạm vi code/hồi quy nêu trên. P2/P3 còn nghiệm thu live
và so khớp báo cáo toàn diện. P4 chỉ được ghi bù trên bản sao khi có chứng từ;
P5/P6 cần đóng trước khi tuyên bố hoàn tất. Các mục checklist còn mở không được
tính là nghiệm thu chỉ vì build hoặc test đại diện thành công.
**Cập nhật 07/11/2026 — tiếp tục hoàn thiện P2–P6**

Trong lượt kiểm tra hiện tại:

- P2: chạy `npx playwright test -c playwright.ledger.config.ts`; 19/19 ca browser fixture đạt trên production server. Kiểm tra reload/back-forward, URL filter, retry/API error, đổi scope, phân trang, thao tác mobile và trạng thái kỳ. Đây là UI test với API mock, không phải nghiệm thu sáu role trên DB thật.
- P3: frontend build thành công; code hiện đã truyền filter event vào export sổ tài khoản, export kiểm toán theo bộ lọc toàn bộ, và khôi phục dataset/scope/date từ URL. Tuy nhiên lượt test này chưa xác minh mọi workbook đối chiếu API/DB cùng snapshot và ma trận role/scope đầy đủ.
- P4: inventory tổng hợp ngày 06/11 vẫn là nguồn hiện có. Không có chứng từ lịch sử mới trong workspace để phân loại/ghi bù; không sửa dữ liệu gốc hoặc tự suy diễn số liệu.
- P5: chưa chạy được vì Docker Desktop engine hiện không kết nối, nên không thể dựng bản sao DB an toàn cho U01–U12. Không dùng tài khoản đã cung cấp để ghi lên môi trường thật.
- P6: cập nhật báo cáo và tài liệu trạng thái bằng kết quả thực tế bên dưới; chỉ đóng bàn giao sau khi các blocker P2–P5 được xử lý.
- Kiểm chứng kỹ thuật: `npm run build` đạt; `npm run lint` thất bại với 8 lỗi `react-hooks/set-state-in-effect` ở 5 file accounting/detail/picker và 9 warning khác. Đây là lỗi lint, chưa có bằng chứng chúng gây lỗi runtime. Playwright chạy không chỉ định config ban đầu thất bại 19/19 do thiếu `baseURL`; chạy đúng `playwright.ledger.config.ts` đạt 19/19.
- Backend: `mvnw.cmd -Dtest=FinancialWorkflowIntegrationTest test` biên dịch và khởi chạy được nhưng 20/20 test bị skip do thiếu Docker/Testcontainers. Vì vậy đây không phải lượt xác nhận backend integration pass.

**Tồn đọng để đóng plan:** (1) sửa các lỗi lint hoặc ghi nhận lý do miễn trừ có kiểm soát; (2) mở được Docker/test DB clone để chạy integration và UI live UAT; (3) đối chiếu mọi export/report theo snapshot và role/scope; (4) nhận chứng từ nguồn cho từng khoản legacy đủ điều kiện, rồi preview/commit/backfill trên clone; (5) lưu kết quả U01–U12, số liệu trước/sau và chạy lại regression.

Không có lỗi nghiệp vụ mới được tái hiện trong 19 ca fixture. Chưa thể kết luận toàn bộ sổ cái đã hết lỗi vì các bước live và dữ liệu lịch sử còn mở.

## 11. Cập nhật tiến độ sau lượt kiểm tra 07/11/2026

| Gói | Trạng thái hiện tại | Kết quả mới nhất / điều kiện còn thiếu |
|---|---|---|
| P2 | UI fixture đạt; live acceptance còn mở | 19/19 browser fixture đạt bằng cấu hình dự án. Chưa có live UI/database test cho mọi trạng thái và role. |
| P3 | Một phần | Build đạt; kiểm tra nội dung export cùng API/DB snapshot, đầy đủ role/scope/giới hạn vẫn chưa chạy. |
| P4 | Inventory hoàn tất; conversion chưa thể làm | Workspace không có hồ sơ chứng từ lịch sử đủ căn cứ. Không backfill cho đến khi có chứng từ và xác nhận số dư. |
| P5 | Chưa hoàn tất | Docker engine không khả dụng; integration test 20 ca bị skip và UI U01–U12 chưa chạy trên DB clone. |
| P6 | Tài liệu cập nhật một phần | Có cập nhật trạng thái kiểm thử, nhưng không thể đóng bàn giao trước P2–P5. |

**Kết luận:** Chưa hoàn tất các P còn lại. Đây là các blocker môi trường và chứng từ, không phải lý do để tự ghi dữ liệu tài chính. Các ca fixture/build thành công chỉ xác nhận phần tương ứng.
