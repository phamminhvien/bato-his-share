/**
 * BATO_SMART_FILL - Content Script
 * Bắt sự kiện thông minh từ Element nguồn, đánh giá quy tắc (Fixed / Mapping / Custom JS)
 * và tự động nhập/chọn dữ liệu cho các Element đích. Tương thích HTML thuần, jQuery, React, Vue, Angular.
 */

(function () {
  if (window.__BATO_SMART_FILL_INITIALIZED__) return;
  window.__BATO_SMART_FILL_INITIALIZED__ = true;

  let appState = {
    enabled: true,
    showToast: true,
    rules: []
  };

  // Quản lý chống lặp, debounce & theo dõi tiến trình mạng/DOM của trang web
  const debounceTimers = new Map();
  const scenarioRunTokens = new Map();
  const scenarioActiveSinceTs = new Map(); // ruleId -> mốc thời gian bắt đầu chuỗi sự kiện hiện tại
  const lastProcessedValues = new Map(); // key: `${ruleId}` -> WeakMap(element -> lastVal)
  const inFlightRequests = new Map(); // reqId -> startTimestamp
  let lastNetEndTimestamp = 0;
  let activeChainDepth = 0;
  let chainResetTimer = null;

  // Theo dõi trạng thái đóng/mở của Popup (on_open) và sự kiện xuất hiện phần tử (appear)
  const activeModalOpenTrackers = new Map(); // ruleId -> Element (modal đang mở đã kích hoạt)
  const activeWindowPopupFired = new Set(); // ruleId đã nổ cho lần tải iframe/window_popup này
  const activeAppearTrackers = new Map(); // ruleId -> Element đang hiển thị
  let appearCheckTimer = null;

  function isInternalNode(node) {
    if (!node || !(node instanceof Element)) return false;
    const id = node.id || '';
    return id.startsWith('__bato_') || Boolean(node.closest('[id^="__bato_"]'));
  }

  // Lắng nghe tín hiệu mạng từ content/page-network-monitor.js (MAIN World)
  window.addEventListener('__bato_net_activity__', (e) => {
    const detail = e && e.detail;
    if (!detail || !detail.reqId) return;
    if (detail.phase === 'start') {
      inFlightRequests.set(detail.reqId, detail.ts || Date.now());
      // Tự dọn dẹp sau 12s nếu là kết nối streaming/SSE dài hạn
      setTimeout(() => {
        inFlightRequests.delete(detail.reqId);
      }, 12000);
    } else if (detail.phase === 'end') {
      inFlightRequests.delete(detail.reqId);
      lastNetEndTimestamp = Date.now();
    }
  });

  function countRequestsStartedSince(sinceTs) {
    let count = 0;
    const threshold = sinceTs - 30;
    for (const startTs of inFlightRequests.values()) {
      if (startTs >= threshold) count++;
    }
    return count;
  }

  /**
   * Chờ toàn bộ Event đồng bộ, API ngầm (fetch/XHR) phát sinh từ sự kiện
   * và quá trình re-render DOM của trang web hoàn tất ổn định trước khi thực thi.
   */
  function waitForWebEventSettled(eventStartTs, maxWaitMs = 3000) {
    return new Promise((resolve) => {
      const safeMax = Math.max(150, Math.min(15000, parseInt(maxWaitMs, 10) || 3000));
      const deadline = eventStartTs + safeMax;
      const DOM_QUIET_MS = 70;
      let lastActivityTs = Date.now();
      let observer = null;
      let pollTimer = null;
      let finished = false;

      const cleanupAndResolve = () => {
        if (finished) return;
        finished = true;
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
        window.removeEventListener('__bato_net_activity__', onNetChange);
        requestAnimationFrame(() => resolve());
      };

      const checkSettled = () => {
        const now = Date.now();
        if (now >= deadline) {
          cleanupAndResolve();
          return;
        }
        const pendingNet = countRequestsStartedSince(eventStartTs);
        const latestSignal = Math.max(lastActivityTs, lastNetEndTimestamp);
        if (pendingNet === 0 && now - latestSignal >= DOM_QUIET_MS) {
          cleanupAndResolve();
        }
      };

      const onNetChange = () => {
        lastActivityTs = Date.now();
      };

      window.addEventListener('__bato_net_activity__', onNetChange);

      if (document.body) {
        observer = new MutationObserver((mutations) => {
          for (const m of mutations) {
            if (!isInternalNode(m.target)) {
              lastActivityTs = Date.now();
              break;
            }
          }
        });
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['disabled', 'readonly', 'class', 'value', 'aria-busy']
        });
      }

      // Nhường 1 nhịp cho toàn bộ event handler đồng bộ + microtask/setTimeout(0) của trang web khởi phát trước
      setTimeout(() => {
        if (finished) return;
        pollTimer = setInterval(checkSettled, 25);
      }, 45);
    });
  }

  // ============================================================================
  // 1. ĐỒNG BỘ CẤU HÌNH TỪ STORAGE
  // ============================================================================
  let isPopupBrowserWindow = Boolean(window.opener && window.opener !== window);

  async function detectBrowserWindowType() {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'BATO_CHECK_WINDOW_TYPE' });
      if (res && res.isPopupWindow) {
        isPopupBrowserWindow = true;
        schedulePopupAppearCheck();
      }
    } catch (_) {}
  }

  async function loadConfig() {
    try {
      const store = await chrome.storage.local.get(['enabled', 'showToast', 'rules']);
      appState.enabled = store.enabled !== false;
      appState.showToast = store.showToast !== false;
      appState.rules = Array.isArray(store.rules) ? store.rules : [];
      schedulePopupAppearCheck();
    } catch (_) {}
  }

  detectBrowserWindowType();
  loadConfig();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.enabled) appState.enabled = changes.enabled.newValue !== false;
    if (changes.showToast) appState.showToast = changes.showToast.newValue !== false;
    if (changes.rules) {
      appState.rules = Array.isArray(changes.rules.newValue) ? changes.rules.newValue : [];
      lastProcessedValues.clear();
      schedulePopupAppearCheck();
    }
  });

  // ============================================================================
  // 2. TIỆN ÍCH KHỚP URL, NHẬN DIỆN POPUP & TÌM KIẾM ELEMENT LINH HOẠT
  // ============================================================================
  const MODAL_CONTAINER_SELECTOR =
    'dialog, [role="dialog"], [role="alertdialog"], [aria-modal="true"], .modal, .ant-modal, .el-dialog, .mat-mdc-dialog-container, .mat-dialog-container, .ui-dialog, .p-dialog, .k-window, .dx-popup-wrapper, .dxpcLite, .rwWindow, .x-window, .swal2-popup, .iziModal, .bootbox';

  function isElementVisible(el) {
    if (!el || !(el instanceof Element) || !el.isConnected) return false;
    if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return false;
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'dialog' && !el.hasAttribute('open')) {
      const dStyle = window.getComputedStyle(el);
      if (dStyle.display === 'none') return false;
    }
    const style = window.getComputedStyle(el);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      parseFloat(style.opacity || '1') <= 0.01
    ) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 2 && rect.height > 2;
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

  function getContextUrlsForPopupInheritance() {
    const urls = [window.location.href];
    if (window !== window.top) {
      try {
        if (window.top && window.top.location && window.top.location.href) {
          urls.push(window.top.location.href);
        }
      } catch (_) {}
    }
    if (window.opener && window.opener !== window) {
      try {
        if (window.opener.location && window.opener.location.href) {
          urls.push(window.opener.location.href);
        }
      } catch (_) {}
    }
    if (document.referrer) {
      urls.push(document.referrer);
    }
    return urls.filter(Boolean);
  }

  function matchWindowOrFramePopupScope(scopeRaw) {
    const scope = String(scopeRaw || '').trim();
    if (!scope) return true;

    if (/^title\s*:/i.test(scope)) {
      const expected = scope.replace(/^title\s*:\s*/i, '').trim().toLowerCase();
      return Boolean(expected && (document.title || '').toLowerCase().includes(expected));
    }

    if (/^name\s*:/i.test(scope)) {
      const expected = scope.replace(/^name\s*:\s*/i, '').trim().toLowerCase();
      return Boolean(expected && (window.name || '').toLowerCase().includes(expected));
    }

    // Kiểm tra khớp thẻ <iframe> trên trang mẹ
    // Lưu ý quan trọng: window.frameElement thuộc Realm DOM của trang mẹ nên PHẢI kiểm tra nodeType === 1 thay vì instanceof Element!
    if (window !== window.top) {
      try {
        const fe = window.frameElement;
        if (fe && fe.nodeType === 1) {
          if (
            fe.id &&
            (scope === fe.id || scope === `#${fe.id}` || scope === `#${CSS.escape(fe.id)}`)
          ) {
            return true;
          }
          try {
            if (typeof fe.matches === 'function' && fe.matches(scope)) return true;
          } catch (_) {}
          const fName = (fe.getAttribute('name') || '').trim();
          if (fName && fName.toLowerCase() === scope.toLowerCase()) return true;
          const fTitle = (fe.getAttribute('title') || fName || '').toLowerCase();
          if (fTitle && fTitle.includes(scope.toLowerCase())) return true;
        }
      } catch (_) {}
    }

    // Kiểm tra khớp đường dẫn URL của khung con / cửa sổ con
    if (matchUrlPattern(window.location.href, scope)) return true;

    // Kiểm tra khớp tiêu đề trang hoặc phần tử bên trong Popup
    if ((document.title || '').toLowerCase().includes(scope.toLowerCase())) return true;
    if (queryElementsSmart(scope).length > 0) return true;

    return false;
  }

  function findVisibleDomModalsOnPage() {
    const found = Array.from(document.querySelectorAll(MODAL_CONTAINER_SELECTOR)).filter(
      (el) => !isInternalNode(el) && isElementVisible(el)
    );
    return found;
  }

  /**
   * Xác định ngữ cảnh khớp của riêng phần cấu hình Popup (dùng chung cho cả Runtime & nút 🔍 Kiểm tra).
   * Trả về { matched: boolean, scopeRoot: Element | null } hoặc null nếu không khớp.
   */
  function resolvePopupContextScope(popupType, popupScope) {
    const pType = popupType || 'auto';
    const pScope = String(popupScope || '').trim();
    const inIframe = window !== window.top;
    const inDetachedWin = isPopupBrowserWindow || Boolean(window.opener && window.opener !== window);

    if (pType === 'window_popup') {
      if (!inDetachedWin) return null;
      if (!matchWindowOrFramePopupScope(pScope)) return null;
      return { matched: true, scopeRoot: null };
    }

    if (pType === 'iframe_popup') {
      if (!inIframe) return null;
      if (window.innerWidth <= 2 && window.innerHeight <= 2) return null;
      if (!matchWindowOrFramePopupScope(pScope)) return null;
      return { matched: true, scopeRoot: null };
    }

    if (pType === 'dom_modal') {
      if (inIframe) return null;
      if (pScope) {
        const modalMatches = queryElementsSmart(pScope).filter(isElementVisible);
        if (modalMatches.length === 0) return null;
        return { matched: true, scopeRoot: modalMatches[modalMatches.length - 1] };
      }
      const openModals = findVisibleDomModalsOnPage();
      if (openModals.length === 0) return null;
      return { matched: true, scopeRoot: openModals[openModals.length - 1] };
    }

    // pType === 'auto': Tự động suy luận theo ngữ cảnh hiện tại
    if (inDetachedWin) {
      if (!matchWindowOrFramePopupScope(pScope)) return null;
      return { matched: true, scopeRoot: null };
    }
    if (inIframe) {
      if (window.innerWidth <= 2 && window.innerHeight <= 2) return null;
      if (!matchWindowOrFramePopupScope(pScope)) return null;
      return { matched: true, scopeRoot: null };
    }
    if (pScope) {
      const modalMatches = queryElementsSmart(pScope).filter(isElementVisible);
      if (modalMatches.length === 0) return null;
      return { matched: true, scopeRoot: modalMatches[modalMatches.length - 1] };
    }
    const openModals = findVisibleDomModalsOnPage();
    if (openModals.length === 0) return null;
    return { matched: true, scopeRoot: openModals[openModals.length - 1] };
  }

  /**
   * Kiểm tra Kịch bản có khớp với ngữ cảnh Trang / Popup hiện tại không.
   * Trả về { matched: boolean, scopeRoot: Element | null }
   * - scopeRoot là Element khung Modal nếu đang chạy chế độ Popup Modal HTML (khóa chặt không chạm trang nền!).
   */
  function resolveScenarioExecutionContext(rule) {
    if (!rule || rule.enabled === false) return null;
    const targets = Array.isArray(rule.targets) ? rule.targets : [];
    if (!targets.some((t) => t && t.enabled !== false)) return null;

    const isPopupRule = Boolean(rule.isPopup);
    const isPopupOnOpen = isPopupRule && rule.popupTriggerMode === 'on_open';
    if (!isPopupOnOpen && !rule.triggerSelector) return null;

    if (!isPopupRule) {
      // Kịch bản trang thường: chỉ chạy trên trang khớp URL trực tiếp (không rò rỉ vào iframe about:blank)
      if (!matchUrlPattern(window.location.href, rule.urlPattern)) return null;
      return { matched: true, scopeRoot: null };
    }

    // Kịch bản Popup: Bắt buộc URL gốc (hoặc URL kế thừa từ trang mẹ / opener) phải khớp urlPattern
    const candidateUrls = getContextUrlsForPopupInheritance();
    if (!candidateUrls.some((u) => matchUrlPattern(u, rule.urlPattern))) {
      return null;
    }

    return resolvePopupContextScope(rule.popupType, rule.popupScope);
  }

  function getActiveRulesForPage() {
    if (!appState.enabled) return [];
    const results = [];
    for (const r of appState.rules) {
      const ctx = resolveScenarioExecutionContext(r);
      if (ctx && ctx.matched) {
        results.push({ rule: r, scopeRoot: ctx.scopeRoot });
      }
    }
    return results;
  }

  function filterByScopeRoot(list, scopeRoot) {
    if (!(scopeRoot instanceof Element)) return list;
    return list.filter((el) => el === scopeRoot || scopeRoot.contains(el));
  }

  /**
   * Tìm danh sách phần tử theo CSS Selector, XPath (// hoặc (//), tiền tố dòng tương đối (row:), hoặc ID/Name trần.
   * Nếu truyền scopeRoot (ví dụ khung Modal Popup), kết quả được khóa chặt chỉ nằm bên trong scopeRoot.
   */
  function queryElementsSmart(selectorStr, contextEl = null, scopeRoot = null) {
    if (!selectorStr) return [];
    const raw = String(selectorStr).trim();
    if (!raw) return [];

    // 0. Hỗ trợ tiền tố "row:" cho bảng/danh sách động sinh nhiều dòng giống hệt nhau
    if (/^row\s*:/i.test(raw)) {
      const subSel = raw.replace(/^row\s*:\s*/i, '').trim();
      if (!subSel) return [];
      const rowContainer =
        contextEl instanceof Element
          ? contextEl.closest('tr, [role="row"], .row-item, li') || contextEl.parentElement
          : scopeRoot instanceof Element
            ? scopeRoot
            : document;
      if (!rowContainer) return [];
      try {
        return filterByScopeRoot(Array.from(rowContainer.querySelectorAll(subSel)), scopeRoot);
      } catch (_) {
        return [];
      }
    }

    // 1. Hỗ trợ XPath nếu bắt đầu bằng // hoặc (//
    if (raw.startsWith('//') || raw.startsWith('(//')) {
      try {
        const snap = document.evaluate(
          raw,
          document,
          null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
          null
        );
        const list = [];
        for (let i = 0; i < snap.snapshotLength; i++) {
          if (snap.snapshotItem(i) instanceof Element) {
            list.push(snap.snapshotItem(i));
          }
        }
        const scopedList = filterByScopeRoot(list, scopeRoot);
        if (scopedList.length > 0) return scopedList;

        // Nếu khóa trong scopeRoot (VD: Modal Popup có trùng nhãn với nền trang), đánh giá XPath tương đối từ scopeRoot
        if (scopeRoot instanceof Element) {
          const relXpath = raw.startsWith('(//') ? '(.//' + raw.slice(3) : './/' + raw.slice(2);
          const relSnap = document.evaluate(
            relXpath,
            scopeRoot,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
          );
          const relList = [];
          for (let i = 0; i < relSnap.snapshotLength; i++) {
            if (relSnap.snapshotItem(i) instanceof Element) {
              relList.push(relSnap.snapshotItem(i));
            }
          }
          if (relList.length > 0) return filterByScopeRoot(relList, scopeRoot);
        }
        return [];
      } catch (_) {
        return [];
      }
    }

    // 2. Thử CSS Selector chuẩn
    try {
      const found = filterByScopeRoot(Array.from(document.querySelectorAll(raw)), scopeRoot);
      if (found.length > 0) return found;
    } catch (_) {
      // Selector có thể có ký tự đặc biệt trong ID
    }

    // 3. Nếu người dùng gõ thẳng ID hoặc Name không kèm # hoặc [name=...]
    if (!/^[#.\[\/>~+]/.test(raw) && !raw.includes(' ')) {
      if (scopeRoot instanceof Element) {
        try {
          const scopedByIdOrName = Array.from(
            scopeRoot.querySelectorAll(`#${CSS.escape(raw)}, [name="${CSS.escape(raw)}"]`)
          );
          if (scopedByIdOrName.length > 0) return scopedByIdOrName;
        } catch (_) {}
      } else {
        const byId = document.getElementById(raw);
        if (byId) return [byId];
        try {
          const byName = Array.from(document.querySelectorAll(`[name="${CSS.escape(raw)}"]`));
          if (byName.length > 0) return byName;
        } catch (_) {}
      }
    }

    // 4. Nếu bắt đầu bằng # nhưng chứa ký tự đặc biệt (ví dụ ASP.NET ctl00$Content$txtAge)
    if (raw.startsWith('#') && !raw.includes(' ')) {
      const byId = document.getElementById(raw.slice(1));
      if (byId && (!(scopeRoot instanceof Element) || scopeRoot === byId || scopeRoot.contains(byId))) {
        return [byId];
      }
    }

    return [];
  }

  function findFirstElement(selectorStr, contextEl = null, scopeRoot = null) {
    const list = queryElementsSmart(selectorStr, contextEl, scopeRoot);
    return list.length > 0 ? list[0] : null;
  }

  /**
   * Nếu phần tử là vỏ giao diện ảo của Select2 (.select2-container / #select2-xxx-container),
   * tự động truy xuất ngược về thẻ <select> hoặc <input> gốc ẩn bên dưới.
   */
  function resolveUnderlyingControl(el) {
    if (!el || !(el instanceof Element)) return el;
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'select' || tag === 'input' || tag === 'textarea') return el;

    const s2Container = el.closest('.select2-container');
    const renderedSpan =
      (el.id && /^select2-(.+)-container$/.test(el.id) ? el : null) ||
      (s2Container ? s2Container.querySelector('[id^="select2-"][id$="-container"]') : null);

    // Select2 v3.5: #s2id_<elementId>
    if (s2Container && /^s2id_(.+)$/.test(s2Container.id || '')) {
      const origId = s2Container.id.slice(5);
      const byId = document.getElementById(origId);
      if (byId) return byId;
    }

    // Select2 v4.x: #select2-<id_hoac_name>-container
    if (renderedSpan && renderedSpan.id) {
      const m = /^select2-(.+)-container$/.exec(renderedSpan.id);
      if (m && m[1]) {
        const key = m[1];
        const byId = document.getElementById(key);
        if (byId) return byId;
        try {
          const byName = document.querySelector(
            `select[name="${CSS.escape(key)}"], input[name="${CSS.escape(key)}"]`
          );
          if (byName) return byName;
        } catch (_) {}
      }
    }

    if (s2Container) {
      const prev = s2Container.previousElementSibling;
      if (prev && ['select', 'input'].includes((prev.tagName || '').toLowerCase())) {
        return prev;
      }
      const next = s2Container.nextElementSibling;
      if (next && ['select', 'input'].includes((next.tagName || '').toLowerCase())) {
        return next;
      }
    }

    return el;
  }

  /**
   * Ngược lại: Nếu thẻ <select> đang bị ẩn bởi Select2 (.select2-hidden-accessible / .select2-offscreen),
   * trả về khung hiển thị .select2-container để nháy viền sáng đúng chỗ người dùng nhìn thấy.
   */
  function getVisibleControlElement(el) {
    if (!el || !(el instanceof Element)) return el;
    if (
      el.classList.contains('select2-hidden-accessible') ||
      el.classList.contains('select2-offscreen')
    ) {
      const next = el.nextElementSibling;
      if (next && next.classList.contains('select2-container')) {
        return next.querySelector('.select2-selection, .select2-choice') || next;
      }
      if (el.id) {
        const v3 = document.getElementById(`s2id_${el.id}`);
        if (v3) return v3;
      }
    }
    return el;
  }

  let bridgeCounter = 0;
  function callMainWorldBridge(el, payload) {
    if (!el || !(el instanceof Element)) return;
    const bridgeId = `bato_${Date.now()}_${++bridgeCounter}`;
    el.setAttribute('data-bato-bridge-id', bridgeId);
    try {
      window.dispatchEvent(
        new CustomEvent('__bato_main_bridge__', {
          detail: JSON.stringify({ ...payload, bridgeId })
        })
      );
    } finally {
      el.removeAttribute('data-bato-bridge-id');
    }
  }

  /**
   * Kiểm tra xem eventTarget (hoặc tổ tiên của nó) có khớp với triggerSelector không
   */
  function resolveMatchingTriggerElement(eventTarget, selectorStr, scopeRoot = null) {
    if (!(eventTarget instanceof Element) || !selectorStr) return null;
    if (scopeRoot instanceof Element && scopeRoot !== eventTarget && !scopeRoot.contains(eventTarget)) {
      return null;
    }
    const resolvedTarget = resolveUnderlyingControl(eventTarget);
    const candidates = queryElementsSmart(selectorStr, null, scopeRoot);
    if (candidates.length === 0) return null;

    for (const rawCandidate of candidates) {
      const el = resolveUnderlyingControl(rawCandidate);
      if (
        el === resolvedTarget ||
        el === eventTarget ||
        el.contains(eventTarget) ||
        rawCandidate === eventTarget ||
        rawCandidate.contains(eventTarget)
      ) {
        return el;
      }
    }
    return null;
  }

  // ============================================================================
  // 3. ĐỌC & GHI GIÁ TRỊ ELEMENT (TƯƠNG THÍCH REACT / VUE / ANGULAR / SELECT2 / HIS)
  // ============================================================================
  function readElementState(rawEl) {
    const el = resolveUnderlyingControl(rawEl);
    if (!el) return { value: '', text: '', checked: false };
    const tag = (el.tagName || '').toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();

    if (tag === 'select') {
      const selectedOpt = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
      return {
        value: el.value ?? '',
        text: selectedOpt ? selectedOpt.textContent.trim() : '',
        checked: false
      };
    }

    if (tag === 'input' && type === 'checkbox') {
      return {
        value: el.checked ? (el.value || 'true') : '',
        text: el.checked ? 'true' : 'false',
        checked: Boolean(el.checked)
      };
    }

    if (tag === 'input' && type === 'radio') {
      if (el.name) {
        const checkedRadio = document.querySelector(
          `input[type="radio"][name="${CSS.escape(el.name)}"]:checked`
        );
        return {
          value: checkedRadio ? checkedRadio.value : '',
          text: checkedRadio ? checkedRadio.value : '',
          checked: Boolean(el.checked)
        };
      }
      return {
        value: el.checked ? el.value : '',
        text: el.checked ? el.value : '',
        checked: Boolean(el.checked)
      };
    }

    if (tag === 'input' || tag === 'textarea') {
      return {
        value: el.value ?? '',
        text: el.value ?? '',
        checked: false
      };
    }

    if (el.isContentEditable) {
      const txt = el.innerText || el.textContent || '';
      return { value: txt.trim(), text: txt.trim(), checked: false };
    }

    const txt = (el.textContent || '').trim();
    return {
      value: el.getAttribute('value') ?? txt,
      text: txt,
      checked: false
    };
  }

  /**
   * Đặt giá trị thông qua Native Prototype Setter để đánh thức React / Vue / Angular
   */
  function setNativeValue(element, value) {
    const tag = (element.tagName || '').toLowerCase();
    let proto = null;
    if (tag === 'input') proto = window.HTMLInputElement && window.HTMLInputElement.prototype;
    else if (tag === 'textarea') proto = window.HTMLTextAreaElement && window.HTMLTextAreaElement.prototype;
    else if (tag === 'select') proto = window.HTMLSelectElement && window.HTMLSelectElement.prototype;

    if (proto) {
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
      if (descriptor && descriptor.set) {
        descriptor.set.call(element, value);
        return;
      }
    }
    element.value = value;
  }

  function setNativeChecked(element, checked) {
    const proto = window.HTMLInputElement && window.HTMLInputElement.prototype;
    const descriptor = proto ? Object.getOwnPropertyDescriptor(proto, 'checked') : null;
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, checked);
    } else {
      element.checked = checked;
    }
  }

  function dispatchFormEvents(el) {
    el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));

    // Đồng bộ giao diện cho Select2 / jQuery Plugins ở MAIN World (nếu có)
    if (
      (el.tagName || '').toLowerCase() === 'select' ||
      el.classList.contains('select2-hidden-accessible') ||
      el.classList.contains('select2-offscreen')
    ) {
      callMainWorldBridge(el, { action: 'sync_control' });
    }
  }

  /**
   * Điền/chọn dữ liệu cho phần tử đích
   * Trả về { status: 'updated' | 'unchanged' | 'not_found', detail: string }
   */
  function applyValueToTarget(selectorStr, actionType, rawValue, contextEl = null, scopeRoot = null) {
    const elements = queryElementsSmart(selectorStr, contextEl, scopeRoot);
    if (elements.length === 0) {
      return { status: 'not_found', detail: `Không tìm thấy phần tử: ${selectorStr}` };
    }

    const mode = actionType || 'auto';
    const rawFirst = elements[0];
    // Với lệnh click thuần thì giữ nguyên phần tử đích; các lệnh đọc/ghi dữ liệu tự động quy về control gốc (Select2 -> <select>)
    const el = mode === 'click' ? rawFirst : resolveUnderlyingControl(rawFirst);
    const tag = (el.tagName || '').toLowerCase();
    const inputType = (el.getAttribute('type') || '').toLowerCase();
    const strVal = String(rawValue ?? '');

    // 1. Hành động CLICK
    if (mode === 'click') {
      const truthy =
        rawValue === true ||
        (strVal !== '' && strVal.toLowerCase() !== 'false' && strVal !== '0');
      if (truthy) {
        el.click();
        return { status: 'updated', detail: 'Đã click phần tử' };
      }
      return { status: 'unchanged', detail: 'Điều kiện click = false' };
    }

    // 2. Hành động CHECKBOX
    if (mode === 'checkbox' || (mode === 'auto' && tag === 'input' && inputType === 'checkbox')) {
      const shouldCheck =
        rawValue === true ||
        rawValue === 1 ||
        ['true', '1', 'yes', 'on', 'checked', 'co', 'có'].includes(strVal.trim().toLowerCase());
      if (Boolean(el.checked) === shouldCheck) {
        return { status: 'unchanged', detail: `Checkbox đã là ${shouldCheck}` };
      }
      setNativeChecked(el, shouldCheck);
      dispatchFormEvents(el);
      highlightElementBriefly(el);
      return { status: 'updated', detail: shouldCheck ? 'Đã tick chọn' : 'Đã bỏ tick' };
    }

    // 3. Hành động RADIO
    if (mode === 'radio' || (mode === 'auto' && tag === 'input' && inputType === 'radio')) {
      let radioGroup = elements.filter(
        (item) => (item.getAttribute('type') || '').toLowerCase() === 'radio'
      );
      if (radioGroup.length <= 1 && el.name) {
        radioGroup = Array.from(
          document.querySelectorAll(`input[type="radio"][name="${CSS.escape(el.name)}"]`)
        );
      }
      const targetLower = strVal.trim().toLowerCase();
      let matchedRadio = radioGroup.find(
        (r) => String(r.value).trim().toLowerCase() === targetLower
      );
      if (!matchedRadio) {
        matchedRadio = radioGroup.find((r) => {
          const lbl = r.id ? document.querySelector(`label[for="${CSS.escape(r.id)}"]`) : r.closest('label');
          return lbl && lbl.textContent.trim().toLowerCase() === targetLower;
        });
      }
      if (!matchedRadio && radioGroup.length === 1 && ['true', '1', 'checked'].includes(targetLower)) {
        matchedRadio = radioGroup[0];
      }

      if (!matchedRadio) {
        return { status: 'not_found', detail: `Không tìm thấy radio khớp "${strVal}"` };
      }
      if (matchedRadio.checked) {
        return { status: 'unchanged', detail: `Radio "${strVal}" đã chọn sẵn` };
      }
      setNativeChecked(matchedRadio, true);
      dispatchFormEvents(matchedRadio);
      highlightElementBriefly(matchedRadio);
      return { status: 'updated', detail: `Đã chọn radio: ${strVal}` };
    }

    // 4. Hành động SELECT (DROPDOWN)
    if (tag === 'select' || mode === 'select_value' || mode === 'select_text') {
      if (tag === 'select') {
        const options = Array.from(el.options || []);
        const targetTrim = strVal.trim();
        const targetLower = targetTrim.toLowerCase();
        let matchedOpt = null;

        if (mode === 'select_text') {
          matchedOpt =
            options.find((o) => o.textContent.trim() === targetTrim) ||
            options.find((o) => o.textContent.trim().toLowerCase() === targetLower) ||
            options.find((o) => o.value === targetTrim) ||
            (targetLower.length >= 2
              ? options.find((o) => o.textContent.trim().toLowerCase().includes(targetLower))
              : null);
        } else {
          matchedOpt =
            options.find((o) => o.value === targetTrim) ||
            options.find((o) => o.value.trim().toLowerCase() === targetLower) ||
            options.find((o) => o.textContent.trim() === targetTrim) ||
            options.find((o) => o.textContent.trim().toLowerCase() === targetLower) ||
            (targetLower.length >= 2
              ? options.find((o) => o.textContent.trim().toLowerCase().includes(targetLower))
              : null);
        }

        if (!matchedOpt) {
          return {
            status: 'not_found',
            detail: `Dropdown không có mục nào khớp "${strVal}"`
          };
        }

        if (el.value === matchedOpt.value) {
          return {
            status: 'unchanged',
            detail: `Đã chọn sẵn "${matchedOpt.textContent.trim()}"`
          };
        }

        setNativeValue(el, matchedOpt.value);
        dispatchFormEvents(el);
        highlightElementBriefly(el);
        return {
          status: 'updated',
          detail: `${matchedOpt.textContent.trim()} (${matchedOpt.value})`
        };
      }
    }

    // 5. Hành động INPUT / TEXTAREA / CONTENTEDITABLE
    if (el.isContentEditable) {
      if ((el.innerText || '').trim() === strVal) {
        return { status: 'unchanged', detail: 'Giá trị không đổi' };
      }
      el.innerText = strVal;
      dispatchFormEvents(el);
      highlightElementBriefly(el);
      return { status: 'updated', detail: strVal };
    }

    if (String(el.value ?? '') === strVal) {
      return { status: 'unchanged', detail: 'Giá trị không đổi' };
    }

    setNativeValue(el, strVal);
    dispatchFormEvents(el);
    highlightElementBriefly(el);
    return { status: 'updated', detail: strVal };
  }

  /**
   * Hiệu ứng nháy viền xanh nhẹ 700ms báo hiệu ô vừa được BATO_SMART_FILL điền tự động
   */
  function highlightElementBriefly(rawEl) {
    const el = getVisibleControlElement(rawEl);
    if (!el || !el.style) return;
    const prevOutline = el.style.outline;
    const prevTransition = el.style.transition;
    el.style.transition = 'outline 0.25s ease';
    el.style.outline = '2px solid #10b981';
    setTimeout(() => {
      el.style.outline = prevOutline;
      el.style.transition = prevTransition;
    }, 800);
  }

  // ============================================================================
  // 4. ĐÁNH GIÁ GIÁ TRỊ THEO CHẾ ĐỘ (FIXED / MAPPING / CUSTOM JS)
  // ============================================================================
  function collectDomSnapshotForScript(scriptCode, contextEl = null, scopeRoot = null) {
    const snapshot = {};

    // 1. Quét tất cả input / select / textarea (ưu tiên ghi đè bởi phần tử nằm trong scopeRoot nếu đang chạy trong Popup)
    const rootNode = scopeRoot instanceof Element ? scopeRoot : document;
    const baseControls =
      rootNode !== document
        ? [
            ...Array.from(document.querySelectorAll('input, select, textarea')),
            ...Array.from(rootNode.querySelectorAll('input, select, textarea'))
          ]
        : Array.from(document.querySelectorAll('input, select, textarea'));

    baseControls.forEach((ctrl) => {
      const state = readElementState(ctrl);
      if (ctrl.id) {
        snapshot[`#${ctrl.id}`] = state;
        snapshot[ctrl.id] = state;
      }
      if (ctrl.name) {
        snapshot[`[name="${ctrl.name}"]`] = state;
        if (!snapshot[ctrl.name] || rootNode.contains(ctrl)) snapshot[ctrl.name] = state;
      }
    });

    // 2. Quét thêm mọi chuỗi trong ngoặc kép/đơn của scriptCode (hỗ trợ cả CSS phức tạp, XPath //, (//, và row:)
    const strRegex = /(['"`])((?:\\.|(?!\1)[^\\\r\n])*)\1/g;
    let match;
    while ((match = strRegex.exec(String(scriptCode || ''))) !== null) {
      const candidate = match[2].trim();
      if (!candidate || candidate.length > 320) continue;
      if (
        candidate.startsWith('//') ||
        candidate.startsWith('(//') ||
        /^row\s*:/i.test(candidate) ||
        /^[#.\[a-zA-Z]/.test(candidate) ||
        document.getElementById(candidate)
      ) {
        const el =
          findFirstElement(candidate, contextEl, scopeRoot) ||
          findFirstElement(candidate, contextEl, null);
        if (el) {
          snapshot[candidate] = readElementState(el);
        }
      }
    }

    return snapshot;
  }

  function resolveTemplateTokens(str, triggerState) {
    if (typeof str !== 'string' || !str.includes('{{')) return str;
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');

    return str
      .replace(/\{\{\s*trigger\s*\}\}/gi, triggerState.value ?? '')
      .replace(/\{\{\s*triggerText\s*\}\}/gi, triggerState.text ?? '')
      .replace(/\{\{\s*today\s*\}\}/gi, `${yyyy}-${mm}-${dd}`)
      .replace(/\{\{\s*today_vn\s*\}\}/gi, `${dd}/${mm}/${yyyy}`);
  }

  function evaluateMappingRules(targetCfg, triggerVal, contextEl = null, scopeRoot = null) {
    const rows = Array.isArray(targetCfg.mappings) ? targetCfg.mappings : [];

    for (const row of rows) {
      if (!row) continue;

      // Cho phép tùy chỉnh Element nguồn điều kiện trên từng dòng (ưu tiên tìm trong Popup trước, rồi tới toàn trang)
      let sourceVal = triggerVal;
      if (row.sourceSelector && String(row.sourceSelector).trim() !== '') {
        const customSourceEl =
          findFirstElement(row.sourceSelector, contextEl, scopeRoot) ||
          findFirstElement(row.sourceSelector, contextEl, null);
        sourceVal = readElementState(customSourceEl).value;
      }

      const rawStr = String(sourceVal ?? '').trim();
      const rawLower = rawStr.toLowerCase();
      const numSource = parseFloat(rawStr);

      const op = row.operator || 'eq';
      const cmpStr = String(row.matchValue ?? '').trim();
      const cmpLower = cmpStr.toLowerCase();
      const numCmp = parseFloat(cmpStr);
      let matched = false;

      switch (op) {
        case 'eq':
          matched = rawLower === cmpLower;
          break;
        case 'neq':
          matched = rawLower !== cmpLower;
          break;
        case 'contains':
          matched = cmpLower !== '' && rawLower.includes(cmpLower);
          break;
        case 'starts':
          matched = cmpLower !== '' && rawLower.startsWith(cmpLower);
          break;
        case 'lt':
          matched = !Number.isNaN(numSource) && !Number.isNaN(numCmp) && numSource < numCmp;
          break;
        case 'lte':
          matched = !Number.isNaN(numSource) && !Number.isNaN(numCmp) && numSource <= numCmp;
          break;
        case 'gt':
          matched = !Number.isNaN(numSource) && !Number.isNaN(numCmp) && numSource > numCmp;
          break;
        case 'gte':
          matched = !Number.isNaN(numSource) && !Number.isNaN(numCmp) && numSource >= numCmp;
          break;
        case 'empty':
          matched = rawStr === '';
          break;
        case 'not_empty':
          matched = rawStr !== '';
          break;
        default:
          matched = rawLower === cmpLower;
      }

      if (matched) {
        if (row.resultAction === 'keep') {
          return null;
        }
        return row.outputValue ?? '';
      }
    }

    if (targetCfg.mappingFallbackMode === 'fixed') {
      return targetCfg.mappingFallbackValue ?? '';
    }
    return null; // Mặc định: Không khớp điều kiện nào thì giữ nguyên
  }

  function parsePluginParams(rawParams) {
    if (rawParams === null || rawParams === undefined) return {};
    const str = String(rawParams).trim();
    if (!str) return {};
    if ((str.startsWith('{') && str.endsWith('}')) || (str.startsWith('[') && str.endsWith(']'))) {
      try {
        return JSON.parse(str);
      } catch (_) {
        return str;
      }
    }
    return str;
  }

  function shouldSkipProtectedTarget(targetCfg, targetState) {
    // 1. Chỉ điền khi ô đang trống
    if (targetCfg.onlyIfEmpty && String(targetState.value ?? '').trim() !== '') {
      return `Ô đã có dữ liệu (${targetState.text || targetState.value})`;
    }

    // 2. Danh sách các giá trị đặc thù giữ nguyên không ghi đè
    if (targetCfg.keepValues && String(targetCfg.keepValues).trim() !== '') {
      const protectedList = String(targetCfg.keepValues)
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      const curValLower = String(targetState.value ?? '').trim().toLowerCase();
      const curTextLower = String(targetState.text ?? '').trim().toLowerCase();

      if (
        (curValLower && protectedList.includes(curValLower)) ||
        (curTextLower && protectedList.includes(curTextLower))
      ) {
        return `Giữ nguyên option cố định (${targetState.text || targetState.value})`;
      }
    }

    return null;
  }

  // ============================================================================
  // 5. THỰC THI RULE KHI SỰ KIỆN KẾT THÚC
  // ============================================================================
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function executeRule(rule, triggerEl, eventType, scopeRoot = null) {
    if (activeChainDepth >= 5) {
      console.warn('[BATO_SMART_FILL] Đã dừng chuỗi kích hoạt quá 5 tầng để tránh vòng lặp.');
      return;
    }

    activeChainDepth++;
    clearTimeout(chainResetTimer);
    chainResetTimer = setTimeout(() => {
      activeChainDepth = 0;
    }, 1200);

    try {
      const triggerState = readElementState(triggerEl);
      const targets = Array.isArray(rule.targets) ? rule.targets : [];
      if (targets.length === 0) return;

      let updatedCount = 0;

      for (const targetCfg of targets) {
        if (!targetCfg || targetCfg.enabled === false) continue;

        // Mỗi phần tử (Rule con) chỉ chạy theo 1 phương thức duy nhất đã chọn ở Dropdown của nó
        const fillMode = targetCfg.mode || 'fixed';
        if (fillMode !== 'plugin' && !targetCfg.selector) continue;

        const delayMs = Math.max(0, parseInt(targetCfg.delayMs, 10) || 0);
        if (delayMs > 0) {
          await sleep(delayMs);
        }

        const targetEl = targetCfg.selector
          ? findFirstElement(targetCfg.selector, triggerEl, scopeRoot)
          : null;
        const targetState = readElementState(targetEl);

        if (targetCfg.selector && fillMode === 'fixed') {
          const skipReason = shouldSkipProtectedTarget(targetCfg, targetState);
          if (skipReason) continue;
        }

        let computedValue = null;

        if (fillMode === 'fixed') {
          computedValue = resolveTemplateTokens(String(targetCfg.fixedValue ?? ''), triggerState);
        } else if (fillMode === 'mapping') {
          computedValue = evaluateMappingRules(targetCfg, triggerState.value, triggerEl, scopeRoot);
        } else if (fillMode === 'script') {
          const domSnapshot = collectDomSnapshotForScript(
            targetCfg.scriptCode,
            triggerEl,
            scopeRoot
          );
          const evalRes = await chrome.runtime.sendMessage({
            type: 'BATO_EVAL_SCRIPT',
            scriptCode: targetCfg.scriptCode || '',
            triggerVal: triggerState.value,
            contextData: {
              currentVal: targetState.value,
              currentText: targetState.text,
              triggerText: triggerState.text,
              url: window.location.href,
              domSnapshot
            }
          });

          // In toàn bộ console.log / warn / error từ Script Sandbox ra thẳng F12 Console của trang web
          if (evalRes && Array.isArray(evalRes.logs) && evalRes.logs.length > 0) {
            const logPrefix = `[BATO_SMART_FILL • ${rule.name || 'Script'} -> ${targetCfg.selector || 'Rule'}]`;
            evalRes.logs.forEach((entry) => {
              const fn =
                entry.level === 'error'
                  ? console.error
                  : entry.level === 'warn'
                    ? console.warn
                    : console.log;
              fn.call(console, logPrefix, ...(Array.isArray(entry.args) ? entry.args : [entry.args]));
            });
          }

          if (!evalRes || !evalRes.ok) {
            const errMsg = (evalRes && evalRes.error) || 'Lỗi thực thi Script';
            console.error(`[BATO_SMART_FILL] Lỗi Script ở Kịch bản "${rule.name}":`, errMsg);
            showToast(`⚠️ Lỗi Script (${rule.name}): ${errMsg}`, true);
            continue;
          }
          computedValue = evalRes.result;
        } else if (fillMode === 'plugin') {
          const pluginId = String(targetCfg.pluginName || '').trim();
          const pluginRegistry = window.BATO_PLUGINS || {};
          const pluginDef = pluginRegistry[pluginId];

          if (!pluginDef || typeof pluginDef.handler !== 'function') {
            const errMsg = `Không tìm thấy Plugin JS "${pluginId}" trong plugins/custom-plugins.js`;
            console.error('[BATO_SMART_FILL]', errMsg);
            showToast(`⚠️ ${errMsg}`, true);
            continue;
          }

          try {
            const parsedParams = parsePluginParams(targetCfg.pluginParams);
            const pluginHelpers = {
              getVal: (sel) =>
                readElementState(
                  findFirstElement(sel, triggerEl, scopeRoot) || findFirstElement(sel, triggerEl, null)
                ).value,
              getText: (sel) =>
                readElementState(
                  findFirstElement(sel, triggerEl, scopeRoot) || findFirstElement(sel, triggerEl, null)
                ).text,
              isChecked: (sel) =>
                readElementState(
                  findFirstElement(sel, triggerEl, scopeRoot) || findFirstElement(sel, triggerEl, null)
                ).checked,
              query: (sel) => queryElementsSmart(sel, triggerEl, scopeRoot),
              resolveControl: resolveUnderlyingControl,
              getVisibleEl: getVisibleControlElement,
              highlight: (elOrSel) => {
                const rawTarget =
                  elOrSel instanceof Element
                    ? elOrSel
                    : findFirstElement(elOrSel, triggerEl, scopeRoot);
                if (rawTarget) highlightElementBriefly(rawTarget);
              },
              openSelect2: (selOrEl) => {
                const rawTarget =
                  selOrEl instanceof Element
                    ? selOrEl
                    : findFirstElement(selOrEl, triggerEl, scopeRoot);
                const ctrl = resolveUnderlyingControl(rawTarget);
                if (!ctrl) return false;
                callMainWorldBridge(ctrl, { action: 'select2_open' });
                return true;
              },
              closeSelect2: (selOrEl) => {
                const rawTarget =
                  selOrEl instanceof Element
                    ? selOrEl
                    : findFirstElement(selOrEl, triggerEl, scopeRoot);
                const ctrl = resolveUnderlyingControl(rawTarget);
                if (!ctrl) return false;
                callMainWorldBridge(ctrl, { action: 'select2_close' });
                return true;
              },
              setValue: (sel, val, act = 'auto') =>
                applyValueToTarget(sel, act, val, triggerEl, scopeRoot),
              setSelect2: (selOrEl, opts = {}) => {
                const rawTarget =
                  selOrEl instanceof Element
                    ? selOrEl
                    : findFirstElement(selOrEl, triggerEl, scopeRoot);
                const ctrl = resolveUnderlyingControl(rawTarget);
                if (!ctrl) return false;
                callMainWorldBridge(ctrl, {
                  action: 'select2_set',
                  value: opts.value ?? '',
                  text: opts.text ?? opts.value ?? '',
                  createIfMissing: opts.createIfMissing !== false
                });
                highlightElementBriefly(ctrl);
                return true;
              },
              sleep
            };

            const pluginOut = await pluginDef.handler({
              triggerEl,
              targetEl,
              triggerVal: triggerState.value,
              triggerText: triggerState.text,
              currentVal: targetState.value,
              currentText: targetState.text,
              params: parsedParams,
              helpers: pluginHelpers
            });

            if (pluginOut && typeof pluginOut === 'object' && pluginOut.handled === true) {
              updatedCount++;
              continue;
            }

            computedValue = pluginOut;
          } catch (pluginErr) {
            const errMsg = pluginErr && pluginErr.message ? pluginErr.message : String(pluginErr);
            console.error(`[BATO_SMART_FILL] Lỗi thực thi Plugin "${pluginId}":`, errMsg);
            showToast(`⚠️ Lỗi Plugin (${pluginId}): ${errMsg}`, true);
            continue;
          }
        }

        if (computedValue === null || computedValue === undefined) {
          continue;
        }

        if (!targetCfg.selector) {
          continue;
        }

        const applyRes = applyValueToTarget(
          targetCfg.selector,
          targetCfg.actionType || 'auto',
          computedValue,
          triggerEl,
          scopeRoot
        );

        if (applyRes.status === 'updated') {
          updatedCount++;
        }
      }

      if (updatedCount > 0 && appState.showToast) {
        showToast(`⚡ ${rule.name || 'BATO_SMART_FILL'}: Đã tự động điền ${updatedCount} mục`);
      }
    } finally {
      setTimeout(() => {
        activeChainDepth = Math.max(0, activeChainDepth - 1);
      }, 80);
    }
  }

  function scheduleRuleExecution(rule, triggerEl, eventType, isImmediate = false, scopeRoot = null) {
    let elemMap = lastProcessedValues.get(rule.id);
    if (!elemMap) {
      elemMap = new WeakMap();
      lastProcessedValues.set(rule.id, elemMap);
    }

    const eventStartTs = Date.now();
    if (!scenarioActiveSinceTs.has(rule.id)) {
      scenarioActiveSinceTs.set(rule.id, eventStartTs);
    }
    const timerKey = `${rule.id}`;
    const currentToken = (scenarioRunTokens.get(rule.id) || 0) + 1;
    scenarioRunTokens.set(rule.id, currentToken);

    if (debounceTimers.has(timerKey)) {
      clearTimeout(debounceTimers.get(timerKey));
    }

    const initialDebounceMs = isImmediate ? 0 : 350;
    const extraWaitMs = Math.max(0, parseInt(rule.triggerWaitMs, 10) || 0);

    const timer = setTimeout(async () => {
      debounceTimers.delete(timerKey);
      const settleBaseTs = scenarioActiveSinceTs.get(rule.id) || eventStartTs;

      // 1. Chờ Event đồng bộ, API ngầm (fetch/XHR) và re-render DOM của trang web hoàn tất
      if (rule.waitForSettled !== false) {
        await waitForWebEventSettled(settleBaseTs, rule.maxSettleMs || 3000);
        if (scenarioRunTokens.get(rule.id) !== currentToken) return;
      }

      // 2. Chờ thêm độ trễ cố định (nếu người dùng có cài đặt thêm)
      if (extraWaitMs > 0) {
        await sleep(extraWaitMs);
        if (scenarioRunTokens.get(rule.id) !== currentToken) return;
      }

      scenarioActiveSinceTs.delete(rule.id);

      // Cập nhật lại scopeRoot mới nhất nếu Modal vừa được framework render lại
      const freshCtx = resolveScenarioExecutionContext(rule);
      const liveScopeRoot =
        scopeRoot && scopeRoot.isConnected ? scopeRoot : freshCtx ? freshCtx.scopeRoot : null;

      // Trường hợp sau khi API xong, framework render lại thay thế node DOM mới
      const liveTriggerEl =
        triggerEl && triggerEl.isConnected
          ? triggerEl
          : (rule.triggerSelector ? findFirstElement(rule.triggerSelector, null, liveScopeRoot) : null) ||
            liveScopeRoot ||
            triggerEl;

      const currentVal = readElementState(liveTriggerEl).value;

      // Ở chế độ 'auto', tránh nổ trùng lặp cùng 1 giá trị khi input -> change -> blur nối tiếp nhau
      if (
        (rule.triggerEvent || 'auto') === 'auto' &&
        eventType !== 'click' &&
        eventType !== 'enter' &&
        eventType !== 'appear' &&
        eventType !== 'popup_open'
      ) {
        if (liveTriggerEl && typeof liveTriggerEl === 'object') {
          const prevVal = elemMap.get(liveTriggerEl);
          if (prevVal !== undefined && prevVal === currentVal) {
            return;
          }
          elemMap.set(liveTriggerEl, currentVal);
        }
      }

      executeRule(rule, liveTriggerEl, eventType, liveScopeRoot);
    }, initialDebounceMs);

    debounceTimers.set(timerKey, timer);
  }

  // ============================================================================
  // 6. ĐĂNG KÝ BỘ LẮNG NGHE SỰ KIỆN TOÀN CỤC & PHÁT HIỆN POPUP MỞ (APPEAR / ON_OPEN)
  // ============================================================================
  function handleDelegatedEvent(domEvent, mappedType) {
    const activeEntries = getActiveRulesForPage();
    if (activeEntries.length === 0) return;

    for (const { rule, scopeRoot } of activeEntries) {
      if (rule.isPopup && rule.popupTriggerMode === 'on_open') continue;
      const ruleEvent = rule.triggerEvent || 'auto';
      if (ruleEvent === 'appear') continue;

      const triggerEl = resolveMatchingTriggerElement(
        domEvent.target,
        rule.triggerSelector,
        scopeRoot
      );
      if (!triggerEl) continue;

      if (ruleEvent === 'auto') {
        if (mappedType === 'change' || mappedType === 'blur' || mappedType === 'enter') {
          scheduleRuleExecution(rule, triggerEl, mappedType, true, scopeRoot);
        } else if (mappedType === 'input') {
          const tag = (triggerEl.tagName || '').toLowerCase();
          if (tag === 'select') {
            scheduleRuleExecution(rule, triggerEl, 'change', true, scopeRoot);
          } else {
            scheduleRuleExecution(rule, triggerEl, 'input', false, scopeRoot);
          }
        }
      } else if (ruleEvent === mappedType) {
        const immediate = mappedType !== 'input';
        scheduleRuleExecution(rule, triggerEl, mappedType, immediate, scopeRoot);
      }
    }
  }

  function evaluateAppearAndPopupOpenRules() {
    if (!appState.enabled || !Array.isArray(appState.rules) || appState.rules.length === 0) return;

    for (const rule of appState.rules) {
      if (!rule || rule.enabled === false) continue;

      // Nhánh A: Kịch bản Popup kích hoạt "Ngay khi Popup vừa mở lên" (on_open)
      if (rule.isPopup && rule.popupTriggerMode === 'on_open') {
        const prevModal = activeModalOpenTrackers.get(rule.id);
        if (prevModal && (!prevModal.isConnected || !isElementVisible(prevModal))) {
          activeModalOpenTrackers.delete(rule.id);
        }

        const ctx = resolveScenarioExecutionContext(rule);
        if (!ctx || !ctx.matched) {
          activeModalOpenTrackers.delete(rule.id);
          continue;
        }

        if (ctx.scopeRoot instanceof Element) {
          // Modal HTML: nổ đúng 1 lần mỗi khi Modal chuyển sang trạng thái hiển thị
          if (activeModalOpenTrackers.get(rule.id) !== ctx.scopeRoot) {
            activeModalOpenTrackers.set(rule.id, ctx.scopeRoot);
            const triggerNode =
              (rule.triggerSelector
                ? findFirstElement(rule.triggerSelector, null, ctx.scopeRoot)
                : null) || ctx.scopeRoot;
            scheduleRuleExecution(rule, triggerNode, 'popup_open', true, ctx.scopeRoot);
          }
        } else {
          // Iframe Popup / Window.open Popup: nổ 1 lần ngay khi khung có kích thước hiển thị
          if (window.innerWidth > 10 && window.innerHeight > 10) {
            if (!activeWindowPopupFired.has(rule.id)) {
              activeWindowPopupFired.add(rule.id);
              const triggerNode =
                (rule.triggerSelector ? findFirstElement(rule.triggerSelector) : null) ||
                document.body;
              scheduleRuleExecution(rule, triggerNode, 'popup_open', true, null);
            }
          } else {
            activeWindowPopupFired.delete(rule.id);
          }
        }
        continue;
      }

      // Nhánh B: Sự kiện "appear" (Khi phần tử Trigger xuất hiện trên màn hình)
      if (rule.triggerEvent === 'appear' && rule.triggerSelector) {
        const prevEl = activeAppearTrackers.get(rule.id);
        if (prevEl && (!prevEl.isConnected || !isElementVisible(prevEl))) {
          activeAppearTrackers.delete(rule.id);
        }

        const ctx = resolveScenarioExecutionContext(rule);
        if (!ctx || !ctx.matched) continue;

        const foundEl = findFirstElement(rule.triggerSelector, null, ctx.scopeRoot);
        if (foundEl && isElementVisible(foundEl)) {
          if (activeAppearTrackers.get(rule.id) !== foundEl) {
            activeAppearTrackers.set(rule.id, foundEl);
            scheduleRuleExecution(rule, foundEl, 'appear', true, ctx.scopeRoot);
          }
        }
      }
    }
  }

  function schedulePopupAppearCheck() {
    if (appearCheckTimer) return;
    appearCheckTimer = setTimeout(() => {
      appearCheckTimer = null;
      evaluateAppearAndPopupOpenRules();
    }, 75);
  }

  const popupAppearObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (!isInternalNode(m.target)) {
        schedulePopupAppearCheck();
        break;
      }
    }
  });

  if (document.documentElement) {
    popupAppearObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'open', 'aria-hidden']
    });
  }
  window.addEventListener('resize', schedulePopupAppearCheck);

  document.addEventListener('change', (e) => handleDelegatedEvent(e, 'change'), true);
  document.addEventListener('input', (e) => handleDelegatedEvent(e, 'input'), true);
  document.addEventListener('focusout', (e) => handleDelegatedEvent(e, 'blur'), true);
  document.addEventListener('click', (e) => handleDelegatedEvent(e, 'click'), true);
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Enter') {
        handleDelegatedEvent(e, 'enter');
      }
    },
    true
  );

  // Lắng nghe tức thì sự kiện $(el).trigger('change') từ Select2 / Datepicker ở MAIN World
  window.addEventListener('__bato_jq_change__', (e) => {
    const token = e && e.detail && e.detail.token;
    if (!token) return;
    const target = document.querySelector(`[data-bato-jq-chg="${token}"]`);
    if (target) {
      handleDelegatedEvent({ target }, 'change');
    }
  });

  // Bộ theo dõi bổ trợ (650ms) cho các thư viện UI đặc thù (jQuery Datepicker, Select2...)
  // thay đổi .value bằng code JS mà không bắn sự kiện DOM tiêu chuẩn
  setInterval(() => {
    const activeEntries = getActiveRulesForPage();
    if (activeEntries.length === 0) return;

    for (const { rule, scopeRoot } of activeEntries) {
      if (rule.isPopup && rule.popupTriggerMode === 'on_open') continue;
      if ((rule.triggerEvent || 'auto') !== 'auto') continue;
      const triggerEl = findFirstElement(rule.triggerSelector, null, scopeRoot);
      if (!triggerEl || document.activeElement === triggerEl) continue;

      let elemMap = lastProcessedValues.get(rule.id);
      if (!elemMap) {
        elemMap = new WeakMap();
        lastProcessedValues.set(rule.id, elemMap);
      }

      const curVal = readElementState(triggerEl).value;
      const prevVal = elemMap.get(triggerEl);

      // Lần đầu tiên ghi nhận giá trị gốc của form mà chưa chạy đè
      if (prevVal === undefined) {
        elemMap.set(triggerEl, curVal);
        continue;
      }

      if (curVal !== prevVal && !debounceTimers.has(`${rule.id}`)) {
        elemMap.set(triggerEl, curVal);
        (async () => {
          if (rule.waitForSettled !== false) {
            await waitForWebEventSettled(Date.now(), rule.maxSettleMs || 3000);
          }
          executeRule(rule, triggerEl, 'auto-detect', scopeRoot);
        })();
      }
    }
  }, 650);

  // ============================================================================
  // 7. CÔNG CỤ 🎯 ELEMENT PICKER & BỘ SINH SELECTOR THÔNG MINH CHO ELEMENT ĐỘNG
  // ============================================================================
  let pickerActive = false;
  let pickerOverlay = null;
  let pickerBanner = null;
  let pickerHoveredEl = null;
  let lastComputedHoverEl = null;
  let lastComputedHoverSel = '';

  const DYNAMIC_ID_REGEX =
    /^(:r|:R|mui-|radix-|headlessui-|el-id-|rc_select_|rc-tabs-|ant-|mat-input-|mat-select-|mat-option-|mat-mdc-|cdk-|pn_id_|pr_id_|select2-|s2id_autogen|ui-id-|ext-gen|ext-comp-|dx_|k-|ember\d+)/i;

  const TRANSIENT_CLASS_REGEX =
    /^(active|focus|focused|hover|open|opened|show|shown|selected|disabled|readonly|hidden|ng-|v-|is-|has-|js-|select2-|ant-select-|el-input|mui|cdk-|mat-)/i;

  const SEMANTIC_ATTRS = [
    'name',
    'formcontrolname',
    'ng-model',
    'v-model',
    'data-bind',
    'data-testid',
    'data-cy',
    'data-field',
    'data-name',
    'data-column',
    'data-key',
    'aria-label',
    'placeholder',
    'title'
  ];

  function isStableElementId(id) {
    if (!id || typeof id !== 'string') return false;
    const trimmed = id.trim();
    if (!trimmed || trimmed.length > 80 || /\s/.test(trimmed)) return false;
    if (DYNAMIC_ID_REGEX.test(trimmed)) return false;
    if (/^\d+$/.test(trimmed)) return false;
    if (/[0-9a-f]{8}-[0-9a-f]{4}-/i.test(trimmed)) return false;
    if (/[_-]\d{5,}$/.test(trimmed)) return false;
    return true;
  }

  function getStableClasses(el, maxCount = 2) {
    if (!el || !el.classList) return [];
    const out = [];
    for (const cls of el.classList) {
      if (!cls || cls.length > 45) continue;
      if (TRANSIENT_CLASS_REGEX.test(cls)) continue;
      if (/[0-9a-f]{6,}/i.test(cls) || /\d{4,}/.test(cls)) continue;
      out.push(cls);
      if (out.length >= maxCount) break;
    }
    return out;
  }

  function toXPathLiteral(str) {
    const s = String(str ?? '');
    if (!s.includes('"')) return `"${s}"`;
    if (!s.includes("'")) return `'${s}'`;
    return `concat("${s.split('"').join('", \'"\', "')}")`;
  }

  function isExactUniqueMatch(selector, targetEl) {
    if (!selector || !targetEl) return false;
    const matches = queryElementsSmart(selector);
    return matches.length === 1 && matches[0] === targetEl;
  }

  function cleanLabelText(raw) {
    if (!raw) return '';
    const norm = String(raw).replace(/\s+/g, ' ').trim();
    if (!norm || norm.length > 55) return '';
    // Bỏ qua chuỗi chỉ toàn số hoặc ký hiệu
    if (!/[a-zA-ZÀ-ỹ]/.test(norm)) return '';
    return norm;
  }

  function getDirectTextWithoutControls(node) {
    if (!node) return '';
    const clone = node.cloneNode(true);
    clone
      .querySelectorAll('input, select, textarea, button, script, style, .select2-container')
      .forEach((c) => c.remove());
    return cleanLabelText(clone.textContent || '');
  }

  /**
   * Trích xuất danh sách nhãn chữ (Label / Tiêu đề cột-dòng) đứng cạnh phần tử (dùng cho Element JS không có ID)
   */
  function extractNearbyLabelCandidates(el) {
    const results = [];
    const pushCandidate = (tagHint, exactText) => {
      const cleaned = cleanLabelText(exactText);
      if (!cleaned) return;
      if (!results.some((r) => r.text === cleaned)) {
        results.push({ tagHint, text: cleaned });
      }
      // Thêm biến thể cắt dấu * hoặc : ở cuối nếu có (ví dụ "Nhiệt độ (*):" -> "Nhiệt độ")
      const stripped = cleanLabelText(cleaned.replace(/[\s*:()]+$/g, ''));
      if (stripped && stripped.length >= 2 && stripped !== cleaned) {
        if (!results.some((r) => r.text === stripped)) {
          results.push({ tagHint, text: stripped, isPartial: true });
        }
      }
    };

    // 1. <label for="el.id"> (vẫn lấy được chữ chuẩn kể cả khi el.id là ID tự sinh của Angular/MUI!)
    if (el.id) {
      try {
        const lblFor = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (lblFor) pushCandidate('label', getDirectTextWithoutControls(lblFor));
      } catch (_) {}
    }

    // 2. aria-labelledby
    const ariaLbl = el.getAttribute('aria-labelledby');
    if (ariaLbl) {
      ariaLbl.split(/\s+/).forEach((refId) => {
        const refEl = document.getElementById(refId);
        if (refEl) pushCandidate(refEl.tagName.toLowerCase(), getDirectTextWithoutControls(refEl));
      });
    }

    // 3. Nằm bên trong thẻ <label>
    const parentLabel = el.closest('label');
    if (parentLabel) {
      pushCandidate('label', getDirectTextWithoutControls(parentLabel));
    }

    // 4. Tìm nhãn đứng trước trong cùng cụm dòng (.form-group, tr, .row, .ant-form-item, .el-form-item...)
    let curr = el;
    for (let depth = 0; depth < 4 && curr && curr !== document.body; depth++) {
      let prev = curr.previousElementSibling;
      let steps = 0;
      while (prev && steps < 3) {
        const pTag = prev.tagName.toLowerCase();
        if (['label', 'th', 'td', 'span', 'strong', 'b', 'div'].includes(pTag)) {
          const txt = getDirectTextWithoutControls(prev);
          if (txt) pushCandidate(pTag, txt);
          const innerLbl = prev.querySelector && prev.querySelector('label, th, strong, b');
          if (innerLbl) {
            pushCandidate(innerLbl.tagName.toLowerCase(), getDirectTextWithoutControls(innerLbl));
          }
        }
        prev = prev.previousElementSibling;
        steps++;
      }
      curr = curr.parentElement;
    }

    return results;
  }

  /**
   * Tạo Selector tối ưu, duy nhất (1-1) và bền vững nhất cho cả Element tĩnh lẫn Element tạo động bằng JS
   */
  function buildOptimalSelector(el) {
    if (!el || !(el instanceof Element)) return '';
    const tag = el.tagName.toLowerCase();

    // TẦNG 1: ID tĩnh chuẩn xác và duy nhất (bỏ qua các ID tự sinh nhảy số của JS Framework)
    if (isStableElementId(el.id)) {
      const idSel = `#${CSS.escape(el.id)}`;
      if (isExactUniqueMatch(idSel, el)) return idSel;
    }

    // Thu thập các đặc trưng thuộc tính của phần tử
    const attrPairs = [];
    for (const attr of SEMANTIC_ATTRS) {
      const val = el.getAttribute(attr);
      if (val && val.trim() !== '' && val.length <= 90) {
        attrPairs.push([attr, val]);
      }
    }
    const stableClasses = getStableClasses(el, 2);
    const classSuffix = stableClasses.map((c) => `.${CSS.escape(c)}`).join('');
    const inputType =
      tag === 'input' && el.getAttribute('type')
        ? `[type="${CSS.escape(el.getAttribute('type'))}"]`
        : '';

    // TẦNG 2: Thuộc tính ràng buộc dữ liệu (đơn lẻ hoặc tổ hợp đa thuộc tính trên chính phần tử)
    const elementSignatures = [];
    for (const [attr, val] of attrPairs) {
      const single = `${tag}[${attr}="${CSS.escape(val)}"]`;
      if (isExactUniqueMatch(single, el)) return single;
      elementSignatures.push(single);

      if (classSuffix) {
        const withCls = `${tag}${classSuffix}[${attr}="${CSS.escape(val)}"]`;
        if (isExactUniqueMatch(withCls, el)) return withCls;
        elementSignatures.push(withCls);
      }
    }

    // Tổ hợp 2 thuộc tính (ví dụ trùng name nhưng khác placeholder hoặc value của radio)
    if (tag === 'input' && (el.type === 'radio' || el.type === 'checkbox') && el.name && el.value) {
      const radioSel = `input[name="${CSS.escape(el.name)}"][value="${CSS.escape(el.value)}"]`;
      if (isExactUniqueMatch(radioSel, el)) return radioSel;
      elementSignatures.unshift(radioSel);
    }
    for (let i = 0; i < attrPairs.length; i++) {
      for (let j = i + 1; j < attrPairs.length; j++) {
        const combo = `${tag}[${attrPairs[i][0]}="${CSS.escape(attrPairs[i][1])}"][${
          attrPairs[j][0]
        }="${CSS.escape(attrPairs[j][1])}"]`;
        if (isExactUniqueMatch(combo, el)) return combo;
        elementSignatures.push(combo);
      }
    }

    if (classSuffix) {
      const tagCls = `${tag}${inputType}${classSuffix}`;
      if (isExactUniqueMatch(tagCls, el)) return tagCls;
      elementSignatures.push(tagCls);
    }

    // Tìm danh sách các mỏ neo Khối cha ổn định (từ gần ra xa)
    const ancestorAnchors = [];
    let anc = el.parentElement;
    while (anc && anc !== document.body && anc !== document.documentElement) {
      if (isStableElementId(anc.id)) {
        ancestorAnchors.push({ el: anc, css: `#${CSS.escape(anc.id)}`, xpathId: anc.id });
      } else {
        for (const pAttr of ['data-testid', 'data-section', 'formgroupname', 'name', 'id']) {
          const pVal = anc.getAttribute(pAttr);
          if (pVal && (pAttr !== 'id' || isStableElementId(pVal)) && pVal.length <= 60) {
            ancestorAnchors.push({
              el: anc,
              css: `${anc.tagName.toLowerCase()}[${pAttr}="${CSS.escape(pVal)}"]`,
              xpathId: null
            });
            break;
          }
        }
        const ancClasses = getStableClasses(anc, 2);
        if (ancClasses.length > 0) {
          ancestorAnchors.push({
            el: anc,
            css: `${anc.tagName.toLowerCase()}${ancClasses.map((c) => `.${CSS.escape(c)}`).join('')}`,
            xpathId: null
          });
        }
      }
      anc = anc.parentElement;
    }

    // TẦNG 3 (Cấp 1): Tổ hợp [Vùng chứa cha + Đặc trưng phần tử] để khử trùng lặp giữa các vùng/tab/modal
    for (const anchor of ancestorAnchors) {
      for (const sig of elementSignatures) {
        const scopedCss = `${anchor.css} ${sig}`;
        if (isExactUniqueMatch(scopedCss, el)) {
          return scopedCss;
        }
      }
    }

    // TẦNG 4 (Cấp 2 & Cấp 3): Neo theo "Nhãn chữ hiển thị đứng cạnh" (XPath Text Anchor + Chỉ số cục bộ [1], [2])
    const labelCandidates = extractNearbyLabelCandidates(el);
    const nearestStableIdAnc = ancestorAnchors.find((a) => a.xpathId);

    for (const lbl of labelCandidates) {
      const lit = toXPathLiteral(lbl.text);
      const allowedTags = ['label', 'th', 'td', 'span', 'strong', 'b'].includes(lbl.tagHint)
        ? lbl.tagHint
        : '*';
      const textCond = lbl.isPartial
        ? `starts-with(normalize-space(.), ${lit}) and string-length(normalize-space(.)) <= ${
            lbl.text.length + 8
          }`
        : `normalize-space(.)=${lit}`;

      // Thử trên toàn trang trước (gọn nhất), nếu nhãn bị trùng ở tab khác thì khoanh thêm @id của khối cha
      const scopes = [''];
      if (nearestStableIdAnc) {
        scopes.push(`//*[@id=${toXPathLiteral(nearestStableIdAnc.xpathId)}]`);
      }

      for (const scopePrefix of scopes) {
        for (let localIdx = 1; localIdx <= 4; localIdx++) {
          const xpath = `(${scopePrefix}//${allowedTags}[${textCond}]/following::${tag})[${localIdx}]`;
          if (isExactUniqueMatch(xpath, el)) {
            return xpath;
          }
          if (allowedTags !== '*') {
            const xpathAny = `(${scopePrefix}//*[${textCond} and not(.//*[${textCond}])]/following::${tag})[${localIdx}]`;
            if (isExactUniqueMatch(xpathAny, el)) {
              return xpathAny;
            }
          }
        }
      }
    }

    // TẦNG 5: Đường dẫn phân cấp tối giản neo vào Khối cha tĩnh gần nhất
    const parts = [];
    let current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
      let part = current.tagName.toLowerCase();
      if (isStableElementId(current.id)) {
        part = `#${CSS.escape(current.id)}`;
        parts.unshift(part);
        const candidate = parts.join(' > ');
        if (isExactUniqueMatch(candidate, el)) return candidate;
        break;
      }
      const curClasses = getStableClasses(current, 1);
      if (curClasses.length > 0 && current === el) {
        part += `.${CSS.escape(curClasses[0])}`;
      }
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (c) => c.tagName === current.tagName
        );
        if (siblings.length > 1) {
          const idx = siblings.indexOf(current) + 1;
          part += `:nth-of-type(${idx})`;
        }
      }
      parts.unshift(part);
      const candidateSel = parts.join(' > ');
      if (isExactUniqueMatch(candidateSel, el)) {
        return candidateSel;
      }
      current = parent;
    }

    return parts.join(' > ');
  }

  function inferSuggestedAction(el) {
    if (!el) return 'auto';
    const tag = (el.tagName || '').toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (tag === 'select') return 'select_value';
    if (tag === 'input' && type === 'checkbox') return 'checkbox';
    if (tag === 'input' && type === 'radio') return 'radio';
    if (tag === 'button' || (tag === 'input' && (type === 'button' || type === 'submit'))) {
      return 'click';
    }
    return 'auto';
  }

  function startElementPicker(labelHint) {
    if (pickerActive) stopElementPicker();
    pickerActive = true;

    pickerOverlay = document.createElement('div');
    pickerOverlay.id = '__bato_picker_overlay__';
    Object.assign(pickerOverlay.style, {
      position: 'fixed',
      pointerEvents: 'none',
      border: '2.5px solid #0ea5e9',
      backgroundColor: 'rgba(14, 165, 233, 0.14)',
      borderRadius: '4px',
      zIndex: '2147483646',
      transition: 'all 0.06s ease-out',
      display: 'none',
      boxShadow: '0 0 0 2px rgba(255,255,255,0.7)'
    });

    const badge = document.createElement('div');
    badge.id = '__bato_picker_badge__';
    Object.assign(badge.style, {
      position: 'absolute',
      bottom: '100%',
      left: '-2px',
      marginBottom: '4px',
      backgroundColor: '#0f172a',
      color: '#38bdf8',
      padding: '3px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontFamily: 'Consolas, monospace',
      whiteSpace: 'nowrap',
      boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
    });
    pickerOverlay.appendChild(badge);

    pickerBanner = document.createElement('div');
    pickerBanner.id = '__bato_picker_banner__';
    Object.assign(pickerBanner.style, {
      position: 'fixed',
      top: '14px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#0f172a',
      color: '#ffffff',
      padding: '10px 18px',
      borderRadius: '999px',
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      zIndex: '2147483647',
      boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      border: '1px solid #38bdf8'
    });
    pickerBanner.innerHTML = `
      <span>🎯 <b>BATO_SMART_FILL</b>: Click vào phần tử cho <b>${labelHint || 'Rule'}</b></span>
      <span style="opacity:0.75;font-size:12px;">(Nhấn ESC để hủy)</span>
    `;

    document.body.appendChild(pickerOverlay);
    // Chỉ hiển thị thanh hướng dẫn ở frame gốc hoặc cửa sổ chính (tránh lặp nhiều thanh nếu trang có nhiều iframe)
    if (window === window.top) {
      document.body.appendChild(pickerBanner);
    }

    document.addEventListener('mousemove', onPickerMouseMove, true);
    document.addEventListener('click', onPickerClick, true);
    document.addEventListener('mousedown', blockPickerPointer, true);
    document.addEventListener('mouseup', blockPickerPointer, true);
    document.addEventListener('keydown', onPickerKeyDown, true);
  }

  function stopElementPicker() {
    pickerActive = false;
    pickerHoveredEl = null;
    lastComputedHoverEl = null;
    lastComputedHoverSel = '';
    if (pickerOverlay) {
      pickerOverlay.remove();
      pickerOverlay = null;
    }
    if (pickerBanner) {
      pickerBanner.remove();
      pickerBanner = null;
    }
    document.removeEventListener('mousemove', onPickerMouseMove, true);
    document.removeEventListener('click', onPickerClick, true);
    document.removeEventListener('mousedown', blockPickerPointer, true);
    document.removeEventListener('mouseup', blockPickerPointer, true);
    document.removeEventListener('keydown', onPickerKeyDown, true);
  }

  function blockPickerPointer(e) {
    if (!pickerActive) return;
    e.preventDefault();
    e.stopPropagation();
  }

  // --------------------------------------------------------------------------
  // BỘ TỰ ĐỘNG PHÁT HIỆN NGỮ CẢNH POPUP (WINDOW.OPEN / IFRAME / DOM MODAL)
  // --------------------------------------------------------------------------
  function findEnclosingDomModal(el) {
    if (!el || !(el instanceof Element)) return null;

    // Bước A: Quét theo chuẩn ngữ nghĩa HTML & các thư viện Modal/Dialog phổ biến trên HIS
    let matched = el.closest(MODAL_CONTAINER_SELECTOR);
    if (matched && !isInternalNode(matched)) {
      // Nếu khớp phần ruột (.modal-dialog), ưu tiên lấy vỏ ngoài (.modal / [role="dialog"]) nếu có
      let parentModal = matched.parentElement
        ? matched.parentElement.closest(MODAL_CONTAINER_SELECTOR)
        : null;
      if (parentModal && !isInternalNode(parentModal)) {
        matched = parentModal;
      }
      return matched;
    }

    // Bước B: Quét theo dấu hiệu vật lý CSS (bắt được cả Popup tự code tay bằng div position:fixed/absolute + z-index cao)
    let cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      const tag = (cur.tagName || '').toLowerCase();
      if (!['header', 'nav', 'aside', 'footer'].includes(tag) && !isInternalNode(cur)) {
        const st = window.getComputedStyle(cur);
        const z = parseInt(st.zIndex, 10);
        if ((st.position === 'fixed' || st.position === 'absolute') && !Number.isNaN(z) && z >= 80) {
          const rect = cur.getBoundingClientRect();
          if (
            rect.width >= 180 &&
            rect.height >= 90 &&
            (rect.width < window.innerWidth * 0.98 || rect.height < window.innerHeight * 0.96)
          ) {
            return cur;
          }
        }
      }
      cur = cur.parentElement;
    }

    return null;
  }

  function extractModalTitleText(modalEl) {
    if (!modalEl || !(modalEl instanceof Element)) return '';
    const titleSelectors = [
      '.modal-title',
      '.ant-modal-title',
      '.el-dialog__title',
      '.ui-dialog-title',
      '.p-dialog-title',
      '.k-window-title',
      '.dx-popup-title',
      '[class*="modal-header"] h1',
      '[class*="modal-header"] h2',
      '[class*="modal-header"] h3',
      '[class*="modal-header"] h4',
      '[class*="modal-header"] h5',
      'header h1',
      'header h2',
      'header h3',
      'h2',
      'h3',
      'h4'
    ];
    for (const sel of titleSelectors) {
      const node = modalEl.querySelector(sel);
      if (node) {
        const txt = String(node.textContent || '').replace(/\s+/g, ' ').trim();
        if (txt && txt.length >= 2 && txt.length <= 80) return txt;
      }
    }
    return '';
  }

  function buildModalScopeSelector(modalEl) {
    if (!modalEl || !(modalEl instanceof Element)) return '';
    if (isStableElementId(modalEl.id)) {
      return `#${CSS.escape(modalEl.id)}`;
    }
    for (const attr of ['data-modal', 'data-dialog', 'data-testid', 'name', 'aria-label']) {
      const val = modalEl.getAttribute(attr);
      if (val && val.trim() && val.length <= 80) {
        const cand = `${modalEl.tagName.toLowerCase()}[${attr}="${CSS.escape(val.trim())}"]`;
        if (queryElementsSmart(cand).length === 1) return cand;
      }
    }
    const title = extractModalTitleText(modalEl);
    if (title) {
      const tag = modalEl.tagName.toLowerCase();
      const xp = `(//${tag}[.//*[normalize-space(.)=${toXPathLiteral(title)}]])[1]`;
      const found = queryElementsSmart(xp);
      if (found.length === 1 && (found[0] === modalEl || found[0].contains(modalEl) || modalEl.contains(found[0]))) {
        return xp;
      }
    }
    return buildOptimalSelector(modalEl);
  }

  function detectPopupContextForElement(target) {
    // 1. Cửa sổ trình duyệt con tách rời (window.open)
    if (isPopupBrowserWindow || (window.opener && window.opener !== window)) {
      let parentUrl = '';
      try {
        if (window.opener && window.opener.location && window.opener.location.href) {
          parentUrl = window.opener.location.href;
        }
      } catch (_) {}
      if (!parentUrl) parentUrl = document.referrer || window.location.href;

      let scope = '';
      if (!window.location.href.startsWith('about:') && window.location.pathname && window.location.pathname !== '/') {
        scope = `*${window.location.pathname}*`;
      } else if (window.name) {
        scope = `name:${window.name}`;
      } else if (document.title && document.title.trim()) {
        scope = `title:${document.title.trim()}`;
      }

      return {
        isPopup: true,
        popupType: 'window_popup',
        popupScope: scope,
        popupLabel: `🪟 Cửa sổ rời (${scope || document.title || 'window.open'})`,
        parentUrl
      };
    }

    // 2. Khung Popup nhúng bằng <iframe>
    if (window !== window.top) {
      let parentUrl = '';
      try {
        if (window.top && window.top.location && window.top.location.href) {
          parentUrl = window.top.location.href;
        }
      } catch (_) {}
      if (!parentUrl) parentUrl = document.referrer || '';

      let scope = '';
      try {
        const fe = window.frameElement;
        if (fe && fe.nodeType === 1) {
          if (isStableElementId(fe.id)) {
            scope = `#${CSS.escape(fe.id)}`;
          } else if (fe.getAttribute('name')) {
            scope = `iframe[name="${CSS.escape(fe.getAttribute('name'))}"]`;
          }
        }
      } catch (_) {}

      if (!scope) {
        if (!window.location.href.startsWith('about:') && window.location.pathname && window.location.pathname !== '/') {
          scope = `*${window.location.pathname}*`;
        } else if (document.title && document.title.trim()) {
          scope = `title:${document.title.trim()}`;
        }
      }

      return {
        isPopup: true,
        popupType: 'iframe_popup',
        popupScope: scope,
        popupLabel: `🖼️ Khung Iframe (${scope || 'iframe'})`,
        parentUrl
      };
    }

    // 3. Hộp thoại nổi HTML (Modal / Dialog) trên cùng trang
    const modalEl = findEnclosingDomModal(target);
    if (modalEl) {
      const scope = buildModalScopeSelector(modalEl);
      const title = extractModalTitleText(modalEl);
      return {
        isPopup: true,
        popupType: 'dom_modal',
        popupScope: scope,
        popupLabel: `💬 Modal HTML${title ? ': "' + title + '"' : ''} (${scope})`,
        parentUrl: window.location.href
      };
    }

    return {
      isPopup: false,
      popupType: 'none',
      popupScope: '',
      popupLabel: '',
      parentUrl: window.location.href
    };
  }

  let lastHoverPopupTag = '';

  function onPickerMouseMove(e) {
    if (!pickerActive || !pickerOverlay) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === pickerBanner || (pickerBanner && pickerBanner.contains(el))) return;

    const underlying = resolveUnderlyingControl(el);
    const s2Box = el.closest('.select2-container');
    const visualTarget = s2Box || el;

    pickerHoveredEl = underlying || el;
    const rect = visualTarget.getBoundingClientRect();
    pickerOverlay.style.display = 'block';
    pickerOverlay.style.top = `${rect.top}px`;
    pickerOverlay.style.left = `${rect.left}px`;
    pickerOverlay.style.width = `${rect.width}px`;
    pickerOverlay.style.height = `${rect.height}px`;

    if (pickerHoveredEl !== lastComputedHoverEl) {
      lastComputedHoverEl = pickerHoveredEl;
      lastComputedHoverSel = buildOptimalSelector(pickerHoveredEl);
      const det = detectPopupContextForElement(pickerHoveredEl);
      if (det.isPopup) {
        lastHoverPopupTag =
          det.popupType === 'window_popup'
            ? '[🪟 Popup Rời] '
            : det.popupType === 'iframe_popup'
              ? '[🖼️ Iframe] '
              : '[💬 Modal] ';
      } else {
        lastHoverPopupTag = '';
      }
    }
    const badge = pickerOverlay.firstElementChild;
    if (badge) {
      const s2Tag = underlying !== el ? ' (Select2)' : '';
      const shortSel =
        lastComputedHoverSel.length > 62
          ? lastComputedHoverSel.slice(0, 59) + '...'
          : lastComputedHoverSel;
      badge.textContent = `${lastHoverPopupTag}<${pickerHoveredEl.tagName.toLowerCase()}>${s2Tag} ${shortSel}`;
    }
  }

  function onPickerClick(e) {
    if (!pickerActive) return;
    e.preventDefault();
    e.stopPropagation();

    const target = resolveUnderlyingControl(pickerHoveredEl || e.target);
    const selector = buildOptimalSelector(target);
    const suggestedAction = inferSuggestedAction(target);
    const tagInfo = `<${target.tagName.toLowerCase()}>`;
    const popupDetection = detectPopupContextForElement(target);

    stopElementPicker();

    chrome.runtime.sendMessage({
      type: 'BATO_PICKER_SELECTED',
      selector,
      suggestedAction,
      tagInfo,
      popupDetection
    });

    showToast(
      popupDetection.isPopup
        ? `✅ Đã lấy selector (${popupDetection.popupLabel}): ${selector}`
        : `✅ Đã lấy selector: ${selector}`
    );
  }

  function onPickerKeyDown(e) {
    if (!pickerActive) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      stopElementPicker();
      chrome.runtime.sendMessage({ type: 'BATO_PICKER_CANCELLED' });
      showToast('Đã hủy chọn phần tử');
    }
  }

  /**
   * Đánh dấu trực quan khi bấm nút 🔍 Kiểm tra Selector:
   * - Khớp đúng 1 phần tử: Viền xanh ngọc + nhãn "✅ Khớp duy nhất (1/1)"
   * - Khớp > 1 phần tử (bị trùng): Viền cam cảnh báo + đánh số "⚠️ Trùng #1/N", "#2/N"...
   */
  function highlightInspectionMatches(elements) {
    // Xóa các nhãn kiểm tra cũ (nếu đang hiện)
    document
      .querySelectorAll('[id^="__bato_inspect_tag_"]')
      .forEach((n) => n.remove());

    if (!elements || elements.length === 0) return;

    const isUnique = elements.length === 1;
    const accentColor = isUnique ? '#10b981' : '#f59e0b';
    const durationMs = isUnique ? 1800 : 2800;

    const firstVisible = getVisibleControlElement(elements[0]);
    if (firstVisible && firstVisible.scrollIntoView) {
      firstVisible.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    elements.forEach((rawEl, idx) => {
      const visEl = getVisibleControlElement(rawEl);
      if (!visEl || !visEl.style) return;

      const prevOutline = visEl.style.outline;
      const prevOutlineOffset = visEl.style.outlineOffset;
      visEl.style.outline = `2.5px solid ${accentColor}`;
      visEl.style.outlineOffset = '1px';

      const rect = visEl.getBoundingClientRect();
      let tagBadge = null;
      if (rect.width > 0 || rect.height > 0) {
        tagBadge = document.createElement('div');
        tagBadge.id = `__bato_inspect_tag_${idx}__`;
        tagBadge.textContent = isUnique
          ? '✅ Khớp duy nhất (1/1)'
          : `⚠️ Trùng #${idx + 1}/${elements.length}`;
        Object.assign(tagBadge.style, {
          position: 'fixed',
          top: `${Math.max(4, rect.top - 22)}px`,
          left: `${Math.max(4, rect.left)}px`,
          backgroundColor: isUnique ? '#065f46' : '#b45309',
          color: '#ffffff',
          fontSize: '11px',
          fontWeight: '700',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '2px 7px',
          borderRadius: '4px',
          zIndex: '2147483647',
          pointerEvents: 'none',
          boxShadow: '0 2px 6px rgba(0,0,0,0.25)'
        });
        document.body.appendChild(tagBadge);
      }

      setTimeout(() => {
        visEl.style.outline = prevOutline;
        visEl.style.outlineOffset = prevOutlineOffset;
        if (tagBadge) tagBadge.remove();
      }, durationMs);
    });

    if (isUnique) {
      showToast('✅ Chuẩn xác: Selector khớp duy nhất 1 phần tử!');
    } else {
      showToast(
        `⚠️ Cảnh báo trùng: Selector đang khớp ${elements.length} phần tử (#1 ➔ #${elements.length})!`,
        true
      );
    }
  }

  // Nhận lệnh từ Popup (ví dụ: Bật Picker ở cả trang gốc + mọi iframe/window.open, Tắt Picker đồng bộ, hoặc Kiểm tra Selector)
  function dispatchRuntimePageCommand(message, sendResponse) {
    if (message.type === 'BATO_START_PICKER') {
      startElementPicker(message.labelHint);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'BATO_STOP_PICKER') {
      if (pickerActive) {
        stopElementPicker();
      }
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'BATO_INSPECT_POPUP_SCOPE') {
      const ctx = resolvePopupContextScope(
        message.popupType || 'auto',
        message.popupScope || ''
      );
      if (ctx && ctx.matched) {
        const targetToFlash = ctx.scopeRoot || document.body;
        if (targetToFlash) {
          highlightInspectionMatches([targetToFlash]);
        }
        if (message.inspectId) {
          chrome.runtime
            .sendMessage({
              type: 'BATO_HIGHLIGHT_REPORT',
              inspectId: message.inspectId,
              count: 1,
              label: document.title || window.location.pathname || 'Popup'
            })
            .catch(() => {});
        }
        sendResponse({ ok: true, count: 1 });
        return false;
      }
      sendResponse({ ok: true, count: 0 });
      return false;
    }

    if (message.type === 'BATO_HIGHLIGHT_SELECTOR') {
      let scopeEl = null;
      if (message.isPopup && !message.ignorePopupContext) {
        const ctx = resolvePopupContextScope(
          message.popupType || 'auto',
          message.popupScope || ''
        );
        if (!ctx || !ctx.matched) {
          highlightInspectionMatches([]);
          sendResponse({ ok: true, count: 0 });
          return false;
        }
        scopeEl = ctx.scopeRoot;
      } else if (!message.ignorePopupContext) {
        // Kịch bản trang thường: không đếm nhầm phần tử nằm trong cửa sổ Popup rời hoặc Iframe khác URL
        const inDetachedWin =
          isPopupBrowserWindow || Boolean(window.opener && window.opener !== window);
        if (inDetachedWin && message.urlPattern && !matchUrlPattern(window.location.href, message.urlPattern)) {
          highlightInspectionMatches([]);
          sendResponse({ ok: true, count: 0 });
          return false;
        }
        if (window !== window.top && message.urlPattern && !matchUrlPattern(window.location.href, message.urlPattern)) {
          highlightInspectionMatches([]);
          sendResponse({ ok: true, count: 0 });
          return false;
        }
      }

      const els = queryElementsSmart(message.selector, null, scopeEl);
      highlightInspectionMatches(els);
      if (els.length > 0 && message.inspectId) {
        chrome.runtime
          .sendMessage({
            type: 'BATO_HIGHLIGHT_REPORT',
            inspectId: message.inspectId,
            count: els.length
          })
          .catch(() => {});
      }
      sendResponse({ ok: true, count: els.length });
      return false;
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.type) return false;
    if (
      message.type !== 'BATO_START_PICKER' &&
      message.type !== 'BATO_STOP_PICKER' &&
      message.type !== 'BATO_HIGHLIGHT_SELECTOR' &&
      message.type !== 'BATO_INSPECT_POPUP_SCOPE'
    ) {
      return false;
    }

    if (Array.isArray(message.targetTabIds) && message.targetTabIds.length > 0) {
      if (typeof chrome.tabs?.getCurrent !== 'function') return false;
      chrome.tabs.getCurrent((myTab) => {
        if (!myTab || !message.targetTabIds.includes(myTab.id)) return;
        dispatchRuntimePageCommand(message, sendResponse);
      });
      return false;
    }

    if (message.targetTabId) {
      if (typeof chrome.tabs?.getCurrent !== 'function') return false;
      chrome.tabs.getCurrent((myTab) => {
        if (!myTab || myTab.id !== message.targetTabId) return;
        dispatchRuntimePageCommand(message, sendResponse);
      });
      return false;
    }

    return dispatchRuntimePageCommand(message, sendResponse);
  });

  // ============================================================================
  // 8. TOAST THÔNG BÁO NHỎ GỌN GÓC MÀN HÌNH
  // ============================================================================
  let toastTimeout = null;
  function showToast(msg, isError = false) {
    if (window.innerWidth < 200 || window.innerHeight < 100) return;
    let toast = document.getElementById('__bato_smart_fill_toast__');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = '__bato_smart_fill_toast__';
      Object.assign(toast.style, {
        position: 'fixed',
        bottom: '22px',
        right: '22px',
        padding: '11px 18px',
        borderRadius: '8px',
        color: '#ffffff',
        fontSize: '13px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontWeight: '600',
        zIndex: '2147483647',
        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.22)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        pointerEvents: 'none',
        maxWidth: '420px'
      });
      document.body.appendChild(toast);
    }

    toast.style.backgroundColor = isError ? '#dc2626' : '#059669';
    toast.textContent = msg;
    toast.style.display = 'block';
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      setTimeout(() => {
        toast.style.display = 'none';
      }, 260);
    }, 3200);
  }
})();
