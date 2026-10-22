# Báo cáo chi tiết công việc tuần vừa qua — Sổ cái IFMS

**Kỳ tổng hợp:** 7 ngày gần nhất, 16–22/10/2026.

**Phạm vi:** frontend `financial-wallet-frontend`, backend `IFMS`; plan sổ cái và nhập/xuất Excel.

**Ngày hoàn thiện báo cáo:** 23/10/2026, múi giờ Việt Nam (UTC+7).

## 1. Kết quả và cách tính mức hoàn thành

- Sáu nhóm tồn đọng được yêu cầu xử lý trong đợt cuối: **6/6 đã có sửa và kiểm chứng đại diện (100% phạm vi đợt này)**.
- Tính theo 23 gói của plan: **19/23 gói có phần triển khai hoàn chỉnh và kiểm chứng đại diện, khoảng 83%**; 4 gói còn điều kiện chưa hoàn tất. Mỗi gói tính một đơn vị, không tính trọng số thời gian. Đây là tỷ lệ gói triển khai, không phải tỷ lệ mọi tình huống nghiệp vụ đã được nghiệm thu.
- **Chưa gọi toàn bộ plan hoàn thành 100%.** Các gói còn lại là G0.1, G3.1, G4.2 và V1, trình bày ở mục 8.
- Kiểm chứng mới: **18/18 test backend qua, 5/5 test trình duyệt qua, production build frontend qua**. Flyway chạy đủ **34 migration** trên PostgreSQL thử nghiệm tách biệt.
- Database triển khai chính chưa được migrate hoặc chuyển đổi trong đợt này.

## 2. Các thay đổi nền tảng đã triển khai từ plan

| Nhóm | Vấn đề trước đây | Cách triển khai hiện tại |
|---|---|---|
| Khởi tạo dữ liệu | Seed/reset có thể làm dữ liệu mẫu xuất hiện trong môi trường dùng thật | Tách profile demo; live khởi tạo cấu trúc/ví 0, ADMIN qua cấu hình và thiết lập PIN lần đầu. Không tự xóa dữ liệu mẫu đã tồn tại trong DB cũ. |
| Nguồn dữ liệu kế toán | Dòng biến động ví được trình bày như sổ cái | Có Transaction/LedgerEntry cho tiền và AccountingJournal/Line cho tài khoản; lưu nguồn, actor, ngày/kỳ, các chiều và bản chụp nguồn. |
| Nhân viên tự chi (EXPENSE) | Thời điểm ghi chi phí và trả tiền dễ bị gộp | Xác nhận chứng từ ghi chi phí/khoản phải hoàn; thanh toán hoàn chi riêng, không ghi thêm chi phí. |
| Tạm ứng (ADVANCE) | Giải ngân có thể bị hiểu là chi phí | Giải ngân chỉ tạo khoản còn phải quyết toán. |
| Quyết toán tạm ứng (REIMBURSE) | Dễ cộng chi phí hai lần hoặc chuyển tiền thêm | Chứng từ được xác nhận mới ghi chi phí và giảm đúng advance; không tạo chuyển ví mới. |
| Hoàn và khấu trừ | Chưa phân biệt hoàn thật và bù trừ lương | Hoàn thật USER→PROJECT có giao dịch; khấu trừ payroll theo FIFO/giới hạn hiện có là bù trừ, có phân bổ từng advance. |
| Giữ tiền và chi đồng thời | Chỉ nhìn tổng tiền khóa, khó truy về request và chống lặp | Theo dõi reservedAmount theo request; khóa nguồn/ví/advance/kỳ lương và kiểm trạng thái khi thực hiện. |
| Payroll | Có nguy cơ sửa/overwrite dữ liệu đã chi | Chặn sửa hoặc ghi đè hồ sơ đã chi; kiểm lại outstanding khi chạy, có liên kết sửa sai/thay thế. |
| Sổ tài khoản | Chỉ có nhật ký, chưa có đầu/phát sinh/cuối kỳ | Báo cáo theo tài khoản và chiều đối tượng, có số dư chạy, lọc ngày/nghiệp vụ và truy tới journal. |
| Đối soát | So riêng COMPANY_FUND dễ sai sau phân bổ nội bộ | Tách tiền công ty, ví cá nhân, FLOAT_MAIN; sao kê có account/cutoff/BOOKED/PENDING và matching. Nạp quỹ mới chọn chứng từ IN/BOOKED chưa dùng. |
| Sửa sai và lịch sử | Thiếu kỳ, liên kết đảo và căn cứ chuyển đổi | Có kỳ đóng, đảo toàn phần gắn gốc, guard ngày; backfill cần chứng cứ, mở phần chênh lệch và audit counter trước/sau. |
| Excel | Nhiều bộ nhập/export riêng, thiếu preview và scope | Nền .xlsx chung, template tham chiếu thật, preview/ghi toàn lô, chống lặp, báo lỗi, export server và audit. |

