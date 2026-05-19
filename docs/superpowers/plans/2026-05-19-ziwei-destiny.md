# 紫微命盤 ‧ 八字 ‧ 流年 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立一個單一 HTML 檔的網頁應用,輸入出生資料後本地精算紫微命盤、八字四柱與八字重量,並用 Gemini API 分段生成詳細解盤與 2026 流年論斷,呈現「星空墨韻」風格。

**Architecture:** 計算引擎(萬年曆、八字、稱骨、紫微)寫成獨立 ES module 放在 `src/`,用 Node 內建測試器 `node --test` 做 TDD。`build.mjs` 把 `src/` 的模組與 `src/index.html` 模板組合成單一交付檔 `ziwei-destiny.html`。瀏覽器端只在執行時呼叫 Gemini API。

**Tech Stack:** 純 JavaScript(ES module)、Node.js v24(內建 test runner,無第三方框架)、HTML/CSS、Gemini `streamGenerateContent` API。

---

## File Structure

| 檔案 | 職責 |
|---|---|
| `package.json` | 標記 `"type": "module"`,定義 `test` / `build` script |
| `src/almanac.js` | 萬年曆:`lunarInfo` 表、24 節氣表、國曆↔農曆換算、節氣查詢 |
| `src/bazi.js` | 八字四柱:由國曆時間推年/月/日/時干支 |
| `src/chenggu.js` | 稱骨:四柱權重加總、總重與歌訣 |
| `src/ziwei.js` | 紫微骨架:命宮/身宮、五行局、紫微定位、十四主星落十二宮 |
| `src/gemini.js` | Gemini API 封裝:金鑰管理、`streamGenerateContent`、四段 prompt 建構 |
| `src/ui.js` | 畫面渲染與流程控制:表單、十二宮格、解讀/流年面板、串接流程 |
| `src/styles.css` | 星空墨韻樣式(含列印樣式、RWD) |
| `src/index.html` | HTML 模板,含 `<!-- INCLUDE:xxx -->` 佔位標記 |
| `build.mjs` | 把 CSS 與各 JS 模組(移除 `export`/`import`)inline 進模板,輸出 `ziwei-destiny.html` |
| `test/almanac.test.mjs` | 萬年曆測試 |
| `test/bazi.test.mjs` | 八字測試 |
| `test/chenggu.test.mjs` | 稱骨測試 |
| `test/ziwei.test.mjs` | 紫微測試 |
| `ziwei-destiny.html` | **最終交付物**,由 `build.mjs` 產出 |

**模組相依**:`bazi`、`ziwei` 依賴 `almanac`;`chenggu` 依賴 `bazi`;`ui` 依賴全部。各 `src/*.js` 用 `export` 匯出函式供測試 `import`;`build.mjs` 在 inline 時移除 `export`/`import` 行,使瀏覽器端成為共用全域。

**常數約定(全專案一致)**

- 天干索引:`['甲','乙','丙','丁','戊','己','庚','辛','壬','癸']`(0–9)
- 地支索引:`['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']`(0–11)
- 時辰:23–01 子、01–03 丑、03–05 寅 …… 21–23 亥(早子時歸入當日子時)
- 十二宮名順序:`['命宮','兄弟','夫妻','子女','財帛','疾厄','遷移','僕役','官祿','田宅','福德','父母']`

---

## Task 1: 專案骨架與測試環境

**Files:**
- Create: `package.json`
- Create: `test/smoke.test.mjs`
- Create: `src/.gitkeep`

- [ ] **Step 1: 建立 `package.json`**

```json
{
  "name": "ziwei-destiny",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "node --test test/",
    "build": "node build.mjs"
  }
}
```

- [ ] **Step 2: 寫一個 smoke 測試確認測試器可運作**

`test/smoke.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('測試環境可運作', () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 3: 執行測試確認通過**

Run: `npm test`
Expected: `# pass 1` `# fail 0`

- [ ] **Step 4: Commit**

```bash
git add package.json test/smoke.test.mjs src/.gitkeep
git commit -m "chore: 建立專案骨架與 Node 測試環境"
```

---

## Task 2: 萬年曆模組 — 國曆↔農曆換算

**Files:**
- Create: `src/almanac.js`
- Create: `test/almanac.test.mjs`

**背景**:`lunarInfo` 為公開、廣泛使用的 1900–2100 農曆資料表,每個整數編碼該年閏月位置與十二/十三個月的大小月。使用此標準資料集;測試案例會抓出任何轉錄錯誤。

