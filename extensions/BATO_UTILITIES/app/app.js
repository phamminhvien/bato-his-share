/**
 * BATO_UTILITIES — Multi-Mode Application Shell Controller
 * Hỗ trợ mượt mà 3 chế độ hiển thị trên cùng một bộ mã nguồn:
 *   - ?view=popup : Popup thả xuống nhanh từ thanh công cụ
 *   - ?view=panel : Thanh Side Panel neo dọc bên phải màn hình
 *   - ?view=tab   : Không gian làm việc lớn mở trên Tab trình duyệt
 */

(function () {
  const params = new URLSearchParams(window.location.search);
  const rawView = params.get('view') || 'popup';
  const currentView = ['popup', 'panel', 'tab'].includes(rawView) ? rawView : 'popup';
  const requestedToolId = params.get('tool') || '';

  document.body.setAttribute('data-view', currentView);

  const VIEW_LABELS = {
    popup: '🪟 Chế độ Popup',
    panel: '📌 Side Panel',
    tab: '🖥️ Tab toàn màn hình'
  };

  let cachedWindowId = null;
  if (chrome.windows && chrome.windows.getCurrent) {
    chrome.windows.getCurrent((win) => {
      if (win && typeof win.id === 'number') {
        cachedWindowId = win.id;
      }
    });
  }

  const state = {
    view: currentView,
    activeToolId: '',
    searchKeyword: '',
    defaultLaunchMode: 'popup',
    currentCleanup: null
  };

  let toastTimer = null;
  function showToast(msg, isError = false) {
    const el = document.getElementById('appToast');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('error', Boolean(isError));
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.add('hidden');
    }, 2200);
  }

  async function copyTextToClipboard(text) {
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    }
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderTopBar() {
    const badge = document.getElementById('currentViewBadge');
    if (badge) {
      badge.textContent = VIEW_LABELS[state.view] || 'Popup';
    }
    const selDefault = document.getElementById('selDefaultLaunchMode');
    if (selDefault) {
      selDefault.value = state.defaultLaunchMode;
    }
  }

  function renderToolNavigation() {
    const allTools = window.BATO_UTILITY_REGISTRY.getAll();
    const compactNav = document.getElementById('compactToolTabs');
    const sidebarList = document.getElementById('sidebarToolsList');

    // 1. Thanh ngang cho Popup & Side Panel
    if (compactNav) {
      if (allTools.length <= 1) {
        compactNav.classList.add('hidden');
      } else {
        compactNav.classList.remove('hidden');
        compactNav.innerHTML = allTools
          .map(
            (t) => `
            <button type="button" class="tool-tab-pill ${
              t.id === state.activeToolId ? 'active' : ''
            }" data-tool-id="${escapeHtml(t.id)}">
              <span>${escapeHtml(t.icon || '🛠️')}</span>
              <span>${escapeHtml(t.shortName || t.name)}</span>
            </button>
          `
          )
          .join('');

        compactNav.querySelectorAll('.tool-tab-pill').forEach((btn) => {
          btn.addEventListener('click', () => activateTool(btn.dataset.toolId));
        });
      }
    }

    // 2. Cột danh mục bên trái cho chế độ Tab lớn
    if (sidebarList) {
      const kw = state.searchKeyword.trim().toLowerCase();
      const filtered = kw
        ? allTools.filter(
            (t) =>
              t.name.toLowerCase().includes(kw) ||
              (t.description || '').toLowerCase().includes(kw) ||
              (t.category || '').toLowerCase().includes(kw)
          )
        : allTools;

      const byCat = new Map();
      for (const tool of filtered) {
        const cat = tool.category || 'Tiện ích chung';
        if (!byCat.has(cat)) byCat.set(cat, []);
        byCat.get(cat).push(tool);
      }

      if (filtered.length === 0) {
        sidebarList.innerHTML = `<div style="padding:8px; font-size:12px; color:#64748b;">Không tìm thấy tiện ích phù hợp.</div>`;
        return;
      }

      let html = '';
      for (const [cat, items] of byCat.entries()) {
        html += `<div class="sidebar-cat-title">${escapeHtml(cat)}</div>`;
        for (const t of items) {
          html += `
            <button type="button" class="sidebar-tool-item ${
              t.id === state.activeToolId ? 'active' : ''
            }" data-tool-id="${escapeHtml(t.id)}">
              <span class="sidebar-tool-icon">${escapeHtml(t.icon || '🛠️')}</span>
              <div>
                <div class="sidebar-tool-name">${escapeHtml(t.name)}</div>
                <div class="sidebar-tool-desc">${escapeHtml(t.description || '')}</div>
              </div>
            </button>
          `;
        }
      }
      sidebarList.innerHTML = html;
      sidebarList.querySelectorAll('.sidebar-tool-item').forEach((btn) => {
        btn.addEventListener('click', () => activateTool(btn.dataset.toolId));
      });
    }
  }

  async function activateTool(toolId) {
    const tool =
      window.BATO_UTILITY_REGISTRY.getById(toolId) ||
      window.BATO_UTILITY_REGISTRY.getAll()[0];
    if (!tool) return;

    if (typeof state.currentCleanup === 'function') {
      try {
        state.currentCleanup();
      } catch (_) {}
      state.currentCleanup = null;
    }

    state.activeToolId = tool.id;
    await chrome.storage.local.set({ activeToolId: tool.id });
    renderToolNavigation();

    const mountContainer = document.getElementById('toolMountContainer');
    if (!mountContainer) return;
    mountContainer.innerHTML = '';

    const cleanup = await tool.mount(mountContainer, {
      view: state.view,
      showToast,
      copyTextToClipboard,
      escapeHtml
    });
    if (typeof cleanup === 'function') {
      state.currentCleanup = cleanup;
    }
  }

  function bindShellEvents() {
    // Nút chuyển ngay sang Side Panel (gọi đồng bộ giữ User Gesture cho Chrome MV3)
    document.getElementById('btnSwitchPanel')?.addEventListener('click', () => {
      if (!chrome.sidePanel || !chrome.sidePanel.open) {
        showToast('Trình duyệt hiện tại không hỗ trợ Side Panel.', true);
        return;
      }
      if (typeof cachedWindowId === 'number') {
        chrome.sidePanel
          .open({ windowId: cachedWindowId })
          .then(() => {
            if (state.view === 'popup') window.close();
          })
          .catch(() => {
            showToast('Không thể mở Side Panel trên cửa sổ này.', true);
          });
      } else {
        chrome.windows.getCurrent((win) => {
          if (win && typeof win.id === 'number') {
            chrome.sidePanel.open({ windowId: win.id }).then(() => {
              if (state.view === 'popup') window.close();
            });
          }
        });
      }
    });

    // Nút mở rộng ra Tab lớn toàn màn hình
    document.getElementById('btnSwitchTab')?.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({
        type: 'BATO_UTIL_OPEN_FULL_TAB',
        toolId: state.activeToolId
      });
      if (state.view === 'popup') {
        window.close();
      }
    });

    // Chọn chế độ mở mặc định khi bấm biểu tượng Extension
    document.getElementById('selDefaultLaunchMode')?.addEventListener('change', async (e) => {
      const nextMode = e.target.value;
      state.defaultLaunchMode = nextMode;
      await chrome.storage.local.set({ defaultLaunchMode: nextMode });
      const modeName =
        nextMode === 'panel'
          ? 'Side Panel bên phải'
          : nextMode === 'tab'
            ? 'Tab mới toàn màn hình'
            : 'Popup nhỏ gọn';
      showToast(`✅ Đã đặt mặc định khi bấm icon: ${modeName}`);
    });

    // Ô tìm kiếm công cụ trong chế độ Tab lớn
    document.getElementById('inpSearchTools')?.addEventListener('input', (e) => {
      state.searchKeyword = e.target.value || '';
      renderToolNavigation();
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.defaultLaunchMode) {
        state.defaultLaunchMode = changes.defaultLaunchMode.newValue || 'popup';
        renderTopBar();
      }
    });
  }

  async function initApp() {
    const store = await chrome.storage.local.get(['defaultLaunchMode', 'activeToolId']);
    if (['popup', 'panel', 'tab'].includes(store.defaultLaunchMode)) {
      state.defaultLaunchMode = store.defaultLaunchMode;
    }

    renderTopBar();
    bindShellEvents();

    const initialTool =
      requestedToolId ||
      store.activeToolId ||
      (window.BATO_UTILITY_REGISTRY.getAll()[0]?.id ?? '');
    await activateTool(initialTool);
  }

  initApp();
})();