### Ví dụ thống nhất số liệu

Nhân viên nhận tạm ứng 3.000.000 đồng; chứng từ được xác nhận 850.000 đồng; hoàn tiền thật 250.000 đồng; bù trừ qua lương 500.000 đồng:

> Còn phải quyết toán = 3.000.000 − 850.000 − 250.000 − 500.000 = **1.400.000 đồng**.

Chi phí dự án là 850.000 đồng từ chứng từ được chấp nhận. Dư tạm ứng được theo dõi riêng, không suy từ số dư ví USER. Ví USER có thể chứa những nguồn tiền khác.

## 3. Sáu nhóm tồn đọng vừa hoàn thiện

| Hạng mục | Nội dung đã sửa | Kiểm chứng |
|---|---|---|
| F16 — URL Excel | Khôi phục dataset/scope/ngày/filter trước khi ghi URL; giữ history state; xử lý refresh và back/forward; chỉ gửi filter dataset hỗ trợ. | Browser test mở link trực tiếp, reload và quay lại, gồm phạm vi dự án. |
| F17 — Audit | Danh sách nhận actor theo tên/email và actorId; ngày dùng from/to. List và export dùng chung Specification. Thay CSV trang hiện tại bằng XLSX toàn bộ kết quả có giới hạn an toàn; ghi audit xuất. | Backend tạo 25 bản ghi, list một trang 10 nhưng file xuất đủ 25; lọc action khác trả 0. Browser xác nhận query và tải file không mang page. |
| F18 — Event sổ tài khoản | Truyền event qua controller/service, áp dụng nhất quán vào đầu kỳ, phát sinh và số dư chạy; export dùng cùng report. Journal export nhận thêm requestId. | Backend đối chiếu EXPENSE_VERIFIED 100 đồng giữa report và XLSX, tách ADVANCE; export journal đúng request. |
| Ma trận báo cáo | Thêm nhân sự phòng ban, ngân sách phòng ban, chi phí giai đoạn/danh mục và đối soát tổng hợp; scope nối AND với filter. Báo cáo Manager gồm cả yêu cầu cấp vốn do mình tạo dù không gắn project. | Backend kiểm báo cáo có dữ liệu, từ chối scope ngoài phòng ban/dự án, so counter/journal và kiểm tra yêu cầu cấp vốn. |
| Picker và phân trang | Tìm theo tên/mã, chọn tham chiếu thật có scope và phân trang. Dùng cho journal, sổ tài khoản, Excel, đối chiếu chi phí. Danh sách advance phân trang theo nhân viên tại DB; ngân sách phân trang theo project. | Backend kiểm scope/lookup/paging; browser chọn tham chiếu trên viewport 390×844 và chuyển trang dự án. |
| Lỗi API thành empty | Lịch sử export, quỹ/chứng từ nạp, audit và picker có error riêng/retry; không dùng empty để che lỗi. Lịch sử export tải lại sau khi xuất. | Browser trả lỗi API lịch sử xuất, xác nhận có alert và không có thông báo “chưa có file”. |

Các báo cáo “hiện tại” không nhận khoảng ngày giả định để dựng số dư quá khứ. Đối soát tổng hợp giữ mốc sao kê đã xác nhận, tách khỏi thời điểm lập báo cáo.

## 4. Các vá quan trọng đi kèm

