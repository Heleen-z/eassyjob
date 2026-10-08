const topicDefinitions = [
  ['basic', '基本资料', ['姓名', '联系方式', '手机', '电话', '邮箱', '个人信息']],
  ['education', '教育经历', ['教育背景', '学历', '学校', '专业', '毕业院校']],
  ['internship', '实习经历', ['实习', '工作经历', '工作经验']],
  ['projects', '项目经历', ['项目', '项目经验', '项目介绍']],
  ['skills', '专业技能', ['技能', '技术能力', '专业能力']],
  ['ai', 'AI 工具使用', ['AI应用', 'AI工具', '人工智能工具', '大模型使用', '多模型协作']],
  ['self', '自我评价', ['个人优势', '个人优点', '自我介绍', '性格特长']],
  ['career', '职业规划', ['职业目标', '发展规划', '未来规划']],
  ['motivation', '求职动机', ['应聘原因', '求职原因', '申请原因', '岗位意向']],
];

export const defaultTopics = topicDefinitions.map(([id, name, aliases]) => ({ id, name, aliases }));

function failure(message, code = 'VALIDATION') {
  const error = new Error(message);
  error.code = code;
  return error;
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw failure(label + '必须是对象');
  }
  return value;
}

function requiredText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw failure('请填写' + label);
  return value.trim();
}

function optionalText(value, label, trim = true) {
  if (value == null) return '';
  if (typeof value !== 'string') throw failure(label + '必须是文字');
  return trim ? value.trim() : value;
}

function uniqueStrings(value, label, allowText = false) {
  const values = allowText && typeof value === 'string'
    ? value.split(/[,，、;；\n]+/u)
    : value == null ? [] : value;
  if (!Array.isArray(values) || values.some((item) => typeof item !== 'string')) {
    throw failure(label + '必须是文字列表');
  }
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function newId() {
  return globalThis.crypto?.randomUUID?.()
    ?? 'record-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

function timestamp(value, label) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw failure(label + '不是有效时间');
  }
  return value;
}

function normalizeTopic(value) {
  object(value, '主题');
  return {
    id: requiredText(value.id, '主题 ID'),
    name: requiredText(value.name, '主题名称'),
    aliases: uniqueStrings(value.aliases, '主题别名'),
  };
}

export function validateRecord(draft) {
  object(draft, '资料');
  const content = optionalText(draft.content, '填写内容', false);
  if (!content.trim()) throw failure('请填写具体内容');
  let jobSnapshot = null;
  if (draft.jobSnapshot != null) {
    const job = object(draft.jobSnapshot, '岗位信息');
    jobSnapshot = {
      title: requiredText(job.title, '岗位名称'),
      company: optionalText(job.company, '公司名称'),
      description: optionalText(job.description, '岗位描述', false),
      keywords: uniqueStrings(job.keywords, '岗位关键词', true),
    };
  }
  return {
    topicId: requiredText(draft.topicId, '主题'),
    title: requiredText(draft.title, '字段名称或题目'),
    content,
    jobSnapshot,
  };
}

export function createRecord(draft, options = {}) {
  const validated = validateRecord(draft);
  const id = options.id == null ? newId() : requiredText(options.id, '资料 ID');
  const now = new Date().toISOString();
  const record = { id, ...validated, createdAt: now, updatedAt: now };
  const source = options.sourceRecordId;
  if (source != null) {
    const sourceId = requiredText(source, '来源 ID');
    if (sourceId !== id) record.sourceRecordId = sourceId;
  }
  return record;
}

function storedRecord(value) {
  const validated = validateRecord(value);
  const record = {
    id: requiredText(value.id, '资料 ID'),
    ...validated,
    createdAt: timestamp(value.createdAt, '创建时间'),
    updatedAt: timestamp(value.updatedAt, '修改时间'),
  };
  if (value.sourceRecordId != null) {
    record.sourceRecordId = requiredText(value.sourceRecordId, '来源 ID');
  }
  return record;
}

