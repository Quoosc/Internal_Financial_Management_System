# IFMS — rà soát sổ cái và kế hoạch hoàn thiện nghiệp vụ, giao diện, Excel

**Ngày rà soát:** 18/10/2026.
**Trạng thái:** Đã được người dùng duyệt và đã triển khai phần chính. Phần 1–8 là ảnh chụp hiện trạng trước triển khai ngày 18/10; xem mục 9 để biết kết quả và việc còn lại ngày 21/10.
**Code đối chiếu:** frontend `7f75d7d`; backend IFMS `2ecab5b`.
**Repo backend đúng:** `D:/UIT/HK6 UIT/LẬP TRÌNH JAVA/IFMS`.

> **Review bổ sung 21/10:** [Review triển khai và các lỗi còn lại](ledger-implementation-review.md)
> xác định F01–F11, gồm cập nhật dự án tạo lại ví, số liệu Team Leader/Manager,
> kiểm hạn mức, chứng cứ nạp quỹ mới, đóng kỳ, PIN và phạm vi Excel/UI.
> Chưa đủ điều kiện đánh dấu hoàn thành mục 7; kết quả build/test trước đó
> không bao phủ các phát hiện mới này.

Tài liệu này thay thế backlog sổ cái ngày 10/10/2026 về thứ tự thực hiện và điều kiện hoàn thành. Giữ các quyết định nghiệp vụ người dùng đã xác nhận; bổ sung những lỗi phát hiện từ code hiện tại và phạm vi nhập/xuất Excel cho sáu vai trò.

## 1. Phạm vi và độ chắc chắn của kết quả

- Đã đọc code request, ví, tạm ứng, payroll, journal, ngân sách, đối soát, migration, seed dữ liệu; màn hình sổ cái/chi tiết, ví nhân viên và chức năng nhập/xuất hiện có.
- Các lỗi bên dưới được xác định bằng đối chiếu mã nguồn. Rủi ro khi thao tác đồng thời cần được tái hiện bằng integration test trước khi đóng task.
- Không khởi động backend trong lượt rà soát: migration đang trùng phiên bản và startup hiện có thể reset dữ liệu demo. Không thay đổi database.
- Không có dịch vụ lắng nghe ở localhost:3000/8080 lúc kiểm tra. Đánh giá giao diện trong tài liệu là đánh giá code/cấu trúc/tương tác; chưa phải nghiệm thu bằng trình duyệt.
- Không chạy lại build/test trong lượt lập plan. Kết quả compile/build ngày 10/10 là kết quả lịch sử, không chứng minh Flyway hoặc nghiệp vụ runtime ngày 18/10 đã đạt.
- Trạng thái migration trên database triển khai hiện **chưa xác minh**. Cần đọc `flyway_schema_history` trên từng môi trường; không suy ra trạng thái database từ biến môi trường của một phiên shell.

## 2. Những phần đã có trong code

| Hạng mục | Thực tế hiện tại |
|---|---|
| Giao dịch ví | Gọi API thật; một dòng mỗi transaction; chi tiết có biến động từng ví. |
| Nhật ký bút toán | Có journal/header-lines riêng, chín loại sự kiện; kiểm tra cân bằng lúc ghi bằng service. |
| Nhân viên tự chi | EXPENSE có bước xác nhận chứng từ và thanh toán hoàn chi riêng. |
| Quyết toán tạm ứng | REIMBURSE giảm dư tạm ứng, không chuyển thêm tiền. |
| Hoàn tiền thật | API và trang Ví nhân viên đã có thao tác USER → PROJECT theo khoản tạm ứng. |
| Khấu trừ lương | Có FIFO và dòng phân bổ đến AdvanceBalance; vẫn cần hoàn thiện khóa/idempotency của cả kỳ lương. |
| Theo dõi ngân sách | Có API dự án/giai đoạn/danh mục, nhưng một số chỉ tiêu đang lấy sai nguồn hoặc thiếu kiểm soát hạn mức. |
| Audit/bất biến | Có cột audit và migration chặn UPDATE/DELETE journal; actor và bảo vệ việc thêm dòng vẫn có lỗ hổng. |
| Excel | Accountant có tải mẫu và nhập payroll; Admin/CFO có xuất audit CSV trang hiện tại. Chưa có bộ import/export Excel cho sáu vai trò. |

**Có API thật không đồng nghĩa có dữ liệu nghiệp vụ thật.** Backend vẫn tạo giao dịch, tài khoản, số dư và payroll mẫu; mẫu Excel cũng chứa dữ liệu cố định.

## 3. Phát hiện cần xử lý, theo mức độ ưu tiên

P0: chặn khởi động hoặc có thể làm sai/mất tiền, sai hồ sơ tài chính. P1: sai số liệu, sai truy vết hoặc thiếu chức năng kế toán thiết yếu. P2: trải nghiệm, tính nhất quán và hiệu năng.

