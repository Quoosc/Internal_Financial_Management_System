# Ma trận nghiệp vụ, nguồn và tác động sổ cái IFMS

**Ngày cập nhật:** 06/11/2026  
**Trạng thái:** Chuẩn đối chiếu triển khai P0–P5

Tài liệu này chốt cách đọc một sự kiện kế toán trong phạm vi IFMS. Số dư ví là
luồng tiền; bút toán kế toán là ghi nhận tác động lên tài khoản. Hai phần liên
kết qua mã nguồn và mã giao dịch nhưng không thay thế cho nhau.

## Quy tắc chung

- Mỗi bút toán phải có tối thiểu hai dòng, tổng tăng bên tài sản/chi phí bằng
  tổng giảm bên tài sản/nợ phải trả theo mô hình tài khoản IFMS.
- Journal lưu ngày ghi sổ, kỳ, mã nguồn và bản chụp dữ liệu tại thời điểm ghi.
  Trạng thái hiện tại của hồ sơ dùng để kiểm tra chuỗi hiệu lực; không ghi đè
  nội dung lịch sử trong journal.
- Khi đảo, hệ thống giữ nguyên journal gốc và tạo journal đảo liên kết với gốc.
  Các dòng đảo phải đảo đúng tài khoản, số tiền và chiều của từng dòng gốc.
- Tạm ứng còn dư là khoản nhân viên còn phải quyết toán. Chi phí chỉ được ghi
  nhận theo chứng từ hợp lệ; giải ngân tạm ứng không tự tạo chi phí.
- Nạp/rút ví cá nhân chỉ thuộc sổ biến động ví cá nhân. Không coi đó là tiền
  công ty giữ hộ và không tạo phát sinh quỹ công ty.
- `DEPOSIT`, `WITHDRAW`, giao dịch ví cá nhân không thuộc danh sách sự kiện
  journal doanh nghiệp dưới đây.

## Ma trận sự kiện

