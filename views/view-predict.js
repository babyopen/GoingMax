/**
 * 预测推演页面视图
 * @description 预测推演相关的渲染逻辑
 */
const PredictView = {
  init: () => {
    PredictView.renderSpecialHistory();
    PredictView.renderZodiacPredictionHistory();
    PredictView.renderSmartHistory();
  },

  renderSpecialHistory: () => {
    try {
      const state = StateManager._state;
      const historyListEl = document.getElementById('specialHistoryList');
      const toggleEl = document.getElementById('specialHistoryToggle');
      
      if(!historyListEl) return;
      
      const history = state.specialHistory;
      const isExpanded = state.specialHistoryExpanded || false;
      
      if(!history || history.length === 0) {
        historyListEl.innerHTML = '<div style="text-align:center;color:var(--sub-text);padding:20px;font-size:13px;">暂无精选特码历史</div>';
        if(toggleEl) toggleEl.style.display = 'none';
        return;
      }
      
      const filteredHistory = history;
      const displayCount = isExpanded ? filteredHistory.length : Math.min(4, filteredHistory.length);
      const displayHistory = filteredHistory.slice(0, displayCount);
      
      let html = '';
      displayHistory.forEach((item, idx) => {
        const period = item.analyzeLimit;
        const periodText = item.selectedPeriodText || (period === 'all' || period >= 365 ? '全年数据' : `${period}期数据`);
        const numCount = item.numCount || item.numbers.length;
        const itemMode = item.mode || 'hot';
        const modeEmoji = itemMode === 'hot' ? '热' : '冷';
        
        let titleText = '';
        if(item.expect) {
          titleText = `第${item.expect}期`;
        }
        if(titleText) {
          titleText += ` · ${periodText}`;
        } else {
          titleText = periodText;
        }
        titleText += ` · ${numCount}个 · ${modeEmoji}`;
        
        let numbersHtml = '';
        item.numbers.forEach(num => {
          const isHit = item.hitNumbers && item.hitNumbers.includes(num);
          const tagClass = isHit ? 'history-tag hit' : 'history-tag';
          
          numbersHtml += `<span class="${tagClass}" style="cursor:pointer;">${String(num).padStart(2, '0')}</span>`;
        });
        
        let drawNumberHtml = '';
        if(item.drawResult !== null) {
          const isHit = item.hitCount > 0;
          const drawClass = isHit ? 'history-tag hit' : 'history-tag miss';
          
          drawNumberHtml = `<span class="${drawClass}" style="margin-left:auto;">${String(item.drawResult).padStart(2, '0')}</span>`;
        }
        
        html += `
          <div style="padding:12px;border-bottom:1px solid var(--border);background:var(--card);border-radius:8px;margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <div style="color:var(--sub-text);font-size:11px;">
                <span>${titleText}</span>
              </div>
            </div>
            <div style="display:flex;align-items:flex-start;gap:8px;">
              <div style="flex:1;min-width:0;">
                <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;">${numbersHtml}${drawNumberHtml}</div>
              </div>
            </div>
          </div>
        `;
      });

      historyListEl.innerHTML = html;
      
      if(toggleEl) {
        if(filteredHistory.length > 4) {
          toggleEl.style.display = 'block';
          const toggleBtn = toggleEl.querySelector('button');
          if(toggleBtn) {
            toggleBtn.innerText = isExpanded ? '收起' : `展开更多（还有${filteredHistory.length - 4}条）`;
          }
        } else {
          toggleEl.style.display = 'none';
        }
      }
    } catch(e) {
      Logger.error('渲染精选特码历史失败', e);
    }
  },

  renderZodiacPredictionHistory: () => {
    try {
      const historyListEl = document.getElementById('zodiacPredictionHistoryList');
      const toggleEl = document.getElementById('zodiacPredictionHistoryToggle');

      if(!historyListEl) return;

      const history = Storage.loadZodiacPredictionHistory();

      if(!history || history.length === 0) {
        historyListEl.innerHTML = '<div class="empty-tip">暂无预测历史</div>';
        if(toggleEl) toggleEl.style.display = 'none';
        return;
      }

      let html = '';
      history.slice(0, 5).forEach((item, idx) => {
        const periodText = item.analyzeLimit >= 365 ? '全年' : `${item.analyzeLimit}期`;
        const displayExpect = item.expect || '--';
        const historyTitle = item.title || '生肖预测';

        html += `
          <div style="padding:12px;border-bottom:1px solid var(--border);background:var(--card);border-radius:8px;margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <div style="color:var(--sub-text);font-size:11px;">
                <span>第${displayExpect}期预测 · ${periodText}</span>
              </div>
              <div style="color:var(--sub-text);font-size:11px;">
                ${new Date(item.timestamp).toLocaleDateString()}
              </div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
              ${(item.sortedZodiacs || []).slice(0, 4).map(([zod, score]) =>
                `<span style="padding:4px 8px;background:var(--bg-secondary);border-radius:6px;font-size:12px;">${zod}(${score}分)</span>`
              ).join('')}
            </div>
          </div>
        `;
      });

      historyListEl.innerHTML = html;
      
      if(toggleEl && history.length > 5) {
        toggleEl.style.display = 'block';
      } else if(toggleEl) {
        toggleEl.style.display = 'none';
      }
    } catch(e) {
      Logger.error('渲染预测历史失败', e);
    }
  },

  renderSmartHistory: () => {
    const historyEl = document.getElementById('smartHistory');
    if(!historyEl) return;

    const history = Storage.get('smartHistory', []);
    if(history.length === 0) {
      historyEl.innerHTML = '<div class="empty-tip">暂无历史记录</div>';
      return;
    }

    historyEl.innerHTML = history.map(item => `
      <div class="smart-history-item">
        <span class="smart-history-time">${new Date(item.timestamp).toLocaleTimeString()}</span>
        <span class="smart-history-count">${item.count}注</span>
        <span class="smart-history-result">${item.result.join(', ')}</span>
      </div>
    `).join('');
  },

  displayLotteryResult: (result) => {
    return;
  },

  toggleSpecialHistory: () => {
    BusinessPredict.toggleSpecialHistory();
    PredictView.renderSpecialHistory();
  },

  clearSpecialHistory: () => {
    BusinessPredict.clearSpecialHistory();
    PredictView.renderSpecialHistory();
    Toast.show('已清空精选特码历史');
  },

  clearSmartHistory: () => {
    Storage.set('smartHistory', []);
    Toast.show('已清空机选历史');
  },

  clearZodiacPredictionHistory: () => {
    Storage.clearZodiacPredictionHistory();
    PredictView.renderZodiacPredictionHistory();
    Toast.show('已清空预测历史');
  },

  toggleZodiacPredictionHistory: () => {
    const toggleEl = document.getElementById('zodiacPredictionHistoryToggle');
    if(!toggleEl) return;

    const panel = document.getElementById('zodiacPredictionHistoryList');
    if(!panel) return;

    const isHidden = panel.style.display === 'none';
    panel.style.display = isHidden ? 'block' : 'none';
    const btn = toggleEl.querySelector('button');
    if(btn) {
      btn.innerText = isHidden ? '收起' : '查看预测历史';
    }
  },

  switchSpecialHistoryMode: (mode) => {
    if(!['all', 'hot', 'cold'].includes(mode)) return;
    BusinessPredict.switchSpecialHistoryMode(mode);
    PredictView.renderSpecialHistory();
    const modeText = mode === 'all' ? '全部' : mode === 'hot' ? '热号模式' : '冷号反弹';
    Toast.show(`已筛选：${modeText}`);
  },

  toggleSpecialFiltersPanel: () => {
    PredictView.togglePanel('specialFiltersPanel', '切换精选特码筛选面板失败');
  },

  togglePredictionFiltersPanel: () => {
    PredictView.togglePanel('predictionFiltersPanel', '切换预测历史筛选面板失败');
  },

  togglePanel: (panelId, errorMsg) => {
    try {
      const panel = document.getElementById(panelId);
      if(panel) {
        panel.style.display = panel.style.display === 'none' || !panel.style.display ? 'block' : 'none';
      }
    } catch(e) {
      Logger.error(errorMsg || '切换面板失败', e);
    }
  },

  refreshHotCold: () => {
    DataQuery.buildNumList();
    FilterView.renderResult();
    Toast.show('冷热号已刷新');
  }
};
