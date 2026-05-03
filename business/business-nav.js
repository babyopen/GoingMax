/**
 * 导航与定时器业务模块
 * @description 处理页面导航、滚动、倒计时、自动刷新等功能
 */
const BusinessNav = {
  switchBottomNav: (index) => {
    return index;
  },

  initAnalysisPage: () => {
    return true;
  },

  toggleDetail: (targetId) => {
    return { targetId };
  },

  switchAnalysisTab: (tab) => {
    const validTabs = ['history', 'analysis', 'zodiac'];
    if (!validTabs.includes(tab)) return null;
    return tab;
  },

  loadMoreHistory: () => {
    const state = StateManager._state;
    const newShowCount = state.analysis.showCount + 30;
    const newAnalysis = { 
      ...state.analysis, 
      showCount: newShowCount 
    };
    StateManager.setState({ analysis: newAnalysis }, false);
    return newShowCount;
  },

  startCountdown: () => {
    return true;
  },

  isInDrawTime: () => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    return h === 21 && m >= 32 && m <= 40;
  },

  startAutoRefresh: () => {
    const state = StateManager._state;
    if(state.analysis.autoRefreshTimer) clearInterval(state.analysis.autoRefreshTimer);
    
    const newTimer = setInterval(() => {
      if(BusinessNav.isInDrawTime()) {
        BusinessAnalysis.refreshHistory();
      } else {
        clearInterval(state.analysis.autoRefreshTimer);
        const newAnalysis = { 
          ...StateManager._state.analysis, 
          autoRefreshTimer: null 
        };
        StateManager.setState({ analysis: newAnalysis }, false);
      }
    }, 20000);
    
    const newAnalysis = { 
      ...state.analysis, 
      autoRefreshTimer: newTimer 
    };
    StateManager.setState({ analysis: newAnalysis }, false);
    return newTimer;
  },

  checkDrawTimeLoop: () => {
    setInterval(() => {
      if(BusinessNav.isInDrawTime() && !StateManager._state.analysis.autoRefreshTimer) {
        BusinessNav.startAutoRefresh();
      }
    }, 60000);
    return true;
  },

  scrollToModule: (targetId) => {
    return { targetId };
  },

  toggleQuickNav: (isOpen = null) => {
    return { isOpen };
  },

  adjustBottomNavPosition: () => {
    AnalysisView.adjustBottomNavPosition();
  },

  backToTop: () => {
    return true;
  },

  handleScroll: () => {
    AnalysisView.handleScroll();
  },

  handlePageUnload: () => {
    BusinessNav.clearAllTimers();
    return true;
  },

  showZodiacDetail: (zodiac) => {
    return { zodiac };
  },

  showZodiacAppearDetail: (zodiac) => {
    return { zodiac };
  },

  clearAllTimers: () => {
    const state = StateManager._state;
    if (state.scrollTimer) clearTimeout(state.scrollTimer);
    return true;
  },

  _autoRefreshDrawResults: () => {
    try {
      const state = StateManager._state;
      const historyData = state.analysis.historyData || [];
      
      if(historyData.length === 0) return;
      
      const specialHistory = state.specialHistory;
      let updated = false;
      const newHistory = specialHistory.map(item => {
        if(item.drawResult !== null) return item;
        
        if(item.predictExpect) {
          const drawItem = historyData.find(d => d.expect === item.predictExpect);
          
          if(drawItem) {
            const special = DataQuery.getSpecial(drawItem);
            const drawNumber = special.te;
            
            const hitNumbers = item.numbers.filter(n => n === drawNumber);
            
            updated = true;
            return {
              ...item,
              drawResult: drawNumber,
              drawExpect: drawItem.expect,
              hitNumbers: hitNumbers,
              hitCount: hitNumbers.length
            };
          }
        }
        return item;
      });
      
      if(updated) {
        StateManager.setState({ specialHistory: newHistory }, false);
        Storage.saveSpecialHistory(newHistory);
        console.log('自动更新开奖结果完成');
      }
    } catch(e) {
      console.error('自动更新开奖结果失败', e);
    }
  },

  startDrawResultAutoRefresh: () => {
    setInterval(() => {
      BusinessNav._autoRefreshDrawResults();
    }, 5 * 60 * 1000);
    return true;
  },

  refreshHotCold: () => {
    DataQuery.buildNumList();
    return true;
  },

  quickLottery: (count) => {
    return BusinessPredict.quickLottery(count);
  },

  runLottery: () => {
    return true;
  },

  excludeLotteryResult: () => {
    return true;
  },

  clearSmartHistory: () => {
    return true;
  },

  showStatDetail: (statType) => {
    return { statType };
  },

  showStreakDetail: (streakType) => {
    return { streakType };
  },

  toggleRecordDetail: (index) => {
    return { index };
  },

  deleteRecord: (recordId) => {
    return { recordId };
  },

  clearRecordHistory: () => {
    return true;
  },

  refreshRecord: () => {
    return true;
  },

  loadMoreRecords: () => {
    return true;
  },

  searchRecords: (keyword) => {
    return { keyword };
  },

  searchRecordsDebounced: (keyword) => {
    return { keyword };
  },

  clearSearch: () => {
    return '';
  },

  showImportDialog: () => {
    return true;
  },

  exportRecords: () => {
    Storage.exportData();
    return true;
  },

  toggleSpecialHistory: () => {
    return true;
  },

  clearSpecialHistory: () => {
    return true;
  },

  toggleZodiacPredictionHistory: () => {
    return true;
  },

  clearZodiacPredictionHistory: () => {
    return true;
  },

  openHistoryDetail: (category) => {
    const categoryMap = {
      'zodiac': '生肖预测',
      'selected': '精选',
      'special': '精选特码',
      'hot': '特码热门TOP5',
      'preferred': '优选记录'
    };
    return { category, categoryName: categoryMap[category] || '历史记录' };
  },

  backFromHistoryDetail: () => {
    return true;
  },

  deleteHistoryDetailRecord: (recordId) => {
    return { recordId };
  }
};
