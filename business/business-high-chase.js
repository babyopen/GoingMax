/**
 * 高频追号策略业务模块
 * @description 高频追号策略 - 动态增强版核心逻辑
 */
const CHASE_CONSTANTS = {
  MIN_HISTORY_LENGTH: 25,
  CACHE_TIMEOUT: 60000,
  MARKET_CACHE_TIMEOUT: 300000,
  CYCLE_STAGE_CACHE_TIMEOUT: 60000,
  CYCLE_STAGE_MIN_HISTORY: 20,
  MAX_HISTORY_RECORDS: 50,
  HISTORY_RETENTION_DAYS: 30,
  WARN_THRESHOLD: 0.9,
  PERIOD_LOOKBACK: 12,
  OBSERVATION_PERIODS: 4,
  CONSECUTIVE_MISS_TRIGGER: 2,
  MARKET_LOOKBACK_PERIODS: 12,
  CYCLE_STAGE_LOOKBACK: 12,
  CYCLE_STAGE_MAX_WINDOWS: 50,
  VARIETY_SIGNAL_THRESHOLD: 8,
  NORMAL_STREAK_THRESHOLD: 18,
  LATE_SIGNAL_THRESHOLD: 3,
  MID_SIGNAL_THRESHOLD: 1,
  ALGORITHM_MODE: 'legacy',
  EMA_DECAY_LAMBDA: 0.10,
  MULTI_WINDOW_SHORT: 7,
  MULTI_WINDOW_MID: 15,
  MULTI_WINDOW_LONG: 30,
  MULTI_WINDOW_WEIGHTS: [0.5, 0.3, 0.2]
};

