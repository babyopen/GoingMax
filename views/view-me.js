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
      Logger.error('profilePage 容器未找到');
      return;
    }

    container.innerHTML = '<div class="empty-tip">加载中...</div>';

    const state = StateManager._state;
    const historyData = state.analysis.historyData;

    const needRefresh = BusinessAnalysis.needsDataRefresh(historyData);

    if(needRefresh) {
      Logger.debug('MeView.init - 数据过期，正在刷新...');
      try {
        const sortedData = await BusinessAnalysis.refreshHistory(true);
        if(sortedData && sortedData.length > 0) {
          Logger.debug('MeView.init - 数据刷新完成，共', sortedData.length, '条');
        }
      } catch(e) {
        Logger.error('MeView.init - 数据刷新失败', e);
      }
    }

    MeView._isInitializing = false;
    MeView.render();
  },

  render: () => {
    try {
      const container = document.getElementById('profilePage');
      if(!container) {
        Logger.error('profilePage 容器未找到');
        return;
      }

      BusinessBacktest.checkAll();

      container.innerHTML = '<div class="empty-tip">加载中...</div>';

      const highChaseData = BusinessHighChase.getStrategyData();
      if (highChaseData && highChaseData.chasePeriods) {
        BusinessBacktest.trackChase(highChaseData);
      }

      const html = `
        <div class="analysis-card">
          <div class="analysis-card-title-row">
            <div class="analysis-card-title" style="color:#FF6B35;">高频追号策略</div>
            <button class="btn-mini" data-action="refreshHighChase" style="background:var(--primary);color:#fff;">刷新</button>
          </div>
          <div class="high-chase-tabs">
            <div class="high-chase-tab ${MeView._currentTab === 'newfeature' ? 'active' : ''}" data-action="switchChaseTab" data-tab="newfeature">频率评级</div>
            <div class="high-chase-tab ${MeView._currentTab === 'chase' ? 'active' : ''}" data-action="switchChaseTab" data-tab="chase">追号计划</div>
            <div class="high-chase-tab ${MeView._currentTab === 'probability' ? 'active' : ''}" data-action="switchChaseTab" data-tab="probability">概率学</div>
            <div class="high-chase-tab ${MeView._currentTab === 'gemini' ? 'active' : ''}" data-action="switchChaseTab" data-tab="gemini">Gemini</div>
          </div>
          ${highChaseData.error ? `
            <div class="empty-tip" style="padding:30px 0;">
              ${highChaseData.error}
            </div>
          ` : (MeView._currentTab === 'newfeature' ? FrequencyRatingView.buildMeContent() : MeView._currentTab === 'chase' ? MeView._renderHighChaseContent(highChaseData) : MeView._currentTab === 'probability' ? MeView._renderProbabilityContent() : MeView._renderGeminiContent())}
        </div>
        <div class="me-info-card">
          <div class="me-info-row">
            <span class="me-info-label">版本信息</span>
            <span class="me-info-value">V26.2Beta3</span>
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
      Logger.error('MeView.render 错误:', e);
      const container = document.getElementById('profilePage');
      if(container) {
        container.innerHTML = '<div class="empty-tip" style="color:var(--danger);">渲染失败，请刷新</div>';
      }
    }
  },

  _renderHighChaseContent: (data) => {
    if(!data) {
      return '<div class="empty-tip">暂无数据</div>';
    }

    const algoMode = BusinessHighChase.getAlgorithmMode();
    const algoToggleBtn = `<button class="high-chase-algo-toggle ${algoMode}" data-action="toggle-algorithm-mode" title="切换推荐算法">${algoMode === 'enhanced' ? 'EMA' : '基础'}</button>`;

    if(data.action === 'paused' || data.action === 'paused_display') {
      const showRecommendation = data.action === 'paused_display' && data.recommendation?.length;
      
      if(showRecommendation) {
        const zodiacCards = data.recommendation.map((zodiac, idx) => {
          const display = BusinessHighChase.getZodiacDisplay(zodiac);
          return `
            <div class="high-chase-zodiac-card rank-${idx + 1}" style="opacity:0.7;">
              <div class="high-chase-zodiac-rank">${idx + 1}</div>
              <div class="high-chase-zodiac-icon">${display.icon}</div>
              <div class="high-chase-zodiac-name">${display.name}</div>
            </div>
          `;
        }).join('');
        
        return `
          <div class="high-chase-content">
            <div class="high-chase-market">
              <span class="high-chase-market-label">当前行情</span>
              <span class="high-chase-market-value" style="color:#9CA3AF;">${data.market || '冷市'}</span>
              ${algoToggleBtn}
            </div>
            <div class="high-chase-zodiac-grid" style="opacity:0.7;">
              ${zodiacCards}
            </div>
            <div class="high-chase-paused-warn" style="background:#1F1F1F;border-radius:8px;padding:16px;margin-top:12px;text-align:center;">
              <div style="color:#F59E0B;font-size:16px;margin-bottom:8px;">🛡️ 风控暂停中</div>
              <div style="color:#9CA3AF;font-size:13px;margin-bottom:8px;">可正常查看推荐，暂不开启关注</div>
              <div style="color:#6B7280;font-size:12px;">等待4期行情企稳后自动恢复</div>
            </div>
          </div>
        `;
      }
      
      return `
        <div class="high-chase-paused-tip" style="text-align:center;padding:20px 0;">
          <div style="font-size:24px;margin-bottom:8px;">🛑</div>
          <div style="color:var(--danger);font-size:16px;margin-bottom:4px;">${data.message || '风控暂停中'}</div>
          <div style="color:#9CA3AF;font-size:13px;">等待4期行情企稳后可恢复</div>
          <div style="margin-top:12px;color:${data.suggestion?.color === 'red' ? '#EF4444' : '#9CA3AF'};">
            ${data.suggestion?.reason || '连续错2组，触发风控'}
          </div>
        </div>
      `;
    }

    if(!data.recommendation || !data.recommendation.length) {
      return '<div class="empty-tip">暂无推荐数据</div>';
    }

    const marketColorMap = { hot: '#FF6B35', normal: '#F59E0B', shock: '#8B5CF6', cold: '#00A3E0' };
    const marketTextMap = { hot: '热市', normal: '温市', shock: '震荡市', cold: '冷市' };
    const marketColor = marketColorMap[data.market] || '#00A3E0';
    const marketText = marketTextMap[data.market] || '冷市';
    const cycleStageMap = { early: '初期', mid: '中期', late: '尾声' };
    const cycleStageText = cycleStageMap[data.cycleStage] || '初期';
    const cycleStageColor = data.cycleStage === 'late' ? '#EF4444' : data.cycleStage === 'mid' ? '#F59E0B' : '#9CA3AF';
    const suggestionColor = data.suggestion.color === 'green' ? '#22C55E' :
                           data.suggestion.color === 'yellow' ? '#F59E0B' :
                           data.suggestion.color === 'red' ? '#EF4444' : '#9CA3AF';

    const zodiacCards = data.recommendation.map((zodiac, idx) => {
      const display = BusinessHighChase.getZodiacDisplay(zodiac);
      return `
        <div class="high-chase-zodiac-card rank-${idx + 1}">
          <div class="high-chase-zodiac-rank">${idx + 1}</div>
          <div class="high-chase-zodiac-icon">${display.icon}</div>
          <div class="high-chase-zodiac-name">${display.name}</div>
        </div>
      `;
    }).join('');

    let backupZodiacCards = '';
    if(data.backupRecommendation && data.backupRecommendation.length > 0) {
      backupZodiacCards = data.backupRecommendation.map((zodiac, idx) => {
        const display = BusinessHighChase.getZodiacDisplay(zodiac);
        return `
          <div class="high-chase-zodiac-card rank-backup-${idx + 1}" style="opacity:0.6;border:1px dashed #6B7280;">
            <div class="high-chase-zodiac-rank" style="color:#6B7280;">备${idx + 1}</div>
            <div class="high-chase-zodiac-icon">${display.icon}</div>
            <div class="high-chase-zodiac-name">${display.name}</div>
          </div>
        `;
      }).join('');
    }

    let chasePeriodsHtml = '';
    if(data.chasePeriods && data.chasePeriods.length > 0) {
      chasePeriodsHtml = MeView._renderChasePeriods(data.chasePeriods);
    }

    return `
      <div class="high-chase-content">
        <div class="high-chase-market">
          <span class="high-chase-market-label">当前行情</span>
          <span class="high-chase-market-value" style="color:${marketColor}">${marketText}</span>
          <span class="high-chase-cycle-stage" style="color:${cycleStageColor}">(${cycleStageText})</span>
          ${algoToggleBtn}
        </div>
        <div class="high-chase-zodiac-grid">
          ${zodiacCards}
        </div>
        ${backupZodiacCards ? `
        <div class="high-chase-backup-section" style="margin-top:12px;padding-top:12px;border-top:1px dashed #374151;">
          <div style="color:#6B7280;font-size:12px;margin-bottom:8px;">备选方案（仅供参考，不参与关注）</div>
          <div class="high-chase-zodiac-grid" style="opacity:0.6;">
            ${backupZodiacCards}
          </div>
        </div>
        ` : ''}
        <div class="high-chase-params">
          <div class="high-chase-param-item high-chase-param-clickable" data-action="showHistoryDetail">
            <span class="high-chase-param-label">统计期数</span>
            <span class="high-chase-param-value">${data.periodLen || 0}期</span>
          </div>
          <div class="high-chase-param-item">
            <span class="high-chase-param-label">高频阈值</span>
            <span class="high-chase-param-value">≥${data.adjustedThreshold || data.threshold || 0}</span>
          </div>
          <div class="high-chase-param-item">
            <span class="high-chase-param-label">追号期数</span>
            <span class="high-chase-param-value">${data.maxAttempts || 0}期</span>
          </div>
          ${data.currentPeriodIndex !== undefined ? `
          <div class="high-chase-progress-container" style="grid-column:1/-1;margin-top:8px;">
            <div class="high-chase-progress-label" style="display:flex;justify-content:space-between;font-size:12px;color:#9CA3AF;margin-bottom:4px;">
              <span>追号进度</span>
              <span>第${(data.currentPeriodIndex || 0) + 1}/${data.maxAttempts || 0}期</span>
            </div>
            <div class="high-chase-progress-bar" style="height:8px;background:#374151;border-radius:4px;overflow:hidden;">
              <div class="high-chase-progress-fill" style="height:100%;width:${((data.currentPeriodIndex || 0) / (data.maxAttempts || 1)) * 100}%;background:${data.market === 'hot' ? '#FF6B35' : data.market === 'cold' ? '#00A3E0' : '#F59E0B'};border-radius:4px;transition:width 0.3s;"></div>
            </div>
          </div>
          ` : ''}
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
        ${MeView._renderChaseBacktest()}
      </div>
    `;
  },

  _renderChaseBacktest: () => {
    if (typeof BusinessBacktest === 'undefined') return '';

    const stats = BusinessBacktest.getChaseStats();
    const records = BusinessBacktest.getChaseRecords(5);

    if (stats.total === 0) return '';

    const ALGO_LABELS = { enhanced: 'EMA', legacy: '基础' };

    const rateClass = stats.combinedRate >= 50 ? 'gemini-bt-rate-good' : stats.combinedRate >= 30 ? 'gemini-bt-rate-mid' : 'gemini-bt-rate-low';
    const mainRateClass = stats.mainRate >= 50 ? 'gemini-bt-rate-good' : stats.mainRate >= 30 ? 'gemini-bt-rate-mid' : 'gemini-bt-rate-low';
    let html = '<div class="gemini-section" style="margin-top:12px;">'
      + '<div class="gemini-section-title">追号回测追踪</div>'
      + '<div class="gemini-bt-stats">'
      + '<div class="gemini-bt-stat-item">'
      + '<div class="gemini-bt-stat-value ' + rateClass + '">' + stats.combinedRate + '%</div>'
      + '<div class="gemini-bt-stat-label">主+备命中率</div>'
      + '</div>'
      + '<div class="gemini-bt-stat-item">'
      + '<div class="gemini-bt-stat-value ' + mainRateClass + '">' + stats.mainRate + '%</div>'
      + '<div class="gemini-bt-stat-label">主方案命中率</div>'
      + '</div>'
      + '<div class="gemini-bt-stat-item">'
      + '<div class="gemini-bt-stat-value">' + stats.total + '</div>'
      + '<div class="gemini-bt-stat-label">已验证期数</div>'
      + '</div>'
      + '</div>';

    if (stats.recent10) {
      html += '<div class="gemini-bt-recent">'
        + '<span>近10期: </span>'
        + '<span class="' + rateClass + '">' + (stats.recent10.mainHit + stats.recent10.backupHit) + '/' + stats.recent10.total + ' (' + stats.recent10.rate + '%)</span>'
        + '</div>';
    }

    if (stats.byAlgorithm && Object.keys(stats.byAlgorithm).length > 0) {
      html += '<div class="gemini-bt-algo-stats">';
      Object.keys(stats.byAlgorithm).forEach(algo => {
        const a = stats.byAlgorithm[algo];
        const label = ALGO_LABELS[algo] || algo;
        const algoClass = algo === 'enhanced' ? 'gemini-bt-algo-ema' : 'gemini-bt-algo-legacy';
        html += '<div class="gemini-bt-algo-item ' + algoClass + '">'
          + '<span class="gemini-bt-algo-label">' + label + '</span>'
          + '<span class="gemini-bt-algo-rate">' + a.combinedRate + '%</span>'
          + '<span class="gemini-bt-algo-detail">' + a.combinedHit + '/' + a.total + '</span>'
          + '</div>';
      });
      html += '</div>';
    }

    if (records.length > 0) {
      html += '<div class="gemini-bt-records">'
        + '<div class="gemini-bt-records-title">最近验证记录</div>';
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        const hitTag = r.isHit ? '<span class="gemini-bt-tag gemini-bt-tag-hit">主中</span>'
          : r.isBackupHit ? '<span class="gemini-bt-tag gemini-bt-tag-backup">备中</span>'
          : '<span class="gemini-bt-tag gemini-bt-tag-miss">未中</span>';
        const algoTag = r.algorithmMode
          ? '<span class="gemini-bt-algo-tag ' + (r.algorithmMode === 'enhanced' ? 'gemini-bt-algo-ema' : 'gemini-bt-algo-legacy') + '">' + (ALGO_LABELS[r.algorithmMode] || r.algorithmMode) + '</span>'
          : '';
        const backupHtml = r.backupRecommendation && r.backupRecommendation.length > 0 
          ? ' <span class="gemini-bt-record-backup">备:' + r.backupRecommendation.join('/') + '</span>' 
          : '';
        html += '<div class="gemini-bt-record">'
          + '<span class="gemini-bt-record-expect">' + r.expect + '期</span>'
          + algoTag
          + '<span class="gemini-bt-record-zodiac">开奖:' + (r.actualZodiac || '-') + '</span>'
          + '<span class="gemini-bt-record-predict">主:' + r.recommendation.join('/') + '</span>'
          + backupHtml
          + hitTag
          + '</div>';
      }
      html += '</div>';
    }

    html += '</div>';
    return html;
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
            <div class="high-chase-history-record-date">${record.completedAt || '--'} · ${({ hot: '热市', normal: '温市', shock: '震荡市', cold: '冷市' })[record.market] || record.market}</div>
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

  _renderChasePeriods: (chasePeriods) => {
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
      } else if(period.status === 'skipped') {
        statusIcon = '➖';
        statusColor = 'var(--sub-text, #9CA3AF)';
        statusText = period.hitResult || '-';
      } else {
        statusIcon = '⏳';
        statusColor = 'var(--warning, #F59E0B)';
        statusText = '待开奖';
      }

      const openedZodiac = period.hitZodiac;
      const isHit = period.status === 'hit';
      const buttonsHtml = (period.recommendation || []).map((zodiac, i) => {
        const topClass = i === 0 ? 'top-1' : (i === 1 ? 'top-2' : (i === 2 ? 'top-3' : ''));
        const hitClass = openedZodiac && zodiac === openedZodiac ? 'hit-blue' : (period.status === 'miss' && !isHit ? '' : '');
        return `<div class="zodiac-btn ${topClass} ${hitClass}">${zodiac}</div>`;
      }).join('');

      return `
        <div class="chase-period-item ${period.status || 'pending'}">
          <div class="chase-period-expect">${period.expect}期</div>
          <div class="chase-period-zodiacs">
            <div class="zodiac-buttons-row">
              ${buttonsHtml}
            </div>
          </div>
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
        <div class="chase-periods-title-row">
          <div class="chase-periods-title">追号计划</div>
          <div class="high-chase-tab" data-action="openHistoryDetail" data-category="high-chase">历史记录</div>
        </div>
        <div class="chase-periods-list">
          ${periodItems}
        </div>
      </div>
    `;
  },

  _renderProbabilityContent: () => {
    return ProbabilityView.buildHtml('openHistoryDetail');
  },

  _renderGeminiContent: () => {
    return GeminiView.buildHtml();
  },

  refresh: () => {
    if(MeView._isRefreshing) return;
    MeView._isRefreshing = true;
    try {
      MeView.render();
      Toast.show('数据已刷新');
    } catch(e) {
      Logger.error('MeView.refresh 错误:', e);
      Toast.show('刷新失败');
    } finally {
      setTimeout(() => { MeView._isRefreshing = false; }, 500);
    }
  }
};