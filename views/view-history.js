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

  getColorByNum: (num) => {
    const color = Object.keys(CONFIG.COLOR_MAP).find(c => CONFIG.COLOR_MAP[c].includes(Number(num)));
    const colorMap = { '红': 'red', '蓝': 'blue', '绿': 'green' };
    return colorMap[color] || 'red';
  },

  renderNumberBallsWithHit: (numbers, hitList, drawZodiac, type, drawResult) => {
    if (!numbers || numbers.length === 0) {
      return '<div class="empty-tip">暂无数据</div>';
    }
    
    const ballsHtml = numbers.map(num => {
      const color = RecordView.getColorByNum(num);
      const zodiac = DataQuery._getZodiacByNum(num) || '';
      const isHit = hitList && hitList.includes(num);
      return AnalysisView.buildBallWithHit(num, color, zodiac, isHit);
    }).join('');
    
    let drawResultHtml = '';
    if (drawResult !== undefined && drawResult !== null && drawZodiac) {
      const color = RecordView.getColorByNum(drawResult);
      const numStr = String(drawResult).padStart(2, '0');
      drawResultHtml = `
        <div class="ball-item draw-result-ball">
          <div class="ball ${color}">${numStr}</div>
          <div class="ball-zodiac">${drawZodiac}</div>
        </div>
      `;
    }
    
    return `
      <div class="number-balls-wrapper">
        ${ballsHtml}
        ${drawResultHtml}
      </div>
    `;
  },

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
        const groupedByExpectAll = Utils.groupRecordsByExpect(filteredRecords);
        recordPeriod.textContent = groupedByExpectAll.length > 0 ? (groupedByExpectAll[0].records[0].expect || '--') : '--';
      }

      const groupedByExpect = Utils.groupRecordsByExpect(filteredRecords);
    const latestGroupOnly = groupedByExpect.slice(0, 1);

    const specialHistory = StateManager._state.specialHistory || [];
    const latestExpect = latestGroupOnly.length > 0 ? latestGroupOnly[0].records[0].expect : null;
    const preferredRecords = latestExpect
      ? specialHistory.filter(item => item.expect === latestExpect)
      : [];

    const html = latestGroupOnly.map((group, groupIndex) => {
        const firstInGroup = group.records[0];
        const date = new Date(firstInGroup.timestamp);
        const timeStr = Utils.formatDate(date);
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
              </div>
            </div>
            
            <div class="record-card-body">
              <div class="record-section">
                <div class="record-section-title-row">
                  <span class="record-section-title">生肖预测</span>
                  <button class="btn-mini" data-action="openHistoryDetail" data-category="zodiac">历史</button>
                </div>
                ${RecordView.renderZodiacCards(group.records, firstInGroup.expect)}
              </div>
              
              <div class="record-section">
                <div class="record-section-title-row">
                  <span class="record-section-title">第${firstInGroup.expect || '--'}期精选</span>
                  <button class="btn-mini" data-action="openHistoryDetail" data-category="selected">历史</button>
                </div>
                ${RecordView.renderSelectedZodiacCards(group.records)}
              </div>
              
              <div class="record-section">
                <div class="record-section-title-row">
                  <span class="record-section-title">精选特码</span>
                  <button class="btn-mini" data-action="openHistoryDetail" data-category="special">历史</button>
                </div>
                ${RecordView.renderSpecialNumberCards(group.records)}
              </div>
              
              <div class="record-section">
                <div class="record-section-title-row">
                  <span class="record-section-title">优选记录</span>
                  <button class="btn-mini" data-action="openHistoryDetail" data-category="preferred">历史</button>
                </div>
                ${RecordView.renderPreferredNumberCards(preferredRecords)}
              </div>
              
              <div class="record-section">
                <div class="record-section-title-row">
                  <span class="record-section-title">特码热门TOP5</span>
                  <button class="btn-mini" data-action="openHistoryDetail" data-category="hot">历史</button>
                </div>
                <div class="record-number-row">
                  ${RecordView.renderNumberBallsWithHit(firstInGroup.hotNumbers, firstInGroup.hotHit, firstInGroup.drawZodiac, 'hot', firstInGroup.drawResult)}
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
        loadMoreBtn.style.display = 'none';
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
    
    const firstRecord = sortedRecords[0];
    const drawZodiac = firstRecord.drawZodiac;
    const hasDrawResult = drawZodiac !== undefined && drawZodiac !== null;
    
    const cardsHtml = sortedRecords.map((record, index) => {
      const analyzeLimit = record.analyzeLimit || 10;
      const limitLabel = analyzeLimit > 50 ? '全年' : `${analyzeLimit}期`;
      const zodiacPrediction = record.zodiacPrediction;
      const buttonsHtml = RecordView.renderZodiacButtons(zodiacPrediction, drawZodiac, hasDrawResult);
      const drawBtnHtml = hasDrawResult ? `<div class="zodiac-btn draw-result ${record.zodiacHit.length > 0 ? 'hit-blue' : 'miss-red'}">${drawZodiac}</div>` : '';
      
      return `
        <div class="zodiac-card" data-slide-index="${index}">
          <div class="zodiac-card-header">
            <span class="zodiac-period-tag">${limitLabel}</span>
            <span class="zodiac-page-info">${index + 1}/${sortedRecords.length}</span>
          </div>
          <div class="zodiac-buttons-row">
            ${buttonsHtml}
            ${drawBtnHtml}
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

  renderZodiacButtons: (zodiacPrediction, drawZodiac, hasDrawResult) => {
    if (!zodiacPrediction || zodiacPrediction.length === 0) {
      return '<div class="zodiac-btn">暂无</div>';
    }
    
    return zodiacPrediction.slice(0, 6).map((item, index) => {
      const topClass = index === 0 ? 'top-1' : (index === 1 ? 'top-2' : (index === 2 ? 'top-3' : ''));
      const isHit = hasDrawResult && item.zodiac === drawZodiac;
      const hitClass = hasDrawResult && isHit ? 'hit-blue' : '';
      return `<div class="zodiac-btn ${topClass} ${hitClass}">${item.zodiac || '未知'}</div>`;
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

  renderSelectedZodiacCards: (sameExpectRecords) => {
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
    
    const firstRecord = sortedRecords[0];
    const drawZodiac = firstRecord.drawZodiac;
    const hasDrawResult = drawZodiac !== undefined && drawZodiac !== null;
    
    const cardsHtml = sortedRecords.map((record, index) => {
      const analyzeLimit = record.analyzeLimit || 10;
      const limitLabel = analyzeLimit > 50 ? '全年' : `${analyzeLimit}期`;
      const zodiacs = RecordView.renderSelectedZodiacButtons(record.selectedZodiacs, drawZodiac, hasDrawResult);
      const drawBtnHtml = hasDrawResult ? `<div class="zodiac-btn draw-result ${record.selectedHit.length > 0 ? 'hit-blue' : 'miss-red'}">${drawZodiac}</div>` : '';
      
      return `
        <div class="zodiac-card" data-slide-index="${index}">
          <div class="zodiac-card-header">
            <span class="zodiac-period-tag">${limitLabel}</span>
            <span class="zodiac-page-info">${index + 1}/${sortedRecords.length}</span>
          </div>
          <div class="zodiac-buttons-row">
            ${zodiacs}
            ${drawBtnHtml}
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
        <div class="zodiac-scroll-wrapper" data-scroll="selected-zodiac">
          ${cardsHtml}
        </div>
        ${paginationHtml}
      </div>
    `;
  },

  renderSelectedZodiacButtons: (selectedZodiacs, drawZodiac, hasDrawResult) => {
    if (!selectedZodiacs || selectedZodiacs.length === 0) {
      return '<div class="zodiac-btn">暂无</div>';
    }
    
    return selectedZodiacs.slice(0, 6).map((zodiac, index) => {
      const topClass = index === 0 ? 'top-1' : (index === 1 ? 'top-2' : (index === 2 ? 'top-3' : ''));
      const isHit = hasDrawResult && zodiac === drawZodiac;
      const hitClass = hasDrawResult && isHit ? 'hit-blue' : '';
      return `<div class="zodiac-btn ${topClass} ${hitClass}">${zodiac}</div>`;
    }).join('');
  },

  renderSpecialNumberCards: (sameExpectRecords) => {
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
    
    const firstRecord = sortedRecords[0];
    const drawResult = firstRecord.drawResult;
    const hasDrawResult = drawResult !== undefined && drawResult !== null;
    
    const cardsHtml = sortedRecords.map((record, index) => {
      const analyzeLimit = record.analyzeLimit || 10;
      const limitLabel = analyzeLimit > 50 ? '全年' : `${analyzeLimit}期`;
      const buttonsHtml = RecordView.renderSpecialNumberButtons(record.specialNumbers, drawResult, hasDrawResult);
      const drawBtnHtml = hasDrawResult ? RecordView.renderSpecialNumberDraw(drawResult, record.specialHit) : '';
      
      return `
        <div class="zodiac-card" data-slide-index="${index}">
          <div class="zodiac-card-header">
            <span class="zodiac-period-tag">${limitLabel}</span>
            <span class="zodiac-page-info">${index + 1}/${sortedRecords.length}</span>
          </div>
          <div class="zodiac-buttons-row">
            ${buttonsHtml}
            ${drawBtnHtml}
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
        <div class="zodiac-scroll-wrapper" data-scroll="special-num">
          ${cardsHtml}
        </div>
        ${paginationHtml}
      </div>
    `;
  },

  renderSpecialNumberButtons: (numbers, drawResult, hasDrawResult) => {
    if (!numbers || numbers.length === 0) {
      return '<div class="zodiac-btn">暂无</div>';
    }
    
    return numbers.slice(0, 6).map((num, index) => {
      const topClass = index === 0 ? 'top-1' : (index === 1 ? 'top-2' : (index === 2 ? 'top-3' : ''));
      const isHit = hasDrawResult && drawResult === num;
      const hitClass = hasDrawResult && isHit ? 'hit-blue' : '';
      const numStr = String(num).padStart(2, '0');
      return `<div class="zodiac-btn ${topClass} ${hitClass}">${numStr}</div>`;
    }).join('');
  },

  renderSpecialNumberDraw: (drawResult, hitList) => {
    const numStr = String(drawResult).padStart(2, '0');
    const isHit = hitList && hitList.includes(drawResult);
    const hitClass = isHit ? 'hit-blue' : 'miss-red';
    return `<div class="zodiac-btn draw-result ${hitClass}">${numStr}</div>`;
  },

  _dedupPreferredRecords: (records) => {
    if (!records || records.length === 0) return [];

    const seen = new Set();
    const deduped = [];

    records.forEach(record => {
      const nums = (record.numbers || []).slice(0, 6);
      if (nums.length === 0) return;

      const key = `${record.analyzeLimit}_${nums.join(',')}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(record);
      }
    });

    return deduped;
  },

  renderPreferredNumberCards: (sameExpectRecords) => {
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

    const dedupedRecords = RecordView._dedupPreferredRecords(sameExpectRecords);
    if (dedupedRecords.length === 0) {
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

    const sortedRecords = [...dedupedRecords].sort((a, b) => {
      const aLimit = a.analyzeLimit || 10;
      const bLimit = b.analyzeLimit || 10;
      return aLimit - bLimit;
    });

    const firstRecord = sortedRecords[0];
    const drawResult = firstRecord.drawResult;
    const hasDrawResult = drawResult !== undefined && drawResult !== null;

    const cardsHtml = sortedRecords.map((record, index) => {
      const analyzeLimit = record.analyzeLimit || 10;
      const limitLabel = analyzeLimit > 50 ? '全年' : `${analyzeLimit}期`;
      const nums = record.numbers || [];
      const hitNumbers = record.hitNumbers || [];
      const buttonsHtml = nums.slice(0, 6).map((num, btnIdx) => {
        const topClass = btnIdx === 0 ? 'top-1' : (btnIdx === 1 ? 'top-2' : (btnIdx === 2 ? 'top-3' : ''));
        const isHit = hitNumbers.includes(num);
        const hitClass = isHit ? 'hit-blue' : '';
        const numStr = String(num).padStart(2, '0');
        return `<div class="zodiac-btn ${topClass} ${hitClass}">${numStr}</div>`;
      }).join('');
      const drawBtnHtml = hasDrawResult ? RecordView.renderSpecialNumberDraw(drawResult, hitNumbers) : '';

      return `
        <div class="zodiac-card" data-slide-index="${index}">
          <div class="zodiac-card-header">
            <span class="zodiac-period-tag">${limitLabel}</span>
            <span class="zodiac-page-info">${index + 1}/${sortedRecords.length}</span>
          </div>
          <div class="zodiac-buttons-row">
            ${buttonsHtml}
            ${drawBtnHtml}
          </div>
        </div>
      `;
    }).join('');

    const paginationHtml = sortedRecords.length > 1 ? `
      <div class="zodiac-pagination">
        ${sortedRecords.map((_, i) => `<div class="zodiac-pagination-dot ${i === 0 ? 'active' : ''}"></div>`).join('')}
      </div>
    ` : '';

    return `
      <div class="zodiac-section">
        <div class="zodiac-scroll-wrapper" data-scroll="preferred-num">
          ${cardsHtml}
        </div>
        ${paginationHtml}
      </div>
    `;
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
      const color = RecordView.getColorByNum(num);
      const zodiac = DataQuery._getZodiacByNum(num) || '';
      return AnalysisView.buildBall(num, color, zodiac);
    }).join('');
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
    } else {
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
