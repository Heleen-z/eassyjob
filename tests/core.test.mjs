import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  defaultTopics, createRecord, validateRecord, fingerprint,
  makeBackup, validateBackup, mergeBackup,
} from '../src/lib/data.js';
import { searchLibrary } from '../src/lib/search.js';
import { prepareRecordSave } from '../src/lib/storage.js';

const empty = () => ({ topics: structuredClone(defaultTopics), records: [] });
function record(id, overrides = {}) {
  return createRecord({
    topicId: 'ai', title: '你如何使用 AI 工具？', content: '我使用多种工具辅助开发。', jobSnapshot: null,
    ...overrides,
  }, { id });
}
function role(title, overrides = {}) {
  return { title, company: '示例公司', description: '', keywords: [], ...overrides };
}

test('默认主题稳定，通用资料与岗位问答共用记录结构', () => {
  assert.deepEqual(defaultTopics.map((topic) => topic.id),
    ['basic', 'education', 'internship', 'projects', 'skills', 'ai', 'self', 'career', 'motivation']);
  assert.equal(defaultTopics[0].name, '基本资料');
  assert.equal(defaultTopics[5].name, 'AI 工具使用');
  const value = createRecord({ topicId: 'basic', title: ' 姓名 ', content: '示例姓名\n' }, { id: 'name' });
  assert.equal(value.title, '姓名');
  assert.equal(value.content, '示例姓名\n');
  assert.equal(value.jobSnapshot, null);
  assert.deepEqual(validateRecord(record('ai', { jobSnapshot: role('前端', { keywords: 'React，TypeScript、React' }) }))
    .jobSnapshot.keywords, ['React', 'TypeScript']);
  assert.throws(() => validateRecord({ topicId: 'ai', title: '工具', content: '  ' }), { code: 'VALIDATION' });
});

test('另存新记录保留原文，指纹忽略元数据但保留内容及岗位差异', () => {
  const original = record('original');
  const originalCopy = structuredClone(original);
  const edited = createRecord({ ...original, content: '修改后的填写内容' },
    { id: 'edited', sourceRecordId: original.id });
  assert.deepEqual(original, originalCopy);
  assert.equal(edited.sourceRecordId, 'original');
  assert.notEqual(fingerprint(original), fingerprint(edited));
  assert.equal(fingerprint(original), fingerprint({ ...original, id: 'different', sourceRecordId: 'anything' }));
  assert.equal(fingerprint(record('lf', { content: '一\n二' })),
    fingerprint(record('crlf', { content: '一\r\n二' })));
  assert.notEqual(fingerprint(record('spaces', { content: '一 二' })),
    fingerprint(record('no-spaces', { content: '一二' })));
  assert.notEqual(fingerprint(original), fingerprint(record('job', { jobSnapshot: role('前端') })));
  assert.notEqual(fingerprint(record('front', { jobSnapshot: role('前端') })),
    fingerprint(record('back', { jobSnapshot: role('后端') })));
  assert.equal(fingerprint(record('order1', { jobSnapshot: role('前端', { keywords: ['React', 'JS'] }) })),
    fingerprint(record('order2', { jobSnapshot: role('前端', { keywords: ['JS', 'React'] }) })));
});

test('备份往返保持原文，无效文件整体拒绝且不修改原库', () => {
  const library = empty();
  library.records.push(record('original', { content: '中文\nEnglish\n  保留缩进' }));
  const snapshot = structuredClone(library);
  const backup = makeBackup(library.topics, library.records);
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(backup))).records, library.records);
  const invalid = { ...backup, records: [backup.records[0], { ...backup.records[0], id: 'bad', topicId: 'missing' }] };
  assert.throws(() => mergeBackup(library, invalid), { code: 'VALIDATION' });
  assert.deepEqual(library, snapshot);
  assert.throws(() => validateBackup({ ...backup, schemaVersion: 2 }), { code: 'VALIDATION' });
  assert.throws(() => validateBackup({ ...backup, records: [backup.records[0], backup.records[0]] }),
    /重复的资料 ID/u);
});

test('当前记录可按同 ID 编辑，保留创建时间且不把自身判为重复', () => {
  const library = empty();
  const original = {
    ...record('edit-original'), createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  };
  library.records.push(original);
  const edited = prepareRecordSave({
    ...original,
    content: '编辑后的正文',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  }, library);
  assert.equal(edited.id, original.id);
  assert.equal(edited.createdAt, '2026-01-01T00:00:00.000Z');
  assert.equal(edited.updatedAt, '2026-04-01T00:00:00.000Z');
  assert.equal(edited.content, '编辑后的正文');
  assert.equal(original.content, '我使用多种工具辅助开发。');
  assert.doesNotThrow(() => prepareRecordSave(original, library));
});

