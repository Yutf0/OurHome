import { useState } from 'react';
import PushSetup from '../components/PushSetup';
import { getIdentityOr, setIdentity, syncPushOwner, IDENTITY_LABEL } from '../identity';
import type { Author } from '../types';

export default function Assistant() {
  const [owner, setOwner] = useState<Author>(() => getIdentityOr('me'));

  // 切换身份:落地本地 + 让推送 owner 跟随(若已订阅)
  const choose = (a: Author) => {
    setOwner(a);
    setIdentity(a);
    void syncPushOwner(a);
  };

  return (
    <>
      <header className="topbar">
        <div className="brand">助理</div>
      </header>

      <main className="page">
        {/* 我是谁:统一身份,发布日常与推送都用它 */}
        <div className="card">
          <h3 className="card-title">🙋 我是谁</h3>
          <p className="push-tip">
            选好这台手机的身份后,发布日常会<b>自动以该身份署名</b>,
            不用每次再选;推送也只会把对方的新记录推给你。
          </p>
          <div className="who" style={{ marginTop: 12, marginBottom: 4 }}>
            <button className={owner === 'me' ? 'on' : ''} onClick={() => choose('me')}>
              {IDENTITY_LABEL.me}
            </button>
            <button className={owner === 'her' ? 'on' : ''} onClick={() => choose('her')}>
              {IDENTITY_LABEL.her}
            </button>
          </div>
        </div>

        <PushSetup owner={owner} />

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
