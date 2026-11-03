# 🛠️ BATO_UTILITIES v2.0.0 — Trung Tâm Tiện Ích Đa Năng Nghiệp Vụ Y Tế & HIS

Tiện ích mở rộng trình duyệt (**Chrome / Microsoft Edge / Cốc Cốc / Brave** — chuẩn **Manifest V3**) được thiết kế theo kiến trúc **Bộ công cụ tổng hợp (Multi-Tool Hub)**, hỗ trợ linh hoạt cả **3 chế độ hiển thị** (`Popup` • `Side Panel` • `Tab toàn màn hình`) trên cùng một giao diện mượt mà.

- **Tác giả:** Vien Pham — IT Bệnh viện ĐKKV Ba Tơ ([Facebook](https://www.facebook.com/phamminhvien))

---

## 🌟 Trải nghiệm Trung Tâm Tiện Ích (Dashboard Hub)
- **Màn hình Tổng quan**: Hiển thị toàn bộ công cụ dưới dạng lưới Card với icon sinh động, phân loại danh mục, mô tả chi tiết và ô tìm kiếm nhanh.
- **Ghim Yêu thích (Favorite ⭐)**: Cho phép ghim các công cụ thường dùng lên đầu Dashboard.
- **Thanh điều hướng linh hoạt**: Nút `🏠 Menu Tiện Ích` trên thanh tiêu đề và thanh cuộn ngang giúp chuyển đổi giữa các tiện ích tức thì mà **không mất dữ liệu đang nhập dở**.
- **3 chế độ hiển thị**:
  1. `🪟 Popup`: Mở nhanh hộp thoại nổi khi bấm biểu tượng trên thanh công cụ.
  2. `📌 Side Panel`: Neo cố định dọc cạnh phải màn hình để vừa nhìn phần mềm HIS vừa thao tác liên tục.
  3. `🖥️ Tab lớn`: Bảng điều khiển rộng rãi với sidebar cây danh mục và tìm kiếm chuyên sâu.

---

## 🧰 Danh sách 9 Công cụ Tích hợp Sẵn

### 1. 🪪 Tạo chuỗi QR Thẻ CCCD gắn chip (`cccd_qr_generator`)
- Tạo chuỗi 7 trường chuẩn Bộ Công An khi bệnh nhân quên mang thẻ vật lý:
  `Số CCCD|Số CMND cũ|Họ và tên|Ngày sinh|Giới tính|Nơi thường trú|Ngày cấp`
- Tự động tra cứu mã Tỉnh/Thành (`001` - `096`), suy luận Giới tính & Năm sinh gốc từ 12 số định danh.
- Nút bấm nhanh ghép địa danh Xã/Huyện/Tỉnh, tính hạn cấp đổi thẻ, giải mã ngược từ chuỗi QR có sẵn.

### 2. 🏥 Tạo & Phân tích chuỗi QR Thẻ BHYT (`bhyt_qr_generator`)
- Tạo chuỗi quét QR chuẩn Bộ Y tế / BHXH Việt Nam:
  `Mã thẻ (15 số)|Họ tên|Ngày sinh|Giới tính|Địa chỉ|Mã CSKCB BĐ|Từ ngày|Đến ngày|Thời điểm 5 năm`
- Tự động phân tích 15 ký tự thẻ BHYT:
  - Mã đối tượng: `GD`, `TE`, `DN`, `HT`, `HN`, `DT`, `QN`, `CA`...
  - Mức hưởng: `1` (100% không giới hạn), `2` (100%), `3` (95%), `4` (80%), `5` (100% đặc thù).
  - Tỉnh/TP cấp thẻ (`51`: Quảng Ngãi, `01`: Hà Nội, `79`: TP.HCM...).
- Nút chọn nhanh mã CSKCB BĐ (`51008` BV Ba Tơ, `51023` TTYT Ba Tơ, `51001` BVĐK Quảng Ngãi...).

### 3. 👶 Thước Tính Tuổi & Phân loại đối tượng (`age_calculator`)
- Tính chính xác Tuổi năm, Số tháng tuổi (rất quan trọng với trẻ em < 36 tháng, < 72 tháng), Số ngày tuổi (sơ sinh ≤ 28 ngày).
- Tự động phân loại chính sách:
  - 🍼 Trẻ sơ sinh (≤ 28 ngày)
  - 🧒 Trẻ dưới 36 tháng
  - 🚸 Trẻ em dưới 6 tuổi: Cảnh báo chính xác **Ngày hết hạn thẻ BHYT TE (đủ 72 tháng)**
  - 🌟 Người cao tuổi từ đủ 80 tuổi (ưu tiên KCB).

### 4. 🩺 Thước Tính Y Khoa Lâm Sàng (`clinical_calculators`)
- **BMI & Diện tích bề mặt cơ thể (BSA)**:
  - Tính BMI theo chuẩn Châu Á (WPRO / Bộ Y tế): Gầy, Bình thường, Thừa cân, Béo phì I, II.
  - Tính diện tích da BSA theo công thức Mosteller và DuBois (dùng tính liều hóa trị/kháng sinh).
  - Tính Cân nặng lý tưởng (IBW - Devine).
- **Độ thanh thải Creatinine (CrCl Cockcroft-Gault & KDIGO)**:
  - Tính CrCl (ml/phút) kèm quy đổi tự động `µmol/L` ⇋ `mg/dL`.
  - Phân độ suy thận KDIGO (G1 đến G5) và khuyến cáo chỉnh liều kháng sinh của Dược lâm sàng.
- **Tốc độ truyền dịch (IV Flow Rate)**:
  - Tính số giọt/phút (gtt/min) và ml/giờ theo dây truyền dịch chuẩn (20 gtt/ml), truyền máu (15 gtt/ml) hoặc dây vi hạt nhi khoa (60 gtt/ml).

### 5. 🧪 Chuyển Đổi Đơn Vị Xét Nghiệm (`unit_converter`)
- Chuyển đổi 2 chiều đơn vị SI (`mmol/L`, `µmol/L`) sang đơn vị thông dụng (`mg/dL`):
  - Glucose máu (kèm đánh giá hạ đường huyết, bình thường, tiền ĐTĐ, ĐTĐ).
  - Creatinine máu.
  - Bộ mỡ Lipid máu (Cholesterol toàn phần, Triglyceride, HDL, LDL).
  - Acid Uric máu (Gout).
  - Bilirubin toàn phần.
  - Urea máu ⇋ BUN (Blood Urea Nitrogen).

### 6. 💰 Đọc Số Tiền Thành Chữ Viện Phí (`money_to_words`)
- Phục vụ thu ngân viện phí, kế toán viện, thủ quỹ: Nhập `1.532.000` ➔ `Một triệu năm trăm ba mươi hai nghìn đồng chẵn`.
- Chuẩn ngữ pháp tiếng Việt tài chính, tùy chọn viết HOA, thêm đuôi "chẵn" hoặc "./.". Hỗ trợ tiền tệ VND, USD, EUR.

### 7. ✍️ Chuẩn Hóa & Xử Lý Văn Bản Y Tế (`text_cleaner`)
- Sửa lỗi mã font cũ: Chuyển bảng mã **TCVN3 (ABC/.VnTime)** sang **Unicode chuẩn** (rất tiện khi sao chép từ máy cận lâm sàng/xét nghiệm cũ vào HIS).
- Chuẩn hóa Họ và Tên (xóa khoảng trắng thừa, viết hoa chữ cái đầu).
- Bỏ dấu tiếng Việt (chuẩn ASCII không dấu cho file XML BHYT theo QĐ 130).

### 8. 📋 Mẫu Mô Tả Khám Bệnh & Cận Lâm Sàng (`quick-templates`)
- Kho mẫu mô tả bình thường 1 chạm sao chép vào HIS: Khám nội khoa toàn thân, Siêu âm bụng tổng quát, X-quang tim phổi, ECG nhịp xoang, Nội soi TMH, Khám nhi...
- Hỗ trợ bác sĩ tự tạo, chỉnh sửa và lưu mẫu riêng của khoa phòng mình (lưu trữ cục bộ).

### 9. 🏷️ Tạo Mã Vạch Code 128 & QR Code Chuẩn (`barcode_generator`)
- Hoạt động 100% offline không cần Internet.
- Sinh mã vạch Code 128 chuẩn công nghiệp cho: Mã bệnh nhân, Số vào viện, Mã bệnh án, Mã đơn thuốc.
- Hỗ trợ in trực tiếp nhãn mã vạch hoặc đưa máy quét barcode cầm tay vào màn hình test tín hiệu "Bíp".

---

## 🚀 Hướng Dẫn Cài Đặt (Load Unpacked)

1. Mở trình duyệt **Chrome** (`chrome://extensions/`) hoặc **Microsoft Edge** (`edge://extensions/`).
2. Bật công tắc **Developer mode** *(Chế độ dành cho nhà phát triển)*.
3. Bấm **Load unpacked** *(Tải tiện ích đã giải nén)* và chọn thư mục:
   ```text
   D:\Development\bato_his\src\toolkit\extensions\BATO_UTILITIES
   ```
4. Ghim biểu tượng **BATO_UTILITIES** lên thanh công cụ trình duyệt để sử dụng.
