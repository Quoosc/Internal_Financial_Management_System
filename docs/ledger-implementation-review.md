# IFMS — review triển khai sổ cái và Excel

**Ngày review:** 21/10/2026.

**Phạm vi:** working tree frontend và backend `LẬP TRÌNH JAVA/IFMS`, đối chiếu
với `ledger-completion-and-excel-plan.md` và các quyết định nghiệp vụ đã chốt.

**Kết luận:** mô hình nghiệp vụ chính đã được triển khai đúng hướng IFMS,
nhưng chưa đủ điều kiện đánh dấu hoàn thành toàn bộ kế hoạch. Có lỗi hồi quy,
số liệu chưa đồng nhất giữa các role, kiểm soát đóng kỳ/nạp quỹ còn thiếu và
ma trận Excel chưa đủ. Các phát hiện dưới đây dựa trên đọc code; không phải
kết quả chạy lại UI hoặc các tình huống runtime trong lượt review này.

## 1. Phần đã triển khai và có thể giữ lại

| Hạng mục | Thay đổi đã có | Giới hạn của kết luận |
|---|---|---|
| Giao dịch ví | Một dòng mỗi transaction; chi tiết có biến động từng ví. | Dữ liệu cũ trong DB vẫn có thể là dữ liệu demo đã seed từ trước. |
| Nhật ký kế toán | Header/lines riêng; ghi nhận/đối ứng cân bằng, nguồn, actor, ngày, snapshot và chiều dữ liệu. | Cân bằng số học không chứng minh chứng từ hoặc toàn bộ dữ liệu lịch sử đã đầy đủ. |
| Nhân viên tự chi (EXPENSE) | Xác nhận chứng từ tạo chi phí/khoản phải hoàn; thanh toán riêng tất toán khoản phải hoàn. | Cần nghiệm thu toàn luồng với chứng từ thật và dữ liệu chuyển đổi. |
| Tạm ứng (ADVANCE) | Giải ngân tạo dư phải quyết toán, không cộng chi phí. | Các màn hình nhân sự Manager/Team Leader còn lấy sai nguồn dư nợ, xem F03. |
| Quyết toán tạm ứng (REIMBURSE) | Giảm đúng AdvanceBalance và ghi chi phí; không chuyển thêm tiền. | Khoản quyết toán phải giữ đúng dự án/giai đoạn/danh mục của khoản gốc. |
| Hoàn tiền thật | USER → PROJECT; giảm dư tạm ứng cùng giao dịch/journal, có idempotency key. | Không suy diễn rằng số dư USER luôn bằng dư tạm ứng. |
| Khấu trừ lương | FIFO, giữ giới hạn 50% thu nhập sau khấu trừ khác; journal lưu phân bổ từng tạm ứng. | Chưa nghiệm thu mọi nhánh đảo/thay thế payroll và đồng thời với hoàn/quyết toán. |
| Tiền giữ | Request có reservedAmount; giữ, sử dụng, giải phóng theo request; backend kiểm scope/hạn mức. | Tiền đang khóa và cam kết chưa ghi chi phí là hai chỉ tiêu khác nhau. |
| Bất biến journal | V22 kiểm tra đủ dòng/tổng ở cuối transaction, khóa kỳ và chặn thêm dòng sau khi đã ghi; chống sửa/xóa. | Chỉ có hiệu lực trên DB đã migrate. |
| Sổ theo tài khoản | Đầu kỳ, phát sinh, cuối kỳ và số dư chạy qua các trang từ journal. | UI chưa có đủ bộ lọc chiều dữ liệu mà API hỗ trợ. |
| Sửa sai | Đảo toàn phần liên kết gốc, kiểm nguồn phụ thuộc, đồng bộ ví/chi phí/tạm ứng; có thay thế phiếu lương. | Quy tắc ngày đảo và kiểm tra trước đóng kỳ còn thiếu, xem F06. |
| Chuyển đổi lịch sử | Tìm mã nguồn tại DB; xem trước lô, yêu cầu chứng từ; mở sổ phần chênh lệch, chặn ghi bù tự động sau mở sổ. | Chưa chạy chuyển đổi trên dữ liệu chính; nguồn thiếu hồ sơ phải giữ ngoại lệ. |
| Đối chiếu chi phí | So request + phân bổ chứng từ + journal, sửa counter có PIN và biên bản trước/sau. | Cơ chế ghi nhận PIN sai đang có lỗi rollback ở F07. |
| Đối soát | Tách tổng ví nội bộ với ngân hàng; account/cutoff/sao kê/matching, PENDING/BOOKED. | Luồng nạp quỹ mới chưa bắt buộc chứng cứ BOOKED, xem F05. |
| Excel | .xlsx, schema, template, preview, kiểm lại khi commit, toàn lô, chống commit lặp, export server theo quyền. | Chưa đủ ma trận/filter/audit và tham chiếu nhập liệu, xem F09–F10. |
| Startup/live UI | Demo seed chỉ trong profile demo; ngoài demo tạo cấu trúc/ví 0; route demo chuyển về ledger thật. | Không tự xóa dữ liệu mẫu cũ; bootstrap ADMIN chưa có đường thiết lập PIN hoàn chỉnh. |

