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
      console.error('渲染精选特码历史失败', e);
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
      console.error('渲染预测历史失败', e);
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
    const resultEl = document.getElementById('lotteryResult');
    if(!resultEl) return;

    resultEl.innerHTML = result.map(n => `
      <div class="result-ball" data-num="${n.num}">
        <div class="ball ${n.color}">${n.s}</div>
        <div class="tag-zodiac">${n.zodiac}</div>
      </div>
    `).join('');
  },

  showCopyDialog: (numStr) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5); z-index: 10000;
      display: flex; align-items: center; justify-content: center;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #fff; border-radius: 8px; width: 90%; max-width: 360px;
      padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    modal.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 12px;">请手动复制号码</div>
      <div style="
        background: #f5f5f5; padding: 12px; border-radius: 8px;
        word-break: break-all; font-size: 14px; line-height: 1.6;
        margin-bottom: 16px; max-height: 200px; overflow-y: auto;
      ">${numStr}</div>
      <button class="btn-primary" style="
        width: 100%; padding: 12px; border: none; border-radius: 8px;
        background: var(--primary); color: #fff; font-size: 14px;
        cursor: pointer;
      ">我知道了</button>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    modal.querySelector('button').addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    overlay.addEventListener('click', (e) => {
      if(e.target === overlay) document.body.removeChild(overlay);
    });
  },

  toggleSpecialHistory: () => {
    const state = StateManager._state;
    const newExpanded = !(state.specialHistoryExpanded || false);
    StateManager.setState({ specialHistoryExpanded: newExpanded }, false);
    PredictView.renderSpecialHistory();
  },

  clearSpecialHistory: () => {
    if(confirm('确定要清空精选特码历史吗？此操作不可恢复。')) {
      StateManager.setState({ specialHistory: [] }, false);
      Storage.saveSpecialHistory([]);
      PredictView.renderSpecialHistory();
      Toast.show('已清空精选特码历史');
    }
  },

  clearSmartHistory: () => {
    if(confirm('确定要清空机选历史吗？此操作不可恢复。')) {
      Storage.set('smartHistory', []);
      PredictView.renderSmartHistory();
      Toast.show('已清空机选历史');
    }
  },

  clearZodiacPredictionHistory: () => {
    if(confirm('确定要清空预测历史吗？此操作不可恢复。')) {
      Storage.clearZodiacPredictionHistory();
      PredictView.renderZodiacPredictionHistory();
      Toast.show('已清空预测历史');
    }
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
    
    const state = StateManager._state;
    const currentMode = state.specialHistoryModeFilter || 'all';
    
    if(currentMode === mode) return;
    
    StateManager.setState({ specialHistoryModeFilter: mode }, false);
    
    document.querySelectorAll('.special-history-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    PredictView.renderSpecialHistory();
    
    const modeText = mode === 'all' ? '全部' : mode === 'hot' ? '热号模式' : '冷号反弹';
    Toast.show(`已筛选：${modeText}`);
  },

  selectAllSpecialFilters: () => {
    const periodBtns = document.querySelectorAll('.special-period-btn');
    const numBtns = document.querySelectorAll('.special-num-btn');
    
    ['10', '20', '30', 'all'].forEach(val => {
      periodBtns.forEach(btn => {
        if(btn.dataset.period === val) {
          btn.classList.add('active');
          btn.style.background = 'var(--primary)';
          btn.style.color = '#fff';
        }
      });
    });
    
    ['5', '10', '15', '20'].forEach(val => {
      numBtns.forEach(btn => {
        if(btn.dataset.num === val) {
          btn.classList.add('active');
          btn.style.background = 'var(--primary)';
          btn.style.color = '#fff';
        }
      });
    });
    
    PredictView.renderSpecialHistory();
    PredictView.togglePanel('specialFiltersPanel');
  },

  resetSpecialFilters: () => {
    const periodBtns = document.querySelectorAll('.special-period-btn');
    const numBtns = document.querySelectorAll('.special-num-btn');
    
    periodBtns.forEach(btn => {
      btn.classList.remove('active');
      btn.style.background = '';
      btn.style.color = '';
      if(btn.dataset.period === '10') {
        btn.classList.add('active');
        btn.style.background = 'var(--primary)';
        btn.style.color = '#fff';
      }
    });
    
    numBtns.forEach(btn => {
      btn.classList.remove('active');
      btn.style.background = '';
      btn.style.color = '';
      if(btn.dataset.num === '5') {
        btn.classList.add('active');
        btn.style.background = 'var(--primary)';
        btn.style.color = '#fff';
      }
    });
    
    PredictView.renderSpecialHistory();
    PredictView.togglePanel('specialFiltersPanel');
  },

  confirmSpecialFilters: () => {
    PredictView.renderSpecialHistory();
    PredictView.togglePanel('specialFiltersPanel');
  },

  toggleSpecialFiltersPanel: () => {
    PredictView.togglePanel('specialFiltersPanel', '切换精选特码筛选面板失败');
  },

  selectAllPredictionPeriods: () => {
    const btns = document.querySelectorAll('.prediction-period-btn');
    btns.forEach(btn => {
      btn.classList.add('active');
      btn.style.background = 'var(--primary)';
      btn.style.color = '#fff';
    });
    Storage.savePredictionHistoryFilter();
    PredictView.renderZodiacPredictionHistory();
    PredictView.togglePanel('predictionFiltersPanel');
  },

  resetPredictionPeriods: () => {
    const btns = document.querySelectorAll('.prediction-period-btn');
    btns.forEach(btn => {
      btn.classList.remove('active');
      btn.style.background = '';
      btn.style.color = '';
      if(btn.dataset.period === '10') {
        btn.classList.add('active');
        btn.style.background = 'var(--primary)';
        btn.style.color = '#fff';
      }
    });
    Storage.savePredictionHistoryFilter();
    PredictView.renderZodiacPredictionHistory();
    PredictView.togglePanel('predictionFiltersPanel');
  },

  confirmPredictionFilters: () => {
    Storage.savePredictionHistoryFilter();
    PredictView.renderZodiacPredictionHistory();
    PredictView.togglePanel('predictionFiltersPanel');
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
      console.error(errorMsg || '切换面板失败', e);
    }
  },

  refreshHotCold: () => {
    DataQuery.buildNumList();
    FilterView.renderResult();
    Toast.show('冷热号已刷新');
  },

  quickLottery: (count) => {
    const filteredList = Filter.getFilteredList();
    if(filteredList.length === 0) {
      Toast.show('没有符合条件的号码');
      return;
    }

    const result = [];
    const shuffled = [...filteredList].sort(() => Math.random() - 0.5);

    for(let i = 0; i < Math.min(count, shuffled.length); i++) {
      result.push(shuffled[i]);
    }

    PredictView.displayLotteryResult(result);

    const smartHistory = Storage.get('smartHistory', []);
    smartHistory.unshift({
      timestamp: Date.now(),
      count: result.length,
      result: result.map(n => n.s)
    });
    if(smartHistory.length > 50) smartHistory.length = 50;
    Storage.set('smartHistory', smartHistory);
    PredictView.renderSmartHistory();
  },

  runLottery: () => {
    const countInput = document.getElementById('lotteryCount');
    const count = countInput ? parseInt(countInput.value) || 5 : 5;
    PredictView.quickLottery(count);
  },

  excludeLotteryResult: () => {
    const resultEl = document.getElementById('lotteryResult');
    if(!resultEl) return;

    const balls = resultEl.querySelectorAll('.result-ball');
    if(balls.length === 0) {
      Toast.show('没有机选结果可以排除');
      return;
    }

    const state = StateManager._state;
    const newExcluded = [...state.excluded];
    const newHistory = [...state.excludeHistory];

    balls.forEach(ball => {
      const num = parseInt(ball.dataset.num);
      if(!newExcluded.includes(num)) {
        newExcluded.push(num);
        newHistory.push([num, 'in']);
      }
    });

    StateManager.setState({ excluded: newExcluded, excludeHistory: newHistory });
    Toast.show(`已排除${balls.length}个号码`);
  }
};
