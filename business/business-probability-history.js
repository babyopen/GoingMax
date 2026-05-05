/**
 * 概率学推荐历史记录业务模块
 * @description 记录概率学推荐结果并计算正确率
 */
const BusinessProbabilityHistory = {
  _currentRecommend: null,
  _lastCheckExpect: null,

  _loadRecords: () => {
    const records = Storage.get('probability_history', null);
    if(records && Array.isArray(records)) return records;
    return [];
  },

  _saveRecords: (records) => {
    const maxRecords = 50;
    const toSave = records.slice(0, maxRecords);
    Storage.set('probability_history', toSave);
  },

  setCurrentRecommend: (recommend, scores) => {
    if(!recommend || recommend.length === 0) return;

    const state = StateManager._state;
    const historyData = state.analysis.historyData;
    if(!historyData || historyData.length === 0) return;

    const latestExpect = historyData[0]?.expect;
    if(!latestExpect) return;

    const latestPeriodNum = parseInt(latestExpect);
    if(isNaN(latestPeriodNum)) return;

    const nextExpect = String(latestPeriodNum + 1).padStart(6, '0');

    const existingRecords = BusinessProbabilityHistory._loadRecords();
    const alreadyExists = existingRecords.some(r => r.expect === nextExpect);
    if(alreadyExists) return;

    BusinessProbabilityHistory._currentRecommend = {
      expect: nextExpect,
      recommendation: recommend.map(z => z.name || z),
      scores: scores || {},
      timestamp: Date.now()
    };
    Storage.set('probability_current_recommend', BusinessProbabilityHistory._currentRecommend);
  },

  checkAndUpdate: () => {
    const state = StateManager._state;
    const historyData = state.analysis.historyData;
    if(!historyData || historyData.length === 0) return;

    let currentRec = BusinessProbabilityHistory._currentRecommend;
    if(!currentRec) {
      currentRec = Storage.get('probability_current_recommend', null);
      if(currentRec) BusinessProbabilityHistory._currentRecommend = currentRec;
    }
    if(!currentRec) return;

    const latestExpect = historyData[0]?.expect;
    if(!latestExpect || latestExpect === BusinessProbabilityHistory._lastCheckExpect) return;

    const targetExpect = currentRec.expect;
    const targetItem = historyData.find(item => item.expect === targetExpect);
    if(!targetItem) return;

    const s = DataQuery.getSpecial(targetItem);
    if(!s || !s.zod) return;

    const openedZodiac = s.zod;
    const isHit = currentRec.recommendation.includes(openedZodiac);

    const records = BusinessProbabilityHistory._loadRecords();
    records.unshift({
      id: Date.now().toString(),
      expect: targetExpect,
      recommendation: currentRec.recommendation,
      scores: currentRec.scores,
      openedZodiac: openedZodiac,
      isHit: isHit,
      createdAt: new Date().toISOString().split('T')[0]
    });

    BusinessProbabilityHistory._saveRecords(records);
    BusinessProbabilityHistory._lastCheckExpect = latestExpect;
    BusinessProbabilityHistory._currentRecommend = null;
    Storage.remove('probability_current_recommend');
  },

  getHistoryData: () => {
    BusinessProbabilityHistory.checkAndUpdate();

    const records = BusinessProbabilityHistory._loadRecords();
    const totalRecords = records.length;
    const totalHits = records.filter(r => r.isHit).length;
    const accuracy = totalRecords > 0 ? Math.round(totalHits / totalRecords * 100) : 0;

    const last10 = records.slice(0, 10);
    const last10Hits = last10.filter(r => r.isHit).length;
    const last10Accuracy = last10.length > 0 ? Math.round(last10Hits / last10.length * 100) : 0;

    return {
      records: records.slice(0, 10),
      stats: {
        totalRecords,
        totalHits,
        accuracy,
        last10Count: last10.length,
        last10Hits,
        last10Accuracy
      }
    };
  }
};