| ID | Mức | Phát hiện và ảnh hưởng | Bằng chứng |
|---|---|---|---|
| R01 | P0 | **Hai migration cùng V20.** Flyway có hai version 20 và sẽ từ chối validate/migrate khi quét. Không được xử lý bằng cách tự sửa checksum/đổi tên migration đã chạy. | [Thư mục migration][be-migrations]: `V20__ADD_ACCOUNTING_JOURNAL_AUDIT_AND_IMMUTABILITY.sql` và `V20__CREATE_DOCUMENT_EXTRACTIONS.sql`. |
| R02 | P0 | **Dữ liệu mẫu và reset vẫn chạy ở startup.** DataInitializer/DataSeeder là Component không có profile giới hạn; các cờ reset mặc định true. Có đoạn gán lại số dư USER, xóa/tạo lại payslip demo và tính lại FLOAT_MAIN mà không qua giao dịch/journal tương ứng. | [DataInitializer][be-init]:108–141, 850–925; [DataSeeder][be-seed]:122; application.yml:194–198. |
| R03 | P0 | **Chưa kiểm soát đủ phạm vi request và hạn mức ở backend.** validateCreateRequest chủ yếu kiểm tra có ID/đúng role/có attachment. Các hàm đọc entity chỉ findById; chưa xác thực đồng bộ membership, phase thuộc project, category thuộc phase, trạng thái dự án/giai đoạn và ngân sách còn được cam kết. incrementSpent còn bỏ qua âm thầm khi không có budget row. Có thể gửi tổ hợp ID không hợp lệ dù UI chỉ cho chọn đúng. | [RequestServiceImpl][be-request]:198–244, 1081; [ProjectQueryServiceImpl][be-project-query]:161–178; [CategoryBudgetServiceImpl][be-category]:177. |
| R04 | P0 | **Khóa/idempotency chưa bao trùm nghiệp vụ.** Các lần đọc request để duyệt/chi không có khóa/version. Nhánh REIMBURSE dùng AdvanceBalance đã đọc qua request, không lấy lại bằng findByIdForUpdate. Kỳ payroll cũng không khóa trước khi kiểm tra DRAFT. Request/journal unique riêng lẻ không đủ chống chi trùng hoặc mất cập nhật khi hai thao tác chạy đồng thời; ví chỉ khóa tổng tiền giữ. | [RequestServiceImpl][be-request]:881–1038; [RequestRepository][be-request-repo]:90–114; [AdvanceBalanceRepository][be-advance-repo]:36–46; [PayrollManagementServiceImpl][be-payroll]:498. |
| R05 | P0 | **Có thể xóa payslip đã thanh toán bằng confirm-overwrite.** Service chỉ kiểm tra kỳ tồn tại rồi deleteAllByPeriodId, không yêu cầu DRAFT và không bảo vệ payslip PAID/journal nguồn. importPayroll cũng chưa kiểm tra đầy đủ trạng thái kỳ; cờ netting phải được vô hiệu hóa khi dữ liệu nền thay đổi. UI ẩn nút không bảo vệ được API. | [PayrollManagementServiceImpl][be-payroll]:248–265, 417–423, 584–608. |
| R06 | P1 | **“Số dư quỹ dự án” lấy từ bộ đếm ngân sách.** API lấy Project.availableBudget; ADVANCE và ADVANCE_RETURN thay đổi ví nhưng không cập nhật bộ đếm đó theo cùng bản chất. EXPENSE xác nhận đã trừ bộ đếm khi tiền chưa chuyển. Vì vậy con số không phải số dư ví thực tế. | [AccountingJournalServiceImpl][be-journal]:370; [Project][be-project]:102–119; [RequestServiceImpl][be-request]:914, 933–959, 1022–1038. |
| R07 | P1 | **Đối soát ngân hàng chưa đúng phạm vi.** bankDiscrepancy đang so riêng COMPANY_FUND với externalBankBalance; phân bổ nội bộ làm COMPANY_FUND giảm dù chưa phải tiền rời doanh nghiệp. Thiếu tài khoản nguồn, mốc sao kê và các khoản đang chuyển. FLOAT_MAIN chỉ chứng minh tổng ví, không chứng minh sao kê ngân hàng khớp. | [CompanyFundServiceImpl][be-fund]:73–106, 133. |
| R08 | P1 | **Audit nhận sai loại principal.** JWT đặt UserDetailsAdapter vào SecurityContext nhưng journal/fund chỉ kiểm tra principal instanceof User. Vì vậy ID người tạo/cập nhật có thể null và tên rơi về username/email. | [JwtAuthenticationFilter][be-jwt]:110–113; [AccountingJournalServiceImpl][be-journal]:473–480; [CompanyFundServiceImpl][be-fund]:139–145. |
| R09 | P1 | **Danh sách journal gán balanced=true.** Chi tiết mới tính tổng thật. V20 chỉ chặn UPDATE/DELETE; vẫn có thể INSERT dòng mới vào journal đã ghi. DB chưa cưỡng chế tổng hai phía/header bằng nhau hoặc journal phải đủ dòng. Chưa có API cho người dùng thêm dòng, nhưng ràng buộc DB chưa đáp ứng mức bảo vệ mà tài liệu mô tả. | [AccountingJournalServiceImpl][be-journal]:414–420; [V19/V20][be-migrations]. |
| R10 | P1 | **Thiếu chiều truy vết lịch sử.** Journal/line chưa lưu đủ department, phase, category, danh tính ví nguồn/đích và snapshot nguồn. Dòng khấu trừ payroll có advanceBalanceId nhưng projectId null; filter project chỉ xét header nên bỏ sót khoản payroll liên quan dự án. | [AccountingJournalLine][be-journal-line]; [AccountingJournalServiceImpl][be-journal]:238–245; [AccountingJournalSpecification][be-journal-spec]. |
| R11 | P1 | **Hiện là nhật ký journal, chưa có sổ theo tài khoản hoàn chỉnh.** Chưa có số dư đầu kỳ/phát sinh/cuối kỳ từng tài khoản, sổ chi tiết theo đối tượng hay đối chiếu tổng tài khoản. Chưa có dữ liệu mở sổ được kiểm chứng để các số dư lịch sử có ý nghĩa. | [AccountingJournalServiceImpl][be-journal], [trang sổ cái][fe-ledger], các API đọc hiện tại. |
| R12 | P1 | **Đóng kỳ và sửa sai còn thiếu.** Posting date lấy LocalDate.now; chưa có kỳ đóng, liên kết đảo gốc/chống đảo trùng, quy trình điều chỉnh các counter/ví/advance liên quan. WalletService.reversal có helper đảo tiền nhưng chưa có caller nghiệp vụ và không đủ kiểm soát liên kết/journal; không được bật thẳng helper đó thành API. | [AccountingJournalServiceImpl][be-journal]:435; [WalletServiceImpl][be-wallet]:133–215. |
| R13 | P1 | **Liên kết từ journal sang yêu cầu có thể 404.** Mọi requestId đi tới trang giải ngân, nhưng API chi tiết đó chỉ đọc ADVANCE/EXPENSE/REIMBURSE ở trạng thái chờ xử lý. Request PAID hoặc phân bổ phòng ban/dự án không nằm trong phạm vi query. | [Chi tiết journal][fe-journal-detail]:46; [RequestRepository][be-request-repo]:111–114. |
| R14 | P1 | **Nguồn nạp quỹ chưa được kiểm chứng đủ.** paymentRef tùy chọn, chưa có cơ chế chống ghi cùng một chứng từ ngân hàng qua hai lần topup khác transaction ID. Tài khoản nguồn ngoài là mã chung, chưa xác định rõ nguồn tiền/số dư đầu. | [SystemTopupRequest][be-topup], [CompanyFundServiceImpl][be-fund]:44–53; [AccountingJournalServiceImpl][be-journal]:89–103. |
| R15 | P1 | **Excel payroll chưa an toàn và còn dữ liệu cố định.** Mẫu chứa MK010/MK001… và mức lương demo. Cho phép .xls nhưng parser chỉ dùng XSSFWorkbook. Chưa kiểm header/schema, nhân viên trùng trong file, lỗi số ở cột tùy chọn có thể thành 0; chưa kiểm đầy đủ số âm và kiểu ô. errorCount đếm lỗi field nên totalRows có thể sai. Import đang lưu ngay các dòng hợp lệ thay vì có bước preview/commit rõ ràng. | [PayrollManagementServiceImpl][be-payroll]:191–236, 269–399, 617–652; [payroll UI][fe-payroll]. |
| R16 | P2 | **UI trạng thái và số tổng chưa nhất quán.** StatusPill luôn màu xanh cả khi FAILED/PENDING. Nhãn “Tổng phát sinh bên tăng” không chính xác vì bên ghi nhận không luôn biểu thị tăng. Tìm theo ID thô, ngày hiển thị không đồng nhất, modal hoàn tạm ứng dùng input tiền/component riêng, chưa giữ tab/filter khi quay lại. | [Trang sổ cái][fe-ledger]:301, 403–408, 431; [trang ví][fe-wallet]; [chi tiết journal][fe-journal-detail]. |
| R17 | P2 | **Race và trạng thái lỗi trên UI.** Các request tải danh sách không có cơ chế loại response cũ; dùng chung loading/total. Đổi tab/filter nhanh có thể để response cũ ghi đè dữ liệu mới. Khi API lỗi danh sách bị xóa nhưng total/totalPages có thể giữ giá trị trước; dễ hiện số cũ hoặc “không có dữ liệu” thay cho lỗi. | [Trang sổ cái][fe-ledger]:132–212. |
| R18 | P2 | **Danh sách chưa đáp ứng dữ liệu lớn.** Advances/budget trả toàn bộ; truy vấn dự án → giai đoạn → danh mục và hoạt động từng advance tạo nhiều lượt query. Export không nên dựa vào data trang hiện tại. | [AccountingJournalServiceImpl][be-journal]:292–377; [audit CSV][fe-audit]:440–465. |
| R19 | P1 | **CSV hiện chỉ escape dấu nháy.** Text bắt đầu bằng ký hiệu công thức chưa được xử lý; khi mở bằng Excel, một số giá trị tên/tóm tắt có thể bị hiểu là formula. Đây là điểm cần bảo vệ trong nền export chung. | [audit CSV][fe-audit]:295–296, 458–465. |

