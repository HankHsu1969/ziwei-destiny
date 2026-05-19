/**
 * gemini.js — 封裝 Google Gemini API
 * 分段 prompt 建構、金鑰管理、串流生成
 */

// ── 金鑰管理 ──────────────────────────────────────────────
let memKey = '';

function getApiKey() {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('gemini_api_key');
    if (stored) return stored;
  }
  return memKey;
}

function setApiKey(key, remember) {
  memKey = key;
  if (remember && typeof localStorage !== 'undefined') {
    localStorage.setItem('gemini_api_key', key);
  }
}

function clearApiKey() {
  memKey = '';
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('gemini_api_key');
  }
}

// ── Prompt 建構 ────────────────────────────────────────────
const SECTION_INSTRUCTIONS = {
  overall:
    '請用簡單易懂的白話,簡要說明這個人的整體命格特點與個性,抓三到四個重點就好。',
  palaces:
    '請逐一說明命宮、兄弟宮、夫妻宮、子女宮、財帛宮、疾厄宮、遷移宮、僕役宮、官祿宮、田宅宮、福德宮、父母宮十二宮。每個宮位只用兩三句白話講最重要的重點,不要長篇大論。',
  chenggu:
    '請用白話簡要說明這個八字重量(袁天罡稱骨)代表的意思,點出一生格局的重點即可,不要逐句翻譯歌訣。',
  liunian:
    '請用白話簡要說明 2026 丙午年的流年運勢,分成事業、財運、感情、健康四個面向,每個面向講重點就好,不要冗長。',
};

const COMMON_PREAMBLE = `以下為系統用專業排盤套件精算的命盤事實,為不可更動的事實。你只能依此解讀,不得改動、新增或重排任何星曜或干支。`;

const COMMON_FOOTER = `請用一般人都看得懂的白話書寫,文字精簡、直接講重點,避免艱深術語與堆砌辭藻,能短則短。以傳統命理觀點、僅供參考的口吻書寫;健康、壽元等敏感面向請採正向、建設性的措辭。`;

function buildPrompt(section, facts) {
  const instruction = SECTION_INSTRUCTIONS[section];
  if (!instruction) {
    throw new Error('未知段落:' + section);
  }

  const factsBlock = [
    `姓名:${facts.name}`,
    `性別:${facts.gender}`,
    `八字:${facts.bazi}`,
    `五行局:${facts.fiveElementsClass}`,
    `八字重量:${facts.chengGu}`,
    `十二宮:${facts.palacesText}`,
    `流年:${facts.liunianText}`,
  ].join('\n');

  return [COMMON_PREAMBLE, '', factsBlock, '', instruction, '', COMMON_FOOTER].join('\n');
}

// ── 串流生成 ───────────────────────────────────────────────
async function streamGenerate(section, facts, model, onChunk) {
  const key = getApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${key}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(section, facts) }] }],
      }),
    });
  } catch (err) {
    if (err === 'KEY_INVALID' || err === 'QUOTA' || err === 'NETWORK') throw err;
    throw 'NETWORK';
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw 'KEY_INVALID';
    if (response.status === 429) throw 'QUOTA';
    throw 'NETWORK';
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // 保留未完整的最後一行
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) onChunk(text);
        } catch {
          // 忽略 JSON 解析錯誤
        }
      }
    }
  } catch (err) {
    if (err === 'KEY_INVALID' || err === 'QUOTA' || err === 'NETWORK') throw err;
    throw 'NETWORK';
  }
}

export { buildPrompt, getApiKey, setApiKey, clearApiKey, streamGenerate };
