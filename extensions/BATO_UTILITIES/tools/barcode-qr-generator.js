/**
 * BATO_UTILITIES - Tạo Barcode (Code 128) & QR Code Độc Lập
 * 100% Offline, không phụ thuộc bất kỳ thư viện bên ngoài hay kết nối Internet.
 * Sinh Barcode 128 chuẩn dùng cho: Mã bệnh nhân, Số vào viện, Mã đơn thuốc, Mã hồ sơ bệnh án.
 */

(function () {
  const TOOL_ID = 'barcode_generator';

  // Bảng mẫu vạch Code 128 chuẩn (107 patterns, mỗi pattern gồm độ rộng bars/spaces)
  const CODE128_PATTERNS = [
    '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
    '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
    '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
    '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
    '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
    '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
    '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
    '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
    '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
    '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
    '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
  ];

  const START_B = 104;
  const STOP = 106;

  function renderCode128Svg(text, height = 70, showText = true) {
    if (!text) return '';
    const cleanText = String(text);
    const codes = [START_B];

    for (let i = 0; i < cleanText.length; i++) {
      const charCode = cleanText.charCodeAt(i);
      if (charCode >= 32 && charCode <= 126) {
        codes.push(charCode - 32);
      }
    }

    // Checksum modulo 103
    let checksum = codes[0];
    for (let i = 1; i < codes.length; i++) {
      checksum += codes[i] * i;
    }
    codes.push(checksum % 103);
    codes.push(STOP);

    let patternString = '';
    for (let code of codes) {
      patternString += CODE128_PATTERNS[code] || '';
    }

    // Render bars
    let svgWidth = 0;
    for (let ch of patternString) {
      svgWidth += parseInt(ch, 10);
    }

    const scale = 2; // px per module
    const totalW = (svgWidth + 20) * scale;
    const totalH = height + (showText ? 24 : 8);

    let currentX = 10 * scale;
    let isBar = true;
    let rects = '';

    for (let ch of patternString) {
      const width = parseInt(ch, 10) * scale;
      if (isBar) {
        rects += `<rect x="${currentX}" y="5" width="${width}" height="${height}" fill="#000000" />`;
      }
      currentX += width;
      isBar = !isBar;
    }

    let textElement = '';
    if (showText) {
      textElement = `<text x="${totalW / 2}" y="${height + 20}" text-anchor="middle" font-family="monospace" font-size="13" font-weight="bold" fill="#0f172a">${escapeXml(cleanText)}</text>`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="100%" height="auto" style="max-height:140px; background:#ffffff; border-radius:6px; padding:6px;">${rects}${textElement}</svg>`;
  }

  function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
      }
    });
  }

  window.registerBatoUtilityTool({
    id: TOOL_ID,
    name: 'Tạo Mã Vạch (Barcode 128) & Nhãn Test',
    shortName: 'Tạo Barcode 128',
    icon: '🏷️',
    category: 'Kỹ thuật & IT',
    description: 'Sinh mã vạch Code 128 chuẩn y tế cho Mã bệnh nhân, Số vào viện, Mã đơn thuốc để test máy quét barcode hoặc in nhãn dán.',

    async mount(container, ctx) {
      container.innerHTML = `
        <div class="tool-content-wrap">
          <div class="tool-header-bar">
            <div>
              <h2 class="tool-title">🏷️ Tạo Mã Vạch Chuẩn Y Tế (Code 128)</h2>
              <p class="tool-subtitle">Tạo mã vạch Code 128 100% offline, chuẩn định dạng máy quét cầm tay bệnh viện đọc được tức thì (Mã BN, Số vào viện, Mã lưu trữ...).</p>
            </div>
          </div>

          <div class="tool-body-grid">
            <!-- CỘT NHẬP DỮ LIỆU -->
            <div class="card form-card">
              <div class="card-head">
                <span class="card-title">📝 Chuỗi ký tự mã vạch</span>
              </div>

              <div class="form-grid">
                <div class="form-group col-span-2">
                  <label class="form-label" for="inpBarcodeText">
                    <span>Nội dung chuỗi mã <b class="req">*</b></span>
                    <span id="barcodeLenBadge" class="badge">0 ký tự</span>
                  </label>
                  <input
                    type="text"
                    id="inpBarcodeText"
                    class="inp"
                    placeholder="VD: 24001925 hoặc BN000123"
                    value="24001925"
                    autocomplete="off"
                    style="font-size:15px; font-weight:700;"
                  />
                  <div class="quick-preset-chips" style="margin-top:8px;">
                    <button type="button" class="preset-chip btn-preset-bc" data-val="24001925">Mẫu Số vào viện</button>
                    <button type="button" class="preset-chip btn-preset-bc" data-val="BN005891">Mã bệnh nhân</button>
                    <button type="button" class="preset-chip btn-preset-bc" data-val="DT240509-001">Mã đơn thuốc</button>
                    <button type="button" class="preset-chip btn-preset-bc" data-val="BA-KKB-012">Mã bệnh án</button>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="selBarcodeHeight">Chiều cao vạch</label>
                  <select id="selBarcodeHeight" class="inp">
                    <option value="50">Nhỏ (50px)</option>
                    <option value="70" selected>Vừa chuẩn (70px)</option>
                    <option value="100">Lớn (100px - Dán bệnh án)</option>
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label" for="chkShowText">Hiển thị chữ số</label>
                  <select id="selShowText" class="inp">
                    <option value="yes" selected>Có hiển thị chữ bên dưới</option>
                    <option value="no">Chỉ vạch (ẩn chữ)</option>
                  </select>
                </div>
              </div>

              <div class="form-actions-row" style="margin-top:14px;">
                <button type="button" id="btnPrintBarcode" class="btn btn-primary" title="In trực tiếp nhãn mã vạch ra máy in">
                  🖨️ In nhãn mã vạch
                </button>
                <button type="button" id="btnCopyBarcodeText" class="btn btn-outline" title="Sao chép nội dung">
                  📋 Sao chép chuỗi
                </button>
              </div>

              <div class="card-note" style="margin-top:16px; font-size:12px; line-height:1.6;">
                <b>💡 Tại sao dùng chuẩn Code 128 trong Bệnh viện?</b><br/>
                Code 128 là chuẩn mã vạch công nghiệp có mật độ dữ liệu cao nhất, mã hóa được cả chữ in hoa, chữ thường và chữ số. Tất cả các đầu đọc mã vạch (súng bắn barcode HoneyWell, Datalogic, Zebex...) tại phòng khám và khoa Dược đều tương thích 100%.
              </div>
            </div>

            <!-- CỘT XEM TRƯỚC MÃ VẠCH -->
            <div class="card result-card">
              <div class="card-head">
                <span class="card-title">🔍 Bản xem trước Barcode</span>
              </div>

              <div id="barcodePreviewWrap" style="background:#ffffff; padding:18px; border-radius:8px; border:1px solid var(--border); display:flex; align-items:center; justify-content:center; min-height:180px;">
                <!-- SVG Barcode rendered here -->
              </div>

              <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:11.5px; color:#64748b;">Mẹo: Đưa máy quét barcode vào màn hình để test tín hiệu "Bíp".</span>
              </div>
            </div>
          </div>
        </div>
      `;

      const inpText = container.querySelector('#inpBarcodeText');
      const badgeLen = container.querySelector('#barcodeLenBadge');
      const selHeight = container.querySelector('#selBarcodeHeight');
      const selShow = container.querySelector('#selShowText');
      const previewWrap = container.querySelector('#barcodePreviewWrap');

      function updateBarcode() {
        const text = (inpText.value || '').trim();
        badgeLen.textContent = `${text.length} ký tự`;

        if (!text) {
          previewWrap.innerHTML = `<div class="empty-hint">Vui lòng nhập nội dung mã vạch...</div>`;
          return;
        }

        const height = parseInt(selHeight.value, 10) || 70;
        const showText = selShow.value === 'yes';
        const svg = renderCode128Svg(text, height, showText);
        previewWrap.innerHTML = svg;
      }

      inpText.addEventListener('input', updateBarcode);
      selHeight.addEventListener('change', updateBarcode);
      selShow.addEventListener('change', updateBarcode);

      container.querySelectorAll('.btn-preset-bc').forEach((btn) => {
        btn.addEventListener('click', () => {
          inpText.value = btn.dataset.val;
          updateBarcode();
        });
      });

      container.querySelector('#btnCopyBarcodeText')?.addEventListener('click', async () => {
        const text = (inpText.value || '').trim();
        if (text) {
          await ctx.copyTextToClipboard(text);
          ctx.showToast(`✅ Đã sao chép: "${text}"`);
        }
      });

      container.querySelector('#btnPrintBarcode')?.addEventListener('click', () => {
        const text = (inpText.value || '').trim();
        if (!text) {
          ctx.showToast('Chưa có mã vạch để in!', true);
          return;
        }
        const height = parseInt(selHeight.value, 10) || 70;
        const showText = selShow.value === 'yes';
        const svg = renderCode128Svg(text, height, showText);

        const printWin = window.open('', '_blank', 'width=450,height=300');
        if (printWin) {
          printWin.document.write(`
            <html>
              <head>
                <title>In nhãn Barcode: ${ctx.escapeHtml(text)}</title>
                <style>
                  body { margin: 0; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: sans-serif; }
                  @media print { body { padding: 0; } }
                </style>
              </head>
              <body>
                ${svg}
                <script>
                  window.onload = function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 500);
                  };
                <\/script>
              </body>
            </html>
          `);
          printWin.document.close();
        } else {
          ctx.showToast('Không thể mở cửa sổ in.', true);
        }
      });

      updateBarcode();

      return () => {};
    }
  });
})();
