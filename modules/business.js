/**
 * 业务逻辑模块
 * @description 核心业务逻辑，包含排除号码、方案管理、导航、分析页面等功能
 */
const Business = {
  toggleExclude: (num) => {
    const state = StateManager._state;
    if(state.lockExclude) return;

    const newExcluded = [...state.excluded];
    const newHistory = [...state.excludeHistory];

    if(newExcluded.includes(num)){
      newHistory.push([num, 'out']);
      const index = newExcluded.indexOf(num);
      newExcluded.splice(index, 1);
    } else {
      newHistory.push([num, 'in']);
      newExcluded.push(num);
    }

    StateManager.setState({ excluded: newExcluded, excludeHistory: newHistory });
  },

  invertExclude: () => {
    const state = StateManager._state;
    if(state.lockExclude) return;

    const allNums = Array.from({length: 49}, (_, i) => i + 1);
    const newExcluded = [];
    const newHistory = [...state.excludeHistory];

    allNums.forEach(num => {
      const isCurrentlyExcluded = state.excluded.includes(num);
      if(!isCurrentlyExcluded){
        newExcluded.push(num);
        newHistory.push([num, 'in']);
      } else {
        newHistory.push([num, 'out']);
      }
    });

    StateManager.setState({ excluded: newExcluded, excludeHistory: newHistory });
    Toast.show(`已反选，当前排除 ${newExcluded.length} 个号码`);
  },

  undoExclude: () => {
    const state = StateManager._state;
    if(state.lockExclude || !state.excludeHistory.length) return;

    const newHistory = [...state.excludeHistory];
    const [num, act] = newHistory.pop();
    const newExcluded = [...state.excluded];

    act === 'in' 
      ? newExcluded.splice(newExcluded.indexOf(num), 1)
      : newExcluded.push(num);

    StateManager.setState({ excluded: newExcluded, excludeHistory: newHistory });
  },

  clearExclude: () => {
    const state = StateManager._state;
    if(state.lockExclude) return;
    StateManager.setState({ excluded: [], excludeHistory: [] });
    Toast.show('已清空所有排除号码');
  },

  batchExcludePrompt: () => {
    const state = StateManager._state;
    if(state.lockExclude) return;

    InputModal.show({
      title: '批量排除号码',
      defaultValue: '',
      placeholder: '输入号码，空格/逗号分隔，如：1,2,3,4,5',
      onConfirm: (input) => {
        if(!input) return;

        const nums = input.split(/[\s,，]+/).map(Number).filter(num => num >=1 && num <=49);
        if(nums.length === 0) {
          Toast.show('请输入有效的号码');
          return;
        }

        const newExcluded = [...state.excluded];
        const newHistory = [...state.excludeHistory];
        let addCount = 0;

        nums.forEach(num => {
          if(!newExcluded.includes(num)){
            newExcluded.push(num);
            newHistory.push([num, 'in']);
            addCount++;
          }
        });

        StateManager.setState({ excluded: newExcluded, excludeHistory: newHistory });
        Toast.show(addCount > 0 ? `已添加${addCount}个排除号码` : '号码已在排除列表中');
      }
    });
  },

  toggleExcludeLock: () => {
    const isLocked = DOM.lockExclude.checked;
    StateManager.setState({ lockExclude: isLocked }, false);
    Toast.show(isLocked ? '已锁定排除号码' : '已解锁排除号码');
  },

  saveFilterPrompt: () => {
    const state = StateManager._state;
    if(state.savedFilters.length >= CONFIG.MAX_SAVE_COUNT){
      Toast.show(`最多只能保存${CONFIG.MAX_SAVE_COUNT}个方案`);
      return;
    }

    const defaultName = `方案${state.savedFilters.length + 1}`;
    InputModal.show({
      title: '保存方案',
      defaultValue: defaultName,
      placeholder: '请输入方案名称',
      onConfirm: (name) => {
        const filterName = (name || '').trim() || defaultName;
        const filterItem = {
          name: filterName,
          selected: Utils.deepClone(state.selected),
          excluded: Utils.deepClone(state.excluded)
        };
        const success = Storage.saveFilter(filterItem);
        if(success){
          FilterView.renderFilterList();
          Toast.show('保存成功');
        }
      }
    });
  },

  loadFilter: (index) => {
    const state = StateManager._state;
    const item = state.savedFilters[index];
    if(!item) return;

    StateManager.setState({
      selected: Utils.deepClone(item.selected),
      excluded: Utils.deepClone(item.excluded)
    });
    Toast.show('加载成功');
  },

  copyFilterNums: (index) => {
    const state = StateManager._state;
    const item = state.savedFilters[index];
    if(!item) return;

    const list = Filter.getFilteredList(item.selected, item.excluded);
    if(list.length === 0){
      Toast.show('该方案无符合条件的号码');
      return;
    }

    const numStr = list.map(n => n.s).join(' ');
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(numStr).then(() => {
        Toast.show('复制成功');
      }).catch(() => {
        Business.showCopyDialog(numStr);
      });
    } else {
      Business.showCopyDialog(numStr);
    }
  },

  showCopyDialog: (numStr) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5); z-index: 10000;
      display: flex; align-items: center; justify-content: center;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #fff; border-radius: 12px; width: 90%; max-width: 360px;
      padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    `;
    modal.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 12px;">请手动复制号码</div>
      <div style="
        background: #f5f5f5; padding: 12px; border-radius: 8px;
        word-break: break-all; font-size: 14px; line-height: 1.6;
        margin-bottom: 16px; max-height: 200px; overflow-y: auto;
      ">${numStr}</div>
      <button class="btn-primary" style="
        width: 100%; padding: 12px; border: none; border-radius: 8px;
        background: var(--primary, #1890ff); color: #fff; font-size: 14px;
        cursor: pointer;
      ">我知道了</button>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    modal.querySelector('button').addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    overlay.addEventListener('click', (e) => {
      if(e.target === overlay) document.body.removeChild(overlay);
    });
  },

  renameFilter: (index) => {
    const state = StateManager._state;
    const item = state.savedFilters[index];
    if(!item) return;

    InputModal.show({
      title: '重命名方案',
      defaultValue: item.name,
      placeholder: '请输入新名称',
      onConfirm: (newName) => {
        if(!newName || newName.trim() === "") return;

        const newList = [...state.savedFilters];
        newList[index].name = newName.trim();
        const success = Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
        
        if(success){
          StateManager.setState({ savedFilters: newList }, false);
          FilterView.renderFilterList();
          Toast.show('重命名成功');
        }
      }
    });
  },

  topFilter: (index) => {
    const state = StateManager._state;
    const item = state.savedFilters[index];
    if(!item) return;

    const newList = [...state.savedFilters];
    newList.splice(index, 1);
    newList.unshift(item);
    const success = Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
    
    if(success){
      StateManager.setState({ savedFilters: newList }, false);
      FilterView.renderFilterList();
      Toast.show('置顶成功');
    }
  },

  deleteFilter: (index) => {
    InputModal.confirm({
      title: '删除方案',
      message: '确定删除该方案吗？',
      onConfirm: () => {
        const state = StateManager._state;
        const newList = [...state.savedFilters];
        newList.splice(index, 1);
        const success = Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
        
        if(success){
          StateManager.setState({ savedFilters: newList }, false);
          FilterView.renderFilterList();
          Toast.show('删除成功');
        }
      }
    });
  },

  clearAllSavedFilters: () => {
    InputModal.confirm({
      title: '清空所有方案',
      message: '确定清空所有方案吗？',
      onConfirm: () => {
        Storage.remove(Storage.KEYS.SAVED_FILTERS);
        StateManager.setState({ savedFilters: [] }, false);
        FilterView.renderFilterList();
        Toast.show('已清空所有方案');
      }
    });
  },

  toggleShowAllFilters: () => {
    const state = StateManager._state;
    StateManager.setState({ showAllFilters: !state.showAllFilters }, false);
    FilterView.renderFilterList();
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
        Business.toggleQuickNav(false);
      }
    }
    
    if(index === 1) {
      AnalysisView.init();
    }
    
    if(index === 2) {
      RecordView.renderRecordList();
    }
  },

  initAnalysisPage: () => {
    AnalysisView.init();
  },

  refreshHistory: async () => {
    const historyList = document.getElementById('historyList');
    if(historyList) historyList.innerHTML = '<div style="padding:20px;text-align:center;">加载中...</div>';
    
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

      AnalysisView.renderLatest(sortedData[0]);
      AnalysisView.renderHistory();
      AnalysisView.renderFullAnalysis();
      AnalysisView.renderZodiacAnalysis();
      
      Toast.show('数据加载成功');
    } catch(e) {
      console.error('加载历史数据失败', e);
      if(historyList) {
        historyList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--danger);">数据加载失败，请刷新重试</div>';
      }
      Toast.show('数据加载失败');
    }
    
    const loadMore = document.getElementById('loadMore');
    if(loadMore) {
      loadMore.style.display = StateManager._state.analysis.historyData.length > StateManager._state.analysis.showCount ? 'block' : 'none';
    }
  },

  getColor: (n) => {
    const color = Object.keys(CONFIG.COLOR_MAP).find(c => CONFIG.COLOR_MAP[c].includes(n));
    const colorMap = { '红': 'red', '蓝': 'blue', '绿': 'green' };
    return colorMap[color] || 'red';
  },
  
  getColorName: (n) => {
    const color = Object.keys(CONFIG.COLOR_MAP).find(c => CONFIG.COLOR_MAP[c].includes(n));
    return color || '红';
  },
  
  getSpecial: (item) => {
    const codeArr = (item.openCode || '0,0,0,0,0,0,0').split(',');
    const zodArrRaw = (item.zodiac || ',,,,,,,,,,,,').split(',');
    const zodArr = zodArrRaw.map(z => CONFIG.ANALYSIS.ZODIAC_TRAD_TO_SIMP[z] || z);
    const te = Math.max(0, Number(codeArr[6]));
    
    return {
      te,
      tail: te % 10,
      head: Math.floor(te / 10),
      wave: Business.getColor(te),
      colorName: Business.getColorName(te),
      zod: zodArr[6] || '-',
      odd: te % 2 === 1,
      big: te >= 25,
      animal: CONFIG.ANALYSIS.HOME_ZODIAC.includes(zodArr[6]) ? '家禽' : '野兽',
      wuxing: Business.getWuxing(te),
      fullZodArr: zodArr
    };
  },

  getWuxing: (n) => {
    const element = Object.keys(CONFIG.ELEMENT_MAP).find(e => CONFIG.ELEMENT_MAP[e].includes(n));
    return element || '金';
  },

  getZodiacLevel: (count, miss, total) => {
    const avgCount = total / 12;
    if(count >= avgCount * 1.5 && miss <= 3) return { cls: 'hot', text: '热' };
    if(count <= avgCount * 0.5 || miss >= 8) return { cls: 'cold', text: '冷' };
    return { cls: 'warm', text: '温' };
  },

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
      const s = Business.getSpecial(item);
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
          const s = Business.getSpecial(item);
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
      const s = Business.getSpecial(item);
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
      const firstShape = `${Business.getSpecial(list[0]).odd}_${Business.getSpecial(list[0]).big}`;
      for(let i = 1; i < list.length; i++) {
        const s = Business.getSpecial(list[i]);
        const shape = `${s.odd}_${s.big}`;
        if(shape === firstShape) curStreak++;
        else break;
      }
      let prevShape = `${Business.getSpecial(list[0]).odd}_${Business.getSpecial(list[0]).big}`;
      for(let i = 1; i < list.length; i++) {
        const s = Business.getSpecial(list[i]);
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
    
    const hotNum = Business.calcMultiDimensionalHotNums(list, numCount, lastAppear, zodiac, {
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

  getTopHot: (arr, limit = 2) => {
    return arr.sort((a, b) => b[1] - a[1]).slice(0, limit).map(i => i[0]).join(' / ');
  },

  calcZodiacAnalysis: () => {
    const state = StateManager._state;
    const { historyData, analyzeLimit } = state.analysis;
    if(!historyData.length || historyData.length < 2) return null;

    const list = historyData.slice(0, Math.min(analyzeLimit, historyData.length));
    const total = list.length;
    const avgExpect = total / 12;

    const zodCount = {};
    const lastAppear = {};
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => { zodCount[z] = 0; lastAppear[z] = -1; });
    const tailZodMap = {};
    for(let t = 0; t <= 9; t++) tailZodMap[t] = {};
    const followMap = {};

    list.forEach((item, idx) => {
      const s = Business.getSpecial(item);
      if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod)) {
        zodCount[s.zod]++;
        if(lastAppear[s.zod] === -1) lastAppear[s.zod] = idx;
      }
      if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod)) {
        tailZodMap[s.tail][s.zod] = (tailZodMap[s.tail][s.zod] || 0) + 1;
      }
    });

    for(let i = 1; i < list.length; i++) {
      const preZod = Business.getSpecial(list[i-1]).zod;
      const curZod = Business.getSpecial(list[i]).zod;
      if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(preZod) && CONFIG.ANALYSIS.ZODIAC_ALL.includes(curZod)) {
        if(!followMap[preZod]) followMap[preZod] = {};
        followMap[preZod][curZod] = (followMap[preZod][curZod] || 0) + 1;
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
    
    for(let i = 1; i < list.length && i < 30; i++) {
      const preZod = Business.getSpecial(list[i-1]).zod;
      const curZod = Business.getSpecial(list[i]).zod;
      const preIdx = zodiacOrder.indexOf(preZod);
      const curIdx = zodiacOrder.indexOf(curZod);
      if(preIdx !== -1 && curIdx !== -1) {
        let diff = curIdx - preIdx;
        if(diff > 6) diff -= 12;
        if(diff < -6) diff += 12;
        intervalStats[diff + 6]++;
      }
    }
    const commonIntervals = Object.entries(intervalStats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => parseInt(x[0]) - 6);

    const lastZod = list.length > 0 ? Business.getSpecial(list[0]).zod : '';
    
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

    return { 
      list, total, avgExpect, zodCount, zodMiss, zodAvgMiss, tailZodMap, followMap, topZod, topTail,
      zodiacScores, zodiacDetails, sortedZodiacs
    };
  },

  syncAnalyze: () => {
    const customNum = document.getElementById('customNum');
    const analyzeSelect = document.getElementById('analyzeSelect');
    const zodiacAnalyzeSelect = document.getElementById('zodiacAnalyzeSelect');
    const zodiacCustomNum = document.getElementById('zodiacCustomNum');
    
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
    
    if(zodiacAnalyzeSelect) zodiacAnalyzeSelect.value = selectVal;
    if(zodiacCustomNum) zodiacCustomNum.value = custom;
    
    AnalysisView.renderFullAnalysis();
    AnalysisView.renderZodiacAnalysis();
    
    setTimeout(() => {
      Business.saveAnalysisToRecord();
    }, 500);
  },

  syncZodiacAnalyze: () => {
    const zodiacCustomNum = document.getElementById('zodiacCustomNum');
    const zodiacAnalyzeSelect = document.getElementById('zodiacAnalyzeSelect');
    const numCountSelect = document.getElementById('numCountSelect');
    const customNumCount = document.getElementById('customNumCount');
    const analyzeSelect = document.getElementById('analyzeSelect');
    const customNum = document.getElementById('customNum');
    
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
    
    if(analyzeSelect) analyzeSelect.value = selectPeriodVal;
    if(customNum) customNum.value = customPeriod;
    
    AnalysisView.renderFullAnalysis();
    AnalysisView.renderZodiacAnalysis();
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

  isInDrawTime: () => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    return h === 21 && m >= 32 && m <= 40;
  },

  startAutoRefresh: () => {
    const state = StateManager._state;
    if(state.analysis.autoRefreshTimer) clearInterval(state.analysis.autoRefreshTimer);
    
    const newTimer = setInterval(() => {
      if(Business.isInDrawTime()) {
        Business.refreshHistory();
      } else {
        clearInterval(state.analysis.autoRefreshTimer);
        const newAnalysis = { 
          ...StateManager._state.analysis, 
          autoRefreshTimer: null 
        };
        StateManager.setState({ analysis: newAnalysis }, false);
      }
    }, 20000);
    
    const newAnalysis = { 
      ...state.analysis, 
      autoRefreshTimer: newTimer 
    };
    StateManager.setState({ analysis: newAnalysis }, false);
  },

  checkDrawTimeLoop: () => {
    setInterval(() => {
      if(Business.isInDrawTime() && !StateManager._state.analysis.autoRefreshTimer) {
        Business.startAutoRefresh();
      }
    }, 60000);
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
          Business.switchBottomNav(1);
          setTimeout(() => {
            Business.switchAnalysisTab(targetTab);
            const el = document.getElementById(targetId);
            if(el) {
              const offset = CONFIG.TOP_OFFSET + Utils.getSafeTop();
              setTimeout(() => {
                window.scrollTo({top: el.offsetTop - offset, behavior: 'smooth'});
              }, 50);
            }
            Business.toggleQuickNav(false);
          }, 100);
        } else {
          Business.switchAnalysisTab(targetTab);
          const offset = CONFIG.TOP_OFFSET + Utils.getSafeTop();
          setTimeout(() => {
            window.scrollTo({top: targetEl.offsetTop - offset, behavior: 'smooth'});
            Business.toggleQuickNav(false);
          }, 50);
        }
      } else {
        const offset = CONFIG.TOP_OFFSET + Utils.getSafeTop();
        window.scrollTo({top: targetEl.offsetTop - offset, behavior: 'smooth'});
        Business.toggleQuickNav(false);
      }
    }
  },

  toggleQuickNav: (isOpen = null) => {
    const isCollapsed = DOM.quickNavMenu.classList.contains('collapsed');
    const shouldOpen = isOpen === null ? isCollapsed : isOpen;

    if(shouldOpen){
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
    if(bottomNav && quickNavBtn){
      bottomNav.classList.add('needs-space');
    }
  },

  backToTop: () => {
    window.scrollTo({top: 0, behavior: 'smooth'});
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
    StateManager.clearAllTimers();
    window.removeEventListener('scroll', Business.handleScroll);
    window.removeEventListener('beforeunload', Business.handlePageUnload);
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
          ${Business.getZodiacNumbers(zodiac).map(num => {
            const color = Business.getColor(num);
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

  getZodiacNumbers: (zodiac) => {
    const numbers = [];
    for(let num = 1; num <= 49; num++) {
      if(DataQuery._getZodiacByNum(num) === zodiac) {
        numbers.push(num);
      }
    }
    return numbers;
  },

  getHotNumbers: (data, targetCount, fullNumZodiacMap) => {
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
        candidateNums.push({ num, weight: count * 10 + (10 - miss) + zodScore * 2 });
      }
    }

    candidateNums.sort((a, b) => b.weight - a.weight);
    return candidateNums.slice(0, targetCount).map(i => i.num);
  },

  getColdReboundNumbers: (data, targetCount, fullNumZodiacMap) => {
    const coldZodiacs = Object.entries(data.zodMiss || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(i => i[0]);

    const warmTails = data.topTail.slice(0, 3).map(i => i.t);

    const candidateNums = [];
    for(let num = 1; num <= 49; num++) {
      const zod = fullNumZodiacMap.get(num);
      const tail = num % 10;
      if(coldZodiacs.includes(zod)) {
        const miss = data.zodMiss[zod] || 0;
        candidateNums.push({ num, weight: miss * 2 - (warmTails.includes(tail) ? 5 : 0) });
      }
    }

    candidateNums.sort((a, b) => b.weight - a.weight);
    return candidateNums.slice(0, targetCount).map(i => i.num);
  },

  decideAutoMode: (data) => {
    const hotCount = Object.values(data.zodCount || {}).filter((v, i) => v > 0).length;
    const coldCount = Object.entries(data.zodMiss || {})
      .filter(([_, miss]) => miss > 20).length;
    
    return coldCount > hotCount ? 'cold' : 'hot';
  },

  copyToClipboard: (text) => {
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(() => {
        Toast.show('复制成功');
      }).catch(() => {
        Toast.show('复制失败，请手动复制');
      });
    } else {
      Toast.show('复制失败，请手动复制');
    }
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
      Toast.show('暂无号码可复制');
      return;
    }
    
    const balls = hotNumberEl.querySelectorAll('.ball-item .ball');
    if(balls.length === 0) {
      Toast.show('暂无号码可复制');
      return;
    }
    
    const nums = Array.from(balls).map(ball => ball.innerText.trim()).join(' ');
    Business.copyToClipboard(nums);
  },

  copyZodiacNumbers: () => {
    const numbers = Business.extractNumbersFromBalls('zodiacFinalNumContent', '暂无精选特码可复制');
    if(numbers) Business.copyToClipboard(numbers);
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
        const data = Business.calcZodiacAnalysis(periodConfig.limit);
        
        if(!data || !data.sortedZodiacs || data.sortedZodiacs.length === 0) return;
        
        modes.forEach(mode => {
          numCounts.forEach(numCount => {
            let finalNums = [];
            
            if(mode === 'cold') {
              finalNums = Business.getColdReboundNumbers(data, numCount, fullNumZodiacMap);
            } else {
              finalNums = Business.getHotNumbers(data, numCount, fullNumZodiacMap);
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
          const special = Business.getSpecial(drawItem);
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

  favoriteZodiacNumbers: () => {
    const zodiacFinalNumContent = document.getElementById('zodiacFinalNumContent');
    if(!zodiacFinalNumContent) {
      Toast.show('暂无精选特码可收藏');
      return;
    }
    
    const ballItems = zodiacFinalNumContent.querySelectorAll('.ball-item .ball');
    if(ballItems.length === 0) {
      Toast.show('暂无精选特码可收藏');
      return;
    }
    
    const numbers = Array.from(ballItems).map(ball => parseInt(ball.innerText.trim()));
    
    Business.saveSpecialToHistory(numbers);
    
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
      Toast.show('该方案已收藏');
      return;
    }
    
    const newFavorites = [...state.favorites, filterItem];
    StateManager.setState({ favorites: newFavorites }, false);
    Storage.set('favorites', newFavorites);
    Toast.show('收藏成功并已记录');
    
    setTimeout(() => {
      Business.saveAnalysisToRecord();
    }, 300);
  },



  switchSpecialHistoryMode: (mode) => {
    if(!['all', 'hot', 'cold'].includes(mode)) return;
    
    const state = StateManager._state;
    const currentMode = state.specialHistoryModeFilter || 'all';
    
    if(currentMode === mode) return;
    
    StateManager.setState({ specialHistoryModeFilter: mode }, false);
    
    document.querySelectorAll('.special-history-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    AnalysisView.renderSpecialHistory();
    
    const modeText = mode === 'all' ? '全部' : mode === 'hot' ? '热号模式' : '冷号反弹';
    Toast.show(`已筛选：${modeText}`);
  },

  loadFavorite: (index) => {
    const state = StateManager._state;
    const item = state.favorites[index];
    if(!item) return;

    if(item.numbers && Array.isArray(item.numbers)) {
      StateManager.setState({
        selected: StateManager.getEmptySelected(),
        excluded: []
      });
      Toast.show('已加载精选特码收藏');
    } else {
      StateManager.setState({
        selected: Utils.deepClone(item.selected),
        excluded: Utils.deepClone(item.excluded)
      });
      Toast.show('加载成功');
    }
  },

  renameFavorite: (index) => {
    const state = StateManager._state;
    const item = state.favorites[index];
    if(!item) return;

    InputModal.show({
      title: '重命名收藏',
      defaultValue: item.name,
      placeholder: '请输入新名称',
      onConfirm: (newName) => {
        if(!newName || newName.trim() === '') return;

        const newList = [...state.favorites];
        newList[index].name = newName.trim();
        StateManager.setState({ favorites: newList }, false);
        Storage.set('favorites', newList);
        RecordView.renderFavoriteList();
        Toast.show('重命名成功');
      }
    });
  },

  copyFavorite: (index) => {
    const state = StateManager._state;
    const item = state.favorites[index];
    if(!item) return;

    let list;
    if(item.numbers && Array.isArray(item.numbers)) {
      list = item.numbers.map(num => DataQuery.getNumAttrs(num));
    } else {
      list = Filter.getFilteredList(item.selected, item.excluded);
    }
    
    if(list.length === 0){
      Toast.show('该方案无符合条件的号码');
      return;
    }

    const numStr = list.map(n => n.s).join(' ');
    Business.copyToClipboard(numStr);
  },

  clearAllFavorites: () => {
    InputModal.confirm({
      title: '清空所有收藏',
      message: '确定清空所有收藏吗？',
      onConfirm: () => {
        StateManager.setState({ favorites: [] }, false);
        Storage.set('favorites', []);
        RecordView.renderFavoriteList();
        Toast.show('已清空所有收藏');
      }
    });
  },

  removeFavorite: (index) => {
    const state = StateManager._state;
    const newList = [...state.favorites];
    newList.splice(index, 1);
    StateManager.setState({ favorites: newList }, false);
    Storage.set('favorites', newList);
    RecordView.renderFavoriteList();
    Toast.show('已删除');
  },

  toggleSpecialHistory: () => {
    try {
      const state = StateManager._state;
      const newExpanded = !state.specialHistoryExpanded;
      StateManager.setState({ specialHistoryExpanded: newExpanded }, false);
      AnalysisView.renderSpecialHistory();
    } catch(e) {
      console.error('切换精选特码历史展开状态失败', e);
    }
  },

  clearSpecialHistory: () => {
    InputModal.confirm({
      title: '清空历史',
      message: '确定清空所有精选特码历史吗？',
      onConfirm: () => {
        Storage.clearSpecialHistory();
        StateManager.setState({ specialHistory: [] }, false);
        AnalysisView.renderSpecialHistory();
        Toast.show('已清空');
      }
    });
  },

  selectAllSpecialFilters: () => {
    const periodBtns = document.querySelectorAll('.special-period-btn');
    const numBtns = document.querySelectorAll('.special-num-btn');
    
    ['10', '20', '30', 'all'].forEach(val => {
      periodBtns.forEach(btn => {
        if(btn.dataset.period === val) {
          btn.classList.add('active');
          btn.style.background = 'var(--primary)';
          btn.style.color = '#fff';
        }
      });
    });
    
    ['5', '10', '15', '20'].forEach(val => {
      numBtns.forEach(btn => {
        if(btn.dataset.num === val) {
          btn.classList.add('active');
          btn.style.background = 'var(--primary)';
          btn.style.color = '#fff';
        }
      });
    });
    
    AnalysisView.renderSpecialHistory();
    Business.togglePanel('specialFiltersPanel');
  },

  resetSpecialFilters: () => {
    const periodBtns = document.querySelectorAll('.special-period-btn');
    const numBtns = document.querySelectorAll('.special-num-btn');
    
    periodBtns.forEach(btn => {
      btn.classList.remove('active');
      btn.style.background = '';
      btn.style.color = '';
      if(btn.dataset.period === '10') {
        btn.classList.add('active');
        btn.style.background = 'var(--primary)';
        btn.style.color = '#fff';
      }
    });
    
    numBtns.forEach(btn => {
      btn.classList.remove('active');
      btn.style.background = '';
      btn.style.color = '';
      if(btn.dataset.num === '5') {
        btn.classList.add('active');
        btn.style.background = 'var(--primary)';
        btn.style.color = '#fff';
      }
    });
    
    AnalysisView.renderSpecialHistory();
    Business.togglePanel('specialFiltersPanel');
  },

  confirmSpecialFilters: () => {
    AnalysisView.renderSpecialHistory();
    Business.togglePanel('specialFiltersPanel');
  },

  toggleSpecialFiltersPanel: () => {
    Business.togglePanel('specialFiltersPanel', '切换精选特码筛选面板失败');
  },

  togglePanel: (panelId, errorMsg) => {
    try {
      const panel = document.getElementById(panelId);
      if(panel) {
        panel.style.display = panel.style.display === 'none' || !panel.style.display ? 'block' : 'none';
      }
    } catch(e) {
      console.error(errorMsg || '切换面板失败', e);
    }
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
          
          const data = Business.calcZodiacAnalysis();
          
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

  clearZodiacPredictionHistory: () => {
    InputModal.confirm({
      title: '清空预测历史',
      message: '确定要清空预测历史吗？',
      onConfirm: () => {
        Storage.clearZodiacPredictionHistory();
        AnalysisView.renderZodiacPredictionHistory();
        Toast.show('已清空预测历史');
      }
    });
  },

  selectAllPredictionPeriods: () => {
    const btns = document.querySelectorAll('.prediction-period-btn');
    btns.forEach(btn => {
      btn.classList.add('active');
      btn.style.background = 'var(--primary)';
      btn.style.color = '#fff';
    });
    Storage.savePredictionHistoryFilter();
    AnalysisView.renderZodiacPredictionHistory();
    Business.togglePanel('predictionFiltersPanel');
  },

  resetPredictionPeriods: () => {
    const btns = document.querySelectorAll('.prediction-period-btn');
    btns.forEach(btn => {
      btn.classList.remove('active');
      btn.style.background = '';
      btn.style.color = '';
      if(btn.dataset.period === '10') {
        btn.classList.add('active');
        btn.style.background = 'var(--primary)';
        btn.style.color = '#fff';
      }
    });
    Storage.savePredictionHistoryFilter();
    AnalysisView.renderZodiacPredictionHistory();
    Business.togglePanel('predictionFiltersPanel');
  },

  togglePredictionFiltersPanel: () => {
    Business.togglePanel('predictionFiltersPanel', '切换预测历史筛选面板失败');
  },

  confirmPredictionFilters: () => {
    Storage.savePredictionHistoryFilter();
    AnalysisView.renderZodiacPredictionHistory();
    Business.togglePanel('predictionFiltersPanel');
  },

  toggleZodiacPredictionHistory: () => {
    const toggleEl = document.getElementById('zodiacPredictionHistoryToggle');
    const historyListEl = document.getElementById('zodiacPredictionHistoryList');
    
    if(!toggleEl || !historyListEl) return;
    
    const history = Storage.loadZodiacPredictionHistory();
    const btn = toggleEl.querySelector('button');
    
    if(history.length <= 5) return;
    
    const isExpanded = btn && btn.innerText.includes('收起');
    
    if(!isExpanded) {
      let html = '';
      history.forEach((item, idx) => {
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
      if(btn) btn.innerText = '收起更多';
    } else {
      AnalysisView.renderZodiacPredictionHistory();
      if(btn) btn.innerText = '展开更多';
    }
  },

  refreshHotCold: () => {
    Render.buildNumList();
    FilterView.renderResult();
    Toast.show('冷热号已刷新');
  },

  quickLottery: (count) => {
    const filteredList = Filter.getFilteredList();
    if(filteredList.length === 0) {
      Toast.show('没有符合条件的号码');
      return;
    }

    const result = [];
    const shuffled = [...filteredList].sort(() => Math.random() - 0.5);

    for(let i = 0; i < Math.min(count, shuffled.length); i++) {
      result.push(shuffled[i]);
    }

    AnalysisView.displayLotteryResult(result);

    const smartHistory = Storage.get('smartHistory', []);
    smartHistory.unshift({
      timestamp: Date.now(),
      count: result.length,
      result: result.map(n => n.s)
    });
    if(smartHistory.length > 50) smartHistory.length = 50;
    Storage.set('smartHistory', smartHistory);
    AnalysisView.renderSmartHistory();
  },

  runLottery: () => {
    const countInput = document.getElementById('lotteryCount');
    const count = countInput ? parseInt(countInput.value) || 5 : 5;
    Business.quickLottery(count);
  },

  excludeLotteryResult: () => {
    const resultEl = document.getElementById('lotteryResult');
    if(!resultEl) return;

    const balls = resultEl.querySelectorAll('.result-ball');
    if(balls.length === 0) {
      Toast.show('没有机选结果可以排除');
      return;
    }

    const state = StateManager._state;
    const newExcluded = [...state.excluded];
    const newHistory = [...state.excludeHistory];

    balls.forEach(ball => {
      const num = parseInt(ball.dataset.num);
      if(!newExcluded.includes(num)) {
        newExcluded.push(num);
        newHistory.push([num, 'in']);
      }
    });

    StateManager.setState({ excluded: newExcluded, excludeHistory: newHistory });
    Toast.show(`已排除${balls.length}个号码`);
  },

  clearSmartHistory: () => {
    InputModal.confirm({
      title: '清空历史',
      message: '确定清空机选历史吗？',
      onConfirm: () => {
        Storage.remove('smartHistory');
        AnalysisView.renderSmartHistory();
        Toast.show('已清空历史');
      }
    });
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

  toggleRecordDetail: (index) => {
    const detailEl = document.getElementById('recordDetail' + index);
    if (detailEl) {
      const isHidden = detailEl.style.display === 'none';
      detailEl.style.display = isHidden ? 'block' : 'none';
    }
  },

  deleteRecord: (recordId) => {
    const recordIdNum = Number(recordId);
    const records = Storage.loadRecordHistory();
    const record = records.find(r => r.id === recordIdNum);
    if(record) {
      if(confirm(`确定删除第 ${record.expect || '--'} 期的记录吗？`)) {
        const success = Storage.deleteRecordById(recordIdNum);
        if(success) {
          RecordView.renderRecordList();
          Toast.show('记录已删除');
        }
      }
    } else {
      Toast.show('记录不存在或已被删除');
    }
  },

  clearRecordHistory: () => {
    if (confirm('确定要清空所有记录吗？此操作不可恢复。')) {
      Storage.clearRecordHistory();
      RecordView.renderRecordList();
      Toast.show('已清空所有记录');
    }
  },

  refreshRecord: () => {
    RecordView.renderRecordList();
    Toast.show('记录已刷新');
  },

  _lastSaveTime: 0,
  _lastSaveHash: '',

  saveAnalysisToRecord: () => {
    try {
      const now = Date.now();
      if(now - Business._lastSaveTime < 1000) {
        console.log('保存间隔太短，跳过');
        return;
      }

      const state = StateManager._state;
      const historyData = state.analysis.historyData;
      
      if (!historyData || historyData.length === 0) {
        return;
      }
      
      const latestExpect = historyData[0]?.expect || null;
      
      const selectedZodiacs = [];
      const selectedZodiacsGrid = document.getElementById('selectedZodiacsGrid');
      if (selectedZodiacsGrid) {
        selectedZodiacsGrid.querySelectorAll('.selected-zodiac-item').forEach(item => {
          const nameEl = item.querySelector('.zodiac-name');
          if (nameEl) {
            selectedZodiacs.push(nameEl.textContent);
          }
        });
      }
      
      let zodiacPrediction = [];
      const zodiacPredictionGrid = document.getElementById('zodiacPredictionGrid');
      if (zodiacPredictionGrid) {
        zodiacPredictionGrid.querySelectorAll('.zodiac-prediction-item').forEach(item => {
          const zodiacEl = item.querySelector('.zodiac-prediction-zodiac');
          const scoreEl = item.querySelector('.zodiac-prediction-score');
          if (zodiacEl && scoreEl) {
            zodiacPrediction.push({
              zodiac: zodiacEl.textContent,
              score: parseFloat(scoreEl.textContent) || 0
            });
          }
        });
      }
      
      let specialNumbers = [];
      const zodiacFinalNumContent = document.getElementById('zodiacFinalNumContent');
      if (zodiacFinalNumContent) {
        const ballElements = zodiacFinalNumContent.querySelectorAll('.ball');
        ballElements.forEach(ball => {
          const num = parseInt(ball.textContent);
          if (num) {
            specialNumbers.push(num);
          }
        });
      }
      
      let hotNumbers = [];
      const hotNumberEl = document.getElementById('hotNumber');
      if (hotNumberEl) {
        const numbers = hotNumberEl.textContent.split(/[、,，\s]+/).filter(n => n.trim());
        hotNumbers = numbers.map(n => parseInt(n)).filter(n => !isNaN(n));
      }
      
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

      if(dataHash === Business._lastSaveHash) {
        console.log('数据未变化，跳过保存');
        return;
      }
      Business._lastSaveHash = dataHash;
      Business._lastSaveTime = now;
      
      Storage.saveRecordHistory(recordData);
      console.log('分析数据已保存到记录');
      RecordView.renderRecordList();
    } catch (e) {
      console.error('保存分析数据到记录失败', e);
    }
  },

  _autoRefreshDrawResults: () => {
    try {
      const state = StateManager._state;
      const historyData = state.analysis.historyData || [];
      
      if(historyData.length === 0) return;
      
      const specialHistory = state.specialHistory;
      let updated = false;
      const newHistory = specialHistory.map(item => {
        if(item.drawResult !== null) return item;
        
        if(item.predictExpect) {
          const drawItem = historyData.find(d => d.expect === item.predictExpect);
          
          if(drawItem) {
            const special = Business.getSpecial(drawItem);
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
        console.log('自动更新开奖结果完成');
      }
    } catch(e) {
      console.error('自动更新开奖结果失败', e);
    }
  },

  startDrawResultAutoRefresh: () => {
    setInterval(() => {
      Business._autoRefreshDrawResults();
    }, 5 * 60 * 1000);
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
  }
};