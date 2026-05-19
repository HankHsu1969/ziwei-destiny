import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt } from '../src/gemini.js';

const facts = {
  name: '某甲', gender: '男',
  bazi: '庚午 壬午 辛亥 癸巳',
  chengGu: '三兩六錢',
  fiveElementsClass: '火六局',
  palacesText: '命宮(丑)主星:太陽祿、太陰科;財帛宮(酉)主星:武曲',
  liunianText: '2026 丙午年,流年命宮在午',
};

test('prompt 含事實鎖定區與盤面資料', () => {
  const p = buildPrompt('overall', facts);
  assert.ok(p.includes('不可更動'));
  assert.ok(p.includes('庚午 壬午 辛亥 癸巳'));
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
