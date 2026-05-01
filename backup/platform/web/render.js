/**
 * 渲染模块
 * @description 通用渲染工具方法
 */
const Render = {
  hideLoading: () => {
    DOM.loadingMask.classList.add('hide');
    setTimeout(() => {
      DOM.loadingMask.style.display = 'none';
    }, 300);
  }
};
