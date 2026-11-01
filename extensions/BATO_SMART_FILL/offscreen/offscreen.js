/**
 * BATO_SMART_FILL - Offscreen Document Bridge
 * Chuyển tiếp yêu cầu đánh giá Script JS từ Service Worker vào Sandboxed Iframe.
 */

(function () {
  const frame = document.getElementById('sandboxFrame');
  const pending = new Map();
  let reqCounter = 0;
  let isFrameReady = false;

  const frameReadyPromise = new Promise((resolve) => {
    frame.addEventListener('load', () => {
      isFrameReady = true;
      resolve();
    });
    // Dự phòng nếu iframe đã load sẵn từ cache
    setTimeout(() => {
      if (!isFrameReady) {
        isFrameReady = true;
        resolve();
      }
    }, 150);
  });

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.type !== 'BATO_SANDBOX_RESULT') return;
    const resolver = pending.get(data.requestId);
    if (resolver) {
      pending.delete(data.requestId);
      resolver(data);
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.target !== 'BATO_OFFSCREEN_EVAL') return false;

    (async () => {
      try {
        await frameReadyPromise;
        const requestId = `req_${Date.now()}_${++reqCounter}`;

        const response = await new Promise((resolve) => {
          const timer = setTimeout(() => {
            pending.delete(requestId);
            resolve({
              ok: false,
              error: 'Quá thời gian thực thi Script (Timeout > 3s)'
            });
          }, 3000);

          pending.set(requestId, (res) => {
            clearTimeout(timer);
            resolve(res);
          });

          frame.contentWindow.postMessage(
            {
              type: 'BATO_SANDBOX_EVAL',
              requestId,
              scriptCode: message.scriptCode,
              triggerVal: message.triggerVal,
              contextData: message.contextData
            },
            '*'
          );
        });

        sendResponse(response);
      } catch (err) {
        sendResponse({
          ok: false,
          error: err && err.message ? err.message : String(err)
        });
      }
    })();

    return true; // Giữ kênh bất đồng bộ cho sendResponse
  });
})();
