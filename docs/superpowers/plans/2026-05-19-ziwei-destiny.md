# 紫微命盤 ‧ 八字 ‧ 流年 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立單一 HTML 檔網頁應用,輸入出生資料後用 iztro 套件精算紫微命盤與 2026 流年、用 lunar-javascript 算八字四柱、自寫稱骨計算八字重量,再用 Gemini API 分段生成詳細解盤,呈現「星空墨韻」風格。

**Architecture:** 排盤交給成熟開源套件(iztro、lunar-javascript,已 vendored 於 `src/vendor/`)。自寫程式只剩:`chart.js`(封裝套件呼叫)、`chenggu.js`(稱骨查表)、`gemini.js`(API)、`ui.js`(畫面)。`build.mjs` 把 vendor 套件、CSS、各模組 inline 成單一 `ziwei-destiny.html`。

**Tech Stack:** 純 JavaScript、Node.js v24(內建 test runner)、HTML/CSS、iztro 2.5.8、lunar-javascript 1.7.7、Gemini `streamGenerateContent` API。

---

## 已完成(不需再做)

- **T1 專案骨架**:`package.json`(`type:module`、`npm test`)、`test/smoke.test.mjs`。commit `eb380e5`。
- **T2 套件 vendoring**:`src/vendor/iztro.min.js`、`src/vendor/lunar.js` 已下載並驗證 API。commit `ee2a276`。

## 常數約定(全專案一致)

- 天干:`['甲','乙','丙','丁','戊','己','庚','辛','壬','癸']`
- 地支:`['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']`
- 時辰下拉 index:0=子 … 11=亥,對應 iztro `timeIndex` 直接相同(0–11)
- 時辰代表小時(供八字):子=0、丑=2、寅=4、卯=6、辰=8、巳=10、午=12、未=14、申=16、酉=18、戌=20、亥=22
- 十二宮渲染順序(4×4 外圈,地支固定):見 T8
- `src/*.js`(非 vendor)為 ES module,用 `export` 匯出
- vendor 套件在瀏覽器以全域提供:`window.iztro`、`window.Solar` / `window.Lunar` 等

## File Structure

| 檔案 | 由哪個 Task 建立 |
|---|---|
| `src/chenggu.js` | T3 |
| `src/chart.js` | T4 |
| `src/gemini.js` | T5 |
| `src/styles.css`、`src/index.html`、`build.mjs` | T6 |
| `src/ui.js` | T7–T10 逐步建立 |
| `ziwei-destiny.html` | build.mjs 產出 |

---

## Task 3: 稱骨模組

**Files:** Create `src/chenggu.js`、Create `test/chenggu.test.mjs`

採 TDD:先寫測試 → 跑確認失敗 → 實作 → 跑確認通過 → commit。

- [ ] **Step 1: 寫失敗測試 `test/chenggu.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getChengGu, formatWeight } from '../src/chenggu.js';

test('formatWeight 把錢數轉中文', () => {
  assert.equal(formatWeight(36), '三兩六錢');
  assert.equal(formatWeight(50), '五兩');
  assert.equal(formatWeight(21), '二兩一錢');
});

test('getChengGu 回傳結構完整', () => {
  const r = getChengGu('庚午', 5, 23, '巳');
  assert.equal(typeof r.totalQian, 'number');
  assert.ok(r.weightText.includes('兩'));
  assert.ok(r.verse.length > 0);
});

test('總重 = 年月日時四項相加', () => {
  const r = getChengGu('庚午', 5, 23, '巳');
  assert.equal(r.totalQian, r.yearQian + r.monthQian + r.dayQian + r.hourQian);
});

test('未知干支丟出錯誤', () => {
  assert.throws(() => getChengGu('XX', 5, 23, '巳'));
});
```

- [ ] **Step 2: 執行確認失敗**

Run: `node --test test/chenggu.test.mjs`
Expected: FAIL — `Cannot find module '../src/chenggu.js'`

- [ ] **Step 3: 實作 `src/chenggu.js`**

