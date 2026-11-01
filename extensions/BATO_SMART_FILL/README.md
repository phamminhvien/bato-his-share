# ⚡ BATO_SMART_FILL

Tiện ích mở rộng trình duyệt (**Chrome / Microsoft Edge / Cốc Cốc / Brave** — chuẩn **Manifest V3**) giúp **tự động hóa nhập liệu thông minh theo ngữ cảnh** trên mọi phần mềm nền Web (đặc biệt tối ưu cho **HIS Bệnh viện, Cổng BHYT/BHXH, Dịch vụ công, ERP, CRM**).

- **Tác giả:** Vien Pham — IT Bệnh viện ĐKKV Ba Tơ ([Facebook](https://www.facebook.com/phamminhvien))

> ⚠️ **Khuyến cáo:** Công cụ thực hiện điền/chọn dữ liệu tự động trên giao diện trình duyệt theo kịch bản do người dùng cấu hình. Các thao tác tự động hoặc Script/Plugin tùy chỉnh có thể kích hoạt sự kiện ngầm ảnh hưởng đến nghiệp vụ trên hệ thống đích — người dùng và cán bộ IT cần kiểm thử kỹ (bằng nút **`🔍 Kiểm tra`** và môi trường thử nghiệm) trước khi áp dụng chính thức.

---

## 🎯 Bài toán thực tế & Công dụng trong công việc hằng ngày

Trong thực tế vận hành tại bệnh viện, cơ quan và doanh nghiệp, phần lớn phần mềm Web nghiệp vụ (như **VNPT HIS, Viettel HIS, FPT eHospital, Medisoft, Cổng giám định BHYT, phần mềm Kế toán/Nhân sự...**) là hệ thống đóng của nhà cung cấp — **IT đơn vị không thể can thiệp sửa mã nguồn**, trong khi người dùng cuối mỗi ngày phải lặp đi lặp lại hàng trăm thao tác chọn/nhập rập khuôn, dễ bỏ sót hoặc nhầm lẫn.

**BATO_SMART_FILL** đóng vai trò một lớp **"Trợ lý tự động hóa ngay trên trình duyệt"** giải quyết trực tiếp các tình huống thực tế:

1. **🏥 Tiếp đón & Hành chính bệnh nhân (Đồng bộ chờ API tính tuổi của Web)**
   - Khi gõ *Năm sinh / Ngày sinh*, phần mềm HIS thường mất vài trăm ms gọi API ngầm để tính ra ô *Tuổi*.
   - Tiện ích tự động **chờ API và DOM của HIS chạy xong** rồi mới dựa vào *Tuổi* vừa tính để: điền sẵn *Quốc tịch = Việt Nam* (nếu đang trống), chọn đúng *Đối tượng* (`Trẻ em < 6 tuổi`, `BHYT`, `Người cao tuổi`), đổi *Nghề nghiệp* phù hợp độ tuổi (nhưng **tự giữ nguyên** nếu đang là nghề đặc thù như *Công an, Quân đội*), đồng thời tự mở ô Select2 AJAX gõ tìm *Phòng khám Nhi / Lão khoa*.

2. **🩺 Khám bệnh, Sinh hiệu & Ràng buộc cảnh báo lâm sàng**
   - Khi điều dưỡng/bác sĩ nhập *Nhiệt độ, Mạch, Huyết áp*: tự động điền gợi ý theo dõi vào ô *Ghi chú khám*, tự động bật checkbox *Cảnh báo theo dõi sốt cao / Tăng huyết áp* khi chỉ số vượt ngưỡng.
   - Tự khóa chặt đúng khu vực đang nhập, không bao giờ ghi đè nhầm sang các ô trùng tên (`name="GhiChu"`) nằm ở tab/khối khác trên cùng màn hình.

3. **💊 Bảng kê đơn thuốc, Vật tư & Danh sách chi tiết nhiều dòng động (`row:`)**
   - Trên bảng kê đơn có hàng chục dòng thuốc được chèn động bằng JavaScript (không có ID riêng, cấu trúc các dòng giống hệt nhau):
   - Đổi *Đường dùng* (`Uống` / `Tiêm` / `Bôi`) hoặc sửa *Sáng - Tối - Số ngày* ở dòng nào ➔ Tự động điền *Cách dùng chuẩn* và tự tính công thức *Tổng số lượng* cho **đúng duy nhất dòng thuốc đang thao tác**.

4. **🔍 Tự động chọn các hộp tìm kiếm động Select2 / Combobox tải dữ liệu qua AJAX**
   - Nhiều ô trên Web (như *Mã bệnh ICD-10, Dịch vụ kỹ thuật, Xã/Phường, Khoa/Phòng*) ban đầu hoàn toàn rỗng, bắt buộc người dùng phải click mở, gõ từ khóa, chờ tải danh sách rồi chọn.
   - Kịch bản hỗ trợ tự động bấm mở hộp Select2, gõ từ khóa tương ứng, chờ danh sách AJAX trả về và tự chọn đúng mục cần thiết.

5. **🪟 Tự động hóa trên mọi loại Popup / Hộp thoại nghiệp vụ**
   - Các phiếu con mở ra từ màn hình chính như *Phiếu chuyển tuyến, Chỉ định Cận lâm sàng, Giấy ra viện, Phiếu hội chẩn, Cửa sổ in biểu mẫu...* thường nằm trong **Modal HTML nổi**, **khung nhúng `<iframe>`**, hoặc **cửa sổ tách rời `window.open`**.
   - Hỗ trợ cả 2 kiểu chạy thực tế:
     - **🚀 Điền sẵn ngay khoảnh khắc Popup vừa mở lên (`on_open`)**: Vừa bấm mở *Phiếu chuyển tuyến* ➔ Tự chờ API khởi tạo của Popup tải xong rồi điền sẵn *Tuyến chuyển*, *Phương tiện vận chuyển*, *Ghi chú mặc định* mà không cần gõ tay.
     - **⚡ Chạy khi thao tác bên trong Popup**: Chọn *Nhóm xét nghiệm / Kết quả điều trị* trong Popup ➔ Tự động điền *Phòng thực hiện, Chỉ dẫn chuẩn bị bệnh nhân, Số ngày nghỉ BHXH, Lời dặn bác sĩ*.

6. **🏢 Mở rộng cho mọi Web nội bộ khác (Cổng dữ liệu ngành, Hành chính công, ERP, CRM)**
   - Tự động điền thông tin đơn vị/địa giới hành chính mặc định tại địa phương, chuẩn hóa dữ liệu đầu vào theo quy định riêng của đơn vị, hoặc đồng bộ liên hoàn nhiều trường dữ liệu mà không cần chờ nhà cung cấp nâng cấp phần mềm.

---

## ✨ Các tính năng kỹ thuật nổi bật

### 1. Bộ chọn phần tử thông minh 5 tầng (`🎯 Chọn` & `🔍 Kiểm tra`)
Giải quyết triệt để bài toán các trang Web hiện đại (Angular, React, Vue, ASP.NET, ExtJS, DevExpress, Select2...) sinh phần tử bằng code JS không có ID hoặc đổi ID liên tục sau mỗi lần F5:
- **Tầng 1 — Lọc ID tĩnh & Loại bỏ ID ảo động**: Tự nhận biết và bỏ qua các ID tự sinh nhảy số khi tải lại trang (`mat-input-*`, `mui-*`, `radix-*`, `el-id-*`, `rc_select_*`, `select2-*`, UUID...).
- **Tầng 2 — Thuộc tính nghiệp vụ & Bóc vỏ UI ảo**: Ưu tiên `name`, `formcontrolname`, `ng-model`, `v-model`, `data-field`...; tự động truy ngược từ vỏ hiển thị `.select2-container` về thẻ `<select>`/`<input>` gốc bên dưới.
- **Tầng 3 — Khoanh vùng khối cha (`Scoped CSS`)**: Tự ghép tổ hợp `#vung_cha + thuộc_tính` khi trên trang có nhiều ô trùng `name` hoặc `class`.
- **Tầng 4 — Neo theo nhãn chữ hiển thị (`XPath Label Anchor`)**: Tự bám vào nhãn `<label>`/`<th>`/`<span>` đứng cạnh kèm chỉ số cục bộ `[1]`, `[2]` (bắt chính xác cả cặp 2 ô đôi sát nhau không ID như *Huyết áp Tâm thu / Tâm trương*, bất chấp JS chèn thêm dòng cảnh báo phía trên).
- **Tầng 5 — Tiền tố dòng tương đối `row:`**: Khóa phạm vi tìm kiếm và đọc giá trị (`getVal('row: ...')`) gói gọn trong đúng dòng `<tr>` đang thao tác.
- **Nút `🔍 Kiểm tra` trực quan**: Khoanh viền xanh ngọc **`✅ Khớp duy nhất (1/1)`** ngay trên trang web, hoặc cảnh báo viền cam đánh số `#1 ➔ #N` nếu selector bị trùng nhiều phần tử.

### 2. Tự động nhận diện & Thực thi trên đủ 3 loại Popup (Giữ nguyên URL trang gốc)
- Chỉ cần bấm **`🎯 Chọn`** (hoặc **`🎯 Nhận diện Popup`**) rồi click vào phần tử bên trong Popup, tiện ích tự động phát hiện và cấu hình đúng loại:
  1. **`💬 Modal HTML` (`dom_modal`)**: Hộp thoại nổi trên cùng trang (`[role="dialog"]`, `<dialog>`, Bootstrap, AntD, Element UI, jQuery UI, DevExpress, Kendo, hoặc `div` có `position: fixed/absolute` + `z-index` cao) — tự khóa chặt phạm vi thực thi bên trong Modal.
  2. **`🖼️ Khung nhúng <iframe>` (`iframe_popup`)**: Hỗ trợ cả `<iframe>` khác đường dẫn con hoặc `about:blank` / `srcdoc`, tự kế thừa URL trang mẹ.
  3. **`🪟 Cửa sổ tách rời` (`window_popup`)**: Cửa sổ con mở bằng `window.open` (`window.type === 'popup'`), cho phép rê chuột chọn phần tử xuyên từ bảng điều khiển cửa sổ chính sang cửa sổ con.

### 3. Bốn (04) Phương thức Rule độc lập cho từng phần tử đích
Trong một Kịch bản, mỗi dòng Rule trong bảng có thể chọn riêng 1 trong 4 phương thức:
1. **`📌 Giá trị cố định` (`fixed`)**: Điền văn bản, chọn dropdown theo Value/Text, tick checkbox, hoặc click nút; hỗ trợ tùy chọn *Chỉ điền khi đang trống* và *Danh sách giá trị cần giữ nguyên*.
2. **`🔀 Bảng điều kiện` (`mapping`)**: Đối chiếu giá trị từ Element chính (hoặc bất kỳ Element nào khác trên trang) với các toán tử `=`, `!=`, `contains`, `startsWith`, `>`, `>=`, `<`, `<=`, `Regex`, `Rỗng / Không rỗng`.
3. **`⚡ Script tùy chỉnh` (`script`)**: Viết hàm JavaScript `(triggerVal, { currentVal, currentText, getVal, getText, isChecked }) => ...` có sẵn mẫu khung gợi ý, nút **Chạy thử (Test)** trực tiếp và thực thi an toàn trong **Offscreen Sandbox cô lập** chuẩn Manifest V3.
4. **`🧩 Plugin JavaScript` (`plugin` — Dành cho IT)**: Khai báo hàm mở rộng dùng chung tại [`plugins/custom-plugins.js`](./plugins/custom-plugins.js) bằng `registerBatoPlugin(...)` để xử lý nghiệp vụ DOM phức tạp hoặc bất đồng bộ `async/await` (tích hợp sẵn plugin `select2_auto_select`).

### 4. Quản lý Kịch bản an toàn & Phòng Kiểm Thử Offline tích hợp sẵn
- **Xuất / Nhập file `.json` sạch gọn**: Tự động loại bỏ trường thừa theo đúng phương thức của từng Rule; chống lưu trùng và chống Import trùng cấu hình 100% (so khớp dấu vân tay cấu hình không phân biệt tên), kèm hộp thoại hỏi xử lý khi trùng tên kịch bản (*Ghi đè bản cũ* hoặc *Giữ cả hai & tự đánh số*).
- **Phòng Kiểm Thử Tích Hợp Sẵn 100% Offline (`🧪 Demo`)**: Bấm nút **`🧪 Demo`** ngay trên thanh tiêu đề tiện ích để mở trang giả lập HIS kèm **7 kịch bản mẫu** (bao phủ đủ 4 phương thức Rule, chờ API ngầm, Select2 tĩnh & AJAX, 7 trường hợp chọn Element động và đủ 3 loại Popup) mà không cần cài đặt thêm bất kỳ server nào.

---

## 🚀 Hướng dẫn cài đặt nhanh (Load Unpacked)

1. Mở trình duyệt **Chrome** (`chrome://extensions/`) hoặc **Microsoft Edge** (`edge://extensions/`).
2. Bật công tắc **Developer mode** *(Chế độ dành cho nhà phát triển)*.
3. Nhấn **Load unpacked** *(Tải tiện ích đã giải nén)* và trỏ tới thư mục chứa `manifest.json`:
   ```text
   .../src/toolkit/extensions/BATO_SMART_FILL
   ```
4. Bấm vào biểu tượng **BATO_SMART_FILL** trên thanh công cụ trình duyệt ➔ Bảng điều khiển sẽ mở dọc bên phải màn hình (**Side Panel**).
5. *(Khuyên dùng lần đầu)* Bấm nút **`🧪 Demo`** ở góc trên bên phải bảng điều khiển để trải nghiệm trực tiếp toàn bộ 7 kịch bản mẫu thực tế.

---

## 📁 Cấu trúc thư mục chính

```text
BATO_SMART_FILL/
├── manifest.json                 # Cấu hình Chrome/Edge Extension Manifest V3
├── background.js                 # Service Worker điều phối Picker đa cửa sổ, Badge & Offscreen Sandbox
├── content/
│   ├── page-network-monitor.js   # Giám sát fetch/XHR & cầu nối sự kiện jQuery/Select2 ở MAIN World
│   └── content.js                # Bộ máy bắt sự kiện, chờ API/DOM, nhận diện Popup & sinh Selector 5 tầng
├── popup/
│   ├── popup.html / .css / .js   # Giao diện điều khiển Side Panel, quản lý Kịch bản, Rule & Import/Export
├── plugins/
│   └── custom-plugins.js         # Thư viện Plugin JS mở rộng cho IT (tích hợp sẵn select2_auto_select)
├── offscreen/ & sandbox/         # Môi trường cô lập thực thi Script tùy chỉnh an toàn theo chuẩn MV3
└── demo/                         # Phòng kiểm thử HIS 100% Offline (Trang chính + Modal + Iframe + Window.open + 7 kịch bản mẫu)
```
