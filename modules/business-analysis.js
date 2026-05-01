/**
 * 分析计算业务模块
 * @description 处理数据分析计算，包含多维度热号计算、完整分析、生肖分析等
 */
const BusinessAnalysis = {
  calcMultiDimensionalHotNums: (list, numCount, lastAppear, zodiac, hotData, targetCount = 5) => {
    const total = list.length;
    
    const top6Zodiacs = Object.entries(zodiac)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(item => item[0]);
    
    const numFullAttrs = new Map();
    for(let num = 1; num <= 49; num++) {
      const attrs = DataQuery.getNumAttrs(num);
      numFullAttrs.set(num, attrs);
    }
    
    const historyNumMap = new Map();
    list.forEach(item => {
      const s = DataQuery.getSpecial(item);
      if(s.te >= 1 && s.te <= 49) {
        historyNumMap.set(s.te, (historyNumMap.get(s.te) || 0) + 1);
      }
    });
    
    const candidateNums = [];
    for(let num = 1; num <= 49; num++) {
      const attrs = numFullAttrs.get(num);
      if(top6Zodiacs.includes(attrs.zodiac)) {
        const numStr = String(num).padStart(2, '0');
        const count = numCount[numStr] || 0;
        const miss = lastAppear[num] === -1 ? total : lastAppear[num];
        
        let score = 0;
        
        const maxCount = Math.max(...Object.values(numCount));
        const freqScore = maxCount > 0 ? (count / maxCount) * 100 : 0;
        score += freqScore * 0.25;
        
        let recentCount = 0;
        const recentList = list.slice(0, Math.min(10, list.length));
        recentList.forEach(item => {
          const s = DataQuery.getSpecial(item);
          if(s.te === num) recentCount++;
        });
        const recentScore = recentList.length > 0 ? (recentCount / recentList.length) * 100 : 0;
        score += recentScore * 0.20;
        
        let missScore = 0;
        if(miss >= 1 && miss <= 3) {
          missScore = 80;
        } else if(miss >= 4 && miss <= 8) {
          missScore = 100;
        } else if(miss >= 9 && miss <= 15) {
          missScore = 60;
        } else {
          missScore = 30;
        }
        score += missScore * 0.15;
        
        if(attrs.odd === hotData.hotSD) score += 100 * 0.10;
        if(attrs.big === hotData.hotBS) score += 100 * 0.10;
        if(attrs.color === hotData.hotColor) score += 100 * 0.05;
        if(attrs.element === hotData.hotWx) score += 100 * 0.05;
        if(String(attrs.head) === String(hotData.hotHead)) score += 100 * 0.05;
        if(String(attrs.tail) === String(hotData.hotTail)) score += 100 * 0.05;
        
        candidateNums.push({
          num: num,
          numStr: numStr,
          score: score,
          zodiac: attrs.zodiac,
          zodiacRank: top6Zodiacs.indexOf(attrs.zodiac)
        });
      }
    }
    
    const hotNums = [];
    const warmNums = [];
    const coldNums = [];
    
    candidateNums.forEach(item => {
      const miss = lastAppear[item.num] === -1 ? total : lastAppear[item.num];
      if(miss <= 3) {
        hotNums.push(item);
      } else if(miss <= 9) {
        warmNums.push(item);
      } else {
        coldNums.push(item);
      }
    });
    
    hotNums.sort((a, b) => b.score - a.score);
    warmNums.sort((a, b) => b.score - a.score);
    coldNums.sort((a, b) => b.score - a.score);
    
    const finalNums = [];
    const hotRatio = targetCount === 5 ? 2 : 4;
    const warmRatio = targetCount === 5 ? 2 : 4;
    const coldRatio = targetCount === 5 ? 1 : 2;
    
    finalNums.push(...hotNums.slice(0, hotRatio));
    finalNums.push(...warmNums.slice(0, warmRatio));
    finalNums.push(...coldNums.slice(0, coldRatio));
    
    if(finalNums.length < targetCount) {
      const remaining = candidateNums
        .filter(n => !finalNums.find(f => f.num === n.num))
        .slice(0, targetCount - finalNums.length);
      finalNums.push(...remaining);
    }
    
    finalNums.sort((a, b) => b.score - a.score);
    const result = finalNums.slice(0, targetCount).map(item => item.numStr);
    
    return result.join(' ');
  },

  calcFullAnalysis: () => {
    const state = StateManager._state;
    const { historyData, analyzeLimit } = state.analysis;
    if(!historyData.length) return null;

    const list = historyData.slice(0, Math.min(analyzeLimit, historyData.length));
    const total = list.length;

    const singleDouble = { '单': 0, '双': 0 };
    const bigSmall = { '大': 0, '小': 0 };
    const range = { '1-9': 0, '10-19': 0, '20-29': 0, '30-39': 0, '40-49': 0 };
    const head = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    const tail = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    const color = { '红': 0, '蓝': 0, '绿': 0 };
    const wuxing = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
    const animal = { '家禽': 0, '野兽': 0 };
    const zodiac = {};
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => zodiac[z] = 0);
    const numCount = {};
    for(let i = 1; i <= 49; i++) numCount[String(i).padStart(2, '0')] = 0;
    const lastAppear = {};
    for(let i = 1; i <= 49; i++) lastAppear[i] = -1;

    list.forEach((item, idx) => {
      const s = DataQuery.getSpecial(item);
      s.odd ? singleDouble['单']++ : singleDouble['双']++;
      s.big ? bigSmall['大']++ : bigSmall['小']++;
      s.te <= 9 ? range['1-9']++ : s.te <= 19 ? range['10-19']++ : s.te <= 29 ? range['20-29']++ : s.te <= 39 ? range['30-39']++ : range['40-49']++;
      head[s.head]++;
      tail[s.tail]++;
      color[s.colorName]++;
      wuxing[s.wuxing]++;
      animal[s.animal]++;
      if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod)) zodiac[s.zod]++;
      numCount[String(s.te).padStart(2, '0')]++;
      if(lastAppear[s.te] === -1) lastAppear[s.te] = idx;
    });

    let totalMissSum = 0, maxMiss = 0, hot = 0, warm = 0, cold = 0;
    const allMiss = [];
    for(let m = 1; m <= 49; m++) {
      const p = lastAppear[m];
      const currentMiss = p === -1 ? total : p;
      allMiss.push(currentMiss);
      totalMissSum += currentMiss;
      if(currentMiss > maxMiss) maxMiss = currentMiss;
      if(currentMiss <= 3) hot++;
      else if(currentMiss <= 9) warm++;
      else cold++;
    }
    const avgMiss = (totalMissSum / 49).toFixed(1);
    const curMaxMiss = Math.max(...allMiss);

    let curStreak = 1, maxStreak = 1, current = 1;
    if(list.length >= 2) {
      const firstShape = `${DataQuery.getSpecial(list[0]).odd}_${DataQuery.getSpecial(list[0]).big}`;
      for(let i = 1; i < list.length; i++) {
        const s = DataQuery.getSpecial(list[i]);
        const shape = `${s.odd}_${s.big}`;
        if(shape === firstShape) curStreak++;
        else break;
      }
      let prevShape = `${DataQuery.getSpecial(list[0]).odd}_${DataQuery.getSpecial(list[0]).big}`;
      for(let i = 1; i < list.length; i++) {
        const s = DataQuery.getSpecial(list[i]);
        const shape = `${s.odd}_${s.big}`;
        if(shape === prevShape) {
          current++;
          if(current > maxStreak) maxStreak = current;
        } else {
          current = 1;
          prevShape = shape;
        }
      }
    }

    const hotSD = Object.entries(singleDouble).sort((a, b) => b[1] - a[1])[0];
    const hotBS = Object.entries(bigSmall).sort((a, b) => b[1] - a[1])[0];
    const hotHead = Object.entries(head).sort((a, b) => b[1] - a[1])[0];
    const hotTail = Object.entries(tail).sort((a, b) => b[1] - a[1])[0];
    const hotColor = Object.entries(color).sort((a, b) => b[1] - a[1])[0];
    const hotWx = Object.entries(wuxing).sort((a, b) => b[1] - a[1])[0];
    const hotZod = Object.entries(zodiac).sort((a, b) => b[1] - a[1]).slice(0, 3).map(i => i[0]).join('、');
    const hotAni = Object.entries(animal).sort((a, b) => b[1] - a[1])[0];
    
    const hotNum = BusinessAnalysis.calcMultiDimensionalHotNums(list, numCount, lastAppear, zodiac, {
      hotSD: hotSD[0],
      hotBS: hotBS[0],
      hotHead: hotHead[0],
      hotTail: hotTail[0],
      hotColor: hotColor[0],
      hotWx: hotWx[0],
      hotZodiacs: Object.entries(zodiac).sort((a, b) => b[1] - a[1]).slice(0, 3).map(i => i[0])
    }, 5);

    return {
      total, singleDouble, bigSmall, range, head, tail, color, wuxing, animal, zodiac, numCount,
      hotSD, hotBS, hotHead, hotTail, hotColor, hotWx, hotZod, hotAni, hotNum,
      miss: { curMaxMiss, avgMiss, maxMiss, hot, warm, cold },
      streak: { curStreak, maxStreak }
    };
  },

  calcZodiacAnalysis: (customLimit) => {
    const state = StateManager._state;
    const { historyData, analyzeLimit, selectedNumCount } = state.analysis;
    if(!historyData.length) return null;
    if(historyData.length < 2) {
      console.log('历史数据不足2期，仅使用', historyData.length, '期进行简单计算');
    }

    const limit = customLimit || analyzeLimit;
    const list = historyData.slice(0, Math.min(limit, historyData.length));
    const total = list.length;
    const avgExpect = total / 12;

    const zodCount = {};
    const lastAppear = {};
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => { zodCount[z] = 0; lastAppear[z] = -1; });
    const tailZodMap = {};
    for(let t = 0; t <= 9; t++) tailZodMap[t] = {};
    const followMap = {};

    list.forEach((item, idx) => {
      const s = DataQuery.getSpecial(item);
      if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod)) {
        zodCount[s.zod]++;
        if(lastAppear[s.zod] === -1) lastAppear[s.zod] = idx;
      }
      if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod)) {
        tailZodMap[s.tail][s.zod] = (tailZodMap[s.tail][s.zod] || 0) + 1;
      }
    });

    if(list.length >= 2) {
      for (let i = 1; i < list.length; i++) {
        const preZod = DataQuery.getSpecial(list[i-1]).zod;
        const curZod = DataQuery.getSpecial(list[i]).zod;
        if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(preZod) && CONFIG.ANALYSIS.ZODIAC_ALL.includes(curZod)) {
          if(!followMap[preZod]) followMap[preZod] = {};
          followMap[preZod][curZod] = (followMap[preZod][curZod] || 0) + 1;
        }
      }
    }

    const zodMiss = {};
    const zodAvgMiss = {};
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => {
      zodMiss[z] = lastAppear[z] === -1 ? total : lastAppear[z];
      zodAvgMiss[z] = zodCount[z] > 0 ? (total / zodCount[z]).toFixed(1) : total;
    });

    const topZod = Object.entries(zodCount).sort((a, b) => b[1] - a[1]);
    const topTail = Array.from({ length: 10 }, (_, t) => ({
      t, sum: Object.values(tailZodMap[t]).reduce((a, b) => a + b, 0)
    })).sort((a, b) => b.sum - a.sum);

    const zodiacScores = {};
    const zodiacDetails = {};

    const hotZodiacs = topZod.slice(0, 3).map(z => z[0]);
    
    let maxMiss = 0;
    Object.values(zodMiss).forEach(m => { if(m > maxMiss) maxMiss = m; });

    const zodiacOrder = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
    const intervalStats = {};
    for(let i = 0; i < 12; i++) intervalStats[i] = 0;
    
    let commonIntervals = [];
    if(list.length >= 2) {
      for (let i = 1; i < list.length && i < 30; i++) {
        const preZod = DataQuery.getSpecial(list[i-1]).zod;
        const curZod = DataQuery.getSpecial(list[i]).zod;
        const preIdx = zodiacOrder.indexOf(preZod);
        const curIdx = zodiacOrder.indexOf(curZod);
        if(preIdx !== -1 && curIdx !== -1) {
          let diff = curIdx - preIdx;
          if(diff > 6) diff -= 12;
          if(diff < -6) diff += 12;
          intervalStats[diff + 6]++;
        }
      }
      commonIntervals = Object.entries(intervalStats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => parseInt(x[0]) - 6);
    }

    const lastZod = list.length > 0 ? DataQuery.getSpecial(list[0]).zod : '';
    
    const elementGenerate = {
      '金': ['水'],
      '水': ['木'],
      '木': ['火'],
      '火': ['土'],
      '土': ['金']
    };

    const zodiacElement = {
      '鼠': '水', '牛': '土', '虎': '木', '兔': '木',
      '龙': '土', '蛇': '火', '马': '火', '羊': '土',
      '猴': '金', '鸡': '金', '狗': '土', '猪': '水'
    };

    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(zod => {
      let score = 0;
      const details = { cold: 0, hot: 0, shape: 0, interval: 0 };

      const missValue = zodMiss[zod] || 0;
      if(maxMiss > 0 && missValue >= maxMiss * 0.8) {
        details.cold = 30;
        score += 30;
      } else if(missValue >= 24) {
        details.cold = 20;
        score += 20;
      } else if(missValue >= 12) {
        details.cold = 10;
        score += 10;
      }

      if(hotZodiacs.includes(zod)) {
        details.hot = 20;
        score += 20;
      }

      if(lastZod && zodiacElement[lastZod] && zodiacElement[zod]) {
        const lastElement = zodiacElement[lastZod];
        const currentElement = zodiacElement[zod];
        if(elementGenerate[lastElement] && elementGenerate[lastElement].includes(currentElement)) {
          details.shape = 15;
          score += 15;
        }
      }

      if(lastZod) {
        const lastIdx = zodiacOrder.indexOf(lastZod);
        const currentIdx = zodiacOrder.indexOf(zod);
        if(lastIdx !== -1 && currentIdx !== -1) {
          let diff = currentIdx - lastIdx;
          if(diff > 6) diff -= 12;
          if(diff < -6) diff += 12;
          if(commonIntervals.includes(diff)) {
            details.interval = 20;
            score += 20;
          }
        }
      }

      zodiacScores[zod] = score;
      zodiacDetails[zod] = details;
    });

    const sortedZodiacs = Object.entries(zodiacScores).sort((a, b) => b[1] - a[1]);

    // 计算最终号码
    const fullNumZodiacMap = new Map();
    for(let num = 1; num <= 49; num++) {
      const zod = DataQuery._getZodiacByNum(num);
      if(zod) fullNumZodiacMap.set(num, zod);
    }

    const coreZodiacs = sortedZodiacs.slice(0, 4).map(i => i[0]);
    const hotTails = topTail.slice(0, 3).map(i => i.t);

    const candidateNums = [];
    for(let num = 1; num <= 49; num++) {
      const zod = fullNumZodiacMap.get(num);
      const tail = num % 10;
      if(coreZodiacs.includes(zod) && hotTails.includes(tail)) {
        const miss = zodMiss[zod] || 0;
        const count = zodCount[zod] || 0;
        const zodScore = zodiacScores[zod] || 0;
        candidateNums.push({
          num,
          weight: count * 10 + (10 - miss) + zodScore * 2
        });
      }
    }

    const targetCount = selectedNumCount || 10;
    candidateNums.sort((a, b) => b.weight - a.weight);
    let finalNums = candidateNums.slice(0, targetCount).map(i => i.num);

    if(finalNums.length < targetCount) {
      const fillNums = [...new Set(list.map(item => DataQuery.getSpecial(item).te))]
        .filter(num => !finalNums.includes(num))
        .slice(0, targetCount - finalNums.length);
      finalNums.push(...fillNums);
    }

    finalNums.sort((a, b) => a - b);

    return { 
      list, total, avgExpect, zodCount, zodMiss, zodAvgMiss, tailZodMap, followMap, topZod, topTail,
      zodiacScores, zodiacDetails, sortedZodiacs, sortedFinalNums: finalNums
    };
  },

  syncAnalyze: (custom, selectVal) => {
    const historyData = StateManager._state.analysis.historyData;
    
    const newLimit = custom && !isNaN(custom) && custom > 0
      ? Number(custom)
      : selectVal === 'all' ? historyData.length : Number(selectVal);
    
    const newAnalysis = { 
      ...StateManager._state.analysis, 
      analyzeLimit: newLimit 
    };
    StateManager.setState({ analysis: newAnalysis }, false);
    
    AnalysisView.syncAnalyzeInputs(selectVal, custom);
    AnalysisView.renderFullAnalysis();
    AnalysisView.renderZodiacAnalysis();
    
    setTimeout(() => {
      BusinessAnalysis.saveAnalysisToRecord();
    }, 500);
  },

  syncZodiacAnalyze: (customPeriod, selectPeriodVal, countVal, customCount) => {
    const historyData = StateManager._state.analysis.historyData;
    
    const newLimit = customPeriod && !isNaN(customPeriod) && customPeriod > 0
      ? Number(customPeriod)
      : selectPeriodVal === 'all' ? historyData.length : Number(selectPeriodVal);
    
    let finalCount = 5;
    
    if(countVal === 'custom') {
      finalCount = customCount && !isNaN(customCount) && Number(customCount) >= 1 && Number(customCount) <= 49
        ? Number(customCount)
        : 5;
    } else {
      finalCount = Number(countVal);
    }
    
    const newAnalysis = { 
      ...StateManager._state.analysis, 
      analyzeLimit: newLimit,
      selectedNumCount: finalCount
    };
    StateManager.setState({ analysis: newAnalysis }, false);
    
    AnalysisView.syncZodiacInputs(selectPeriodVal, customPeriod, countVal, customCount);
    AnalysisView.renderFullAnalysis();
    AnalysisView.renderZodiacAnalysis();
    
    setTimeout(() => {
      BusinessAnalysis.saveAnalysisToRecord();
    }, 500);
  },

  refreshHistory: async () => {
    AnalysisView.showHistoryLoading();
    
    try {
      const year = new Date().getFullYear();
      const res = await fetch(CONFIG.API.HISTORY + year);
      const data = await res.json();
      let rawData = data.data || [];

      rawData = rawData.filter(item => {
        const expect = item.expect || '';
        const openCode = item.openCode || '';
        return expect && openCode && openCode.split(',').length === 7;
      });

      const uniqueMap = new Map();
      rawData.forEach(item => {
        const expectNum = Number(item.expect || 0);
        if(expectNum && !isNaN(expectNum)) {
          uniqueMap.set(expectNum, item);
        }
      });

      const sortedData = Array.from(uniqueMap.values()).sort((a, b) => {
        return Number(b.expect || 0) - Number(a.expect || 0);
      });

      const newAnalysis = { ...StateManager._state.analysis, historyData: sortedData };
      StateManager.setState({ analysis: newAnalysis }, false);
      
      // 保存数据到本地缓存
      Storage.saveHistoryCache(sortedData);
      console.log('历史数据已保存到本地缓存，共', sortedData.length, '条');

      AnalysisView.renderLatest(sortedData[0]);
      AnalysisView.renderHistory();
      AnalysisView.renderFullAnalysis();
      AnalysisView.renderZodiacAnalysis();
      AnalysisView.showLoadMoreButton();
      
      setTimeout(() => {
        BusinessAnalysis.saveAnalysisToRecord();
      }, 500);
      
      Toast.show('数据加载成功');
    } catch(e) {
      console.error('加载历史数据失败', e);
      AnalysisView.showHistoryError();
      Toast.show('数据加载失败');
    }
  },

  _lastSaveTime: 0,
  _lastSaveHash: '',

  saveAnalysisToRecord: () => {
    try {
      const now = Date.now();
      if(now - BusinessAnalysis._lastSaveTime < 1000) {
        console.log('保存间隔太短，跳过');
        return;
      }

      const state = StateManager._state;
      const historyData = state.analysis.historyData;
      
      if (!historyData || historyData.length === 0) {
        return;
      }
      
      const latestExpect = historyData[0]?.expect || null;
      
      // 从业务计算结果获取数据，不使用 DOM 查询
      const selectedZodiacs = [];
      const specialData = BusinessSpecial.calcSelectedZodiacs();
      if(specialData && specialData.selectedZodiacs) {
        specialData.selectedZodiacs.forEach(item => {
          selectedZodiacs.push(item.zodiac);
        });
      }
      
      // 从 calcZodiacAnalysis 获取数据
      const zodiacData = BusinessAnalysis.calcZodiacAnalysis();
      const zodiacPrediction = zodiacData && zodiacData.sortedZodiacs ? zodiacData.sortedZodiacs.map(([zodiac, score]) => ({
        zodiac: zodiac,
        score: score
      })) : [];
      
      // 从 calcZodiacAnalysis 获取最终号码
      const specialNumbers = zodiacData && zodiacData.sortedFinalNums ? zodiacData.sortedFinalNums : [];
      
      // 从 calcFullAnalysis 获取热门号码
      const fullData = BusinessAnalysis.calcFullAnalysis();
      const hotNumbers = fullData && fullData.hotNum 
        ? (typeof fullData.hotNum === 'string' 
            ? fullData.hotNum.split(/[、,，\s]+/).map(n => parseInt(n)).filter(n => !isNaN(n))
            : Array.isArray(fullData.hotNum) 
              ? fullData.hotNum 
              : [])
        : [];
      
      const analyzeLimit = state.analysis.analyzeLimit || 10;
      
      const recordData = {
        expect: latestExpect,
        zodiacPrediction: zodiacPrediction,
        selectedZodiacs: selectedZodiacs,
        specialNumbers: specialNumbers,
        hotNumbers: hotNumbers,
        analyzeLimit: analyzeLimit
      };

      const dataHash = JSON.stringify({
        expect: latestExpect,
        zodiacs: selectedZodiacs,
        special: specialNumbers,
        hot: hotNumbers,
        limit: analyzeLimit
      });

      if(dataHash === BusinessAnalysis._lastSaveHash) {
        console.log('数据未变化，跳过保存');
        return;
      }
      BusinessAnalysis._lastSaveHash = dataHash;
      BusinessAnalysis._lastSaveTime = now;
      
      Storage.saveRecordHistory(recordData);
      console.log('分析数据已保存到记录');
      RecordView.renderRecordList();
    } catch (e) {
      console.error('保存分析数据到记录失败', e);
    }
  },

  filterRecords: (filterParams) => {
    const state = StateManager._state;
    let currentFilter = {};

    if (filterParams) {
      const groupToFilterType = {
        'zodiac': 'zodiac',
        'color': 'waveColor',
        'colorsx': 'waveColorOddEven',
        'type': 'animalType',
        'element': 'fiveElements',
        'head': 'headNumber',
        'tail': 'tailNumber',
        'sum': 'tailSum',
        'bs': 'sizeOddEven',
        'hot': 'hotCold'
      };

      for (const [group, values] of Object.entries(filterParams)) {
        if (Array.isArray(values) && values.length > 0) {
          const filterType = groupToFilterType[group];
          if (filterType) {
            currentFilter[filterType] = values;
          }
        } else if (values && typeof values === 'string') {
          const filterType = groupToFilterType[group];
          if (filterType) {
            currentFilter[filterType] = values;
          }
        }
      }

      if (filterParams.excludeNumber && Array.isArray(filterParams.excludeNumber)) {
        currentFilter.excludeNumber = filterParams.excludeNumber;
      }
    }

    const resultEl = document.querySelector('.filter-result');
    if (resultEl) {
      const list = Filter.getFilteredList();
      resultEl.textContent = `筛选结果：${list.length} 条`;
    }

    return currentFilter;
  },

  silentUpdateAllPredictionHistory: () => {
    try {
      const state = StateManager._state;
      const historyData = state.analysis.historyData || [];
      
      if(historyData.length === 0) return;
      
      const periodsToUpdate = [10, 20, 30];
      
      periodsToUpdate.forEach(period => {
        const originalLimit = state.analysis.analyzeLimit;
        
        try {
          const newAnalysis = { ...state.analysis, analyzeLimit: period };
          StateManager.setState({ analysis: newAnalysis }, false);
          
          const data = BusinessAnalysis.calcZodiacAnalysis();
          
          if(data && data.sortedZodiacs && data.zodiacDetails) {
            Storage.saveZodiacPredictionHistory(data.sortedZodiacs, data.zodiacDetails);
          }
        } finally {
          const restoreAnalysis = { ...state.analysis, analyzeLimit: originalLimit };
          StateManager.setState({ analysis: restoreAnalysis }, false);
        }
      });
      
      AnalysisView.renderZodiacPredictionHistory();
    } catch(e) {
      console.error('静默更新预测历史失败', e);
    }
  },

  silentSaveAllSpecialCombinations: () => {
    try {
      const state = StateManager._state;
      const historyData = state.analysis.historyData;
      
      if(!historyData || historyData.length < 2) return;
      
      let latestExpect = null;
      let predictExpect = null;
      if(historyData.length > 0) {
        latestExpect = historyData[0].expect;
        predictExpect = String(Number(latestExpect) + 1);
      }
      
      const periodConfigs = [
        { limit: 10, text: '10期数据' },
        { limit: 20, text: '20期数据' },
        { limit: 30, text: '30期数据' },
        { limit: historyData.length, text: '全年数据' }
      ];
      
      const numCounts = [5, 10, 15, 20];
      const modes = ['hot', 'cold'];
      
      let currentHistory = [...state.specialHistory];
      let hasUpdates = false;
      
      const fullNumZodiacMap = new Map();
      for(let num = 1; num <= 49; num++) {
        const zod = DataQuery._getZodiacByNum(num);
        if(zod) fullNumZodiacMap.set(num, zod);
      }
      
      periodConfigs.forEach(periodConfig => {
        const data = BusinessAnalysis.calcZodiacAnalysis(periodConfig.limit);
        
        if(!data || !data.sortedZodiacs || data.sortedZodiacs.length === 0) return;
        
        modes.forEach(mode => {
          numCounts.forEach(numCount => {
            let finalNums = [];
            
            if(mode === 'cold') {
              finalNums = Utils.getColdReboundNumbers(data, numCount, fullNumZodiacMap);
            } else {
              finalNums = Utils.getHotNumbers(data, numCount, fullNumZodiacMap);
            }
            
            finalNums.sort((a, b) => a - b);
            
            const exists = currentHistory.some(item => 
              item.expect === predictExpect && 
              item.analyzeLimit === periodConfig.limit && 
              item.numCount === numCount &&
              item.mode === mode
            );
            
            if(exists) return;
            
            const isDuplicate = currentHistory.some(item => 
              item.numbers && 
              item.numbers.length === numCount && 
              item.numbers.every((n, i) => n === finalNums[i]) &&
              item.analyzeLimit === periodConfig.limit &&
              item.mode === mode
            );
            
            if(isDuplicate) return;
            
            const historyItem = {
              id: Date.now() + Math.random(),
              timestamp: Date.now(),
              numbers: finalNums,
              numCount: numCount,
              analyzeLimit: periodConfig.limit,
              selectedPeriod: periodConfig.limit,
              selectedPeriodText: periodConfig.text,
              latestExpect: latestExpect,
              expect: predictExpect,
              predictExpect: predictExpect,
              drawResult: null,
              hitNumbers: [],
              hitCount: 0,
              mode: mode
            };
            
            currentHistory.unshift(historyItem);
            hasUpdates = true;
          });
        });
      });
      
      if(currentHistory.length > Storage.SPECIAL_HISTORY_MAX_COUNT) {
        currentHistory.length = Storage.SPECIAL_HISTORY_MAX_COUNT;
      }
      
      if(hasUpdates) {
        StateManager.setState({ specialHistory: currentHistory }, false);
        Storage.saveSpecialHistory(currentHistory);
        AnalysisView.renderSpecialHistory();
      }
    } catch(e) {
      console.error('静默保存所有组合失败', e);
    }
  }
};
