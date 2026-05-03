/**
 * 生肖预测三窗口算法 v3.3
 * @description 基于5/10/15期三窗口的生肖分池、行情判定、策略推荐算法
 * 核心特性：固定三窗口、热温冷分池、五档行情模式、多维度热度、风控保护
 * V3.2优化：热号衰减/伪热过滤/冷号反转/三窗加权/精选3肖/连开规避/上期重码规避
 * V3.3优化：年度弱势肖/梯队互斥/透支静默/熄火预判/近3期降权
 */
const BusinessZodiacPredict = {
  _modeCooldown: 0,
  _currentMode: 'normal',
  _modeLockCount: 0,

  calc: (historyData) => {
    const data = historyData || StateManager._state.analysis.historyData;
    if(!data || data.length < 5) return null;

    const windows = BusinessZodiacPredict._extractWindows(data);
    const freqStats = BusinessZodiacPredict._calcFreqStats(windows);
    const pool = BusinessZodiacPredict._assignPools(freqStats.mid, windows.short);

    // V3.2：先跑八条优化规则
    BusinessZodiacPredict._applyOptimizationRules(pool, freqStats, windows, data);

    // 行情判定：三窗口交叉
    const rawMode = BusinessZodiacPredict._detectMarketMode(windows, freqStats, pool);

    // 六维热度
    const dimHeat = BusinessZodiacPredict._calcDimensionHeat(windows);

    // V3.3：再跑五条智能规则
    const annualWeak = BusinessZodiacPredict._calcAnnualWeakZodiacs(data);
    const tierPools = BusinessZodiacPredict._assignTierPools(data, freqStats.long);
    const recent3Zods = BusinessZodiacPredict._getRecent3Zodiacs(data);
    const hotShutdown = BusinessZodiacPredict._detectHotShutdown(tierPools.tier1, windows, pool);

    BusinessZodiacPredict._applyV33Rules(pool, windows, freqStats, data, annualWeak, tierPools, recent3Zods, hotShutdown);

    // V3.3规则4：热肖集体熄火强制预判跳开
    const mode = hotShutdown ? 'chaos' : rawMode;

    const strategy = BusinessZodiacPredict._buildStrategy(mode, pool, dimHeat, freqStats);

    if(mode === 'chaos') {
      const seqAnalysis = BusinessZodiacPredict._analyzePoolSequence(data, pool);
      BusinessZodiacPredict._applyChaosSequenceRule(pool, seqAnalysis);
      const newStrategy = BusinessZodiacPredict._buildStrategy(mode, pool, dimHeat, freqStats);
      Object.assign(strategy, newStrategy);
    }

    const risk = BusinessZodiacPredict._applyRiskControl(pool, mode, freqStats);
    const selected3 = BusinessZodiacPredict._buildSelected3(pool, windows, freqStats);

    return {
      marketMode: mode,
      hotPool: pool.hot,
      warmPool: pool.warm,
      coldPool: pool.cold,
      zodiacScores: pool.scores,
      zodiacDetails: pool.details,
      sortedZodiacs: pool.sorted,
      dimensionHeat: dimHeat,
      strategy: strategy,
      risk: risk,
      selected3: selected3,
      windows: windows,
      freqStats: freqStats
    };
  },

  _extractWindows: (data) => {
    return {
      short: data.slice(0, Math.min(5, data.length)),
      mid: data.slice(0, Math.min(10, data.length)),
      long: data.slice(0, Math.min(15, data.length))
    };
  },

  _calcFreqStats: (windows) => {
    const calcOne = (list) => {
      const zodCount = {};
      CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => zodCount[z] = 0);
      const lastAppear = {};
      CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => lastAppear[z] = -1);

      list.forEach((item, idx) => {
        const s = DataQuery.getSpecial(item);
        if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod)) {
          zodCount[s.zod]++;
          if(lastAppear[s.zod] === -1) lastAppear[s.zod] = idx;
        }
      });

      return { zodCount, lastAppear, total: list.length };
    };

    return {
      short: calcOne(windows.short),
      mid: calcOne(windows.mid),
      long: calcOne(windows.long)
    };
  },

  _calcStatsByDim: (list, dimKey) => {
    const count = {};
    if(dimKey === 'zodiac') {
      CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => count[z] = 0);
    } else if(dimKey === 'element') {
      ['金','木','水','火','土'].forEach(e => count[e] = 0);
    } else if(dimKey === 'color') {
      ['红','蓝','绿'].forEach(c => count[c] = 0);
    } else if(dimKey === 'tail') {
      for(let t = 0; t <= 9; t++) count[t] = 0;
    } else if(dimKey === 'head') {
      for(let h = 0; h <= 4; h++) count[h] = 0;
    } else if(dimKey === 'range') {
      ['1-9','10-19','20-29','30-39','40-49'].forEach(r => count[r] = 0);
    }

    list.forEach(item => {
      const s = DataQuery.getSpecial(item);
      let val;
      if(dimKey === 'zodiac') val = s.zod;
      else if(dimKey === 'element') val = DataQuery.getWuxing(s.te);
      else if(dimKey === 'color') val = s.colorName;
      else if(dimKey === 'tail') val = s.tail;
      else if(dimKey === 'head') val = s.head;
      else if(dimKey === 'range') {
        const te = s.te;
        if(te >= 1 && te <= 9) val = '1-9';
        else if(te >= 10 && te <= 19) val = '10-19';
        else if(te >= 20 && te <= 29) val = '20-29';
        else if(te >= 30 && te <= 39) val = '30-39';
        else if(te >= 40 && te <= 49) val = '40-49';
      }
      if(val !== undefined && count[val] !== undefined) count[val]++;
    });

    return count;
  },

  _assignPools: (midStats, shortWindow) => {
    const zodCount = midStats.zodCount;
    const total = midStats.total;
    const zodList = CONFIG.ANALYSIS.ZODIAC_ALL;
    const misses = zodList.map(z => {
      const m = midStats.lastAppear[z] === -1 ? total : midStats.lastAppear[z];
      return { zodiac: z, miss: m, count: zodCount[z] || 0 };
    });

    const missValues = misses.map(m => m.miss);
    const mu = missValues.reduce((a, b) => a + b, 0) / missValues.length;
    const variance = missValues.reduce((a, b) => a + Math.pow(b - mu, 2), 0) / missValues.length;
    const sigma = Math.sqrt(variance) || 1;

    const sortedByMiss = [...misses].sort((a, b) => a.miss - b.miss);
    const top5Miss = sortedByMiss.slice(0, 5);
    const top5Threshold = top5Miss[4].miss;

    const hotSet = new Set();
    sortedByMiss.forEach(m => {
      if(m.miss <= top5Threshold) hotSet.add(m.zodiac);
    });

    const hot = [];
    const warm = [];
    const cold = [];
    const scores = {};
    const details = {};

    misses.forEach(m => {
      let score = 0;
      let pool = '';

      if(hotSet.has(m.zodiac)) {
        score = 35;
        pool = 'hot';
        hot.push(m.zodiac);
      } else {
        const warmLow = mu - 0.5 * sigma;
        const warmHigh = mu + 0.5 * sigma;

        if(m.miss >= warmLow && m.miss <= warmHigh) {
          const raw = 30 - 10 * (m.miss - warmLow) / sigma;
          score = Math.max(20, Math.min(30, raw));
          if(score > 29.5) score = 30;
          pool = 'warm';
          warm.push(m.zodiac);
        } else {
          const ratio = (m.miss - warmHigh) / (sigma || 1);
          const base = 10 + Math.max(0, ratio * 5);
          score = Math.round(base * 10) / 10;
          score = Math.max(10, Math.min(18, score));
          pool = 'cold';
          cold.push(m.zodiac);
        }
      }

      scores[m.zodiac] = score;
      details[m.zodiac] = { pool, miss: m.miss, count: m.count };
    });

    if(shortWindow && shortWindow.length >= 3) {
      let shortColdCount = 0;
      shortWindow.forEach(item => {
        const s = DataQuery.getSpecial(item);
        if(details[s.zod]?.pool === 'cold') shortColdCount++;
      });

      if(shortColdCount >= 3) {
        CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => {
          if(details[z]?.pool === 'cold') {
            scores[z] = Math.min(20, Math.round((scores[z] + 8) * 10) / 10);
          }
        });
      }
    }

    const sorted = zodList
      .slice()
      .sort((a, b) => scores[b] - scores[a])
      .map(z => [z, Math.round(scores[z])]);

    return { hot, warm, cold, scores, details, sorted };
  },

  _detectMarketMode: (windows, freqStats, pool) => {
    if(BusinessZodiacPredict._modeCooldown > 0) {
      BusinessZodiacPredict._modeCooldown--;
      return BusinessZodiacPredict._currentMode;
    }

    const getPoolType = (z) => pool.details[z]?.pool || 'warm';

    const calcPoolRatio = (list) => {
      const counts = { hot: 0, warm: 0, cold: 0 };
      let total = 0;
      list.forEach(item => {
        const s = DataQuery.getSpecial(item);
        if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod)) {
          counts[getPoolType(s.zod)]++;
          total++;
        }
      });
      if(total === 0) return { hot: 0, warm: 0, cold: 0 };
      return { hot: counts.hot / total, warm: counts.warm / total, cold: counts.cold / total };
    };

    const shortRatio = calcPoolRatio(windows.short);
    const midRatio = calcPoolRatio(windows.mid);
    const longRatio = calcPoolRatio(windows.long);

    const shortHotCount = windows.short.filter(item => {
      const s = DataQuery.getSpecial(item);
      return getPoolType(s.zod) === 'hot';
    }).length;

    const shortColdCount = windows.short.filter(item => {
      const s = DataQuery.getSpecial(item);
      return getPoolType(s.zod) === 'cold';
    }).length;

    const getPoolTypeStr = (list) => {
      const ratio = calcPoolRatio(list);
      if(ratio.hot >= ratio.warm && ratio.hot >= ratio.cold) return 'hot';
      if(ratio.warm >= ratio.hot && ratio.warm >= ratio.cold) return 'warm';
      return 'cold';
    };

    const determineMode = (ratio, list, label) => {
      const hotCount = list.filter(item => {
        const s = DataQuery.getSpecial(item);
        return getPoolType(s.zod) === 'hot';
      }).length;
      const coldCount = list.filter(item => {
        const s = DataQuery.getSpecial(item);
        return getPoolType(s.zod) === 'cold';
      }).length;
      const warmCount = list.filter(item => {
        const s = DataQuery.getSpecial(item);
        return getPoolType(s.zod) === 'warm';
      }).length;
      const dominant = getPoolTypeStr(list);

      const hasConsecutive = BusinessZodiacPredict._hasConsecutiveCold(list, pool.details);
      const hasConsecutiveSame = BusinessZodiacPredict._hasConsecutiveSamePool(list, pool.details);
      const allPools = new Set(list.map(i => getPoolType(DataQuery.getSpecial(i).zod)));

      if(ratio.hot >= 0.4 || (hotCount > warmCount + coldCount)) {
        if(label === 'short' && hotCount >= 3) return 'strong_hot';
        if(label !== 'short' && hotCount >= 2) return 'strong_hot';
      }

      if(ratio.cold > 0.3) {
        if(hasConsecutive && coldCount >= 3 && (label !== 'short' || hotCount <= 1)) return 'cold_relay';
      }

      if(allPools.size >= 3 && ratio.hot >= 0.25 && ratio.hot <= 0.4 && ratio.warm >= ratio.hot && ratio.warm >= ratio.cold) {
        return 'normal';
      }

      if(allPools.size < 2) {
        return 'chaos';
      }

      if(allPools.size >= 3 && ratio.hot < 0.4 && ratio.warm < 0.4 && ratio.cold < 0.4 && !hasConsecutiveSame) {
        return 'alternating';
      }

      if(dominant === 'warm' || (dominant === 'hot' && ratio.hot < 0.4)) return 'normal';
      if(dominant === 'hot') return 'strong_hot';
      if(dominant === 'cold' && coldCount >= 2) return 'cold_relay';

      return 'normal';
    };

    const midMode = determineMode(midRatio, windows.mid, 'mid');
    const shortMode = determineMode(shortRatio, windows.short, 'short');
    const longMode = determineMode(longRatio, windows.long, 'long');

    const midShortConsistent = midMode === shortMode;

    let finalMode = '';

    if(midShortConsistent) {
      finalMode = midMode;
    } else {
      finalMode = longMode;
    }

    if(!finalMode || finalMode === '') {
      finalMode = 'normal';
    }

    BusinessZodiacPredict._currentMode = finalMode;
    BusinessZodiacPredict._modeCooldown = 5;

    return finalMode;
  },

  _hasConsecutiveCold: (list, details) => {
    let consecutive = 0;
    let maxConsecutive = 0;
    list.forEach(item => {
      const s = DataQuery.getSpecial(item);
      if(details[s.zod]?.pool === 'cold') {
        consecutive++;
        maxConsecutive = Math.max(maxConsecutive, consecutive);
      } else {
        consecutive = 0;
      }
    });
    return maxConsecutive >= 2;
  },

  _hasConsecutiveSamePool: (list, details) => {
    let consecutive = 0;
    let maxConsecutive = 0;
    let lastPool = '';
    list.forEach(item => {
      const s = DataQuery.getSpecial(item);
      const p = details[s.zod]?.pool || '';
      if(p === lastPool && p !== '') {
        consecutive++;
        maxConsecutive = Math.max(maxConsecutive, consecutive);
      } else {
        consecutive = 1;
        lastPool = p;
      }
    });
    return maxConsecutive >= 2;
  },

  _calcDimensionHeat: (windows) => {
    const dims = ['zodiac', 'element', 'color', 'tail', 'head', 'range'];
    const result = {};

    dims.forEach(dim => {
      const shortCount = BusinessZodiacPredict._calcStatsByDim(windows.short, dim);
      const midCount = BusinessZodiacPredict._calcStatsByDim(windows.mid, dim);
      const longCount = BusinessZodiacPredict._calcStatsByDim(windows.long, dim);

      const rankOne = (countObj) => {
        const entries = Object.entries(countObj).sort((a, b) => b[1] - a[1]);
        const maxVal = entries[0]?.[1] || 1;
        const hot = entries.filter(([, v]) => v >= maxVal * 0.7).map(([k]) => k);
        const cold = entries.filter(([, v]) => v === 0).map(([k]) => k);
        const warm = entries.filter(([, v]) => v > 0 && v < maxVal * 0.7).map(([k]) => k);
        return { hot, warm, cold, ranked: entries };
      };

      result[dim] = {
        short: rankOne(shortCount),
        mid: rankOne(midCount),
        long: rankOne(longCount)
      };
    });

    return result;
  },

  _buildStrategy: (mode, pool, dimHeat, freqStats) => {
    const strategy = {
      mode: mode,
      recommend: [],
      backup: [],
      defense: [],
      dimMatch: {}
    };

    switch(mode) {
      case 'normal':
        strategy.recommend = pool.warm.slice(0, 4).concat(pool.hot.slice(0, 1));
        strategy.backup = pool.warm.slice(4).concat(pool.hot.slice(1, 3));
        strategy.defense = pool.cold.slice(0, 2);
        strategy.dimMatch = {
          element: dimHeat.element.mid.warm.slice(0, 2).concat(dimHeat.element.mid.hot.slice(0, 1)),
          color: dimHeat.color.mid.warm.slice(0, 2).concat(dimHeat.color.mid.hot.slice(0, 1)),
          tail: dimHeat.tail.mid.warm.slice(0, 2).concat(dimHeat.tail.mid.hot.slice(0, 1)),
          range: '主力区间'
        };
        break;

      case 'strong_hot':
        strategy.recommend = pool.hot.slice(0, 4).concat(pool.warm.slice(0, 2));
        strategy.backup = pool.hot.slice(4).concat(pool.warm.slice(2, 4));
        strategy.defense = [];
        strategy.dimMatch = {
          element: dimHeat.element.mid.hot.slice(0, 2),
          color: dimHeat.color.mid.hot.slice(0, 2),
          tail: dimHeat.tail.mid.hot.slice(0, 2),
          range: '热门区间'
        };
        break;

      case 'cold_relay': {
        const missVals = CONFIG.ANALYSIS.ZODIAC_ALL.map(z => pool.details[z]?.miss || 0);
        const missMu = missVals.reduce((a, b) => a + b, 0) / missVals.length;
        const missVar = missVals.reduce((a, b) => a + Math.pow(b - missMu, 2), 0) / missVals.length;
        const missSigma = Math.sqrt(missVar) || 1;

        const longCold = pool.cold.filter(z => {
          const miss = pool.details[z]?.miss || 0;
          return miss > missMu + 2 * missSigma;
        }).slice(0, 3);
        strategy.recommend = longCold.length > 0 ? longCold.concat(pool.cold.slice(0, 2)) : pool.cold.slice(0, 5);
        strategy.backup = pool.cold.slice(longCold.length > 0 ? longCold.length : 5, 7).concat(pool.warm.slice(0, 2));
        strategy.defense = longCold;
        strategy.dimMatch = {
          element: dimHeat.element.long.cold.slice(0, 2),
          color: dimHeat.color.long.cold.slice(0, 2),
          tail: dimHeat.tail.long.cold.slice(0, 2),
          range: '冷号区间'
        };
        break;
      }

      case 'chaos':
        strategy.recommend = BusinessZodiacPredict._selectByDimHeat(dimHeat, pool, 6);
        strategy.backup = pool.warm.slice(0, 4);
        strategy.defense = pool.cold.slice(0, 2);
        strategy.dimMatch = {
          element: dimHeat.element.mid.hot.slice(0, 2),
          color: dimHeat.color.mid.hot.slice(0, 2),
          tail: dimHeat.tail.mid.hot.slice(0, 2),
          range: '多维择优'
        };
        break;

      case 'alternating': {
        // 7.5 热号只取TOP3，分值下调为30
        const hotTop3 = pool.hot.slice(0, 3);
        hotTop3.forEach(z => { pool.scores[z] = 30; });

        const hotTake = pool.hot.length >= 2 ? 2 : 1;
        const coldTake = 3 - hotTake;
        strategy.recommend = [
          ...pool.hot.slice(0, hotTake),
          ...pool.warm.slice(0, 3),
          ...pool.cold.slice(0, coldTake)
        ];
        strategy.backup = pool.cold.slice(coldTake, coldTake + 2).concat(pool.hot.slice(hotTake, hotTake + 2));
        strategy.defense = pool.cold.slice(0, 2);
        strategy.dimMatch = {
          element: dimHeat.element.mid.warm.slice(0, 3),
          color: dimHeat.color.mid.warm.slice(0, 3),
          tail: dimHeat.tail.mid.warm.slice(0, 3),
          range: '均衡覆盖'
        };
        break;
      }

      default:
        strategy.recommend = pool.warm.slice(0, 4).concat(pool.hot.slice(0, 1));
        strategy.backup = pool.cold.slice(0, 2);
        strategy.defense = pool.cold.slice(2, 4);
        break;
    }

    return strategy;
  },

  _selectByDimHeat: (dimHeat, pool, count) => {
    const candidates = [];
    const seenZods = new Set();

    const addZodsByElement = (element) => {
      CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => {
        const nums = DataQuery.getZodiacNumbers(z);
        nums.forEach(n => {
          if(DataQuery.getWuxing(n) === element && !seenZods.has(z)) {
            candidates.push({ zodiac: z, score: pool.scores[z] || 0 });
            seenZods.add(z);
          }
        });
      });
    };

    const addZodsByColor = (color) => {
      CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => {
        const nums = DataQuery.getZodiacNumbers(z);
        nums.forEach(n => {
          if(DataQuery.getColorName(n) === color && !seenZods.has(z)) {
            candidates.push({ zodiac: z, score: pool.scores[z] || 0 });
            seenZods.add(z);
          }
        });
      });
    };

    const addZodsByTail = (tail) => {
      CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => {
        const nums = DataQuery.getZodiacNumbers(z);
        nums.forEach(n => {
          if(n % 10 === tail && !seenZods.has(z)) {
            candidates.push({ zodiac: z, score: pool.scores[z] || 0 });
            seenZods.add(z);
          }
        });
      });
    };

    const addZodsByRange = (rangeStr) => {
      CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => {
        const nums = DataQuery.getZodiacNumbers(z);
        nums.forEach(n => {
          let r = '';
          if(n >= 1 && n <= 9) r = '1-9';
          else if(n >= 10 && n <= 19) r = '10-19';
          else if(n >= 20 && n <= 29) r = '20-29';
          else if(n >= 30 && n <= 39) r = '30-39';
          else if(n >= 40 && n <= 49) r = '40-49';
          if(r === rangeStr && !seenZods.has(z)) {
            candidates.push({ zodiac: z, score: pool.scores[z] || 0 });
            seenZods.add(z);
          }
        });
      });
    };

    const dimKeys = ['element', 'color', 'tail', 'range'];
    dimKeys.forEach(dk => {
      const hotVals = dimHeat[dk].mid.hot;
      hotVals.forEach(val => {
        if(dk === 'element') addZodsByElement(val);
        else if(dk === 'color') addZodsByColor(val);
        else if(dk === 'tail') addZodsByTail(val);
        else if(dk === 'range') addZodsByRange(val);
      });
    });

    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => {
      if(!seenZods.has(z)) {
        candidates.push({ zodiac: z, score: pool.scores[z] || 0 });
      }
    });

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, count).map(c => c.zodiac);
  },

  _applyRiskControl: (pool, mode, freqStats) => {
    const midMiss = freqStats.mid.lastAppear;
    const midTotal = freqStats.mid.total;

    const missValues = CONFIG.ANALYSIS.ZODIAC_ALL.map(z => {
      return midMiss[z] === -1 ? midTotal : midMiss[z];
    });
    const mu = missValues.reduce((a, b) => a + b, 0) / missValues.length;
    const variance = missValues.reduce((a, b) => a + Math.pow(b - mu, 2), 0) / missValues.length;
    const sigma = Math.sqrt(variance) || 1;

    const extremeCold = CONFIG.ANALYSIS.ZODIAC_ALL.filter(z => {
      const miss = midMiss[z] === -1 ? midTotal : midMiss[z];
      return miss > mu + 2 * sigma;
    });

    const hotZodiacs = CONFIG.ANALYSIS.ZODIAC_ALL.filter(z => pool.details[z]?.pool === 'hot');
    const warmZodiacs = CONFIG.ANALYSIS.ZODIAC_ALL.filter(z => pool.details[z]?.pool === 'warm');
    const coldZodiacs = CONFIG.ANALYSIS.ZODIAC_ALL.filter(z => pool.details[z]?.pool === 'cold');

    const hotScore = hotZodiacs.length > 0 ? Math.max(...hotZodiacs.map(z => pool.scores[z] || 0)) : 35;
    const warmMax = warmZodiacs.length > 0 ? Math.max(...warmZodiacs.map(z => pool.scores[z] || 0)) : 0;
    const coldMax = coldZodiacs.length > 0 ? Math.max(...coldZodiacs.map(z => pool.scores[z] || 0)) : 0;

    const overridden = warmMax >= hotScore || coldMax >= hotScore;

    return {
      extremeCold: extremeCold,
      hierarchyValid: !overridden,
      modeCooldown: BusinessZodiacPredict._modeCooldown,
      sigma: Math.round(sigma * 10) / 10,
      mu: Math.round(mu * 10) / 10
    };
  },

  /**
   * =============================================
   * V3.2 优化规则层（8条永久开启）
   * 不修改原有函数名、接口、输出结构
   * 仅追加过滤/评分/规避逻辑
   * =============================================
   */

  /**
   * 统一应用8条优化规则
   * 规则1: 热号连开衰减（近5期≥4次→扣5分降级备选禁首位）
   * 规则2: 伪热三窗口过滤（近5期≥1+近10期前6+近15期不掉队）
   * 规则3: 冷号临界反转（遗漏≥μ+1.4σ→同类维度回暖+2~4分）
   * 规则4: 三窗口加权评分（10期50%+5期30%+15期20%）
   * 规则5: 精选3肖硬过滤（三窗口共振+无连开透支+五行波色分散）
   * 规则6: 连开透支规避（轻）（近5期≥2次→移出精选）
   * 规则7: 连开透支规避（重）（近5期≥3次→彻底规避禁任何推荐池）
   * 规则8: 上期重码零首选（上期开出生肖→直接终极规避）
   */
  _applyOptimizationRules: (pool, freqStats, windows, fullData) => {
    const zodList = CONFIG.ANALYSIS.ZODIAC_ALL;
    const details = pool.details;
    const scores = pool.scores;

    // 三窗口遗漏基准（用于规则4和规则3）
    const windowMiss = { short: {}, mid: {}, long: {} };
    ['short', 'mid', 'long'].forEach(w => {
      const ws = w === 'short' ? windows.short : w === 'mid' ? windows.mid : windows.long;
      const lastAppear = freqStats[w].lastAppear;
      const total = freqStats[w].total;
      zodList.forEach(z => {
        windowMiss[w][z] = lastAppear[z] === -1 ? total : lastAppear[z];
      });
    });

    // 计算均值和标准差（用于规则3）
    const midMissArr = zodList.map(z => windowMiss.mid[z]);
    const mu = midMissArr.reduce((a, b) => a + b, 0) / midMissArr.length;
    const var1 = midMissArr.reduce((a, b) => a + Math.pow(b - mu, 2), 0) / midMissArr.length;
    const sigma = Math.sqrt(var1) || 1;

    // 规则1：热号连开衰减（近5期≥4次→扣5分、降级备选、禁止精选首位）
    zodList.forEach(z => {
      const shortCount = freqStats.short.zodCount[z] || 0;
      if(shortCount >= 4) {
        scores[z] = Math.max(10, scores[z] - 5);
        details[z]._overdueByOverheat = true;
      }
    });

    // 规则2：伪热三窗口过滤（近5期≥1、近10期前6、近15期不掉队）
    const shortAppearances = [];
    windows.short.forEach(item => {
      const s = DataQuery.getSpecial(item);
      if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod)) shortAppearances.push(s.zod);
    });
    const midSorted = zodList.slice().sort((a, b) => (freqStats.mid.zodCount[b] || 0) - (freqStats.mid.zodCount[a] || 0));
    const midTop6 = midSorted.slice(0, 6);

    zodList.forEach(z => {
      const inShort5 = shortAppearances.filter(x => x === z).length >= 1;
      const inMidTop6 = midTop6.includes(z);
      const longCount = freqStats.long.zodCount[z] || 0;
      const notDropLong = longCount >= 1;

      // 优化规则2：伪热三窗口过滤
      if(inShort5 && inMidTop6 && !notDropLong) {
        scores[z] = Math.max(10, scores[z] - 3);
        details[z]._pseudoHot = true;
      }
    });

    // 规则3：冷号临界反转（遗漏≥μ+1.4σ→同类维度回暖则+2~4分）
    zodList.forEach(z => {
      const miss = windowMiss.mid[z];
      if(miss >= mu + 1.4 * sigma) {
        details[z]._coldCritical = true;
        const dimRecovery = BusinessZodiacPredict._checkDimRecovery(z, windows, freqStats);
        const bonus = Math.max(2, Math.min(4, dimRecovery * 1.3));
        scores[z] = Math.min(20, Math.round((scores[z] + bonus) * 10) / 10);
      }
    });

    // 规则4：三窗口加权评分（10期50% + 5期30% + 15期20%）
    // 计算各窗口的频次得分
    const windowScores = {};
    zodList.forEach(z => {
      const sScore = freqStats.short.zodCount[z] || 0;
      const mScore = freqStats.mid.zodCount[z] || 0;
      const lScore = freqStats.long.zodCount[z] || 0;
      // 归一化处理：频次越高→遗漏越低→分值越高
      const sWeight = 1 - (sScore / (freqStats.short.total || 1));
      const mWeight = 1 - (mScore / (freqStats.mid.total || 1));
      const lWeight = 1 - (lScore / (freqStats.long.total || 1));
      windowScores[z] = mWeight * 0.5 + sWeight * 0.3 + lWeight * 0.2;
    });
    // 将窗口加权分数融入最终评分（与原分数混合）
    const maxW = Math.max(...Object.values(windowScores));
    const minW = Math.min(...Object.values(windowScores));
    zodList.forEach(z => {
      // 优化规则4：三窗口加权评分
      const normalized = (windowScores[z] - minW) / ((maxW - minW) || 1);
      const weightedBonus = Math.round(normalized * 10);
      // 热号固定35分不受加权影响，只允许扣分
      if(pool.details[z].pool === 'hot') {
        scores[z] = Math.min(35, Math.round((scores[z] + weightedBonus) * 10) / 10);
      } else if(pool.details[z].pool === 'warm') {
        scores[z] = Math.max(20, Math.min(30, Math.round((scores[z] + weightedBonus) * 10) / 10));
      } else {
        scores[z] = Math.max(10, Math.min(20, Math.round((scores[z] + weightedBonus) * 10) / 10));
      }
    });

    // 规则6 & 7：连开透支规避 + 上期重码规避标记
    const lastZodiac = fullData.length > 0 ? DataQuery.getSpecial(fullData[0]).zod : '';

    zodList.forEach(z => {
      const shortCount = freqStats.short.zodCount[z] || 0;
      // 优化规则6：连开透支规避
      if(shortCount >= 3) {
        details[z]._blockedByOverheat = true;
      } else if(shortCount >= 2) {
        details[z]._warnedByOverheat = true;
      }
      // 优化规则7：上期重码零首选
      if(z === lastZodiac && lastZodiac) {
        details[z]._blockedByRepeat = true;
      }
    });

    // 重新排序
    pool.sorted = zodList
      .slice()
      .sort((a, b) => scores[b] - scores[a])
      .map(z => [z, Math.round(scores[z])]);
  },

  /**
   * 规则3辅助：检查冷号同类维度回暖情况
   * 五行/波色/尾数/区间 在三窗口内是否回开
   */
  _checkDimRecovery: (zodiac, windows, freqStats) => {
    let recoveryCount = 0;
    const nums = DataQuery.getZodiacNumbers(zodiac);
    if(nums.length === 0) return 0;

    const sampleNum = nums[0];
    const zodElement = DataQuery.getWuxing(sampleNum);
    const zodColor = DataQuery.getColorName(sampleNum);
    const zodTail = sampleNum % 10;

    const checkDim = (list, dimKey, targetVal) => {
      return list.some(item => {
        const s = DataQuery.getSpecial(item);
        if(dimKey === 'element') return DataQuery.getWuxing(s.te) === targetVal;
        if(dimKey === 'color') return DataQuery.getColorName(s.te) === targetVal;
        if(dimKey === 'tail') return s.tail === targetVal;
        return false;
      });
    };

    if(checkDim(windows.short, 'element', zodElement)) recoveryCount++;
    if(checkDim(windows.short, 'color', zodColor)) recoveryCount++;
    if(checkDim(windows.short, 'tail', zodTail)) recoveryCount++;

    return recoveryCount;
  },

  /**
   * 规则5：精选3肖硬过滤
   * 条件：三窗口共振 + 无连开透支 + 五行/波色分散 + 只取前三
   * V3.3增强：年度弱势肖排除、梯队互斥、热度透支静默、近3期降权
   */
  _buildSelected3: (pool, windows, freqStats) => {
    const zodList = pool.sorted.map(([z]) => z);
    const details = pool.details;

    const candidates = [];
    const lastZodiac = freqStats.short.total > 0 ? DataQuery.getSpecial(windows.short[0]).zod : '';

    zodList.forEach(z => {
      // 规则8：上期重码零首选
      if(z === lastZodiac) return;

      // 规则7：连开透支≥3彻底规避
      if(details[z]._blockedByOverheat) return;

      // 规则6：连开透支≥2移出精选
      if(details[z]._warnedByOverheat) return;

      // 规则1：热号连开衰减≥4禁止精选首位（允许非首位）
      const isRule1Penalized = details[z]._overdueByOverheat || false;

      // V3.3规则1：年度弱势肖禁止进入精选
      if(details[z]._annualWeak) return;

      // V3.3规则3：热度透支静默
      if(details[z]._overheatSilence) return;

      // V3.3规则5：近3期出号已降权，允许但优先级低

      // 规则5：三窗口共振判定（三窗口均出现该生肖或遗漏不极端）
      const sCount = freqStats.short.zodCount[z] || 0;
      const mCount = freqStats.mid.zodCount[z] || 0;
      const lCount = freqStats.long.zodCount[z] || 0;
      const shortMiss = details[z].miss;
      const midMiss = details[z].miss;

      const inMultipleWindows = (sCount > 0 || mCount > 0) && lCount > 0;
      const notOverdue = shortMiss <= 5 && midMiss <= 10;

      if(!inMultipleWindows && !notOverdue) return;

      candidates.push({
        zodiac: z,
        score: pool.scores[z] || 0,
        element: DataQuery.getWuxing(DataQuery.getZodiacNumbers(z)[0]),
        color: DataQuery.getColorName(DataQuery.getZodiacNumbers(z)[0]),
        tier: details[z]._tier || 3,
        recent3Penalty: details[z]._recent3Penalty || false,
        rule1Penalized: isRule1Penalized
      });
    });

    // V3.3规则2：同梯队热肖轮换互斥
    // 精选3肖不允许扎堆全选一线热肖，最多只入选1~2只
    const tier1Max = 2;
    const selected = [];
    const usedElements = new Set();
    const usedColors = new Set();
    let tier1Count = 0;

    for(const c of candidates) {
      if(selected.length >= 3) break;

      // 规则1：禁止精选首位
      if(selected.length === 0 && c.rule1Penalized) continue;

      if(c.tier === 1 && tier1Count >= tier1Max) continue;

      // 优先选择不同五行和波色的生肖
      const isDiverse = !usedElements.has(c.element) || !usedColors.has(c.color);
      if(selected.length < 2 || isDiverse) {
        selected.push(c);
        usedElements.add(c.element);
        usedColors.add(c.color);
        if(c.tier === 1) tier1Count++;
      }
    }

    // 如果五行/波色分散后不足3个，放宽互斥条件补足
    if(selected.length < 3) {
      for(const c of candidates) {
        if(!selected.find(s => s.zodiac === c.zodiac)) {
          // 规则1：仍禁止首位
          if(selected.length === 0 && c.rule1Penalized) continue;
          selected.push(c);
          if(selected.length >= 3) break;
        }
      }
    }

    // 如果仍不足3个，按分数从所有候选（排除已过滤的）中补足
    if(selected.length < 3) {
      for(const c of candidates) {
        if(!selected.find(s => s.zodiac === c.zodiac)) {
          // 规则1：仍禁止首位
          if(selected.length === 0 && c.rule1Penalized) continue;
          selected.push(c);
          if(selected.length >= 3) break;
        }
      }
    }

    return selected.slice(0, 3).map(c => c.zodiac);
  },

  resetCooldown: () => {
    BusinessZodiacPredict._modeCooldown = 0;
    BusinessZodiacPredict._currentMode = 'normal';
  },

  /**
   * =============================================
   * V3.3 智能增强层（5条永久开启）
   * 全部由程序自动读取历史数据自行计算识别
   * 禁止手工写死任何生肖名单
   * =============================================
   */

  /**
   * 规则1：自动计算年度固定弱势肖
   * 1. 截取当前年度全部历史开奖生肖数据
   * 2. 统计12生肖全年总开出频次、平均间隔遗漏、平均出现密度
   * 3. 按全年频次倒数排序，锁定频次最低、长期遗漏偏高、补号只出一期不连开的生肖
   * 4. 强制：年度弱势肖禁止进入精选3肖主推/备选，仅可放入终极防守池
   */
  _calcAnnualWeakZodiacs: (fullData) => {
    const zodList = CONFIG.ANALYSIS.ZODIAC_ALL;
    const zodCount = {};
    zodList.forEach(z => zodCount[z] = 0);
    const lastAppear = {};
    zodList.forEach(z => lastAppear[z] = -1);

    fullData.forEach((item, idx) => {
      const s = DataQuery.getSpecial(item);
      if(zodList.includes(s.zod)) {
        zodCount[s.zod]++;
        if(lastAppear[s.zod] === -1) lastAppear[s.zod] = idx;
      }
    });

    const total = fullData.length || 1;
    const stats = zodList.map(z => {
      const miss = lastAppear[z] === -1 ? total : lastAppear[z];
      const density = zodCount[z] / total;
      return { zodiac: z, count: zodCount[z], miss, density };
    });

    const avgCount = stats.reduce((a, b) => a + b.count, 0) / stats.length;
    const avgMiss = stats.reduce((a, b) => a + b.miss, 0) / stats.length;

    const weakCandidates = stats.filter(s =>
      s.count < avgCount && s.miss > avgMiss
    );

    weakCandidates.sort((a, b) => a.count - b.count || b.miss - a.miss);

    const annualWeak = [];
    for(let i = 0; i < Math.min(3, weakCandidates.length); i++) {
      if(weakCandidates[i].count <= avgCount * 0.6) {
        annualWeak.push(weakCandidates[i].zodiac);
      }
    }

    // 兜底：若无满足阈值的弱势肖，取频次最低的2个作为年度弱势
    if(annualWeak.length === 0 && weakCandidates.length >= 2) {
      const minCount = weakCandidates[0].count;
      weakCandidates.forEach(w => {
        if(w.count === minCount && annualWeak.length < 2) {
          annualWeak.push(w.zodiac);
        }
      });
    }

    return annualWeak;
  },

  /**
   * 规则2：自动划分同梯队热肖 + 轮换互斥
   * 按全年开出频次+15期窗口热度聚类，划分一线/二线/三线梯队
   * 精选3肖不允许扎堆全选一线热肖，最多只入选1~2只
   */
  _assignTierPools: (fullData, longStats) => {
    const zodList = CONFIG.ANALYSIS.ZODIAC_ALL;
    const zodCount = {};
    zodList.forEach(z => zodCount[z] = 0);
    fullData.forEach(item => {
      const s = DataQuery.getSpecial(item);
      if(zodList.includes(s.zod)) zodCount[s.zod]++;
    });

    const total = fullData.length || 1;
    const combinedScore = zodList.map(z => {
      const yearWeight = zodCount[z] / total;
      const windowWeight = (longStats.zodCount[z] || 0) / (longStats.total || 1);
      return { zodiac: z, score: yearWeight * 0.6 + windowWeight * 0.4 };
    });

    combinedScore.sort((a, b) => b.score - a.score);
    const third = Math.ceil(zodList.length / 3);

    const tier1 = combinedScore.slice(0, third).map(x => x.zodiac);
    const tier2 = combinedScore.slice(third, third * 2).map(x => x.zodiac);
    const tier3 = combinedScore.slice(third * 2).map(x => x.zodiac);

    return { tier1, tier2, tier3 };
  },

  /**
   * 规则3：自动识别阶段性热度透支静默
   * 近15期密集高频开出、远超年度平均频次 → 标记热度透支
   */
  _detectOverheatSilence: (zodiac, fullData, longWindow) => {
    const zodList = CONFIG.ANALYSIS.ZODIAC_ALL;
    let totalCount = 0;
    fullData.forEach(item => {
      const s = DataQuery.getSpecial(item);
      if(s.zod === zodiac) totalCount++;
    });

    const avgDensity = totalCount / (fullData.length || 1);
    const longCount = longWindow.filter(item => {
      const s = DataQuery.getSpecial(item);
      return s.zod === zodiac;
    }).length;

    const longDensity = longCount / (longWindow.length || 1);

    // 近15期密度远超年度平均（2倍以上）标记为透支
    return longDensity > avgDensity * 2 && longCount >= 3;
  },

  /**
   * 规则4：自动识别热肖集体熄火 → 预判跳开行情
   * 一线主力热肖群体连续2~3期集体不出
   */
  _detectHotShutdown: (tier1, windows, pool) => {
    if(!tier1 || tier1.length === 0) return false;

    let consecutiveNoHot = 0;
    windows.short.forEach(item => {
      const s = DataQuery.getSpecial(item);
      if(!tier1.includes(s.zod)) consecutiveNoHot++;
    });

    return consecutiveNoHot >= 2;
  },

  /**
   * 规则5：近3期全域出号降权
   * 自动抓取最新近3期所有已出生肖，统一降低精选排序权重
   */
  _getRecent3Zodiacs: (fullData) => {
    const recent3 = fullData.slice(0, Math.min(3, fullData.length));
    const zods = new Set();
    recent3.forEach(item => {
      const s = DataQuery.getSpecial(item);
      if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod)) zods.add(s.zod);
    });
    return Array.from(zods);
  },

  /**
   * 统一应用V3.3的5条智能规则
   * 规则1: 年度弱势肖禁止进入精选3肖
   * 规则2: 同梯队热肖轮换互斥（精选最多1~2只一线热肖）
   * 规则3: 阶段性热度透支静默
   * 规则5: 近3期全域出号降权
   * 规则4（已在calc中处理）：热肖集体熄火→预判跳开
   */
  _applyV33Rules: (pool, windows, freqStats, fullData, annualWeak, tierPools, recent3Zods, hotShutdown) => {
    const zodList = CONFIG.ANALYSIS.ZODIAC_ALL;
    const details = pool.details;
    const scores = pool.scores;

    // V3.3规则1：年度弱势肖禁止进入精选3肖（标记）
    annualWeak.forEach(z => {
      // 优化规则1（V3.3）：年度弱势肖
      details[z]._annualWeak = true;
    });

    // V3.3规则3：阶段性热度透支静默
    zodList.forEach(z => {
      if(BusinessZodiacPredict._detectOverheatSilence(z, fullData, windows.long)) {
        // 优化规则3（V3.3）：热度透支静默
        details[z]._overheatSilence = true;
        scores[z] = Math.max(10, Math.round((scores[z] - 8) * 10) / 10);
      }
    });

    // V3.3规则5：近3期全域出号降权
    recent3Zods.forEach(z => {
      // 优化规则5（V3.3）：近3期出号降权
      details[z]._recent3Penalty = true;
      scores[z] = Math.max(10, Math.round((scores[z] - 3) * 10) / 10);
    });

    // V3.3规则2：同梯队热肖轮换互斥标记（在精选3肖中使用）
    zodList.forEach(z => {
      if(tierPools.tier1.includes(z)) details[z]._tier = 1;
      else if(tierPools.tier2.includes(z)) details[z]._tier = 2;
      else details[z]._tier = 3;
    });

    // 重新排序
    pool.sorted = zodList
      .slice()
      .sort((a, b) => scores[b] - scores[a])
      .map(z => [z, Math.round(scores[z])]);

    pool._annualWeak = annualWeak;
    pool._tierPools = tierPools;
    pool._hotShutdown = hotShutdown;
  },

  /**
   * V3.4：冷热序列模式分析（跳开乱序专用）
   * 15期窗口：观察冷热转换大趋势
   * 10期窗口：判断当前冷热偏向
   * 5期窗口：确认下一期预测
   */
  _analyzePoolSequence: (fullData, pool) => {
    const details = pool.details;

    const sequence = fullData.map(item => {
      const s = DataQuery.getSpecial(item);
      return details[s.zod]?.pool || 'warm';
    });

    const countPattern = (seq, window) => {
      const slice = seq.slice(0, Math.min(window, seq.length));
      const counts = { hot: 0, warm: 0, cold: 0 };
      slice.forEach(p => counts[p]++);
      return counts;
    };

    const recent5 = countPattern(sequence, 5);
    const recent7 = countPattern(sequence, 7);
    const recent10 = countPattern(sequence, 10);
    const recent15 = countPattern(sequence, 15);

    const getDominantPool = (counts) => {
      const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      return entries[0][0];
    };

    const predictNextPool = () => {
      const lastPool = sequence[0];
      const secondPool = sequence.length > 1 ? sequence[1] : lastPool;
      const thirdPool = sequence.length > 2 ? sequence[2] : secondPool;
      const fourthPool = sequence.length > 3 ? sequence[3] : thirdPool;

      const dominant15 = getDominantPool(recent15);

      const seq7 = sequence.slice(0, Math.min(7, sequence.length));
      const seq10 = sequence.slice(0, Math.min(10, sequence.length));

      if(lastPool === 'hot' && secondPool === 'hot' && thirdPool === 'hot') {
        return 'warm';
      }

      if(lastPool === 'hot' && secondPool === 'hot' && thirdPool === 'cold') {
        return recent5.warm >= 2 ? 'warm' : 'cold';
      }

      if(recent7) {
        const hot7 = recent7.hot || 0;
        const cold7 = recent7.cold || 0;
        const warm7 = recent7.warm || 0;
        if(hot7 >= 4 && hot7 <= 5 && cold7 >= 2) {
          return warm7 >= 1 ? 'warm' : 'hot';
        }
      }

      const hotToCold10 = seq10.filter((p, i) => i > 0 && seq10[i-1] === 'hot' && p === 'cold').length;
      const coldToHot10 = seq10.filter((p, i) => i > 0 && seq10[i-1] === 'cold' && p === 'hot').length;
      const totalTransitions10 = hotToCold10 + coldToHot10;
      if(totalTransitions10 >= 4 && Math.abs(hotToCold10 - coldToHot10) <= 1) {
        return 'warm';
      }

      if(recent15.hot >= 6 || recent15.cold >= 6) {
        return 'warm';
      }

      if(recent10.hot > recent10.cold && recent10.hot > recent10.warm) {
        if(lastPool === 'hot' && secondPool === 'hot') {
          return 'warm';
        }
        if(lastPool === 'hot' && secondPool === 'cold') {
          return recent5.warm >= 2 ? 'warm' : 'hot';
        }
        return 'warm';
      }

      if(recent10.cold > recent10.hot && recent10.cold > recent10.warm) {
        if(lastPool === 'cold' && secondPool === 'cold') {
          return hotToCold10 >= 2 ? 'warm' : 'hot';
        }
        if(lastPool === 'cold' && secondPool === 'hot') {
          return 'warm';
        }
        return coldToHot10 >= 2 ? 'hot' : 'warm';
      }

      if(recent5.hot >= 3) {
        return 'warm';
      }

      if(recent5.cold >= 3) {
        return recent5.hot >= 1 ? 'warm' : 'hot';
      }

      if(lastPool === secondPool) {
        return lastPool === 'hot' ? 'warm' : lastPool === 'cold' ? 'warm' : 'hot';
      }

      if(lastPool === 'hot' && secondPool === 'cold') {
        return thirdPool === 'hot' ? 'warm' : 'cold';
      }

      if(lastPool === 'cold' && secondPool === 'hot') {
        return thirdPool === 'cold' ? 'warm' : 'hot';
      }

      return 'warm';
    };

    const detectPattern = () => {
      const seq5 = sequence.slice(0, Math.min(5, sequence.length));
      const seq7 = sequence.slice(0, Math.min(7, sequence.length));

      if(seq5[0] === 'hot' && seq5[1] === 'hot' && seq5[2] === 'hot') {
        return { name: '三连热', desc: '连续三期热号，下期回归温号', confidence: 0.9 };
      }

      if(seq5[0] === 'hot' && seq5[1] === 'hot' && seq5[2] === 'cold') {
        return { name: '两热一冷', desc: '热号转冷，下期看温或冷', confidence: 0.75 };
      }

      const seq7Pattern = seq7.join('/');
      if(seq7Pattern.includes('hot/cold/hot') || seq7Pattern.includes('cold/hot/cold')) {
        const hot7 = recent7.hot || 0;
        const cold7 = recent7.cold || 0;
        if(hot7 >= 3 && cold7 >= 2) {
          return { name: '热冷交替', desc: '7期内热冷交替频繁', confidence: 0.7 };
        }
      }

      const hotToCold10 = sequence.slice(0, 10).filter((p, i) => i > 0 && sequence[i-1] === 'hot' && p === 'cold').length;
      const coldToHot10 = sequence.slice(0, 10).filter((p, i) => i > 0 && sequence[i-1] === 'cold' && p === 'hot').length;
      if(hotToCold10 >= 2 && coldToHot10 >= 1) {
        return { name: '由热转冷', desc: '近10期由热转冷趋势', confidence: 0.8 };
      }
      if(coldToHot10 >= 2 && hotToCold10 >= 1) {
        return { name: '由冷回补', desc: '近10期由冷转热回补', confidence: 0.8 };
      }

      if(recent15.hot >= 3 && recent15.cold >= 3 && recent15.warm >= 2) {
        return { name: '混沌乱序', desc: '15期内热冷温均匀分布', confidence: 0.6 };
      }

      return { name: '正常轮动', desc: '无明显特殊模式', confidence: 0.5 };
    };

    const predictedPool = predictNextPool();
    const pattern = detectPattern();

    return {
      sequence: sequence,
      recent5,
      recent7,
      recent10,
      recent15,
      dominant15: getDominantPool(recent15),
      predictedPool: predictedPool,
      pattern: pattern
    };
  },

  /**
   * V3.4：基于冷热序列预测优化推荐
   */
  _applyChaosSequenceRule: (pool, sequenceAnalysis) => {
    const zodList = CONFIG.ANALYSIS.ZODIAC_ALL;
    const scores = pool.scores;
    const predictedPool = sequenceAnalysis.predictedPool;

    zodList.forEach(z => {
      const zodiacPool = pool.details[z]?.pool;
      if(zodiacPool === predictedPool) {
        scores[z] = Math.round((scores[z] + 5) * 10) / 10;
      } else {
        scores[z] = Math.max(10, Math.round((scores[z] - 2) * 10) / 10);
      }
    });

    pool.sorted = zodList
      .slice()
      .sort((a, b) => scores[b] - scores[a])
      .map(z => [z, Math.round(scores[z])]);
  },

  getModeText: (mode) => {
    const map = {
      'normal': '正常轮动',
      'strong_hot': '强追热',
      'cold_relay': '冷号接力',
      'chaos': '跳开乱序',
      'alternating': '冷热交替'
    };
    return map[mode] || '正常轮动';
  },

  getPoolText: (pool) => {
    const map = { 'hot': '热号', 'warm': '温号', 'cold': '冷号' };
    return map[pool] || pool;
  }
};
