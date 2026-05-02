/**
 * 特码独立算法 V3.3
 * @description 完全独立于生肖算法，根据候选生肖列表计算精选特码
 * 依赖：DataQuery（生肖号码映射）、CONFIG（配置常量）
 * 不修改、不耦合原有生肖任何逻辑
 */

/**
 * 特码算法固定配置
 * 所有参数集中管理，支持后期调参
 */
const SPECIAL_NUM_CONFIG = {
  SHORT_WINDOW: 13,
  MID_WINDOW: 29,
  HOT_WEIGHT: 0.65,
  MID_WEIGHT: 0.35,
  OUTPUT_COUNT: 10,
  HEAD_COUNT: 5,
  TAIL_COUNT: 10,
  HEAD_EXPECTED_RATIO: 0.20,
  TAIL_EXPECTED_RATIO: 0.10,
  MISSING_SCORES: { level1: { min: 6, score: 2 }, level2: { min: 10, score: 4 } },
  NEAR_OPEN_PENALTY: -3,
  NEAR_ADJACENT_PENALTY: -2,
  NEAR_OPEN_WINDOW: 3
};

const BusinessSpecialNum = {
  _cache: null,
  _cacheKey: null,

  /**
   * 过滤当年历史数据
   * 规则：当年数据 ≥ 50 条时用当年的，否则用最近 50 期
   * @param {Object[]} historyData - 全量历史数据
   * @returns {Object[]} 当年或最近50期数据
   */
  filterYearHistory: (historyData) => {
    if (!historyData || historyData.length === 0) return [];

    const now = new Date();
    const currentYear = String(now.getFullYear());

    const yearData = historyData.filter(item => {
      const expect = String(item.expect || '');
      return expect.startsWith(currentYear);
    });

    if (yearData.length >= 50) {
      return yearData;
    }

    return historyData.slice(0, 50);
  },

  /**
   * 主入口：计算精选特码
   * @param {string[]} zodiacList - 候选生肖列表，如 ['虎','羊','蛇']
   * @param {Object[]} historyData - 全量历史开奖数据
   * @returns {number[]} 前10个特码号码数组
   */
  calc: (zodiacList, historyData, debug = false) => {
    if (!zodiacList || zodiacList.length === 0 || !historyData || historyData.length === 0) {
      return [];
    }

    const now = new Date();
    const currentYear = String(now.getFullYear());
    const cacheKey = `special_${currentYear}_${zodiacList.join(',')}_${historyData.length}`;
    if (BusinessSpecialNum._cacheKey === cacheKey && BusinessSpecialNum._cache) {
      return BusinessSpecialNum._cache;
    }

    const candidateNums = BusinessSpecialNum._buildCandidatePool(zodiacList);
    if (candidateNums.length === 0) {
      return [];
    }

    if (debug) {
      console.log('=== 特码算法 V3.3 调试日志 ===');
      console.log('1. 候选生肖列表:', zodiacList);
      console.log('2. 候选号码池:', candidateNums);
      console.log('3. 历史数据量:', historyData.length);
    }

    const window13 = historyData.slice(0, SPECIAL_NUM_CONFIG.SHORT_WINDOW);
    const window29 = historyData.slice(0, SPECIAL_NUM_CONFIG.MID_WINDOW);

    const missingMap = BusinessSpecialNum._calcMissingMap(historyData, candidateNums);

    if (debug) {
      console.log('4. 遗漏数据:', missingMap);
    }

    const stats13 = BusinessSpecialNum._calcWindowStats(window13, window13.length);
    const stats29 = BusinessSpecialNum._calcWindowStats(window29, window29.length);

    if (debug) {
      console.log('5. 近13期统计:', stats13);
      console.log('6. 近29期统计:', stats29);
    }

    const hotScores = BusinessSpecialNum._calcHotScores(stats13, stats29);

    if (debug) {
      console.log('7. 热度分数:', hotScores);
    }

    const scoredNums = BusinessSpecialNum._scoreNums(candidateNums, missingMap, hotScores, historyData);

    if (debug) {
      console.log('8. 号码总分(前20):', scoredNums.sort((a, b) => b.totalScore - a.totalScore).slice(0, 20));
    }

    const result = scoredNums
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, SPECIAL_NUM_CONFIG.OUTPUT_COUNT)
      .map(item => item.num)
      .sort((a, b) => a - b);

    BusinessSpecialNum._cache = result;
    BusinessSpecialNum._cacheKey = cacheKey;

    if (debug) {
      console.log('9. 最终结果:', result);
      console.log('=== 调试结束 ===');
    }

    return result;
  },

  /**
   * 步骤1：根据候选生肖生成候选号码池
   */
  _buildCandidatePool: (zodiacList) => {
    const numSet = new Set();
    zodiacList.forEach(zodiac => {
      const nums = DataQuery.getZodiacNumbers(zodiac);
      if (nums && nums.length > 0) {
        nums.forEach(num => numSet.add(num));
      }
    });
    return Array.from(numSet).sort((a, b) => a - b);
  },

  /**
   * 步骤2：计算全局数字遗漏（全历史不截断）
   * 遗漏值 = 从最新一期开始，距离该号码最近一次开出的期数
   */
  _calcMissingMap: (historyData, candidateNums) => {
    const missingMap = {};

    candidateNums.forEach(num => {
      let missing = historyData.length;
      for (let i = 0; i < historyData.length; i++) {
        const item = historyData[i];
        const s = DataQuery.getSpecial(item);
        if (s.te === num) {
          missing = i;
          break;
        }
      }
      missingMap[num] = missing;
    });

    return missingMap;
  },

  /**
   * 步骤3：截取窗口并统计频次
   */
  _calcWindowStats: (windowData, windowSize) => {
    const headCount = new Array(SPECIAL_NUM_CONFIG.HEAD_COUNT).fill(0);
    const tailCount = new Array(SPECIAL_NUM_CONFIG.TAIL_COUNT).fill(0);

    windowData.forEach(item => {
      const s = DataQuery.getSpecial(item);
      const num = s.te;
      if (num >= 1 && num <= 49) {
        const head = Math.floor(num / 10);
        const tail = num % 10;
        if (head >= 0 && head < SPECIAL_NUM_CONFIG.HEAD_COUNT) {
          headCount[head]++;
        }
        tailCount[tail]++;
      }
    });

    return { headCount, tailCount, windowSize };
  },

  /**
   * 步骤4：加权合成头尾热度分（使用归一化频率，消除窗口差异）
   */
  _calcHotScores: (stats13, stats29) => {
    const headScore = [];
    const tailScore = [];

    for (let i = 0; i < SPECIAL_NUM_CONFIG.HEAD_COUNT; i++) {
      const ratio13 = stats13.windowSize > 0 ? stats13.headCount[i] / stats13.windowSize : 0;
      const ratio29 = stats29.windowSize > 0 ? stats29.headCount[i] / stats29.windowSize : 0;
      headScore.push(BusinessSpecialNum._ratioToScore(ratio13, ratio29, SPECIAL_NUM_CONFIG.HEAD_EXPECTED_RATIO));
    }

    for (let i = 0; i < SPECIAL_NUM_CONFIG.TAIL_COUNT; i++) {
      const ratio13 = stats13.windowSize > 0 ? stats13.tailCount[i] / stats13.windowSize : 0;
      const ratio29 = stats29.windowSize > 0 ? stats29.tailCount[i] / stats29.windowSize : 0;
      tailScore.push(BusinessSpecialNum._ratioToScore(ratio13, ratio29, SPECIAL_NUM_CONFIG.TAIL_EXPECTED_RATIO));
    }

    return { headScore, tailScore };
  },

  /**
   * 归一化频率转分数
   * @param {number} expectedRatio - 理论均匀分布比例（头数20%，尾数10%）
   */
  _ratioToScore: (ratio13, ratio29, expectedRatio) => {
    const weighted = ratio13 * SPECIAL_NUM_CONFIG.HOT_WEIGHT + ratio29 * SPECIAL_NUM_CONFIG.MID_WEIGHT;

    if (weighted >= expectedRatio * 1.5) {
      return 3;
    } else if (weighted >= expectedRatio * 1.2) {
      return 2;
    } else if (weighted >= expectedRatio * 0.8) {
      return 1;
    } else if (weighted >= expectedRatio * 0.5) {
      return 0;
    } else {
      return -1;
    }
  },

  /**
   * 步骤5：逐号码综合打分
   * 总分 = 头数热度 + 尾数热度 + 遗漏加分 + 扣分项（无预设基础分）
   */
  _scoreNums: (candidateNums, missingMap, hotScores, historyData) => {
    const near3Nums = new Set();
    const near3AdjSet = new Set();
    for (let i = 0; i < Math.min(SPECIAL_NUM_CONFIG.NEAR_OPEN_WINDOW, historyData.length); i++) {
      const s = DataQuery.getSpecial(historyData[i]);
      const num = s.te;
      near3Nums.add(num);
      if (num - 1 >= 1) near3AdjSet.add(num - 1);
      if (num + 1 <= 49) near3AdjSet.add(num + 1);
    }

    return candidateNums.map(num => {
      const head = Math.floor(num / 10);
      const tail = num % 10;

      let missingBonus = 0;
      const miss = missingMap[num];
      if (miss >= SPECIAL_NUM_CONFIG.MISSING_SCORES.level2.min) {
        missingBonus = SPECIAL_NUM_CONFIG.MISSING_SCORES.level2.score;
      } else if (miss >= SPECIAL_NUM_CONFIG.MISSING_SCORES.level1.min) {
        missingBonus = SPECIAL_NUM_CONFIG.MISSING_SCORES.level1.score;
      }

      const headHot = hotScores.headScore[head] || 0;
      const tailHot = hotScores.tailScore[tail] || 0;

      let penalty = 0;
      if (near3Nums.has(num)) {
        penalty += SPECIAL_NUM_CONFIG.NEAR_OPEN_PENALTY;
      }
      if (near3AdjSet.has(num)) {
        penalty += SPECIAL_NUM_CONFIG.NEAR_ADJACENT_PENALTY;
      }

      const totalScore = headHot + tailHot + missingBonus + penalty;

      return { num, totalScore };
    });
  },

  /**
   * 清除缓存
   */
  clearCache: () => {
    BusinessSpecialNum._cache = null;
    BusinessSpecialNum._cacheKey = null;
  }
};
