/**
 * 输入框模态框模块
 * @description 替代 prompt/confirm，提供统一风格的输入确认体验
 */
const InputModal = {
  show: (options) => {
    const { title, defaultValue, placeholder, onConfirm, onCancel } = options;

    const overlay = document.createElement('div');
    overlay.className = 'input-modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #fff;
      border-radius: 12px;
      width: 85%;
      max-width: 320px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    `;

    modal.innerHTML = `
      <div style="padding: 16px 20px; border-bottom: 1px solid #eee; font-weight: 600; font-size: 16px;">
        ${title}
      </div>
      <div style="padding: 16px 20px;">
        <input type="text" 
          id="inputModalInput"
          value="${defaultValue || ''}"
          placeholder="${placeholder || ''}"
          style="
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-size: 14px;
            outline: none;
            box-sizing: border-box;
          "
        />
      </div>
      <div style="display: flex; border-top: 1px solid #eee;">
        <button id="inputModalCancel" style="flex: 1; padding: 12px; border: none; background: #f5f5f5; font-size: 14px; cursor: pointer;">
          取消
        </button>
        <button id="inputModalConfirm" style="flex: 1; padding: 12px; border: none; background: var(--primary, #1890ff); color: #fff; font-size: 14px; cursor: pointer;">
          确定
        </button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const input = document.getElementById('inputModalInput');
    const cancelBtn = document.getElementById('inputModalCancel');
    const confirmBtn = document.getElementById('inputModalConfirm');

    const close = () => {
      document.body.removeChild(overlay);
    };

    cancelBtn.addEventListener('click', () => {
      close();
      if(onCancel) onCancel();
    });

    confirmBtn.addEventListener('click', () => {
      const value = input.value;
      close();
      if(onConfirm) onConfirm(value);
    });

    overlay.addEventListener('click', (e) => {
      if(e.target === overlay) {
        close();
        if(onCancel) onCancel();
      }
    });

    setTimeout(() => input.focus(), 100);

    return { close };
  },

  confirm: (options) => {
    const { title, message, onConfirm, onCancel } = options;

    const overlay = document.createElement('div');
    overlay.className = 'confirm-modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #fff;
      border-radius: 12px;
      width: 85%;
      max-width: 320px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    `;

    modal.innerHTML = `
      <div style="padding: 20px; text-align: center;">
        <div style="font-size: 15px; color: #333; margin-bottom: 8px;">${title || '确认操作'}</div>
        ${message ? `<div style="font-size: 13px; color: #666;">${message}</div>` : ''}
      </div>
      <div style="display: flex; border-top: 1px solid #eee;">
        <button id="confirmModalCancel" style="flex: 1; padding: 12px; border: none; background: #f5f5f5; font-size: 14px; cursor: pointer;">
          取消
        </button>
        <button id="confirmModalConfirm" style="flex: 1; padding: 12px; border: none; background: var(--primary, #1890ff); color: #fff; font-size: 14px; cursor: pointer;">
          确定
        </button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const cancelBtn = document.getElementById('confirmModalCancel');
    const confirmBtn = document.getElementById('confirmModalConfirm');

    const close = () => {
      document.body.removeChild(overlay);
    };

    cancelBtn.addEventListener('click', () => {
      close();
      if(onCancel) onCancel();
    });

    confirmBtn.addEventListener('click', () => {
      close();
      if(onConfirm) onConfirm();
    });

    overlay.addEventListener('click', (e) => {
      if(e.target === overlay) {
        close();
        if(onCancel) onCancel();
      }
    });
  }
};