Nhánh EXPENSE và REIMBURSE đã yêu cầu attachment khi tạo. Không kết luận hệ thống cho tạo REIMBURSE không chứng từ. Phần còn cần hoàn thiện là xác nhận chứng từ tại lúc ghi sổ, số tiền được sử dụng trên từng chứng từ, chống tái sử dụng và xử lý hồ sơ đã thay đổi; cảnh báo AI không thay thế ràng buộc nghiệp vụ chung.

### Những mô tả tài liệu cần sửa đồng bộ

- Tài liệu nói đã lưu đủ actor, nhưng R08 cho thấy ID actor chưa được lấy đúng từ principal thực tế.
- Tài liệu nói có audit/bất biến phải kèm giới hạn: migration có thể chưa áp dụng, đang trùng V20 và chưa chặn việc thêm dòng vào journal đã ghi.
- Tên “số dư quỹ dự án” trong API/UI chưa khớp nguồn Project.availableBudget; cần sửa định nghĩa và nguồn số liệu cùng lúc, không chỉ đổi nhãn.
- Kế hoạch ĐA2 cũ dùng V17 và thiết kế account_id trên LedgerEntry; code hiện đã tách AccountingJournal. Hai hướng không được triển khai chồng lên nhau.
- PROGRESS ghi không còn mock ở dashboard không chứng minh backend không seed số liệu mẫu. Trạng thái gọi API, dữ liệu nguồn và nghiệm thu phải là ba thông tin riêng.
- Các API_TEST_STATUS/kết quả kiểm tra ledger cũ không chứng minh các API journal/budget/correction mới đã được kiểm tra. Cần lập kết quả mới theo phiên bản và môi trường.

### Định nghĩa “không còn mock/fake” khi bàn giao

- Màn hình dùng thật đọc dữ liệu lưu qua nghiệp vụ hoặc nhập từ hồ sơ người dùng đã xác nhận; API lỗi không điền số mẫu và không coi thiếu dữ liệu là đã đối soát thành công.
- Không có payroll, số dư, nhân viên/giao dịch mẫu tự chèn vào môi trường dùng thật. Roles, permissions và danh mục tham chiếu cần thiết có thể bootstrap riêng.
- Route demo và fixtures chỉ được giữ ở môi trường demo/test tách biệt, không truy cập từ bản dùng thật. Không tự xóa số liệu hiện có khi chuyển cấu hình; cần phân loại và đối chiếu trước.
- MockReceiptExtractor và MockBank chỉ thuộc môi trường kiểm thử. Nếu chưa có kết nối ngân hàng thật, phạm vi vận hành phải dùng quy trình chứng từ/sao kê được xác nhận và trạng thái chờ đối chiếu; không giả kết quả SUCCESS hoặc tuyên bố đã kết nối ngân hàng thật.

## 4. Quy tắc hoàn thiện trong phạm vi IFMS

### 4.1 Giữ các quyết định đã chốt

