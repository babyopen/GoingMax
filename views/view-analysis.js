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
    AnalysisView.renderSpecialHistory();
    AnalysisView.renderZodiacPredictionHistory();
    AnalysisView.renderSmartHistory();
  },

  renderLatest: (item) => {
    if(!item) return;
    const codeArr = (item.openCode || '0,0,0,0,0,0,0').split(',');
    const s = Business.getSpecial(item);
    const zodArr = s.fullZodArr;
    
    let html = '';
    for(let i = 0; i < 6; i++) {
      const num = Number(codeArr[i]);
      html += AnalysisView.buildBall(codeArr[i], Business.getColor(num), zodArr[i]);
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
        const s = Business.getSpecial(item);
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
      'hotShape2': Business.getTopHot(Object.entries(data.singleDouble).concat(Object.entries(data.bigSmall))),
      'hotRange2': Business.getTopHot(Object.entries(data.range)),
      'hotHead2': Business.getTopHot(Object.entries(data.head)),
      'hotTail2': Business.getTopHot(Object.entries(data.tail)),
      'hotColor2': Business.getTopHot(Object.entries(data.color)),
      'hotWuxing2': Business.getTopHot(Object.entries(data.wuxing)),
      'hotAnimal': Business.getTopHot(Object.entries(data.animal)),
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

  getTopHot: (arr, limit = 2) => {
    return arr.sort((a, b) => b[1] - a[1]).slice(0, limit).map(i => i[0]).join(' / ');
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
        const level = Business.getZodiacLevel(cnt, data.zodMiss[topZ] || 0, data.total);
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
      let zodHtml = '';
      CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => {
        const cnt = data.zodCount[z];
        const miss = data.zodMiss[z];
        const rate = ((cnt / data.total) * 100).toFixed(0) + '%';
        const level = Business.getZodiacLevel(cnt, miss, data.total);
        zodHtml += `<div class="data-item-z ${level.cls}">${z}<br>${cnt}次/${rate}<br>遗${miss}</div>`;
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
  },

  renderZodiacFinalNums: (data) => {
    const state = StateManager._state;
    
    const fullNumZodiacMap = new Map();
    for(let num = 1; num <= 49; num++) {
      const zod = DataQuery._getZodiacByNum(num);
      if(zod) fullNumZodiacMap.set(num, zod);
    }

    const coreZodiacs = data.sortedZodiacs 
      ? data.sortedZodiacs.slice(0, 4).map(i => i[0])
      : data.topZod.slice(0, 2).map(i => i[0]);

    const hotTails = data.topTail.slice(0, 3).map(i => i.t);

    const candidateNums = [];
    for(let num = 1; num <= 49; num++) {
      const zod = fullNumZodiacMap.get(num);
      const tail = num % 10;
      if(coreZodiacs.includes(zod) && hotTails.includes(tail)) {
        const miss = data.zodMiss[zod] || 0;
        const count = data.zodCount[zod] || 0;
        const zodScore = data.zodiacScores && data.zodiacScores[zod] ? data.zodiacScores[zod] : 0;
        candidateNums.push({
          num,
          weight: count * 10 + (10 - miss) + zodScore * 2
        });
      }
    }

    const targetCount = state.analysis.selectedNumCount;
    candidateNums.sort((a, b) => b.weight - a.weight);
    let finalNums = candidateNums.slice(0, targetCount).map(i => i.num);

    if(finalNums.length < targetCount) {
      const fillNums = [...new Set(data.list.map(item => Business.getSpecial(item).te))]
        .filter(num => !finalNums.includes(num))
        .slice(0, targetCount - finalNums.length);
      finalNums.push(...fillNums);
    }

    finalNums.sort((a, b) => a - b);

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

    const zodiacFinalNum = document.getElementById('zodiacFinalNum');
    if(zodiacFinalNum) {
      zodiacFinalNum.innerHTML = `✅ 精选特码：${ballHtml}`;
      zodiacFinalNum.classList.add('final-recommend-z-balls');
    }
  },

  renderSpecialHistory: () => {
    try {
      const state = StateManager._state;
      const historyListEl = document.getElementById('specialHistoryList');
      const toggleEl = document.getElementById('specialHistoryToggle');
      
      if(!historyListEl) return;
      
      const history = state.specialHistory;
      const isExpanded = state.specialHistoryExpanded || false;
      
      if(!history || history.length === 0) {
        historyListEl.innerHTML = '<div style="text-align:center;color:var(--sub-text);padding:20px;font-size:13px;">暂无精选特码历史</div>';
        if(toggleEl) toggleEl.style.display = 'none';
        return;
      }
      
      const filteredHistory = history;
      const displayCount = isExpanded ? filteredHistory.length : Math.min(4, filteredHistory.length);
      const displayHistory = filteredHistory.slice(0, displayCount);
      
      let html = '';
      displayHistory.forEach((item, idx) => {
        const period = item.analyzeLimit;
        const periodText = item.selectedPeriodText || (period === 'all' || period >= 365 ? '全年数据' : `${period}期数据`);
        const numCount = item.numCount || item.numbers.length;
        const itemMode = item.mode || 'hot';
        const modeEmoji = itemMode === 'hot' ? '热' : '冷';
        
        let titleText = '';
        if(item.expect) {
          titleText = `第${item.expect}期`;
        }
        if(titleText) {
          titleText += ` · ${periodText}`;
        } else {
          titleText = periodText;
        }
        titleText += ` · ${numCount}个 · ${modeEmoji}`;
        
        let numbersHtml = '';
        item.numbers.forEach(num => {
          const isHit = item.hitNumbers && item.hitNumbers.includes(num);
          const tagClass = isHit ? 'history-tag hit' : 'history-tag';
          
          numbersHtml += `<span class="${tagClass}" style="cursor:pointer;">${String(num).padStart(2, '0')}</span>`;
        });
        
        let drawNumberHtml = '';
        if(item.drawResult !== null) {
          const isHit = item.hitCount > 0;
          const drawClass = isHit ? 'history-tag hit' : 'history-tag miss';
          
          drawNumberHtml = `<span class="${drawClass}" style="margin-left:auto;">${String(item.drawResult).padStart(2, '0')}</span>`;
        }
        
        html += `
          <div style="padding:12px;border-bottom:1px solid var(--border);background:var(--card);border-radius:8px;margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <div style="color:var(--sub-text);font-size:11px;">
                <span>${titleText}</span>
              </div>
            </div>
            <div style="display:flex;align-items:flex-start;gap:8px;">
              <div style="flex:1;min-width:0;">
                <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;">${numbersHtml}${drawNumberHtml}</div>
              </div>
            </div>
          </div>
        `;
      });

      historyListEl.innerHTML = html;
      
      if(toggleEl) {
        if(filteredHistory.length > 4) {
          toggleEl.style.display = 'block';
          const toggleBtn = toggleEl.querySelector('button');
          if(toggleBtn) {
            toggleBtn.innerText = isExpanded ? '收起' : `展开更多（还有${filteredHistory.length - 4}条）`;
          }
        } else {
          toggleEl.style.display = 'none';
        }
      }
    } catch(e) {
      console.error('渲染精选特码历史失败', e);
    }
  },

  renderZodiacPredictionHistory: () => {
    try {
      const historyListEl = document.getElementById('zodiacPredictionHistoryList');
      const toggleEl = document.getElementById('zodiacPredictionHistoryToggle');
      
      if(!historyListEl) return;
      
      const history = Storage.loadZodiacPredictionHistory();
      
      if(!history || history.length === 0) {
        historyListEl.innerHTML = '<div class="empty-tip">暂无预测历史</div>';
        if(toggleEl) toggleEl.style.display = 'none';
        return;
      }
      
      let html = '';
      history.slice(0, 5).forEach((item, idx) => {
        const periodText = item.analyzeLimit >= 365 ? '全年' : `${item.analyzeLimit}期`;
        
        html += `
          <div style="padding:12px;border-bottom:1px solid var(--border);background:var(--card);border-radius:8px;margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <div style="color:var(--sub-text);font-size:11px;">
                <span>第${item.expect || '--'}期 · ${periodText}</span>
              </div>
              <div style="color:var(--sub-text);font-size:11px;">
                ${new Date(item.timestamp).toLocaleDateString()}
              </div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
              ${(item.sortedZodiacs || []).slice(0, 4).map(([zod, score]) => 
                `<span style="padding:4px 8px;background:var(--bg-secondary);border-radius:6px;font-size:12px;">${zod}(${score}分)</span>`
              ).join('')}
            </div>
          </div>
        `;
      });

      historyListEl.innerHTML = html;
      
      if(toggleEl && history.length > 5) {
        toggleEl.style.display = 'block';
      } else if(toggleEl) {
        toggleEl.style.display = 'none';
      }
    } catch(e) {
      console.error('渲染预测历史失败', e);
    }
  },

  renderSmartHistory: () => {
    const historyEl = document.getElementById('smartHistory');
    if(!historyEl) return;

    const history = Storage.get('smartHistory', []);
    if(history.length === 0) {
      historyEl.innerHTML = '<div class="empty-tip">暂无历史记录</div>';
      return;
    }

    historyEl.innerHTML = history.map(item => `
      <div class="smart-history-item">
        <span class="smart-history-time">${new Date(item.timestamp).toLocaleTimeString()}</span>
        <span class="smart-history-count">${item.count}注</span>
        <span class="smart-history-result">${item.result.join(', ')}</span>
      </div>
    `).join('');
  },

  displayLotteryResult: (result) => {
    const resultEl = document.getElementById('lotteryResult');
    if(!resultEl) return;

    resultEl.innerHTML = result.map(n => `
      <div class="result-ball" data-num="${n.num}">
        <div class="num-ball ${n.color}色">${n.s}</div>
        <div class="tag-zodiac">${n.zodiac}</div>
      </div>
    `).join('');
  }
};
