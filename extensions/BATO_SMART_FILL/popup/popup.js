/**
 * BATO_SMART_FILL - Right-Side Panel Controller
 * Tác giả: Vien Pham (https://www.facebook.com/phamminhvien)
 *
 * Cấu trúc phân cấp:
 * - Cấp ngoài: Danh sách Kịch bản (URL thực thi + Element chính bắt sự kiện)
 * - Cấp trong: Danh sách Rule hiển thị dạng Table; click vào từng dòng mở Popup tùy chỉnh
 *   với Dropdown chọn 1 trong 4 phương thức độc lập cho từng phần tử:
 *     1. fixed   - Tự động theo giá trị cố định được cài đặt
 *     2. mapping - Tự động theo bảng điều kiện (tùy chỉnh Element đối chiếu)
 *     3. script  - Tự động theo Rule dựa vào Script được cài đặt
 *     4. plugin  - Tự động theo Plugin JavaScript chung (plugins/custom-plugins.js)
 */

(function () {
  // ==========================================================================
  // MẪU KHUNG SCRIPT TỔNG QUÁT CHO PHƯƠNG THỨC 3
  // ==========================================================================
  const SCRIPT_TEMPLATES = {
    basic_if: `(triggerVal) => {
  const val = String(triggerVal || "").trim();
  if (val === "GIA_TRI_A") return "KET_QUA_1";
  if (val === "GIA_TRI_B") return "KET_QUA_2";
  return null; // null = Giữ nguyên không thay đổi
}`,

    keep_existing: `(triggerVal, { currentVal }) => {
  // Danh sách các giá trị hiện tại không cần thay đổi
  const giuNguyen = ["OPTION_1", "OPTION_2"];
  if (giuNguyen.includes(currentVal)) {
    return null;
  }

  return triggerVal ? "GIA_TRI_MOI" : null;
}`,

    read_other_elements: `(triggerVal, { currentVal, getVal, isChecked }) => {
  // Đọc giá trị từ một hoặc nhiều element khác trên trang
  const otherVal = Number(getVal("#id_element_khac") || triggerVal);
  const flag = isChecked("#id_checkbox");

  if (flag) return "GIA_TRI_UU_TIEN";
  if (!Number.isNaN(otherVal) && otherVal < 18) return "NHOM_1";
  return "NHOM_2";
}`
  };

  const MODE_BADGES = {
    fixed: { label: 'Cố định', cls: 'fixed' },
    mapping: { label: 'Bảng ĐK', cls: 'mapping' },
    script: { label: 'Script', cls: 'script' },
    plugin: { label: 'Plugin JS', cls: 'plugin' }
  };

  // ==========================================================================
  // STATE QUẢN LÝ GIAO DIỆN
  // ==========================================================================
  let state = {
    enabled: true,
    showToast: true,
    scenarios: [],
    activeTab: null,
    currentFilter: 'all', // 'all' | 'current'
    editingScenario: null, // Kịch bản đang chỉnh sửa
    activeRuleModal: null // { rowIndex: number | null, isNewRow: boolean, ruleData: Object }
  };

  // Sandbox runner cho nút "Chạy thử Script" trong Modal
  const sandboxFrame = document.getElementById('popupSandboxFrame');
  const pendingSandboxMap = new Map();
  let sandboxSeq = 0;

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.type !== 'BATO_SANDBOX_RESULT') return;
    const cb = pendingSandboxMap.get(data.requestId);
    if (cb) {
      pendingSandboxMap.delete(data.requestId);
      cb(data);
    }
  });

  function runPopupSandboxEval(scriptCode, triggerVal, contextData) {
    return new Promise((resolve) => {
      const requestId = `popup_test_${Date.now()}_${++sandboxSeq}`;
      const timer = setTimeout(() => {
        pendingSandboxMap.delete(requestId);
        resolve({ ok: false, error: 'Quá thời gian chạy thử (> 3s)' });
      }, 3000);

      pendingSandboxMap.set(requestId, (res) => {
        clearTimeout(timer);
        resolve(res);
      });

      sandboxFrame.contentWindow.postMessage(
        {
          type: 'BATO_SANDBOX_EVAL',
          requestId,
          scriptCode,
          triggerVal,
          contextData
        },
        '*'
      );
    });
  }

  // ==========================================================================
  // TIỆN ÍCH CHUNG
  // ==========================================================================
  function uid(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function matchUrlPattern(url, pattern) {
    if (!url || !pattern) return false;
    const raw = String(pattern).trim();
    if (!raw || raw === '*' || raw === '<all_urls>') return true;

    if (raw.length > 2 && raw.startsWith('/') && raw.endsWith('/')) {
      try {
        return new RegExp(raw.slice(1, -1), 'i').test(url);
      } catch (_) {
        return false;
      }
    }

    if (raw.includes('*')) {
      const escaped = raw
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
      try {
        return new RegExp(`^${escaped}$`, 'i').test(url) || new RegExp(escaped, 'i').test(url);
      } catch (_) {
        return false;
      }
    }

    return url.toLowerCase().includes(raw.toLowerCase());
  }

  function getAvailablePluginsList() {
    const reg = window.BATO_PLUGINS || {};
    return Object.keys(reg).map((k) => reg[k]);
  }

  function createEmptyMappingRow() {
    return {
      sourceSelector: '', // Để trống = Element chính (Trigger)
      operator: 'eq',
      matchValue: '',
      resultAction: 'fill', // 'fill' | 'keep'
      outputValue: ''
    };
  }

  function createEmptyRuleItem() {
    return {
      id: uid('rule'),
      enabled: true,
      selector: '',
      actionType: 'auto',
      delayMs: 0,
      mode: 'fixed', // 'fixed' | 'mapping' | 'script' | 'plugin'
      onlyIfEmpty: false,
      keepValues: '',
      fixedValue: ''
    };
  }

  /**
   * Lọc sạch dữ liệu Rule: chỉ giữ lại các thuộc tính của đúng 1 phương thức đang chọn (mode),
   * loại bỏ hoàn toàn các trường rác/nháp của các phương thức không sử dụng.
   */
  function sanitizeRuleItem(rawRule) {
    const r = rawRule && typeof rawRule === 'object' ? rawRule : {};
    const mode = ['fixed', 'mapping', 'script', 'plugin'].includes(r.mode) ? r.mode : 'fixed';
    const clean = {
      id: r.id || uid('rule'),
      enabled: r.enabled !== false,
      selector: String(r.selector ?? '').trim(),
      actionType: r.actionType || 'auto',
      delayMs: Math.max(0, parseInt(r.delayMs, 10) || 0),
      mode
    };

    if (mode === 'fixed') {
      clean.fixedValue = String(r.fixedValue ?? '');
      clean.keepValues = String(r.keepValues ?? '').trim();
      clean.onlyIfEmpty = Boolean(r.onlyIfEmpty);
    } else if (mode === 'mapping') {
      const rawMappings =
        Array.isArray(r.mappings) && r.mappings.length > 0
          ? r.mappings
          : [createEmptyMappingRow()];
      clean.mappings = rawMappings.map((m) => {
        const act = m && m.resultAction === 'keep' ? 'keep' : 'fill';
        const op = (m && m.operator) || 'eq';
        const noMatchVal = op === 'empty' || op === 'not_empty';
        return {
          sourceSelector: String((m && m.sourceSelector) ?? '').trim(),
          operator: op,
          matchValue: noMatchVal ? '' : String((m && m.matchValue) ?? ''),
          resultAction: act,
          outputValue: act === 'keep' ? '' : String((m && m.outputValue) ?? '')
        };
      });
      clean.mappingFallbackMode = r.mappingFallbackMode === 'fixed' ? 'fixed' : 'keep';
      clean.mappingFallbackValue =
        clean.mappingFallbackMode === 'fixed' ? String(r.mappingFallbackValue ?? '') : '';
    } else if (mode === 'script') {
      clean.scriptCode = String(r.scriptCode ?? '');
    } else if (mode === 'plugin') {
      clean.pluginName = String(r.pluginName ?? '').trim();
      clean.pluginParams = String(r.pluginParams ?? '');
    }

    return clean;
  }

  function sanitizeScenario(rawScn) {
    const s = rawScn && typeof rawScn === 'object' ? rawScn : {};
    const targets = Array.isArray(s.targets) ? s.targets.map(sanitizeRuleItem) : [];
    return {
      id: s.id || uid('scn'),
      name: String(s.name ?? '').trim(),
      enabled: s.enabled !== false,
      urlPattern: String(s.urlPattern ?? '').trim(),
      triggerSelector: String(s.triggerSelector ?? '').trim(),
      triggerEvent: s.triggerEvent || 'auto',
      triggerWaitMs: Math.max(0, parseInt(s.triggerWaitMs, 10) || 0),
      waitForSettled: s.waitForSettled !== false,
      maxSettleMs: Math.max(200, parseInt(s.maxSettleMs, 10) || 3000),
      targets
    };
  }

  /**
   * Tạo dấu vân tay cấu hình chuẩn (Fingerprint) cho Kịch bản để kiểm tra trùng lặp:
   * So sánh toàn bộ URL, Trigger, Sự kiện, Danh sách Rule, Element đích & chi tiết cấu hình,
   * KHÔNG phân biệt tên Kịch bản (name) và mã định danh (id).
   */
  function buildScenarioFingerprint(rawScn) {
    const s = sanitizeScenario(rawScn);
    const canonicalTargets = s.targets.map((t) => {
      const base = {
        selector: t.selector,
        actionType: t.actionType,
        delayMs: t.delayMs,
        mode: t.mode
      };
      if (t.mode === 'fixed') {
        base.fixedValue = t.fixedValue.trim();
        base.keepValues = t.keepValues;
        base.onlyIfEmpty = t.onlyIfEmpty;
      } else if (t.mode === 'mapping') {
        base.mappings = t.mappings.map((m) => ({
          sourceSelector: m.sourceSelector,
          operator: m.operator,
          matchValue: m.matchValue.trim(),
          resultAction: m.resultAction,
          outputValue: m.outputValue.trim()
        }));
        base.mappingFallbackMode = t.mappingFallbackMode;
        base.mappingFallbackValue = t.mappingFallbackValue.trim();
      } else if (t.mode === 'script') {
        base.scriptCode = t.scriptCode.replace(/\r\n/g, '\n').trim();
      } else if (t.mode === 'plugin') {
        base.pluginName = t.pluginName;
        base.pluginParams = t.pluginParams.replace(/\r\n/g, '\n').trim();
      }
      return base;
    });

    return JSON.stringify({
      urlPattern: s.urlPattern.toLowerCase(),
      triggerSelector: s.triggerSelector,
      triggerEvent: s.triggerEvent,
      triggerWaitMs: s.triggerWaitMs,
      waitForSettled: s.waitForSettled,
      maxSettleMs: s.waitForSettled ? s.maxSettleMs : 0,
      targets: canonicalTargets
    });
  }

  function normalizeScenarioName(name) {
    return String(name ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  function generateUniqueScenarioName(baseName, usedNormNamesSet) {
    const trimmed = String(baseName || 'Kịch bản mới').trim();
    if (!usedNormNamesSet.has(normalizeScenarioName(trimmed))) {
      return trimmed;
    }
    const rootName = trimmed.replace(/\s*\(\d+\)$/, '').trim() || 'Kịch bản mới';
    let counter = 2;
    while (usedNormNamesSet.has(normalizeScenarioName(`${rootName} (${counter})`))) {
      counter++;
    }
    return `${rootName} (${counter})`;
  }

  /**
   * Hiển thị hộp thoại hỏi người dùng cách xử lý khi Nhập file JSON gặp kịch bản trùng tên (nhưng khác cấu hình Rule)
   * Trả về Promise<'overwrite' | 'keep_both' | 'cancel'>
   */
  function askImportNameConflictChoice(conflictNames) {
    return new Promise((resolve) => {
      const overlay = document.getElementById('importConflictOverlay');
      const titleEl = document.getElementById('importConflictTitle');
      const bodyEl = document.getElementById('importConflictBody');
      const btnClose = document.getElementById('btnCloseConflictModal');
      const btnCancel = document.getElementById('btnConflictCancel');
      const btnKeep = document.getElementById('btnConflictKeepBoth');
      const btnOverwrite = document.getElementById('btnConflictOverwrite');

      titleEl.textContent = `⚠️ Phát hiện ${conflictNames.length} kịch bản trùng tên`;
      const namesListHtml = conflictNames
        .slice(0, 8)
        .map((n) => `<li style="margin: 3px 0; font-weight: 600; color: #0f172a;">${escapeHtml(n)}</li>`)
        .join('');
      const moreHtml =
        conflictNames.length > 8
          ? `<li style="color:#64748b;">...và ${conflictNames.length - 8} kịch bản khác</li>`
          : '';

      bodyEl.innerHTML = `
        <div style="font-size: 12.5px; line-height: 1.5; color: #334155;">
          Các kịch bản dưới đây có <b>cùng tên</b> với kịch bản đang có trong máy nhưng <b>khác cấu hình Rule bên trong</b>:
          <ul style="margin: 8px 0 10px 18px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 7px 10px 7px 24px;">
            ${namesListHtml}
            ${moreHtml}
          </ul>
          Bạn muốn xử lý như thế nào?
        </div>
      `;

      overlay.classList.remove('hidden');

      const finish = (choice) => {
        overlay.classList.add('hidden');
        btnClose.removeEventListener('click', onCancel);
        btnCancel.removeEventListener('click', onCancel);
        btnKeep.removeEventListener('click', onKeep);
        btnOverwrite.removeEventListener('click', onOverwrite);
        document.removeEventListener('keydown', onEsc);
        resolve(choice);
      };

      const onCancel = () => finish('cancel');
      const onKeep = () => finish('keep_both');
      const onOverwrite = () => finish('overwrite');
      const onEsc = (ev) => {
        if (ev.key === 'Escape') finish('cancel');
      };

      btnClose.addEventListener('click', onCancel);
      btnCancel.addEventListener('click', onCancel);
      btnKeep.addEventListener('click', onKeep);
      btnOverwrite.addEventListener('click', onOverwrite);
      document.addEventListener('keydown', onEsc);
    });
  }

  function createEmptyScenario(defaultUrl = '') {
    return {
      id: uid('scn'),
      isNew: true,
      name: '',
      enabled: true,
      urlPattern: defaultUrl,
      triggerSelector: '',
      triggerEvent: 'auto',
      triggerWaitMs: 0,
      waitForSettled: true,
      maxSettleMs: 3000,
      targets: []
    };
  }

  function summarizeRuleConfig(ruleItem) {
    const mode = ruleItem.mode || 'fixed';
    if (mode === 'fixed') {
      const val = String(ruleItem.fixedValue ?? '').trim();
      return val !== '' ? `Giá trị: "${val}"` : '(Điền rỗng)';
    }
    if (mode === 'mapping') {
      const count = Array.isArray(ruleItem.mappings) ? ruleItem.mappings.length : 0;
      return `${count} điều kiện đối chiếu`;
    }
    if (mode === 'script') {
      const firstLine = String(ruleItem.scriptCode || '')
        .split('\n')
        .map((s) => s.trim())
        .find((s) => s && !s.startsWith('//'));
      return firstLine || 'Script tùy chỉnh';
    }
    if (mode === 'plugin') {
      return `Plugin: ${ruleItem.pluginName || '(Chưa chọn)'}`;
    }
    return '';
  }

  // ==========================================================================
  // KHỞI TẠO & ĐỒNG BỘ THỜI GIAN THỰC TRÊN SIDE PANEL
  // ==========================================================================
  async function refreshActiveTab() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      state.activeTab = tabs && tabs[0] ? tabs[0] : null;
      renderHeader();
      if (!state.editingScenario) {
        renderScenariosList();
      }
    } catch (_) {}
  }

  async function initPopup() {
    await refreshActiveTab();

    const store = await chrome.storage.local.get(['enabled', 'showToast', 'rules', 'editorDraft']);
    state.enabled = store.enabled !== false;
    state.showToast = store.showToast !== false;
    const rawStoredRules = Array.isArray(store.rules) ? store.rules : [];
    state.scenarios = rawStoredRules.map(sanitizeScenario);

    // Làm sạch luôn dữ liệu cũ còn sót trường thừa trong storage (nếu có)
    if (JSON.stringify(rawStoredRules) !== JSON.stringify(state.scenarios)) {
      await chrome.storage.local.set({ rules: state.scenarios });
    }

    bindStaticEvents();
    bindRealtimeListeners();
    renderHeader();

    if (store.editorDraft) {
      const draft = store.editorDraft;
      const savedModal = draft.activeRuleModal || null;
      delete draft.activeRuleModal;
      openScenarioEditor(draft, false);
      if (savedModal && savedModal.ruleData) {
        openRuleModal(savedModal.rowIndex, savedModal.isNewRow, savedModal.ruleData, false);
      }
    } else {
      showScenariosListView();
    }
  }

  function showPickerNotice(selector) {
    const bar = document.getElementById('pickerNoticeBar');
    const txt = document.getElementById('pickerNoticeText');
    txt.textContent = `✅ Đã lấy selector: ${selector}`;
    bar.classList.remove('hidden');
  }

  function bindRealtimeListeners() {
    // Nhận selector trực tiếp khi người dùng click chọn phần tử trên trang web bên trái
    chrome.runtime.onMessage.addListener((message) => {
      if (message && message.type === 'BATO_DRAFT_UPDATED_FROM_PICKER' && message.draft) {
        showPickerNotice(message.selector);
        const draft = message.draft;
        const savedModal = draft.activeRuleModal || null;
        delete draft.activeRuleModal;

        openScenarioEditor(draft, false);
        if (savedModal && savedModal.ruleData) {
          openRuleModal(savedModal.rowIndex, savedModal.isNewRow, savedModal.ruleData, false);
        }
      }
    });

    chrome.tabs.onActivated.addListener(() => refreshActiveTab());
    chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
      if (changeInfo.status === 'complete' || changeInfo.url) {
        refreshActiveTab();
      }
    });
  }

  // ==========================================================================
  // RENDER HEADER & DANH SÁCH KỊCH BẢN
  // ==========================================================================
  function renderHeader() {
    const chkGlobal = document.getElementById('chkGlobalEnabled');
    const lblStatus = document.getElementById('globalStatusLabel');
    const pageInfo = document.getElementById('pageMatchInfo');
    const badgeCount = document.getElementById('scenariosCountBadge');
    const chkToast = document.getElementById('chkShowToast');

    if (chkGlobal) chkGlobal.checked = state.enabled;
    if (lblStatus) {
      lblStatus.textContent = state.enabled ? 'ĐANG BẬT' : 'TẠM TẮT';
      lblStatus.classList.toggle('active', state.enabled);
    }
    if (chkToast) chkToast.checked = state.showToast;
    if (badgeCount) badgeCount.textContent = String(state.scenarios.length);

    const url = state.activeTab && state.activeTab.url ? state.activeTab.url : '';
    const matched = state.scenarios.filter(
      (s) => s.enabled !== false && matchUrlPattern(url, s.urlPattern)
    );

    if (!pageInfo) return;
    if (!state.enabled) {
      pageInfo.textContent = 'Tiện ích đang tạm tắt toàn cục';
      pageInfo.classList.remove('matched');
    } else if (matched.length > 0) {
      pageInfo.textContent = `⚡ ${matched.length} kịch bản đang hoạt động trên trang này`;
      pageInfo.classList.add('matched');
    } else {
      pageInfo.textContent = 'Chưa có kịch bản nào khớp với trang hiện tại';
      pageInfo.classList.remove('matched');
    }
  }

  function showScenariosListView() {
    state.editingScenario = null;
    closeRuleModal(false);
    document.getElementById('viewScenarioEditor').classList.add('hidden');
    document.getElementById('viewScenariosList').classList.remove('hidden');
    renderScenariosList();
  }

  function renderScenariosList() {
    const container = document.getElementById('scenariosContainer');
    const activeUrl = state.activeTab && state.activeTab.url ? state.activeTab.url : '';

    let list = state.scenarios.slice();
    if (state.currentFilter === 'current') {
      list = list.filter((s) => matchUrlPattern(activeUrl, s.urlPattern));
    }

    if (list.length === 0) {
      container.innerHTML = `
        <div class="empty-box">
          <h4>${
            state.currentFilter === 'current'
              ? 'Chưa có kịch bản nào cho trang web này'
              : 'Chưa có kịch bản tự động nào'
          }</h4>
          <p>
            Tạo một Kịch bản để bắt sự kiện từ Element chính và thực thi Danh sách Rule
            tự động điền/chọn dữ liệu tương ứng.
          </p>
          <button type="button" id="btnEmptyCreate" class="btn btn-primary">＋ Tạo Kịch bản đầu tiên</button>
        </div>
      `;
      document.getElementById('btnEmptyCreate')?.addEventListener('click', handleCreateNewScenario);
      return;
    }

    container.innerHTML = list
      .map((scn) => {
        const isMatched = matchUrlPattern(activeUrl, scn.urlPattern);
        const allTargets = Array.isArray(scn.targets) ? scn.targets : [];
        const rulesCount = allTargets.length;
        const activeRulesCount = allTargets.filter((t) => t && t.enabled !== false).length;
        const ruleCountLabel =
          activeRulesCount === rulesCount
            ? `${rulesCount} Rule`
            : `${activeRulesCount}/${rulesCount} Rule bật`;

        return `
          <div class="scenario-card ${scn.enabled === false ? 'disabled' : ''}">
            <div class="scenario-card-top">
              <div class="scenario-title-group">
                <span class="scenario-name" title="${escapeHtml(scn.name || 'Kịch bản không tên')}">
                  ${escapeHtml(scn.name || 'Kịch bản không tên')}
                </span>
                ${isMatched ? '<span class="badge badge-match">Khớp trang này</span>' : ''}
              </div>
              <label class="switch-wrap" title="Bật / Tắt kịch bản này">
                <input type="checkbox" class="js-toggle-scn" data-id="${escapeHtml(scn.id)}" ${
          scn.enabled !== false ? 'checked' : ''
        } />
                <span class="slider"></span>
              </label>
            </div>

            <div class="scenario-meta">
              <span class="meta-tag mono" title="URL: ${escapeHtml(scn.urlPattern)}">🌐 ${escapeHtml(
          scn.urlPattern || '*'
        )}</span>
              <span class="meta-tag mono" title="Trigger: ${escapeHtml(scn.triggerSelector)}">⚡ ${escapeHtml(
          scn.triggerSelector
        )} (${escapeHtml(scn.triggerEvent || 'auto')})</span>
              <span class="meta-tag">📑 ${ruleCountLabel}</span>
            </div>

            <div class="scenario-actions">
              <span style="font-size:11px; color:#64748b;">
                ${scn.enabled !== false ? '🟢 Đang kích hoạt' : '⚪ Đang tạm dừng'}
              </span>
              <div class="scenario-btn-group">
                <button type="button" class="btn btn-outline btn-xs js-edit-scn" data-id="${escapeHtml(
                  scn.id
                )}">✏️ Chỉnh sửa</button>
                <button type="button" class="btn btn-ghost btn-xs js-dup-scn" data-id="${escapeHtml(
                  scn.id
                )}" title="Nhân bản kịch bản">📑 Nhân bản</button>
                <button type="button" class="btn btn-danger-ghost btn-xs js-del-scn" data-id="${escapeHtml(
                  scn.id
                )}" title="Xóa kịch bản">🗑️</button>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    container.querySelectorAll('.js-toggle-scn').forEach((chk) => {
      chk.addEventListener('change', async (e) => {
        const found = state.scenarios.find((s) => s.id === e.target.dataset.id);
        if (found) {
          found.enabled = e.target.checked;
          await chrome.storage.local.set({ rules: state.scenarios });
          renderHeader();
          renderScenariosList();
        }
      });
    });

    container.querySelectorAll('.js-edit-scn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const found = state.scenarios.find((s) => s.id === btn.dataset.id);
        if (found) {
          const clone = JSON.parse(JSON.stringify(found));
          clone.isNew = false;
          openScenarioEditor(clone, true);
        }
      });
    });

    container.querySelectorAll('.js-dup-scn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const found = state.scenarios.find((s) => s.id === btn.dataset.id);
        if (found) {
          const copy = sanitizeScenario(found);
          copy.id = uid('scn');
          const usedNormNames = new Set(state.scenarios.map((s) => normalizeScenarioName(s.name)));
          copy.name = generateUniqueScenarioName(`${copy.name || 'Kịch bản'} (Bản sao)`, usedNormNames);
          state.scenarios.unshift(copy);
          await chrome.storage.local.set({ rules: state.scenarios });
          renderHeader();
          renderScenariosList();
        }
      });
    });

    container.querySelectorAll('.js-del-scn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const found = state.scenarios.find((s) => s.id === id);
        if (!found) return;
        if (confirm(`Bạn có chắc muốn xóa kịch bản "${found.name || id}"?`)) {
          state.scenarios = state.scenarios.filter((s) => s.id !== id);
          await chrome.storage.local.set({ rules: state.scenarios });
          renderHeader();
          renderScenariosList();
        }
      });
    });
  }

  // ==========================================================================
  // TRÌNH CHỈNH SỬA KỊCH BẢN & BẢNG DANH SÁCH RULE (TABLE)
  // ==========================================================================
  function getSuggestedUrlFromActiveTab(mode = 'origin') {
    const rawUrl = state.activeTab && state.activeTab.url ? state.activeTab.url : '';
    if (!rawUrl || rawUrl.startsWith('chrome://') || rawUrl.startsWith('edge://')) return '';
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol === 'file:') {
        return parsed.pathname.split('/').pop() || rawUrl;
      }
      if (mode === 'origin') {
        return `${parsed.origin}/*`;
      }
      return `${parsed.origin}${parsed.pathname}*`;
    } catch (_) {
      return rawUrl;
    }
  }

  function handleCreateNewScenario() {
    const defaultUrl = getSuggestedUrlFromActiveTab('origin');
    const fresh = createEmptyScenario(defaultUrl);
    openScenarioEditor(fresh, true);
  }

  function syncScenarioTopFields() {
    if (!state.editingScenario) return;
    state.editingScenario.name = document.getElementById('inpScenarioName').value;
    state.editingScenario.enabled = document.getElementById('selScenarioEnabled').value === 'true';
    state.editingScenario.urlPattern = document.getElementById('inpUrlPattern').value.trim();
    state.editingScenario.triggerSelector = document.getElementById('inpTriggerSelector').value.trim();
    state.editingScenario.triggerEvent = document.getElementById('selTriggerEvent').value;
    state.editingScenario.triggerWaitMs =
      parseInt(document.getElementById('inpTriggerWaitMs').value, 10) || 0;
    state.editingScenario.waitForSettled = document.getElementById('chkWaitForSettled').checked;
    state.editingScenario.maxSettleMs =
      parseInt(document.getElementById('inpMaxSettleMs').value, 10) || 3000;
  }

  async function saveDraftToStorage() {
    if (!state.editingScenario) return;
    syncScenarioTopFields();
    const draftPayload = JSON.parse(JSON.stringify(state.editingScenario));
    if (state.activeRuleModal) {
      draftPayload.activeRuleModal = JSON.parse(JSON.stringify(state.activeRuleModal));
    }
    await chrome.storage.local.set({ editorDraft: draftPayload });
    const statusEl = document.getElementById('draftStatusText');
    if (statusEl) {
      const now = new Date();
      statusEl.textContent = `Đã lưu nháp lúc ${now.toLocaleTimeString('vi-VN')}`;
    }
  }

  function openScenarioEditor(scnObj, persistImmediately = true) {
    state.editingScenario = scnObj;
    if (!Array.isArray(state.editingScenario.targets)) {
      state.editingScenario.targets = [];
    }

    document.getElementById('viewScenariosList').classList.add('hidden');
    document.getElementById('viewScenarioEditor').classList.remove('hidden');

    document.getElementById('editorHeadingTitle').textContent = scnObj.isNew
      ? 'Tạo Kịch bản mới'
      : 'Chỉnh sửa Kịch bản';

    const isSettledOn = scnObj.waitForSettled !== false;
    document.getElementById('inpScenarioName').value = scnObj.name || '';
    document.getElementById('selScenarioEnabled').value = scnObj.enabled !== false ? 'true' : 'false';
    document.getElementById('inpUrlPattern').value = scnObj.urlPattern || '';
    document.getElementById('inpTriggerSelector').value = scnObj.triggerSelector || '';
    document.getElementById('selTriggerEvent').value = scnObj.triggerEvent || 'auto';
    document.getElementById('inpTriggerWaitMs').value = scnObj.triggerWaitMs || 0;
    document.getElementById('chkWaitForSettled').checked = isSettledOn;
    document.getElementById('inpMaxSettleMs').value = scnObj.maxSettleMs || 3000;
    document.getElementById('wrapMaxSettleMs').classList.toggle('hidden', !isSettledOn);

    renderRulesTable();

    if (persistImmediately) {
      saveDraftToStorage();
    }
  }

  function renderRulesTable() {
    const wrapper = document.getElementById('rulesTableWrapper');
    const rules = state.editingScenario.targets;

    if (!rules || rules.length === 0) {
      wrapper.innerHTML = `
        <div class="table-empty">
          Chưa có Rule nào trong danh sách. Nhấn <b>"＋ Thêm Rule"</b> ở góc trên để thêm phần tử tự động điền.
        </div>
      `;
      return;
    }

    wrapper.innerHTML = `
      <table class="rules-table">
        <thead>
          <tr>
            <th class="col-idx">#</th>
            <th class="col-status">Bật</th>
            <th>Element đích</th>
            <th>Phương thức</th>
            <th>Chi tiết cấu hình</th>
            <th class="col-actions">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${rules
            .map((r, idx) => {
              const isRuleOn = r.enabled !== false;
              const modeKey = r.mode || 'fixed';
              const badge = MODE_BADGES[modeKey] || MODE_BADGES.fixed;
              const selectorDisplay =
                r.selector && r.selector.trim() !== ''
                  ? r.selector
                  : modeKey === 'plugin'
                  ? '[Toàn trang]'
                  : '(Chưa chọn)';
              const summary = summarizeRuleConfig(r);

              return `
                <tr class="js-rule-row ${isRuleOn ? '' : 'rule-row-disabled'}" data-idx="${idx}" title="Click để mở popup tùy chỉnh Rule #${idx + 1}">
                  <td class="col-idx">${idx + 1}</td>
                  <td class="col-status js-rule-toggle-cell">
                    <label class="switch-wrap switch-sm" title="${
                      isRuleOn
                        ? 'Đang bật — Click để tạm tắt Rule này'
                        : 'Đang tạm tắt — Click để bật lại Rule này'
                    }">
                      <input type="checkbox" class="js-toggle-rule" data-idx="${idx}" ${
                isRuleOn ? 'checked' : ''
              } />
                      <span class="slider"></span>
                    </label>
                  </td>
                  <td>
                    <div class="cell-selector" title="${escapeHtml(selectorDisplay)}">
                      ${escapeHtml(selectorDisplay)}
                    </div>
                  </td>
                  <td>
                    <span class="mode-pill ${badge.cls}">${escapeHtml(badge.label)}</span>
                  </td>
                  <td>
                    <div class="cell-summary" title="${escapeHtml(summary)}">
                      ${escapeHtml(summary)}
                    </div>
                  </td>
                  <td class="col-actions">
                    ${
                      idx > 0
                        ? `<button type="button" class="btn btn-ghost btn-xs js-row-up" data-idx="${idx}" title="Đưa lên trên">↑</button>`
                        : ''
                    }
                    <button type="button" class="btn btn-danger-ghost btn-xs js-row-del" data-idx="${idx}" title="Xóa Rule này">🗑️</button>
                  </td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    `;

    // Click vào dòng -> mở Modal tùy chỉnh Rule
    wrapper.querySelectorAll('.js-rule-row').forEach((tr) => {
      tr.addEventListener('click', () => {
        const idx = Number(tr.dataset.idx);
        const ruleClone = JSON.parse(JSON.stringify(state.editingScenario.targets[idx]));
        openRuleModal(idx, false, ruleClone, true);
      });
    });

    // Bật / Tắt nhanh từng Rule ngay trên bảng (chặn nổi bọt để không mở Modal)
    wrapper.querySelectorAll('.js-rule-toggle-cell').forEach((cell) => {
      cell.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    });

    wrapper.querySelectorAll('.js-toggle-rule').forEach((chk) => {
      chk.addEventListener('change', (e) => {
        e.stopPropagation();
        const idx = Number(chk.dataset.idx);
        const targetItem = state.editingScenario.targets[idx];
        if (!targetItem) return;
        targetItem.enabled = chk.checked;
        renderRulesTable();
        saveDraftToStorage();
      });
    });

    // Nút đẩy lên trên (chặn nổi bọt để không mở Modal)
    wrapper.querySelectorAll('.js-row-up').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.idx);
        if (idx > 0) {
          const arr = state.editingScenario.targets;
          [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
          renderRulesTable();
          saveDraftToStorage();
        }
      });
    });

    // Nút xóa dòng Rule (chặn nổi bọt để không mở Modal)
    wrapper.querySelectorAll('.js-row-del').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.idx);
        state.editingScenario.targets.splice(idx, 1);
        renderRulesTable();
        saveDraftToStorage();
      });
    });
  }

  // ==========================================================================
  // MODAL POPUP TÙY CHỈNH CHI TIẾT 1 RULE (DROPDOWN PHƯƠNG THỨC THEO PHẦN TỬ)
  // ==========================================================================
  function openRuleModal(rowIndex, isNewRow, ruleData, persist = true) {
    state.activeRuleModal = {
      rowIndex,
      isNewRow,
      ruleData
    };

    const overlay = document.getElementById('ruleModalOverlay');
    const titleEl = document.getElementById('ruleModalTitle');
    titleEl.textContent = isNewRow
      ? 'Thêm Rule mới'
      : `Tùy chỉnh Rule #${Number(rowIndex) + 1}`;

    overlay.classList.remove('hidden');
    renderRuleModalBody();

    if (persist) {
      saveDraftToStorage();
    }
  }

  function closeRuleModal(persist = true) {
    state.activeRuleModal = null;
    document.getElementById('ruleModalOverlay').classList.add('hidden');
    if (persist && state.editingScenario) {
      saveDraftToStorage();
    }
  }

  function renderRuleModalBody() {
    if (!state.activeRuleModal) return;
    const body = document.getElementById('ruleModalBody');
    const r = state.activeRuleModal.ruleData;
    const mode = r.mode || 'fixed';
    const availablePlugins = getAvailablePluginsList();

    if (!Array.isArray(r.mappings) || r.mappings.length === 0) {
      r.mappings = [createEmptyMappingRow()];
    }

    const isRuleEnabled = r.enabled !== false;
    const selectedPluginObj = availablePlugins.find((p) => p.id === r.pluginName) || null;

    body.innerHTML = `
      <!-- 0. Tùy chọn Bật / Tắt riêng cho Rule này -->
      <div class="rule-modal-status-bar ${isRuleEnabled ? 'is-on' : 'is-off'}">
        <div>
          <div class="rule-status-title">${
            isRuleEnabled ? '🟢 Rule này đang BẬT' : '⚪ Rule này đang TẠM TẮT'
          }</div>
          <div class="rule-status-desc">${
            isRuleEnabled
              ? 'Sẽ được thực thi khi Kịch bản kích hoạt'
              : 'Tạm bỏ qua khi chạy Kịch bản, giữ nguyên cấu hình để bật lại sau'
          }</div>
        </div>
        <label class="switch-wrap" title="Bật / Tắt Rule này">
          <input type="checkbox" id="modalChkRuleEnabled" ${isRuleEnabled ? 'checked' : ''} />
          <span class="slider"></span>
        </label>
      </div>

      <!-- 1. Dropdown chọn Phương thức tự động riêng cho phần tử này -->
      <div class="form-group method-selector-box">
        <label class="field-label" for="modalSelMode">
          Phương thức tự động Fill (Phần tử này chỉ chạy theo 1 phương thức đã chọn)
        </label>
        <select id="modalSelMode" class="inp method-select">
          <option value="fixed" ${mode === 'fixed' ? 'selected' : ''}>1. 📌 Tự động theo giá trị cố định được cài đặt</option>
          <option value="mapping" ${mode === 'mapping' ? 'selected' : ''}>2. 🔀 Tự động theo bảng điều kiện (tùy chỉnh Element)</option>
          <option value="script" ${mode === 'script' ? 'selected' : ''}>3. ⚡ Tự động theo Rule dựa vào Script cài đặt</option>
          <option value="plugin" ${mode === 'plugin' ? 'selected' : ''}>4. 🧩 Tự động theo Plugin JavaScript (IT chuyên sâu)</option>
        </select>
      </div>

      <!-- 2. Selector phần tử đích & Kiểu thao tác -->
      <div class="form-group mt-10">
        <label class="field-label">
          ${
            mode === 'plugin'
              ? 'Selector Element đích (Tùy chọn — để trống nếu Plugin tự xử lý nhiều ô)'
              : 'Selector Element đích <span class="req">*</span>'
          }
        </label>
        <div class="input-action-group">
          <input
            type="text"
            id="modalInpSelector"
            class="inp mono"
            value="${escapeHtml(r.selector)}"
            placeholder="${
              mode === 'plugin'
                ? 'Tùy chọn: #id_dich (hoặc để trống)'
                : "VD: #id_dich, .class_name, [name='field']"
            }"
          />
          <button type="button" id="modalBtnPickTarget" class="btn btn-accent btn-sm" title="Click chọn phần tử trên trang web bên trái">
            🎯 Chọn
          </button>
          <button type="button" id="modalBtnHlTarget" class="btn btn-outline btn-sm" title="Nháy sáng kiểm tra phần tử trên trang">
            🔍
          </button>
        </div>
      </div>

      <div class="form-row mt-8">
        <div class="form-col flex-1">
          <label class="field-label">Kiểu nhập / chọn</label>
          <select id="modalSelAction" class="inp">
            <option value="auto" ${r.actionType === 'auto' ? 'selected' : ''}>✨ Tự động nhận diện (Input / Dropdown / Checkbox)</option>
            <option value="input" ${r.actionType === 'input' ? 'selected' : ''}>⌨️ Nhập văn bản (Input / Textarea)</option>
            <option value="select_value" ${r.actionType === 'select_value' ? 'selected' : ''}>▾ Chọn Dropdown (Ưu tiên Value, sau đó Text)</option>
            <option value="select_text" ${r.actionType === 'select_text' ? 'selected' : ''}>▾ Chọn Dropdown theo Nhãn hiển thị (Text)</option>
            <option value="checkbox" ${r.actionType === 'checkbox' ? 'selected' : ''}>☑️ Tick / Bỏ tick Checkbox (true / false)</option>
            <option value="radio" ${r.actionType === 'radio' ? 'selected' : ''}>🔘 Chọn Radio Button</option>
            <option value="click" ${r.actionType === 'click' ? 'selected' : ''}>👆 Tự động Click phần tử</option>
          </select>
        </div>
        <div class="form-col" style="width: 100px;">
          <label class="field-label">Trễ (ms)</label>
          <input type="number" id="modalInpDelay" class="inp" min="0" max="10000" step="50" value="${
      r.delayMs || 0
    }" />
        </div>
      </div>

      <!-- 3. CẤU HÌNH CHI TIẾT CỦA DUY NHẤT PHƯƠNG THỨC ĐANG CHỌN -->
      ${
        mode === 'fixed'
          ? `
        <div class="mt-10">
          <label class="field-label">Giá trị cố định cần nhập / chọn</label>
          <input
            type="text"
            id="modalInpFixed"
            class="inp"
            value="${escapeHtml(r.fixedValue)}"
            placeholder="Nhập giá trị cố định (hoặc biến {{trigger}}, {{today_vn}})..."
          />
          <div class="field-hint">
            Với Dropdown: có thể nhập mã <code>value</code> hoặc <code>tên hiển thị</code> của option.
          </div>

          <div class="protect-box">
            <div class="form-group">
              <label class="field-label" style="margin-bottom:3px;">
                🛡️ Giữ nguyên (không ghi đè) nếu ô đích đang thuộc danh sách:
              </label>
              <input
                type="text"
                id="modalInpKeep"
                class="inp"
                value="${escapeHtml(r.keepValues)}"
                placeholder="Phân cách bằng dấu phẩy (để trống nếu luôn điền)"
                style="padding:5px 8px; font-size:12px;"
              />
            </div>
            <label class="checkbox-row mt-6">
              <input type="checkbox" id="modalChkEmptyOnly" ${r.onlyIfEmpty ? 'checked' : ''} />
              <span>Chỉ tự động điền khi phần tử đích đang trống</span>
            </label>
          </div>
        </div>
      `
          : ''
      }

      ${
        mode === 'mapping'
          ? `
        <div class="mt-10">
          <div class="field-label">
            Các dòng điều kiện (Để trống ô Element = lấy theo Element chính; hoặc chọn Element bất kỳ):
          </div>
          <div class="mapping-rows">
            ${r.mappings
              .map((m, mIdx) => {
                const resAction = m.resultAction || 'fill';
                const hideValInput = m.operator === 'empty' || m.operator === 'not_empty';
                return `
                  <div class="mapping-card-row">
                    <div class="mapping-line-top">
                      <input
                        type="text"
                        class="inp mono js-modal-map-source"
                        data-midx="${mIdx}"
                        value="${escapeHtml(m.sourceSelector || '')}"
                        placeholder="Trống = Element chính (hoặc #selector khác)"
                        style="padding:5px 7px; font-size:12px;"
                      />
                      <button
                        type="button"
                        class="btn btn-accent btn-xs js-modal-pick-map-src"
                        data-midx="${mIdx}"
                        title="Chọn Element cần kiểm tra điều kiện trên trang web"
                      >🎯</button>
                      <select class="inp js-modal-map-op" data-midx="${mIdx}" style="padding:5px 5px; font-size:12px;">
                        <option value="eq" ${m.operator === 'eq' ? 'selected' : ''}>Bằng (=)</option>
                        <option value="neq" ${m.operator === 'neq' ? 'selected' : ''}>Khác (!=)</option>
                        <option value="lt" ${m.operator === 'lt' ? 'selected' : ''}>Nhỏ hơn (&lt;)</option>
                        <option value="lte" ${m.operator === 'lte' ? 'selected' : ''}>Nhỏ/bằng (&le;)</option>
                        <option value="gt" ${m.operator === 'gt' ? 'selected' : ''}>Lớn hơn (&gt;)</option>
                        <option value="gte" ${m.operator === 'gte' ? 'selected' : ''}>Lớn/bằng (&ge;)</option>
                        <option value="contains" ${m.operator === 'contains' ? 'selected' : ''}>Chứa chữ</option>
                        <option value="starts" ${m.operator === 'starts' ? 'selected' : ''}>Bắt đầu</option>
                        <option value="not_empty" ${m.operator === 'not_empty' ? 'selected' : ''}>Có dữ liệu</option>
                        <option value="empty" ${m.operator === 'empty' ? 'selected' : ''}>Đang trống</option>
                      </select>
                      <button
                        type="button"
                        class="btn btn-danger-ghost btn-xs js-modal-del-map"
                        data-midx="${mIdx}"
                        title="Xóa dòng này"
                      >✕</button>
                    </div>

                    <div class="mapping-line-bottom">
                      <input
                        type="text"
                        class="inp js-modal-map-match"
                        data-midx="${mIdx}"
                        value="${escapeHtml(m.matchValue)}"
                        placeholder="${hideValInput ? '(Không cần nhập)' : 'Giá trị đối chiếu...'}"
                        ${hideValInput ? 'disabled' : ''}
                        style="padding:5px 7px; font-size:12px;"
                      />
                      <span class="mapping-arrow">➔</span>
                      <select class="inp js-modal-map-res" data-midx="${mIdx}" style="padding:5px 5px; font-size:12px;">
                        <option value="fill" ${resAction !== 'keep' ? 'selected' : ''}>Điền / Chọn:</option>
                        <option value="keep" ${resAction === 'keep' ? 'selected' : ''}>Giữ nguyên</option>
                      </select>
                      <input
                        type="text"
                        class="inp js-modal-map-out ${resAction === 'keep' ? 'hidden' : ''}"
                        data-midx="${mIdx}"
                        value="${escapeHtml(m.outputValue)}"
                        placeholder="Giá trị cần điền..."
                        style="padding:5px 7px; font-size:12px;"
                      />
                      ${
                        resAction === 'keep'
                          ? `<span style="font-size:11.5px; color:#64748b; padding-left:4px;">(Không đổi ô đích)</span>`
                          : ''
                      }
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
          <button type="button" id="modalBtnAddMapRow" class="btn btn-outline btn-xs">
            ＋ Thêm dòng điều kiện
          </button>

          <div class="form-row mt-8">
            <div class="form-col" style="width: 195px;">
              <label class="field-label">Nếu không khớp điều kiện nào:</label>
              <select id="modalSelMapFbMode" class="inp" style="padding:5px 6px;">
                <option value="keep" ${r.mappingFallbackMode !== 'fixed' ? 'selected' : ''}>Giữ nguyên không đổi</option>
                <option value="fixed" ${r.mappingFallbackMode === 'fixed' ? 'selected' : ''}>Điền giá trị mặc định:</option>
              </select>
            </div>
            <div class="form-col flex-1 ${r.mappingFallbackMode === 'fixed' ? '' : 'hidden'}">
              <label class="field-label">Giá trị mặc định</label>
              <input type="text" id="modalInpMapFbVal" class="inp" value="${escapeHtml(
                r.mappingFallbackValue
              )}" style="padding:5px 8px;" />
            </div>
          </div>
        </div>
      `
          : ''
      }

      ${
        mode === 'script'
          ? `
        <div class="mt-10">
          <div class="field-label">Chèn khung mẫu gợi ý:</div>
          <div class="template-bar">
            <button type="button" class="tpl-chip js-modal-tpl" data-tpl="basic_if">🔀 If / Else cơ bản</button>
            <button type="button" class="tpl-chip js-modal-tpl" data-tpl="keep_existing">🛡️ Giữ nguyên giá trị hiện có</button>
            <button type="button" class="tpl-chip js-modal-tpl" data-tpl="read_other_elements">🔗 Đọc Element khác (getVal)</button>
          </div>

          <textarea
            id="modalTxtScript"
            class="code-editor"
            spellcheck="false"
            placeholder="(triggerVal, { currentVal, getVal, getText, isChecked }) => {\n  return 'GIA_TRI';\n}"
          >${escapeHtml(r.scriptCode)}</textarea>

          <div class="field-hint">
            Biến hỗ trợ: <code>triggerVal</code>, <code>triggerText</code>, <code>currentVal</code>, <code>currentText</code>,
            <code>getVal('#selector')</code>, <code>getText('#selector')</code>, <code>isChecked('#selector')</code>.
            Trả về <code>null</code> = <b>Giữ nguyên không đổi</b>.
          </div>

          <div class="script-test-box">
            <div class="field-label" style="margin-bottom:4px;">🧪 Kiểm tra nhanh cú pháp &amp; kết quả Script:</div>
            <div class="script-test-row">
              <input type="text" id="modalTestTrigger" class="inp mono" placeholder="triggerVal thử nghiệm" style="padding:5px 7px; font-size:12px;" />
              <input type="text" id="modalTestCurrent" class="inp mono" placeholder="currentVal thử nghiệm" style="padding:5px 7px; font-size:12px;" />
              <button type="button" id="modalBtnRunTest" class="btn btn-accent btn-xs">▶ Chạy thử</button>
            </div>
            <div id="modalTestResult" class="test-result hidden"></div>
          </div>
        </div>
      `
          : ''
      }

      ${
        mode === 'plugin'
          ? `
        <div class="mt-10">
          <div class="form-group">
            <label class="field-label">Chọn Plugin từ <code>plugins/custom-plugins.js</code> <span class="req">*</span></label>
            ${
              availablePlugins.length > 0
                ? `<select id="modalSelPlugin" class="inp">
                    ${availablePlugins
                      .map(
                        (p) =>
                          `<option value="${escapeHtml(p.id)}" ${
                            r.pluginName === p.id ? 'selected' : ''
                          }>${escapeHtml(p.name)} (${escapeHtml(p.id)})</option>`
                      )
                      .join('')}
                  </select>`
                : `<input
                    type="text"
                    id="modalInpPlugin"
                    class="inp mono"
                    value="${escapeHtml(r.pluginName || '')}"
                    placeholder="Nhập mã Plugin đăng ký trong plugins/custom-plugins.js"
                  />`
            }
          </div>

          ${
            selectedPluginObj && selectedPluginObj.description
              ? `<div class="plugin-info-box">ℹ️ ${escapeHtml(selectedPluginObj.description)}</div>`
              : `<div class="plugin-info-box">
                  ℹ️ Dành cho IT chuyên sâu: Khai báo hàm xử lý trong file <code>plugins/custom-plugins.js</code>
                  bằng <code>registerBatoPlugin("ma_plugin", { ... })</code>.
                </div>`
          }

          <div class="form-group mt-8">
            <div class="label-with-actions">
              <label class="field-label">Tham số truyền vào Plugin (<code>params</code> — JSON hoặc Text tùy chọn)</label>
              ${
                selectedPluginObj && selectedPluginObj.defaultParams
                  ? `<button type="button" id="modalBtnPluginDefault" class="chip-action">Chèn tham số mẫu</button>`
                  : ''
              }
            </div>
            <textarea
              id="modalTxtPluginParams"
              class="inp mono"
              rows="3"
              spellcheck="false"
              placeholder='VD: {"skipValues": ["A", "B"], "extraSelector": "#id_khac"}'
            >${escapeHtml(r.pluginParams || '')}</textarea>
          </div>
        </div>
      `
          : ''
      }
    `;

    bindRuleModalBodyEvents(body);
  }

  function bindRuleModalBodyEvents(body) {
    const r = state.activeRuleModal.ruleData;
    const availablePlugins = getAvailablePluginsList();

    // Bật / Tắt Rule ngay trong Modal
    document.getElementById('modalChkRuleEnabled')?.addEventListener('change', (e) => {
      r.enabled = e.target.checked;
      renderRuleModalBody();
      saveDraftToStorage();
    });

    // Đổi phương thức từ Dropdown của riêng phần tử này
    document.getElementById('modalSelMode').addEventListener('change', (e) => {
      r.mode = e.target.value;
      if (r.mode === 'plugin' && !r.pluginName && availablePlugins.length > 0) {
        r.pluginName = availablePlugins[0].id;
        if (r.pluginParams === undefined && availablePlugins[0].defaultParams !== undefined) {
          r.pluginParams =
            typeof availablePlugins[0].defaultParams === 'string'
              ? availablePlugins[0].defaultParams
              : JSON.stringify(availablePlugins[0].defaultParams, null, 2);
        }
      }
      renderRuleModalBody();
      saveDraftToStorage();
    });

    document.getElementById('modalInpSelector').addEventListener('input', (e) => {
      r.selector = e.target.value.trim();
      saveDraftToStorage();
    });

    document.getElementById('modalSelAction').addEventListener('change', (e) => {
      r.actionType = e.target.value;
      saveDraftToStorage();
    });

    document.getElementById('modalInpDelay').addEventListener('input', (e) => {
      r.delayMs = parseInt(e.target.value, 10) || 0;
      saveDraftToStorage();
    });

    document.getElementById('modalBtnPickTarget').addEventListener('click', () => {
      startPickerOnActivePage('modalTarget', null, 'Element đích của Rule');
    });

    document.getElementById('modalBtnHlTarget').addEventListener('click', () => {
      highlightSelectorOnActivePage(r.selector);
    });

    // Fixed fields
    document.getElementById('modalInpFixed')?.addEventListener('input', (e) => {
      r.fixedValue = e.target.value;
      saveDraftToStorage();
    });
    document.getElementById('modalInpKeep')?.addEventListener('input', (e) => {
      r.keepValues = e.target.value;
      saveDraftToStorage();
    });
    document.getElementById('modalChkEmptyOnly')?.addEventListener('change', (e) => {
      r.onlyIfEmpty = e.target.checked;
      saveDraftToStorage();
    });

    // Mapping fields
    body.querySelectorAll('.js-modal-map-source').forEach((el) => {
      el.addEventListener('input', () => {
        r.mappings[Number(el.dataset.midx)].sourceSelector = el.value.trim();
        saveDraftToStorage();
      });
    });

    body.querySelectorAll('.js-modal-pick-map-src').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mIdx = Number(btn.dataset.midx);
        startPickerOnActivePage(
          'modalMappingSource',
          mIdx,
          `Element đối chiếu của Điều kiện #${mIdx + 1}`
        );
      });
    });

    body.querySelectorAll('.js-modal-map-op').forEach((el) => {
      el.addEventListener('change', () => {
        r.mappings[Number(el.dataset.midx)].operator = el.value;
        renderRuleModalBody();
        saveDraftToStorage();
      });
    });

    body.querySelectorAll('.js-modal-map-match').forEach((el) => {
      el.addEventListener('input', () => {
        r.mappings[Number(el.dataset.midx)].matchValue = el.value;
        saveDraftToStorage();
      });
    });

    body.querySelectorAll('.js-modal-map-res').forEach((el) => {
      el.addEventListener('change', () => {
        r.mappings[Number(el.dataset.midx)].resultAction = el.value;
        renderRuleModalBody();
        saveDraftToStorage();
      });
    });

    body.querySelectorAll('.js-modal-map-out').forEach((el) => {
      el.addEventListener('input', () => {
        r.mappings[Number(el.dataset.midx)].outputValue = el.value;
        saveDraftToStorage();
      });
    });

    body.querySelectorAll('.js-modal-del-map').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mIdx = Number(btn.dataset.midx);
        if (r.mappings.length > 1) {
          r.mappings.splice(mIdx, 1);
          renderRuleModalBody();
          saveDraftToStorage();
        }
      });
    });

    document.getElementById('modalBtnAddMapRow')?.addEventListener('click', () => {
      r.mappings.push(createEmptyMappingRow());
      renderRuleModalBody();
      saveDraftToStorage();
    });

    document.getElementById('modalSelMapFbMode')?.addEventListener('change', (e) => {
      r.mappingFallbackMode = e.target.value;
      renderRuleModalBody();
      saveDraftToStorage();
    });

    document.getElementById('modalInpMapFbVal')?.addEventListener('input', (e) => {
      r.mappingFallbackValue = e.target.value;
      saveDraftToStorage();
    });

    // Script fields
    const txtScript = document.getElementById('modalTxtScript');
    if (txtScript) {
      txtScript.addEventListener('input', () => {
        r.scriptCode = txtScript.value;
        saveDraftToStorage();
      });
      txtScript.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const start = txtScript.selectionStart;
          const end = txtScript.selectionEnd;
          txtScript.value =
            txtScript.value.substring(0, start) + '  ' + txtScript.value.substring(end);
          txtScript.selectionStart = txtScript.selectionEnd = start + 2;
          r.scriptCode = txtScript.value;
          saveDraftToStorage();
        }
      });
    }

    body.querySelectorAll('.js-modal-tpl').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tplCode = SCRIPT_TEMPLATES[btn.dataset.tpl];
        if (!tplCode) return;
        if ((r.scriptCode || '').trim() && (r.scriptCode || '').trim() !== tplCode.trim()) {
          if (!confirm('Thay thế đoạn Script hiện tại bằng mẫu khung này?')) return;
        }
        r.scriptCode = tplCode;
        renderRuleModalBody();
        saveDraftToStorage();
      });
    });

    document.getElementById('modalBtnRunTest')?.addEventListener('click', async () => {
      const mockTriggerVal = document.getElementById('modalTestTrigger')?.value || '';
      const mockCurrentVal = document.getElementById('modalTestCurrent')?.value || '';
      const resBox = document.getElementById('modalTestResult');

      resBox.classList.remove('hidden', 'ok', 'err');
      resBox.textContent = 'Đang chạy thử...';

      const res = await runPopupSandboxEval(r.scriptCode || '', mockTriggerVal, {
        currentVal: mockCurrentVal,
        currentText: mockCurrentVal,
        triggerText: mockTriggerVal,
        url: state.activeTab?.url || '',
        domSnapshot: {}
      });

      resBox.style.whiteSpace = 'pre-wrap';
      const logLines =
        Array.isArray(res.logs) && res.logs.length > 0
          ? '\n📋 Console Log:\n' +
            res.logs
              .map(
                (l) =>
                  `  [${l.level}] ` +
                  (Array.isArray(l.args)
                    ? l.args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
                    : String(l.args))
              )
              .join('\n')
          : '';

      if (res.ok) {
        resBox.classList.add('ok');
        if (res.result === null || res.result === undefined) {
          resBox.textContent =
            '✅ Kết quả: null (Giữ nguyên giá trị hiện tại, không ghi đè)' + logLines;
        } else {
          resBox.textContent = `✅ Kết quả trả về: ${JSON.stringify(res.result)}` + logLines;
        }
      } else {
        resBox.classList.add('err');
        resBox.textContent = `❌ Lỗi cú pháp / thực thi: ${res.error}` + logLines;
      }
    });

    // Plugin fields
    document.getElementById('modalSelPlugin')?.addEventListener('change', (e) => {
      r.pluginName = e.target.value;
      renderRuleModalBody();
      saveDraftToStorage();
    });
    document.getElementById('modalInpPlugin')?.addEventListener('input', (e) => {
      r.pluginName = e.target.value.trim();
      saveDraftToStorage();
    });
    document.getElementById('modalTxtPluginParams')?.addEventListener('input', (e) => {
      r.pluginParams = e.target.value;
      saveDraftToStorage();
    });
    document.getElementById('modalBtnPluginDefault')?.addEventListener('click', () => {
      const pluginObj = availablePlugins.find((p) => p.id === r.pluginName);
      if (pluginObj && pluginObj.defaultParams !== undefined) {
        r.pluginParams =
          typeof pluginObj.defaultParams === 'string'
            ? pluginObj.defaultParams
            : JSON.stringify(pluginObj.defaultParams, null, 2);
        renderRuleModalBody();
        saveDraftToStorage();
      }
    });
  }

  function applyRuleModalChanges() {
    if (!state.activeRuleModal || !state.editingScenario) return;
    const { rowIndex, isNewRow, ruleData } = state.activeRuleModal;
    const mode = ruleData.mode || 'fixed';

    if (mode !== 'plugin' && (!ruleData.selector || !ruleData.selector.trim())) {
      alert('Vui lòng nhập hoặc Chọn Selector cho Element đích!');
      document.getElementById('modalInpSelector')?.focus();
      return;
    }

    if (mode === 'script' && (!ruleData.scriptCode || !ruleData.scriptCode.trim())) {
      alert('Vui lòng nhập nội dung Script cho Rule này (hoặc chọn 1 khung mẫu gợi ý)!');
      document.getElementById('modalTxtScript')?.focus();
      return;
    }

    if (mode === 'plugin' && (!ruleData.pluginName || !ruleData.pluginName.trim())) {
      alert('Vui lòng chọn hoặc nhập mã Plugin JS!');
      return;
    }

    const cleanItem = sanitizeRuleItem(ruleData);
    if (isNewRow || rowIndex === null || rowIndex === undefined) {
      state.editingScenario.targets.push(cleanItem);
    } else {
      state.editingScenario.targets[rowIndex] = cleanItem;
    }

    closeRuleModal(false);
    renderRulesTable();
    saveDraftToStorage();
  }

  // ==========================================================================
  // LƯU HOẶC HỦY KỊCH BẢN
  // ==========================================================================
  async function saveCurrentEditingScenario() {
    if (!state.editingScenario) return;
    syncScenarioTopFields();
    const scn = state.editingScenario;

    if (!scn.urlPattern) {
      alert('Vui lòng nhập URL Web cần thực thi (hoặc nhập * cho mọi trang)!');
      document.getElementById('inpUrlPattern').focus();
      return;
    }

    if (!scn.triggerSelector) {
      alert('Vui lòng nhập hoặc Chọn Selector cho Element chính bắt sự kiện!');
      document.getElementById('inpTriggerSelector').focus();
      return;
    }

    if (!Array.isArray(scn.targets) || scn.targets.length === 0) {
      alert('Vui lòng thêm ít nhất 1 Rule vào Danh sách Rule!');
      return;
    }

    const otherNormNames = new Set(
      state.scenarios
        .filter((s) => s.id !== scn.id)
        .map((s) => normalizeScenarioName(s.name))
        .filter(Boolean)
    );

    if (!scn.name || !scn.name.trim()) {
      scn.name = generateUniqueScenarioName(
        `Kịch bản từ ${scn.triggerSelector} (${scn.targets.length} Rule)`,
        otherNormNames
      );
    }

    const cleanScn = sanitizeScenario(scn);

    // 1. Cảnh báo trùng tên với Kịch bản khác khi Tạo / Sửa trực tiếp trên giao diện
    if (otherNormNames.has(normalizeScenarioName(cleanScn.name))) {
      alert(
        `Tên kịch bản "${cleanScn.name}" đã tồn tại! Vui lòng đặt tên khác trước khi lưu.`
      );
      document.getElementById('inpScenarioName')?.focus();
      return;
    }

    const newFingerprint = buildScenarioFingerprint(cleanScn);

    // 2. Kiểm tra trùng lặp toàn bộ cấu hình với các Kịch bản khác đang có sẵn (không phân biệt tên)
    const duplicateOther = state.scenarios.find(
      (s) => s.id !== cleanScn.id && buildScenarioFingerprint(s) === newFingerprint
    );
    if (duplicateOther) {
      alert(
        `Không thể lưu vì cấu hình này đã trùng hoàn toàn (URL, Trigger và toàn bộ Rule) với kịch bản "${
          duplicateOther.name || duplicateOther.id
        }"!`
      );
      return;
    }

    const existingIdx = state.scenarios.findIndex((s) => s.id === cleanScn.id);
    if (existingIdx >= 0) {
      state.scenarios[existingIdx] = cleanScn;
    } else {
      state.scenarios.unshift(cleanScn);
    }

    await chrome.storage.local.set({
      rules: state.scenarios,
      editorDraft: null
    });

    renderHeader();
    showScenariosListView();
  }

  async function cancelEditingScenario() {
    await chrome.storage.local.set({ editorDraft: null, pickerSession: null });
    showScenariosListView();
  }

  // ==========================================================================
  // GIAO TIẾP VỚI TRANG WEB BÊN TRÁI (PICKER & HIGHLIGHT KIỂM TRA)
  // ==========================================================================
  async function ensureContentScriptsReady(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        files: ['content/page-network-monitor.js']
      });
    } catch (_) {}

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['plugins/custom-plugins.js', 'content/content.js']
      });
    } catch (_) {}
  }

  async function startPickerOnActivePage(field, mappingIndex, labelHint) {
    await refreshActiveTab();
    if (!state.activeTab || !state.activeTab.id) {
      alert('Không tìm thấy tab trình duyệt đang mở.');
      return;
    }

    const url = state.activeTab.url || '';
    if (
      url.startsWith('chrome://') ||
      url.startsWith('edge://') ||
      url.startsWith('chrome-extension://')
    ) {
      alert('Trình duyệt không cho phép chọn phần tử trên trang nội bộ hệ thống. Hãy mở trang web cần cấu hình ở khung bên trái!');
      return;
    }

    await saveDraftToStorage();
    await chrome.storage.local.set({
      pickerSession: {
        field,
        mappingIndex: typeof mappingIndex === 'number' ? mappingIndex : null
      }
    });

    await ensureContentScriptsReady(state.activeTab.id);

    try {
      await chrome.tabs.sendMessage(state.activeTab.id, {
        type: 'BATO_START_PICKER',
        labelHint
      });
    } catch (_) {
      alert('Không thể kết nối tới trang web hiện tại. Hãy tải lại (F5) trang web rồi thử lại!');
    }
  }

  async function highlightSelectorOnActivePage(selector) {
    if (!selector) {
      alert('Hãy nhập Selector trước khi kiểm tra!');
      return;
    }
    await refreshActiveTab();
    if (!state.activeTab || !state.activeTab.id) return;

    await ensureContentScriptsReady(state.activeTab.id);
    try {
      const res = await chrome.tabs.sendMessage(state.activeTab.id, {
        type: 'BATO_HIGHLIGHT_SELECTOR',
        selector
      });
      if (!res || res.count === 0) {
        alert(`Không tìm thấy phần tử nào khớp với "${selector}" trên trang hiện tại.`);
      }
    } catch (_) {
      alert('Không thể kiểm tra trên trang này (hãy F5 lại trang web nếu vừa cài tiện ích).');
    }
  }

  // ==========================================================================
  // GẮN CÁC SỰ KIỆN TĨNH TRÊN GIAO DIỆN
  // ==========================================================================
  function bindStaticEvents() {
    document.getElementById('chkGlobalEnabled').addEventListener('change', async (e) => {
      state.enabled = e.target.checked;
      await chrome.storage.local.set({ enabled: state.enabled });
      renderHeader();
    });

    document.getElementById('btnDismissPickerNotice').addEventListener('click', () => {
      document.getElementById('pickerNoticeBar').classList.add('hidden');
    });

    document.getElementById('chkShowToast').addEventListener('change', async (e) => {
      state.showToast = e.target.checked;
      await chrome.storage.local.set({ showToast: state.showToast });
    });

    document.querySelectorAll('.filter-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        state.currentFilter = chip.dataset.filter;
        document.querySelectorAll('.filter-chip').forEach((c) => {
          c.classList.toggle('active', c.dataset.filter === state.currentFilter);
        });
        renderScenariosList();
      });
    });

    document.getElementById('btnNewScenario').addEventListener('click', handleCreateNewScenario);

    document.getElementById('btnCancelEdit').addEventListener('click', cancelEditingScenario);
    document.getElementById('btnDiscardDraft').addEventListener('click', cancelEditingScenario);
    document.getElementById('btnSaveScenarioTop').addEventListener('click', saveCurrentEditingScenario);
    document.getElementById('btnSaveScenarioBottom').addEventListener('click', saveCurrentEditingScenario);

    [
      'inpScenarioName',
      'selScenarioEnabled',
      'inpUrlPattern',
      'inpTriggerSelector',
      'selTriggerEvent',
      'inpTriggerWaitMs',
      'inpMaxSettleMs'
    ].forEach((id) => {
      const el = document.getElementById(id);
      el.addEventListener('input', saveDraftToStorage);
      el.addEventListener('change', saveDraftToStorage);
    });

    document.getElementById('chkWaitForSettled').addEventListener('change', (e) => {
      document.getElementById('wrapMaxSettleMs').classList.toggle('hidden', !e.target.checked);
      saveDraftToStorage();
    });

    document.getElementById('btnUseCurrentOrigin').addEventListener('click', async () => {
      await refreshActiveTab();
      const originPattern = getSuggestedUrlFromActiveTab('origin');
      if (originPattern) {
        document.getElementById('inpUrlPattern').value = originPattern;
        saveDraftToStorage();
      }
    });

    document.getElementById('btnUseCurrentPath').addEventListener('click', async () => {
      await refreshActiveTab();
      const pathPattern = getSuggestedUrlFromActiveTab('path');
      if (pathPattern) {
        document.getElementById('inpUrlPattern').value = pathPattern;
        saveDraftToStorage();
      }
    });

    document.getElementById('btnPickTrigger').addEventListener('click', () => {
      startPickerOnActivePage('trigger', null, 'Element chính bắt sự kiện');
    });

    document.getElementById('btnHighlightTrigger').addEventListener('click', () => {
      const sel = document.getElementById('inpTriggerSelector').value.trim();
      highlightSelectorOnActivePage(sel);
    });

    // Thêm dòng Rule mới -> mở Modal Popup tùy chỉnh
    document.getElementById('btnAddRuleRow').addEventListener('click', () => {
      if (!state.editingScenario) return;
      openRuleModal(null, true, createEmptyRuleItem(), true);
    });

    // Các nút trên Modal Popup tùy chỉnh Rule
    document.getElementById('btnCloseRuleModal').addEventListener('click', () => closeRuleModal(true));
    document.getElementById('btnCancelRuleModal').addEventListener('click', () => closeRuleModal(true));
    document.getElementById('btnApplyRuleModal').addEventListener('click', applyRuleModalChanges);

    // Đóng Modal khi nhấn phím ESC (nếu đang mở Modal)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.activeRuleModal) {
        closeRuleModal(true);
      }
    });

    // Export JSON (đã lọc gọn sạch theo đúng phương thức từng Rule)
    document.getElementById('btnExportJson').addEventListener('click', () => {
      const cleanScenarios = state.scenarios.map(sanitizeScenario);
      const payload = {
        app: 'BATO_SMART_FILL',
        version: '1.3.0',
        exportedAt: new Date().toISOString(),
        scenarios: cleanScenarios
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BATO_SMART_FILL_scenarios_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Import JSON (kèm lọc sạch trường thừa & chống trùng lặp toàn bộ cấu hình không phân biệt tên)
    const fileInput = document.getElementById('fileImportInput');
    document.getElementById('btnImportJson').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          const imported = Array.isArray(parsed)
            ? parsed
            : parsed.scenarios || parsed.rules;
          if (!Array.isArray(imported)) {
            throw new Error('File JSON không đúng định dạng danh sách Kịch bản.');
          }

          const existingFingerprints = new Set(state.scenarios.map(buildScenarioFingerprint));
          const candidates = [];
          let skippedDuplicates = 0;

          // Bước 1: Lọc bỏ các kịch bản trùng hệt 100% cấu hình (không phân biệt tên)
          for (const rawItem of imported) {
            if (!rawItem || typeof rawItem !== 'object') continue;
            const cleaned = sanitizeScenario(rawItem);
            if (!cleaned.name) {
              cleaned.name = `Kịch bản từ ${cleaned.triggerSelector || 'Import'} (${cleaned.targets.length} Rule)`;
            }
            const fp = buildScenarioFingerprint(cleaned);

            if (existingFingerprints.has(fp)) {
              skippedDuplicates++;
              continue;
            }

            existingFingerprints.add(fp);
            candidates.push(cleaned);
          }

          if (candidates.length === 0) {
            if (skippedDuplicates > 0) {
              alert(
                `Bỏ qua ${skippedDuplicates} kịch bản do đã tồn tại kịch bản trùng hoàn toàn cấu hình (URL, Trigger, Rule & Element đích)!`
              );
            }
            return;
          }

          // Bước 2: Kiểm tra các kịch bản KHÁC cấu hình nhưng bị TRÙNG TÊN với kịch bản đang có trong máy
          const existingNormNameMap = new Map();
          state.scenarios.forEach((s, idx) => {
            const norm = normalizeScenarioName(s.name);
            if (norm && !existingNormNameMap.has(norm)) {
              existingNormNameMap.set(norm, idx);
            }
          });

          const conflictItems = candidates.filter((c) =>
            existingNormNameMap.has(normalizeScenarioName(c.name))
          );

          let conflictResolution = 'keep_both';
          if (conflictItems.length > 0) {
            const uniqueConflictNames = Array.from(new Set(conflictItems.map((c) => c.name)));
            conflictResolution = await askImportNameConflictChoice(uniqueConflictNames);
            if (conflictResolution === 'cancel') {
              return;
            }
          }

          // Bước 3: Áp dụng theo lựa chọn ("overwrite" = Ghi đè bản cũ | "keep_both" = Giữ cả hai & đánh số (2), (3))
          const nextScenarios = state.scenarios.slice();
          const existingIds = new Set(nextScenarios.map((s) => s.id));
          const usedNormNames = new Set(nextScenarios.map((s) => normalizeScenarioName(s.name)));
          const prependedNew = [];
          let overwrittenCount = 0;
          let renamedCount = 0;

          for (const item of candidates) {
            const norm = normalizeScenarioName(item.name);

            if (conflictResolution === 'overwrite' && existingNormNameMap.has(norm)) {
              const targetIdx = existingNormNameMap.get(norm);
              const oldScn = nextScenarios[targetIdx];
              item.id = oldScn.id;
              item.name = oldScn.name; // Giữ chuẩn tên gốc đang có
              nextScenarios[targetIdx] = item;
              overwrittenCount++;
              // Xóa khỏi map để nếu ngay trong file JSON có 2 bản cùng tên thì bản thứ 2 tự đánh số (2)
              existingNormNameMap.delete(norm);
              continue;
            }

            if (existingIds.has(item.id)) {
              item.id = uid('scn');
            }
            existingIds.add(item.id);

            const uniqueName = generateUniqueScenarioName(item.name, usedNormNames);
            if (uniqueName !== item.name) {
              renamedCount++;
              item.name = uniqueName;
            }
            usedNormNames.add(normalizeScenarioName(item.name));
            prependedNew.push(item);
          }

          state.scenarios = [...prependedNew, ...nextScenarios];
          await chrome.storage.local.set({ rules: state.scenarios });
          renderHeader();

          const summaryParts = [];
          if (overwrittenCount > 0) summaryParts.push(`ghi đè cập nhật ${overwrittenCount} kịch bản trùng tên`);
          if (prependedNew.length > 0) summaryParts.push(`thêm mới ${prependedNew.length} kịch bản`);
          if (renamedCount > 0) summaryParts.push(`tự đánh số phân biệt ${renamedCount} kịch bản trùng tên`);
          if (skippedDuplicates > 0) summaryParts.push(`bỏ qua ${skippedDuplicates} kịch bản trùng hệt cấu hình`);

          alert(`Hoàn tất nhập JSON: Đã ${summaryParts.join(', ')}!`);
          showScenariosListView();
        } catch (err) {
          alert(`Lỗi đọc file JSON: ${err.message}`);
        } finally {
          fileInput.value = '';
        }
      };
      reader.readAsText(file);
    });
  }

  document.addEventListener('DOMContentLoaded', initPopup);
})();
