/**
 * DOM缓存模块
 */
const DOM = {
  loadingMask: null,
  resultCount: null,
  resultNums: null,
  excludeCount: null,
  excludeGrid: null,
  lockExclude: null,
  filterList: null,
  zodiacTags: null,
  quickNavBtn: null,
  quickNavMenu: null,
  navTabs: null,
  navToggle: null,
  backTopBtn: null,
  toast: null,

  init: () => {
    DOM.loadingMask = document.getElementById('loadingMask');
    DOM.resultCount = document.getElementById('resultCount');
    DOM.resultNums = document.getElementById('resultNums');
    DOM.excludeCount = document.getElementById('excludeCount');
    DOM.excludeGrid = document.getElementById('excludeGrid');
    DOM.lockExclude = document.getElementById('lockExclude');
    DOM.filterList = document.getElementById('filterList');
    DOM.zodiacTags = document.getElementById('zodiacTags');
    DOM.quickNavBtn = document.getElementById('quickNavBtn');
    DOM.quickNavMenu = document.getElementById('quickNavMenu');
    DOM.navTabs = document.getElementById('navTabs');
    DOM.navToggle = document.getElementById('quickNavBtn');
    DOM.backTopBtn = document.getElementById('backTopBtn');
    DOM.toast = document.getElementById('toast');
  }
};
