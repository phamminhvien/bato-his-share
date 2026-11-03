# 🛠️ BATO_UTILITIES — Bộ Tiện Ích Tổng Hợp Đa Chế Độ

Tiện ích mở rộng trình duyệt (**Chrome / Microsoft Edge / Cốc Cốc / Brave** — chuẩn **Manifest V3**) được thiết kế theo kiến trúc **Bộ công cụ tổng hợp (Multi-Tool Hub)**, hỗ trợ linh hoạt cả **3 chế độ hiển thị** (`Popup` • `Side Panel` • `Tab toàn màn hình`) trên cùng một giao diện.

- **Tác giả:** Vien Pham — IT Bệnh viện ĐKKV Ba Tơ ([Facebook](https://www.facebook.com/phamminhvien))

---

## 🖥️ Đa chế độ hiển thị (Popup ➔ Side Panel ➔ Tab lớn)

1. **`🪟 Chế độ Popup`**: Bấm vào icon tiện ích trên thanh công cụ để mở nhanh hộp thoại nổi, tạo và sao chép dữ liệu tức thì trong vài giây.
2. **`📌 Chế độ Side Panel`**: Neo cố định dọc bên phải màn hình trình duyệt để vừa nhìn phần mềm nghiệp vụ (HIS, Hành chính công...) ở bên trái vừa thao tác liên tục mà không bị tự đóng.
3. **`🖥️ Chế độ Tab lớn (New Tab)`**: Giao diện bảng điều khiển 2 cột rộng rãi kèm thanh tìm kiếm danh mục công cụ bên trái và vùng nhập liệu — kết quả song song bên phải.
- **Chuyển đổi tức thì & Nhớ chế độ mặc định**: Có thể bấm chuyển qua lại giữa `Popup`, `Side Panel`, `Tab` ngay trên thanh tiêu đề mà **không mất dữ liệu đang gõ dở**, đồng thời chọn sẵn **Chế độ mở mặc định** khi click biểu tượng tiện ích.

---

## 🧰 Danh sách công cụ hiện có

### 1. 🪪 Tạo chuỗi ký tự QR thẻ CCCD gắn chip (`cccd_qr_generator`)
Phục vụ trường hợp **bệnh nhân / công dân quên mang thẻ CCCD vật lý** nhưng nhớ số định danh cá nhân và các thông tin cơ bản, giúp cán bộ tiếp đón tạo ra chuỗi ký tự giống hệt kết quả bắn từ súng quét QR chuẩn Bộ Công An (7 trường phân tách bằng dấu `|`):

```text
Số CCCD (12 số)|Số CMND cũ (9 số)|Họ và tên|Ngày sinh (ddMMyyyy)|Giới tính|Nơi thường trú|Ngày cấp (ddMMyyyy)
```

**Các tính năng thông minh hỗ trợ thực tế:**
- **Tự động giải mã & Kiểm tra chéo từ 12 số CCCD**:
  - Tra cứu tự động **63 mã Tỉnh/Thành phố đăng ký khai sinh (`001` – `096`)** từ 3 chữ số đầu.
  - Tự động suy luận **Giới tính (`Nam` / `Nữ`)** và **Năm sinh gốc** từ chữ số thứ 4–6; cảnh báo ngay nếu người dân đọc nhầm số CCCD làm lệch năm sinh hoặc giới tính.
- **Xử lý linh hoạt các thông tin hay quên**:
  - *CMND 9 số cũ*: Cho phép để trống (tự giữ đúng cặp dấu `||` chuẩn 7 trường).
  - *Ngày sinh*: Cho phép gõ liền `15081994`, `15/08/1994` hoặc chỉ gõ năm `1994` (tùy chọn tự ghép `0101yyyy`, kèm nút điền nhanh `01/01/YYYY` từ mã số CCCD).
  - *Ngày cấp thẻ*: Gợi ý 1 chạm đợt cấp thẻ chip (`10/05/2021`), tự tính theo mốc tuổi cấp đổi (`14 / 25 / 40 / 60 tuổi`) hoặc để trống.
  - *Nơi thường trú*: Tích hợp các **nút bấm ghép nhanh Xã/Huyện/Tỉnh thường gặp** (cho phép tự lưu thêm hoặc xóa mẫu địa danh của đơn vị).
- **Sao chép nhanh & Kiểm tra ngược**:
  - Nút **`📋 Sao chép chuỗi QR`** (`Ctrl + Enter`), **`📋 Copy & Nhập mới`** (`Alt + N` làm mới), tùy chọn kèm phím `Enter` cuối chuỗi.
  - Hỗ trợ **dán chuỗi QR có sẵn để bóc tách ngược lên 7 ô** chỉnh sửa lại và lưu **Lịch sử 15 mục gần nhất**.

---

## 🧩 Hướng dẫn mở rộng thêm Công cụ mới (Plug-and-Play)

Kiến trúc của `BATO_UTILITIES` cho phép cắm thêm bất kỳ công cụ mới nào chỉ với **2 bước**:
1. Tạo file `tools/<ten-cong-cu>.js` và đăng ký qua `window.registerBatoUtilityTool({ id, name, shortName, icon, category, description, mount(container, ctx) { ... } })`.
2. Khai báo thẻ `<script src="../tools/<ten-cong-cu>.js"></script>` trong [`app/index.html`](./app/index.html) — thanh điều hướng ngang (Popup/Panel) và cây danh mục tìm kiếm (Tab lớn) sẽ tự động nhận diện.

---

## 🚀 Hướng dẫn cài đặt (Load Unpacked)

1. Mở trình duyệt **Chrome** (`chrome://extensions/`) hoặc **Microsoft Edge** (`edge://extensions/`).
2. Bật **Developer mode** *(Chế độ dành cho nhà phát triển)*.
3. Nhấn **Load unpacked** *(Tải tiện ích đã giải nén)* và chọn thư mục:
   ```text
   .../src/toolkit/extensions/BATO_UTILITIES
   ```
4. Ghim biểu tượng **BATO_UTILITIES** lên thanh công cụ trình duyệt để sử dụng ở bất kỳ chế độ nào (`Popup` / `Side Panel` / `Tab`).
