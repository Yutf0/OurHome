import type { DemoReport, QuestionKind } from './types';

const essayReport: DemoReport = {
  title: '大作文演示批改',
  score: 29,
  maxScore: 40,
  level: '二类文 · 接近一类',
  verdict: '立意与题意相合，结构完整；主要差距在分论点论证没有完全展开。',
  strengths: ['总论点清楚，标题与主题形成照应', '三个分论点方向统一，没有明显跑题', '结尾能够回扣中心并完成升华'],
  priorities: [
    { title: '先补论证链', detail: '每个分论点按“解释—材料—分析—回扣”推进，避免只有观点和例子。' },
    { title: '减少同义反复', detail: '第二段与第三段都在强调重要性，应分别承担不同论证任务。' },
    { title: '把材料用实', detail: '引用材料后补一句“这说明什么”，让事例真正服务于分论点。' },
  ],
  rewrite: {
    before: '只有不断努力，我们才能取得更好的发展。',
    after: '唯有把实干落到破解发展难题的具体行动中，才能将改革愿景转化为群众可感的治理成效。',
  },
};

const smallReport: DemoReport = {
  title: '小题演示批改',
  score: 15,
  maxScore: 20,
  level: '要点较全 · 归并待加强',
  verdict: '核心要点基本覆盖，但同类信息没有合并，部分表述未形成阅卷关键词。',
  strengths: ['能够从材料中提取主要做法', '作答顺序与材料逻辑大体一致', '字数控制合理，没有明显赘述'],
  priorities: [
    { title: '合并同类项', detail: '把“培训人员”和“引进人才”归到“强化人才支撑”，节省字数。' },
    { title: '前置概括词', detail: '每一点先写上位概括，再补材料中的具体做法。' },
    { title: '补齐结果词', detail: '涉及成效时保留结果对象，避免只写“效果显著”这类空泛判断。' },
  ],
  rewrite: {
    before: '当地组织了很多培训，还请来了专家。',
    after: '强化人才支撑：开展分层培训，引入专业团队驻点指导。',
  },
};

export function getDemoReport(kind: QuestionKind): DemoReport {
  return kind === 'essay' ? essayReport : smallReport;
}
