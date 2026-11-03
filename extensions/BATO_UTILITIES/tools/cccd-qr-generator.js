/**
 * BATO_UTILITIES — Tool #1: Tạo chuỗi ký tự QR thẻ CCCD gắn chip
 * Dành cho trường hợp công dân / bệnh nhân không mang thẻ CCCD vật lý nhưng nhớ các thông tin trên thẻ.
 *
 * Cấu trúc chuỗi chuẩn Bộ Công An (7 trường phân tách bằng dấu '|'):
 *   [0] Số CCCD (12 chữ số)
 *   [1] Số CMND 9 số cũ (để trống nếu không có / không nhớ -> giữ nguyên dấu '|')
 *   [2] Họ và tên
 *   [3] Ngày sinh (ddMMyyyy — hoặc yyyy nếu chỉ nhớ năm sinh và chọn giữ năm)
 *   [4] Giới tính (Nam / Nữ)
 *   [5] Nơi thường trú
 *   [6] Ngày cấp thẻ (ddMMyyyy — hoặc để trống nếu phần mềm đích không bắt buộc)
 */

(function () {
  // Bảng mã 63 Tỉnh/Thành phố đăng ký khai sinh theo cấu trúc 3 chữ số đầu của thẻ CCCD Bộ Công An
  const PROVINCE_CODES = {
    '001': 'Hà Nội',
    '002': 'Hà Giang',
    '004': 'Cao Bằng',
    '006': 'Bắc Kạn',
    '008': 'Tuyên Quang',
    '010': 'Lào Cai',
    '011': 'Điện Biên',
    '012': 'Lai Châu',
    '014': 'Sơn La',
    '015': 'Yên Bái',
    '017': 'Hòa Bình',
    '019': 'Thái Nguyên',
    '020': 'Lạng Sơn',
    '022': 'Quảng Ninh',
    '024': 'Bắc Giang',
    '025': 'Phú Thọ',
    '026': 'Vĩnh Phúc',
    '027': 'Bắc Ninh',
    '030': 'Hải Dương',
    '031': 'Hải Phòng',
    '033': 'Hưng Yên',
    '034': 'Thái Bình',
    '035': 'Hà Nam',
    '036': 'Nam Định',
    '037': 'Ninh Bình',
    '038': 'Thanh Hóa',
    '040': 'Nghệ An',
    '042': 'Hà Tĩnh',
    '044': 'Quảng Bình',
    '045': 'Quảng Trị',
    '046': 'Thừa Thiên Huế',
    '048': 'Đà Nẵng',
    '049': 'Quảng Nam',
    '051': 'Quảng Ngãi',
    '052': 'Bình Định',
    '054': 'Phú Yên',
    '056': 'Khánh Hòa',
    '058': 'Ninh Thuận',
    '060': 'Bình Thuận',
    '062': 'Kon Tum',
    '064': 'Gia Lai',
    '066': 'Đắk Lắk',
    '067': 'Đắk Nông',
    '068': 'Lâm Đồng',
    '070': 'Bình Phước',
    '072': 'Tây Ninh',
    '074': 'Bình Dương',
    '075': 'Đồng Nai',
    '077': 'Bà Rịa - Vũng Tàu',
    '079': 'TP. Hồ Chí Minh',
    '080': 'Long An',
    '082': 'Tiền Giang',
    '083': 'Bến Tre',
    '084': 'Trà Vinh',
    '086': 'Vĩnh Long',
    '087': 'Đồng Tháp',
    '089': 'An Giang',
    '091': 'Kiên Giang',
    '092': 'Cần Thơ',
    '093': 'Hậu Giang',
    '094': 'Sóc Trăng',
    '095': 'Bạc Liêu',
    '096': 'Cà Mau'
  };

  const DEFAULT_ADDRESS_PRESETS = [
    'Thị trấn Ba Tơ, Huyện Ba Tơ, Quảng Ngãi',
    'Xã Ba Cung, Huyện Ba Tơ, Quảng Ngãi',
    'Xã Ba Động, Huyện Ba Tơ, Quảng Ngãi',
    'Xã Ba Thành, Huyện Ba Tơ, Quảng Ngãi',
    'Xã Ba Vì, Huyện Ba Tơ, Quảng Ngãi'
  ];

  const STORAGE_KEYS = {
    DRAFT: 'cccdQrDraft',
    PREFS: 'cccdQrPrefs',
    HISTORY: 'cccdQrHistory',
    ADDR_PRESETS: 'cccdAddressPresets'
  };

  /**
   * Giải mã thông tin ẩn trong 6 chữ số đầu của mã số CCCD (Mã tỉnh + Thế kỷ/Giới tính + Năm sinh)
   */
  function decodeCccdPrefix(rawCccd) {
    const digits = String(rawCccd || '').replace(/\D/g, '');
    if (digits.length < 3) return null;

    const provCode = digits.slice(0, 3);
    const provinceName = PROVINCE_CODES[provCode] || null;

    let gender = null;
    let birthYear = null;
    let centuryValid = true;

    if (digits.length >= 6) {
      const gCode = parseInt(digits[3], 10);
      const yy = parseInt(digits.slice(4, 6), 10);
      if (gCode === 0 || gCode === 1) {
        birthYear = 1900 + yy;
        gender = gCode === 0 ? 'Nam' : 'Nữ';
      } else if (gCode === 2 || gCode === 3) {
        birthYear = 2000 + yy;
        gender = gCode === 2 ? 'Nam' : 'Nữ';
      } else if (gCode === 4 || gCode === 5) {
        birthYear = 2100 + yy;
        gender = gCode === 4 ? 'Nam' : 'Nữ';
      } else {
        centuryValid = false;
      }
    }

    return {
      digits,
      length: digits.length,
      provCode,
      provinceName,
      gender,
      birthYear,
      centuryValid
    };
  }

  function isValidCalendarDate(day, month, year) {
    if (year < 1900 || year > 2150 || month < 1 || month > 12 || day < 1 || day > 31) {
      return false;
    }
    const check = new Date(year, month - 1, day);
    return (
      check.getFullYear() === year &&
      check.getMonth() === month - 1 &&
      check.getDate() === day
    );
  }

  /**
   * Phân tích chuỗi ngày người dùng gõ linh hoạt:
   *   - "15081994" / "15/08/1994" / "15-8-1994" / "1994-08-15" -> { valid: true, qrValue: "15081994", display: "15/08/1994", year: 1994, yearOnly: false }
   *   - "1994" (chỉ nhớ năm sinh) -> { valid: true, qrValue: padYearOnly ? "01011994" : "1994", display: "1994", year: 1994, yearOnly: true }
   */
  function parseFlexibleDate(raw, padYearOnly = true) {
    const s = String(raw || '').trim();
    if (!s) {
      return { empty: true, valid: true, qrValue: '', display: '', year: null, yearOnly: false };
    }

    // Trường hợp chỉ gõ 4 chữ số năm (VD: 1994)
    if (/^\d{4}$/.test(s)) {
      const y = parseInt(s, 10);
      if (y >= 1900 && y <= 2100) {
        return {
          empty: false,
          valid: true,
          qrValue: padYearOnly ? `0101${s}` : s,
          display: s,
          year: y,
          yearOnly: true
        };
      }
      return { empty: false, valid: false, error: 'Năm không hợp lệ (1900 - 2100)' };
    }

    // Trường hợp gõ liền 8 chữ số ddMMyyyy (VD: 15081994)
    if (/^\d{8}$/.test(s)) {
      const d = parseInt(s.slice(0, 2), 10);
      const m = parseInt(s.slice(2, 4), 10);
      const y = parseInt(s.slice(4, 8), 10);
      if (isValidCalendarDate(d, m, y)) {
        const dd = String(d).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        return {
          empty: false,
          valid: true,
          qrValue: `${dd}${mm}${y}`,
          display: `${dd}/${mm}/${y}`,
          year: y,
          yearOnly: false
        };
      }
      return { empty: false, valid: false, error: 'Ngày tháng không tồn tại trên lịch (ddMMyyyy)' };
    }

    // Trường hợp có dấu phân cách '/', '-', '.'
    const parts = s.split(/[\/\-.]/).map((p) => p.trim());
    if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p))) {
      let d, m, y;
      if (parts[0].length === 4) {
        // yyyy-MM-dd
        y = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10);
        d = parseInt(parts[2], 10);
      } else {
        // dd/MM/yyyy
        d = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10);
        y = parseInt(parts[2], 10);
      }
      if (isValidCalendarDate(d, m, y)) {
        const dd = String(d).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        return {
          empty: false,
          valid: true,
          qrValue: `${dd}${mm}${y}`,
          display: `${dd}/${mm}/${y}`,
          year: y,
          yearOnly: false
        };
      }
      return { empty: false, valid: false, error: 'Ngày/tháng/năm không hợp lệ' };
    }

    return { empty: false, valid: false, error: 'Nhập theo dạng ddMMyyyy, dd/MM/yyyy hoặc yyyy' };
  }

  function toTitleCaseVietnamese(str) {
    return String(str || '')
      .replace(/\|/g, ' ')
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toLocaleUpperCase('vi-VN') + w.slice(1).toLocaleLowerCase('vi-VN'))
      .join(' ');
  }

  function formatPersonName(raw, nameCaseMode) {
    const cleaned = String(raw || '')
      .replace(/\|/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
    if (!cleaned) return '';
    if (nameCaseMode === 'upper') {
      return cleaned.toLocaleUpperCase('vi-VN');
    }
    return toTitleCaseVietnamese(cleaned);
  }

  function sanitizePipeField(raw) {
    return String(raw || '')
      .replace(/\|/g, ',')
      .replace(/[\r\n]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  /**
   * Ước tính ngày cấp CCCD gắn chip hợp lệ gần nhất theo năm sinh (mốc đủ 14, 25, 40, 60 tuổi hoặc đợt cấp đại trà 2021)
   */
  function suggestIssueDateByBirthYear(birthYear) {
    const currentYear = new Date().getFullYear();
    if (!birthYear || birthYear < 1900 || birthYear > currentYear - 14) {
      return '10/05/2021';
    }
    const age = currentYear - birthYear;
    const milestones = [60, 40, 25, 14];
    for (const ms of milestones) {
      if (age >= ms) {
        const milestoneYear = birthYear + ms;
        // Thẻ CCCD gắn chip bắt đầu cấp đại trà từ đầu năm 2021
        const issueYear = Math.max(2021, Math.min(currentYear, milestoneYear));
        return `10/05/${issueYear}`;
      }
    }
    return '10/05/2021';
  }

  window.registerBatoUtilityTool({
    id: 'cccd_qr_generator',
    name: 'Tạo chuỗi QR thẻ CCCD',
    shortName: 'QR CCCD',
    icon: '🪪',
    category: 'Hành chính • Tiếp đón Y tế',
    description: 'Tạo chuỗi ký tự 7 trường chuẩn quét QR CCCD cho người quên mang thẻ',

    async mount(container, ctx) {
      const store = await chrome.storage.local.get([
        STORAGE_KEYS.DRAFT,
        STORAGE_KEYS.PREFS,
        STORAGE_KEYS.HISTORY,
        STORAGE_KEYS.ADDR_PRESETS
      ]);

      const prefs = {
        nameCase: 'title', // 'title' (Nguyễn Văn A) | 'upper' (NGUYỄN VĂN A)
        padYearOnly: true, // Chỉ nhớ năm 1994 -> xuất 01011994 (true) hay 1994 (false)
        appendEnter: false, // Thêm \n khi copy
        trailingEmptyPipes: false, // Thêm 4 dấu |||| ở cuối (chuẩn súng quét thẻ đời 2024–2025)
        ...(store[STORAGE_KEYS.PREFS] || {})
      };

      const draft = {
        soCccd: '',
        soCmndCu: '',
        hoTen: '',
        ngaySinh: '',
        gioiTinh: 'Nam',
        gioiTinhManual: false,
        diaChi: '',
        ngayCap: '10/05/2021',
        ...(store[STORAGE_KEYS.DRAFT] || {})
      };

      let history = Array.isArray(store[STORAGE_KEYS.HISTORY]) ? store[STORAGE_KEYS.HISTORY] : [];
      let addressPresets = Array.isArray(store[STORAGE_KEYS.ADDR_PRESETS])
        ? store[STORAGE_KEYS.ADDR_PRESETS]
        : DEFAULT_ADDRESS_PRESETS.slice();

      container.innerHTML = `
        <div class="tool-grid">
          <!-- CỘT 1: FORM NHẬP THÔNG TIN THẺ CCCD -->
          <section class="card">
            <div class="card-header">
              <div>
                <div class="card-title">🪪 Nhập thông tin công dân (Không mang thẻ CCCD)</div>
                <div class="card-subtitle">
                  Tự động giải mã Tỉnh khai sinh, Giới tính &amp; Năm sinh từ 12 số CCCD để chống đọc nhầm số
                </div>
              </div>
              <button type="button" id="btnResetForm" class="chip-btn" title="Xóa trắng để nhập người tiếp theo (Alt + N)">
                🔄 Làm mới
              </button>
            </div>

            <div class="form-grid-2">
              <!-- 1. Số CCCD 12 số -->
              <div class="field">
                <div class="field-label-row">
                  <label for="inpSoCccd" class="field-label">1. Số CCCD (12 số) <span class="req">*</span></label>
                  <span id="cccdLenBadge" class="chip-btn" style="pointer-events:none;">0/12 số</span>
                </div>
                <input
                  type="text"
                  id="inpSoCccd"
                  class="inp mono"
                  inputmode="numeric"
                  maxlength="12"
                  placeholder="VD: 051094001234"
                  autocomplete="off"
                />
              </div>

              <!-- 2. Số CMND 9 số cũ -->
              <div class="field">
                <div class="field-label-row">
                  <label for="inpSoCmndCu" class="field-label">2. Số CMND cũ (9 số)</label>
                  <span style="font-size:10.5px; color:#64748b;">Không nhớ để trống</span>
                </div>
                <input
                  type="text"
                  id="inpSoCmndCu"
                  class="inp mono"
                  inputmode="numeric"
                  maxlength="12"
                  placeholder="Để trống nếu không nhớ"
                  autocomplete="off"
                />
              </div>

              <!-- Khung giải mã trực tiếp 12 số CCCD -->
              <div id="cccdDecodeBanner" class="col-span-2 info-banner ok hidden"></div>
              <div id="cccdConflictBanner" class="col-span-2 info-banner warn hidden"></div>

              <!-- 3. Họ và tên -->
              <div class="field col-span-2">
                <div class="field-label-row">
                  <label for="inpHoTen" class="field-label">3. Họ và tên <span class="req">*</span></label>
                  <div class="chip-row" style="margin-top:0;">
                    <button type="button" id="btnCaseTitle" class="chip-btn" title="Định dạng gốc trên QR thẻ CCCD gắn chip">
                      Aa Hoa đầu từ
                    </button>
                    <button type="button" id="btnCaseUpper" class="chip-btn" title="Viết IN HOA toàn bộ họ tên">
                      AA IN HOA
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  id="inpHoTen"
                  class="inp"
                  placeholder="VD: Nguyễn Văn An"
                  autocomplete="off"
                />
              </div>

              <!-- 4. Ngày sinh -->
              <div class="field">
                <div class="field-label-row">
                  <label for="inpNgaySinh" class="field-label">4. Ngày sinh <span class="req">*</span></label>
                  <button type="button" id="btnFillBirthFromCccd" class="chip-btn hidden" title="Dùng khi người dân chỉ nhớ năm sinh"></button>
                </div>
                <input
                  type="text"
                  id="inpNgaySinh"
                  class="inp mono"
                  placeholder="Gõ 15081994 hoặc 15/08/1994"
                  autocomplete="off"
                />
                <label style="display:flex; align-items:center; gap:5px; font-size:11px; color:#64748b; margin-top:2px; cursor:pointer;">
                  <input type="checkbox" id="chkPadYearOnly" />
                  <span>Nếu chỉ gõ năm (<code>yyyy</code>) ➔ tự ghép <code>0101yyyy</code></span>
                </label>
              </div>

              <!-- 5. Giới tính -->
              <div class="field">
                <div class="field-label-row">
                  <label for="selGioiTinh" class="field-label">5. Giới tính <span class="req">*</span></label>
                  <span style="font-size:10.5px; color:#64748b;">Tự nhận theo số thứ 4</span>
                </div>
                <select id="selGioiTinh" class="inp">
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                </select>
              </div>

              <!-- 6. Nơi thường trú -->
              <div class="field col-span-2">
                <div class="field-label-row">
                  <label for="inpDiaChi" class="field-label">6. Nơi thường trú <span class="req">*</span></label>
                  <button type="button" id="btnSaveAddrPreset" class="chip-btn" title="Lưu cụm Xã/Huyện/Tỉnh đang nhập làm nút bấm nhanh">
                    ＋ Lưu địa danh mẫu
                  </button>
                </div>
                <input
                  type="text"
                  id="inpDiaChi"
                  class="inp"
                  placeholder="VD: Thôn 1, Thị trấn Ba Tơ, Huyện Ba Tơ, Quảng Ngãi"
                  autocomplete="off"
                />
                <div id="addrPresetsRow" class="chip-row"></div>
              </div>

              <!-- 7. Ngày cấp thẻ CCCD -->
              <div class="field col-span-2">
                <div class="field-label-row">
                  <label for="inpNgayCap" class="field-label">7. Ngày cấp thẻ CCCD</label>
                  <div class="chip-row" style="margin-top:0;">
                    <button type="button" id="btnIssueDefault2021" class="chip-btn" title="Mốc cấp CCCD gắn chip phổ biến">
                      ⚡ 10/05/2021
                    </button>
                    <button type="button" id="btnIssueByAge" class="chip-btn" title="Tính tự động theo mốc tuổi cấp đổi 14 / 25 / 40 / 60 tuổi">
                      ⚡ Theo mốc tuổi
                    </button>
                    <button type="button" id="btnIssueClear" class="chip-btn" title="Để trống trường ngày cấp">
                      Để trống
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  id="inpNgayCap"
                  class="inp mono"
                  placeholder="Gõ 10052021, 10/05/2021 hoặc chọn gợi ý phía trên nếu không nhớ"
                  autocomplete="off"
                />
              </div>
            </div>
          </section>

          <!-- CỘT 2: CHUỖI KẾT QUẢ QR + SAO CHÉP + BẢNG 7 TRƯỜNG + LỊCH SỬ -->
          <section class="card">
            <div class="card-header">
              <div>
                <div class="card-title">📋 Chuỗi ký tự kết quả quét QR thẻ CCCD</div>
                <div class="card-subtitle">Chuẩn 7 trường Bộ Công An ngăn cách bằng dấu <code>|</code></div>
              </div>
              <div class="field-label-row" style="gap:10px;">
                <label style="display:inline-flex; align-items:center; gap:5px; font-size:11px; color:#475569; cursor:pointer;" title="Thêm 4 dấu |||| ở cuối giống súng quét thẻ đời mới 2024–2025">
                  <input type="checkbox" id="chkTrailingPipes" />
                  <span>Kèm đuôi <code>||||</code></span>
                </label>
                <label style="display:inline-flex; align-items:center; gap:5px; font-size:11px; color:#475569; cursor:pointer;" title="Thêm ký tự xuống dòng ở cuối khi sao chép">
                  <input type="checkbox" id="chkAppendEnter" />
                  <span>Kèm <code>Enter</code></span>
                </label>
              </div>
            </div>

            <textarea
              id="txtQrResult"
              class="qr-output-box"
              rows="3"
              readonly
              placeholder="Chuỗi kết quả QR sẽ tự động tạo ngay khi bạn nhập..."
            ></textarea>

            <div id="validationHintBox" class="info-banner err hidden" style="margin-top:8px;"></div>

            <div class="action-bar">
              <button type="button" id="btnCopyQr" class="btn btn-primary btn-grow" title="Phím tắt: Ctrl + Enter">
                📋 Sao chép chuỗi QR (Ctrl+Enter)
              </button>
              <button type="button" id="btnCopyAndNext" class="btn btn-indigo" title="Sao chép vào Clipboard rồi xóa trắng form để nhập người kế tiếp">
                📋 Copy &amp; Nhập mới
              </button>
            </div>

            <!-- Bảng kiểm tra chi tiết 7 cột -->
            <table class="segments-table" aria-label="Chi tiết 7 trường trong chuỗi QR">
              <tbody id="segmentsTbody"></tbody>
            </table>

            <!-- Tiện ích phụ: Dán chuỗi QR có sẵn để tách ngược lên Form -->
            <details class="reverse-box">
              <summary>📥 Bóc tách ngược từ chuỗi QR có sẵn (Dán để sửa lại)</summary>
              <div style="margin-top:8px; display:flex; gap:6px;">
                <input
                  type="text"
                  id="inpReverseQr"
                  class="inp mono"
                  placeholder="Dán chuỗi 051094...|...|... vào đây"
                />
                <button type="button" id="btnParseReverse" class="btn btn-outline" style="padding:6px 10px; white-space:nowrap;">
                  Đổ lên Form
                </button>
              </div>
            </details>

            <!-- Lịch sử tạo gần đây -->
            <div style="margin-top:12px;">
              <div class="field-label-row">
                <span class="field-label">🕒 Lịch sử vừa tạo gần đây (<span id="historyCount">0</span>)</span>
                <button type="button" id="btnClearHistory" class="chip-btn">🗑️ Xóa lịch sử</button>
              </div>
              <div id="historyContainer" class="history-list"></div>
            </div>
          </section>
        </div>
      `;

      // Tham chiếu DOM
      const inpSoCccd = container.querySelector('#inpSoCccd');
      const inpSoCmndCu = container.querySelector('#inpSoCmndCu');
      const inpHoTen = container.querySelector('#inpHoTen');
      const inpNgaySinh = container.querySelector('#inpNgaySinh');
      const selGioiTinh = container.querySelector('#selGioiTinh');
      const inpDiaChi = container.querySelector('#inpDiaChi');
      const inpNgayCap = container.querySelector('#inpNgayCap');
      const chkPadYearOnly = container.querySelector('#chkPadYearOnly');
      const chkAppendEnter = container.querySelector('#chkAppendEnter');
      const chkTrailingPipes = container.querySelector('#chkTrailingPipes');

      const cccdLenBadge = container.querySelector('#cccdLenBadge');
      const cccdDecodeBanner = container.querySelector('#cccdDecodeBanner');
      const cccdConflictBanner = container.querySelector('#cccdConflictBanner');
      const btnFillBirthFromCccd = container.querySelector('#btnFillBirthFromCccd');
      const btnCaseTitle = container.querySelector('#btnCaseTitle');
      const btnCaseUpper = container.querySelector('#btnCaseUpper');
      const addrPresetsRow = container.querySelector('#addrPresetsRow');
      const txtQrResult = container.querySelector('#txtQrResult');
      const validationHintBox = container.querySelector('#validationHintBox');
      const segmentsTbody = container.querySelector('#segmentsTbody');
      const historyContainer = container.querySelector('#historyContainer');
      const historyCount = container.querySelector('#historyCount');

      function populateFormFromDraft() {
        inpSoCccd.value = draft.soCccd || '';
        inpSoCmndCu.value = draft.soCmndCu || '';
        inpHoTen.value = draft.hoTen || '';
        inpNgaySinh.value = draft.ngaySinh || '';
        selGioiTinh.value = draft.gioiTinh === 'Nữ' ? 'Nữ' : 'Nam';
        inpDiaChi.value = draft.diaChi || '';
        inpNgayCap.value = draft.ngayCap ?? '';
        chkPadYearOnly.checked = Boolean(prefs.padYearOnly);
        chkAppendEnter.checked = Boolean(prefs.appendEnter);
        chkTrailingPipes.checked = Boolean(prefs.trailingEmptyPipes);
        btnCaseTitle.classList.toggle('active', prefs.nameCase === 'title');
        btnCaseUpper.classList.toggle('active', prefs.nameCase === 'upper');
      }

      function saveDraftAndPrefs() {
        chrome.storage.local.set({
          [STORAGE_KEYS.DRAFT]: draft,
          [STORAGE_KEYS.PREFS]: prefs
        });
      }

      function renderAddressPresets() {
        if (!addrPresetsRow) return;
        addrPresetsRow.innerHTML = addressPresets
          .map(
            (addr, idx) => `
            <span class="chip-btn js-addr-chip" data-idx="${idx}" title="Bấm để ghép nhanh vào Nơi thường trú">
              <span>＋ ${ctx.escapeHtml(addr)}</span>
              <span class="chip-del js-del-addr" data-idx="${idx}" title="Xóa mẫu địa danh này">✕</span>
            </span>
          `
          )
          .join('');

        addrPresetsRow.querySelectorAll('.js-addr-chip').forEach((chip) => {
          chip.addEventListener('click', (e) => {
            if (e.target.classList.contains('js-del-addr')) {
              e.stopPropagation();
              const delIdx = Number(e.target.dataset.idx);
              addressPresets.splice(delIdx, 1);
              chrome.storage.local.set({ [STORAGE_KEYS.ADDR_PRESETS]: addressPresets });
              renderAddressPresets();
              return;
            }
            const pick = addressPresets[Number(chip.dataset.idx)];
            if (!pick) return;
            const cur = inpDiaChi.value.trim();
            if (!cur) {
              inpDiaChi.value = pick;
            } else if (!cur.toLowerCase().includes(pick.toLowerCase())) {
              inpDiaChi.value = `${cur.replace(/,\s*$/, '')}, ${pick}`;
            }
            draft.diaChi = inpDiaChi.value;
            saveDraftAndPrefs();
            recomputeAll();
          });
        });
      }

      function renderHistory() {
        historyCount.textContent = String(history.length);
        if (history.length === 0) {
          historyContainer.innerHTML = `<div style="font-size:11.5px; color:#94a3b8; padding:4px 0;">Chưa có mục nào được sao chép.</div>`;
          return;
        }

        historyContainer.innerHTML = history
          .map(
            (item, idx) => `
            <div class="history-item">
              <div class="history-meta">
                <div class="history-title">${ctx.escapeHtml(item.hoTen)} • ${ctx.escapeHtml(item.soCccd)}</div>
                <div class="history-raw">${ctx.escapeHtml(item.qrString)}</div>
              </div>
              <div class="history-actions">
                <button type="button" class="chip-btn js-hist-load" data-idx="${idx}" title="Đổ lại thông tin này lên Form">Sửa</button>
                <button type="button" class="chip-btn js-hist-copy" data-idx="${idx}" title="Sao chép ngay chuỗi này">📋 Copy</button>
              </div>
            </div>
          `
          )
          .join('');

        historyContainer.querySelectorAll('.js-hist-copy').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const item = history[Number(btn.dataset.idx)];
            if (!item) return;
            const out = prefs.appendEnter ? `${item.qrString}\n` : item.qrString;
            await ctx.copyTextToClipboard(out);
            ctx.showToast(`✅ Đã sao chép lại chuỗi QR của ${item.hoTen}`);
          });
        });

        historyContainer.querySelectorAll('.js-hist-load').forEach((btn) => {
          btn.addEventListener('click', () => {
            const item = history[Number(btn.dataset.idx)];
            if (!item) return;
            loadQrStringIntoForm(item.qrString);
            ctx.showToast(`Đã nạp thông tin của ${item.hoTen} lên Form`);
          });
        });
      }

      function computeQrBuildState() {
        const cleanCccd = String(draft.soCccd || '').replace(/\D/g, '');
        const cleanCmnd = String(draft.soCmndCu || '').replace(/\D/g, '');
        const formattedName = formatPersonName(draft.hoTen, prefs.nameCase);
        const birthParsed = parseFlexibleDate(draft.ngaySinh, prefs.padYearOnly);
        const issueParsed = parseFlexibleDate(draft.ngayCap, true);
        const gender = draft.gioiTinh === 'Nữ' ? 'Nữ' : 'Nam';
        const cleanAddress = sanitizePipeField(draft.diaChi);
        const decoded = decodeCccdPrefix(cleanCccd);

        const errors = [];
        const conflicts = [];

        if (!cleanCccd) {
          errors.push('Chưa nhập Số CCCD (12 chữ số).');
        } else if (cleanCccd.length !== 12) {
          errors.push(`Số CCCD phải đúng 12 chữ số (hiện đang có ${cleanCccd.length} số).`);
        }

        if (decoded && cleanCccd.length >= 3 && !decoded.provinceName) {
          conflicts.push(`3 số đầu "${decoded.provCode}" không khớp mã Tỉnh/TP tiêu chuẩn (001–096).`);
        }
        if (decoded && cleanCccd.length >= 6 && !decoded.centuryValid) {
          conflicts.push(`Chữ số thứ 4 ("${cleanCccd[3]}") vượt ngoài mã thế kỷ/giới tính chuẩn (0–5).`);
        }

        if (cleanCmnd && cleanCmnd.length !== 9 && cleanCmnd.length !== 12) {
          conflicts.push(`Số CMND cũ thường gồm 9 chữ số (hiện đang nhập ${cleanCmnd.length} số).`);
        }

        if (!formattedName) {
          errors.push('Chưa nhập Họ và tên.');
        }

        if (birthParsed.empty) {
          errors.push('Chưa nhập Ngày sinh (hoặc Năm sinh).');
        } else if (!birthParsed.valid) {
          errors.push(`Ngày sinh: ${birthParsed.error}.`);
        }

        if (!issueParsed.empty && !issueParsed.valid) {
          errors.push(`Ngày cấp thẻ: ${issueParsed.error}.`);
        }

        if (!cleanAddress) {
          errors.push('Chưa nhập Nơi thường trú.');
        }

        // Đối chiếu chéo giữa 6 số đầu CCCD với Năm sinh & Giới tính để phát hiện đọc nhầm số CCCD
        if (decoded && decoded.birthYear && birthParsed.valid && birthParsed.year) {
          if (decoded.birthYear !== birthParsed.year) {
            conflicts.push(
              `Lệch năm sinh: Số CCCD thể hiện sinh năm ${decoded.birthYear}, nhưng ô Ngày sinh đang nhập năm ${birthParsed.year}!`
            );
          }
        }
        if (decoded && decoded.gender && decoded.gender !== gender) {
          conflicts.push(
            `Lệch giới tính: Chữ số thứ 4 của CCCD thể hiện giới tính "${decoded.gender}", nhưng đang chọn "${gender}"!`
          );
        }

        const fields = [
          cleanCccd,
          cleanCmnd,
          formattedName,
          birthParsed.valid ? birthParsed.qrValue : '',
          gender,
          cleanAddress,
          issueParsed.valid ? issueParsed.qrValue : ''
        ];

        let qrString = fields.join('|');
        if (prefs.trailingEmptyPipes) {
          qrString += '||||';
        }
        return {
          cleanCccd,
          cleanCmnd,
          formattedName,
          birthParsed,
          issueParsed,
          gender,
          cleanAddress,
          decoded,
          errors,
          conflicts,
          fields,
          qrString
        };
      }

      function recomputeAll() {
        const res = computeQrBuildState();

        cccdLenBadge.textContent = `${res.cleanCccd.length}/12 số`;
        inpSoCccd.classList.toggle('invalid', res.cleanCccd.length > 0 && res.cleanCccd.length !== 12);
        inpNgaySinh.classList.toggle('invalid', !res.birthParsed.empty && !res.birthParsed.valid);
        inpNgayCap.classList.toggle('invalid', !res.issueParsed.empty && !res.issueParsed.valid);

        // Thanh giải mã 6 số đầu CCCD
        if (res.decoded && res.cleanCccd.length >= 3) {
          const parts = [];
          parts.push(
            res.decoded.provinceName
              ? `📍 Khai sinh: <b>${ctx.escapeHtml(res.decoded.provinceName)}</b> (${res.decoded.provCode})`
              : `📍 Mã tỉnh: <b>${ctx.escapeHtml(res.decoded.provCode)}</b> (Chưa rõ)`
          );
          if (res.decoded.gender && res.decoded.birthYear) {
            parts.push(`Giới tính gốc: <b>${res.decoded.gender}</b>`);
            parts.push(`Năm sinh gốc: <b>${res.decoded.birthYear}</b>`);
          }
          cccdDecodeBanner.innerHTML = parts.join(' • ');
          cccdDecodeBanner.classList.remove('hidden');
        } else {
          cccdDecodeBanner.classList.add('hidden');
        }

        // Nút gợi ý điền nhanh 01/01/YYYY từ số CCCD nếu người dân quên ngày tháng sinh
        if (res.decoded && res.decoded.birthYear) {
          btnFillBirthFromCccd.textContent = `⚡ Điền 01/01/${res.decoded.birthYear}`;
          btnFillBirthFromCccd.dataset.year = String(res.decoded.birthYear);
          btnFillBirthFromCccd.classList.remove('hidden');
        } else {
          btnFillBirthFromCccd.classList.add('hidden');
        }

        // Cảnh báo lệch thông tin
        if (res.conflicts.length > 0) {
          cccdConflictBanner.innerHTML = res.conflicts
            .map((c) => `⚠️ ${ctx.escapeHtml(c)}`)
            .join('<br/>');
          cccdConflictBanner.classList.remove('hidden');
        } else {
          cccdConflictBanner.classList.add('hidden');
        }

        // Chuỗi đầu ra
        txtQrResult.value = res.cleanCccd || res.formattedName ? res.qrString : '';

        if (res.errors.length > 0) {
          validationHintBox.innerHTML = `<b>Cần bổ sung trước khi dùng:</b> ${ctx.escapeHtml(res.errors[0])}`;
          validationHintBox.classList.remove('hidden');
        } else {
          validationHintBox.classList.add('hidden');
        }

        // Bảng 7 trường trực quan
        const labels = [
          '1. Số CCCD (12 số)',
          '2. Số CMND 9 số cũ',
          '3. Họ và tên',
          '4. Ngày sinh (QR)',
          '5. Giới tính',
          '6. Nơi thường trú',
          '7. Ngày cấp (QR)'
        ];
        segmentsTbody.innerHTML = labels
          .map((lbl, idx) => {
            const val = res.fields[idx];
            return `
              <tr>
                <th>${ctx.escapeHtml(lbl)}</th>
                <td class="${val ? '' : 'empty-cell'}">${
                  val ? ctx.escapeHtml(val) : '(Để trống — vẫn giữ vạch |)'
                }</td>
              </tr>
            `;
          })
          .join('');

        return res;
      }

      async function handleCopyQr(resetAfterCopy = false) {
        const res = recomputeAll();
        if (res.errors.length > 0) {
          ctx.showToast(`⚠️ ${res.errors[0]}`, true);
          return;
        }

        const finalText = prefs.appendEnter ? `${res.qrString}\n` : res.qrString;
        const ok = await ctx.copyTextToClipboard(finalText);
        if (!ok) {
          ctx.showToast('Không thể truy cập Clipboard trên trình duyệt này.', true);
          return;
        }

        // Lưu vào lịch sử (chống trùng chuỗi vừa tạo)
        history = [
          {
            soCccd: res.cleanCccd,
            hoTen: res.formattedName,
            qrString: res.qrString,
            createdAt: Date.now()
          },
          ...history.filter((h) => h.qrString !== res.qrString)
        ].slice(0, 15);
        await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: history });
        renderHistory();

        if (resetAfterCopy) {
          resetFormFields();
          ctx.showToast(`✅ Đã Copy QR của ${res.formattedName} & sẵn sàng nhập người mới!`);
        } else {
          ctx.showToast(`✅ Đã sao chép chuỗi QR CCCD (${res.formattedName})!`);
        }
      }

      function resetFormFields() {
        draft.soCccd = '';
        draft.soCmndCu = '';
        draft.hoTen = '';
        draft.ngaySinh = '';
        draft.gioiTinh = 'Nam';
        draft.gioiTinhManual = false;
        draft.diaChi = '';
        draft.ngayCap = '10/05/2021';
        populateFormFromDraft();
        saveDraftAndPrefs();
        recomputeAll();
        inpSoCccd.focus();
      }

      function loadQrStringIntoForm(rawQr) {
        const cleaned = String(rawQr || '').trim();
        const parts = cleaned.split('|');
        if (parts.length < 6) {
          ctx.showToast('Chuỗi dán vào chưa đủ định dạng tối thiểu 6–7 trường ngăn cách dấu |', true);
          return;
        }
        draft.soCccd = (parts[0] || '').replace(/\D/g, '').slice(0, 12);
        draft.soCmndCu = (parts[1] || '').replace(/\D/g, '').slice(0, 12);
        draft.hoTen = (parts[2] || '').trim();
        const b = parseFlexibleDate(parts[3] || '', false);
        draft.ngaySinh = b.valid && b.display ? b.display : parts[3] || '';
        draft.gioiTinh = (parts[4] || '').trim() === 'Nữ' ? 'Nữ' : 'Nam';
        draft.gioiTinhManual = true;
        draft.diaChi = (parts[5] || '').trim();
        const iss = parseFlexibleDate(parts[6] || '', false);
        draft.ngayCap = iss.valid && iss.display ? iss.display : parts[6] || '';

        populateFormFromDraft();
        saveDraftAndPrefs();
        recomputeAll();
      }

      // Gắn sự kiện tương tác
      inpSoCccd.addEventListener('input', () => {
        const digits = inpSoCccd.value.replace(/\D/g, '').slice(0, 12);
        if (inpSoCccd.value !== digits) inpSoCccd.value = digits;
        draft.soCccd = digits;

        // Tự động gán Giới tính từ chữ số thứ 4 nếu người dùng chưa chỉnh tay
        const dec = decodeCccdPrefix(digits);
        if (dec && dec.gender && !draft.gioiTinhManual) {
          draft.gioiTinh = dec.gender;
          selGioiTinh.value = dec.gender;
        }
        saveDraftAndPrefs();
        recomputeAll();
      });

      inpSoCmndCu.addEventListener('input', () => {
        const digits = inpSoCmndCu.value.replace(/\D/g, '').slice(0, 12);
        if (inpSoCmndCu.value !== digits) inpSoCmndCu.value = digits;
        draft.soCmndCu = digits;
        saveDraftAndPrefs();
        recomputeAll();
      });

      inpHoTen.addEventListener('input', () => {
        draft.hoTen = inpHoTen.value;
        saveDraftAndPrefs();
        recomputeAll();
      });

      inpHoTen.addEventListener('blur', () => {
        if (inpHoTen.value.trim()) {
          inpHoTen.value = formatPersonName(inpHoTen.value, prefs.nameCase);
          draft.hoTen = inpHoTen.value;
          saveDraftAndPrefs();
          recomputeAll();
        }
      });

      inpNgaySinh.addEventListener('input', () => {
        draft.ngaySinh = inpNgaySinh.value;
        saveDraftAndPrefs();
        recomputeAll();
      });

      inpNgaySinh.addEventListener('blur', () => {
        const parsed = parseFlexibleDate(inpNgaySinh.value, prefs.padYearOnly);
        if (!parsed.empty && parsed.valid && !parsed.yearOnly) {
          inpNgaySinh.value = parsed.display;
          draft.ngaySinh = parsed.display;
          saveDraftAndPrefs();
          recomputeAll();
        }
      });

      selGioiTinh.addEventListener('change', () => {
        draft.gioiTinh = selGioiTinh.value;
        draft.gioiTinhManual = true;
        saveDraftAndPrefs();
        recomputeAll();
      });

      inpDiaChi.addEventListener('input', () => {
        draft.diaChi = inpDiaChi.value;
        saveDraftAndPrefs();
        recomputeAll();
      });

      inpNgayCap.addEventListener('input', () => {
        draft.ngayCap = inpNgayCap.value;
        saveDraftAndPrefs();
        recomputeAll();
      });

      inpNgayCap.addEventListener('blur', () => {
        const parsed = parseFlexibleDate(inpNgayCap.value, true);
        if (!parsed.empty && parsed.valid && !parsed.yearOnly) {
          inpNgayCap.value = parsed.display;
          draft.ngayCap = parsed.display;
          saveDraftAndPrefs();
          recomputeAll();
        }
      });

      btnFillBirthFromCccd.addEventListener('click', () => {
        const y = btnFillBirthFromCccd.dataset.year;
        if (!y) return;
        inpNgaySinh.value = `01/01/${y}`;
        draft.ngaySinh = inpNgaySinh.value;
        saveDraftAndPrefs();
        recomputeAll();
      });

      btnCaseTitle.addEventListener('click', () => {
        prefs.nameCase = 'title';
        btnCaseTitle.classList.add('active');
        btnCaseUpper.classList.remove('active');
        if (inpHoTen.value.trim()) {
          inpHoTen.value = formatPersonName(inpHoTen.value, 'title');
          draft.hoTen = inpHoTen.value;
        }
        saveDraftAndPrefs();
        recomputeAll();
      });

      btnCaseUpper.addEventListener('click', () => {
        prefs.nameCase = 'upper';
        btnCaseUpper.classList.add('active');
        btnCaseTitle.classList.remove('active');
        if (inpHoTen.value.trim()) {
          inpHoTen.value = formatPersonName(inpHoTen.value, 'upper');
          draft.hoTen = inpHoTen.value;
        }
        saveDraftAndPrefs();
        recomputeAll();
      });

      chkPadYearOnly.addEventListener('change', () => {
        prefs.padYearOnly = chkPadYearOnly.checked;
        saveDraftAndPrefs();
        recomputeAll();
      });

      chkAppendEnter.addEventListener('change', () => {
        prefs.appendEnter = chkAppendEnter.checked;
        saveDraftAndPrefs();
      });

      chkTrailingPipes.addEventListener('change', () => {
        prefs.trailingEmptyPipes = chkTrailingPipes.checked;
        saveDraftAndPrefs();
        recomputeAll();
      });

      container.querySelector('#btnIssueDefault2021')?.addEventListener('click', () => {
        inpNgayCap.value = '10/05/2021';
        draft.ngayCap = inpNgayCap.value;
        saveDraftAndPrefs();
        recomputeAll();
      });

      container.querySelector('#btnIssueByAge')?.addEventListener('click', () => {
        const dec = decodeCccdPrefix(draft.soCccd);
        const bParsed = parseFlexibleDate(draft.ngaySinh, prefs.padYearOnly);
        const y = (bParsed.valid && bParsed.year) || (dec && dec.birthYear) || null;
        inpNgayCap.value = suggestIssueDateByBirthYear(y);
        draft.ngayCap = inpNgayCap.value;
        saveDraftAndPrefs();
        recomputeAll();
      });

      container.querySelector('#btnIssueClear')?.addEventListener('click', () => {
        inpNgayCap.value = '';
        draft.ngayCap = '';
        saveDraftAndPrefs();
        recomputeAll();
      });

      container.querySelector('#btnSaveAddrPreset')?.addEventListener('click', () => {
        const val = sanitizePipeField(inpDiaChi.value);
        if (!val) {
          ctx.showToast('Hãy gõ cụm Xã/Huyện/Tỉnh vào ô Nơi thường trú trước khi lưu mẫu!', true);
          return;
        }
        if (!addressPresets.some((a) => a.toLowerCase() === val.toLowerCase())) {
          addressPresets.unshift(val);
          addressPresets = addressPresets.slice(0, 12);
          chrome.storage.local.set({ [STORAGE_KEYS.ADDR_PRESETS]: addressPresets });
          renderAddressPresets();
          ctx.showToast(`✅ Đã lưu mẫu địa danh: "${val}"`);
        } else {
          ctx.showToast('Mẫu địa danh này đã có sẵn trong danh sách.');
        }
      });

      container.querySelector('#btnCopyQr')?.addEventListener('click', () => handleCopyQr(false));
      container.querySelector('#btnCopyAndNext')?.addEventListener('click', () => handleCopyQr(true));
      container.querySelector('#btnResetForm')?.addEventListener('click', () => {
        resetFormFields();
        ctx.showToast('Đã xóa trắng Form');
      });

      container.querySelector('#btnParseReverse')?.addEventListener('click', () => {
        const inpRev = container.querySelector('#inpReverseQr');
        if (!inpRev || !inpRev.value.trim()) {
          ctx.showToast('Hãy dán chuỗi QR cần tách vào ô bên cạnh!', true);
          return;
        }
        loadQrStringIntoForm(inpRev.value);
        inpRev.value = '';
        ctx.showToast('✅ Đã tách ngược chuỗi QR lên các ô thông tin!');
      });

      container.querySelector('#btnClearHistory')?.addEventListener('click', async () => {
        if (history.length === 0) return;
        history = [];
        await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: [] });
        renderHistory();
        ctx.showToast('Đã xóa sạch lịch sử tạo QR');
      });

      const onKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          handleCopyQr(false);
        } else if (e.altKey && (e.key === 'n' || e.key === 'N')) {
          e.preventDefault();
          resetFormFields();
        }
      };
      document.addEventListener('keydown', onKeyDown);

      // Đồng bộ tức thì nếu người dùng sửa ở cửa sổ khác (VD mở song song Side Panel & Tab)
      const onStorageChanged = (changes, area) => {
        if (area !== 'local') return;
        if (changes[STORAGE_KEYS.HISTORY] && Array.isArray(changes[STORAGE_KEYS.HISTORY].newValue)) {
          history = changes[STORAGE_KEYS.HISTORY].newValue;
          renderHistory();
        }
      };
      chrome.storage.onChanged.addListener(onStorageChanged);

      // Khởi chạy lần đầu
      populateFormFromDraft();
      renderAddressPresets();
      renderHistory();
      recomputeAll();

      return () => {
        document.removeEventListener('keydown', onKeyDown);
        chrome.storage.onChanged.removeListener(onStorageChanged);
      };
    }
  });
})();
