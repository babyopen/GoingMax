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
    killedZodiac: [],
    killedColor: [],
    killedColorsx: [],
    killedType: [],
    killedElement: [],
    killedHead: [],
    killedTail: [],
    killedSum: [],
    killedBs: [],
    killedSumOdd: [],
    killedSumBig: [],
    killedTailBig: [],
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
    tagMarks: [],
    analysis: {
      historyData: [],
      analyzeLimit: 30,
      selectedNumCount: 5,
      showCount: 20,
      currentTab: 'history',
      autoRefreshTimer: null
    }
  },

  KILLED_KEYS: ['killedZodiac','killedColor','killedColorsx','killedType','killedElement','killedHead','killedTail','killedSum','killedBs','killedSumOdd','killedSumBig','killedTailBig'],

  getState: () => Utils.deepClone(StateManager._state),

  setState: (partialState, needRender = true) => {
    try {
      StateManager._state = {
        ...StateManager._state,
        ...partialState
      };
      
      if (needRender) {
        StateManager.triggerRender(partialState);
      }
    } catch (e) {
      Logger.error('状态更新失败', e);
    }
  },

  triggerRender: (partialState) => {
    const keys = Object.keys(partialState);
    const needResultRender = keys.some(key => 
      key === 'selected' || 
      key === 'excluded' || 
      StateManager.KILLED_KEYS.includes(key)
    );

    if (partialState.selected) {
      FilterView.renderTagStatus();
    }

    if (needResultRender) {
      FilterView.renderResult();
    }

    if (partialState.excluded !== undefined) {
      ExcludeView.renderExcludeGrid();
    }

    if (partialState.savedFilters) {
      SavedView.renderFilterList();
    }

    if (partialState.showAllFilters !== undefined) {
      SavedView.renderFilterList();
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

  getHistoryDataSimple: () => {
    const hd = StateManager._state.analysis.historyData;
    return hd && hd.length > 0 ? hd : null;
  },

  _renderQueue: null,
  _renderTimer: null,

  batchRender: (partialState) => {
    if (!StateManager._renderQueue) {
      StateManager._renderQueue = {};
    }
    Object.assign(StateManager._renderQueue, partialState);

    if (!StateManager._renderTimer) {
      StateManager._renderTimer = setTimeout(() => {
        StateManager.triggerRender(StateManager._renderQueue);
        StateManager._renderQueue = null;
        StateManager._renderTimer = null;
      }, 16);
    }
  },

  setStateBatch: (partialState) => {
    try {
      StateManager._state = { ...StateManager._state, ...partialState };
      StateManager.batchRender(partialState);
    } catch (e) {
      Logger.error('批量状态更新失败', e);
    }
  }
};
