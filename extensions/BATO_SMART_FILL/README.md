# ⚡ BATO_SMART_FILL

Tiện ích mở rộng trình duyệt (**Chrome / Microsoft Edge / Cốc Cốc / Brave** — chuẩn **Manifest V3**) giúp **tự động hóa nhập liệu thông minh theo ngữ cảnh** trên mọi phần mềm và cổng thông tin nền Web (**Y tế, Hành chính công, Giáo dục, Kế toán - Kho bạc, Thương mại - Kho vận, Nhân sự, Ngân hàng - CRM...**).

- **Tác giả:** Vien Pham — IT Bệnh viện ĐKKV Ba Tơ ([Facebook](https://www.facebook.com/phamminhvien))

> ⚠️ **Khuyến cáo:** Công cụ thực hiện điền/chọn dữ liệu tự động trên giao diện trình duyệt theo kịch bản do người dùng cấu hình. Các thao tác tự động hoặc Script/Plugin tùy chỉnh có thể kích hoạt sự kiện ngầm ảnh hưởng đến nghiệp vụ trên hệ thống đích — người dùng và cán bộ IT cần kiểm thử kỹ (bằng nút **`🔍 Kiểm tra`** và môi trường thử nghiệm) trước khi áp dụng chính thức.

---

## 🎯 Bài toán chung & Các nhóm tình huống ứng dụng thực tế

Trong thực tế vận hành tại cơ quan, đơn vị sự nghiệp, trường học và doanh nghiệp, phần lớn phần mềm Web nghiệp vụ là **hệ thống đóng của nhà cung cấp hoặc cổng dùng chung toàn quốc** — **IT cơ sở không thể sửa mã nguồn**, trong khi người dùng cuối mỗi ngày phải lặp đi lặp lại hàng trăm thao tác chọn/nhập rập khuôn, dễ bỏ sót hoặc nhầm lẫn.

**BATO_SMART_FILL** đóng vai trò một **"Trợ lý tự động hóa ngay trên trình duyệt"**, áp dụng linh hoạt cho nhiều lĩnh vực:

### 1. 🏥 Nhóm Y tế (Bệnh viện, Trung tâm Y tế, Phòng khám, Trạm Y tế)
*Áp dụng trên: VNPT HIS, Viettel HIS, FPT eHospital, Medisoft, LIS/PACS, Cổng giám định BHYT, Hồ sơ sức khỏe điện tử...*
- **Tiếp đón & Hành chính bệnh nhân**: Nhập *Năm sinh / Ngày sinh* ➔ Tiện ích tự **chờ API tính Tuổi của HIS chạy xong** rồi mới điền *Quốc tịch = Việt Nam* (nếu trống), chọn *Đối tượng* (`Trẻ em < 6 tuổi`, `BHYT`, `Người cao tuổi`), đổi *Nghề nghiệp* theo độ tuổi (nhưng **tự giữ nguyên** nghề đặc thù như *Công an, Quân đội*) và tự gõ tìm *Phòng khám Nhi / Lão khoa* trên ô Select2 AJAX.
- **Khám bệnh, Sinh hiệu & Mã bệnh ICD-10**: Nhập *Nhiệt độ, Mạch, Huyết áp* ➔ Tự điền nhận xét vào *Ghi chú khám* (không đụng nhầm ô *Ghi chú* của tab Hành chính) và tick *Cảnh báo sốt cao / Tăng huyết áp*; chọn gợi ý lâm sàng ➔ Tự mở Select2 AJAX tìm mã *ICD-10*.
- **Bảng kê đơn thuốc & Vật tư nhiều dòng động (`row:`)**: Đổi *Đường dùng* (`Uống` / `Tiêm` / `Bôi`) hoặc sửa *Sáng - Tối - Số ngày* ở dòng thuốc nào ➔ Tự điền *Cách dùng chuẩn* và tính *Tổng số lượng* cho riêng dòng đó.
- **Popup phiếu chuyên môn (`Modal` / `Iframe` / `window.open`)**: Vừa bấm mở *Phiếu chuyển tuyến, Chỉ định Cận lâm sàng, Giấy ra viện, Giấy chứng sinh* ➔ Tự điền sẵn *Tuyến chuyển, Phương tiện vận chuyển, Phòng thực hiện, Số ngày nghỉ BHXH, Lời dặn bác sĩ*.

### 2. 🏛️ Nhóm Hành chính công & Cơ quan Nhà nước (UBND, Sở/Ban/Ngành, Một cửa)
*Áp dụng trên: Cổng Dịch vụ công Quốc gia/Tỉnh, Phần mềm Một cửa điện tử (iGate), Phần mềm Hộ tịch, Quản lý văn bản (iOffice, Egov)...*
- **Tiếp nhận hồ sơ Một cửa & Tư pháp - Hộ tịch**: Chọn *Thủ tục hành chính* (Khai sinh, Kết hôn, Chứng thực, Đất đai...) ➔ Tự động điền *Số ngày giải quyết*, *Mức lệ phí quy định*, *Phòng chuyên môn thụ lý* và *Ghi chú thành phần hồ sơ*.
- **Điền sẵn địa giới hành chính mặc định tại địa phương**: Ngay khi mở biểu mẫu hoặc Popup nhập công dân ➔ Tự động chọn sẵn *Quốc tịch = Việt Nam*, *Dân tộc phổ biến tại địa bàn*, *Tỉnh/Thành phố*, *Xã/Phường* để cán bộ không phải chọn lại từ đầu cho từng hồ sơ.
- **Quản lý văn bản & Điều hành (eOffice)**: Chọn *Loại văn bản* (`Công văn`, `Quyết định`, `Tờ trình`, `Báo cáo`) hoặc *Độ khẩn* ➔ Tự điền *Ký hiệu văn bản chuẩn của đơn vị*, *Hạn xử lý*, *Nơi nhận lưu* và chọn sẵn *Lãnh đạo ký duyệt*.

### 3. 🎓 Nhóm Giáo dục & Đào tạo (Trường học phổ thông, Đại học, Trung tâm đào tạo)
*Áp dụng trên: vnEdu, Viettel SMAS, Cơ sở dữ liệu ngành CSDL Bộ GD&ĐT, Cổng quản lý đào tạo tín chỉ / LMS...*
- **Nhập điểm & Nhận xét học bạ theo từng dòng học sinh (`row:`)**: Trên bảng điểm danh sách lớp nhiều dòng, giáo viên nhập *Điểm đánh giá / Mức đạt* ở dòng học sinh nào ➔ Tự động quy đổi *Xếp loại* và điền *Nhận xét chuẩn theo Thông tư Bộ GD&ĐT* tương ứng ngay tại dòng đó (vẫn giữ nguyên nếu giáo viên đã viết nhận xét riêng).
- **Tuyển sinh đầu cấp & Hồ sơ học sinh - sinh viên**: Chọn *Thôn/Bản/Tổ dân phố* hoặc *Diện chính sách* ➔ Tự động xác định *Khu vực ưu tiên (`KV1`, `KV2-NT`, `KV2`, `KV3`)*, *Đối tượng miễn giảm học phí* và *Tuyến tuyển sinh*.
- **Popup xét thi đua, khen thưởng & tốt nghiệp**: Mở hộp thoại xét duyệt ➔ Tự điền sẵn *Năm học - Học kỳ hiện hành*, *Căn cứ quyết định* và *Danh hiệu tương ứng*.

### 4. 💰 Nhóm Kế toán, Tài chính, Kho bạc & Thuế
*Áp dụng trên: MISA AMIS, Fast Accounting, Bravo, Dịch vụ công Kho bạc Nhà nước (DVC KBNN), Hóa đơn điện tử, Thuế điện tử...*
- **Định khoản chứng từ & Bảng hạch toán nhiều dòng (`row:`)**: Chọn *Loại nghiệp vụ thu/chi* ở từng dòng hạch toán ➔ Tự động điền cặp *Tài khoản Nợ / Tài khoản Có*, *Mã chương - Tiểu mục ngân sách (MLNS)*, *Nguồn kinh phí* và *Thuế suất GTGT (`0%`, `5%`, `8%`, `10%`)*.
- **Xuất hóa đơn điện tử & Giao dịch Kho bạc**: Mở Popup lập chứng từ thanh toán hoặc hóa đơn ➔ Tự điền sẵn *Hình thức thanh toán mặc định (`Chuyển khoản`)*, *Đơn vị tính* và *Nội dung diễn giải chuẩn theo quy định Kho bạc*.

### 5. 🛒 Nhóm Bán hàng, Thương mại điện tử, Kho vận & Logistics
*Áp dụng trên: Sapo, KiotViet, Haravan, Odoo/ERP, Cổng lên đơn ViettelPost / GHTK / GHN / J&T, Cổng Hải quan...*
- **Tạo vận đơn & Xử lý đơn hàng nhanh**: Chọn *Nhóm sản phẩm* (`Hàng dễ vỡ`, `Thực phẩm lạnh`, `Điện tử giá trị cao`, `Thời trang`) ➔ Tự chọn *Dịch vụ vận chuyển*, *Tùy chọn xem hàng* (`"Cho xem hàng, không cho thử"`), bật checkbox *Khai giá / Bảo hiểm* và điền sẵn *Khối lượng - Kích thước đóng gói tiêu chuẩn*.
- **Phiếu nhập / xuất / kiểm kê kho nhiều dòng (`row:`)**: Chọn *Lý do xuất / Kho nhận* hoặc nhập *Số thùng* ở dòng hàng hóa nào ➔ Tự quy đổi ra *Tổng số lượng đơn vị lẻ* và điền *Vị trí kệ kho*.

### 6. 👥 Nhóm Nhân sự, Tiền lương & Bảo hiểm xã hội (HRM)
*Áp dụng trên: Phần mềm HRM (Base, 1Office, MISAHRM...), Cổng kê khai BHXH điện tử (EFY, iVAN, VssID Web)...*
- **Tiếp nhận nhân sự mới & Hợp đồng lao động**: Chọn *Chức danh / Ngạch bậc* ➔ Tự động điền *Phòng ban*, *Thời gian thử việc*, *Mức phụ cấp ăn ca/điện thoại*, *Vùng lương tối thiểu* và *Bệnh viện đăng ký KCB BHYT ban đầu thường dùng*.
- **Kê khai tăng/giảm lao động & Giải quyết chế độ BHXH**: Chọn *Phương án kê khai* (Tăng mới, Nghỉ thai sản, Nghỉ ốm, Thôi việc) ➔ Tự điền *Tỷ lệ đóng*, *Căn cứ hồ sơ kèm theo* và *Ghi chú nghiệp vụ*.

### 7. 🏦 Nhóm Ngân hàng, Bảo hiểm, Tín dụng & Chăm sóc khách hàng (CRM / Call Center)
*Áp dụng trên: Core Banking/LOS nền Web, Phần mềm đại lý Bảo hiểm, Salesforce, Zoho CRM, Zendesk, Tổng đài CSKH...*
- **Tổng đài CSKH & Xử lý phiếu phản ánh (Ticket)**: Điện thoại viên chọn *Nhóm vấn đề khách hàng gặp phải* ➔ Tự động gán *Mức độ ưu tiên (SLA)*, *Phòng ban xử lý tuyến 2* và điền sẵn *Mẫu khung ghi chú cuộc gọi (Template)* vào ô nội dung để điền nhanh thông tin chính.
- **Thẩm định hồ sơ tín dụng / Hợp đồng bảo hiểm**: Nhập *Độ tuổi, Nghề nghiệp, Thu nhập* ➔ Tự động phân loại *Nhóm khách hàng*, *Gói sản phẩm/hạn mức đề xuất* và các mục kiểm tra hồ sơ bắt buộc.

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
  1. **`💬 Modal HTML` (`dom_modal`)**: Hộp thoại nổi trên cùng trang (`[role="dialog"]`, `<dialog>`, Bootstrap, AntD, Element UI, jQuery UI, DevExpress, Kendo, hoặc `div` có `position: fixed/absolute` + `z-index` cao) — tự khóa chặt phạm vi thực thi bên trong Modal, kèm chế độ **`🚀 Ngay khi Popup vừa mở lên` (`on_open`)**.
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
- **Phòng Kiểm Thử Tích Hợp Sẵn 100% Offline (`🧪 Demo`)**: Bấm nút **`🧪 Demo`** ngay trên thanh tiêu đề tiện ích để mở trang kiểm thử tích hợp sẵn kèm **7 kịch bản mẫu** (bao phủ đủ 4 phương thức Rule, chờ API ngầm, Select2 tĩnh & AJAX, 7 trường hợp chọn Element động và đủ 3 loại Popup) mà không cần cài đặt thêm bất kỳ server nào.

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
└── demo/                         # Phòng kiểm thử tích hợp sẵn 100% Offline (Trang chính + 3 loại Popup + 7 kịch bản mẫu)
```