test('编辑及新增仍检查其他记录的完全重复，显式 allowDuplicate 可以继续保存', () => {
  const library = empty();
  const original = record('editing', { content: '编辑前正文' });
  const other = record('other', { content: '另一个已保存的正文' });
  library.records.push(original, other);
  const edit = { ...original, content: other.content };
  assert.throws(() => prepareRecordSave(edit, library), (error) =>
    error.code === 'DUPLICATE' && error.record.id === 'other');
  assert.equal(prepareRecordSave(edit, library, { allowDuplicate: true }).id, 'editing');
  assert.throws(() => prepareRecordSave({ ...other, id: 'new-id' }, library),
    (error) => error.code === 'DUPLICATE' && error.record.id === 'other');
});

test('同 ID 不同内容另存，来源引用映射到新 ID，与输入顺序无关', () => {
  const library = empty();
  library.records.push(record('A', { content: '本地原文' }));
  const importedA = record('A', { content: '导入的新原文' });
  const importedB = { ...record('B', { content: '基于导入记录修改' }), sourceRecordId: 'A' };
  const merged = mergeBackup(library, makeBackup(defaultTopics, [importedB, importedA]));
  assert.equal(merged.added, 2);
  assert.equal(merged.conflicts, 1);
  assert.equal(merged.records.find((item) => item.id === 'A').content, '本地原文');
  const newA = merged.records.find((item) => item.content === '导入的新原文');
  assert.notEqual(newA.id, 'A');
  assert.equal(merged.records.find((item) => item.id === 'B').sourceRecordId, newA.id);
  assert.equal(library.records.length, 1);
});

test('完全重复可映射到另一现有 ID，保留既存来源；导入内重复去除自引用', () => {
  const library = empty();
  library.records.push({ ...record('C'), sourceRecordId: 'old-source' });
  library.records.push(record('A', { content: '同 ID 的另一份本地内容' }));
  const a = record('A');
  const b = { ...record('B', { content: '另存版本' }), sourceRecordId: 'A' };
  const merged = mergeBackup(library, makeBackup(defaultTopics, [b, a]));
  assert.equal(merged.skipped, 1);
  assert.equal(merged.records.find((item) => item.id === 'B').sourceRecordId, 'C');
  assert.equal(merged.records.find((item) => item.id === 'C').sourceRecordId, 'old-source');
  assert.equal(merged.records.find((item) => item.id === 'A').content, '同 ID 的另一份本地内容');
  assert.equal(merged.conflicts, 0);
  const selfCollapsed = mergeBackup(empty(), makeBackup(defaultTopics, [
    { ...record('D'), sourceRecordId: 'E' }, record('E'),
  ]));
  assert.equal(selfCollapsed.added, 1);
  assert.equal(selfCollapsed.skipped, 1);
  assert.equal(selfCollapsed.records[0].sourceRecordId, undefined);
});

test('备份主题名称复用；主题 ID 冲突另存；未知来源不误指本地记录', () => {
  const library = empty();
  library.records.push(record('local-only'));
  const backup = makeBackup([
    { id: 'renamed-ai', name: 'AI 工具使用', aliases: ['新别名'] },
    { id: 'basic', name: '其他个人主题', aliases: [] },
  ], [
    record('alias', { topicId: 'renamed-ai', content: '主题名称复用内容' }),
    { ...record('custom', { topicId: 'basic', content: '自定义主题' }), sourceRecordId: 'local-only' },
  ]);
  const merged = mergeBackup(library, backup);
  assert.equal(merged.records.find((item) => item.id === 'alias').topicId, 'ai');
  const custom = merged.records.find((item) => item.id === 'custom');
  assert.notEqual(custom.topicId, 'basic');
  assert.equal(merged.topics.find((item) => item.id === custom.topicId).name, '其他个人主题');
  assert.equal(custom.sourceRecordId, undefined);
  assert.ok(merged.topics.find((item) => item.id === 'ai').aliases.includes('新别名'));
});

test('双条件搜索优先主题，错误主题的完全相同岗位不能抢占结果', () => {
  const records = [
    record('wrong-topic', { topicId: 'self', title: '个人优势', content: '我善于使用 AI 工具。', jobSnapshot: role('前端开发工程师') }),
    record('right-topic', { jobSnapshot: role('frontend engineer') }),
    record('general', { content: '通用的工具使用内容' }),
  ];
  const freeText = searchLibrary(records, defaultTopics, { text: 'AI工具', role: '前端开发工程师' });
  assert.ok(freeText.some((item) => item.record.id === 'right-topic'));
  assert.ok(freeText.every((item) => item.record.topicId === 'ai'));
  assert.equal(freeText[0].record.id, 'right-topic');
  assert.ok(freeText.some((item) => item.record.id === 'general'));
  const selected = searchLibrary(records, defaultTopics, { role: '前端开发工程师', topicId: 'ai' });
  assert.equal(selected.length, 2);
  assert.equal(selected[0].record.id, 'right-topic');
  assert.ok(selected[0].reasons.includes('近似岗位'));
});

