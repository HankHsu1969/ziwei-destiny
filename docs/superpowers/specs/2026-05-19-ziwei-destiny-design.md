# 紫微命盤 ‧ 八字 ‧ 流年 — 設計規格

- 日期:2026-05-19(2026-05-19 修訂:改採開源套件排盤)
- 專案代號:ziwei-destiny
- 交付物:單一檔案 `ziwei-destiny.html`

## 1. 目標

提供一個網頁應用,使用者輸入姓名、性別與出生時間後,得到:

1. 紫微斗數命盤(十二宮、主星、輔星、四化)
2. 八字四柱與八字重量(袁天罡稱骨)
3. 詳細解盤:整體格局與十二宮逐宮詳解
4. 2026 丙午年流年詳細論斷

畫面風格為「星空墨韻」— 深夜藍黑漸層 × 星金,水墨留白,沉靜神祕。

## 2. 範圍與非目標

**範圍內**

- 國曆 / 農曆雙向輸入
- 用開源套件精算:紫微命盤(iztro)、八字四柱與曆法(lunar-javascript)
- 八字重量(袁天罡稱骨)以自寫查表計算
- 2026 流年運限資料由 iztro 提供
- Gemini API 生成文字解讀,分四段
- 列印 / 存 PDF、另起一盤

**非目標**

- 不自寫萬年曆 / 紫微排盤演算法 — 改用成熟開源套件
- 不做真太陽時 / 出生地經度校正
- 不做後端伺服器、不做多人部署、不做帳號系統
- 不做流年以外年份的詳細論斷(僅 2026)

## 3. 核心架構決策

| 決策 | 結論 | 理由 |
|---|---|---|
| 排盤計算 | 用開源套件精算整盤 | iztro/lunar-javascript 為成熟、經測試的專業庫,比自寫演算法可靠 |
| 紫微命盤 | iztro(MIT) | 輸入生日/時辰/性別,輸出完整命盤十二宮、主星輔星四化、大限流年 |
| 曆法與八字 | lunar-javascript(MIT) | 國曆↔農曆換算、節氣、干支、八字四柱 |
| 八字重量 | 自寫 `chenggu.js` | 袁天罡稱骨表為簡單查表,套件無此功能 |
| 應用形式 | 單一 HTML 檔 | 套件 bundle 直接 inline,免安裝雙擊即開 |
| Gemini 金鑰 | 執行時輸入,「記住金鑰」勾選(預設不勾) | 金鑰只存使用者瀏覽器,只送 Google API |
| 內容生成 | 方案 A:分段漸進生成 | 命盤秒出、逐段揭曉有儀式感、容錯佳 |
| 視覺風格 | 星空墨韻 | 使用者自三方案中選定 |
| 流年範圍 | 僅 2026 丙午年詳細論斷 | iztro 提供 2026 流年運限資料 |
| 解盤組織 | 十二宮逐宮詳解 | 對應「越詳細越好」 |

**準確度**:命盤由 iztro 整盤精算,不再有「LLM 排盤幻覺」問題。Gemini 只接收已算好的正確盤面、純做文字解讀。

## 4. 套件相依

| 套件 | 版本 | 授權 | 用途 | 取得 |
|---|---|---|---|---|
| iztro | 2.5.8 | MIT | 紫微斗數命盤 + 流年運限 | `src/vendor/iztro.min.js`(UMD,瀏覽器全域 `iztro`) |
| lunar-javascript | 1.7.7 | MIT | 曆法換算 + 八字四柱 | `src/vendor/lunar.js`(UMD,瀏覽器全域 `Solar`/`Lunar` 等) |

兩套件已下載至 `src/vendor/` 並提交。`build.mjs` 會把它們 inline 進最終 HTML。瀏覽器端原生支援(iztro 需 `self` 全域,瀏覽器具備)。

**已驗證的 API 形狀**

