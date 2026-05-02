/**
 * 渲染模块
 * @description 通用渲染工具方法
 */
const Render = {
  hideLoading: () => {
    DOM.loadingMask.classList.add('hide');
    setTimeout(() => {
      DOM.loadingMask.style.display = 'none';
    }, 300);
  },

  renderVersion: () => {
    const versionSpan = document.querySelector('.top-title span:last-child');
    if(versionSpan) {
      versionSpan.textContent = 'V' + CONFIG.VERSION;
    }
  },

  showCopyDialog: (numStr) => {
    const overlay = document.createElement('div');
    overlay.className = 'copy-dialog-overlay';

    const modal = document.createElement('div');
    modal.className = 'copy-dialog-box';

    modal.innerHTML = `
      <div class="copy-dialog-header">请手动复制号码</div>
      <div class="copy-dialog-body">
        <div class="copy-dialog-numbers">${numStr}</div>
        <button class="copy-dialog-btn">我知道了</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    modal.querySelector('button').addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    overlay.addEventListener('click', (e) => {
      if(e.target === overlay) document.body.removeChild(overlay);
    });
  },

  showImportDialog: (onImportComplete) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if(file) {
        Storage.importData(file).then(() => {
          if(onImportComplete) onImportComplete();
        }).catch(err => {
          console.error('导入失败', err);
        });
      }
    };
    input.click();
  },

  showModal: (overlayClass, boxClass, headerHtml, bodyHtml, footerHtml = '') => {
    const overlay = document.createElement('div');
    overlay.className = overlayClass;

    const modal = document.createElement('div');
    modal.className = boxClass;

    let contentHtml = '';
    if(headerHtml) contentHtml += headerHtml;
    if(bodyHtml) contentHtml += bodyHtml;
    if(footerHtml) contentHtml += footerHtml;

    modal.innerHTML = contentHtml;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const close = () => {
      if(overlay.parentNode) document.body.removeChild(overlay);
    };

    const closeBtn = modal.querySelector('.modal-close-btn, .modal-footer-btn, .mode-detail-close');
    if(closeBtn) closeBtn.addEventListener('click', close);

    overlay.addEventListener('click', (e) => {
      if(e.target === overlay) close();
    });

    return { close, overlay, modal };
  },

  showZodiacDetailModal: (zodiac, detailData) => {
    const headerHtml = `
      <div class="zodiac-detail-header">
        <h3 class="zodiac-detail-title">${zodiac} 详情分析</h3>
      </div>
    `;

    let bodyHtml = `<div class="zodiac-detail-body">`;
    bodyHtml += `<div class="zodiac-detail-row"><strong>综合评分：</strong>${Math.round(detailData.score)}分</div>`;
    bodyHtml += `<div class="zodiac-detail-row"><strong>所属池：</strong>${detailData.pool}</div>`;
    bodyHtml += `<div class="zodiac-detail-row"><strong>推荐梯队：</strong>${detailData.tierTag}</div>`;
    bodyHtml += `<div class="zodiac-detail-row"><strong>梯队等级：</strong>${detailData.tierLevel}</div>`;
    bodyHtml += `<div class="zodiac-detail-row"><strong>出现次数：</strong>${detailData.count}次 (${detailData.rate})</div>`;
    bodyHtml += `<div class="zodiac-detail-row"><strong>遗漏期数：</strong>${detailData.miss}期</div>`;
    bodyHtml += `<div class="zodiac-detail-row"><strong>当前行情：</strong>${detailData.marketModeText}</div>`;
    bodyHtml += `</div>`;

    if(detailData.tags && detailData.tags.length > 0) {
      bodyHtml += `<div class="zodiac-detail-section"><h4 class="zodiac-detail-section-title">优化标记</h4><div>`;
      detailData.tags.forEach(t => {
        bodyHtml += `<span class="zodiac-mark-tag">${t}</span>`;
      });
      bodyHtml += `</div></div>`;
    }

    bodyHtml += `<div class="zodiac-detail-section"><h4 class="zodiac-detail-section-title">关联号码</h4><div>`;
    const numbers = detailData.numbers || [];
    numbers.forEach(num => {
      const colorClass = Render._getNumColorClass(num);
      const numStr = String(num).padStart(2, '0');
      bodyHtml += `<span class="zodiac-num-ball ${colorClass}">${numStr}</span>`;
    });
    bodyHtml += `</div></div>`;

    if(!detailData.hasPredictResult) {
      bodyHtml += `<div class="zodiac-hint-box" style="margin:16px 20px;"><strong>提示：</strong>历史数据未加载，显示的是默认信息。请切换到分析页面加载历史数据后查看详细分析。</div>`;
    }

    const footerHtml = `<button class="modal-footer-btn">关闭</button>`;

    Render.showModal('zodiac-detail-overlay', 'zodiac-detail-box', headerHtml, bodyHtml, footerHtml);
  },

  showZodiacAppearModal: (zodiac, data) => {
    const headerHtml = `
      <div class="zodiac-detail-header">
        <h3 class="zodiac-detail-title">${zodiac} 出现记录</h3>
      </div>
    `;

    let bodyHtml = `<div class="zodiac-detail-body">`;
    bodyHtml += `<div class="zodiac-empty-tip" style="margin-bottom:12px;">共出现 ${data.totalCount} 次</div>`;

    if(data.stats) {
      bodyHtml += `<div class="zodiac-stat-card">`;
      bodyHtml += `<div class="zodiac-stat-title">间隔统计</div>`;
      bodyHtml += `<div class="zodiac-stat-row"><span>平均间隔</span><span>${data.stats.avgInterval.toFixed(1)}期</span></div>`;
      bodyHtml += `<div class="zodiac-stat-row"><span>最大间隔</span><span>${data.stats.maxInterval}期</span></div>`;
      bodyHtml += `<div class="zodiac-stat-row"><span>最小间隔</span><span>${data.stats.minInterval}期</span></div>`;
      bodyHtml += `</div>`;
    }

    bodyHtml += `<div class="zodiac-records-list">`;
    if(data.records && data.records.length === 0) {
      bodyHtml += `<div class="zodiac-empty-tip">该生肖在近期未出现</div>`;
    } else if(data.records) {
      data.records.forEach((r, idx) => {
        const numStr = String(r.num).padStart(2, '0');
        let intervalText = '';
        if(idx > 0) {
          const interval = data.records[idx - 1].index - r.index;
          intervalText = `<span class="zodiac-record-expect">间隔${interval}期</span>`;
        }
        bodyHtml += `<div class="zodiac-record-item">`;
        bodyHtml += `<span>${r.expect}${intervalText}</span>`;
        bodyHtml += `<span><span class="zodiac-record-num">${r.zodiac} ${numStr}</span></span>`;
        bodyHtml += `</div>`;
      });
    }
    bodyHtml += `</div></div>`;

    const footerHtml = `<button class="modal-footer-btn">关闭</button>`;

    Render.showModal('zodiac-appear-overlay', 'zodiac-appear-box', headerHtml, bodyHtml, footerHtml);
  },

  showZodiacSelectedDetailModal: (detailData) => {
    const headerHtml = `
      <div class="zodiac-detail-header">
        <h3 class="zodiac-detail-title">${detailData.zodiac} 精选详情</h3>
      </div>
    `;

    let bodyHtml = `<div class="zodiac-detail-body">`;
    bodyHtml += `<div class="zodiac-detail-row"><strong>综合评分：</strong>${detailData.totalScore}分</div>`;
    bodyHtml += `<div class="zodiac-detail-row"><strong>出现次数：</strong>${detailData.count}次</div>`;
    bodyHtml += `<div class="zodiac-detail-row"><strong>遗漏期数：</strong>${detailData.miss}期</div>`;
    bodyHtml += `<div class="zodiac-detail-row"><strong>轮转状态：</strong>${detailData.cycleState}</div>`;
    bodyHtml += `<div class="zodiac-detail-row"><strong>当前行情：</strong>${detailData.marketMode}</div>`;
    bodyHtml += `<div class="zodiac-detail-row"><strong>窗口信号：</strong>${detailData.windowSignal}</div>`;
    bodyHtml += `</div>`;

    bodyHtml += `<div class="zodiac-detail-section">`;
    bodyHtml += `<h4 class="zodiac-detail-section-title">五大算法得分</h4>`;
    bodyHtml += `<div class="zodiac-detail-row"><strong>基础频次分：</strong>${detailData.baseScore}分</div>`;
    bodyHtml += `<div class="zodiac-detail-row"><strong>热号惯性分：</strong>${detailData.hotInertia}分</div>`;
    bodyHtml += `<div class="zodiac-detail-row"><strong>遗漏回补分：</strong>${detailData.missRepair}分</div>`;
    bodyHtml += `<div class="zodiac-detail-row"><strong>轮转平衡分：</strong>${detailData.cycleBalance}分</div>`;
    bodyHtml += `<div class="zodiac-detail-row"><strong>多窗口形态分：</strong>${detailData.patternScore}分</div>`;
    bodyHtml += `</div>`;

    bodyHtml += `<div class="zodiac-detail-section">`;
    bodyHtml += `<h4 class="zodiac-detail-section-title">对应号码</h4>`;
    bodyHtml += `<div class="zodiac-detail-row">${detailData.numbers}</div>`;
    bodyHtml += `</div>`;

    const footerHtml = `<button id="zodiacDetailClose" class="modal-footer-btn">关闭</button>`;

    Render.showModal('zodiac-detail-modal-overlay', 'zodiac-detail-modal-box', headerHtml, bodyHtml, footerHtml);
  },

  showMarketModeModal: (result) => {
    const sorted = result.sortedZodiacs || [];
    let rowsHtml = '';
    sorted.forEach(([zod]) => {
      const score = Math.round(result.zodiacScores[zod] || 0);
      const details = result.zodiacDetails[zod];
      if(!details) return;

      const marks = [];
      if(details._overdueByOverheat) marks.push('过耗');
      if(details._pseudoHot) marks.push('伪热');
      if(details._coldCritical) marks.push('临界');
      if(details._blockedByRepeat) marks.push('重码');
      if(details._annualWeak) marks.push('年弱');
      if(details._overheatSilence) marks.push('静默');
      if(details._recent3Penalty) marks.push('近3');
      if(details._warnedByOverheat) marks.push('透支轻');
      if(details._blockedByOverheat) marks.push('透支重');

      rowsHtml += `
        <tr>
          <td>${zod}</td>
          <td style="text-align:center;">${score}分</td>
          <td style="text-align:center;">${details.pool === 'hot' ? '热' : details.pool === 'warm' ? '温' : '冷'}</td>
          <td>${marks.length > 0 ? marks.join('、') : '-'}</td>
        </tr>
      `;
    });

    const modeText = result.modeText || '-';

    const headerHtml = `
      <div class="mode-detail-header">
        <span class="mode-detail-title">行情详情</span>
        <span class="mode-detail-close" data-action="closeModeDetail">&times;</span>
      </div>
    `;

    let bodyHtml = `<div class="mode-detail-body">`;
    bodyHtml += `<div class="mode-detail-info">`;
    bodyHtml += `<div class="mode-detail-info-label">当前行情模式</div>`;
    bodyHtml += `<div class="mode-detail-info-value">${modeText}</div>`;
    bodyHtml += `</div>`;
    bodyHtml += `<table class="modal-table">`;
    bodyHtml += `<thead><tr><th>生肖</th><th style="text-align:center;">得分</th><th style="text-align:center;">池</th><th>标记</th></tr></thead>`;
    bodyHtml += `<tbody>${rowsHtml}</tbody>`;
    bodyHtml += `</table>`;
    bodyHtml += `</div>`;

    Render.showModal('modal-zodiac-mode-overlay', 'modal-zodiac-mode', headerHtml, bodyHtml);
  },

  _getNumColorClass: (num) => {
    if(CONFIG.COLOR_MAP['红'].includes(num)) return 'red';
    if(CONFIG.COLOR_MAP['蓝'].includes(num)) return 'blue';
    if(CONFIG.COLOR_MAP['绿'].includes(num)) return 'green';
    return 'red';
  }
};