## 2. Lỗi và thiếu sót xác định từ code

P1: cần xử lý trước nghiệm thu nghiệp vụ. P2: phần còn thiếu về sử dụng,
tính nhất quán hoặc khả năng xử lý dữ liệu. Trạng thái mọi mục bên dưới:
**chưa sửa trong lượt review này**.

### F01 — P1: cập nhật dự án gọi tạo lại ví đã có

- `ManagerProjectServiceImpl.updateProject()` gọi `createWallet()` sau khi save.
- `WalletServiceImpl.createWallet()` từ chối ví đã tồn tại. Dự án mới đã được
  cấp ví khi tạo; V31 cũng bổ sung ví còn thiếu cho dự án cũ.
- Đổi tên, chuyển PLANNING → ACTIVE hoặc cập nhật dự án có ví sẽ bị lỗi và
  rollback. Điều này còn chặn sử dụng dự án mới sau khi import.
- Sửa: chỉ tạo ví trong luồng tạo dự án; việc bổ sung ví cũ thực hiện qua
  migration/quy trình rõ ràng. Kiểm lại update và các luồng tài chính đồng thời.
- Nghiệm thu: cập nhật dự án thành công, số ví và số dư không đổi; dự án mới
  có đúng một ví 0.
- Bằng chứng: [ManagerProjectServiceImpl:244][be-manager-update],
  [WalletServiceImpl:234][be-wallet-create].

### F02 — P1: Team Leader nhận sai quỹ/ngân sách khả dụng

- `resolveAvailableBudget()` dùng `totalBudget + totalSpent - resolvedSpent`.
- Khi hai chỉ tiêu spent khớp, kết quả luôn bằng ngân sách kế hoạch. Ví dụ:
  ngân sách 100 triệu, chi phí 20 triệu, vẫn trả 100 triệu thay vì phần còn lại.
- UI Team Leader còn gọi giá trị này là “Quỹ khả dụng”, mô tả là tiền thực tế
  có thể dùng. Trong khi trang Accountant đã lấy số dư từ Wallet.
- Sửa: trả riêng ngân sách kế hoạch, chi phí, cam kết, dư tạm ứng, tiền ví,
  tiền khóa và tiền ví khả dụng; dùng cùng định nghĩa ở mọi role.
- Nghiệm thu: cùng dự án có cùng số liệu gốc giữa Team Leader, Manager,
  Accountant và export; không gọi hạn mức kế hoạch là tiền có thể chi.
- Bằng chứng: [TeamLeaderProjectServiceImpl:644][be-tl-available].

### F03 — P1: dư nợ trên nhân sự Manager/Team Leader còn lấy tiền khóa ví

- Danh sách/chi tiết nhân sự Manager và Team Leader dùng USER.lockedBalance
  để gán debtBalance.
- Tiền khóa ví không phải tạm ứng còn phải quyết toán. Nhân viên còn nợ
  1,4 triệu nhưng ví không khóa có thể hiện nợ 0; tiền giữ cho rút ví lại có
  thể bị hiểu nhầm thành nợ.
- Sửa: dùng tổng AdvanceBalance.remainingAmount và đúng scope dự án/phòng
  ban được phép xem; không trả công nợ ngoài scope của Team Leader.