| Sự kiện | Nguồn bắt buộc | Bút toán tài khoản IFMS | Tiền ví / trạng thái hợp lệ | Số liệu cần giữ khớp | Vai trò chịu ảnh hưởng |
|---|---|---|---|---|---|
| Giải ngân tạm ứng (`ADVANCE_DISBURSED`) | Yêu cầu tạm ứng đã giải ngân, khoản dư tạm ứng, giao dịch `REQUEST_PAYMENT` | Tăng khoản tạm ứng nhân viên chưa quyết toán; giảm ví dự án | Dự án → nhân viên; yêu cầu đã chi hoặc đã đảo có journal đảo liên kết | Tiền gốc ứng = giao dịch ví = journal; khoản tạm ứng tham chiếu đúng yêu cầu/người/dự án | Nhân viên, Trưởng nhóm, Kế toán, Quản lý dự án, CFO xem báo cáo tổng hợp |
| Xác nhận chi phí nhân viên tự trả (`EXPENSE_VERIFIED`) | Yêu cầu `EXPENSE`, chứng từ đính kèm, tổng phân bổ chứng từ | Tăng chi phí dự án; tăng khoản phải hoàn cho nhân viên | Không chuyển tiền; trạng thái đã xác nhận, đã thanh toán hoặc đã đảo có journal đảo | Tổng chứng từ phân bổ = số được xác nhận = journal; ghi chi phí đúng một lần | Nhân viên, Trưởng nhóm, Kế toán, Quản lý dự án, CFO xem báo cáo |
| Thanh toán hoàn chi (`EXPENSE_PAID`) | Yêu cầu chi phí đã xác nhận, giao dịch `REQUEST_PAYMENT` | Giảm khoản phải hoàn; giảm ví dự án | Dự án → nhân viên; phải tồn tại sự kiện xác nhận chi phí trước đó | Tiền thanh toán = số phải hoàn = giao dịch ví; không tăng chi phí lần hai | Nhân viên, Kế toán, Quản lý dự án, CFO xem báo cáo |
| Quyết toán tạm ứng bằng chứng từ (`REIMBURSE_SETTLED`) | Yêu cầu `REIMBURSE`, khoản tạm ứng được chọn, chứng từ và phân bổ | Tăng chi phí dự án; giảm khoản tạm ứng nhân viên chưa quyết toán | Không chuyển tiền; yêu cầu đã quyết toán hoặc đã đảo có journal đảo liên kết | Số quyết toán = phân bổ chứng từ = journal; giảm đúng khoản tạm ứng, không đổi số dư ví | Nhân viên, Trưởng nhóm, Kế toán, Quản lý dự án, CFO xem báo cáo |
| Nhân viên hoàn tiền tạm ứng (`ADVANCE_RETURNED`) | Giao dịch `ADVANCE_RETURN` có tham chiếu khoản tạm ứng | Tăng ví dự án; giảm khoản tạm ứng chưa quyết toán | Nhân viên → dự án; giao dịch ví thành công, đúng nhân viên và dự án | Tiền hoàn = giao dịch = journal; dư tạm ứng không âm | Nhân viên, Kế toán, Quản lý dự án, CFO xem báo cáo |
| Khấu trừ tạm ứng qua lương (`PAYROLL_SETTLEMENT`) | Phiếu lương đã chi, các thành phần lương và phân bổ khấu trừ tới từng khoản ứng | Tăng chi phí lương; giảm quỹ công ty theo thực lĩnh; ghi khoản khấu trừ bảng lương; giảm từng khoản tạm ứng | Quỹ công ty → nhân viên theo thực lĩnh; phần khấu trừ là bù trừ, không tạo chuyển tiền ngược | Lương gộp = chi phí lương; khấu trừ khác và khấu trừ tạm ứng khớp phiếu; thực lĩnh khớp giao dịch | Nhân viên, Kế toán, CFO, Quản lý xem số liệu trong phạm vi được phép |
| Nạp quỹ công ty (`SYSTEM_TOPUP`) | Giao dịch nạp quỹ và sao kê ngân hàng IN/BOOKED hoặc đã xác nhận | Tăng quỹ công ty; giảm tiền tại ngân hàng/nguồn bên ngoài | Nguồn bên ngoài → quỹ công ty | Số tiền, tài khoản công ty, chiều IN, trạng thái BOOKED và giao dịch phải cùng khớp | Kế toán, CFO; Quản lý xem số quỹ/phân bổ được cấp |
| Cấp ngân sách phòng ban (`DEPARTMENT_ALLOCATION`) | Yêu cầu cấp phòng ban đã chi và giao dịch phân bổ | Tăng ví phòng ban; giảm quỹ công ty | Quỹ công ty → phòng ban | Số được duyệt = giao dịch = journal; trừ đúng phần ngân sách công ty | Manager, CFO, Kế toán; Trưởng nhóm xem hạn mức liên quan |
| Cấp vốn dự án (`PROJECT_ALLOCATION`) | Yêu cầu cấp dự án đã chi và giao dịch phân bổ | Tăng ví dự án; giảm ví phòng ban | Phòng ban → dự án | Số được duyệt = giao dịch = journal; không vượt phần quỹ phòng ban | Trưởng nhóm, Manager, Kế toán, CFO xem tổng hợp |
| Đảo bút toán (`REVERSAL`) | Journal gốc, lý do, PIN và ngày đảo hợp lệ; correction nghiệp vụ đã hoàn tất | Đảo chiều chính xác từng dòng journal gốc | Có thể kèm giao dịch ví đảo hoặc khôi phục công nợ/ngân sách theo loại nghiệp vụ | Gốc chỉ được đảo một lần; dòng đảo khớp gốc; nguồn và số dư nghiệp vụ được cập nhật cùng giao dịch DB | Accountant/CFO thao tác theo quyền; các vai trò liên quan thấy trạng thái/lịch sử mới |
| Mở sổ số dư đã xác minh (`OPENING_BALANCE`) | Phạm vi ví/khoản tạm ứng, preview số dư và căn cứ chuyển đổi | Ghi phần chênh lệch vào tài khoản tương ứng và tài khoản đối ứng mở sổ | Không tự tạo giao dịch ví | Chỉ ghi chênh lệch có bằng chứng; không ghi bù trùng; tổng trước/sau được xác nhận | Kế toán/CFO thao tác theo quyền; người liên quan tra cứu |

