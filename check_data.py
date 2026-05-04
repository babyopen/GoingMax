import urllib.request, json

url = "https://history.macaumarksix.com/history/macaujc2/y/2026"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req) as resp:
    raw = json.loads(resp.read())
    data = raw.get("data", raw)

print("总期数:", len(data))
print("最新期:", data[0]["expect"])
print()

trad_to_simp = {
    "龍": "龙", "蛇": "蛇", "馬": "马", "羊": "羊",
    "猴": "猴", "雞": "鸡", "狗": "狗", "豬": "猪",
    "鼠": "鼠", "牛": "牛", "虎": "虎", "兔": "兔"
}

print("前3期zodiac字段示例:")
for i in range(3):
    z = data[i]["zodiac"]
    arr = z.split(",")
    raw_zod = arr[6] if len(arr) > 6 else "无"
    simp_zod = trad_to_simp.get(raw_zod, raw_zod)
    print(f"  期号={data[i]['expect']}, 第7位原始={raw_zod}, 简体={simp_zod}")

print()
freq = {}
for i in range(1, 26):
    if i >= len(data):
        break
    zodiac_str = data[i]["zodiac"]
    arr = zodiac_str.split(",")
    raw_zod = arr[6] if len(arr) > 6 else "-"
    special_zodiac = trad_to_simp.get(raw_zod, raw_zod)
    freq[special_zodiac] = freq.get(special_zodiac, 0) + 1

print("=" * 50)
print("25期特肖频次统计:")
print("=" * 50)
sorted_freq = sorted(freq.items(), key=lambda x: x[1], reverse=True)
for z, count in sorted_freq:
    marker = "YES" if count >= 3 else ""
    print(f"  {z}: {count}次 {marker}")

print()
high_freq = [z for z, c in sorted_freq if c >= 3]
print("高频生肖(>=3次):", high_freq, "(共", len(high_freq), "个)")

if len(high_freq) >= 4:
    print("推荐结果:", high_freq[:4])
else:
    fallback = [z for z, c in sorted_freq if c == 2]
    needed = 4 - len(high_freq)
    result = high_freq + fallback[:needed]
    print("高频", len(high_freq), "个 + 补充", needed, "个 =", result[:4])
