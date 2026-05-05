/**
 * 排除号码业务模块
 * @description 处理号码排除、反选、撤销、批量排除等功能
 */
const BusinessExclude = {
  GROUP_VALUES_MAP: {
    zodiac: CONFIG.ANALYSIS.ZODIAC_ALL,
    color: ['红', '蓝', '绿'],
    colorsx: ['红单', '红双', '蓝单', '蓝双', '绿单', '绿双'],
    type: ['家禽', '野兽'],
    element: ['金', '木', '水', '火', '土'],
    head: [0, 1, 2, 3, 4],
    tail: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    sum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    bs: ['大单', '小单', '大双', '小双'],
    sumOdd: ['合单', '合双'],
    sumBig: ['合大', '合小'],
    tailBig: ['尾大', '尾小'],
    hot: ['热号', '温号', '冷号']
  },

  toggleExclude: (num) => {
    const state = StateManager._state;
    if(state.lockExclude) return null;

    const newExcluded = [...state.excluded];
    const newHistory = [...state.excludeHistory];

    if(newExcluded.includes(num)){
      newHistory.push([num, 'out']);
      const index = newExcluded.indexOf(num);
      newExcluded.splice(index, 1);
    } else {
      newHistory.push([num, 'in']);
      newExcluded.push(num);
    }

    StateManager.setState({ excluded: newExcluded, excludeHistory: newHistory });
    return { excluded: newExcluded.length };
  },

  invertExclude: () => {
    const state = StateManager._state;
    if(state.lockExclude) return null;

    const allNums = Array.from({length: 49}, (_, i) => i + 1);
    const newExcluded = [];
    const newHistory = [...state.excludeHistory];

    allNums.forEach(num => {
      const isCurrentlyExcluded = state.excluded.includes(num);
      if(!isCurrentlyExcluded){
        newExcluded.push(num);
        newHistory.push([num, 'in']);
      } else {
        newHistory.push([num, 'out']);
      }
    });

    StateManager.setState({ excluded: newExcluded, excludeHistory: newHistory });
    return { excluded: newExcluded.length };
  },

  undoExclude: () => {
    const state = StateManager._state;
    if(state.lockExclude || !state.excludeHistory.length) return null;

    const newHistory = [...state.excludeHistory];
    const [num, act] = newHistory.pop();
    const newExcluded = [...state.excluded];

    act === 'in' 
      ? newExcluded.splice(newExcluded.indexOf(num), 1)
      : newExcluded.push(num);

    StateManager.setState({ excluded: newExcluded, excludeHistory: newHistory });
    return { success: true };
  },

  clearExclude: () => {
    const state = StateManager._state;
    if(state.lockExclude) return null;
    StateManager.setState({ excluded: [], excludeHistory: [] });
    return { success: true };
  },

  batchExcludePrompt: () => {
    return { prompt: true };
  },

  doBatchExclude: (input) => {
    if(!input) return { success: false, error: 'empty' };

    const nums = input.split(/[\s,，]+/).map(Number).filter(num => num >=1 && num <=49);
    if(nums.length === 0) {
      return { success: false, error: 'invalid' };
    }

    const state = StateManager._state;
    const newExcluded = [...state.excluded];
    const newHistory = [...state.excludeHistory];
    let addCount = 0;

    nums.forEach(num => {
      if(!newExcluded.includes(num)){
        newExcluded.push(num);
        newHistory.push([num, 'in']);
        addCount++;
      }
    });

    StateManager.setState({ excluded: newExcluded, excludeHistory: newHistory });
    return { success: true, count: addCount };
  },

  toggleExcludeLock: (isLocked) => {
    StateManager.setState({ lockExclude: isLocked }, false);
    return { locked: isLocked };
  },

  getAllValuesForGroup: (group) => {
    return BusinessExclude.GROUP_VALUES_MAP[group] || [];
  },

  _getKilledKey: (group) => {
    return 'killed' + group.charAt(0).toUpperCase() + group.slice(1);
  },

  GROUP_NAME_MAP: {
    color: '波色',
    colorsx: '波色单双',
    type: '家禽野兽',
    element: '五行',
    head: '头数',
    tail: '尾数',
    sum: '尾合',
    zodiac: '生肖',
    bs: '大小单双'
  },

  getGroupName: (group) => {
    return BusinessExclude.GROUP_NAME_MAP[group] || group;
  },

  selectGroup: (group) => {
    const allValues = BusinessExclude.getAllValuesForGroup(group);
    const newSelected = { ...StateManager._state.selected };
    newSelected[group] = allValues;
    StateManager.setState({ selected: newSelected });
    return { group, selected: allValues.length };
  },

  invertGroup: (group) => {
    const state = StateManager._state;
    const allValues = BusinessExclude.getAllValuesForGroup(group);
    const newSelected = { ...state.selected };
    newSelected[group] = allValues.filter(v => !state.selected[group].includes(v));
    StateManager.setState({ selected: newSelected });
    return { group, selected: newSelected[group].length };
  },

  killGroup: (group) => {
    const state = StateManager._state;
    const selectedValues = state.selected[group] || [];
    const killedKey = BusinessExclude._getKilledKey(group);
    const killedValues = state[killedKey] || [];

    if (killedValues.length > 0) {
      const clearState = {};
      clearState[killedKey] = [];
      StateManager.setState(clearState);
      return { success: true, action: 'unlocked' };
    }

    if (selectedValues.length === 0) return { success: false, error: 'empty' };

    const setState = {};
    setState[killedKey] = [...selectedValues];
    StateManager.setState(setState);
    return { success: true, action: 'locked', killed: selectedValues, group };
  },

  killGroupBs: () => {
    const state = StateManager._state;
    const allGroups = ['bs', 'sumOdd', 'sumBig', 'tailBig'];

    const anyKilled = allGroups.some(g => (state[BusinessExclude._getKilledKey(g)] || []).length > 0);

    if (anyKilled) {
      const clearState = {};
      allGroups.forEach(g => {
        clearState[BusinessExclude._getKilledKey(g)] = [];
      });
      StateManager.setState(clearState);
      return { success: true, action: 'unlocked' };
    }

    let hasAnySelected = false;
    allGroups.forEach(g => {
      if ((state.selected[g] || []).length > 0) hasAnySelected = true;
    });

    if (!hasAnySelected) return { success: false, error: 'empty' };

    const setState = {};
    allGroups.forEach(g => {
      const key = BusinessExclude._getKilledKey(g);
      setState[key] = [...(state.selected[g] || [])];
    });
    StateManager.setState(setState);
    return { success: true, action: 'locked', group: 'bs' };
  },

  killZodiac: () => BusinessExclude.killGroup('zodiac'),

  clearKillZodiac: () => {
    StateManager.setState({ killedZodiac: [] });
    return { success: true };
  }
};
