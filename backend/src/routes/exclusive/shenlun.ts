import type { FastifyInstance, FastifyReply } from 'fastify';
import { requireAuth } from '../../auth.js';
import { config } from '../../config.js';

interface ReviewReport {
  title: string;
  score: number;
  maxScore: number;
  level: string;
  verdict: string;
  strengths: string[];
  priorities: Array<{ title: string; detail: string }>;
  rewrite: { before: string; after: string };
}

interface ImageInput {
  mime: string;
  data: Buffer;
}

async function apiError(response: Response, label: string): Promise<never> {
  const text = (await response.text()).slice(0, 500);
  throw new Error(`${label}请求失败（${response.status}）：${text}`);
}

async function kimiRead(images: ImageInput[], task: string): Promise<string> {
  if (!images.length) return '';
  const content = images.map((image) => ({
    type: 'image_url',
    image_url: { url: `data:${image.mime};base64,${image.data.toString('base64')}` },
  }));
  const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.kimiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.kimiModel,
      reasoning_effort: 'low',
      messages: [
        {
          role: 'system',
          content:
            '你是申论试卷转写助手。只忠实转写图片中的中文，不补写、不评价。保留题号、段落、标点和无法辨认处（用[无法辨认]标记）。',
        },
        { role: 'user', content: [...content, { type: 'text', text: task }] },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) return apiError(response, 'Kimi');
  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Kimi 未返回可用的转写内容');
  return text;
}

async function findMaterial(query: string): Promise<string> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.deepseekApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.deepseekModel,
      reasoning_effort: 'low',
      max_tokens: 5000,
      messages: [
        {
          role: 'system',
          content:
            '你负责检索申论真题。只整理能够核实的题干、作答要求、分值、字数和给定资料摘要；信息不足时明确指出，不得虚构官方评分点。',
        },
        { role: 'user', content: `请检索并整理这道申论题：${query}` },
      ],
      tools: [{ type: 'deepseek_web_search' }],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) return apiError(response, 'DeepSeek 联网检索');
  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('未找到可用的题目材料');
  return text;
}

function correctionSystem(kind: string): string {
  const common =
    '你是严谨、克制的申论阅卷老师。必须以用户提供的题目材料和作答为唯一评分依据；材料不完整时降低结论强度并明确指出。禁止编造原文、官方答案或评分标准。';
  if (kind === 'small') {
    return `${common}\n小题按采分点覆盖、要点准确性、层次、字数与表达评分。先找材料依据，再判断遗漏、错点和赘述。`;
  }
  return `${common}\n大作文参考袁东公开方法框架：审题立意、总分论点结构、材料联系、论证层次、对策落地和语言表达。重点判断是否扣题、观点是否清楚、结构是否完整、论据是否有效。不得声称这是袁东老师官方批改。`;
}

async function correct(kind: string, material: string, answer: string): Promise<ReviewReport> {
  const maxScore = kind === 'small' ? 20 : 40;
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.deepseekApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.deepseekModel,
      thinking: { type: 'disabled' },
      max_tokens: 5000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: correctionSystem(kind) },
        {
          role: 'user',
          content: `请批改以下${kind === 'small' ? '申论小题' : '申论大作文'}。满分暂按 ${maxScore} 分；若题干中给出其他分值，以题干为准。\n\n【题目与材料】\n${material.slice(0, 80_000)}\n\n【考生作答】\n${answer.slice(0, 50_000)}\n\n只输出 JSON，字段必须是：title(string)、score(number)、maxScore(number)、level(string)、verdict(string)、strengths(string数组，2到4项)、priorities(恰好3项，每项含title和detail)、rewrite(含before和after，选择一处最值得改写的原句；没有合适原句时说明)。评分要保守，所有意见必须能在材料或作答中找到依据。`,
        },
      ],
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) return apiError(response, 'DeepSeek 批改');
  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = json.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error('DeepSeek 未返回批改报告');
  const report = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, '')) as ReviewReport;
  if (
    typeof report.title !== 'string' ||
    typeof report.score !== 'number' ||
    !Array.isArray(report.strengths) ||
    !Array.isArray(report.priorities) ||
    typeof report.rewrite?.after !== 'string'
  ) {
    throw new Error('DeepSeek 返回的报告结构不完整');
  }
  return report;
}

export function registerShenlunRoutes(app: FastifyInstance): void {
  app.post('/api/exclusive/shenlun/review', { preHandler: requireAuth }, async (req, reply) => {
    if (!config.kimiApiKey || !config.deepseekApiKey) {
      return reply.code(503).send({ error: '申论批改服务尚未配置 API Key' });
    }

    const fields: Record<string, string> = {};
    const materialImages: ImageInput[] = [];
    const answerImages: ImageInput[] = [];
    let totalBytes = 0;

    for await (const part of req.parts()) {
      if (part.type === 'field') {
        fields[part.fieldname] = String(part.value ?? '');
        continue;
      }
      if (!part.mimetype.startsWith('image/')) {
        part.file.resume();
        return reply.code(400).send({ error: '当前真实批改仅支持图片文件' });
      }
      const data = await part.toBuffer();
      totalBytes += data.length;
      if (totalBytes > 25 * 1024 * 1024) {
        return reply.code(413).send({ error: '图片总大小不能超过 25MB' });
      }
      const target = part.fieldname === 'answer_files' ? answerImages : materialImages;
      if (target.length >= 10) return reply.code(400).send({ error: '每组最多上传 10 张图片' });
      target.push({ mime: part.mimetype, data });
    }

    const kind = fields.kind === 'small' ? 'small' : 'essay';
    const materialMode = fields.material_mode || 'text';
    const answerMode = fields.answer_mode || 'text';

    try {
      let material = fields.material_text?.trim() || '';
      if (materialMode === 'upload') {
        material = await kimiRead(
          materialImages,
          '这些图片依次是申论题目和给定资料。请按页序完整转写题干、作答要求、分值、字数和材料正文。'
        );
      } else if (materialMode === 'search') {
        material = await findMaterial(fields.search_query?.trim() || '');
      }

      let answer = fields.answer_text?.trim() || '';
      if (answerMode === 'upload') {
        answer = await kimiRead(
          answerImages,
          '这些图片依次是考生的手写申论答案。请按页序逐字转写，保留段落，不要点评。'
        );
      }

      if (material.length < 20 || answer.length < 20) {
        return reply.code(400).send({ error: '题目材料或答案内容过少，无法开始批改' });
      }
      return await correct(kind, material, answer);
    } catch (error) {
      app.log.error({ err: error }, '申论批改失败');
      const message = error instanceof Error ? error.message : '申论批改失败';
      return reply.code(502).send({ error: message });
    }
  });
}
