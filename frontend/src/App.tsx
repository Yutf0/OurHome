import { useEffect, useState } from 'react';
import { api } from './api';
import Login from './pages/Login';
import Timeline from './pages/Timeline';
import Wardrobe from './pages/Wardrobe';
import Anniversaries from './pages/Anniversaries';
import Assistant from './pages/Assistant';
import ExclusivePage from './features/exclusive';
import BottomNav, { type Tab } from './components/BottomNav';

export default function App() {
  const previewMode =
    import.meta.env.DEV || import.meta.env.VITE_EXCLUSIVE_PREVIEW === 'true'
      ? new URLSearchParams(window.location.search).get('preview')
      : null;
  const exclusivePreview = previewMode === 'exclusive';
  const dailyPreview = previewMode === 'daily';
  const loginPreview = previewMode === 'login';
  const [loggedIn, setLoggedIn] = useState<boolean | null>(
    loginPreview ? false : exclusivePreview || dailyPreview ? true : null
  );
  const [tab, setTab] = useState<Tab>(exclusivePreview ? 'exclusive' : 'home');

  useEffect(() => {
    if (previewMode) return;
    api
      .me()
      .then((r) => setLoggedIn(r.loggedIn))
      .catch(() => setLoggedIn(false));
  }, [previewMode]);

  if (loggedIn === null) {
    return <div className="boot">🐰</div>;
  }
  if (!loggedIn) {
    return <Login onSuccess={() => setLoggedIn(true)} />;
  }

  return (
    <div className="app">
      {tab === 'home' && <Timeline onLogout={() => setLoggedIn(false)} preview={dailyPreview} />}
      {tab === 'wardrobe' && <Wardrobe />}
      {tab === 'days' && <Anniversaries />}
      {tab === 'ai' && <Assistant />}
      {tab === 'exclusive' && <ExclusivePage />}
      <BottomNav tab={tab} onChange={setTab} />
    </div>
  );
}
