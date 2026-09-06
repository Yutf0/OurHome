import { useEffect, useState } from 'react';
import { api } from './api';
import Login from './pages/Login';
import Timeline from './pages/Timeline';
import Wardrobe from './pages/Wardrobe';
import Anniversaries from './pages/Anniversaries';
import Assistant from './pages/Assistant';
import BottomNav, { type Tab } from './components/BottomNav';

export default function App() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('home');

  useEffect(() => {
    api
      .me()
      .then((r) => setLoggedIn(r.loggedIn))
      .catch(() => setLoggedIn(false));
  }, []);

  if (loggedIn === null) {
    return <div className="boot">🐰</div>;
  }
  if (!loggedIn) {
    return <Login onSuccess={() => setLoggedIn(true)} />;
  }

  return (
    <div className="app">
      {tab === 'home' && <Timeline onLogout={() => setLoggedIn(false)} />}
      {tab === 'wardrobe' && <Wardrobe />}
      {tab === 'days' && <Anniversaries />}
      {tab === 'ai' && <Assistant />}
      <BottomNav tab={tab} onChange={setTab} />
    </div>
  );
}
