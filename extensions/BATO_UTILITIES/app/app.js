/**
 * BATO_UTILITIES — Multi-Mode Multi-Tool Application Shell Controller
 * Tác giả: Vien Pham (IT Bệnh viện ĐKKV Ba Tơ)
 * Hỗ trợ 3 chế độ: Popup (?view=popup) • Side Panel (?view=panel) • Tab lớn (?view=tab)
 * Quản lý Trung tâm Tiện ích (Dashboard Hub) và các công cụ Plug-and-Play.
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
    activeToolId: 'dashboard', // 'dashboard' hoặc ID của tool con
    hubSearchKeyword: '',
    hubSelectedCategory: 'all',
    sidebarSearchKeyword: '',
    defaultLaunchMode: 'popup',
    favorites: [],
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

    const breadcrumb = document.getElementById('topbarBreadcrumb');
    const btnNavHome = document.getElementById('btnNavHome');

    if (state.activeToolId === 'dashboard') {
      if (breadcrumb) breadcrumb.textContent = 'Trung tâm tiện ích tổng hợp • Vien Pham';
      if (btnNavHome) btnNavHome.classList.add('active');
    } else {
      const activeTool = window.BATO_UTILITY_REGISTRY.getById(state.activeToolId);
      if (breadcrumb) {
        breadcrumb.innerHTML = `<span><a href="#" id="crumbHomeLink" style="color:#a5b4fc; text-decoration:none;">🏠 Menu</a></span> &rsaquo; <b>${escapeHtml(activeTool?.shortName || activeTool?.name || 'Tiện ích')}</b>`;
        document.getElementById('crumbHomeLink')?.addEventListener('click', (e) => {
          e.preventDefault();
          activateTool('dashboard');
        });
      }
      if (btnNavHome) btnNavHome.classList.remove('active');
    }
  }

  function renderToolNavigation() {
    const allTools = window.BATO_UTILITY_REGISTRY.getAll();
    const compactNav = document.getElementById('compactToolTabs');
    const sidebarList = document.getElementById('sidebarToolsList');

    // 1. THANH CHỌN CÔNG CỤ NGANG (Popup & Side Panel)
    if (compactNav) {
      let navHtml = `
        <button type="button" class="tool-tab-pill ${state.activeToolId === 'dashboard' ? 'active' : ''}" data-tool-id="dashboard">
          <span>🏠</span>
          <span>Menu Tiện Ích</span>
        </button>
      `;

      navHtml += allTools
        .map(
          (t) => `
          <button type="button" class="tool-tab-pill ${t.id === state.activeToolId ? 'active' : ''}" data-tool-id="${escapeHtml(t.id)}">
            <span>${escapeHtml(t.icon || '🛠️')}</span>
            <span>${escapeHtml(t.shortName || t.name)}</span>
          </button>
        `
        )
        .join('');

      compactNav.innerHTML = navHtml;
      compactNav.querySelectorAll('.tool-tab-pill').forEach((btn) => {
        btn.addEventListener('click', () => activateTool(btn.dataset.toolId));
      });
    }

    // 2. CỘT DANH MỤC SIDEBAR (Chế độ Tab lớn)
    if (sidebarList) {
      let html = `
        <button type="button" class="sidebar-tool-item ${state.activeToolId === 'dashboard' ? 'active' : ''}" data-tool-id="dashboard">
          <span class="sidebar-tool-icon">🏠</span>
          <div>
            <div class="sidebar-tool-name">Trung Tâm Tiện Ích</div>
            <div class="sidebar-tool-desc">Xem toàn bộ ${allTools.length} công cụ & phân loại</div>
          </div>
        </button>
      `;

      const kw = state.sidebarSearchKeyword.trim().toLowerCase();
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

      for (const [cat, items] of byCat.entries()) {
        html += `<div class="sidebar-cat-title">${escapeHtml(cat)} (${items.length})</div>`;
        for (const t of items) {
          html += `
            <button type="button" class="sidebar-tool-item ${t.id === state.activeToolId ? 'active' : ''}" data-tool-id="${escapeHtml(t.id)}">
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

  // =========================================================================
  // GIAO DIỆN TRANG CHỦ / TRUNG TÂM TIỆN ÍCH (DASHBOARD HUB)
  // =========================================================================
  function renderDashboard(container) {
    const allTools = window.BATO_UTILITY_REGISTRY.getAll();
    const categories = ['all', ...Array.from(new Set(allTools.map((t) => t.category || 'Khác')))];

    const kw = state.hubSearchKeyword.trim().toLowerCase();
    const filteredTools = allTools.filter((t) => {
      const matchCat = state.hubSelectedCategory === 'all' || t.category === state.hubSelectedCategory;
      const matchKw =
        !kw ||
        t.name.toLowerCase().includes(kw) ||
        (t.shortName || '').toLowerCase().includes(kw) ||
        (t.description || '').toLowerCase().includes(kw) ||
        (t.category || '').toLowerCase().includes(kw);
      return matchCat && matchKw;
    });

    const favTools = allTools.filter((t) => state.favorites.includes(t.id));

    container.innerHTML = `
      <div class="hub-container">
        <!-- BANNER GIỚI THIỆU TRUNG TÂM TIỆN ÍCH -->
        <div class="hub-hero">
          <div class="hub-hero-text">
            <h2 class="hub-hero-title">🌟 Trung Tâm Tiện Ích BATO_UTILITIES</h2>
            <p class="hub-hero-sub">Hệ thống công cụ chuyên sâu hỗ trợ tiếp đón, BHYT, cận lâm sàng, viện phí và nghiệp vụ Y tế bệnh viện.</p>
          </div>
          <div class="hub-search-bar">
            <input
              type="search"
              id="inpHubSearch"
              class="inp hub-search-inp"
              placeholder="🔍 Tìm kiếm tiện ích... (Gõ tên, chức năng, hoặc từ khóa)"
              value="${escapeHtml(state.hubSearchKeyword)}"
              autocomplete="off"
            />
          </div>
        </div>

        <!-- BỘ LỌC CHUYÊN MỤC DẠNG PILLS -->
        <div class="hub-category-pills" id="hubCatPills">
          ${categories
            .map((c) => {
              const count = c === 'all' ? allTools.length : allTools.filter((t) => t.category === c).length;
              const label = c === 'all' ? 'Tất cả tiện ích' : c;
              return `
                <button type="button" class="hub-cat-pill ${state.hubSelectedCategory === c ? 'active' : ''}" data-cat="${escapeHtml(c)}">
                  <span>${escapeHtml(label)}</span>
                  <span class="hub-cat-count">${count}</span>
                </button>
              `;
            })
            .join('')}
        </div>

        <!-- MỤC TIỆN ÍCH ĐÃ GHIM (NẾU CÓ) -->
        ${
          favTools.length > 0 && state.hubSelectedCategory === 'all' && !kw
            ? `
          <div class="hub-section">
            <div class="hub-section-head">
              <span class="hub-section-title">⭐ Tiện ích đã ghim yêu thích</span>
            </div>
            <div class="hub-grid">
              ${favTools.map((t) => renderToolCardHtml(t, true)).join('')}
            </div>
          </div>
        `
            : ''
        }

        <!-- LƯỚI DANH SÁCH CÔNG CỤ -->
        <div class="hub-section">
          <div class="hub-section-head">
            <span class="hub-section-title">
              🧰 Danh sách công cụ (${filteredTools.length})
            </span>
          </div>

          ${
            filteredTools.length === 0
              ? `<div class="empty-hint" style="padding:40px 10px; font-size:13px;">Không tìm thấy tiện ích nào khớp với từ khóa "<b>${escapeHtml(kw)}</b>".</div>`
              : `<div class="hub-grid">${filteredTools.map((t) => renderToolCardHtml(t, state.favorites.includes(t.id))).join('')}</div>`
          }
        </div>
      </div>
    `;

    // Event listeners for Hub
    const inpSearch = container.querySelector('#inpHubSearch');
    inpSearch?.addEventListener('input', (e) => {
      state.hubSearchKeyword = e.target.value;
      renderDashboard(container);
      const nextInp = container.querySelector('#inpHubSearch');
      if (nextInp) {
        nextInp.focus();
        nextInp.setSelectionRange(nextInp.value.length, nextInp.value.length);
      }
    });

    container.querySelectorAll('.hub-cat-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.hubSelectedCategory = btn.dataset.cat;
        renderDashboard(container);
      });
    });

    container.querySelectorAll('.hub-tool-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-fav-star')) return;
        const toolId = card.dataset.toolId;
        if (toolId) activateTool(toolId);
      });
    });

    container.querySelectorAll('.btn-fav-star').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const toolId = btn.dataset.toolId;
        if (state.favorites.includes(toolId)) {
          state.favorites = state.favorites.filter((id) => id !== toolId);
          showToast('Đã bỏ ghim tiện ích.');
        } else {
          state.favorites.push(toolId);
          showToast('⭐ Đã ghim tiện ích lên đầu!');
        }
        await chrome.storage.local.set({ bato_util_favorites: state.favorites });
        renderDashboard(container);
      });
    });
  }

  function renderToolCardHtml(t, isFav) {
    return `
      <div class="hub-tool-card" data-tool-id="${escapeHtml(t.id)}">
        <div class="hub-card-top">
          <div class="hub-card-icon-wrap">
            <span class="hub-card-icon">${escapeHtml(t.icon || '🛠️')}</span>
          </div>
          <button type="button" class="btn-fav-star ${isFav ? 'starred' : ''}" data-tool-id="${escapeHtml(t.id)}" title="${isFav ? 'Bỏ ghim' : 'Ghim yêu thích'}">
            ★
          </button>
        </div>
        <div class="hub-card-content">
          <span class="hub-card-cat">${escapeHtml(t.category || 'Tiện ích')}</span>
          <h3 class="hub-card-title">${escapeHtml(t.name)}</h3>
          <p class="hub-card-desc">${escapeHtml(t.description || '')}</p>
        </div>
        <div class="hub-card-foot">
          <span class="hub-card-open-btn">Mở công cụ &rarr;</span>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // KÍCH HOẠT VÀ HIỂN THỊ CÔNG CỤ
  // =========================================================================
  async function activateTool(toolId) {
    if (typeof state.currentCleanup === 'function') {
      try {
        state.currentCleanup();
      } catch (_) {}
      state.currentCleanup = null;
    }

    state.activeToolId = toolId;
    await chrome.storage.local.set({ activeToolId: toolId });

    renderTopBar();
    renderToolNavigation();

    const mountContainer = document.getElementById('toolMountContainer');
    if (!mountContainer) return;
    mountContainer.innerHTML = '';

    if (toolId === 'dashboard') {
      renderDashboard(mountContainer);
      return;
    }

    const tool = window.BATO_UTILITY_REGISTRY.getById(toolId);
    if (!tool) {
      renderDashboard(mountContainer);
      return;
    }

    try {
      const cleanup = await tool.mount(mountContainer, {
        view: state.view,
        showToast,
        copyTextToClipboard,
        escapeHtml,
        goToDashboard: () => activateTool('dashboard')
      });
      if (typeof cleanup === 'function') {
        state.currentCleanup = cleanup;
      }
    } catch (err) {
      console.error('[BATO_UTILITIES] Lỗi mount tool:', err);
      mountContainer.innerHTML = `
        <div style="padding:20px; color:var(--danger);">
          <h3>⚠️ Đã xảy ra lỗi khi khởi chạy tiện ích "${escapeHtml(tool.name)}"</h3>
          <p>${escapeHtml(err.message)}</p>
          <button type="button" class="btn btn-outline" style="margin-top:10px;" id="btnErrBackHome">🏠 Trở về Trang chủ</button>
        </div>
      `;
      document.getElementById('btnErrBackHome')?.addEventListener('click', () => activateTool('dashboard'));
    }
  }

  function bindShellEvents() {
    // Nút Home trên Header
    document.getElementById('btnGoHome')?.addEventListener('click', () => activateTool('dashboard'));
    document.getElementById('btnNavHome')?.addEventListener('click', () => activateTool('dashboard'));

    // Chuyển sang Side Panel
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

    // Mở ra Tab lớn toàn màn hình
    document.getElementById('btnSwitchTab')?.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({
        type: 'BATO_UTIL_OPEN_FULL_TAB',
        toolId: state.activeToolId
      });
      if (state.view === 'popup') {
        window.close();
      }
    });

    // Chế độ mở mặc định
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

    // Tìm kiếm trong sidebar Tab lớn
    document.getElementById('inpSearchTools')?.addEventListener('input', (e) => {
      state.sidebarSearchKeyword = e.target.value || '';
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
    const store = await chrome.storage.local.get([
      'defaultLaunchMode',
      'activeToolId',
      'bato_util_favorites'
    ]);

    if (['popup', 'panel', 'tab'].includes(store.defaultLaunchMode)) {
      state.defaultLaunchMode = store.defaultLaunchMode;
    }

    if (Array.isArray(store.bato_util_favorites)) {
      state.favorites = store.bato_util_favorites;
    }

    renderTopBar();
    bindShellEvents();

    // Xác định công cụ hiển thị ban đầu
    // Nếu có requestedToolId trong query URL -> ưu tiên hiển thị
    // Nếu không, mở thẳng 'dashboard' để người dùng thấy bộ sưu tập đầy đủ các công cụ!
    const initialTool = requestedToolId || store.activeToolId || 'dashboard';
    await activateTool(initialTool);
  }

  initApp();
})();