- EXPENSE: nhân viên tự chi; xác nhận chứng từ ghi chi phí/khoản phải hoàn; thanh toán chỉ tất toán khoản phải hoàn.
- ADVANCE: tiền giải ngân là khoản phải quyết toán, chưa phải chi phí.
- REIMBURSE: ghi chi phí và giảm đúng khoản tạm ứng, không chuyển thêm tiền.
- ADVANCE_RETURN: chuyển USER → PROJECT thật, không ghi chi phí.
- Payroll: giữ FIFO và cách khấu trừ hiện tại; không tự bổ sung thuế/bảo hiểm hoặc chuyển ví giả.
- Nạp/rút USER cá nhân nằm trong sổ giao dịch ví; không coi là tiền công ty giữ hộ.
- SYSTEM_TOPUP và phân bổ nội bộ có journal. FLOAT_MAIN không là tài khoản kế toán/ngân hàng.
- Giữ sáu role. Mapping là tài khoản quản trị IFMS; không mở rộng thành phần mềm kế toán pháp định. Người dùng duyệt plan/mapping này trước khi code, không đặt thêm yêu cầu phải có phê duyệt GVHD mới được triển khai.

### 4.2 Phân biệt tiền, ngân sách và công nợ

| Chỉ tiêu | Nguồn đúng / quy tắc |
|---|---|
| Số dư ví, tiền khả dụng, tiền khóa | Wallet.balance / availableBalance / lockedBalance; phải đối chiếu được với dòng biến động ví. |
| Chi phí được xác nhận | Bút toán chi phí đã ghi và chiều project/phase/category; counter hiện có phải đối chiếu, không tự gọi counter là tiền. |
| Tạm ứng còn phải quyết toán | Đã giải ngân − chứng từ chấp nhận − hoàn tiền thật − khấu trừ lương − phần lịch sử đã được xác nhận. |
| Cam kết chưa ghi chi phí | Các khoản đã duyệt chưa xử lý; không tính EXPENSE đã xác nhận thêm lần nữa. REIMBURSE không tạo cam kết chuyển tiền mới. |
| Khả năng nhận thêm yêu cầu | Đồng thời xét hạn mức còn lại theo project/phase/category và tiền ví có thể giữ; không chỉ xét một trong hai. |
| Đối soát ngân hàng | Theo tài khoản, phạm vi tiền doanh nghiệp thực sự kiểm soát, mốc sao kê và giao dịch đang chuyển. Không lấy riêng COMPANY_FUND hoặc toàn bộ USER để so tùy ý. |

Ví dụ kiểm chứng nghiệp vụ, không phải dữ liệu tự seed vào ứng dụng:

| Bước | Ví dự án | Tạm ứng còn mở | Chi phí đã xác nhận |
|---|---:|---:|---:|
| Có 10 triệu trong ví | 10.000.000 | 0 | 0 |
| Giải ngân tạm ứng 3 triệu | 7.000.000 | 3.000.000 | 0 |
| Chấp nhận chứng từ 2,2 triệu | 7.000.000 | 800.000 | 2.200.000 |
| Nhân viên hoàn thật 300 nghìn | 7.300.000 | 500.000 | 2.200.000 |
| Khấu trừ lương 500 nghìn | 7.300.000 | 0 | 2.200.000 |

### 4.3 Quy tắc ghi sổ, kỳ và sửa sai đề xuất để duyệt cùng plan

- Mỗi nguồn nghiệp vụ chỉ được thực hiện một lần: khóa bản ghi nguồn, xác thực trạng thái lại trong transaction, idempotency cho request lặp; ví, reserve, advance, chi phí và journal cùng commit/rollback. Publish cập nhật sau commit.
- Journal lưu ngày nghiệp vụ, ngày ghi sổ, thời điểm tạo và actor chính xác; timezone nghiệp vụ cấu hình thống nhất.
- Lưu số dư mở sổ có nguồn chứng minh. Thiếu hồ sơ thì ghi rõ dữ liệu lịch sử chưa xác minh; không tạo “journal cho đủ”.
- Đóng kỳ kiểm tra journal cân bằng, nguồn liên kết, đối soát và các ngoại lệ; advance chưa quyết toán vẫn được chuyển số dư sang kỳ sau.
- Đảo toàn phần, có lý do, người thực hiện và liên kết gốc; chống đảo trùng. Kỳ gốc đã đóng thì ghi điều chỉnh vào kỳ hiện tại đang mở, giữ ngày/chứng từ gốc làm tham chiếu.
- Sửa phân loại kế toán khác với thu hồi/chuyển tiền thật. Không tự chuyển ví chỉ vì đảo journal; không xóa debt hoặc chi phí khi dòng tiền/hồ sơ phụ thuộc chưa được xử lý.
- Nếu giao dịch gốc đã có quyết toán/hoàn tiền/payroll phụ thuộc, service phải kiểm tra chuỗi nghiệp vụ và hướng dẫn điều chỉnh đúng thứ tự. Không cho đảo làm âm ví hoặc sai dư tạm ứng.
- Giữ cách trình bày “Ghi nhận / Đối ứng”, giải thích tăng/giảm ở từng dòng; bỏ nhãn tổng “bên tăng”.
- Các chứng từ cần được phân bổ số tiền cho yêu cầu để không sử dụng cùng một khoản hai lần. Chứng từ AI chỉ hỗ trợ nhập liệu, không được tự ghi journal.

## 5. Ma trận Excel theo sáu vai trò

Đây là phạm vi đề xuất để duyệt. Import chỉ thực hiện thao tác role vốn có quyền làm; export luôn áp dụng scope dữ liệu ở backend.

