/**
 * Gemini 多窗口分析视图（高性能渲染版）
 * @description 三窗口分析结果渲染，包含行情判定、生肖分池、打分、多维度热度、执行策略
 * 优化：结果缓存 60s、for-loop+join 替代模板字符串拼接、模式颜色预计算
 */
const GeminiView = {
  _lastResult: null,
  _lastCalcTime: 0,
  _cacheTTL: 60000,

  _getCachedResult: () => {
    const now = Date.now();
    if (GeminiView._lastResult && (now - GeminiView._lastCalcTime) < GeminiView._cacheTTL) {
      return GeminiView._lastResult;
    }
    const data = BusinessGemini.calc();
    GeminiView._lastResult = data;
    GeminiView._lastCalcTime = now;
    return data;
  },

  buildHtml: () => {
    const data = GeminiView._getCachedResult();
    if (data.error) {
      return '<div class="gemini-container"><div class="gemini-error">' + data.error + '</div></div>';
    }

    const modeColor = GeminiView._getModeColor(data.marketMode);
    const modeIcon = GeminiView._getModeIcon(data.marketMode);
    const parts = [];

    parts.push(
      GeminiView._renderHeader(data),
      GeminiView._renderMarketMode(data, modeColor, modeIcon),
      GeminiView._renderZodiacPools(data),
      GeminiView._renderZodiacScores(data),
      GeminiView._renderWeightedScores(data),
      GeminiView._renderAnnualAnalysis(data),
      GeminiView._renderDimensionHot(data),
      GeminiView._renderStrategy(data),
      GeminiView._renderBacktest()
    );

    return '<div class="gemini-container">' + parts.join('') + '</div>';
  },

  _renderHeader: (data) => {
    return '<div class="gemini-header">'
      + '<div class="gemini-title">Gemini 多窗口分析</div>'
      + '<div class="gemini-subtitle">三窗口交叉验证 · 5/10/15期</div>'
      + '<div class="gemini-next-period">下一期: ' + (data.nextPeriod || '待计算') + '</div>'
      + '</div>';
  },

  _renderMarketMode: (data, modeColor, modeIcon) => {
    const lockText = data.modeLocked ? '· 锁定中(' + data.lockCount + '/5)' : '';
    return '<div class="gemini-section">'
      + '<div class="gemini-section-title">行情模式判定</div>'
      + '<div class="gemini-mode-card" style="border-left:3px solid ' + modeColor + ';">'
      + '<div class="gemini-mode-icon">' + modeIcon + '</div>'
      + '<div class="gemini-mode-name" style="color:' + modeColor + '">' + data.marketMode + '</div>'
      + '<div class="gemini-mode-lock">' + lockText + '</div>'
      + '</div>'
      + '<div class="gemini-mode-desc">' + (data.strategy.strategyDesc || '') + '</div>'
      + '</div>';
  },

  _renderZodiacPools: (data) => {
    const { hotPool, warmPool, coldPool, hotScores, warmScores, coldScores } = data.pools;

    const _buildPoolCards = (pool, scores, cls) => {
      const cards = [];
      for (let i = 0; i < pool.length; i++) {
        const z = pool[i];
        cards.push(
          '<div class="gemini-pool-card ' + cls + '">'
          + '<div class="gemini-pool-zodiac">' + z + '</div>'
          + '<div class="gemini-pool-score">' + (scores[z] || 0) + '分</div>'
          + '<div class="gemini-pool-miss">遗漏' + (data.zodiacMiss[z] || 0) + '期</div>'
          + '</div>'
        );
      }
      return cards.join('');
    };

    return '<div class="gemini-section">'
      + '<div class="gemini-section-title">生肖分池</div>'
      + '<div class="gemini-pool-group">'
      + '<div class="gemini-pool-label gemini-pool-label-hot">热号池 (' + hotPool.length + ')</div>'
      + '<div class="gemini-pool-row">' + _buildPoolCards(hotPool, hotScores, 'gemini-pool-hot') + '</div>'
      + '</div>'
      + '<div class="gemini-pool-group">'
      + '<div class="gemini-pool-label gemini-pool-label-warm">温号池 (' + warmPool.length + ')</div>'
      + '<div class="gemini-pool-row">' + _buildPoolCards(warmPool, warmScores, 'gemini-pool-warm') + '</div>'
      + '</div>'
      + '<div class="gemini-pool-group">'
      + '<div class="gemini-pool-label gemini-pool-label-cold">冷号池 (' + coldPool.length + ')</div>'
      + '<div class="gemini-pool-row">' + _buildPoolCards(coldPool, coldScores, 'gemini-pool-cold') + '</div>'
      + '</div>'
      + '<div class="gemini-pool-stats">'
      + '<div class="gemini-stat-item"><div class="gemini-stat-label">遗漏均值μ</div><div class="gemini-stat-value">' + data.pools.mu + '</div></div>'
      + '<div class="gemini-stat-item"><div class="gemini-stat-label">标准差σ</div><div class="gemini-stat-value">' + data.pools.sigma + '</div></div>'
      + '</div></div>';
  },

  _renderZodiacScores: (data) => {
    const sortedZodiacs = CONFIG.ANALYSIS.ZODIAC_ALL.slice()
      .sort((a, b) => (data.pools.allScores[b] || 0) - (data.pools.allScores[a] || 0));

    const cards = [];
    for (let i = 0; i < sortedZodiacs.length; i++) {
      const z = sortedZodiacs[i];
      const score = data.pools.allScores[z] || 0;
      const miss = data.zodiacMiss[z] || 0;
      let poolClass = data.pools.coldPool.includes(z) ? 'gemini-pool-cold'
        : data.pools.warmPool.includes(z) ? 'gemini-pool-warm'
        : 'gemini-pool-hot';

      cards.push(
        '<div class="gemini-score-card ' + poolClass + '">'
        + '<div class="gemini-score-rank">' + (i + 1) + '</div>'
        + '<div class="gemini-score-zodiac">' + z + '</div>'
        + '<div class="gemini-score-value">' + score + '分</div>'
        + '<div class="gemini-score-miss">遗漏' + miss + '期</div>'
        + '</div>'
      );
    }

    return '<div class="gemini-section">'
      + '<div class="gemini-section-title">生肖得分排行</div>'
      + '<div class="gemini-score-grid">' + cards.join('') + '</div>'
      + '</div>';
  },

  _renderWeightedScores: (data) => {
    const entries = Object.entries(data.pools.weightedScores || {});
    entries.sort((a, b) => b[1] - a[1]);
    const sorted = entries.slice(0, 12);

    const cards = [];
    for (let i = 0; i < sorted.length; i++) {
      const z = sorted[i][0], score = sorted[i][1];
      let poolClass = data.pools.coldPool.includes(z) ? 'gemini-pool-cold'
        : data.pools.warmPool.includes(z) ? 'gemini-pool-warm'
        : 'gemini-pool-hot';

      cards.push(
        '<div class="gemini-score-card ' + poolClass + '">'
        + '<div class="gemini-score-rank">' + (i + 1) + '</div>'
        + '<div class="gemini-score-zodiac">' + z + '</div>'
        + '<div class="gemini-score-value">' + score + '分</div>'
        + '<div class="gemini-score-miss">三窗口加权</div>'
        + '</div>'
      );
    }

    return '<div class="gemini-section">'
      + '<div class="gemini-section-title">三窗口加权评分 (50%·10期 + 30%·5期 + 20%·15期)</div>'
      + '<div class="gemini-score-grid">' + cards.join('') + '</div>'
      + '</div>';
  },

  _renderDimensionHot: (data) => {
    const dim10 = data.dimensionHot.window10;

    const _render = (title, dimData) => {
      const entries = Object.entries(dimData);
      entries.sort((a, b) => b[1].freq - a[1].freq);

      const items = [];
      for (let i = 0; i < entries.length; i++) {
        const key = entries[i][0], val = entries[i][1];
        const lvlClass = val.level === '高' ? 'gemini-level-hot'
          : val.level === '中' ? 'gemini-level-warm'
          : 'gemini-level-cold';
        items.push(
          '<div class="gemini-dim-item">'
          + '<div class="gemini-dim-key">' + key + '</div>'
          + '<div class="gemini-dim-freq">' + val.freq + '次</div>'
          + '<div class="gemini-dim-level ' + lvlClass + '">' + val.level + '</div>'
          + '</div>'
        );
      }

      return '<div class="gemini-dim-section">'
        + '<div class="gemini-dim-title">' + title + '</div>'
        + '<div class="gemini-dim-list">' + items.join('') + '</div>'
        + '</div>';
    };

    return '<div class="gemini-section">'
      + '<div class="gemini-section-title">维度热度 (10期基准)</div>'
      + _render('五行', dim10.fiveElements)
      + _render('波色', dim10.color)
      + _render('尾数', dim10.tail)
      + _render('头数', dim10.head)
      + '</div>';
  },

  _renderAnnualAnalysis: (data) => {
    const annual = data.annualAnalysis || {};
    const weakPool = annual.weakPool || [];
    const tier1 = annual.tier1 || [];
    const tier2 = annual.tier2 || [];
    const tier3 = annual.tier3 || [];
    const heatExhaustion = annual.heatExhaustionList || [];
    const fireout = annual.fireoutDetected;

    const _buildCards = (pool, cls) => {
      const cards = [];
      for (let i = 0; i < pool.length; i++) {
        cards.push('<div class="gemini-strat-card ' + cls + '">' + pool[i] + '</div>');
      }
      return cards.join('') || '<div class="gemini-empty-tip">暂无</div>';
    };

    const yearFreq = annual.yearFreq || {};
    const entries = Object.entries(yearFreq);
    entries.sort((a, b) => b[1] - a[1]);
    const freqItems = [];
    for (let i = 0; i < entries.length; i++) {
      freqItems.push(
        '<div class="gemini-year-freq-item">'
        + '<span class="gemini-year-freq-zod">' + entries[i][0] + '</span>'
        + '<span class="gemini-year-freq-val">' + entries[i][1] + '次</span>'
        + '</div>'
      );
    }

    let html = '<div class="gemini-section">'
      + '<div class="gemini-section-title">年度智能分析</div>'
      + '<div class="gemini-annual-group">'
      + '<div class="gemini-annual-label gemini-annual-label-weak">年度弱势肖 (永久禁入精选)</div>'
      + '<div class="gemini-annual-row">' + _buildCards(weakPool, 'gemini-strat-weak') + '</div>'
      + '</div>'
      + '<div class="gemini-annual-group">'
      + '<div class="gemini-annual-label gemini-annual-label-tier1">一线热肖梯队 (轮换互斥)</div>'
      + '<div class="gemini-annual-row">' + _buildCards(tier1, 'gemini-strat-tier1') + '</div>'
      + '</div>'
      + '<div class="gemini-annual-group">'
      + '<div class="gemini-annual-label gemini-annual-label-tier2">二线温肖梯队</div>'
      + '<div class="gemini-annual-row">' + _buildCards(tier2, 'gemini-strat-tier2') + '</div>'
      + '</div>'
      + '<div class="gemini-annual-group">'
      + '<div class="gemini-annual-label gemini-annual-label-tier3">三线冷肖梯队</div>'
      + '<div class="gemini-annual-row">' + _buildCards(tier3, 'gemini-strat-tier3') + '</div>'
      + '</div>';

    if (heatExhaustion.length > 0) {
      html += '<div class="gemini-annual-group">'
        + '<div class="gemini-annual-label gemini-annual-label-exhaust">热度透支静默</div>'
        + '<div class="gemini-annual-row">' + _buildCards(heatExhaustion, 'gemini-strat-exhaust') + '</div>'
        + '</div>';
    }

    if (fireout) {
      html += '<div class="gemini-annual-alert">'
        + '<div class="gemini-annual-alert-icon">⚠️</div>'
        + '<div class="gemini-annual-alert-text">热肖集体熄火 → 预判跳开乱序行情</div>'
        + '</div>';
    }

    html += '<div class="gemini-annual-group">'
      + '<div class="gemini-annual-label">年度开出频次</div>'
      + '<div class="gemini-year-freq-list">' + freqItems.join('') + '</div>'
      + '</div></div>';

    return html;
  },

  _renderStrategy: (data) => {
    const { mainZodiac, backupZodiac, defenseZodiac, dimensionTags, strategyDesc, avoidList, lastPeriodZodiac } = data.strategy;

    const _buildCards = (pool, cls) => {
      const cards = [];
      for (let i = 0; i < pool.length; i++) {
        cards.push('<div class="gemini-strat-card ' + cls + '">' + pool[i] + '</div>');
      }
      return cards.join('') || '<div class="gemini-empty-tip">无</div>';
    };

    let html = '<div class="gemini-section">'
      + '<div class="gemini-section-title">执行策略</div>'
      + '<div class="gemini-strat-desc">' + strategyDesc + '</div>';

    if (lastPeriodZodiac) {
      html += '<div class="gemini-avoid-section">'
        + '<div class="gemini-avoid-label">上期重码(零首选)</div>'
        + '<div class="gemini-avoid-item">' + lastPeriodZodiac + '</div>'
        + '</div>';
    }

    html += '<div class="gemini-strat-group">'
      + '<div class="gemini-strat-label">主推生肖 (精选)</div>'
      + '<div class="gemini-strat-row">' + (_buildCards(mainZodiac, 'gemini-strat-main') || '<div class="gemini-empty-tip">无符合精选条件</div>') + '</div>'
      + '</div>'
      + '<div class="gemini-strat-group">'
      + '<div class="gemini-strat-label">备选生肖</div>'
      + '<div class="gemini-strat-row">' + _buildCards(backupZodiac, 'gemini-strat-backup') + '</div>'
      + '</div>'
      + '<div class="gemini-strat-group">'
      + '<div class="gemini-strat-label">防守兜底</div>'
      + '<div class="gemini-strat-row">' + _buildCards(defenseZodiac, 'gemini-strat-defense') + '</div>'
      + '</div>';

    if (avoidList.length > 0) {
      html += '<div class="gemini-strat-group">'
        + '<div class="gemini-strat-label gemini-strat-label-avoid">连开透支规避</div>'
        + '<div class="gemini-strat-row">' + _buildCards(avoidList, 'gemini-strat-avoid') + '</div>'
        + '</div>';
    }

    const tagsHtml = [];
    for (let i = 0; i < dimensionTags.length; i++) {
      tagsHtml.push('<div class="gemini-strat-tag">' + dimensionTags[i] + '</div>');
    }

    html += '<div class="gemini-strat-group">'
      + '<div class="gemini-strat-label">维度匹配标签</div>'
      + '<div class="gemini-strat-tags">' + tagsHtml.join('') + '</div>'
      + '</div></div>';

    return html;
  },

  _getModeColor: (mode) => {
    const map = {
      '正常轮动': '#22C55E',
      '强追热': '#EF4444',
      '冷号接力': '#3B82F6',
      '跳开乱序': '#F59E0B',
      '冷热交替均衡': '#8B5CF6'
    };
    return map[mode] || '#9CA3AF';
  },

  _getModeIcon: (mode) => {
    const map = {
      '正常轮动': '🔄',
      '强追热': '🔥',
      '冷号接力': '❄️',
      '跳开乱序': '🎲',
      '冷热交替均衡': '⚖️'
    };
    return map[mode] || '📊';
  },

  _renderBacktest: () => {
    if (typeof BusinessBacktest === 'undefined') return '';

    const stats = BusinessBacktest.getStats();
    const pendingCount = BusinessBacktest.getPendingCount();
    const records = BusinessBacktest.getRecords(5);

    const rateClass = stats.totalRate >= 50 ? 'gemini-bt-rate-good' : stats.totalRate >= 30 ? 'gemini-bt-rate-mid' : 'gemini-bt-rate-low';

    let html = '<div class="gemini-section">'
      + '<div class="gemini-section-title">预测回测追踪</div>';

    if (stats.total === 0) {
      html += '<div class="gemini-empty-tip">暂无回测数据。每次预测后系统将自动对比实际开奖结果，积累准确率统计。</div>';
      if (pendingCount > 0) {
        html += '<div class="gemini-bt-pending">待验证预测: <strong>' + pendingCount + '</strong> 期</div>';
      }
    } else {
      html += '<div class="gemini-bt-stats">'
        + '<div class="gemini-bt-stat-item">'
        + '<div class="gemini-bt-stat-value ' + rateClass + '">' + stats.totalRate + '%</div>'
        + '<div class="gemini-bt-stat-label">主/备综合命中率</div>'
        + '</div>'
        + '<div class="gemini-bt-stat-item">'
        + '<div class="gemini-bt-stat-value">' + stats.mainRate + '%</div>'
        + '<div class="gemini-bt-stat-label">主推命中率</div>'
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

      if (pendingCount > 0) {
        html += '<div class="gemini-bt-pending">待验证预测: <strong>' + pendingCount + '</strong> 期</div>';
      }

      if (records.length > 0) {
        html += '<div class="gemini-bt-records">'
          + '<div class="gemini-bt-records-title">最近验证记录</div>';
        for (let i = 0; i < records.length; i++) {
          const r = records[i];
          const hitTag = r.isMainHit ? '<span class="gemini-bt-tag gemini-bt-tag-hit">主推命中</span>'
            : r.isBackupHit ? '<span class="gemini-bt-tag gemini-bt-tag-backup">备选命中</span>'
            : '<span class="gemini-bt-tag gemini-bt-tag-miss">未中</span>';
          html += '<div class="gemini-bt-record">'
            + '<span class="gemini-bt-record-expect">' + r.expect + '期</span>'
            + '<span class="gemini-bt-record-zodiac">开奖: ' + (r.actualZodiac || '-') + '</span>'
            + '<span class="gemini-bt-record-predict">预测: ' + r.mainZodiac.join('/') + '</span>'
            + hitTag
            + '</div>';
        }
        html += '</div>';
      }
    }

    html += '</div>';
    return html;
  }
};
