// Temporary, deterministic UI acceptance data. This module never reads or writes storage.
const syntheticParagraphs = [
  '这是一份完全虚构的求职填写样本，不代表任何真实个人或公司。',
  '在一项虚构课程任务中，我使用 AI 工具整理公开信息、比较方案并辅助制作产品草稿。先拆分目标，说明输入与预期，再逐步检查输出。',
  '我会结合不同工具的特点安排任务，检查资料来源和逻辑，对关键事实进行复核。采用生成建议前，先用一个小范围场景进行验证。',
  '在虚构协作过程中，我整理需求、记录待确认的问题，并把可复用的流程写成简短说明。重要决策由人工作出，提交前检查准确性和完整性。',
  '后续会根据实际反馈调整使用方法，保留验证记录，减少重复劳动。这些文字仅用于检索与界面响应的验收。',
];
const syntheticBody = syntheticParagraphs.join('\n\n');
const fixedTimestamp = '2026-10-03T00:00:00.000Z';

export const performanceRecords = Array.from({ length: 1000 }, (_, index) => ({
  id: 'demo-' + index,
  topicId: 'ai',
  title: index === 0 ? '性能验收唯一题目' : 'AI 工具使用经验 · 虚构样本 ' + String(index + 1).padStart(4, '0'),
  content: '虚构样本编号：' + String(index + 1).padStart(4, '0') + '\n\n' + syntheticBody,
  jobSnapshot: {
    title: 'AI 产品经理',
    company: '虚构示例公司',
    description: '虚构岗位：整理产品需求，制作方案草稿，评估 AI 工具的应用效果。',
    keywords: ['需求整理', '方案设计', 'AI 工具'],
  },
  createdAt: fixedTimestamp,
  updatedAt: fixedTimestamp,
}));
