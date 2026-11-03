/**
 * BATO_UTILITIES - Công cụ Tính tuổi & Phân loại đối tượng Y tế / BHYT
 * Phục vụ nhân viên tiếp đón, phòng khám, giám định BHYT kiểm tra chính sách:
 * - Trẻ sơ sinh (< 28 ngày)
 * - Trẻ em dưới 36 tháng
 * - Trẻ em dưới 6 tuổi (72 tháng) hưởng BHYT TE không cùng chi trả
 * - Người cao tuổi (60+, 80+)
 */

(function () {
  const TOOL_ID = 'age_calculator';

  window.registerBatoUtilityTool({
    id: TOOL_ID,
    name: 'Tính Tuổi & Phân Loại Đối Tượng',
    shortName: 'Tính tuổi & Đối tượng',
    icon: '👶',
    category: 'Tiếp đón & BHYT',
    description: 'Tính chính xác số tuổi, số tháng, số ngày; phân loại trẻ sơ sinh, trẻ <6 tuổi (hạn thẻ TE), người già ≥80 tuổi.',

    async mount(container, ctx) {
      container.innerHTML = `
        <div class="tool-content-wrap">
          <div class="tool-header-bar">
            <div>
              <h2 class="tool-title">👶 Thước Tính Tuổi & Phân Loại Đối Tượng Y Tế</h2>
              <p class="tool-subtitle">Tính toán chính xác tuổi năm, số tháng tuổi, số ngày tuổi phục vụ phân loại chính sách KCB BHYT trẻ em và người cao tuổi.</p>
            </div>
          </div>

          <div class="tool-body-grid">
            <!-- CỘT NHẬP LIỆU -->
            <div class="card form-card">
              <div class="card-head">
                <span class="card-title">📅 Nhập ngày sinh & mốc tính</span>
              </div>

              <div class="form-grid">
                <div class="form-group col-span-2">
                  <label class="form-label" for="ageInpDob">Ngày sinh bệnh nhân <b class="req">*</b></label>
                  <div class="input-with-button">
                    <input type="date" id="ageInpDob" class="inp" />
                    <button type="button" id="btnQuickToday" class="btn btn-sm btn-outline">Hôm nay</button>
                  </div>
                  <div class="quick-preset-chips" style="margin-top:8px;">
                    <button type="button" class="preset-chip" data-preset="newborn">Sơ sinh (7 ngày)</button>
                    <button type="button" class="preset-chip" data-preset="months6">6 tháng</button>
                    <button type="button" class="preset-chip" data-preset="months18">18 tháng</button>
                    <button type="button" class="preset-chip" data-preset="under6">5 tuổi (chuẩn bị hết hạn TE)</button>
                    <button type="button" class="preset-chip" data-preset="elderly">80 tuổi</button>
                  </div>
                </div>

                <div class="form-group col-span-2">
                  <label class="form-label" for="ageInpTarget">Tính đến ngày (mặc định ngày hiện tại)</label>
                  <input type="date" id="ageInpTarget" class="inp" />
                </div>
              </div>

              <div class="card-note" style="margin-top: 14px;">
                <b>💡 Ghi chú nghiệp vụ BHYT:</b>
                <ul style="padding-left:18px; margin-top:4px; font-size:12px; color:#475569; line-height:1.6;">
                  <li><b>Trẻ em dưới 6 tuổi</b>: Hưởng 100% chi phí KCB BHYT theo Luật BHYT. Thẻ BHYT TE có giá trị đến ngày trẻ đủ 72 tháng tuổi.</li>
                  <li>Trường hợp trẻ đủ 72 tháng tuổi mà chưa đến kỳ nhập học thì thẻ BHYT có giá trị sử dụng đến hết ngày 30/9 của năm đó.</li>
                  <li><b>Người cao tuổi từ đủ 80 tuổi trở lên</b>: Thuộc nhóm đối tượng ưu tiên khám chữa bệnh tại các cơ sở KCB.</li>
                </ul>
              </div>
            </div>

            <!-- CỘT KẾT QUẢ TÍNH TOÁN & PHÂN LOẠI -->
            <div class="card result-card">
              <div class="card-head">
                <span class="card-title">📊 Kết quả phân tích tuổi</span>
              </div>

              <div id="ageResultBox" class="age-stats-grid">
                <div class="stat-card">
                  <div class="stat-val" id="statYears">0</div>
                  <div class="stat-lbl">Tuổi (Năm)</div>
                </div>
                <div class="stat-card">
                  <div class="stat-val" id="statMonths">0</div>
                  <div class="stat-lbl">Tổng số tháng</div>
                </div>
                <div class="stat-card">
                  <div class="stat-val" id="statDays">0</div>
                  <div class="stat-lbl">Tổng số ngày</div>
                </div>
              </div>

              <!-- Dòng chi tiết: X tuổi Y tháng Z ngày -->
              <div class="age-exact-row" id="ageExactText">
                Vui lòng chọn ngày sinh để xem kết quả.
              </div>

              <!-- Phân loại đối tượng nghiệp vụ -->
              <div class="classification-box">
                <div class="classification-title">🏷️ Phân loại đối tượng & Chính sách</div>
                <div id="classificationBadges" class="classification-badges"></div>
              </div>

              <!-- Các mốc quan trọng -->
              <div class="milestones-box">
                <div class="milestones-title">📌 Các mốc ngày quan trọng</div>
                <div id="milestonesList" class="milestones-list"></div>
              </div>
            </div>
          </div>
        </div>
      `;

      const inpDob = container.querySelector('#ageInpDob');
      const inpTarget = container.querySelector('#ageInpTarget');
      const statYears = container.querySelector('#statYears');
      const statMonths = container.querySelector('#statMonths');
      const statDays = container.querySelector('#statDays');
      const exactText = container.querySelector('#ageExactText');
      const badgesContainer = container.querySelector('#classificationBadges');
      const milestonesList = container.querySelector('#milestonesList');

      // Default target date is today
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      inpTarget.value = todayStr;

      function formatDateVN(dateObj) {
        if (!dateObj || isNaN(dateObj.getTime())) return '';
        const d = String(dateObj.getDate()).padStart(2, '0');
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const y = dateObj.getFullYear();
        return `${d}/${m}/${y}`;
      }

      function calculateAge() {
        if (!inpDob.value) {
          exactText.textContent = 'Vui lòng chọn ngày sinh để xem kết quả.';
          statYears.textContent = '0';
          statMonths.textContent = '0';
          statDays.textContent = '0';
          badgesContainer.innerHTML = '';
          milestonesList.innerHTML = '';
          return;
        }

        const dob = new Date(inpDob.value + 'T00:00:00');
        const target = inpTarget.value ? new Date(inpTarget.value + 'T00:00:00') : new Date();

        if (isNaN(dob.getTime()) || isNaN(target.getTime())) return;

        if (dob > target) {
          exactText.innerHTML = '<span style="color:var(--danger)">⚠️ Ngày sinh lớn hơn mốc tính toán!</span>';
          return;
        }

        const diffTime = target.getTime() - dob.getTime();
        const totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        let years = target.getFullYear() - dob.getFullYear();
        let months = target.getMonth() - dob.getMonth();
        let days = target.getDate() - dob.getDate();

        if (days < 0) {
          months--;
          const prevMonthLastDay = new Date(target.getFullYear(), target.getMonth(), 0).getDate();
          days += prevMonthLastDay;
        }
        if (months < 0) {
          years--;
          months += 12;
        }

        const totalMonths = years * 12 + months;

        statYears.textContent = years;
        statMonths.textContent = totalMonths;
        statDays.textContent = totalDays;

        exactText.innerHTML = `Bệnh nhân: <b>${years} tuổi, ${months} tháng, ${days} ngày</b> (Tương đương <b>${totalMonths}</b> tháng tuổi / <b>${totalDays}</b> ngày).`;

        // Phân loại chính sách
        const badges = [];
        if (totalDays <= 28) {
          badges.push({ text: '👶 Trẻ sơ sinh (≤ 28 ngày tuổi)', color: 'blue' });
        }
        if (totalMonths < 12) {
          badges.push({ text: '🍼 Trẻ em dưới 1 tuổi (Chế độ tiêm chủng mở rộng)', color: 'blue' });
        }
        if (totalMonths < 36) {
          badges.push({ text: '🧒 Trẻ em dưới 36 tháng tuổi', color: 'indigo' });
        }
        if (totalMonths < 72) {
          badges.push({ text: '🚸 Trẻ em dưới 6 tuổi (Hưởng 100% BHYT mã TE)', color: 'emerald' });
        } else {
          badges.push({ text: '👤 Đã trên 6 tuổi (Hết hạn mức thẻ TE dưới 6 tuổi)', color: 'slate' });
        }

        if (years >= 18) {
          badges.push({ text: '🧑 Người trưởng thành (≥ 18 tuổi)', color: 'slate' });
        }
        if (years >= 60 && years < 80) {
          badges.push({ text: '🧓 Người cao tuổi (≥ 60 tuổi)', color: 'amber' });
        }
        if (years >= 80) {
          badges.push({ text: '🌟 Người cao tuổi từ đủ 80 tuổi (Ưu tiên KCB & Bảo trợ)', color: 'purple' });
        }

        badgesContainer.innerHTML = badges
          .map((b) => `<span class="policy-badge badge-${b.color}">${ctx.escapeHtml(b.text)}</span>`)
          .join('');

        // Mốc ngày quan trọng
        const date28Days = new Date(dob);
        date28Days.setDate(date28Days.getDate() + 28);

        const date1Year = new Date(dob);
        date1Year.setFullYear(date1Year.getFullYear() + 1);

        const date6Years = new Date(dob);
        date6Years.setFullYear(date6Years.getFullYear() + 6);

        const date18Years = new Date(dob);
        date18Years.setFullYear(date18Years.getFullYear() + 18);

        const date80Years = new Date(dob);
        date80Years.setFullYear(date80Years.getFullYear() + 80);

        milestonesList.innerHTML = `
          <div class="milestone-item">
            <span class="milestone-name">Hết thời kỳ sơ sinh (28 ngày):</span>
            <span class="milestone-date"><b>${formatDateVN(date28Days)}</b></span>
          </div>
          <div class="milestone-item">
            <span class="milestone-name">Tròn 1 tuổi (12 tháng):</span>
            <span class="milestone-date"><b>${formatDateVN(date1Year)}</b></span>
          </div>
          <div class="milestone-item ${totalMonths >= 72 ? 'passed' : 'active-highlight'}">
            <span class="milestone-name">Tròn 6 tuổi (72 tháng - Hết hạn thẻ TE):</span>
            <span class="milestone-date"><b>${formatDateVN(date6Years)}</b> ${totalMonths >= 72 ? '(Đã qua)' : '(Đang áp dụng)'}</span>
          </div>
          <div class="milestone-item">
            <span class="milestone-name">Đủ 18 tuổi (Trưởng thành):</span>
            <span class="milestone-date"><b>${formatDateVN(date18Years)}</b></span>
          </div>
          <div class="milestone-item">
            <span class="milestone-name">Đủ 80 tuổi (Ưu tiên KCB):</span>
            <span class="milestone-date"><b>${formatDateVN(date80Years)}</b></span>
          </div>
        `;
      }

      inpDob.addEventListener('input', calculateAge);
      inpTarget.addEventListener('input', calculateAge);

      container.querySelector('#btnQuickToday')?.addEventListener('click', () => {
        inpDob.value = todayStr;
        calculateAge();
      });

      // Quick preset buttons
      container.querySelectorAll('.preset-chip[data-preset]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const type = btn.dataset.preset;
          const ref = new Date();
          if (type === 'newborn') {
            ref.setDate(ref.getDate() - 7);
          } else if (type === 'months6') {
            ref.setMonth(ref.getMonth() - 6);
          } else if (type === 'months18') {
            ref.setMonth(ref.getMonth() - 18);
          } else if (type === 'under6') {
            ref.setFullYear(ref.getFullYear() - 5);
            ref.setMonth(ref.getMonth() - 8);
          } else if (type === 'elderly') {
            ref.setFullYear(ref.getFullYear() - 81);
          }
          inpDob.value = ref.toISOString().slice(0, 10);
          calculateAge();
        });
      });

      return () => {};
    }
  });
})();
