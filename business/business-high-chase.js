/**
 * 高频追号策略业务模块
 * @description 高频追号策略 - 动态增强版核心逻辑
 */
const BusinessHighChase = {
  _engine: null,
  _lastResult: null,
  _cacheTimeout: 60000,
  _cache: new Map(),
  _chasePlan: null,

  _getConfig: () => ({
    periodLength: { hot: 25, normal: 27, cold: 30 },
    threshold: { hot: 3, cold: 2 },
    maxAttempts: { hot: 3, cold: 2 },
    default: { periodLength: 27, threshold: 3, maxAttempts: 3 },
    marketRules: { changeRateThreshold: 0.4, varietyThreshold: 6, lookbackPeriods: 10 },
    confidenceWeights: { market: 40, highFreq: 30, hitRate: 30 },
    suggestionThresholds: { strong: 80, normal: 60, weak: 40 },
    risk: { consecutiveMissGroups: 2, observationPeriods: 3, recoverCondition: 'allDifferent' }
  }),

  _getMarketCondition: (periods) => {
    if(!periods || periods.length < 2) return 'cold';

    const config = BusinessHighChase._getConfig();
    const lookback = config.marketRules.lookbackPeriods;
    let changeCount = 0;
    for(let i = 1; i < periods.length; i++) {
      if(periods[i].zodiac !== periods[i - 1].zodiac) changeCount++;
    }
    const denominator = periods.length - 1;
    const changeRate = denominator > 0 ? changeCount / denominator : 0;
    const lastRepeat = periods.length >= 2 && periods[periods.length - 1].zodiac === periods[periods.length - 2].zodiac;
    const lastN = periods.slice(-lookback);
    const variety = new Set(lastN.map(p => p.zodiac)).size;
    let hotScore = 0;
    if(changeRate >= config.marketRules.changeRateThreshold) hotScore++;
    if(lastRepeat) hotScore++;
    if(variety <= config.marketRules.varietyThreshold) hotScore++;
    return hotScore >= 2 ? 'hot' : 'cold';
  },

  _getPeriodLength: (market) => {
    const config = BusinessHighChase._getConfig();
    return config.periodLength[market] || config.default.periodLength;
  },

  _getThreshold: (market) => {
    const config = BusinessHighChase._getConfig();
    return config.threshold[market] || config.default.threshold;
  },

  _getMaxAttempts: (market) => {
    const config = BusinessHighChase._getConfig();
    return config.maxAttempts[market] || config.default.maxAttempts;
  },

  _getRecentPeriods: (data, count, excludeLast = true) => {
    if(!data || !data.length) return [];
    let result = [...data];
    if(excludeLast && result.length > 0) result = result.slice(0, -1);
    if(count > 0) return result.slice(-count);
    return result;
  },

  _countZodiacFrequency: (periods) => {
    const freq = new Map();
    for(const p of periods) {
      freq.set(p.zodiac, (freq.get(p.zodiac) || 0) + 1);
    }
    return freq;
  },

  _sortByFrequencyAndRecency: (periods, freqMap) => {
    const lastIndex = new Map();
    for(let i = periods.length - 1; i >= 0; i--) {
      const zod = periods[i].zodiac;
      if(!lastIndex.has(zod)) lastIndex.set(zod, periods.length - 1 - i);
    }
    const zodiacs = [...new Set(periods.map(p => p.zodiac))];
    return zodiacs.sort((a, b) => {
      const diff = (freqMap.get(b) || 0) - (freqMap.get(a) || 0);
      if(diff !== 0) return diff;
      return (lastIndex.get(a) || Infinity) - (lastIndex.get(b) || Infinity);
    });
  },

  _getRecentSet: (periods, lookbackCount) => {
    const recent = periods.slice(-lookbackCount);
    return new Set(recent.map(p => p.zodiac));
  },

  _calculateRecentHitRate: () => 0.25,

  _getConfidenceScore: (market, highFreqCount, recentHitRate) => {
    const config = BusinessHighChase._getConfig();
    const weights = config.confidenceWeights;
    let score = 0;
    if(market === 'hot') score += weights.market;
    else if(market === 'cold') score += weights.market * 0.5;
    else score += weights.market * 0.75;
    const highFreqScore = Math.min(highFreqCount, 4) / 4 * weights.highFreq;
    score += highFreqScore;
    score += recentHitRate * weights.hitRate;
    return Math.min(100, Math.max(0, Math.round(score)));
  },

  _getSuggestion: (score, isPaused) => {
    const config = BusinessHighChase._getConfig();
    if(isPaused) {
      return { action: '暂停交易', color: 'red', reason: '连续错2组，等待企稳' };
    }
    const thresholds = config.suggestionThresholds;
    if(score >= thresholds.strong) {
      return { action: '建议出手', color: 'green', reason: '信号强烈，正常追号' };
    }
    if(score >= thresholds.normal) {
      return { action: '谨慎出手', color: 'yellow', reason: '信号一般，可降低仓位' };
    }
    return { action: '建议观望', color: 'gray', reason: '信号偏弱，等待更好时机' };
  },

  _getRiskStatus: () => {
    return {
      isPaused: false,
      consecutiveMissGroups: 0
    };
  },

  _recommendNext: (history) => {
    if(history.length < 25) {
      return { error: '至少需要25期历史数据' };
    }
    const market = BusinessHighChase._getMarketCondition(history.slice(-27));
    const periodLen = BusinessHighChase._getPeriodLength(market);
    const threshold = BusinessHighChase._getThreshold(market);
    const recent = BusinessHighChase._getRecentPeriods(history, periodLen, true);
    const freq = BusinessHighChase._countZodiacFrequency(recent);
    const sorted = BusinessHighChase._sortByFrequencyAndRecency(recent, freq);
    const highFreq = sorted.filter(z => (freq.get(z) || 0) >= threshold);
    let recommendation = [];
    if(highFreq.length >= 4) {
      recommendation = highFreq.slice(0, 4);
    } else {
      const fallback = sorted.filter(z => (freq.get(z) || 0) === 2);
      const recent10Set = BusinessHighChase._getRecentSet(recent, 10);
      const priority = fallback.filter(z => recent10Set.has(z));
      const needed = 4 - highFreq.length;
      if(priority.length >= needed) {
        recommendation = highFreq.concat(priority.slice(0, needed));
      } else {
        const remaining = needed - priority.length;
        recommendation = highFreq.concat(priority, fallback.slice(0, remaining));
      }
    }
    if(recommendation.length < 4 && sorted.length > 0) {
      let currentZodiacs = new Set(recommendation);
      for(const z of sorted) {
        if(currentZodiacs.size >= 4) break;
        if(!currentZodiacs.has(z)) {
          recommendation.push(z);
          currentZodiacs.add(z);
        }
      }
    }
    return {
      recommendation,
      market,
      periodLen,
      threshold,
      freq: Object.fromEntries(freq)
    };
  },

  _formatResult: (recResult, maxAttempts) => {
    const hitRate = BusinessHighChase._calculateRecentHitRate();
    const confidenceScore = BusinessHighChase._getConfidenceScore(
      recResult.market,
      recResult.recommendation.length,
      hitRate
    );
    const suggestion = BusinessHighChase._getSuggestion(confidenceScore, false);
    return {
      action: 'new_recommendation',
      recommendation: recResult.recommendation,
      market: recResult.market,
      periodLen: recResult.periodLen,
      threshold: recResult.threshold,
      maxAttempts: maxAttempts,
      confidenceScore: confidenceScore,
      suggestion: suggestion,
      riskStatus: BusinessHighChase._getRiskStatus()
    };
  },

  _getNextPeriodExpect: (history, offset) => {
    const latestExpect = history[history.length - 1].period;
    const latestPeriodNum = parseInt(latestExpect);
    if(isNaN(latestPeriodNum)) return null;
    return String(latestPeriodNum + offset).padStart(6, '0');
  },

  _generateChasePlan: (history) => {
    const recResult = BusinessHighChase._recommendNext(history);
    if(recResult.error) return recResult;
    
    const maxAttempts = BusinessHighChase._getMaxAttempts(recResult.market);
    const latestExpect = history[history.length - 1].period;
    const latestPeriodNum = parseInt(latestExpect);
    
    if(isNaN(latestPeriodNum)) {
      return { error: '期号格式错误' };
    }

    const chasePeriods = [];
    for(let i = 1; i <= maxAttempts; i++) {
      const periodNum = latestPeriodNum + i;
      chasePeriods.push({
        expect: String(periodNum).padStart(6, '0'),
        recommendation: recResult.recommendation,
        status: 'pending',
        hitResult: null,
        hitZodiac: null
      });
    }

    const hitRate = BusinessHighChase._calculateRecentHitRate();
    const confidenceScore = BusinessHighChase._getConfidenceScore(
      recResult.market,
      recResult.recommendation.length,
      hitRate
    );
    const suggestion = BusinessHighChase._getSuggestion(confidenceScore, false);

    return {
      action: 'new_chase_plan',
      recommendation: recResult.recommendation,
      market: recResult.market,
      periodLen: recResult.periodLen,
      threshold: recResult.threshold,
      maxAttempts: maxAttempts,
      confidenceScore: confidenceScore,
      suggestion: suggestion,
      riskStatus: BusinessHighChase._getRiskStatus(),
      chasePeriods: chasePeriods,
      currentPeriodIndex: 0,
      isPlanActive: true
    };
  },

  _checkPlanHitResult: (plan, historyData) => {
    if(!plan || !plan.isPlanActive || !plan.chasePeriods) return plan;

    const currentPeriod = plan.chasePeriods[plan.currentPeriodIndex];
    if(!currentPeriod) return plan;

    const targetExpect = currentPeriod.expect;
    const latestItem = historyData.find(item => item.expect === targetExpect);
    
    if(!latestItem) return plan;

    const s = DataQuery.getSpecial(latestItem);
    if(!s || !s.zod) return plan;

    const openedZodiac = s.zod;
    const isHit = currentPeriod.recommendation.includes(openedZodiac);

    currentPeriod.status = isHit ? 'hit' : 'miss';
    currentPeriod.hitResult = isHit ? '命中' : '未中';
    currentPeriod.hitZodiac = openedZodiac;

    if(isHit) {
      plan.isPlanActive = false;
      plan.currentPeriodIndex++;
    } else {
      plan.currentPeriodIndex++;
      if(plan.currentPeriodIndex >= plan.maxAttempts) {
        plan.isPlanActive = false;
      }
    }

    return plan;
  },

  checkAndRefreshPlan: () => {
    try {
      const plan = BusinessHighChase._lastResult;
      const state = StateManager._state;
      const historyData = state.analysis.historyData;
      
      if(!plan || !historyData) return plan;

      const updatedPlan = BusinessHighChase._checkPlanHitResult(plan, historyData);
      
      if(updatedPlan && updatedPlan.isPlanActive) {
        return updatedPlan;
      }

      const history = historyData.map(item => {
        const s = DataQuery.getSpecial(item);
        if(!s || !s.zod) return null;
        return {
          period: item.expect,
          zodiac: s.zod
        };
      }).filter(item => item !== null);

      if(history.length < 25) {
        return { error: '有效历史数据不足25期' };
      }

      const newPlan = BusinessHighChase._generateChasePlan(history);
      BusinessHighChase._lastResult = newPlan;
      return newPlan;
    } catch(e) {
      console.error('BusinessHighChase.checkAndRefreshPlan 错误:', e);
      return { error: '计算出错，请刷新' };
    }
  },

  getStrategyData: () => {
    try {
      const state = StateManager._state;
      const historyData = state.analysis.historyData;
      if(!historyData || historyData.length < 25) {
        return { error: '历史数据不足25期' };
      }
      const history = historyData.map(item => {
        const s = DataQuery.getSpecial(item);
        if(!s || !s.zod) return null;
        return {
          period: item.expect,
          zodiac: s.zod
        };
      }).filter(item => item !== null);

      if(history.length < 25) {
        return { error: '有效历史数据不足25期' };
      }

      const chasePlan = BusinessHighChase._generateChasePlan(history);
      BusinessHighChase._lastResult = chasePlan;
      return chasePlan;
    } catch(e) {
      console.error('BusinessHighChase.getStrategyData 错误:', e);
      return { error: '计算出错，请刷新' };
    }
  },

  getMarketParams: () => {
    const config = BusinessHighChase._getConfig();
    const state = StateManager._state;
    const historyData = state.analysis.historyData;
    if(!historyData || historyData.length < 27) {
      return {
        hot: { periodLength: config.periodLength.hot, threshold: config.threshold.hot, maxAttempts: config.maxAttempts.hot },
        cold: { periodLength: config.periodLength.cold, threshold: config.threshold.cold, maxAttempts: config.maxAttempts.cold },
        default: config.default
      };
    }
    const history = historyData.map(item => {
      const s = DataQuery.getSpecial(item);
      if(!s || !s.zod) return null;
      return {
        period: item.expect,
        zodiac: s.zod
      };
    }).filter(item => item !== null);

    const market = BusinessHighChase._getMarketCondition(history.slice(-27));
    return {
      market,
      hot: { periodLength: config.periodLength.hot, threshold: config.threshold.hot, maxAttempts: config.maxAttempts.hot },
      cold: { periodLength: config.periodLength.cold, threshold: config.threshold.cold, maxAttempts: config.maxAttempts.cold },
      default: config.default
    };
  },

  getZodiacNumbers: (zodiacList) => {
    const numbers = [];
    for(let num = 1; num <= 49; num++) {
      const zod = DataQuery._getZodiacByNum(num);
      if(zod && zodiacList.includes(zod)) {
        numbers.push(num);
      }
    }
    return numbers.sort((a, b) => a - b);
  },

  getLastResult: () => BusinessHighChase._lastResult,

  getZodiacDisplay: (zodiac) => {
    const iconMap = {
      '鼠': '🐭', '牛': '🐮', '虎': '🐯', '兔': '🐰',
      '龙': '🐲', '蛇': '🐍', '马': '🐴', '羊': '🐑',
      '猴': '🐵', '鸡': '🐔', '狗': '🐶', '猪': '🐷'
    };
    return { icon: iconMap[zodiac] || '🐾', name: zodiac };
  }
};