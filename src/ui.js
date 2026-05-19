import { buildChart } from './chart.js';
import { getChengGu, formatWeight } from './chenggu.js';
import { getApiKey, setApiKey, streamGenerate, buildPrompt } from './gemini.js';

// ── module 層級狀態 ─────────────────────────────────────────
let selectedModel = 'gemini-2.5-flash';

// ── 時辰資料 ───────────────────────────────────────────────
const HOURS = [
  { label: '子時 (23:00–01:00)', value: 0 },
  { label: '丑時 (01:00–03:00)', value: 1 },
  { label: '寅時 (03:00–05:00)', value: 2 },
  { label: '卯時 (05:00–07:00)', value: 3 },
  { label: '辰時 (07:00–09:00)', value: 4 },
  { label: '巳時 (09:00–11:00)', value: 5 },
  { label: '午時 (11:00–13:00)', value: 6 },
  { label: '未時 (13:00–15:00)', value: 7 },
  { label: '申時 (15:00–17:00)', value: 8 },
  { label: '酉時 (17:00–19:00)', value: 9 },
  { label: '戌時 (19:00–21:00)', value: 10 },
  { label: '亥時 (21:00–23:00)', value: 11 },
];

// ── 渲染表單 ───────────────────────────────────────────────
function renderForm() {
  const app = document.getElementById('app');
  const hasKey = !!getApiKey();

  app.innerHTML = `
    <div class="act1-wrap">
      <header class="act1-header">
        <h1 class="title-main">紫微斗數</h1>
        <p class="title-sub">命 ‧ 八字 ‧ 流年</p>
      </header>

      <div class="form-card">
        <div id="form-errors" class="form-errors" style="display:none;"></div>

        <div class="form-row">
          <label class="form-label" for="inp-name">姓名 / 稱謂</label>
          <input class="form-input" id="inp-name" type="text" placeholder="請輸入姓名或稱謂" />
        </div>

        <div class="form-row">
          <label class="form-label">性別</label>
          <div class="radio-group">
            <label class="radio-label"><input type="radio" name="gender" value="男" /> 男</label>
            <label class="radio-label"><input type="radio" name="gender" value="女" /> 女</label>
          </div>
        </div>

        <div class="form-row">
          <label class="form-label">曆別</label>
          <div class="radio-group">
            <label class="radio-label"><input type="radio" name="calendar" value="solar" checked /> 國曆</label>
            <label class="radio-label"><input type="radio" name="calendar" value="lunar" /> 農曆</label>
          </div>
          <label class="leap-wrap" id="leap-wrap" style="display:none;">
            <input type="checkbox" id="inp-leap" /> 閏月
          </label>
        </div>

        <div class="form-row">
          <label class="form-label">生日</label>
          <div class="date-group">
            <input class="form-input date-inp" id="inp-year"  type="number" placeholder="年 (1900–2100)" min="1900" max="2100" />
            <input class="form-input date-inp" id="inp-month" type="number" placeholder="月 (1–12)"      min="1"    max="12"   />
            <input class="form-input date-inp" id="inp-day"   type="number" placeholder="日 (1–31)"      min="1"    max="31"   />
          </div>
        </div>

        <div class="form-row">
          <label class="form-label" for="inp-hour">時辰</label>
          <select class="form-input form-select" id="inp-hour">
            <option value="" disabled selected>請選擇時辰</option>
            ${HOURS.map(h => `<option value="${h.value}">${h.label}</option>`).join('\n')}
          </select>
        </div>

        ${!hasKey ? `
        <div class="form-row key-section" id="key-section">
          <label class="form-label" for="inp-key">Gemini API 金鑰</label>
          <input class="form-input" id="inp-key" type="password" placeholder="請輸入 Gemini API 金鑰" autocomplete="off" />
          <div class="key-options">
            <label class="radio-label"><input type="checkbox" id="inp-remember" /> 記住金鑰</label>
            <div class="model-row">
              <label class="form-label" for="inp-model">模型</label>
              <select class="form-input form-select" id="inp-model">
                <option value="gemini-2.5-flash" selected>gemini-2.5-flash</option>
                <option value="gemini-2.5-pro">gemini-2.5-pro</option>
              </select>
            </div>
          </div>
        </div>
        ` : `
        <div class="form-row key-section" id="key-section-haskey">
          <div class="model-row">
            <label class="form-label" for="inp-model">模型</label>
            <select class="form-input form-select" id="inp-model">
              <option value="gemini-2.5-flash" selected>gemini-2.5-flash</option>
              <option value="gemini-2.5-pro">gemini-2.5-pro</option>
            </select>
          </div>
        </div>
        `}

        <div class="form-row form-submit-row">
          <button class="btn-primary" id="btn-submit" type="button">起　盤</button>
        </div>
      </div>
    </div>
  `;

  // 農曆切換顯示/隱藏「閏月」
  document.querySelectorAll('input[name="calendar"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const leapWrap = document.getElementById('leap-wrap');
      if (leapWrap) {
        leapWrap.style.display = radio.value === 'lunar' && radio.checked ? '' : 'none';
      }
    });
  });

  document.getElementById('btn-submit').addEventListener('click', onSubmit);
}

