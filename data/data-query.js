/**
 * 数据查询模块
 * @description 打通生肖、五行、波色、家禽野兽、大小单双等所有关联关系
 */
const DataQuery = {
  _numToAttrMap: null,
  _attrToNumMap: null,
  _colorLookup: null,
  _elementLookup: null,
  _colorNameLookup: null,
  _fullNumAttrCache: null,

  init: () => {
    if(DataQuery._numToAttrMap && DataQuery._attrToNumMap) {
      return;
    }
    
    DataQuery._initLookups();
    
    DataQuery._numToAttrMap = {};
    DataQuery._attrToNumMap = {
      zodiac: {},
      color: {},
      element: {},
      type: {},
      head: {},
      tail: {},
      sum: {},
      bs: {},
      colorsx: {}
    };
    
    for(let num = 1; num <= 49; num++) {
      const attrs = DataQuery.getNumAttrs(num);
      DataQuery._numToAttrMap[num] = attrs;
      
      Object.keys(attrs).forEach(key => {
        if(DataQuery._attrToNumMap[key]) {
          if(!DataQuery._attrToNumMap[key][attrs[key]]) {
            DataQuery._attrToNumMap[key][attrs[key]] = [];
          }
          DataQuery._attrToNumMap[key][attrs[key]].push(num);
        }
      });
    }
  },

  _initLookups: () => {
    DataQuery._colorLookup = new Map();
    DataQuery._colorNameLookup = new Map();
    Object.entries(CONFIG.COLOR_MAP).forEach(([colorName, nums]) => {
      const cssColor = { '红': 'red', '蓝': 'blue', '绿': 'green' }[colorName] || 'red';
      nums.forEach(num => {
        DataQuery._colorLookup.set(num, cssColor);
        DataQuery._colorNameLookup.set(num, colorName);
      });
    });

    DataQuery._elementLookup = new Map();
    Object.entries(CONFIG.ELEMENT_MAP).forEach(([elementName, nums]) => {
      nums.forEach(num => {
        DataQuery._elementLookup.set(num, elementName);
      });
    });

    DataQuery._fullNumAttrCache = new Map();
    for(let num = 1; num <= 49; num++) {
      const s = num.toString().padStart(2, '0');
      const head = Math.floor(num / 10);
      const tail = num % 10;
      const sum = head + tail;
      const big = num >= 25 ? '大' : '小';
      const odd = num % 2 === 1 ? '单' : '双';
      const bs = big + odd;
      
      const color = DataQuery._colorNameLookup.get(num) || '红';
      const element = DataQuery._elementLookup.get(num) || '金';
      
      DataQuery._fullNumAttrCache.set(num, {
        num, s, color, element,
        head, tail, sum, big, odd, bs,
        colorsx: color + odd
      });
    }
  },

  getNumAttrs: (num) => {
    num = Number(num);
    const cached = DataQuery._fullNumAttrCache.get(num);
    if(cached) {
      const zodiac = DataQuery._getZodiacByNum(num);
      const type = CONFIG.JIAQIN.includes(zodiac) ? '家禽' : '野兽';
      return {
        ...cached,
        zodiac,
        type
      };
    }
    
    const s = num.toString().padStart(2, '0');
    const head = Math.floor(num / 10);
    const tail = num % 10;
    const sum = head + tail;
    const big = num >= 25 ? '大' : '小';
    const odd = num % 2 === 1 ? '单' : '双';
    const bs = big + odd;
    
    const color = Object.keys(CONFIG.COLOR_MAP).find(c => CONFIG.COLOR_MAP[c].includes(num));
    const element = Object.keys(CONFIG.ELEMENT_MAP).find(e => CONFIG.ELEMENT_MAP[e].includes(num));
    
    const zodiac = DataQuery._getZodiacByNum(num);
    const type = CONFIG.JIAQIN.includes(zodiac) ? '家禽' : '野兽';
    
    return {
      num, s, color, element, zodiac, type,
      head, tail, sum, big, odd, bs,
      colorsx: color + odd
    };
  },

  _getZodiacByNum: (num) => {
    const state = StateManager._state;
    if(state.zodiacCycle && state.zodiacCycle.length === 12) {
      return state.zodiacCycle[(num - 1) % 12];
    }
    const fallbackCycle = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
    return fallbackCycle[(num - 1) % 12];
  },

  getNumsByAttr: (attrType, attrValue) => {
    DataQuery.init();
    if(!DataQuery._attrToNumMap[attrType]) {
      return [];
    }
    return DataQuery._attrToNumMap[attrType][attrValue] || [];
  },

  getNumsByConditions: (conditions) => {
    DataQuery.init();
    let result = Array.from({length: 49}, (_, i) => i + 1);
    
    Object.keys(conditions).forEach(attrType => {
      const attrValue = conditions[attrType];
      const nums = DataQuery.getNumsByAttr(attrType, attrValue);
      result = result.filter(n => nums.includes(n));
    });
    
    return result;
  },

  checkNumAttr: (num, attrType, attrValue) => {
    const attrs = DataQuery.getNumAttrs(num);
    return attrs[attrType] === attrValue;
  },

  getCommonAttrs: (num1, num2) => {
    const attrs1 = DataQuery.getNumAttrs(num1);
    const attrs2 = DataQuery.getNumAttrs(num2);
    const common = [];
    
    ['zodiac', 'color', 'element', 'type', 'big', 'odd', 'bs', 'colorsx'].forEach(key => {
      if(attrs1[key] === attrs2[key]) {
        common.push(key);
      }
    });
    
    return common;
  },

  buildNumList: () => {
    try {
      const list = [];
      for(let i = 1; i <= 49; i++) {
        const attrs = DataQuery.getNumAttrs(i);
        list.push({
          num: attrs.num,
          s: attrs.s,
          color: attrs.color,
          zodiac: attrs.zodiac,
          element: attrs.element,
          type: attrs.type,
          bs: attrs.bs,
          colorsx: attrs.colorsx,
          head: attrs.head,
          tail: attrs.tail,
          sum: attrs.sum,
          odd: attrs.odd,
          big: attrs.big,
          hot: '温号',
          sumOdd: '合' + attrs.odd,
          sumBig: '合' + attrs.big,
          tailBig: '尾' + (attrs.tail < 5 ? '小' : '大')
        });
      }
      StateManager.setState({ numList: list }, false);
      return list;
    } catch(e) {
      Logger.error('生成号码列表失败', e);
      Toast.show('数据初始化失败，请刷新重试');
      return [];
    }
  },

  buildZodiacCycle: () => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const thisYearSpring = new Date(CONFIG.SPRING_FESTIVAL[year]);
      const zodiacYear = now < thisYearSpring ? year - 1 : year;
      const branchIndex = (zodiacYear - 4) % 12;
      const currentBranch = CONFIG.EARTHLY_BRANCHES[branchIndex];
      const currentZodiac = CONFIG.ZODIAC_BASE[currentBranch];
      
      const currentIndex = CONFIG.EARTHLY_BRANCHES.indexOf(currentBranch);
      const cycleBranches = [];
      for(let i=0; i<12; i++){
        const index = (currentIndex - i + 12) % 12;
        cycleBranches.push(CONFIG.EARTHLY_BRANCHES[index]);
      }
      const zodiacCycle = cycleBranches.map(branch => CONFIG.ZODIAC_BASE[branch]);

      StateManager.setState({ currentZodiac, zodiacCycle }, false);
      
      DataQuery._numToAttrMap = null;
      DataQuery._attrToNumMap = null;
      DataQuery.init();
      
      return { currentZodiac, zodiacCycle };
    } catch(e) {
      Logger.error('生成生肖循环失败', e);
      Toast.show('生肖数据初始化失败');
      const fallbackCycle = ['马','蛇','龙','兔','虎','牛','鼠','猪','狗','鸡','猴','羊'];
      StateManager.setState({ currentZodiac: '马', zodiacCycle: fallbackCycle }, false);
      
      DataQuery._numToAttrMap = null;
      DataQuery._attrToNumMap = null;
      DataQuery.init();
      
      return { currentZodiac: '马', zodiacCycle: fallbackCycle };
    }
  },

  getColor: (n) => {
    return DataQuery._colorLookup.get(n) || 'red';
  },
  
  getColorName: (n) => {
    return DataQuery._colorNameLookup.get(n) || '红';
  },
  
  _specialCache: new Map(),
  _specialCacheVersion: 0,

  invalidateSpecialCache: () => {
    DataQuery._specialCacheVersion++;
    if(DataQuery._specialCache.size > 1000) {
      DataQuery._specialCache.clear();
    }
  },

  getSpecial: (item) => {
    if(!item || !item.expect) return null;

    const cacheKey = item.expect;
    const currentVersion = DataQuery._specialCacheVersion;
    
    const cached = DataQuery._specialCache.get(cacheKey);
    if(cached && cached.version === currentVersion) {
      return cached.result;
    }

    const codeArr = (item.openCode || '0,0,0,0,0,0,0').split(',');
    const zodArrRaw = (item.zodiac || ',,,,,,,,,,,,').split(',');
    const zodArr = zodArrRaw.map(z => CONFIG.ANALYSIS.ZODIAC_TRAD_TO_SIMP[z] || z);
    const te = Math.max(0, Number(codeArr[6]));
    
    const result = {
      te,
      tail: te % 10,
      head: Math.floor(te / 10),
      wave: DataQuery.getColor(te),
      colorName: DataQuery.getColorName(te),
      zod: zodArr[6] || '-',
      odd: te % 2 === 1,
      big: te >= 25,
      animal: CONFIG.ANALYSIS.HOME_ZODIAC.includes(zodArr[6]) ? '家禽' : '野兽',
      wuxing: DataQuery.getWuxing(te),
      fullZodArr: zodArr
    };

    DataQuery._specialCache.set(cacheKey, { result, version: currentVersion });
    return result;
  },

  getWuxing: (n) => {
    return DataQuery._elementLookup.get(n) || '金';
  },

  getZodiacLevel: (count, miss, total) => {
    const avgCount = total / 12;
    if(count >= avgCount * 1.5 && miss <= 3) return { cls: 'hot', text: '热' };
    if(count <= avgCount * 0.5 || miss >= 8) return { cls: 'cold', text: '冷' };
    return { cls: 'warm', text: '温' };
  },

  getTopHot: (arr, limit = 2) => {
    return arr.sort((a, b) => b[1] - a[1]).slice(0, limit).map(i => i[0]).join(' / ');
  },

  getZodiacNumbers: (zodiac) => {
    DataQuery.init();
    return DataQuery._attrToNumMap.zodiac[zodiac] || [];
  },

  calculateZodiacAppearDetail: (zodiac) => {
    const state = StateManager._state;
    const historyData = state.analysis.historyData;
    
    const appearRecords = [];
    if(historyData && historyData.length > 0) {
      for(let i = 0; i < historyData.length; i++) {
        const item = historyData[i];
        const s = DataQuery.getSpecial(item);
        if(s.zod === zodiac) {
          appearRecords.push({
            expect: item.expect,
            num: s.te,
            zodiac: s.zod,
            index: i
          });
        }
      }
    }

    let intervalStats = null;
    if(appearRecords.length > 1) {
      const intervals = [];
      for(let i = 0; i < appearRecords.length - 1; i++) {
        intervals.push(appearRecords[i].index - appearRecords[i + 1].index);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const maxInterval = Math.max(...intervals);
      const minInterval = Math.min(...intervals);
      intervalStats = { avgInterval, maxInterval, minInterval };
    }

    return { appearRecords, intervalStats };
  }
};
