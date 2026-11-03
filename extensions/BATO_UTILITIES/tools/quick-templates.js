/**
 * BATO_UTILITIES - Mẫu Mô Tả Khám Bệnh & Cận Lâm Sàng (Quick Text Templates)
 * Hỗ trợ bác sĩ sao chép nhanh các đoạn mô tả bình thường/thường gặp vào phần mềm HIS.
 * Cho phép tự thêm, sửa, xóa và lưu trữ cục bộ (chrome.storage.local).
 */

(function () {
  const TOOL_ID = 'quick_templates';
  const STORAGE_KEY = 'bato_util_custom_templates';

  const DEFAULT_TEMPLATES = [
    {
      id: 'kham_tong_quat',
      title: 'Khám toàn thân & Nội khoa (Bình thường)',
      category: 'Khám Lâm Sàng',
      content: `- Bệnh nhân tỉnh táo, tiếp xúc tốt. Da niêm mạc hồng hào, không phù, không xuất huyết dưới da.\n- Tuyến giáp không lớn, hạch ngoại vi không sờ chạm.\n- Tim đều rõ, T1, T2 nghe rõ, không nghe âm thổi bệnh lý.\n- Phổi thông khí rõ cả 2 phế trường, không rale.\n- Bụng mềm, không chướng, gan lách không sờ thấy, ấn không điểm đau khu trú.\n- Các cơ quan khác: Chưa phát hiện bất thường.`
    },
    {
      id: 'sieu_am_bung',
      title: 'Siêu âm bụng tổng quát (Bình thường)',
      category: 'Chẩn Đoán Hình Ảnh',
      content: `- Gan: Kích thước trong giới hạn bình thường, nhu mô đều, không thấy tổn thương khu trú. Tĩnh mạch cửa không giãn.\n- Mật: Túi mật thành mỏng, lòng không có sỏi. Đường mật trong và ngoài gan không giãn.\n- Tụy, Lách: Kích thước và cấu trúc hồi âm bình thường.\n- Hai thận: Kích thước bình thường, nhu mô phân biệt vỏ tủy rõ, đài bể thận không giãn, không thấy sỏi.\n- Bàng quang: Thành mỏng, lòng thông thoáng.\n- Ổ bụng: Không thấy dịch tự do, không thấy khối u bất thường.\n=> KẾT LUẬN: Hình ảnh siêu âm bụng tổng quát hiện tại chưa thấy bất thường.`
    },
    {
      id: 'xquang_phoi',
      title: 'X-quang ngực thẳng (Bình thường)',
      category: 'Chẩn Đoán Hình Ảnh',
      content: `- Khung xương lồng ngực cân đối, không gãy xương sườn.\n- Hai phế trường sáng đều, không thấy tổn thương thâm nhiễm hay nốt mờ bất thường.\n- Rốn phổi 2 bên bình thường. Góc tâm hoành và sườn hoành 2 bên nhọn sáng.\n- Bóng tim kích thước và chỉ số tim/lồng ngực trong giới hạn bình thường.\n- Vòm hoành 2 bên đều, đường bờ liên tục.\n=> KẾT LUẬN: Hình ảnh tim phổi trên phim chụp hiện tại chưa thấy bất thường.`
    },
    {
      id: 'ecg_nhan_xoang',
      title: 'Điện tâm đồ ECG (Nhịp xoang bình thường)',
      category: 'Thăm Dò Chức Năng',
      content: `- Nhịp xoang đều, tần số ~ 75 chu kỳ/phút.\n- Trục trung gian.\n- Sóng P bình thường.\n- Khoảng PR: 0.16s trong giới hạn bình thường.\n- Phức bộ QRS thanh mảnh (0.08s), không có dấu hiệu dày thất.\n- Đoạn ST đẳng điện, sóng T dương bình thường.\n=> KẾT LUẬN: Điện tâm đồ nhịp xoang đều trong giới hạn bình thường.`
    },
    {
      id: 'noi_soi_tmh',
      title: 'Nội soi Tai Mũi Họng (Bình thường)',
      category: 'Chuyên Khoa',
      content: `- Tai: Ống tai ngoài 2 bên sạch, màng nhĩ 2 bên sáng bóng, nón sáng rõ, không thủng.\n- Mũi: Niêm mạc mũi hồng, cuốn dưới 2 bên kích thước bình thường, không quá phát, khe giữa thông thoáng, không có mủ hay polyp.\n- Họng - Thanh quản: Niêm mạc họng hồng sạch, hai Amiđan kích thước bình thường (độ I), không sưng mủ. Hạ họng sạch, dây thanh 2 bên di động tốt, khép kín khi phát âm.`
    },
    {
      id: 'kham_nhi_viem_ho_hap',
      title: 'Khám Nhi: Nhiễm khuẩn hô hấp trên',
      category: 'Nhi Khoa',
      content: `- Trẻ tỉnh, quấy khóc nhẹ, không khó thở, môi hồng.\n- Mũi: Chảy ít dịch nhầy trong.\n- Họng đỏ nhẹ, amidan không sưng mủ.\n- Thở êm, không co kéo cơ hô hấp phụ. Nhịp thở đều.\n- Phổi thông khí tốt, không nghe rale ẩm, không rale rít.\n- Bụng mềm, đại tiểu tiện bình thường.\n=> KẾT LUẬN: Nhiễm khuẩn hô hấp trên cấp tính.`
    }
  ];

  window.registerBatoUtilityTool({
    id: TOOL_ID,
    name: 'Mẫu Mô Tả Khám Bệnh & Cận Lâm Sàng',
    shortName: 'Mẫu Khám & CLS',
    icon: '📋',
    category: 'Lâm sàng & Xét nghiệm',
    description: 'Kho mẫu mô tả bình thường: Khám nội khoa, Siêu âm bụng, X-quang ngực, ECG, TMH, Nhi khoa; 1 chạm sao chép vào HIS.',

    async mount(container, ctx) {
      const store = await chrome.storage.local.get([STORAGE_KEY]);
      let customTemplates = Array.isArray(store[STORAGE_KEY]) ? store[STORAGE_KEY] : [];
      let allTemplates = [...DEFAULT_TEMPLATES, ...customTemplates];
      let selectedCategory = 'all';

      container.innerHTML = `
        <div class="tool-content-wrap">
          <div class="tool-header-bar">
            <div>
              <h2 class="tool-title">📋 Kho Mẫu Mô Tả Khám Bệnh & Cận Lâm Sàng</h2>
              <p class="tool-subtitle">Sao chép 1 chạm các mẫu mô tả bình thường vào phần mềm HIS; hỗ trợ lưu thêm mẫu riêng của khoa phòng.</p>
            </div>
            <div>
              <button type="button" id="btnAddNewTemplate" class="btn btn-sm btn-primary">
                ➕ Thêm mẫu mới
              </button>
            </div>
          </div>

          <!-- BỘ LỌC CHUYÊN KHOA & TÌM KIẾM -->
          <div style="display:flex; gap:10px; margin-bottom:12px; flex-wrap:wrap; align-items:center;">
            <input type="search" id="inpSearchTpl" class="inp" placeholder="🔍 Tìm kiếm mẫu khám..." style="max-width:280px;" />
            <div id="tplCategoryChips" class="quick-preset-chips" style="margin-top:0;"></div>
          </div>

          <!-- DANH SÁCH MẪU -->
          <div id="templatesGrid" class="templates-grid"></div>

          <!-- MODAL THÊM MẪU MỚI (ẨN MẶC ĐỊNH) -->
          <div id="modalAddTemplate" class="app-modal hidden">
            <div class="app-modal-dialog">
              <div class="app-modal-head">
                <span class="app-modal-title">➕ Thêm Mẫu Mô Tả Mới</span>
                <button type="button" id="btnCloseModalTpl" class="app-modal-close">&times;</button>
              </div>
              <div class="app-modal-body">
                <div class="form-group" style="margin-bottom:10px;">
                  <label class="form-label" for="inpNewTplTitle">Tiêu đề mẫu <b class="req">*</b></label>
                  <input type="text" id="inpNewTplTitle" class="inp" placeholder="VD: Khám Mắt bình thường..." />
                </div>
                <div class="form-group" style="margin-bottom:10px;">
                  <label class="form-label" for="inpNewTplCat">Chuyên khoa / Phân loại</label>
                  <input type="text" id="inpNewTplCat" class="inp" placeholder="VD: Mắt / Ngoại khoa / Khám bệnh..." />
                </div>
                <div class="form-group">
                  <label class="form-label" for="txtNewTplContent">Nội dung mẫu mô tả <b class="req">*</b></label>
                  <textarea id="txtNewTplContent" class="inp" rows="6" placeholder="Nhập nội dung mẫu văn bản..."></textarea>
                </div>
              </div>
              <div class="app-modal-footer">
                <button type="button" id="btnSaveNewTpl" class="btn btn-primary">💾 Lưu vào danh sách</button>
                <button type="button" id="btnCancelModalTpl" class="btn btn-outline">Hủy bỏ</button>
              </div>
            </div>
          </div>
        </div>
      `;

      const grid = container.querySelector('#templatesGrid');
      const catChips = container.querySelector('#tplCategoryChips');
      const inpSearch = container.querySelector('#inpSearchTpl');
      const modal = container.querySelector('#modalAddTemplate');

      function getCategories() {
        const cats = new Set(allTemplates.map((t) => t.category || 'Khác'));
        return ['all', ...Array.from(cats)];
      }

      function renderCatChips() {
        const cats = getCategories();
        catChips.innerHTML = cats
          .map(
            (c) => `
            <button type="button" class="preset-chip ${selectedCategory === c ? 'active' : ''}" data-cat="${ctx.escapeHtml(c)}">
              ${c === 'all' ? 'Tất cả' : ctx.escapeHtml(c)}
            </button>
          `
          )
          .join('');

        catChips.querySelectorAll('.preset-chip').forEach((btn) => {
          btn.addEventListener('click', () => {
            selectedCategory = btn.dataset.cat;
            renderCatChips();
            renderList();
          });
        });
      }

      function renderList() {
        const kw = (inpSearch.value || '').trim().toLowerCase();
        const filtered = allTemplates.filter((t) => {
          const matchCat = selectedCategory === 'all' || t.category === selectedCategory;
          const matchKw =
            !kw ||
            t.title.toLowerCase().includes(kw) ||
            t.content.toLowerCase().includes(kw) ||
            (t.category || '').toLowerCase().includes(kw);
          return matchCat && matchKw;
        });

        if (filtered.length === 0) {
          grid.innerHTML = `<div class="empty-hint" style="grid-column: 1 / -1; padding:30px 10px;">Không tìm thấy mẫu phù hợp.</div>`;
          return;
        }

        grid.innerHTML = filtered
          .map(
            (t, idx) => `
            <div class="template-card">
              <div class="template-card-head">
                <div>
                  <span class="policy-badge badge-blue" style="font-size:10px; margin-bottom:4px;">${ctx.escapeHtml(t.category || 'Chung')}</span>
                  <div class="template-card-title">${ctx.escapeHtml(t.title)}</div>
                </div>
                ${
                  t.isCustom
                    ? `<button type="button" class="btn-link btn-del-tpl" data-id="${ctx.escapeHtml(t.id)}" title="Xóa mẫu này" style="color:var(--danger); font-size:11px;">Xóa</button>`
                    : ''
                }
              </div>
              <div class="template-card-body">${ctx.escapeHtml(t.content)}</div>
              <div class="template-card-foot">
                <button type="button" class="btn btn-sm btn-primary btn-copy-tpl" data-id="${ctx.escapeHtml(t.id)}">
                  📋 Sao chép vào HIS
                </button>
              </div>
            </div>
          `
          )
          .join('');

        grid.querySelectorAll('.btn-copy-tpl').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const t = allTemplates.find((x) => x.id === btn.dataset.id);
            if (t) {
              await ctx.copyTextToClipboard(t.content);
              ctx.showToast(`✅ Đã chép mẫu: "${t.title}"`);
            }
          });
        });

        grid.querySelectorAll('.btn-del-tpl').forEach((btn) => {
          btn.addEventListener('click', async () => {
            if (confirm('Bạn có chắc muốn xóa mẫu này?')) {
              customTemplates = customTemplates.filter((x) => x.id !== btn.dataset.id);
              await chrome.storage.local.set({ [STORAGE_KEY]: customTemplates });
              allTemplates = [...DEFAULT_TEMPLATES, ...customTemplates];
              renderCatChips();
              renderList();
              ctx.showToast('Đã xóa mẫu.');
            }
          });
        });
      }

      renderCatChips();
      renderList();

      inpSearch.addEventListener('input', renderList);

      // Modal Handlers
      const openModal = () => modal.classList.remove('hidden');
      const closeModal = () => {
        modal.classList.add('hidden');
        container.querySelector('#inpNewTplTitle').value = '';
        container.querySelector('#inpNewTplCat').value = '';
        container.querySelector('#txtNewTplContent').value = '';
      };

      container.querySelector('#btnAddNewTemplate')?.addEventListener('click', openModal);
      container.querySelector('#btnCloseModalTpl')?.addEventListener('click', closeModal);
      container.querySelector('#btnCancelModalTpl')?.addEventListener('click', closeModal);

      container.querySelector('#btnSaveNewTpl')?.addEventListener('click', async () => {
        const title = container.querySelector('#inpNewTplTitle').value.trim();
        const category = container.querySelector('#inpNewTplCat').value.trim() || 'Mẫu riêng';
        const content = container.querySelector('#txtNewTplContent').value.trim();

        if (!title || !content) {
          ctx.showToast('Vui lòng nhập Tiêu đề và Nội dung mẫu!', true);
          return;
        }

        const newTpl = {
          id: 'custom_' + Date.now(),
          title,
          category,
          content,
          isCustom: true
        };

        customTemplates.push(newTpl);
        await chrome.storage.local.set({ [STORAGE_KEY]: customTemplates });
        allTemplates = [...DEFAULT_TEMPLATES, ...customTemplates];

        closeModal();
        renderCatChips();
        renderList();
        ctx.showToast('✅ Đã lưu mẫu mới thành công!');
      });

      return () => {};
    }
  });
})();