- F01: cập nhật dự án không tạo lại ví.
- F02: Team Leader dùng đúng công thức ngân sách; nhãn chi tiết mô tả ngân sách còn sau chi phí. Việc hiển thị đủ tiền ví/tiền giữ ở mọi dashboard vẫn thuộc nghiệm thu toàn bộ giao diện.
- F03: dư tạm ứng lấy từ AdvanceBalance, thay cho lockedBalance của ví.
- F04: kiểm tổng hạn mức giai đoạn/danh mục với hạn mức cha.
- F05: nạp quỹ bắt buộc chứng cứ đúng account/chiều/số tiền/BOOKED/chưa dùng; tiền, journal và matching cùng transaction.
- F06/F15: chỉ đóng tháng đã kết thúc; đảo không trước nguồn, kỳ gốc đóng thì ghi kỳ hiện tại đang mở; preview kiểm lại dưới khóa.
- F07/F19: xác thực PIN dùng transaction riêng và khóa dòng security settings, giữ được lượt sai khi nghiệp vụ tài chính rollback và khi sai đồng thời.
- F08: ADMIN bootstrap đi qua first-login/PIN.
- F12: scope export không còn bị filter ghi đè; nhân viên không xuất được dữ liệu người khác.
- F13: sửa SQL matching hợp lệ trên PostgreSQL, trả một ID mỗi giao dịch.
- F14: fixture nạp quỹ tạo chứng từ IN/BOOKED rồi dùng bankEvidenceId theo API mới.

## 5. Giao diện và luồng sử dụng

1. **Giao dịch ví:** một dòng mỗi transaction; mở chi tiết để xem biến động từng ví.
2. **Sổ cái kế toán:** journal và hai phía ghi sổ, nguồn/actor/ngày/kỳ; tìm theo tham chiếu bằng tên/mã.
3. **Sổ theo tài khoản:** đầu kỳ/phát sinh/cuối kỳ, filter nghiệp vụ/đối tượng và chuyển sang xuất cùng filter. Khi lọc, số dư là của phạm vi bút toán được chọn.
4. **Tạm ứng:** danh sách nhân viên có phân trang; mở từng khoản để thấy giải ngân, chứng từ, hoàn tiền, payroll và số còn lại.
5. **Ngân sách:** phân trang dự án; tách chi phí, số dư ví, tiền giữ và tạm ứng, không cộng chồng.
6. **Trang bổ trợ:** đối soát, kỳ kế toán, lịch sử/mở sổ và đối chiếu chi phí.
7. **Excel:** chọn bộ dữ liệu/phạm vi → tải mẫu → preview → xác nhận ghi, hoặc xuất từ server theo quyền/filter; theo dõi lịch sử xuất.

Không bổ sung số tiền mẫu vào trang dùng thật. Các bộ dữ liệu cố định trong test chỉ là fixture kiểm thử và nằm ngoài mã trang sản phẩm.

## 6. Ma trận nhập/xuất theo vai trò

| Role | Nhập | Xuất và phạm vi |
|---|---|---|
| ADMIN | Phòng ban, nhân sự/onboarding | Dữ liệu quản trị và audit; dữ liệu cá nhân của chính mình. Không nhập số dư/PIN/mật khẩu từ file. |
| EMPLOYEE | Yêu cầu của mình gắn chứng từ | Yêu cầu, ví/nạp/rút, tạm ứng và phiếu lương của mình. |
| TEAM_LEADER | Giai đoạn, thành viên, hạn mức danh mục dự án được quản lý | Thành viên, yêu cầu và báo cáo dự án/chi phí/tạm ứng trong scope. |
| MANAGER | Dự án thuộc phòng ban | Dự án, nhân sự, ngân sách phòng ban, yêu cầu cấp vốn/phụ trách, chi phí chi tiết và tạm ứng đúng scope. |
| ACCOUNTANT | Payroll và sao kê bằng chứng | Giao dịch, journal, sổ tài khoản, payroll, tạm ứng, báo cáo phòng ban/dự án và đối soát. |
| CFO | Sao kê bằng chứng | Dòng tiền/phân bổ, ngân sách, nhân sự báo cáo, chi phí/tạm ứng và đối soát tổng hợp. |

