/**
 * BATO_UTILITIES - Chuẩn hóa & Xử lý văn bản Y tế / HIS
 * Phục vụ bác sĩ, điều dưỡng, văn thư, IT bệnh viện:
 * 1. Chuyển đổi bảng mã tiếng Việt cũ: TCVN3 (ABC), VNI sang Unicode chuẩn
 * 2. Chuẩn hóa Họ và Tên (Viết hoa chữ đầu, xóa dấu cách thừa)
 * 3. Bỏ dấu tiếng Việt (chuẩn ký tự không dấu cho XML BHYT, tên file)
 * 4. Đổi kiểu chữ (IN HOA, in thường, Title Case)
 * 5. Thống kê số ký tự, số từ, độ dài chuỗi
 */

(function () {
  const TOOL_ID = 'text_cleaner';

  // Bảng mã TCVN3 -> Unicode
  const TCVN3_CHARS = [
    'a', '¸', 'µ', '¶', '·', '¹', '©', '¾', '»', '¼', '½', 'Æ', '¨', '¾', '»', '¼', '½', 'Æ',
    'e', 'Ð', 'Ì', 'Î', 'Ï', 'Ñ', 'ª', 'Õ', 'Ò', 'Ó', 'Ô', 'Ö',
    'o', 'ã', 'á', 'â', 'ä', 'å', '«', 'è', 'æ', 'ç', 'é', 'ê', '¬', 'í', 'ë', 'ì', 'î', 'ï',
    'u', 'ó', 'ñ', 'ò', 'õ', 'ö', '®', 'ø', 'ù', 'ú', 'û', 'ü',
    'i', 'Ý', 'Þ', 'ß', 'á', 'í',
    'y', 'ý', 'þ', 'ÿ', '¡', '¢',
    'd', '®'
  ];

  // Chuyển TCVN3 sang Unicode
  function tcvn3ToUnicode(str) {
    const tcvnMap = {
      '¸': 'á', 'µ': 'à', '¶': 'ả', '·': 'ã', '¹': 'ạ',
      '©': 'ê', 'Ð': 'é', 'Ì': 'è', 'Î': 'ẻ', 'Ï': 'ẽ', 'Ñ': 'ẹ',
      'Õ': 'ế', 'Ò': 'ề', 'Ó': 'ể', 'Ô': 'ễ', 'Ö': 'ệ',
      '«': 'ô', 'ã': 'ó', 'á': 'ò', 'â': 'ỏ', 'ä': 'õ', 'å': 'ọ',
      'è': 'ố', 'æ': 'ồ', 'ç': 'ổ', 'é': 'ỗ', 'ê': 'ộ',
      '¬': 'ơ', 'í': 'ớ', 'ë': 'ờ', 'ì': 'ở', 'î': 'ỡ', 'ï': 'ợ',
      '®': 'đ', 'ó': 'ú', 'ñ': 'ù', 'ò': 'ủ', 'õ': 'ũ', 'ö': 'ụ',
      'ø': 'ứ', 'ù': 'ừ', 'ú': 'ử', 'û': 'ữ', 'ü': 'ự',
      'Ý': 'í', 'Þ': 'ì', 'ß': 'ỉ', 'á': 'ĩ', 'í': 'ị',
      'ý': 'ý', 'þ': 'ỳ', 'ÿ': 'ỷ', '¡': 'ỹ', '¢': 'ỵ',
      '¨': 'ă', '¾': 'ắ', '»': 'ằ', '¼': 'ẳ', '½': 'ẵ', 'Æ': 'ặ'
    };
    return String(str || '').replace(/[¸µ¶·¹©ÐÌÎÏÑÕÒÓÔÖ«ãáâäåèæçéê¬íëìîï®óñòõöøùúûüÝÞßáíýþÿ¡¢¨¾»¼½Æ]/g, (m) => tcvnMap[m] || m);
  }

  // Bỏ dấu tiếng Việt
  function removeAccents(str) {
    return String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  // Chuẩn hóa Họ và tên
  function normalizeName(str) {
    return String(str || '')
      .trim()
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // Chuẩn hóa câu / dấu cách
  function cleanSpaces(str) {
    return String(str || '')
      .replace(/[ \t]+/g, ' ')
      .replace(/ ?([,.:;?!]) ?/g, '$1 ')
      .replace(/\s+\n/g, '\n')
      .trim();
  }

  window.registerBatoUtilityTool({
    id: TOOL_ID,
    name: 'Chuẩn Hóa & Xử Lý Văn Bản Y Tế',
    shortName: 'Xử lý văn bản Y tế',
    icon: '✍️',
    category: 'Hành chính & Viện phí',
    description: 'Chuyển font cũ TCVN3/VNI sang Unicode, chuẩn hóa Họ tên, bỏ dấu (chuẩn XML BHYT), viết HOA/thường.',

    async mount(container, ctx) {
      container.innerHTML = `
        <div class="tool-content-wrap">
          <div class="tool-header-bar">
            <div>
              <h2 class="tool-title">✍️ Chuẩn Hóa & Chuyển Đổi Văn Bản Y Tế</h2>
              <p class="tool-subtitle">Chuyển mã font lỗi, làm sạch dấu câu, định dạng Họ tên bệnh nhân và loại bỏ dấu tiếng Việt phục vụ xuất hồ sơ XML BHYT.</p>
            </div>
          </div>

          <div class="tool-body-grid">
            <!-- CỘT NHẬP VĂN BẢN -->
            <div class="card form-card">
              <div class="card-head">
                <span class="card-title">📝 Văn bản gốc</span>
                <span id="txtStatsBadge" class="badge">0 ký tự | 0 từ</span>
              </div>

              <div class="result-box">
                <textarea id="txtRawInput" class="result-textarea" rows="7" placeholder="Dán văn bản cần xử lý vào đây... (Ví dụ: tên bệnh nhân, đoạn mô tả bệnh án lỗi font, danh sách...)"></textarea>
              </div>

              <div class="form-actions-row" style="margin-top:12px; flex-wrap:wrap; gap:6px;">
                <button type="button" id="btnFixFont" class="btn btn-outline" title="Chuyển mã font cũ TCVN3 (.VnTime) sang Unicode chuẩn">
                  🔤 Sửa lỗi Font TCVN3
                </button>
                <button type="button" id="btnNormalizeName" class="btn btn-outline" title="Chuẩn hóa họ tên: Xóa khoảng trắng thừa, viết hoa chữ cái đầu">
                  👤 Chuẩn hóa Họ Tên
                </button>
                <button type="button" id="btnRemoveAccents" class="btn btn-outline" title="Bỏ toàn bộ dấu tiếng Việt (chuẩn XML BHYT)">
                  🔡 Bỏ dấu tiếng Việt
                </button>
                <button type="button" id="btnCleanSpacing" class="btn btn-outline" title="Xóa khoảng trắng thừa & chuẩn hóa dấu câu">
                  🧹 Làm sạch khoảng trắng
                </button>
                <button type="button" id="btnUpper" class="btn btn-outline">
                  🔠 IN HOA
                </button>
                <button type="button" id="btnLower" class="btn btn-outline">
                  🔡 in thường
                </button>
              </div>
            </div>

            <!-- CỘT KẾT QUẢ VĂN BẢN -->
            <div class="card result-card">
              <div class="card-head">
                <span class="card-title">✨ Kết quả sau xử lý</span>
                <button type="button" id="btnCopyCleaned" class="btn btn-sm btn-primary">
                  📋 Sao chép
                </button>
              </div>

              <div class="result-box">
                <textarea id="txtCleanedOutput" class="result-textarea" rows="7" readonly placeholder="Kết quả sau khi chuẩn hóa sẽ xuất hiện tại đây..."></textarea>
              </div>

              <div class="card-note" style="margin-top:14px; font-size:12px; line-height:1.6;">
                <b>💡 Ứng dụng thực tế tại bệnh viện:</b>
                <ul style="padding-left:18px; margin-top:4px; color:#475569;">
                  <li><b>Lỗi font TCVN3</b>: Khi copy kết quả từ các máy cận lâm sàng (máy xét nghiệm sinh hóa, huyết học, đo điện tim) dùng phần mềm thời cũ hiển thị chữ ngoằn ngoèo.</li>
                  <li><b>Bỏ dấu</b>: Tạo mã không dấu cho thư mục lưu trữ, mã hóa file XML theo Quyết định 130/QĐ-BYT gửi cổng BHXH.</li>
                  <li><b>Chuẩn hóa Họ Tên</b>: Chỉnh sửa nhanh khi nhân viên tiếp đón gõ ẩu hoặc chữ in chữ thường lộn xộn.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      `;

      const inpRaw = container.querySelector('#txtRawInput');
      const outClean = container.querySelector('#txtCleanedOutput');
      const statsBadge = container.querySelector('#txtStatsBadge');

      function updateStats() {
        const text = inpRaw.value || '';
        const charCount = text.length;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        statsBadge.textContent = `${charCount} ký tự | ${words} từ`;
      }

      inpRaw.addEventListener('input', () => {
        updateStats();
        // Mặc định phản chiếu sang output nếu chưa bấm nút
        if (!outClean.value || outClean.value === inpRaw.value.slice(0, -1)) {
          outClean.value = inpRaw.value;
        }
      });

      container.querySelector('#btnFixFont')?.addEventListener('click', () => {
        const res = tcvn3ToUnicode(inpRaw.value);
        outClean.value = res;
        ctx.showToast('✅ Đã sửa lỗi mã font TCVN3 sang Unicode!');
      });

      container.querySelector('#btnNormalizeName')?.addEventListener('click', () => {
        const lines = inpRaw.value.split('\n');
        const res = lines.map((l) => normalizeName(l)).join('\n');
        outClean.value = res;
        ctx.showToast('✅ Đã chuẩn hóa Họ và Tên!');
      });

      container.querySelector('#btnRemoveAccents')?.addEventListener('click', () => {
        const res = removeAccents(inpRaw.value);
        outClean.value = res;
        ctx.showToast('✅ Đã loại bỏ toàn bộ dấu tiếng Việt!');
      });

      container.querySelector('#btnCleanSpacing')?.addEventListener('click', () => {
        const res = cleanSpaces(inpRaw.value);
        outClean.value = res;
        ctx.showToast('✅ Đã làm sạch dấu câu và khoảng trắng thừa!');
      });

      container.querySelector('#btnUpper')?.addEventListener('click', () => {
        outClean.value = inpRaw.value.toUpperCase();
        ctx.showToast('✅ Đã chuyển sang IN HOA!');
      });

      container.querySelector('#btnLower')?.addEventListener('click', () => {
        outClean.value = inpRaw.value.toLowerCase();
        ctx.showToast('✅ Đã chuyển sang in thường!');
      });

      container.querySelector('#btnCopyCleaned')?.addEventListener('click', async () => {
        const text = outClean.value;
        if (!text) {
          ctx.showToast('Chưa có nội dung để sao chép!', true);
          return;
        }
        await ctx.copyTextToClipboard(text);
        ctx.showToast('📋 Đã sao chép văn bản vào Clipboard!');
      });

      return () => {};
    }
  });
})();
