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
    'hot': '特码热门TOP5'
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
        contentHtml = HistoryDetailView.renderCategorySpecial(firstInGroup);
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
    if (HistoryDetailView._currentCategory) {
      HistoryDetailView.render(HistoryDetailView._currentCategory);
    }
  },

  deleteRecord: (recordId) => {
    const success = Storage.deleteRecordById(recordId);
    if (success) {
      HistoryDetailView.refresh();
      Toast.show('记录已删除');
    } else {
      Toast.show('记录不存在或已被删除');
    }
  },

  renderCategoryZodiac: (sameExpectRecords) => {
    return RecordView.renderZodiacCards(sameExpectRecords);
  },

  renderCategorySelected: (sameExpectRecords) => {
    return RecordView.renderSelectedZodiacCards(sameExpectRecords);
  },

  renderCategorySpecial: (firstInGroup) => {
    return `
      <div class="record-section">
        <div class="record-section-title">精选特码</div>
        <div class="record-number-row">
          ${RecordView.renderNumberBallsWithHit(firstInGroup.specialNumbers, firstInGroup.specialHit, firstInGroup.drawZodiac, 'special', firstInGroup.drawResult)}
        </div>
      </div>
    `;
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
