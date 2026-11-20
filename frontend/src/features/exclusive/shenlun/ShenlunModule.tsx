import { useEffect, useRef, useState } from 'react';
import { api } from '../../../api';
import { getDemoReport } from './demo';
import UploadBox from './UploadBox';
import type { DemoReport, MaterialMode, QuestionKind, ReviewStage, SelectedFile } from './types';

interface Props {
  onBack: () => void;
}

const materialModes: Array<{ id: MaterialMode; label: string; icon: string }> = [
  { id: 'upload', label: '上传材料', icon: '▧' },
  { id: 'search', label: '联网找题', icon: '⌕' },
  { id: 'text', label: '粘贴文字', icon: 'T' },
];

export default function ShenlunModule({ onBack }: Props) {
  const [kind, setKind] = useState<QuestionKind>('essay');
  const [materialMode, setMaterialMode] = useState<MaterialMode>('upload');
  const [materialFiles, setMaterialFiles] = useState<SelectedFile[]>([]);
  const [answerFiles, setAnswerFiles] = useState<SelectedFile[]>([]);
  const [answerMode, setAnswerMode] = useState<'upload' | 'text'>('upload');
  const [answerText, setAnswerText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [materialText, setMaterialText] = useState('');
  const [stage, setStage] = useState<ReviewStage>('setup');
  const [liveReport, setLiveReport] = useState<DemoReport | null>(null);
  const [error, setError] = useState('');
  const urls = useRef(new Map<string, string>());
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const previewUrls = urls.current;
    return () => {
      timers.current.forEach(window.clearTimeout);
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const toSelected = (list: FileList | null): SelectedFile[] => {
    if (!list) return [];
    return Array.from(list).map((file, index) => {
      const id = `${Date.now()}-${index}-${file.name}`;
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      if (previewUrl) urls.current.set(id, previewUrl);
      return { id, file, previewUrl };
    });
  };

  const removeFile = (
    id: string,
    setter: React.Dispatch<React.SetStateAction<SelectedFile[]>>
  ) => {
    const url = urls.current.get(id);
    if (url) URL.revokeObjectURL(url);
    urls.current.delete(id);
    setter((items) => items.filter((item) => item.id !== id));
  };

  const hasMaterial =
    (materialMode === 'upload' && materialFiles.length > 0) ||
    (materialMode === 'search' && searchQuery.trim().length > 5) ||
    (materialMode === 'text' && materialText.trim().length > 20);
  const hasAnswer =
    (answerMode === 'upload' && answerFiles.length > 0) ||
    (answerMode === 'text' && answerText.trim().length > 20);
  const canStart = hasMaterial && hasAnswer;

  const startReview = async () => {
    timers.current.forEach(window.clearTimeout);
    setError('');
    setLiveReport(null);
    setStage('reading');
    timers.current = [window.setTimeout(() => setStage('reviewing'), 900)];
    const data = new FormData();
    data.append('kind', kind);
    data.append('material_mode', materialMode);
    data.append('answer_mode', answerMode);
    data.append('material_text', materialText);
    data.append('search_query', searchQuery);
    data.append('answer_text', answerText);
    materialFiles.forEach((item) => data.append('material_files', item.file));
    answerFiles.forEach((item) => data.append('answer_files', item.file));
    try {
      const result = await api.reviewShenlun(data);
      timers.current.forEach(window.clearTimeout);
      setLiveReport(result);
      setStage('report');
    } catch (reviewError) {
      timers.current.forEach(window.clearTimeout);
      setError(reviewError instanceof Error ? reviewError.message : '批改失败，请稍后再试');
      setStage('setup');
    }
  };

  const showExample = () => {
    timers.current.forEach(window.clearTimeout);
    setLiveReport(null);
    setError('');
    setStage('report');
  };

  const reset = () => {
    timers.current.forEach(window.clearTimeout);
    setStage('setup');
  };

  const report = liveReport ?? getDemoReport(kind);

  return (
    <>
      <header className="topbar sl-topbar">
        <button type="button" className="sl-back" onClick={onBack} aria-label="返回专属首页">←</button>
        <div>
          <div className="exclusive-kicker">专属 · 学习助手</div>
          <div className="brand">申论批改</div>
        </div>
        <span className="sl-top-seal" aria-hidden="true">审</span>
      </header>

      <main className="page sl-page">
        <section className="sl-hero">
          <div className="sl-hero-copy">
            <span>AI 阅卷工作台</span>
            <h1>先读懂材料，<br />再认真改每一笔。</h1>
            <p>大作文按袁东体系分析；小题按采分点覆盖逐条核对。</p>
          </div>
          <div className="sl-hero-note" aria-label="批改流程">
            <span>识题</span><i>→</i><span>读卷</span><i>→</i><span>批改</span>
          </div>
        </section>

        {stage === 'setup' ? (
          <div className="sl-paper">
            <section className="sl-step" aria-labelledby="sl-step-one">
              <div className="sl-step-number">01</div>
              <div className="sl-step-content">
                <div className="sl-step-heading">
                  <div>
                    <h2 id="sl-step-one">选择题型</h2>
                    <p>题型决定批改口径和报告结构。</p>
                  </div>
                </div>
                <div className="sl-kind-switch">
                  <button type="button" className={kind === 'essay' ? 'on' : ''} onClick={() => setKind('essay')}>
                    <span>大作文</span><small>35 / 40 分 · 袁东体系</small>
                  </button>
                  <button type="button" className={kind === 'small' ? 'on' : ''} onClick={() => setKind('small')}>
                    <span>小题</span><small>概括 · 分析 · 对策 · 公文</small>
                  </button>
                </div>
              </div>
            </section>

            <section className="sl-step" aria-labelledby="sl-step-two">
              <div className="sl-step-number">02</div>
              <div className="sl-step-content">
                <div className="sl-step-heading">
                  <div>
                    <h2 id="sl-step-two">提供题目与材料</h2>
                    <p>题干、分值、字数和给定资料越完整，判断越准确。</p>
                  </div>
                  <span className={hasMaterial ? 'sl-check done' : 'sl-check'}>{hasMaterial ? '已准备' : '必填'}</span>
                </div>

                <div className="sl-source-tabs" role="tablist" aria-label="材料来源">
                  {materialModes.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      role="tab"
                      aria-selected={materialMode === mode.id}
                      className={materialMode === mode.id ? 'on' : ''}
                      onClick={() => setMaterialMode(mode.id)}
                    >
                      <span aria-hidden="true">{mode.icon}</span>{mode.label}
                    </button>
                  ))}
                </div>

                {materialMode === 'upload' && (
                  <UploadBox
                    id="sl-material-files"
                    title="上传题目或材料"
                    hint="支持照片和截图，可按页序多张上传"
                    accept="image/*"
                    files={materialFiles}
                    onAdd={(files) => setMaterialFiles((items) => [...items, ...toSelected(files)])}
                    onRemove={(id) => removeFile(id, setMaterialFiles)}
                  />
                )}
                {materialMode === 'search' && (
                  <div className="sl-search-source">
                    <label htmlFor="sl-search-query">输入真题线索</label>
                    <div>
                      <input
                        id="sl-search-query"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="例如：2025 国考地市级 第三题"
                      />
                      <span>接入后由服务端联网检索</span>
                    </div>
                  </div>
                )}
                {materialMode === 'text' && (
                  <div className="sl-text-source">
                    <label htmlFor="sl-material-text">题干与材料原文</label>
                    <textarea
                      id="sl-material-text"
                      rows={7}
                      value={materialText}
                      onChange={(event) => setMaterialText(event.target.value)}
                      placeholder="粘贴题干、分值、作答要求和给定资料……"
                    />
                    <small>{materialText.trim().length} 字</small>
                  </div>
                )}
              </div>
            </section>

            <section className="sl-step" aria-labelledby="sl-step-three">
              <div className="sl-step-number">03</div>
              <div className="sl-step-content">
                <div className="sl-step-heading">
                  <div>
                    <h2 id="sl-step-three">这位准公务员同志，请上传你的答案</h2>
                    <p>可以上传手写照片，也可以直接粘贴文字内容。</p>
                  </div>
                  <span className={hasAnswer ? 'sl-check done' : 'sl-check'}>
                    {hasAnswer
                      ? answerMode === 'upload'
                        ? `${answerFiles.length} 页`
                        : `${answerText.trim().length} 字`
                      : '必填'}
                  </span>
                </div>
                <div className="sl-answer-tabs" role="tablist" aria-label="答案输入方式">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={answerMode === 'upload'}
                    className={answerMode === 'upload' ? 'on' : ''}
                    onClick={() => setAnswerMode('upload')}
                  >
                    <span aria-hidden="true">▧</span>上传图片
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={answerMode === 'text'}
                    className={answerMode === 'text' ? 'on' : ''}
                    onClick={() => setAnswerMode('text')}
                  >
                    <span aria-hidden="true">T</span>粘贴文字
                  </button>
                </div>
                {answerMode === 'upload' ? (
                  <UploadBox
                    id="sl-answer-files"
                    title="上传手写作答照片"
                    hint="iPhone 可从相册选择或直接拍摄；请避免反光和裁掉纸张边缘"
                    accept="image/*"
                    files={answerFiles}
                    onAdd={(files) => setAnswerFiles((items) => [...items, ...toSelected(files)])}
                    onRemove={(id) => removeFile(id, setAnswerFiles)}
                  />
                ) : (
                  <div className="sl-text-source sl-answer-text">
                    <label htmlFor="sl-answer-text">答案正文</label>
                    <textarea
                      id="sl-answer-text"
                      rows={9}
                      value={answerText}
                      onChange={(event) => setAnswerText(event.target.value)}
                      placeholder="把你的答案粘贴到这里。请保留原有分段，便于分析结构和表达……"
                    />
                    <small>{answerText.trim().length} 字</small>
                  </div>
                )}
              </div>
            </section>

            <div className="sl-submit-row">
              <button type="button" className="sl-example" onClick={showExample}>看示例报告</button>
              <button type="button" className="sl-submit" disabled={!canStart} onClick={startReview}>
                开始 AI 批改
              </button>
            </div>
            {error && <p className="sl-error" role="alert">{error}</p>}
            {!canStart && <p className="sl-submit-hint">准备好材料和答案后即可开始；现在也可以先看示例报告。</p>}
          </div>
        ) : stage === 'reading' || stage === 'reviewing' ? (
          <section className="sl-processing" aria-live="polite">
            <div className="sl-scan-sheet" aria-hidden="true"><span /></div>
            <div className="sl-processing-copy">
              <span>{stage === 'reading' ? '正在整理题目与作答' : '正在按评分口径逐项批改'}</span>
              <h2>{stage === 'reading' ? '先把每一页读准确' : '阅卷老师正在落笔'}</h2>
              <div className="sl-progress"><i className={stage === 'reviewing' ? 'wide' : ''} /></div>
              <p>{stage === 'reading' ? '识别题干、材料、分值、字数与手写内容' : '核对扣题、结构、采分点与表达'}</p>
            </div>
          </section>
        ) : (
          <section className="sl-report">
            <div className="sl-report-head">
              <button type="button" onClick={reset}>← 返回修改</button>
              <span>{liveReport ? 'AI 批改报告' : '演示批改报告'}</span>
            </div>
            <div className="sl-score-card">
              <div className="sl-score"><strong>{report.score}</strong><span>/ {report.maxScore}</span></div>
              <div><span>{report.title}</span><h2>{report.level}</h2><p>{report.verdict}</p></div>
              <i aria-hidden="true">阅</i>
            </div>

            <div className="sl-report-section">
              <div className="sl-report-label">做得好的地方</div>
              <ul className="sl-strengths">
                {report.strengths.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>

            <div className="sl-report-section">
              <div className="sl-report-label">优先修改这 3 处</div>
              <div className="sl-priority-list">
                {report.priorities.map((item, index) => (
                  <article key={item.title}>
                    <span>{index + 1}</span>
                    <div><h3>{item.title}</h3><p>{item.detail}</p></div>
                  </article>
                ))}
              </div>
            </div>

            <div className="sl-report-section">
              <div className="sl-report-label">一句话升级</div>
              <div className="sl-rewrite">
                <p><span>原句</span>{report.rewrite.before}</p>
                <p><span>改写</span>{report.rewrite.after}</p>
              </div>
            </div>

          </section>
        )}
      </main>
    </>
  );
}