- [ ] **Step 1: 寫失敗測試 — 已知國曆對應農曆**

`test/almanac.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solarToLunar, lunarToSolar } from '../src/almanac.js';

test('2000-01-01 國曆 → 農曆 1999 年十一月廿五', () => {
  const l = solarToLunar(2000, 1, 1);
  assert.equal(l.lunarYear, 1999);
  assert.equal(l.lunarMonth, 11);
  assert.equal(l.lunarDay, 25);
  assert.equal(l.isLeap, false);
});

test('1990-06-15 國曆 → 農曆 1990 年閏五月 廿三', () => {
  const l = solarToLunar(1990, 6, 15);
  assert.equal(l.lunarYear, 1990);
  assert.equal(l.lunarMonth, 5);
  assert.equal(l.lunarDay, 23);
  assert.equal(l.isLeap, true);
});

test('農曆 → 國曆 為 solarToLunar 的逆運算', () => {
  const s = lunarToSolar(1999, 11, 25, false);
  assert.equal(s.year, 2000);
  assert.equal(s.month, 1);
  assert.equal(s.day, 1);
});

test('超出範圍年份丟出錯誤', () => {
  assert.throws(() => solarToLunar(1899, 12, 31));
  assert.throws(() => solarToLunar(2101, 1, 1));
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `node --test test/almanac.test.mjs`
Expected: FAIL — `Cannot find module '../src/almanac.js'`

- [ ] **Step 3: 實作 `src/almanac.js`(換算部分)**

實作內容:
- `const lunarInfo = [...]` — 採用標準公開的 1900–2100 lunarInfo 陣列(201 個整數)。
- `lunarYearDays(y)` — 加總該年各月天數。
- `leapMonth(y)` = `lunarInfo[y-1900] & 0xf`(0 表無閏月)。
- `leapDays(y)` — 閏月天數(`lunarInfo[y-1900] & 0x10000 ? 30 : 29`)。
- `monthDays(y, m)` — 第 m 個非閏月天數(`lunarInfo[y-1900] & (0x10000 >> m) ? 30 : 29`)。
- `solarToLunar(y, m, d)`:以 1900-01-31 為農曆 1900 正月初一基準,計算與輸入日期相差天數,逐年逐月扣減得 `{lunarYear, lunarMonth, lunarDay, isLeap}`。輸入年份不在 1900–2100 丟 `RangeError`。
- `lunarToSolar(ly, lm, ld, isLeap)`:逆運算,累加天數後加回基準日,回傳 `{year, month, day}`。

匯出:`export { solarToLunar, lunarToSolar, lunarInfo };`

- [ ] **Step 4: 執行測試確認通過**

Run: `node --test test/almanac.test.mjs`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/almanac.js test/almanac.test.mjs
git commit -m "feat: 萬年曆模組 — 國曆農曆雙向換算"
```

---

## Task 3: 萬年曆模組 — 24 節氣查詢

**Files:**
- Modify: `src/almanac.js`
- Modify: `test/almanac.test.mjs`

**背景**:八字年柱以立春為界、月柱以「節」為界,需要精確到日的節氣表。採用標準節氣計算法:基準年常數 + 每節氣固定間隔 + 1900–2100 微調表(`sTermInfo`),或內建逐年節氣日資料。回傳指定年份某節氣的國曆日期。

- [ ] **Step 1: 寫失敗測試 — 已知節氣日期**

