import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  defaultTopics, createRecord, validateRecord, makeBackup, validateBackup,
} from '../src/lib/data.js';
import {
  templates, templateSources, quickImportExample, parseQuickImport,
} from '../src/lib/templates.js';

function entry(overrides = {}) {
  const { heading = '## 内容 1', topic = '项目经历', question = '请介绍项目。',
    role = '', company = '', keywords = '', description = '', body = '真实项目的填写内容。' } = overrides;
  return [
    heading,
    `主题：${topic}`,
    `问题：${question}`,
    `岗位：${role}`,
    `公司：${company}`,
    `关键词：${keywords}`,
    `岗位描述：${description}`,
    '正文：',
    body,
  ].join('\n');
}

function validatedRecords(drafts, prefix) {
  const records = drafts.map((draft, index) => {
    const record = createRecord(draft, { id: `${prefix}-${index + 1}` });
    assert.deepEqual(validateRecord(record), draft);
    return record;
  });
  const backup = makeBackup(defaultTopics, records);
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(backup))).records, records);
  return records;
}

test('12 个模板均引用实际默认主题，并覆盖常用资料的全部主题', () => {
  const topicIds = new Set(defaultTopics.map((topic) => topic.id));
  assert.equal(templates.length, 12);
  assert.equal(new Set(templates.map((template) => template.id)).size, templates.length);
  assert.deepEqual(new Set(templates.map((template) => template.topicId)), topicIds);
  for (const template of templates) {
    assert.ok(topicIds.has(template.topicId), `模板 ${template.id} 的主题必须存在`);
    for (const field of ['id', 'name', 'description', 'title', 'content']) {
      assert.equal(typeof template[field], 'string');
      assert.ok(template[field].trim(), `${template.id}.${field} 不能为空`);
    }
    assert.equal(typeof template.isGeneral, 'boolean');
    assert.ok(Array.isArray(template.sourceReferences));
  }
  assert.deepEqual(templates.filter((template) => template.topicId === 'basic').map((template) => template.title),
    ['姓名', '手机号码', '电子邮箱']);
});

test('模板提供有效来源说明，AI 协作与职业规划不冒充来源框架', () => {
  assert.equal(templateSources.length, 2);
  const urls = new Set(templateSources.map((source) => source.url));
  for (const source of templateSources) {
    assert.ok(source.label.trim());
    assert.ok(source.note.trim());
    assert.equal(new URL(source.url).protocol, 'https:');
    assert.equal(new URL(source.url).hostname, 'nationalcareers.service.gov.uk');
  }
  for (const template of templates) {
    for (const source of template.sourceReferences) {
      assert.ok(source.label.trim());
      assert.ok(urls.has(source.url));
    }
  }
  assert.deepEqual(templates.find((template) => template.topicId === 'ai').sourceReferences, []);
  assert.deepEqual(templates.find((template) => template.topicId === 'career').sourceReferences, []);
});

test('每个模板的填写草稿可直接创建记录并通过真实备份校验', () => {
  const drafts = templates.map(({ topicId, title, content }) => ({
    topicId, title, content, jobSnapshot: null,
  }));
  const records = validatedRecords(drafts, 'template');
  assert.equal(records.length, 12);
  assert.ok(records.every((record) => record.jobSnapshot === null));
});

test('实际 defaultTopics 的中文显示名全部可导入并通过 createRecord', () => {
  const drafts = defaultTopics.map((topic) => {
    const draft = parseQuickImport(entry({ topic: topic.name }))[0];
    assert.equal(draft.topicId, topic.id, topic.name);
    return draft;
  });
  assert.equal(validatedRecords(drafts, 'default-topic').length, defaultTopics.length);
});

test('快速导入示例生成三条符合编辑器和存储接口的草稿', () => {
  const drafts = parseQuickImport(quickImportExample);
  assert.equal(drafts.length, 3);
  assert.deepEqual(drafts.map((draft) => draft.topicId), ['basic', 'projects', 'ai']);
  assert.equal(drafts[0].jobSnapshot, null);
  assert.deepEqual(drafts[1].jobSnapshot.keywords, ['[关键词一]', '[关键词二]']);
  for (const draft of drafts) {
    assert.deepEqual(Object.keys(draft).sort(), ['content', 'jobSnapshot', 'title', 'topicId']);
  }
  validatedRecords(drafts, 'quick-example');
});

test('下载的 Markdown 整体可解析，说明与参考链接不会进入回答', () => {
  const markdown = readFileSync(new URL('../public/templates/网申录入模板.md', import.meta.url), 'utf8');
  assert.match(markdown, /保存前替换方括号占位内容/u);
  assert.match(markdown, /https:\/\/nationalcareers\.service\.gov\.uk\/careers-advice\/application-forms/u);
  const drafts = parseQuickImport(markdown);
  assert.equal(drafts.length, 3);
  assert.equal(drafts[0].content, '[你的手机号码]');
  assert.ok(drafts.every((draft) => !draft.content.includes('格式参考与来源')));
  assert.ok(drafts.every((draft) => !draft.content.includes('nationalcareers.service.gov.uk')));
  validatedRecords(drafts, 'downloaded-template');
});

