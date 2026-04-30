/**
 * 数据查询模块
 * @description 打通生肖、五行、波色、家禽野兽、大小单双等所有关联关系
 */
const DataQuery = {
  _numToAttrMap: null,
  _attrToNumMap: null,

  init: () => {
    if(DataQuery._numToAttrMap && DataQuery._attrToNumMap) {
      return;
    }
    
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

  getNumAttrs: (num) => {
    num = Number(num);
    const s = num.toString().padStart(2, '0');
    const head = Math.floor(num / 10);
    const tail = num % 10;
    const sum = head + tail;
    const big = num >= 25 ? '大' : '小';
    const odd = num % 2 === 1 ? '单' : '双';
    const bs = big + odd;
    
    const color = Object.keys(CONFIG.COLOR_MAP).find(c => CONFIG.COLOR_MAP[c].includes(num));
    const element = Object.keys(CONFIG.ELEMENT_MAP).find(e => CONFIG.ELEMENT_MAP[e].includes(num));
    
    const type = CONFIG.JIAQIN.includes(DataQuery._getZodiacByNum(num)) ? '家禽' : '野兽';
    
    return {
      num,
      s,
      color,
      element,
      zodiac: DataQuery._getZodiacByNum(num),
      type,
      head,
      tail,
      sum,
      big,
      odd,
      bs,
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
  }
};
