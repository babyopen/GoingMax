/**
 * 状态管理模块
 */
const StateManager = {
  _state: {
    selected: {
      zodiac: [], color: [], colorsx: [], type: [], element: [],
      head: [], tail: [], sum: [], bs: [], hot: [],
      sumOdd: [], sumBig: [], tailBig: []
    },
    excluded: [],
    excludeHistory: [],
    lockExclude: false,
    savedFilters: [],
    favorites: [],
    showAllFilters: false,
    numList: [],
    currentZodiac: '',
    zodiacCycle: [],
    scrollTimer: null,
    specialHistory: [],
    specialHistoryModeFilter: 'all',
    specialHistoryExpanded: false,
    analysis: {
      historyData: [],
      analyzeLimit: 30,
      selectedNumCount: 5,
      showCount: 20,
      currentTab: 'history',
      autoRefreshTimer: null,
      specialMode: 'hot'
    }
  },

  getState: () => Utils.deepClone(StateManager._state),

  setState: (partialState, needRender = true) => {
    try {
      StateManager._state = {
        ...StateManager._state,
        ...partialState
      };
      if (needRender) FilterView.renderAll();
    } catch (e) {
      console.error('状态更新失败', e);
      Toast.show('操作失败，请刷新重试');
    }
  },

  updateSelected: (group, value) => {
    const state = StateManager._state;
    const index = state.selected[group].indexOf(value);
    const newSelected = { ...state.selected };

    index > -1
      ? newSelected[group] = newSelected[group].filter(item => item !== value)
      : newSelected[group] = [...newSelected[group], value];

    StateManager.setState({ selected: newSelected });
  },

  resetGroup: (group) => {
    const newSelected = { ...StateManager._state.selected };
    newSelected[group] = [];
    StateManager.setState({ selected: newSelected });
  },

  getEmptySelected: () => ({
    zodiac: [], color: [], colorsx: [], type: [], element: [],
    head: [], tail: [], sum: [], bs: [], hot: [],
    sumOdd: [], sumBig: [], tailBig: []
  }),

  selectGroup: (group) => {
    const allTags = [...document.querySelectorAll(`.tag[data-group="${group}"]`)];
    let allValues = allTags.map(tag => Utils.formatTagValue(tag.dataset.value, group));

    if (group === 'sum' || group === 'head') {
      allValues = allValues.map(v => parseInt(v));
    }

    const newSelected = { ...StateManager._state.selected };
    newSelected[group] = allValues;
    StateManager.setState({ selected: newSelected });
  },

  invertGroup: (group) => {
    const state = StateManager._state;
    const allTags = [...document.querySelectorAll(`.tag[data-group="${group}"]`)];
    let allValues = allTags.map(tag => Utils.formatTagValue(tag.dataset.value, group));

    if (group === 'sum' || group === 'head') {
      allValues = allValues.map(v => parseInt(v));
    }
    const newSelected = { ...state.selected };
    newSelected[group] = allValues.filter(v => !state.selected[group].includes(v));
    StateManager.setState({ selected: newSelected });
  },

  resetGroup: (group) => {
    const newSelected = { ...StateManager._state.selected };
    newSelected[group] = [];
    StateManager.setState({ selected: newSelected });
  },

  clearAllTimers: () => {
    const state = StateManager._state;
    if (state.scrollTimer) clearTimeout(state.scrollTimer);
    Toast.clearTimer();
  }
};
