/**
 * BATO_UTILITIES - Công cụ Tạo & Phân tích chuỗi ký tự QR Thẻ BHYT chuẩn
 * Hỗ trợ tiếp đón bệnh nhân quên thẻ BHYT vật lý, phân tích 15 ký tự thẻ BHYT.
 * Chuẩn định dạng chuỗi QR BHYT Bộ Y tế / BHXH Việt Nam:
 * [Mã thẻ 15 số]|[Họ tên]|[Ngày sinh]|[Giới tính]|[Địa chỉ]|[Mã CSKCB BĐ]|[Từ ngày]|[Đến ngày]|[Ngày 5 năm]
 */

(function () {
  const TOOL_ID = 'bhyt_qr_generator';

  const BHYT_DOI_TUONG = {
    DN: 'Người lao động trong doanh nghiệp',
    HX: 'Người lao động trong HTX, liên hiệp HTX',
    CH: 'Người lao động trong cơ quan nhà nước, ĐV sự nghiệp',
    NN: 'Cán bộ, công chức, viên chức',
    TK: 'Người hoạt động không chuyên trách cấp xã',
    HC: 'Cán bộ, công chức cấp xã',
    XK: 'Người đi làm việc ở nước ngoài theo hợp đồng',
    HT: 'Người đang hưởng lương hưu, trợ cấp mất sức',
    TB: 'Người đang hưởng trợ cấp tai nạn LĐ, bệnh nghề nghiệp',
    NO: 'Người lao động nghỉ việc hưởng chế độ ốm đau',
    CT: 'Người từ đủ 80 tuổi trở lên đang hưởng trợ cấp tuất',
    XB: 'Cán bộ xã, phường, thị trấn đã nghỉ việc',
    TN: 'Người đang hưởng trợ cấp thất nghiệp',
    CS: 'Người có công với cách mạng',
    QN: 'Sĩ quan, quân nhân chuyên nghiệp QĐND',
    CA: 'Sĩ quan, hạ sĩ quan CAND',
    CY: 'Người làm công tác cơ yếu',
    TE: 'Trẻ em dưới 6 tuổi (được cấp thẻ miễn phí)',
    HN: 'Người thuộc hộ gia đình nghèo',
    DT: 'Người dân tộc thiểu số sống tại vùng khó khăn',
    DK: 'Người sinh sống tại vùng có điều kiện ĐB khó khăn',
    XD: 'Người sinh sống tại xã đảo, huyện đảo',
    BT: 'Người thuộc diện hưởng trợ cấp bảo trợ xã hội',
    TS: 'Thân nhân của người có công với cách mạng',
    TC: 'Thân nhân của liệt sĩ',
    SV: 'Sinh viên đang theo học tại các cơ sở giáo dục ĐH, CĐ',
    HS: 'Học sinh đang theo học tại các trường phổ thông',
    GB: 'Người thuộc hộ gia đình cận nghèo',
    GD: 'Người tham gia BHYT theo hộ gia đình',
    PV: 'Phóng viên, nhà báo được cấp thẻ nhà báo',
    CN: 'Người thuộc hộ gia đình cận nghèo theo tiêu chuẩn chuẩn nghèo',
    TA: 'Người lao động tại các cơ sở sản xuất kinh doanh dịch vụ'
  };

  const MUC_HUONG_INFO = {
    '1': { rate: '100%', note: '100% chi phí KCB, không áp dụng giới hạn tỷ lệ thanh toán' },
    '2': { rate: '100%', note: '100% chi phí KCB, có giới hạn tỷ lệ với một số thuốc, VTYT kỹ thuật cao' },
    '3': { rate: '95%', note: '95% chi phí KCB, người bệnh cùng chi trả 5%' },
    '4': { rate: '80%', note: '80% chi phí KCB, người bệnh cùng chi trả 20%' },
    '5': { rate: '100%', note: '100% chi phí KCB kể cả ngoài phạm vi BHYT (QN, CA, CY)' }
  };

  const PROVINCE_CODES = {
    '01': 'Hà Nội', '02': 'Hà Giang', '04': 'Cao Bằng', '06': 'Bắc Kạn', '08': 'Tuyên Quang',
    '10': 'Lào Cai', '11': 'Điện Biên', '12': 'Lai Châu', '14': 'Sơn La', '15': 'Yên Bái',
    '17': 'Hòa Bình', '19': 'Thái Nguyên', '20': 'Lạng Sơn', '22': 'Quảng Ninh', '24': 'Bắc Giang',
    '25': 'Phú Thọ', '26': 'Vĩnh Phúc', '27': 'Bắc Ninh', '30': 'Hải Dương', '31': 'Hải Phòng',
    '33': 'Hưng Yên', '34': 'Thái Bình', '35': 'Hà Nam', '36': 'Nam Định', '37': 'Ninh Bình',
    '38': 'Thanh Hóa', '40': 'Nghệ An', '42': 'Hà Tĩnh', '44': 'Quảng Bình', '45': 'Quảng Trị',
    '46': 'Thừa Thiên Huế', '48': 'Đà Nẵng', '49': 'Quảng Nam', '51': 'Quảng Ngãi', '52': 'Bình Định',
    '54': 'Phú Yên', '56': 'Khánh Hòa', '58': 'Ninh Thuận', '60': 'Bình Thuận', '62': 'Kon Tum',
    '64': 'Gia Lai', '66': 'Đắk Lắk', '67': 'Đắk Nông', '68': 'Lâm Đồng', '70': 'Bình Phước',
    '72': 'Tây Ninh', '74': 'Bình Dương', '75': 'Đồng Nai', '77': 'Bà Rịa - Vũng Tàu', '79': 'TP. Hồ Chí Minh',
    '80': 'Long An', '82': 'Tiền Giang', '83': 'Bến Tre', '84': 'Trà Vinh', '86': 'Vĩnh Long',
    '87': 'Đồng Tháp', '89': 'An Giang', '91': 'Kiên Giang', '92': 'Cần Thơ', '93': 'Hậu Giang',
    '94': 'Sóc Trăng', '95': 'Bạc Liêu', '96': 'Cà Mau'
  };

  const DEFAULT_CSKCB_PRESETS = [
    { code: '51008', name: 'BV ĐKKV Ba Tơ' },
    { code: '51023', name: 'TTYT Ba Tơ' },
    { code: '51001', name: 'BV Đa khoa Tỉnh Quảng Ngãi' },
    { code: '51005', name: 'BV ĐKKV Đặng Thùy Trâm' },
    { code: '51002', name: 'BV Sản - Nhi Quảng Ngãi' }
  ];

  window.registerBatoUtilityTool({
    id: TOOL_ID,
    name: 'Tạo & Phân tích QR Thẻ BHYT',
    shortName: 'QR Thẻ BHYT',
    icon: '🏥',
    category: 'Tiếp đón & BHYT',
    description: 'Tạo chuỗi ký tự QR BHYT chuẩn Bộ Y tế phục vụ tiếp đón khi bệnh nhân quên thẻ; phân tích mã 15 ký tự.',

    async mount(container, ctx) {
      const storageKeyHist = 'bato_util_bhyt_history';
      const storageKeyPresets = 'bato_util_bhyt_cskcb_presets';

      const store = await chrome.storage.local.get([storageKeyHist, storageKeyPresets, 'bato_util_bhyt_append_enter']);
      let history = Array.isArray(store[storageKeyHist]) ? store[storageKeyHist] : [];
      let cskcbPresets = Array.isArray(store[storageKeyPresets]) && store[storageKeyPresets].length > 0
        ? store[storageKeyPresets]
        : DEFAULT_CSKCB_PRESETS;
      let appendEnter = store.bato_util_bhyt_append_enter ?? true;

      container.innerHTML = `
        <div class="tool-content-wrap">
          <div class="tool-header-bar">
            <div>
              <h2 class="tool-title">🏥 Tạo & Phân Tích Chuỗi QR Thẻ BHYT Chuẩn</h2>
              <p class="tool-subtitle">Tạo chuỗi quét QR chuẩn Bộ Y tế / Cổng BHXH (9 trường phân tách dấu |) hỗ trợ tiếp đón bệnh nhân quên thẻ giấy / hỏng VNeID.</p>
            </div>
          </div>

          <div class="tool-body-grid">
            <!-- CỘT NHẬP LIỆU -->
            <div class="card form-card">
              <div class="card-head">
                <span class="card-title">📝 Thông tin thẻ BHYT</span>
                <button type="button" id="btnPasteBhytRaw" class="btn btn-sm btn-outline" title="Dán chuỗi QR BHYT có sẵn để bóc tách">
                  📋 Dán chuỗi QR
                </button>
              </div>

              <div class="form-grid">
                <!-- Mã thẻ BHYT 15 số -->
                <div class="form-group col-span-2">
                  <label class="form-label" for="bhytCode">
                    <span>Mã thẻ BHYT (15 ký tự) <b class="req">*</b></span>
                    <span id="bhytCodeLenBadge" class="badge">0/15</span>
                  </label>
                  <input type="text" id="bhytCode" class="inp" placeholder="VD: GD4515123456789 hoặc DN401..." maxlength="15" autocomplete="off" />
                  <div id="bhytDecodedBox" class="decoded-callout hidden"></div>
                </div>

                <!-- Họ và tên -->
                <div class="form-group col-span-2">
                  <label class="form-label" for="bhytName">Họ và tên bệnh nhân <b class="req">*</b></label>
                  <input type="text" id="bhytName" class="inp" placeholder="VD: NGUYỄN VĂN AN" autocomplete="off" />
                </div>

                <!-- Ngày sinh & Giới tính -->
                <div class="form-group">
                  <label class="form-label" for="bhytDob">Ngày sinh (dd/MM/yyyy hoặc yyyy) <b class="req">*</b></label>
                  <input type="text" id="bhytDob" class="inp" placeholder="15/08/1990 hoặc 1990" maxlength="10" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="bhytGender">Giới tính <b class="req">*</b></label>
                  <select id="bhytGender" class="inp">
                    <option value="1">1 - Nam</option>
                    <option value="2">2 - Nữ</option>
                  </select>
                </div>

                <!-- Mã nơi ĐKKCB Ban đầu -->
                <div class="form-group col-span-2">
                  <label class="form-label" for="bhytCskcb">
                    <span>Mã CSKCB Ban đầu (5 số) <b class="req">*</b></span>
                    <span id="bhytCskcbName" class="hint-text"></span>
                  </label>
                  <div class="input-with-button">
                    <input type="text" id="bhytCskcb" class="inp" placeholder="VD: 51008 (BV ĐKKV Ba Tơ)" maxlength="5" />
                  </div>
                  <div class="quick-preset-chips" id="cskcbPresetContainer"></div>
                </div>

                <!-- Địa chỉ -->
                <div class="form-group col-span-2">
                  <label class="form-label" for="bhytAddress">Địa chỉ cư trú</label>
                  <input type="text" id="bhytAddress" class="inp" placeholder="VD: Ba Động, Ba Tơ, Quảng Ngãi" />
                </div>

                <!-- Hạn sử dụng: Từ ngày - Đến ngày -->
                <div class="form-group">
                  <label class="form-label" for="bhytFromDate">Hạn từ ngày (dd/MM/yyyy)</label>
                  <input type="text" id="bhytFromDate" class="inp" placeholder="01/01/2024" maxlength="10" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="bhytToDate">
                    <span>Hạn đến ngày</span>
                    <button type="button" id="btnFill5Years" class="btn-link" title="Tính hạn 1 năm / 5 năm">+1 năm</button>
                  </label>
                  <input type="text" id="bhytToDate" class="inp" placeholder="31/12/2024" maxlength="10" />
                </div>

                <!-- Thời điểm đủ 5 năm liên tục -->
                <div class="form-group col-span-2">
                  <label class="form-label" for="bhyt5YearsDate">Thời điểm đủ 5 năm liên tục (tùy chọn)</label>
                  <input type="text" id="bhyt5YearsDate" class="inp" placeholder="01/01/2022 (nếu có)" maxlength="10" />
                </div>
              </div>

              <!-- Hàng phím bấm thao tác -->
              <div class="form-actions-row">
                <button type="button" id="btnCopyResult" class="btn btn-primary" title="Sao chép chuỗi QR (Ctrl + Enter)">
                  📋 Sao chép chuỗi QR
                </button>
                <button type="button" id="btnCopyAndReset" class="btn btn-emerald" title="Sao chép và xóa form nhập người mới (Alt + N)">
                  ⚡ Copy & Nhập mới
                </button>
                <button type="button" id="btnResetForm" class="btn btn-outline" title="Làm mới form">
                  🔄 Xóa trắng
                </button>
              </div>

              <div class="form-extra-opts">
                <label class="checkbox-label" title="Tự động thêm ký tự Enter sau chuỗi để mô phỏng súng bắn mã vạch">
                  <input type="checkbox" id="chkAppendEnter" ${appendEnter ? 'checked' : ''} />
                  <span>Kèm phím Enter cuối chuỗi khi dán vào phần mềm HIS</span>
                </label>
              </div>
            </div>

            <!-- CỘT KẾT QUẢ & LỊCH SỬ -->
            <div class="card result-card">
              <div class="card-head">
                <span class="card-title">🔍 Kết quả chuỗi quét QR BHYT</span>
                <span id="charCountBadge" class="badge">0 ký tự</span>
              </div>

              <div class="result-box">
                <textarea id="txtResultString" class="result-textarea" readonly rows="4" placeholder="Chuỗi mã QR BHYT sẽ hiển thị tại đây..."></textarea>
              </div>

              <div class="result-breakdown" id="resultBreakdownBox">
                <!-- Chi tiết từng trường được phân tách -->
              </div>

              <!-- Lịch sử tạo gần nhất -->
              <div class="history-box">
                <div class="history-head">
                  <span class="history-title">🕒 Lịch sử tạo gần nhất</span>
                  <button type="button" id="btnClearHistory" class="btn-link" title="Xóa toàn bộ lịch sử">Xóa lịch sử</button>
                </div>
                <div id="historyList" class="history-list"></div>
              </div>
            </div>
          </div>
        </div>
      `;

      // Elements
      const inpCode = container.querySelector('#bhytCode');
      const codeLenBadge = container.querySelector('#bhytCodeLenBadge');
      const decodedBox = container.querySelector('#bhytDecodedBox');
      const inpName = container.querySelector('#bhytName');
      const inpDob = container.querySelector('#bhytDob');
      const selGender = container.querySelector('#bhytGender');
      const inpCskcb = container.querySelector('#bhytCskcb');
      const lblCskcbName = container.querySelector('#bhytCskcbName');
      const presetWrap = container.querySelector('#cskcbPresetContainer');
      const inpAddr = container.querySelector('#bhytAddress');
      const inpFrom = container.querySelector('#bhytFromDate');
      const inpTo = container.querySelector('#bhytToDate');
      const inp5Y = container.querySelector('#bhyt5YearsDate');
      const txtResult = container.querySelector('#txtResultString');
      const charCount = container.querySelector('#charCountBadge');
      const breakdownBox = container.querySelector('#resultBreakdownBox');
      const historyList = container.querySelector('#historyList');
      const chkEnter = container.querySelector('#chkAppendEnter');

      // Render CSKCB Presets
      function renderPresets() {
        presetWrap.innerHTML = cskcbPresets
          .map((p) => `<button type="button" class="preset-chip" data-code="${ctx.escapeHtml(p.code)}" data-name="${ctx.escapeHtml(p.name)}">${ctx.escapeHtml(p.name)} (${ctx.escapeHtml(p.code)})</button>`)
          .join('');

        presetWrap.querySelectorAll('.preset-chip').forEach((btn) => {
          btn.addEventListener('click', () => {
            inpCskcb.value = btn.dataset.code;
            lblCskcbName.textContent = btn.dataset.name;
            updateResult();
          });
        });
      }
      renderPresets();

      // Normalize date string DDMMYYYY -> DD/MM/YYYY
      function formatDisplayDate(val) {
        const clean = (val || '').replace(/\D/g, '');
        if (clean.length === 8) {
          return `${clean.slice(0, 2)}/${clean.slice(2, 4)}/${clean.slice(4, 8)}`;
        }
        return val;
      }

      function cleanDateForQr(val) {
        if (!val) return '';
        const v = val.trim();
        const parts = v.split(/[\/\-.]/);
        if (parts.length === 3) {
          const d = parts[0].padStart(2, '0');
          const m = parts[1].padStart(2, '0');
          const y = parts[2];
          return `${d}/${m}/${y}`;
        }
        return v;
      }

      // Phân tích mã thẻ BHYT 15 ký tự
      function analyzeBhytCode(code) {
        const c = (code || '').trim().toUpperCase();
        if (c.length < 3) {
          decodedBox.classList.add('hidden');
          return null;
        }

        const dtCode = c.slice(0, 2);
        const dtDesc = BHYT_DOI_TUONG[dtCode] || 'Mã đối tượng khác';
        const mucHuongChar = c.charAt(2);
        const mucHuongObj = MUC_HUONG_INFO[mucHuongChar] || { rate: 'Chưa rõ', note: '' };
        const provinceCode = c.length >= 5 ? c.slice(3, 5) : '';
        const provinceName = PROVINCE_CODES[provinceCode] || (provinceCode ? 'Chưa rõ mã tỉnh' : '');
        const bhxhNum = c.length > 5 ? c.slice(5) : '';

        decodedBox.classList.remove('hidden');
        decodedBox.innerHTML = `
          <div class="decoded-item"><b>Đối tượng:</b> [${ctx.escapeHtml(dtCode)}] ${ctx.escapeHtml(dtDesc)}</div>
          <div class="decoded-item"><b>Mức hưởng:</b> [Mức ${ctx.escapeHtml(mucHuongChar)}] Hưởng <b>${ctx.escapeHtml(mucHuongObj.rate)}</b> — ${ctx.escapeHtml(mucHuongObj.note)}</div>
          ${provinceName ? `<div class="decoded-item"><b>Tỉnh/TP cấp:</b> [${ctx.escapeHtml(provinceCode)}] ${ctx.escapeHtml(provinceName)}</div>` : ''}
          ${bhxhNum ? `<div class="decoded-item"><b>Mã số BHXH:</b> <code>${ctx.escapeHtml(bhxhNum)}</code></div>` : ''}
        `;

        return { dtCode, mucHuongChar, provinceCode, bhxhNum };
      }

      function buildQrString() {
        const code = (inpCode.value || '').trim().toUpperCase();
        const name = (inpName.value || '').trim().toUpperCase();
        const dob = cleanDateForQr(inpDob.value);
        const gender = selGender.value;
        const address = (inpAddr.value || '').trim();
        const cskcb = (inpCskcb.value || '').trim();
        const fromDate = cleanDateForQr(inpFrom.value);
        const toDate = cleanDateForQr(inpTo.value);
        const fiveYears = cleanDateForQr(inp5Y.value);

        if (!code && !name) return '';

        // Định dạng QR thẻ BHYT chuẩn:
        // MãThẻ|HọTên|NgàySinh|GiớiTính|ĐịaChỉ|MãCSKCB|TừNgày|ĐếnNgày|ThờiĐiểm5Năm
        const parts = [
          code,
          name,
          dob,
          gender,
          address,
          cskcb,
          fromDate,
          toDate,
          fiveYears
        ];

        // Loại bỏ các trường rỗng ở cuối nếu không có
        while (parts.length > 6 && !parts[parts.length - 1]) {
          parts.pop();
        }

        return parts.join('|');
      }

      function updateResult() {
        const qr = buildQrString();
        txtResult.value = qr;
        charCount.textContent = `${qr.length} ký tự`;

        if (!qr) {
          breakdownBox.innerHTML = '';
          return;
        }

        const fields = qr.split('|');
        const labels = ['Mã thẻ', 'Họ và tên', 'Ngày sinh', 'Giới tính', 'Địa chỉ', 'Mã CSKCB', 'Hạn từ', 'Hạn đến', 'Thời điểm 5 năm'];
        breakdownBox.innerHTML = fields
          .map((f, i) => `
            <div class="breakdown-row">
              <span class="breakdown-lbl">${labels[i] || `Trường ${i + 1}`}:</span>
              <span class="breakdown-val">${ctx.escapeHtml(f || '(để trống)')}</span>
            </div>
          `)
          .join('');
      }

      function renderHistory() {
        if (history.length === 0) {
          historyList.innerHTML = `<div class="empty-hint">Chưa có lịch sử tạo QR BHYT.</div>`;
          return;
        }
        historyList.innerHTML = history
          .map((item, idx) => `
            <div class="history-item" data-idx="${idx}">
              <div class="history-item-top">
                <b>${ctx.escapeHtml(item.name || item.code)}</b>
                <span class="history-badge">${ctx.escapeHtml(item.code || '')}</span>
              </div>
              <div class="history-item-str">${ctx.escapeHtml(item.qr)}</div>
              <div class="history-item-actions">
                <button type="button" class="btn-link btn-hist-load" data-idx="${idx}">Nạp lại</button>
                <button type="button" class="btn-link btn-hist-copy" data-idx="${idx}">📋 Sao chép</button>
              </div>
            </div>
          `)
          .join('');

        historyList.querySelectorAll('.btn-hist-load').forEach((btn) => {
          btn.addEventListener('click', () => {
            const item = history[btn.dataset.idx];
            if (item) parseRawQrIntoForm(item.qr);
          });
        });

        historyList.querySelectorAll('.btn-hist-copy').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const item = history[btn.dataset.idx];
            if (item) {
              const textToCopy = chkEnter.checked ? `${item.qr}\n` : item.qr;
              await ctx.copyTextToClipboard(textToCopy);
              ctx.showToast('✅ Đã sao chép chuỗi QR từ lịch sử!');
            }
          });
        });
      }
      renderHistory();

      async function saveToHistory(qr) {
        if (!qr) return;
        const code = (inpCode.value || '').trim().toUpperCase();
        const name = (inpName.value || '').trim().toUpperCase();
        const item = { code, name, qr, time: Date.now() };

        history = [item, ...history.filter((h) => h.qr !== qr)].slice(0, 15);
        await chrome.storage.local.set({ [storageKeyHist]: history });
        renderHistory();
      }

      function parseRawQrIntoForm(rawStr) {
        if (!rawStr) return;
        const parts = rawStr.trim().split('|');
        if (parts.length < 2) {
          ctx.showToast('Chuỗi không đúng định dạng QR BHYT (cần phân cách bởi dấu |).', true);
          return;
        }

        inpCode.value = (parts[0] || '').trim().toUpperCase();
        inpName.value = (parts[1] || '').trim().toUpperCase();
        inpDob.value = formatDisplayDate(parts[2] || '');
        if (parts[3] === '1' || parts[3] === '2') {
          selGender.value = parts[3];
        }
        inpAddr.value = (parts[4] || '').trim();
        inpCskcb.value = (parts[5] || '').trim();
        inpFrom.value = formatDisplayDate(parts[6] || '');
        inpTo.value = formatDisplayDate(parts[7] || '');
        inp5Y.value = formatDisplayDate(parts[8] || '');

        codeLenBadge.textContent = `${inpCode.value.length}/15`;
        analyzeBhytCode(inpCode.value);
        updateResult();
        ctx.showToast('✅ Đã bóc tách chuỗi QR BHYT lên form!');
      }

      // Input Listeners
      inpCode.addEventListener('input', () => {
        inpCode.value = inpCode.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        codeLenBadge.textContent = `${inpCode.value.length}/15`;
        analyzeBhytCode(inpCode.value);
        updateResult();
      });

      inpName.addEventListener('input', () => {
        inpName.value = inpName.value.toUpperCase();
        updateResult();
      });

      [inpDob, selGender, inpCskcb, inpAddr, inpFrom, inpTo, inp5Y].forEach((el) => {
        el.addEventListener('input', updateResult);
        el.addEventListener('change', updateResult);
      });

      chkEnter.addEventListener('change', async () => {
        await chrome.storage.local.set({ bato_util_bhyt_append_enter: chkEnter.checked });
      });

      // Nút tính hạn +1 năm
      container.querySelector('#btnFill5Years')?.addEventListener('click', () => {
        const fromStr = inpFrom.value || '01/01/' + new Date().getFullYear();
        inpFrom.value = fromStr;
        const parts = fromStr.split('/');
        if (parts.length === 3) {
          const nextYear = parseInt(parts[2], 10) + 1;
          inpTo.value = `31/12/${nextYear - 1}`;
        } else {
          inpTo.value = '31/12/' + new Date().getFullYear();
        }
        updateResult();
      });

      // Nút Dán chuỗi QR thô
      container.querySelector('#btnPasteBhytRaw')?.addEventListener('click', async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            parseRawQrIntoForm(text);
          } else {
            ctx.showToast('Clipboard đang trống.', true);
          }
        } catch (_) {
          const promptVal = prompt('Dán chuỗi ký tự QR BHYT vào đây:');
          if (promptVal) parseRawQrIntoForm(promptVal);
        }
      });

      // Nút Sao chép
      async function handleCopy() {
        const qr = buildQrString();
        if (!qr) {
          ctx.showToast('Vui lòng nhập Mã thẻ và Họ tên!', true);
          return;
        }
        const textToCopy = chkEnter.checked ? `${qr}\n` : qr;
        const ok = await ctx.copyTextToClipboard(textToCopy);
        if (ok) {
          ctx.showToast('✅ Đã sao chép chuỗi QR BHYT!');
          await saveToHistory(qr);
        } else {
          ctx.showToast('Không thể sao chép chuỗi.', true);
        }
      }

      container.querySelector('#btnCopyResult')?.addEventListener('click', handleCopy);

      // Nút Copy & Nhập mới
      container.querySelector('#btnCopyAndReset')?.addEventListener('click', async () => {
        const qr = buildQrString();
        if (!qr) {
          ctx.showToast('Vui lòng nhập Mã thẻ và Họ tên!', true);
          return;
        }
        const textToCopy = chkEnter.checked ? `${qr}\n` : qr;
        await ctx.copyTextToClipboard(textToCopy);
        await saveToHistory(qr);
        ctx.showToast('✅ Đã copy! Đã sẵn sàng nhập người tiếp theo.');

        // Reset các trường cá nhân, giữ lại CSKCB
        inpCode.value = '';
        inpName.value = '';
        inpDob.value = '';
        inpAddr.value = '';
        decodedBox.classList.add('hidden');
        codeLenBadge.textContent = '0/15';
        updateResult();
        inpCode.focus();
      });

      // Nút Reset
      container.querySelector('#btnResetForm')?.addEventListener('click', () => {
        inpCode.value = '';
        inpName.value = '';
        inpDob.value = '';
        inpAddr.value = '';
        inpFrom.value = '';
        inpTo.value = '';
        inp5Y.value = '';
        decodedBox.classList.add('hidden');
        codeLenBadge.textContent = '0/15';
        updateResult();
        ctx.showToast('Đã làm mới form.');
      });

      // Nút Xóa lịch sử
      container.querySelector('#btnClearHistory')?.addEventListener('click', async () => {
        if (confirm('Bạn có chắc muốn xóa sạch lịch sử QR BHYT?')) {
          history = [];
          await chrome.storage.local.set({ [storageKeyHist]: [] });
          renderHistory();
          ctx.showToast('Đã xóa lịch sử.');
        }
      });

      // Phím tắt Ctrl + Enter và Alt + N
      const keyHandler = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          handleCopy();
        } else if (e.altKey && (e.key === 'n' || e.key === 'N')) {
          e.preventDefault();
          container.querySelector('#btnCopyAndReset')?.click();
        }
      };
      window.addEventListener('keydown', keyHandler);

      return () => {
        window.removeEventListener('keydown', keyHandler);
      };
    }
  });
})();
