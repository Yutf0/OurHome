import PushSetup from '../components/PushSetup';

export default function Assistant() {
  return (
    <>
      <header className="topbar">
        <div className="brand">助理</div>
      </header>

      <main className="page">
        <PushSetup />

        <div className="ai-placeholder">
          <div className="ai-icon">🐱</div>
          <h2>小管家还在路上</h2>
          <p>这里以后会住着我们的 AI 小管家,计划中它会:</p>
          <div className="ai-plans">
            <div className="ai-plan">💬 回答两个人的各种问题</div>
            <div className="ai-plan">👚 看天气和衣柜,推荐今天的穿搭</div>
            <div className="ai-plan">⏰ 提前提醒快到的纪念日</div>
            <div className="ai-plan">✨ 接入专属 agent 和 skills</div>
          </div>
          <p className="ai-soon">敬请期待 ♡</p>
        </div>
      </main>
    </>
  );
}
