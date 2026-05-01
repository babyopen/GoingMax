/**
 * 分析页面视图
 * @description 分析页面的渲染逻辑，包含最新开奖、历史记录、完整分析、生肖分析等
 */
const AnalysisView = {
  init: () => {
    const state = StateManager._state;
    if(state.analysis.historyData.length === 0) {
      Business.refreshHistory();
    }
    Business.startCountdown();
    Business.startAutoRefresh();
    PredictView.renderSpecialHistory();
    PredictView.renderZodiacPredictionHistory();
    PredictView.renderSmartHistory();
    AnalysisView.updateZodiacPredictionPeriod();
    AnalysisView.updateSelectedZodiacPeriod();
  },

  showHistoryLoading: () => {
    const historyList = document.getElementById('historyList');
    if(historyList) historyList.innerHTML = '<div style="padding:20px;text-align:center;">加载中...</div>';
  },

  showHistoryError: () => {
    const historyList = document.getElementById('historyList');
    if(historyList) {
      historyList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--danger);">数据加载失败，请刷新重试</div>';
    }
  },

  showLoadMoreButton: () => {
    const loadMore = document.getElementById('loadMore');
    if(loadMore) {
      loadMore.style.display = StateManager._state.analysis.historyData.length > StateManager._state.analysis.showCount ? 'block' : 'none';
    }
  },

  syncAnalyzeInputs: (selectVal, custom) => {
    const analyzeSelect = document.getElementById('analyzeSelect');
    const customNum = document.getElementById('customNum');
    if(analyzeSelect) analyzeSelect.value = selectVal;
    if(customNum) customNum.value = custom;
  },

  syncZodiacInputs: (selectPeriodVal, customPeriod, countVal, customCount) => {
    const zodiacAnalyzeSelect = document.getElementById('zodiacAnalyzeSelect');
    const zodiacCustomNum = document.getElementById('zodiacCustomNum');
    if(zodiacAnalyzeSelect) zodiacAnalyzeSelect.value = selectPeriodVal;
    if(zodiacCustomNum) zodiacCustomNum.value = customPeriod;
  },

  toggleCustomNumCount: (show) => {
    const customNumCount = document.getElementById('customNumCount');
    if(customNumCount) {
      customNumCount.style.display = show ? 'inline-block' : 'none';
    }
  },

  getSafeTop: () => {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-top')) || 0;
  },

  updateZodiacPredictionPeriod: () => {
    const state = StateManager._state;
    const historyData = state.analysis.historyData;
    let predictPeriod = '待预测';

    if(historyData && historyData.length > 0) {
      const latestExpect = historyData[0].expect;
      if(latestExpect) {
        const latestPeriodNum = parseInt(latestExpect.trim());
        if(!isNaN(latestPeriodNum)) {
          predictPeriod = String(latestPeriodNum + 1).padStart(6, '0');
        }
      }
    }

    window.predictPeriod = predictPeriod;

    const predictionTitleEl = document.getElementById('zodiacPredictionTitle');
    if(predictionTitleEl) {
      predictionTitleEl.innerText = `第${predictPeriod}期预测`;
    }
  },

  updateSelectedZodiacPeriod: () => {
    const state = StateManager._state;
    const historyData = state.analysis.historyData;
    let selectedZodiacPeriod = '待预测';

    if(historyData && historyData.length > 0) {
      const latestExpect = historyData[0].expect;
      if(latestExpect) {
        const latestPeriodNum = parseInt(latestExpect.trim());
        if(!isNaN(latestPeriodNum)) {
          selectedZodiacPeriod = String(latestPeriodNum + 1).padStart(6, '0');
        }
      }
    }

    window.selectedZodiacPeriod = selectedZodiacPeriod;

    const selectedZodiacTitleEl = document.getElementById('selectedZodiacTitle');
    if(selectedZodiacTitleEl) {
      selectedZodiacTitleEl.innerText = `第${selectedZodiacPeriod}期精选`;
    }
  },

  renderLatest: (item) => {
    if(!item) return;
    const codeArr = (item.openCode || '0,0,0,0,0,0,0').split(',');
    const s = DataQuery.getSpecial(item);
    const zodArr = s.fullZodArr;
    
    let html = '';
    for(let i = 0; i < 6; i++) {
      const num = Number(codeArr[i]);
      html += AnalysisView.buildBall(codeArr[i], DataQuery.getColor(num), zodArr[i]);
    }
    html += '<div class="ball-sep">+</div>' + AnalysisView.buildBall(codeArr[6], s.wave, zodArr[6]);
    
    const latestBalls = document.getElementById('latestBalls');
    const curExpect = document.getElementById('curExpect');
    if(latestBalls) latestBalls.innerHTML = html;
    if(curExpect) curExpect.innerText = item.expect || '--';
  },

  buildBall: (num, color, zodiac) => {
    return `
    <div class="ball-item">
      <div class="ball ${color}">${num}</div>
      <div class="ball-zodiac">${zodiac}</div>
    </div>`;
  },

  buildBallWithHit: (num, color, zodiac, isHit) => {
    const hitClass = isHit ? 'ball-hit' : '';
    return `
    <div class="ball-item ${hitClass}">
      <div class="ball ${color}">${num}</div>
      <div class="ball-zodiac">${zodiac}</div>
    </div>`;
  },

  renderHistory: () => {
    const state = StateManager._state;
    const list = state.analysis.historyData.slice(0, state.analysis.showCount);
    const historyList = document.getElementById('historyList');
    
    if(!list.length) {
      if(historyList) historyList.innerHTML = '<div style="padding:20px;text-align:center;">暂无历史数据</div>';
      return;
    }
    
    if(historyList) {
      historyList.innerHTML = list.map(item => {
        const codeArr = (item.openCode || '0,0,0,0,0,0,0').split(',');
        const waveArr = (item.wave || 'red,red,red,red,red,red,red').split(',');
        const s = DataQuery.getSpecial(item);
        const zodArr = s.fullZodArr;
        let balls = '';
        for(let i = 0; i < 6; i++) balls += AnalysisView.buildBall(codeArr[i], waveArr[i], zodArr[i]);
        balls += '<div class="ball-sep">+</div>' + AnalysisView.buildBall(codeArr[6], waveArr[6], zodArr[6]);
        return `
        <div class="history-item">
          <div class="history-expect">第${item.expect || ''}期</div>
          <div class="ball-group">${balls}</div>
        </div>`;
      }).join('');
    }
  },

  renderFullAnalysis: () => {
    const data = Business.calcFullAnalysis();
    if(!data) {
      const hotWrap = document.getElementById('hotWrap');
      const emptyTip = document.getElementById('emptyTip');
      if(hotWrap) hotWrap.style.display = 'none';
      if(emptyTip) emptyTip.style.display = 'block';
      return;
    }
    
    const hotWrap = document.getElementById('hotWrap');
    const emptyTip = document.getElementById('emptyTip');
    if(hotWrap) hotWrap.style.display = 'block';
    if(emptyTip) emptyTip.style.display = 'none';

    const elements = {
      'hotShape': `${data.hotSD[0]} / ${data.hotBS[0]}`,
      'hotZodiac': data.hotZod,
      'hotHeadTail': `${data.hotHead[0]}头 / ${data.hotTail[0]}尾`,
      'hotColorWx': `${data.hotColor[0]} / ${data.hotWx[0]}`,
      'hotMiss': `热:${data.miss.hot} 温:${data.miss.warm} 冷:${data.miss.cold} | 最大遗漏:${data.miss.maxMiss}期`,
      'odd': data.singleDouble['单'],
      'even': data.singleDouble['双'],
      'big': data.bigSmall['大'],
      'small': data.bigSmall['小'],
      'r1': data.range['1-9'],
      'r2': data.range['10-19'],
      'r3': data.range['20-29'],
      'r4': data.range['30-39'],
      'r5': data.range['40-49'],
      'h0': data.head[0],
      'h1': data.head[1],
      'h2': data.head[2],
      'h3': data.head[3],
      'h4': data.head[4],
      'cRed': data.color['红'],
      'cBlue': data.color['蓝'],
      'cGreen': data.color['绿'],
      'wJin': data.wuxing['金'],
      'wMu': data.wuxing['木'],
      'wShui': data.wuxing['水'],
      'wHuo': data.wuxing['火'],
      'wTu': data.wuxing['土'],
      'aniHome': data.animal['家禽'],
      'aniWild': data.animal['野兽'],
      'hotShape2': DataQuery.getTopHot(Object.entries(data.singleDouble).concat(Object.entries(data.bigSmall))),
      'hotRange2': DataQuery.getTopHot(Object.entries(data.range)),
      'hotHead2': DataQuery.getTopHot(Object.entries(data.head)),
      'hotTail2': DataQuery.getTopHot(Object.entries(data.tail)),
      'hotColor2': DataQuery.getTopHot(Object.entries(data.color)),
      'hotWuxing2': DataQuery.getTopHot(Object.entries(data.wuxing)),
      'hotAnimal': DataQuery.getTopHot(Object.entries(data.animal)),
      'hotZodiac2': Object.entries(data.zodiac).sort((a, b) => b[1] - a[1]).slice(0, 5).map(i => `${i[0]}(${i[1]})`).join(' '),
      'hotNumber': data.hotNum,
      'missCur': data.miss.curMaxMiss,
      'missAvg': data.miss.avgMiss,
      'missMax': data.miss.maxMiss,
      'missHot': data.miss.hot,
      'missWarm': data.miss.warm,
      'missCold': data.miss.cold,
      'hotColdTip': `热:${data.miss.hot} 温:${data.miss.warm} 冷:${data.miss.cold}`,
      'streakCur': data.streak.curStreak,
      'streakMax': data.streak.maxStreak,
      'streakTip': `当前:${data.streak.curStreak}期 最长:${data.streak.maxStreak}期`
    };

    Object.entries(elements).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if(el && id !== 'hotNumber') el.innerText = value;
    });

    const hotNumberEl = document.getElementById('hotNumber');
    if(hotNumberEl && data.hotNum) {
      const nums = data.hotNum.split(' ').map(n => parseInt(n));
      
      const getNumColor = (num) => {
        if(CONFIG.COLOR_MAP['红'].includes(num)) return 'red';
        if(CONFIG.COLOR_MAP['蓝'].includes(num)) return 'blue';
        if(CONFIG.COLOR_MAP['绿'].includes(num)) return 'green';
        return 'red';
      };
      
      const getNumElement = (num) => {
        if(CONFIG.ELEMENT_MAP['金'].includes(num)) return '金';
        if(CONFIG.ELEMENT_MAP['木'].includes(num)) return '木';
        if(CONFIG.ELEMENT_MAP['水'].includes(num)) return '水';
        if(CONFIG.ELEMENT_MAP['火'].includes(num)) return '火';
        if(CONFIG.ELEMENT_MAP['土'].includes(num)) return '土';
        return '';
      };

      let ballHtml = '<div class="ball-group">';
      nums.forEach(num => {
        const color = getNumColor(num);
        const zodiac = DataQuery._getZodiacByNum(num) || '';
        const element = getNumElement(num);
        const numStr = String(num).padStart(2, '0');
        ballHtml += `
          <div class="ball-item">
            <div class="ball ${color}">${numStr}</div>
            <div class="ball-zodiac">${zodiac}/${element}</div>
          </div>
        `;
      });
      ballHtml += '</div>';
      
      hotNumberEl.innerHTML = ballHtml;
      hotNumberEl.style.color = '';
      hotNumberEl.style.fontWeight = '';
    }

    const tailRow = document.getElementById('tailRow');
    if(tailRow) {
      let tailHtml = '';
      for(let t = 0; t <= 9; t++) {
        tailHtml += `<div class="analysis-item"><div class="label">尾${t}</div><div class="value">${data.tail[t]}</div></div>`;
      }
      tailRow.innerHTML = tailHtml;
    }

    AnalysisView.renderFullRank('singleDoubleRank', data.singleDouble, data.total);
    AnalysisView.renderFullRank('bigSmallRank', data.bigSmall, data.total);
    AnalysisView.renderFullRank('rangeRank', data.range, data.total);
    AnalysisView.renderFullRank('headRank', data.head, data.total);
    AnalysisView.renderFullRank('tailRank', data.tail, data.total);
    AnalysisView.renderFullRank('colorRank', data.color, data.total);
    AnalysisView.renderFullRank('wuxingRank', data.wuxing, data.total);
    AnalysisView.renderFullRank('animalRank', data.animal, data.total);
    AnalysisView.renderFullRank('zodiacRank', data.zodiac, data.total);
  },

  renderFullRank: (containerId, dataObj, total) => {
    const container = document.getElementById(containerId);
    if(!container) return;
    if(total === 0) { container.innerHTML = ''; return; }
    
    const sorted = Object.entries(dataObj).sort((a, b) => b[1] - a[1]);
    let html = `
    <div class="rank-header">
      <div class="rank-no">名次</div>
      <div class="rank-name">分类</div>
      <div class="rank-count">次数</div>
      <div class="rank-rate">占比</div>
      <div class="rank-miss">遗漏</div>
    </div>`;
    
    sorted.forEach(([name, count], idx) => {
      const rate = ((count / total) * 100).toFixed(0) + '%';
      const miss = count > 0 ? Math.floor((total - count) / count) : total;
      html += `
      <div class="rank-row">
        <div class="rank-no">${idx + 1}</div>
        <div class="rank-name">${name}</div>
        <div class="rank-count">${count}</div>
        <div class="rank-rate">${rate}</div>
        <div class="rank-miss">${miss}</div>
      </div>`;
    });
    
    container.innerHTML = html;
  },

  renderZodiacAnalysis: () => {
    const data = Business.calcZodiacAnalysis();
    const zodiacEmptyTip = document.getElementById('zodiacEmptyTip');
    const zodiacContent = document.getElementById('zodiacContent');
    
    if(!data) {
      if(zodiacEmptyTip) zodiacEmptyTip.style.display = 'block';
      if(zodiacContent) zodiacContent.style.display = 'none';
      return;
    }
    
    if(zodiacEmptyTip) zodiacEmptyTip.style.display = 'none';
    if(zodiacContent) zodiacContent.style.display = 'block';

    const zodiacPredictionGrid = document.getElementById('zodiacPredictionGrid');
    if(zodiacPredictionGrid && data.sortedZodiacs) {
      let predictionHtml = '';
      data.sortedZodiacs.forEach(([zod, score], idx) => {
        const details = data.zodiacDetails[zod];
        let topClass = '';
        if(idx === 0) topClass = 'top-1';
        else if(idx === 1) topClass = 'top-2';
        else if(idx === 2) topClass = 'top-3';

        const tags = [];
        if(details.cold > 0) tags.push(`冷${details.cold}`);
        if(details.hot > 0) tags.push(`热${details.hot}`);
        if(details.shape > 0) tags.push(`形${details.shape}`);
        if(details.interval > 0) tags.push(`间${details.interval}`);

        if(!zod) zod = '未知';

        predictionHtml += `
          <div class="zodiac-prediction-item ${topClass}" data-zodiac="${zod}">
            <div class="zodiac-prediction-zodiac">${zod}</div>
            <div class="zodiac-prediction-score">${score}分</div>
            <div class="zodiac-prediction-details">
              ${tags.map(t => `<span class="zodiac-prediction-tag">${t}</span>`).join('')}
            </div>
          </div>
        `;
      });
      zodiacPredictionGrid.innerHTML = predictionHtml;
    }

    const combo1 = document.getElementById('combo1');
    const combo2 = document.getElementById('combo2');
    const combo3 = document.getElementById('combo3');
    if(combo1) combo1.innerText = `1. 首选：尾${data.topTail[0]?.t ?? '-'} + ${data.topZod[0]?.[0] ?? '-'}（出现${data.topZod[0]?.[1] ?? 0}次）`;
    if(combo2) combo2.innerText = `2. 次选：尾${data.topTail[1]?.t ?? '-'} + ${data.topZod[1]?.[0] ?? '-'}（出现${data.topZod[1]?.[1] ?? 0}次）`;
    if(combo3) combo3.innerText = `3. 备选：尾${data.topTail[2]?.t ?? '-'} + ${data.topZod[2]?.[0] ?? '-'}（出现${data.topZod[2]?.[1] ?? 0}次）`;

    const tailZodiacGrid = document.getElementById('tailZodiacGrid');
    if(tailZodiacGrid) {
      let tailHtml = '';
      for(let t = 0; t <= 9; t++) {
        const arr = Object.entries(data.tailZodMap[t]).sort((a, b) => b[1] - a[1]);
        const topZ = arr.length ? arr[0][0] : '-';
        const cnt = arr.length ? arr[0][1] : 0;
        const level = DataQuery.getZodiacLevel(cnt, data.zodMiss[topZ] || 0, data.total);
        tailHtml += `<div class="data-item-z ${level.cls}">尾${t}<br>${topZ}<br>${cnt}次</div>`;
      }
      tailZodiacGrid.innerHTML = tailHtml;
    }

    const zodiacFollowTable = document.getElementById('zodiacFollowTable');
    if(zodiacFollowTable) {
      let followHtml = `<tr><th>上期生肖</th><th>首选(次数)</th><th>次选(次数)</th><th>排除生肖</th></tr>`;
      const followKeys = Object.keys(data.followMap).slice(0, 4);
      followKeys.forEach(k => {
        const arr = Object.entries(data.followMap[k]).sort((a, b) => b[1] - a[1]);
        const first = arr[0] ? `${arr[0][0]}(${arr[0][1]})` : '-';
        const second = arr[1] ? `${arr[1][0]}(${arr[1][1]})` : '-';
        const exclude = CONFIG.ANALYSIS.ZODIAC_ALL.filter(z => !arr.some(x => x[0] === z)).slice(0, 2).join('、');
        followHtml += `<tr><td>${k}</td><td>${first}</td><td>${second}</td><td>${exclude || '-'}</td></tr>`;
      });
      zodiacFollowTable.innerHTML = followHtml;
    }

    const zodiacTotalGrid = document.getElementById('zodiacTotalGrid');
    if(zodiacTotalGrid) {
      const zodiacData = CONFIG.ANALYSIS.ZODIAC_ALL.map(z => ({
        z,
        cnt: data.zodCount[z],
        miss: data.zodMiss[z],
        total: data.total
      })).sort((a, b) => a.miss - b.miss);
      let zodHtml = '';
      zodiacData.forEach(item => {
        const rate = ((item.cnt / item.total) * 100).toFixed(0) + '%';
        const level = DataQuery.getZodiacLevel(item.cnt, item.miss, item.total);
        zodHtml += `<div class="data-item-z ${level.cls}">${item.z}<br>${item.cnt}次/${rate}<br>遗${item.miss}</div>`;
      });
      zodiacTotalGrid.innerHTML = zodHtml;
    }

    const zodiacMissGrid = document.getElementById('zodiacMissGrid');
    if(zodiacMissGrid) {
      const missSort = Object.entries(data.zodMiss).sort((a, b) => b[1] - a[1]).slice(0, 3);
      let missHtml = '';
      missSort.forEach(([z, m]) => {
        const avgMiss = data.zodAvgMiss[z];
        const tag = m > avgMiss ? '超平均' : '';
        missHtml += `<div class="data-item-z cold">${z}<br>遗${m}期<br>${tag}</div>`;
      });
      zodiacMissGrid.innerHTML = missHtml;
    }

    AnalysisView.renderZodiacFinalNums(data);
    const selectedZodiacData = BusinessSpecial.renderSelectedZodiacs();
    if(selectedZodiacData) {
      AnalysisView.renderSelectedZodiacsGrid(selectedZodiacData);
    }
  },

  renderZodiacFinalNums: (data) => {
    const fullNumZodiacMap = new Map();
    for(let num = 1; num <= 49; num++) {
      const zod = DataQuery._getZodiacByNum(num);
      if(zod) fullNumZodiacMap.set(num, zod);
    }

    const finalNums = data.sortedFinalNums || [];

    const getNumColor = (num) => {
      if(CONFIG.COLOR_MAP['红'].includes(num)) return 'red';
      if(CONFIG.COLOR_MAP['蓝'].includes(num)) return 'blue';
      if(CONFIG.COLOR_MAP['绿'].includes(num)) return 'green';
      return 'red';
    };

    const getNumElement = (num) => {
      if(CONFIG.ELEMENT_MAP['金'].includes(num)) return '金';
      if(CONFIG.ELEMENT_MAP['木'].includes(num)) return '木';
      if(CONFIG.ELEMENT_MAP['水'].includes(num)) return '水';
      if(CONFIG.ELEMENT_MAP['火'].includes(num)) return '火';
      if(CONFIG.ELEMENT_MAP['土'].includes(num)) return '土';
      return '';
    };

    let ballHtml = '<div class="ball-group">';
    finalNums.forEach(num => {
      const color = getNumColor(num);
      const zodiac = fullNumZodiacMap.get(num) || '';
      const element = getNumElement(num);
      const numStr = String(num).padStart(2, '0');
      const zodiacText = element ? `${zodiac}/${element}` : zodiac;
      ballHtml += `
        <div class="ball-item">
          <div class="ball ${color}">${numStr}</div>
          <div class="ball-zodiac">${zodiacText}</div>
        </div>
      `;
    });
    ballHtml += '</div>';

    const zodiacFinalNumContent = document.getElementById('zodiacFinalNumContent');
    if(zodiacFinalNumContent) {
      zodiacFinalNumContent.innerHTML = ballHtml;
      zodiacFinalNumContent.parentElement.classList.add('final-recommend-z-balls');
    }
  },

  renderSpecialHistory: () => {
    PredictView.renderSpecialHistory();
  },

  renderZodiacPredictionHistory: () => {
    PredictView.renderZodiacPredictionHistory();
  },

  renderSmartHistory: () => {
    PredictView.renderSmartHistory();
  },

  displayLotteryResult: (result) => {
    PredictView.displayLotteryResult(result);
  },

  showCopyDialog: (numStr) => {
    Render.showCopyDialog(numStr);
  },

  showZodiacDetail: (zodiac) => {
    const data = Business.calcZodiacAnalysis();
    
    let score = 0;
    let miss = 0;
    let count = 0;
    let total = 0;
    let rate = '0%';
    let details = { cold: 0, hot: 0, shape: 0, interval: 0 };
    
    if(data) {
      details = data.zodiacDetails[zodiac];
      score = data.zodiacScores[zodiac] || 0;
      miss = data.zodMiss[zodiac] || 0;
      count = data.zodCount[zodiac] || 0;
      total = data.total || 0;
      rate = total > 0 ? ((count / total) * 100).toFixed(1) + '%' : '0%';
    }

    let detailHtml = `
      <div style="padding:16px;">
        <h3 style="margin-top:0; color:var(--primary);">${zodiac} 详情分析</h3>
        <div style="margin:12px 0;">
          <div style="margin:8px 0;"><strong>综合评分：</strong>${score}分</div>
          <div style="margin:8px 0;"><strong>出现次数：</strong>${count}次 (${rate})</div>
          <div style="margin:8px 0;"><strong>遗漏期数：</strong>${miss}期</div>
        </div>
        <h4 style="margin:16px 0 8px 0; color:var(--primary);">评分详情</h4>
        <div style="margin:12px 0;">
          <div style="margin:4px 0;"><strong>冷号状态：</strong>${details.cold}分</div>
          <div style="margin:4px 0;"><strong>热号状态：</strong>${details.hot}分</div>
          <div style="margin:4px 0;"><strong>形态匹配：</strong>${details.shape}分</div>
          <div style="margin:4px 0;"><strong>间隔匹配：</strong>${details.interval}分</div>
        </div>
        <h4 style="margin:16px 0 8px 0; color:var(--primary);">关联号码</h4>
        <div style="margin:12px 0;">
          ${DataQuery.getZodiacNumbers(zodiac).map(num => {
            const color = DataQuery.getColor(num);
            const numStr = String(num).padStart(2, '0');
            return `<span style="display:inline-block; margin:4px; padding:4px 8px; background:${color === 'red' ? '#ff4d4f' : color === 'blue' ? '#1890ff' : '#52c41a'}; color:white; border-radius:4px;">${numStr}</span>`;
          }).join('')}
        </div>
        ${!data ? '<div style="margin-top:16px; padding:12px; background:#f5f5f5; border-radius:4px;"><strong>提示：</strong>历史数据未加载，显示的是默认信息。请切换到分析页面加载历史数据后查看详细分析。</div>' : ''}
      </div>
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:9999;
      display:flex; align-items:center; justify-content:center;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background:white; border-radius:8px; width:90%; max-width:400px; max-height:80vh;
      overflow-y:auto; box-shadow:0 4px 12px rgba(0,0,0,0.15);
    `;

    const closeBtn = document.createElement('button');
    closeBtn.innerText = '关闭';
    closeBtn.style.cssText = `
      display:block; width:100%; padding:12px; background:var(--primary); color:white;
      border:none; border-radius:0 0 8px 8px; cursor:pointer;
    `;

    content.innerHTML = detailHtml;
    content.appendChild(closeBtn);
    modal.appendChild(content);

    closeBtn.addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    modal.addEventListener('click', (e) => {
      if(e.target === modal) {
        document.body.removeChild(modal);
      }
    });

    document.body.appendChild(modal);
  },

  showZodiacAppearDetail: (zodiac) => {
    const { appearRecords, intervalStats: stats } = DataQuery.calculateZodiacAppearDetail(zodiac);
    
    if(!appearRecords || appearRecords.length === 0) {
      Toast.show('暂无历史数据');
      return;
    }

    let intervalStatsHtml = '';
    if(stats) {
      intervalStatsHtml = `
        <div style="background:#f5f5f5; padding:12px; border-radius:6px; margin-bottom:16px;">
          <div style="font-weight:bold; margin-bottom:8px; color:var(--primary);">间隔统计</div>
          <div style="display:flex; justify-content:space-between; font-size:13px; margin:4px 0;">
            <span>平均间隔</span><span>${stats.avgInterval.toFixed(1)}期</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:13px; margin:4px 0;">
            <span>最大间隔</span><span>${stats.maxInterval}期</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:13px; margin:4px 0;">
            <span>最小间隔</span><span>${stats.minInterval}期</span>
          </div>
        </div>
      `;
    }

    let recordsHtml = '';
    if(appearRecords.length === 0) {
      recordsHtml = '<div style="text-align:center; color:#999; padding:20px;">该生肖在近期未出现</div>';
    } else {
      recordsHtml = appearRecords.map((r, idx) => {
        const numStr = String(r.num).padStart(2, '0');
        let intervalText = '';
        if(idx > 0) {
          const interval = appearRecords[idx - 1].index - r.index;
          intervalText = `<span style="font-size:12px; color:#999; margin-left:8px;">间隔${interval}期</span>`;
        }
        return `<div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #eee;">
          <span style="color:#666;">${r.expect}${intervalText}</span>
          <span><span style="font-weight:bold; color:var(--primary);">${r.zodiac} ${numStr}</span></span>
        </div>`;
      }).join('');
    }

    let detailHtml = `
      <div style="padding:16px;">
        <h3 style="margin-top:0; color:var(--primary); text-align:center;">${zodiac} 出现记录</h3>
        <div style="text-align:center; font-size:14px; color:#666; margin-bottom:12px;">共出现 ${appearRecords.length} 次</div>
        ${intervalStatsHtml}
        <div style="margin-top:12px; max-height:400px; overflow-y:auto;">${recordsHtml}</div>
      </div>
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:9999;
      display:flex; align-items:center; justify-content:center;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background:white; border-radius:8px; width:90%; max-width:360px; max-height:85vh;
      overflow-y:auto; box-shadow:0 4px 12px rgba(0,0,0,0.15);
    `;

    const closeBtn = document.createElement('button');
    closeBtn.innerText = '关闭';
    closeBtn.style.cssText = `
      display:block; width:100%; padding:12px; background:var(--primary); color:white;
      border:none; border-radius:0 0 8px 8px; cursor:pointer;
    `;

    content.innerHTML = detailHtml;
    content.appendChild(closeBtn);
    modal.appendChild(content);

    closeBtn.addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    modal.addEventListener('click', (e) => {
      if(e.target === modal) {
        document.body.removeChild(modal);
      }
    });

    document.body.appendChild(modal);
  },

  toggleZodiacPredictionHistory: () => {
    PredictView.toggleZodiacPredictionHistory();
  },

  switchBottomNav: (index) => {
    document.querySelectorAll('.bottom-nav-item').forEach((el,i)=>{
      el.classList.toggle('active', i===index);
    });
    
    const pages = ['filterPage', 'analysisPage', 'randomPage', 'profilePage'];
    pages.forEach((pageId, i) => {
      const pageEl = document.getElementById(pageId);
      if(pageEl) {
        pageEl.style.display = i === index ? 'block' : 'none';
        pageEl.classList.toggle('active', i === index);
      }
    });
    
    const topBox = document.getElementById('topBox');
    if(topBox) {
      topBox.style.display = index === 0 ? 'block' : 'none';
    }
    
    const bodyBox = document.querySelector('.body-box');
    if(bodyBox) {
      if(index === 0) {
        bodyBox.style.marginTop = 'calc(var(--top-offset) + var(--safe-top))';
      } else {
        bodyBox.style.marginTop = 'calc(12px + var(--safe-top))';
      }
    }
    
    const quickNavBtn = document.getElementById('quickNavBtn');
    const quickNavMenu = document.getElementById('quickNavMenu');
    const filterNavTabs = document.getElementById('filterNavTabs');
    const analysisNavTabs = document.getElementById('analysisNavTabs');
    
    if(index === 0 || index === 1) {
      if(quickNavBtn) {
        quickNavBtn.style.display = 'grid';
      }
      if(quickNavMenu) {
        if(filterNavTabs) filterNavTabs.style.display = index === 0 ? 'block' : 'none';
        if(analysisNavTabs) analysisNavTabs.style.display = index === 1 ? 'block' : 'none';
      }
    } else {
      if(quickNavBtn) {
        quickNavBtn.style.display = 'none';
      }
      if(quickNavMenu) {
        AnalysisView.toggleQuickNav(false);
      }
    }
    
    if(index === 1) {
      AnalysisView.init();
    }
    
    if(index === 2) {
      RecordView.renderRecordList();
    }
  },

  toggleDetail: (targetId) => {
    const el = document.getElementById(targetId);
    if(!el) return;
    
    const isVisible = el.style.display === 'block';
    el.style.display = isVisible ? 'none' : 'block';
    
    const btn = el.previousElementSibling ? el.previousElementSibling.querySelector('.toggle-btn') : null;
    if(btn) btn.textContent = isVisible ? '展开详情' : '收起详情';
  },

  switchAnalysisTab: (tab) => {
    document.querySelectorAll('.analysis-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.analysisTab === tab);
    });
    
    const panels = {
      'history': 'historyPanel',
      'analysis': 'analysisPanelContent',
      'zodiac': 'zodiacAnalysisPanel'
    };
    
    Object.entries(panels).forEach(([key, id]) => {
      const panel = document.getElementById(id);
      if(panel) panel.classList.toggle('active', key === tab);
    });
    
    const newAnalysis = { 
      ...StateManager._state.analysis, 
      currentTab: tab 
    };
    StateManager.setState({ analysis: newAnalysis }, false);
    
    if(tab === 'analysis') AnalysisView.renderFullAnalysis();
    if(tab === 'zodiac') AnalysisView.renderZodiacAnalysis();
  },

  loadMoreHistory: () => {
    const state = StateManager._state;
    const newShowCount = state.analysis.showCount + 30;
    
    const newAnalysis = { 
      ...state.analysis, 
      showCount: newShowCount 
    };
    StateManager.setState({ analysis: newAnalysis }, false);
    
    AnalysisView.renderHistory();
    
    const loadMore = document.getElementById('loadMore');
    if(loadMore && newShowCount >= state.analysis.historyData.length) {
      loadMore.style.display = 'none';
    }
  },

  scrollToModule: (targetId) => {
    const targetEl = document.getElementById(targetId);
    const analysisTabMap = {
      'historyPanel': 'history',
      'analysisPanelContent': 'analysis',
      'zodiacAnalysisPanel': 'zodiac'
    };
    
    if(targetEl) {
      if(analysisTabMap[targetId]) {
        const analysisPage = document.getElementById('analysisPage');
        const targetTab = analysisTabMap[targetId];
        
        if(analysisPage && analysisPage.style.display !== 'block') {
          AnalysisView.switchBottomNav(1);
          setTimeout(() => {
            AnalysisView.switchAnalysisTab(targetTab);
            const el = document.getElementById(targetId);
            if(el) {
              const offset = CONFIG.TOP_OFFSET + AnalysisView.getSafeTop();
              setTimeout(() => {
                window.scrollTo({top: el.offsetTop - offset, behavior: 'smooth'});
              }, 50);
            }
            AnalysisView.toggleQuickNav(false);
          }, 100);
        } else {
          AnalysisView.switchAnalysisTab(targetTab);
          const offset = CONFIG.TOP_OFFSET + AnalysisView.getSafeTop();
          setTimeout(() => {
            window.scrollTo({top: targetEl.offsetTop - offset, behavior: 'smooth'});
            AnalysisView.toggleQuickNav(false);
          }, 50);
        }
      } else {
        const offset = CONFIG.TOP_OFFSET + AnalysisView.getSafeTop();
        window.scrollTo({top: targetEl.offsetTop - offset, behavior: 'smooth'});
        AnalysisView.toggleQuickNav(false);
      }
    }
  },

  toggleQuickNav: (isOpen = null) => {
    const isCollapsed = DOM.quickNavMenu.classList.contains('collapsed');
    const shouldOpen = isOpen === null ? isCollapsed : isOpen;

    if(shouldOpen) {
      DOM.quickNavMenu.classList.remove('collapsed');
      DOM.quickNavMenu.classList.add('expanded');
      DOM.navToggle.style.display = 'none';
      DOM.navTabs.style.display = 'flex';
    } else {
      DOM.quickNavMenu.classList.remove('expanded');
      DOM.quickNavMenu.classList.add('collapsed');
      DOM.navTabs.style.display = 'none';
      DOM.navToggle.style.display = 'grid';
    }
  },

  adjustBottomNavPosition: () => {
    const bottomNav = document.querySelector('.bottom-nav');
    const quickNavBtn = document.getElementById('quickNavBtn');
    if(bottomNav && quickNavBtn) {
      bottomNav.classList.add('needs-space');
    }
  },

  backToTop: () => {
    window.scrollTo({top: 0, behavior: 'smooth'});
  },

  switchSpecialHistoryMode: (mode) => {
    PredictView.switchSpecialHistoryMode(mode);
  },

  selectAllSpecialFilters: () => {
    PredictView.selectAllSpecialFilters();
  },

  resetSpecialFilters: () => {
    PredictView.resetSpecialFilters();
  },

  confirmSpecialFilters: () => {
    PredictView.confirmSpecialFilters();
  },

  toggleSpecialFiltersPanel: () => {
    PredictView.toggleSpecialFiltersPanel();
  },

  togglePanel: (panelId, errorMsg) => {
    PredictView.togglePanel(panelId, errorMsg);
  },

  selectAllPredictionPeriods: () => {
    PredictView.selectAllPredictionPeriods();
  },

  resetPredictionPeriods: () => {
    PredictView.resetPredictionPeriods();
  },

  confirmPredictionFilters: () => {
    PredictView.confirmPredictionFilters();
  },

  togglePredictionFiltersPanel: () => {
    PredictView.togglePredictionFiltersPanel();
  },

  refreshHotCold: () => {
    PredictView.refreshHotCold();
  },

  quickLottery: (count) => {
    PredictView.quickLottery(count);
  },

  runLottery: () => {
    PredictView.runLottery();
  },

  excludeLotteryResult: () => {
    PredictView.excludeLotteryResult();
  },

  showStatDetail: (statType) => {
    const rankEl = document.getElementById(statType + 'Rank');
    if(rankEl && rankEl.style.display !== 'none') {
      rankEl.style.display = 'none';
      return;
    }

    const mapping = {
      odd: 'singleDoubleRank',
      even: 'singleDoubleRank',
      big: 'bigSmallRank',
      small: 'bigSmallRank',
      range1: 'rangeRank',
      range2: 'rangeRank',
      range3: 'rangeRank',
      range4: 'rangeRank',
      range5: 'rangeRank',
      head0: 'headRank',
      head1: 'headRank',
      head2: 'headRank',
      head3: 'headRank',
      head4: 'headRank',
      red: 'colorRank',
      blue: 'colorRank',
      green: 'colorRank',
      jin: 'wuxingRank',
      mu: 'wuxingRank',
      shui: 'wuxingRank',
      huo: 'wuxingRank',
      tu: 'wuxingRank',
      home: 'animalRank',
      wild: 'animalRank'
    };

    const targetId = mapping[statType];
    if(targetId) {
      const targetEl = document.getElementById(targetId);
      if(targetEl) {
        targetEl.style.display = 'block';
      }
    }
  },

  showStreakDetail: (streakType) => {
    Toast.show('连出详情功能开发中');
  },

  startCountdown: () => {
    setInterval(() => {
      const now = new Date();
      const target = new Date();
      target.setHours(21, 32, 32, 0);
      if(now > target) target.setDate(target.getDate() + 1);
      const diff = target - now;
      const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
      
      const countdown = document.getElementById('countdown');
      if(countdown) countdown.innerText = `${h}:${m}:${s}`;
    }, 1000);
  },

  handleScroll: Utils.throttle(() => {
    const state = StateManager._state;
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    clearTimeout(state.scrollTimer);

    if(scrollTop > CONFIG.BACK_TOP_THRESHOLD){
      DOM.backTopBtn.classList.add('show');
      state.scrollTimer = setTimeout(() => {
        DOM.backTopBtn.classList.remove('show');
      }, CONFIG.SCROLL_HIDE_DELAY);
    } else {
      DOM.backTopBtn.classList.remove('show');
    }
  }, CONFIG.SCROLL_THROTTLE_DELAY),

  handlePageUnload: () => {
    Business.clearAllTimers();
    window.removeEventListener('scroll', AnalysisView.handleScroll);
    window.removeEventListener('beforeunload', AnalysisView.handlePageUnload);
  },

  refreshHistoryUI: (status, data) => {
    const historyList = document.getElementById('historyList');
    if(historyList) {
      if(status === 'loading') {
        historyList.innerHTML = '<div style="padding:20px;text-align:center;">加载中...</div>';
      } else if(status === 'error') {
        historyList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--danger);">数据加载失败，请刷新重试</div>';
      }
    }
    
    const loadMore = document.getElementById('loadMore');
    if(loadMore && data) {
      loadMore.style.display = data.historyData.length > data.showCount ? 'block' : 'none';
    }
  },

  syncAnalyze: () => {
    const customNum = document.getElementById('customNum');
    const analyzeSelect = document.getElementById('analyzeSelect');
    
    const custom = customNum ? customNum.value.trim() : '';
    const selectVal = analyzeSelect ? analyzeSelect.value : '30';
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

  syncZodiacAnalyze: () => {
    const zodiacCustomNum = document.getElementById('zodiacCustomNum');
    const zodiacAnalyzeSelect = document.getElementById('zodiacAnalyzeSelect');
    const numCountSelect = document.getElementById('numCountSelect');
    const customNumCount = document.getElementById('customNumCount');
    
    const customPeriod = zodiacCustomNum ? zodiacCustomNum.value.trim() : '';
    const selectPeriodVal = zodiacAnalyzeSelect ? zodiacAnalyzeSelect.value : '30';
    const historyData = StateManager._state.analysis.historyData;
    
    const newLimit = customPeriod && !isNaN(customPeriod) && customPeriod > 0
      ? Number(customPeriod)
      : selectPeriodVal === 'all' ? historyData.length : Number(selectPeriodVal);
    
    const countVal = numCountSelect ? numCountSelect.value : '5';
    const customCount = customNumCount ? customNumCount.value.trim() : '';
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

  extractNumbersFromBalls: (containerId, errorMsg) => {
    const container = document.getElementById(containerId);
    if(!container) {
      Toast.show(errorMsg || '未找到容器');
      return null;
    }
    
    const balls = container.querySelectorAll('.ball-item .ball');
    if(balls.length === 0) {
      Toast.show(errorMsg || '暂无号码可复制');
      return null;
    }
    
    return Array.from(balls).map(ball => parseInt(ball.innerText.trim())).join(' ');
  },

  copyHotNumbers: () => {
    const hotNumberEl = document.getElementById('hotNumber');
    if(!hotNumberEl) {
      return null;
    }
    
    const balls = hotNumberEl.querySelectorAll('.ball-item .ball');
    if(balls.length === 0) {
      return null;
    }
    
    return Array.from(balls).map(ball => ball.innerText.trim()).join(' ');
  },

  favoriteZodiacNumbers: () => {
    const zodiacFinalNumContent = document.getElementById('zodiacFinalNumContent');
    if(!zodiacFinalNumContent) {
      return null;
    }
    
    const ballItems = zodiacFinalNumContent.querySelectorAll('.ball-item .ball');
    if(ballItems.length === 0) {
      return null;
    }
    
    return Array.from(ballItems).map(ball => parseInt(ball.innerText.trim()));
  },
  
  copyZodiacNumbers: () => {
    const zodiacFinalNumContent = document.getElementById('zodiacFinalNumContent');
    if(!zodiacFinalNumContent) {
      return null;
    }
    
    const ballItems = zodiacFinalNumContent.querySelectorAll('.ball-item .ball');
    if(ballItems.length === 0) {
      return null;
    }
    
    return Array.from(ballItems).map(ball => ball.innerText.trim()).join(' ');
  },

  filterRecords: (filterParams) => {
    // 业务逻辑由 BusinessAnalysis.filterRecords 处理
    const currentFilter = BusinessAnalysis.filterRecords(filterParams);
    
    const resultEl = document.querySelector('.filter-result');
    if (resultEl) {
      const list = Filter.getFilteredList();
      resultEl.textContent = `筛选结果：${list.length} 条`;
    }

    return currentFilter;
  },

  getAllValuesForGroup: (group) => {
    const allTags = [...document.querySelectorAll(`.tag[data-group="${group}"]`)];
    let allValues = allTags.map(tag => Utils.formatTagValue(tag.dataset.value, group));

    if (group === 'sum' || group === 'head') {
      allValues = allValues.map(v => parseInt(v));
    }

    return allValues;
  },

  showZodiacDetailModal: (detailData) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #fff;
      border-radius: 12px;
      width: 90%;
      max-width: 400px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    `;

    modal.innerHTML = `
      <div style="padding: 16px 20px; border-bottom: 1px solid #eee;">
        <h3 style="margin: 0; color: var(--primary);">${detailData.zodiac} 精选详情</h3>
      </div>
      <div style="padding: 16px 20px;">
        <div style="margin: 8px 0;"><strong>综合评分：</strong>${detailData.totalScore}分</div>
        <div style="margin: 8px 0;"><strong>出现次数：</strong>${detailData.count}次</div>
        <div style="margin: 8px 0;"><strong>遗漏期数：</strong>${detailData.miss}期</div>
        <div style="margin: 8px 0;"><strong>轮转状态：</strong>${detailData.cycleState}</div>
        <div style="margin: 8px 0;"><strong>当前行情：</strong>${detailData.marketMode}</div>
        <div style="margin: 8px 0;"><strong>窗口信号：</strong>${detailData.windowSignal}</div>
      </div>
      <div style="padding: 0 20px 16px 20px;">
        <h4 style="margin: 0 0 8px 0; color: var(--primary);">五大算法得分</h4>
        <div style="margin: 4px 0;"><strong>基础频次分：</strong>${detailData.baseScore}分</div>
        <div style="margin: 4px 0;"><strong>热号惯性分：</strong>${detailData.hotInertia}分</div>
        <div style="margin: 4px 0;"><strong>遗漏回补分：</strong>${detailData.missRepair}分</div>
        <div style="margin: 4px 0;"><strong>轮转平衡分：</strong>${detailData.cycleBalance}分</div>
        <div style="margin: 4px 0;"><strong>多窗口形态分：</strong>${detailData.patternScore}分</div>
      </div>
      <div style="padding: 0 20px 16px 20px;">
        <h4 style="margin: 0 0 8px 0; color: var(--primary);">对应号码</h4>
        <div style="line-height: 1.8;">${detailData.numbers}</div>
      </div>
      <div style="display: flex; border-top: 1px solid #eee;">
        <button id="zodiacDetailClose" style="flex: 1; padding: 12px; border: none; background: var(--primary, #1890ff); color: #fff; font-size: 14px; cursor: pointer;">
          关闭
        </button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeBtn = document.getElementById('zodiacDetailClose');
    const close = () => document.body.removeChild(overlay);

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if(e.target === overlay) close();
    });
  },

  renderSelectedZodiacsGrid: (data) => {
    const grid = document.getElementById('selectedZodiacsGrid');
    if(!grid || !data) return;

    let html = '';
    data.selectedZodiacs.forEach((item, idx) => {
      let rankClass = '';
      if(idx === 0) rankClass = 'rank-1';
      else if(idx === 1) rankClass = 'rank-2';
      else if(idx === 2) rankClass = 'rank-3';

      const stateColorMap = {
        '大热肖': '#ff4757',
        '温态肖': '#ffa502',
        '偏冷肖': '#3742fa',
        '极冷肖': '#2f3542'
      };
      const stateColor = stateColorMap[item.cycleState] || '#666';

      const patternIcon = {
        'hot_streak': '🔥',
        'hot': '⬆️',
        'warm': '➡️',
        'cooling': '⬇️',
        'cold': '❄️',
        'oscillation': '🔄',
        '无信号': '-'
      };

      html += `
        <div class="selected-zodiac-item ${rankClass}" data-action="showSelectedZodiacDetail" data-zodiac="${item.zodiac}" data-index="${idx}">
          <div class="selected-zodiac-rank">${idx + 1}</div>
          <div class="selected-zodiac-name">${item.zodiac}</div>
          <div class="selected-zodiac-score">${item.totalScore}分</div>
          <div class="selected-zodiac-tags">
            <span class="zodiac-tag" style="background:${stateColor}">${item.cycleState}</span>
            <span class="zodiac-tag">遗${item.miss}期</span>
            <span class="zodiac-tag">${patternIcon[item.windowSignal] || ''}${item.windowSignal}</span>
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;
  }
};
