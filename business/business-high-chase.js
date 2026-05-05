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
  _historyRecords: null,

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
    const lastRepeat = periods.length >= 2 && periods[0].zodiac === periods[1].zodiac;
    const lastN = periods.slice(0, lookback);
    const variety = new Set(lastN.map(p => p.zodiac)).size;
    let hotScore = 0;
    if(changeRate >= config.marketRules.changeRateThreshold) hotScore++;
    if(lastRepeat) hotScore++;
    if(variety <= config.marketRules.varietyThreshold) hotScore++;
    return hotScore >= 2 ? 'hot' : 'cold';
  },

  _cachedConfigs: new Map(),

  _getConfig: () => {
    if(BusinessHighChase._cachedConfigs.size === 0) {
      const config = {
        periodLength: { hot: 25, normal: 27, cold: 30 },
        threshold: { hot: 3, cold: 2 },
        maxAttempts: { hot: 3, cold: 2 },
        default: { periodLength: 27, threshold: 3, maxAttempts: 3 },
        marketRules: { changeRateThreshold: 0.4, varietyThreshold: 6, lookbackPeriods: 10 },
        confidenceWeights: { market: 40, highFreq: 30, hitRate: 30 },
        suggestionThresholds: { strong: 80, normal: 60, weak: 40 },
        risk: { consecutiveMissGroups: 2, observationPeriods: 3, recoverCondition: 'allDifferent' }
      };
      BusinessHighChase._cachedConfigs.set('main', config);
    }
    return BusinessHighChase._cachedConfigs.get('main');
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
    if(excludeLast && result.length > 0) result = result.slice(1);
    if(count > 0) return result.slice(0, count);
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
      lastIndex.set(zod, periods.length - 1 - i);
    }
    const zodiacs = [...new Set(periods.map(p => p.zodiac))];
    return zodiacs.sort((a, b) => {
      const diff = (freqMap.get(b) || 0) - (freqMap.get(a) || 0);
      if(diff !== 0) return diff;
      return (lastIndex.get(a) || Infinity) - (lastIndex.get(b) || Infinity);
    });
  },

  _getRecentSet: (periods, lookbackCount) => {
    const recent = periods.slice(0, lookbackCount);
    return new Set(recent.map(p => p.zodiac));
  },

  _calculateRecentHitRate: () => {
    const records = BusinessHighChase._loadHistoryRecords();
    if(!records || records.length === 0) return 0;
    const recent10 = records.slice(0, Math.min(10, records.length));
    const totalPeriods = recent10.reduce((sum, r) => sum + r.totalCount, 0);
    const totalHits = recent10.reduce((sum, r) => sum + r.hitCount, 0);
    return totalPeriods > 0 ? totalHits / totalPeriods : 0;
  },

  _loadHistoryRecords: () => {
    const records = Storage.get('high_chase_history', null);
    if(records && Array.isArray(records)) return records;
    return [];
  },

  _saveHistoryRecords: (records) => {
    const maxRecords = 50;
    const toSave = records.slice(0, maxRecords);
    Storage.set('high_chase_history', toSave);
    BusinessHighChase._historyRecords = toSave;
  },

  _recordCompletedPlan: (plan) => {
    const records = BusinessHighChase._loadHistoryRecords();
    
    if(!plan || !plan.chasePeriods || plan.chasePeriods.length === 0) return;

    const allCompleted = plan.chasePeriods.every(p => p.status === 'hit' || p.status === 'miss' || p.status === 'skipped');
    if(!allCompleted) return;

    const hitCount = plan.chasePeriods.filter(p => p.status === 'hit').length;
    const totalCount = plan.chasePeriods.length;
    const accuracy = totalCount > 0 ? Math.round(hitCount / totalCount * 100) : 0;

    records.unshift({
      planId: Date.now().toString(),
      market: plan.market,
      recommendation: plan.recommendation,
      periods: plan.chasePeriods.map(p => ({
        expect: p.expect,
        recommendation: p.recommendation,
        status: p.status,
        hitResult: p.hitResult,
        hitZodiac: p.hitZodiac
      })),
      hitCount,
      totalCount,
      accuracy,
      completedAt: new Date().toISOString().split('T')[0]
    });

    BusinessHighChase._saveHistoryRecords(records);
  },

  getHistoryRecords: () => {
    const records = BusinessHighChase._loadHistoryRecords();
    
    const totalPlans = records.length;
    const totalPeriods = records.reduce((sum, r) => sum + r.totalCount, 0);
    const totalHits = records.reduce((sum, r) => sum + r.hitCount, 0);
    const overallAccuracy = totalPeriods > 0 ? Math.round(totalHits / totalPeriods * 100) : 0;

    const last10 = records.slice(0, 10);
    const last10Periods = last10.reduce((sum, r) => sum + r.totalCount, 0);
    const last10Hits = last10.reduce((sum, r) => sum + r.hitCount, 0);
    const last10Accuracy = last10Periods > 0 ? Math.round(last10Hits / last10Periods * 100) : 0;

    return {
      records: records.slice(0, 10),
      stats: {
        totalPlans,
        totalPeriods,
        totalHits,
        overallAccuracy,
        last10Plans: last10.length,
        last10Periods,
        last10Hits,
        last10Accuracy
      }
    };
  },

  _getConfidenceScore: (market, highFreqCount, recentHitRate) => {
    const config = BusinessHighChase._getConfig();
    const weights = config.confidenceWeights;
    let score = 0;
    if(market === 'hot') score += weights.market;
    else score += weights.market * 0.5;
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
    const records = BusinessHighChase._loadHistoryRecords();
    const config = BusinessHighChase._getConfig();
    let consecutiveMissGroups = 0;

    for(const record of records) {
      if(record.accuracy === 0) {
        consecutiveMissGroups++;
        if(consecutiveMissGroups >= config.risk.consecutiveMissGroups) break;
      } else {
        break;
      }
    }

    return {
      isPaused: consecutiveMissGroups >= config.risk.consecutiveMissGroups,
      consecutiveMissGroups
    };
  },

  _recommendNext: (history) => {
    if(history.length < 25) {
      return { error: '至少需要25期历史数据' };
    }
    const market = BusinessHighChase._getMarketCondition(history.slice(0, 27));
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
      const fallback = sorted.filter(z => {
        const count = freq.get(z) || 0;
        return count > 0 && count < threshold;
      });
      const recent10Set = BusinessHighChase._getRecentSet(recent, 10);
      const priority = fallback.filter(z => recent10Set.has(z));
      const nonPriority = fallback.filter(z => !recent10Set.has(z));
      const needed = 4 - highFreq.length;
      if(priority.length >= needed) {
        recommendation = highFreq.concat(priority.slice(0, needed));
      } else {
        const remaining = needed - priority.length;
        recommendation = highFreq.concat(priority, nonPriority.slice(0, remaining));
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
    const riskStatus = BusinessHighChase._getRiskStatus();
    const suggestion = BusinessHighChase._getSuggestion(confidenceScore, riskStatus.isPaused);
    return {
      action: 'new_recommendation',
      recommendation: recResult.recommendation,
      market: recResult.market,
      periodLen: recResult.periodLen,
      threshold: recResult.threshold,
      maxAttempts: maxAttempts,
      confidenceScore: confidenceScore,
      suggestion: suggestion,
      riskStatus: riskStatus
    };
  },

  _getNextPeriodExpect: (history, offset) => {
    const latestExpect = history[history.length - 1].period;
    const latestPeriodNum = parseInt(latestExpect);
    if(isNaN(latestPeriodNum)) return null;
    return String(latestPeriodNum + offset);
  },

  _generateChasePlan: (history) => {
    const recResult = BusinessHighChase._recommendNext(history);
    if(recResult.error) return recResult;
    
    const maxAttempts = BusinessHighChase._getMaxAttempts(recResult.market);
    const latestExpect = history[0].period;
    const latestPeriodNum = parseInt(latestExpect);
    
    if(isNaN(latestPeriodNum)) {
      return { error: '期号格式错误' };
    }

    const chasePeriods = [];
    for(let i = 1; i <= maxAttempts; i++) {
      const periodNum = latestPeriodNum + i;
      chasePeriods.push({
        expect: String(periodNum),
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
    const riskStatus = BusinessHighChase._getRiskStatus();
    const suggestion = BusinessHighChase._getSuggestion(confidenceScore, riskStatus.isPaused);

    return {
      action: 'new_chase_plan',
      recommendation: recResult.recommendation,
      market: recResult.market,
      periodLen: recResult.periodLen,
      threshold: recResult.threshold,
      maxAttempts: maxAttempts,
      confidenceScore: confidenceScore,
      suggestion: suggestion,
      riskStatus: riskStatus,
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
      for(let k = plan.currentPeriodIndex; k < plan.chasePeriods.length; k++) {
        plan.chasePeriods[k].status = 'skipped';
        plan.chasePeriods[k].hitResult = '-';
      }
    } else {
      plan.currentPeriodIndex++;
      if(plan.currentPeriodIndex >= plan.maxAttempts) {
        plan.isPlanActive = false;
      }
    }

    return plan;
  },

  _generateNewPlan: (historyData) => {
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
    if(newPlan.error) return newPlan;
    BusinessHighChase._lastResult = newPlan;
    BusinessHighChase._savePlan(newPlan);
    return newPlan;
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

      if(updatedPlan && !updatedPlan.isPlanActive && !updatedPlan._recorded) {
        BusinessHighChase._recordCompletedPlan(updatedPlan);
        updatedPlan._recorded = true;
      }

      return BusinessHighChase._generateNewPlan(historyData);
    } catch(e) {
      Logger.error('BusinessHighChase.checkAndRefreshPlan 错误:', e);
      return { error: '计算出错，请刷新' };
    }
  },

  getStrategyData: () => {
    try {
      const savedPlan = BusinessHighChase._loadPlan();
      if(savedPlan && savedPlan.isPlanActive && !savedPlan.error) {
        BusinessHighChase._lastResult = savedPlan;
        const state = StateManager._state;
        const histData = state.analysis.historyData;
        if(histData) {
          BusinessHighChase._checkPlanHitResult(savedPlan, histData);
          if(!savedPlan.isPlanActive && !savedPlan._recorded) {
            BusinessHighChase._recordCompletedPlan(savedPlan);
            savedPlan._recorded = true;
            BusinessHighChase._savePlan(null);
            return BusinessHighChase._generateNewPlan(histData);
          }
        }
        BusinessHighChase._savePlan(savedPlan);
        return savedPlan;
      }

      const state = StateManager._state;
      const historyData = state.analysis.historyData;
      if(!historyData || historyData.length < 25) {
        return { error: '历史数据不足25期' };
      }

      return BusinessHighChase._generateNewPlan(historyData);
    } catch(e) {
      Logger.error('BusinessHighChase.getStrategyData 错误:', e);
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

    const market = BusinessHighChase._getMarketCondition(history.slice(0, 27));
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

  _savePlan: (plan) => {
    if(!plan || plan.error) return;
    Storage.set('high_chase_plan', plan);
  },

  _loadPlan: () => {
    return Storage.get('high_chase_plan', null);
  },

  getZodiacDisplay: (zodiac) => {
    const iconMap = {
      '鼠': '🐭', '牛': '🐮', '虎': '🐯', '兔': '🐰',
      '龙': '🐲', '蛇': '🐍', '马': '🐴', '羊': '🐑',
      '猴': '🐵', '鸡': '🐔', '狗': '🐶', '猪': '🐷'
    };
    return { icon: iconMap[zodiac] || '🐾', name: zodiac };
  },

  getHistoryDetail: () => {
    try {
      const state = StateManager._state;
      const historyData = state.analysis.historyData;
      if(!historyData || historyData.length === 0) return null;

      const config = BusinessHighChase._getConfig();
      const history = historyData.map(item => {
        const s = DataQuery.getSpecial(item);
        if(!s || !s.zod) return null;
        return {
          period: item.expect,
          zodiac: s.zod,
          fullData: item
        };
      }).filter(item => item !== null);

      if(history.length < 25) {
        return { error: '有效历史数据不足25期' };
      }

      const recent25 = history.slice(0, 25);
      const recResult = BusinessHighChase._recommendNext(recent25);
      if(recResult.error) return recResult;

      const periodLength = config.periodLength[recResult.market] || config.default.periodLength;
      const threshold = config.threshold[recResult.market] || config.default.threshold;

      const calcHistory = recent25.slice(0, periodLength);

      const zodiacCounts = {};
      calcHistory.forEach(item => {
        zodiacCounts[item.zodiac] = (zodiacCounts[item.zodiac] || 0) + 1;
      });

      const highFreqZodiacs = [];
      Object.entries(zodiacCounts).forEach(([zod, count]) => {
        if(count >= threshold) {
          highFreqZodiacs.push({ zodiac: zod, count, missed: recent25[0].zodiac === zod ? 0 : null });
        }
      });
      highFreqZodiacs.sort((a, b) => b.count - a.count);

      const missCounts = {};
      recent25.forEach((item, idx) => {
        if(missCounts[item.zodiac] === undefined) {
          missCounts[item.zodiac] = idx;
        }
      });
      highFreqZodiacs.forEach(h => {
        h.missed = missCounts[h.zodiac] || 0;
      });

      const records = calcHistory.map((item, idx) => {
        const prevItem = idx > 0 ? calcHistory[idx - 1] : null;
        const interval = prevItem ? Math.abs(parseInt(item.period) - parseInt(prevItem.period)) : '-';
        return {
          index: idx + 1,
          period: item.period,
          zodiac: item.zodiac,
          interval: interval
        };
      });

      return {
        market: recResult.market,
        periodLength,
        threshold,
        records,
        highFreqZodiacs,
        zodiacCounts,
        totalHistory: history.length
      };
    } catch(e) {
      Logger.error('获取历史详情失败', e);
      return null;
    }
  }
};