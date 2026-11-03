/**
 * BATO_UTILITIES — Plug-and-Play Tool Registry
 * Mỗi tiện ích con trong thư mục tools/*.js chỉ cần gọi:
 *   window.registerBatoUtilityTool({
 *     id: 'ma_cong_cu',
 *     name: 'Tên công cụ',
 *     shortName: 'Tên ngắn',
 *     icon: '🪪',
 *     category: 'Hành chính / Y tế',
 *     description: 'Mô tả ngắn công dụng...',
 *     mount(container, context) { ... }
 *   });
 */

(function () {
  const toolsList = [];
  const toolsById = new Map();

  window.BATO_UTILITY_REGISTRY = {
    register(toolDef) {
      if (!toolDef || !toolDef.id || typeof toolDef.mount !== 'function') {
        console.warn('[BATO_UTILITIES] Tool không hợp lệ:', toolDef);
        return;
      }
      if (toolsById.has(toolDef.id)) {
        const idx = toolsList.findIndex((t) => t.id === toolDef.id);
        if (idx >= 0) toolsList[idx] = toolDef;
      } else {
        toolsList.push(toolDef);
      }
      toolsById.set(toolDef.id, toolDef);
    },

    getAll() {
      return toolsList.slice();
    },

    getById(id) {
      return toolsById.get(id) || null;
    }
  };

  window.registerBatoUtilityTool = function (toolDef) {
    window.BATO_UTILITY_REGISTRY.register(toolDef);
  };
})();
