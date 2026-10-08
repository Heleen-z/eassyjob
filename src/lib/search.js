const roleSynonyms = [
  ['frontend', ['前端', 'frontend', 'front end']],
  ['backend', ['后端', 'backend', 'back end']],
  ['fullstack', ['全栈', 'fullstack', 'full stack']],
  ['ai', ['人工智能', '大模型', 'ai', 'llm']],
  ['agent', ['智能体', 'agent', 'agents']],
  ['ml', ['机器学习', 'machine learning', 'ml']],
  ['algorithm', ['算法', 'algorithm']],
  ['test', ['测试', 'qa', 'quality assurance']],
  ['product', ['产品', 'product']],
];

function normalized(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function compact(value) {
  return normalized(value).replace(/\s+/gu, '');
}

function topicPhrase(value) {
  // Only normalize phrases about using tools. Development and role titles stay distinct.
  return compact(value)
    .replace(/(?:大模型|ai工具)(?:的)?(?:使用|应用)(?:的)?(?=经验|经历|情况|能力|方法|方式|$)/gu, 'ai工具使用')
    .replace(/(?:使用|应用)(?:大模型|ai工具)(?:的)?(?=经验|经历|情况|能力|方法|方式|$)/gu, 'ai工具使用');
}

function bigrams(value) {
  const chars = Array.from(compact(value));
  if (chars.length === 1) return new Set(chars);
  const result = new Set();
  for (let index = 0; index < chars.length - 1; index += 1) {
    result.add(chars[index] + chars[index + 1]);
  }
  return result;
}

function dice(left, right) {
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const item of left) if (right.has(item)) overlap += 1;
  return 2 * overlap / (left.size + right.size);
}

function containsTerm(value, term) {
  if (/[a-z]/u.test(term)) {
    const escaped = term.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
    return new RegExp('(^|[^a-z0-9])' + escaped + '(?=$|[^a-z0-9])', 'u').test(value);
  }
  return value.includes(term);
}

function roleTokens(value) {
  const text = normalized(value);
  const tokens = new Set(text.match(/[a-z][a-z0-9+#.]*/gu) ?? []);
  for (const [canonical, variants] of roleSynonyms) {
    if (variants.some((variant) => containsTerm(text, variant))) tokens.add(canonical);
  }
  return tokens;
}

function topicMatch(query, queryGrams, topic) {
  if (!query) return 0;
  let best = 0;
  for (const value of [topic.name, ...(topic.aliases ?? [])]) {
    const name = compact(value);
    if (name === query) return 3;
    if (query.length >= 2 && name.length >= 2 && (query.includes(name) || name.includes(query))) {
      best = Math.max(best, 2);
    } else {
      const similarity = dice(queryGrams, bigrams(name));
      if (similarity >= 0.35) best = Math.max(best, similarity);
    }
  }
  return best;
}

function textMatch(query, queryGrams, title, content, originalQuery, originalGrams) {
  if (!query) return { title: 0, content: 0 };
  const heading = topicPhrase(title);
  const body = compact(content);
  const bodyContains = body.includes(query) || body.includes(originalQuery);
  return {
    title: heading === query ? 4 : heading.includes(query) ? 3 : dice(queryGrams, bigrams(heading)),
    content: bodyContains ? 2 : Math.max(
      dice(queryGrams, bigrams(body)), dice(originalGrams, bigrams(body)),
    ),
  };
}

function compareNewest(left, right) {
  return Date.parse(right.record.updatedAt) - Date.parse(left.record.updatedAt)
    || left.record.id.localeCompare(right.record.id);
}

export function searchLibrary(records, topics, { text = '', role = '', topicId = 'all' } = {}) {
  const originalQuery = compact(text);
  const originalGrams = bigrams(originalQuery);
  const query = topicPhrase(text);
  const queryGrams = bigrams(query);
  const roleQuery = normalized(role);
  const roleCompact = compact(role);
  const roleGrams = bigrams(role);
  const queryRoleTokens = roleTokens(role);
  const topicScores = new Map(topics.map((topic) => [topic.id, topicMatch(query, queryGrams, topic)]));
  const strongTheme = topicId === 'all' && query && [...topicScores.values()].some((score) => score >= 2);
  const results = [];

  for (const record of records) {
    if (topicId !== 'all' && record.topicId !== topicId) continue;
    const theme = topicScores.get(record.topicId) ?? 0;
    if (strongTheme && theme < 2) continue;
    const match = textMatch(query, queryGrams, record.title, record.content, originalQuery, originalGrams);
    if (query && theme === 0 && match.title < 0.18 && match.content < 0.12) continue;

    const reasons = [];
    if (topicId !== 'all') reasons.push('主题匹配');
    else if (theme >= 2) reasons.push('主题匹配');
    else if (theme > 0) reasons.push('近似主题');
    if (match.title >= 3) reasons.push('原问题命中');
    else if (match.content >= 2) reasons.push('正文命中');

    let jobScore = 0;
    const job = record.jobSnapshot;
    if (!job) {
      reasons.push('通用内容');
    } else if (roleQuery) {
      const keywords = Array.isArray(job.keywords) ? job.keywords.join(' ') : job.keywords ?? '';
      const jobTokens = roleTokens(job.title + ' ' + keywords);
      const tokenSimilarity = dice(queryRoleTokens, jobTokens);
      const titleSimilarity = dice(roleGrams, bigrams(job.title));
      const descriptionSimilarity = dice(roleGrams, bigrams(job.description));
      const exact = compact(job.title) === roleCompact;
      jobScore = (exact ? 3 : 0) + 2 * tokenSimilarity + titleSimilarity + 0.3 * descriptionSimilarity;
      if (exact) reasons.push('相同岗位');
      else if (tokenSimilarity > 0) reasons.push('近似岗位');
      else if (titleSimilarity >= 0.2 || descriptionSimilarity >= 0.2) reasons.push('近似岗位');
      else reasons.push('岗位匹配较弱');
    }
    if (!query && !roleQuery) reasons.push('最近保存');
    results.push({ record, reasons, theme, titleScore: match.title, contentScore: match.content, jobScore });
  }

  results.sort((left, right) =>
    right.theme - left.theme
    || right.titleScore - left.titleScore
    || right.jobScore - left.jobScore
    || right.contentScore - left.contentScore
    || compareNewest(left, right));
  return results.map(({ record, reasons }) => ({ record, reasons }));
}
