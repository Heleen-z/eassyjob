import 'fake-indexeddb/auto';
import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRecord, defaultTopics, makeBackup } from '../src/lib/data.js';
import {
  loadLibrary, saveRecord, deleteRecord, saveTopic, restoreBackup, subscribeLibrary,
} from '../src/lib/storage.js';

function resetDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('job-library');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('测试资料库连接没有关闭'));
  });
}

beforeEach(resetDatabase);
after(resetDatabase);

function record(id, overrides = {}) {
  return createRecord({
    topicId: 'ai',
    title: '如何使用 AI 工具？',
    content: '这是一份合成测试内容。\n保留第二段。',
    jobSnapshot: null,
    ...overrides,
  }, { id });
}

function role(title) {
  return { title, company: '测试公司', description: '合成岗位描述', keywords: ['JavaScript'] };
}

test('首次加载只有默认主题，保存后的完整内容能从新事务恢复', async () => {
  const initial = await loadLibrary();
  assert.deepEqual(initial.topics, defaultTopics);
  assert.deepEqual(initial.records, []);
  const original = record('first');
  assert.deepEqual(await saveRecord(original), original);
  assert.deepEqual((await loadLibrary()).records, [original]);
  const loaded = await loadLibrary();
  loaded.records[0].content = '修改调用方副本';
  assert.equal((await loadLibrary()).records[0].content, original.content);
});

