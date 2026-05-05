/**
 * 生肖预测三窗口视图层
 * @description 渲染三窗口算法的预测结果，包括分池列表、评分、精选3肖等
 */
const ViewZodiacPredict = {
  showModeDetail: (result) => {
    const modeText = BusinessGemini.getModeText(result.marketMode);
    Render.showMarketModeModal({
      ...result,
      modeText
    });
  },

  renderPredictionGrid: () => {
    const result = BusinessGemini.calc();
    if(!result) return;

    const zodiacPredictionGrid = document.getElementById('zodiacPredictionGrid');
    if(!zodiacPredictionGrid) return;

    const predictionTitleEl = document.getElementById('zodiacPredictionTitle');
    const predictionModeEl = document.getElementById('zodiacPredictionMode');
    const period = window.predictPeriod || '';
    if(predictionTitleEl) predictionTitleEl.innerText = `第${period}期预测`;
    if(predictionModeEl) {
      const modeText = BusinessGemini.getModeText(result.marketMode);
      predictionModeEl.innerText = `当前模式：${modeText}`;
    }

    // 按推荐梯队排序：精选3肖 → 主推 → 备选 → 防守 → 其他
    const selected3 = result.selected3 || [];
    const recommend = result.strategy.recommend || [];
    const backup = result.strategy.backup || [];
    const defense = result.strategy.defense || [];

    const tierOrder = [];
    selected3.forEach(z => tierOrder.push(z));
    recommend.forEach(z => { if(!tierOrder.includes(z)) tierOrder.push(z); });
    backup.forEach(z => { if(!tierOrder.includes(z)) tierOrder.push(z); });
    defense.forEach(z => { if(!tierOrder.includes(z)) tierOrder.push(z); });
    result.sortedZodiacs.forEach(([zod]) => { if(!tierOrder.includes(zod)) tierOrder.push(zod); });

    let html = '';
    tierOrder.forEach((zod, idx) => {
      const score = result.zodiacScores[zod] || 0;
      const details = result.zodiacDetails[zod];
      if(!details) return;

      let topClass = '';
      if(idx === 0) topClass = 'top-1';
      else if(idx === 1) topClass = 'top-2';
      else if(idx === 2) topClass = 'top-3';

      // 梯队标记
      let tierTag = '';
      if(selected3.includes(zod)) tierTag = '精选';
      else if(recommend.includes(zod)) tierTag = '主推';
      else if(backup.includes(zod)) tierTag = '备选';
      else if(defense.includes(zod)) tierTag = '防守';

      const poolText = BusinessGemini.getPoolText(details.pool);
      const tags = [];
      if(tierTag) tags.push(`<span class="zodiac-prediction-tag tier-tag">${tierTag}</span>`);
      tags.push(`<span class="zodiac-prediction-tag">${poolText}</span>`);

      if(!zod) zod = '未知';

      html += `
        <div class="zodiac-prediction-item ${topClass}" data-zodiac="${zod}">
          <div class="zodiac-prediction-zodiac">${zod}</div>
          <div class="zodiac-prediction-score">${Math.round(score)}分</div>
          <div class="zodiac-prediction-details">
            ${tags.join('')}
          </div>
        </div>
      `;
    });
    zodiacPredictionGrid.innerHTML = html;
  }
};
