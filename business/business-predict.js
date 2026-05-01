/**
 * 预测业务模块
 * @description 处理预测相关的业务逻辑，不包含任何 DOM 操作
 */
const BusinessPredict = {
  /**
   * 快速机选（业务逻辑）
   * @param {number} count - 机选数量
   * @returns {Object} 包含机选结果和历史数据
   */
  quickLottery: (count) => {
    const filteredList = Filter.getFilteredList();
    if(filteredList.length === 0) {
      return { success: false, result: [] };
    }

    const result = [];
    const shuffled = [...filteredList].sort(() => Math.random() - 0.5);

    for(let i = 0; i < Math.min(count, shuffled.length); i++) {
      result.push(shuffled[i]);
    }

    const smartHistory = Storage.get('smartHistory', []);
    smartHistory.unshift({
      timestamp: Date.now(),
      count: result.length,
      result: result.map(n => n.s)
    });
    if(smartHistory.length > 50) smartHistory.length = 50;
    Storage.set('smartHistory', smartHistory);

    return { success: true, result };
  },

  /**
   * 排除机选结果（业务逻辑）
   * @param {Array} numbers - 要排除的号码
   * @returns {Object} 操作结果
   */
  excludeLotteryNumbers: (numbers) => {
    if(!numbers || numbers.length === 0) {
      return { success: false, count: 0 };
    }

    const state = StateManager._state;
    const newExcluded = [...state.excluded];
    const newHistory = [...state.excludeHistory];
    let excludedCount = 0;

    numbers.forEach(num => {
      if(!newExcluded.includes(num)) {
        newExcluded.push(num);
        newHistory.push([num, 'in']);
        excludedCount++;
      }
    });

    StateManager.setState({ excluded: newExcluded, excludeHistory: newHistory });

    return { success: true, count: excludedCount };
  },

  /**
   * 切换精选特码历史展开/收起
   */
  toggleSpecialHistory: () => {
    const state = StateManager._state;
    const newExpanded = !(state.specialHistoryExpanded || false);
    StateManager.setState({ specialHistoryExpanded: newExpanded }, false);
  },

  /**
   * 清空精选特码历史
   */
  clearSpecialHistory: () => {
    StateManager.setState({ specialHistory: [] }, false);
    Storage.saveSpecialHistory([]);
  },

  /**
   * 清空机选历史
   */
  clearSmartHistory: () => {
    Storage.set('smartHistory', []);
  },

  /**
   * 切换特码历史模式
   * @param {string} mode - 模式：all|hot|cold
   */
  switchSpecialHistoryMode: (mode) => {
    if(!['all', 'hot', 'cold'].includes(mode)) return;
    StateManager.setState({ specialHistoryModeFilter: mode }, false);
  },

  /**
   * 全选精选特码筛选
   * @returns {Object} 选择状态
   */
  selectAllSpecialFilters: () => {
    return {
      periods: ['10', '20', '30', 'all'],
      nums: ['5', '10', '15', '20']
    };
  },

  /**
   * 重置精选特码筛选
   * @returns {Object} 默认选择
   */
  resetSpecialFilters: () => {
    return {
      period: '10',
      num: '5'
    };
  },

  /**
   * 全选预测期数
   * @returns {Array} 所有期数
   */
  selectAllPredictionPeriods: () => {
    return ['10', '20', '30', 'all'];
  },

  /**
   * 重置预测期数
   * @returns {string} 默认期数
   */
  resetPredictionPeriods: () => {
    return '10';
  }
};
