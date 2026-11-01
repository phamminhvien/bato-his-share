/**
 * ============================================================================
 * BATO_SMART_FILL - CUSTOM JAVASCRIPT PLUGINS REGISTRY
 * ============================================================================
 * File này dành cho đội ngũ IT chuyên sâu bổ sung các hàm xử lý nâng cao
 * (can thiệp trực tiếp DOM phức tạp, Custom UI như Select2 / AntD / React,
 * gọi API bất đồng bộ async/await, xử lý Shadow DOM, v.v.) mà Script cấu hình
 * thông thường trên giao diện không đáp ứng hết.
 *
 * CÁCH THÊM PLUGIN MỚI:
 * Gọi hàm registerBatoPlugin("ma_plugin", { name, description, defaultParams, handler })
 * Sau khi lưu file này và Reload extension, Plugin sẽ tự động xuất hiện trong
 * danh sách chọn của Phương thức 4 (Plugin JS) trên giao diện Popup.
 */

(function () {
  const registry = window.BATO_PLUGINS || {};

  function registerBatoPlugin(id, pluginDef) {
    if (!id || typeof pluginDef !== 'object' || typeof pluginDef.handler !== 'function') {
      console.warn('[BATO_SMART_FILL] Định nghĩa plugin không hợp lệ:', id);
      return;
    }
    registry[id] = {
      id,
      name: pluginDef.name || id,
      description: pluginDef.description || '',
      defaultParams: pluginDef.defaultParams ?? '',
      handler: pluginDef.handler
    };
  }

  window.BATO_PLUGINS = registry;
  window.registerBatoPlugin = registerBatoPlugin;

  // --------------------------------------------------------------------------
  // PLUGIN MẪU KHUNG SƯỜN DÀNH CHO IT THAM KHẢO & MỞ RỘNG
  // --------------------------------------------------------------------------

  registerBatoPlugin('template_dom_custom', {
    name: 'Mẫu IT #1: Can thiệp DOM trực tiếp / Tùy biến nâng cao',
    description:
      'Mẫu khung dành cho IT truy cập trực tiếp triggerEl, targetEl, document và nhận tham số JSON từ giao diện.',
    defaultParams: '{"skipValues": [], "fallback": ""}',
    /**
     * @param {Object} ctx
     * @param {Element} ctx.triggerEl     - Phần tử DOM chính phát sinh sự kiện
     * @param {Element|null} ctx.targetEl - Phần tử DOM đích cần điền/chọn
     * @param {string} ctx.triggerVal     - Giá trị hiện tại của triggerEl
     * @param {string} ctx.currentVal     - Giá trị hiện tại của targetEl
     * @param {any} ctx.params            - Tham số cấu hình truyền từ giao diện Popup (Object nếu là JSON, hoặc String)
     * @param {Object} ctx.helpers        - Bộ hàm hỗ trợ: { getVal, getText, isChecked, setValue, sleep, query }
     * @returns {any | Promise<any>}
     *   - Trả về chuỗi/số/boolean: Hệ thống sẽ tự động điền/chọn giá trị đó vào targetEl.
     *   - Trả về null / undefined: Giữ nguyên, không ghi đè.
     *   - Trả về { handled: true, detail: "..." }: Báo hiệu Plugin đã tự thao tác DOM trực tiếp xong.
     */
    handler: async ({ triggerEl, targetEl, triggerVal, currentVal, params, helpers }) => {
      const cfg = typeof params === 'object' && params !== null ? params : {};

      if (Array.isArray(cfg.skipValues) && cfg.skipValues.includes(currentVal)) {
        return null;
      }

      // IT có toàn quyền dùng document, window, fetch, async/await tại đây...
      return cfg.fallback !== undefined && cfg.fallback !== '' ? cfg.fallback : null;
    }
  });

  // --------------------------------------------------------------------------
  // PLUGIN CHUYÊN DỤNG CHO SELECT2 (HỖ TRỢ CẢ SELECT2 TĨNH LẪN SELECT2 AJAX)
  // --------------------------------------------------------------------------
  registerBatoPlugin('select2_auto_select', {
    name: 'Select2: Tự động chọn mục (Hỗ trợ cả Select2 Tĩnh & Tìm kiếm AJAX)',
    description:
      'Hỗ trợ 2 chế độ: "ui_search" (tự mở ô Select2, gõ từ khóa chờ API trả danh sách rồi click chọn) hoặc "inject" (gán trực tiếp value/text qua cầu nối Select2).',
    defaultParams:
      '{"mode": "ui_search", "keyword": "Học sinh", "value": "", "skipTexts": ["Công an", "Quân đội"]}',
    handler: async ({ targetEl, currentVal, currentText, params, helpers }) => {
      if (!targetEl) return null;
      const cfg =
        typeof params === 'object' && params !== null
          ? params
          : { mode: 'ui_search', keyword: String(params || '').trim() };

      // 1. Bỏ qua nếu giá trị/nhãn hiện tại nằm trong danh sách giữ nguyên
      if (Array.isArray(cfg.skipValues) && cfg.skipValues.includes(currentVal)) return null;
      if (
        Array.isArray(cfg.skipTexts) &&
        cfg.skipTexts.some(
          (t) => currentText && currentText.toLowerCase().includes(String(t).toLowerCase())
        )
      ) {
        return null;
      }

      const keyword = String(cfg.keyword ?? cfg.text ?? '').trim();
      const val = String(cfg.value ?? '').trim();
      if (!keyword && !val) return null;

      // Chế độ A: Gán nhanh qua jQuery Select2 API (tự tạo <option> nếu là Select2 AJAX biết trước mã + tên)
      if (cfg.mode === 'inject') {
        helpers.setSelect2(targetEl, {
          value: val || keyword,
          text: keyword || val,
          createIfMissing: true
        });
        return { handled: true, detail: `Select2 inject: ${keyword || val}` };
      }

      // Chế độ B (Mặc định - ui_search): Mở ô Select2 -> gõ từ khóa -> đợi kết quả AJAX -> click chọn
      const ctrl = helpers.resolveControl(targetEl);
      const visibleBox = helpers.getVisibleEl(ctrl);
      const triggerBox =
        (visibleBox && visibleBox.querySelector && visibleBox.querySelector('.select2-selection, .select2-choice')) ||
        visibleBox;

      if (!triggerBox) {
        helpers.setSelect2(ctrl, { value: val || keyword, text: keyword || val, createIfMissing: true });
        return { handled: true };
      }

      // Mở dropdown Select2 (hỗ trợ cả v4 mousedown và v3 mousedown/click)
      triggerBox.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      triggerBox.click();
      await helpers.sleep(60);

      // Tìm ô gõ tìm kiếm đang mở của Select2
      const searchInputs = Array.from(
        document.querySelectorAll(
          '.select2-container--open input.select2-search__field, .select2-drop-active input.select2-input'
        )
      );
      const searchInp = searchInputs[searchInputs.length - 1];

      if (searchInp) {
        searchInp.focus();
        searchInp.value = keyword || val;
        searchInp.dispatchEvent(new Event('input', { bubbles: true }));
        searchInp.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
      }

      // Chờ API tìm kiếm của Select2 tải xong danh sách (tối đa 3000ms)
      const searchLower = (keyword || val).toLowerCase();
      const deadline = Date.now() + (parseInt(cfg.timeoutMs, 10) || 3000);
      let matchedItem = null;

      while (Date.now() < deadline) {
        await helpers.sleep(80);
        const loadingEl = document.querySelector(
          '.select2-results__option.loading-results, .select2-searching'
        );
        if (loadingEl) continue;

        const options = Array.from(
          document.querySelectorAll(
            '.select2-container--open .select2-results__option[role="option"], .select2-container--open .select2-results__option[role="treeitem"], .select2-drop-active .select2-result-selectable'
          )
        ).filter(
          (li) =>
            !li.classList.contains('loading-results') &&
            !li.classList.contains('select2-results__message') &&
            li.getAttribute('aria-disabled') !== 'true'
        );

        if (options.length > 0) {
          matchedItem =
            options.find((li) => li.textContent.trim().toLowerCase() === searchLower) ||
            options.find((li) => li.textContent.trim().toLowerCase().includes(searchLower)) ||
            (cfg.pickFirstIfFound ? options[0] : null);
          if (matchedItem) break;
        }
      }

      if (matchedItem) {
        matchedItem.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        matchedItem.click();
        return { handled: true, detail: `Đã chọn Select2: ${matchedItem.textContent.trim()}` };
      }

      // Đóng dropdown nếu không tìm thấy để không che giao diện
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return null;
    }
  });
})();
