/**
 * BATO_SMART_FILL — Logic điều khiển cho trang con Popup Iframe & Popup Window (100% Offline CSP-safe)
 */
(function () {
  document.getElementById('btnCloseWindowPopup')?.addEventListener('click', () => {
    window.close();
  });

  document.getElementById('btnResetChildForm')?.addEventListener('click', () => {
    document.querySelectorAll('input[type="text"], input[type="number"]').forEach((el) => {
      el.value = '';
    });
    document.querySelectorAll('select').forEach((el) => {
      el.selectedIndex = 0;
    });
    document.querySelectorAll('input[type="checkbox"]').forEach((el) => {
      el.checked = false;
    });
  });
})();
