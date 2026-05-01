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
  },

  showCopyDialog: (numStr) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5); z-index: 10000;
      display: flex; align-items: center; justify-content: center;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #fff; border-radius: 8px; width: 90%; max-width: 360px;
      padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    modal.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 12px;">请手动复制号码</div>
      <div style="
        background: #f5f5f5; padding: 12px; border-radius: 8px;
        word-break: break-all; font-size: 14px; line-height: 1.6;
        margin-bottom: 16px; max-height: 200px; overflow-y: auto;
      ">${numStr}</div>
      <button class="btn-primary" style="
        width: 100%; padding: 12px; border: none; border-radius: 8px;
        background: var(--primary); color: #fff; font-size: 14px;
        cursor: pointer;
      ">我知道了</button>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    modal.querySelector('button').addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    overlay.addEventListener('click', (e) => {
      if(e.target === overlay) document.body.removeChild(overlay);
    });
  },

  showImportDialog: (onImportComplete) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if(file) {
        Storage.importData(file).then(() => {
          if(onImportComplete) onImportComplete();
        }).catch(err => {
          console.error('导入失败', err);
        });
      }
    };
    input.click();
  }
};
