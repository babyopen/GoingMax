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
    Toast.show('已全选所有筛选条件');
  }, CONFIG.CLICK_DEBOUNCE_DELAY),

  clearAllFilters: Utils.debounce(() => {
    const state = StateManager._state;
    Object.keys(state.selected).forEach(group => StateManager.resetGroup(group));
    StateManager.setState({
      excluded: [],
      excludeHistory: [],
      lockExclude: false
    });
    DOM.lockExclude.checked = false;
    Toast.show('已清除所有筛选与排除条件');
  }, CONFIG.CLICK_DEBOUNCE_DELAY)
};