- Nghiệm thu: giải ngân, quyết toán, hoàn tiền và khấu trừ cập nhật dư nợ
  nhất quán ở Accountant, nhân viên, Manager, Team Leader và Excel.
- Bằng chứng: [ManagerProjectServiceImpl:114][be-manager-debt],
  [TeamLeaderProjectServiceImpl:493][be-tl-debt].

### F04 — P1: thay đổi hạn mức giai đoạn chưa kiểm tra tổng cơ cấu

- Tạo phase kiểm tổng hạn mức mọi phase ≤ totalBudget; cập nhật phase chỉ
  so phần tăng với totalBudget.
- Dự án 100 triệu có phase 60 + 40; sửa phase đầu thành 90 vẫn qua kiểm tra
  phần tăng 30 ≤ 100, dù tổng thành 130.
- Giảm hạn mức phase cũng chưa kiểm tổng hạn mức các category đang nằm bên
  trong. Guard chi phí/cam kết/tạm ứng không thay thế ràng buộc cơ cấu này.
- Sửa: kiểm tổng phase sau thay đổi và tổng category hiện tại trong phase,
  giữ lock project cùng transaction. Các guard chi tiền hiện có vẫn cần giữ.
- Nghiệm thu: không tạo được cấu hình vượt tổng ở cả form/API và Excel.
- Bằng chứng: [TeamLeaderProjectServiceImpl:383][be-tl-phase].

### F05 — P1: nạp quỹ mới chưa bắt buộc sao kê BOOKED như tài liệu ghi

- `CompanyFundServiceImpl.topup()` gọi `systemTopup()` và ghi journal ngay.
- Wallet chỉ kiểm paymentRef có nội dung, chống dùng lại cùng mã và số tiền;
  không kiểm dòng sao kê, account, chiều IN, BOOKED hoặc số tiền đã dùng.
- Kiểm `hasBookedMatch()` hiện nằm trong **ghi bù lịch sử**, chưa áp dụng cho
  nạp quỹ mới. Một mã tự nhập vẫn có thể tăng số dư quỹ và tạo journal.
- Sửa: nạp quỹ chọn nguồn tiền vào đã xác minh, lock/chống sử dụng lặp;
  cập nhật tiền, journal và matching trong cùng transaction. Import sao kê
  tiếp tục chỉ ghi chứng cứ, không tự nạp tiền.
- Nghiệm thu: chưa có căn cứ, sai tiền/account/chiều hoặc chứng cứ đã dùng
  đều bị chặn; retry không tăng quỹ lần hai.
- Bằng chứng: [CompanyFundServiceImpl:48][be-topup],
  [WalletServiceImpl:400][be-wallet-topup],
  [AccountingBackfillService:172][be-backfill-topup].

### F06 — P1: đóng kỳ và ngày đảo chưa đủ điều kiện đã duyệt

- Đóng kỳ hiện kiểm tháng đã kết thúc, lý do và journal cân bằng. Chưa có
  báo cáo kiểm nguồn liên kết, tình trạng đối soát và các ngoại lệ để xác
  nhận trước đóng kỳ như mục 4.3 của plan.
- Đảo chỉ chặn ngày tương lai; trigger chặn kỳ đã đóng. Chưa chặn ngày đảo
  trước ngày bút toán gốc, hoặc bắt buộc kỳ hiện tại đang mở khi kỳ gốc đã đóng.
- Ví dụ: bút toán tháng 9 đã đóng, nhưng tháng 8 còn mở thì ngày đảo tháng 8
  chưa bị điều kiện hiện tại từ chối. Tháng 10 mới là kỳ cần ghi điều chỉnh
  theo quy tắc đã duyệt.
- Sửa: pre-close preview có kết quả từng điều kiện và ngoại lệ; xác nhận
  lại tại commit. Enforce quy tắc ngày/kỳ trong service; tiếp tục giữ trigger.
  Dư tạm ứng chưa quyết toán được chuyển kỳ, không phải lỗi tự động chặn đóng.
- Bằng chứng: [AccountingPeriodService:35][be-period],
  [AccountingCorrectionService:35][be-reversal-date].

### F07 — P1: PIN sai ở mở sổ/đối chiếu chi phí có thể mất bộ đếm thử sai

- Hai entrypoint dùng transaction mặc định, gọi verifyMyPin rồi ném
  UnauthorizedException khi PIN sai. Transaction ngoài rollback cả retryCount.
