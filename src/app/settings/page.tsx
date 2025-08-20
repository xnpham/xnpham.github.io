'use client';
import { useEffect, useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';

type UiTheme = 'system' | 'light' | 'dark';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme(); // theme here is only light/dark
  const [uiTheme, setUiTheme] = useState<UiTheme>('system');

  // On mount, derive current selection from localStorage (if exists)
  useEffect(() => {
    const stored = localStorage.getItem('theme-mode');
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      setUiTheme(stored);
      if (stored === 'light' || stored === 'dark') setTheme(stored);
      if (stored === 'system') applySystem(setTheme);
    } else {
      // default to system
      applySystem(setTheme);
    }
    // Listen for system changes when in system mode
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => {
      if (uiTheme === 'system') applySystem(setTheme);
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applySystem(setThemeFn: (t: 'light' | 'dark') => void) {
    const sysLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    setThemeFn(sysLight ? 'light' : 'dark');
  }

  function handleChange(next: UiTheme) {
    setUiTheme(next);
    localStorage.setItem('theme-mode', next);
    if (next === 'system') {
      applySystem(setTheme);
    } else {
      setTheme(next);
    }
  }

  return (
    <section className="card space-y-4">
      <h1 className="text-2xl md:text-3xl font-semibold">Settings</h1>
      <div className="space-y-2">
        <label className="block text-sm" htmlFor="theme-select">Theme</label>
        <select
          id="theme-select"
          className="rounded-xl px-3 py-2 bg-[color:var(--card)] border border-[color:var(--border)] text-sm"
          value={uiTheme}
          onChange={(e) => handleChange(e.target.value as UiTheme)}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
        <p className="text-xs text-[color:var(--muted)]">Current applied: <span className="font-medium text-[color:var(--text)]">{theme}</span></p>
      </div>
    </section>
  );
}