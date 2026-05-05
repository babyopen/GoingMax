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

  _jsonStringify: (() => {
    try {
      if(typeof window !== 'undefined' && window.JSON && JSON.stringify) {
        return JSON.stringify;
      }
    } catch(e) {}
    return (value) => {
      if(value === null || value === undefined) return 'null';
      if(typeof value === 'string') return '"' + value + '"';
      if(typeof value === 'number' || typeof value === 'boolean') return String(value);
      if(Array.isArray(value)) {
        return '[' + value.map(v => Storage._jsonStringify(v)).join(',') + ']';
      }
      if(typeof value === 'object') {
        const entries = Object.entries(value).map(([k, v]) => '"' + k + '":' + Storage._jsonStringify(v));
        return '{' + entries.join(',') + '}';
      }
      return 'null';
    };
  })(),

  _jsonParse: (() => {
    try {
      if(typeof window !== 'undefined' && window.JSON && JSON.parse) {
        return JSON.parse;
      }
    } catch(e) {}
    return (text) => {
      if(typeof text !== 'string') return null;
      try {
        return eval('(' + text + ')');
      } catch(e) {
        return null;
      }
    };
  })(),

  SAVE_INTERVAL_CONFIG: Object.freeze({
    RECORD_HISTORY: 5000,
    SPECIAL_HISTORY: 3000,
    ZODIAC_HISTORY: 5000,
    MIN_SAVE_GAP: 1000
  }),

  _memoryCache: {},
  _memoryCacheTime: {},

  _memoryStorage: {},

  _lastSaveTimes: {
    RECORD_HISTORY: 0,
    SPECIAL_HISTORY: 0,
    ZODIAC_HISTORY: 0
  },

  _pendingSaveQueue: [],
  _saveBatchTimer: null,
  _BATCH_SAVE_DELAY: 500,

  _canSave: (type) => {
    const now = Date.now();
    const lastSave = Storage._lastSaveTimes[type] || 0;
    const minInterval = Storage.SAVE_INTERVAL_CONFIG[type] || Storage.SAVE_INTERVAL_CONFIG.MIN_SAVE_GAP;
    return (now - lastSave) >= minInterval;
  },

  _updateLastSaveTime: (type) => {
    Storage._lastSaveTimes[type] = Date.now();
  },

  _enqueueSave: (type, data) => {
    Storage._pendingSaveQueue.push({ type, data, timestamp: Date.now() });

    if(Storage._saveBatchTimer) {
      clearTimeout(Storage._saveBatchTimer);
    }

    Storage._saveBatchTimer = setTimeout(() => {
      Storage._flushSaveQueue();
    }, Storage._BATCH_SAVE_DELAY);
  },

  _flushSaveQueue: () => {
    if(Storage._pendingSaveQueue.length === 0) return;

    const queue = Storage._pendingSaveQueue.splice(0);

    const groupedByType = {};
    queue.forEach(item => {
      if(!groupedByType[item.type]) {
        groupedByType[item.type] = [];
      }
      groupedByType[item.type].push(item);
    });

    Object.entries(groupedByType).forEach(([type, items]) => {
      const latestItem = items[items.length - 1];
      if(Storage._canSave(type)) {
        Storage._executeSave(type, latestItem.data);
      }
    });

    Storage._saveBatchTimer = null;
  },

  _executeSave: (type, data) => {
    try {
      switch(type) {
        case 'RECORD_HISTORY':
          Storage._executeRecordSave(data);
          break;
        case 'SPECIAL_HISTORY':
          Storage._executeSpecialSave(data);
          break;
        case 'ZODIAC_HISTORY':
          Storage._executeZodiacSave(data);
          break;
      }
      Storage._updateLastSaveTime(type);
    } catch(e) {
      console.error(`执行保存失败 [${type}]`, e);
    }
  },

  _generateRecordId: (timestamp) => {
    return 'r_' + timestamp;
  },

  _generateSpecialId: (timestamp, mode, numCount) => {
    return 's_' + timestamp + '_' + mode + '_' + numCount;
  },

  _generateZodiacId: (timestamp, analyzeLimit = 10) => {
    return 'z_' + timestamp + '_' + analyzeLimit;
  },

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
        const parsed = value ? Storage._jsonParse(value) : defaultValue;
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

      const serialized = Storage._jsonStringify(value);
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

  saveZodiacPredictionHistory: (sortedZodiacs, zodiacDetails, predictPeriod, analyzeLimit = 10, analyzeLimitText = '10期数据') => {
    const data = Storage.get(Storage.KEYS.ZODIAC_PREDICTION_HISTORY, []);
    const timestamp = Date.now();

    const historyItem = {
      id: Storage._generateZodiacId(timestamp, analyzeLimit),
      timestamp: timestamp,
      expect: predictPeriod || '待预测',
      title: '生肖预测',
      sortedZodiacs: Utils.deepClone(sortedZodiacs),
      zodiacDetails: Utils.deepClone(zodiacDetails),
      analyzeLimit: analyzeLimit,
      analyzeLimitText: analyzeLimitText,
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

    const timestamp = Date.now();
    const recordItem = {
      id: existingIndex >= 0 ? data[existingIndex].id : Storage._generateRecordId(timestamp),
      timestamp: timestamp,
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
  },

  _validateRecordData: (recordData) => {
    if(!recordData || typeof recordData !== 'object') return false;
    if(!recordData.expect) return false;
    if(!recordData.analyzeLimit || typeof recordData.analyzeLimit !== 'number') return false;
    if(recordData.zodiacPrediction !== undefined && !Array.isArray(recordData.zodiacPrediction)) return false;
    if(recordData.selectedZodiacs !== undefined && !Array.isArray(recordData.selectedZodiacs)) return false;
    if(recordData.specialNumbers !== undefined && !Array.isArray(recordData.specialNumbers)) return false;
    if(recordData.hotNumbers !== undefined && !Array.isArray(recordData.hotNumbers)) return false;
    return true;
  },

  _validateSpecialData: (specialData) => {
    if(!specialData || typeof specialData !== 'object') return false;
    if(!Array.isArray(specialData)) return false;
    if(specialData.length === 0) return true;
    
    return specialData.every(item => {
      if(!item.id || !item.timestamp) return false;
      if(!item.expect) return false;
      if(!item.numbers || !Array.isArray(item.numbers)) return false;
      if(!item.mode || !['hot', 'cold'].includes(item.mode)) return false;
      if(!item.analyzeLimit || typeof item.analyzeLimit !== 'number') return false;
      if(!item.numCount || typeof item.numCount !== 'number') return false;
      return true;
    });
  },

  _validateZodiacData: (zodiacData) => {
    if(!zodiacData || typeof zodiacData !== 'object') return false;
    if(!zodiacData.sortedZodiacs || !Array.isArray(zodiacData.sortedZodiacs)) return false;
    if(!zodiacData.zodiacDetails || typeof zodiacData.zodiacDetails !== 'object') return false;
    return true;
  },

  _deduplicateSpecialHistory: (history) => {
    if(!Array.isArray(history)) return history;
    
    const seen = new Map();
    const uniqueHistory = [];
    
    history.forEach(item => {
      const key = `${item.expect}-${item.analyzeLimit}-${item.numCount}-${item.mode}`;
      if(!seen.has(key)) {
        seen.set(key, true);
        uniqueHistory.push(item);
      }
    });
    
    if(uniqueHistory.length < history.length) {
      console.log(`精选特码去重完成：原始 ${history.length} 条，去重后 ${uniqueHistory.length} 条`);
    }
    
    return uniqueHistory;
  },

  _executeRecordSave: (recordData) => {
    if(!Storage._validateRecordData(recordData)) {
      console.error('记录数据校验失败，跳过保存', recordData);
      return;
    }
    
    Storage.saveRecordHistory(recordData);
  },

  _executeSpecialSave: (specialHistory) => {
    if(!Storage._validateSpecialData(specialHistory)) {
      console.error('精选特码数据校验失败，跳过保存', specialHistory);
      return;
    }
    
    const deduplicated = Storage._deduplicateSpecialHistory(specialHistory);
    Storage.saveSpecialHistory(deduplicated);
  },

  _executeZodiacSave: (zodiacData) => {
    if(!Storage._validateZodiacData(zodiacData)) {
      console.error('生肖预测数据校验失败，跳过保存', zodiacData);
      return;
    }
    
    Storage.saveZodiacPredictionHistory(
      zodiacData.sortedZodiacs,
      zodiacData.zodiacDetails,
      zodiacData.predictPeriod,
      zodiacData.analyzeLimit,
      zodiacData.analyzeLimitText
    );
  },

  saveRecordHistoryBatched: (recordData) => {
    Storage._enqueueSave('RECORD_HISTORY', recordData);
  },

  saveSpecialHistoryBatched: (specialHistory) => {
    Storage._enqueueSave('SPECIAL_HISTORY', specialHistory);
  },

  saveZodiacHistoryBatched: (zodiacData) => {
    Storage._enqueueSave('ZODIAC_HISTORY', zodiacData);
  },

  getSaveStats: () => {
    return {
      lastSaveTimes: { ...Storage._lastSaveTimes },
      pendingQueueLength: Storage._pendingSaveQueue.length,
      config: Storage.SAVE_INTERVAL_CONFIG
    };
  }

};
