/**
 * 渲染模块
 * @description 通用渲染工具方法
 */
const Render = {
  buildNumList: () => {
    try {
      const list = [];
      for(let i = 1; i <= 49; i++) {
        const attrs = DataQuery.getNumAttrs(i);
        list.push({
          num: attrs.num,
          s: attrs.s,
          color: attrs.color,
          zodiac: attrs.zodiac,
          element: attrs.element,
          type: attrs.type,
          bs: attrs.bs,
          colorsx: attrs.colorsx,
          head: attrs.head,
          tail: attrs.tail,
          sum: attrs.sum,
          odd: attrs.odd,
          big: attrs.big,
          hot: '温号',
          sumOdd: '合' + attrs.odd,
          sumBig: '合' + attrs.big,
          tailBig: '尾' + (attrs.tail < 5 ? '小' : '大')
        });
      }
      StateManager.setState({ numList: list }, false);
      return list;
    } catch(e) {
      console.error('生成号码列表失败', e);
      Toast.show('数据初始化失败，请刷新重试');
      return [];
    }
  },

  buildZodiacCycle: () => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const thisYearSpring = new Date(CONFIG.SPRING_FESTIVAL[year]);
      const zodiacYear = now < thisYearSpring ? year - 1 : year;
      const branchIndex = (zodiacYear - 4) % 12;
      const currentBranch = CONFIG.EARTHLY_BRANCHES[branchIndex];
      const currentZodiac = CONFIG.ZODIAC_BASE[currentBranch];
      
      const currentIndex = CONFIG.EARTHLY_BRANCHES.indexOf(currentBranch);
      const cycleBranches = [];
      for(let i=0; i<12; i++){
        const index = (currentIndex - i + 12) % 12;
        cycleBranches.push(CONFIG.EARTHLY_BRANCHES[index]);
      }
      const zodiacCycle = cycleBranches.map(branch => CONFIG.ZODIAC_BASE[branch]);

      StateManager.setState({ currentZodiac, zodiacCycle }, false);
      
      DataQuery._numToAttrMap = null;
      DataQuery._attrToNumMap = null;
      DataQuery.init();
      
      return { currentZodiac, zodiacCycle };
    } catch(e) {
      console.error('生成生肖循环失败', e);
      Toast.show('生肖数据初始化失败');
      const fallbackCycle = ['马','蛇','龙','兔','虎','牛','鼠','猪','狗','鸡','猴','羊'];
      StateManager.setState({ currentZodiac: '马', zodiacCycle: fallbackCycle }, false);
      
      DataQuery._numToAttrMap = null;
      DataQuery._attrToNumMap = null;
      DataQuery.init();
      
      return { currentZodiac: '马', zodiacCycle: fallbackCycle };
    }
  },

  hideLoading: () => {
    DOM.loadingMask.classList.add('hide');
    setTimeout(() => {
      DOM.loadingMask.style.display = 'none';
    }, 300);
  }
};