test('正文的行内空格、缩进、空行与看似头字段的文字保留到记录', () => {
  const body = '  首行保留缩进与尾空格  \n\n主题：这不是头字段\n岗位：这也不是头字段\n正文：这行属于原回答\n\t- 列表项\n最后一行  ';
  const draft = parseQuickImport(entry({ body }))[0];
  assert.equal(draft.content, body);
  assert.equal(draft.topicId, 'projects');
  assert.equal(draft.jobSnapshot, null);
  assert.equal(createRecord(draft).content, body);
});

test('Windows 换行与 BOM 可导入，正文换行统一为 LF', () => {
  const body = '中文第一行\n\n  English second line';
  const text = '\uFEFF' + entry({ body }).replace(/\n/g, '\r\n');
  const draft = parseQuickImport(text)[0];
  assert.equal(draft.content, body);
  assert.equal(createRecord(draft).content, body);
});

test('空输入、非文字输入和缺少内容标题时给出可操作错误', () => {
  for (const value of ['', '  \n ', null, undefined, {}, 1]) {
    assert.throws(() => parseQuickImport(value), /先粘贴要导入的内容/u);
  }
  assert.throws(() => parseQuickImport('主题：项目经历\n问题：题目\n正文：回答'), /内容分隔标题/u);
});

test('未知主题明确报错，常见主题别名与主题 ID 可使用', () => {
  assert.throws(() => parseQuickImport(entry({ topic: '不存在的主题' })),
    /主题“不存在的主题”无法识别。可用主题：基本资料/u);
  assert.equal(parseQuickImport(entry({ topic: 'AI工具协作' }))[0].topicId, 'ai');
  assert.equal(parseQuickImport(entry({ topic: '教育背景' }))[0].topicId, 'education');
  assert.equal(parseQuickImport(entry({ topic: 'projects' }))[0].topicId, 'projects');
});

test('主题、问题、正文标记或正文内容缺失时拒绝整批导入', () => {
  const cases = [
    [entry({ topic: '' }), /缺少主题/u],
    [entry({ question: '' }), /缺少问题/u],
    [entry().replace('正文：\n', ''), /无法识别的行/u],
    ['## 内容\n主题：项目经历\n问题：题目', /缺少“正文：”/u],
    [entry({ body: ' \n\t ' }), /正文为空/u],
  ];
  for (const [text, error] of cases) {
    assert.throws(() => parseQuickImport(text), error);
    assert.throws(() => parseQuickImport(entry() + '\n\n' + text), /第 2 条/u);
  }
});

test('无岗位时填写公司、JD 或关键词会报错，防止静默丢失信息', () => {
  for (const overrides of [{ company: '示例公司' }, { description: '相关岗位职责' }, { keywords: 'React' }]) {
    assert.throws(() => parseQuickImport(entry(overrides)), /岗位名称为空。请补充岗位名称/u);
  }
  const general = parseQuickImport('## 内容\n主题：基本资料\n问题：姓名\n正文：\n示例姓名')[0];
  assert.equal(general.jobSnapshot, null);
  const attached = parseQuickImport(entry({ role: '前端工程师' }))[0];
  assert.deepEqual(attached.jobSnapshot, { title: '前端工程师', company: '', description: '', keywords: [] });
  validatedRecords([general, attached], 'job-default');
});

test('无编号、有编号及紧邻编号的内容标题可以混用，并规范岗位关键词', () => {
  const text = [
    entry({ heading: '## 内容', question: '第一条' }),
    entry({ heading: '## 内容 2', question: '第二条' }),
    entry({ heading: '## 内容3', question: '第三条', role: '前端工程师',
      keywords: 'React，React、 测试 ;沟通；测试,TypeScript' }),
  ].join('\n\n');
  const drafts = parseQuickImport(text);
  assert.deepEqual(drafts.map((draft) => draft.title), ['第一条', '第二条', '第三条']);
  assert.deepEqual(drafts[2].jobSnapshot.keywords, ['React', '测试', '沟通', 'TypeScript']);
  validatedRecords(drafts, 'separator');
  const halfWidth = parseQuickImport('## 内容\n主题: 项目经历\n问题: 题目\n正文: 行内回答')[0];
  assert.equal(halfWidth.content, '行内回答');
  assert.equal(halfWidth.jobSnapshot, null);
});

test('重复头字段与无法识别的头字段拒绝导入，不覆盖已有值', () => {
  for (const label of ['主题', '问题', '岗位', '公司', '关键词', '岗位描述']) {
    const text = entry().replace('正文：', `${label}：重复值\n正文：`);
    assert.throws(() => parseQuickImport(text), new RegExp(`“${label}”出现了两次`, 'u'));
  }
  const unexpected = entry().replace('正文：', '未定义字段：不能忽略\n正文：');
  assert.throws(() => parseQuickImport(unexpected), /无法识别的行/u);
});
