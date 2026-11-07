from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


OUT = Path(__file__).resolve().parents[1] / "public" / "demo-documents"
FONT_PATH = Path("C:/Windows/Fonts/arial.ttf")
FONT_BOLD_PATH = Path("C:/Windows/Fonts/arialbd.ttf")

DOCS = [
    {
        "id": 63,
        "code": "REQ-IT-0926-075",
        "file": "REQ-IT-0926-075-du-toan-hoi-thao.pdf",
        "kind": "advance",
        "name": "Vũ Thị Lan",
        "title": "Tham dự hội thảo công nghệ tại Hà Nội",
        "amount": 2000000,
        "date": "06/11/2026",
        "items": [("Vé tham dự hội thảo chuyên ngành", 1, 1200000), ("Di chuyển khứ hồi", 1, 450000), ("Lưu trú theo định mức", 1, 250000), ("Đi lại nội thành", 1, 100000)],
    },
    {
        "id": 88,
        "code": "REQ-IT-1126-115",
        "file": "REQ-IT-1126-115-du-toan-thue-thiet-bi.pdf",
        "kind": "advance",
        "name": "Đỗ Quốc Bảo",
        "title": "Thuê thiết bị phục vụ chạy thử hệ thống ERP",
        "amount": 2100000,
        "date": "06/11/2026",
        "items": [("Thuê laptop cấu hình kiểm thử (2 ngày)", 2, 650000), ("Thuê bộ thiết bị trình chiếu", 1, 350000), ("Phí vận chuyển và bàn giao", 1, 450000)],
    },
    {
        "id": 89,
        "code": "REQ-IT-1126-116",
        "file": "REQ-IT-1126-116-du-toan-huong-dan.pdf",
        "kind": "advance",
        "name": "Vũ Thị Lan",
        "title": "Tổ chức buổi hướng dẫn sử dụng ERP",
        "amount": 980000,
        "date": "06/11/2026",
        "items": [("Thuê phòng hướng dẫn theo buổi", 1, 500000), ("Nước uống và vật tư lớp học", 1, 180000), ("In tài liệu hướng dẫn", 20, 15000)],
    },
    {
        "id": 90,
        "code": "REQ-FIN-1126-117",
        "file": "REQ-FIN-1126-117-du-toan-phu-kien.pdf",
        "kind": "advance",
        "name": "Nguyễn Thị Minh",
        "title": "Mua phụ kiện phục vụ nghiệm thu sprint",
        "amount": 1450000,
        "date": "06/11/2026",
        "items": [("Bộ chuyển đổi USB-C đa cổng", 2, 390000), ("Cáp kết nối HDMI", 2, 145000), ("Ổ cắm điện chống quá tải", 1, 380000)],
    },
    {
        "id": 91,
        "code": "REQ-IT-1126-118",
        "file": "REQ-IT-1126-118-du-toan-di-chuyen.pdf",
        "kind": "advance",
        "name": "Đỗ Quốc Bảo",
        "title": "Di chuyển làm việc với nhóm triển khai",
        "amount": 850000,
        "date": "06/11/2026",
        "items": [("Di chuyển liên tỉnh khứ hồi", 1, 520000), ("Đi lại tại địa điểm làm việc", 1, 180000), ("Phụ phí hành lý thiết bị", 1, 150000)],
    },
    {
        "id": 92,
        "code": "REQ-IT-1126-119",
        "file": "REQ-IT-1126-119-du-toan-thiet-bi-kiem-thu.pdf",
        "kind": "advance",
        "name": "Vũ Thị Lan",
        "title": "Chuẩn bị thiết bị cho đợt kiểm thử tích hợp",
        "amount": 1250000,
        "date": "06/11/2026",
        "items": [("Bộ phát Wi-Fi phục vụ môi trường test", 1, 650000), ("Dây mạng CAT6", 5, 50000), ("Vật tư phụ kiện lắp đặt", 1, 350000)],
    },
    {
        "id": 93,
        "code": "REQ-FIN-1126-120",
        "file": "REQ-FIN-1126-120-du-toan-dao-tao.pdf",
        "kind": "advance",
        "name": "Nguyễn Thị Minh",
        "title": "Hỗ trợ đào tạo người dùng nội bộ",
        "amount": 1650000,
        "date": "06/11/2026",
        "items": [("Thuê phòng đào tạo theo buổi", 1, 700000), ("In bộ tài liệu hướng dẫn", 25, 12000), ("Nước uống cho người tham dự", 25, 10000), ("Vật tư lớp học", 1, 400000)],
    },
    {
        "id": 57,
        "code": "REQ-IT-0926-069",
        "file": "REQ-IT-0926-069-bang-ke-quyet-toan.pdf",
        "kind": "settlement",
        "name": "Đỗ Quốc Bảo",
        "title": "Thiết bị laptop phục vụ kiểm thử ERP",
        "amount": 2000000,
        "date": "06/11/2026",
        "items": [("Thiết bị laptop phục vụ chạy thử", 1, 1818182), ("Thuế minh họa 10%", 1, 181818)],
    },
]