- `noRollbackFor` của verifyMyPin không tách nó khỏi transaction ngoài đang
  tham gia. Luồng đảo/disburse đã có chính sách khác, nên hiện không đồng nhất.
- Sửa: lưu lần thử PIN/khóa PIN bền vững ở transaction riêng hoặc áp dụng
  chính sách transaction phù hợp; vẫn bảo đảm nghiệp vụ tài chính lỗi rollback.
- Nghiệm thu: nhập sai liên tiếp qua cả hai API vẫn bị khóa đúng số lần;
  không có thay đổi tiền/journal khi PIN sai.
- Bằng chứng: [AccountingOpeningService:59][be-opening-pin],
  [AccountingCostReconciliationService:59][be-cost-pin],
  [ProfileServiceImpl:196][be-pin].

### F08 — P1: ADMIN bootstrap chưa thiết lập được PIN qua UI hiện có

- ADMIN đầu tiên được tạo isFirstLogin=false và security settings có PIN null.
- Đăng nhập bỏ qua first-login setup cho ADMIN; API đổi PIN yêu cầu PIN hiện
  tại, đồng thời báo lỗi khi tài khoản chưa có PIN.
- Vì vậy “bootstrap tạo ADMIN thành công” chưa đồng nghĩa onboarding hoàn tất.
- Sửa: bổ sung đường thiết lập PIN đầu tiên đã xác thực cho ADMIN/bootstrap;
  không dùng PIN mặc định và không làm mất PIN của tài khoản đang tồn tại.
- Bằng chứng: [DataInitializer:203][be-bootstrap],
  [AuthServiceImpl:331][be-auth-setup], [ProfileServiceImpl:166][be-pin-change].

### F09 — P2: export chưa bảo toàn bộ lọc/phạm vi đang xem

- DataExchange UI gửi scope/from/to. Chưa có đầy đủ account, employee,
  project, event, status, search hoặc bộ lọc actor/action của audit.
- API journal export có các chiều account/employee/project, nhưng thiếu
  event/request tương ứng danh sách journal và UI chưa truyền các chiều đó.
- Export chung nhiều dataset chỉ hiểu ngày tạo. Với tạm ứng, chọn khoảng
  ngày không có nghĩa tái dựng dư tạm ứng tại ngày cuối kỳ.
- Nút CSV audit cũ vẫn xuất trang hiện tại; đã có xử lý tiền tố công thức,
  nhưng chưa thay bằng export backend giữ đầy đủ bộ lọc như X6 yêu cầu.
- Sửa: contract filter riêng cho từng báo cáo, truyền từ màn hình sang export,
  ghi rõ ngày tạo/ngày ghi sổ/cutoff; kiểm tổng theo cùng định nghĩa.
- Bằng chứng: [DataExchange:57][fe-excel],
  [AccountingExcelConfiguration:19][be-journal-export],
  [ExcelExportSpecification:26][be-export-filter],
  [AuditLogs:441][fe-audit-export].

### F10 — P2: Excel chưa đủ ma trận, tham chiếu và nhật ký

- Template request yêu cầu phaseId/categoryId nhưng tham chiếu hiện mới có
  PROJECT và ADVANCE; thiếu danh mục phase/category cho yêu cầu mới.
- Template phòng ban chưa cấp danh sách manager đủ điều kiện dù có managerId.
- Chưa thấy dataset chi tiết dư tạm ứng theo nhân viên trong scope Team Leader,
  danh sách nhân sự/ngân sách phòng ban cho Manager, báo cáo chi phí chi tiết
  theo phase/category và báo cáo đối soát tổng hợp theo ma trận đã duyệt.
- Project summary có số tạm ứng tổng; không thay thế danh sách nhân viên và
  khoản tạm ứng chi tiết của từng dự án.
- Import có batch/checksum/actor/result. Export hiện tạo workbook và trả file;
  chưa thấy nhật ký export lưu filter/scope/kết quả/checksum theo X0/X6.
- Sửa: hoàn thiện bảng dataset × role × scope × filter × import/export;
  bổ sung tham chiếu đủ để người dùng nhập mà không phải tìm ID thủ công.
