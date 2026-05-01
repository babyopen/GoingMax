/**
 * 应用入口
 */
async function initApp() {
  try {
    DOM.init();
    DataQuery.buildZodiacCycle();
    DataQuery.buildNumList();
    DataQuery.init();
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
    }, 3000);
  } catch (e) {
    console.error('应用初始化失败', e);
    Toast.show('页面初始化失败，请刷新重试');
    Render.hideLoading();
  }
}

window.addEventListener('DOMContentLoaded', initApp);
