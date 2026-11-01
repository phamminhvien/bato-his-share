/**
 * BATO_SMART_FILL — Built-in Mock HIS API Adapter (100% Offline, Zero Server)
 * Được nạp TRƯỚC page-network-monitor.js trên trang demo.html để giả lập chính xác
 * các API bất đồng bộ có độ trễ mạng thực tế (550ms / 280ms / 300ms) của hệ thống HIS
 * ngay bên trong trình duyệt mà không cần cài đặt hay chạy Node.js / Server bên ngoài.
 */

(function () {
  const PHONG_KHAM_DB = [
    { id: 'PK01', text: 'Phòng khám Đa khoa Nội 01' },
    { id: 'PK02', text: 'Phòng khám Nhi tổng hợp' },
    { id: 'PK03', text: 'Phòng khám Lão khoa - Tim mạch' },
    { id: 'PK99', text: 'Phòng Cấp cứu lưu' }
  ];

  const ICD_DB = [
    { id: 'A97', text: 'A97 - Sốt xuất huyết Dengue' },
    { id: 'I10', text: 'I10 - Tăng huyết áp vô căn (nguyên phát)' },
    { id: 'J02', text: 'J02 - Viêm họng cấp' },
    { id: 'K29', text: 'K29 - Viêm dạ dày và tá tràng' }
  ];

  const nativeFetch = window.fetch.bind(window);

  function jsonResponse(payload, delayMs) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(
          new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
          })
        );
      }, delayMs);
    });
  }

  window.fetch = function (input, init) {
    const rawUrl = typeof input === 'string' ? input : (input && input.url) || '';

    if (rawUrl.includes('/api/his/')) {
      const parsed = new URL(rawUrl, 'https://bato-his-mock.local');

      if (parsed.pathname === '/api/his/calc-age') {
        const year = parseInt(parsed.searchParams.get('year') || '0', 10);
        const delay = parseInt(parsed.searchParams.get('delay') || '550', 10);
        const currentYear = new Date().getFullYear();
        const age = year >= 1900 ? Math.max(0, currentYear - year) : null;
        return jsonResponse({ ok: true, year, age, delayMs: delay }, delay);
      }

      if (parsed.pathname === '/api/his/phong-kham') {
        const term = (parsed.searchParams.get('term') || '').toLowerCase();
        const results = PHONG_KHAM_DB.filter((item) => item.text.toLowerCase().includes(term));
        return jsonResponse({ results }, 280);
      }

      if (parsed.pathname === '/api/his/icd10') {
        const term = (parsed.searchParams.get('term') || '').toLowerCase();
        const results = ICD_DB.filter((item) => item.text.toLowerCase().includes(term));
        return jsonResponse({ results }, 300);
      }
    }

    return nativeFetch(input, init);
  };
})();