- Bằng chứng: [EmployeeRequestExcelDataset:50][be-request-template],
  [DepartmentExcelDataset][be-dept-template],
  [SpreadsheetService:109][be-export], [ProjectSummaryExcelConfiguration][be-summary-export].

### F11 — P2: UI và hiệu năng chưa hoàn thành mọi tiêu chí G4/R18

- Màu xanh IFMS, card/table, CurrencyInput, SideDrawer, error/empty và phần
  chính ledger đã được thống nhất. Trang ledger giữ tab/filter/page trong URL
  và loại response cũ.
- Bộ lọc journal còn bắt nhập ID nhân viên/dự án/yêu cầu. Sổ theo tài khoản
  chỉ có account/from/to; chưa đưa các chiều đối tượng từ API lên UI.
- Trang đối chiếu chi phí còn hiện phase/category bằng ID; ngày và state URL
  của các trang mới chưa đồng nhất với ledger chính.
- Danh sách tạm ứng/ngân sách vẫn trả toàn bộ và truy thêm theo từng khoản,
  từng dự án/phase/category. Đây là phần R18 còn tồn tại, chưa phải dữ liệu
  lớn đọc theo lô/aggregate như plan.
- Gợi ý matching ngân hàng lấy 100 transaction mới nhất cùng số tiền rồi lọc
  tiếp trong Java; không có tìm mã/phân trang. Giao dịch cũ có thể không xuất
  hiện trong lựa chọn dù hợp lệ.
- Sửa: picker theo mã/tên có scope, giữ state, phân trang/aggregate server,
  tìm matching trực tiếp trong DB với mã/ngày/chiều/trạng thái chưa khớp.
- Chưa nghiệm thu trực quan desktop/mobile và sáu role bằng browser.
- Bằng chứng: [Ledger:469][fe-ledger-filter], [AccountLedger:24][fe-account-filter],
  [AccountingJournalServiceImpl:281][be-advance-list],
  [WalletFinancialEvidenceService:67][be-match-candidates].

## 3. Luồng mới cần hiểu thống nhất

### 3.1 Nhân viên tự chi và được hoàn tiền

1. Nhân viên chi tiền cá nhân, gửi yêu cầu hoàn chi kèm chứng từ (EXPENSE).
2. Team Leader duyệt; hệ thống giữ tiền của request trong ví dự án.
3. Accountant xác nhận và phân bổ chứng từ: ghi chi phí + khoản phải hoàn;
   tăng chi phí project/phase/category. Chưa chuyển ví.
4. Accountant thanh toán: PROJECT → USER, giải phóng phần tiền giữ và tất toán
   khoản phải hoàn. Không ghi chi phí lần hai.

### 3.2 Tạm ứng và xử lý phần còn phải quyết toán

1. Nhân viên xin tạm ứng (ADVANCE), Team Leader duyệt và giữ tiền theo request.
2. Accountant giải ngân PROJECT → USER: tăng khoản phải quyết toán, chi phí = 0.
3. Nhân viên nộp chứng từ quyết toán (REIMBURSE): Accountant chấp nhận bao nhiêu
   thì ghi chi phí và giảm dư tạm ứng bấy nhiêu; không chuyển thêm tiền.
4. Tiền không sử dụng có thể hoàn USER → PROJECT (ADVANCE_RETURN), hoặc bù trừ
   qua lương theo quy tắc đã chốt. Hai cách đều giảm dư, chỉ cách đầu chuyển ví.

| Bước | Ví dự án | Dư tạm ứng | Chi phí dự án |
|---|---:|---:|---:|
| Ban đầu | 10.000.000 | 0 | 0 |
| Giải ngân 3 triệu | 7.000.000 | 3.000.000 | 0 |
| Xác nhận chứng từ 2,2 triệu | 7.000.000 | 800.000 | 2.200.000 |
| Nhân viên hoàn thật 300 nghìn | 7.300.000 | 500.000 | 2.200.000 |
| Bù trừ lương 500 nghìn | 7.300.000 | 0 | 2.200.000 |

Ví USER có thể chứa tiền cá nhân, lương, hoàn chi và tạm ứng. Số dư ví USER
không được dùng thay dư tạm ứng. Tiền lương thực lĩnh chuyển từ quỹ công ty;
bù trừ 500 nghìn không tạo giao dịch giả về ví dự án.

