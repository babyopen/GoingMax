/**
 * 筛选逻辑模块
 */
const Filter = {
  KILLED_MAPPING: [
    { key: 'killedZodiac', itemKey: 'zodiac' },
    { key: 'killedColor', itemKey: 'color' },
    { key: 'killedColorsx', itemKey: 'colorsx' },
    { key: 'killedType', itemKey: 'type' },
    { key: 'killedElement', itemKey: 'element' },
    { key: 'killedHead', itemKey: 'head' },
    { key: 'killedTail', itemKey: 'tail' },
    { key: 'killedSum', itemKey: 'sum' },
    { key: 'killedBs', itemKey: 'bs' },
    { key: 'killedSumOdd', itemKey: 'sumOdd' },
    { key: 'killedSumBig', itemKey: 'sumBig' },
    { key: 'killedTailBig', itemKey: 'tailBig' }
  ],

  getFilterGroups: () => {
    return Filter.KILLED_MAPPING.map(m => m.itemKey);
  },

  parseSumValue: (tagValue) => {
    return parseInt(tagValue);
  },

  parseTailValue: (tagValue) => {
    if (tagValue === '尾大') return 5;
    if (tagValue === '尾小') return 0;
    return parseInt(tagValue);
  },

  matchFilterValue: (item, group, tagValue) => {
    if (group === 'sum') {
      const itemValue = item.sum;
      const tagValueNum = Filter.parseSumValue(tagValue);
      return itemValue === tagValueNum;
    }

    if (group === 'tail') {
      if (tagValue === '尾大' || tagValue === '尾小') {
        return Filter.parseTailValue(tagValue) <= item.tail;
      }
      return item[group] === parseInt(tagValue);
    }

    return item[group] === tagValue;
  },

  getFilteredList: (selected = null, excluded = null) => {
    try {
      const state = StateManager._state;
      const targetSelected = selected || state.selected;
      const targetExcluded = excluded || state.excluded;
      const numList = state.numList;

      const killedCache = Filter.KILLED_MAPPING.map(({ key, itemKey }) => ({
        list: state[key],
        itemKey
      }));

      return numList.filter(item => {
        if (targetExcluded.includes(item.num)) return false;

        for (const { list, itemKey } of killedCache) {
          if (list && list.length > 0 && list.includes(item[itemKey])) {
            return false;
          }
        }

        for (const group in targetSelected) {
          const groupValues = targetSelected[group];
          if (!groupValues.length) continue;

          let match = false;
          for (const tagValue of groupValues) {
            if (Filter.matchFilterValue(item, group, tagValue)) {
              match = true;
              break;
            }
          }

          if (!match) return false;
        }
        return true;
      });
    } catch (e) {
      Logger.error('筛选失败', e);
      return [];
    }
  },

  selectAllFilters: Utils.debounce(() => {
    const batchUpdate = {
      selected: {}
    };
    Filter.getFilterGroups().forEach(group => {
      batchUpdate.selected[group] = BusinessExclude.getAllValuesForGroup(group);
    });
    const killedKeys = Filter.KILLED_MAPPING.map(m => m.key);
    killedKeys.forEach(key => { batchUpdate[key] = []; });
    StateManager.setState(batchUpdate, true);
    Toast.show('已全选所有筛选条件');
  }, CONFIG.CLICK_DEBOUNCE_DELAY),

  clearAllFilters: Utils.debounce(() => {
    const state = StateManager._state;
    const batchUpdate = {
      selected: {}
    };
    Object.keys(state.selected).forEach(group => {
      batchUpdate.selected[group] = [];
    });
    const killedKeys = Filter.KILLED_MAPPING.map(m => m.key);
    killedKeys.forEach(key => { batchUpdate[key] = []; });
    Object.assign(batchUpdate, {
      excluded: [],
      excludeHistory: [],
      lockExclude: false
    });
    StateManager.setState(batchUpdate, true);
    DOM.lockExclude.checked = false;
    Toast.show('已清除所有筛选与排除条件');
  }, CONFIG.CLICK_DEBOUNCE_DELAY)
};