| Vai trò | File nhập đề xuất | File xuất đề xuất | Giới hạn nghiệp vụ |
|---|---|---|---|
| ADMIN | Phòng ban; nhân sự và thông tin hồ sơ cần thiết | Phòng ban, nhân sự, audit | Tạo user qua luồng onboarding hiện có; ví mới bắt đầu 0; không nhập password/PIN/token, số dư hay quyền tùy ý từ Excel. Mã nhân sự theo chính sách hiện có; mã tham chiếu từ hệ thống ngoài tách riêng nếu cần. |
| EMPLOYEE | Lô yêu cầu ADVANCE/EXPENSE/REIMBURSE của mình, liên kết chứng từ đã upload | Yêu cầu cá nhân, sao kê ví, lịch sử nạp/rút, tạm ứng và quyết toán, phiếu lương cá nhân | Preview rồi xác nhận gửi theo luồng bình thường. EXPENSE/REIMBURSE bắt buộc chứng từ hợp lệ; không nhập trạng thái duyệt hoặc journal. |
| TEAM_LEADER | Giai đoạn, thành viên và hạn mức danh mục của dự án mình quản lý | Thành viên, ngân sách/chi phí dự án, yêu cầu được phép xem, tạm ứng trong phạm vi dự án | Validate tổng hạn mức và scope; không nhập số đã chi hoặc phê duyệt hàng loạt qua file. |
| MANAGER | Danh mục dự án thuộc phòng ban theo form hiện có, gán Team Leader hợp lệ | Dự án, nhân sự được phép xem, ngân sách phòng ban, yêu cầu cấp vốn và chi phí/tạm ứng trong scope | Import dự án không tự cấp tiền; ngân sách kế hoạch khác với transfer phân bổ vốn. |
| ACCOUNTANT | Payroll; sao kê làm bằng chứng đối soát; hồ sơ mở sổ/backfill qua quy trình kiểm soát riêng | Giao dịch ví, journal, sổ theo tài khoản, đối chiếu hai phía, tạm ứng, chi phí/ngân sách, payroll | Không import journal thô để bypass request/duyệt tiền. Chứng từ lịch sử chỉ ghi sau khi kiểm tra và xác nhận từng nguồn. |
| CFO | Sao kê nguồn quỹ doanh nghiệp có quyền để hỗ trợ đối soát | Báo cáo dòng tiền doanh nghiệp, phân bổ, ngân sách, công nợ/tạm ứng và kết quả đối soát | Import sao kê chỉ thêm bằng chứng; không tự topup, duyệt hoặc chuyển tiền. Quyền nhập sao kê dùng chung nền tảng với Accountant, được kiểm soát riêng. |

Không ép từng role phải có thao tác import làm thay đổi tiền nếu role không có nghiệp vụ đó. Mọi role đều có export dữ liệu đúng quyền. Quyền xem báo cáo và quyền sửa cấu hình không tự kéo theo quyền ghi sổ.

### Chuẩn file và trải nghiệm dùng chung

- Dùng .xlsx cho phiên bản đầu; bỏ .xls trên UI/API cho đến khi parser hỗ trợ thật. Dùng Apache POI hiện có, tránh triển khai hai parser nghiệp vụ khác nhau.
- Workbook gồm sheet hướng dẫn tiếng Việt, sheet dữ liệu và danh mục tham chiếu có quyền; schemaVersion được kiểm tra.
- File mẫu lấy danh mục thật theo role/phòng ban/dự án. Payroll không điền lương cố định; ô tiền để nhập, chỉ dùng mức đã lưu hợp lệ nếu người dùng chủ động chọn.
- Phòng ban/nhân sự dùng mã tham chiếu ổn định; dự án/giai đoạn/request/advance chọn theo mã nghiệp vụ. Không dùng tên hiển thị làm khóa duy nhất. Danh mục chưa có business code phải có ID kèm scope và tên xác nhận.
- Quy trình: tải mẫu → chọn file → kiểm tra/preview toàn bộ → xem lỗi theo dòng/cột → xác nhận commit. Preview không tạo user/request/payslip hoặc gửi mail.
- Mặc định commit cả lô hợp lệ trong một transaction; lô có lỗi không ghi một phần âm thầm. Có báo cáo lỗi tải về để sửa và nhập lại. Batch/token commit chống bấm lại và kiểm tra dữ liệu/quyền thay đổi sau preview.
- Kiểm tra file thật, phiên bản, header, định dạng ô, dòng trùng, mã không tồn tại, số âm/precision, ngày, scope và ràng buộc nghiệp vụ. Hạn mức dung lượng/số dòng cấu hình; không chạy macro/formula từ file nhập.
- Bảo vệ dữ liệu text khi xuất để không bị hiểu là công thức Excel; giữ mã và tài khoản dạng text, tiền dạng số. Không xuất dữ liệu bí mật.
- Export lấy dữ liệu từ backend theo cùng bộ lọc/quyền và mốc báo cáo, đủ mọi trang; ghi người xuất, thời điểm, scope, điều kiện lọc và tổng kiểm tra. Không chỉ xuất mảng items đang render.
- Tạo nhật ký import/export: actor, loại file, checksum, scope, số dòng, kết quả; hiển thị báo lỗi thật, không dùng dữ liệu giả khi API lỗi.
- Các báo cáo lớn đọc theo lô hoặc job có giới hạn cấu hình; không tải toàn bộ database vào bộ nhớ trình duyệt.

## 6. Các gói triển khai và điều kiện nghiệm thu