### 3.3 Phân bổ quỹ, nạp quỹ và nạp/rút cá nhân

- COMPANY → DEPARTMENT → PROJECT là phân bổ nội bộ: chuyển tiền và tài khoản
  tiền, không tự tạo chi phí.
- SYSTEM_TOPUP có journal và chống trùng paymentRef; cần hoàn thiện F05 để
  nguồn tiền mới đáp ứng kiểm chứng BOOKED.
- Nạp/rút USER cá nhân hiện ở sổ giao dịch ví; không đưa vào tiền doanh nghiệp
  giữ hộ. MockBank rút cá nhân vẫn là tích hợp mô phỏng ngoài phạm vi sổ nội bộ.

### 3.4 Sửa sai và dữ liệu lịch sử

- Sửa sai giữ bản gốc, tạo đảo toàn phần liên kết, kiểm tra phụ thuộc và đồng
  bộ nguồn. Khoản đã trả chỉ đảo khi tiền có thể thu lại theo luồng hiện tại.
- Chuyển đổi lịch sử chỉ ghi bù nguồn đủ căn cứ; không chuyển tiền thêm.
  Mở sổ ghi chênh lệch có xác nhận, không thay số dư ví nguồn.
- Sổ chỉ có ý nghĩa toàn bộ sau khi đối chiếu nguồn/mở sổ; API thật không tự
  làm dữ liệu cũ trở thành dữ liệu đã được xác minh.

## 4. Mức hoàn thành so với plan

| Gói | Đánh giá sau review | Cần hoàn tất |
|---|---|---|
| G0 | Migration/demo isolation đã có; clone đã được kiểm tra ở lượt trước. | F08; kiểm lịch sử/checksum DB chính, cấu hình deploy; dữ liệu seed cũ. |
| G1 | Lõi chi/ứng/quyết toán/hoàn/lương đã có và tách đúng bản chất. | F01–F04, F07; test đồng thời mở rộng và đồng nhất số liệu các role. |
| G2 | Journal bất biến, actor/chiều dữ liệu, sổ tài khoản, chứng từ và đối soát đã có. | F02–F05, F09–F11; kiểm nguồn tiền và report cùng scope. |
| G3 | Đảo, mở sổ, ghi bù và đối chiếu counter đã có. | F06–F07; nghiệm thu nhánh đảo/closing và chuyển đổi dữ liệu thực. |
| G4 | Trang live nối API và dùng phong cách IFMS; demo được nghỉ dùng. | Picker/URL/filter/export, UI desktop/mobile, sáu role. |
| X0–X6 | Có nền Excel thật và các bộ nhập chính. | F09–F10; hoàn thiện ma trận dataset, báo cáo, tham chiếu, audit và nghiệm thu từng file. |
| D1 | Tài liệu có phân biệt lịch sử/code/kiểm chứng. | Các mô tả nạp quỹ BOOKED và hoàn thành X0–X6 phải đọc kèm review này; cập nhật contract sau sửa. |
| V1 | Lượt trước ghi nhận build, 12 test và API smoke trên DB clone. | Chưa phải nghiệm thu tất cả điều kiện mục 7; các tình huống F01–F11 chưa được chứng minh đã qua. |

Không gán phần trăm hoàn thành: chưa có bộ tiêu chí trọng số và còn lỗi chặn
luồng. Cũng không đánh dấu toàn bộ là hoàn thành chỉ dựa vào số API/migration.

## 5. Thứ tự xử lý tiếp và điều kiện chốt

1. **Sửa hồi quy và nguồn số liệu:** F01–F04. Kiểm chuỗi tạo/import dự án →
   kích hoạt → cấp vốn → chi phí/tạm ứng; đối chiếu dư nợ sáu role.
2. **Hoàn thiện kiểm soát tài chính:** F05–F08. Kiểm nạp quỹ chưa/đã BOOKED,
   dùng lại chứng cứ; pre-close và correction khi kỳ gốc đóng; PIN sai và
   bootstrap lần đầu. Giữ nguyên mọi quyết định nghiệp vụ đã duyệt.
3. **Hoàn thiện Excel:** F09–F10. Chốt đủ ma trận trong phạm vi plan, cùng filter
   với màn hình; mẫu đủ tham chiếu; nhật ký; test file hợp lệ/lỗi/quyền/rollback.
