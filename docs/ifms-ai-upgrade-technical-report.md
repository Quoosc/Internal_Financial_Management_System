# Báo cáo kỹ thuật: nâng cấp AI cho IFMS

> **Mục đích:** trình bày với GVHD chức năng AI đang có, cách thay thế lời gọi Gemini và phần mô hình nhóm dự kiến huấn luyện.  
> **Trạng thái:** đây là **kế hoạch**, chưa phải kết quả triển khai hay kết quả đo mô hình. Khảo sát dựa trên source backend IFMS và frontend financial-wallet-frontend.

## Tóm tắt trong một phút

| Việc | IFMS hiện dùng | Nhóm đề xuất dùng | Có phải nhóm train? |
|---|---|---|---|
| Đọc ảnh/PDF hóa đơn | **Gemini API** đọc và trả các trường hóa đơn | **PaddleOCR chạy nội bộ** đọc chữ; code tách và kiểm tra số tiền, ngày, nhà cung cấp | **Không** ở giai đoạn đầu; dùng OCR có sẵn |
| Gợi ý danh mục chi | **Gemini API** chọn từ danh mục của giai đoạn dự án | **Fine tune PhoBERT** bằng các khoản chi đã được xác nhận danh mục | **Có**; đây là đóng góp huấn luyện chính |
| Hỏi đáp quy trình IFMS | **Chưa có chatbot** | **RAG** tìm tài liệu đã duyệt; **Qwen chạy nội bộ** trả lời kèm nguồn | **Không**; RAG là truy xuất, Qwen là mô hình có sẵn |
| Hỏi số dư, ngân sách, sổ cái | **Chưa có chatbot** | Chatbot gọi **API báo cáo IFMS có phân quyền**; Qwen chỉ diễn đạt | **Không**; backend tính số liệu |
| Gợi ý khi nhập Excel | Excel hiện kiểm cột và dữ liệu bằng code, **chưa có AI** | Dùng lại **PhoBERT** để gợi ý danh mục cho từng dòng yêu cầu chi; RAG giải thích quy trình/lỗi nhập | Không huấn luyện thêm một model Excel riêng |

**Câu chốt để báo cáo:** “Nhóm sẽ fine tune PhoBERT để gợi ý danh mục chi, dùng PaddleOCR nội bộ đọc chứng từ và xây chatbot RAG với Qwen nội bộ để hỏi đáp quy trình. Câu hỏi về tiền và sổ cái được backend IFMS tính qua API có phân quyền.”

---

# PHẦN 1. AI TRONG IFMS HIỆN TẠI

## 1. Đã triển khai những gì?

Trong source hiện tại, **Gemini là nhà cung cấp AI duy nhất được xác nhận**. Có hai lời gọi mô hình trong quy trình tạo yêu cầu:

| Chức năng | Mục đích và luồng đang chạy | Công nghệ | Hạn chế |
|---|---|---|---|
| **Đọc chứng từ** | Nhân viên tạo yêu cầu hoàn chi/quyết toán và tải ảnh hoặc PDF → frontend gửi tệp tới backend → backend gọi Gemini → nhận tổng tiền, ngày, nhà cung cấp, số hóa đơn, VAT, mô tả… → lưu kết quả và trả về form. | Next.js, Spring Boot, Gemini API, PostgreSQL, Redis cache/quota. | Ảnh phải gửi cho nhà cung cấp; phụ thuộc mạng, hạn mức và giá gói; có thể đọc sai trường dù JSON hợp lệ. |
| **Gợi ý danh mục chi** | Nếu đã chọn giai đoạn, Gemini chọn danh mục trong cùng lần đọc ảnh. Nếu chọn giai đoạn sau, backend gửi tóm tắt chứng từ và danh sách danh mục cho Gemini bằng một lời gọi văn bản khác. Backend từ chối ID ngoài danh sách. | Gemini API, danh mục giai đoạn do Spring Boot tải và kiểm quyền. | Chưa có model nhóm train; chưa đo mức đúng theo danh mục; kết quả phụ thuộc nội dung chứng từ đọc được. |

