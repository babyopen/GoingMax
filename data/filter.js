/**
 * 筛选逻辑模块
 */
const Filter = {
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

      return numList.filter(item => {
        if (targetExcluded.includes(item.num)) return false;
        const killedGroups = [
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
        ];
        for (const { key, itemKey } of killedGroups) {
          if (state[key] && state[key].length > 0) {
            if (state[key].includes(item[itemKey])) return false;
          }
        }

        for (const group in targetSelected) {
          if (!targetSelected[group].length) continue;

          let match = false;

          for (const tagValue of targetSelected[group]) {
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
      console.error('筛选失败', e);
      return [];
    }
  },

  selectAllFilters: Utils.debounce(() => {
    const state = StateManager._state;
    Object.keys(state.selected).forEach(group => Business.selectGroup(group));
    const killedKeys = ['killedZodiac','killedColor','killedColorsx','killedType','killedElement','killedHead','killedTail','killedSum','killedBs','killedSumOdd','killedSumBig','killedTailBig'];
    const clearState = {};
    killedKeys.forEach(key => { clearState[key] = []; });
    StateManager.setState(clearState);
    Toast.show('已全选所有筛选条件');
  }, CONFIG.CLICK_DEBOUNCE_DELAY),

  clearAllFilters: Utils.debounce(() => {
    const state = StateManager._state;
    Object.keys(state.selected).forEach(group => StateManager.resetGroup(group));
    const killedKeys = ['killedZodiac','killedColor','killedColorsx','killedType','killedElement','killedHead','killedTail','killedSum','killedBs','killedSumOdd','killedSumBig','killedTailBig'];
    const clearState = {
      excluded: [],
      excludeHistory: [],
      lockExclude: false
    };
    killedKeys.forEach(key => { clearState[key] = []; });
    StateManager.setState(clearState);
    DOM.lockExclude.checked = false;
    Toast.show('已清除所有筛选与排除条件');
  }, CONFIG.CLICK_DEBOUNCE_DELAY)
};
