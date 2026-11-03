/**
 * BATO_UTILITIES - Thước tính Y khoa lâm sàng
 * Hỗ trợ bác sĩ / dược sĩ lâm sàng tính toán nhanh:
 * 1. BMI & Diện tích bề mặt cơ thể (BSA)
 * 2. Độ thanh thải Creatinine (CrCl Cockcroft-Gault & Phân độ suy thận KDIGO)
 * 3. Tốc độ truyền dịch (giọt/phút & ml/h)
 */

(function () {
  const TOOL_ID = 'clinical_calculators';

  window.registerBatoUtilityTool({
    id: TOOL_ID,
    name: 'Thước Tính Y Khoa (BMI, CrCl, Dịch Truyền)',
    shortName: 'Thước tính Y khoa',
    icon: '🩺',
    category: 'Lâm sàng & Xét nghiệm',
    description: 'Tính BMI, BSA (diện tích da), độ thanh thải Creatinine CrCl (Cockcroft-Gault chỉnh liều thuốc), tốc độ truyền dịch giọt/phút.',

    async mount(container, ctx) {
      container.innerHTML = `
        <div class="tool-content-wrap">
          <div class="tool-header-bar">
            <div>
              <h2 class="tool-title">🩺 Thước Tính Y Khoa Lâm Sàng Nhanh</h2>
              <p class="tool-subtitle">Công cụ hỗ trợ Bác sĩ và Dược sĩ lâm sàng tính toán liều lượng thuốc, thể trạng và tốc độ y lệnh truyền dịch.</p>
            </div>
          </div>

          <!-- TABS CON BÊN TRONG CÔNG CỤ -->
          <div class="subtool-tabs">
            <button type="button" class="subtool-tab-btn active" data-tab="tabBmi">⚖️ BMI & Diện tích da (BSA)</button>
            <button type="button" class="subtool-tab-btn" data-tab="tabCrCl">🧪 Độ thanh thải Creatinine (CrCl)</button>
            <button type="button" class="subtool-tab-btn" data-tab="tabIv">💧 Tốc độ truyền dịch (IV Rate)</button>
          </div>

          <!-- ================= TAB 1: BMI & BSA ================= -->
          <div id="tabBmi" class="subtool-tab-pane active">
            <div class="tool-body-grid">
              <div class="card form-card">
                <div class="card-head">
                  <span class="card-title">📐 Chỉ số thể trạng</span>
                </div>
                <div class="form-grid">
                  <div class="form-group">
                    <label class="form-label" for="bmiHeight">Chiều cao (cm) <b class="req">*</b></label>
                    <input type="number" id="bmiHeight" class="inp" placeholder="VD: 165" min="30" max="250" />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="bmiWeight">Cân nặng (kg) <b class="req">*</b></label>
                    <input type="number" id="bmiWeight" class="inp" placeholder="VD: 60" min="2" max="300" step="0.5" />
                  </div>
                </div>

                <div class="card-note" style="margin-top:16px;">
                  <b>Phân loại BMI chuẩn Châu Á (WPRO / Bộ Y tế):</b>
                  <div style="font-size:11.5px; margin-top:6px; line-height:1.6; color:#475569;">
                    • <b>&lt; 18.5</b>: Thiếu cân (Gầy)<br/>
                    • <b>18.5 – 22.9</b>: Thể trạng bình thường<br/>
                    • <b>23.0 – 24.9</b>: Thừa cân (Tiền béo phì)<br/>
                    • <b>25.0 – 29.9</b>: Béo phì độ I<br/>
                    • <b>≥ 30.0</b>: Béo phì độ II
                  </div>
                </div>
              </div>

              <div class="card result-card">
                <div class="card-head">
                  <span class="card-title">📊 Kết quả BMI & BSA</span>
                </div>
                <div class="age-stats-grid">
                  <div class="stat-card">
                    <div class="stat-val" id="valBmi">--</div>
                    <div class="stat-lbl">Chỉ số BMI (kg/m²)</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-val" id="valBsa">--</div>
                    <div class="stat-lbl">Diện tích da BSA (m²)</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-val" id="valIbw">--</div>
                    <div class="stat-lbl">Cân nặng lý tưởng (kg)</div>
                  </div>
                </div>

                <div id="bmiClassificationBox" style="margin-top:12px;"></div>
                <div id="bsaDetailBox" style="margin-top:10px; font-size:12px; color:#475569;"></div>
              </div>
            </div>
          </div>

          <!-- ================= TAB 2: CrCl COCKCROFT-GAULT ================= -->
          <div id="tabCrCl" class="subtool-tab-pane">
            <div class="tool-body-grid">
              <div class="card form-card">
                <div class="card-head">
                  <span class="card-title">🧪 Thông số bệnh nhân & Xét nghiệm</span>
                </div>
                <div class="form-grid">
                  <div class="form-group">
                    <label class="form-label" for="crclAge">Tuổi (Năm) <b class="req">*</b></label>
                    <input type="number" id="crclAge" class="inp" placeholder="VD: 55" min="18" max="120" />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="crclGender">Giới tính <b class="req">*</b></label>
                    <select id="crclGender" class="inp">
                      <option value="male">Nam</option>
                      <option value="female">Nữ (× 0.85)</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="crclWeight">Cân nặng (kg) <b class="req">*</b></label>
                    <input type="number" id="crclWeight" class="inp" placeholder="VD: 58" min="20" max="250" />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="crclCreatinine">
                      <span>Creatinine huyết thanh <b class="req">*</b></span>
                    </label>
                    <div class="input-with-button">
                      <input type="number" id="crclCreatinine" class="inp" placeholder="VD: 110" step="0.01" />
                      <select id="crclUnit" class="inp" style="max-width:90px;">
                        <option value="umol">µmol/L</option>
                        <option value="mgdl">mg/dL</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div class="card-note" style="margin-top:14px;">
                  <b>Công thức Cockcroft-Gault:</b><br/>
                  <code style="font-size:11.5px; color:#312e81;">CrCl = [(140 - Tuổi) × Cân nặng (kg)] / [72 × Creatinine (mg/dL)]</code> (Nữ × 0.85)<br/>
                  <span style="font-size:11px; color:#64748b;">(Quy đổi: 1 mg/dL = 88.4 µmol/L)</span>
                </div>
              </div>

              <div class="card result-card">
                <div class="card-head">
                  <span class="card-title">🩺 Đánh giá mức độ suy thận</span>
                </div>
                <div class="age-stats-grid">
                  <div class="stat-card" style="grid-column: span 3;">
                    <div class="stat-val" id="valCrcl" style="font-size:32px;">--</div>
                    <div class="stat-lbl">Độ thanh thải Creatinine: <b>ml/phút</b></div>
                  </div>
                </div>

                <div id="crclKdigoBox" style="margin-top:14px;"></div>
                <div id="crclClinicalTip" class="card-note" style="margin-top:12px; display:none;"></div>
              </div>
            </div>
          </div>

          <!-- ================= TAB 3: TỐC ĐỘ TRUYỀN DỊCH ================= -->
          <div id="tabIv" class="subtool-tab-pane">
            <div class="tool-body-grid">
              <div class="card form-card">
                <div class="card-head">
                  <span class="card-title">💧 Y lệnh dịch truyền</span>
                </div>
                <div class="form-grid">
                  <div class="form-group col-span-2">
                    <label class="form-label" for="ivVolume">Tổng thể tích dịch truyền (ml) <b class="req">*</b></label>
                    <input type="number" id="ivVolume" class="inp" placeholder="VD: 500" min="10" max="5000" />
                    <div class="quick-preset-chips" style="margin-top:6px;">
                      <button type="button" class="preset-chip btn-vol" data-vol="100">100 ml</button>
                      <button type="button" class="preset-chip btn-vol" data-vol="250">250 ml</button>
                      <button type="button" class="preset-chip btn-vol" data-vol="500">500 ml</button>
                      <button type="button" class="preset-chip btn-vol" data-vol="1000">1000 ml</button>
                    </div>
                  </div>

                  <div class="form-group">
                    <label class="form-label" for="ivDuration">Thời gian truyền <b class="req">*</b></label>
                    <input type="number" id="ivDuration" class="inp" placeholder="VD: 4" min="0.1" step="0.5" />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="ivDurationUnit">Đơn vị thời gian</label>
                    <select id="ivDurationUnit" class="inp">
                      <option value="hours">Giờ</option>
                      <option value="minutes">Phút</option>
                    </select>
                  </div>

                  <div class="form-group col-span-2">
                    <label class="form-label" for="ivDropFactor">Loại dây truyền (Drop Factor)</label>
                    <select id="ivDropFactor" class="inp">
                      <option value="20">Dây truyền dịch người lớn chuẩn (20 giọt/ml)</option>
                      <option value="15">Dây truyền máu / một số hãng (15 giọt/ml)</option>
                      <option value="60">Dây truyền vi hạt / Trẻ em (Microdrip - 60 giọt/ml)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div class="card result-card">
                <div class="card-head">
                  <span class="card-title">⏱️ Tốc độ điều chỉnh</span>
                </div>
                <div class="age-stats-grid">
                  <div class="stat-card">
                    <div class="stat-val" id="valIvGtt" style="color:var(--primary);">--</div>
                    <div class="stat-lbl">Giọt / Phút (gtt/min)</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-val" id="valIvMlH">--</div>
                    <div class="stat-lbl">Tốc độ máy (ml/giờ)</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-val" id="valIvSecPerDrop">--</div>
                    <div class="stat-lbl">Giây / 1 giọt</div>
                  </div>
                </div>

                <div id="ivSummaryBox" class="card-note" style="margin-top:14px; font-size:12.5px;">
                  Nhập thể tích và thời gian để tính tốc độ giọt/phút chuẩn xác.
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      // Subtabs switching
      container.querySelectorAll('.subtool-tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('.subtool-tab-btn').forEach((b) => b.classList.remove('active'));
          container.querySelectorAll('.subtool-tab-pane').forEach((p) => p.classList.remove('active'));
          btn.classList.add('active');
          const target = container.querySelector('#' + btn.dataset.tab);
          if (target) target.classList.add('active');
        });
      });

      // ================= CALC 1: BMI & BSA =================
      const inpHeight = container.querySelector('#bmiHeight');
      const inpWeight = container.querySelector('#bmiWeight');
      const valBmi = container.querySelector('#valBmi');
      const valBsa = container.querySelector('#valBsa');
      const valIbw = container.querySelector('#valIbw');
      const boxBmi = container.querySelector('#bmiClassificationBox');
      const boxBsa = container.querySelector('#bsaDetailBox');

      function calcBmi() {
        const h = parseFloat(inpHeight.value);
        const w = parseFloat(inpWeight.value);
        if (!h || !w || h <= 0 || w <= 0) {
          valBmi.textContent = '--';
          valBsa.textContent = '--';
          valIbw.textContent = '--';
          boxBmi.innerHTML = '';
          boxBsa.innerHTML = '';
          return;
        }

        const hMeter = h / 100;
        const bmi = w / (hMeter * hMeter);
        // Mosteller formula: sqrt((cm * kg)/3600)
        const bsaMosteller = Math.sqrt((h * w) / 3600);
        // DuBois formula: 0.007184 * H^0.725 * W^0.425
        const bsaDuBois = 0.007184 * Math.pow(h, 0.725) * Math.pow(w, 0.425);
        // Devine Ideal Body Weight (for adult ~ average male/female estimation)
        const inchesOver5Ft = Math.max(0, (h / 2.54) - 60);
        const ibw = 50 + 2.3 * inchesOver5Ft;

        valBmi.textContent = bmi.toFixed(1);
        valBsa.textContent = bsaMosteller.toFixed(2);
        valIbw.textContent = ibw > 0 ? ibw.toFixed(1) : '--';

        let category = '';
        let colorClass = '';
        if (bmi < 18.5) {
          category = 'Thiếu cân (Gầy)';
          colorClass = 'badge-blue';
        } else if (bmi <= 22.9) {
          category = 'Thể trạng Bình thường (Lý tưởng)';
          colorClass = 'badge-emerald';
        } else if (bmi <= 24.9) {
          category = 'Thừa cân (Tiền béo phì)';
          colorClass = 'badge-amber';
        } else if (bmi <= 29.9) {
          category = 'Béo phì độ I';
          colorClass = 'badge-amber';
        } else {
          category = 'Béo phì độ II (Nguy hiểm)';
          colorClass = 'badge-red';
        }

        boxBmi.innerHTML = `
          <div style="padding:10px; border-radius:8px; background:var(--surface-soft); border:1px solid var(--border-light);">
            <b>Đánh giá:</b> <span class="policy-badge ${colorClass}" style="margin-left:6px; font-size:12px;">${category}</span>
          </div>
        `;

        boxBsa.innerHTML = `
          <b>Chi tiết diện tích da (BSA):</b><br/>
          • Công thức Mosteller: <b>${bsaMosteller.toFixed(3)} m²</b><br/>
          • Công thức DuBois: <b>${bsaDuBois.toFixed(3)} m²</b> (dùng trong hóa trị liệu ung thư & tính liều thuốc lọc thận)
        `;
      }
      inpHeight.addEventListener('input', calcBmi);
      inpWeight.addEventListener('input', calcBmi);

      // ================= CALC 2: CrCl =================
      const inpCrAge = container.querySelector('#crclAge');
      const selCrGender = container.querySelector('#crclGender');
      const inpCrWeight = container.querySelector('#crclWeight');
      const inpCrCreatinine = container.querySelector('#crclCreatinine');
      const selCrUnit = container.querySelector('#crclUnit');
      const valCrcl = container.querySelector('#valCrcl');
      const boxKdigo = container.querySelector('#crclKdigoBox');
      const tipKdigo = container.querySelector('#crclClinicalTip');

      function calcCrCl() {
        const age = parseFloat(inpCrAge.value);
        const w = parseFloat(inpCrWeight.value);
        let cr = parseFloat(inpCrCreatinine.value);
        const gender = selCrGender.value;
        const unit = selCrUnit.value;

        if (!age || !w || !cr || age <= 0 || w <= 0 || cr <= 0) {
          valCrcl.textContent = '--';
          boxKdigo.innerHTML = '';
          tipKdigo.style.display = 'none';
          return;
        }

        // Đổi về mg/dL nếu đơn vị là µmol/L (1 mg/dL = 88.4 µmol/L)
        let crMgDl = unit === 'umol' ? cr / 88.4 : cr;

        // Cockcroft-Gault: [(140 - Age) * Weight] / [72 * Cr(mg/dL)]
        let crcl = ((140 - age) * w) / (72 * crMgDl);
        if (gender === 'female') {
          crcl *= 0.85;
        }

        valCrcl.textContent = crcl.toFixed(1);

        let stage = '';
        let stageDesc = '';
        let badgeColor = '';
        let clinicalNote = '';

        if (crcl >= 90) {
          stage = 'G1 — Chức năng thận bình thường hoặc tăng';
          stageDesc = 'CrCl ≥ 90 ml/phút';
          badgeColor = 'badge-emerald';
          clinicalNote = 'Không cần hiệu chỉnh liều theo chức năng thận đối với hầu hết các thuốc.';
        } else if (crcl >= 60) {
          stage = 'G2 — Suy giảm chức năng thận nhẹ';
          stageDesc = 'CrCl 60 – 89 ml/phút';
          badgeColor = 'badge-blue';
          clinicalNote = 'Thận trọng với thuốc độc thận. Phần lớn thuốc chưa cần giảm liều.';
        } else if (crcl >= 45) {
          stage = 'G3a — Suy giảm chức năng thận nhẹ đến trung bình';
          stageDesc = 'CrCl 45 – 59 ml/phút';
          badgeColor = 'badge-amber';
          clinicalNote = 'Bắt đầu cần xem xét hiệu chỉnh liều một số kháng sinh (Vancomycin, Aminoglycosid, Cephalosporin...).';
        } else if (crcl >= 30) {
          stage = 'G3b — Suy giảm chức năng thận trung bình đến nặng';
          stageDesc = 'CrCl 30 – 44 ml/phút';
          badgeColor = 'badge-amber';
          clinicalNote = 'Bắt buộc hiệu chỉnh liều hoặc giãn khoảng cách đưa liều cho các thuốc đào thải chủ yếu qua thận.';
        } else if (crcl >= 15) {
          stage = 'G4 — Suy giảm chức năng thận nặng';
          stageDesc = 'CrCl 15 – 29 ml/phút';
          badgeColor = 'badge-red';
          clinicalNote = 'Nguy cơ tích lũy thuốc rất cao. Giảm mạnh liều hoặc tăng gấp đôi khoảng cách đưa liều.';
        } else {
          stage = 'G5 — Suy thận giai đoạn cuối';
          stageDesc = 'CrCl < 15 ml/phút';
          badgeColor = 'badge-red';
          clinicalNote = 'Chỉ định lọc máu / chạy thận nhân tạo. Cân nhắc dùng liều sau khi lọc máu.';
        }

        boxKdigo.innerHTML = `
          <div style="padding:10px; border-radius:8px; background:var(--surface-soft); border:1px solid var(--border-light);">
            <div><b>Phân độ chức năng thận (KDIGO):</b></div>
            <div style="margin-top:6px;">
              <span class="policy-badge ${badgeColor}" style="font-size:12px;">${stage}</span>
            </div>
            <div style="font-size:11.5px; color:#64748b; margin-top:4px;">${stageDesc}</div>
          </div>
        `;

        tipKdigo.style.display = 'block';
        tipKdigo.innerHTML = `<b>💡 Khuyến cáo Dược lâm sàng:</b> ${clinicalNote}`;
      }

      [inpCrAge, selCrGender, inpCrWeight, inpCrCreatinine, selCrUnit].forEach((el) => {
        el.addEventListener('input', calcCrCl);
        el.addEventListener('change', calcCrCl);
      });

      // ================= CALC 3: IV RATE =================
      const inpVol = container.querySelector('#ivVolume');
      const inpDur = container.querySelector('#ivDuration');
      const selDurUnit = container.querySelector('#ivDurationUnit');
      const selDropFactor = container.querySelector('#ivDropFactor');
      const valIvGtt = container.querySelector('#valIvGtt');
      const valIvMlH = container.querySelector('#valIvMlH');
      const valIvSecPerDrop = container.querySelector('#valIvSecPerDrop');
      const boxIvSummary = container.querySelector('#ivSummaryBox');

      function calcIv() {
        const vol = parseFloat(inpVol.value);
        let dur = parseFloat(inpDur.value);
        const unit = selDurUnit.value;
        const dropFactor = parseFloat(selDropFactor.value);

        if (!vol || !dur || vol <= 0 || dur <= 0) {
          valIvGtt.textContent = '--';
          valIvMlH.textContent = '--';
          valIvSecPerDrop.textContent = '--';
          boxIvSummary.textContent = 'Nhập thể tích và thời gian để tính tốc độ giọt/phút chuẩn xác.';
          return;
        }

        const durMinutes = unit === 'hours' ? dur * 60 : dur;
        const durHours = durMinutes / 60;

        // gtt/min = (Volume in mL * Drop Factor) / Time in Minutes
        const gttMin = (vol * dropFactor) / durMinutes;
        const mlH = vol / durHours;
        const secPerDrop = gttMin > 0 ? 60 / gttMin : 0;

        valIvGtt.textContent = Math.round(gttMin);
        valIvMlH.textContent = mlH.toFixed(1);
        valIvSecPerDrop.textContent = secPerDrop.toFixed(1) + ' s';

        boxIvSummary.innerHTML = `
          ✅ <b>Kết luận điều dưỡng:</b> Cần điều chỉnh dây truyền <b>${Math.round(gttMin)} giọt/phút</b> 
          (khoảng <b>${secPerDrop.toFixed(1)} giây rơi 1 giọt</b>) để truyền hết <b>${vol} ml</b> trong vòng <b>${dur} ${unit === 'hours' ? 'giờ' : 'phút'}</b>.
        `;
      }

      [inpVol, inpDur, selDurUnit, selDropFactor].forEach((el) => {
        el.addEventListener('input', calcIv);
        el.addEventListener('change', calcIv);
      });

      container.querySelectorAll('.btn-vol').forEach((btn) => {
        btn.addEventListener('click', () => {
          inpVol.value = btn.dataset.vol;
          calcIv();
        });
      });

      return () => {};
    }
  });
})();
