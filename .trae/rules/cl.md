# 事件绑定强制规范（AI 必须自动遵守）
1. 所有点击交互必须使用：data-action 方式，统一事件委托。
2. 所有事件必须统一写在：/modules/event.js 或 EventBinder。
3. 禁止在元素上写 onclick、onchange 等内联事件。
4. 新增页面/按钮时，AI 必须自动：
   - 给标签加 data-action
   - 在事件模块添加对应处理逻辑
   - 不重复、不冲突、不污染全局
5. 视图页面只允许：渲染DOM，不允许绑定事件。