/**
 * Gemini 多窗口分析业务模块（高性能优化版）
 * @description 三窗口（5/10/15期）交叉分析、生肖分池打分、行情判定、执行策略、风控机制
 * 优化：窗口缓存、批量遗漏计算、频次预计算、消除冗余调用
 */
const BusinessGemini = {
  _state: null,
  _historyData: null,
  _cache: null,

  _getValidHistory: () => {
    const state = StateManager._state;
    const historyData = state.analysis.historyData;
    if (!historyData || historyData.length === 0) return null;
    return historyData;
  },

  _getWindowData: (historyData, windowLen) => {
    return historyData.slice(0, Math.min(windowLen, historyData.length));
  },

  _getCurrentYearData: (fullHistoryData) => {
    if (!fullHistoryData || fullHistoryData.length === 0) return [];
    const yearStr = new Date().getFullYear();
    const yearData = fullHistoryData.filter(item => (item.expect || '').startsWith(String(yearStr)));
    return yearData.length > 0 ? yearData : fullHistoryData;
  },

  _buildZodiacIndex: () => {
    const idx = {};
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach((z, i) => { idx[z] = i; });
    return idx;
  },

  _buildElementIndex: () => {
    const idx = {};
    Object.keys(CONFIG.ELEMENT_MAP).forEach((e, i) => { idx[e] = i; });
    return idx;
  },

  _buildColorIndex: () => {
    const idx = {};
    Object.keys(CONFIG.COLOR_MAP).forEach((c, i) => { idx[c] = i; });
    return idx;
  },

  _extractAllAttributes: (windowData, zodiacIndex, elementIndex, colorIndex) => {
    const zLen = CONFIG.ANALYSIS.ZODIAC_ALL.length;
    const eLen = Object.keys(CONFIG.ELEMENT_MAP).length;
    const cLen = Object.keys(CONFIG.COLOR_MAP).length;
    const zodiacFreq = new Array(zLen).fill(0);
    const fiveElementsFreq = new Array(eLen).fill(0);
    const colorFreq = new Array(cLen).fill(0);
    const tailFreq = new Array(10).fill(0);
    const headFreq = new Array(5).fill(0);

    const dataLen = windowData.length;
    for (let i = 0; i < dataLen; i++) {
      const special = DataQuery.getSpecial(windowData[i]);
      if (!special || special.te < 1 || special.te > 49) continue;

      const zodIdx = zodiacIndex[special.zod];
      if (zodIdx !== undefined) zodiacFreq[zodIdx]++;

      const elemIdx = elementIndex[special.wuxing];
      if (elemIdx !== undefined) fiveElementsFreq[elemIdx]++;

      const colIdx = colorIndex[special.colorName];
      if (colIdx !== undefined) colorFreq[colIdx]++;

      tailFreq[special.tail]++;
      headFreq[special.head]++;
    }

    return { zodiacFreq, fiveElementsFreq, colorFreq, tailFreq, headFreq };
  },

  _toZodiacFreqMap: (freqArr, zodiacAll) => {
    const map = {};
    for (let i = 0; i < zodiacAll.length; i++) map[zodiacAll[i]] = freqArr[i];
    return map;
  },

  _toFreqMap: (freqArr, keys) => {
    const map = {};
    for (let i = 0; i < keys.length; i++) map[keys[i]] = freqArr[i];
    return map;
  },

  _calcZodiacMiss: (historyData, zodiacIndex) => {
    const total = historyData.length;
    const zodiacAll = CONFIG.ANALYSIS.ZODIAC_ALL;
    const zLen = zodiacAll.length;
    const missArr = new Array(zLen).fill(-1);

    for (let i = 0; i < total; i++) {
      const special = DataQuery.getSpecial(historyData[i]);
      if (!special) continue;
      const idx = zodiacIndex[special.zod];
      if (idx !== undefined && missArr[idx] === -1) {
        missArr[idx] = i;
      }
    }

    for (let i = 0; i < zLen; i++) {
      if (missArr[i] === -1) missArr[i] = total;
    }

    return missArr;
  },

  _missArrToMap: (missArr, zodiacAll) => {
    const map = {};
    for (let i = 0; i < zodiacAll.length; i++) map[zodiacAll[i]] = missArr[i];
    return map;
  },

  _calcZodiacFreqBatch: (historyData, zodiacIndex, maxWindow) => {
    const zodiacAll = CONFIG.ANALYSIS.ZODIAC_ALL;
    const zLen = zodiacAll.length;
    const totalFreq = new Array(zLen).fill(0);
    const limit = Math.min(maxWindow, historyData.length);

    for (let i = 0; i < limit; i++) {
      const special = DataQuery.getSpecial(historyData[i]);
      if (!special) continue;
      const idx = zodiacIndex[special.zod];
      if (idx !== undefined) totalFreq[idx]++;
    }

    return totalFreq;
  },

  _calcConsecutiveInWindow: (historyData, zodiacIndex, windowLen, zodIdx) => {
    const limit = Math.min(windowLen, historyData.length);
    let maxConsecutive = 0;
    let currentConsecutive = 0;
    let totalCount = 0;

    for (let i = 0; i < limit; i++) {
      const special = DataQuery.getSpecial(historyData[i]);
      if (!special) continue;
      const idx = zodiacIndex[special.zod];
      if (idx === zodIdx) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
        totalCount++;
      } else {
        currentConsecutive = 0;
      }
    }

    return { totalCount, maxConsecutive };
  },

  _getSpecialAt: (historyData, pos) => {
    if (!historyData || pos >= historyData.length) return null;
    return DataQuery.getSpecial(historyData[pos]);
  },

  _getRecentZodiacsByIdx: (historyData, zodiacIndex, windowLen) => {
    const result = [];
    const limit = Math.min(windowLen, historyData.length);
    for (let i = 0; i < limit; i++) {
      const special = DataQuery.getSpecial(historyData[i]);
      if (special) result.push(zodiacIndex[special.zod] !== undefined ? zodiacIndex[special.zod] : -1);
    }
    return result;
  },

  _calcStdDev: (values, mean) => {
    const len = values.length;
    let sumSq = 0;
    for (let i = 0; i < len; i++) sumSq += (values[i] - mean) * (values[i] - mean);
    return Math.sqrt(sumSq / len);
  },

  _identifyAnnualWeakZodiac: (yearData, zodiacIndex) => {
    if (!yearData || yearData.length < 12) return { weakPool: [], freqMap: {} };

    const zodiacAll = CONFIG.ANALYSIS.ZODIAC_ALL;
    const zLen = zodiacAll.length;
    const freqArr = new Array(zLen).fill(0);

    for (let i = 0; i < yearData.length; i++) {
      const idx = zodiacIndex[DataQuery.getSpecial(yearData[i])?.zod];
      if (idx !== undefined) freqArr[idx]++;
    }

    const sorted = [];
    for (let i = 0; i < zLen; i++) sorted.push({ zodiac: zodiacAll[i], freq: freqArr[i] });
    sorted.sort((a, b) => a.freq - b.freq);

    const weakCount = Math.min(2, Math.ceil(12 * 0.17));
    const weakPool = sorted.slice(0, weakCount).map(s => s.zodiac);
    const freqMap = {};
    sorted.forEach(s => { freqMap[s.zodiac] = s.freq; });

    return { weakPool, freqMap };
  },

  _classifyTierPools: (yearData, historyData, zodiacIndex) => {
    const zodiacAll = CONFIG.ANALYSIS.ZODIAC_ALL;
    const zLen = zodiacAll.length;
    const yearFreqArr = new Array(zLen).fill(0);

    if (yearData && yearData.length > 0) {
      for (let i = 0; i < yearData.length; i++) {
        const idx = zodiacIndex[DataQuery.getSpecial(yearData[i])?.zod];
        if (idx !== undefined) yearFreqArr[idx]++;
      }
    }

    const window15FreqArr = new Array(zLen).fill(0);
    const w15Limit = Math.min(15, historyData.length);
    for (let i = 0; i < w15Limit; i++) {
      const idx = zodiacIndex[DataQuery.getSpecial(historyData[i])?.zod];
      if (idx !== undefined) window15FreqArr[idx]++;
    }

    let ySum = 0, wSum = 0;
    for (let i = 0; i < zLen; i++) { ySum += yearFreqArr[i]; wSum += window15FreqArr[i]; }
    const yearMean = ySum / zLen;
    const winMean = wSum / zLen;

    let ySqSum = 0;
    for (let i = 0; i < zLen; i++) ySqSum += (yearFreqArr[i] - yearMean) * (yearFreqArr[i] - yearMean);
    const yearStd = Math.sqrt(ySqSum / zLen);

    const tier1 = [], tier2 = [], tier3 = [];
    const yearFreq = {}, window15Freq = {};

    for (let i = 0; i < zLen; i++) {
      const z = zodiacAll[i];
      const yScore = yearFreqArr[i];
      const wScore = window15FreqArr[i];
      yearFreq[z] = yScore;
      window15Freq[z] = wScore;

      if (yScore >= yearMean + yearStd && wScore >= winMean) {
        tier1.push(z);
      } else if (yScore >= yearMean - yearStd * 0.5 || wScore >= winMean * 0.8) {
        tier2.push(z);
      } else {
        tier3.push(z);
      }
    }

    return { tier1, tier2, tier3, yearFreq, window15Freq };
  },

  _identifyHeatExhaustion: (historyData, yearFreq, zodiacIndex) => {
    const zodiacAll = CONFIG.ANALYSIS.ZODIAC_ALL;
    const zLen = zodiacAll.length;
    const freq15Arr = new Array(zLen).fill(0);
    const limit = Math.min(15, historyData.length);

    for (let i = 0; i < limit; i++) {
      const idx = zodiacIndex[DataQuery.getSpecial(historyData[i])?.zod];
      if (idx !== undefined) freq15Arr[idx]++;
    }

    const exhaustionList = [];
    for (let i = 0; i < zLen; i++) {
      const z = zodiacAll[i];
      const f15 = freq15Arr[i];
      if (f15 >= 3 && f15 > (yearFreq[z] || 0) * 1.5) {
        exhaustionList.push(z);
      }
    }

    return exhaustionList;
  },

  _detectHotZodiacFireout: (historyData, tier1Pool, zodiacIndex) => {
    if (tier1Pool.length === 0) return false;

    const w3Limit = Math.min(3, historyData.length);
    for (let i = 0; i < w3Limit; i++) {
      const zod = DataQuery.getSpecial(historyData[i])?.zod;
      if (zod && tier1Pool.includes(zod)) return false;
    }
    return true;
  },

  _applyHotStreakDecay: (zodiac, scoresMap, freq5Map, zodiacAll) => {
    const freq5 = freq5Map[zodiac] || 0;
    if (freq5 >= 4) {
      scoresMap[zodiac] = Math.max(0, (scoresMap[zodiac] || 0) - 5);
      return true;
    }
    return false;
  },

  _validatePseudoHot: (freq5Map, freq10Map, freq15Map, zodiac) => {
    const f5 = freq5Map[zodiac] || 0;
    const f10 = freq10Map[zodiac] || 0;
    const f15 = freq15Map[zodiac] || 0;
    return f5 >= 1 && f10 >= 6 && f15 >= f10 - 2;
  },

  _applyColdCriticalReversal: (zodiac, scoresMap, miss10Map, mu, sigma, dimHot) => {
    const miss = miss10Map[zodiac] || 0;
    if (miss < mu + 1.4 * sigma) return;

    let bonus = 0;
    const elementKeys = Object.keys(CONFIG.ELEMENT_MAP);
    const colorKeys = Object.keys(CONFIG.COLOR_MAP);

    for (let i = 0; i < elementKeys.length; i++) {
      const d = dimHot.fiveElements[elementKeys[i]];
      if (d && d.level === '高') bonus++;
      if (bonus >= 2) break;
    }
    for (let i = 0; i < colorKeys.length && bonus < 2; i++) {
      const d = dimHot.color[colorKeys[i]];
      if (d && d.level === '高') bonus++;
    }

    if (bonus >= 2) {
      scoresMap[zodiac] = (scoresMap[zodiac] || 0) + Math.min(4, Math.max(2, bonus));
    }
  },

  _calcThreeWindowWeightedScore: (freq5Map, freq10Map, freq15Map, zodiac) => {
    const freq5 = freq5Map[zodiac] || 0;
    const freq10 = freq10Map[zodiac] || 0;
    const freq15 = freq15Map[zodiac] || 0;

    const score5 = (freq5 / 5) * 100;
    const score10 = (freq10 / 10) * 100;
    const score15 = (freq15 / 15) * 100;

    return Math.round((score10 * 0.5 + score5 * 0.3 + score15 * 0.2) * 10) / 10;
  },

  _checkConsecutiveExhaustion: (historyData, zodiacIndex, zodIdx, windowLen) => {
    const streak = BusinessGemini._calcConsecutiveInWindow(historyData, zodiacIndex, windowLen, zodIdx);
    if (streak.totalCount >= 3 || streak.maxConsecutive >= 2) return 'block';
    if (streak.totalCount >= 2) return 'remove_from_main';
    return 'safe';
  },

  _applyPrecisionFilterTop3: (mainZodiac, poolData, historyData, zodiacIndex, freq5Map, freq10Map, freq15Map, dimHot10) => {
    const filtered = [];
    const lastZodiac = (BusinessGemini._getSpecialAt(historyData, 0) || {}).zod;

    for (let i = 0; i < mainZodiac.length && filtered.length < 3; i++) {
      const zodiac = mainZodiac[i];
      if (zodiac === lastZodiac) continue;

      const zodIdx = zodiacIndex[zodiac];
      const streak = BusinessGemini._calcConsecutiveInWindow(historyData, zodiacIndex, 5, zodIdx);
      if (streak.totalCount >= 3 || streak.maxConsecutive >= 2) continue;

      const f5 = freq5Map[zodiac] || 0;
      const f10 = freq10Map[zodiac] || 0;
      const f15 = freq15Map[zodiac] || 0;

      if ((f5 >= 1 && f10 >= 2 && f15 >= 3) || !poolData.hotPool.includes(zodiac)) {
        filtered.push(zodiac);
      } else if (!BusinessGemini._validatePseudoHot(freq5Map, freq10Map, freq15Map, zodiac) && f5 < 1) {
        continue;
      } else {
        filtered.push(zodiac);
      }
    }

    return filtered;
  },

  _classifyZodiacPoolsOptimized: (miss10Map, miss5Map, freq5Map) => {
    const zodiacAll = CONFIG.ANALYSIS.ZODIAC_ALL;
    const zLen = zodiacAll.length;

    const sorted = [];
    for (let i = 0; i < zLen; i++) sorted.push({ zodiac: zodiacAll[i], miss: miss10Map[zodiacAll[i]] });
    sorted.sort((a, b) => a.miss - b.miss);

    const top5Threshold = sorted[Math.min(4, zLen - 1)].miss;
    const hotPool = [];
    const hotScoreMap = {};

    for (let i = 0; i < zLen; i++) {
      const s = sorted[i];
      if (s.miss <= top5Threshold) {
        hotPool.push(s.zodiac);
        hotScoreMap[s.zodiac] = 35;
      } else break;
    }

    let missSum = 0;
    for (let i = 0; i < zLen; i++) missSum += sorted[i].miss;
    const mu = missSum / zLen;

    let sqSum = 0;
    for (let i = 0; i < zLen; i++) sqSum += (sorted[i].miss - mu) * (sorted[i].miss - mu);
    const sigma = Math.sqrt(sqSum / zLen);

    const lowerBound = mu - 0.5 * sigma;
    const upperBound = mu + 0.5 * sigma;

    const warmPool = [], coldPool = [];
    const warmScoreMap = {}, coldScoreMap = {};

    for (let i = 0; i < zLen; i++) {
      const z = sorted[i].zodiac;
      const miss = sorted[i].miss;
      if (hotPool.includes(z)) continue;

      if (miss >= lowerBound && miss <= upperBound) {
        warmPool.push(z);
        let score = 30 - 10 * (miss - lowerBound) / sigma;
        score = Math.max(20, Math.min(30, score));
        warmScoreMap[z] = Math.round(score * 10) / 10;
      } else {
        coldPool.push(z);
        let baseScore = 10 + 8 * (1 - (mu - miss) / mu);
        baseScore = Math.max(10, Math.min(18, baseScore));
        coldScoreMap[z] = Math.round(baseScore * 10) / 10;
      }
    }

    let cold5OpenCount = 0;
    for (let i = 0; i < zLen; i++) {
      const z = zodiacAll[i];
      if (coldPool.includes(z) && (miss5Map[z] || 0) <= 4) cold5OpenCount++;
    }
    if (cold5OpenCount >= 3) {
      for (const z of coldPool) {
        coldScoreMap[z] = Math.min(20, coldScoreMap[z] + 8);
        coldScoreMap[z] = Math.round(coldScoreMap[z] * 10) / 10;
      }
    }

    const allScoreMap = { ...hotScoreMap, ...warmScoreMap, ...coldScoreMap };
    const maxHot = hotPool.length > 0 ? 35 : 0;
    const warmMin = warmPool.length > 0 ? Math.min(...Object.values(warmScoreMap)) : 20;

    for (const z of warmPool) {
      if (warmScoreMap[z] >= maxHot) warmScoreMap[z] = maxHot - 0.1;
    }
    for (const z of coldPool) {
      if (coldScoreMap[z] >= maxHot) coldScoreMap[z] = maxHot - 0.1;
      if (coldScoreMap[z] >= warmMin) coldScoreMap[z] = warmMin - 0.1;
    }

    for (let i = 0; i < zLen; i++) {
      const z = zodiacAll[i];
      allScoreMap[z] = hotPool.includes(z) ? hotScoreMap[z] :
                       warmPool.includes(z) ? warmScoreMap[z] : coldScoreMap[z];
    }

    for (let i = 0; i < zLen; i++) {
      BusinessGemini._applyHotStreakDecay(zodiacAll[i], allScoreMap, freq5Map, zodiacAll);
    }

    return { hotPool, warmPool, coldPool, hotScoreMap, warmScoreMap, coldScoreMap, allScoreMap, mu, sigma };
  },

  _classifyDimensionHotnessOptimized: (freqArr, keys) => {
    const entries = [];
    const len = freqArr.length;
    for (let i = 0; i < len; i++) entries.push({ key: keys[i], freq: freqArr[i] });
    entries.sort((a, b) => b.freq - a.freq);

    const third = Math.ceil(len / 3);
    const result = {};
    for (let i = 0; i < len; i++) {
      result[entries[i].key] = {
        freq: entries[i].freq,
        level: i < third ? '高' : i < third * 2 ? '中' : '冷',
        rank: i + 1
      };
    }
    return result;
  },

  _judgeMarketMode: (poolData, miss5Map, miss10Map, miss15Map, fireoutDetected, zodiacIndex) => {
    if (fireoutDetected) return { mode: '跳开乱序', locked: false, lockCount: 0 };

    const { hotPool, warmPool, coldPool } = poolData;
    const zodiacAll = CONFIG.ANALYSIS.ZODIAC_ALL;
    const zLen = zodiacAll.length;

    const _calcPoolRatio = (pool, missMap, totalPeriods) => {
      let openCount = 0;
      for (let i = 0; i < zLen; i++) {
        const z = zodiacAll[i];
        if (pool.includes(z)) openCount += (totalPeriods - (missMap[z] || 0));
      }
      return totalPeriods > 0 ? openCount / totalPeriods : 0;
    };

    const _calcPoolOpenCount = (pool, missMap, totalPeriods) => {
      let count = 0;
      for (let i = 0; i < zLen; i++) {
        const z = zodiacAll[i];
        if (pool.includes(z) && (missMap[z] || 0) < totalPeriods) count++;
      }
      return count;
    };

    const hot10Ratio = _calcPoolRatio(hotPool, miss10Map, 10);
    const hot5Count = _calcPoolOpenCount(hotPool, miss5Map, 5);
    const cold5Count = _calcPoolOpenCount(coldPool, miss5Map, 5);
    const cold10Ratio = _calcPoolRatio(coldPool, miss10Map, 10);

    let mode5 = '';
    if (hot10Ratio >= 0.4 || hotPool.length > warmPool.length + coldPool.length) {
      mode5 = hot5Count >= 3 ? '强追热' : '';
    }
    if (cold5Count >= 3 && hot5Count <= 1) mode5 = '冷号接力';
    if (!mode5) {
      const warm5Count = _calcPoolOpenCount(warmPool, miss5Map, 5);
      mode5 = (warm5Count >= 3 && hot5Count <= 2) ? '正常轮动' : '跳开乱序';
    }

    let mode10 = '';
    if (hot10Ratio >= 0.4) mode10 = '强追热';
    else if (cold10Ratio > 0.3) mode10 = '冷号接力';
    else mode10 = '正常轮动';

    const hot15Ratio = _calcPoolRatio(hotPool, miss15Map, 15);
    const cold15Ratio = _calcPoolRatio(coldPool, miss15Map, 15);
    let mode15 = hot15Ratio >= 0.35 ? '强追热' : cold15Ratio > 0.3 ? '冷号接力' : '正常轮动';

    const lastMode = BusinessGemini._state && BusinessGemini._state.lastMarketMode;
    const lastLockCount = (BusinessGemini._state && BusinessGemini._state.lastModeLockCount) || 0;
    const isLocked = lastMode && lastLockCount < 5;

    if (mode5 === mode10) {
      if (isLocked && lastMode !== mode5) return { mode: lastMode, locked: true, lockCount: lastLockCount + 1 };
      return { mode: mode5, locked: false, lockCount: 0 };
    }

    if (mode15 === mode5 || mode15 === mode10) {
      if (isLocked && lastMode !== mode15) return { mode: lastMode, locked: true, lockCount: lastLockCount + 1 };
      return { mode: mode15, locked: false, lockCount: 0 };
    }

    if (isLocked) return { mode: lastMode, locked: true, lockCount: lastLockCount + 1 };
    return { mode: '正常轮动', locked: false, lockCount: 0 };
  },

  _executeStrategy: (marketMode, poolData, dimHot5, dimHot10, dimHot15, missMaps) => {
    const { hotPool, warmPool, coldPool, allScoreMap, hotScoreMap, warmScoreMap, coldScoreMap, mu, sigma } = poolData;

    const _topByScore = (scores, pool, n) => pool.slice().sort((a, b) => (scores[b] || 0) - (scores[a] || 0)).slice(0, n);
    const _topByMiss = (pool, missMap, n) => pool.slice().sort((a, b) => (missMap[b] || 0) - (missMap[a] || 0)).slice(0, n);
    const _hotTags = (dim, n) => Object.entries(dim).filter(e => e[1].level === '高' || e[1].level === '中').sort((a, b) => b[1].freq - a[1].freq).slice(0, n).map(e => `${e[0]}(${e[1].level})`);

    const miss15Map = missMaps && missMaps.miss15Map ? missMaps.miss15Map
      : BusinessGemini._missArrToMap(BusinessGemini._calcZodiacMiss(BusinessGemini._getWindowData(BusinessGemini._historyData, 15), BusinessGemini._cache.zodiacIndex), CONFIG.ANALYSIS.ZODIAC_ALL);
    const missFullMap = missMaps && missMaps.missFullMap ? missMaps.missFullMap
      : BusinessGemini._missArrToMap(BusinessGemini._calcZodiacMiss(BusinessGemini._historyData, BusinessGemini._cache.zodiacIndex), CONFIG.ANALYSIS.ZODIAC_ALL);

    let main = [], backup = [], defense = [], tags = [], desc = '';

    switch (marketMode) {
      case '正常轮动':
        main = _topByScore(warmScoreMap, warmPool, 4);
        backup = _topByScore(hotScoreMap, hotPool, 2);
        defense = _topByMiss(coldPool, missFullMap, 1);
        tags = _hotTags(dimHot10, 3);
        desc = '主推温号池，辅助少量热号，冷号兜底';
        break;

      case '强追热':
        main = _topByScore(hotScoreMap, hotPool, 5);
        backup = _topByScore(warmScoreMap, warmPool, 2);
        defense = coldPool.slice(0, 1);
        tags = _hotTags(dimHot5, 4);
        desc = '主推热号梯队，辅助温号次热，放弃冷号';
        break;

      case '冷号接力':
        main = _topByMiss(coldPool, miss15Map, 3);
        backup = warmPool.filter(z => (miss15Map[z] || 0) > mu).slice(0, 2);
        defense = coldPool.filter(z => (miss15Map[z] || 0) > mu + 2 * sigma).slice(0, 2);
        if (defense.length === 0) defense = coldPool.slice(0, 2);
        tags = _hotTags(dimHot15, 3);
        desc = '主推极值冷号TOP3，温冷交界辅助，极冷号防守';
        break;

      case '跳开乱序':
        const sortedAll = CONFIG.ANALYSIS.ZODIAC_ALL.slice().sort((a, b) => (allScoreMap[b] || 0) - (allScoreMap[a] || 0));
        main = sortedAll.slice(0, 4);
        backup = sortedAll.slice(4, 7);
        defense = sortedAll.slice(7, 9);

        const allDimHot = {};
        ['fiveElements', 'color', 'tail', 'head'].forEach(dim => {
          const dimData = dim === 'fiveElements' ? dimHot10.fiveElements : dim === 'color' ? dimHot10.color : dim === 'tail' ? dimHot10.tail : dimHot10.head;
          Object.entries(dimData).forEach(([k, v]) => {
            if (v.level === '高' || v.level === '中') allDimHot[`${dim}:${k}`] = v;
          });
        });
        tags = Object.entries(allDimHot).sort((a, b) => b[1].freq - a[1].freq).slice(0, 4).map(([k, v]) => `${k}(${v.level})`);
        desc = '弱化生肖冷热池，依靠五行/波色/尾数/区间热度择优';
        break;

      case '冷热交替均衡':
        const hot3 = _topByScore(hotScoreMap, hotPool, 3);
        hot3.forEach(z => { allScoreMap[z] = 30; });
        main = warmPool.slice().sort((a, b) => (warmScoreMap[b] || 0) - (warmScoreMap[a] || 0));
        backup = _topByMiss(coldPool, missFullMap, 2);
        defense = hot3.slice(0, 1);
        tags = _hotTags(dimHot10, 3);
        desc = '热1+温3+冷2配比，中等热度维度全覆盖';
        break;

      default:
        main = _topByScore(warmScoreMap, warmPool, 4);
        backup = _topByScore(hotScoreMap, hotPool, 2);
        defense = coldPool.slice(0, 2);
        tags = _hotTags(dimHot10, 3);
        desc = '默认正常轮动策略';
        break;
    }

    return { mainZodiac: main, backupZodiac: backup, defenseZodiac: defense, dimensionTags: tags, strategyDesc: desc };
  },

  _applyRiskControl: (strategy, poolData, miss10Map, marketMode) => {
    const { mu, sigma } = poolData;
    const zodiacAll = CONFIG.ANALYSIS.ZODIAC_ALL;
    for (let i = 0; i < zodiacAll.length; i++) {
      const z = zodiacAll[i];
      if ((miss10Map[z] || 0) > mu + 2 * sigma && !strategy.defenseZodiac.includes(z)) {
        strategy.defenseZodiac.push(z);
      }
    }

    Object.keys(poolData.hotScoreMap).forEach(z => {
      if (poolData.warmScoreMap[z] && poolData.warmScoreMap[z] >= poolData.hotScoreMap[z]) poolData.warmScoreMap[z] = poolData.hotScoreMap[z] - 0.1;
      if (poolData.coldScoreMap[z] && poolData.coldScoreMap[z] >= poolData.hotScoreMap[z]) poolData.coldScoreMap[z] = poolData.hotScoreMap[z] - 0.1;
    });

    return strategy;
  },

  _extractFreqMapsFromWindows: (historyData, zodiacIndex) => {
    const zodiacAll = CONFIG.ANALYSIS.ZODIAC_ALL;
    const zLen = zodiacAll.length;

    const w5Len = Math.min(5, historyData.length);
    const w10Len = Math.min(10, historyData.length);
    const w15Len = Math.min(15, historyData.length);

    const f5Arr = new Array(zLen).fill(0);
    const f10Arr = new Array(zLen).fill(0);
    const f15Arr = new Array(zLen).fill(0);

    for (let i = 0; i < w15Len; i++) {
      const idx = zodiacIndex[DataQuery.getSpecial(historyData[i])?.zod];
      if (idx === undefined) continue;
      f15Arr[idx]++;
      if (i < w10Len) f10Arr[idx]++;
      if (i < w5Len) f5Arr[idx]++;
    }

    const freq5Map = {}, freq10Map = {}, freq15Map = {};
    for (let i = 0; i < zLen; i++) {
      freq5Map[zodiacAll[i]] = f5Arr[i];
      freq10Map[zodiacAll[i]] = f10Arr[i];
      freq15Map[zodiacAll[i]] = f15Arr[i];
    }

    return { freq5Map, freq10Map, freq15Map };
  },

  _calcAllMissInOnePass: (historyData, zodiacIndex) => {
    const zodiacAll = CONFIG.ANALYSIS.ZODIAC_ALL;
    const zLen = zodiacAll.length;
    const total = historyData.length;

    const miss5Arr = new Array(zLen).fill(-1);
    const miss10Arr = new Array(zLen).fill(-1);
    const miss15Arr = new Array(zLen).fill(-1);
    const missFullArr = new Array(zLen).fill(-1);

    const w5 = Math.min(5, total), w10 = Math.min(10, total), w15 = Math.min(15, total);

    for (let i = 0; i < w15; i++) {
      const idx = zodiacIndex[DataQuery.getSpecial(historyData[i])?.zod];
      if (idx === undefined) continue;
      if (miss15Arr[idx] === -1) miss15Arr[idx] = i;
      if (i < w10 && miss10Arr[idx] === -1) miss10Arr[idx] = i;
      if (i < w5 && miss5Arr[idx] === -1) miss5Arr[idx] = i;
    }

    for (let i = 0; i < total; i++) {
      const idx = zodiacIndex[DataQuery.getSpecial(historyData[i])?.zod];
      if (idx !== undefined && missFullArr[idx] === -1) missFullArr[idx] = i;
    }

    for (let i = 0; i < zLen; i++) {
      if (miss5Arr[i] === -1) miss5Arr[i] = w5;
      if (miss10Arr[i] === -1) miss10Arr[i] = w10;
      if (miss15Arr[i] === -1) miss15Arr[i] = w15;
      if (missFullArr[i] === -1) missFullArr[i] = total;
    }

    return { miss5Arr, miss10Arr, miss15Arr, missFullArr };
  },

  calc: () => {
    const historyData = BusinessGemini._getValidHistory();
    if (!historyData || historyData.length < 5) {
      return { error: '历史数据不足，至少需要5期数据', mode: '未知', windows: { window5: [], window10: [], window15: [] } };
    }

    BusinessGemini._historyData = historyData;
    const zodiacAll = CONFIG.ANALYSIS.ZODIAC_ALL;
    const zLen = zodiacAll.length;
    const elementKeys = Object.keys(CONFIG.ELEMENT_MAP);
    const colorKeys = Object.keys(CONFIG.COLOR_MAP);

    if (!BusinessGemini._cache) {
      BusinessGemini._cache = {
        zodiacIndex: BusinessGemini._buildZodiacIndex(),
        elementIndex: BusinessGemini._buildElementIndex(),
        colorIndex: BusinessGemini._buildColorIndex()
      };
    }
    const cache = BusinessGemini._cache;

    const { miss5Arr, miss10Arr, miss15Arr, missFullArr } = BusinessGemini._calcAllMissInOnePass(historyData, cache.zodiacIndex);
    const miss5Map = BusinessGemini._missArrToMap(miss5Arr, zodiacAll);
    const miss10Map = BusinessGemini._missArrToMap(miss10Arr, zodiacAll);
    const miss15Map = BusinessGemini._missArrToMap(miss15Arr, zodiacAll);
    const missFullMap = BusinessGemini._missArrToMap(missFullArr, zodiacAll);

    const { freq5Map, freq10Map, freq15Map } = BusinessGemini._extractFreqMapsFromWindows(historyData, cache.zodiacIndex);

    const yearData = BusinessGemini._getCurrentYearData(historyData);
    const annualWeak = BusinessGemini._identifyAnnualWeakZodiac(yearData, cache.zodiacIndex);
    const tierPools = BusinessGemini._classifyTierPools(yearData, historyData, cache.zodiacIndex);
    const heatExhaustionList = BusinessGemini._identifyHeatExhaustion(historyData, tierPools.yearFreq, cache.zodiacIndex);
    const fireoutDetected = BusinessGemini._detectHotZodiacFireout(historyData, tierPools.tier1, cache.zodiacIndex);

    const window5 = BusinessGemini._getWindowData(historyData, 5);
    const window10 = BusinessGemini._getWindowData(historyData, 10);
    const window15 = BusinessGemini._getWindowData(historyData, 15);

    const attr5 = BusinessGemini._extractAllAttributes(window5, cache.zodiacIndex, cache.elementIndex, cache.colorIndex);
    const attr10 = BusinessGemini._extractAllAttributes(window10, cache.zodiacIndex, cache.elementIndex, cache.colorIndex);
    const attr15 = BusinessGemini._extractAllAttributes(window15, cache.zodiacIndex, cache.elementIndex, cache.colorIndex);

    const poolData = BusinessGemini._classifyZodiacPoolsOptimized(miss10Map, miss5Map, freq5Map);

    for (let i = 0; i < zLen; i++) {
      const z = zodiacAll[i];
      if (heatExhaustionList.includes(z)) poolData.allScoreMap[z] = Math.max(0, (poolData.allScoreMap[z] || 0) - 8);
      const recent3Zodiacs = BusinessGemini._getRecentZodiacsByIdx(historyData, cache.zodiacIndex, 3);
      if (recent3Zodiacs.includes(cache.zodiacIndex[z])) poolData.allScoreMap[z] = Math.max(0, (poolData.allScoreMap[z] || 0) - 3);
    }

    const dimHot5 = {
      zodiac: BusinessGemini._classifyDimensionHotnessOptimized(attr5.zodiacFreq, zodiacAll),
      fiveElements: BusinessGemini._classifyDimensionHotnessOptimized(attr5.fiveElementsFreq, elementKeys),
      color: BusinessGemini._classifyDimensionHotnessOptimized(attr5.colorFreq, colorKeys),
      tail: BusinessGemini._classifyDimensionHotnessOptimized(attr5.tailFreq, ['0','1','2','3','4','5','6','7','8','9']),
      head: BusinessGemini._classifyDimensionHotnessOptimized(attr5.headFreq, ['0','1','2','3','4'])
    };
    const dimHot10 = {
      zodiac: BusinessGemini._classifyDimensionHotnessOptimized(attr10.zodiacFreq, zodiacAll),
      fiveElements: BusinessGemini._classifyDimensionHotnessOptimized(attr10.fiveElementsFreq, elementKeys),
      color: BusinessGemini._classifyDimensionHotnessOptimized(attr10.colorFreq, colorKeys),
      tail: BusinessGemini._classifyDimensionHotnessOptimized(attr10.tailFreq, ['0','1','2','3','4','5','6','7','8','9']),
      head: BusinessGemini._classifyDimensionHotnessOptimized(attr10.headFreq, ['0','1','2','3','4'])
    };
    const dimHot15 = {
      zodiac: BusinessGemini._classifyDimensionHotnessOptimized(attr15.zodiacFreq, zodiacAll),
      fiveElements: BusinessGemini._classifyDimensionHotnessOptimized(attr15.fiveElementsFreq, elementKeys),
      color: BusinessGemini._classifyDimensionHotnessOptimized(attr15.colorFreq, colorKeys),
      tail: BusinessGemini._classifyDimensionHotnessOptimized(attr15.tailFreq, ['0','1','2','3','4','5','6','7','8','9']),
      head: BusinessGemini._classifyDimensionHotnessOptimized(attr15.headFreq, ['0','1','2','3','4'])
    };

    const marketJudge = BusinessGemini._judgeMarketMode(poolData, miss5Map, miss10Map, miss15Map, fireoutDetected, cache.zodiacIndex);
    const marketMode = marketJudge.mode;

    const strategy = BusinessGemini._executeStrategy(marketMode, poolData, dimHot5, dimHot10, dimHot15, { miss15Map, missFullMap });
    const controlledStrategy = BusinessGemini._applyRiskControl(strategy, poolData, miss10Map, marketMode);

    for (let i = 0; i < zLen; i++) {
      BusinessGemini._applyColdCriticalReversal(zodiacAll[i], poolData.allScoreMap, miss10Map, poolData.mu, poolData.sigma, dimHot10);
    }

    const weightedScores = {};
    for (let i = 0; i < zLen; i++) {
      weightedScores[zodiacAll[i]] = BusinessGemini._calcThreeWindowWeightedScore(freq5Map, freq10Map, freq15Map, zodiacAll[i]);
    }

    let refinedMain = BusinessGemini._applyPrecisionFilterTop3(controlledStrategy.mainZodiac, poolData, historyData, cache.zodiacIndex, freq5Map, freq10Map, freq15Map, dimHot10);

    let tier1InMain = 0;
    for (let i = 0; i < refinedMain.length; i++) { if (tierPools.tier1.includes(refinedMain[i])) tier1InMain++; }
    if (tier1InMain > 2) {
      const filtered = refinedMain.filter((z, i) => !tierPools.tier1.includes(z) || i < 2);
      refinedMain = filtered.slice(0, 3);
      if (refinedMain.length < 3) {
        for (let i = 0; i < tierPools.tier2.length && refinedMain.length < 3; i++) {
          if (!refinedMain.includes(tierPools.tier2[i])) refinedMain.push(tierPools.tier2[i]);
        }
      }
    }

    const avoidList = [];
    for (let i = 0; i < zLen; i++) {
      const z = zodiacAll[i];
      const zodIdx = cache.zodiacIndex[z];
      if (BusinessGemini._checkConsecutiveExhaustion(historyData, cache.zodiacIndex, zodIdx, 5) === 'block') {
        avoidList.push(z);
      }
    }
    for (let i = 0; i < heatExhaustionList.length; i++) {
      if (!avoidList.includes(heatExhaustionList[i])) avoidList.push(heatExhaustionList[i]);
    }

    const lastZodiac = DataQuery.getSpecial(historyData[0])?.zod || null;
    const recent3Zodiacs = [];
    const recent3ByIdx = BusinessGemini._getRecentZodiacsByIdx(historyData, cache.zodiacIndex, 3);
    for (let i = 0; i < recent3ByIdx.length; i++) {
      if (recent3ByIdx[i] >= 0 && recent3ByIdx[i] < zLen) recent3Zodiacs.push(zodiacAll[recent3ByIdx[i]]);
    }

    const finalMain = refinedMain.filter(z => !avoidList.includes(z) && z !== lastZodiac && !annualWeak.weakPool.includes(z));
    const finalBackup = controlledStrategy.backupZodiac.filter(z => !finalMain.includes(z) && !avoidList.includes(z) && z !== lastZodiac && !annualWeak.weakPool.includes(z));
    let finalDefense = controlledStrategy.defenseZodiac.filter(z => !finalMain.includes(z) && !finalBackup.includes(z) && z !== lastZodiac);
    for (let i = 0; i < annualWeak.weakPool.length; i++) {
      if (!finalDefense.includes(annualWeak.weakPool[i])) finalDefense.push(annualWeak.weakPool[i]);
    }

    const mu = Math.round(poolData.mu * 10) / 10;
    const sigma = Math.round(poolData.sigma * 10) / 10;

    const zodiacDetailsCompat = {};
    for (let i = 0; i < zLen; i++) {
      const z = zodiacAll[i];
      const inHot = poolData.hotPool.includes(z);
      const inWarm = poolData.warmPool.includes(z);
      zodiacDetailsCompat[z] = {
        pool: inHot ? 'hot' : inWarm ? 'warm' : 'cold',
        miss: miss10Map[z] || 0,
        count: freq10Map[z] || 0,
        _tier: tierPools.tier1.includes(z) ? 1 : tierPools.tier2.includes(z) ? 2 : 3,
        _overdueByOverheat: false,
        _pseudoHot: false,
        _coldCritical: false,
        _blockedByRepeat: z === lastZodiac,
        _annualWeak: annualWeak.weakPool.includes(z),
        _overheatSilence: heatExhaustionList.includes(z),
        _recent3Penalty: recent3Zodiacs.includes(z),
        _warnedByOverheat: false,
        _blockedByOverheat: false
      };
    }

    const result = {
      nextPeriod: BusinessGemini._getNextPeriod(),
      marketMode,
      modeLocked: marketJudge.locked,
      lockCount: marketJudge.lockCount,
      windows: { window5: window5.length, window10: window10.length, window15: window15.length, short: window5, mid: window10, long: window15 },
      pools: {
        hotPool: poolData.hotPool, warmPool: poolData.warmPool, coldPool: poolData.coldPool,
        hotScores: poolData.hotScoreMap, warmScores: poolData.warmScoreMap, coldScores: poolData.coldScoreMap,
        allScores: poolData.allScoreMap, weightedScores, mu, sigma
      },
      annualAnalysis: {
        weakPool: annualWeak.weakPool,
        tier1: tierPools.tier1, tier2: tierPools.tier2, tier3: tierPools.tier3,
        yearFreq: tierPools.yearFreq, heatExhaustionList, fireoutDetected
      },
      zodiacMiss: miss10Map,
      dimensionHot: { window5: dimHot5, window10: dimHot10, window15: dimHot15 },
      selected3: finalMain.slice(0, 3),
      zodiacScores: poolData.allScoreMap,
      sortedZodiacs: zodiacAll.map(z => [z, poolData.allScoreMap[z] || 0]).sort((a, b) => b[1] - a[1]),
      zodiacDetails: zodiacDetailsCompat,
      strategy: {
        ...controlledStrategy,
        mainZodiac: finalMain, backupZodiac: finalBackup, defenseZodiac: finalDefense,
        recommend: finalMain, backup: finalBackup, defense: finalDefense,
        avoidList, lastPeriodZodiac: lastZodiac, recent3Zodiacs
      }
    };

    if (BusinessGemini._state) {
      BusinessGemini._state.lastMarketMode = marketMode;
      BusinessGemini._state.lastModeLockCount = marketJudge.lockCount;
    }

    BusinessBacktest.track(result);
    BusinessBacktest.checkAll();

    return result;
  },

  _getNextPeriod: () => {
    const historyData = BusinessGemini._getValidHistory();
    if (!historyData || historyData.length === 0) return null;
    const latestExpect = historyData[0]?.expect || null;
    if (!latestExpect) return null;
    const latestPeriodNum = parseInt(latestExpect.trim());
    if (isNaN(latestPeriodNum)) return null;
    return String(latestPeriodNum + 1);
  },

  getModeText: (mode) => {
    const map = {
      'normal': '正常轮动',
      'strong_hot': '强追热',
      'cold_relay': '冷号接力',
      'chaos': '跳开乱序',
      'alternating': '冷热交替',
      '正常轮动': '正常轮动',
      '强追热': '强追热',
      '冷号接力': '冷号接力',
      '跳开乱序': '跳开乱序',
      '冷热交替均衡': '冷热交替均衡',
      '冷热交替': '冷热交替'
    };
    return map[mode] || '正常轮动';
  },

  getPoolText: (pool) => {
    const map = { 'hot': '热号', 'warm': '温号', 'cold': '冷号', '热号': '热号', '温号': '温号', '冷号': '冷号' };
    return map[pool] || pool;
  },

  refresh: () => {
    BusinessGemini._state = { lastMarketMode: null, lastModeLockCount: 0 };
    BusinessGemini._cache = null;
    return BusinessGemini.calc();
  }
};
