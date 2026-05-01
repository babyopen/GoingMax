/**
 * 应用入口
 */
async function initApp() {
  try {
    DOM.init();
    DataQuery.buildZodiacCycle();
    DataQuery.buildNumList();
    DataQuery.init();
    
    // 1. 优先从本地缓存加载历史数据
    const cachedHistory = Storage.loadHistoryCache();
    let cachedExpired = false;
    if(cachedHistory.data && cachedHistory.data.length > 0) {
      const newAnalysis = { 
        ...StateManager._state.analysis, 
        historyData: cachedHistory.data 
      };
      StateManager.setState({ analysis: newAnalysis }, false);
      cachedExpired = cachedHistory.expired;
      console.log('从本地缓存加载历史数据', cachedHistory.data.length, '条', cachedExpired ? '(已过期)' : '(有效)');
    }
    
    FilterView.renderZodiacTags();
    FilterView.renderResult();
    FilterView.renderTagStatus();
    Storage.loadSavedFilters();
    Storage.loadFavorites();
    const specialHistory = Storage.loadSpecialHistory();
    StateManager.setState({ specialHistory: specialHistory }, false);
    ExcludeView.init();
    SavedView.init();
    PredictView.init();
    RecordView.renderFavoriteList();
    EventBinder.init();
    
    // 2. 调用 AnalysisView.init() 检查并加载数据
    AnalysisView.init();
    
    AnalysisView.renderFullAnalysis();
    AnalysisView.renderZodiacAnalysis();
    Business.startCountdown();
    Business.checkDrawTimeLoop();
    Business.adjustBottomNavPosition();
    Business.startDrawResultAutoRefresh();
    Storage._checkDailyBackup();
    Render.hideLoading();
    RecordView.init();

    setTimeout(() => {
      Business.silentUpdateAllPredictionHistory();
      Business.updateSpecialHistoryComparison();
      PredictView.renderSpecialHistory();

      try {
        Business.silentSaveAllSpecialCombinations();
      } catch (e) {
        console.error('后台静默保存精选特码失败', e);
      }
      
      // 自动保存分析数据到记录
      try {
        BusinessAnalysis.saveAnalysisToRecord();
      } catch (e) {
        console.error('自动保存分析数据到记录失败', e);
      }
    }, 3000);

    // 如果缓存已过期，立即静默刷新一次数据（不等3秒）
    if(cachedExpired) {
      console.log('缓存已过期，立即静默刷新数据');
      BusinessAnalysis.refreshHistory(true);
    }
  } catch (e) {
    console.error('应用初始化失败', e);
    Toast.show('页面初始化失败，请刷新重试');
    Render.hideLoading();
  }
}

window.addEventListener('DOMContentLoaded', initApp);
