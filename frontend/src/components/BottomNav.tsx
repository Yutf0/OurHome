export type Tab = 'home' | 'wardrobe' | 'days' | 'ai' | 'exclusive';

const TABS: Array<{ key: Tab; label: string; icon: string }> = [
  { key: 'home', label: '日常', icon: '🐰' },
  { key: 'wardrobe', label: '衣柜', icon: '🧸' },
  { key: 'days', label: '纪念日', icon: '🍓' },
  { key: 'ai', label: '助理', icon: '🐱' },
  { key: 'exclusive', label: '专属', icon: '🌷' },
];

interface Props {
  tab: Tab;
  onChange: (t: Tab) => void;
}

export default function BottomNav({ tab, onChange }: Props) {
  return (
    <nav className="bottomnav">
      {TABS.map((t) => (
        <button
          key={t.key}
          className={`tabbtn ${tab === t.key ? 'on' : ''}`}
          onClick={() => onChange(t.key)}
        >
          <span className="ico">{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
