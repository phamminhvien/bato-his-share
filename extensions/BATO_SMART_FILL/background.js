/**
 * BATO_SMART_FILL - Background Service Worker (Manifest V3)
 * Quản lý Side Panel, thực thi Script qua Offscreen Sandbox, đồng bộ Element Picker và Badge.
 */

const OFFSCREEN_DOCUMENT_PATH = 'offscreen/offscreen.html';
let creatingOffscreenPromise = null;

// Cấu hình bấm vào icon tiện ích sẽ mở bảng Side Panel full màn hình bên phải
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

/**
 * Kiểm tra xem URL có khớp với mẫu URL của Kịch bản không
 */
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
      const regex = new RegExp(`^${escaped}$`, 'i');
      if (regex.test(url)) return true;
      return new RegExp(escaped, 'i').test(url);
    } catch (_) {
      return false;
    }
  }

  return url.toLowerCase().includes(raw.toLowerCase());
}

/**
 * Đảm bảo Offscreen Document đang tồn tại để chạy Sandbox
 */
async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);

  if (chrome.runtime.getContexts) {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [offscreenUrl]
    });
    if (existingContexts.length > 0) return;
  }

  if (creatingOffscreenPromise) {
    await creatingOffscreenPromise;
    return;
  }

  creatingOffscreenPromise = chrome.offscreen
    .createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ['IFRAME_SCRIPTING'],
      justification: 'Thực thi Script Rule tùy chỉnh trong môi trường Sandbox cô lập an toàn.'
    })
    .catch((err) => {
      if (!String(err.message || '').includes('Only a single offscreen')) {
        throw err;
      }
    })
    .finally(() => {
      creatingOffscreenPromise = null;
    });

  await creatingOffscreenPromise;
}

/**
 * Cập nhật Badge trên thanh công cụ cho Tab
 */
async function updateBadgeForTab(tabId, url) {
  if (!tabId) return;
  try {
    const data = await chrome.storage.local.get(['enabled', 'rules']);
    const isEnabled = data.enabled !== false;

    if (!isEnabled) {
      await chrome.action.setBadgeText({ tabId, text: 'OFF' });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: '#64748b' });
      return;
    }

    const scenarios = Array.isArray(data.rules) ? data.rules : [];
    const matchedCount = url
      ? scenarios.filter((s) => s && s.enabled !== false && matchUrlPattern(url, s.urlPattern)).length
      : 0;

    if (matchedCount > 0) {
      await chrome.action.setBadgeText({ tabId, text: String(matchedCount) });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: '#059669' });
    } else {
      await chrome.action.setBadgeText({ tabId, text: '' });
    }
  } catch (_) {}
}

async function refreshActiveTabBadge() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) {
      await updateBadgeForTab(tabs[0].id, tabs[0].url);
    }
  } catch (_) {}
}

chrome.runtime.onInstalled.addListener(async () => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }

  const existing = await chrome.storage.local.get(['enabled', 'showToast', 'rules']);
  const updates = {};
  if (typeof existing.enabled !== 'boolean') updates.enabled = true;
  if (typeof existing.showToast !== 'boolean') updates.showToast = true;
  if (!Array.isArray(existing.rules)) updates.rules = [];

  // Dọn dẹp activityLogs cũ nếu có cho nhẹ storage
  await chrome.storage.local.remove('activityLogs').catch(() => {});

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }
  await refreshActiveTabBadge();
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    await updateBadgeForTab(tabId, tab.url);
  } catch (_) {}
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    updateBadgeForTab(tabId, tab.url);
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.enabled || changes.rules)) {
    refreshActiveTabBadge();
  }
});

// Lắng nghe các bản tin từ Content Script & Side Panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  // 1. Yêu cầu thực thi Custom JS Script trong Sandbox
  if (message.type === 'BATO_EVAL_SCRIPT') {
    (async () => {
      try {
        await ensureOffscreenDocument();
        const result = await chrome.runtime.sendMessage({
          target: 'BATO_OFFSCREEN_EVAL',
          scriptCode: message.scriptCode,
          triggerVal: message.triggerVal,
          contextData: message.contextData
        });
        sendResponse(result || { ok: false, error: 'Không nhận được phản hồi từ Sandbox' });
      } catch (err) {
        sendResponse({
          ok: false,
          error: err && err.message ? err.message : String(err)
        });
      }
    })();
    return true;
  }

  // 2. Nhận phần tử được chọn từ công cụ Element Picker trên trang web
  if (message.type === 'BATO_PICKER_SELECTED') {
    (async () => {
      try {
        const store = await chrome.storage.local.get(['pickerSession', 'editorDraft']);
        const session = store.pickerSession;
        const draft = store.editorDraft;

        if (session && draft) {
          if (session.field === 'trigger') {
            draft.triggerSelector = message.selector;
          } else if (session.field === 'modalTarget' && draft.activeRuleModal && draft.activeRuleModal.ruleData) {
            draft.activeRuleModal.ruleData.selector = message.selector;
            if (message.suggestedAction && draft.activeRuleModal.ruleData.actionType === 'auto') {
              draft.activeRuleModal.ruleData.actionType = message.suggestedAction;
            }
          } else if (
            session.field === 'modalMappingSource' &&
            draft.activeRuleModal &&
            draft.activeRuleModal.ruleData &&
            Array.isArray(draft.activeRuleModal.ruleData.mappings) &&
            typeof session.mappingIndex === 'number' &&
            draft.activeRuleModal.ruleData.mappings[session.mappingIndex]
          ) {
            draft.activeRuleModal.ruleData.mappings[session.mappingIndex].sourceSelector =
              message.selector;
          }

          await chrome.storage.local.set({
            editorDraft: draft,
            pickerSession: null
          });

          // Thông báo trực tiếp cho Side Panel cập nhật ngay tức khắc
          chrome.runtime
            .sendMessage({
              type: 'BATO_DRAFT_UPDATED_FROM_PICKER',
              draft,
              selector: message.selector
            })
            .catch(() => {});
        } else {
          await chrome.storage.local.set({ pickerSession: null });
        }

        if (sender && sender.tab) {
          await updateBadgeForTab(sender.tab.id, sender.tab.url);
        }
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true;
  }

  // 3. Hủy chế độ Picker
  if (message.type === 'BATO_PICKER_CANCELLED') {
    chrome.storage.local.set({ pickerSession: null }).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  return false;
});
