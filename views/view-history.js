/**
 * 记录页面视图
 * @description 展示分析页面的历史预测数据记录，支持分页加载、搜索、导出导入
 */

const RecordView = {
  _pageSize: 20,
  _currentPage: 1,
  _searchKeyword: '',
  _searchDebounceTimer: null,
  _recordData: [],
  _searchUIReady: false,

  _ensureSearchUI: (recordList) => {
    if (RecordView._searchUIReady) return;
    const searchInput = document.getElementById('recordSearchInput');
    if (searchInput) {
      RecordView._searchUIReady = true;
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'record-search-bar';
    wrapper.innerHTML = `
      <input type="text" id="recordSearchInput" class="record-search-input" placeholder="按期号搜索...">
      <span class="record-search-clear" data-action="clearRecordSearch" style="display:none;">✕</span>
    `;
    recordList.parentNode.insertBefore(wrapper, recordList);

    const input = wrapper.querySelector('#recordSearchInput');
    const clearBtn = wrapper.querySelector('.record-search-clear');

    input.addEventListener('input', Utils.debounce(() => {
      const keyword = input.value;
      if (keyword) {
        clearBtn.style.display = '';
        RecordView._currentPage = 1;
        RecordView._searchKeyword = keyword;
      } else {
        clearBtn.style.display = 'none';
        RecordView._searchKeyword = null;
      }
      RecordView.renderRecordList();
    }, 300));

    RecordView._searchUIReady = true;
  },

  getColorByNum: (num) => {
    const color = Object.keys(CONFIG.COLOR_MAP).find(c => CONFIG.COLOR_MAP[c].includes(Number(num)));
    const colorMap = { '红': 'red', '蓝': 'blue', '绿': 'green' };
    return colorMap[color] || 'red';
  },

  renderRecordList: () => {
    const recordList = document.getElementById('recordList');
    const recordCount = document.getElementById('recordCount');
    const recordPeriod = document.getElementById('recordPeriod');
    const loadMoreBtn = document.getElementById('loadMoreRecordBtn');

    if (!recordList) return;

    RecordView._ensureSearchUI(recordList);

    const records = Storage._validateRecordHistory();
    RecordView._recordData = records;

    let filteredRecords = records;
    if(RecordView._searchKeyword) {
      const keyword = RecordView._searchKeyword.toLowerCase();
      filteredRecords = records.filter(record => {
        return record.expect && String(record.expect).toLowerCase().includes(keyword);
      });
    }

    if (recordCount) {
      recordCount.textContent = filteredRecords.length;
    }

    if (filteredRecords.length > 0) {
      if (recordPeriod) {
        const sortedByExpect = [...filteredRecords]
          .filter(r => r.expect)
          .sort((a, b) => String(b.expect || '').localeCompare(String(a.expect || '')));
        recordPeriod.textContent = sortedByExpect.length > 0 ? sortedByExpect[0].expect : '--';
      }

      const groupedByExpect = Utils.groupRecordsByExpect(filteredRecords);

      const pageSize = RecordView._pageSize;
      const endIndex = RecordView._currentPage * pageSize;
      const displayGroups = groupedByExpect.slice(0, endIndex);

      const html = displayGroups.map((group, groupIndex) => {
        const firstRecord = group.records[0];
        const date = new Date(firstRecord.timestamp);
        const timeStr = Utils.formatDate(date);
        const expect = firstRecord.expect || '--';

        const sortedByLimit = [...group.records].sort((a, b) => {
          return (a.analyzeLimit || 10) - (b.analyzeLimit || 10);
        });

        const hasMultiple = sortedByLimit.length > 1;
        const defaultRecord = sortedByLimit[0];

        let tabsHtml = '';
        let panelsHtml = '';
        if (hasMultiple) {
          tabsHtml = `
            <div class="record-limit-tabs">
              ${sortedByLimit.map((r, i) => {
                const limitLabel = (r.analyzeLimit || 10) > 50 ? '全年' : `${r.analyzeLimit || 10}期`;
                return `<span class="record-limit-tab ${i === 0 ? 'active' : ''}" data-action="switchRecordLimit" data-group="${groupIndex}" data-limit-index="${i}">${limitLabel}</span>`;
              }).join('')}
            </div>
          `;
          panelsHtml = sortedByLimit.map((r, i) => {
            return `
              <div class="record-limit-panel ${i === 0 ? 'active' : ''}" data-limit-panel="${groupIndex}-${i}" style="${i === 0 ? '' : 'display:none'}">
                ${RecordView._renderCompactZodiac(r)}
                ${RecordView._renderCompactSelected(r)}
                ${RecordView._renderCompactSpecial(r)}
              </div>
            `;
          }).join('');
        } else {
          panelsHtml = `
            ${RecordView._renderCompactZodiac(defaultRecord)}
            ${RecordView._renderCompactSelected(defaultRecord)}
            ${RecordView._renderCompactSpecial(defaultRecord)}
          `;
        }

        return `
          <div class="record-card" data-record-group="${groupIndex}">
            <div class="record-card-header">
              <div class="record-card-title">
                <span class="record-period">第 ${expect} 期</span>
                ${!hasMultiple ? `<span class="record-limit-tag">${(defaultRecord.analyzeLimit || 10) > 50 ? '全年' : (defaultRecord.analyzeLimit || 10) + '期'}</span>` : ''}
                <span class="record-time">${timeStr}</span>
              </div>
              <div class="record-card-actions">
                <button class="btn-mini" data-action="toggleRecordDetail" data-index="${groupIndex}">详情</button>
              </div>
            </div>
            <div class="record-card-body">
              ${tabsHtml}
              ${panelsHtml}
              ${RecordView._renderCompactDraw(firstRecord)}
            </div>
            <div class="record-card-detail" id="recordDetail${groupIndex}" style="display:none;">
              <div class="record-detail-content">
                ${RecordView._renderFullDetailMulti(group.records, groupIndex)}
              </div>
            </div>
          </div>
        `;
      }).join('');

      recordList.innerHTML = html;

      if (loadMoreBtn) {
        const hasMore = endIndex < groupedByExpect.length;
        loadMoreBtn.style.display = hasMore ? '' : 'none';
      }
    } else {
      if (recordPeriod) {
        recordPeriod.textContent = '--';
      }
      recordList.innerHTML = RecordView._searchKeyword 
        ? '<div class="empty-tip">未找到匹配 "' + RecordView._searchKeyword + '" 的记录</div>'
        : '<div class="empty-tip">暂无历史记录</div>';
      
      if (loadMoreBtn) {
        loadMoreBtn.style.display = 'none';
      }
    }
    
    RecordView.renderFavoriteList();
  },

  _switchLimitPanel: (containerEl, tabClass, panelClass, limitIndex) => {
    if (!containerEl) return;

    const tabs = containerEl.querySelectorAll('.' + tabClass);
    const panels = containerEl.querySelectorAll('.' + panelClass);

    tabs.forEach((tab, i) => {
      tab.classList.toggle('active', i === Number(limitIndex));
    });

    panels.forEach((panel, i) => {
      panel.classList.toggle('active', i === Number(limitIndex));
      panel.style.display = i === Number(limitIndex) ? '' : 'none';
    });
  },

  switchRecordLimit: (groupIndex, limitIndex) => {
    const groupEl = document.querySelector(`.record-card[data-record-group="${groupIndex}"]`);
    RecordView._switchLimitPanel(groupEl, 'record-limit-tab', 'record-limit-panel', limitIndex);
    const detailEl = document.getElementById('recordDetail' + groupIndex);
    RecordView._switchLimitPanel(detailEl, 'record-detail-tab', 'record-detail-panel', limitIndex);
  },

  switchDetailLimit: (groupIndex, limitIndex) => {
    const detailEl = document.getElementById('recordDetail' + groupIndex);
    RecordView._switchLimitPanel(detailEl, 'record-detail-tab', 'record-detail-panel', limitIndex);
  },

  _renderFullDetailMulti: (sameExpectRecords, groupIndex) => {
    const firstRecord = sameExpectRecords[0];
    const date = new Date(firstRecord.timestamp);

    const sortedByLimit = [...sameExpectRecords].sort((a, b) => {
      return (a.analyzeLimit || 10) - (b.analyzeLimit || 10);
    });

    let html = `
      <div class="record-detail-item">
        <span class="record-detail-label">记录时间：</span>
        <span class="record-detail-value">${date.toLocaleString()}</span>
      </div>
    `;

    sortedByLimit.forEach((r, i) => {
      html += `
        <div class="record-detail-panel ${i === 0 ? 'active' : ''}" style="${i === 0 ? '' : 'display:none'}">
          ${RecordView._renderPeriodDetail(r)}
        </div>
      `;
    });

    return html;
  },

  _renderPeriodDetail: (record) => {
    let html = '';

    const zodiacPrediction = record.zodiacPrediction || [];
    if (zodiacPrediction.length > 0) {
      const hasDraw = record.drawZodiac !== undefined && record.drawZodiac !== null;
      const zodiacList = zodiacPrediction.map((item, i) => {
        const topClass = hasDraw ? '' : (i === 0 ? 'top-1' : (i === 1 ? 'top-2' : (i === 2 ? 'top-3' : '')));
        return `<span class="record-detail-zodiac ${topClass}">${item.zodiac}</span>`;
      }).join(' ');
      html += `
        <div class="record-detail-item">
          <span class="record-detail-label">生肖排序：</span>
          <span class="record-detail-value">${zodiacList}</span>
        </div>
      `;
    }

    const selectedZodiacs = record.selectedZodiacs || [];
    if (selectedZodiacs.length > 0) {
      html += `
        <div class="record-detail-item">
          <span class="record-detail-label">精选生肖：</span>
          <span class="record-detail-value">${selectedZodiacs.slice(0, 6).join('、')}</span>
        </div>
      `;
    }

    const specialNumbers = record.specialNumbers || [];
    if (specialNumbers.length > 0) {
      html += `
        <div class="record-detail-item">
          <span class="record-detail-label">精选特码：</span>
          <span class="record-detail-value">${specialNumbers.slice(0, 6).join('、')}</span>
        </div>
      `;
    }

    const hotNumbers = record.hotNumbers || [];
    if (hotNumbers.length > 0) {
      html += `
        <div class="record-detail-item">
          <span class="record-detail-label">热门TOP5：</span>
          <span class="record-detail-value">${hotNumbers.slice(0, 5).join('、')}</span>
        </div>
      `;
    }

    return html;
  },

  _renderCompactZodiac: (record) => {
    const drawZodiac = record.drawZodiac;
    const hasDraw = drawZodiac !== undefined && drawZodiac !== null;
    const zodiacPrediction = record.zodiacPrediction || [];

    if (zodiacPrediction.length === 0) {
      return '<div class="record-section"><div class="record-section-title">推荐生肖</div><div class="empty-tip">暂无数据</div></div>';
    }

    const topZodiacs = zodiacPrediction.slice(0, 6);
    const zodiacBtns = topZodiacs.map((item, i) => {
      const topClass = hasDraw ? '' : (i === 0 ? 'top-1' : (i === 1 ? 'top-2' : (i === 2 ? 'top-3' : '')));
      const isHit = hasDraw && item.zodiac === drawZodiac;
      const hitClass = isHit ? 'hit-blue' : '';
      return `<div class="zodiac-btn ${topClass} ${hitClass}">${item.zodiac || '?'}</div>`;
    }).join('');

    const hitCount = record.zodiacHit ? record.zodiacHit.length : 0;
    const hitBadge = hasDraw ? `<span class="record-hit-badge ${hitCount > 0 ? 'hit' : 'miss'}">${hitCount > 0 ? '中' : '错'}</span>` : '';

    return `
      <div class="record-section record-section-row">
        <div class="record-section-title">推荐生肖</div>
        <div class="zodiac-buttons-row">
          ${zodiacBtns}
          ${hitBadge}
        </div>
      </div>
    `;
  },

  _renderCompactSelected: (record) => {
    const drawZodiac = record.drawZodiac;
    const hasDraw = drawZodiac !== undefined && drawZodiac !== null;
    const selectedZodiacs = record.selectedZodiacs || [];

    if (selectedZodiacs.length === 0) {
      return '<div class="record-section"><div class="record-section-title">精选生肖</div><div class="empty-tip">暂无数据</div></div>';
    }

    const topZodiacs = selectedZodiacs.slice(0, 6);
    const zodiacBtns = topZodiacs.map((zodiac, i) => {
      const topClass = hasDraw ? '' : (i === 0 ? 'top-1' : (i === 1 ? 'top-2' : (i === 2 ? 'top-3' : '')));
      const isHit = hasDraw && zodiac === drawZodiac;
      const hitClass = isHit ? 'hit-blue' : '';
      return `<div class="zodiac-btn ${topClass} ${hitClass}">${zodiac}</div>`;
    }).join('');

    const hitCount = record.selectedHit ? record.selectedHit.length : 0;
    const hitBadge = hasDraw ? `<span class="record-hit-badge ${hitCount > 0 ? 'hit' : 'miss'}">${hitCount > 0 ? '中' : '错'}</span>` : '';

    return `
      <div class="record-section record-section-row">
        <div class="record-section-title">精选生肖</div>
        <div class="zodiac-buttons-row">
          ${zodiacBtns}
          ${hitBadge}
        </div>
      </div>
    `;
  },

  _renderCompactSpecial: (record) => {
    const specialNumbers = record.specialNumbers || [];
    const drawResult = record.drawResult;
    const hasDraw = drawResult !== undefined && drawResult !== null;

    if (specialNumbers.length === 0) {
      return '<div class="record-section"><div class="record-section-title">精选特码</div><div class="empty-tip">暂无数据</div></div>';
    }

    const topNums = specialNumbers.slice(0, 6);
    const numBtns = topNums.map((num, i) => {
      const topClass = hasDraw ? '' : (i === 0 ? 'top-1' : (i === 1 ? 'top-2' : (i === 2 ? 'top-3' : '')));
      const isHit = hasDraw && drawResult === num;
      const hitClass = isHit ? 'hit-blue' : '';
      const numStr = String(num).padStart(2, '0');
      return `<div class="zodiac-btn ${topClass} ${hitClass}">${numStr}</div>`;
    }).join('');

    const hitCount = record.specialHit ? record.specialHit.length : 0;
    const hitBadge = hasDraw ? `<span class="record-hit-badge ${hitCount > 0 ? 'hit' : 'miss'}">${hitCount > 0 ? '中' : '错'}</span>` : '';

    return `
      <div class="record-section record-section-row">
        <div class="record-section-title">精选特码</div>
        <div class="zodiac-buttons-row">
          ${numBtns}
          ${hitBadge}
        </div>
      </div>
    `;
  },

  _renderCompactDraw: (record) => {
    const drawResult = record.drawResult;
    const drawZodiac = record.drawZodiac;
    const hasDraw = drawResult !== undefined && drawResult !== null;

    if (!hasDraw) return '';

    const color = RecordView.getColorByNum(drawResult);
    const numStr = String(drawResult).padStart(2, '0');

    return `
      <div class="record-section record-section-row">
        <div class="record-section-title">开奖结果</div>
        <div class="zodiac-buttons-row">
          <div class="zodiac-btn draw-result ${color}">${numStr}</div>
          <span class="record-draw-zodiac">${drawZodiac || ''}</span>
        </div>
      </div>
    `;
  },

  renderFavoriteList: () => {
    const favoriteListEl = document.getElementById('favoriteList');
    
    if(!favoriteListEl) return;
    
    const favorites = StateManager._state.favorites || [];

    if(!favorites.length){
      favoriteListEl.innerHTML = '<div class="empty-tip">暂无收藏的方案</div>';
      return;
    }

    let html = '';
    favorites.forEach((item, index) => {
      let numsHtml = '';
      if(item.numbers && Array.isArray(item.numbers)) {
        item.numbers.forEach(num => {
          const attrs = DataQuery.getNumAttrs(num);
          const colorClass = attrs.color === '红' ? 'red' : attrs.color === '蓝' ? 'blue' : 'green';
          numsHtml += `<span class="history-tag" style="cursor:pointer;">${String(num).padStart(2, '0')}</span>`;
        });
      } else {
        const list = Filter.getFilteredList(item.selected, item.excluded);
        list.slice(0, 10).forEach(num => {
          const colorClass = num.color === '红' ? 'red' : num.color === '蓝' ? 'blue' : 'green';
          numsHtml += `<span class="history-tag">${num.s}</span>`;
        });
        if(list.length > 10) numsHtml += '...';
      }
      
      html += `
        <div class="record-card">
          <div class="record-card-header">
            <div class="record-card-title">
              <span>${item.name}</span>
            </div>
            <div class="record-card-actions">
              <button class="btn-mini" data-action="loadFavorite" data-index="${index}">加载</button>
              <button class="btn-mini red" data-action="removeFavorite" data-index="${index}">删除</button>
            </div>
          </div>
          <div class="record-card-body">
            <div class="record-section">
              <div class="record-section-title">号码预览</div>
              <div style="display:flex;flex-wrap:wrap;gap:6px;">${numsHtml}</div>
            </div>
          </div>
        </div>
      `;
    });

    favoriteListEl.innerHTML = html;
  },

  switchTab: (tabName) => {
    const historyPage = document.getElementById('randomPage');
    if (!historyPage) return;

    const tabBar = historyPage.querySelector('.record-tab-bar');
    if (tabBar) {
      tabBar.querySelectorAll('.record-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
      });
    }

    const statsCard = historyPage.querySelector('.record-stats-card');
    const recordList = historyPage.querySelector('#recordList');
    const loadMoreBtn = historyPage.querySelector('#loadMoreRecordBtn');
    const favoriteSection = historyPage.querySelector('#favoriteSection');

    if (tabName === 'history') {
      if (statsCard) statsCard.style.display = '';
      if (recordList) recordList.style.display = '';
      if (loadMoreBtn) loadMoreBtn.style.display = '';
      if (favoriteSection) favoriteSection.style.display = 'none';
      RecordView.renderRecordList();
    } else if (tabName === 'favorites') {
      if (statsCard) statsCard.style.display = 'none';
      if (recordList) recordList.style.display = 'none';
      if (loadMoreBtn) loadMoreBtn.style.display = 'none';
      if (favoriteSection) favoriteSection.style.display = '';
      RecordView.renderFavoriteList();
    }
  },

  init: () => {
    RecordView.switchTab('history');
  },

  toggleRecordDetail: (index) => {
    const detailEl = document.getElementById('recordDetail' + index);
    if (detailEl) {
      const isHidden = detailEl.style.display === 'none';
      detailEl.style.display = isHidden ? 'block' : 'none';
    }
  },

  deleteRecord: (recordId) => {
    const records = Storage.loadRecordHistory();
    const record = records.find(r => r.id == recordId);
    
    if(record) {
      const success = Storage.deleteRecordById(record.id);
      if(success) {
        RecordView.renderRecordList();
        Toast.show('记录已删除');
      }
    } else {
      Toast.show('记录不存在或已被删除');
    }
  },

  clearRecordHistory: () => {
    Storage.clearRecordHistory();
    RecordView.renderRecordList();
    Toast.show('已清空所有记录');
  },

  refreshRecord: () => {
    RecordView.renderRecordList();
    Toast.show('记录已刷新');
  },

  loadMoreRecords: () => {
    RecordView._currentPage++;
    RecordView.renderRecordList();
  },

  searchRecords: (keyword) => {
    RecordView._searchKeyword = keyword.trim();
    RecordView._currentPage = 1;
    RecordView.renderRecordList();
  },

  searchRecordsDebounced: (keyword) => {
    if(RecordView._searchDebounceTimer) {
      clearTimeout(RecordView._searchDebounceTimer);
    }
    RecordView._searchDebounceTimer = setTimeout(() => {
      RecordView.searchRecords(keyword);
    }, 500);
  },

  clearSearch: () => {
    RecordView._searchKeyword = '';
    const searchInput = document.getElementById('recordSearchInput');
    if(searchInput) searchInput.value = '';
    RecordView._currentPage = 1;
    RecordView.renderRecordList();
  },

  handleHashChangeToRandom: () => {
    const randomPage = document.getElementById('randomPage');
    if (randomPage && randomPage.style.display !== 'none') {
      RecordView.renderRecordList();
    }
  }
};
