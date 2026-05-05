/**
 * 应用监控器 - 检测新开奖并自动刷新
 * @description 每天 21:33 开奖后自动检查并刷新数据
 * @layer business (禁止DOM操作)
 */
const AppMonitor = {
  _timer: null,
  _lastKnownExpect: null,
  _isInitialized: false,
  _DRAW_HOUR: 21,
  _DRAW_MINUTE: 33,
  _CHECK_DELAY: 5 * 60 * 1000,

  start: () => {
    if(AppMonitor._isInitialized) return;
    AppMonitor._isInitialized = true;

    const historyData = StateManager._state.analysis.historyData;
    if(historyData && historyData.length > 0) {
      AppMonitor._lastKnownExpect = historyData[0].expect;
    }

    AppMonitor._checkOnStart();
    AppMonitor._scheduleNextCheck();

    console.log('应用监控器已启动，开奖时间 21:33 后自动检查');
  },

  _checkOnStart: async () => {
    const cacheTime = Storage.get(Storage.KEYS.HISTORY_CACHE_TIME, 0);
    const now = Date.now();
    const isExpired = (now - cacheTime) > Storage.CACHE_DURATION;

    if(isExpired) {
      console.log('缓存已过期，启动时立即刷新...');
      await AppMonitor._check();
    } else {
      console.log('缓存有效，等待下次开奖后刷新');
    }
  },

  stop: () => {
    if(AppMonitor._timer) {
      clearTimeout(AppMonitor._timer);
      AppMonitor._timer = null;
    }
    console.log('应用监控器已停止');
  },

  _getNextCheckTime: () => {
    const now = new Date();
    const checkTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(),
                               AppMonitor._DRAW_HOUR, AppMonitor._DRAW_MINUTE, 0);
    checkTime.setTime(checkTime.getTime() + AppMonitor._CHECK_DELAY);

    if(checkTime <= now) {
      checkTime.setDate(checkTime.getDate() + 1);
    }

    return checkTime;
  },

  _scheduleNextCheck: () => {
    const checkTime = AppMonitor._getNextCheckTime();
    const now = new Date();
    const delay = checkTime.getTime() - now.getTime();

    const hours = Math.floor(delay / 1000 / 60 / 60);
    const mins = Math.round((delay / 1000 / 60) % 60);
    console.log('下次检查:', checkTime.toLocaleString(), `(${hours}小时${mins}分钟后)`);

    AppMonitor._timer = setTimeout(async () => {
      await AppMonitor._check();
      AppMonitor._scheduleNextCheck();
    }, delay);
  },

  _check: async () => {
    try {
      console.log('开始检查新开奖...');

      const year = new Date().getFullYear();
      const res = await fetch(CONFIG.API.HISTORY + year);
      const data = await res.json();
      let rawData = data.data || [];
      rawData = rawData.filter(item => {
        const expect = item.expect || '';
        const openCode = item.openCode || '';
        return expect && openCode && openCode.split(',').length === 7;
      });

      if(rawData.length === 0) {
        console.log('无新数据');
        return;
      }

      rawData.sort((a, b) => Number(b.expect || 0) - Number(a.expect || 0));
      const latestExpect = rawData[0].expect;

      if(latestExpect === AppMonitor._lastKnownExpect) {
        console.log('期号未变化:', latestExpect);
        return;
      }

      console.log('检测到新开奖:', AppMonitor._lastKnownExpect, '→', latestExpect);
      await AppMonitor._refreshFromServer(rawData, latestExpect);
    } catch(e) {
      console.error('监控检查失败', e);
    }
  },

  _refreshFromServer: async (rawData, newExpect) => {
    try {
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
      Storage.saveHistoryCache(sortedData);

      AppMonitor._lastKnownExpect = newExpect;

      try {
        Business.silentSaveSpecialCombinations(true);
      } catch(e) {
        console.error('后台静默保存精选特码失败', e);
      }

      try {
        BusinessAnalysis.saveAnalysisToRecord(true);
      } catch(e) {
        console.error('后台静默保存分析数据失败', e);
      }

      try {
        BusinessProbabilityHistory.checkAndUpdate();
      } catch(e) {
        console.error('后台概率学历史检测失败', e);
      }

      console.log('新开奖数据刷新完成:', newExpect);
    } catch(e) {
      console.error('新开奖刷新失败', e);
    }
  }
};
