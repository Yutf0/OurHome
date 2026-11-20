import { useState } from 'react';
import { exclusiveFeatures, type ExclusiveFeatureId } from './registry';
import ShenlunModule from './shenlun/ShenlunModule';

export default function ExclusivePage() {
  const [activeFeature, setActiveFeature] = useState<ExclusiveFeatureId | null>(null);

  if (activeFeature === 'shenlun') {
    return <ShenlunModule onBack={() => setActiveFeature(null)} />;
  }

  return (
    <>
      <header className="topbar">
        <div>
          <div className="exclusive-kicker">FOR YOU</div>
          <div className="brand">专属</div>
        </div>
      </header>

      <main className="page exclusive-page">
        <section className="exclusive-intro" aria-labelledby="exclusive-title">
          <span className="exclusive-intro-mark" aria-hidden="true">♡</span>
          <div>
            <p className="exclusive-intro-label">你需要的，都慢慢放进来</p>
            <h1 id="exclusive-title">一个可以不断长大的专属空间</h1>
            <p>每项能力独立收纳，方便以后增加、升级或单独迁移。</p>
          </div>
        </section>

        <section className="exclusive-grid" aria-label="专属功能">
          {exclusiveFeatures.map((feature) => (
            <button
              key={feature.id}
              type="button"
              className="exclusive-feature-card"
              onClick={() => setActiveFeature(feature.id)}
            >
              <span className="exclusive-feature-icon" aria-hidden="true">{feature.icon}</span>
              <span className="exclusive-feature-copy">
                <span className="exclusive-feature-eyebrow">{feature.eyebrow}</span>
                <strong>{feature.title}</strong>
                <span>{feature.description}</span>
              </span>
              <span className="exclusive-feature-side">
                <small>{feature.status}</small>
                <span aria-hidden="true">→</span>
              </span>
            </button>
          ))}

          <div className="exclusive-future-card">
            <span aria-hidden="true">＋</span>
            <div>
              <strong>下一个专属功能</strong>
              <p>以后新增的工具会在这里拥有独立入口。</p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
