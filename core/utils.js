
// ====================== 2. 工具函数模块（纯函数，无副作用）======================
/**
 * 通用工具函数
 * @namespace Utils
 */
const Utils = {
  /**
   * 节流函数（优化高频事件）
   * @param {Function} fn - 要执行的函数
   * @param {number} delay - 节流延迟(ms)
   * @returns {Function} 节流后的函数
   */
  throttle: (fn, delay) => {
    let timer = null;
    return function(...args) {
      if(!timer){
        timer = setTimeout(() => {
          fn.apply(this, args);
          timer = null;
        }, delay);
      }
    }
  },

  /**
   * 防抖函数（优化高频点击）
   * @param {Function} fn - 要执行的函数
   * @param {number} delay - 防抖延迟(ms)
   * @returns {Function} 防抖后的函数
   */
  debounce: (fn, delay) => {
    let timer = null;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    }
  },

  /**
   * 深拷贝对象
   * @param {any} obj - 要拷贝的对象
   * @returns {any} 拷贝后的对象
   */
  deepClone: (obj) => {
    try {
      if(typeof obj !== 'object' || obj === null) {
        return obj;
      }
      if(typeof structuredClone === 'function') {
        return structuredClone(obj);
      }
      return JSON.parse(JSON.stringify(obj));
    } catch(e) {
      Logger.error('深拷贝失败', e);
      return obj;
    }
  },

  /**
   * 标签值类型转换（解决数字/字符串匹配问题）
   * @param {string|number} value - 标签值
   * @param {string} group - 分组名
   * @returns {string|number} 转换后的值
   */
  formatTagValue: (value, group) => {
    return CONFIG.NUMBER_GROUPS.includes(group) ? Number(value) : value;
  },

  /**
   * 校验筛选方案格式
   * @param {any} item - 要校验的方案对象
   * @returns {boolean} 是否合法
   */
  validateFilterItem: (item) => {
    return item && 
      typeof item === 'object' && 
      typeof item.name === 'string' && 
      item.selected && typeof item.selected === 'object' &&
      Array.isArray(item.excluded);
  },

  /**
   * 按期望分组记录
   * @param {Array} records - 记录数组
   * @returns {Array} 分组后的数组
   */
  groupRecordsByExpect: (records) => {
    const groups = new Map();
    for (const record of records) {
      const expect = record.expect;
      if (!groups.has(expect)) {
        groups.set(expect, { expect: expect, records: [] });
      }
      groups.get(expect).records.push(record);
    }
    return Array.from(groups.values());
  },

  /**
   * 格式化日期显示
   * @param {Date} date - 日期对象
   * @returns {string} 格式化后的日期字符串
   */
  formatDate: (date) => {
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return '今天 ' + date.toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'});
    } else if (days === 1) {
      return '昨天 ' + date.toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'});
    } else if (days < 7) {
      return days + '天前';
    } else {
      return date.toLocaleDateString('zh-CN', {month: 'numeric', day: 'numeric'});
    }
  },

  getHotNumbers: (data, targetCount, fullNumZodiacMap) => {
    const coreZodiacs = data.sortedZodiacs 
      ? data.sortedZodiacs.slice(0, 4).map(i => i[0])
      : data.topZod.slice(0, 2).map(i => i[0]);

    const hotTails = data.topTail.slice(0, 3).map(i => i.t);

    const candidateNums = [];
    for(let num = 1; num <= 49; num++) {
      const zod = fullNumZodiacMap.get(num);
      const tail = num % 10;
      if(coreZodiacs.includes(zod) && hotTails.includes(tail)) {
        const miss = data.zodMiss[zod] || 0;
        const count = data.zodCount[zod] || 0;
        const zodScore = data.zodiacScores && data.zodiacScores[zod] ? data.zodiacScores[zod] : 0;
        candidateNums.push({ num, weight: count * 10 + (10 - miss) + zodScore * 2 });
      }
    }

    candidateNums.sort((a, b) => b.weight - a.weight);
    return candidateNums.slice(0, targetCount).map(i => i.num);
  },

  getColdReboundNumbers: (data, targetCount, fullNumZodiacMap) => {
    const coldZodiacs = Object.entries(data.zodMiss || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(i => i[0]);

    const warmTails = data.topTail.slice(0, 3).map(i => i.t);

    const candidateNums = [];
    for(let num = 1; num <= 49; num++) {
      const zod = fullNumZodiacMap.get(num);
      const tail = num % 10;
      if(coldZodiacs.includes(zod)) {
        const miss = data.zodMiss[zod] || 0;
        candidateNums.push({ num, weight: miss * 2 - (warmTails.includes(tail) ? 5 : 0) });
      }
    }

    candidateNums.sort((a, b) => b.weight - a.weight);
    return candidateNums.slice(0, targetCount).map(i => i.num);
  },

  decideAutoMode: (data) => {
    const hotCount = Object.values(data.zodCount || {}).filter(v => v > 0).length;
    const coldCount = Object.entries(data.zodMiss || {})
      .filter(([_, miss]) => miss > 20).length;
    
    return coldCount > hotCount ? 'cold' : 'hot';
  },

  memoize: (fn) => {
    const cache = new Map();
    return (...args) => {
      const key = JSON.stringify(args);
      if (cache.has(key)) {
        return cache.get(key);
      }
      const result = fn(...args);
      cache.set(key, result);
      return result;
    };
  },

  createFullNumZodiacMap: () => {
    const map = new Map();
    for (let num = 1; num <= 49; num++) {
      const zodiac = DataQuery._getZodiacByNum(num);
      map.set(num, zodiac);
    }
    return map;
  },

  quickShuffle: (array) => {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  },

  uniqueArray: (array, key) => {
    const seen = new Set();
    return array.filter(item => {
      const k = key ? item[key] : item;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  },

  getNumColor: (num) => {
    if (CONFIG.COLOR_MAP['红'].includes(num)) return 'red';
    if (CONFIG.COLOR_MAP['蓝'].includes(num)) return 'blue';
    if (CONFIG.COLOR_MAP['绿'].includes(num)) return 'green';
    return 'red';
  },

  getNumElement: (num) => {
    if (CONFIG.ELEMENT_MAP['金'].includes(num)) return '金';
    if (CONFIG.ELEMENT_MAP['木'].includes(num)) return '木';
    if (CONFIG.ELEMENT_MAP['水'].includes(num)) return '水';
    if (CONFIG.ELEMENT_MAP['火'].includes(num)) return '火';
    if (CONFIG.ELEMENT_MAP['土'].includes(num)) return '土';
    return '';
  }
};

const Logger = {
  debug: (...args) => { console.log('[DEBUG]', ...args); },
  info: (...args) => { console.log('[INFO]', ...args); },
  warn: (...args) => { console.warn('[WARN]', ...args); },
  error: (...args) => { console.error('[ERROR]', ...args); }
};

