/**
 * BATO_SMART_FILL - Page Network Activity Monitor (MAIN World)
 * Theo dõi không xâm lấn (non-intrusive) thời điểm bắt đầu và kết thúc của các
 * yêu cầu mạng (window.fetch & XMLHttpRequest) trên trang web gốc để giúp Content Script
 * biết chính xác khi nào các hàm sự kiện bất đồng bộ (AJAX / API) của trang web đã chạy xong.
 */

(function () {
  if (window.__BATO_NET_MONITOR_INSTALLED__) return;
  window.__BATO_NET_MONITOR_INSTALLED__ = true;

  let seq = 0;

  function emitNetEvent(phase, reqId) {
    try {
      window.dispatchEvent(
        new CustomEvent('__bato_net_activity__', {
          detail: {
            phase, // 'start' | 'end'
            reqId,
            ts: Date.now()
          }
        })
      );
    } catch (_) {}
  }

  // 1. Theo dõi window.fetch
  if (typeof window.fetch === 'function') {
    const originalFetch = window.fetch;
    window.fetch = function (...args) {
      const reqId = ++seq;
      emitNetEvent('start', reqId);

      let settled = false;
      const markDone = () => {
        if (settled) return;
        settled = true;
        emitNetEvent('end', reqId);
      };

      try {
        const promise = originalFetch.apply(this, args);
        if (promise && typeof promise.finally === 'function') {
          promise.finally(markDone);
        } else if (promise && typeof promise.then === 'function') {
          promise.then(markDone, markDone);
        } else {
          markDone();
        }
        return promise;
      } catch (err) {
        markDone();
        throw err;
      }
    };
  }

  // 2. Theo dõi XMLHttpRequest (bao gồm Axios, jQuery.ajax, Angular HttpClient, ASP.NET...)
  if (typeof window.XMLHttpRequest === 'function' && window.XMLHttpRequest.prototype) {
    const originalSend = window.XMLHttpRequest.prototype.send;
    window.XMLHttpRequest.prototype.send = function (...args) {
      const reqId = ++seq;
      emitNetEvent('start', reqId);

      let settled = false;
      const markDone = () => {
        if (settled) return;
        settled = true;
        emitNetEvent('end', reqId);
      };

      this.addEventListener('loadend', markDone, { once: true });
      this.addEventListener('error', markDone, { once: true });
      this.addEventListener('abort', markDone, { once: true });
      this.addEventListener('timeout', markDone, { once: true });

      try {
        return originalSend.apply(this, args);
      } catch (err) {
        markDone();
        throw err;
      }
    };
  }

  // 3. Cầu nối đồng bộ UI nâng cao (Select2 v3/v4, Chosen, jQuery Plugins...) ở MAIN World
  let isBatoSyncing = false;
  let jqHookInstalled = false;

  function tryInstallJQueryChangeBridge() {
    if (jqHookInstalled) return;
    const jq = window.jQuery || window.$;
    if (typeof jq !== 'function' || !jq.fn || typeof jq(document).on !== 'function') return;
    jqHookInstalled = true;

    // Bắt các sự kiện $(el).trigger('change') do Select2 / Datepicker bắn qua hệ thống riêng của jQuery
    jq(document).on('change', 'select, input, textarea', function (e) {
      if (isBatoSyncing || (e && e.originalEvent)) return;
      const target = this;
      if (!(target instanceof Element)) return;
      const token = 'jq_' + ++seq;
      target.setAttribute('data-bato-jq-chg', token);
      try {
        window.dispatchEvent(
          new CustomEvent('__bato_jq_change__', {
            detail: { token }
          })
        );
      } finally {
        target.removeAttribute('data-bato-jq-chg');
      }
    });
  }

  tryInstallJQueryChangeBridge();
  document.addEventListener('DOMContentLoaded', tryInstallJQueryChangeBridge, { once: true });
  window.addEventListener('load', tryInstallJQueryChangeBridge, { once: true });

  window.addEventListener('__bato_main_bridge__', (e) => {
    tryInstallJQueryChangeBridge();
    let payload = null;
    try {
      payload = typeof e.detail === 'string' ? JSON.parse(e.detail) : e.detail;
    } catch (_) {
      return;
    }
    if (!payload || !payload.bridgeId) return;

    const el = document.querySelector(`[data-bato-bridge-id="${payload.bridgeId}"]`);
    if (!el) return;

    const jq = window.jQuery || window.$;
    isBatoSyncing = true;
    try {
      if (payload.action === 'sync_control') {
        if (typeof jq === 'function') {
          const $el = jq(el);
          if ($el && typeof $el.trigger === 'function') {
            $el.trigger('change');
          }
        }
      } else if (payload.action === 'select2_set') {
        const val = payload.value !== undefined && payload.value !== null ? String(payload.value) : '';
        const text = payload.text !== undefined && payload.text !== null ? String(payload.text) : val;
        const createIfMissing = payload.createIfMissing !== false;

        if ((el.tagName || '').toLowerCase() === 'select') {
          const opts = Array.from(el.options || []);
          const valLower = val.trim().toLowerCase();
          const txtLower = text.trim().toLowerCase();

          let matched =
            (val !== '' && opts.find((o) => o.value === val || o.value.trim().toLowerCase() === valLower)) ||
            (text !== '' &&
              (opts.find((o) => o.textContent.trim() === text.trim()) ||
                opts.find((o) => o.textContent.trim().toLowerCase() === txtLower) ||
                (txtLower.length >= 2
                  ? opts.find((o) => o.textContent.trim().toLowerCase().includes(txtLower))
                  : null)));

          if (!matched && createIfMissing && (val !== '' || text !== '')) {
            const optVal = val !== '' ? val : text;
            const optText = text !== '' ? text : val;
            matched = new Option(optText, optVal, true, true);
            el.appendChild(matched);
          }

          if (matched) {
            el.value = matched.value;
            matched.selected = true;
          }
        } else {
          el.value = val !== '' ? val : text;
        }

        if (typeof jq === 'function') {
          const $el = jq(el);
          if ($el && typeof $el.trigger === 'function') {
            $el.trigger('change');
            $el.trigger({
              type: 'select2:select',
              params: { data: { id: el.value, text: text || el.value } }
            });
          }
        } else {
          el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        }
      }
    } catch (_) {
    } finally {
      setTimeout(() => {
        isBatoSyncing = false;
      }, 20);
    }
  });
})();
