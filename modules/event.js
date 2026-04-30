/**
 * 事件绑定模块
 * @description 统一事件委托，支持键盘操作
 */
const EventBinder = {
  init: () => {
    document.addEventListener('click', EventBinder.handleGlobalClick);
    document.addEventListener('keydown', EventBinder.handleKeyDown);
    window.addEventListener('scroll', Business.handleScroll);
    document.addEventListener('click', EventBinder.handleClickOutside);
    window.addEventListener('beforeunload', Business.handlePageUnload);
    window.addEventListener('error', EventBinder.handleGlobalError);
    
    const analyzeSelect = document.getElementById('analyzeSelect');
    if(analyzeSelect) {
      analyzeSelect.addEventListener('change', function() {
        Business.syncAnalyze();
      });
    }
    
    const zodiacAnalyzeSelect = document.getElementById('zodiacAnalyzeSelect');
    if(zodiacAnalyzeSelect) {
      zodiacAnalyzeSelect.addEventListener('change', function() {
        Business.syncZodiacAnalyze();
      });
    }
    
    const numCountSelect = document.getElementById('numCountSelect');
    const customNumCount = document.getElementById('customNumCount');
    
    if(numCountSelect) {
      numCountSelect.addEventListener('change', function() {
        const isCustom = this.value === 'custom';
        if(customNumCount) customNumCount.style.display = isCustom ? 'inline-block' : 'none';
        if(!isCustom) {
          const newAnalysis = { 
            ...StateManager._state.analysis, 
            selectedNumCount: Number(this.value)
          };
          StateManager.setState({ analysis: newAnalysis }, false);
          AnalysisView.renderZodiacAnalysis();
        }
      });
    }
    
    if(customNumCount) {
      customNumCount.addEventListener('input', function() {
        const val = this.value.trim();
        if(val && !isNaN(val) && Number(val) >= 1 && Number(val) <= 49) {
          const newAnalysis = { 
            ...StateManager._state.analysis, 
            selectedNumCount: Number(val)
          };
          StateManager.setState({ analysis: newAnalysis }, false);
          AnalysisView.renderZodiacAnalysis();
        }
      });
    }
  },

  handleGlobalClick: (e) => {
    const target = e.target;

    const filterOption = target.closest('.filter-option');
    if(filterOption && filterOption.dataset.type && filterOption.dataset.value !== undefined){
      e.stopPropagation();
      const type = filterOption.dataset.type;
      const value = filterOption.dataset.value;

      const filterTypeToGroup = {
        'zodiac': 'zodiac',
        'waveColor': 'color',
        'waveColorOddEven': 'colorsx',
        'animalType': 'type',
        'fiveElements': 'element',
        'headNumber': 'head',
        'tailNumber': 'tail',
        'tailSum': 'sum',
        'sizeOddEven': 'bs',
        'hotCold': 'hot',
        'excludeNumber': 'excludeNumber'
      };

      const group = filterTypeToGroup[type];
      if (!group) return;

      if (type === 'excludeNumber') {
        Business.toggleExclude(Number(value));
      } else {
        StateManager.updateSelected(group, value);
      }
      return;
    }

    const tag = target.closest('.tag[data-group]');
    if(tag){
      const group = tag.dataset.group;
      let value = tag.dataset.value;

      if (group === 'sum' || group === 'head') {
        value = parseInt(value);
      }

      StateManager.updateSelected(group, value);
      return;
    }

    const excludeTag = target.closest('.exclude-tag[data-num]');
    if(excludeTag){
      Business.toggleExclude(Number(excludeTag.dataset.num));
      return;
    }

    const navTab = target.closest('.nav-tab[data-target]');
    if(navTab){
      const targetId = navTab.dataset.target;
      Business.scrollToModule(targetId);
      return;
    }

    if(target === DOM.navToggle){
      Business.toggleQuickNav();
      return;
    }

    if(target === DOM.backTopBtn){
      Business.backToTop();
      return;
    }

    const actionBtn = target.closest('[data-action]');
    if(actionBtn){
      const action = actionBtn.dataset.action;
      const group = actionBtn.dataset.group;
      const index = actionBtn.dataset.index;
      const isSizeOddGroup = ['bs', 'sumOdd', 'sumBig', 'tailBig'].includes(group);

      if(isSizeOddGroup) {
        const allGroups = ['bs', 'sumOdd', 'sumBig', 'tailBig'];

        if(action === CONFIG.ACTIONS.SELECT_GROUP) {
          allGroups.forEach(g => StateManager.selectGroup(g));
        } else if(action === CONFIG.ACTIONS.INVERT_GROUP) {
          allGroups.forEach(g => StateManager.invertGroup(g));
        } else if(action === CONFIG.ACTIONS.CLEAR_GROUP || action === CONFIG.ACTIONS.RESET_GROUP) {
          allGroups.forEach(g => StateManager.resetGroup(g));
        }
      } else {
        if(action === CONFIG.ACTIONS.RESET_GROUP) StateManager.resetGroup(group);
        if(action === CONFIG.ACTIONS.SELECT_GROUP) StateManager.selectGroup(group);
        if(action === CONFIG.ACTIONS.INVERT_GROUP) StateManager.invertGroup(group);
        if(action === CONFIG.ACTIONS.CLEAR_GROUP) StateManager.resetGroup(group);
      }

      if(action === CONFIG.ACTIONS.SELECT_ALL) Filter.selectAllFilters();
      if(action === CONFIG.ACTIONS.CLEAR_ALL) Filter.clearAllFilters();
      if(action === CONFIG.ACTIONS.SAVE_FILTER) Business.saveFilterPrompt();
      if(action === CONFIG.ACTIONS.CLEAR_ALL_SAVED) Business.clearAllSavedFilters();
      if(action === CONFIG.ACTIONS.INVERT_EXCLUDE) Business.invertExclude();
      if(action === CONFIG.ACTIONS.UNDO_EXCLUDE) Business.undoExclude();
      if(action === CONFIG.ACTIONS.BATCH_EXCLUDE) Business.batchExcludePrompt();
      if(action === CONFIG.ACTIONS.CLEAR_EXCLUDE) Business.clearExclude();
      if(action === CONFIG.ACTIONS.TOGGLE_SHOW_ALL) Business.toggleShowAllFilters();
      if(action === CONFIG.ACTIONS.LOAD_FILTER) Business.loadFilter(Number(index));
      if(action === CONFIG.ACTIONS.RENAME_FILTER) Business.renameFilter(Number(index));
      if(action === CONFIG.ACTIONS.COPY_FILTER) Business.copyFilterNums(Number(index));
      if(action === CONFIG.ACTIONS.TOP_FILTER) Business.topFilter(Number(index));
      if(action === CONFIG.ACTIONS.DELETE_FILTER) Business.deleteFilter(Number(index));
      if(action === CONFIG.ACTIONS.SWITCH_NAV) Business.switchBottomNav(Number(actionBtn.dataset.index));
      if(action === 'refreshHistory') Business.refreshHistory();
      if(action === 'syncAnalyze') Business.syncAnalyze();
      if(action === 'syncZodiacAnalyze') Business.syncZodiacAnalyze();
      if(action === 'toggleDetail') Business.toggleDetail(actionBtn.dataset.target);
      if(action === 'loadMoreHistory') Business.loadMoreHistory();

      if(action === 'switchSpecialHistoryMode') Business.switchSpecialHistoryMode(actionBtn.dataset.mode);
      if(action === 'copyHotNumbers') Business.copyHotNumbers();
      if(action === 'copyZodiacNumbers') Business.copyZodiacNumbers();
      if(action === 'favoriteZodiacNumbers') Business.favoriteZodiacNumbers();
      if(action === 'loadFavorite') Business.loadFavorite(Number(index));
      if(action === 'copyFavorite') Business.copyFavorite(Number(index));
      if(action === 'removeFavorite') Business.removeFavorite(Number(index));
      if(action === 'toggleSpecialHistory') Business.toggleSpecialHistory();
      if(action === 'toggleSpecialFiltersPanel') Business.toggleSpecialFiltersPanel();
      if(action === 'selectAllSpecialFilters') Business.selectAllSpecialFilters();
      if(action === 'resetSpecialFilters') Business.resetSpecialFilters();
      if(action === 'confirmSpecialFilters') Business.confirmSpecialFilters();
      if(action === 'toggleSpecialHistory') Business.toggleSpecialHistory();
      if(action === 'clearSpecialHistory') Business.clearSpecialHistory();
      if(action === 'togglePredictionFiltersPanel') Business.togglePredictionFiltersPanel();
      if(action === 'selectAllPredictionPeriods') Business.selectAllPredictionPeriods();
      if(action === 'resetPredictionPeriods') Business.resetPredictionPeriods();
      if(action === 'confirmPredictionFilters') Business.confirmPredictionFilters();
      if(action === 'clearZodiacPredictionHistory') Business.clearZodiacPredictionHistory();
      if(action === 'toggleZodiacPredictionHistory') Business.toggleZodiacPredictionHistory();
      if(action === 'clearAllFavorites') Business.clearAllFavorites();
      if(action === 'toggleRecordDetail') Business.toggleRecordDetail(actionBtn.dataset.index);
      if(action === 'deleteRecord') Business.deleteRecord(actionBtn.dataset.recordId);
      if(action === 'clearRecordHistory') Business.clearRecordHistory();
      if(action === 'refreshRecord') Business.refreshRecord();
      if(action === 'searchRecords') RecordView.searchRecordsDebounced(actionBtn.previousElementSibling?.value || '');
      if(action === 'clearRecordSearch') RecordView.clearSearch();
      if(action === 'exportRecords') RecordView.exportRecords();
      if(action === 'importRecords') RecordView.showImportDialog();
      if(action === 'refreshHotCold') Business.refreshHotCold();
      if(action === 'runLottery') Business.runLottery();
      if(action === 'excludeLotteryResult') Business.excludeLotteryResult();
      if(action === 'clearSmartHistory') Business.clearSmartHistory();
      if(action === 'showStatDetail') Business.showStatDetail(actionBtn.dataset.statType);
      if(action === 'showStreakDetail') Business.showStreakDetail(actionBtn.dataset.streakType);
      if(action === 'toggleQuickNav') Business.toggleQuickNav();
      if(action === 'loadMoreRecords') RecordView.loadMoreRecords();
      return;
    }

    const analysisTabBtn = target.closest('.analysis-tab-btn[data-analysis-tab]');
    if(analysisTabBtn){
      Business.switchAnalysisTab(analysisTabBtn.dataset.analysisTab);
      return;
    }

    const loadMoreBtn = target.closest('#loadMore');
    if(loadMoreBtn){
      Business.loadMoreHistory();
      return;
    }

    const zodiacItem = target.closest('.zodiac-prediction-item[data-zodiac]');
    if(zodiacItem){
      const zodiac = zodiacItem.dataset.zodiac;
      Business.showZodiacDetail(zodiac);
      return;
    }

    const zodiacTotalItem = target.closest('#zodiacTotalGrid .data-item-z');
    if(zodiacTotalItem){
      const zodiacText = zodiacTotalItem.innerText.split('\n')[0];
      if(zodiacText) {
        Business.showZodiacAppearDetail(zodiacText);
      }
      return;
    }

    const quickBtn = target.closest('.quick-btn');
    if(quickBtn){
      const count = parseInt(quickBtn.dataset.count) || 1;
      Business.quickLottery(count);
      return;
    }
  },

  handleKeyDown: (e) => {
    if(e.key !== 'Enter' && e.key !== ' ') return;
    
    const target = e.target;
    const isInteractive = target.matches('.tag, .exclude-tag, .btn-mini, .btn-line, .nav-tab, .nav-toggle-btn, .back-top-btn, .filter-expand, .filter-item-btns button, .bottom-nav-item');
    
    if(isInteractive){
      e.preventDefault();
      target.click();
    }
  },

  handleClickOutside: (e) => {
    if(DOM.quickNavMenu && !DOM.quickNavMenu.contains(e.target) && !DOM.navToggle.contains(e.target) && DOM.quickNavMenu.classList.contains('expanded')){
      Business.toggleQuickNav(false);
    }
  },

  handleGlobalError: (e) => {
    console.error('全局错误', e.error || e.message || e);
    Toast.show('页面出现异常，请刷新重试');
  }
};