Bốn bộ báo cáo bổ sung:

| Dataset | Nội dung | Mốc |
|---|---|---|
| `department-employees` | Nhân sự, phòng ban, trạng thái, dư tạm ứng | Hiện tại |
| `department-budgets` | Ngân sách cấp, tiền ví phòng ban, tiền giữ, tiền ví dự án, chi phí và tạm ứng | Hiện tại |
| `project-cost-details` | Giai đoạn/danh mục, hạn mức, chi phí counter, chi phí journal, chênh lệch cần đối chiếu | Hiện tại |
| `bank-reconciliation-summary` | Mốc/căn cứ sao kê, trạng thái xác minh phạm vi, tiền tại mốc, đang chuyển, số ngân hàng và chênh lệch | Mốc sao kê đã lưu; kiểm soát tổng ví ghi riêng thời điểm hiện tại |

## 7. Kết quả kiểm chứng và giới hạn

| Kiểm tra | Kết quả | Phạm vi kết luận |
|---|---|---|
| Backend financial workflow | 13 ca qua, 0 lỗi, 0 bỏ qua | Gồm các luồng trước và filter/scope/báo cáo/paging/matching/PIN/kỳ bổ sung. |
| Bất biến journal PostgreSQL | 5 ca qua, 0 lỗi, 0 bỏ qua | Các ràng buộc journal, cân bằng, kỳ đóng. |
| Flyway trên DB cô lập | 34 migration qua | PostgreSQL 16 mới, không phải DB triển khai chính. |
| Frontend production build/TypeScript | Qua | Mã nguồn biên dịch và tạo trang production. |
| Browser regression | 5 ca qua, 0 lỗi | URL, lỗi API, audit export, paging, picker mobile; có fixture mạng để cô lập UI. |

**Không cộng hai lớp kiểm thử thành một kiểm thử end-to-end sáu role.** Backend dùng PostgreSQL/Redis/RabbitMQ riêng và dịch vụ nghiệp vụ thật; kiểm thử browser kiểm hành vi frontend với phản hồi mạng được kiểm soát. Chưa chạy tất cả UI trực tiếp với API/database triển khai thật.

Dấu vết chạy:

- Backend: `IFMS/target-verification/surefire-reports`, gồm FinancialWorkflowIntegrationTest và JournalDatabaseIntegrationTest.
- Log: `IFMS/target-verification/ledger-acceptance-20261022.log`.
- Browser: `financial-wallet-frontend/test-results/ledger/results.json`.
- Các container chỉ dành cho kiểm thử được dọn sau chạy; không dùng volume/database đang vận hành.

## 8. Mức hoàn thành toàn bộ plan theo 23 gói

Quy ước **D**: có phần triển khai hoàn chỉnh và kiểm chứng đại diện; **P**: còn điều kiện/hạng mục cụ thể phải hoàn thiện. D không tự thay thế nghiệm thu mọi trường hợp trên dữ liệu thực tế. Tỷ lệ 19/23 là tỷ lệ gói D, làm tròn 83%; không suy từ số dòng code hay số test.

