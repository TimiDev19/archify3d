'use client';
import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

type Theme = 'system' | 'light' | 'dark';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');
  useEffect(() => {
    const stored = localStorage.getItem('archify-theme') as Theme | null;
    const preference = stored === 'dark' || stored === 'light' ? stored : 'system';
    setTheme(preference);

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const isDark = preference === 'system' ? media.matches : preference === 'dark';
      document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    };
    apply();
    const onSystemChange = () => {
      if (preference === 'system') apply();
    };
    media.addEventListener('change', onSystemChange);
    return () => media.removeEventListener('change', onSystemChange);
  }, [theme]);

  function choose(next: Theme) {
    setTheme(next);
    if (next === 'system') localStorage.removeItem('archify-theme');
    else localStorage.setItem('archify-theme', next);
    const isDark = next === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : next === 'dark';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  }

  return (
    <div className="theme-control" role="group" aria-label="Color theme" style={{ display: 'inline-flex', alignItems: 'center', padding: 3, gap: 2, border: '1px solid var(--border)', borderRadius: 11, background: 'var(--subtle)' }}>
      {([
        ['system', Monitor, 'System'],
        ['light', Sun, 'Light'],
        ['dark', Moon, 'Dark'],
      ] as const).map(([value, Icon, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={theme === value}
          aria-label={`${label} theme`}
          title={value === 'system' ? 'Follow device appearance' : `${label} theme`}
          onClick={() => choose(value)}
          className="theme-choice"
          style={{
            minWidth: 67, padding: '7px 9px', border: 0, borderRadius: 8,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            background: theme === value ? 'var(--surface)' : 'transparent',
            color: theme === value ? 'var(--accent)' : 'var(--secondary)',
            fontSize: 12, fontWeight: 600, boxShadow: theme === value ? '0 1px 3px #0f172a1f' : 'none',
          }}
        >
          <Icon size={14} /> <span className="theme-label">{label}</span>
        </button>
      ))}
    </div>
  );
}