| Gói / task | Công việc frontend và backend | Điều kiện hoàn thành | Phụ thuộc |
|---|---|---|---|
| G0.1 — Migration | Đọc lịch sử Flyway từng môi trường; giải quyết hai V20 bằng version mới phù hợp. Migration đã áp dụng giữ nguyên checksum; không tự dùng repair hoặc sửa migration cũ. | Database trống và bản sao dữ liệu cũ migrate được, AI và ledger cùng tồn tại. Có phương án cho tình huống một V20 đã chạy. | Bắt đầu |
| G0.2 — Nguồn dữ liệu | Tách bootstrap tham chiếu/roles khỏi demo seed/reset; live khởi tạo ví 0. Demo/test profile riêng, không sửa dữ liệu đã tồn tại. Loại route ledger/demo khỏi bản ứng dụng dùng thật. | Restart không đổi số dư/payslip; không phát sinh nghiệp vụ mẫu. Mock AI/MockBank không được ngụy trang nguồn thật. | G0.1 |
| G1.1 — Request và ngân sách | Validate lại scope, quan hệ ID, trạng thái và hạn mức ở create/update/approve/verify/pay. Không im lặng bỏ qua category budget thiếu. Phân biệt commitment, tiền khóa và chi phí. | API gửi ID chéo dự án hoặc vượt hạn mức bị chặn; tổng tiền giữ truy về từng request. | G0 |
| G1.2 — Atomic/idempotency | Khóa request, advance, kỳ/payslip và các counter theo thứ tự thống nhất; chống thao tác lặp từ retry/double click. Cùng transaction ghi ví/reserve/advance/journal; thông báo sau commit. | Hai thao tác đồng thời chỉ ghi một nghiệp vụ; REIMBURSE/return/payroll không lost update hoặc oversettle. | G1.1 |
| G1.3 — Payroll | Chặn overwrite/import/edit kỳ đã chi; giữ nguyên hồ sơ PAID. Netting phải được tính lại khi dữ liệu lương thay đổi và kiểm tra outstanding tại lúc run; giữ FIFO/giới hạn hiện có. | Không xóa payslip đã có payout/journal. Chạy payroll hai lần không chi trùng; lỗi phải rollback toàn kỳ. | G1.2 |
| G2.1 — Dữ liệu journal | Bổ sung registry tài khoản nội bộ, chiều owner/project/phase/category, actor đúng adapter, snapshot nguồn/ngày nghiệp vụ và nguồn nạp có căn cứ. | Trace từ journal đến tài khoản/nguồn/đối tượng có nghĩa ngay cả khi tên danh mục thay đổi. | G1 |
| G2.2 — Bảo vệ cân bằng | Tính balanced từ số liệu thật. Cưỡng chế journal đủ dòng/tổng khớp ở transaction hoàn tất và chặn thêm dòng vào journal đã ghi; không chỉ chặn UPDATE/DELETE. | Cố thêm dòng lệch hoặc journal thiếu dòng bị từ chối; list/detail cho cùng kết quả. | G2.1 |
| G2.3 — Sổ theo tài khoản | API số dư đầu, phát sinh hai phía, cuối kỳ; sổ chi tiết theo tài khoản/đối tượng và bảng đối chiếu tổng. Thêm filter chiều dữ liệu và payroll offset theo dự án. | Tổng sổ chi tiết khớp journal; không bỏ sót payroll offset; không giả số dư đầu. | G2.1–2 |
| G2.4 — Tiền/ngân sách/đối soát | Số ví lấy Wallet; chi phí từ bút toán/counter đã đối chiếu. Xây matching theo sao kê, tài khoản, thời điểm, chênh lệch và khoản đang chuyển. | Ví dụ ở mục 4.2 khớp từng bước; phân bổ nội bộ không tạo chi phí hoặc chênh lệch ngân hàng giả. | G1, G2.1 |
| G2.5 — Chứng từ | Đối chiếu số tiền dùng trên chứng từ, dấu vết xác nhận, nguồn topup, chống dùng lại chứng từ và request lặp. AI không tự thay quyết định Kế toán. | Không hoàn chi/quyết toán hai lần cho cùng phần chứng từ; có lý do cho ngoại lệ được phép. | G1–2 |
| G3.1 — Kỳ/điều chỉnh | Bổ sung ngày nghiệp vụ/ngày ghi sổ, đóng kỳ, đảo toàn phần/điều chỉnh theo nguồn có lý do; kiểm tra phụ thuộc và chống đảo trùng. | Không sửa lịch sử; kỳ đóng không ghi lùi; số dư và journal sau correction khớp nhau. | G2 |
| G3.2 — Lịch sử/mở sổ | Báo cáo dữ liệu có/thiếu chứng từ, opening balances có nguồn, backfill preview/commit theo từng sự kiện. Không suy diễn legacy thành tiền hoàn hay payroll. | Mỗi dòng chuyển đổi có nguồn và đối chiếu; chạy lại không trùng; báo cáo chỉ rõ phần chưa xác minh. | G0, G2, dữ liệu thật |
| G4.1 — UI đồng nhất | Giữ màu/bố cục IFMS. Tách rõ giao dịch ví, nhật ký journal/sổ tài khoản, ngân sách và icon tạm ứng. Tái dùng CurrencyInput, status, filter, modal/drawer, date/table. | Status đúng màu; không có NaN/ID thô bắt buộc; ngôn ngữ Việt nhất quán; kiểm tra desktop/mobile. | API G2 |
| G4.2 — UI truy vết và state | View lịch sử request theo quyền, link đúng theo loại nguồn/trạng thái; URL lưu tab/filter/page; hủy/loại response cũ; error riêng empty, summary cùng bộ lọc. | Mọi nguồn journal mở được; quay lại giữ vị trí; lỗi API không hiển thị số cũ/0 giả hoặc mock. | G1, G2 |
| X0 — Nền Excel | Dùng chung template/preview/commit/export, kiểm tra schema/scope, báo cáo lỗi, audit và idempotency như mục 5. | File hợp lệ round-trip được; file sai không tạo dữ liệu; quyền kiểm ở server. | G0–G1 |
| X1 — Admin | Import/export phòng ban, nhân sự; onboarding/role hợp lệ/ví 0; lỗi dòng và trùng mã/email. | Tạo user/phòng ban giống luồng form; không tạo tài khoản mồ côi hoặc gửi mail trước commit. | X0 |
| X2 — Accountant payroll | Thay mẫu demo, sửa parser/validation/duplicate/counts và pipeline preview; export bảng lương thực tế. | Mẫu chỉ danh mục thật; invalid bonus không thành 0; duplicate employee báo từng dòng; không overwrite PAID. | X0, G1.3 |
| X3 — Manager/Team Leader | Nhập dự án; giai đoạn, thành viên, hạn mức danh mục đúng quyền; export báo cáo phạm vi phụ trách. | Tổng hạn mức không vượt; ID chéo scope bị từ chối; import không tự transfer/duyệt tiền. | X0, G1.1 |
| X4 — Employee | Nhập lô yêu cầu gắn chứng từ đã upload; export yêu cầu/ví/advance/phiếu lương của mình. | Mỗi dòng qua validation giống form; chứng từ thiếu bị chặn; không xem/nhập thay người khác. | X0, G2.5 |
| X5 — CFO/Accountant đối soát | Nhập sao kê có tài khoản/kỳ/nguồn, preview duplicate/matching; export phân bổ/dòng tiền/đối soát. | Import sao kê không tăng tiền ví, không auto-topup; report phân biệt khớp/chưa khớp/đang chuyển. | X0, G2.4 |
| X6 — Export sổ và sáu role | Bộ export theo ma trận mục 5; cùng query filter với màn hình, đủ mọi trang và cutoff; thay CSV trang hiện tại bằng lựa chọn xuất đúng phạm vi. | Tổng file khớp API/màn hình cùng cutoff; server chặn role/scope không được phép. | G2–G4, X0 |
| D1 — Tài liệu | Đồng bộ ledger-accounting, API contract, tiến độ, schema, seed/deploy, Excel schema và ma trận quyền của hai repo. Đánh dấu các kế hoạch ĐA1/ĐA2 mâu thuẫn là lịch sử. | Một nguồn định nghĩa nghiệp vụ; mọi mục phân biệt “có code” và “đã nghiệm thu”. | Mỗi gói |
| V1 — Nghiệm thu | Unit/integration trên PostgreSQL thử nghiệm, kiểm thử song song, migration bản sao và trình duyệt sáu role; chỉ dùng fixture tách biệt môi trường dùng thật. | Đạt toàn bộ checklist ở mục 7; có kết quả thực tế kèm phiên bản code. | Tất cả |

