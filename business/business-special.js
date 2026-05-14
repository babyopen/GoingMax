/**
 * 精选特码业务模块 v2.0
 * @description 处理精选特码的保存、收藏、历史记录等功能，包含四大核心算法+多窗口交叉识别+冷热交替适配
 */
const BusinessSpecial = {

  calcSelectedZodiacs: (customAnalyzeLimit) => {
    const state = StateManager._state;
    const { historyData, analyzeLimit: defaultAnalyzeLimit } = state.analysis;
    if(!historyData || historyData.length < 2) return null;

    const analyzeLimit = customAnalyzeLimit || defaultAnalyzeLimit;
    const list = historyData.slice(0, Math.min(analyzeLimit || 30, historyData.length));
    const total = list.length;

    const zodiacCount = {};
    const zodiacLastAppear = {};
    const zodiacRecent2 = [];
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => {
      zodiacCount[z] = 0;
      zodiacLastAppear[z] = -1;
    });

    list.forEach((item, idx) => {
      const s = DataQuery.getSpecial(item);
      if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod)) {
        zodiacCount[s.zod]++;
        if(zodiacLastAppear[s.zod] === -1) {
          zodiacLastAppear[s.zod] = idx;
        }
      }
      if(idx < 2 && CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod)) {
        zodiacRecent2.push({ zodiac: s.zod, index: idx });
      }
    });

    const marketMode = BusinessSpecial._detectMarketMode(list);
    const windowAnalysis = BusinessSpecial._multiWindowAnalysis(list);
    const patternScores = BusinessSpecial._calcPatternScores(windowAnalysis, marketMode);

    const hotInertiaScores = BusinessSpecial._calcHotInertia(zodiacRecent2, total, marketMode);
    const missRepairScores = BusinessSpecial._calcMissRepair(zodiacLastAppear, zodiacCount, total, marketMode);
    const cycleBalanceScores = BusinessSpecial._calcCycleBalance(zodiacCount, zodiacLastAppear, total, marketMode);
    const freqBaseScores = BusinessSpecial._calcFreqBase(zodiacCount, list, total);

    const selectedZodiacs = [];
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(zod => {
      const baseScore = freqBaseScores[zod] || 0;
      const hotInertia = hotInertiaScores[zod] || 0;
      const missRepair = missRepairScores[zod] || 0;
      const cycleBalance = cycleBalanceScores[zod] || 0;
      const patternScore = patternScores[zod] || 0;

      let totalScore = baseScore + hotInertia + missRepair + cycleBalance + patternScore;

      if(marketMode.isOverheated[zod]) {
        totalScore *= 0.6;
      }

      selectedZodiacs.push({
        zodiac: zod,
        totalScore: Math.round(totalScore * 100) / 100,
        baseScore: Math.round(baseScore * 100) / 100,
        hotInertia: Math.round(hotInertia * 100) / 100,
        missRepair: Math.round(missRepair * 100) / 100,
        cycleBalance: Math.round(cycleBalance * 100) / 100,
        patternScore: Math.round(patternScore * 100) / 100,
        count: zodiacCount[zod],
        miss: zodiacLastAppear[zod] === -1 ? total : zodiacLastAppear[zod],
        cycleState: BusinessSpecial._getCycleState(zodiacCount[zod], zodiacLastAppear[zod], total),
        marketMode: marketMode.type,
        windowSignal: windowAnalysis.signal[zod] || '无信号'
      });
    });

    selectedZodiacs.sort((a, b) => b.totalScore - a.totalScore);

    return {
      selectedZodiacs: selectedZodiacs.slice(0, 6),
      allZodiacs: selectedZodiacs,
      total: total,
      marketMode: marketMode.type,
      windowConsistency: windowAnalysis.consistency
    };
  },

  _multiWindowAnalysis: (list) => {
    const windows = {
      short: list.slice(0, Math.min(5, list.length)),
      medium: list.slice(0, Math.min(8, list.length)),
      long: list.slice(0, Math.min(10, list.length))
    };

    const windowPatterns = {};
    Object.keys(windows).forEach(key => {
      windowPatterns[key] = BusinessSpecial._extractWindowPattern(windows[key]);
    });

    const signal = {};
    let consistentCount = 0;
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(zod => {
      const signals = [
        windowPatterns.short[zod],
        windowPatterns.medium[zod],
        windowPatterns.long[zod]
      ].filter(s => s && s !== 'neutral');

      const uniqueSignals = [...new Set(signals)];
      if(uniqueSignals.length === 1) {
        signal[zod] = uniqueSignals[0];
        consistentCount++;
      } else if(uniqueSignals.length === 2) {
        const counts = {};
        signals.forEach(s => counts[s] = (counts[s] || 0) + 1);
        signal[zod] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      } else {
        signal[zod] = 'oscillation';
      }
    });

    const consistency = consistentCount / CONFIG.ANALYSIS.ZODIAC_ALL.length;

    return { patterns: windowPatterns, signal, consistency };
  },

  _extractWindowPattern: (windowList) => {
    const patterns = {};
    const total = windowList.length;
    if(total === 0) return patterns;

    const zodiacSequence = windowList.map(item => {
      const s = DataQuery.getSpecial(item);
      return CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod) ? s.zod : null;
    }).filter(z => z !== null);

    const zodiacCount = {};
    const zodiacPositions = {};
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => {
      zodiacCount[z] = 0;
      zodiacPositions[z] = [];
    });

    zodiacSequence.forEach((zod, idx) => {
      zodiacCount[zod]++;
      zodiacPositions[zod].push(idx);
    });

    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(zod => {
      const count = zodiacCount[zod];
      const positions = zodiacPositions[zod];
      const avgCount = total / 12;

      if(count === 0) {
        patterns[zod] = 'cold';
      } else if(count >= avgCount * 1.5) {
        if(positions.length >= 2 && positions[1] - positions[0] <= 2) {
          patterns[zod] = 'hot_streak';
        } else {
          patterns[zod] = 'hot';
        }
      } else if(count >= avgCount * 0.8) {
        patterns[zod] = 'warm';
      } else {
        patterns[zod] = 'cooling';
      }
    });

    return patterns;
  },

  _calcPatternScores: (windowAnalysis, marketMode) => {
    const scores = {};
    const { signal, consistency } = windowAnalysis;

    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(zod => {
      let score = 0;
      const sig = signal[zod];

      if(consistency >= 0.8) {
        switch(sig) {
          case 'hot_streak':
            score = 20;
            break;
          case 'hot':
            score = 15;
            break;
          case 'warm':
            score = 10;
            break;
          case 'cooling':
            score = 5;
            break;
          case 'cold':
            score = 12;
            break;
        }
      } else if(consistency >= 0.5) {
        switch(sig) {
          case 'hot_streak':
            score = 15;
            break;
          case 'hot':
            score = 12;
            break;
          case 'warm':
            score = 8;
            break;
          case 'cooling':
            score = 4;
            break;
          case 'cold':
            score = 10;
            break;
        }
      } else {
        score = 5;
      }

      if(marketMode.type === '冷热交替') {
        if(sig === 'warm') score *= 1.25;
        if(sig === 'hot_streak') score *= 0.8;
      }

      scores[zod] = score;
    });

    return scores;
  },

  _detectMarketMode: (list) => {
    const total = list.length;
    const zodiacSequence = list.map(item => {
      const s = DataQuery.getSpecial(item);
      return CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod) ? s.zod : null;
    }).filter(z => z !== null);

    const zodiacCount = {};
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => zodiacCount[z] = 0);
    zodiacSequence.forEach(zod => zodiacCount[zod]++);

    const maxCount = Math.max(...Object.values(zodiacCount));
    const avgCount = total / 12;
    const hotZodiacs = Object.entries(zodiacCount).filter(([_, c]) => c >= avgCount * 1.5).length;
    const coldZodiacs = Object.entries(zodiacCount).filter(([_, c]) => c === 0).length;

    let switchCount = 0;
    for(let i = 1; i < zodiacSequence.length; i++) {
      if(zodiacSequence[i] !== zodiacSequence[i-1]) {
        switchCount++;
      }
    }
    const switchRate = switchCount / (zodiacSequence.length - 1 || 1);

    let maxStreak = 0;
    let currentStreak = 1;
    for(let i = 1; i < zodiacSequence.length; i++) {
      if(zodiacSequence[i] === zodiacSequence[i-1]) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }

    const isOverheated = {};
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(zod => {
      isOverheated[zod] = zodiacCount[zod] >= avgCount * 2;
    });

    let modeType = 'normal';
    if(switchRate > 0.7 && maxStreak <= 2 && hotZodiacs <= 3 && coldZodiacs <= 3) {
      modeType = '冷热交替';
    } else if(maxStreak >= 4) {
      modeType = '持续热肖';
    } else if(coldZodiacs >= 5) {
      modeType = '持续冷肖';
    } else if(switchRate < 0.3) {
      modeType = '震荡轮转';
    }

    return {
      type: modeType,
      switchRate,
      maxStreak,
      hotZodiacs,
      coldZodiacs,
      isOverheated
    };
  },

  _calcHotInertia: (recent2, total, marketMode = { type: 'normal' }) => {
    const scores = {};
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => scores[z] = 0);

    if(recent2.length === 0) return scores;

    const latestZodiac = recent2[0]?.zodiac;
    const prevZodiac = recent2[1]?.zodiac;

    let baseBonus = 0;
    if(latestZodiac && prevZodiac && latestZodiac === prevZodiac) {
      baseBonus = 15;
      scores[latestZodiac] = baseBonus;
    } else {
      baseBonus = 10;
      if(latestZodiac) scores[latestZodiac] = baseBonus;
      if(prevZodiac) scores[prevZodiac] = baseBonus;
    }

    let streakCount = 0;
    if(latestZodiac) {
      for(let i = 0; i < Math.min(3, recent2.length); i++) {
        if(recent2[i]?.zodiac === latestZodiac) {
          streakCount++;
        } else {
          break;
        }
      }
      if(streakCount >= 3 && marketMode.type !== '冷热交替') {
        scores[latestZodiac] = Math.max(0, scores[latestZodiac] * 0.6);
      }
    }

    return scores;
  },

  _calcMissRepair: (lastAppear, count, total, marketMode = { type: 'normal' }) => {
    const scores = {};
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => {
      const miss = lastAppear[z] === -1 ? total : lastAppear[z];
      
      let score = 0;
      if(miss >= 30) {
        score = 20;
      } else if(miss >= 15) {
        score = 15 + (miss - 15) * 0.33;
      } else if(miss >= 5) {
        score = 5 + (miss - 5) * 0.5;
      }

      if(marketMode.type === '冷热交替') {
        score *= 0.7;
      }

      scores[z] = score;
    });

    return scores;
  },

  _calcCycleBalance: (count, lastAppear, total, marketMode = { type: 'normal' }) => {
    const scores = {};
    const avgCount = total / 12;

    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => {
      const zodCount = count[z] || 0;
      const miss = lastAppear[z] === -1 ? total : lastAppear[z];
      const state = BusinessSpecial._getCycleState(zodCount, miss, total);

      let score = 0;
      switch(state) {
        case '大热肖':
          score = -10;
          break;
        case '温态肖':
          score = 5;
          break;
        case '偏冷肖':
          score = 10;
          break;
        case '极冷肖':
          score = 15;
          break;
      }

      if(marketMode.type === '冷热交替') {
        score *= 1.25;
      }

      scores[z] = score;
    });

    return scores;
  },

  _calcFreqBase: (count, list, total) => {
    const scores = {};
    const recent30 = list.slice(0, Math.min(30, list.length));
    const recentCount = {};
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => recentCount[z] = 0);

    recent30.forEach(item => {
      const s = DataQuery.getSpecial(item);
      if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod)) {
        recentCount[s.zod]++;
      }
    });

    const maxTotalCount = Math.max(...Object.values(count), 1);
    const maxRecentCount = Math.max(...Object.values(recentCount), 1);

    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => {
      const longTermScore = (count[z] / maxTotalCount) * 50;
      const shortTermScore = (recentCount[z] / maxRecentCount) * 50;
      scores[z] = longTermScore * 0.6 + shortTermScore * 0.4;
    });

    return scores;
  },

  _getCycleState: (count, miss, total) => {
    const avgCount = total / 12;
    const actualMiss = miss === -1 ? total : miss;

    if(count >= avgCount * 1.5 && actualMiss <= 3) return '大热肖';
    if(count >= avgCount * 0.8 && count < avgCount * 1.5) return '温态肖';
    if(count < avgCount * 0.8 || actualMiss >= 8) return '偏冷肖';
    if(actualMiss >= 15) return '极冷肖';
    return '温态肖';
  },

  renderSelectedZodiacs: () => {
    const data = BusinessSpecial.calcSelectedZodiacs();
    if(!data) return null;
    return data;
  },

  showSelectedZodiacDetail: (zodiac, index) => {
    const data = BusinessSpecial.calcSelectedZodiacs();
    if(!data) return null;

    const item = data.allZodiacs[parseInt(index)];
    if(!item || item.zodiac !== zodiac) return null;

    const numbers = DataQuery.getZodiacNumbers(zodiac);
    const numStr = numbers.map(n => String(n).padStart(2, '0')).join('、');

    const marketModeText = {
      'normal': '正常行情',
      '冷热交替': '冷热交替',
      '持续热肖': '持续热肖',
      '持续冷肖': '持续冷肖',
      '震荡轮转': '震荡轮转'
    };

    return {
      zodiac: zodiac,
      totalScore: item.totalScore,
      count: item.count,
      miss: item.miss,
      cycleState: item.cycleState,
      marketMode: marketModeText[item.marketMode] || item.marketMode,
      windowSignal: item.windowSignal,
      baseScore: item.baseScore,
      hotInertia: item.hotInertia,
      missRepair: item.missRepair,
      cycleBalance: item.cycleBalance,
      patternScore: item.patternScore,
      numbers: numStr
    };
  },

  saveSpecialToHistory: (numbers) => {
    const state = StateManager._state;
    const historyData = state.analysis.historyData;
    const analyzeLimit = state.analysis.analyzeLimit || 10;
    
    let latestExpect = null;
    let predictExpect = null;
    if(historyData.length > 0) {
      latestExpect = historyData[0].expect;
      predictExpect = String(Number(latestExpect) + 1);
    }
    
    let selectedPeriodText = '';
    if(analyzeLimit === 'all' || analyzeLimit >= 365) {
      selectedPeriodText = '全年数据';
    } else {
      selectedPeriodText = `${analyzeLimit}期数据`;
    }
    
    const historyItem = {
      id: Date.now(),
      timestamp: Date.now(),
      mode: 'unknown',
      numbers: numbers,
      numCount: numbers.length,
      analyzeLimit: analyzeLimit,
      selectedPeriod: analyzeLimit,
      selectedPeriodText: selectedPeriodText,
      latestExpect: latestExpect,
      expect: predictExpect,
      predictExpect: predictExpect,
      drawResult: null,
      hitNumbers: [],
      hitCount: 0
    };
    
    const isDuplicate = state.specialHistory.some(item => 
      item.numbers && 
      item.numbers.length === numbers.length && 
      item.numbers.every((n, i) => n === numbers[i]) &&
      item.analyzeLimit === analyzeLimit
    );
    
    if(isDuplicate) return;
    
    const newHistory = [historyItem, ...state.specialHistory];
    
    if(newHistory.length > Storage.SPECIAL_HISTORY_MAX_COUNT) {
      newHistory.length = Storage.SPECIAL_HISTORY_MAX_COUNT;
    }
    
    StateManager.setState({ specialHistory: newHistory }, false);
    Storage.saveSpecialHistory(newHistory);
  },

  updateSpecialHistoryComparison: () => {
    const state = StateManager._state;
    const historyData = state.analysis.historyData;
    const specialHistory = state.specialHistory;
    
    if(historyData.length === 0 || specialHistory.length === 0) return;
    
    let updated = false;
    const newHistory = specialHistory.map(item => {
      if(item.drawResult !== null) return item;
      
      if(item.predictExpect) {
        const drawItem = historyData.find(d => d.expect === item.predictExpect);
        
        if(drawItem) {
          const special = DataQuery.getSpecial(drawItem);
          const drawNumber = special.te;
          
          const hitNumbers = item.numbers.filter(n => n === drawNumber);
          
          updated = true;
          return {
            ...item,
            drawResult: drawNumber,
            drawExpect: drawItem.expect,
            hitNumbers: hitNumbers,
            hitCount: hitNumbers.length
          };
        }
      }
      return item;
    });
    
    if(updated) {
      StateManager.setState({ specialHistory: newHistory }, false);
      Storage.saveSpecialHistory(newHistory);
    }
  },

  favoriteZodiacNumbers: (numbers) => {
    if(!numbers || numbers.length === 0) {
      return { success: false, error: 'empty' };
    }
    
    BusinessSpecial.saveSpecialToHistory(numbers);
    
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${month}/${day}`;
    
    const state = StateManager._state;
    const analyzeLimit = state.analysis.analyzeLimit || 10;
    const periodText = analyzeLimit >= 365 ? '全年' : `${analyzeLimit}期`;
    
    const filterName = `特/${dateStr}/${periodText}`;
    const filterItem = {
      name: filterName,
      selected: {},
      excluded: [],
      numbers: numbers
    };
    
    const isFavorited = state.favorites.some(fav => 
      fav.numbers && 
      fav.numbers.length === numbers.length && 
      fav.numbers.every((n, i) => n === numbers[i])
    );
    
    if(isFavorited) {
      return { success: false, error: 'already_favorited' };
    }
    
    const newFavorites = [...state.favorites, filterItem];
    StateManager.setState({ favorites: newFavorites }, false);
    Storage.set('favorites', newFavorites);
    
    setTimeout(() => {
      BusinessAnalysis.saveAnalysisToRecord();
    }, 300);
    
    return { success: true, filterName };
  },

  switchSpecialHistoryMode: (mode) => {
    if(!['all', 'hot', 'cold'].includes(mode)) return;
    StateManager.setState({ specialHistoryModeFilter: mode }, false);
  },

  loadFavorite: (index) => {
    const state = StateManager._state;
    const item = state.favorites[index];
    if(!item) return null;

    if(item.numbers && Array.isArray(item.numbers)) {
      StateManager.setState({
        selected: StateManager.getEmptySelected(),
        excluded: []
      });
      return { success: true, type: 'numbers' };
    } else {
      StateManager.setState({
        selected: Utils.deepClone(item.selected),
        excluded: Utils.deepClone(item.excluded)
      });
      return { success: true, type: 'filter' };
    }
  },

  renameFavorite: (index) => {
    const state = StateManager._state;
    const item = state.favorites[index];
    if(!item) return null;

    return {
      index,
      originalName: item.name
    };
  },

  copyFavorite: (index) => {
    const state = StateManager._state;
    const item = state.favorites[index];
    if(!item) return null;

    let list;
    if(item.numbers && Array.isArray(item.numbers)) {
      list = item.numbers.map(num => DataQuery.getNumAttrs(num));
    } else {
      list = Filter.getFilteredList(item.selected, item.excluded);
    }
    
    if(list.length === 0){
      return { success: false, error: 'empty' };
    }

    const numStr = list.map(n => n.s).join(' ');
    return { success: true, numStr };
  },

  clearAllFavorites: () => {
    return true;
  },

  removeFavorite: (index) => {
    const state = StateManager._state;
    const newList = [...state.favorites];
    if(index < 0 || index >= newList.length) return null;
    
    const removed = newList.splice(index, 1);
    StateManager.setState({ favorites: newList }, false);
    Storage.set('favorites', newList);
    return { success: true, removed };
  },

  toggleSpecialHistory: () => {
    try {
      const state = StateManager._state;
      const newExpanded = !state.specialHistoryExpanded;
      StateManager.setState({ specialHistoryExpanded: newExpanded }, false);
      return newExpanded;
    } catch(e) {
      Logger.error('切换精选特码历史展开状态失败', e);
      return null;
    }
  },

  clearSpecialHistory: () => {
    return true;
  },

  selectAllSpecialFilters: () => {
    return {
      periods: ['10', '20', '30', 'all'],
      nums: ['5', '10', '15', '20']
    };
  },

  resetSpecialFilters: () => {
    return {
      period: '10',
      num: '5'
    };
  },

  confirmSpecialFilters: () => {
    return true;
  },

  toggleSpecialFiltersPanel: () => {
    return true;
  },

  togglePanel: (panelId, errorMsg) => {
    return { panelId, errorMsg };
  },

  clearZodiacPredictionHistory: () => {
    return true;
  },

  selectAllPredictionPeriods: () => {
    return ['10', '20', '30', 'all'];
  },

  resetPredictionPeriods: () => {
    return '10';
  },

  togglePredictionFiltersPanel: () => {
    return true;
  },

  confirmPredictionFilters: () => {
    return true;
  },

  toggleZodiacPredictionHistory: () => {
    return true;
  },

  copyToClipboard: (text) => {
    if(navigator.clipboard && navigator.clipboard.writeText){
      return { success: true, text };
    } else {
      return { success: false, text };
    }
  },

  extractNumbersFromBalls: () => {
    return null;
  },

  copyHotNumbers: (nums) => {
    if(!nums) return null;
    return { success: true, nums };
  },

  copyZodiacNumbers: (numbers) => {
    if(!numbers) return null;
    return { success: true, numbers };
  }
};
