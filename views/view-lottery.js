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

  renderRecordList: () => {
    const recordList = document.getElementById('recordList');
    const recordCount = document.getElementById('recordCount');
    const recordPeriod = document.getElementById('recordPeriod');
    const loadMoreBtn = document.getElementById('loadMoreRecordBtn');

    if (!recordList) return;

    const records = Storage._validateRecordHistory();
    RecordView._currentPage = 1;
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
        recordPeriod.textContent = filteredRecords[0].expect || '--';
      }

      const displayRecords = filteredRecords.slice(0, RecordView._pageSize * RecordView._currentPage);
      const groupedByExpect = RecordView._groupRecordsByExpect(displayRecords);

      const html = groupedByExpect.map((group, groupIndex) => {
        const firstInGroup = group.records[0];
        const date = new Date(firstInGroup.timestamp);
        const timeStr = RecordView.formatDate(date);
        const firstRecordIndex = filteredRecords.indexOf(firstInGroup);

        return `
          <div class="record-card">
            <div class="record-card-header">
              <div class="record-card-title">
                <span class="record-period">第 ${firstInGroup.expect || '--'} 期</span>
                <span class="record-time">${timeStr}</span>
              </div>
              <div class="record-card-actions">
                <button class="btn-mini" data-action="toggleRecordDetail" data-index="${firstRecordIndex}">详情</button>
                <button class="btn-mini red" data-action="deleteRecord" data-record-id="${firstInGroup.id}">删除</button>
              </div>
            </div>
            
            <div class="record-card-body">
              <div class="record-section">
                <div class="record-section-title">生肖预测</div>
                ${RecordView.renderZodiacCards(group.records, firstInGroup.expect)}
              </div>
              
              <div class="record-section">
                <div class="record-section-title">第${firstInGroup.expect || '--'}期精选</div>
                <div class="record-zodiac-chips">
                  ${RecordView.renderZodiacChips(firstInGroup.selectedZodiacs)}
                </div>
              </div>
              
              <div class="record-section">
                <div class="record-section-title">精选特码</div>
                <div class="record-number-row">
                  ${RecordView.renderNumberBalls(firstInGroup.specialNumbers)}
                </div>
              </div>
              
              <div class="record-section">
                <div class="record-section-title">特码热门TOP5</div>
                <div class="record-number-row">
                  ${RecordView.renderNumberBalls(firstInGroup.hotNumbers)}
                </div>
              </div>
            </div>
            
            <div class="record-card-detail" id="recordDetail${groupIndex}" style="display:none;">
              <div class="record-detail-content">
                <div class="record-detail-item">
                  <span class="record-detail-label">分析期数：</span>
                  <span class="record-detail-value">${firstInGroup.analyzeLimit || 10}期</span>
                </div>
                <div class="record-detail-item">
                  <span class="record-detail-label">记录时间：</span>
                  <span class="record-detail-value">${date.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');
      
      recordList.innerHTML = html;
      
      if (loadMoreBtn) {
        const groupedByExpect = RecordView._groupRecordsByExpect(filteredRecords);
        const totalDisplayed = RecordView._pageSize * RecordView._currentPage;
        if (totalDisplayed < groupedByExpect.length) {
          loadMoreBtn.style.display = 'block';
          const btnText = loadMoreBtn.querySelector('button') || loadMoreBtn;
          btnText.innerText = `加载更多（还有${groupedByExpect.length - totalDisplayed}条）`;
        } else {
          loadMoreBtn.style.display = 'none';
        }
      }

      RecordView.initZodiacScrollEvents();
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

  _groupRecordsByExpect: (records) => {
    const groups = new Map();
    for (const record of records) {
      const expect = record.expect;
      if (!groups.has(expect)) {
        groups.set(expect, { expect: expect, records: [] });
      }
      groups.get(expect).records.push(record);
    }
    return Array.from(groups.values());
  },

  renderZodiacCards: (sameExpectRecords, expect) => {
    if (!sameExpectRecords || sameExpectRecords.length === 0) {
      return `
        <div class="zodiac-section">
          <div class="zodiac-scroll-wrapper">
            <div class="zodiac-card">
              <div class="zodiac-card-header">
                <span class="zodiac-period-tag">无数据</span>
                <span class="zodiac-page-info">0/0</span>
              </div>
              <div class="zodiac-buttons-row">
                <div class="zodiac-btn">暂无</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }
    
    const sortedRecords = [...sameExpectRecords].sort((a, b) => {
      const aLimit = a.analyzeLimit || 10;
      const bLimit = b.analyzeLimit || 10;
      return aLimit - bLimit;
    });
    
    const defaultIndex = sortedRecords.findIndex(r => (r.analyzeLimit || 10) === 10);
    const startIndex = defaultIndex >= 0 ? defaultIndex : 0;
    
    const cardsHtml = sortedRecords.map((record, index) => {
      const date = new Date(record.timestamp);
      const timeStr = date.toLocaleDateString('zh-CN', {month: 'numeric', day: 'numeric'});
      const analyzeLimit = record.analyzeLimit || 10;
      const limitLabel = analyzeLimit > 50 ? '全年' : `${analyzeLimit}期`;
      const zodiacs = RecordView.renderZodiacButtons(record.zodiacPrediction);
      
      return `
        <div class="zodiac-card" data-slide-index="${index}">
          <div class="zodiac-card-header">
            <span class="zodiac-period-tag">${limitLabel}</span>
            <span class="zodiac-page-info">${index + 1}/${sortedRecords.length}</span>
          </div>
          <div class="zodiac-buttons-row">
            ${zodiacs}
          </div>
        </div>
      `;
    }).join('');
    
    const paginationHtml = sortedRecords.length > 1 ? `
      <div class="zodiac-pagination">
        ${sortedRecords.map((_, i) => `<div class="zodiac-pagination-dot ${i === startIndex ? 'active' : ''}"></div>`).join('')}
      </div>
    ` : '';
    
    return `
      <div class="zodiac-section">
        <div class="zodiac-scroll-wrapper" data-scroll="zodiac">
          ${cardsHtml}
        </div>
        ${paginationHtml}
      </div>
    `;
  },

  renderZodiacButtons: (zodiacPrediction) => {
    if (!zodiacPrediction || zodiacPrediction.length === 0) {
      return '<div class="zodiac-btn">暂无</div>';
    }
    
    return zodiacPrediction.slice(0, 6).map((item, index) => {
      const topClass = index === 0 ? 'top-1' : (index === 1 ? 'top-2' : (index === 2 ? 'top-3' : ''));
      return `<div class="zodiac-btn ${topClass}">${item.zodiac || '未知'}</div>`;
    }).join('');
  },

  initZodiacScrollEvents: () => {
    document.querySelectorAll('.zodiac-scroll-wrapper').forEach(container => {
      const pagination = container.parentElement.querySelector('.zodiac-pagination');
      
      const updatePagination = () => {
        if (!pagination) return;
        const scrollLeft = container.scrollLeft;
        const itemWidth = container.offsetWidth;
        const index = Math.round(scrollLeft / itemWidth);
        const dots = pagination.querySelectorAll('.zodiac-pagination-dot');
        dots.forEach((dot, i) => {
          dot.classList.toggle('active', i === index);
        });
      };
      
      container.addEventListener('scroll', updatePagination, { passive: true });
      
      setTimeout(() => {
        container.scrollTo({ left: 0, behavior: 'instant' });
        updatePagination();
      }, 100);
    });
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

  showImportDialog: () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if(file) {
        Storage.importData(file).then(() => {
          RecordView.renderRecordList();
          if(typeof FilterView !== 'undefined') FilterView.renderFilterList();
        }).catch(err => {
          console.error('导入失败', err);
        });
      }
    };
    input.click();
  },

  exportRecords: () => {
    Storage.exportData();
  },

  renderZodiacGrid: (zodiacPrediction) => {
    if (!zodiacPrediction || zodiacPrediction.length === 0) {
      return '<div class="empty-tip">暂无数据</div>';
    }
    
    return zodiacPrediction.slice(0, 6).map((item, index) => {
      const topClass = index === 0 ? 'top-1' : (index === 1 ? 'top-2' : (index === 2 ? 'top-3' : ''));
      return `
        <div class="record-zodiac-item ${topClass}">
          <div class="record-zodiac-name">${item.zodiac || '未知'}</div>
          <div class="record-zodiac-score">${item.score || 0}</div>
        </div>
      `;
    }).join('');
  },

  renderZodiacChips: (selectedZodiacs) => {
    if (!selectedZodiacs || selectedZodiacs.length === 0) {
      return '<div class="empty-tip">暂无数据</div>';
    }
    
    return selectedZodiacs.map(zodiac => {
      return `<span class="record-zodiac-chip">${zodiac}</span>`;
    }).join('');
  },

  renderNumberBalls: (numbers) => {
    if (!numbers || numbers.length === 0) {
      return '<div class="empty-tip">暂无数据</div>';
    }
    
    return numbers.map(num => {
      const color = Utils.getColorByNum(num);
      const zodiac = DataQuery._getZodiacByNum(num) || '';
      return AnalysisView.buildBall(num, color, zodiac);
    }).join('');
  },

  formatDate: (date) => {
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return '今天 ' + date.toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'});
    } else if (days === 1) {
      return '昨天 ' + date.toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'});
    } else if (days < 7) {
      return days + '天前';
    } else {
      return date.toLocaleDateString('zh-CN', {month: 'numeric', day: 'numeric'});
    }
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

  init: () => {
    RecordView.renderRecordList();
  }
};

window.addEventListener('hashchange', () => {
  if (window.location.hash === '#random' || window.location.hash === '') {
    setTimeout(() => {
      const randomPage = document.getElementById('randomPage');
      if (randomPage && randomPage.style.display !== 'none') {
        RecordView.renderRecordList();
      }
    }, 100);
  }
});
