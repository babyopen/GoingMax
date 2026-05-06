/**
 * 事件绑定模块
 * @description 统一事件委托，支持键盘操作
 */

const FILTER_TYPE_TO_GROUP = {
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

const EventBinder = {
  init: () => {
    document.addEventListener('click', EventBinder.handleGlobalClick);
    document.addEventListener('keydown', EventBinder.handleKeyDown);
    window.addEventListener('scroll', AnalysisView.handleScroll);
    document.addEventListener('click', EventBinder.handleClickOutside);
    window.addEventListener('beforeunload', Business.handlePageUnload);
    window.addEventListener('error', EventBinder.handleGlobalError);
    
    const analyzeSelect = document.getElementById('analyzeSelect');
    if(analyzeSelect) {
      analyzeSelect.addEventListener('change', function() {
        BusinessSpecialNum.clearCache();
        const result = AnalysisView.syncAnalyze();
        if(result) {
          AnalysisView.renderFullAnalysis();
          AnalysisView.renderZodiacAnalysis();
          setTimeout(() => {
            BusinessAnalysis.saveAnalysisToRecord();
          }, 500);
        }
      });
    }
    
    const zodiacAnalyzeSelect = document.getElementById('zodiacAnalyzeSelect');
    if(zodiacAnalyzeSelect) {
      zodiacAnalyzeSelect.addEventListener('change', function() {
        BusinessSpecialNum.clearCache();
        const result = AnalysisView.syncZodiacAnalyze();
        if(result) {
          AnalysisView.renderFullAnalysis();
          AnalysisView.renderZodiacAnalysis();
          setTimeout(() => {
            BusinessAnalysis.saveAnalysisToRecord();
          }, 500);
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

      const group = FILTER_TYPE_TO_GROUP[type];
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

      if (group === 'sum' || group === 'head' || group === 'tail') {
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
      const result = Business.scrollToModule(targetId);
      if(result && result.targetId) {
        AnalysisView.scrollToModule(result.targetId);
      }
      return;
    }

    if(target === DOM.navToggle){
      const result = Business.toggleQuickNav();
      if(result) {
        AnalysisView.toggleQuickNav(result.isOpen);
      }
      return;
    }

    if(target === DOM.backTopBtn){
      AnalysisView.backToTop();
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
          allGroups.forEach(g => Business.selectGroup(g));
        } else if(action === CONFIG.ACTIONS.INVERT_GROUP) {
          allGroups.forEach(g => Business.invertGroup(g));
        } else if(action === CONFIG.ACTIONS.CLEAR_GROUP || action === CONFIG.ACTIONS.RESET_GROUP) {
          allGroups.forEach(g => StateManager.resetGroup(g));
        }
        FilterView.renderResult();
      } else {
        if(action === CONFIG.ACTIONS.RESET_GROUP) StateManager.resetGroup(group);
        if(action === CONFIG.ACTIONS.SELECT_GROUP) Business.selectGroup(group);
        if(action === CONFIG.ACTIONS.INVERT_GROUP) Business.invertGroup(group);
        if(action === CONFIG.ACTIONS.CLEAR_GROUP) StateManager.resetGroup(group);
        FilterView.renderResult();
      }

      if(action === CONFIG.ACTIONS.SELECT_ALL) {
        Filter.selectAllFilters();
        FilterView.renderAll();
      }
      if(action === CONFIG.ACTIONS.CLEAR_ALL) {
        Filter.clearAllFilters();
        FilterView.renderAll();
      }
      if(action === CONFIG.ACTIONS.KILL_GROUP) {
        const result = Business.killGroup(group);
        if(result && result.success) {
          FilterView.renderResult();
          FilterView.renderTagStatus(group);
          if(result.action === 'locked') {
            Toast.show(`已锁定排除：${result.killed.join('、')}`, 1500);
          } else if(result.action === 'unlocked') {
            Toast.show(`已解除${BusinessExclude.getGroupName(group)}锁定`);
          }
        } else if(result && result.error === 'empty') {
          Toast.show('请先选择要锁定的选项');
        }
      }
      if(action === CONFIG.ACTIONS.KILL_GROUP_BS) {
        const result = Business.killGroupBs();
        if(result && result.success) {
          FilterView.renderResult();
          FilterView.renderTagStatus('bs');
          if(result.action === 'locked') {
            Toast.show('已锁定排除大小单双', 1500);
          } else if(result.action === 'unlocked') {
            Toast.show('已解除大小单双锁定');
          }
        } else if(result && result.error === 'empty') {
          Toast.show('请先选择要锁定的选项');
        }
      }
      if(action === CONFIG.ACTIONS.SAVE_FILTER) {
        const result = Business.saveFilterPrompt();
        if(result && result.success) {
          InputModal.show({
            title: '保存方案',
            defaultValue: result.defaultName,
            placeholder: '请输入方案名称',
            onConfirm: (name) => {
              const saveResult = BusinessFilter.saveFilter(name);
              if(saveResult.success) {
                FilterView.renderFilterList();
                Toast.show('保存成功');
              }
            }
          });
        } else if(result && result.error === 'max_count') {
          Toast.show(`最多只能保存${result.limit}个方案`);
        }
      }
      if(action === CONFIG.ACTIONS.CLEAR_ALL_SAVED) {
        if(Business.clearAllSavedFilters()) {
          InputModal.confirm({
            title: '清空所有方案',
            message: '确定清空所有方案吗？',
            onConfirm: () => {
              BusinessFilter.doClearAllSavedFilters();
              FilterView.renderFilterList();
              Toast.show('已清空所有方案');
            }
          });
        }
      }
      if(action === CONFIG.ACTIONS.INVERT_EXCLUDE) {
        const result = Business.invertExclude();
        if(result) {
          Toast.show(`已反选，当前排除 ${result.excluded} 个号码`);
          FilterView.renderResult();
          ExcludeView.renderExcludeGrid();
        }
      }
      if(action === CONFIG.ACTIONS.UNDO_EXCLUDE) Business.undoExclude();
      if(action === CONFIG.ACTIONS.BATCH_EXCLUDE) {
        if(Business.batchExcludePrompt()) {
          InputModal.show({
            title: '批量排除号码',
            defaultValue: '',
            placeholder: '输入号码，空格/逗号分隔，如：1,2,3,4,5',
            onConfirm: (input) => {
              const result = BusinessExclude.doBatchExclude(input);
              if(result.success) {
                FilterView.renderResult();
                ExcludeView.renderExcludeGrid();
                if(result.count > 0) {
                  Toast.show(`已添加${result.count}个排除号码`);
                } else {
                  Toast.show('号码已在排除列表中');
                }
              } else if(result.error === 'empty') {
                return;
              } else {
                Toast.show('请输入有效的号码');
              }
            }
          });
        }
      }
      if(action === CONFIG.ACTIONS.CLEAR_EXCLUDE) {
        Business.clearExclude();
        FilterView.renderResult();
        ExcludeView.renderExcludeGrid();
      }
      if(action === CONFIG.ACTIONS.TOGGLE_SHOW_ALL) {
        Business.toggleShowAllFilters();
        FilterView.renderFilterList();
      }
      if(action === CONFIG.ACTIONS.LOAD_FILTER) {
        const result = Business.loadFilter(Number(index));
        if(result && result.success) {
          FilterView.renderAll();
          Toast.show('加载成功');
        }
      }
      if(action === CONFIG.ACTIONS.RENAME_FILTER) {
        const result = Business.renameFilter(Number(index));
        if(result) {
          InputModal.show({
            title: '重命名方案',
            defaultValue: result.originalName,
            placeholder: '请输入新名称',
            onConfirm: (newName) => {
              const renameResult = BusinessFilter.doRenameFilter(result.index, newName);
              if(renameResult && renameResult.success) {
                FilterView.renderFilterList();
                Toast.show('重命名成功');
              }
            }
          });
        }
      }
      if(action === CONFIG.ACTIONS.COPY_FILTER) {
        const result = Business.copyFilterNums(Number(index));
        if(result && result.success) {
          Render.copyToClipboard(result.numStr).then(success => {
            if(success) {
              Toast.show('复制成功');
            } else {
              AnalysisView.showCopyDialog(result.numStr);
            }
          });
        } else if(result && result.error === 'empty') {
          Toast.show('该方案无符合条件的号码');
        }
      }
      if(action === CONFIG.ACTIONS.TOP_FILTER) {
        const result = Business.topFilter(Number(index));
        if(result && result.success) {
          FilterView.renderFilterList();
          Toast.show('置顶成功');
        }
      }
      if(action === CONFIG.ACTIONS.DELETE_FILTER) {
        if(Business.deleteFilter(Number(index))) {
          InputModal.confirm({
            title: '删除方案',
            message: '确定删除该方案吗？',
            onConfirm: () => {
              const deleteResult = BusinessFilter.doDeleteFilter(Number(index));
              if(deleteResult && deleteResult.success) {
                FilterView.renderFilterList();
                Toast.show('删除成功');
              }
            }
          });
        }
      }
      if(action === 'navToRecordTab') {
        const tabName = actionBtn.dataset.tab;
        BusinessAnalysis.saveAnalysisToRecord(true);
        Business.switchBottomNav(2);
        AnalysisView.switchBottomNav(2);
        RecordView.switchTab(tabName);
      }
      if(action === CONFIG.ACTIONS.SWITCH_NAV) {
        const index = Number(actionBtn.dataset.index);
        Business.switchBottomNav(index);
        AnalysisView.switchBottomNav(index);
      }
      if(action === 'refreshHistory') {
        Business.refreshHistory().then(sortedData => {
          if(sortedData && sortedData.length > 0) {
            AnalysisView.showHistoryLoading();
            AnalysisView.renderLatest(sortedData[0]);
            AnalysisView.renderHistory();
            AnalysisView.renderFullAnalysis();
            AnalysisView.renderZodiacAnalysis();
            AnalysisView.showLoadMoreButton();
            Toast.show('数据加载成功');
            setTimeout(() => {
              BusinessAnalysis.migrateRecordHistoryFields();
              BusinessAnalysis.saveAnalysisToRecord();
              BusinessAnalysis.updateRecordHistoryComparison();
              RecordView.renderRecordList();
            }, 500);
          }
        }).catch(() => {
          AnalysisView.showHistoryError();
          Toast.show('数据加载失败');
        });
        return;
      }
      if(action === 'syncAnalyze') {
        const result = AnalysisView.syncAnalyze();
        AnalysisView.renderFullAnalysis();
        AnalysisView.renderZodiacAnalysis();
        setTimeout(() => {
          BusinessAnalysis.saveAnalysisToRecord();
        }, 500);
        return;
      }
      if(action === 'syncZodiacAnalyze') {
        const result = AnalysisView.syncZodiacAnalyze();
        AnalysisView.renderFullAnalysis();
        AnalysisView.renderZodiacAnalysis();
        setTimeout(() => {
          BusinessAnalysis.saveAnalysisToRecord();
        }, 500);
        return;
      }
      if(action === 'toggleDetail') {
        const result = Business.toggleDetail(actionBtn.dataset.target);
        if(result && result.targetId) {
          AnalysisView.toggleDetail(result.targetId);
        }
      }
      if(action === 'loadMoreHistory') {
        const result = Business.loadMoreHistory();
        if(result) {
          AnalysisView.renderHistory();
          AnalysisView.showLoadMoreButton();
        }
      }

      if(action === 'toggleSpecialHistoryMode') {
        const mode = actionBtn.dataset.mode;
        Business.switchSpecialHistoryMode(mode);
        PredictView.switchSpecialHistoryMode(mode);
      }
      if(action === 'copyHotNumbers') {
        const numStr = AnalysisView.copyHotNumbers();
        if(numStr) {
          Render.copyToClipboard(numStr).then(success => {
            if(success) {
              Toast.show('复制成功');
            } else {
              AnalysisView.showCopyDialog(numStr);
            }
          });
        } else {
          Toast.show('暂无号码可复制');
        }
      }
      if(action === 'copyZodiacNumbers') {
        const numStr = AnalysisView.copyZodiacNumbers();
        if(numStr) {
          Render.copyToClipboard(numStr).then(success => {
            if(success) {
              Toast.show('复制成功');
            } else {
              AnalysisView.showCopyDialog(numStr);
            }
          });
        } else {
          Toast.show('暂无精选特码可复制');
        }
      }
      if(action === 'favoriteZodiacNumbers') {
        const numbers = AnalysisView.favoriteZodiacNumbers();
        if(numbers && numbers.length > 0) {
          const favResult = Business.favoriteZodiacNumbers(numbers);
          if(favResult && favResult.success) {
            RecordView.renderFavoriteList();
            Toast.show('收藏成功并已记录');
          } else if(favResult && favResult.error === 'empty') {
            Toast.show('暂无精选特码可收藏');
          } else if(favResult && favResult.error === 'already_favorited') {
            Toast.show('该方案已收藏');
          }
        } else {
          Toast.show('暂无精选特码可收藏');
        }
      }
      if(action === 'loadFavorite') {
        const result = Business.loadFavorite(Number(index));
        if(result && result.success) {
          const typeText = result.type === 'numbers' ? '已加载精选特码收藏' : '加载成功';
          Toast.show(typeText);
          FilterView.renderAll();
        }
      }
      if(action === 'copyFavorite') {
        const result = Business.copyFavorite(Number(index));
        if(result && result.success) {
          Render.copyToClipboard(result.numStr).then(success => {
            if(success) {
              Toast.show('复制成功');
            } else {
              AnalysisView.showCopyDialog(result.numStr);
            }
          });
        } else if(result && result.error === 'empty') {
          Toast.show('该方案无符合条件的号码');
        }
      }
      if(action === 'removeFavorite') {
        const result = Business.removeFavorite(Number(index));
        if(result && result.success) {
          RecordView.renderFavoriteList();
          Toast.show('已删除');
        }
      }
      if(action === 'toggleSpecialHistory') {
        Business.toggleSpecialHistory();
        PredictView.toggleSpecialHistory();
      }
      if(action === 'clearSpecialHistory') {
        if(Business.clearSpecialHistory()) {
          InputModal.confirm({
            title: '清空历史',
            message: '确定清空所有精选特码历史吗？',
            onConfirm: () => {
              PredictView.clearSpecialHistory();
            }
          });
        }
      }
      if(action === 'clearZodiacPredictionHistory') {
        if(Business.clearZodiacPredictionHistory()) {
          InputModal.confirm({
            title: '清空预测历史',
            message: '确定要清空预测历史吗？',
            onConfirm: () => {
              PredictView.clearZodiacPredictionHistory();
            }
          });
        }
      }
      if(action === 'toggleZodiacPredictionHistory') {
        Business.toggleZodiacPredictionHistory();
        PredictView.toggleZodiacPredictionHistory();
      }
      if(action === 'switchRecordTab') {
        BusinessAnalysis.saveAnalysisToRecord(true);
        RecordView.switchTab(actionBtn.dataset.tab);
      }
      if(action === 'switchRecordLimit') {
        RecordView.switchRecordLimit(actionBtn.dataset.group, actionBtn.dataset.limitIndex);
      }
      if(action === 'switchDetailLimit') {
        RecordView.switchDetailLimit(actionBtn.dataset.group, actionBtn.dataset.limitIndex);
      }
      if(action === 'toggleTier') {
        ProbabilityView.toggleTier(actionBtn.dataset.tier);
      }
      if(action === 'clearAllFavorites') {
        if(Business.clearAllFavorites()) {
          InputModal.confirm({
            title: '清空所有收藏',
            message: '确定清空所有收藏吗？',
            onConfirm: () => {
              StateManager.setState({ favorites: [] }, false);
              Storage.set('favorites', []);
              RecordView.renderFavoriteList();
              Toast.show('已清空所有收藏');
            }
          });
        }
      }
      if(action === 'showSelectedZodiacDetail') {
        const detailData = BusinessSpecial.showSelectedZodiacDetail(actionBtn.dataset.zodiac, actionBtn.dataset.index);
        if(detailData) {
          AnalysisView.showZodiacDetailModal(detailData);
        }
        return;
      }
      if(action === 'toggleRecordDetail') {
        Business.toggleRecordDetail(actionBtn.dataset.index);
        RecordView.toggleRecordDetail(actionBtn.dataset.index);
      }
      if(action === 'deleteRecord') {
        const result = Business.deleteRecord(actionBtn.dataset.recordId);
        if(result && result.recordId) {
          const records = Storage.loadRecordHistory();
          const record = records.find(r => r.id == result.recordId);
          InputModal.confirm({
            title: '删除记录',
            message: `确定删除第 ${record ? record.expect || '--' : '--'} 期的记录吗？`,
            onConfirm: () => {
              RecordView.deleteRecord(result.recordId);
            }
          });
        }
      }
      if(action === 'clearRecordHistory') {
        if(Business.clearRecordHistory()) {
          InputModal.confirm({
            title: '清空记录',
            message: '确定要清空所有记录吗？此操作不可恢复。',
            onConfirm: () => {
              RecordView.clearRecordHistory();
            }
          });
        }
      }
      if(action === 'refreshRecord') {
        RecordView.refreshRecord();
      }
      if(action === 'searchRecords') {
        Business.searchRecords(actionBtn.previousElementSibling?.value || '');
        RecordView.searchRecords(actionBtn.previousElementSibling?.value || '');
      }
      if(action === 'clearRecordSearch') {
        Business.clearSearch();
        RecordView.clearSearch();
      }
      if(action === 'exportRecords') {
        Business.exportRecords();
      }
      if(action === 'importRecords') {
        Render.showImportDialog(() => {
          RecordView.renderRecordList();
          if(typeof FilterView !== 'undefined') FilterView.renderFilterList();
        });
      }
      if(action === 'refreshHotCold') {
        Business.refreshHotCold();
        PredictView.refreshHotCold();
      }
      if(action === 'showStatDetail') {
        const result = Business.showStatDetail(actionBtn.dataset.statType);
        if(result && result.statType) {
          AnalysisView.showStatDetail(result.statType);
        }
      }
      if(action === 'showStreakDetail') {
        const result = Business.showStreakDetail(actionBtn.dataset.streakType);
        if(result && result.streakType) {
          AnalysisView.showStreakDetail(result.streakType);
        }
      }
      if(action === 'toggleQuickNav') {
        Business.toggleQuickNav();
        AnalysisView.toggleQuickNav();
      }
      if(action === 'loadMoreRecords') {
        RecordView.loadMoreRecords();
      }
      if(action === 'toggleExcludeLock') {
        Business.toggleExcludeLock();
        ExcludeView.toggleExcludeLock();
      }
      if(action === 'openHistoryDetail') {
        const category = actionBtn.dataset.category;
        const result = Business.openHistoryDetail(category);
        if(result && result.category) {
          HistoryDetailView.render(result.category);
        }
      }
      if(action === 'backFromHistoryDetail') {
        Business.backFromHistoryDetail();
        HistoryDetailView.back();
      }
      if(action === 'deleteHistoryDetailRecord') {
        const result = Business.deleteHistoryDetailRecord(actionBtn.dataset.recordId);
        if(result && result.recordId) {
          const records = Storage.loadRecordHistory();
          const record = records.find(r => r.id == result.recordId);
          InputModal.confirm({
            title: '删除记录',
            message: `确定删除第 ${record ? record.expect || '--' : '--'} 期的记录吗？`,
            onConfirm: () => {
              HistoryDetailView.deleteRecord(result.recordId);
            }
          });
        }
      }
      if(action === 'showModeDetail') {
        const result = BusinessGemini.calc();
        if(result) {
          ViewZodiacPredict.showModeDetail(result);
        }
      }
      if(action === 'refreshHighChase') {
        MeView.refresh();
      }
      if(action === 'switchChaseTab') {
        const historyDetailPage = document.getElementById('historyDetailPage');
        if(historyDetailPage && historyDetailPage.style.display !== 'none') {
          HistoryDetailView.back();
        }
        const tab = actionBtn.dataset.tab;
        if(tab) {
          MeView.switchTab(tab);
        }
      }
      if(action === 'switchProbTab') {
        const tab = actionBtn.dataset.tab;
        if(tab) {
          ProbabilityView.switchTab(tab);
          MeView.render();
        }
      }
      if(action === 'showRhythmWindow') {
        const detail = BusinessZodiacTiers.getRhythmWindowDetail();
        if(detail) {
          Render.showRhythmWindowModal(detail);
        }
      }
      if(action === 'showHistoryDetail') {
        const detail = BusinessHighChase.getHistoryDetail();
        if(detail) {
          Render.showHistoryDetailModal(detail);
        }
      }
      if(action === 'refreshHistoryDetail') {
        Render.updateHistoryDetailModal();
      }
      return;
    }

    const analysisTabBtn = target.closest('.analysis-tab-btn[data-analysis-tab]');
    if(analysisTabBtn){
      const result = Business.switchAnalysisTab(analysisTabBtn.dataset.analysisTab);
      if(result) {
        AnalysisView.switchAnalysisTab(result);
        if(result === 'analysis') AnalysisView.renderFullAnalysis();
        if(result === 'zodiac') AnalysisView.renderZodiacAnalysis();
      }
      return;
    }

    const loadMoreBtn = target.closest('#loadMore');
    if(loadMoreBtn){
      const result = Business.loadMoreHistory();
      if(result) {
        AnalysisView.renderHistory();
        AnalysisView.showLoadMoreButton();
      }
      return;
    }

    const zodiacItem = target.closest('.zodiac-prediction-item[data-zodiac]');
    if(zodiacItem){
      const result = Business.showZodiacDetail(zodiacItem.dataset.zodiac);
      if(result && result.zodiac) {
        AnalysisView.showZodiacDetail(result.zodiac);
      }
      return;
    }

    const zodiacTotalItem = target.closest('#zodiacTotalGrid .data-item-z');
    if(zodiacTotalItem){
      const zodiacText = zodiacTotalItem.innerText.split('\n')[0];
      if(zodiacText) {
        const result = Business.showZodiacAppearDetail(zodiacText);
        if(result && result.zodiac) {
          AnalysisView.showZodiacAppearDetail(result.zodiac);
        }
      }
      return;
    }

    const selectedZodiacItem = target.closest('.selected-zodiac-item[data-zodiac]');
    if(selectedZodiacItem){
      const detailData = BusinessSpecial.showSelectedZodiacDetail(selectedZodiacItem.dataset.zodiac, selectedZodiacItem.dataset.index);
      if(detailData) {
        AnalysisView.showZodiacDetailModal(detailData);
      }
      return;
    }

    const quickBtn = target.closest('.quick-btn');
    if(quickBtn){
      const count = parseInt(quickBtn.dataset.count) || 1;
      const result = Business.quickLottery(count);
      if(result) {
        PredictView.quickLottery(count);
      }
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
      AnalysisView.toggleQuickNav(false);
    }
  },

  handleGlobalError: (e) => {
    Logger.error('全局错误', e.error || e.message || e);
    Toast.show('页面出现异常，请刷新重试');
  }
};

window.addEventListener('hashchange', () => {
  if (window.location.hash === '#random' || window.location.hash === '') {
    setTimeout(() => {
      RecordView.handleHashChangeToRandom();
    }, 100);
  }
});
