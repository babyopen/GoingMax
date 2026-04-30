/**
 * 筛选页面视图
 * @description 筛选页面的渲染逻辑，包含结果展示、标签状态、排除网格、生肖标签、方案列表等
 */
const FilterView = {
  init: () => {
    FilterView.renderAll();
  },

  renderAll: () => {
    FilterView.renderResult();
    FilterView.renderTagStatus();
    FilterView.renderExcludeGrid();
  },

  renderResult: () => {
    try {
      const state = StateManager._state;
      const filteredList = Filter.getFilteredList();
      
      const fragment = Utils.createFragment(filteredList, (item) => {
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

      groups.forEach(g => {
        const selectedList = state.selected[g];
        document.querySelectorAll(`.tag[data-group="${g}"]`).forEach(tag => {
          let tagValue = tag.dataset.value;

          if (g === 'sum' || g === 'head') {
            tagValue = parseInt(tagValue);
          }

          const isActive = selectedList.includes(tagValue);
          tag.classList.toggle('active', isActive);
          tag.setAttribute('aria-checked', isActive);
        });
      });

      if (isSizeOddGroup) {
        ['bs', 'sumOdd', 'sumBig', 'tailBig'].forEach(subGroup => {
          const selectedList = state.selected[subGroup];
          document.querySelectorAll(`.tag[data-group="${subGroup}"]`).forEach(tag => {
            const tagValue = tag.dataset.value;
            const isActive = selectedList.includes(tagValue);
            tag.classList.toggle('active', isActive);
            tag.setAttribute('aria-checked', isActive);
          });
        });
      }
    } catch(e) {
      console.error('渲染标签状态失败', e);
    }
  },

  renderExcludeGrid: () => {
    try {
      const state = StateManager._state;
      const fragment = Utils.createFragment(Array.from({length:49}, (_,i)=>i+1), (num) => {
        const isExcluded = state.excluded.includes(num);
        const wrapper = document.createElement('div');
        wrapper.className = `exclude-tag ${isExcluded ? 'excluded' : ''}`;
        wrapper.dataset.num = num;
        wrapper.setAttribute('aria-checked', isExcluded);
        wrapper.setAttribute('tabindex', '0');
        wrapper.innerText = num.toString().padStart(2,'0');
        return wrapper;
      });

      DOM.excludeGrid.innerHTML = '';
      DOM.excludeGrid.appendChild(fragment);
    } catch(e) {
      console.error('渲染排除网格失败', e);
    }
  },

  renderZodiacTags: () => {
    try {
      const state = StateManager._state;
      const fragment = Utils.createFragment(state.zodiacCycle, (zodiac) => {
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
    try {
      const state = StateManager._state;
      const savedList = state.savedFilters;

      if(!savedList.length){
        DOM.filterList.innerHTML = "<div style='text-align:center;color:var(--sub-text)'>暂无保存的方案</div>";
        return;
      }

      const showCount = 2;
      const displayList = state.showAllFilters ? savedList : savedList.slice(0, showCount);
      const fragment = document.createDocumentFragment();

      displayList.forEach((item, index) => {
        const realIndex = state.showAllFilters ? index : index;
        const previewList = Filter.getFilteredList(item.selected, item.excluded).slice(0, CONFIG.PREVIEW_MAX_COUNT);
        const previewFragment = Utils.createFragment(previewList, (num) => {
          const wrapper = document.createElement('div');
          wrapper.className = 'num-item';
          wrapper.innerHTML = `<div class="num-ball ${num.color}色">${num.s}</div><div class="tag-zodiac">${num.zodiac}</div>`;
          return wrapper;
        });

        const itemWrapper = document.createElement('div');
        itemWrapper.className = 'filter-item';
        itemWrapper.setAttribute('role', 'listitem');
        itemWrapper.innerHTML = `
          <div class="filter-row">
            <div class="filter-item-name">${item.name}</div>
            <div class="filter-preview"></div>
          </div>
          <div class="filter-item-btns">
            <button data-action="${CONFIG.ACTIONS.LOAD_FILTER}" data-index="${realIndex}">加载</button>
            <button data-action="${CONFIG.ACTIONS.RENAME_FILTER}" data-index="${realIndex}">重命名</button>
            <button data-action="${CONFIG.ACTIONS.COPY_FILTER}" data-index="${realIndex}">复制</button>
            <button data-action="${CONFIG.ACTIONS.TOP_FILTER}" data-index="${realIndex}">置顶</button>
            <button class="del" data-action="${CONFIG.ACTIONS.DELETE_FILTER}" data-index="${realIndex}">删除</button>
          </div>
        `;
        itemWrapper.querySelector('.filter-preview').appendChild(previewFragment);
        fragment.appendChild(itemWrapper);
      });

      if(savedList.length > showCount){
        const expandBtn = document.createElement('div');
        expandBtn.className = 'filter-expand';
        expandBtn.dataset.action = CONFIG.ACTIONS.TOGGLE_SHOW_ALL;
        expandBtn.innerText = state.showAllFilters ? '收起' : `展开全部(${savedList.length}条)`;
        fragment.appendChild(expandBtn);
      }

      DOM.filterList.innerHTML = '';
      DOM.filterList.appendChild(fragment);
    } catch(e) {
      console.error('渲染方案列表失败', e);
    }
  }
};
