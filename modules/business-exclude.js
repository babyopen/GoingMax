/**
 * 排除号码业务模块
 * @description 处理号码排除、反选、撤销、批量排除等功能
 */
const BusinessExclude = {
  toggleExclude: (num) => {
    const state = StateManager._state;
    if(state.lockExclude) return;

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
  },

  invertExclude: () => {
    const state = StateManager._state;
    if(state.lockExclude) return;

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
    Toast.show(`已反选，当前排除 ${newExcluded.length} 个号码`);
  },

  undoExclude: () => {
    const state = StateManager._state;
    if(state.lockExclude || !state.excludeHistory.length) return;

    const newHistory = [...state.excludeHistory];
    const [num, act] = newHistory.pop();
    const newExcluded = [...state.excluded];

    act === 'in' 
      ? newExcluded.splice(newExcluded.indexOf(num), 1)
      : newExcluded.push(num);

    StateManager.setState({ excluded: newExcluded, excludeHistory: newHistory });
  },

  clearExclude: () => {
    const state = StateManager._state;
    if(state.lockExclude) return;
    StateManager.setState({ excluded: [], excludeHistory: [] });
    Toast.show('已清空所有排除号码');
  },

  batchExcludePrompt: () => {
    const state = StateManager._state;
    if(state.lockExclude) return;

    InputModal.show({
      title: '批量排除号码',
      defaultValue: '',
      placeholder: '输入号码，空格/逗号分隔，如：1,2,3,4,5',
      onConfirm: (input) => {
        if(!input) return;

        const nums = input.split(/[\s,，]+/).map(Number).filter(num => num >=1 && num <=49);
        if(nums.length === 0) {
          Toast.show('请输入有效的号码');
          return;
        }

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
        Toast.show(addCount > 0 ? `已添加${addCount}个排除号码` : '号码已在排除列表中');
      }
    });
  },

  toggleExcludeLock: (isLocked) => {
    StateManager.setState({ lockExclude: isLocked }, false);
    Toast.show(isLocked ? '已锁定排除号码' : '已解锁排除号码');
  },

  getAllValuesForGroup: (group) => {
    const groupValuesMap = {
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
    };

    return groupValuesMap[group] || [];
  },

  selectGroup: (group) => {
    const allValues = BusinessExclude.getAllValuesForGroup(group);
    const newSelected = { ...StateManager._state.selected };
    newSelected[group] = allValues;
    StateManager.setState({ selected: newSelected });
  },

  invertGroup: (group) => {
    const state = StateManager._state;
    const allValues = BusinessExclude.getAllValuesForGroup(group);
    const newSelected = { ...state.selected };
    newSelected[group] = allValues.filter(v => !state.selected[group].includes(v));
    StateManager.setState({ selected: newSelected });
  }
};
