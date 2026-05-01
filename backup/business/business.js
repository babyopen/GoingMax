/**
 * 业务逻辑模块（兼容层）
 * @description 将所有业务子模块的方法合并到 Business 对象，保持向后兼容
 */
const Business = {
  ...BusinessExclude,
  ...BusinessFilter,
  ...BusinessAnalysis,
  ...BusinessSpecial,
  ...BusinessNav,
  ...BusinessPredict
};