test('同 ID 编辑更新当前记录，保留创建时间且排除自身查重', async () => {
  const original = {
    ...record('editing'),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  await saveRecord(original);
  const edit = {
    ...original,
    content: '当前记录修改后的内容',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  };
  const saved = await saveRecord(edit);
  assert.equal(saved.id, original.id);
  assert.equal(saved.createdAt, original.createdAt);
  assert.equal(saved.updatedAt, edit.updatedAt);
  assert.equal(saved.content, edit.content);
  const library = await loadLibrary();
  assert.deepEqual(library.records, [saved]);
  assert.deepEqual(await saveRecord(saved), saved);
  assert.equal((await loadLibrary()).records.length, 1);
});

test('完全重复被拒绝，不同岗位相同正文保留，显式允许重复可以保存', async () => {
  const front = record('front', { jobSnapshot: role('前端开发工程师') });
  const back = record('back', { jobSnapshot: role('后端开发工程师') });
  await saveRecord(front);
  await saveRecord(back);
  const duplicate = { ...front, id: 'duplicate' };
  await assert.rejects(saveRecord(duplicate), (error) =>
    error.code === 'DUPLICATE' && error.record.id === 'front');
  assert.equal((await loadLibrary()).records.length, 2);
  await saveRecord(duplicate, { allowDuplicate: true });
  assert.equal((await loadLibrary()).records.length, 3);
});

test('编辑为其他现有记录的正文被拒绝，失败后原记录保持不变', async () => {
  const first = record('first', { content: '第一份正文' });
  const second = record('second', { content: '第二份正文' });
  await saveRecord(first);
  await saveRecord(second);
  const snapshot = await loadLibrary();
  await assert.rejects(saveRecord({ ...first, content: second.content }),
    (error) => error.code === 'DUPLICATE' && error.record.id === 'second');
  assert.deepEqual(await loadLibrary(), snapshot);
});

test('并发相同内容的保存由事务串行查重，只写入一份', async () => {
  const results = await Promise.allSettled([
    saveRecord(record('concurrent-a')),
    saveRecord(record('concurrent-b')),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = results.find((result) => result.status === 'rejected');
  assert.equal(rejected.reason.code, 'DUPLICATE');
  assert.equal((await loadLibrary()).records.length, 1);
});

test('创建和更新主题保持关联，重复主题被拒绝；删除只移除目标记录', async () => {
  const topic = { id: 'custom', name: '自定义填写主题', aliases: ['自定义问题'] };
  await saveTopic(topic);
  const custom = record('custom-record', { topicId: topic.id });
  const basic = record('basic-record', { topicId: 'basic', title: '姓名', content: '合成姓名' });
  await saveRecord(custom);
  await saveRecord(basic);
  await saveTopic({ ...topic, name: '更新后的主题', aliases: ['更新后的问题'] });
  const updated = await loadLibrary();
  assert.equal(updated.topics.find((item) => item.id === topic.id).name, '更新后的主题');
  assert.equal(updated.records.find((item) => item.id === custom.id).topicId, topic.id);
  await assert.rejects(saveTopic({ id: 'duplicate-topic', name: '更新后的主题', aliases: [] }),
    (error) => error.code === 'DUPLICATE_TOPIC' && error.topic.id === topic.id);
  await deleteRecord(custom.id);
  assert.deepEqual((await loadLibrary()).records, [basic]);
  await deleteRecord('not-present');
  assert.deepEqual((await loadLibrary()).records, [basic]);
});

test('无效正文、不存在的主题和损坏备份整体拒绝，数据库保持原样', async () => {
  await saveRecord(record('baseline'));
  const baseline = await loadLibrary();
  await assert.rejects(saveRecord({ ...record('bad-content'), content: '  ' }), { code: 'VALIDATION' });
  await assert.rejects(saveRecord(record('bad-topic', { topicId: 'missing-topic' })),
    { code: 'VALIDATION' });
  await assert.rejects(saveTopic({ id: 'bad-topic', name: '', aliases: [] }), { code: 'VALIDATION' });
  await assert.rejects(deleteRecord(''), { code: 'VALIDATION' });
  const invalidBackup = makeBackup(defaultTopics, [record('valid-import')]);
  invalidBackup.records.push({ ...record('invalid-import'), topicId: 'missing-topic' });
  await assert.rejects(restoreBackup(invalidBackup), { code: 'VALIDATION' });
  assert.deepEqual(await loadLibrary(), baseline);
});

test('恢复同 ID 冲突另存并正确映射来源，再次恢复跳过完全重复', async () => {
  const local = record('A', { content: '本地原始正文' });
  await saveRecord(local);
  const incomingA = record('A', { content: '导入的另一份正文' });
  const incomingB = { ...record('B', { content: '基于导入内容修改后的版本' }), sourceRecordId: 'A' };
  const backup = makeBackup(defaultTopics, [incomingB, incomingA]);
  const first = await restoreBackup(backup);
  assert.equal(first.added, 2);
  assert.equal(first.skipped, 0);
  assert.equal(first.conflicts, 1);
  const imported = first.records.find((item) => item.content === incomingA.content);
  assert.notEqual(imported.id, 'A');
  assert.equal(first.records.find((item) => item.id === 'B').sourceRecordId, imported.id);
  assert.equal(first.records.find((item) => item.id === 'A').content, local.content);
  const saved = await loadLibrary();
  const second = await restoreBackup(backup);
  assert.equal(second.added, 0);
  assert.equal(second.skipped, 2);
  assert.deepEqual(await loadLibrary(), saved);
});

test('恢复中途写入失败回滚全部记录及主题，不发布成功通知', async (t) => {
  await saveRecord(record('baseline'));
  const baseline = await loadLibrary();
  const topic = { id: 'new-topic', name: '事务失败时不应留下的主题', aliases: [] };
  const backup = makeBackup([...defaultTopics, topic], [
    record('first-write', { topicId: topic.id, content: '第一个排队的写入' }),
    record('failing-write', { topicId: topic.id, content: '第二个写入时模拟失败' }),
  ]);
  let notifications = 0;
  const unsubscribe = subscribeLibrary(() => { notifications += 1; });
  t.after(unsubscribe);
  const originalPut = IDBObjectStore.prototype.put;
  let sawFirstWrite = false;
  t.mock.method(IDBObjectStore.prototype, 'put', function injectedFailure(value, ...args) {
    if (this.name === 'records' && value.id === 'first-write') sawFirstWrite = true;
    if (this.name === 'records' && value.id === 'failing-write') {
      throw new DOMException('合成测试：模拟磁盘配额不足', 'QuotaExceededError');
    }
    return originalPut.call(this, value, ...args);
  });
  await assert.rejects(restoreBackup(backup), { name: 'QuotaExceededError' });
  assert.equal(sawFirstWrite, true);
  assert.deepEqual(await loadLibrary(), baseline);
  assert.equal(notifications, 0);
});

test('成功提交才通知订阅方，取消订阅后不再通知', async () => {
  let notifications = 0;
  const unsubscribe = subscribeLibrary(() => { notifications += 1; });
  await loadLibrary();
  assert.equal(notifications, 0);
  await saveRecord(record('notify'));
  assert.equal(notifications, 1);
  await assert.rejects(saveRecord(record('duplicate-notify')), { code: 'DUPLICATE' });
  assert.equal(notifications, 1);
  unsubscribe();
  await deleteRecord('notify');
  assert.equal(notifications, 1);
});