在 `test/almanac.test.mjs` 追加:
```js
import { solarTermDate, prevSolarTerm } from '../src/almanac.js';

test('2026 立春為 2026-02-04', () => {
  const d = solarTermDate(2026, '立春');
  assert.equal(d.month, 2);
  assert.equal(d.day, 4);
});

test('2026 芒種為 2026-06-05', () => {
  const d = solarTermDate(2026, '芒種');
  assert.equal(d.month, 6);
  assert.equal(d.day, 5);
});

test('2026-06-15 之前最近的「節」為芒種', () => {
  const t = prevSolarTerm(2026, 6, 15);
  assert.equal(t.name, '芒種');
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `node --test test/almanac.test.mjs`
Expected: FAIL — `solarTermDate is not a function`

- [ ] **Step 3: 實作節氣計算**

在 `src/almanac.js` 追加:
- `const solarTerms = ['小寒','大寒','立春','雨水','驚蟄','春分','清明','穀雨','立夏','小滿','芒種','夏至','小暑','大暑','立秋','處暑','白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至']`。
- 12 個「節」(用於月柱)為索引偶數:立春、驚蟄、清明、立夏、芒種、小暑、立秋、白露、寒露、立冬、大雪、小寒。
- `solarTermDate(year, name)` — 用標準節氣公式(`[Y×0.2422 + C] − [(Y−1900+1)/4]` 系列常數,C 值依節氣與世紀,1900–2100 範圍)+ 內建例外微調表,回傳 `{month, day}`。
- `prevSolarTerm(year, month, day)` — 回傳該日期之前(含當日)最近的「節」,跨年時回推前一年大雪/小寒,回傳 `{name, year, month, day}`。

匯出追加 `solarTermDate, prevSolarTerm, solarTerms`。

- [ ] **Step 4: 執行測試確認通過**

Run: `node --test test/almanac.test.mjs`
Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/almanac.js test/almanac.test.mjs
git commit -m "feat: 萬年曆模組 — 24 節氣查詢"
```

---

## Task 4: 八字模組 — 四柱干支

**Files:**
- Create: `src/bazi.js`
- Create: `test/bazi.test.mjs`

**演算法**
- 日柱:以儒略日數計算。`JD` 對 60 取模,基準對齊(已知 2000-01-07 為甲子日)→ 日干 = `n % 10`,日支 = `n % 12`。
- 時柱:時支由時辰直接得;時干 = `(日干 % 5) × 2 + 時支索引`,對 10 取模(五鼠遁)。
- 年柱:以立春為界。若國曆日期在當年立春之前,年柱用前一年。年干支 = `(年 − 4) % 60`。
- 月柱:用 `prevSolarTerm` 找出所在「節」→ 對應月支(立春後為寅月…);月干 = `(年干 % 5) × 2 + 月序`,對 10 取模(五虎遁)。

- [ ] **Step 1: 寫失敗測試**

`test/bazi.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getBaZi } from '../src/bazi.js';

// 1990-06-15 巳時(09:00–11:00)
test('1990-06-15 巳時 四柱', () => {
  const b = getBaZi(1990, 6, 15, 5); // 5 = 巳時索引
  assert.equal(b.year.gan + b.year.zhi, '庚午');
  assert.equal(b.month.gan + b.month.zhi, '壬午');
  assert.equal(b.day.gan + b.day.zhi, '丁未');
  assert.equal(b.hour.gan + b.hour.zhi, '乙巳');
});

test('立春前出生年柱算前一年', () => {
  // 2026-01-20 在 2026 立春(2/4)之前 → 年柱為乙巳(2025)
  const b = getBaZi(2026, 1, 20, 0);
  assert.equal(b.year.gan + b.year.zhi, '乙巳');
});

test('晚子時(23:30)歸入次日日柱', () => {
  const b = getBaZi(2000, 1, 7, 0, 30); // 23:00 後的子時
  assert.equal(b.hour.zhi, '子');
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `node --test test/bazi.test.mjs`
Expected: FAIL — `Cannot find module '../src/bazi.js'`

- [ ] **Step 3: 實作 `src/bazi.js`**

- 引入 `prevSolarTerm`、天干地支常數。
- `getBaZi(year, month, day, hourBranchIndex)` 回傳 `{ year:{gan,zhi}, month:{gan,zhi}, day:{gan,zhi}, hour:{gan,zhi} }`,各 `gan`/`zhi` 為單字字串。
- 子時(索引 0)若時間 ≥ 23:00 屬「晚子時」,日柱用次日。
- 依上述演算法計算。匯出 `export { getBaZi };`

- [ ] **Step 4: 執行測試確認通過**

Run: `node --test test/bazi.test.mjs`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/bazi.js test/bazi.test.mjs
git commit -m "feat: 八字模組 — 四柱干支推算"
```

---

## Task 5: 稱骨模組 — 八字重量與歌訣

**Files:**
- Create: `src/chenggu.js`
- Create: `test/chenggu.test.mjs`

**演算法**:袁天罡稱骨法。年(依干支 60 組)、月(1–12)、日(1–30)、時辰(子–亥)各對應固定「兩」數(以「錢」為單位的整數表,1 兩 = 10 錢)。四者相加得總重;總重對應 52 句稱骨歌訣其中一條。需內建四張權重表與歌訣對照表。

- [ ] **Step 1: 寫失敗測試**

