/**
 * 应用入口
 */
async function initApp() {
  try {
    const startTime = performance.now();
    
    DOM.init();
    DataQuery.buildZodiacCycle();
    DataQuery.buildNumList();
    DataQuery.init();
    
    const cachedHistory = Storage.loadHistoryCache();
    if(cachedHistory.data && cachedHistory.data.length > 0) {
      const newAnalysis = { 
        ...StateManager._state.analysis, 
        historyData: cachedHistory.data 
      };
      StateManager.setState({ analysis: newAnalysis }, false);
      Logger.debug('从本地缓存加载历史数据', cachedHistory.data.length, '条');
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
    
    AnalysisView.init();
    
    AnalysisView.renderFullAnalysis();
    AnalysisView.renderZodiacAnalysis();
    Business.startCountdown();
    Business.checkDrawTimeLoop();
    AnalysisView.adjustBottomNavPosition();
    Business.startDrawResultAutoRefresh();
    Storage._checkDailyBackup();
    Render.hideLoading();
    Render.renderVersion();
    RecordView.init();

    const initTime = performance.now() - startTime;
    Logger.debug('应用初始化耗时:', initTime.toFixed(2), 'ms');

    setTimeout(() => {
      const perfStart = performance.now();
      
      Business.silentUpdateAllPredictionHistory();
      Business.updateSpecialHistoryComparison();
      PredictView.renderSpecialHistory();

      try {
        Business.silentSaveSpecialCombinations(true);
      } catch (e) {
        Logger.error('后台静默保存精选特码失败', e);
      }
      
      try {
        BusinessAnalysis.saveAnalysisToRecord(true);
      } catch (e) {
        Logger.error('自动保存分析数据到记录失败', e);
      }

      AppMonitor.start();

      const perfEnd = performance.now() - perfStart;
      Logger.debug('后台任务耗时:', perfEnd.toFixed(2), 'ms');

      if(cachedHistory.expired) {
        Logger.debug('缓存已过期，后台刷新数据');
        BusinessAnalysis.refreshHistory().then(sortedData => {
          if(sortedData && sortedData.length > 0) {
            AnalysisView.renderLatest(sortedData[0]);
            AnalysisView.renderHistory();
            AnalysisView.renderFullAnalysis();
            AnalysisView.renderZodiacAnalysis();
          }
        });
      }
    }, 3000);
  } catch (e) {
    Logger.error('应用初始化失败', e);
    Toast.show('页面初始化失败，请刷新重试');
    Render.hideLoading();
  }
}

window.addEventListener('DOMContentLoaded', initApp);
