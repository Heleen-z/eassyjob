const applicationSource = {
  label: 'National Careers Service · 求职申请表填写建议',
  url: 'https://nationalcareers.service.gov.uk/careers-advice/application-forms',
};

const starSource = {
  label: 'National Careers Service · STAR 方法',
  url: 'https://nationalcareers.service.gov.uk/careers-advice/interview-advice/the-star-method',
};

export const templateSources = [
  {
    ...applicationSource,
    note: '参考常见申请表的联系方式、教育、工作经历和能力举例分类；以下中文内容为原创占位模板。',
  },
  {
    ...starSource,
    note: '参考情境、任务、行动、结果的经历组织方式；未复制来源中的示例经历。',
  },
];

export const templates = [
  {
    id: 'basic-name',
    name: '姓名',
    description: '单独保存姓名，适合一项一项复制。',
    topicId: 'basic',
    title: '姓名',
    content: '[你的姓名]',
    isGeneral: true,
    sourceReferences: [applicationSource],
  },
  {
    id: 'basic-phone',
    name: '手机号码',
    description: '只保存手机号，避免复制其他联系方式。',
    topicId: 'basic',
    title: '手机号码',
    content: '[你的手机号码]',
    isGeneral: true,
    sourceReferences: [applicationSource],
  },
  {
    id: 'basic-email',
    name: '电子邮箱',
    description: '保存用于接收招聘通知的邮箱。',
    topicId: 'basic',
    title: '电子邮箱',
    content: '[你的求职邮箱]',
    isGeneral: true,
    sourceReferences: [applicationSource],
  },
  {
    id: 'education',
    name: '教育经历',
    description: '学校、专业、时间与相关课程；按需要删去不适用的项。',
    topicId: 'education',
    title: '请填写你的教育经历。',
    content: '学校：[学校名称]\n学历 / 学位：[学历或学位]\n专业：[专业名称]\n就读时间：[开始年月]—[结束年月或预计毕业年月]\n相关课程：[与目标岗位相关且实际修读的课程]\n补充信息：[有依据的成绩、奖项或资格；不适用可删除]',
    isGeneral: true,
    sourceReferences: [applicationSource],
  },
  {
    id: 'internship',
    name: '实习职责与成果',
    description: '写清个人职责、具体行动和有依据的成果。',
    topicId: 'internship',
    title: '请描述一段相关的实习或工作经历。',
    content: '单位 / 部门：[单位和部门]\n岗位与时间：[实习岗位]，[开始年月]—[结束年月]\n主要职责：[本人实际负责的工作]\n具体行动：[完成工作的做法、工具与协作方式]\n成果与依据：[可核实的交付物、反馈或指标；没有量化数据就描述具体结果]\n与申请岗位的关联：[这段经历能证明的相关能力]',
    isGeneral: false,
    sourceReferences: [applicationSource],
  },
  {
    id: 'project-star',
    name: '项目经历 · STAR',
    description: '用背景、任务、行动、结果组织一段真实项目经历。',
    topicId: 'projects',
    title: '请介绍一个与你申请岗位相关的项目。',
    content: '项目名称：[项目名称]\n背景（S）：[项目面向谁，解决什么问题]\n任务（T）：[目标、约束以及本人承担的部分]\n行动（A）：[本人具体做了什么，采用什么方法，如何处理难点]\n结果（R）：[实际交付与验证结果；指标须注明口径或依据]\n经验：[从项目中学到的内容，以及与目标岗位的关联]',
    isGeneral: false,
    sourceReferences: [starSource],
  },
  {
    id: 'professional-skills',
    name: '专业技能',
    description: '技能名称配上使用场景与证据，比堆砌关键词更便于复用。',
    topicId: 'skills',
    title: '请说明你的专业技能及相关实践。',
    content: '核心技能：[实际掌握的技能、语言或工具]\n应用场景：[在课程、项目或工作中如何使用]\n熟练程度：[能够独立完成的具体任务]\n实践证据：[对应的作品、项目或可核实成果]\n岗位关联：[这些能力与岗位要求的对应点]',
    isGeneral: false,
    sourceReferences: [applicationSource],
  },
  {
    id: 'ai-collaboration',
    name: 'AI 工具协作',
    description: '原创框架：记录真实用途、人工判断和验证过程。',
    topicId: 'ai',
    title: '你如何使用 AI 工具辅助学习或工作？',
    content: '实际使用的工具：[你用过的 AI 工具]\n任务与目标：[具体任务，以及希望改善的环节]\n协作流程：[如何提供上下文、拆分任务和迭代结果]\n人工判断：[由自己确定的目标、取舍与最终决策]\n验证方法：[如何检查事实、运行结果或作品质量]\n实际效果：[有依据的改进或交付；不要填写未经验证的比例或部署情况]',
    isGeneral: false,
    sourceReferences: [],
  },
  {
    id: 'self-evaluation',
    name: '自我评价',
    description: '以相关优势、真实例子和改进方向构成简短介绍。',
    topicId: 'self',
    title: '请简要评价自己。',
    content: '我与该岗位相关的优势是[优势或能力]。在[真实经历]中，我通过[具体行动]完成了[有依据的结果]。\n目前我正在改进[需要提升的方面]，采取的做法是[实际行动]。我希望将[已有能力]用于[目标岗位的具体工作]。',
    isGeneral: false,
    sourceReferences: [applicationSource],
  },
  {
    id: 'application-motivation',
    name: '求职动机',
    description: '结合实际了解的岗位工作与自己的经历，避免空泛套话。',
    topicId: 'motivation',
    title: '为什么申请这个岗位？',
    content: '我对[岗位或业务方向]感兴趣，具体原因是[与真实经历相关的动机]。\n通过[岗位描述或公司公开信息]，我了解到这项工作需要[具体能力或职责]。我在[真实经历]中积累了[相关能力与证据]，希望在这个岗位上参与[具体工作]并继续提升[能力方向]。',
    isGeneral: false,
    sourceReferences: [applicationSource],
  },
  {
    id: 'career-plan',
    name: '职业规划',
    description: '原创框架：写清近期能力目标与可执行的成长路径。',
    topicId: 'career',
    title: '你的职业规划是什么？',
    content: '近期目标：[入职初期希望掌握的工作与能力]\n行动计划：[学习、实践与反馈的具体安排]\n阶段成果：[可以用于检验进步的交付或能力表现]\n中期方向：[希望逐步承担的职责，与申请岗位的联系]\n调整方式：[如何根据实际工作反馈调整规划]',
    isGeneral: false,
    sourceReferences: [],
  },
  {
    id: 'teamwork-star',
    name: '团队合作 · STAR',
    description: '突出自己在团队中的贡献，保留协作与结果的证据。',
    topicId: 'self',
    title: '请举例说明你如何与团队协作。',
    content: '背景（S）：[团队所处情境及需要解决的问题]\n任务（T）：[共同目标与本人分工]\n行动（A）：[如何沟通、推进任务或解决分歧，写明本人的行动]\n结果（R）：[团队实际结果及本人贡献的依据]\n反思：[下次协作会保留或改进的做法]',
    isGeneral: false,
    sourceReferences: [applicationSource, starSource],
  },
];

