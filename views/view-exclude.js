/**
 * 排除页面视图
 * @description 排除号码相关的渲染逻辑
 */
const ExcludeView = {
  init: () => {
    ExcludeView.renderExcludeGrid();
  },

  createFragment: (list, renderItem) => {
    const fragment = document.createDocumentFragment();
    list.forEach((item, index) => {
      const el = renderItem(item, index);
      if(el) fragment.appendChild(el);
    });
    return fragment;
  },

  renderExcludeGrid: () => {
    try {
      const state = StateManager._state;
      const fragment = ExcludeView.createFragment(Array.from({length:49}, (_,i)=>i+1), (num) => {
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

  toggleExcludeLock: () => {
    const isLocked = DOM.lockExclude.checked;
    StateManager.setState({ lockExclude: isLocked }, false);
    Toast.show(isLocked ? '已锁定排除号码' : '已解锁排除号码');
  }
};
