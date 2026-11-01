# ⚡ BATO_SMART_FILL

Tiện ích mở rộng trình duyệt (Chrome / Microsoft Edge / Cốc Cốc / Brave — Manifest V3) giúp bắt sự kiện thay đổi từ một phần tử trên trang web theo **Kịch bản** và thực thi **Danh sách Rule** tự động điền/chọn dữ liệu tương ứng.

- **Author:** Vien Pham - IT Bệnh viện ĐKKV Ba Tơ — [Facebook](https://www.facebook.com/phamminhvien)

> ⚠️ **Khuyến cáo:** Công cụ chỉ thực hiện tự động nhập liệu thông minh theo cấu hình. Thao tác tự động hoặc Script/Plugin tùy chỉnh có thể kích hoạt các sự kiện ngầm làm thay đổi nghiệp vụ không mong muốn trên hệ thống đích — người dùng và IT cần kiểm thử kỹ trước khi áp dụng chính thức.

---

## 🚀 Hướng dẫn cài đặt (Load Unpacked)

1. Mở trình duyệt **Chrome** (`chrome://extensions/`) hoặc **Microsoft Edge** (`edge://extensions/`).
2. Bật chế độ **Developer mode** *(Chế độ dành cho nhà phát triển)*.
3. Nhấn **Load unpacked** *(Tải tiện ích đã giải nén)* và chọn thư mục:
   ```text
   d:\Development\bato_his\src\toolkit\extensions\BATO_SMART_FILL
   ```
4. Bấm vào biểu tượng **BATO_SMART_FILL** trên thanh công cụ $\rightarrow$ Bảng điều khiển sẽ mở dọc hết toàn bộ màn hình bên phải (Side Panel).

---

## 📋 Cấu trúc phân cấp & 4 Phương thức theo từng Rule

- **Danh sách Kịch bản (Cấp ngoài)**:
  - Quản lý URL Web cần thực thi và Element chính bắt sự kiện (`Trigger`).
  - Hỗ trợ tùy chọn **`⏳ Tự động chờ Event / API ngầm & DOM của Web hoàn tất`** (mặc định bật): Giám sát tiến trình mạng (`window.fetch` / `XMLHttpRequest`) phát sinh từ sự kiện và theo dõi `MutationObserver` trên DOM để chỉ thực thi nhập dữ liệu **sau khi** toàn bộ sự kiện riêng của trang web đã chạy xong.
- **Danh sách Rule (Cấp trong — Hiển thị dạng Table)**:
  Click vào từng dòng (`row`) trong bảng (hoặc nhấn `＋ Thêm Rule`) để mở **Popup tùy chỉnh** riêng cho phần tử đó. Mỗi phần tử chọn độc lập **1 trong 4 phương thức** qua Dropdown:

1. **`1. 📌 Tự động theo giá trị cố định được cài đặt` (`fixed`)**:
   Điền văn bản, chọn dropdown, hoặc tick checkbox theo giá trị cố định.
2. **`2. 🔀 Tự động theo bảng điều kiện` (`mapping`)**:
   Mỗi dòng điều kiện cho phép tùy chỉnh **Element đối chiếu** bất kỳ trên trang (hoặc để trống để đối chiếu Element chính) và chọn hành động **Điền giá trị** hoặc **Giữ nguyên**.
3. **`3. ⚡ Tự động theo Rule dựa vào Script cài đặt` (`script`)**:
   Viết hàm JavaScript tùy chỉnh trực tiếp trong Popup và chạy qua môi trường Sandbox cô lập.
4. **`4. 🧩 Tự động theo Plugin JavaScript` (`plugin` — Dành cho IT chuyên sâu)**:
   Khai báo hàm xử lý nâng cao trong file dùng chung [`plugins/custom-plugins.js`](./plugins/custom-plugins.js) bằng `registerBatoPlugin(...)` để can thiệp trực tiếp DOM phức tạp hoặc xử lý bất đồng bộ `async/await`.