function comparisonText(value) {
  return value.replace(/\r\n?/g, '\n');
}

export function fingerprint(record) {
  const value = validateRecord(record);
  const job = value.jobSnapshot;
  return JSON.stringify([
    value.topicId,
    value.title,
    comparisonText(value.content),
    job === null ? null : [
      job.title,
      job.company,
      comparisonText(job.description),
      [...job.keywords].sort(),
    ],
  ]);
}

export function validateBackup(value) {
  object(value, '备份');
  if (value.schemaVersion !== 1) throw failure('不支持此备份版本');
  if (!Array.isArray(value.topics) || !Array.isArray(value.records)) {
    throw failure('备份缺少主题或资料列表');
  }
  const topics = value.topics.map(normalizeTopic);
  const topicIds = new Set();
  for (const topic of topics) {
    if (topicIds.has(topic.id)) throw failure('备份中存在重复的主题 ID');
    topicIds.add(topic.id);
  }
  const records = value.records.map(storedRecord);
  const recordIds = new Set();
  for (const record of records) {
    if (recordIds.has(record.id)) throw failure('备份中存在重复的资料 ID');
    if (!topicIds.has(record.topicId)) throw failure('资料引用了不存在的主题');
    recordIds.add(record.id);
  }
  const result = { schemaVersion: 1, topics, records };
  if (value.exportedAt != null) result.exportedAt = timestamp(value.exportedAt, '导出时间');
  return result;
}

export function makeBackup(topics, records) {
  return validateBackup({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    topics,
    records,
  });
}

function topicName(value) {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, '').trim();
}

export function mergeBackup(localLibrary, backup) {
  const local = validateBackup({ schemaVersion: 1, ...localLibrary });
  const incoming = validateBackup(backup);
  const topics = local.topics;
  const records = local.records;
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const topicByName = new Map(topics.map((topic) => [topicName(topic.name), topic]));
  const topicMap = new Map();

  for (const topic of incoming.topics) {
    const sameId = topicById.get(topic.id);
    let target = sameId && topicName(sameId.name) === topicName(topic.name)
      ? sameId : topicByName.get(topicName(topic.name));
    if (!target) {
      let id = topic.id;
      while (topicById.has(id)) id = newId();
      target = { ...topic, id, aliases: [...topic.aliases] };
      topics.push(target);
      topicById.set(id, target);
      topicByName.set(topicName(target.name), target);
    } else {
      target.aliases = [...new Set([...target.aliases, ...topic.aliases])];
    }
    topicMap.set(topic.id, target.id);
  }

  const recordById = new Map(records.map((record) => [record.id, record]));
  const recordByFingerprint = new Map(records.map((record) => [fingerprint(record), record]));
  const reservedIds = new Set([...recordById.keys(), ...incoming.records.map((record) => record.id)]);
  const recordMap = new Map();
  const pending = [];
  let skipped = 0;
  let conflicts = 0;

  for (const source of incoming.records) {
    const candidate = { ...source, topicId: topicMap.get(source.topicId) };
    const key = fingerprint(candidate);
    const duplicate = recordByFingerprint.get(key);
    if (duplicate) {
      recordMap.set(source.id, duplicate.id);
      skipped += 1;
      continue;
    }
    let id = source.id;
    if (recordById.has(id)) {
      do { id = newId(); } while (reservedIds.has(id));
      conflicts += 1;
    }
    reservedIds.add(id);
    const record = { ...candidate, id };
    pending.push({ record, originalSourceId: source.sourceRecordId });
    recordMap.set(source.id, id);
    recordById.set(id, record);
    recordByFingerprint.set(key, record);
  }

  // All incoming IDs must be resolved before provenance can be remapped.
  for (const { record, originalSourceId } of pending) {
    const sourceId = recordMap.get(originalSourceId);
    delete record.sourceRecordId;
    if (sourceId && sourceId !== record.id) record.sourceRecordId = sourceId;
    records.push(record);
  }
  return { topics, records, added: pending.length, skipped, conflicts };
}
