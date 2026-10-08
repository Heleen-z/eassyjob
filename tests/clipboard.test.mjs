import test from 'node:test';
import assert from 'node:assert/strict';
import { copyText } from '../src/lib/clipboard.js';

test('复制成功前等待系统确认，保留中文、英文、空格和换行', async () => {
  const value = '中文 + English\n\n  保留前导空格\n最后一行';
  let saved, finish, fallback = false;
  const result = copyText(value, { clipboard: { writeText: text => { saved = text; return new Promise(resolve => { finish = resolve; }); } }, selectFallback: () => { fallback = true; } });
  assert.equal(saved, value);
  finish(); assert.deepEqual(await result, { copied: true }); assert.equal(fallback, false);
});
test('剪贴板被拒绝或不可用时选中原文以便手动复制', async () => {
  for (const clipboard of [undefined, { writeText: async () => { throw new Error('NotAllowedError'); } }]) {
    let selected = 0;
    assert.deepEqual(await copyText('原文\n第二行', { clipboard, selectFallback: () => { selected += 1; } }), { copied: false });
    assert.equal(selected, 1);
  }
});
