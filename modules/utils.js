/**
 * 工具函数模块
 */
const Utils = {
  throttle: (fn, delay) => {
    let timer = null;
    return function(...args) {
      if (!timer) {
        timer = setTimeout(() => {
          fn.apply(this, args);
          timer = null;
        }, delay);
      }
    };
  },

  debounce: (fn, delay) => {
    let timer = null;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  deepClone: (obj) => {
    try {
      if (typeof obj !== 'object' || obj === null) return obj;
      if (typeof structuredClone === 'function') return structuredClone(obj);
      return JSON.parse(JSON.stringify(obj));
    } catch (e) {
      console.error('深拷贝失败', e);
      return obj;
    }
  },

  formatTagValue: (value, group) => {
    return CONFIG.NUMBER_GROUPS.includes(group) ? Number(value) : value;
  },

  getSafeTop: () => {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-top')) || 0;
  },

  validateFilterItem: (item) => {
    return item &&
      typeof item === 'object' &&
      typeof item.name === 'string' &&
      item.selected && typeof item.selected === 'object' &&
      Array.isArray(item.excluded);
  },

  createFragment: (list, renderItem) => {
    const fragment = document.createDocumentFragment();
    list.forEach((item, index) => {
      const el = renderItem(item, index);
      if (el) fragment.appendChild(el);
    });
    return fragment;
  },

  getColorByNum: (num) => {
    const color = Object.keys(CONFIG.COLOR_MAP).find(c => CONFIG.COLOR_MAP[c].includes(num));
    const colorMap = { '红': 'red', '蓝': 'blue', '绿': 'green' };
    return colorMap[color] || 'red';
  }
};