- `iztro.astro.bySolar(dateStr, timeIndex, gender, fixLeap, lang)` → 命盤物件
  - `.fiveElementsClass`(五行局)、`.soul`(命主)、`.body`(身主)、`.palaces`(12 宮)
  - `palace.name` / `.earthlyBranch` / `.majorStars[]`(`{name, mutagen}`)/ `.minorStars[]` / `.adjectiveStars[]`
  - `.horoscope(dateStr)` → `.yearly`(`{name, heavenlyStem, earthlyBranch, mutagen[], stars}`)
  - `timeIndex`:0=早子、1=丑、2=寅 …… 11=亥、12=晚子
- `lunar.Solar.fromYmdHms(y,m,d,h,0,0).getLunar().getEightChar()` → 八字
  - `.getYear()` / `.getMonth()` / `.getDay()` / `.getTime()` 各回傳柱干支字串
- `lunar.Solar.fromYmd` / `lunar.Lunar.fromYmd` 供國曆↔農曆換算

## 5. 檔案與模組

單一交付檔 `ziwei-destiny.html`,由 `build.mjs` 組裝。原始檔:

| 檔案 | 職責 | 測試 |
|---|---|---|
| `src/vendor/iztro.min.js` | iztro 套件(原樣) | 套件自帶測試,信任 |
| `src/vendor/lunar.js` | lunar-javascript 套件(原樣) | 套件自帶測試,信任 |
| `src/chart.js` | 排盤封裝:輸入 → 呼叫 iztro/lunar → 統一盤面資料物件 | 瀏覽器手動驗證 |
| `src/chenggu.js` | 袁天罡稱骨:四柱權重加總、總重與歌訣 | `node --test`(TDD) |
| `src/gemini.js` | Gemini API 封裝:金鑰管理、分段 prompt、串流 | `buildPrompt` 以 `node --test` |
| `src/ui.js` | 畫面渲染與流程控制 | 瀏覽器手動驗證 |
| `src/styles.css` | 星空墨韻樣式(含列印、RWD) | — |
| `src/index.html` | HTML 模板,含 `INCLUDE` 佔位標記 | — |
| `build.mjs` | inline 組裝出 `ziwei-destiny.html` | 執行驗證 |

## 6. 排盤封裝(`chart.js`)

`buildChart(input)` 接收表單資料 `{ name, gender, calendar, year, month, day, isLeapMonth, hourIndex }`,流程:

1. 若為農曆輸入,先用 `lunar.Lunar.fromYmd` 轉國曆。
2. `timeIndex` = `hourIndex`(0–11,子–亥);時辰代表小時(子=0、丑=2 …… 巳=10 …… 亥=22)供八字用。
3. 呼叫 `iztro.astro.bySolar(國曆字串, timeIndex, gender, true, 'zh-TW')` 得命盤。
4. 呼叫 `astro.horoscope('2026-7-1')`(2026 年內任一日)取 2026 流年。
5. 呼叫 `lunar.Solar.fromYmdHms(...)` 取八字四柱。
6. 回傳統一物件:`{ name, gender, solarDate, lunarDate, fiveElementsClass, soul, body, palaces:[{name,branch,majorStars,minorStars,adjStars}], bazi:{year,month,day,hour}, liunian:{stem,branch,mutagen,...} }`。

`chart.js` 是瀏覽器模組,依賴 `window.iztro` / `window.Solar` 全域(由 vendor script 提供)。

## 7. 稱骨模組(`chenggu.js`)

- 年(依干支 60 組)、月(1–12)、日(1–30)、時辰(子–亥)各對應袁天罡稱骨表固定「錢」數。
- 四者相加得總重(例:三兩六錢),對應 52 句稱骨歌訣其中一條。
- `getChengGu(yearGanZhi, lunarMonth, lunarDay, hourZhi)` 回傳 `{ totalQian, weightText, verse, 各柱錢數 }`。
- 為可測試的純函式,以 `node --test` 驗證結構與加總一致性。

## 8. Gemini 整合

### 8.1 模型與呼叫

- 端點:`streamGenerateContent`(串流,文字逐字浮現)。
- 預設模型 `gemini-2.5-flash`;設定欄可切換 `gemini-2.5-pro`。
- 金鑰:啟動時輸入欄;「記住金鑰」勾選決定是否存 `localStorage`(預設不勾)。

### 8.2 四段獨立呼叫(依序)

