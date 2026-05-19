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

// ── 地支 → 格子位置 (row, col) 1-indexed ────────────────────
const BRANCH_POS = {
  子:[4,3], 丑:[4,2], 寅:[4,1], 卯:[3,1],
  辰:[2,1], 巳:[1,1], 午:[1,2], 未:[1,3],
  申:[1,4], 酉:[2,4], 戌:[3,4], 亥:[4,4],
};

// ── 渲染命盤 ───────────────────────────────────────────────
function renderChart(data) {
  const app = document.getElementById('app');

  // 宮格 HTML 產生器
  function palaceHTML(palace) {
    const pos = BRANCH_POS[palace.branch];
    if (!pos) return '';
    const [row, col] = pos;
    const gridStyle = `grid-row:${row};grid-column:${col};`;

    const majorHTML = palace.majorStars.map(s => {
      const tag = s.mutagen ? `<span class="mutagen">⟨${s.mutagen}⟩</span>` : '';
      return `<span class="star-major">${s.name}${tag}</span>`;
    }).join('');

    const minorHTML = palace.minorStars.map(s => {
      const tag = s.mutagen ? `<span class="mutagen-minor">⟨${s.mutagen}⟩</span>` : '';
      return `<span class="star-minor">${s.name}${tag}</span>`;
    }).join('');

    const adjHTML = palace.adjStars.map(s =>
      `<span class="star-adj">${s}</span>`
    ).join('');

    return `
      <div class="palace" style="${gridStyle}">
        <div class="palace-branch">${palace.branch}</div>
        <div class="palace-name">${palace.name}</div>
        <div class="palace-stars">
          ${majorHTML}
          ${minorHTML ? `<div class="stars-minor-row">${minorHTML}</div>` : ''}
          ${adjHTML ? `<div class="stars-adj-row">${adjHTML}</div>` : ''}
        </div>
      </div>`;
  }

  // 中宮 HTML
  const bazi = data.bazi;
  const centerHTML = `
    <div class="palace center" style="grid-row:2/4;grid-column:2/4;">
      <div class="center-name">${data.name}</div>
      <div class="center-gender">${data.gender}</div>
      <div class="center-date">
        <span class="center-label">國曆</span>${data.solarDate}
      </div>
      <div class="center-date">
        <span class="center-label">農曆</span>${data.lunarDate}
      </div>
      <div class="center-wuxing">${data.fiveElementsClass}</div>
      <div class="center-soul">
        <span class="center-label">命主</span>${data.soul}
        <span class="center-sep">‧</span>
        <span class="center-label">身主</span>${data.body}
      </div>
      <div class="center-bazi">
        <span class="bazi-item"><span class="center-label">年</span>${bazi.year}</span>
        <span class="bazi-item"><span class="center-label">月</span>${bazi.month}</span>
        <span class="bazi-item"><span class="center-label">日</span>${bazi.day}</span>
        <span class="bazi-item"><span class="center-label">時</span>${bazi.hour}</span>
      </div>
    </div>`;

  // 全部宮格
  const palacesHTML = data.palaces.map(palaceHTML).join('');

  app.innerHTML = `
    <div class="act2-wrap fade-in">
      <header class="act2-header">
        <h1 class="title-main">紫微斗數</h1>
        <p class="title-sub">命 ‧ 八字 ‧ 流年</p>
      </header>

      <div class="board-wrap">
        <div class="board">
          ${palacesHTML}
          ${centerHTML}
        </div>
      </div>

      <div class="panels-wrap">
        <div class="panel-card" id="panel-overall">
          <div class="panel-title">整體格局</div>
          <div class="panel-body"></div>
        </div>
        <div class="panel-card" id="panel-palaces">
          <div class="panel-title">十二宮詳解</div>
          <div class="panel-body"></div>
        </div>
        <div class="panel-card" id="panel-chenggu">
          <div class="panel-title">八字重量</div>
          <div class="panel-body"></div>
        </div>
        <div class="panel-card" id="panel-liunian">
          <div class="panel-title">2026 流年</div>
          <div class="panel-body"></div>
        </div>
      </div>
    </div>
  `;

  renderPanels(data);
}

