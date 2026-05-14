/**
 * 频率评级表计算层
 * @description 多窗口(12/24/36期)统计特码生肖频次、遗漏、区域分级、willDrop判断
 * @layer business (禁止DOM操作)
 */
const BusinessFrequencyRating = {

  ZONE_ORDER: ['peak', 'high', 'mid', 'low', 'wait'],

  ZONE_LABELS: {
    peak: '顶峰区',
    high: '高频区',
    mid: '中频区',
    low: '低频区',
    wait: '等待区'
  },

  ZONE_STORAGE_KEYS: {
    12: 'ZONE_PREV_ZONE_p12',
    24: 'ZONE_PREV_ZONE_p24',
    36: 'ZONE_PREV_ZONE_p36'
  },

  _getZone: (count) => {
    if (count >= 4) return 'peak';
    if (count === 3) return 'high';
    if (count === 2) return 'mid';
    if (count === 1) return 'low';
    return 'wait';
  },

  _getZodiacsFromSpecial: (item) => {
    if (!item || !item.zodiac) return [];
    if (typeof item.zodiac === 'string') {
      return item.zodiac.split(',').map(z => z.trim());
    }
    return [];
  },

  _calcWindow: (windowData, zodiacs) => {
    const result = {};
    zodiacs.forEach(z => {
      result[z] = { count: 0, miss: windowData.length, firstAppear: -1 };
    });

    for (let i = 0; i < windowData.length; i++) {
      const zodList = BusinessFrequencyRating._getZodiacsFromSpecial(windowData[i]);
      if (zodList.length > 0) {
        const special = zodList[zodList.length - 1];
        if (result[special]) {
          result[special].count++;
          if (result[special].firstAppear === -1) {
            result[special].firstAppear = i;
          }
          const miss = i;
          if (miss < result[special].miss) {
            result[special].miss = miss;
          }
        }
      }
    }

    return result;
  },

  _calcWillDrop: (windowData, zodiacStats, zodiac) => {
    if (!windowData || windowData.length === 0) return false;
    if (!zodiacStats[zodiac] || zodiacStats[zodiac].count === 0) return false;
    const oldestAppear = zodiacStats[zodiac].firstAppear;
    if (oldestAppear === -1) return false;
    return oldestAppear === windowData.length - 1;
  },

  calcWindowData: (historyData, windowSize) => {
    if (!historyData || historyData.length < windowSize) return null;
    const windowData = historyData.slice(0, windowSize);
    const allZodiacs = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
    const rawStats = BusinessFrequencyRating._calcWindow(windowData, allZodiacs);
    const stats = {};
    allZodiacs.forEach(z => {
      const raw = rawStats[z];
      const zone = BusinessFrequencyRating._getZone(raw.count);
      const willDrop = BusinessFrequencyRating._calcWillDrop(windowData, rawStats, z);
      stats[z] = {
        count: raw.count,
        miss: raw.miss,
        zone,
        willDrop
      };
    });
    return {
      windowSize,
      windowData,
      stats,
      rawStats
    };
  },

  calcFrequencyRating: (historyData) => {
    if (!historyData || historyData.length === 0) return { error: '无历史数据' };
    if (historyData.length < 12) return { error: '数据不足' };

    const windows = [12, 24, 36];
    const results = {};

    windows.forEach(size => {
      if (historyData.length >= size) {
        results['p' + size] = BusinessFrequencyRating.calcWindowData(historyData, size);
      }
    });

    return {
      historyData,
      windows: results
    };
  },

  getZonePrevZones: () => {
    const storageKeys = BusinessFrequencyRating.ZONE_STORAGE_KEYS;
    const prevZones = {};
    Object.keys(storageKeys).forEach(size => {
      try {
        const stored = localStorage.getItem(storageKeys[size]);
        prevZones['p' + size] = stored ? JSON.parse(stored) : {};
      } catch (e) {
        prevZones['p' + size] = {};
      }
    });
    return prevZones;
  },

  saveZonePrevZones: (allZodiacStats, prevZones) => {
    Object.keys(allZodiacStats).forEach(key => {
      const stats = allZodiacStats[key].stats;
      const zoneKey = BusinessFrequencyRating.ZONE_STORAGE_KEYS[key.replace('p', '')];
      if (!zoneKey) return;
      const newPrev = {};
      Object.keys(stats).forEach(z => {
        newPrev[z] = stats[z].zone;
      });
      const oldPrev = prevZones[key] || {};
      const changed = Object.keys(newPrev).some(z => newPrev[z] !== oldPrev[z]);
      if (changed) {
        try {
          localStorage.setItem(zoneKey, JSON.stringify(newPrev));
        } catch (e) {}
      }
    });
  },

  buildGroupedByZone: (windowResult) => {
    if (!windowResult) return {};
    const grouped = {};
    BusinessFrequencyRating.ZONE_ORDER.forEach(zone => {
      grouped[zone] = [];
    });
    const stats = windowResult.stats;
    Object.keys(stats).forEach(z => {
      const s = stats[z];
      if (grouped[s.zone]) {
        grouped[s.zone].push({ zodiac: z, ...s });
      }
    });
    return grouped;
  },

  buildRenderData: (freqResult, prevZones) => {
    if (freqResult.error) return { error: freqResult.error };
    const windows = freqResult.windows;
    const cards = [];
    [12, 24, 36].forEach(size => {
      const key = 'p' + size;
      if (windows[key]) {
        const grouped = BusinessFrequencyRating.buildGroupedByZone(windows[key]);
        const prevZone = prevZones[key] || {};
        cards.push({
          windowSize: size,
          grouped,
          prevZone,
          stats: windows[key].stats
        });
      }
    });
    return { cards };
  }
};