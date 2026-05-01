/**
 * Toast提示模块
 */
const Toast = {
  _timer: null,

  show: (text, duration = CONFIG.TOAST_DURATION) => {
    clearTimeout(Toast._timer);
    const toastDom = DOM.toast || document.getElementById('toast');
    if (!toastDom) return;
    toastDom.innerText = text;
    toastDom.classList.add('show');
    Toast._timer = setTimeout(() => {
      toastDom.classList.remove('show');
    }, duration);
  },

  clearTimer: () => {
    clearTimeout(Toast._timer);
  }
};