// ── 驗證 ───────────────────────────────────────────────────
function validate(input) {
  const errors = [];

  if (!input.name || !input.name.trim()) {
    errors.push('姓名/稱謂不可空白');
  }

  if (!input.gender) {
    errors.push('請選擇性別');
  }

  const year = input.year;
  const month = input.month;
  const day = input.day;

  if (!year || !Number.isInteger(year) || year < 1900 || year > 2100) {
    errors.push('年份必填且需在 1900–2100 之間');
  }
  if (!month || !Number.isInteger(month) || month < 1 || month > 12) {
    errors.push('月份必填且需在 1–12 之間');
  }
  if (!day || !Number.isInteger(day) || day < 1 || day > 31) {
    errors.push('日期必填且需在 1–31 之間');
  }

  if (input.hourIndex === null || input.hourIndex === undefined || input.hourIndex === '') {
    errors.push('請選擇時辰');
  }

  // 農曆合法性檢查(只在年月日基本格式正確時才檢查)
  if (
    input.calendar === 'lunar' &&
    Number.isInteger(year) && year >= 1900 && year <= 2100 &&
    Number.isInteger(month) && month >= 1 && month <= 12 &&
    Number.isInteger(day) && day >= 1 && day <= 31
  ) {
    try {
      Lunar.fromYmd(year, input.isLeapMonth ? -month : month, day);
    } catch (e) {
      errors.push('農曆日期不存在,請重新選擇');
    }
  }

  return errors;
}

// ── 送出 ───────────────────────────────────────────────────
function onSubmit() {
  // 讀取表單值
  const name = (document.getElementById('inp-name').value || '').trim();

  const genderEl = document.querySelector('input[name="gender"]:checked');
  const gender = genderEl ? genderEl.value : '';

  const calendarEl = document.querySelector('input[name="calendar"]:checked');
  const calendar = calendarEl ? calendarEl.value : 'solar';

  const leapEl = document.getElementById('inp-leap');
  const isLeapMonth = leapEl ? leapEl.checked : false;

  const yearRaw  = document.getElementById('inp-year').value;
  const monthRaw = document.getElementById('inp-month').value;
  const dayRaw   = document.getElementById('inp-day').value;

  const year  = yearRaw  !== '' ? Math.trunc(Number(yearRaw))  : null;
  const month = monthRaw !== '' ? Math.trunc(Number(monthRaw)) : null;
  const day   = dayRaw   !== '' ? Math.trunc(Number(dayRaw))   : null;

  const hourRaw = document.getElementById('inp-hour').value;
  const hourIndex = hourRaw !== '' ? Number(hourRaw) : null;

  const modelEl = document.getElementById('inp-model');
  if (modelEl) selectedModel = modelEl.value;

  // 金鑰區處理
  const keyInput = document.getElementById('inp-key');
  const hasKeySection = !!keyInput;
  const errors = [];

  let keyValue = '';
  let rememberKey = false;
  if (hasKeySection) {
    keyValue = (keyInput.value || '').trim();
    const rememberEl = document.getElementById('inp-remember');
    rememberKey = rememberEl ? rememberEl.checked : false;
    if (!keyValue) {
      errors.push('請輸入 Gemini API 金鑰');
    }
  }

  // 組合 input 物件
  const input = { name, gender, calendar, year, month, day, isLeapMonth, hourIndex };

  // 驗證
  const validationErrors = validate(input);
  const allErrors = [...errors, ...validationErrors];

  const errBox = document.getElementById('form-errors');
  if (allErrors.length > 0) {
    if (errBox) {
      errBox.style.display = '';
      errBox.innerHTML = allErrors.map(e => `<div class="form-error-item">✦ ${e}</div>`).join('');
    }
    return;
  }

  // 清除錯誤訊息
  if (errBox) {
    errBox.style.display = 'none';
    errBox.innerHTML = '';
  }

  // 儲存金鑰與模型
  if (hasKeySection && keyValue) {
    setApiKey(keyValue, rememberKey);
  }

  // 起盤
  const chartData = buildChart(input);
  renderChart(chartData);
}

// ── 佔位函式(後續任務實作) ──────────────────────────────────
function renderChart(data){ /* T8 實作 */ }
function renderPanels(data){ /* T9 實作 */ }

// ── 啟動 ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', renderForm);