// ── 四段解讀面板 ───────────────────────────────────────────
function renderPanels(data) {
  // (a) 算農曆月日
  const sd = data.solarDate.split('-').map(Number);
  const lunar = Solar.fromYmd(sd[0], sd[1], sd[2]).getLunar();
  const lunarMonth = Math.abs(lunar.getMonth());
  const lunarDay = lunar.getDay();
  const hourZhi = data.bazi.hour.slice(-1);

  // 稱骨
  const cg = getChengGu(data.bazi.year, lunarMonth, lunarDay, hourZhi);

  // 組 facts
  const facts = {
    name: data.name,
    gender: data.gender,
    bazi: `${data.bazi.year} ${data.bazi.month} ${data.bazi.day} ${data.bazi.hour}`,
    chengGu: cg.weightText,
    fiveElementsClass: data.fiveElementsClass,
    palacesText: data.palaces.map(p =>
      `${p.name}(${p.branch})主星:${p.majorStars.map(s => s.name + (s.mutagen ? '化' + s.mutagen : '')).join('、') || '無主星'}`
    ).join(';'),
    liunianText: `2026 丙午年,流年命宮在${data.liunian.branch}`,
  };

  // (b) 稱骨面板先填本地結果
  const chengguPanel = document.querySelector('#panel-chenggu .panel-body');
  if (chengguPanel) {
    chengguPanel.innerHTML = `
      <div class="chenggu-weight">八字重量：<span class="chenggu-val">${cg.weightText}</span></div>
      <div class="chenggu-verse">${cg.verse}</div>
      <div class="chenggu-analysis" id="chenggu-analysis-content"></div>
    `;
  }

  // 金鑰無效時喚回金鑰輸入
  function showKeyInput(containerEl, onSaved) {
    const existing = document.getElementById('inline-key-form');
    if (existing) { existing.remove(); }
    const wrap = document.createElement('div');
    wrap.id = 'inline-key-form';
    wrap.className = 'inline-key-form';
    wrap.innerHTML = `
      <div class="inline-key-label">請輸入 Gemini API 金鑰</div>
      <div class="inline-key-row">
        <input class="form-input inline-key-input" id="inline-key-inp" type="password" placeholder="金鑰" autocomplete="off" />
        <button class="btn-retry inline-key-btn" id="inline-key-save">儲存金鑰</button>
      </div>
    `;
    containerEl.insertBefore(wrap, containerEl.firstChild);
    document.getElementById('inline-key-save').addEventListener('click', () => {
      const val = (document.getElementById('inline-key-inp').value || '').trim();
      if (val) {
        setApiKey(val, false);
        wrap.remove();
        if (onSaved) onSaved();
      }
    });
  }

  // (c) 串流單段
  async function streamSection(section, contentEl) {
    // 清空舊內容,顯示 loading
    contentEl.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';

    let acc = '';
    try {
      await streamGenerate(section, facts, selectedModel, (chunk) => {
        acc += chunk;
        // 移除 loading(首個 chunk 時)
        const dots = contentEl.querySelector('.loading-dots');
        if (dots) dots.remove();
        contentEl.innerText = acc;
      });
      // 移除可能仍存在的 loading
      const dots = contentEl.querySelector('.loading-dots');
      if (dots) dots.remove();
      if (!acc) {
        throw '生成失敗';
      }
    } catch (err) {
      const dots = contentEl.querySelector('.loading-dots');
      if (dots) dots.remove();

      let msg = '生成失敗';
      if (err === 'KEY_INVALID') {
        msg = '金鑰無效,請重新輸入金鑰';
      } else if (err === 'QUOTA') {
        msg = 'Gemini 額度已用盡,請稍後再試';
      } else if (err === 'NETWORK') {
        msg = '連線失敗,請檢查網路';
      } else if (typeof err === 'string') {
        msg = err;
      }

      const errWrap = document.createElement('div');
      errWrap.className = 'stream-error-wrap';
      errWrap.innerHTML = `
        <div class="stream-error-msg">${msg}</div>
        <button class="btn-retry">重新揭示</button>
      `;
      contentEl.innerHTML = acc ? `<div style="white-space:pre-wrap;">${acc}</div>` : '';
      contentEl.appendChild(errWrap);

      if (err === 'KEY_INVALID') {
        showKeyInput(contentEl, null);
      }

      errWrap.querySelector('.btn-retry').addEventListener('click', () => {
        streamSection(section, contentEl);
      });
    }
  }

  // 依序串流四段
  async function runAllSections() {
    // overall
    const overallEl = document.querySelector('#panel-overall .panel-body');
    if (overallEl) {
      try { await streamSection('overall', overallEl); } catch (_) { /* 顯示重試 UI 後繼續 */ }
    }

    // palaces
    const palacesEl = document.querySelector('#panel-palaces .panel-body');
    if (palacesEl) {
      try { await streamSection('palaces', palacesEl); } catch (_) { /* 繼續 */ }
    }

    // chenggu — 填到本地結果下方的論斷區
    const chengguAnalysisEl = document.getElementById('chenggu-analysis-content');
    if (chengguAnalysisEl) {
      try { await streamSection('chenggu', chengguAnalysisEl); } catch (_) { /* 繼續 */ }
    }

    // liunian
    const liunianEl = document.querySelector('#panel-liunian .panel-body');
    if (liunianEl) {
      try { await streamSection('liunian', liunianEl); } catch (_) { /* 繼續 */ }
    }
  }

  runAllSections();
}

// ── 啟動 ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', renderForm);
