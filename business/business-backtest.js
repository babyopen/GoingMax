/**
 * Gemini 预测回测与准确率追踪模块
 * @description 追踪 Gemini 引擎预测结果、自动对比实际开奖、计算准确率统计
 * @layer business (禁止DOM操作)
 */
const BusinessBacktest = {

  _loadPredictions: () => {
    try {
      const stored = Storage.get('gemini_backtest_predictions');
      return Array.isArray(stored) ? stored : [];
    } catch (e) {
      return [];
    }
  },

  _savePredictions: (predictions) => {
    try {
      const trimmed = predictions.slice(-200);
      Storage.set('gemini_backtest_predictions', trimmed);
    } catch (e) {}
  },

  track: (predictResult) => {
    if (!predictResult || !predictResult.nextPeriod) return;

    const predictions = BusinessBacktest._loadPredictions();
    const nextExpect = String(predictResult.nextPeriod).trim();
    const alreadyExists = predictions.some(p => String(p.expect).trim() === nextExpect);

    if (alreadyExists) return;

    const entry = {
      expect: nextExpect,
      mainZodiac: (predictResult.strategy && predictResult.strategy.mainZodiac) || [],
      backupZodiac: (predictResult.strategy && predictResult.strategy.backupZodiac) || [],
      marketMode: predictResult.marketMode || '未知',
      trackedAt: Date.now(),
      actualZodiac: null,
      isMainHit: false,
      isBackupHit: false,
      checked: false
    };

    predictions.push(entry);
    BusinessBacktest._savePredictions(predictions);
  },

  checkHistory: () => {
    const state = StateManager._state;
    const historyData = state.analysis.historyData;
    if (!historyData || historyData.length === 0) return;

    const predictions = BusinessBacktest._loadPredictions();
    let updated = false;

    for (let i = 0; i < predictions.length; i++) {
      const p = predictions[i];
      if (p.checked) continue;

      const drawItem = historyData.find(d => String(d.expect).trim() === String(p.expect).trim());
      if (!drawItem) continue;

      const special = DataQuery.getSpecial(drawItem);
      p.actualZodiac = special && special.zod ? special.zod : null;
      p.isMainHit = p.actualZodiac ? p.mainZodiac.includes(p.actualZodiac) : false;
      p.isBackupHit = p.actualZodiac ? p.backupZodiac.includes(p.actualZodiac) : false;
      p.checked = true;
      updated = true;
    }

    if (updated) {
      BusinessBacktest._savePredictions(predictions);
    }
  },

  getStats: () => {
    const predictions = BusinessBacktest._loadPredictions();
    const checked = predictions.filter(p => p.checked);
    const total = checked.length;

    if (total === 0) {
      return {
        total: 0,
        mainHit: 0,
        mainRate: 0,
        backupHit: 0,
        backupRate: 0,
        totalHit: 0,
        totalRate: 0,
        recent10: null,
        byMode: {}
      };
    }

    const mainHit = checked.filter(p => p.isMainHit).length;
    const backupHit = checked.filter(p => p.isBackupHit).length;
    const totalHit = checked.filter(p => p.isMainHit || p.isBackupHit).length;

    const recent10 = checked.slice(-10);
    const recent10Total = recent10.length;
    const recent10Hit = recent10.filter(p => p.isMainHit || p.isBackupHit).length;

    const byMode = {};
    checked.forEach(p => {
      const mode = p.marketMode || '未知';
      if (!byMode[mode]) byMode[mode] = { total: 0, mainHit: 0 };
      byMode[mode].total++;
      if (p.isMainHit) byMode[mode].mainHit++;
    });

    Object.keys(byMode).forEach(mode => {
      const m = byMode[mode];
      m.mainRate = m.total > 0 ? Math.round((m.mainHit / m.total) * 1000) / 10 : 0;
    });

    return {
      total,
      mainHit,
      mainRate: total > 0 ? Math.round((mainHit / total) * 1000) / 10 : 0,
      backupHit,
      backupRate: total > 0 ? Math.round((backupHit / total) * 1000) / 10 : 0,
      totalHit,
      totalRate: total > 0 ? Math.round((totalHit / total) * 1000) / 10 : 0,
      recent10: recent10Total > 0 ? {
        total: recent10Total,
        hit: recent10Hit,
        rate: Math.round((recent10Hit / recent10Total) * 1000) / 10
      } : null,
      byMode
    };
  },

  getRecords: (limit) => {
    const predictions = BusinessBacktest._loadPredictions();
    const sorted = predictions.filter(p => p.checked).sort((a, b) => {
      const aNum = parseInt(String(a.expect).trim()) || 0;
      const bNum = parseInt(String(b.expect).trim()) || 0;
      return bNum - aNum;
    });
    return limit ? sorted.slice(0, limit) : sorted;
  },

  getPendingCount: () => {
    const predictions = BusinessBacktest._loadPredictions();
    return predictions.filter(p => !p.checked).length;
  },

  _loadChasePredictions: () => {
    try {
      const stored = Storage.get('backtest_chase_predictions');
      return Array.isArray(stored) ? stored : [];
    } catch (e) { return []; }
  },

  _saveChasePredictions: (predictions) => {
    try { Storage.set('backtest_chase_predictions', predictions.slice(-200)); } catch (e) {}
  },

  _loadProbPredictions: () => {
    try {
      const stored = Storage.get('backtest_probability_predictions');
      return Array.isArray(stored) ? stored : [];
    } catch (e) { return []; }
  },

  _saveProbPredictions: (predictions) => {
    try { Storage.set('backtest_probability_predictions', predictions.slice(-200)); } catch (e) {}
  },

  _getNextExpect: () => {
    const state = StateManager._state;
    const historyData = state.analysis.historyData;
    if (!historyData || historyData.length === 0) return null;
    const latestExpect = historyData[0]?.expect;
    if (!latestExpect) return null;
    const num = parseInt(String(latestExpect).trim());
    return isNaN(num) ? null : String(num + 1);
  },

  trackChase: (chaseResult) => {
    if (!chaseResult || !chaseResult.chasePeriods) return;

    const predictions = BusinessBacktest._loadChasePredictions();
    const chasePeriods = chaseResult.chasePeriods;

    for (let i = 0; i < chasePeriods.length; i++) {
      const period = chasePeriods[i];
      const expect = String(period.expect).trim();
      if (predictions.some(p => String(p.expect).trim() === expect)) continue;

      predictions.push({
        expect,
        recommendation: (period.recommendation || []).slice(),
        backupRecommendation: (chaseResult.backupRecommendation || []).slice(),
        status: period.status || 'pending',
        trackedAt: Date.now(),
        actualZodiac: null,
        isHit: false,
        isBackupHit: false,
        checked: false
      });
    }

    BusinessBacktest._saveChasePredictions(predictions);
  },

  checkChaseHistory: () => {
    const state = StateManager._state;
    const historyData = state.analysis.historyData;
    if (!historyData || historyData.length === 0) return;

    const predictions = BusinessBacktest._loadChasePredictions();
    let updated = false;

    for (let i = 0; i < predictions.length; i++) {
      const p = predictions[i];
      if (p.checked) continue;

      const drawItem = historyData.find(d => String(d.expect).trim() === String(p.expect).trim());
      if (!drawItem) continue;

      const special = DataQuery.getSpecial(drawItem);
      p.actualZodiac = (special && special.zod) ? special.zod : null;
      p.isHit = p.actualZodiac ? p.recommendation.includes(p.actualZodiac) : false;
      p.isBackupHit = p.actualZodiac ? (p.backupRecommendation || []).includes(p.actualZodiac) : false;
      p.checked = true;
      updated = true;
    }

    if (updated) BusinessBacktest._saveChasePredictions(predictions);
  },

  getChaseStats: () => {
    const predictions = BusinessBacktest._loadChasePredictions();
    const checked = predictions.filter(p => p.checked);
    const total = checked.length;

    if (total === 0) return { total: 0, mainHit: 0, mainRate: 0, backupHit: 0, backupRate: 0, combinedHit: 0, combinedRate: 0, recent10: null };

    const mainHit = checked.filter(p => p.isHit).length;
    const backupHit = checked.filter(p => p.isBackupHit).length;
    const combinedHit = checked.filter(p => p.isHit || p.isBackupHit).length;
    const recent10 = checked.slice(-10);
    const recent10Total = recent10.length;
    const recent10MainHit = recent10.filter(p => p.isHit).length;
    const recent10BackupHit = recent10.filter(p => p.isBackupHit).length;

    return {
      total,
      mainHit,
      mainRate: Math.round((mainHit / total) * 1000) / 10,
      backupHit,
      backupRate: Math.round((backupHit / total) * 1000) / 10,
      combinedHit,
      combinedRate: Math.round((combinedHit / total) * 1000) / 10,
      recent10: recent10Total > 0 ? {
        total: recent10Total,
        mainHit: recent10MainHit,
        backupHit: recent10BackupHit,
        rate: Math.round(((recent10MainHit + recent10BackupHit) / recent10Total) * 1000) / 10
      } : null
    };
  },

  getChaseRecords: (limit) => {
    const predictions = BusinessBacktest._loadChasePredictions();
    const sorted = predictions.filter(p => p.checked)
      .sort((a, b) => (parseInt(String(b.expect).trim()) || 0) - (parseInt(String(a.expect).trim()) || 0));
    return limit ? sorted.slice(0, limit) : sorted;
  },

  getChasePendingCount: () => {
    return BusinessBacktest._loadChasePredictions().filter(p => !p.checked).length;
  },

  trackProbability: (probResult) => {
    if (!probResult || !probResult.recommend || probResult.recommend.length === 0) return;

    const nextExpect = BusinessBacktest._getNextExpect();
    if (!nextExpect) return;

    const predictions = BusinessBacktest._loadProbPredictions();
    if (predictions.some(p => String(p.expect).trim() === nextExpect)) return;

    predictions.push({
      expect: nextExpect,
      recommend: probResult.recommend.slice(),
      recommendScores: probResult.recommendScores || {},
      phase: probResult.phase || '',
      rhythmWindow: probResult.rhythmWindow || 0,
      trackedAt: Date.now(),
      actualZodiac: null,
      isHit: false,
      checked: false
    });

    BusinessBacktest._saveProbPredictions(predictions);
  },

  checkProbabilityHistory: () => {
    const state = StateManager._state;
    const historyData = state.analysis.historyData;
    if (!historyData || historyData.length === 0) return;

    const predictions = BusinessBacktest._loadProbPredictions();
    let updated = false;

    for (let i = 0; i < predictions.length; i++) {
      const p = predictions[i];
      if (p.checked) continue;

      const drawItem = historyData.find(d => String(d.expect).trim() === String(p.expect).trim());
      if (!drawItem) continue;

      const special = DataQuery.getSpecial(drawItem);
      p.actualZodiac = (special && special.zod) ? special.zod : null;
      p.isHit = p.actualZodiac ? p.recommend.includes(p.actualZodiac) : false;
      p.checked = true;
      updated = true;
    }

    if (updated) BusinessBacktest._saveProbPredictions(predictions);
  },

  getProbabilityStats: () => {
    const predictions = BusinessBacktest._loadProbPredictions();
    const checked = predictions.filter(p => p.checked);
    const total = checked.length;

    if (total === 0) return { total: 0, hit: 0, hitRate: 0, recent10: null };

    const hit = checked.filter(p => p.isHit).length;
    const recent10 = checked.slice(-10);
    const recent10Total = recent10.length;
    const recent10Hit = recent10.filter(p => p.isHit).length;

    return {
      total,
      hit,
      hitRate: Math.round((hit / total) * 1000) / 10,
      recent10: recent10Total > 0 ? {
        total: recent10Total,
        hit: recent10Hit,
        rate: Math.round((recent10Hit / recent10Total) * 1000) / 10
      } : null
    };
  },

  getProbabilityRecords: (limit) => {
    const predictions = BusinessBacktest._loadProbPredictions();
    const sorted = predictions.filter(p => p.checked)
      .sort((a, b) => (parseInt(String(b.expect).trim()) || 0) - (parseInt(String(a.expect).trim()) || 0));
    return limit ? sorted.slice(0, limit) : sorted;
  },

  checkAll: () => {
    BusinessBacktest.checkHistory();
    BusinessBacktest.checkChaseHistory();
    BusinessBacktest.checkProbabilityHistory();
  }
};
