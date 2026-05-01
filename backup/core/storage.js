/**
 * 存储模块
 * @description 统一管理本地存储，加校验和兜底，支持内存缓存、自动备份、数据恢复
 */
const Storage = {
  KEYS: Object.freeze({
    SAVED_FILTERS: 'savedFilters',
    DATA_VERSION: 'dataVersion',
    HISTORY_CACHE: 'historyCache',
    HISTORY_CACHE_TIME: 'historyCacheTime',
    LOTTERY_HISTORY: 'lotteryHistory',
    SPECIAL_HISTORY: 'specialHistory',
    ZODIAC_PREDICTION_HISTORY: 'zodiacPredictionHistory',
    PREDICTION_HISTORY_FILTER: 'predictionHistoryFilter',
    RECORD_HISTORY: 'recordHistory',
    AUTO_BACKUP: 'autoBackup',
    AUTO_BACKUP_TIME: 'autoBackupTime',
    LAST_BACKUP_DATE: 'lastBackupDate'
  }),

  CACHE_DURATION: 4 * 60 * 60 * 1000,

  LOTTERY_HISTORY_DURATION: 3 * 24 * 60 * 60 * 1000,

  SPECIAL_HISTORY_DURATION: 30 * 24 * 60 * 60 * 1000,

  SPECIAL_HISTORY_MAX_COUNT: 50,

  MEMORY_CACHE_DURATION: 5000,

  _memoryCache: {},
  _memoryCacheTime: {},

  _memoryStorage: {},

  isLocalStorageAvailable: () => {
    try {
      const testKey = '__test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch(e) {
      return false;
    }
  },

  _isCacheValid: (key) => {
    const cacheTime = Storage._memoryCacheTime[key];
    if(!cacheTime) return false;
    return Date.now() - cacheTime < Storage.MEMORY_CACHE_DURATION;
  },

  get: (key, defaultValue = null) => {
    try {
      if(Storage._isCacheValid(key)) {
        return Storage._memoryCache[key];
      }

      if(Storage.isLocalStorageAvailable()){
        const value = localStorage.getItem(key);
        const parsed = value ? JSON.parse(value) : defaultValue;
        if(parsed !== null && parsed !== defaultValue) {
          Storage._memoryCache[key] = parsed;
          Storage._memoryCacheTime[key] = Date.now();
        }
        return parsed;
      } else {
        return Storage._memoryStorage[key] || defaultValue;
      }
    } catch(e) {
      console.error('存储读取失败', e);
      if(key === Storage.KEYS.RECORD_HISTORY || key === Storage.KEYS.SPECIAL_HISTORY) {
        const backup = Storage._restoreFromBackup();
        if(backup && backup[key]) {
          return backup[key];
        }
      }
      return defaultValue;
    }
  },

  set: (key, value) => {
    try {
      Storage._memoryCache[key] = value;
      Storage._memoryCacheTime[key] = Date.now();

      const serialized = JSON.stringify(value);
      if(Storage.isLocalStorageAvailable()){
        localStorage.setItem(key, serialized);
      } else {
        Storage._memoryStorage[key] = value;
      }
      return true;
    } catch(e) {
      console.error('存储写入失败', e);
      Storage._memoryCache[key] = value;
      Storage._memoryCacheTime[key] = Date.now();
      Toast.show('保存失败，存储空间可能已满');
      return false;
    }
  },

  remove: (key) => {
    try {
      if(Storage.isLocalStorageAvailable()){
        localStorage.removeItem(key);
      } else {
        delete Storage._memoryStorage[key];
      }
      return true;
    } catch(e) {
      console.error('存储移除失败', e);
      return false;
    }
  },

  loadSavedFilters: () => {
    const savedVersion = Storage.get(Storage.KEYS.DATA_VERSION, 0);
    if(savedVersion < CONFIG.DATA_VERSION){
      Storage.set(Storage.KEYS.DATA_VERSION, CONFIG.DATA_VERSION);
    }

    const rawList = Storage.get(Storage.KEYS.SAVED_FILTERS, []);
    const validList = Array.isArray(rawList) ? rawList.filter(Utils.validateFilterItem) : [];
    StateManager.setState({ savedFilters: validList }, false);
    return validList;
  },

  saveFilter: (filterItem) => {
    const state = StateManager._state;
    const newList = [filterItem, ...state.savedFilters];
    const success = Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
    if(success) StateManager.setState({ savedFilters: newList });
    return success;
  },

  loadFavorites: () => {
    const rawList = Storage.get('favorites', []);
    const validList = Array.isArray(rawList) ? rawList.filter(Utils.validateFilterItem) : [];
    StateManager.setState({ favorites: validList }, false);
    return validList;
  },

  saveHistoryCache: (historyData) => {
    Storage.set(Storage.KEYS.HISTORY_CACHE, historyData);
    Storage.set(Storage.KEYS.HISTORY_CACHE_TIME, Date.now());
  },

  loadHistoryCache: () => {
    const cacheTime = Storage.get(Storage.KEYS.HISTORY_CACHE_TIME, 0);
    const now = Date.now();
    const historyData = Storage.get(Storage.KEYS.HISTORY_CACHE, []);
    
    if(now - cacheTime > Storage.CACHE_DURATION) {
      if(historyData && historyData.length > 0) {
        return { data: historyData, expired: true };
      }
      return { data: null, expired: true };
    }
    
    return { data: historyData, expired: false };
  },

  clearHistoryCache: () => {
    Storage.remove(Storage.KEYS.HISTORY_CACHE);
    Storage.remove(Storage.KEYS.HISTORY_CACHE_TIME);
  },

  saveLotteryHistory: (history) => {
    const data = {
      history: history,
      timestamp: Date.now()
    };
    Storage.set(Storage.KEYS.LOTTERY_HISTORY, data);
  },

  loadLotteryHistory: () => {
    const data = Storage.get(Storage.KEYS.LOTTERY_HISTORY, null);
    if(!data || !data.history || !Array.isArray(data.history)) {
      return [];
    }

    const now = Date.now();
    const threeDaysAgo = now - Storage.LOTTERY_HISTORY_DURATION;

    const filteredHistory = data.history.filter(item => {
      const itemTime = item.timestamp || data.timestamp || now;
      return itemTime >= threeDaysAgo;
    });

    if(filteredHistory.length < data.history.length) {
      Storage.saveLotteryHistory(filteredHistory);
    }

    return filteredHistory;
  },

  clearLotteryHistory: () => {
    Storage.remove(Storage.KEYS.LOTTERY_HISTORY);
  },

  saveSpecialHistory: (history) => {
    Storage.set(Storage.KEYS.SPECIAL_HISTORY, history);
  },

  loadSpecialHistory: () => {
    const data = Storage.get(Storage.KEYS.SPECIAL_HISTORY, null);
    if(!data || !Array.isArray(data)) {
      return [];
    }

    const now = Date.now();
    const thirtyDaysAgo = now - Storage.SPECIAL_HISTORY_DURATION;

    const filteredHistory = data.filter(item => {
      const itemTime = item.timestamp || now;
      return itemTime >= thirtyDaysAgo;
    });

    if(filteredHistory.length < data.length) {
      Storage.saveSpecialHistory(filteredHistory);
    }

    return filteredHistory;
  },

  clearSpecialHistory: () => {
    Storage.remove(Storage.KEYS.SPECIAL_HISTORY);
  },

  saveZodiacPredictionHistory: (sortedZodiacs, zodiacDetails, predictPeriod) => {
    const data = Storage.get(Storage.KEYS.ZODIAC_PREDICTION_HISTORY, []);
    const state = StateManager._state;

    const historyItem = {
      id: Date.now(),
      timestamp: Date.now(),
      expect: predictPeriod || '待预测',
      title: '生肖预测',
      sortedZodiacs: Utils.deepClone(sortedZodiacs),
      zodiacDetails: Utils.deepClone(zodiacDetails),
      analyzeLimit: state.analysis.analyzeLimit,
      status: 'pending'
    };

    const newHistory = [historyItem, ...data];
    if(newHistory.length > 100) {
      newHistory.length = 100;
    }

    Storage.set(Storage.KEYS.ZODIAC_PREDICTION_HISTORY, newHistory);
  },

  loadZodiacPredictionHistory: () => {
    return Storage.get(Storage.KEYS.ZODIAC_PREDICTION_HISTORY, []);
  },

  clearZodiacPredictionHistory: () => {
    Storage.remove(Storage.KEYS.ZODIAC_PREDICTION_HISTORY);
  },

  savePredictionHistoryFilter: (filter) => {
    Storage.set(Storage.KEYS.PREDICTION_HISTORY_FILTER, filter);
  },

  loadPredictionHistoryFilter: () => {
    return Storage.get(Storage.KEYS.PREDICTION_HISTORY_FILTER, null);
  },

  saveRecordHistory: (recordData) => {
    const data = Storage.get(Storage.KEYS.RECORD_HISTORY, []);
    const expect = recordData.expect;
    const analyzeLimit = recordData.analyzeLimit || 10;
    const existingIndex = data.findIndex(r =>
      r.expect === expect && (r.analyzeLimit || 10) === analyzeLimit
    );

    const recordItem = {
      id: existingIndex >= 0 ? data[existingIndex].id : (Date.now() + Math.floor(Math.random() * 1000000)),
      timestamp: Date.now(),
      expect: expect,
      title: recordData.title || '精选生肖',
      type: recordData.type || 'selectedZodiac',
      zodiacPrediction: recordData.zodiacPrediction,
      selectedZodiacs: recordData.selectedZodiacs,
      specialNumbers: recordData.specialNumbers,
      hotNumbers: recordData.hotNumbers,
      analyzeLimit: analyzeLimit,
      drawResult: recordData.drawResult || null,
      drawZodiac: recordData.drawZodiac || null,
      zodiacHit: recordData.zodiacHit || [],
      zodiacMiss: recordData.zodiacMiss || [],
      selectedHit: recordData.selectedHit || [],
      selectedMiss: recordData.selectedMiss || [],
      specialHit: recordData.specialHit || [],
      specialMiss: recordData.specialMiss || [],
      hotHit: recordData.hotHit || [],
      hotMiss: recordData.hotMiss || []
    };
    
    let newHistory;
    if (existingIndex >= 0) {
      data[existingIndex] = recordItem;
      newHistory = data;
    } else {
      newHistory = [recordItem, ...data];
    }

    if(newHistory.length > 100) {
      newHistory.length = 100;
    }

    Storage.set(Storage.KEYS.RECORD_HISTORY, newHistory);
    Storage._autoBackup();
    return newHistory;
  },

  loadRecordHistory: () => {
    return Storage.get(Storage.KEYS.RECORD_HISTORY, []);
  },

  deleteRecordById: (recordId) => {
    const data = Storage.get(Storage.KEYS.RECORD_HISTORY, []);
    // 使用 == 进行宽松比较，兼容字符串和数字
    const newData = data.filter(item => item.id != recordId);
    if(newData.length < data.length) {
      Storage.set(Storage.KEYS.RECORD_HISTORY, newData);
      return true;
    }
    return false;
  },

  clearRecordHistory: () => {
    Storage.remove(Storage.KEYS.RECORD_HISTORY);
  },

  _autoBackup: () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const lastBackupDate = Storage.get(Storage.KEYS.LAST_BACKUP_DATE, '');

      if(lastBackupDate === today) {
        return;
      }

      const backupData = {
        timestamp: Date.now(),
        date: today,
        recordHistory: Storage.get(Storage.KEYS.RECORD_HISTORY, []),
        specialHistory: Storage.get(Storage.KEYS.SPECIAL_HISTORY, []),
        savedFilters: Storage.get(Storage.KEYS.SAVED_FILTERS, []),
        favorites: Storage.get('favorites', [])
      };

      const backups = Storage.get(Storage.KEYS.AUTO_BACKUP, []);
      const backupId = 'backup_' + today;

      const existingIndex = backups.findIndex(b => b.id === backupId);
      if(existingIndex >= 0) {
        backups[existingIndex] = { id: backupId, ...backupData };
      } else {
        backups.unshift({ id: backupId, ...backupData });
      }

      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const filteredBackups = backups.filter(b => b.timestamp > sevenDaysAgo);

      Storage.set(Storage.KEYS.AUTO_BACKUP, filteredBackups);
      Storage.set(Storage.KEYS.AUTO_BACKUP_TIME, Date.now());
      Storage.set(Storage.KEYS.LAST_BACKUP_DATE, today);

      console.log('自动备份完成，保留', filteredBackups.length, '个备份');
    } catch(e) {
      console.error('自动备份失败', e);
    }
  },

  _restoreFromBackup: () => {
    try {
      const backups = Storage.get(Storage.KEYS.AUTO_BACKUP, []);
      if(backups.length === 0) return null;

      const latestBackup = backups[0];
      if(!latestBackup || !latestBackup.recordHistory) return null;

      console.log('从备份恢复数据，备份时间:', new Date(latestBackup.timestamp).toLocaleString());
      Toast.show('检测到数据异常，已从备份恢复');

      return latestBackup;
    } catch(e) {
      console.error('从备份恢复失败', e);
      return null;
    }
  },

  exportData: () => {
    try {
      const exportData = {
        version: CONFIG.DATA_VERSION,
        exportTime: Date.now(),
        exportDate: new Date().toISOString(),
        recordHistory: Storage.get(Storage.KEYS.RECORD_HISTORY, []),
        specialHistory: Storage.get(Storage.KEYS.SPECIAL_HISTORY, []),
        savedFilters: Storage.get(Storage.KEYS.SAVED_FILTERS, []),
        favorites: Storage.get('favorites', []),
        zodiacPredictionHistory: Storage.get(Storage.KEYS.ZODIAC_PREDICTION_HISTORY, [])
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'going_backup_' + new Date().toISOString().split('T')[0] + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      Toast.show('导出成功');
      return true;
    } catch(e) {
      console.error('导出失败', e);
      Toast.show('导出失败');
      return false;
    }
  },

  importData: (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importData = JSON.parse(e.target.result);
          if(!importData || typeof importData !== 'object') {
            Toast.show('文件格式错误');
            reject(new Error('文件格式错误'));
            return;
          }

          if(importData.recordHistory && Array.isArray(importData.recordHistory)) {
            const currentRecords = Storage.get(Storage.KEYS.RECORD_HISTORY, []);
            const mergedRecords = [...importData.recordHistory, ...currentRecords];
            const uniqueRecords = [];
            const seenIds = new Set();
            for(const record of mergedRecords) {
              if(record.id && !seenIds.has(record.id)) {
                seenIds.add(record.id);
                uniqueRecords.push(record);
              }
            }
            if(uniqueRecords.length > 100) {
              uniqueRecords.length = 100;
            }
            Storage.set(Storage.KEYS.RECORD_HISTORY, uniqueRecords);
          }

          if(importData.specialHistory && Array.isArray(importData.specialHistory)) {
            const currentSpecial = Storage.get(Storage.KEYS.SPECIAL_HISTORY, []);
            const mergedSpecial = [...importData.specialHistory, ...currentSpecial];
            const uniqueSpecial = [];
            const seenIds = new Set();
            for(const item of mergedSpecial) {
              if(item.id && !seenIds.has(item.id)) {
                seenIds.add(item.id);
                uniqueSpecial.push(item);
              }
            }
            if(uniqueSpecial.length > Storage.SPECIAL_HISTORY_MAX_COUNT) {
              uniqueSpecial.length = Storage.SPECIAL_HISTORY_MAX_COUNT;
            }
            Storage.set(Storage.KEYS.SPECIAL_HISTORY, uniqueSpecial);
          }

          if(importData.savedFilters && Array.isArray(importData.savedFilters)) {
            Storage.set(Storage.KEYS.SAVED_FILTERS, importData.savedFilters);
          }

          if(importData.favorites && Array.isArray(importData.favorites)) {
            Storage.set('favorites', importData.favorites);
          }

          Toast.show('导入成功');
          resolve(true);
        } catch(err) {
          console.error('导入失败', err);
          Toast.show('导入失败：文件格式错误');
          reject(err);
        }
      };
      reader.onerror = () => {
        Toast.show('读取文件失败');
        reject(new Error('读取文件失败'));
      };
      reader.readAsText(file);
    });
  },

  _checkDailyBackup: () => {
    const lastBackupDate = Storage.get(Storage.KEYS.LAST_BACKUP_DATE, '');
    const today = new Date().toISOString().split('T')[0];

    if(lastBackupDate !== today) {
      Storage._autoBackup();
    }
  },

  _validateRecordHistory: () => {
    try {
      let data = Storage.get(Storage.KEYS.RECORD_HISTORY, []);
      if(!Array.isArray(data)) {
        const backup = Storage._restoreFromBackup();
        if(backup && backup.recordHistory) {
          Storage.set(Storage.KEYS.RECORD_HISTORY, backup.recordHistory);
          return backup.recordHistory;
        }
        return [];
      }

      data = Storage._migrateRecordData(data);
      data = Storage._cleanRecordDuplicates(data);
      return data;
    } catch(e) {
      console.error('记录数据校验失败', e);
      const backup = Storage._restoreFromBackup();
      return backup ? backup.recordHistory : [];
    }
  },

  _migrateRecordData: (data) => {
    let migrated = false;
    const newData = data.map(record => {
      const newRecord = { ...record };
      if(!newRecord.title) {
        newRecord.title = '精选生肖';
        migrated = true;
      }
      if(!newRecord.type) {
        newRecord.type = 'selectedZodiac';
        migrated = true;
      }
      if(!newRecord.expect && newRecord.timestamp) {
        const date = new Date(newRecord.timestamp);
        const year = date.getFullYear();
        const dayOfYear = Math.floor((date - new Date(year, 0, 1)) / (24 * 60 * 60 * 1000));
        newRecord.expect = String(year * 1000 + dayOfYear).padStart(6, '0');
        migrated = true;
      }
      return newRecord;
    });

    if(migrated) {
      Storage.set(Storage.KEYS.RECORD_HISTORY, newData);
      console.log('精选生肖模块旧数据迁移完成');
    }

    return newData;
  },

  _cleanRecordDuplicates: (data) => {
    const seen = new Map();
    const uniqueData = [];
    
    for (let i = 0; i < data.length; i++) {
      const record = data[i];
      const expect = record.expect;
      const analyzeLimit = record.analyzeLimit || 10;
      const key = `${expect}-${analyzeLimit}`;
      
      if (!seen.has(key)) {
        seen.set(key, true);
        uniqueData.push(record);
      }
    }
    
    if (uniqueData.length < data.length) {
      Storage.set(Storage.KEYS.RECORD_HISTORY, uniqueData);
      console.log(`数据去重完成：原始 ${data.length} 条，去重后 ${uniqueData.length} 条`);
    }
    
    return uniqueData;
  }
};