`test/chenggu.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getChengGu } from '../src/chenggu.js';

test('稱骨回傳兩錢數與歌訣', () => {
  // 庚午年(1990)五月 廿三 巳時
  const r = getChengGu('庚午', 5, 23, '巳');
  assert.equal(typeof r.totalQian, 'number');     // 總錢數
  assert.ok(r.weightText.includes('兩'));          // 例 "三兩六錢"
  assert.ok(r.verse.length > 0);                  // 歌訣原文
});

test('總重 = 年月日時四項相加', () => {
  const r = getChengGu('庚午', 5, 23, '巳');
  assert.equal(r.totalQian, r.yearQian + r.monthQian + r.dayQian + r.hourQian);
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `node --test test/chenggu.test.mjs`
Expected: FAIL — `Cannot find module '../src/chenggu.js'`

- [ ] **Step 3: 實作 `src/chenggu.js`**

- `YEAR_QIAN`:60 干支 → 錢數對照(物件,key 為干支字串)。
- `MONTH_QIAN`:長度 12 陣列。
- `DAY_QIAN`:長度 30 陣列。
- `HOUR_QIAN`:12 地支 → 錢數。
- `VERSES`:總錢數 → 歌訣字串對照(由二兩一錢到七兩一錢,共 52 條)。
- `formatWeight(qian)` — 把錢數轉「X兩Y錢」字串。
- `getChengGu(yearGanZhi, lunarMonth, lunarDay, hourZhi)` 回傳 `{ yearQian, monthQian, dayQian, hourQian, totalQian, weightText, verse }`。
- 匯出 `export { getChengGu };`

> 實作時 `YEAR_QIAN`/`VERSES` 採用通行的袁天罡稱骨標準表。Step 1 的測試只驗證結構與加總一致性(非絕對數值),避免綁死特定流派數字;若採用的表來源明確,可再補一條對特定生辰的數值斷言。

- [ ] **Step 4: 執行測試確認通過**

Run: `node --test test/chenggu.test.mjs`
Expected: PASS — 2 tests

- [ ] **Step 5: Commit**

```bash
git add src/chenggu.js test/chenggu.test.mjs
git commit -m "feat: 稱骨模組 — 八字重量與歌訣"
```

---

## Task 6: 紫微模組 — 命宮、身宮、五行局

**Files:**
- Create: `src/ziwei.js`
- Create: `test/ziwei.test.mjs`

**演算法**
- 命宮地支:由寅起正月,順數至生月,再由生月宮起子時、逆數至生時 → 命宮。等式:`命宮支 = (2 + 生月 − 1 − 時辰索引) mod 12`。
- 身宮地支:`身宮支 = (2 + 生月 − 1 + 時辰索引) mod 12`。
- 命宮天干:由生年干起「五虎遁」定寅宮干,順推至命宮地支。
- 五行局:命宮干支查「納音五行」→ 水二局/木三局/金四局/土五局/火六局(回傳局數 2/3/4/5/6 與名稱)。

- [ ] **Step 1: 寫失敗測試**

`test/ziwei.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMingShen, getWuXingJu } from '../src/ziwei.js';

// 農曆五月、巳時(索引5)
test('命宮與身宮地支', () => {
  const r = getMingShen(5, 5);
  assert.equal(r.mingZhi, '午');   // (2+5-1-5) mod 12 = 1? 依實作驗證
  assert.equal(typeof r.shenZhi, 'string');
});

