/**
 * BATO_UTILITIES - Công cụ Đọc số tiền thành chữ tiếng Việt chuẩn
 * Phục vụ nhân viên thu ngân viện phí, tài chính kế toán, lập hóa đơn, phiếu thu/chi.
 * Hỗ trợ định dạng dấu phân cách, đọc ngoại tệ (USD, EUR, VND), tùy chọn viết hoa và đuôi "chẵn".
 */

(function () {
  const TOOL_ID = 'money_to_words';

  const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

  function readGroupOfThree(strGroup, isLead) {
    let [c1, c2, c3] = strGroup.split('').map(Number);
    let res = '';

    if (!isLead || c1 > 0) {
      res += DIGITS[c1] + ' trăm ';
      if (c2 === 0 && c3 > 0) {
        res += 'linh ';
      }
    }

    if (c2 === 1) {
      res += 'mười ';
    } else if (c2 > 1) {
      res += DIGITS[c2] + ' mươi ';
    }

    if (c3 === 1) {
      if (c2 > 1) {
        res += 'mốt ';
      } else {
        res += 'một ';
      }
    } else if (c3 === 5) {
      if (c2 >= 1) {
        res += 'lăm ';
      } else {
        res += 'năm ';
      }
    } else if (c3 > 1) {
      res += DIGITS[c3] + ' ';
    }

    return res.trim();
  }

  function convertNumberToWords(rawNumStr, opts = {}) {
    const cleanStr = String(rawNumStr || '').replace(/[^\d]/g, '');
    if (!cleanStr) return '';
    if (cleanStr === '0') return 'Không đồng';

    const UNITS = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

    // Chia nhóm 3 số từ phải sang trái
    let groups = [];
    let s = cleanStr;
    while (s.length > 0) {
      groups.unshift(s.slice(Math.max(0, s.length - 3)));
      s = s.slice(0, Math.max(0, s.length - 3));
    }

    let parts = [];
    const totalGroups = groups.length;

    for (let i = 0; i < totalGroups; i++) {
      let g = groups[i];
      let gNum = parseInt(g, 10);
      if (gNum === 0 && totalGroups > 1) continue;

      let gPad = g.padStart(3, '0');
      let gWords = readGroupOfThree(gPad, i === 0);
      let unit = UNITS[totalGroups - 1 - i] || '';

      if (gWords) {
        parts.push(gWords + (unit ? ' ' + unit : ''));
      }
    }

    let fullStr = parts.join(' ').replace(/\s+/g, ' ').trim();

    // Hậu tố tiền tệ
    const currency = opts.currency || 'VND';
    let suffix = 'đồng';
    if (currency === 'USD') suffix = 'đô la Mỹ';
    if (currency === 'EUR') suffix = 'euro';

    if (opts.appendChan) {
      fullStr += ` ${suffix} chẵn`;
    } else if (opts.appendDotSlash) {
      fullStr += ` ${suffix}./.`;
    } else {
      fullStr += ` ${suffix}`;
    }

    // Định dạng chữ hoa
    if (opts.casing === 'upper') {
      return fullStr.toUpperCase();
    }
    // Mặc định viết hoa chữ cái đầu tiên
    return fullStr.charAt(0).toUpperCase() + fullStr.slice(1);
  }

  function formatCurrencyDisplay(rawNum) {
    const clean = String(rawNum || '').replace(/[^\d]/g, '');
    if (!clean) return '';
    return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  window.registerBatoUtilityTool({
    id: TOOL_ID,
    name: 'Đọc Số Tiền Thành Chữ (Viện Phí)',
    shortName: 'Đọc Tiền Thành Chữ',
    icon: '💰',
    category: 'Hành chính & Viện phí',
    description: 'Chuyển đổi số tiền viện phí, hóa đơn, phiếu thu sang chữ tiếng Việt chuẩn xác ngữ pháp tài chính.',

    async mount(container, ctx) {
      container.innerHTML = `
        <div class="tool-content-wrap">
          <div class="tool-header-bar">
            <div>
              <h2 class="tool-title">💰 Chuyển Đổi Số Tiền Thành Chữ Chuẩn</h2>
              <p class="tool-subtitle">Đọc số tiền viện phí, đơn thuốc, tạm ứng, thanh toán ra chữ tiếng Việt chuẩn văn thư tài chính & kế toán.</p>
            </div>
          </div>

          <div class="tool-body-grid">
            <!-- CỘT NHẬP LIỆU -->
            <div class="card form-card">
              <div class="card-head">
                <span class="card-title">💵 Nhập số tiền</span>
              </div>

              <div class="form-grid">
                <div class="form-group col-span-2">
                  <label class="form-label" for="inpMoneyRaw">
                    <span>Số tiền cần đọc <b class="req">*</b></span>
                    <span id="badgeFormattedMoney" class="badge">0 đ</span>
                  </label>
                  <input
                    type="text"
                    id="inpMoneyRaw"
                    class="inp"
                    placeholder="VD: 1530000 hoặc 1.530.000"
                    autocomplete="off"
                    style="font-size:15px; font-weight:700; color:#1e1b4b;"
                  />
                  <div class="quick-preset-chips" style="margin-top:8px;">
                    <button type="button" class="preset-chip btn-quick-money" data-amt="50000">50.000 đ</button>
                    <button type="button" class="preset-chip btn-quick-money" data-amt="100000">100.000 đ</button>
                    <button type="button" class="preset-chip btn-quick-money" data-amt="500000">500.000 đ</button>
                    <button type="button" class="preset-chip btn-quick-money" data-amt="1500000">1.500.000 đ</button>
                    <button type="button" class="preset-chip btn-quick-money" data-amt="5000000">5.000.000 đ</button>
                  </div>
                </div>

                <!-- Tùy chọn ngữ pháp & định dạng -->
                <div class="form-group">
                  <label class="form-label" for="selCurrency">Đơn vị tiền tệ</label>
                  <select id="selCurrency" class="inp">
                    <option value="VND">VNĐ (Đồng Việt Nam)</option>
                    <option value="USD">USD (Đô la Mỹ)</option>
                    <option value="EUR">EUR (Euro)</option>
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label" for="selCasing">Quy cách chữ</label>
                  <select id="selCasing" class="inp">
                    <option value="capitalize">Viết hoa chữ cái đầu (Một triệu...)</option>
                    <option value="upper">VIẾT HOA TOÀN BỘ (MỘT TRIỆU...)</option>
                    <option value="lower">viết thường toàn bộ (một triệu...)</option>
                  </select>
                </div>

                <div class="form-group col-span-2">
                  <label class="checkbox-label">
                    <input type="checkbox" id="chkAppendChan" checked />
                    <span>Thêm chữ <b>"chẵn"</b> ở cuối (Ví dụ: <i>...đồng chẵn</i>)</span>
                  </label>
                  <label class="checkbox-label" style="margin-top:6px;">
                    <input type="checkbox" id="chkAppendDotSlash" />
                    <span>Thêm ký hiệu kế toán <b>"./."</b> ở cuối (Ví dụ: <i>...đồng./.</i>)</span>
                  </label>
                </div>
              </div>

              <div class="form-actions-row" style="margin-top:14px;">
                <button type="button" id="btnCopyMoneyWords" class="btn btn-primary" title="Sao chép chữ vào Clipboard (Ctrl + Enter)">
                  📋 Sao chép chữ
                </button>
                <button type="button" id="btnResetMoney" class="btn btn-outline">
                  🔄 Xóa trắng
                </button>
              </div>
            </div>

            <!-- CỘT KẾT QUẢ & LỊCH SỬ -->
            <div class="card result-card">
              <div class="card-head">
                <span class="card-title">📝 Kết quả đọc chữ</span>
              </div>

              <div class="result-box">
                <textarea
                  id="txtMoneyWordsResult"
                  class="result-textarea"
                  rows="4"
                  readonly
                  placeholder="Chữ đọc số tiền sẽ hiển thị tại đây..."
                  style="font-size:14px; font-weight:600; line-height:1.6;"
                ></textarea>
              </div>

              <!-- Lịch sử đọc gần đây -->
              <div class="history-box" style="margin-top:14px;">
                <div class="history-head">
                  <span class="history-title">🕒 Gần đây</span>
                </div>
                <div id="moneyHistoryList" class="history-list"></div>
              </div>
            </div>
          </div>
        </div>
      `;

      const inpMoney = container.querySelector('#inpMoneyRaw');
      const badgeFormatted = container.querySelector('#badgeFormattedMoney');
      const selCurrency = container.querySelector('#selCurrency');
      const selCasing = container.querySelector('#selCasing');
      const chkChan = container.querySelector('#chkAppendChan');
      const chkDot = container.querySelector('#chkAppendDotSlash');
      const txtResult = container.querySelector('#txtMoneyWordsResult');
      const historyWrap = container.querySelector('#moneyHistoryList');

      let recentList = [];

      function updateMoneyWords() {
        const rawDigits = (inpMoney.value || '').replace(/[^\d]/g, '');
        if (!rawDigits) {
          badgeFormatted.textContent = '0 đ';
          txtResult.value = '';
          return;
        }

        const formatted = formatCurrencyDisplay(rawDigits);
        badgeFormatted.textContent = `${formatted} ${selCurrency.value}`;

        let words = convertNumberToWords(rawDigits, {
          currency: selCurrency.value,
          casing: selCasing.value,
          appendChan: chkChan.checked,
          appendDotSlash: chkDot.checked
        });

        if (selCasing.value === 'lower') {
          words = words.toLowerCase();
        }

        txtResult.value = words;
      }

      function addToHistory(formatted, words) {
        if (!formatted || !words) return;
        recentList = [{ formatted, words }, ...recentList.filter((x) => x.formatted !== formatted)].slice(0, 8);
        renderHistory();
      }

      function renderHistory() {
        if (recentList.length === 0) {
          historyWrap.innerHTML = `<div class="empty-hint">Chưa có lịch sử chuyển đổi.</div>`;
          return;
        }
        historyWrap.innerHTML = recentList
          .map(
            (item, i) => `
            <div class="history-item" data-idx="${i}">
              <div class="history-item-top">
                <b>${ctx.escapeHtml(item.formatted)} VNĐ</b>
                <button type="button" class="btn-link btn-copy-hist-money" data-idx="${i}">📋 Copy</button>
              </div>
              <div class="history-item-str">${ctx.escapeHtml(item.words)}</div>
            </div>
          `
          )
          .join('');

        historyWrap.querySelectorAll('.btn-copy-hist-money').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const item = recentList[btn.dataset.idx];
            if (item) {
              await ctx.copyTextToClipboard(item.words);
              ctx.showToast(`✅ Đã copy: "${item.words}"`);
            }
          });
        });
      }
      renderHistory();

      // Mask định dạng số khi nhập
      inpMoney.addEventListener('input', () => {
        const clean = inpMoney.value.replace(/[^\d]/g, '');
        if (clean) {
          inpMoney.value = formatCurrencyDisplay(clean);
        } else {
          inpMoney.value = '';
        }
        updateMoneyWords();
      });

      [selCurrency, selCasing, chkChan, chkDot].forEach((el) => {
        el.addEventListener('change', updateMoneyWords);
      });

      chkChan.addEventListener('change', () => {
        if (chkChan.checked) chkDot.checked = false;
        updateMoneyWords();
      });

      chkDot.addEventListener('change', () => {
        if (chkDot.checked) chkChan.checked = false;
        updateMoneyWords();
      });

      container.querySelectorAll('.btn-quick-money').forEach((btn) => {
        btn.addEventListener('click', () => {
          inpMoney.value = formatCurrencyDisplay(btn.dataset.amt);
          updateMoneyWords();
        });
      });

      async function handleCopy() {
        const text = (txtResult.value || '').trim();
        if (!text) {
          ctx.showToast('Chưa có số tiền để sao chép!', true);
          return;
        }
        const ok = await ctx.copyTextToClipboard(text);
        if (ok) {
          ctx.showToast(`✅ Đã sao chép: "${text}"`);
          addToHistory(badgeFormatted.textContent, text);
        }
      }

      container.querySelector('#btnCopyMoneyWords')?.addEventListener('click', handleCopy);

      container.querySelector('#btnResetMoney')?.addEventListener('click', () => {
        inpMoney.value = '';
        badgeFormatted.textContent = '0 đ';
        txtResult.value = '';
        inpMoney.focus();
      });

      const keyHandler = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          handleCopy();
        }
      };
      window.addEventListener('keydown', keyHandler);

      return () => {
        window.removeEventListener('keydown', keyHandler);
      };
    }
  });
})();
