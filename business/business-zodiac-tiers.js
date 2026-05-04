/**
 * 生肖冷热分级系统 - 业务层
 * @description 实现四级分类、节奏窗、周转率、阶段判断、推荐生成等核心算法
 * @layer business (禁止DOM操作)
 */
const BusinessZodiacTiers = {
  CONFIG: Object.freeze({
    rhythmWindowMin: 6,
    rhythmWindowDefault: 8,
    rhythmWindowMax: 10,
    coldWindow: 30,
    turnoverSample: 20,
    turnoverFast: 0.75,
    turnoverSlow: 0.60,
    turnoverRecalcInterval: 5,
    hotMinCount: 2,
    hotMaxMiss: 4,
    coldThreshold: 15,
    hotPoolMin: 4,
    breakWindow: 3,
    pendingMin: 3,
    pendingMax: 5,
    recommendSize: 4,
    allZodiacs: ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪']
  }),

  _getCurrentYear: () => {
    return new Date().getFullYear();
  },

  _getSortedZodiacHistory: () => {
    const state = StateManager._state;
    const historyData = state.analysis.historyData;
    if(!historyData || historyData.length === 0) return [];

    const result = [];
    for(let i = historyData.length - 1; i >= 0; i--) {
      const item = historyData[i];
      const s = DataQuery.getSpecial(item);
      if(s && s.zod) {
        result.push(s.zod);
      }
    }
    return result;
  },

  _getSpecialZodiacHistory: (limit) => {
    const state = StateManager._state;
    const historyData = state.analysis.historyData;
    const sorted = BusinessZodiacTiers._getSortedZodiacHistory();
    if(sorted.length === 0) return [];

    const currentYear = BusinessZodiacTiers._getCurrentYear();
    const yearPrefix = String(currentYear);
    const minPeriods = 50;

    let yearStart = -1;
    if(historyData && historyData.length > 0) {
      for(let i = 0; i < sorted.length; i++) {
        const idx = historyData.length - 1 - i;
        if(idx >= 0 && idx < historyData.length) {
          const expect = historyData[idx].expect || '';
          if(expect.startsWith(yearPrefix) && yearStart === -1) {
            yearStart = i;
            break;
          }
        }
      }
    }

    const yearHistory = yearStart >= 0 ? sorted.slice(yearStart) : [];
    const effectiveHistory = yearHistory.length >= minPeriods ? yearHistory : sorted.slice(-minPeriods);
    const effectiveLimit = limit || effectiveHistory.length;
    const result = effectiveHistory.slice(-effectiveLimit);
    
    BusinessZodiacTiers._historySource = yearHistory.length >= minPeriods ? 'year' : 'crossYear';
    BusinessZodiacTiers._historyYearCount = yearHistory.length;
    BusinessZodiacTiers._historyTotalCount = effectiveHistory.length;
    
    return result;
  },

  _getZodiacExpect: (zodiac) => {
    const state = StateManager._state;
    const historyData = state.analysis.historyData;
    if(!historyData || historyData.length === 0) return null;
    
    for(let i = 0; i < historyData.length; i++) {
      const item = historyData[i];
      const s = DataQuery.getSpecial(item);
      if(s && s.zod === zodiac) {
        return item.expect || null;
      }
    }
    return null;
  },

  _getLatestExpect: () => {
    const state = StateManager._state;
    const historyData = state.analysis.historyData;
    if(!historyData || historyData.length === 0) return null;
    return historyData[0].expect || null;
  },

  _calcMissPeriods: (lastExpect, latestExpect) => {
    if(!lastExpect || !latestExpect) return 0;
    const lastNum = parseInt(String(lastExpect).trim());
    const latestNum = parseInt(String(latestExpect).trim());
    if(isNaN(lastNum) || isNaN(latestNum)) return 0;
    return Math.max(0, latestNum - lastNum);
  },

  _getAllZodiacStats: (history, rhythmWindow) => {
    const zodiacs = BusinessZodiacTiers.CONFIG.allZodiacs;
    const rhythmHistory = history.slice(-rhythmWindow);
    const coldHistory = history.slice(-BusinessZodiacTiers.CONFIG.coldWindow);
    const latestExpect = BusinessZodiacTiers._getLatestExpect();
    
    return zodiacs.map(name => {
      let totalCount = 0;
      let rhythmCount = 0;
      let coldCount = 0;
      
      const lastExpect = BusinessZodiacTiers._getZodiacExpect(name);
      const currentMiss = BusinessZodiacTiers._calcMissPeriods(lastExpect, latestExpect);
      
      for(let i = 0; i < history.length; i++) {
        if(history[i] === name) {
          totalCount++;
        }
      }
      
      rhythmHistory.forEach(z => { if(z === name) rhythmCount++; });
      coldHistory.forEach(z => { if(z === name) coldCount++; });
      
      const isSilent = rhythmCount === 0 && totalCount > 0;
      const neverAppeared = totalCount === 0;
      
      return {
        name,
        totalCount,
        currentMiss,
        rhythmCount,
        coldCount,
        isSilent,
        neverAppeared
      };
    });
  },

  calcRhythmWindow: (history) => {
    if(!history || history.length < BusinessZodiacTiers.CONFIG.turnoverSample) {
      return BusinessZodiacTiers.CONFIG.rhythmWindowDefault;
    }
    
    const recent = history.slice(-BusinessZodiacTiers.CONFIG.turnoverSample);
    const rate = BusinessZodiacTiers.calcTurnoverRate(recent);
    
    if(rate >= BusinessZodiacTiers.CONFIG.turnoverFast) {
      return BusinessZodiacTiers.CONFIG.rhythmWindowMin;
    } else if(rate >= BusinessZodiacTiers.CONFIG.turnoverSlow) {
      return BusinessZodiacTiers.CONFIG.rhythmWindowDefault;
    } else {
      return BusinessZodiacTiers.CONFIG.rhythmWindowMax;
    }
  },

  calcTurnoverRate: (recentHistory) => {
    if(!recentHistory || recentHistory.length === 0) return 0;
    const unique = new Set(recentHistory).size;
    return unique / recentHistory.length;
  },

  classifyZodiacs: (history, rhythmWindow) => {
    const stats = BusinessZodiacTiers._getAllZodiacStats(history, rhythmWindow);
    const cfg = BusinessZodiacTiers.CONFIG;
    
    const tiers = { hot: [], warm: [], edge: [], cold: [] };
    
    stats.forEach(z => {
      const { name, rhythmCount, currentMiss, totalCount, coldCount } = z;
      let tier;
      
      if(rhythmCount >= cfg.hotMinCount && currentMiss <= cfg.hotMaxMiss) {
        tier = 'hot';
      } else if(rhythmCount >= 1) {
        tier = 'warm';
      } else {
        if(currentMiss >= cfg.coldThreshold) {
          tier = 'cold';
        } else if(coldCount > 0 || totalCount > 0) {
          tier = 'edge';
        } else {
          tier = 'cold';
        }
      }
      
      tiers[tier].push(z);
    });
    
    return { tiers, stats };
  },

  determinePhase: (tiers, silent, recent3) => {
    const cfg = BusinessZodiacTiers.CONFIG;
    const hotPoolSize = tiers.hot.length;
    
    if(recent3 && recent3.length > 0) {
      for(let i = 0; i < Math.min(cfg.breakWindow, recent3.length); i++) {
        if(silent && silent.includes(recent3[i])) {
          return 'cold_break';
        }
      }
    }
    
    if(hotPoolSize >= cfg.hotPoolMin) {
      return 'hot';
    } else {
      return 'cooling';
    }
  },

  _calcScore: (z) => {
    return Math.round((z.currentMiss * 0.4 + z.rhythmCount * 0.6) * 100) / 100;
  },

  _generateScoredRecommend: (candidates, maxCount) => {
    const scored = candidates.map(z => ({
      name: z.name,
      score: BusinessZodiacTiers._calcScore(z)
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxCount);
  },

  generateRecommend: (tiers, phase, silent, recommendSize) => {
    const cfg = BusinessZodiacTiers.CONFIG;
    let recommend = [];
    
    if(phase === 'hot') {
      const pending = tiers.hot.filter(z => 
        z.currentMiss >= cfg.pendingMin && z.currentMiss <= cfg.pendingMax
      );
      pending.sort((a, b) => b.currentMiss - a.currentMiss);
      recommend = pending.map(z => z.name);
      
      if(recommend.length < cfg.recommendSize) {
        const active = tiers.hot.filter(z => 
          !recommend.includes(z.name) && z.currentMiss >= 2
        );
        const scored = BusinessZodiacTiers._generateScoredRecommend(active, cfg.recommendSize - recommend.length);
        recommend = recommend.concat(scored.map(s => s.name));
      }
    } else if(phase === 'cooling') {
      const hotCandidates = tiers.hot.filter(z => z.currentMiss >= 2);
      const hotScored = BusinessZodiacTiers._generateScoredRecommend(hotCandidates, recommendSize);
      recommend = hotScored.map(s => s.name);
      
      const warmCandidates = tiers.warm.filter(z => 
        z.currentMiss >= 5 && z.currentMiss <= 10
      );
      const warmScored = BusinessZodiacTiers._generateScoredRecommend(warmCandidates, recommendSize - recommend.length);
      recommend = recommend.concat(warmScored.map(s => s.name));
      
      if(recommend.length > recommendSize) {
        recommend = recommend.slice(0, recommendSize);
      }
    } else if(phase === 'cold_break') {
      const breakZodiac = silent && silent.length > 0 ? silent[0] : null;
      if(breakZodiac) {
        recommend.push(breakZodiac);
      }
      
      const edgeCandidates = tiers.edge.filter(z => 
        z.currentMiss >= cfg.coldThreshold
      );
      const edgeScored = BusinessZodiacTiers._generateScoredRecommend(edgeCandidates, recommendSize - recommend.length);
      recommend = recommend.concat(edgeScored.map(s => s.name));
      
      const hotCandidates = tiers.hot.filter(z => 
        !recommend.includes(z.name) && z.currentMiss >= 2
      );
      const hotScored = BusinessZodiacTiers._generateScoredRecommend(hotCandidates, recommendSize - recommend.length);
      recommend = recommend.concat(hotScored.map(s => s.name));
      
      if(recommend.length > recommendSize) {
        recommend = recommend.slice(0, recommendSize);
      }
    }
    
    if(recommend.length < recommendSize) {
      const candidates = [...tiers.hot, ...tiers.warm].filter(z => 
        !recommend.includes(z.name) && z.currentMiss >= 2
      );
      const scored = BusinessZodiacTiers._generateScoredRecommend(candidates, recommendSize - recommend.length);
      recommend = recommend.concat(scored.map(s => s.name));
    }
    
    return recommend.slice(0, recommendSize);
  },

  generateRecommendWithScores: (tiers, phase, silent, recommendSize) => {
    const cfg = BusinessZodiacTiers.CONFIG;
    let recommend = [];
    const scores = {};
    
    const addCandidates = (candidates, count) => {
      const scored = candidates.map(z => ({ name: z.name, score: BusinessZodiacTiers._calcScore(z) }));
      scored.sort((a, b) => b.score - a.score);
      const selected = scored.slice(0, count);
      selected.forEach(s => {
        if(!recommend.includes(s.name)) {
          recommend.push(s.name);
          scores[s.name] = s.score;
        }
      });
    };
    
    if(phase === 'hot') {
      const pending = tiers.hot.filter(z => 
        z.currentMiss >= cfg.pendingMin && z.currentMiss <= cfg.pendingMax
      );
      pending.sort((a, b) => b.currentMiss - a.currentMiss);
      pending.forEach(z => {
        recommend.push(z.name);
        scores[z.name] = BusinessZodiacTiers._calcScore(z);
      });
      
      if(recommend.length < cfg.recommendSize) {
        const active = tiers.hot.filter(z => 
          !recommend.includes(z.name) && z.currentMiss >= 2
        );
        addCandidates(active, cfg.recommendSize - recommend.length);
      }
    } else if(phase === 'cooling') {
      const hotCandidates = tiers.hot.filter(z => z.currentMiss >= 2);
      addCandidates(hotCandidates, recommendSize);
      
      const warmCandidates = tiers.warm.filter(z => 
        z.currentMiss >= 5 && z.currentMiss <= 10
      );
      addCandidates(warmCandidates, recommendSize - recommend.length);
      
      if(recommend.length > recommendSize) {
        recommend = recommend.slice(0, recommendSize);
      }
    } else if(phase === 'cold_break') {
      const breakZodiac = silent && silent.length > 0 ? silent[0] : null;
      if(breakZodiac) {
        recommend.push(breakZodiac);
        scores[breakZodiac] = BusinessZodiacTiers._calcScore(tiers.edge.find(z => z.name === breakZodiac) || { currentMiss: 0, rhythmCount: 0 });
      }
      
      const edgeCandidates = tiers.edge.filter(z => z.currentMiss >= cfg.coldThreshold);
      addCandidates(edgeCandidates, recommendSize - recommend.length);
      
      const hotCandidates = tiers.hot.filter(z => 
        !recommend.includes(z.name) && z.currentMiss >= 2
      );
      addCandidates(hotCandidates, recommendSize - recommend.length);
      
      if(recommend.length > recommendSize) {
        recommend = recommend.slice(0, recommendSize);
      }
    }
    
    if(recommend.length < recommendSize) {
      const candidates = [...tiers.hot, ...tiers.warm].filter(z => 
        !recommend.includes(z.name) && z.currentMiss >= 2
      );
      addCandidates(candidates, recommendSize - recommend.length);
    }
    
    return { list: recommend.slice(0, recommendSize), scores };
  },

  getSilentPool: (stats) => {
    if(!stats) return [];
    return stats.filter(z => z.isSilent).map(z => z.name);
  },

  getBreakSignal: (silent, recent3, history, rhythmWindow) => {
    const cfg = BusinessZodiacTiers.CONFIG;
    if(!silent || silent.length === 0 || !recent3 || recent3.length === 0) {
      return { breakSignal: false, breakZodiac: null };
    }
    
    for(let i = 0; i < Math.min(cfg.breakWindow, recent3.length); i++) {
      if(silent.includes(recent3[i])) {
        return { breakSignal: true, breakZodiac: recent3[i] };
      }
    }

    for(let i = 0; i < Math.min(cfg.breakWindow, recent3.length); i++) {
      const zod = recent3[i];
      const lastIdx = history.lastIndexOf(zod);
      if(lastIdx === -1) continue;

      const beforeDraw = history.slice(0, lastIdx);
      const window = beforeDraw.slice(-rhythmWindow);
      
      if(!window.includes(zod) && beforeDraw.includes(zod)) {
        return { breakSignal: true, breakZodiac: zod };
      }
    }
    
    return { breakSignal: false, breakZodiac: null };
  },

  getStrategyText: (phase, tiers, silent) => {
    const phaseMap = {
      hot: '🔥 热态持续：关注热号回补',
      cooling: '🌡 降温阶段：热号+温号组合',
      cold_break: '💎 冷态破冰：静默号破冰信号'
    };
    return phaseMap[phase] || '⏳ 等待数据积累';
  },

  analyzeZodiac: (history) => {
    const cfg = BusinessZodiacTiers.CONFIG;
    const rhythmWindow = BusinessZodiacTiers.calcRhythmWindow(history);
    const { tiers, stats } = BusinessZodiacTiers.classifyZodiacs(history, rhythmWindow);
    const silent = BusinessZodiacTiers.getSilentPool(stats);
    
    const recent3 = history.slice(-cfg.breakWindow);
    const phase = BusinessZodiacTiers.determinePhase(tiers, silent, recent3);
    const { breakSignal, breakZodiac } = BusinessZodiacTiers.getBreakSignal(silent, recent3, history, rhythmWindow);
    
    const recommend = BusinessZodiacTiers.generateRecommend(tiers, phase, silent, cfg.recommendSize);
    const turnoverRate = history.length >= cfg.turnoverSample 
      ? BusinessZodiacTiers.calcTurnoverRate(history.slice(-cfg.turnoverSample))
      : 0;
    
    const strategy = BusinessZodiacTiers.getStrategyText(phase, tiers, silent);
    
    return {
      tiers,
      silent,
      phase,
      strategy,
      recommend,
      rhythmWindow,
      turnoverRate: Math.round(turnoverRate * 100) / 100,
      stats,
      signals: {
        breakSignal,
        breakZodiac,
        hotPoolSize: tiers.hot.length
      }
    };
  },

  backtest: (fullHistory, minTrainSize) => {
    const cfg = BusinessZodiacTiers.CONFIG;
    const trainSize = minTrainSize || cfg.turnoverSample;
    
    if(!fullHistory || fullHistory.length <= trainSize) {
      return [];
    }
    
    const results = [];
    
    for(let i = trainSize; i < fullHistory.length; i++) {
      const history = fullHistory.slice(0, i);
      const actual = fullHistory[i];
      
      const result = BusinessZodiacTiers.analyzeZodiac(history);
      result.actualNext = actual;
      result.isHit = result.recommend.includes(actual);
      result.historyIndex = i;
      
      results.push(result);
    }
    
    return results;
  },

  calcHitRate: (backtestResults) => {
    if(!backtestResults || backtestResults.length === 0) {
      return { total: 0, hit: 0, rate: 0, byPhase: {} };
    }
    
    let total = backtestResults.length;
    let hit = backtestResults.filter(r => r.isHit).length;
    
    const byPhase = {};
    const phases = ['hot', 'cooling', 'cold_break'];
    
    phases.forEach(phase => {
      const phaseResults = backtestResults.filter(r => r.phase === phase);
      if(phaseResults.length > 0) {
        const phaseHit = phaseResults.filter(r => r.isHit).length;
        byPhase[phase] = {
          total: phaseResults.length,
          hit: phaseHit,
          rate: Math.round((phaseHit / phaseResults.length) * 10000) / 100
        };
      }
    });
    
    return {
      total,
      hit,
      rate: Math.round((hit / total) * 10000) / 100,
      byPhase
    };
  },

  runFullAnalysis: () => {
    try {
      const history = BusinessZodiacTiers._getSpecialZodiacHistory();
      
      if(!history || history.length < 6) {
        return {
          tiers: { hot: [], warm: [], edge: [], cold: [] },
          silent: [],
          phase: 'cooling',
          strategy: '⏳ 数据不足，至少需要6期数据',
          recommend: [],
          recommendScores: {},
          rhythmWindow: 8,
          turnoverRate: 0,
          stats: [],
          signals: { breakSignal: false, breakZodiac: null, hotPoolSize: 0 },
          hitRate: null,
          historyLength: history ? history.length : 0
        };
      }
      
      const result = BusinessZodiacTiers.analyzeZodiac(history);
      const backtestResults = BusinessZodiacTiers.backtest(history);
      const hitRate = BusinessZodiacTiers.calcHitRate(backtestResults);
      
      const recommendData = BusinessZodiacTiers.generateRecommendWithScores(
        result.tiers, result.phase, result.silent, BusinessZodiacTiers.CONFIG.recommendSize
      );
      
      return {
        ...result,
        recommend: recommendData.list,
        recommendScores: recommendData.scores,
        hitRate,
        historyLength: history.length
      };
    } catch(e) {
      console.error('生肖冷热分级分析失败', e);
      return null;
    }
  },

  getRhythmWindowDetail: () => {
    try {
      const state = StateManager._state;
      const historyData = state.analysis.historyData;
      if(!historyData || historyData.length === 0) return null;

      const sorted = BusinessZodiacTiers._getSortedZodiacHistory();
      if(sorted.length === 0) return null;

      const currentYear = BusinessZodiacTiers._getCurrentYear();
      const yearPrefix = String(currentYear);

      const historyWithPeriod = [];
      for(let i = historyData.length - 1; i >= 0; i--) {
        const item = historyData[i];
        const s = DataQuery.getSpecial(item);
        if(s && s.zod) {
          historyWithPeriod.push({ period: item.expect, zodiac: s.zod });
        }
      }

      if(historyWithPeriod.length === 0) return null;

      let yearStart = -1;
      for(let i = 0; i < historyWithPeriod.length; i++) {
        if(historyWithPeriod[i].period.startsWith(yearPrefix) && yearStart === -1) {
          yearStart = i;
          break;
        }
      }

      const minPeriods = 50;
      const yearHistory = yearStart >= 0 ? historyWithPeriod.slice(yearStart) : [];
      const history = yearHistory.length >= minPeriods ? yearHistory : historyWithPeriod.slice(-minPeriods);

      if(history.length === 0) return null;

      const rhythmWindow = BusinessZodiacTiers.calcRhythmWindow(history.map(h => h.zodiac));
      const windowContent = history.slice(-rhythmWindow);

      const records = windowContent.map((item, idx) => {
        const actualIdx = history.length - rhythmWindow + idx + 1;
        return {
          index: actualIdx,
          period: item.period,
          zodiac: item.zodiac,
          isRhythmWindow: true
        };
      });

      const zodiacCounts = {};
      windowContent.forEach(item => {
        zodiacCounts[item.zodiac] = (zodiacCounts[item.zodiac] || 0) + 1;
      });

      const turnoverRate = BusinessZodiacTiers.calcTurnoverRate(windowContent.map(h => h.zodiac));

      return {
        rhythmWindow,
        records: records,
        zodiacCounts,
        turnoverRate: Math.round(turnoverRate * 100) / 100,
        totalHistory: history.length
      };
    } catch(e) {
      console.error('获取节奏窗详情失败', e);
      return null;
    }
  }
};
