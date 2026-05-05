/**
 * 历史详情页视图
 * @description 展示指定类别的全部历史记录（追号计划 & 概率学历史）
 */
const HistoryDetailView = {
  _currentCategory: '',
  _fromPageId: '',

  CATEGORY_MAP: {
    'probability-history': '概率学历史',
    'high-chase': '追号计划历史'
  },

  render: (category) => {
    const page = document.getElementById('historyDetailPage');
    if (!page) return;

    document.querySelectorAll('.page').forEach(p => {
      if (p.id !== 'historyDetailPage' && p.style.display !== 'none') {
        HistoryDetailView._fromPageId = p.id;
      }
      if (p.id !== 'historyDetailPage') p.style.display = 'none';
    });

    HistoryDetailView._currentCategory = category;

    page.style.display = 'block';

    const titleEl = document.getElementById('historyDetailTitle');
    if (titleEl) {
      titleEl.textContent = HistoryDetailView.CATEGORY_MAP[category] || '历史记录';
    }

    const listEl = document.getElementById('historyDetailList');
    if (!listEl) return;

    if (category === 'probability-history') {
      listEl.innerHTML = HistoryDetailView.renderCategoryProbabilityHistory();
      return;
    }

    if (category === 'high-chase') {
      listEl.innerHTML = HistoryDetailView.renderCategoryHighChaseHistory();
      return;
    }

    listEl.innerHTML = '<div class="empty-tip">暂无历史记录</div>';
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

    if (category === 'probability-history') {
      listEl.innerHTML = HistoryDetailView.renderCategoryProbabilityHistory();
      return;
    }

    if (category === 'high-chase') {
      listEl.innerHTML = HistoryDetailView.renderCategoryHighChaseHistory();
      return;
    }

    listEl.innerHTML = '<div class="empty-tip">暂无历史记录</div>';
  },

  renderCategoryProbabilityHistory: () => {
    const historyData = BusinessProbabilityHistory.getHistoryData();
    if (!historyData || !historyData.records || historyData.records.length === 0) {
      return '<div class="empty-tip">暂无概率学历史记录</div>';
    }

    const stats = historyData.stats;
    const accuracyColor = stats.accuracy >= 60 ? '#22C55E' :
                         stats.accuracy >= 40 ? '#F59E0B' : '#EF4444';
    const last10Color = stats.last10Accuracy >= 60 ? '#22C55E' :
                       stats.last10Accuracy >= 40 ? '#F59E0B' : '#EF4444';

    const statsHtml = `
      <div class="high-chase-history-stats">
        <div class="high-chase-history-stat-item">
          <div class="high-chase-history-stat-value">${stats.totalRecords}</div>
          <div class="high-chase-history-stat-label">总记录</div>
        </div>
        <div class="high-chase-history-stat-item">
          <div class="high-chase-history-stat-value" style="color:${accuracyColor}">${stats.accuracy}%</div>
          <div class="high-chase-history-stat-label">总正确率</div>
        </div>
        <div class="high-chase-history-stat-item">
          <div class="high-chase-history-stat-value" style="color:${last10Color}">${stats.last10Accuracy}%</div>
          <div class="high-chase-history-stat-label">近10期</div>
        </div>
      </div>
    `;

    const recordsHtml = historyData.records.map(record => {
      const statusColor = record.isHit ? '#22C55E' : '#EF4444';
      const statusIcon = record.isHit ? '✅' : '❌';

      const buttonsHtml = (record.recommendation || []).map((zodiac, i) => {
        const hitClass = record.isHit && record.openedZodiac === zodiac ? 'hit-blue' : '';
        const topClass = i === 0 ? 'top-1' : (i === 1 ? 'top-2' : (i === 2 ? 'top-3' : ''));
        return `<div class="zodiac-btn ${topClass} ${hitClass}">${zodiac}</div>`;
      }).join('');

      return `
        <div class="record-simple-card">
          <div class="record-simple-header">
            <span class="record-simple-period">第${record.expect || '--'}期</span>
            <span class="record-simple-time" style="color:${statusColor}">${statusIcon} ${record.isHit ? '命中' : '未中'}</span>
          </div>
          <div class="record-simple-body">
            <div class="zodiac-buttons-row">
              ${buttonsHtml}
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      ${statsHtml}
      ${recordsHtml}
    `;
  },

  renderCategoryHighChaseHistory: () => {
    const historyData = BusinessHighChase.getHistoryRecords();
    if (!historyData || !historyData.records || historyData.records.length === 0) {
      return `
        <div class="empty-tip" style="padding:30px 0;">
          <div style="font-size:32px;margin-bottom:8px;">📊</div>
          <div>暂无历史记录</div>
        </div>
      `;
    }

    const stats = historyData.stats;
    const accuracyColor = stats.overallAccuracy >= 60 ? '#22C55E' :
                         stats.overallAccuracy >= 40 ? '#F59E0B' : '#EF4444';

    const statsHtml = `
      <div class="high-chase-history-stats">
        <div class="high-chase-history-stat-item">
          <div class="high-chase-history-stat-value">${stats.last10Plans}</div>
          <div class="high-chase-history-stat-label">完成计划</div>
        </div>
        <div class="high-chase-history-stat-item">
          <div class="high-chase-history-stat-value" style="color:${accuracyColor}">${stats.last10Accuracy}%</div>
          <div class="high-chase-history-stat-label">近10期正确率</div>
        </div>
        <div class="high-chase-history-stat-item">
          <div class="high-chase-history-stat-value">${stats.last10Hits}/${stats.last10Periods}</div>
          <div class="high-chase-history-stat-label">命中/总期数</div>
        </div>
      </div>
    `;

    const recordsHtml = historyData.records.map(record => {
      const recordAccuracyColor = record.accuracy >= 60 ? '#22C55E' :
                                  record.accuracy >= 33 ? '#F59E0B' : '#EF4444';

      const periodsHtml = record.periods.map(p => {
        const statusIcon = p.status === 'hit' ? '✅' : p.status === 'miss' ? '❌' : p.status === 'skipped' ? '➖' : '⏳';
        return `
          <div class="history-period-item ${p.status || 'pending'}">
            <span class="history-period-expect">${p.expect}</span>
            <span class="history-period-rec">${p.recommendation.join('、')}</span>
            <span class="history-period-status">${statusIcon} ${p.hitResult || '-'}</span>
            ${p.hitZodiac ? `<span class="history-period-opened">开${p.hitZodiac}</span>` : ''}
          </div>
        `;
      }).join('');

      return `
        <div class="high-chase-history-record">
          <div class="high-chase-history-record-header">
            <div class="high-chase-history-record-date">${record.completedAt || '--'} · ${record.market === 'hot' ? '热市' : '冷市'}</div>
            <div class="high-chase-history-record-accuracy" style="color:${recordAccuracyColor}">${record.accuracy}%</div>
          </div>
          <div class="high-chase-history-record-periods">
            ${periodsHtml}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="high-chase-history-content">
        ${statsHtml}
        <div class="high-chase-history-records">
          <div class="high-chase-history-records-title">历史计划</div>
          ${recordsHtml}
        </div>
      </div>
    `;
  },

  back: () => {
    const historyDetailPage = document.getElementById('historyDetailPage');
    if (historyDetailPage) {
      historyDetailPage.style.display = 'none';
    }

    const fromPage = HistoryDetailView._fromPageId;
    if (fromPage) {
      const targetPage = document.getElementById(fromPage);
      if (targetPage) {
        targetPage.style.display = 'block';
      }
    }

    HistoryDetailView._fromPageId = '';

    RecordView.switchTab('history');
  }
};
