/**
 * BATO_SMART_FILL - Secure JS Rule Sandbox Evaluator (Manifest V3 compliant)
 * Chỉ đóng vai trò môi trường thực thi thuần túy cho đoạn Script Rule được cài đặt trên giao diện,
 * hoàn toàn không chứa logic nghiệp vụ cứng.
 */

(function () {
  /**
   * Tìm dữ liệu phần tử từ domSnapshot linh hoạt
   */
  function lookupDomEntry(domSnapshot, selector) {
    if (!domSnapshot || !selector) return null;
    const key = String(selector).trim();
    if (domSnapshot[key]) return domSnapshot[key];
    if (!key.startsWith('#') && !key.startsWith('.') && !key.startsWith('[')) {
      if (domSnapshot['#' + key]) return domSnapshot['#' + key];
      if (domSnapshot[`[name="${key}"]`]) return domSnapshot[`[name="${key}"]`];
    }
    return null;
  }

  function serializeLogArg(val) {
    if (val === undefined) return 'undefined';
    if (val === null) return null;
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      return val;
    }
    try {
      return JSON.parse(JSON.stringify(val));
    } catch (_) {
      return String(val);
    }
  }

  /**
   * Thực thi mã JS tùy chỉnh do người dùng định nghĩa trong Rule
   */
  function evaluateUserScript(scriptCode, triggerVal, contextData = {}, logsOut = []) {
    const trimmed = String(scriptCode || '').trim();
    if (!trimmed) {
      return { ok: true, result: null, logs: logsOut };
    }

    const domSnapshot = contextData.domSnapshot || {};
    const helpers = {
      currentVal: contextData.currentVal ?? '',
      currentText: contextData.currentText ?? '',
      triggerVal: triggerVal ?? '',
      triggerText: contextData.triggerText ?? '',
      url: contextData.url ?? '',
      getVal: (sel) => {
        const entry = lookupDomEntry(domSnapshot, sel);
        return entry ? (entry.value ?? '') : '';
      },
      getText: (sel) => {
        const entry = lookupDomEntry(domSnapshot, sel);
        return entry ? (entry.text ?? entry.value ?? '') : '';
      },
      isChecked: (sel) => {
        const entry = lookupDomEntry(domSnapshot, sel);
        return entry ? Boolean(entry.checked) : false;
      }
    };

    const customConsole = {
      log: (...args) => logsOut.push({ level: 'log', args: args.map(serializeLogArg) }),
      info: (...args) => logsOut.push({ level: 'info', args: args.map(serializeLogArg) }),
      warn: (...args) => logsOut.push({ level: 'warn', args: args.map(serializeLogArg) }),
      error: (...args) => logsOut.push({ level: 'error', args: args.map(serializeLogArg) }),
      debug: (...args) => logsOut.push({ level: 'debug', args: args.map(serializeLogArg) })
    };

    let userFn = null;

    // Cách 1: Người dùng viết biểu thức hàm (arrow function hoặc function declaration)
    try {
      const compiledExpr = new Function('console', `"use strict"; return (\n${trimmed}\n);`)(
        customConsole
      );
      if (typeof compiledExpr === 'function') {
        userFn = compiledExpr;
      }
    } catch (_) {
      // Chuyển sang Cách 2 nếu viết trực tiếp thân hàm
    }

    // Cách 2: Người dùng viết trực tiếp các câu lệnh bên trong thân hàm
    if (!userFn) {
      userFn = new Function(
        'triggerVal',
        'helpers',
        'console',
        `"use strict";
        const { currentVal, currentText, triggerText, url, getVal, getText, isChecked } = helpers;
        ${trimmed}`
      );
    }

    logsOut.length = 0;
    const output = userFn(triggerVal ?? '', helpers, customConsole);
    return {
      ok: true,
      result: output === undefined ? null : output,
      logs: logsOut
    };
  }

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.type !== 'BATO_SANDBOX_EVAL') return;

    const { requestId, scriptCode, triggerVal, contextData } = data;
    const logsOut = [];
    try {
      const res = evaluateUserScript(scriptCode, triggerVal, contextData, logsOut);
      event.source.postMessage(
        {
          type: 'BATO_SANDBOX_RESULT',
          requestId,
          ok: true,
          result: res.result,
          logs: res.logs
        },
        '*'
      );
    } catch (err) {
      event.source.postMessage(
        {
          type: 'BATO_SANDBOX_RESULT',
          requestId,
          ok: false,
          error: err && err.message ? err.message : String(err),
          logs: logsOut
        },
        '*'
      );
    }
  });
})();