| Gói | Nội dung | Mức | Căn cứ / phần còn lại |
|---|---|---|---|
| G0.1 | Migration | P | V34 qua trên DB trống; chưa chạy bản sao dữ liệu triển khai thực tế. |
| G0.2 | Seed và bootstrap | D | Tách demo/live; startup DB thử nghiệm không tạo user/số dư demo. |
| G1.1 | Request, scope và hạn mức | D | Kiểm quan hệ, tiền giữ theo request; các luồng tài chính có test đại diện. |
| G1.2 | Atomic và chống lặp | D | Khóa nguồn/ví/advance/payroll; test chi đồng thời và thực hiện lặp. |
| G1.3 | Payroll | D | FIFO/giới hạn hiện có; test không overwrite/chạy lại kỳ đã chi. |
| G2.1 | Dữ liệu journal | D | Nguồn, actor, snapshot, ngày/kỳ và các chiều dữ liệu. |
| G2.2 | Bất biến và cân bằng | D | 5 test PostgreSQL cho các ràng buộc journal. |
| G2.3 | Sổ tài khoản | D | Đầu/phát sinh/cuối kỳ, filter chiều và event; đối chiếu XLSX với API. |
| G2.4 | Tiền, ngân sách, đối soát | D | Nguồn riêng; matching SQL thật và bộ báo cáo đối soát. |
| G2.5 | Chứng từ | D | Phân bổ chứng từ, nạp quỹ theo IN/BOOKED, không tự ghi từ AI. |
| G3.1 | Kỳ và sửa sai | P | Đã có đóng kỳ/đảo và guard ngày; preview còn thiếu rà soát mọi liên kết nguồn/ngoại lệ. |
| G3.2 | Lịch sử và mở sổ | D | Preview chứng cứ, mở phần chênh lệch, PIN/audit; test mở sổ và counter. |
| G4.1 | Giao diện thống nhất | D | Trang thật, thành phần chung và picker tên/mã; kiểm tra browser đại diện. |
| G4.2 | Truy vết và state toàn bộ trang | P | Ledger/sổ tài khoản/Excel đã giữ URL; chưa đồng nhất mọi trang phụ và mọi deep link qua sáu role. |
| X0 | Nền Excel | D | Template, preview, ghi toàn lô, chống lặp, export/audit/checksum. |
| X1 | Excel Admin | D | Phòng ban/nhân sự, tham chiếu Manager và onboarding. |
| X2 | Excel payroll | D | Dữ liệu mẫu lấy từ nhân sự hiện có, parser dùng chung, chặn ghi đè đã chi. |
| X3 | Excel Manager/Team Leader | D | Dự án/giai đoạn/thành viên/hạn mức; thêm báo cáo phòng ban và chi phí chi tiết. |
| X4 | Excel nhân viên | D | Yêu cầu gắn chứng từ, ví, lịch sử, tạm ứng và phiếu lương cá nhân. |
| X5 | Excel CFO/Accountant đối soát | D | Nhập sao kê chỉ ghi chứng cứ; xuất dòng sao kê và kết quả tổng hợp. |
| X6 | Export sổ và sáu role | D | Bổ sung phạm vi/filter, xuất audit mọi trang, ma trận báo cáo và scope an toàn. |
| D1 | Tài liệu | D | Đồng bộ trạng thái, API mới, ma trận và giới hạn kiểm chứng. |
| V1 | Nghiệm thu tổng thể | P | 18 test backend + 5 browser test đại diện; chưa UAT toàn bộ sáu role trên dữ liệu triển khai. |

## 9. Những việc còn lại để bàn giao toàn bộ

1. **G0.1:** chạy migration trên bản sao dữ liệu đang sử dụng, xác nhận lịch sử Flyway/checksum và khả năng chuyển đổi; không tự sửa lịch sử để qua validate.
2. **G3.1:** mở rộng báo cáo trước đóng kỳ cho toàn bộ liên kết nguồn và ngoại lệ đối soát; xác định cách ghi nhận/xử lý các ngoại lệ trước khi khóa kỳ.
3. **G4.2:** tiếp tục đồng nhất URL/state ở các trang phụ còn lại, kiểm toàn bộ deep link nguồn và lỗi tải dữ liệu qua sáu vai trò.
4. **V1:** nghiệm thu UI sáu role với backend thật, kiểm các tình huống tài chính đồng thời còn chưa bao phủ, và đối chiếu mở sổ/số dư/chứng từ trên bản sao dữ liệu thực.
5. Khi triển khai thực tế: áp dụng migration đúng môi trường, đối chiếu nguồn dữ liệu, chạy lại các kịch bản nghiệm thu; chỉ thực hiện mở sổ/backfill cho nguồn đủ chứng từ.

Các giới hạn dữ liệu bên ngoài vẫn giữ rõ: tắt seed không chứng minh DB cũ không còn dữ liệu demo; MockBank ở luồng rút ví cá nhân là mô phỏng. Không tự ghi bù lịch sử thiếu căn cứ và không coi ví cá nhân là tiền công ty giữ hộ.