test('五行局回傳局數與名稱', () => {
  const ju = getWuXingJu('庚', '午'); // 命宮干支
  assert.ok([2,3,4,5,6].includes(ju.ju));
  assert.ok(ju.name.includes('局'));
});
```

> 註:Step 1 的 `mingZhi` 期望值請在實作後以權威排盤工具核對該生辰並改成正確值;先寫佔位,Step 4 前更正。

- [ ] **Step 2: 執行測試確認失敗**

Run: `node --test test/ziwei.test.mjs`
Expected: FAIL — `Cannot find module '../src/ziwei.js'`

- [ ] **Step 3: 實作命宮/身宮/五行局**

- `getMingShen(lunarMonth, hourIndex)` 回傳 `{ mingZhi, mingGan, shenZhi }`。
- `NAYIN` 表:60 干支 → 納音五行。
- `getWuXingJu(mingGan, mingZhi)` 回傳 `{ ju: 2|3|4|5|6, name: '水二局'|... }`。
- 匯出 `export { getMingShen, getWuXingJu };`

- [ ] **Step 4: 用權威工具核對測試期望值並執行通過**

先用線上權威排盤工具排出測試生辰的命宮、身宮、五行局,更正 Step 1 期望值。
Run: `node --test test/ziwei.test.mjs`
Expected: PASS — 2 tests

- [ ] **Step 5: Commit**

```bash
git add src/ziwei.js test/ziwei.test.mjs
git commit -m "feat: 紫微模組 — 命宮身宮與五行局"
```

---

## Task 7: 紫微模組 — 紫微定位與十四主星落宮

**Files:**
- Modify: `src/ziwei.js`
- Modify: `test/ziwei.test.mjs`

**演算法**
- 紫微星:由五行局數與農曆日定位。標準法:`商 = ceil(農曆日 / 局數)`,`餘 = 商×局數 − 農曆日`;餘數為偶則紫微在「寅起順數商−1」再依餘數加、奇則減 — 採用標準紫微定位表(局數×日 → 紫微地支),建議內建查表確保正確。
- 天府星:與紫微對稱,`天府支 = (4 − 紫微支 + 4) ... ` → 用標準對照(紫微在寅天府在寅、紫微在卯天府在丑…即關於寅申軸對稱)。
- 紫微星系(逆行):紫微、天機(紫微逆1)、太陽(逆3)、武曲(逆4)、天同(逆5)、廉貞(逆8)。
- 天府星系(順行):天府、太陰(順1)、貪狼(順2)、巨門(順3)、天相(順4)、天梁(順5)、七殺(順6)、破軍(順10)。
- 把十四主星依其地支落入十二宮,空宮標記為「空宮」。

- [ ] **Step 1: 寫失敗測試**

在 `test/ziwei.test.mjs` 追加:
```js
import { getZiWeiChart } from '../src/ziwei.js';

test('十四主星全數落宮、十二宮齊備', () => {
  const chart = getZiWeiChart({ lunarMonth: 5, lunarDay: 23, hourIndex: 5, yearGan: '庚', yearZhi: '午' });
  assert.equal(chart.palaces.length, 12);
  const allStars = chart.palaces.flatMap(p => p.stars);
  for (const s of ['紫微','天機','太陽','武曲','天同','廉貞','天府','太陰','貪狼','巨門','天相','天梁','七殺','破軍']) {
    assert.ok(allStars.includes(s), `應包含 ${s}`);
  }
});

