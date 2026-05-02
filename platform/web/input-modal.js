/**
 * 输入框模态框模块
 * @description 替代 prompt/confirm，提供统一风格的输入确认体验
 */
const InputModal = {
  show: (options) => {
    const { title, defaultValue, placeholder, onConfirm, onCancel } = options;

    const overlay = document.createElement('div');
    overlay.className = 'input-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'input-modal-box';

    modal.innerHTML = `
      <div class="input-modal-header">
        <h3 class="input-modal-title">${title}</h3>
      </div>
      <div class="input-modal-body">
        <input type="text" 
          id="inputModalInput"
          class="input-modal-input"
          value="${defaultValue || ''}"
          placeholder="${placeholder || ''}"
        />
      </div>
      <div class="modal-btn-row">
        <button id="inputModalCancel" class="modal-btn-cancel">
          取消
        </button>
        <button id="inputModalConfirm" class="modal-btn-confirm">
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

    const modal = document.createElement('div');
    modal.className = 'confirm-modal-box';

    modal.innerHTML = `
      <div class="confirm-modal-header">
        <div class="confirm-modal-title">${title || '确认操作'}</div>
        ${message ? `<div class="confirm-modal-message">${message}</div>` : ''}
      </div>
      <div class="modal-btn-row">
        <button id="confirmModalCancel" class="modal-btn-cancel">
          取消
        </button>
        <button id="confirmModalConfirm" class="modal-btn-confirm">
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
