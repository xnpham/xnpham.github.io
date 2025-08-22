"use client";
import React, { useEffect, useState } from 'react';
import { useActivity, ActivityProcess } from './ActivityProvider';

export default function ActivityPanel() {
  const { processes, invokeAction } = useActivity();
  const [open, setOpen] = useState(false);

  // Persist open state
  useEffect(() => {
    try {
      const raw = localStorage.getItem('activityPanelOpen');
      if (raw) setOpen(raw === '1');
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem('activityPanelOpen', open ? '1' : '0'); } catch {}
  }, [open]);

  const typeLabel = (p: ActivityProcess) => {
    if (p.type === 'pomodoro') return 'Pomodoro';
    if (p.type === 'video') return 'Media';
    if (p.type === 'generic' && p.meta && 'number' in p.meta) return 'Learning';
    return p.type;
  };

  const getNumber = (obj: unknown, key: string): number | undefined => {
    if (obj && typeof obj === 'object' && key in obj) {
      const v = (obj as Record<string, unknown>)[key];
      if (typeof v === 'number') return v;
    }
    return undefined;
  };
  const getString = (obj: unknown, key: string): string | undefined => {
    if (obj && typeof obj === 'object' && key in obj) {
      const v = (obj as Record<string, unknown>)[key];
      if (typeof v === 'string') return v;
    }
    return undefined;
  };

  return (
    <div className="">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="pointer-events-auto fixed top-20 right-4 z-50 bg-[color:var(--card)] border border-[color:var(--border)] rounded-full px-3 py-1 text-xs font-medium shadow hover:bg-white/5 transition"
        aria-expanded={open}
        aria-controls="activity-panel"
      >
        {open ? 'Close' : 'Activity'}{processes.length ? ` (${processes.length})` : ''}
      </button>
      <aside
        id="activity-panel"
        className={`pointer-events-auto fixed top-0 right-0 h-full w-80 max-w-[85vw] z-40 bg-[color:var(--card)]/95 backdrop-blur border-l border-[color:var(--border)] shadow-xl transition-transform duration-300 flex flex-col ${open ? 'translate-x-0' : 'translate-x-full'}`}
        role="complementary"
        aria-label="Current activity"
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-[color:var(--border)]">
          <h2 className="text-sm font-semibold tracking-tight">Activity</h2>
          <button onClick={() => setOpen(false)} className="text-xs opacity-70 hover:opacity-100">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
          {processes.length === 0 && (
            <div className="text-[color:var(--muted)] text-xs">No running processes.</div>
          )}
      {processes.map(p => (
            <div key={p.id} className="rounded border border-[color:var(--border)] p-3 bg-[color:var(--card)]/60">
              <div className="flex items-center justify-between mb-1">
        <div className="font-medium text-xs uppercase tracking-wide opacity-70">{typeLabel(p)}</div>
                <time className="text-[10px] opacity-50" dateTime={new Date(p.updatedAt).toISOString()}>{new Date(p.updatedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</time>
              </div>
              <div className="font-semibold text-sm truncate">{p.label}</div>
              {p.status && <div className="text-[10px] mt-1 inline-block px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-400">{p.status}</div>}
              {p.meta && p.type === 'pomodoro' && (() => {
                const secondsLeft = getNumber(p.meta, 'secondsLeft');
                const mode = getString(p.meta, 'mode');
                return (
                  <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-[color:var(--muted)]">
                    {typeof secondsLeft === 'number' && <span>Remaining: {Math.floor(secondsLeft/60)}m {secondsLeft%60}s</span>}
                    {mode && <span>Mode: {mode}</span>}
                  </div>
                );
              })()}
              {p.meta && p.type === 'video' && (() => {
                const title = getString(p.meta, 'title');
                const progress = getNumber(p.meta, 'progress');
                return (
                  <div className="mt-2 text-[10px] text-[color:var(--muted)]">
                    {title && <div className="truncate">{title}</div>}
                    {typeof progress === 'number' && (
                      <div className="h-1 rounded bg-white/10 overflow-hidden mt-1">
                        <div className="h-full bg-blue-500" style={{ width: `${progress}%` }} />
                      </div>
                    )}
                  </div>
                );
              })()}
              {p.meta && p.type === 'generic' && (() => {
                const elapsedMs = getNumber(p.meta, 'elapsedMs');
                if (typeof elapsedMs !== 'number') return null;
                const category = getString(p.meta, 'category');
                const urgency = getString(p.meta, 'urgency');
                const totalSec = Math.floor(elapsedMs / 1000);
                const h = Math.floor(totalSec / 3600).toString().padStart(2,'0');
                const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2,'0');
                const s = Math.floor(totalSec % 60).toString().padStart(2,'0');
                return (
                  <div className="mt-2 text-[10px] text-[color:var(--muted)] flex items-center gap-2">
                    <span className="font-mono">{`${h}:${m}:${s}`}</span>
                    {category && <span>{category}</span>}
                    {urgency && <span className="uppercase tracking-wide text-[color:var(--text)]/70">{urgency}</span>}
                  </div>
                );
              })()}
              {p.actions && p.actions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.actions.map(a => (
                    <button
                      key={a.id}
                      onClick={() => invokeAction(p.id, a.id)}
                      className={`text-[10px] px-2 py-1 rounded border transition bg-transparent hover:bg-white/5 ${a.kind === 'primary' ? 'border-blue-500 text-blue-400' : a.kind === 'danger' ? 'border-red-500 text-red-400' : 'border-[color:var(--border)] text-[color:var(--muted)]'}`}
                      type="button"
                    >{a.label}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