Backend có cấu hình Gemini, timeout, model dự phòng, giới hạn lượt/người/ngày và cache theo tệp. Khi AI không khả dụng, nhân viên vẫn nhập tay. **Không thể xác nhận model Gemini, tier hoặc chi phí đang chạy thực tế chỉ bằng cấu hình mặc định trong source.**

### Đầu ra AI được dùng thế nào?

- Form lấy trường đã đọc để **gợi ý** số tiền, ngày, tiêu đề và mô tả; người dùng sửa thì AI không ghi đè.
- Backend dùng **quy tắc**, không dùng mô hình AI, để cảnh báo tổng tiền lệch, ngày hóa đơn bất thường, tiền tệ khác VND, dòng hàng không khớp và hóa đơn có dấu hiệu đã dùng.
- Chế độ mock tạo dữ liệu mẫu dựa vào tên tệp để demo; **không phải OCR hoặc mô hình được huấn luyện**.
- Kết quả đọc được lưu trong bảng document_extractions. Cần bổ sung đường xem lại cảnh báo/chứng từ từ màn kế toán khi triển khai nâng cấp; source đã khảo sát chưa xác nhận màn đó đọc lại đầy đủ cảnh báo.

## 2. Những gì chưa có

**Chưa xác nhận có code chạy** cho chatbot RAG, mô hình fine tune, OCR nội bộ, AI phân tích Excel hoặc dự báo dòng tiền bằng ML. F4 (hỏi đáp) và F5 (dự báo) trong tài liệu đồ án 2 là **đề xuất**, không được đưa vào phần thành quả đã triển khai. Không thấy tích hợp OpenAI hoặc Claude trong mã nguồn ứng dụng đã khảo sát.

