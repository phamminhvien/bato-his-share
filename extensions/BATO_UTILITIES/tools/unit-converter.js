/**
 * BATO_UTILITIES - Chuyển đổi đơn vị Xét nghiệm Y khoa
 * Hỗ trợ chuyển đổi nhanh giữa đơn vị SI (mmol/L, µmol/L) và đơn vị truyền thống (mg/dL)
 * kèm khoảng tham chiếu tham khảo.
 */

(function () {
  const TOOL_ID = 'unit_converter';

  const CONVERSIONS = [
    {
      id: 'glucose',
      name: 'Glucose máu (Đường huyết)',
      unitA: 'mmol/L',
      unitB: 'mg/dL',
      factor: 18.0182, // A * factor = B
      refRangeA: '3.9 – 6.4 mmol/L (Lúc đói)',
      refRangeB: '70 – 115 mg/dL',
      eval(valA) {
        if (valA < 3.9) return { text: 'Hạ đường huyết (< 3.9)', color: 'badge-amber' };
        if (valA <= 5.6) return { text: 'Bình thường lúc đói (3.9 – 5.6)', color: 'badge-emerald' };
        if (valA <= 6.9) return { text: 'Tiền đái tháo đường (5.6 – 6.9)', color: 'badge-amber' };
        return { text: 'Tăng đường huyết / Nghi ngờ ĐTĐ (≥ 7.0)', color: 'badge-red' };
      }
    },
    {
      id: 'creatinine',
      name: 'Creatinine máu',
      unitA: 'µmol/L',
      unitB: 'mg/dL',
      factor: 1 / 88.4, // A * (1/88.4) = B
      refRangeA: 'Nam: 62 – 106 | Nữ: 44 – 88 µmol/L',
      refRangeB: 'Nam: 0.7 – 1.2 | Nữ: 0.5 – 1.0 mg/dL'
    },
    {
      id: 'cholesterol',
      name: 'Cholesterol toàn phần',
      unitA: 'mmol/L',
      unitB: 'mg/dL',
      factor: 38.67,
      refRangeA: '< 5.2 mmol/L (Mục tiêu)',
      refRangeB: '< 200 mg/dL'
    },
    {
      id: 'triglyceride',
      name: 'Triglyceride',
      unitA: 'mmol/L',
      unitB: 'mg/dL',
      factor: 88.57,
      refRangeA: '< 1.7 mmol/L (Bình thường)',
      refRangeB: '< 150 mg/dL'
    },
    {
      id: 'hdl',
      name: 'HDL - Cholesterol (Tốt)',
      unitA: 'mmol/L',
      unitB: 'mg/dL',
      factor: 38.67,
      refRangeA: '≥ 1.0 (Nam) | ≥ 1.3 (Nữ) mmol/L',
      refRangeB: '≥ 40 (Nam) | ≥ 50 (Nữ) mg/dL'
    },
    {
      id: 'ldl',
      name: 'LDL - Cholesterol (Xấu)',
      unitA: 'mmol/L',
      unitB: 'mg/dL',
      factor: 38.67,
      refRangeA: '< 3.4 mmol/L (Nguy cơ vừa)',
      refRangeB: '< 130 mg/dL'
    },
    {
      id: 'uric',
      name: 'Acid Uric máu (Gout)',
      unitA: 'µmol/L',
      unitB: 'mg/dL',
      factor: 1 / 59.48,
      refRangeA: 'Nam: 210 – 420 | Nữ: 150 – 360 µmol/L',
      refRangeB: 'Nam: 3.5 – 7.0 | Nữ: 2.5 – 6.0 mg/dL'
    },
    {
      id: 'bilirubin',
      name: 'Bilirubin toàn phần',
      unitA: 'µmol/L',
      unitB: 'mg/dL',
      factor: 1 / 17.1,
      refRangeA: '5.1 – 17.1 µmol/L',
      refRangeB: '0.3 – 1.0 mg/dL'
    },
    {
      id: 'urea',
      name: 'Urea máu ⇋ BUN (Blood Urea Nitrogen)',
      unitA: 'mmol/L (Urea)',
      unitB: 'mg/dL (BUN)',
      factor: 2.8,
      refRangeA: '2.5 – 7.5 mmol/L (Urea)',
      refRangeB: '7 – 20 mg/dL (BUN)'
    }
  ];

  window.registerBatoUtilityTool({
    id: TOOL_ID,
    name: 'Chuyển Đổi Đơn Vị Xét Nghiệm Y Khoa',
    shortName: 'Đổi Đơn Vị XN',
    icon: '🧪',
    category: 'Lâm sàng & Xét nghiệm',
    description: 'Chuyển đổi 2 chiều đơn vị xét nghiệm: Glucose, Creatinine, Bộ mỡ Lipid máu, Acid Uric, Bilirubin, Urea/BUN.',

    async mount(container, ctx) {
      container.innerHTML = `
        <div class="tool-content-wrap">
          <div class="tool-header-bar">
            <div>
              <h2 class="tool-title">🧪 Chuyển Đổi Đơn Vị Xét Nghiệm Y Khoa</h2>
              <p class="tool-subtitle">Chuyển đổi 2 chiều nhanh chóng giữa đơn vị SI (mmol/L, µmol/L) và đơn vị thông dụng (mg/dL) kèm khoảng tham chiếu tham khảo.</p>
            </div>
          </div>

          <div class="tool-body-grid">
            <!-- CỘT CHỌN LOẠI VÀ NHẬP GIÁ TRỊ -->
            <div class="card form-card">
              <div class="card-head">
                <span class="card-title">🔬 Chọn chỉ số xét nghiệm</span>
              </div>

              <div class="form-grid">
                <div class="form-group col-span-2">
                  <label class="form-label" for="selTestType">Chỉ số xét nghiệm</label>
                  <select id="selTestType" class="inp">
                    ${CONVERSIONS.map((c) => `<option value="${c.id}">${c.name}</option>`).join('')}
                  </select>
                </div>

                <!-- Ô ĐƠN VỊ A -->
                <div class="form-group">
                  <label class="form-label" for="inpValA">
                    <span id="lblUnitA">mmol/L</span>
                  </label>
                  <input type="number" id="inpValA" class="inp" placeholder="Nhập giá trị" step="any" />
                </div>

                <!-- Ô ĐƠN VỊ B -->
                <div class="form-group">
                  <label class="form-label" for="inpValB">
                    <span id="lblUnitB">mg/dL</span>
                  </label>
                  <input type="number" id="inpValB" class="inp" placeholder="Nhập giá trị" step="any" />
                </div>
              </div>

              <div class="form-actions-row" style="margin-top:14px;">
                <button type="button" id="btnCopyConverted" class="btn btn-primary" title="Sao chép kết quả">
                  📋 Sao chép kết quả
                </button>
                <button type="button" id="btnResetConverter" class="btn btn-outline">
                  🔄 Xóa trắng
                </button>
              </div>

              <!-- PHÍM CHỌN NHANH CHỈ SỐ -->
              <div style="margin-top:16px;">
                <div style="font-size:11.5px; font-weight:600; color:#475569; margin-bottom:6px;">Chỉ số phổ biến:</div>
                <div class="quick-preset-chips">
                  <button type="button" class="preset-chip chip-test" data-test="glucose">Glucose</button>
                  <button type="button" class="preset-chip chip-test" data-test="creatinine">Creatinine</button>
                  <button type="button" class="preset-chip chip-test" data-test="cholesterol">Cholesterol</button>
                  <button type="button" class="preset-chip chip-test" data-test="triglyceride">Triglyceride</button>
                  <button type="button" class="preset-chip chip-test" data-test="uric">Acid Uric</button>
                  <button type="button" class="preset-chip chip-test" data-test="bilirubin">Bilirubin</button>
                </div>
              </div>
            </div>

            <!-- CỘT THÔNG TIN THAM CHIẾU & ĐÁNH GIÁ -->
            <div class="card result-card">
              <div class="card-head">
                <span class="card-title">📖 Khoảng tham chiếu & Đánh giá</span>
              </div>

              <div id="testInfoBox" class="result-breakdown" style="margin-top:4px;">
                <!-- Chi tiết công thức và tham chiếu -->
              </div>

              <div id="testEvalBox" style="margin-top:14px;"></div>
            </div>
          </div>
        </div>
      `;

      const selTest = container.querySelector('#selTestType');
      const inpA = container.querySelector('#inpValA');
      const inpB = container.querySelector('#inpValB');
      const lblA = container.querySelector('#lblUnitA');
      const lblB = container.querySelector('#lblUnitB');
      const infoBox = container.querySelector('#testInfoBox');
      const evalBox = container.querySelector('#testEvalBox');

      function getCurrentConfig() {
        return CONVERSIONS.find((c) => c.id === selTest.value) || CONVERSIONS[0];
      }

      function updateUiLabels() {
        const cfg = getCurrentConfig();
        lblA.textContent = `${cfg.unitA}`;
        lblB.textContent = `${cfg.unitB}`;

        infoBox.innerHTML = `
          <div class="breakdown-row">
            <span class="breakdown-lbl">Xét nghiệm:</span>
            <span class="breakdown-val"><b>${ctx.escapeHtml(cfg.name)}</b></span>
          </div>
          <div class="breakdown-row">
            <span class="breakdown-lbl">Tham chiếu (${ctx.escapeHtml(cfg.unitA)}):</span>
            <span class="breakdown-val">${ctx.escapeHtml(cfg.refRangeA)}</span>
          </div>
          <div class="breakdown-row">
            <span class="breakdown-lbl">Tham chiếu (${ctx.escapeHtml(cfg.unitB)}):</span>
            <span class="breakdown-val">${ctx.escapeHtml(cfg.refRangeB)}</span>
          </div>
        `;
      }

      function updateEval() {
        const cfg = getCurrentConfig();
        const valA = parseFloat(inpA.value);
        if (!isNaN(valA) && typeof cfg.eval === 'function') {
          const res = cfg.eval(valA);
          evalBox.innerHTML = `
            <div style="padding:10px; border-radius:8px; background:var(--surface-soft); border:1px solid var(--border-light);">
              <b>Đánh giá sơ bộ:</b> <span class="policy-badge ${res.color}" style="font-size:12px; margin-left:6px;">${res.text}</span>
            </div>
          `;
        } else {
          evalBox.innerHTML = '';
        }
      }

      function onInputA() {
        const cfg = getCurrentConfig();
        const val = parseFloat(inpA.value);
        if (isNaN(val)) {
          inpB.value = '';
          evalBox.innerHTML = '';
          return;
        }
        const b = val * cfg.factor;
        inpB.value = b >= 100 ? b.toFixed(1) : b.toFixed(2);
        updateEval();
      }

      function onInputB() {
        const cfg = getCurrentConfig();
        const val = parseFloat(inpB.value);
        if (isNaN(val)) {
          inpA.value = '';
          evalBox.innerHTML = '';
          return;
        }
        const a = val / cfg.factor;
        inpA.value = a >= 100 ? a.toFixed(1) : a.toFixed(2);
        updateEval();
      }

      inpA.addEventListener('input', onInputA);
      inpB.addEventListener('input', onInputB);

      selTest.addEventListener('change', () => {
        updateUiLabels();
        inpA.value = '';
        inpB.value = '';
        evalBox.innerHTML = '';
        inpA.focus();
      });

      container.querySelectorAll('.chip-test').forEach((btn) => {
        btn.addEventListener('click', () => {
          selTest.value = btn.dataset.test;
          updateUiLabels();
          inpA.value = '';
          inpB.value = '';
          evalBox.innerHTML = '';
          inpA.focus();
        });
      });

      container.querySelector('#btnResetConverter')?.addEventListener('click', () => {
        inpA.value = '';
        inpB.value = '';
        evalBox.innerHTML = '';
      });

      container.querySelector('#btnCopyConverted')?.addEventListener('click', async () => {
        const cfg = getCurrentConfig();
        if (!inpA.value || !inpB.value) {
          ctx.showToast('Vui lòng nhập giá trị để sao chép!', true);
          return;
        }
        const text = `${cfg.name}: ${inpA.value} ${cfg.unitA} (${inpB.value} ${cfg.unitB})`;
        await ctx.copyTextToClipboard(text);
        ctx.showToast(`✅ Đã copy: "${text}"`);
      });

      updateUiLabels();

      return () => {};
    }
  });
})();