- `YEAR_QIAN`:60 干支 → 錢數(物件,key 為干支字串,採通行袁天罡稱骨年柱表)。
- `MONTH_QIAN`:長度 13 陣列(索引 1–12 有效)。
- `DAY_QIAN`:長度 31 陣列(索引 1–30 有效)。
- `HOUR_QIAN`:12 地支 → 錢數(物件)。
- `VERSES`:總錢數 → 歌訣字串(由二兩一錢至七兩一錢,採通行稱骨歌)。
- `formatWeight(qian)`:錢數 → 「X兩Y錢」(整除時省略「Y錢」,如 `50`→`五兩`)。中文數字用 `['零','一','二',…,'十']` 對照。
- `getChengGu(yearGanZhi, lunarMonth, lunarDay, hourZhi)`:四表查值相加;任一查無對應丟 `Error`;回傳 `{ yearQian, monthQian, dayQian, hourQian, totalQian, weightText, verse }`。
- `export { getChengGu, formatWeight };`

- [ ] **Step 4: 執行確認通過**

Run: `node --test test/chenggu.test.mjs`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/chenggu.js test/chenggu.test.mjs
git commit -m "feat: 稱骨模組 — 八字重量與歌訣"
```

---

## Task 4: 排盤封裝模組

**Files:** Create `src/chart.js`

**背景**:`chart.js` 在瀏覽器執行,依賴 vendor 套件提供的全域 `iztro`、`Solar`。它把表單輸入轉成統一盤面資料。**此模組不寫 Node 單元測試**(依賴瀏覽器全域),於 T9 build 後在瀏覽器手動驗證。

已驗證的套件 API:
- `iztro.astro.bySolar('1990-6-15', 5, '男', true, 'zh-TW')` → astro
  - `astro.fiveElementsClass`(如 `'火六局'`)、`astro.soul`、`astro.body`、`astro.palaces`(12)
  - `palace.name`、`palace.earthlyBranch`、`palace.majorStars`/`minorStars`/`adjectiveStars`(各為 `[{name, mutagen?}]`)
  - `astro.horoscope('2026-7-1')` → `.yearly`(`{name, heavenlyStem, earthlyBranch, mutagen, ...}`)
- `Solar.fromYmdHms(y,m,d,h,0,0).getLunar()` → lunar;`lunar.getEightChar()` → `{getYear(),getMonth(),getDay(),getTime()}` 各回干支字串;`lunar.getMonth()`(農曆月,負數為閏)、`lunar.getDay()`、`lunar.getYearInGanZhi()`。
- `Lunar.fromYmd(y,m,d).getSolar()` → 農曆轉國曆。

- [ ] **Step 1: 實作 `src/chart.js`**

`buildChart(input)`,`input = { name, gender, calendar:'solar'|'lunar', year, month, day, isLeapMonth, hourIndex }`(`gender` 為 `'男'|'女'`,`hourIndex` 0–11):

1. 取得國曆 `y,m,d`:`calendar==='lunar'` 時用 `Lunar.fromYmd(year, isLeapMonth?-month:month, day).getSolar()`,否則直接用輸入。
2. `HOUR_HH = [0,2,4,6,8,10,12,14,16,18,20,22]`;`hh = HOUR_HH[hourIndex]`。
3. `astro = iztro.astro.bySolar(\`${y}-${m}-${d}\`, hourIndex, gender, true, 'zh-TW')`。
4. `horo = astro.horoscope('2026-7-1')`。
5. `ec = Solar.fromYmdHms(y,m,d,hh,0,0).getLunar().getEightChar()`。
6. 整理回傳:
```js
return {
  name, gender,
  solarDate: `${y}-${m}-${d}`,
  lunarDate: astro.lunarDate,           // iztro 提供的農曆字串
  fiveElementsClass: astro.fiveElementsClass,
  soul: astro.soul, body: astro.body,
  palaces: astro.palaces.map(p => ({
    name: p.name,
    branch: p.earthlyBranch,
    majorStars: p.majorStars.map(s => ({ name: s.name, mutagen: s.mutagen || '' })),
    minorStars: p.minorStars.map(s => ({ name: s.name, mutagen: s.mutagen || '' })),
    adjStars:   p.adjectiveStars.map(s => s.name),
  })),
  bazi: { year: ec.getYear(), month: ec.getMonth(), day: ec.getDay(), hour: ec.getTime() },
  liunian: {
    stem: horo.yearly.heavenlyStem, branch: horo.yearly.earthlyBranch,
    palaceName: horo.yearly.name,
    mutagen: horo.yearly.mutagen,
  },
};
```
若 `buildChart` 過程套件丟錯(如農曆日期不存在),讓錯誤往外拋,由 `ui.js` 捕捉。
- `export { buildChart };`

- [ ] **Step 2: 語法檢查**

Run: `node --check src/chart.js`
Expected: 無輸出(語法正確)。

- [ ] **Step 3: Commit**

```bash
git add src/chart.js
git commit -m "feat: 排盤封裝 — iztro 命盤與 lunar 八字整合"
```

---

## Task 5: Gemini 模組

**Files:** Create `src/gemini.js`、Create `test/gemini.test.mjs`

- [ ] **Step 1: 寫失敗測試 `test/gemini.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt } from '../src/gemini.js';

const facts = {
  name: '某甲', gender: '男',
  bazi: '庚午 壬午 辛亥 戊子',
  chengGu: '三兩六錢',
  fiveElementsClass: '火六局',
  palacesText: '命宮(丑)主星:太陽祿、太陰科;財帛宮(酉)主星:武曲',
  liunianText: '2026 丙午年,流年命宮在午',
};

test('prompt 含事實鎖定區與盤面資料', () => {
  const p = buildPrompt('overall', facts);
  assert.ok(p.includes('不可更動'));
  assert.ok(p.includes('庚午 壬午 辛亥 戊子'));
  assert.ok(p.includes('太陽祿'));
});

test('四種段落各有對應 prompt', () => {
  for (const s of ['overall', 'palaces', 'chenggu', 'liunian']) {
    assert.ok(buildPrompt(s, facts).length > 80);
  }
});

test('liunian prompt 提及 2026', () => {
  assert.ok(buildPrompt('liunian', facts).includes('2026'));
});

test('未知段落丟出錯誤', () => {
  assert.throws(() => buildPrompt('unknown', facts));
});
```

- [ ] **Step 2: 執行確認失敗**

Run: `node --test test/gemini.test.mjs`
Expected: FAIL — `Cannot find module '../src/gemini.js'`

- [ ] **Step 3: 實作 `src/gemini.js`**

- `buildPrompt(section, facts)`:
  - 共用「事實鎖定」前言:「以下為系統用專業排盤套件精算的命盤事實,為不可更動的事實。你只能依此解讀,不得改動、新增或重排任何星曜或干支。」後接 `facts` 的八字、五行局、十二宮、流年文字。
  - 四段 `section`:
    - `overall` — 「以傳統紫微斗數觀點,論此命整體格局高低、主星組合與命主性情輪廓。」
    - `palaces` — 「逐一解讀命、兄弟、夫妻、子女、財帛、疾厄、遷移、僕役、官祿、田宅、福德、父母十二宮,每宮自成一段,詳盡說明。」
    - `chenggu` — 「將八字重量(稱骨)歌訣以白話闡釋,並結合四柱論一生格局。」
    - `liunian` — 「論 2026 丙午年流年運勢,含流年四化、事業/財運/感情/健康分項與月份走勢提點。」
  - 所有段落結尾附:「以傳統命理觀點、僅供參考的口吻書寫;健康、壽元等敏感面向採正向、建設性措辭。」
  - `section` 不在四者內丟 `Error`。
- `getApiKey()` / `setApiKey(key, remember)` / `clearApiKey()`:`remember` 為真存 `localStorage`(key 名 `gemini_api_key`),否則存模組內記憶體變數。`typeof localStorage === 'undefined'` 時(Node)一律降級記憶體變數。
- `streamGenerate(section, facts, model, onChunk)`:async。`POST` 至 `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${getApiKey()}`,body `{ contents:[{ parts:[{ text: buildPrompt(section,facts) }] }] }`。逐行讀 SSE,解析 `data:` JSON 取 `candidates[0].content.parts[0].text`,每塊呼叫 `onChunk(text)`。HTTP 401/403 throw `'KEY_INVALID'`、429 throw `'QUOTA'`、其他非 2xx 或網路錯誤 throw `'NETWORK'`。
- `export { buildPrompt, getApiKey, setApiKey, clearApiKey, streamGenerate };`

- [ ] **Step 4: 執行確認通過**

Run: `node --test test/gemini.test.mjs`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/gemini.js test/gemini.test.mjs
git commit -m "feat: Gemini 模組 — 金鑰管理與分段串流"
```

---

## Task 6: HTML 模板、樣式基礎與 build.mjs

**Files:** Create `src/styles.css`、Create `src/index.html`、Create `build.mjs`

- [ ] **Step 1: 建立 `src/styles.css`(星空墨韻基礎)**

```css
:root{
  --bg-deep:#070a14; --bg-mid:#16223f; --gold:#d4af5a; --gold-light:#f4e4b8;
  --ink:#7f8db5; --text:#cdd6e8; --line:#24304f;
}
*{box-sizing:border-box;}
body{margin:0;font-family:"Noto Serif TC","Songti TC",serif;color:var(--text);
  background:radial-gradient(ellipse at 50% 0%,#10182e 0%,#070a14 60%,#04050a 100%);
  min-height:100vh;}
button{font-family:inherit;cursor:pointer;}
```
(完整樣式於 T10 補完。)

- [ ] **Step 2: 建立 `src/index.html` 模板**

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
<script>/* INCLUDE:vendor/lunar.js */</script>
<script>/* INCLUDE:vendor/iztro.min.js */</script>
<script type="module">
/* INCLUDE:chenggu.js */
/* INCLUDE:chart.js */
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
  .replace(/^\s*import\s.+?;\s*$/gm, '');

const out = tpl.replace(/\/\*\s*INCLUDE:([\w./]+)\s*\*\//g, (_, file) => {
  const content = readFileSync(`src/${file}`, 'utf8');
  // vendor 與 css 原樣 inline;自寫 ES module 去除 import/export
  return (file.startsWith('vendor/') || file.endsWith('.css')) ? content : strip(content);
});

writeFileSync('ziwei-destiny.html', out);
console.log('built ziwei-destiny.html', out.length, 'bytes');
```

> 註:`chenggu.js` 被 `chart.js`?否 — `chart.js` 不依賴 `chenggu.js`;`ui.js` 依賴 `chenggu`/`chart`/`gemini`。strip 移除 import/export 後,瀏覽器 `<script type="module">` 內各函式成為同一模組作用域共用,順序依模板(chenggu→chart→gemini→ui)。

- [ ] **Step 4: 執行 build 驗證**

Run: `npm run build`
Expected: 印出 `built ziwei-destiny.html ... bytes`;開啟 `ziwei-destiny.html` 應為深色空白頁、無 console 錯誤。

- [ ] **Step 5: Commit**

```bash
git add src/styles.css src/index.html build.mjs
git commit -m "build: HTML 模板、星空墨韻基礎樣式與單檔組裝腳本"
```

---

## Task 7: 畫面 — 第一幕入命表單

**Files:** Create `src/ui.js`

- [ ] **Step 1: 實作 `src/ui.js` 表單部分**

- `renderForm()`:在 `#app` 注入第一幕:
  - 標題「紫微斗數」、副標「命 ‧ 八字 ‧ 流年」。
  - 欄位:姓名/稱謂(text)、性別(男/女 radio)、曆別(國曆/農曆 切換 radio)、生日(年 input 1900–2100、月、日;曆別為農曆時顯示「閏月」checkbox)、時辰(下拉,12 項「子時 23–01」…「亥時 21–23」)。
  - 金鑰區:`getApiKey()` 無值時顯示金鑰 input + 「記住金鑰」checkbox(預設不勾)+ 模型下拉(`gemini-2.5-flash` / `gemini-2.5-pro`)。
  - 「起盤」按鈕,綁 `onSubmit`。
- `validate(input)`:必填檢查、年份範圍、農曆日合法(用 try/catch 包 `Lunar.fromYmd`);回傳錯誤訊息陣列。
- `onSubmit()`:讀表單→`validate`→有錯則欄位旁紅字顯示並中止;若顯示了金鑰欄,先 `setApiKey(輸入值, 記住勾選)`。通過則呼叫 `renderChart(buildChart(input))`(`renderChart` 於 T8 實作,本任務先留空函式 `function renderChart(){}`)。
- 檔尾:`document.addEventListener('DOMContentLoaded', renderForm);`
- `ui.js` 為 ES module,頂部 `import { buildChart } from './chart.js';` `import { getChengGu } from './chenggu.js';` `import { getApiKey, setApiKey, streamGenerate } from './gemini.js';`(build 時 strip 掉)。

- [ ] **Step 2: build 並手動驗證**

Run: `npm run build`,瀏覽器開 `ziwei-destiny.html`。
Expected: 顯示星空背景與輸入表單;送出空表單出現紅字提示;年份 1850 被擋下;曆別切到農曆出現閏月勾選。

- [ ] **Step 3: Commit**

```bash
git add src/ui.js
git commit -m "feat: 畫面 — 第一幕入命表單與驗證"
```

---

## Task 8: 畫面 — 第二幕命盤渲染

**Files:** Modify `src/ui.js`

**十二宮 4×4 版面**(地支固定,grid-area `列/欄`):
巳(1/1)午(1/2)未(1/3)申(1/4);辰(2/1)、酉(2/4);卯(3/1)、戌(3/4);寅(4/1)丑(4/2)子(4/3)亥(4/4);中宮 = `grid-area:2/2/4/4`。

- [ ] **Step 1: 實作 `renderChart(data)`**

- 淡入第二幕,清掉表單。
- 畫 4×4 grid:每個 `data.palaces` 依其 `branch` 放入對應 grid-area 格;每格顯示宮名、地支、`majorStars`(含 `mutagen` 標記如「祿/權/科/忌」)、`minorStars`、`adjStars`。
- 中宮顯示:`data.name`、性別、`data.solarDate`、`data.lunarDate`、`data.fiveElementsClass`、命主 `data.soul` / 身主 `data.body`、八字四柱 `data.bazi`。
- 命盤下方預留四個面板容器(`#panel-overall`、`#panel-palaces`、`#panel-chenggu`、`#panel-liunian`),內容由 T9 填。
- 呼叫 `renderPanels(data)`(T9 實作,本任務先留空函式)。

- [ ] **Step 2: build 並手動驗證**

Run: `npm run build`,填 1990-06-15、巳時、男 起盤。
Expected: 十二宮格正確淡入,各宮主星與 iztro 官方 demo(ziwei.pub)排同一生辰一致,中宮資料正確。

- [ ] **Step 3: Commit**

```bash
git add src/ui.js
git commit -m "feat: 畫面 — 第二幕十二宮命盤渲染"
```

---

## Task 9: 畫面 — 分段解讀面板與流程控制

**Files:** Modify `src/ui.js`

- [ ] **Step 1: 實作 `renderPanels(data)`**

- 用 `data` 組 `facts` 物件(供 `gemini.buildPrompt`):`bazi` 字串、`fiveElementsClass`、`palacesText`(十二宮主星彙整成文字)、`liunianText`、`name`、`gender`;另以 `getChengGu(data.bazi.year, 農曆月, 農曆日, 時辰地支)` 算稱骨,`chengGu` 放入 `facts`。
  - 農曆月/日:由 `Lunar` 取得(`Solar.fromYmd(...).getLunar().getMonth()/getDay()`),時辰地支由 `data.bazi.hour` 末字。
- 八字重量面板頂端先用本地稱骨結果顯示「X兩Y錢」與歌訣原文。
- 依序對四段呼叫 `streamGenerate(section, facts, model, onChunk)`(`overall`→`palaces`→`chenggu`→`liunian`):
  - 生成中該面板顯示星點 loading 動畫;`onChunk` 把文字逐步 append 到面板。
  - 某段 throw:
    - `'KEY_INVALID'` → 面板顯示「金鑰無效」+「重新揭示」按鈕,並重新顯示金鑰輸入欄。
    - `'QUOTA'` → 面板顯示「Gemini 額度已用盡,請稍後再試」+「重新揭示」。
    - `'NETWORK'` → 面板顯示「連線失敗」+「重新揭示」。
  - 「重新揭示」按鈕重呼該段;其餘面板不受影響。
- `model` 取自表單的模型下拉(存於 module 變數)。

- [ ] **Step 2: build 並手動驗證(需有效 Gemini 金鑰)**

Run: `npm run build`,輸入有效金鑰起盤。
Expected: 四面板依序串流浮現;故意輸入錯金鑰 → 面板顯示「金鑰無效」並喚回金鑰欄;單段「重新揭示」可重生。

- [ ] **Step 3: Commit**

```bash
git add src/ui.js
git commit -m "feat: 畫面 — 四段 Gemini 串流解讀與容錯"
```

---

## Task 10: 收尾功能與星空墨韻完整樣式

**Files:** Modify `src/ui.js`、Modify `src/styles.css`

- [ ] **Step 1: `ui.js` 收尾功能**

- 「另起一盤」按鈕 → 清空 `#app` 重新 `renderForm()`。
- 「列印 / 存 PDF」按鈕 → `window.print()`。
- 頁尾固定免責聲明:「本內容依傳統命理觀點生成,僅供娛樂與參考,不構成醫療、財務或人生決策建議。」
- 第四段流年面板套用流光外框 class。
- 全域錯誤:`renderChart` 流程用 try/catch 包住,排盤例外時 `#app` 顯示友善錯誤訊息與「重新輸入」按鈕。

- [ ] **Step 2: `styles.css` 完整星空墨韻**

- 三幕淡入動畫(`@keyframes fadeIn`)、星塵微動背景。
- 十二宮 4×4 grid 版面(grid-template-areas 或 grid-area 定位)、宮格 hover 鎏金描邊微光。
- 標題鎏金光暈、面板標題分隔線、串流 loading 星點動畫、流年面板流光外框。
- RWD:`@media (max-width:640px)` 十二宮格可水平捲動或縮放,表單單欄。
- `@media print`:白底深字、隱藏按鈕與金鑰欄、命盤與解讀完整可讀。

- [ ] **Step 3: build 並手動驗證**

Run: `npm run build`。
Expected: 桌機/手機寬度皆正常;列印預覽為可讀版面;「另起一盤」可重置;頁尾有免責聲明;故意傳壞日期時顯示友善錯誤。

- [ ] **Step 4: Commit**

```bash
git add src/ui.js src/styles.css
git commit -m "feat: 收尾功能與星空墨韻完整樣式"
```

---

## Task 11: 最終整合驗收

**Files:** 無新增

- [ ] **Step 1: 全量測試**

Run: `npm test`
Expected: 全數 PASS（smoke、chenggu、gemini）。

- [ ] **Step 2: 走查設計文件第 12 節驗收標準**

瀏覽器逐項驗證 `ziwei-destiny.html`:雙擊即開、命盤瞬出且與 iztro 官方 demo 一致、八字與稱骨正確、四段串流與單段重生、流年面板、星空墨韻與 RWD、列印/PDF、另起一盤、頁尾免責聲明。記錄缺漏並修正。

- [ ] **Step 3: 確認單檔可獨立運作**

把 `ziwei-destiny.html` 複製到其他目錄雙擊開啟,確認不依賴 `src/`。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: 最終整合與驗收"
```

---

## Self-Review 註記

- **Spec 覆蓋**:稱骨(T3)、排盤封裝 iztro+lunar(T4)、Gemini 四段與事實鎖定(T5、T9)、單檔組裝(T6)、三幕畫面(T7–T9)、收尾與星空墨韻+錯誤處理(T10)、測試與驗收(T11)。萬年曆/紫微演算法已改為套件,無需自寫任務。
- **型別一致**:`buildChart` 回傳物件的 `palaces[].majorStars` 為 `[{name,mutagen}]`,T8 渲染與 T9 組 facts 一致使用;`streamGenerate(section, facts, model, onChunk)` 簽名於 T5 定義、T9 沿用;`getChengGu` 簽名於 T3 定義、T9 沿用。
- **測試策略**:`chenggu.js`、`gemini.buildPrompt` 有 Node 單元測試;`chart.js`、`ui.js` 依賴瀏覽器全域,以 build 後瀏覽器手動驗證 — 已在各 Task 的 Step 寫明。
