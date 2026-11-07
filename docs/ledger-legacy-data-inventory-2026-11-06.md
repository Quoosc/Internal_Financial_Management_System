# Kiểm kê dữ liệu lịch sử IFMS — 06/11/2026

## Phạm vi kiểm tra

Kiểm tra chỉ đọc database Docker local `IFMSdb` ngày 06/11/2026. Flyway ở
V36 (21 migration đã chạy). Không tạo journal, sửa giao dịch, điều chỉnh số dư
hoặc ghi bù trong lần kiểm kê này. Báo cáo chỉ lưu số tổng hợp, không sao chép
danh tính nhân viên, mã chứng từ, thông tin tài khoản hay nội dung hồ sơ.

Các số liệu dưới đây phản ánh database tại thời điểm kiểm tra; chúng chưa được
xác nhận là chứng từ hoặc số liệu kế toán đã được doanh nghiệp duyệt.

## Số liệu hiện có

| Nguồn | Số lượng | Tổng tiền | Ghi chú |
|---|---:|---:|---|
| Giao dịch nạp cá nhân (`DEPOSIT`) thành công | 3 | 3.800.000 ₫ | Thuộc sổ ví cá nhân, không hạch toán là tiền công ty giữ hộ. |
| Giao dịch rút cá nhân (`WITHDRAW`) thành công | 2 | 20.000.000 ₫ | Thuộc sổ ví cá nhân, không hạch toán là tiền công ty giữ hộ. |
| Cấp quỹ phòng ban (`DEPT_QUOTA_ALLOCATION`) thành công | 1 | 280.000.000 ₫ | Khớp request đã duyệt và transfer thành công. |
| Cấp vốn dự án (`PROJECT_QUOTA_ALLOCATION`) thành công | 1 | 80.000.000 ₫ | Khớp request đã duyệt và transfer thành công. |
| Thanh toán tạm ứng/hoàn chi (`REQUEST_PAYMENT`) thành công | 8 | 18.500.000 ₫ | 3 tạm ứng: 8.000.000 ₫; 5 hoàn chi: 10.500.000 ₫. Các transfer khớp số tiền đã duyệt. |
| Thanh toán lương (`PAYSLIP_PAYMENT`) thành công | 9 | 200.500.000 ₫ | 1 giao dịch chưa tìm được phiếu lương tham chiếu. |
| Bút toán kế toán | 0 | — | Chưa có journal lịch sử. |
| Dòng sao kê ngân hàng | 0 | — | Chưa có căn cứ đối chiếu ngân hàng trong database. |
| Chứng từ tài chính đã xác minh / phân bổ | 0 / 0 | — | Không có dữ liệu phân bổ chứng từ ở các bảng hiện hành. |

Không cộng tổng tiền của các loại giao dịch để suy ra tiền công ty: số liệu có
cả luồng cá nhân, thanh toán lương và các lần chuyển quỹ nội bộ.

## Phân loại nguồn lịch sử

| Nguồn | Phát hiện | Xử lý hiện tại |
|---|---|---|
| Nạp/rút ví cá nhân | 5 giao dịch thành công. | Giữ trong lịch sử ví cá nhân; loại khỏi journal doanh nghiệp theo nghiệp vụ đã chốt. |
| Cấp phòng ban/dự án | Mỗi nhóm có một request đã trả; transfer thành công khớp số đã duyệt. | Có thể đưa vào hàng đợi preview ghi bù sau khi người phụ trách xác nhận hồ sơ nguồn và kỳ/ngày nghiệp vụ. Chưa ghi bù tự động. |
| Tạm ứng | 3 khoản đang mở; đã giải ngân 8.000.000 ₫, đã quyết toán chứng từ 0 ₫, hoàn tiền thật 0 ₫, khấu trừ lương 0 ₫; còn phải quyết toán 8.000.000 ₫. Các request đã trả khớp transfer. | Giữ nguyên số dư. Chỉ preview journal giải ngân khi xác nhận được request, nhân viên nhận tiền, dự án và transaction tương ứng. Không chuyển phần tạm ứng thành chi phí. |
| Hoàn chi (`EXPENSE`) | 5 request đã thanh toán, tổng transfer 10.500.000 ₫; cả 5 đều thiếu file đính kèm và phân bổ chứng từ đã xác minh. | **Chặn ghi bù chi phí và khoản phải hoàn.** Cần bổ sung chứng từ, số tiền hợp lệ và xác nhận của Kế toán. Không lấy transfer làm bằng chứng duy nhất rằng chi phí hợp lệ. |
| Phiếu lương | 17 phiếu trạng thái đã trả, tổng thực lĩnh 395.000.000 ₫. 8 phiếu có transaction tham chiếu khớp đúng số tiền; 9 phiếu chưa có transaction khớp. | 8 trường hợp có liên kết cần được kiểm tra hồ sơ lương trước khi preview. 9 phiếu thiếu giao dịch và 1 transaction không tìm được phiếu lương phải điều tra riêng; không tự suy luận liên kết. |
| Sao kê/nạp quỹ công ty | Không có dòng sao kê và không có giao dịch nạp quỹ ngân hàng `SYSTEM_TOPUP`. | Không tạo journal nguồn ngân hàng hoặc khẳng định đã đối soát. Import sao kê có chứng từ rồi mới ghép/nạp quỹ. |
| Quyết toán tạm ứng (`REIMBURSE`) | Có yêu cầu mới ở trạng thái đã được Trưởng nhóm duyệt, chưa phải giao dịch quyết toán đã ghi sổ. | Không tạo journal lịch sử cho yêu cầu chưa hoàn tất quyết toán. |

## Điều kiện trước khi tiếp tục P4

1. Chủ dự án xác nhận các dữ liệu local nào là nghiệp vụ thật, dữ liệu demo hay
   dữ liệu kiểm thử; đối chiếu riêng từng nguồn với lịch sử duyệt và hồ sơ gốc.
2. Thu thập chứng từ chi phí, hồ sơ bảng lương và sao kê còn thiếu. Riêng các
   phiếu lương chưa có giao dịch phải xác định nguồn thanh toán hoặc xác nhận
   trạng thái thực tế.
3. Chạy preview/đối chiếu trên bản sao database, có người phụ trách xác nhận
   từng nhóm và số dư mở đầu; kiểm lại số dư ví, khoản tạm ứng, chi phí, lương,
   ngân sách và kỳ trước khi ghi.
4. Chỉ commit các nguồn có căn cứ; lưu danh sách chưa xử lý và lý do. Không sửa
   migration đã chạy và không ghi một journal tổng để bù các khoản thiếu nguồn.

**Kết luận P4:** đã kiểm kê và phân loại mốc dữ liệu local; chưa thực hiện
chuyển đổi. Phần này chỉ được đóng sau khi hồ sơ được bổ sung/xác nhận và các
preview có thể đối chiếu đầy đủ. Database local đã được dừng lại sau truy vấn;
database cô lập dùng cho test không chứa dữ liệu này.