**Thứ tự đề nghị:** G0 → G1 → G2 → G3; G4 triển khai cùng API ổn định. X0/X1/X2 có thể triển khai khi G1 ổn định; X3–X6 theo phụ thuộc trong bảng. D1 cập nhật sau từng gói, V1 nghiệm thu theo gói rồi toàn luồng.

Không cần viết lại toàn bộ IFMS. Phần thay đổi chính nằm ở request/payroll, nguồn tiền, budget, journal/report và các trang liên quan; Excel mở rộng sang organization/user/project theo quyền sẵn có.

## 7. Điều kiện để gọi là hoàn tất

- [ ] Không còn hai version Flyway trùng; migrate được database mới và bản sao lịch sử; kiểm chứng schema thực tế.
- [ ] Startup bản dùng thật chỉ tạo tham chiếu cần thiết/ví 0; không tạo/reset giao dịch, payroll, số dư hoặc user demo.
- [ ] Trang dùng thật không có route/data demo hoặc fallback số tiền giả; API lỗi có thông báo và retry.
- [ ] Toàn bộ các sự kiện đã chốt ghi journal đúng một lần, cân bằng và truy vết được nguồn/actor/đối tượng.
- [ ] Request, hoàn tiền, REIMBURSE và payroll chạy đồng thời không chi trùng, oversettle, mất cập nhật hoặc âm reservation.
- [ ] EXPENSE xác nhận rồi thanh toán chỉ ghi chi phí một lần; ADVANCE chưa quyết toán không thành chi phí.
- [ ] Ví, ngân sách, công nợ và đối soát có công thức/nguồn riêng; ví dụ mục 4.2 đạt, số dư tiền không lấy từ counter chi phí.
- [ ] Có sổ theo tài khoản, số đầu kỳ/phát sinh/cuối kỳ và truy vết journal; lịch sử chưa đủ chứng từ hiện rõ ngoại lệ.
- [ ] Có đóng kỳ và sửa sai có lý do/liên kết; không sửa/xóa hồ sơ đã chi hoặc journal đã ghi.
- [ ] Các deep link nguồn hoạt động cho hồ sơ đã PAID/phân bổ/payroll theo quyền; UI thống nhất loading/error/empty/filter/định dạng tiền và ngày.
- [ ] Nhập/xuất Excel đúng ma trận sáu role; mẫu không chứa dữ liệu giả, preview không ghi dữ liệu, commit chống lặp và export đúng scope/mọi trang.
- [ ] Payroll không xóa/ghi đè kỳ đã chi; file nhập sai kiểu/header/duplicate/ô công thức/quyền báo lỗi rõ ràng.
- [ ] Các báo cáo và dashboard liên quan dùng cùng định nghĩa số liệu; tổng file export khớp API cùng thời điểm chốt.
- [ ] Tài liệu hai repo và kết quả kiểm chứng đã cập nhật; không dùng kết quả build thay cho nghiệm thu nghiệp vụ.

## 8. Những gì người dùng duyệt ở plan này

1. Phạm vi tài khoản nội bộ, nguồn dữ liệu thật, công thức ở mục 4.
2. Chính sách kỳ đóng/đảo toàn phần, correction theo nguồn và backfill chỉ có chứng từ.
3. Ma trận nhập/xuất Excel và ranh giới quyền của sáu role.
4. Thứ tự G0 → G1 → G2 → G3/G4 và các gói Excel; điều kiện hoàn tất ở mục 7.

Khi bắt đầu triển khai sau phê duyệt, G0 là kiểm tra lịch sử Flyway và cô lập seed/reset trước khi chạy app trên database. Phần này đã làm trên database thử nghiệm; database chính vẫn chưa thay đổi. Không tự xóa dữ liệu hiện có hoặc tạo journal lịch sử thiếu căn cứ.

## 9. Nhật ký triển khai sau khi duyệt — cập nhật 21/10/2026

Các bảng và lỗi R01–R19 ở trên là **mốc trước sửa**. Trạng thái sau sửa dưới đây dựa trên code đang nằm ở hai working tree, chưa commit/chưa đẩy lên remote.

