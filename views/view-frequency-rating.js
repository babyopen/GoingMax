/**
 * 频率评级表视图层
 * @description 渲染频率评级表UI(iOS 17毛玻璃风格)
 * @layer view (只允许渲染和数据调用)
 */
const FrequencyRatingView = {

  ZONE_COLORS: {
    peak: { bg: 'rgba(255,69,58,0.18)', text: '#FF453A' },
    high: { bg: 'rgba(255,149,0,0.15)', text: '#FF9500' },
    mid: { bg: 'rgba(0,122,255,0.12)', text: '#007AFF' },
    low: { bg: 'rgba(48,209,88,0.12)', text: '#30D158' },
    wait: { bg: 'rgba(175,82,222,0.12)', text: '#AF52DE' }
  },

  ZONE_LABELS: {
    peak: '顶峰区',
    high: '高频区',
    mid: '中频区',
    low: '低频区',
    wait: '等待区'
  },

  ZONE_ORDER: ['peak', 'high', 'mid', 'low', 'wait'],

  _buildZodCard: (zodData, prevZone) => {
    const colors = FrequencyRatingView.ZONE_COLORS;
    const pz = prevZone || zodData.zone;
    const pzColors = colors[pz] || colors.wait;
    const willDropArrow = zodData.willDrop
      ? '<span style="color:#FF3B30;font-size:10px;margin-left:2px;vertical-align:super;">▼</span>'
      : '';
    return `
      <div class="zone-zod-card">
        <div class="zod-card-count-badge">${zodData.count}${willDropArrow}</div>
        <div class="zod-card-name">
          <span class="prev-zone-dot" style="background:${colors[pz] ? colors[pz].text : '#AF52DE'}"></span>
          ${zodData.zodiac}
        </div>
        <div class="zod-card-miss" style="background:${pzColors.bg};color:${pzColors.text}">${zodData.miss}期</div>
      </div>
    `;
  },

  _buildZoneGroup: (zodList, zoneKey, prevZoneMap) => {
    if (!zodList || zodList.length === 0) return '';
    const colors = FrequencyRatingView.ZONE_COLORS;
    const label = FrequencyRatingView.ZONE_LABELS[zoneKey];
    const color = colors[zoneKey];
    let cardsHtml = '';
    zodList.forEach(z => {
      cardsHtml += FrequencyRatingView._buildZodCard(z, prevZoneMap[z.zodiac]);
    });
    return `
      <div class="freq-zone-group">
        <div class="freq-zone-header">
          <span class="freq-zone-tag" style="background:${color.text}">${label}</span>
          <span class="zone-count-badge">${zodList.length}</span>
        </div>
        <div class="freq-zone-cards">${cardsHtml}</div>
      </div>
    `;
  },

  _buildCard: (cardData) => {
    const sortedZones = FrequencyRatingView.ZONE_ORDER.filter(zone =>
      cardData.grouped[zone] && cardData.grouped[zone].length > 0
    );
    let groupsHtml = '';
    sortedZones.forEach(zone => {
      groupsHtml += FrequencyRatingView._buildZoneGroup(
        cardData.grouped[zone],
        zone,
        cardData.prevZone
      );
    });
    return `
      <div class="freq-card">
        <div class="freq-card-title">${cardData.windowSize}期窗口</div>
        <div class="freq-card-body">${groupsHtml}</div>
      </div>
    `;
  },

  buildHtml: (renderData) => {
    if (renderData.error) {
      return `
        <div class="freq-empty">
          <div class="freq-empty-icon">📊</div>
          <div class="freq-empty-text">${renderData.error}</div>
          <div class="freq-empty-hint">至少需要12期历史数据</div>
        </div>
      `;
    }
    if (!renderData.cards || renderData.cards.length === 0) {
      return `
        <div class="freq-empty">
          <div class="freq-empty-icon">📊</div>
          <div class="freq-empty-text">暂无数据</div>
          <div class="freq-empty-hint">等待数据加载...</div>
        </div>
      `;
    }
    let cardsHtml = '';
    renderData.cards.forEach(card => {
      cardsHtml += FrequencyRatingView._buildCard(card);
    });
    return `
      <div class="freq-rating-container">
        <div class="freq-rating-header">
          <div class="freq-rating-title">频率评级表</div>
          <div class="freq-rating-subtitle">特码生肖 · 滑动窗口</div>
        </div>
        <div class="freq-cards-wrapper">${cardsHtml}</div>
      </div>
    `;
  },

  buildMeContent: () => {
    const historyData = StateManager._state.analysis.historyData;
    const freqResult = BusinessFrequencyRating.calcFrequencyRating(historyData);
    const prevZones = BusinessFrequencyRating.getZonePrevZones();
    const renderData = BusinessFrequencyRating.buildRenderData(freqResult, prevZones);
    if (!renderData.error) {
      BusinessFrequencyRating.saveZonePrevZones(freqResult.windows, prevZones);
    }
    return FrequencyRatingView.buildHtml(renderData);
  }
};