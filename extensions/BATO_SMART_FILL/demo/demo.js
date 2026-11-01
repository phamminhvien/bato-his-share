/**
 * BATO_SMART_FILL — Built-in Interactive Demo Lab Controller
 */

(function () {
  // 1. Gán ID động ngẫu nhiên khi tải trang (mô phỏng Angular Material / Element UI)
  const phoneInput = document.querySelector('input[formcontrolname="soDienThoai"]');
  if (phoneInput) {
    const randomMatId = 'mat-input-' + Math.floor(10000 + Math.random() * 89999);
    phoneInput.id = randomMatId;
    const lblPhone = document.getElementById('lblDynamicPhone');
    const chipPhone = document.getElementById('chipPhoneId');
    if (lblPhone) lblPhone.setAttribute('for', randomMatId);
    if (chipPhone) chipPhone.textContent = 'ID ảo: #' + randomMatId;
  }

  // 2. Mô phỏng Event + API bất đồng bộ (550ms) khi đổi Năm sinh (#txtNamSinh)
  const inpNamSinh = document.getElementById('txtNamSinh');
  const inpTuoi = document.getElementById('txtTuoi');
  const apiStatus = document.getElementById('apiAgeStatus');

  if (inpNamSinh && inpTuoi && apiStatus) {
    inpNamSinh.addEventListener('change', async () => {
      const year = parseInt(inpNamSinh.value, 10);
      if (Number.isNaN(year) || year < 1900) {
        inpTuoi.value = '';
        return;
      }

      const startAt = Date.now();
      apiStatus.className = 'api-status busy';
      apiStatus.textContent = '⏳ Event của Web đang chạy: Đang gọi API /api/his/calc-age (chờ 550ms)...';
      inpTuoi.setAttribute('aria-busy', 'true');

      let calcAge = Math.max(0, new Date().getFullYear() - year);
      try {
        const resp = await fetch(`/api/his/calc-age?year=${encodeURIComponent(year)}&delay=550`);
        if (resp.ok) {
          const data = await resp.json();
          if (typeof data.age === 'number') calcAge = data.age;
        }
      } catch (_) {}

      inpTuoi.value = String(calcAge);
      inpTuoi.removeAttribute('aria-busy');

      apiStatus.className = 'api-status done';
      apiStatus.textContent = `✅ Web đã tính xong Tuổi = ${calcAge} sau ${Date.now() - startAt}ms (BATO_SMART_FILL chạy ngay sau mốc này!)`;
    });
  }

  // 3. Khởi tạo Select2 Tĩnh & Select2 AJAX Động (gọi qua /api/his/*)
  function initSelect2Controls() {
    if (!window.jQuery || !window.jQuery.fn.select2) return;
    const $ = window.jQuery;

    $('.js-select2-static').select2({ width: '100%' });

    $('#cboPhongKhamAjax').select2({
      width: '100%',
      placeholder: '-- Gõ tìm Phòng khám (Select2 AJAX) --',
      allowClear: true,
      ajax: {
        transport: function (params, success, failure) {
          const term = (params.data && params.data.term) || '';
          let aborted = false;
          fetch(`/api/his/phong-kham?term=${encodeURIComponent(term)}`)
            .then((r) => r.json())
            .then((data) => {
              if (!aborted) success(data);
            })
            .catch((err) => {
              if (!aborted && failure) failure(err);
            });
          return {
            abort: () => {
              aborted = true;
            }
          };
        }
      }
    });

    $('#cboIcdAjax').select2({
      width: '100%',
      placeholder: '-- Click mở & gõ tìm mã bệnh ICD-10 (AJAX) --',
      allowClear: true,
      ajax: {
        transport: function (params, success, failure) {
          const term = (params.data && params.data.term) || '';
          let aborted = false;
          fetch(`/api/his/icd10?term=${encodeURIComponent(term)}`)
            .then((r) => r.json())
            .then((data) => {
              if (!aborted) success(data);
            })
            .catch((err) => {
              if (!aborted && failure) failure(err);
            });
          return {
            abort: () => {
              aborted = true;
            }
          };
        }
      }
    });
  }

  // 4. Sinh động 100% Khối Sinh hiệu bằng document.createElement (không ID, không Name)
  let alertSeq = 0;
  function renderDynamicVitals(preserveValues = true) {
    const container = document.getElementById('jsGeneratedVitalsContainer');
    if (!container) return;
    const oldInputs = Array.from(container.querySelectorAll('input.inp-vital'));
    const savedVals = preserveValues ? oldInputs.map((i) => i.value) : [];

    container.innerHTML = '';

    const specs = [
      { label: 'Nhiệt độ (°C)', single: true },
      { label: 'Mạch (lần/phút)', single: true },
      { label: 'Huyết áp (mmHg)', single: false }
    ];

    let valIdx = 0;
    specs.forEach((sp) => {
      const row = document.createElement('div');
      row.className = 'vital-row';

      const lbl = document.createElement('label');
      lbl.textContent = sp.label;
      row.appendChild(lbl);

      if (sp.single) {
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.step = '0.1';
        inp.className = 'inp-vital';
        if (savedVals[valIdx] !== undefined) inp.value = savedVals[valIdx];
        valIdx++;
        row.appendChild(inp);
      } else {
        const pairWrap = document.createElement('div');
        pairWrap.className = 'bp-pair';

        const inpSys = document.createElement('input');
        inpSys.type = 'number';
        inpSys.className = 'inp-vital';
        if (savedVals[valIdx] !== undefined) inpSys.value = savedVals[valIdx];
        valIdx++;

        const slash = document.createElement('span');
        slash.textContent = '/';
        slash.style.fontWeight = '700';

        const inpDia = document.createElement('input');
        inpDia.type = 'number';
        inpDia.className = 'inp-vital';
        if (savedVals[valIdx] !== undefined) inpDia.value = savedVals[valIdx];
        valIdx++;

        pairWrap.appendChild(inpSys);
        pairWrap.appendChild(slash);
        pairWrap.appendChild(inpDia);
        row.appendChild(pairWrap);
      }

      container.appendChild(row);
    });
  }

  document.getElementById('btnMutateDom')?.addEventListener('click', () => {
    const zone = document.getElementById('dynamicAlertsZone');
    if (!zone) return;
    const banner = document.createElement('div');
    banner.className = 'dynamic-alert';
    banner.textContent = `⚡ Dòng cảnh báo động #${++alertSeq} do JS chèn thêm phía trên (nth-of-type từ gốc sẽ lệch, nhưng XPath neo chữ vẫn chuẩn 100%!)`;
    zone.appendChild(banner);
    renderDynamicVitals(true);
  });

  // 5. Bảng kê đơn thuốc động nhiều dòng giống hệt nhau (test row:)
  const SAMPLE_DRUGS = [
    'Paracetamol 500mg',
    'Amoxicillin 500mg',
    'Gentrisone Cream 10g',
    'Ceftriaxone 1g'
  ];
  let drugCounter = 0;

  function addPrescriptionRow(drugName, sang = 1, toi = 1, days = 5) {
    const tbody = document.getElementById('rxTbody');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="inp-ten-thuoc" value="${drugName}" /></td>
      <td>
        <select class="cbo-duong-dung">
          <option value="">-- Chọn --</option>
          <option value="UONG">Uống</option>
          <option value="TIEM">Tiêm</option>
          <option value="BOI">Bôi ngoài da</option>
        </select>
      </td>
      <td><input type="number" class="inp-sang" value="${sang}" min="0" /></td>
      <td><input type="number" class="inp-toi" value="${toi}" min="0" /></td>
      <td><input type="number" class="inp-so-ngay" value="${days}" min="1" /></td>
      <td><input type="number" class="inp-so-luong" placeholder="Tự tính" /></td>
      <td><input type="text" class="inp-cach-dung" placeholder="Đổi Đường dùng -> tự điền đúng dòng này!" /></td>
    `;
    tbody.appendChild(tr);
  }

  document.getElementById('btnAddRxRow')?.addEventListener('click', () => {
    const name = SAMPLE_DRUGS[drugCounter % SAMPLE_DRUGS.length];
    drugCounter++;
    addPrescriptionRow(name, 1, 1, 5);
  });

  document.getElementById('btnResetLab')?.addEventListener('click', () => {
    window.location.reload();
  });

  // 6. Kiểm thử đủ 3 loại Popup (Modal HTML + Iframe Popup + Cửa sổ rời window.open)
  let modalOpenSeq = 8800;
  const domModalBackdrop = document.getElementById('modalChuyenTuyenBackdrop');
  const txtModalMaHS = document.getElementById('txtModalMaHS');
  const modalApiStatus = document.getElementById('modalApiStatus');

  function clearDomModalFields() {
    const modal = document.getElementById('modalChuyenTuyen');
    if (!modal) return;
    modal.querySelectorAll('select').forEach((s) => {
      s.selectedIndex = 0;
    });
    modal.querySelectorAll('input:not([readonly])').forEach((inp) => {
      inp.value = '';
    });
    if (txtModalMaHS) txtModalMaHS.value = '';
  }

  document.getElementById('btnOpenDomModal')?.addEventListener('click', async () => {
    if (!domModalBackdrop) return;
    clearDomModalFields();

    const startAt = Date.now();
    const nextCode = 'HS-2026-' + ++modalOpenSeq;
    if (txtModalMaHS) txtModalMaHS.setAttribute('aria-busy', 'true');
    if (modalApiStatus) {
      modalApiStatus.className = 'api-status busy';
      modalApiStatus.textContent = '⏳ Modal vừa mở: Đang gọi API /api/his/calc-age (400ms) để cấp Mã hồ sơ...';
    }

    // Gọi API ngầm ngay thời điểm bật Modal để kiểm chứng cơ chế waitForSettled + on_open
    const apiPromise = fetch('/api/his/calc-age?year=1980&delay=400').catch(() => null);
    domModalBackdrop.classList.remove('hidden');

    await apiPromise;
    if (txtModalMaHS) {
      txtModalMaHS.value = nextCode;
      txtModalMaHS.removeAttribute('aria-busy');
    }
    if (modalApiStatus) {
      modalApiStatus.className = 'api-status done';
      modalApiStatus.textContent = `✅ Đã cấp Mã hồ sơ ${nextCode} sau ${Date.now() - startAt}ms — Kịch bản [Demo 5] tự điền ngay sau khi API xong!`;
    }
  });

  const closeDomModal = () => {
    domModalBackdrop?.classList.add('hidden');
  };
  document.getElementById('btnCloseDomModal')?.addEventListener('click', closeDomModal);
  document.getElementById('btnCloseDomModalTop')?.addEventListener('click', closeDomModal);
  document.getElementById('btnClearDomModal')?.addEventListener('click', clearDomModalFields);

  // Loại 2: Mở / Đóng Popup nhúng <iframe>
  const iframeBackdrop = document.getElementById('modalIframeBackdrop');
  const frmChiDinhCLS = document.getElementById('frmChiDinhCLS');

  document.getElementById('btnOpenIframePopup')?.addEventListener('click', () => {
    if (frmChiDinhCLS) {
      frmChiDinhCLS.src = './popup-iframe.html';
    }
    iframeBackdrop?.classList.remove('hidden');
  });

  const closeIframeModal = () => {
    iframeBackdrop?.classList.add('hidden');
    if (frmChiDinhCLS) {
      frmChiDinhCLS.src = 'about:blank';
    }
  };
  document.getElementById('btnCloseIframePopup')?.addEventListener('click', closeIframeModal);
  document.getElementById('btnCloseIframePopupTop')?.addEventListener('click', closeIframeModal);

  // Loại 3: Mở Cửa sổ Popup rời bằng window.open
  document.getElementById('btnOpenWindowPopup')?.addEventListener('click', () => {
    window.open(
      './popup-window.html',
      'BatoPopupGiayRaVien',
      'popup=yes,width=660,height=520,left=160,top=120'
    );
  });

  // 7. Nút Nạp / Khôi phục 7 kịch bản mẫu gốc trực tiếp vào chrome.storage.local
  document.getElementById('btnRestoreDemoScenarios')?.addEventListener('click', async () => {
    try {
      const resp = await fetch('./demo-scenarios.json');
      const data = await resp.json();
      const demoList = Array.isArray(data.scenarios) ? data.scenarios : [];
      if (!demoList.length) return;

      const store = await chrome.storage.local.get(['rules']);
      const currentRules = Array.isArray(store.rules) ? store.rules : [];
      const demoIds = new Set(demoList.map((d) => d.id));
      const demoNames = new Set(demoList.map((d) => String(d.name || '').trim().toLowerCase()));

      const keptOthers = currentRules.filter(
        (r) =>
          r &&
          !demoIds.has(r.id) &&
          !demoNames.has(String(r.name || '').trim().toLowerCase())
      );

      await chrome.storage.local.set({
        rules: [...demoList, ...keptOthers]
      });

      alert(`✅ Đã nạp / khôi phục nguyên bản ${demoList.length} Kịch bản Demo mẫu (gồm cả 3 loại Popup) vào BATO_SMART_FILL!`);
    } catch (err) {
      alert('Không thể nạp kịch bản mẫu: ' + (err && err.message ? err.message : String(err)));
    }
  });

  // Khởi tạo dữ liệu trang Demo
  renderDynamicVitals(false);
  addPrescriptionRow('Paracetamol 500mg', 1, 1, 5);
  addPrescriptionRow('Gentrisone Cream 10g', 1, 2, 7);
  drugCounter = 2;
  initSelect2Controls();
})();