**Hạn chế chung:** bộ thử Gemini được mô tả trong tài liệu cũ chỉ gồm vài ảnh mẫu; chưa đủ để tuyên bố độ chính xác trên chứng từ thật. Chi phí API, độ trễ và chất lượng phải đo trên cùng một tập kiểm thử trước khi so sánh với giải pháp mới. Điều kiện sử dụng ảnh gửi ra ngoài phụ thuộc loại dịch vụ/gói của Google; không suy đoán rằng mọi gói có cùng chính sách. Tham khảo [bảng giá](https://ai.google.dev/gemini-api/docs/pricing) và [điều khoản Gemini API](https://ai.google.dev/gemini-api/terms).

---

# PHẦN 2. KIẾN TRÚC VÀ KẾ HOẠCH NÂNG CẤP

## 1. Phân biệt kỹ thuật

| Thuật ngữ | Nghĩa trong kế hoạch IFMS |
|---|---|
| **API inference** | Gửi ảnh/văn bản cho model có sẵn để lấy kết quả. Gemini hiện làm việc này; **không phải nhóm train model**. |
| **OCR nội bộ** | Model có sẵn đọc chữ trên ảnh/PDF tại máy chủ nhóm. Chỉ gọi là “nhóm train OCR” nếu thật sự huấn luyện lại bằng ảnh có nhãn. |
| **Supervised fine tuning** | Nhóm lấy ví dụ có **đáp án danh mục đã xác nhận** để huấn luyện tiếp PhoBERT. Đây là phần nhóm train. |
| **RAG** | Tìm đoạn tài liệu liên quan rồi đưa cho Qwen trả lời. **RAG không train mô hình**; Qwen phải chạy nội bộ nếu muốn bỏ API cloud cho chatbot. |
| **Training from scratch** | Học toàn bộ trọng số từ đầu; không chọn để xây LLM/OCR lớn trong phạm vi đồ án. |

## 2. Sơ đồ kiến trúc đề xuất

~~~mermaid
flowchart TB
    U["Nhân viên / Kế toán / các vai trò được quyền"] --> FE["Frontend IFMS"]
    FE --> BE["Spring Boot: xác thực, phân quyền, kiểm nghiệp vụ"]
    BE --> OCR["PaddleOCR nội bộ: đọc chứng từ"]
    OCR --> CAT["PhoBERT do nhóm fine tune: gợi ý danh mục"]
    EX["Dòng yêu cầu chi trong Excel"] --> CAT
    LABEL["Khoản chi đã được xác nhận danh mục"] --> TRAIN["Train và đánh giá offline"]
    TRAIN --> CAT
    BE --> RAG["RAG: tìm tài liệu IFMS đã duyệt"]
    DOC["Tài liệu có phiên bản và quyền xem"] --> RAG
    RAG --> QWEN["Qwen chạy nội bộ: trả lời có nguồn"]
    BE --> REPORT["API báo cáo có phân quyền: ví, ngân sách, sổ cái"]
    REPORT --> QWEN
    CAT --> BE
    QWEN --> BE
~~~

**Ranh giới bắt buộc:** AI chỉ đọc, gợi ý và giải thích. Spring Boot xác nhận quyền, tính tiền, kiểm Excel, duyệt yêu cầu và ghi sổ. AI không có quyền tự giải ngân, sửa ví hoặc tạo bút toán.

## 3. Kế hoạch cho từng chức năng

### A. Thay Gemini đọc chứng từ bằng OCR nội bộ

- **Chọn:** PaddleOCR hỗ trợ tiếng Việt chạy trong Python/FastAPI; code tách số tiền, ngày, nhà cung cấp, số hóa đơn từ văn bản OCR. Không chọn RAG vì RAG dùng để tra tài liệu, không đọc ảnh. Chưa fine tune OCR vì thiếu ảnh có nhãn chi tiết.
- **Dữ liệu:** ảnh/PDF nhiều loại có kết quả đúng cho từng trường; ảnh mờ và tệp không phải chứng từ; chỉ dùng ảnh có quyền sử dụng. Dữ liệu mock không dùng để đo chất lượng.
- **Thực hiện:** lập tập ảnh kiểm thử → chạy Gemini và OCR trên **cùng ảnh** → tách/chuẩn hóa trường → giữ quy tắc cảnh báo backend → cho người dùng xem ảnh gốc và sửa trường OCR → chuyển khỏi Gemini theo từng loại chứng từ khi đạt chất lượng.
- **Đánh giá:** tỷ lệ đúng **từng trường**, ưu tiên tổng tiền; số trường để trống khi không chắc, cảnh báo sai, độ trễ, CPU/RAM. **Khả thi:** làm bản demo sớm; không khẳng định thay hoàn toàn Gemini trước khi đo. [Tài liệu PaddleOCR](https://www.paddleocr.ai/main/en/version3.x/pipeline_usage/OCR.html).

### B. Nhóm huấn luyện PhoBERT để gợi ý danh mục

- **Chọn:** train một mô hình đơn giản TF–IDF + bộ phân loại làm mốc so sánh, sau đó **fine tune PhoBERT**. Mô hình chấm mức phù hợp giữa **mô tả khoản chi** và **tên/mô tả từng danh mục**; backend chỉ đưa những danh mục được phép trong giai đoạn. Cách chấm từng cặp giúp xử lý cả danh mục riêng của dự án, thay vì học thuộc ID cố định.
- **Nhãn để train:** khoản chi và **danh mục cuối cùng đã được người có trách nhiệm xác nhận** là cặp đúng; các danh mục hợp lệ khác của cùng giai đoạn là cặp sai. Không lấy gợi ý Gemini hoặc dữ liệu demo tự sinh làm “đáp án đúng”. Với quyết toán tạm ứng, danh mục kế thừa từ khoản gốc nên không cần AI chọn lại.
- **Thực hiện:** thu thập/gắn nhãn → chuẩn hóa và tách từ tiếng Việt → chia train/validation/test theo yêu cầu gốc để tránh cùng hóa đơn xuất hiện ở hai tập → train baseline → fine tune PhoBERT → so sánh → đưa model có phiên bản vào API gợi ý hiện tại. Người dùng vẫn xác nhận và có thể sửa đề xuất.
- **Đánh giá:** top-1/top-3 danh mục đúng, kết quả theo dự án/danh mục mới, tỷ lệ không gợi ý khi chưa chắc, độ trễ; so với Gemini và baseline trên cùng tập test. **Khả thi:** đây là trọng tâm đồ án nếu có đủ nhãn sạch; fine tuning cần thêm thời gian/GPU và có thể thua baseline khi dữ liệu ít. [Model card PhoBERT](https://huggingface.co/vinai/phobert-base), [hướng dẫn fine tuning](https://huggingface.co/docs/transformers/training).

### C. Chatbot RAG trả lời những câu hỏi nào?

**Câu hỏi về quy trình/tài liệu**, ví dụ: “Tạm ứng khác hoàn chi thế nào?”, “Quyết toán cần chứng từ gì?”, “Vì sao file Excel bị từ chối?”, “Bút toán kế toán khác giao dịch ví ở điểm nào?”. Chỉ dùng **tài liệu IFMS đã duyệt**, loại hoặc đánh dấu rõ tài liệu đồ án 1 đã lỗi thời.

- **Chọn:** BGE-M3 tạo embedding tài liệu → pgvector tìm đoạn được phép xem → Qwen chạy **local** diễn đạt và kèm link nguồn. Đây là RAG, **không phải phần nhóm train**. Không dùng fine tuning để “nhớ” các quy trình hay thay đổi thường xuyên.
- **Dữ liệu:** tài liệu có phiên bản, ngày hiệu lực và quyền xem; bộ câu hỏi–đáp án–nguồn đúng cho các vai trò. Không đưa chứng từ cá nhân hoặc phiếu lương vào kho tài liệu dùng chung.
- **Thực hiện:** duyệt tài liệu → chia đoạn và lập chỉ mục → đo tìm đúng đoạn → thử Qwen nội bộ trên máy nhóm → kiểm nguồn và quyền → thêm ô Trợ giúp vào các màn phù hợp.
- **Đánh giá:** tìm đúng nguồn, trả lời đúng, có dẫn nguồn, từ chối khi không có tài liệu, không lộ dữ liệu khác quyền, thời gian/RAM. **Khả thi:** tra cứu tài liệu có nguồn làm được trước; chatbot sinh câu trả lời local phụ thuộc máy và chất lượng tiếng Việt. Nếu Qwen không đạt, hiển thị đoạn nguồn và câu trả lời theo mẫu. [RAG và fine tuning là hai cách khác nhau](https://docs.aws.amazon.com/prescriptive-guidance/latest/retrieval-augmented-generation-options/rag-vs-fine-tuning.html).

**Câu hỏi về số liệu mới nhất**, ví dụ “Tôi còn phải quyết toán bao nhiêu?”, “Giai đoạn này còn bao nhiêu ngân sách?”, “Khoản chi này đã chuyển ví và ghi sổ chưa?” **không lấy số từ RAG**. Qwen chỉ chọn một hàm báo cáo được phép; Spring Boot kiểm quyền và tính số, trả kỳ và link bản ghi nguồn; Qwen diễn đạt. Không cho AI viết SQL tự do. Nghiệm thu bằng cách so số tiền **khớp tuyệt đối** màn báo cáo/API cùng bộ lọc và thử câu hỏi vượt quyền.

### D. Excel dùng AI ở đâu?

- **Hiện tại:** backend kiểm cột, kiểu dữ liệu và các quy tắc nhập/xuất; chưa có mô hình AI.
- **Đề xuất:** khi xem trước file **yêu cầu chi**, chạy **cùng PhoBERT ở mục B** để gợi ý danh mục cho từng dòng có mô tả. Chatbot ở mục C giải thích mã lỗi hoặc cách điền mẫu bằng tài liệu có nguồn.
- **Không dùng AI để thay quy tắc:** cột bắt buộc, quyền nhập, số tiền, ID, chứng từ và điều kiện xác nhận vẫn do backend kiểm. Chưa có lý do train model riêng cho bảng lương, nhân sự hoặc sao kê.
- **Đánh giá:** tỷ lệ dòng được gợi ý đúng, dòng bị người dùng sửa, thời gian xem trước file; khi AI tắt, nhập Excel vẫn chạy theo schema hiện có.

## 4. Bảng trước và sau nâng cấp

| Chức năng | Trước | Sau — mục tiêu, chưa triển khai |
|---|---|---|
| Đọc chứng từ | Gemini API | PaddleOCR nội bộ + người xác nhận |
| Gợi ý danh mục | Gemini API | PhoBERT do nhóm fine tune; so với baseline |
| Tự điền và cảnh báo | Code dùng trường Gemini đọc | Giữ code, dùng trường OCR và hiện rõ nguồn |
| Hỏi đáp quy trình | Chưa có | RAG tài liệu IFMS + Qwen nội bộ, có dẫn nguồn |
| Hỏi đáp số liệu | Chưa có | API báo cáo IFMS kiểm quyền; AI chỉ diễn đạt |
| Excel | Kiểm schema bằng code | Giữ schema; thêm gợi ý danh mục ở preview phù hợp |

## 5. Lộ trình ưu tiên

| Thứ tự | Việc cần làm | Có thể làm ngay? |
|---|---|---|
| **1** | Lập bộ chứng từ và khoản chi **có nhãn đúng**, đo chất lượng Gemini hiện tại | Có, nếu được phép dùng dữ liệu và có người xác nhận |
| **2** | Train baseline rồi fine tune PhoBERT; tích hợp vào form và preview Excel | Sau khi đủ nhãn sạch |
| **3** | Thử PaddleOCR, so trên cùng bộ ảnh rồi thay dần lời gọi Gemini | Có thể bắt đầu thử ngay |
| **4** | Chatbot tra tài liệu có nguồn; thêm vài hàm hỏi tạm ứng/ngân sách/sổ cái | Sau khi chốt tài liệu và quyền |
| **5** | Qwen local + BGE-M3/pgvector cho hỏi đáp tự nhiên | Sau khi đo RAM, tốc độ và chất lượng trên máy nhóm |
| **6** | Dự báo dòng tiền bằng ML | Chỉ khi có lịch sử thực đủ dài; dữ liệu demo không đủ để kết luận |

**Phương án tối ưu cho đồ án:** ưu tiên **PhoBERT có dữ liệu gắn nhãn, mã train và kết quả so sánh**; thêm OCR nội bộ để giảm phụ thuộc Gemini; chatbot RAG làm bản có nguồn và phạm vi câu hỏi rõ. Không cần tự train LLM lớn. Chi phí API có thể giảm, nhưng máy chủ local vẫn tốn RAM/CPU/GPU và công vận hành; chưa ghi mức tiết kiệm khi chưa đo.

## Kết luận

Giá trị kỹ thuật chính của kế hoạch là chuyển từ “gửi yêu cầu cho Gemini và nhận kết quả” sang **một mô hình phân loại được nhóm fine tune và đánh giá**, kết hợp OCR và hỏi đáp có nguồn. Giá trị ứng dụng là giảm nhập liệu chứng từ, gợi ý danh mục trên form/Excel và tra cứu quy trình dễ hơn. Mọi con số tài chính và quyết định chuyển tiền vẫn đi qua backend và quyền IFMS. Báo cáo nghiệm thu phải tách rõ phần **đã chạy**, phần **đã train/đo** và phần **mới là thiết kế**.

## Nguồn kiểm chứng

- Backend: IFMS/src/main/java/com/mkwang/backend/modules/ai/; IFMS/src/main/resources/application.yml; migration V21 tạo document_extractions.
- Frontend: financial-wallet-frontend/lib/api/ai.ts; app/(dashboard)/requests/new/page.tsx.
- Tài liệu dự án: IFMS/docs/project_2/task-2-ai-receipt-scan.md và da2-improvement-request.md.
- Tài liệu công nghệ: [PaddleOCR](https://www.paddleocr.ai/main/en/version3.x/pipeline_usage/OCR.html), [PhoBERT](https://huggingface.co/vinai/phobert-base), [fine tuning](https://huggingface.co/docs/transformers/training), [RAG so với fine tuning](https://docs.aws.amazon.com/prescriptive-guidance/latest/retrieval-augmented-generation-options/rag-vs-fine-tuning.html), [pgvector](https://github.com/pgvector/pgvector), [Qwen](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507).
