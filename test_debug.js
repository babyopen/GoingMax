// 在浏览器控制台运行以下代码
const historyData = StateManager._state.analysis.historyData;
console.log('historyData 长度:', historyData.length);
console.log('最新5期数据:');
for(let i = 0; i < 5; i++) {
  const item = historyData[i];
  const s = DataQuery.getSpecial(item);
  console.log('  期号=' + item.expect + ', zodiac原始=' + item.zodiac + ', 特肖=' + (s ? s.zod : '无'));
}

console.log('\n统计25期频次:');
const freq = new Map();
for(let i = 1; i <= 25; i++) {
  const item = historyData[i];
  if(!item) break;
  const s = DataQuery.getSpecial(item);
  if(!s || !s.zod) continue;
  freq.set(s.zod, (freq.get(s.zod) || 0) + 1);
}
const sorted = Array.from(freq.entries()).sort((a,b) => b[1] - a[1]);
sorted.forEach(([z,c]) => console.log('  ' + z + ': ' + c + '次'));

console.log('\n高频追号策略结果:');
const result = BusinessHighChase.getStrategyData();
console.log('  推荐:', result.recommendation);
console.log('  行情:', result.market);
