/**
 * 方案管理业务模块
 * @description 处理方案保存、加载、重命名、置顶、删除等功能
 */
const BusinessFilter = {
  _generateFilterName: (savedFilters) => {
    return `方案${savedFilters.length + 1}`;
  },

  saveFilterPrompt: () => {
    const state = StateManager._state;
    if(state.savedFilters.length >= CONFIG.MAX_SAVE_COUNT){
      return { success: false, error: 'max_count', limit: CONFIG.MAX_SAVE_COUNT };
    }

    return {
      success: true,
      defaultName: BusinessFilter._generateFilterName(state.savedFilters),
      state: {
        selected: Utils.deepClone(state.selected),
        excluded: Utils.deepClone(state.excluded)
      }
    };
  },

  saveFilter: (name) => {
    const state = StateManager._state;
    const filterName = (name || '').trim() || BusinessFilter._generateFilterName(state.savedFilters);
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
  },

  MARK_COLORS: ['#F59E0B', '#10B981', '#EF4444', '#14B8A6', '#8B5CF6', '#F97316'],
  MAX_MARK_LEVEL: 6,

  getMarkColor: (level) => {
    return BusinessFilter.MARK_COLORS[level % BusinessFilter.MARK_COLORS.length];
  },

  markTag: (group, selectedValues) => {
    if (!Array.isArray(selectedValues)) {
      selectedValues = [selectedValues];
    }

    selectedValues = selectedValues.map(v => {
      if (group === 'sum' || group === 'head' || group === 'tail') {
        return parseInt(v);
      }
      return v;
    });

    if (selectedValues.length === 0) {
      return { success: false, error: 'no_selection' };
    }

    const state = StateManager._state;
    const tagMarks = state.tagMarks || [];
    const currentLevel = tagMarks.length;

    if (currentLevel >= BusinessFilter.MAX_MARK_LEVEL) {
      return { success: false, error: 'max_level_reached', limit: BusinessFilter.MAX_MARK_LEVEL };
    }

    const tagKeys = selectedValues.map(value => `${group}_${value}`);
    const newMark = {
      level: currentLevel,
      color: BusinessFilter.getMarkColor(currentLevel),
      tagKeys: tagKeys
    };

    tagMarks.push(newMark);
    Storage.saveTagMarks(tagMarks);

    // 直接清除所选项，保留杀状态
    const newSelected = {};
    Object.keys(state.selected).forEach(group => {
      newSelected[group] = [];
    });
    StateManager.setState({ selected: newSelected }, true);

    FilterView.renderAll();
    FilterView.renderAllTagMarks();
    FilterView.updateMarkButtonState();

    return { success: true, action: 'added', level: currentLevel, color: newMark.color, count: selectedValues.length };
  },

  clearAllTagMarks: () => {
    Storage.clearTagMarks();
    FilterView.renderAllTagMarks();
    FilterView.updateMarkButtonState();
    return { success: true };
  },

  getTagMarks: () => {
    return StateManager._state.tagMarks || [];
  },

  getTagMarkLevels: (group, value) => {
    if (group === 'sum' || group === 'head' || group === 'tail') {
      value = parseInt(value);
    }
    const tagKey = `${group}_${value}`;
    const tagMarks = StateManager._state.tagMarks || [];
    const levels = [];
    tagMarks.forEach(mark => {
      if (mark.tagKeys && mark.tagKeys.includes(tagKey)) {
        levels.push({ level: mark.level, color: mark.color });
      }
    });
    return levels;
  },

  hasTagMark: (group, value) => {
    return BusinessFilter.getTagMarkLevels(group, value).length > 0;
  },

  getCurrentMarkLevel: () => {
    const tagMarks = StateManager._state.tagMarks || [];
    return tagMarks.length;
  }
};