4. **Hoàn thiện UI và hiệu năng:** F11. Picker và filter/state, phân trang dữ liệu,
   tìm matching theo mã; nghiệm thu desktop/mobile với sáu role.
5. **Nghiệm thu dữ liệu và bàn giao:** đọc Flyway DB chính, chuyển đổi trên bản
   sao với hồ sơ thật, đối chiếu journal/chi phí/advance/ví/sao kê/export,
   lưu test report và quyết định xử lý ngoại lệ trước chuyển đổi thật.

Kiểm tra đã ghi nhận ở lượt trước không bao phủ toàn bộ các lỗi mới: integration
test hiện tập trung EXPENSE/đảo EXPENSE, chuỗi tạm ứng/hoàn/lương, chi đồng thời,
Excel phòng ban/công thức/idempotency, phân bổ category, mở sổ và counter; 5 test
DB tập trung journal seal/cân bằng/kỳ đóng. Chưa có bộ nghiệm thu đủ Manager update,
Team Leader budget, topup mới có BOOKED, PIN sai, bootstrap setup, tất cả dataset
và browser sáu role. Cần lưu lại report theo lần chạy/mã code khi xử lý tiếp.

**Dấu vết kiểm chứng còn lưu:** `target/surefire-reports` trong backend hiện
chứa run cũ ngày 19/10 (4 lỗi nạp ApplicationContext). Không có bộ report 12 test
của lần kiểm tra sau trong `target-verification/surefire-reports` ở thời điểm
review. Kết quả 12 test là kết quả đã báo ở lượt trước, chưa được chạy lại trong
lượt này; không dùng report cũ để khẳng định code hiện tại đã qua toàn bộ test.
Sau sửa F01–F11 cần chạy lại và lưu report kèm phiên bản/môi trường.

[be-manager-update]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/project/service/ManagerProjectServiceImpl.java:244>
[be-wallet-create]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/wallet/service/WalletServiceImpl.java:234>
[be-tl-available]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/project/service/TeamLeaderProjectServiceImpl.java:644>
[be-manager-debt]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/project/service/ManagerProjectServiceImpl.java:114>
[be-tl-debt]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/project/service/TeamLeaderProjectServiceImpl.java:493>
[be-tl-phase]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/project/service/TeamLeaderProjectServiceImpl.java:383>
[be-topup]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/accounting/service/CompanyFundServiceImpl.java:48>
[be-wallet-topup]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/wallet/service/WalletServiceImpl.java:400>
[be-backfill-topup]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/accounting/service/AccountingBackfillService.java:172>
[be-period]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/accounting/service/AccountingPeriodService.java:35>
[be-reversal-date]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/accounting/service/AccountingCorrectionService.java:35>
[be-opening-pin]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/accounting/service/AccountingOpeningService.java:59>
[be-cost-pin]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/accounting/service/AccountingCostReconciliationService.java:59>
[be-pin]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/profile/service/ProfileServiceImpl.java:196>
[be-bootstrap]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/config/DataInitializer.java:203>
[be-auth-setup]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/auth/service/AuthServiceImpl.java:331>
[be-pin-change]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/profile/service/ProfileServiceImpl.java:166>
[fe-excel]: <../app/(dashboard)/data-exchange/page.tsx:57>
[be-journal-export]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/accounting/service/AccountingExcelConfiguration.java:19>
[be-export-filter]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/spreadsheet/repository/ExcelExportSpecification.java:26>
[fe-audit-export]: <../app/(dashboard)/admin/audit-logs/page.tsx:441>
[be-request-template]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/request/service/EmployeeRequestExcelDataset.java:50>
[be-dept-template]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/organization/service/DepartmentExcelDataset.java>
[be-export]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/spreadsheet/service/SpreadsheetService.java:109>
[be-summary-export]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/project/service/ProjectSummaryExcelConfiguration.java>
[fe-ledger-filter]: <../app/(dashboard)/accountant/ledger/page.tsx:469>
[fe-account-filter]: <../components/accounting/account-ledger.tsx:24>
[be-advance-list]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/accounting/service/AccountingJournalServiceImpl.java:281>
[be-match-candidates]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/wallet/service/WalletFinancialEvidenceService.java:67>