const topicLabels = {
  basic: ['基本资料', '基本信息', '个人信息', '联系方式'],
  education: ['教育经历', '教育背景'],
  internship: ['实习经历', '实习经验', '工作经历'],
  projects: ['项目经历', '项目经验'],
  skills: ['专业技能', '技能特长'],
  ai: ['AI 工具使用', 'AI工具使用', 'AI 工具协作', 'AI工具协作', 'AI 应用', 'AI应用'],
  self: ['自我评价', '个人评价', '团队合作'],
  career: ['职业规划', '职业发展'],
  motivation: ['求职动机', '应聘动机', '申请动机'],
};

const topicLookup = new Map(
  Object.entries(topicLabels).flatMap(([id, labels]) =>
    [id, ...labels].map((label) => [label.replace(/\s+/g, '').toLowerCase(), id]),
  ),
);

const headingPattern = /^\s*##\s+内容(?:\s*\d+)?\s*$/;
const headerPattern = /^\s*(主题|问题|岗位|公司|关键词|岗位描述|正文)\s*[:：]\s?(.*)$/;
const acceptedTopics = Object.values(topicLabels).map((labels) => labels[0]).join('、');

export const quickImportExample = `## 内容 1
主题：基本资料
问题：手机号码
岗位：
公司：
关键词：
岗位描述：
正文：
[你的手机号码]

## 内容 2
主题：项目经历
问题：请介绍一个与你申请岗位相关的项目。
岗位：[岗位名称]
公司：[公司名称，可留空]
关键词：[关键词一]、[关键词二]
岗位描述：[粘贴相关职责摘要，可留空]
正文：
背景：[项目面向谁，解决什么问题]
任务：[本人承担的目标与范围]
行动：[本人具体采取的做法]
结果：[可核实的交付或效果]

## 内容 3
主题：AI 工具使用
问题：你如何使用 AI 工具辅助工作？
岗位：[岗位名称]
公司：
关键词：
岗位描述：
正文：
工具：[实际用过的工具]
任务：[真实的使用场景]
协作：[如何提供上下文、迭代和保留人工判断]
验证：[如何确认结果可靠]
效果：[有依据的结果]`;

