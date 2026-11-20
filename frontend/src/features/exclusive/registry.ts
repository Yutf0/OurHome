export type ExclusiveFeatureId = 'shenlun';

export interface ExclusiveFeature {
  id: ExclusiveFeatureId;
  icon: string;
  title: string;
  eyebrow: string;
  description: string;
  status: string;
}

/**
 * 专属功能注册表。
 * 日后新增功能时，只需追加元数据，并在 ExclusivePage 注册对应组件。
 */
export const exclusiveFeatures: ExclusiveFeature[] = [
  {
    id: 'shenlun',
    icon: '🖋️',
    title: '申论批改',
    eyebrow: '学习助手',
    description: '上传题目材料与手写作答，分大作文、小题给出批改建议。',
    status: '首个专属能力',
  },
];
