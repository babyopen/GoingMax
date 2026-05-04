/**
 * 筛选页面视图
 * @description 筛选页面的渲染逻辑，包含结果展示、标签状态、排除网格、生肖标签、方案列表等
 */
const FilterView = {
  init: () => {
    FilterView.renderAll();
  },

  createFragment: (list, renderItem) => {
    const fragment = document.createDocumentFragment();
    list.forEach((item, index) => {
      const el = renderItem(item, index);
      if(el) fragment.appendChild(el);
    });
    return fragment;
  },

  renderAll: () => {
    FilterView.renderResult();
    FilterView.renderTagStatus();
  },

  renderResult: () => {
    try {
      const state = StateManager._state;
      const filteredList = Filter.getFilteredList();
      
      const fragment = FilterView.createFragment(filteredList, (item) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'num-item';
        wrapper.setAttribute('role', 'listitem');
        wrapper.innerHTML = `<div class="num-ball ${item.color}色">${item.s}</div><div class="tag-zodiac">${item.zodiac}</div>`;
        return wrapper;
      });

      DOM.resultNums.innerHTML = '';
      DOM.resultNums.appendChild(fragment);
      
      DOM.resultCount.innerText = filteredList.length;
      DOM.excludeCount.innerText = state.excluded.length;
    } catch(e) {
      console.error('渲染结果失败', e);
    }
  },

  renderTagStatus: (group = null) => {
    try {
      const state = StateManager._state;
      const isSizeOddGroup = ['bs', 'sumOdd', 'sumBig', 'tailBig'].includes(group);
      const groups = group ? [group] : Object.keys(state.selected);

      const groupKilledMap = {
        zodiac: state.killedZodiac || [],
        color: state.killedColor || [],
        colorsx: state.killedColorsx || [],
        type: state.killedType || [],
        element: state.killedElement || [],
        head: state.killedHead || [],
        tail: state.killedTail || [],
        sum: state.killedSum || [],
        bs: state.killedBs || [],
        sumOdd: state.killedSumOdd || [],
        sumBig: state.killedSumBig || [],
        tailBig: state.killedTailBig || []
      };

      document.querySelectorAll('[data-action="killGroup"]').forEach(btn => {
        const g = btn.dataset.group;
        if (g) {
          btn.classList.toggle('killed-active', (groupKilledMap[g] || []).length > 0);
        }
      });
      document.querySelectorAll('[data-action="killGroupBs"]').forEach(btn => {
        const anyKilled = ['bs','sumOdd','sumBig','tailBig'].some(g => (groupKilledMap[g] || []).length > 0);
        btn.classList.toggle('killed-active', anyKilled);
      });

      groups.forEach(g => {
        const selectedList = state.selected[g];
        const killedList = groupKilledMap[g] || [];
        document.querySelectorAll(`.tag[data-group="${g}"]`).forEach(tag => {
          let tagValue = tag.dataset.value;

          if (g === 'sum' || g === 'head' || g === 'tail') {
            tagValue = parseInt(tagValue);
          }

          const isActive = selectedList.includes(tagValue);
          tag.classList.toggle('active', isActive);
          tag.setAttribute('aria-checked', isActive);

          const isKilled = killedList.includes(tagValue);
          tag.classList.toggle('killed', isKilled);
        });
      });

      if (isSizeOddGroup) {
        ['bs', 'sumOdd', 'sumBig', 'tailBig'].forEach(subGroup => {
          const selectedList = state.selected[subGroup];
          const killedList = groupKilledMap[subGroup] || [];
          document.querySelectorAll(`.tag[data-group="${subGroup}"]`).forEach(tag => {
            const tagValue = tag.dataset.value;
            const isActive = selectedList.includes(tagValue);
            tag.classList.toggle('active', isActive);
            tag.setAttribute('aria-checked', isActive);
            const isKilled = killedList.includes(tagValue);
            tag.classList.toggle('killed', isKilled);
          });
        });
      }
    } catch(e) {
      console.error('渲染标签状态失败', e);
    }
  },

  renderExcludeGrid: () => {
    ExcludeView.renderExcludeGrid();
  },

  renderZodiacTags: () => {
    try {
      const state = StateManager._state;
      const fragment = FilterView.createFragment(state.zodiacCycle, (zodiac) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'tag filter-option';
        wrapper.dataset.type = 'zodiac';
        wrapper.dataset.value = zodiac;
        wrapper.dataset.group = 'zodiac';
        wrapper.setAttribute('role', 'checkbox');
        wrapper.setAttribute('tabindex', '0');
        wrapper.innerText = zodiac;
        return wrapper;
      });

      DOM.zodiacTags.innerHTML = '';
      DOM.zodiacTags.appendChild(fragment);
    } catch(e) {
      console.error('渲染生肖标签失败', e);
    }
  },

  renderFilterList: () => {
    SavedView.renderFilterList();
  },

  toggleExcludeLock: () => {
    ExcludeView.toggleExcludeLock();
  }
};
