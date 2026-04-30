# 自动拆分 JS/CSS 模块化规则（AI 必须严格遵守）
## 1. 拆分目标
将现有 index.html 中的 CSS、JS 按功能拆分为多文件，不改变业务逻辑、不删代码、不破坏功能。

## 2. 最终目录结构（AI 必须按此创建）
index.html          # 只保留骨架，不内嵌 CSS/JS
style.css           # 全局样式（变量、布局、基础）
/app.js             # 路由、视图调度、初始化
/modules/            # 公共业务模块
  config.js         # 常量、配置
  utils.js          # 工具函数
  state.js          # 状态管理
  storage.js        # 本地存储
  toast.js          # 提示
  dom.js            # DOM 缓存
  render.js         # 渲染
  filter.js         # 筛选逻辑
  business.js       # 业务逻辑
  event.js          # 事件绑定
/views/              # 页面视图
  view-filter.js    # 筛选页
  view-exclude.js   # 排除页
  view-saved.js     # 方案页
  view-analyze.js   # 分析页
  view-history.js   # 历史记录
  view-predict.js   # 预测推演

## 3. 拆分铁律
1. 只拆分、不修改、不删除、不重构原有逻辑
2. CSS 全部抽离到 style.css，不改动样式效果
3. JS 按功能完整提取，不切割函数、不破坏调用
4. 视图按页面拆到 /views，每个视图只包含自己的渲染与初始化
5. 公共逻辑拆到 /modules，全局唯一、不重复
6. 所有引入顺序正确，不出现报错
7. 拆分后必须保证：筛选/排除/方案/分析全部正常运行

## 4. 禁止行为
- 禁止改变原有函数逻辑
- 禁止改变变量名、结构
- 禁止删除任何代码
- 禁止合并、重写逻辑
- 禁止擅自新增功能