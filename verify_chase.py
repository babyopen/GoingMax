import urllib.request, json

url = "https://history.macaumarksix.com/history/macaujc2/y/2026"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req) as resp:
    raw = json.loads(resp.read())
    data = raw.get("data", raw)

# 繁体到简体映射
trad_to_simp = {
    "龍": "龙", "蛇": "蛇", "馬": "马", "羊": "羊",
    "猴": "猴", "雞": "鸡", "狗": "狗", "豬": "猪",
    "鼠": "鼠", "牛": "牛", "虎": "虎", "兔": "兔"
}

# 检查API原始数据
print("=" * 60)
print("检查API返回的zodiac字段格式")
print("=" * 60)
print("前3期数据:")
for i in range(3):
    item = data[i]
    print(f"\n期号: {item['expect']}")
    print(f"  zodiac字段原始值: {item.get('zodiac', '无')}")
    
    zodiac_arr = item.get('zodiac', '').split(',')
    print(f"  分割后数组: {zodiac_arr}")
    print(f"  数组长度: {len(zodiac_arr)}")
    
    if len(zodiac_arr) > 6:
        raw_zod = zodiac_arr[6]
        simp_zod = trad_to_simp.get(raw_zod, raw_zod)
        print(f"  第7位(索引6): {raw_zod} -> {simp_zod}")

# 统计25期（排除最新一期）
print("\n" + "=" * 60)
print("统计25期频次（排除最新2026123期）")
print("=" * 60)

freq = {}
periods_list = []
for i in range(1, 26):
    if i >= len(data):
        break
    item = data[i]
    zodiac_arr = item.get('zodiac', '').split(',')
    raw_zod = zodiac_arr[6] if len(zodiac_arr) > 6 else '-'
    special_zodiac = trad_to_simp.get(raw_zod, raw_zod)
    freq[special_zodiac] = freq.get(special_zodiac, 0) + 1
    periods_list.append({
        'period': item['expect'],
        'zodiac': special_zodiac
    })

print("\n25期特肖列表:")
for idx, p in enumerate(periods_list, 1):
    print(f"  {idx:2d}. {p['period']}期 -> {p['zodiac']}")

print("\n" + "-" * 60)
print("频次统计（热市阈值>=3）:")
print("-" * 60)
sorted_freq = sorted(freq.items(), key=lambda x: x[1], reverse=True)
for z, count in sorted_freq:
    marker = '✅' if count >= 3 else ''
    print(f"  {z}: {count}次 {marker}")

# 模拟算法逻辑
print("\n" + "-" * 60)
print("算法推荐结果:")
print("-" * 60)
high_freq = [z for z, c in sorted_freq if c >= 3]
print(f"高频生肖(≥3次): {high_freq} (共{len(high_freq)}个)")

if len(high_freq) >= 4:
    print(f"最终推荐: {high_freq[:4]}")
else:
    fallback = [z for z, c in sorted_freq if c == 2]
    needed = 4 - len(high_freq)
    result = high_freq + fallback[:needed]
    print(f"高频{len(high_freq)}个 + 补充{needed}个 = {result[:4]}")