test('每個宮位都有宮名與地支', () => {
  const chart = getZiWeiChart({ lunarMonth: 5, lunarDay: 23, hourIndex: 5, yearGan: '庚', yearZhi: '午' });
  for (const p of chart.palaces) {
    assert.ok(p.name && p.zhi);
  }
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `node --test test/ziwei.test.mjs`
Expected: FAIL — `getZiWeiChart is not a function`

- [ ] **Step 3: 實作 `getZiWeiChart`**

- 內建紫微定位查表 `ZIWEI_POS[ju][lunarDay]` → 地支索引(2/3/4/5/6 局,日 1–30),確保 100% 正確。
- 依星系規則排出十四主星地支。
- 從命宮地支起,逆時針(地支逆行)貼十二宮名。
- 回傳 `{ mingZhi, shenZhi, mingGan, wuXingJu, ziweiZhi, palaces: [{ name, zhi, gan, stars: [] }, ...12] }`。
- 匯出追加 `getZiWeiChart`。

- [ ] **Step 4: 用權威工具核對並執行通過**

用線上排盤工具核對測試生辰的紫微落宮與十四主星分布。
Run: `node --test test/ziwei.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ziwei.js test/ziwei.test.mjs
git commit -m "feat: 紫微模組 — 紫微定位與十四主星落宮"
```

---

## Task 8: 邊界案例測試補強

**Files:**
- Modify: `test/almanac.test.mjs`, `test/bazi.test.mjs`, `test/ziwei.test.mjs`

設計文件第 9 節要求覆蓋邊界。為已知正確答案的邊界生辰各補測試案例。

- [ ] **Step 1: 補邊界測試**

每個檔案各加 2–3 條,涵蓋:閏月生日、節氣交界當日出生、立春當日、子時換日、農曆年末、2100 年上限、1900 年下限。每條的期望值需先以權威排盤工具求得。

範例(`test/bazi.test.mjs`):
```js
test('節氣交界當日 — 芒種日出生月柱', () => {
  // 2026 芒種 6/5;6/5 當日出生月柱應為午月(以權威工具核對 gan)
  const b = getBaZi(2026, 6, 5, 6);
  assert.equal(b.month.zhi, '午');
});
```

- [ ] **Step 2: 執行全部測試確認通過**

Run: `npm test`
Expected: 全數 PASS

- [ ] **Step 3: Commit**

```bash
git add test/
git commit -m "test: 補強萬年曆/八字/紫微邊界案例"
```

---

## Task 9: Gemini 模組 — 金鑰管理與 API 封裝

**Files:**
- Create: `src/gemini.js`
- Create: `test/gemini.test.mjs`

**背景**:`gemini.js` 同時被 Node 測試與瀏覽器使用。金鑰存取用 `localStorage`(瀏覽器)— 測試只驗證純函式(prompt 建構),API 呼叫部分以可注入 `fetch` 的方式設計以便測試。

- [ ] **Step 1: 寫失敗測試 — prompt 建構與事實鎖定**

`test/gemini.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt } from '../src/gemini.js';

const facts = {
  name: '某甲', gender: '男',
  bazi: '庚午 壬午 丁未 乙巳',
  chengGu: '三兩六錢',
  ziwei: '命宮在午坐紫微;財帛宮在寅坐天機'
};

test('prompt 含事實鎖定區與盤面資料', () => {
  const p = buildPrompt('overall', facts);
  assert.ok(p.includes('不可更動'));
  assert.ok(p.includes('庚午 壬午 丁未 乙巳'));
  assert.ok(p.includes('命宮在午坐紫微'));
});

test('四種段落各有對應 prompt', () => {
  for (const s of ['overall', 'palaces', 'chenggu', 'liunian']) {
    assert.ok(buildPrompt(s, facts).length > 50);
  }
});

test('未知段落丟出錯誤', () => {
  assert.throws(() => buildPrompt('unknown', facts));
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `node --test test/gemini.test.mjs`
Expected: FAIL — `Cannot find module '../src/gemini.js'`

- [ ] **Step 3: 實作 `src/gemini.js`**

- `buildPrompt(section, facts)`:組合「事實鎖定」前言(「以下命盤為系統精算結果,為不可更動的事實,你只能解讀、不得重排星曜」)+ 盤面資料 + 該段落指示。四段:
  - `overall` — 整體格局與命主性情
  - `palaces` — 十二宮逐宮詳解(指示逐宮成段)
  - `chenggu` — 八字重量論斷(稱骨歌訣白話化 + 結合四柱)
  - `liunian` — 2026 丙午年流年(四化、事業/財運/感情/健康、月份走勢)
  - 各段落均要求「以傳統命理觀點、僅供參考的口吻;健康壽元等敏感面向用正向建設性措辭」。
- `getApiKey()` / `setApiKey(key, remember)` / `clearApiKey()`:`remember` 為真存 `localStorage`,否則存記憶體變數。瀏覽器外(測試)`localStorage` 不存在時降級為記憶體變數。
- `streamGenerate(section, facts, model, onChunk)`:async,呼叫 `streamGenerateContent` 端點,逐塊解析串流,每塊呼叫 `onChunk(text)`。HTTP 401 丟 `'KEY_INVALID'`、429 丟 `'QUOTA'`、其他網路錯誤丟 `'NETWORK'`。
- 匯出 `export { buildPrompt, getApiKey, setApiKey, clearApiKey, streamGenerate };`

- [ ] **Step 4: 執行測試確認通過**

Run: `node --test test/gemini.test.mjs`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/gemini.js test/gemini.test.mjs
git commit -m "feat: Gemini 模組 — 金鑰管理與分段 prompt"
```

---

## Task 10: HTML 模板與 build.mjs

**Files:**
- Create: `src/index.html`
- Create: `src/styles.css`
- Create: `build.mjs`

- [ ] **Step 1: 建立 `src/styles.css` 起始檔**

放入星空墨韻基礎變數(沿用 mockup):
```css
:root{
  --bg-deep:#070a14; --bg-mid:#16223f; --gold:#d4af5a; --gold-light:#f4e4b8;
  --ink:#7f8db5; --text:#cdd6e8; --line:#24304f;
}
body{margin:0;font-family:"Noto Serif TC",serif;color:var(--text);
  background:radial-gradient(ellipse at 50% 0%,#10182e 0%,#070a14 60%,#04050a 100%);}
```
(其餘樣式於 Task 14 補完。)

- [ ] **Step 2: 建立 `src/index.html` 模板**

含佔位標記:
```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>紫微斗數 ‧ 命盤</title>
<style>/* INCLUDE:styles.css */</style>
</head>
<body>
<div id="app"></div>
<script>
/* INCLUDE:almanac.js */
/* INCLUDE:bazi.js */
/* INCLUDE:chenggu.js */
/* INCLUDE:ziwei.js */
/* INCLUDE:gemini.js */
/* INCLUDE:ui.js */
</script>
</body>
</html>
```

- [ ] **Step 3: 建立 `build.mjs`**

```js
import { readFileSync, writeFileSync } from 'node:fs';

const tpl = readFileSync('src/index.html', 'utf8');
const strip = (js) => js
  .replace(/^\s*export\s*\{[^}]*\};?\s*$/gm, '')
  .replace(/^\s*export\s+/gm, '')
  .replace(/^\s*import\s.+;?\s*$/gm, '');

const out = tpl.replace(/\/\*\s*INCLUDE:([\w.]+)\s*\*\//g, (_, file) => {
  const path = file.endsWith('.css') ? `src/${file}` : `src/${file}`;
  const content = readFileSync(path, 'utf8');
  return file.endsWith('.css') ? content : strip(content);
});

writeFileSync('ziwei-destiny.html', out);
console.log('built ziwei-destiny.html', out.length, 'bytes');
```

- [ ] **Step 4: 執行 build 驗證產出**

Run: `npm run build`
Expected: `built ziwei-destiny.html ... bytes`,且 `ziwei-destiny.html` 內無殘留 `export`/`import` 行。

- [ ] **Step 5: Commit**

```bash
git add src/index.html src/styles.css build.mjs
git commit -m "build: HTML 模板與單檔組裝腳本"
```

---

## Task 11: 畫面 — 第一幕入命表單

**Files:**
- Create: `src/ui.js`

- [ ] **Step 1: 實作表單渲染**

`src/ui.js` 加入 `renderForm()`:在 `#app` 內注入第一幕:
- 標題「紫微斗數」「命 ‧ 八字 ‧ 流年」。
- 欄位:姓名/稱謂(text)、性別(男/女 radio)、曆別(國曆/農曆 切換)、生日(年/月/日;農曆時加閏月勾選)、時辰(子–亥下拉,附時間對照)。
- 金鑰區:`getApiKey()` 無值時顯示金鑰輸入欄 + 「記住金鑰」勾選(預設不勾)。
- 「起盤」按鈕,綁定 `onSubmit`。
- 表單驗證:必填檢查、年份 1900–2100、農曆日合法性(呼叫 `lunarToSolar` 偵測);錯誤於欄位旁紅字顯示。

`init()`:`document.addEventListener('DOMContentLoaded', renderForm)`。

- [ ] **Step 2: build 並手動驗證**

Run: `npm run build`,瀏覽器開 `ziwei-destiny.html`。
Expected: 顯示星空背景與輸入表單;送出空表單會出現紅字提示;1850 年會被擋下。

- [ ] **Step 3: Commit**

```bash
git add src/ui.js
git commit -m "feat: 畫面 — 第一幕入命表單與驗證"
```

---

## Task 12: 畫面 — 第二幕命盤渲染

**Files:**
- Modify: `src/ui.js`

- [ ] **Step 1: 實作排盤與十二宮渲染**

`onSubmit` 流程:
1. 讀表單;若為農曆先 `lunarToSolar` 轉國曆。
2. 呼叫 `getBaZi`、`getChengGu`、`getZiWeiChart` 得本地盤面(瞬間)。
3. 呼叫 `renderChart(data)`:淡入第二幕,畫 4×4 十二宮格(地支固定位置,沿用 mockup 版面),中宮顯示命主姓名、國曆/農曆生辰、五行局、身主。各宮顯示宮名、地支、主星。
4. 呼叫 `renderPanels(data)`(Task 13)。

- [ ] **Step 2: build 並手動驗證**

Run: `npm run build`,填 1990-06-15 巳時送出。
Expected: 十二宮格正確淡入,主星分布與權威工具一致,中宮資料正確。

- [ ] **Step 3: Commit**

```bash
git add src/ui.js
git commit -m "feat: 畫面 — 第二幕十二宮命盤渲染"
```

---

## Task 13: 畫面 — 分段解讀面板與流程控制

**Files:**
- Modify: `src/ui.js`

- [ ] **Step 1: 實作四段串流面板**

`renderPanels(data)`:
- 建立四個面板:整體格局、十二宮逐宮、八字重量(面板頂端先以本地資料顯示「X兩Y錢」與歌訣原文,下方接 Gemini 論斷)、2026 流年。
- 依序對每段呼叫 `streamGenerate(section, facts, model, onChunk)`:
  - 把本地盤面整理成 `facts` 物件傳入。
  - 生成中該面板顯示星點 loading 動畫;`onChunk` 逐字附加文字。
  - 某段 reject(`KEY_INVALID`/`QUOTA`/`NETWORK`):該面板顯示對應訊息與「重新揭示」按鈕(重呼叫該段),其餘面板繼續。
  - `KEY_INVALID` 時額外喚回金鑰輸入欄。
- 第四段流年面板套用流光外框樣式(第三幕強調)。

- [ ] **Step 2: build 並手動驗證(需有效金鑰)**

Run: `npm run build`,輸入有效 Gemini 金鑰並起盤。
Expected: 四面板依序串流浮現;故意輸入錯金鑰 → 面板顯示「金鑰無效」並喚回金鑰欄;單段「重新揭示」可重生。

- [ ] **Step 3: Commit**

```bash
git add src/ui.js
git commit -m "feat: 畫面 — 四段 Gemini 串流解讀與容錯"
```

---

## Task 14: 收尾功能與星空墨韻完整樣式

**Files:**
- Modify: `src/ui.js`, `src/styles.css`

- [ ] **Step 1: 收尾功能**

`src/ui.js` 加入:
- 「另起一盤」按鈕 → 清空 `#app` 重新 `renderForm()`。
- 「列印 / 存 PDF」按鈕 → `window.print()`。
- 頁尾固定免責聲明:「本內容依傳統命理觀點生成,僅供娛樂與參考,不構成醫療、財務或人生決策建議。」

- [ ] **Step 2: 完整星空墨韻樣式**

`src/styles.css` 補完:
- 三幕淡入動畫、星塵微動背景。
- 十二宮格 hover 鎏金描邊微光;標題鎏金光暈。
- 面板標題分隔線、串流 loading 星點動畫、流年面板流光外框。
- RWD:窄螢幕(<640px)十二宮格可水平捲動或縮放。
- `@media print`:深色友善列印樣式(白底深字、隱藏按鈕與金鑰欄)。

- [ ] **Step 3: build 並手動驗證**

Run: `npm run build`。
Expected: 桌機/手機寬度皆正常;列印預覽為可讀版面;「另起一盤」可重置;頁尾有免責聲明。

- [ ] **Step 4: Commit**

```bash
git add src/ui.js src/styles.css
git commit -m "feat: 收尾功能與星空墨韻完整樣式"
```

---

## Task 15: 最終整合驗收

**Files:**
- 無新增

- [ ] **Step 1: 全量測試**

Run: `npm test`
Expected: 全數 PASS。

- [ ] **Step 2: 走查設計文件第 10 節驗收標準**

逐項用瀏覽器驗證 `ziwei-destiny.html`:雙擊即開、本地命盤瞬出且正確、四柱與稱骨正確、四段串流與單段重生、流年面板、星空墨韻與 RWD、列印/PDF、另起一盤、頁尾免責聲明。記錄任何缺漏並回頭修正。

- [ ] **Step 3: 確認單檔可獨立運作**

把 `ziwei-destiny.html` 複製到其他目錄雙擊開啟,確認不依賴 `src/`。

- [ ] **Step 4: Commit 並推送**

```bash
git add -A
git commit -m "chore: 最終整合與驗收"
git push
```

---

## Self-Review 註記

- **Spec 覆蓋**:萬年曆(T2–3)、八字(T4)、稱骨(T5)、紫微骨架(T6–7)、邊界測試(T8)、Gemini 四段與事實鎖定(T9、T13)、單檔交付(T10)、三幕畫面(T11–13)、收尾與星空墨韻(T14)、錯誤處理(T11 表單、T13 API)、驗收(T15)— 設計文件各節均有對應任務。
- **已知待辦**:T6/T7/T8 的測試期望值需在實作時以權威排盤工具核對後填入正確值(計畫中已明確標註,非佔位遺漏)。
- **型別一致**:`getZiWeiChart` 回傳的 `palaces[].stars` 為字串陣列,T7 測試與 T12 渲染一致使用;`streamGenerate(section, facts, model, onChunk)` 簽名於 T9 定義、T13 沿用。