function trimBlankLines(lines) {
  let start = 0;
  let end = lines.length;
  while (start < end && !lines[start].trim()) start += 1;
  while (end > start && !lines[end - 1].trim()) end -= 1;
  return lines.slice(start, end).join('\n');
}

function parseEntry(lines, index) {
  const fields = {};
  const body = [];
  let inBody = false;

  for (const line of lines) {
    if (inBody) {
      body.push(line);
      continue;
    }
    if (!line.trim()) continue;
    const match = line.match(headerPattern);
    if (!match) {
      throw new Error(`第 ${index} 条在“正文：”之前有无法识别的行：${line.trim().slice(0, 36)}。请使用模板中的字段名称。`);
    }
    const [, label, value] = match;
    if (label === '正文') {
      inBody = true;
      if (value.length) body.push(value);
      continue;
    }
    if (Object.hasOwn(fields, label)) {
      throw new Error(`第 ${index} 条的“${label}”出现了两次，请保留一个字段。`);
    }
    fields[label] = value.trim();
  }

  if (!fields.主题) throw new Error(`第 ${index} 条缺少主题，请填写“主题：项目经历”等内容。`);
  const topicId = topicLookup.get(fields.主题.replace(/\s+/g, '').toLowerCase());
  if (!topicId) {
    throw new Error(`第 ${index} 条的主题“${fields.主题}”无法识别。可用主题：${acceptedTopics}。`);
  }
  if (!fields.问题) throw new Error(`第 ${index} 条缺少问题，请填写“问题：”后的题目或资料名称。`);
  if (!inBody) throw new Error(`第 ${index} 条缺少“正文：”，请在回答前添加这一行。`);

  const content = trimBlankLines(body);
  if (!content.trim()) throw new Error(`第 ${index} 条的正文为空，请填写要保存的回答。`);

  const title = fields.岗位 || '';
  const company = fields.公司 || '';
  const description = fields.岗位描述 || '';
  const keywords = [...new Set((fields.关键词 || '').split(/[,，、;；\n]/).map((keyword) => keyword.trim()).filter(Boolean))];

  if (!title && (company || description || keywords.length)) {
    throw new Error(`第 ${index} 条填写了公司、关键词或岗位描述，但岗位名称为空。请补充岗位名称；保存通用资料时请将这些岗位字段留空。`);
  }

  return {
    topicId,
    title: fields.问题,
    content,
    jobSnapshot: title ? { title, company, description, keywords } : null,
  };
}

/**
 * Parse a batch of application answers. Only header fields before 正文 are read.
 * Blank optional fields are allowed. The reserved “## 内容 [number]” line starts
 * the next entry; all other lines inside the answer are retained.
 */
export function parseQuickImport(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('先粘贴要导入的内容，可从格式示例开始填写。');
  }

  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const entries = [];
  let current = null;

  for (const line of lines) {
    if (headingPattern.test(line)) {
      if (current) entries.push(current);
      current = [];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) entries.push(current);
  if (!entries.length) {
    throw new Error('没有找到内容分隔标题。请让每条记录从独占一行的“## 内容 1”开始。');
  }

  return entries.map((entry, index) => parseEntry(entry, index + 1));
}