| Gói | Phần đã viết | Mức kiểm chứng và phần còn lại |
|---|---|---|
| G0 | Tách migration tạo trích xuất chứng từ sang V21, thêm V22–V33; seed demo chỉ chạy profile `demo`, cờ reset mặc định tắt. Môi trường mới có thể cấp tài khoản ADMIN đầu tiên bằng `BOOTSTRAP_ADMIN_EMAIL` và `BOOTSTRAP_ADMIN_PASSWORD`, ví bắt đầu từ 0. | PostgreSQL thử nghiệm mới lên V33; bản sao lịch sử V23 → V33. Tài khoản bootstrap và quỹ/ví cấu trúc đã kiểm tra trên database rỗng. Chưa migrate database chính. Cần cấu hình bootstrap ở môi trường triển khai thật. |
| G1 | Kiểm tra quyền/phạm vi request, hạn mức và tiền giữ theo yêu cầu; khóa request/ví/tạm ứng/payroll, chặn chi trùng; EXPENSE xác nhận chứng từ rồi mới ghi chi phí; cấm ghi đè kỳ lương đã chi; chuẩn hóa số dư ví, ngân sách và dư tạm ứng. | Luồng chi phí/đảo, tạm ứng/quyết toán/hoàn thật/khấu trừ và giải ngân song song đã chạy integration trên database thử nghiệm. Cần kiểm tra lại dữ liệu lịch sử thật theo từng ngoại lệ. |
| G2 | Journal bổ sung chiều dự án/phòng ban/giai đoạn/danh mục và nguồn; ràng buộc DB cân bằng/bất biến; sổ theo tài khoản; kỳ đóng; đảo toàn phần có liên kết; sao kê ngân hàng thủ công và đối chiếu mốc thời gian. | Các DB constraint có 5 integration test. BOOKED đã được kiểm khi ghi bù nạp quỹ lịch sử; nạp quỹ mới hiện chỉ kiểm paymentRef, còn thiếu ràng buộc chứng cứ F05. Đóng kỳ/ngày đảo còn F06. MockBank cho rút ví cá nhân chưa phải ngân hàng thật. |
| G3 | Ghi bù lịch sử có xem trước, chứng từ và mã nguồn tra cứu tại DB; mở sổ phần chênh lệch có PIN và căn cứ; khóa ghi bù tự động sau mở sổ; đối chiếu bộ đếm chi phí với journal/chứng từ và lưu audit trước/sau. | Hai luồng mở sổ và đối chiếu bộ đếm đã có integration test; cần chạy trên bản sao dữ liệu thực của doanh nghiệp và ký biên bản mở sổ. Không tự tạo bút toán cho nguồn thiếu chứng từ. |
| G4 | Trang giao dịch ví, journal, sổ tài khoản, chi tiết nguồn, kỳ, đối soát, chuyển đổi lịch sử, đối chiếu chi phí; route demo chuyển về trang thật; trạng thái tải/lỗi, link và nhãn tiền được chỉnh. | TypeScript và production build qua; API smoke trên database clone qua cho journal, account balances, advances, budget exposure, periods và spreadsheet catalog. Chưa nghiệm thu trực quan bằng trình duyệt cho đủ sáu role. |
| X0–X6 | Nền `.xlsx` dùng chung: schema, preview/commit toàn lô, chống lặp, lỗi từng dòng, phân quyền server; có các bộ nhập chính và bộ xuất theo sáu role. Mẫu payroll dùng danh sách nhân viên thật, không gắn lương mẫu. | Integration đã thử import phòng ban, từ chối công thức, commit lặp và phân bổ lại nhiều hạn mức trong một file. Chưa đủ ma trận, tham chiếu nhập liệu, filter cùng màn hình và nhật ký export; xem F09–F10. Cần nghiệm thu từng dataset với file thật. |

**Kết quả kiểm chứng hiện có:** backend package và production build Next.js đạt; Flyway V33 trên DB thử nghiệm mới và bản sao lịch sử; 12 integration test đạt (7 luồng tài chính/Excel + 5 bất biến journal), gồm mở sổ, đối chiếu bộ đếm, bootstrap ADMIN và phân bổ hạn mức trong cùng file. Không xem đây là nghiệm thu database chính hay giao diện sáu role.

**Kiểm tra giao diện:** frontend production build và API smoke trên backend nối PostgreSQL clone đã qua. Các API đã kiểm tra gồm danh sách journal, sổ tài khoản, tạm ứng còn mở theo nhân viên, mức sử dụng ngân sách, kỳ kế toán và danh mục Excel. Route `/accountant/ledger` chưa đăng nhập chuyển về `/login` như thiết kế. Không chạy được browser smoke trực quan vì phiên làm việc không cung cấp browser provider; cũng chưa nghiệm thu với đủ sáu role hoặc dữ liệu database triển khai chính.

**Việc cần hoàn tất trước khi gọi là bàn giao:** chạy kiểm tra quyền và UI sáu role; đối chiếu chứng từ/mở sổ trên bản sao dữ liệu chính rồi mới tính chuyển đổi thật; kiểm tra từng file Excel và tổng export cùng mốc lọc; chọn và cấu hình kênh ngân hàng thật hoặc công bố rõ rút ví cá nhân qua MockBank chỉ là mô phỏng. Trên database thiếu chứng từ, giữ nguyên ngoại lệ; không nhập số tùy đoán.

## Nguồn code đã đối chiếu

[be-migrations]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/resources/db/migration/>
[be-init]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/config/DataInitializer.java>
[be-seed]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/config/DataSeeder.java>
[be-request]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/request/service/RequestServiceImpl.java>
[be-request-repo]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/request/repository/RequestRepository.java>
[be-advance-repo]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/request/repository/AdvanceBalanceRepository.java>
[be-project-query]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/project/service/ProjectQueryServiceImpl.java>
[be-category]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/project/service/CategoryBudgetServiceImpl.java>
[be-project]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/project/entity/Project.java>
[be-journal]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/accounting/service/AccountingJournalServiceImpl.java>
[be-journal-line]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/accounting/entity/AccountingJournalLine.java>
[be-journal-spec]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/accounting/repository/AccountingJournalSpecification.java>
[be-fund]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/accounting/service/CompanyFundServiceImpl.java>
[be-topup]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/accounting/dto/request/SystemTopupRequest.java>
[be-jwt]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/auth/security/JwtAuthenticationFilter.java>
[be-wallet]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/wallet/service/WalletServiceImpl.java>
[be-payroll]: <../../../LẬP TRÌNH JAVA/IFMS/src/main/java/com/mkwang/backend/modules/accounting/service/PayrollManagementServiceImpl.java>
[fe-ledger]: <../app/(dashboard)/accountant/ledger/page.tsx>
[fe-journal-detail]: <../app/(dashboard)/accountant/ledger/journals/[journalId]/page.tsx>
[fe-wallet]: <../app/(dashboard)/wallet/page.tsx>
[fe-payroll]: <../app/(dashboard)/accountant/payroll/[id]/page.tsx>
[fe-audit]: <../app/(dashboard)/admin/audit-logs/page.tsx>

