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

    const analysisResult = BusinessZodiacTiers.runFullAnalysis();
    if(!analysisResult) {
      container.innerHTML = '<div class="probability-empty"><div class="probability-empty-icon">❌</div><div class="probability-empty-text">分析失败</div></div>';
      return;
    }

    const { tiers, silent, phase, strategy, recommend, recommendScores, rhythmWindow, turnoverRate, stats, signals, hitRate, historyLength } = analysisResult;
    
    if(recommend && recommend.length > 0) {
      BusinessProbabilityHistory.setCurrentRecommend(recommend, recommendScores);
    }
    
    const dataSourceText = ProbabilityView._getDataSourceText();

    let html = '';
    
    html += `<div class="prob-header">`;
    html += `<div class="prob-header-top">`;
    html += `<div class="prob-title">生肖冷热分级系统</div>`;
    html += `<div class="prob-update-time">基于 ${dataSourceText}</div>`;
    html += `</div>`;
    
    html += `<div class="prob-phase-card" style="border-left: 4px solid ${ProbabilityView._getPhaseColor(phase)}">`;
    html += `<div class="prob-phase-label">当前阶段</div>`;
    html += `<div class="prob-phase-value" style="color: ${ProbabilityView._getPhaseColor(phase)}">${ProbabilityView._getPhaseLabel(phase)}</div>`;
    html += `<div class="prob-strategy">${strategy}</div>`;
    html += `</div>`;
    html += `</div>`;

    html += `<div class="prob-metrics-row">`;
    html += `<div class="prob-metric-card"><div class="prob-metric-value">${rhythmWindow}</div><div class="prob-metric-label">节奏窗</div></div>`;
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
    html += `<div class="prob-tab ${ProbabilityView._currentTab === 'history' ? 'active' : ''}" data-action="switchProbTab" data-tab="history">历史记录</div>`;
    html += `</div>`;

    if(ProbabilityView._currentTab === 'recommend') {
      html += `<div class="high-chase-zodiac-grid">`;
      if(recommend.length > 0) {
        recommend.forEach((z, i) => {
          const zodiacNums = DataQuery.getZodiacNumbers(z);
          const statsItem = stats.find(s => s.name === z);
          const score = recommendScores && recommendScores[z] ? recommendScores[z].toFixed(2) : '--';
          const display = BusinessHighChase.getZodiacDisplay(z.name || z);
          html += `<div class="high-chase-zodiac-card rank-${i + 1}">`;
          html += `<div class="high-chase-zodiac-rank">${i + 1}</div>`;
          html += `<div class="high-chase-zodiac-icon">${display.icon}</div>`;
          html += `<div class="high-chase-zodiac-name">${display.name}</div>`;
          html += `<div class="high-chase-zodiac-nums">${zodiacNums.map(n => String(n).padStart(2, '0')).join(' ')}</div>`;
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
      const displayItems = isExpanded ? zodiacs : zodiacs.slice(0, 4);
      
      html += `<div class="prob-tier-card">`;
      html += `<div class="prob-tier-header">`;
      html += `<div class="prob-tier-title"><span class="prob-tier-icon">${ProbabilityView._getTierIcon(tier)}</span> ${ProbabilityView._getTierLabel(tier)} <span class="prob-tier-count">${zodiacs.length}个</span></div>`;
      if(zodiacs.length > 4) {
        html += `<button class="prob-tier-toggle" data-action="toggleTier" data-tier="${tier}">${isExpanded ? '收起' : '展开'}</button>`;
      }
      html += `</div>`;
      
      html += `<div class="prob-zodiac-grid">`;
      displayItems.forEach(z => {
        html += `<div class="prob-zodiac-item">`;
        html += `<div class="prob-zodiac-name">${z.name}</div>`;
        html += `<div class="prob-zodiac-stats">`;
        html += `<span class="prob-zodiac-stat">遗漏${z.currentMiss}</span>`;
        html += `<span class="prob-zodiac-stat">节奏${z.rhythmCount}</span>`;
        html += `<span class="prob-zodiac-stat">总计${z.totalCount}</span>`;
        html += `</div>`;
        if(z.isSilent) {
          html += `<div class="prob-zodiac-silent-tag">静默</div>`;
        }
        html += `</div>`;
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

    html += `<div class="prob-footer">`;
    html += `<div class="prob-footer-text">仅供娱乐，非投注建议</div>`;
    html += `<div class="prob-footer-version">V26.2Beta</div>`;
    html += `</div>`;

    container.innerHTML = html;
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
  }
};
