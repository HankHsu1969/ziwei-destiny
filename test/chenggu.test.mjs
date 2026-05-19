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
