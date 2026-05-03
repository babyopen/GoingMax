/**
 * 历史详情页视图
 * @description 展示指定类别的全部历史记录
 */
const HistoryDetailView = {
  _currentCategory: '',

  CATEGORY_MAP: {
    'zodiac': '生肖预测',
    'selected': '精选',
    'special': '精选特码',
    'hot': '特码热门TOP5',
    'preferred': '优选记录'
  },

  render: (category) => {
    const page = document.getElementById('historyDetailPage');
    if (!page) return;

    const randomPage = document.getElementById('randomPage');
    if (randomPage) randomPage.style.display = 'none';

    HistoryDetailView._currentCategory = category;

    page.style.display = 'block';

    const titleEl = document.getElementById('historyDetailTitle');
    if (titleEl) {
      titleEl.textContent = HistoryDetailView.CATEGORY_MAP[category] || '历史记录';
    }

    const listEl = document.getElementById('historyDetailList');
    if (!listEl) return;

    if (category === 'preferred') {
      listEl.innerHTML = HistoryDetailView.renderCategoryPreferred();
      return;
    }

    const records = Storage._validateRecordHistory();
    const groupedByExpect = Utils.groupRecordsByExpect(records);

    if (groupedByExpect.length === 0) {
      listEl.innerHTML = '<div class="empty-tip">暂无历史记录</div>';
      return;
    }

    const html = groupedByExpect.map((group) => {
      const firstInGroup = group.records[0];
      const date = new Date(firstInGroup.timestamp);
      const timeStr = Utils.formatDate(date);

      let contentHtml = '';
      if (category === 'zodiac') {
        contentHtml = HistoryDetailView.renderCategoryZodiac(group.records);
      } else if (category === 'selected') {
        contentHtml = HistoryDetailView.renderCategorySelected(group.records);
      } else if (category === 'special') {
        contentHtml = HistoryDetailView.renderCategorySpecial(group.records);
      } else if (category === 'hot') {
        contentHtml = HistoryDetailView.renderCategoryHot(firstInGroup);
      }

      return `
        <div class="record-card">
          <div class="record-card-header">
            <div class="record-card-title">
              <span class="record-period">第 ${firstInGroup.expect || '--'} 期</span>
              <span class="record-time">${timeStr}</span>
            </div>
            <div class="record-card-actions">
              <button class="btn-mini red" data-action="deleteHistoryDetailRecord" data-record-id="${firstInGroup.id}">删除</button>
            </div>
          </div>
          <div class="record-card-body">
            ${contentHtml}
          </div>
        </div>
      `;
    }).join('');

    listEl.innerHTML = html;
  },

  refresh: () => {
    const category = HistoryDetailView._currentCategory;
    if (category) {
      HistoryDetailView.render(category);
    }
  },

  deleteRecord: (recordId) => {
    if (!recordId) {
      Toast.show('记录ID无效');
      return;
    }
    const success = Storage.deleteRecordById(recordId);
    if (success) {
      try {
        HistoryDetailView._forceRefresh();
      } catch (e) {
        console.error('删除后刷新失败', e);
        HistoryDetailView.render(HistoryDetailView._currentCategory);
      }
      Toast.show('记录已删除');
    } else {
      Toast.show('记录不存在或已被删除');
    }
  },

  _forceRefresh: () => {
    const page = document.getElementById('historyDetailPage');
    const listEl = document.getElementById('historyDetailList');
    if (!page || !listEl) return;

    const titleEl = document.getElementById('historyDetailTitle');
    const titleText = titleEl ? titleEl.textContent : '';
    let category = HistoryDetailView._currentCategory;
    if (!category) {
      for (const [key, value] of Object.entries(HistoryDetailView.CATEGORY_MAP)) {
        if (titleText === value) {
          category = key;
          break;
        }
      }
    }

    let records;
    try {
      const raw = localStorage.getItem(Storage.KEYS.RECORD_HISTORY);
      records = raw ? JSON.parse(raw) : [];
    } catch (e) {
      records = [];
    }

    const groupedByExpect = Utils.groupRecordsByExpect(records);

    if (groupedByExpect.length === 0) {
      listEl.innerHTML = '<div class="empty-tip">暂无历史记录</div>';
      return;
    }

    const html = groupedByExpect.map((group) => {
      const firstInGroup = group.records[0];
      const date = new Date(firstInGroup.timestamp);
      const timeStr = Utils.formatDate(date);

      let contentHtml = '';
      if (category === 'zodiac') {
        contentHtml = HistoryDetailView.renderCategoryZodiac(group.records);
      } else if (category === 'selected') {
        contentHtml = HistoryDetailView.renderCategorySelected(group.records);
      } else if (category === 'special') {
        contentHtml = HistoryDetailView.renderCategorySpecial(group.records);
      } else if (category === 'preferred') {
        contentHtml = HistoryDetailView.renderCategoryPreferred();
      } else if (category === 'hot') {
        contentHtml = HistoryDetailView.renderCategoryHot(firstInGroup);
      }

      return `
        <div class="record-card">
          <div class="record-card-header">
            <div class="record-card-title">
              <span class="record-period">第 ${firstInGroup.expect || '--'} 期</span>
              <span class="record-time">${timeStr}</span>
            </div>
            <div class="record-card-actions">
              <button class="btn-mini red" data-action="deleteHistoryDetailRecord" data-record-id="${firstInGroup.id}">删除</button>
            </div>
          </div>
          <div class="record-card-body">
            ${contentHtml}
          </div>
        </div>
      `;
    }).join('');

    listEl.innerHTML = html;
  },

  renderCategoryZodiac: (sameExpectRecords) => {
    return RecordView.renderZodiacCards(sameExpectRecords);
  },

  renderCategorySelected: (sameExpectRecords) => {
    return RecordView.renderSelectedZodiacCards(sameExpectRecords);
  },

  renderCategorySpecial: (sameExpectRecords) => {
    return RecordView.renderSpecialNumberCards(sameExpectRecords);
  },

  renderCategoryPreferred: () => {
    const state = StateManager._state;
    const specialHistory = state.specialHistory || [];
    const filteredHistory = specialHistory.filter(item => item.expect);
    const groupedByExpect = {};
    filteredHistory.forEach(item => {
      if (!groupedByExpect[item.expect]) groupedByExpect[item.expect] = [];
      groupedByExpect[item.expect].push(item);
    });

    const sortedExpects = Object.keys(groupedByExpect).sort((a, b) => Number(b) - Number(a));

    if (sortedExpects.length === 0) {
      return '<div class="empty-tip">暂无优选记录</div>';
    }

    return sortedExpects.map(expect => {
      const records = groupedByExpect[expect];
      return RecordView.renderPreferredNumberCards(records);
    }).join('');
  },

  renderCategoryHot: (firstInGroup) => {
    return `
      <div class="record-section">
        <div class="record-section-title">特码热门TOP5</div>
        <div class="record-number-row">
          ${RecordView.renderNumberBallsWithHit(firstInGroup.hotNumbers, firstInGroup.hotHit, firstInGroup.drawZodiac, 'hot', firstInGroup.drawResult)}
        </div>
      </div>
    `;
  },

  back: () => {
    const historyDetailPage = document.getElementById('historyDetailPage');
    if (historyDetailPage) {
      historyDetailPage.style.display = 'none';
    }

    const randomPage = document.getElementById('randomPage');
    if (randomPage) {
      randomPage.style.display = 'block';
    }

    RecordView.switchTab('history');
  }
};
