"use client";
import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={toggle}
      className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-white/10 bg-black/30 hover:bg-black/40 transition text-xs font-medium"
    >
      {theme === 'dark' ? '🌙' : '☀️'}
    </button>
  );
}
