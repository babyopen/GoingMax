/**
 * 方案管理业务模块
 * @description 处理方案保存、加载、重命名、置顶、删除等功能
 */
const BusinessFilter = {
  saveFilterPrompt: () => {
    const state = StateManager._state;
    if(state.savedFilters.length >= CONFIG.MAX_SAVE_COUNT){
      Toast.show(`最多只能保存${CONFIG.MAX_SAVE_COUNT}个方案`);
      return;
    }

    const defaultName = `方案${state.savedFilters.length + 1}`;
    InputModal.show({
      title: '保存方案',
      defaultValue: defaultName,
      placeholder: '请输入方案名称',
      onConfirm: (name) => {
        const filterName = (name || '').trim() || defaultName;
        const filterItem = {
          name: filterName,
          selected: Utils.deepClone(state.selected),
          excluded: Utils.deepClone(state.excluded)
        };
        const success = Storage.saveFilter(filterItem);
        if(success){
          FilterView.renderFilterList();
          Toast.show('保存成功');
        }
      }
    });
  },

  loadFilter: (index) => {
    const state = StateManager._state;
    const item = state.savedFilters[index];
    if(!item) return;

    StateManager.setState({
      selected: Utils.deepClone(item.selected),
      excluded: Utils.deepClone(item.excluded)
    });
    Toast.show('加载成功');
  },

  copyFilterNums: (index) => {
    const state = StateManager._state;
    const item = state.savedFilters[index];
    if(!item) return;

    const list = Filter.getFilteredList(item.selected, item.excluded);
    if(list.length === 0){
      Toast.show('该方案无符合条件的号码');
      return;
    }

    const numStr = list.map(n => n.s).join(' ');
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(numStr).then(() => {
        Toast.show('复制成功');
      }).catch(() => {
        BusinessFilter.showCopyDialog(numStr);
      });
    } else {
      BusinessFilter.showCopyDialog(numStr);
    }
  },

  showCopyDialog: (numStr) => {
    AnalysisView.showCopyDialog(numStr);
  },

  renameFilter: (index) => {
    const state = StateManager._state;
    const item = state.savedFilters[index];
    if(!item) return;

    InputModal.show({
      title: '重命名方案',
      defaultValue: item.name,
      placeholder: '请输入新名称',
      onConfirm: (newName) => {
        if(!newName || newName.trim() === "") return;

        const newList = [...state.savedFilters];
        newList[index].name = newName.trim();
        const success = Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
        
        if(success){
          StateManager.setState({ savedFilters: newList }, false);
          FilterView.renderFilterList();
          Toast.show('重命名成功');
        }
      }
    });
  },

  topFilter: (index) => {
    const state = StateManager._state;
    const item = state.savedFilters[index];
    if(!item) return;

    const newList = [...state.savedFilters];
    newList.splice(index, 1);
    newList.unshift(item);
    const success = Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
    
    if(success){
      StateManager.setState({ savedFilters: newList }, false);
      FilterView.renderFilterList();
      Toast.show('置顶成功');
    }
  },

  deleteFilter: (index) => {
    InputModal.confirm({
      title: '删除方案',
      message: '确定删除该方案吗？',
      onConfirm: () => {
        const state = StateManager._state;
        const newList = [...state.savedFilters];
        newList.splice(index, 1);
        const success = Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
        
        if(success){
          StateManager.setState({ savedFilters: newList }, false);
          FilterView.renderFilterList();
          Toast.show('删除成功');
        }
      }
    });
  },

  clearAllSavedFilters: () => {
    InputModal.confirm({
      title: '清空所有方案',
      message: '确定清空所有方案吗？',
      onConfirm: () => {
        Storage.remove(Storage.KEYS.SAVED_FILTERS);
        StateManager.setState({ savedFilters: [] }, false);
        FilterView.renderFilterList();
        Toast.show('已清空所有方案');
      }
    });
  },

  toggleShowAllFilters: () => {
    const state = StateManager._state;
    StateManager.setState({ showAllFilters: !state.showAllFilters }, false);
    FilterView.renderFilterList();
  }
};