def money(value: int) -> str:
    return f"{value:,.0f}".replace(",", ".")


def build_document(doc: dict, regular: str, bold: str) -> Path:
    calculated = sum(quantity * unit_price for _, quantity, unit_price in doc["items"])
    if calculated != doc["amount"]:
        raise ValueError(f"Line items do not match request amount for {doc['code']}: {calculated} != {doc['amount']}")
    output = OUT / doc["file"]
    title = "BẢNG KÊ CHỨNG TỪ QUYẾT TOÁN TẠM ỨNG" if doc["kind"] == "settlement" else "DỰ TOÁN KHOẢN TẠM ỨNG"
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="Brand", fontName=bold, fontSize=10, leading=14, textColor=colors.HexColor("#1d4ed8")))
    styles.add(ParagraphStyle(name="TitleVN", fontName=bold, fontSize=17, leading=22, alignment=TA_CENTER, textColor=colors.HexColor("#0f172a"), spaceAfter=5))
    styles.add(ParagraphStyle(name="SubTitle", fontName=regular, fontSize=9, leading=13, alignment=TA_CENTER, textColor=colors.HexColor("#64748b")))
    styles.add(ParagraphStyle(name="BodyVN", fontName=regular, fontSize=9, leading=14, textColor=colors.HexColor("#334155")))
    styles.add(ParagraphStyle(name="SmallVN", fontName=regular, fontSize=8, leading=12, textColor=colors.HexColor("#64748b")))
    styles.add(ParagraphStyle(name="TableVN", fontName=regular, fontSize=8.5, leading=12, textColor=colors.HexColor("#334155")))
    styles.add(ParagraphStyle(name="TableBoldVN", fontName=bold, fontSize=8.5, leading=12, textColor=colors.HexColor("#0f172a")))
    styles.add(ParagraphStyle(name="RightVN", fontName=regular, fontSize=8.5, leading=12, alignment=TA_RIGHT, textColor=colors.HexColor("#334155")))

    doc_template = SimpleDocTemplate(str(output), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm, topMargin=17 * mm, bottomMargin=18 * mm, title=title, author="IFMS Demo")
    story = [
        Paragraph("IFMS FINANCE · TÀI LIỆU DEMO", styles["Brand"]),
        Spacer(1, 8 * mm),
        Paragraph(title, styles["TitleVN"]),
        Paragraph("TÀI LIỆU MINH HỌA · KHÔNG CÓ GIÁ TRỊ THANH TOÁN / KÊ KHAI", styles["SubTitle"]),
        Spacer(1, 8 * mm),
    ]

    info = [
        [Paragraph("Mã yêu cầu", styles["SmallVN"]), Paragraph(doc["code"], styles["TableBoldVN"]), Paragraph("Ngày lập", styles["SmallVN"]), Paragraph(doc["date"], styles["TableVN"])],
        [Paragraph("Người đề nghị", styles["SmallVN"]), Paragraph(doc["name"], styles["TableBoldVN"]), Paragraph("Dự án", styles["SmallVN"]), Paragraph("Hệ Thống ERP Nội Bộ", styles["TableVN"])],
        [Paragraph("Giai đoạn", styles["SmallVN"]), Paragraph("Triển khai / kiểm thử ERP", styles["TableVN"]), Paragraph("Loại tài liệu", styles["SmallVN"]), Paragraph("Căn cứ xét tạm ứng" if doc["kind"] == "advance" else "Chứng từ quyết toán minh họa", styles["TableVN"])],
    ]
    info_table = Table(info, colWidths=[28 * mm, 58 * mm, 25 * mm, 55 * mm], rowHeights=[10 * mm] * 3)
    info_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#dbe4f0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#e2e8f0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ]))
    story += [info_table, Spacer(1, 7 * mm), Paragraph("Nội dung đề nghị", styles["TableBoldVN"]), Spacer(1, 2 * mm), Paragraph(doc["title"], styles["BodyVN"]), Spacer(1, 5 * mm)]
    story.append(Paragraph("Bảng chi tiết dự kiến" if doc["kind"] == "advance" else "Bảng kê chi phí đề nghị quyết toán", styles["TableBoldVN"]))
    story.append(Spacer(1, 2 * mm))

    rows = [[Paragraph(label, styles["TableBoldVN"]) for label in ["STT", "Nội dung", "SL", "Đơn giá (VND)", "Thành tiền (VND)"]]]
    subtotal = 0
    for i, (description, quantity, unit_price) in enumerate(doc["items"], 1):
        line_total = quantity * unit_price
        subtotal += line_total
        rows.append([
            Paragraph(str(i), styles["TableVN"]),
            Paragraph(description, styles["TableVN"]),
            Paragraph(str(quantity), styles["RightVN"]),
            Paragraph(money(unit_price), styles["RightVN"]),
            Paragraph(money(line_total), styles["RightVN"]),
        ])
    rows.append(["", Paragraph("TỔNG CỘNG", styles["TableBoldVN"]), "", "", Paragraph(money(subtotal), styles["TableBoldVN"])])
    detail_table = Table(rows, colWidths=[12 * mm, 77 * mm, 14 * mm, 32 * mm, 32 * mm], repeatRows=1)
    detail_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eaf2ff")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1e40af")),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#dbe4f0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#e2e8f0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story += [detail_table, Spacer(1, 5 * mm)]
    story.append(Paragraph(f"Số tiền theo yêu cầu trên hệ thống: <b>{money(doc['amount'])} VND</b>", styles["BodyVN"]))
    story.append(Spacer(1, 5 * mm))

    if doc["kind"] == "advance":
        note = "Đây là dự toán trước khi mua sắm/chi tiêu, dùng để Accountant xem mục đích, tính hợp lý và hạn mức. Chưa xác nhận giao dịch mua, chưa phải hóa đơn và chưa ghi nhận chi phí. Sau khi sử dụng tiền, nhân viên nộp hóa đơn/chứng từ thực tế qua yêu cầu Quyết toán tạm ứng."
        sign_left, sign_right = "Người đề nghị tạm ứng", "Người xem xét / phê duyệt"
    else:
        note = "Bảng kê mô phỏng để minh họa cách đối chiếu chứng từ và phân bổ khoản đã chi vào yêu cầu tạm ứng. Hóa đơn, mã số thuế và số liệu thuế trong bản demo không phải chứng từ pháp lý; khi vận hành thật cần tải bản gốc hợp lệ. Khoản quyết toán này không tạo thêm lần chuyển tiền cho nhân viên."
        sign_left, sign_right = "Người lập bảng kê", "Kế toán kiểm tra"
    notice = Table([[Paragraph(note, styles["BodyVN"])]], colWidths=[167 * mm])
    notice.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fff7ed")), ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#fed7aa")), ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10), ("TOPPADDING", (0, 0), (-1, -1), 9), ("BOTTOMPADDING", (0, 0), (-1, -1), 9)]))
    story += [notice, Spacer(1, 13 * mm)]
    sign = Table([[Paragraph(sign_left, styles["SmallVN"]), Paragraph(sign_right, styles["SmallVN"])], [Paragraph("(Minh họa)", styles["SmallVN"]), Paragraph("(Minh họa)", styles["SmallVN"])]], colWidths=[83.5 * mm, 83.5 * mm], rowHeights=[8 * mm, 18 * mm])
    sign.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER"), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story += [sign]

    def footer(canvas, _document):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor("#dbe4f0"))
        canvas.line(18 * mm, 14 * mm, A4[0] - 18 * mm, 14 * mm)
        canvas.setFont(regular, 7)
        canvas.setFillColor(colors.HexColor("#64748b"))
        canvas.drawString(18 * mm, 9 * mm, "IFMS DEMO · Tài liệu giả lập, không phải chứng từ kế toán hợp pháp")
        canvas.drawRightString(A4[0] - 18 * mm, 9 * mm, f"Trang {_document.page}")
        canvas.restoreState()

    doc_template.build(story, onFirstPage=footer, onLaterPages=footer)
    return output


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    if not FONT_PATH.exists() or not FONT_BOLD_PATH.exists():
        raise FileNotFoundError("Arial font files are required to render Vietnamese text in the demo PDFs.")
    pdfmetrics.registerFont(TTFont("ArialVN", str(FONT_PATH)))
    pdfmetrics.registerFont(TTFont("ArialVNBold", str(FONT_BOLD_PATH)))
    for document in DOCS:
        path = build_document(document, "ArialVN", "ArialVNBold")
        print(f"{document['id']}\t{path.name}\t{path.stat().st_size}")


if __name__ == "__main__":
    main()