## Kiểm tra trước khi đóng kỳ

| Nhóm | Phải kiểm tra | Xử lý |
|---|---|---|
| Cấu trúc | Ít nhất hai dòng; tổng các dòng cân bằng và bằng số journal | Chặn đóng kỳ; mở journal để lập correction có liên kết |
| Hồ sơ nguồn | Nguồn tồn tại, đúng loại sự kiện, đúng mã nhân viên/dự án/khoản tạm ứng | Chặn; đối chiếu hồ sơ gốc và lịch sử |
| Số tiền | Số đã duyệt, số giao dịch, journal và các dòng tài khoản khớp theo event | Chặn; không tự điều chỉnh số tiền |
| Chứng từ | Tổng phân bổ đang hiệu lực bằng chi phí đã xác nhận/quyết toán | Chặn; kiểm tra file và lịch sử phân bổ/đảo |
| Tạm ứng | Số còn lại = số đã ứng trừ chứng từ quyết toán, hoàn tiền, khấu trừ lương và phần lịch sử chưa phân loại | Chặn nếu sai; khoản còn dư đúng được chuyển kỳ |
| Lương | Phiếu gốc/thay thế/đảo đúng; chi phí, khấu trừ, thực lĩnh và chuyển ví khớp | Chặn nếu lệch; mở chuỗi phiếu lương và journal liên quan |
| Ngân hàng | Nạp quỹ gắn sao kê đúng tài khoản, chiều IN, số tiền và BOOKED | Chặn nạp quỹ chưa đối chiếu; sao kê chờ được nêu riêng |
| Đảo | Đúng journal gốc, không đảo lặp, ngày đảo không trước ngày gốc, dòng đảo khớp tuyệt đối | Chặn; xử lý qua nghiệp vụ correction |

## Ma trận truy cập theo vai trò

| Vai trò | Xem luồng liên quan | Thao tác làm thay đổi số liệu kế toán |
|---|---|---|
| Nhân viên | Yêu cầu của mình, ví, tạm ứng, hoàn tiền, phiếu lương và thông báo của mình | Tạo yêu cầu; hoàn tiền tạm ứng thật; không sửa journal |
| Trưởng nhóm | Yêu cầu nhóm/dự án, trạng thái và ngân sách được phân công | Duyệt yêu cầu theo quyền hiện có; không sửa journal |
| Quản lý | Yêu cầu cấp dự án, quỹ phòng ban và báo cáo đơn vị được quản lý | Duyệt/cấp vốn đúng luồng; không sửa journal |
| Kế toán | Giao dịch, journal, chứng từ, lương, tạm ứng, ngân hàng và kỳ trong quyền | Xác nhận chứng từ, thanh toán, ghi bù/đóng kỳ/đảo theo quyền hiện hành |
| CFO | Quỹ công ty, cấp ngân sách và báo cáo được cấp quyền | Duyệt/cấp quỹ, xác nhận hoặc thao tác kỳ theo quyền hiện hành |
| Admin | Nhân sự/phòng ban, nhật ký hệ thống và lịch sử import/export | Quản trị dữ liệu; không mặc nhiên có quyền ghi journal kế toán |

## Liên kết với ca kiểm thử

- `U01`: tạm ứng, quyết toán nhiều lần, hoàn tiền thật.
- `U02`: tự chi, xác nhận chứng từ, thanh toán hoàn chi.
- `U03`: từ chối/hủy và giải phóng khoản giữ.
- `U04`: cấp quỹ phòng ban/dự án và kiểm giới hạn.
- `U05`: nhập lương, khấu trừ, chi và thay phiếu.
- `U06`: sao kê, đối chiếu, nạp quỹ và đảo.
- `U07`: đảo từng loại nguồn theo quan hệ phụ thuộc.
- `U08`: xem trước/đóng kỳ và xử lý sau khi đóng.
- `U09`: ghi bù, mở sổ và đối chiếu căn cứ lịch sử.
- `U10`: nhập dữ liệu quản trị và quyền theo vai trò.
- `U11`: sổ tài khoản, báo cáo và Excel sau các nghiệp vụ.
- `U12`: lỗi API, thử lại, điều hướng và đổi nguồn nhanh.
