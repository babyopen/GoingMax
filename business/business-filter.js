/**
 * 方案管理业务模块
 * @description 处理方案保存、加载、重命名、置顶、删除等功能
 */
const BusinessFilter = {
  saveFilterPrompt: () => {
    const state = StateManager._state;
    if(state.savedFilters.length >= CONFIG.MAX_SAVE_COUNT){
      return { success: false, error: 'max_count', limit: CONFIG.MAX_SAVE_COUNT };
    }

    const defaultName = `方案${state.savedFilters.length + 1}`;
    return {
      success: true,
      defaultName,
      state: {
        selected: Utils.deepClone(state.selected),
        excluded: Utils.deepClone(state.excluded)
      }
    };
  },

  saveFilter: (name) => {
    const state = StateManager._state;
    const filterName = (name || '').trim() || `方案${state.savedFilters.length + 1}`;
    const filterItem = {
      name: filterName,
      selected: Utils.deepClone(state.selected),
      excluded: Utils.deepClone(state.excluded)
    };
    const success = Storage.saveFilter(filterItem);
    if(success){
      const newState = [...state.savedFilters, filterItem];
      StateManager.setState({ savedFilters: newState }, false);
    }
    return { success, filterItem };
  },

  loadFilter: (index) => {
    const state = StateManager._state;
    const item = state.savedFilters[index];
    if(!item) return null;

    StateManager.setState({
      selected: Utils.deepClone(item.selected),
      excluded: Utils.deepClone(item.excluded)
    });
    return { success: true, index };
  },

  copyFilterNums: (index) => {
    const state = StateManager._state;
    const item = state.savedFilters[index];
    if(!item) return null;

    const list = Filter.getFilteredList(item.selected, item.excluded);
    if(list.length === 0){
      return { success: false, error: 'empty' };
    }

    const numStr = list.map(n => n.s).join(' ');
    return { success: true, numStr };
  },

  showCopyDialog: (numStr) => {
    return { numStr };
  },

  renameFilter: (index) => {
    const state = StateManager._state;
    const item = state.savedFilters[index];
    if(!item) return null;

    return {
      index,
      originalName: item.name
    };
  },

  doRenameFilter: (index, newName) => {
    if(!newName || newName.trim() === "") return null;

    const state = StateManager._state;
    const newList = [...state.savedFilters];
    newList[index].name = newName.trim();
    const success = Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
    
    if(success){
      StateManager.setState({ savedFilters: newList }, false);
    }
    return { success, newName: newName.trim() };
  },

  topFilter: (index) => {
    const state = StateManager._state;
    const item = state.savedFilters[index];
    if(!item) return null;

    const newList = [...state.savedFilters];
    newList.splice(index, 1);
    newList.unshift(item);
    const success = Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
    
    if(success){
      StateManager.setState({ savedFilters: newList }, false);
    }
    return { success, newIndex: 0 };
  },

  deleteFilter: (index) => {
    return { index };
  },

  doDeleteFilter: (index) => {
    const state = StateManager._state;
    const newList = [...state.savedFilters];
    newList.splice(index, 1);
    const success = Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
    
    if(success){
      StateManager.setState({ savedFilters: newList }, false);
    }
    return { success };
  },

  clearAllSavedFilters: () => {
    return true;
  },

  doClearAllSavedFilters: () => {
    Storage.remove(Storage.KEYS.SAVED_FILTERS);
    StateManager.setState({ savedFilters: [] }, false);
    return true;
  },

  toggleShowAllFilters: () => {
    const state = StateManager._state;
    const newValue = !state.showAllFilters;
    StateManager.setState({ showAllFilters: newValue }, false);
    return newValue;
  }
};
