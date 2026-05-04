/**
 * 我的页面视图
 * @description 我的页面渲染逻辑，包含高频追号策略模块
 */
const MeView = {
  _isRefreshing: false,
  _isInitializing: false,
  _currentTab: 'chase',

  init: async () => {
    if(MeView._isInitializing) return;
    MeView._isInitializing = true;

    const container = document.getElementById('profilePage');
    if(!container) {
      console.error('profilePage 容器未找到');
      return;
    }

    container.innerHTML = '<div class="empty-tip">加载中...</div>';

    const state = StateManager._state;
    const historyData = state.analysis.historyData;

    const needRefresh = MeView._needRefreshData(historyData);

    if(needRefresh) {
      console.log('MeView.init - 数据过期，正在刷新...');
      try {
        const sortedData = await BusinessAnalysis.refreshHistory(true);
        if(sortedData && sortedData.length > 0) {
          console.log('MeView.init - 数据刷新完成，共', sortedData.length, '条');
        }
      } catch(e) {
        console.error('MeView.init - 数据刷新失败', e);
      }
    }

    MeView._isInitializing = false;
    MeView.render();
  },

  _needRefreshData: (historyData) => {
    console.log('MeView._needRefreshData - historyData长度:', historyData?.length);
    console.log('MeView._needRefreshData - 最新期号:', historyData?.[0]?.expect);

    if(!historyData || historyData.length === 0) {
      console.log('MeView._needRefreshData - 数据为空，需要刷新');
      return true;
    }

    const latestExpect = historyData[0]?.expect || '';
    const currentYear = String(new Date().getFullYear());

    console.log('MeView._needRefreshData - 当前年份:', currentYear, '最新期号开头:', latestExpect.substring(0, 4));

    if(!latestExpect.startsWith(currentYear)) {
      console.log('MeView._needRefreshData - 期号年份不匹配，需要刷新');
      return true;
    }

    const cacheTime = Storage.get(Storage.KEYS.HISTORY_CACHE_TIME, 0);
    const now = Date.now();
    const fourHours = 4 * 60 * 60 * 1000;
    console.log('MeView._needRefreshData - 缓存时间:', new Date(cacheTime).toLocaleString(), '距今:', Math.round((now - cacheTime) / 1000 / 60), '分钟');

    if(now - cacheTime > fourHours) {
      console.log('MeView._needRefreshData - 缓存过期，需要刷新');
      return true;
    }

    console.log('MeView._needRefreshData - 数据有效，不需要刷新');
    return false;
  },

  render: () => {
    try {
      const container = document.getElementById('profilePage');
      if(!container) {
        console.error('profilePage 容器未找到');
        return;
      }

      container.innerHTML = '<div class="empty-tip">加载中...</div>';

      const highChaseData = BusinessHighChase.getStrategyData();

      const html = `
        <div class="analysis-card">
          <div class="analysis-card-title-row">
            <div class="analysis-card-title" style="color:#FF6B35;">高频追号策略</div>
            <button class="btn-mini" data-action="refreshHighChase" style="background:var(--primary);color:#fff;">刷新</button>
          </div>
          <div class="high-chase-tabs">
            <div class="high-chase-tab ${MeView._currentTab === 'chase' ? 'active' : ''}" data-action="switchChaseTab" data-tab="chase">追号计划</div>
            <div class="high-chase-tab ${MeView._currentTab === 'history' ? 'active' : ''}" data-action="switchChaseTab" data-tab="history">历史记录</div>
          </div>
          ${highChaseData.error ? `
            <div class="empty-tip" style="padding:30px 0;">
              ${highChaseData.error}
            </div>
          ` : (MeView._currentTab === 'chase' ? MeView._renderHighChaseContent(highChaseData) : MeView._renderHistoryContent())}
        </div>
        <div class="me-info-card">
          <div class="me-info-row">
            <span class="me-info-label">版本信息</span>
            <span class="me-info-value">V26.2Beta</span>
          </div>
          <div class="me-info-row">
            <span class="me-info-label">数据来源</span>
            <span class="me-info-value">历史开奖</span>
          </div>
        </div>
        <div class="disclaimer">仅供娱乐，非投注建议</div>
      `;

      container.innerHTML = html;
    } catch(e) {
      console.error('MeView.render 错误:', e);
      const container = document.getElementById('profilePage');
      if(container) {
        container.innerHTML = '<div class="empty-tip" style="color:var(--danger);">渲染失败，请刷新</div>';
      }
    }
  },

  _renderHighChaseContent: (data) => {
    if(!data || !data.recommendation || !data.recommendation.length) {
      return '<div class="empty-tip">暂无推荐数据</div>';
    }

    const marketColor = data.market === 'hot' ? '#FF6B35' : '#00A3E0';
    const marketText = data.market === 'hot' ? '热市' : '冷市';
    const suggestionColor = data.suggestion.color === 'green' ? '#22C55E' :
                           data.suggestion.color === 'yellow' ? '#F59E0B' :
                           data.suggestion.color === 'red' ? '#EF4444' : '#9CA3AF';

    const zodiacCards = data.recommendation.map((zodiac, idx) => {
      const display = BusinessHighChase.getZodiacDisplay(zodiac);
      const numbers = BusinessHighChase.getZodiacNumbers([zodiac]);
      const numbersStr = numbers.length > 0 ? numbers.map(n => String(n).padStart(2, '0')).join(' ') : '--';
      return `
        <div class="high-chase-zodiac-card rank-${idx + 1}">
          <div class="high-chase-zodiac-rank">${idx + 1}</div>
          <div class="high-chase-zodiac-icon">${display.icon}</div>
          <div class="high-chase-zodiac-name">${display.name}</div>
          <div class="high-chase-zodiac-nums">${numbersStr}</div>
        </div>
      `;
    }).join('');

    let chasePeriodsHtml = '';
    if(data.chasePeriods && data.chasePeriods.length > 0) {
      chasePeriodsHtml = MeView._renderChasePeriods(data.chasePeriods, data.recommendation);
    }

    return `
      <div class="high-chase-content">
        <div class="high-chase-market">
          <span class="high-chase-market-label">当前行情</span>
          <span class="high-chase-market-value" style="color:${marketColor}">${marketText}</span>
        </div>
        <div class="high-chase-zodiac-grid">
          ${zodiacCards}
        </div>
        <div class="high-chase-params">
          <div class="high-chase-param-item high-chase-param-clickable" data-action="showHistoryDetail">
            <span class="high-chase-param-label">统计期数</span>
            <span class="high-chase-param-value">${data.periodLen || 0}期</span>
          </div>
          <div class="high-chase-param-item">
            <span class="high-chase-param-label">高频阈值</span>
            <span class="high-chase-param-value">≥${data.threshold || 0}</span>
          </div>
          <div class="high-chase-param-item">
            <span class="high-chase-param-label">追号期数</span>
            <span class="high-chase-param-value">${data.maxAttempts || 0}期</span>
          </div>
        </div>
        ${chasePeriodsHtml}
        <div class="high-chase-confidence">
          <div class="high-chase-confidence-label">信心评分</div>
          <div class="high-chase-confidence-value">${data.confidenceScore || 0}分</div>
          <div class="high-chase-confidence-bar">
            <div class="high-chase-confidence-fill" style="width:${data.confidenceScore || 0}%"></div>
          </div>
        </div>
        <div class="high-chase-suggestion" style="border-left:3px solid ${suggestionColor};">
          <div class="high-chase-suggestion-action" style="color:${suggestionColor}">${data.suggestion?.action || '未知'}</div>
          <div class="high-chase-suggestion-reason">${data.suggestion?.reason || ''}</div>
        </div>
        <div class="high-chase-risk">
          <span class="high-chase-risk-label">风控状态</span>
          <span class="high-chase-risk-value ${data.riskStatus?.isPaused ? 'paused' : ''}">${data.riskStatus?.isPaused ? '暂停中' : '正常'}</span>
        </div>
      </div>
    `;
  },

  switchTab: (tab) => {
    MeView._currentTab = tab;
    MeView.render();
  },

  _renderHistoryContent: () => {
    const historyData = BusinessHighChase.getHistoryRecords();
    if(!historyData || !historyData.records || historyData.records.length === 0) {
      return `
        <div class="high-chase-history-empty">
          <div class="high-chase-history-empty-icon">📊</div>
          <div class="high-chase-history-empty-text">暂无历史记录</div>
          <div class="high-chase-history-empty-hint">完成追号计划后会自动记录</div>
        </div>
      `;
    }

    const stats = historyData.stats;
    const accuracyColor = stats.overallAccuracy >= 60 ? '#22C55E' : 
                         stats.overallAccuracy >= 40 ? '#F59E0B' : '#EF4444';

    let statsHtml = `
      <div class="high-chase-history-stats">
        <div class="high-chase-history-stat-item">
          <div class="high-chase-history-stat-value">${stats.last10Plans}</div>
          <div class="high-chase-history-stat-label">完成计划</div>
        </div>
        <div class="high-chase-history-stat-item">
          <div class="high-chase-history-stat-value" style="color:${accuracyColor}">${stats.last10Accuracy}%</div>
          <div class="high-chase-history-stat-label">近10期正确率</div>
        </div>
        <div class="high-chase-history-stat-item">
          <div class="high-chase-history-stat-value">${stats.last10Hits}/${stats.last10Periods}</div>
          <div class="high-chase-history-stat-label">命中/总期数</div>
        </div>
      </div>
    `;

    let recordsHtml = historyData.records.map(record => {
      const accuracyColor = record.accuracy >= 60 ? '#22C55E' : 
                           record.accuracy >= 33 ? '#F59E0B' : '#EF4444';
      
      const periodsHtml = record.periods.map(p => {
        let statusClass = p.status || 'pending';
        let statusIcon = p.status === 'hit' ? '✅' : p.status === 'miss' ? '❌' : '⏳';
        return `
          <div class="history-period-item ${statusClass}">
            <span class="history-period-expect">${p.expect}</span>
            <span class="history-period-rec">${p.recommendation.join('、')}</span>
            <span class="history-period-status">${statusIcon} ${p.hitResult || '-'}</span>
            ${p.hitZodiac ? `<span class="history-period-opened">开${p.hitZodiac}</span>` : ''}
          </div>
        `;
      }).join('');

      return `
        <div class="high-chase-history-record">
          <div class="high-chase-history-record-header">
            <div class="high-chase-history-record-date">${record.completedAt || '--'} · ${record.market === 'hot' ? '热市' : '冷市'}</div>
            <div class="high-chase-history-record-accuracy" style="color:${accuracyColor}">${record.accuracy}%</div>
          </div>
          <div class="high-chase-history-record-periods">
            ${periodsHtml}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="high-chase-history-content">
        ${statsHtml}
        <div class="high-chase-history-records">
          <div class="high-chase-history-records-title">历史计划</div>
          ${recordsHtml}
        </div>
      </div>
    `;
  },

  _renderChasePeriods: (chasePeriods, recommendation) => {
    const recText = recommendation.join('、');
    
    const periodItems = chasePeriods.map((period, idx) => {
      let statusIcon = '';
      let statusColor = '';
      let statusText = '';

      if(period.status === 'hit') {
        statusIcon = '✅';
        statusColor = 'var(--success, #22C55E)';
        statusText = period.hitResult || '命中';
      } else if(period.status === 'miss') {
        statusIcon = '❌';
        statusColor = 'var(--danger, #EF4444)';
        statusText = period.hitResult || '未中';
      } else {
        statusIcon = '⏳';
        statusColor = 'var(--warning, #F59E0B)';
        statusText = '待开奖';
      }

      return `
        <div class="chase-period-item ${period.status || 'pending'}">
          <div class="chase-period-expect">${period.expect}期</div>
          <div class="chase-period-zodiacs">${recText}</div>
          <div class="chase-period-result" style="color:${statusColor}">
            <span class="chase-period-status-icon">${statusIcon}</span>
            <span class="chase-period-status-text">${statusText}</span>
            ${period.hitZodiac ? `<span class="chase-period-opened">开出:${period.hitZodiac}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="chase-periods-section">
        <div class="chase-periods-title">追号计划</div>
        <div class="chase-periods-list">
          ${periodItems}
        </div>
      </div>
    `;
  },

  refresh: () => {
    if(MeView._isRefreshing) return;
    MeView._isRefreshing = true;
    try {
      MeView.render();
      Toast.show('数据已刷新');
    } catch(e) {
      console.error('MeView.refresh 错误:', e);
      Toast.show('刷新失败');
    } finally {
      setTimeout(() => { MeView._isRefreshing = false; }, 500);
    }
  }
};