test('姓名字段、中文近似岗位及英文同义词可检索，空搜索按最新排序', () => {
  const records = [
    record('name', { topicId: 'basic', title: '姓名', content: '示例姓名' }),
    record('near', { jobSnapshot: role('前端研发工程师') }),
    record('latest', { topicId: 'education', title: '学历', content: '硕士' }),
  ];
  records[0].updatedAt = '2026-01-01T00:00:00.000Z';
  records[1].updatedAt = '2026-02-01T00:00:00.000Z';
  records[2].updatedAt = '2026-03-01T00:00:00.000Z';
  assert.equal(searchLibrary(records, defaultTopics, { text: '姓名' })[0].record.id, 'name');
  assert.equal(searchLibrary(records, defaultTopics, { topicId: 'ai', role: '前端开发工程师' })[0].record.id, 'near');
  assert.equal(searchLibrary(records, defaultTopics, { topicId: 'ai', role: 'frontend engineer' })[0].record.id, 'near');
  assert.deepEqual(searchLibrary(records, defaultTopics).map((item) => item.record.id), ['latest', 'near', 'name']);
  assert.deepEqual(searchLibrary(records, defaultTopics, { topicId: 'missing' }), []);
});

test('大模型使用经验优先匹配 AI 工具使用原问题，仍保留原文和主题边界', () => {
  const records = [
    record('collaboration', { title: '多模型协作经验', content: '合成协作内容' }),
    record('reference', { title: '请介绍你使用 AI 工具的经验', content: '合成工具使用内容' }),
    record('body-only', { title: '其他填写问题', content: '大模型使用经验', jobSnapshot: null }),
    record('wrong-topic', { topicId: 'self', title: '大模型使用经验', content: '个人评价内容' }),
  ];
  const original = structuredClone(records);
  for (const query of ['大模型使用经验', '大模型应用经验']) {
    const results = searchLibrary(records, defaultTopics, { text: query, topicId: 'ai' });
    assert.equal(results[0].record.id, 'reference');
    assert.ok(results[0].reasons.includes('主题匹配'));
    assert.ok(results[0].reasons.includes('原问题命中'));
    assert.ok(results.every((item) => item.record.topicId === 'ai'));
  }
  const body = searchLibrary(records, defaultTopics, { text: '大模型使用经验', topicId: 'ai' })
    .find((item) => item.record.id === 'body-only');
  assert.ok(body.reasons.includes('正文命中'));
  assert.ok(body.reasons.includes('通用内容'));
  assert.deepEqual(records, original);
});

test('工具使用短语不把开发经验改写为同义主题，公司名称不参与岗位匹配', () => {
  const records = [
    record('tool-usage', {
      title: 'AI 工具使用经验', content: '工具使用填写内容',
      jobSnapshot: role('后端开发工程师', { company: '前端人工智能公司' }),
    }),
    record('model-development', {
      title: '大模型应用开发经验', content: '应用开发填写内容',
      jobSnapshot: role('前端开发工程师', { company: '后端集团' }),
    }),
  ];
  const usage = searchLibrary(records, defaultTopics, { text: '大模型使用', topicId: 'ai' });
  assert.equal(usage[0].record.id, 'tool-usage');
  assert.ok(!usage.find((item) => item.record.id === 'model-development').reasons.includes('原问题命中'));
  const development = searchLibrary(records, defaultTopics, { text: '大模型应用开发经验', topicId: 'ai' });
  assert.equal(development[0].record.id, 'model-development');
  const matchingRole = searchLibrary(records, defaultTopics, { role: 'frontend engineer', topicId: 'ai' });
  assert.equal(matchingRole[0].record.id, 'model-development');
  assert.ok(matchingRole[0].reasons.includes('近似岗位'));
});

test('1000 条资料本地搜索在可交互时间内完成', () => {
  const records = Array.from({ length: 1000 }, (_, index) => record('record-' + index, {
    topicId: index % 2 === 0 ? 'ai' : 'projects',
    content: '我使用 AI 工具辅助开发，复核生成内容，参与 React 项目。'.repeat(10),
    jobSnapshot: role(index % 3 === 0 ? '前端研发工程师' : '后端开发工程师'),
  }));
  const start = performance.now();
  const results = searchLibrary(records, defaultTopics, { text: 'AI工具', role: 'frontend engineer' });
  const duration = performance.now() - start;
  assert.equal(results.length, 500);
  assert.ok(results.every((item) => item.record.topicId === 'ai'));
  assert.ok(duration < 500, '1000 条检索耗时 ' + duration.toFixed(1) + 'ms');
});
