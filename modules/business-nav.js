/**
 * 导航与定时器业务模块
 * @description 处理页面导航、滚动、倒计时、自动刷新等功能
 */
const BusinessNav = {
  switchBottomNav: (index) => {
    AnalysisView.switchBottomNav(index);
  },

  initAnalysisPage: () => {
    AnalysisView.init();
  },

  toggleDetail: (targetId) => {
    AnalysisView.toggleDetail(targetId);
  },

  switchAnalysisTab: (tab) => {
    AnalysisView.switchAnalysisTab(tab);
  },

  loadMoreHistory: () => {
    AnalysisView.loadMoreHistory();
  },

  startCountdown: () => {
    AnalysisView.startCountdown();
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
  },

  checkDrawTimeLoop: () => {
    setInterval(() => {
      if(BusinessNav.isInDrawTime() && !StateManager._state.analysis.autoRefreshTimer) {
        BusinessNav.startAutoRefresh();
      }
    }, 60000);
  },

  scrollToModule: (targetId) => {
    AnalysisView.scrollToModule(targetId);
  },

  toggleQuickNav: (isOpen = null) => {
    AnalysisView.toggleQuickNav(isOpen);
  },

  adjustBottomNavPosition: () => {
    AnalysisView.adjustBottomNavPosition();
  },

  backToTop: () => {
    AnalysisView.backToTop();
  },

  handleScroll: (...args) => AnalysisView.handleScroll(...args),

  handlePageUnload: () => {
    AnalysisView.handlePageUnload();
  },

  showZodiacDetail: (zodiac) => {
    AnalysisView.showZodiacDetail(zodiac);
  },

  showZodiacAppearDetail: (zodiac) => {
    AnalysisView.showZodiacAppearDetail(zodiac);
  },

  handleNumCountSelectChange: (value) => {
    const isCustom = value === 'custom';
    AnalysisView.toggleCustomNumCount(isCustom);
    if(!isCustom) {
      const newAnalysis = { 
        ...StateManager._state.analysis, 
        selectedNumCount: Number(value)
      };
      StateManager.setState({ analysis: newAnalysis }, false);
      AnalysisView.renderZodiacAnalysis();
    }
  },

  handleCustomNumCountInput: (value) => {
    const val = value.trim();
    if(val && !isNaN(val) && Number(val) >= 1 && Number(val) <= 49) {
      const newAnalysis = { 
        ...StateManager._state.analysis, 
        selectedNumCount: Number(val)
      };
      StateManager.setState({ analysis: newAnalysis }, false);
      AnalysisView.renderZodiacAnalysis();
    }
  },

  clearAllTimers: () => {
    const state = StateManager._state;
    if (state.scrollTimer) clearTimeout(state.scrollTimer);
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
  },

  refreshHotCold: () => {
    AnalysisView.refreshHotCold();
  },

  quickLottery: (count) => {
    AnalysisView.quickLottery(count);
  },

  runLottery: () => {
    AnalysisView.runLottery();
  },

  excludeLotteryResult: () => {
    AnalysisView.excludeLotteryResult();
  },

  clearSmartHistory: () => {
    AnalysisView.clearSmartHistory();
  },

  showStatDetail: (statType) => {
    AnalysisView.showStatDetail(statType);
  },

  showStreakDetail: (streakType) => {
    AnalysisView.showStreakDetail(streakType);
  },

  toggleRecordDetail: (index) => {
    RecordView.toggleRecordDetail(index);
  },

  deleteRecord: (recordId) => {
    RecordView.deleteRecord(recordId);
  },

  clearRecordHistory: () => {
    RecordView.clearRecordHistory();
  },

  refreshRecord: () => {
    RecordView.refreshRecord();
  },

  loadMoreRecords: () => {
    RecordView.loadMoreRecords();
  },

  searchRecords: (keyword) => {
    RecordView.searchRecords(keyword);
  },

  searchRecordsDebounced: (keyword) => {
    RecordView.searchRecordsDebounced(keyword);
  },

  clearSearch: () => {
    RecordView.clearSearch();
  },

  showImportDialog: () => {
    RecordView.showImportDialog();
  },

  exportRecords: () => {
    Storage.exportData();
  }
};