1. 整體格局與命主性情
2. 十二宮逐宮詳解(最長,逐宮成段,確保每宮詳盡)
3. 八字重量論斷(稱骨歌訣白話化 + 結合四柱論一生格局)
4. 2026 丙午年流年(流年四化、事業/財運/感情/健康、月份走勢)

### 8.3 事實鎖定

每段 prompt 含「事實鎖定」區,把 iztro/lunar 算好的命盤、八字、稱骨結果以不可更動的事實帶入,指示 Gemini 只做解讀、不得改動盤面。

### 8.4 用詞分寸

- 以「傳統命理觀點」「僅供參考」口吻呈現。
- 健康、壽元等敏感面向採正向、建設性措辭。
- 頁尾固定免責聲明:命理內容僅供娛樂與參考,不構成醫療、財務或人生決策建議。

## 9. 畫面與流程(星空墨韻)

單頁三幕,垂直捲動,每幕淡入 + 星塵微動。

- **第一幕 ‧ 入命**:星空背景、置中標題「紫微斗數」、輸入卡(姓名/稱謂、性別、國曆/農曆切換生日、時辰下拉、鎏金「起盤」按鈕);無金鑰時先顯示金鑰欄(含「記住金鑰」勾選)。
- **第二幕 ‧ 命盤**:按「起盤」後 `chart.js` 瞬間排盤,十二宮 4×4 格線淡入(中宮顯示命主姓名、生辰、五行局、命主/身主),各宮顯示宮名、地支、主星與輔星、四化標記。下方依序浮現四個解讀面板,文字串流顯示,生成中顯示星點 loading,失敗顯示「重新揭示」按鈕。
- **第三幕 ‧ 流年**:2026 丙午年面板,外框流光強調,含事業/財運/感情/健康分項與月份走勢。
- **收尾**:頁尾免責聲明;「另起一盤」重置;「列印 / 存 PDF」(瀏覽器列印,套深色友善列印樣式)。

風格:深夜藍黑漸層底、星金主色、思源宋體、宮格 hover 鎏金描邊微光、標題鎏金光暈。RWD 支援手機(窄螢幕十二宮格可捲動 / 縮放)。

## 10. 錯誤處理

| 情況 | 處理 |
|---|---|
| 表單未填完 / 日期超出套件支援範圍 | 起盤前擋下,欄位旁紅字提示 |
| 農曆日期不存在 | 換算時偵測(套件丟錯),提示重選 |
| 無金鑰 / 金鑰錯誤(401) | 顯示金鑰欄,訊息「金鑰無效,請重新輸入」 |
| 額度超限(429)/ 網路失敗 | 該面板顯示「重新揭示」,其餘保留 |
| 回應截斷 / 空白 | 視為該段失敗,可重生 |
| 排盤例外 | 全域捕捉,顯示友善錯誤,不出現白畫面 |

## 11. 測試

- **`chenggu.js`**:純函式,以 `node --test` 驗證錢數加總、歌訣對應、輸出結構。
- **`gemini.js` 的 `buildPrompt`**:以 `node --test` 驗證事實鎖定區與四段落 prompt。
- **`chart.js`**:封裝呼叫成熟套件,以瀏覽器手動驗證(挑數筆已知生辰,核對 iztro 官方 demo 排盤一致)。
- **套件本身**:iztro / lunar-javascript 自帶測試,信任其正確性。
- **UI**:手動在瀏覽器走黃金路徑與邊界(缺金鑰、超範圍日期、農曆閏月、某段 API 失敗重生)。

## 12. 驗收標準

1. 雙擊 `ziwei-destiny.html` 即可在瀏覽器使用,無需安裝、無需網路(除呼叫 Gemini)。
2. 輸入合法出生資料後,十二宮命盤於本地瞬間產出,與 iztro 官方 demo 排盤一致。
3. 八字四柱與稱骨重量正確顯示。
4. 四段 Gemini 解讀依序串流顯示;任一段失敗可單獨重生。
5. 2026 流年面板正確顯示分項論斷。
6. 畫面呈現星空墨韻風格,支援手機;可列印 / 存 PDF;可另起一盤。
7. 頁尾顯示免責聲明。
