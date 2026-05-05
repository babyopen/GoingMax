/**
 * 方案页面视图
 * @description 方案管理相关的渲染逻辑
 */
const SavedView = {
  init: () => {
    SavedView.renderFilterList();
  },

  createFragment: (list, renderItem) => {
    const fragment = document.createDocumentFragment();
    list.forEach((item, index) => {
      const el = renderItem(item, index);
      if(el) fragment.appendChild(el);
    });
    return fragment;
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
        const previewList = Filter.getFilteredList(item.selected, item.excluded);
        const previewFragment = SavedView.createFragment(previewList, (num) => {
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
      Logger.error('渲染方案列表失败', e);
    }
  }
};
