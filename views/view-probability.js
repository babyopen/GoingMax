/**
 * 概率学页面视图 - 生肖冷热分级系统展示
 * @layer view (仅渲染DOM,无业务计算)
 */
const ProbabilityView = {
  _expandedTiers: { hot: true, warm: true, edge: true, cold: true },
  _currentTab: 'recommend',

  _getTierIcon: (tier) => {
    const icons = { hot: '🔥', warm: '🌡', edge: '🧊', cold: '🧊🧊' };
    return icons[tier] || '';
  },

  _getTierLabel: (tier) => {
    const labels = { hot: '高频轮动', warm: '穿插活跃', edge: '边缘', cold: '独冷' };
    return labels[tier] || tier;
  },

  _getPhaseColor: (phase) => {
    const colors = { hot: '#ff6b6b', cooling: '#ffa94d', cold_break: '#74c0fc' };
    return colors[phase] || '#868e96';
  },

  _getPhaseLabel: (phase) => {
    const labels = { hot: '热态', cooling: '降温', cold_break: '冷态破冰' };
    return labels[phase] || phase;
  },

  _getDataSourceText: () => {
    const currentYear = BusinessZodiacTiers._getCurrentYear();
    const source = BusinessZodiacTiers._historySource;
    const yearCount = BusinessZodiacTiers._historyYearCount || 0;
    const totalCount = BusinessZodiacTiers._historyTotalCount || 0;
    
    if(source === 'year') {
      return `${currentYear}年数据 (${yearCount}期)`;
    } else {
      return `最近${totalCount}期 (跨年)`;
    }
  },

  render: () => {
    const container = document.getElementById('probabilityContent');
    if (!container) return;
    container.innerHTML = ProbabilityView.buildHtml('switchProbTab');
  },

  buildHtml: (historyAction = 'switchProbTab') => {
    BusinessBacktest.checkAll();

    const analysisResult = BusinessZodiacTiers.runFullAnalysis();
    if(!analysisResult) {
      return '<div class="probability-empty"><div class="probability-empty-icon">❌</div><div class="probability-empty-text">分析失败</div></div>';
    }

    BusinessBacktest.trackProbability(analysisResult);

    const { tiers, silent, phase, strategy, recommend, recommendScores, rhythmWindow, turnoverRate, stats, signals, hitRate } = analysisResult;
    
    if(recommend && recommend.length > 0) {
      BusinessProbabilityHistory.setCurrentRecommend(recommend, recommendScores);
    }
    
    const dataSourceText = ProbabilityView._getDataSourceText();

    let html = '';
    
    const latestExpect = BusinessZodiacTiers._getLatestExpect();
    const recommendExpect = latestExpect ? String(parseInt(latestExpect) + 1) : '--';

    html += `<div class="prob-header">`;
    html += `<div class="prob-header-top">`;
    html += `<div class="prob-title">生肖冷热分级系统</div>`;
    html += `<div class="prob-update-time">基于 ${dataSourceText}</div>`;
    html += `</div>`;
    
    html += `<div class="prob-phase-card" style="border-left: 4px solid ${ProbabilityView._getPhaseColor(phase)}">`;
    html += `<div class="prob-phase-label">当前阶段</div>`;
    html += `<div class="prob-phase-value" style="color: ${ProbabilityView._getPhaseColor(phase)}">${ProbabilityView._getPhaseLabel(phase)}</div>`;
    html += `<div class="prob-phase-expect">推荐期数: ${recommendExpect}期</div>`;
    html += `<div class="prob-strategy">${strategy}</div>`;
    html += `</div>`;
    html += `</div>`;

    html += `<div class="prob-metrics-row">`;
    html += `<div class="prob-metric-card prob-metric-card-clickable" data-action="showRhythmWindow"><div class="prob-metric-value">${rhythmWindow}</div><div class="prob-metric-label">节奏窗</div></div>`;
    html += `<div class="prob-metric-card"><div class="prob-metric-value">${(turnoverRate * 100).toFixed(0)}%</div><div class="prob-metric-label">周转率</div></div>`;
    html += `<div class="prob-metric-card"><div class="prob-metric-value">${signals.hotPoolSize}</div><div class="prob-metric-label">热号池</div></div>`;
    html += `<div class="prob-metric-card"><div class="prob-metric-value">${signals.breakSignal ? '是' : '否'}</div><div class="prob-metric-label">破冰信号</div></div>`;
    html += `</div>`;

    if(hitRate && hitRate.total > 0) {
      html += `<div class="prob-section">`;
      html += `<div class="prob-section-title">回测命中率</div>`;
      html += `<div class="prob-hitrate-card">`;
      html += `<div class="prob-hitrate-main"><span class="prob-hitrate-value">${hitRate.rate}%</span><span class="prob-hitrate-desc">${hitRate.hit}/${hitRate.total} 期</span></div>`;
      if(Object.keys(hitRate.byPhase).length > 0) {
        html += `<div class="prob-hitrate-phases">`;
        Object.entries(hitRate.byPhase).forEach(([p, d]) => {
          html += `<div class="prob-hitrate-phase"><span class="prob-hitrate-phase-label">${ProbabilityView._getPhaseLabel(p)}</span><span class="prob-hitrate-phase-value">${d.rate}%</span></div>`;
        });
        html += `</div>`;
      }
      html += `</div>`;
      html += `</div>`;
    }

    html += `<div class="prob-section">`;
    html += `<div class="prob-section-title">推荐生肖</div>`;
    html += `<div class="prob-tabs">`;
    html += `<div class="prob-tab ${ProbabilityView._currentTab === 'recommend' ? 'active' : ''}" data-action="switchProbTab" data-tab="recommend">推荐</div>`;
    html += `<div class="prob-tab" data-action="${historyAction}" data-category="probability-history" data-tab="history">历史记录</div>`;
    html += `</div>`;

    if(ProbabilityView._currentTab === 'recommend') {
      html += `<div class="high-chase-zodiac-grid">`;
      if(recommend.length > 0) {
        recommend.forEach((z, i) => {
          const display = BusinessHighChase.getZodiacDisplay(z.name || z);
          html += `<div class="high-chase-zodiac-card rank-${i + 1}">`;
          html += `<div class="high-chase-zodiac-rank">${i + 1}</div>`;
          html += `<div class="high-chase-zodiac-icon">${display.icon}</div>`;
          html += `<div class="high-chase-zodiac-name">${display.name}</div>`;
          html += `</div>`;
        });
      } else {
        html += `<div class="prob-empty-small">暂无推荐</div>`;
      }
      html += `</div>`;
    } else {
      const historyData = BusinessProbabilityHistory.getHistoryData();
      html += ProbabilityView._renderProbabilityHistory(historyData);
    }
    html += `</div>`;

    html += `<div class="prob-section">`;
    html += `<div class="prob-section-title">四级分类</div>`;
    
    ['hot', 'warm', 'edge', 'cold'].forEach(tier => {
      const zodiacs = tiers[tier] || [];
      if(zodiacs.length === 0) return;
      
      const isExpanded = ProbabilityView._expandedTiers[tier];
      const sortedZodiacs = [...zodiacs].sort((a, b) => {
        const scoreA = a.currentMiss * 0.4 + a.rhythmCount * 0.6;
        const scoreB = b.currentMiss * 0.4 + b.rhythmCount * 0.6;
        return scoreB - scoreA;
      });
      const displayItems = isExpanded ? sortedZodiacs : sortedZodiacs.slice(0, 4);
      
      html += `<div class="prob-tier-card">`;
      html += `<div class="prob-tier-header">`;
      html += `<div class="prob-tier-title"><span class="prob-tier-icon">${ProbabilityView._getTierIcon(tier)}</span> ${ProbabilityView._getTierLabel(tier)} <span class="prob-tier-count">${zodiacs.length}个</span></div>`;
      if(zodiacs.length > 4) {
        html += `<button class="prob-tier-toggle" data-action="toggleTier" data-tier="${tier}">${isExpanded ? '收起' : '展开'}</button>`;
      }
      html += `</div>`;
      
      const tierClass = tier === 'hot' ? 'tier-hot' : tier === 'warm' ? 'tier-warm' : tier === 'edge' ? 'tier-edge' : 'tier-cold';
      
      html += `<div class="zodiac-prediction-grid">`;
      displayItems.forEach((z, idx) => {
        const topClass = idx === 0 ? 'top-1' : idx === 1 ? 'top-2' : idx === 2 ? 'top-3' : '';
        const itemClass = `${topClass} ${tierClass}`;
        
        const score = Math.round((z.currentMiss * 0.4 + z.rhythmCount * 0.6) * 100) / 100 * 10;
        
        let missTag = '';
        if(z.currentMiss === 0 && z.lastMiss > 0) {
          missTag = `遗漏0(前${z.lastMiss}期)`;
        } else {
          missTag = `遗漏${z.currentMiss}期`;
        }
        
        const silentTag = z.isSilent ? '<span class="zodiac-prediction-tag silent-tag">静默</span>' : '';
        
        html += `
          <div class="zodiac-prediction-item ${itemClass}">
            <div class="zodiac-prediction-zodiac">${z.name}</div>
            <div class="zodiac-prediction-score">${Math.round(score)}分</div>
            <div class="zodiac-prediction-details">
              <span class="zodiac-prediction-tag">${missTag}</span>
              <span class="zodiac-prediction-tag">节奏${z.rhythmCount}</span>
              ${silentTag}
            </div>
          </div>
        `;
      });
      html += `</div>`;
      
      html += `</div>`;
    });
    
    html += `</div>`;

    if(silent.length > 0) {
      html += `<div class="prob-section">`;
      html += `<div class="prob-section-title">静默池</div>`;
      html += `<div class="prob-silent-grid">`;
      silent.forEach(z => {
        const statsItem = stats.find(s => s.name === z);
        html += `<div class="prob-silent-item">`;
        html += `<div class="prob-silent-name">${z}</div>`;
        html += `<div class="prob-silent-miss">遗漏 ${statsItem ? statsItem.currentMiss : '--'} 期</div>`;
        html += `</div>`;
      });
      html += `</div>`;
      html += `</div>`;
    }

    html += ProbabilityView._renderProbabilityBacktest();

    html += `<div class="prob-footer">`;
    html += `<div class="prob-footer-text">仅供娱乐，非投注建议</div>`;
    html += `<div class="prob-footer-version">V26.2Beta</div>`;
    html += `</div>`;

    return html;
  },

  toggleTier: (tierName) => {
    ProbabilityView._expandedTiers[tierName] = !ProbabilityView._expandedTiers[tierName];
    ProbabilityView.render();
  },

  switchTab: (tab) => {
    ProbabilityView._currentTab = tab;
    ProbabilityView.render();
  },

  _renderProbabilityHistory: (historyData) => {
    if(!historyData || !historyData.records || historyData.records.length === 0) {
      return `
        <div class="high-chase-history-empty">
          <div class="high-chase-history-empty-icon">📊</div>
          <div class="high-chase-history-empty-text">暂无历史记录</div>
          <div class="high-chase-history-empty-hint">完成推荐开奖后会自动记录</div>
        </div>
      `;
    }

    const stats = historyData.stats;
    const accuracyColor = stats.accuracy >= 60 ? '#22C55E' : 
                         stats.accuracy >= 40 ? '#F59E0B' : '#EF4444';
    const last10Color = stats.last10Accuracy >= 60 ? '#22C55E' : 
                       stats.last10Accuracy >= 40 ? '#F59E0B' : '#EF4444';

    let statsHtml = `
      <div class="high-chase-history-stats">
        <div class="high-chase-history-stat-item">
          <div class="high-chase-history-stat-value">${stats.totalRecords}</div>
          <div class="high-chase-history-stat-label">总记录</div>
        </div>
        <div class="high-chase-history-stat-item">
          <div class="high-chase-history-stat-value" style="color:${accuracyColor}">${stats.accuracy}%</div>
          <div class="high-chase-history-stat-label">总正确率</div>
        </div>
        <div class="high-chase-history-stat-item">
          <div class="high-chase-history-stat-value" style="color:${last10Color}">${stats.last10Accuracy}%</div>
          <div class="high-chase-history-stat-label">近10期</div>
        </div>
      </div>
    `;

    let recordsHtml = historyData.records.map(record => {
      const statusColor = record.isHit ? '#22C55E' : '#EF4444';
      const statusIcon = record.isHit ? '✅' : '❌';
      const recText = record.recommendation.join('、');

      return `
        <div class="prob-history-item ${record.isHit ? 'hit' : 'miss'}">
          <div class="prob-history-item-header">
            <span class="prob-history-expect">${record.expect}期</span>
            <span class="prob-history-status" style="color:${statusColor}">${statusIcon} ${record.isHit ? '命中' : '未中'}</span>
          </div>
          <div class="prob-history-item-body">
            <div class="prob-history-rec">${recText}</div>
            <div class="prob-history-opened">开出: ${record.openedZodiac || '--'}</div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="prob-history-content">
        ${statsHtml}
        <div class="prob-history-records">
          ${recordsHtml}
        </div>
      </div>
    `;
  },

  _renderProbabilityBacktest: () => {
    if (typeof BusinessBacktest === 'undefined') return '';

    const stats = BusinessBacktest.getProbabilityStats();
    const records = BusinessBacktest.getProbabilityRecords(5);

    if (stats.total === 0) return '';

    const rateClass = stats.hitRate >= 50 ? 'gemini-bt-rate-good' : stats.hitRate >= 30 ? 'gemini-bt-rate-mid' : 'gemini-bt-rate-low';
    let html = '<div class="prob-section">'
      + '<div class="prob-section-title">预测回测追踪</div>'
      + '<div class="gemini-bt-stats">'
      + '<div class="gemini-bt-stat-item">'
      + '<div class="gemini-bt-stat-value ' + rateClass + '">' + stats.hitRate + '%</div>'
      + '<div class="gemini-bt-stat-label">预测命中率</div>'
      + '</div>'
      + '<div class="gemini-bt-stat-item">'
      + '<div class="gemini-bt-stat-value">' + stats.total + '</div>'
      + '<div class="gemini-bt-stat-label">已验证期数</div>'
      + '</div>'
      + '</div>';

    if (stats.recent10) {
      html += '<div class="gemini-bt-recent">'
        + '<span>近10期: </span>'
        + '<span class="' + rateClass + '">' + stats.recent10.hit + '/' + stats.recent10.total + ' (' + stats.recent10.rate + '%)</span>'
        + '</div>';
    }

    if (records.length > 0) {
      html += '<div class="gemini-bt-records">'
        + '<div class="gemini-bt-records-title">最近验证记录</div>';
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        const hitTag = r.isHit
          ? '<span class="gemini-bt-tag gemini-bt-tag-hit">命中</span>'
          : '<span class="gemini-bt-tag gemini-bt-tag-miss">未中</span>';
        html += '<div class="gemini-bt-record">'
          + '<span class="gemini-bt-record-expect">' + r.expect + '期</span>'
          + '<span class="gemini-bt-record-zodiac">开奖: ' + (r.actualZodiac || '-') + '</span>'
          + '<span class="gemini-bt-record-predict">预测: ' + (r.recommend || []).join('/') + '</span>'
          + hitTag
          + '</div>';
      }
      html += '</div>';
    }

    html += '</div>';
    return html;
  }
};