const BusinessHighChase = {
  _lastResult: null,
  _historyRecords: null,
  _riskState: null,
  _marketCache: null,
  _marketCacheTime: 0,
  _cycleStageCache: null,
  _cycleStageCacheTime: 0,
  _algorithmMode: null,

  _getEffectiveAlgorithmMode: () => {
    if(BusinessHighChase._algorithmMode !== null) {
      return BusinessHighChase._algorithmMode;
    }
    const saved = Storage.get('high_chase_algo_mode');
    if(saved && (saved === 'legacy' || saved === 'enhanced')) {
      BusinessHighChase._algorithmMode = saved;
      return saved;
    }
    return CHASE_CONSTANTS.ALGORITHM_MODE;
  },

  _setAlgorithmMode: (mode) => {
    BusinessHighChase._algorithmMode = mode;
    Storage.set('high_chase_algo_mode', mode);
  },

  _initRiskState: () => {
    if(!BusinessHighChase._riskState) {
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
      BusinessHighChase._riskState = {
        isPaused: consecutiveMissGroups >= config.risk.consecutiveMissGroups,
        consecutiveMissGroups,
        observationPeriods: []
      };
    }
    return BusinessHighChase._riskState;
  },

  _getMarketCondition: (periods) => {
    if(!periods || periods.length < 2) return 'cold';

    const lookback = 12;
    const calcPeriods = periods.slice(0, lookback);
    const now = Date.now();
    const lastPeriod = periods[0]?.period || '';
    const cacheKey = lastPeriod + '_' + (calcPeriods[calcPeriods.length - 1]?.period || '') + '_' + calcPeriods.length;
    
    if(BusinessHighChase._marketCache && 
       (now - BusinessHighChase._marketCacheTime) < CHASE_CONSTANTS.MARKET_CACHE_TIMEOUT &&
       BusinessHighChase._marketCache.key === cacheKey) {
      return BusinessHighChase._marketCache.result;
    }

    const config = BusinessHighChase._getConfig();
    let changeCount = 0;
    for(let i = 1; i < calcPeriods.length; i++) {
      if(calcPeriods[i].zodiac !== calcPeriods[i - 1].zodiac) changeCount++;
    }
    const denominator = calcPeriods.length - 1;
    const changeRate = denominator > 0 ? changeCount / denominator : 0;
    const lastRepeat = calcPeriods.length >= 2 && calcPeriods[0].zodiac === calcPeriods[1].zodiac;
    const variety = new Set(calcPeriods.map(p => p.zodiac)).size;
    let hotScore = 0;
    if(changeRate >= config.marketRules.changeRateThreshold) hotScore++;
    if(lastRepeat) hotScore++;
    if(variety <= config.marketRules.varietyThreshold) hotScore++;
    const result = hotScore >= 3 ? 'hot' : hotScore >= 2 ? 'normal' : hotScore >= 1 ? 'shock' : 'cold';
    
    BusinessHighChase._marketCache = { key: cacheKey, result };
    BusinessHighChase._marketCacheTime = now;
    return result;
  },

  _cachedConfigs: new Map(),

  _getConfig: () => {
    if(BusinessHighChase._cachedConfigs.size === 0) {
      const config = {
        periodLength: { hot: 28, normal: 27, shock: 29, cold: 32 },
        threshold: { hot: 3, normal: 3, shock: 2, cold: 2 },
        maxAttempts: { hot: 3, normal: 2, shock: 1, cold: 1 },
        dynamicFilter: { hot: 2, normal: 5, shock: 3, cold: 7 },
        default: { periodLength: 27, threshold: 3 },
        marketRules: { changeRateThreshold: 0.5, varietyThreshold: 7, lookbackPeriods: 12 },
        confidenceWeights: { market: 30, highFreq: 40, hitRate: 30 },
        suggestionThresholds: { strong: 80, normal: 60, weak: 40 },
        risk: { consecutiveMissGroups: 2, observationPeriods: 4, recoverCondition: 'allDifferent' },
        cycleLateOffset: { filterAdd: 1, periodAdd: 2, attemptSub: 1, confidenceSub: 20 },
        backupStrategy: { lookBackPeriod: 34, minFreq: 2, filterOffset: 2 },
        recommendCount: { main: 4, backup: 2, maxCombine: 6 }
      };
      BusinessHighChase._cachedConfigs.set('main', config);
    }
    return BusinessHighChase._cachedConfigs.get('main');
  },

  _updateConfig: (updates) => {
    const currentConfig = BusinessHighChase._getConfig();
    const mergedConfig = { ...currentConfig };
    
    for(const key in updates) {
      if(typeof updates[key] === 'object' && !Array.isArray(updates[key])) {
        mergedConfig[key] = { ...mergedConfig[key], ...updates[key] };
      } else {
        mergedConfig[key] = updates[key];
      }
    }
    
    BusinessHighChase._cachedConfigs.set('main', mergedConfig);
    BusinessHighChase._marketCache = null;
    BusinessHighChase._cycleStageCache = null;
    
    Logger.info('追号策略配置已更新', Object.keys(updates));
    return mergedConfig;
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
    if(excludeLast && result.length > 0) {
      result = result.slice(0, -1);
    }
    return result.slice(-count);
  },

  _countZodiacFrequency: (periods, useEMA = false) => {
    const freq = new Map();
    const lambda = CHASE_CONSTANTS.EMA_DECAY_LAMBDA;
    for(let i = 0; i < periods.length; i++) {
      const zod = periods[i].zodiac;
      const weight = useEMA ? Math.exp(-lambda * i) : 1;
      freq.set(zod, (freq.get(zod) || 0) + weight);
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

  _filterByRecent: (periods, filterLen) => {
    if(filterLen <= 0) return periods;
    const recentZodiac = new Set(
      periods.slice(-filterLen).map(p => p.zodiac)
    );
    return periods.filter(p => !recentZodiac.has(p.zodiac));
  },

  _calcChangeRate: (periods) => {
    if(!periods || periods.length <= 1) return 0;
    let changeCount = 0;
    for(let i = 1; i < periods.length; i++) {
      if(periods[i].zodiac !== periods[i - 1].zodiac) changeCount++;
    }
    return changeCount / (periods.length - 1);
  },

  _getCycleStage: (history, market) => {
    if(!history || history.length < CHASE_CONSTANTS.CYCLE_STAGE_MIN_HISTORY) return 'early';

    const now = Date.now();
    const lookback = 12;
    const last12 = history.slice(1, Math.min(lookback + 1, history.length));
    const lastPeriod = history[0]?.period || '';
    const cacheKey = lastPeriod + '_' + (last12[last12.length - 1]?.period || '') + '_' + last12.length;
    
    if(BusinessHighChase._cycleStageCache && 
       (now - BusinessHighChase._cycleStageCacheTime) < CHASE_CONSTANTS.CYCLE_STAGE_CACHE_TIMEOUT &&
       BusinessHighChase._cycleStageCache.key === cacheKey) {
      return BusinessHighChase._cycleStageCache.result;
    }

    const config = BusinessHighChase._getConfig();
    const variety = new Set(last12.map(p => p.zodiac)).size;
    const changeRate = BusinessHighChase._calcChangeRate(last12);

    let signal = 0;
    if(variety >= 8) signal++;
    if(Math.abs(changeRate - 0.4) > 0.15) signal++;

    const precalcMarkets = [];
    const marketCache = new Map();
    const maxWindows = CHASE_CONSTANTS.CYCLE_STAGE_MAX_WINDOWS;
    const windowLimit = Math.min(maxWindows, history.length - lookback);
    for(let i = 0; i <= windowLimit; i++) {
      const segment = history.slice(i, i + lookback);
      const segKey = segment[0]?.period + '_' + (segment[segment.length - 1]?.period || '') + '_' + segment.length;
      if(marketCache.has(segKey)) {
        precalcMarkets.push(marketCache.get(segKey));
      } else {
        const m = BusinessHighChase._getMarketCondition(segment);
        precalcMarkets.push(m);
        marketCache.set(segKey, m);
      }
    }
    const normalStreak = precalcMarkets.filter(m => m === 'normal').length;
    if(normalStreak >= 18) signal++;

    const result = signal >= 3 ? 'late' : signal >= 1 ? 'mid' : 'early';
    
    BusinessHighChase._cycleStageCache = { key: cacheKey, result, market };
    BusinessHighChase._cycleStageCacheTime = now;
    return result;
  },

  _getFilterRecentLen: (market, cycleStage) => {
    const config = BusinessHighChase._getConfig();
    let base = config.dynamicFilter[market] || 5;
    if(cycleStage === 'late') {
      base += config.cycleLateOffset.filterAdd;
    }
    return base;
  },

  _getMaxAttemptsWithStage: (market, cycleStage) => {
    const config = BusinessHighChase._getConfig();
    let base = config.maxAttempts[market] || 3;
    if(cycleStage === 'late') {
      base = Math.max(1, base - 1);
    }
    return base;
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
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const toSave = records
      .filter(r => new Date(r.completedAt) >= thirtyDaysAgo)
      .slice(0, maxRecords);
    
    if(toSave.length >= maxRecords * 0.9) {
      Logger.warn('追号历史记录即将达到上限', toSave.length);
    }
    
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
    else if(market === 'cold') score += weights.market * 0.3;
    else score += weights.market * 0.75;
    const highFreqScore = Math.min(highFreqCount, 4) / 4 * weights.highFreq;
    score += highFreqScore;
    score += recentHitRate * weights.hitRate;
    return Math.min(100, Math.max(0, Math.round(score)));
  },

  _getSuggestion: (score, isPaused, market) => {
    const config = BusinessHighChase._getConfig();
    if(isPaused) {
      return { action: '暂停推荐', color: 'red', reason: '连续错2组，等待企稳' };
    }
    if(market === 'cold') {
      return { action: '建议观望', color: 'yellow', reason: '⚠️ 冷市行情谨慎，仅建议轻仓试1期' };
    }
    const thresholds = config.suggestionThresholds;
    if(score >= thresholds.strong) {
      return { action: '建议关注', color: 'green', reason: '信号强烈，可正常关注' };
    }
    if(score >= thresholds.normal) {
      return { action: '谨慎关注', color: 'yellow', reason: '信号一般，建议降低关注' };
    }
    return { action: '建议观望', color: 'gray', reason: '信号偏弱，建议观望' };
  },

  _checkRiskRecovery: (latestZodiac) => {
    const state = BusinessHighChase._initRiskState();
    const config = BusinessHighChase._getConfig();

    if(!state.isPaused) return false;

    state.observationPeriods.push(latestZodiac);
    if(state.observationPeriods.length > config.risk.observationPeriods) {
      state.observationPeriods.shift();
    }

    if(state.observationPeriods.length === config.risk.observationPeriods) {
      const unique = new Set(state.observationPeriods);
      if(unique.size === config.risk.observationPeriods) {
        state.isPaused = false;
        state.consecutiveMissGroups = 0;
        state.observationPeriods = [];
        return true;
      }
    }
    return false;
  },

  _recordPlanResult: (plan) => {
    const state = BusinessHighChase._initRiskState();
    const config = BusinessHighChase._getConfig();

    if(state.isPaused) return;

    const hitCount = plan.chasePeriods.filter(p => p.status === 'hit').length;
    const isWin = hitCount > 0;

    if(!isWin) {
      state.consecutiveMissGroups++;
      if(state.consecutiveMissGroups >= config.risk.consecutiveMissGroups) {
        state.isPaused = true;
      }
    } else {
      state.consecutiveMissGroups = 0;
    }
  },

  _scoreMultiTimeframe: (history) => {
    const windows = [
      CHASE_CONSTANTS.MULTI_WINDOW_SHORT,
      CHASE_CONSTANTS.MULTI_WINDOW_MID,
      CHASE_CONSTANTS.MULTI_WINDOW_LONG
    ];
    const weights = CHASE_CONSTANTS.MULTI_WINDOW_WEIGHTS;
    const allZodiacs = [...new Set(history.map(h => h.zodiac))];
    const scores = {};
    allZodiacs.forEach(z => { scores[z] = 0; });

    for(let w = 0; w < windows.length; w++) {
      const windowData = history.slice(0, Math.min(windows[w], history.length));
      const freq = BusinessHighChase._countZodiacFrequency(windowData, true);
      const maxFreq = Math.max(1, ...Array.from(freq.values()));
      for(const zod of allZodiacs) {
        const raw = freq.get(zod) || 0;
        const normalized = (raw / maxFreq) * 100;
        scores[zod] += normalized * weights[w];
      }
    }

    const sorted = allZodiacs.sort((a, b) => scores[b] - scores[a]);
    return { scores, sorted, maxScore: Math.max(...Object.values(scores)) };
  },

  _recommendEnhanced: (history) => {
    if(history.length < CHASE_CONSTANTS.MIN_HISTORY_LENGTH) {
      return { error: '至少需要25期历史数据' };
    }
    const config = BusinessHighChase._getConfig();
    const defaultLen = config.default.periodLength;
    const detectLen = Math.min(defaultLen, history.length);
    const market = BusinessHighChase._getMarketCondition(history.slice(0, detectLen));
    const periodLen = config.periodLength[market] || defaultLen;
    const threshold = config.threshold[market] || config.default.threshold;
    const cycleStage = BusinessHighChase._getCycleStage(history, market);
    let adjustedPeriodLen = periodLen;
    if(cycleStage === 'late') {
      adjustedPeriodLen = Math.min(periodLen + config.cycleLateOffset.periodAdd, history.length);
    }
    const filterRecentLen = BusinessHighChase._getFilterRecentLen(market, cycleStage);

    const mtf = BusinessHighChase._scoreMultiTimeframe(history);
    const latestZod = history[0]?.zodiac;
    const recommendation = mtf.sorted
      .filter(z => z !== latestZod)
      .slice(0, 4);

    let adjustedThreshold = threshold;
    if(cycleStage === 'late') {
      adjustedThreshold = Math.min(threshold + 1, 5);
    }

    Logger.debug('追号推荐计算(enhanced)', {
      market,
      periodLen,
      threshold,
      cycleStage,
      filterRecentLen,
      recommendation,
      multiScores: mtf.scores,
      historyLength: history.length
    });

    const riskStatus = BusinessHighChase._initRiskState();
    const needBackup = BusinessHighChase._needBackupStrategy(riskStatus.isPaused, market, cycleStage);
    let backupRecommendation = [];
    if(needBackup && recommendation.length > 0) {
      backupRecommendation = BusinessHighChase._genBackupRecommend(history, recommendation);
    }

    return {
      recommendation,
      backupRecommendation,
      needBackup,
      market,
      cycleStage,
      periodLen: adjustedPeriodLen,
      threshold,
      adjustedThreshold,
      filterRecentLen,
      freq: Object.fromEntries(Object.entries(mtf.scores).map(([k, v]) => [k, Math.round(v)]))
    };
  },

  _recommendNext: (history) => {
    if(BusinessHighChase._getEffectiveAlgorithmMode() === 'enhanced') {
      return BusinessHighChase._recommendEnhanced(history);
    }
    if(history.length < CHASE_CONSTANTS.MIN_HISTORY_LENGTH) {
      return { error: '至少需要25期历史数据' };
    }
    const config = BusinessHighChase._getConfig();
    const defaultLen = config.default.periodLength;
    const detectLen = Math.min(defaultLen, history.length);
    const market = BusinessHighChase._getMarketCondition(history.slice(0, detectLen));
    const periodLen = config.periodLength[market] || defaultLen;
    const threshold = config.threshold[market] || config.default.threshold;
    const cycleStage = BusinessHighChase._getCycleStage(history, market);
    let adjustedPeriodLen = periodLen;
    if(cycleStage === 'late') {
      adjustedPeriodLen = Math.min(periodLen + config.cycleLateOffset.periodAdd, history.length);
    }
    const filterRecentLen = BusinessHighChase._getFilterRecentLen(market, cycleStage);
    const recent = BusinessHighChase._getRecentPeriods(history, adjustedPeriodLen, true);
    const filteredRecent = BusinessHighChase._filterByRecent(recent, filterRecentLen);
    const effectiveRecent = filteredRecent.length > 0 ? filteredRecent : recent;
    const freq = BusinessHighChase._countZodiacFrequency(effectiveRecent);
    const sorted = BusinessHighChase._sortByFrequencyAndRecency(effectiveRecent, freq);
    let adjustedThreshold = threshold;
    if(cycleStage === 'late') {
      adjustedThreshold = Math.min(threshold + 1, 5);
    }
    const highFreq = sorted.filter(z => (freq.get(z) || 0) >= adjustedThreshold);
    let recommendation = [];
    if(highFreq.length >= 4) {
      recommendation = highFreq.slice(0, 4);
    } else {
      const needed = 4 - highFreq.length;
      const fallback = sorted.filter(z => (freq.get(z) || 0) < threshold);
      recommendation = highFreq.concat(fallback.slice(0, needed));
    }
    
    Logger.debug('追号推荐计算', {
      market,
      periodLen,
      threshold,
      cycleStage,
      filterRecentLen,
      filteredCount: filteredRecent.length,
      highFreqCount: highFreq.length,
      recommendation,
      historyLength: history.length,
      latestZodiac: history[0]?.zodiac,
      secondZodiac: history[1]?.zodiac
    });
    
    const riskStatus = BusinessHighChase._initRiskState();
    const needBackup = BusinessHighChase._needBackupStrategy(riskStatus.isPaused, market, cycleStage);
    let backupRecommendation = [];
    if(needBackup && recommendation.length > 0) {
      backupRecommendation = BusinessHighChase._genBackupRecommend(history, recommendation);
    }
    
    return {
      recommendation,
      backupRecommendation,
      needBackup,
      market,
      cycleStage,
      periodLen: adjustedPeriodLen,
      threshold,
      adjustedThreshold,
      filterRecentLen,
      freq: Object.fromEntries(freq)
    };
  },

  _needBackupStrategy: (isPaused, market, cycleStage) => {
    if(isPaused) return true;
    if(market === 'shock' && cycleStage === 'late') return true;
    if(market === 'cold' && (cycleStage === 'mid' || cycleStage === 'late')) return true;
    return false;
  },

  _genBackupRecommend: (history, mainList) => {
    const config = BusinessHighChase._getConfig();
    const backupConfig = config.backupStrategy;
    
    const periodLen = backupConfig.lookBackPeriod;
    const minFreq = backupConfig.minFreq;
    const marketFilter = config.dynamicFilter;
    
    const baseFilter = marketFilter.normal || 5;
    const filterLen = baseFilter + backupConfig.filterOffset;
    
    const recent = history.slice(0, Math.min(periodLen, history.length));
    const filteredRecent = BusinessHighChase._filterByRecent(recent, filterLen);
    const effectiveRecent = filteredRecent.length > 0 ? filteredRecent : recent;
    
    const freq = BusinessHighChase._countZodiacFrequency(effectiveRecent);
    
    const missCounts = {};
    effectiveRecent.forEach((item, idx) => {
      if(missCounts[item.zodiac] === undefined) {
        missCounts[item.zodiac] = idx;
      }
    });
    
    const mainSet = new Set(mainList);
    const zodiacs = [...new Set(effectiveRecent.map(p => p.zodiac))].filter(z => !mainSet.has(z));
    
    const sortedBackup = zodiacs.sort((a, b) => {
      const aMiss = missCounts[a] !== undefined ? missCounts[a] : effectiveRecent.length;
      const bMiss = missCounts[b] !== undefined ? missCounts[b] : effectiveRecent.length;
      const missDiff = bMiss - aMiss;
      if(Math.abs(missDiff) > 2) return missDiff;
      const aFreq = freq.get(a) || 0;
      const bFreq = freq.get(b) || 0;
      return aFreq - bFreq;
    });
    
    const validBackup = sortedBackup.filter(z => {
      const f = freq.get(z) || 0;
      return f >= minFreq;
    });
    
    Logger.debug('备选推荐计算', {
      filterLen,
      recentLength: recent.length,
      filteredLength: filteredRecent.length,
      mainList,
      missCounts,
      sortedBackup,
      validBackup
    });
    
    return validBackup.slice(0, config.recommendCount.backup);
  },

  _generateChasePlan: (history) => {
    const recResult = BusinessHighChase._recommendNext(history);
    if(recResult.error) return recResult;
    
    const cycleStage = recResult.cycleStage || 'early';
    let maxAttempts = BusinessHighChase._getMaxAttemptsWithStage(recResult.market, cycleStage);
    const latestExpect = history[0].period;
    const latestPeriodNum = parseInt(latestExpect);
    
    if(isNaN(latestPeriodNum)) {
      return { error: '期号格式错误' };
    }

    const riskStatus = BusinessHighChase._initRiskState();
    
    const chasePeriods = [];
    if(!riskStatus.isPaused && maxAttempts > 0) {
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
    }

    const hitRate = BusinessHighChase._calculateRecentHitRate();
    let baseConfidence = BusinessHighChase._getConfidenceScore(
      recResult.market,
      recResult.recommendation.length,
      hitRate
    );
    if(cycleStage === 'late') {
      baseConfidence = Math.max(0, baseConfidence - 20);
    }
    const suggestion = BusinessHighChase._getSuggestion(baseConfidence, riskStatus.isPaused, recResult.market);

    if(riskStatus.isPaused) {
      return {
        action: 'paused_display',
        recommendation: recResult.recommendation,
        backupRecommendation: recResult.backupRecommendation,
        needBackup: recResult.needBackup,
        market: recResult.market,
        cycleStage,
        periodLen: recResult.periodLen,
        threshold: recResult.threshold,
        adjustedThreshold: recResult.adjustedThreshold,
        filterRecentLen: recResult.filterRecentLen,
        maxAttempts: 0,
        confidenceScore: 0,
        suggestion: suggestion,
        riskStatus: riskStatus,
        chasePeriods: [],
        currentPeriodIndex: 0,
        isPlanActive: false,
        message: '风控暂停中，可正常查看推荐但不开启关注'
      };
    }

    return {
      action: 'new_chase_plan',
      recommendation: recResult.recommendation,
      backupRecommendation: recResult.backupRecommendation,
      needBackup: recResult.needBackup,
      market: recResult.market,
      cycleStage,
      periodLen: recResult.periodLen,
      threshold: recResult.threshold,
      adjustedThreshold: recResult.adjustedThreshold,
      filterRecentLen: recResult.filterRecentLen,
      maxAttempts: maxAttempts,
      confidenceScore: baseConfidence,
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
    const currentExpect = historyData[0]?.expect;
    if(currentExpect === targetExpect) {
      const latestItem = historyData[0];
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
    }

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

    if(history.length < CHASE_CONSTANTS.MIN_HISTORY_LENGTH) {
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

      if(historyData.length > 0) {
        const latestItem = historyData[0];
        const latestS = DataQuery.getSpecial(latestItem);
        if(latestS && latestS.zod) {
          BusinessHighChase._checkRiskRecovery(latestS.zod);
        }
      }

      const updatedPlan = BusinessHighChase._checkPlanHitResult(plan, historyData);
      
      if(updatedPlan && updatedPlan.isPlanActive) {
        BusinessHighChase._savePlan(updatedPlan);
        return {
          action: 'continue_chase',
          remainingAttempts: updatedPlan.maxAttempts - updatedPlan.currentPeriodIndex,
          recommendation: updatedPlan.recommendation,
          market: updatedPlan.market,
          cycleStage: updatedPlan.cycleStage,
          maxAttempts: updatedPlan.maxAttempts,
          isPlanActive: true
        };
      }

      if(updatedPlan && !updatedPlan.isPlanActive && !updatedPlan._recorded) {
        BusinessHighChase._recordCompletedPlan(updatedPlan);
        BusinessHighChase._recordPlanResult(updatedPlan);
        updatedPlan._recorded = true;
      }

      const riskState = BusinessHighChase._initRiskState();
      if(riskState.isPaused) {
        return {
          ...(updatedPlan || {}),
          action: 'paused',
          message: '风控暂停中，等待4期行情企稳',
          isPlanActive: false,
          riskStatus: { ...riskState, isPaused: true },
          suggestion: BusinessHighChase._getSuggestion(0, true, updatedPlan?.market)
        };
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
            BusinessHighChase._recordPlanResult(savedPlan);
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
      if(!historyData || historyData.length < CHASE_CONSTANTS.MIN_HISTORY_LENGTH) {
        return { error: '历史数据不足25期' };
      }

      return BusinessHighChase._generateNewPlan(historyData);
    } catch(e) {
      Logger.error('BusinessHighChase.getStrategyData 错误:', e);
      return { error: '计算出错，请刷新' };
    }
  },

  getAlgorithmMode: () => BusinessHighChase._getEffectiveAlgorithmMode(),

  getMarketParams: () => {
    const config = BusinessHighChase._getConfig();
    const state = StateManager._state;
    const historyData = state.analysis.historyData;
    if(!historyData || historyData.length < 27) {
      return {
        hot: { periodLength: config.periodLength.hot, threshold: config.threshold.hot, maxAttempts: config.maxAttempts.hot },
        normal: { periodLength: config.periodLength.normal, threshold: config.threshold.normal, maxAttempts: config.maxAttempts.normal },
        shock: { periodLength: config.periodLength.shock, threshold: config.threshold.shock, maxAttempts: config.maxAttempts.shock },
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
      normal: { periodLength: config.periodLength.normal, threshold: config.threshold.normal, maxAttempts: config.maxAttempts.normal },
      shock: { periodLength: config.periodLength.shock, threshold: config.threshold.shock, maxAttempts: config.maxAttempts.shock },
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

  getEngineStatus: () => {
    const riskState = BusinessHighChase._initRiskState();
    const activeGroup = BusinessHighChase._lastResult;
    return {
      isPaused: riskState.isPaused,
      consecutiveMissGroups: riskState.consecutiveMissGroups,
      activeGroup: activeGroup ? {
        recommendation: activeGroup.recommendation,
        remainingAttempts: activeGroup.maxAttempts - (activeGroup.currentPeriodIndex || 0),
        isPlanActive: activeGroup.isPlanActive
      } : null,
      lastRecommendation: activeGroup
    };
  },

  _savePlan: (plan) => {
    if(plan && plan.error) return;
    Storage.set('high_chase_plan', plan || null);
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

      if(history.length < CHASE_CONSTANTS.MIN_HISTORY_LENGTH) {
        return { error: '有效历史数据不足25期' };
      }

      const recResult = BusinessHighChase._recommendNext(history);
      if(recResult.error) return recResult;

      const periodLength = recResult.periodLen;
      const threshold = recResult.adjustedThreshold || recResult.threshold;

      const calcHistory = history.slice(0, periodLength);

      const zodiacCounts = {};
      calcHistory.forEach(item => {
        zodiacCounts[item.zodiac] = (zodiacCounts[item.zodiac] || 0) + 1;
      });

      const missCounts = {};
      history.forEach((item, idx) => {
        if(missCounts[item.zodiac] === undefined) {
          missCounts[item.zodiac] = idx;
        }
      });

      const highFreqZodiacs = [];
      Object.entries(zodiacCounts).forEach(([zod, count]) => {
        if(count >= threshold) {
          const missed = missCounts[zod] !== undefined ? missCounts[zod] : 0;
          highFreqZodiacs.push({ zodiac: zod, count, missed });
        }
      });
      highFreqZodiacs.sort((a, b) => b.count - a.count);

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
  },

  refreshHistoryDetail: () => {
    return BusinessHighChase.getHistoryDetail();
  }
};