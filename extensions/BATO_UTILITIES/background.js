/**
 * BATO_UTILITIES - Background Service Worker (Manifest V3)
 * Tác giả: Vien Pham (https://www.facebook.com/phamminhvien)
 *
 * Điều phối chế độ mở mặc định khi click biểu tượng tiện ích trên thanh công cụ:
 *   - 'popup' : Mở hộp thoại Popup nhỏ gọn (mặc định)
 *   - 'panel' : Mở thanh Side Panel dọc bên phải màn hình
 *   - 'tab'   : Mở hẳn sang một Tab làm việc lớn trên trình duyệt
 */

const VALID_LAUNCH_MODES = ['popup', 'panel', 'tab'];

async function applyLaunchMode(rawMode) {
  const mode = VALID_LAUNCH_MODES.includes(rawMode) ? rawMode : 'popup';

  try {
    if (mode === 'popup') {
      if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
      }
      await chrome.action.setPopup({ popup: 'app/index.html?view=popup' });
    } else if (mode === 'panel') {
      await chrome.action.setPopup({ popup: '' });
      if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
      }
    } else if (mode === 'tab') {
      if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
      }
      await chrome.action.setPopup({ popup: '' });
    }
  } catch (_) {}
}

async function syncLaunchModeFromStorage() {
  try {
    const store = await chrome.storage.local.get(['defaultLaunchMode']);
    const mode = VALID_LAUNCH_MODES.includes(store.defaultLaunchMode)
      ? store.defaultLaunchMode
      : 'popup';
    if (!store.defaultLaunchMode) {
      await chrome.storage.local.set({ defaultLaunchMode: mode });
    }
    await applyLaunchMode(mode);
  } catch (_) {}
}

async function openOrFocusFullTab(toolId = '') {
  const baseTabUrl = chrome.runtime.getURL('app/index.html?view=tab');
  const fullUrl = toolId ? `${baseTabUrl}&tool=${encodeURIComponent(toolId)}` : baseTabUrl;

  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const existing = tabs.find((t) => t.url && t.url.startsWith(baseTabUrl));
    if (existing && existing.id) {
      await chrome.tabs.update(existing.id, {
        active: true,
        ...(toolId && existing.url !== fullUrl ? { url: fullUrl } : {})
      });
      return existing;
    }
  } catch (_) {}

  return await chrome.tabs.create({ url: fullUrl, active: true });
}

chrome.runtime.onInstalled.addListener(() => {
  syncLaunchModeFromStorage();
});

chrome.runtime.onStartup.addListener(() => {
  syncLaunchModeFromStorage();
});

syncLaunchModeFromStorage();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.defaultLaunchMode) {
    applyLaunchMode(changes.defaultLaunchMode.newValue);
  }
});

// Khi defaultLaunchMode === 'tab' (hoặc trình duyệt không hỗ trợ Side Panel), click icon sẽ chạy vào đây
chrome.action.onClicked.addListener(async () => {
  const store = await chrome.storage.local.get(['defaultLaunchMode', 'activeToolId']);
  const mode = store.defaultLaunchMode || 'popup';
  if (mode === 'tab') {
    await openOrFocusFullTab(store.activeToolId || '');
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) return false;

  if (message.type === 'BATO_UTIL_OPEN_FULL_TAB') {
    (async () => {
      try {
        await openOrFocusFullTab(message.toolId || '');
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
      }
    })();
    return true;
  }

  return false;
});
