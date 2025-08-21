"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useActivity } from '@/components/ActivityProvider';

type Task = {
  id: string;
  number: number;
  name: string;
  category?: string;
  urgency?: string;
  links?: string;
  totalMs: number; // accumulated active time
  running: boolean;
  startedAt?: number; // epoch ms when current run began
};

type Session = {
  id: string;
  taskId: string;
  taskName: string;
  category?: string;
  start: number; // epoch ms
  end: number;   // epoch ms
  durationMs: number;
};

type DailyAdjustments = Record<string, number>; // date (YYYY-MM-DD) -> adjustmentMs (can be negative)

function loadSessions(): Session[] {
  if (typeof window === 'undefined') return [];
  try { const raw = localStorage.getItem('learningSessions'); if (!raw) return []; return JSON.parse(raw); } catch { return []; }
}
function saveSessions(list: Session[]) {
  if (typeof window === 'undefined') return; try { localStorage.setItem('learningSessions', JSON.stringify(list)); } catch {}
}
function addSession(s: Session) { const list = loadSessions(); list.push(s); saveSessions(list); }

function startOfDay(ts: number) { const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime(); }
function isSameDay(a: number, b: number) { return startOfDay(a) === startOfDay(b); }
function todayKey() { return new Date().toISOString().slice(0,10); }

function computeDailyTotalMs(sessions: Session[], dayTs: number) {
  return sessions.filter(s => isSameDay(s.start, dayTs)).reduce((acc, s) => acc + s.durationMs, 0);
}
function computeStreak(sessions: Session[], dailyGoalMin: number, adjustments: DailyAdjustments) {
  const goalMs = dailyGoalMin * 60 * 1000;
  let streak = 0;
  const ONE_DAY = 86400000;
  let cursor = startOfDay(Date.now());
  while (true) {
    const dayTotal = computeDailyTotalMs(sessions, cursor);
    const dayKey = new Date(cursor).toISOString().slice(0,10);
    const adj = adjustments[dayKey] || 0;
    const total = dayTotal + adj;
    if (total >= goalMs && goalMs > 0) { streak++; cursor -= ONE_DAY; } else break;
  }
  return streak;
}

function formatDuration(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSec % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export default function LearningPage() {
  const [rawTable, setRawTable] = useState(`| No. | Task name | Cat | Urgency | Links | Duration |\n| --- | --------- | --- | ------- | ----- | -------- |\n| 1   |           |     |         |       |          |\n| 2   |           |     |         |       |          |\n| 3   |           |     |         |       |          |\n| 4   |           |     |         |       |          |`);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const [loaded, setLoaded] = useState(false); // indicates initial localStorage load complete
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState<number>(120);
  const [dailyTotalMs, setDailyTotalMs] = useState(0);
  const [streak, setStreak] = useState(0);
  const [adjustments, setAdjustments] = useState<DailyAdjustments>({});
  const today = todayKey();
  const todayAdjustmentMs = adjustments[today] || 0;
  const [tempAdjustmentMin, setTempAdjustmentMin] = useState<number>(0); // input buffer
  const { upsertProcess, removeProcess, registerActionRunner } = useActivity();
  const [showTodayBreakdown, setShowTodayBreakdown] = useState(false);
  const activityProcessId = 'learning-active-task';

  // Load persisted state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('learningTasks');
      if (saved) {
        const parsed: Task[] = JSON.parse(saved);
        setTasks(parsed);
        const running = parsed.find(t => t.running);
        if (running) setActiveId(running.id);
      }
  const savedActive = localStorage.getItem('learningActiveId');
  if (savedActive) setActiveId(savedActive);
      const savedTable = localStorage.getItem('learningTasksRawTable');
      if (savedTable) setRawTable(savedTable);
  const goalRaw = localStorage.getItem('learningDailyGoalMinutes');
  if (goalRaw) setDailyGoalMinutes(Number(goalRaw) || 0);
  const adjRaw = localStorage.getItem('learningDailyAdjustments');
  if (adjRaw) { try { setAdjustments(JSON.parse(adjRaw)); } catch {} }
  setLoaded(true);
    } catch {}
  }, []);

  // Persist tasks + raw input (skip until initial load to avoid overwriting saved data)
  useEffect(() => {
    if (!loaded || typeof window === 'undefined') return;
    try { localStorage.setItem('learningTasks', JSON.stringify(tasks)); } catch {}
  }, [tasks, loaded]);
  useEffect(() => {
    if (!loaded || typeof window === 'undefined') return;
    try { localStorage.setItem('learningTasksRawTable', rawTable); } catch {}
  }, [rawTable, loaded]);

  // Persist goal
  useEffect(() => { if (!loaded) return; try { localStorage.setItem('learningDailyGoalMinutes', String(dailyGoalMinutes)); } catch {} }, [dailyGoalMinutes, loaded]);
  // Persist adjustments
  useEffect(() => { if (!loaded) return; try { localStorage.setItem('learningDailyAdjustments', JSON.stringify(adjustments)); } catch {} }, [adjustments, loaded]);

  // Recompute metrics when sessions or goal change
  const recomputeMetrics = useCallback(() => {
    const sessions = loadSessions();
    const nowTs = Date.now();
    let base = computeDailyTotalMs(sessions, nowTs);
    const active = tasks.find(t => t.running && t.startedAt);
    if (active && active.startedAt && isSameDay(active.startedAt, nowTs)) {
      base += nowTs - active.startedAt;
    }
    const adjMs = adjustments[today] || 0;
    setDailyTotalMs(base + adjMs);
    setStreak(computeStreak(sessions, dailyGoalMinutes, adjustments));
  }, [dailyGoalMinutes, adjustments, today, tasks]);

  useEffect(() => { if (loaded) recomputeMetrics(); }, [loaded, tasks, dailyGoalMinutes, recomputeMetrics]);

  // Cross-tab sync via storage events
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: StorageEvent) => {
      if (e.key === 'learningTasks' && e.newValue) {
        try { const parsed: Task[] = JSON.parse(e.newValue); setTasks(parsed); } catch {}
      } else if (e.key === 'learningTasksRawTable' && e.newValue) {
        setRawTable(e.newValue);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const parseTable = useCallback(() => {
    const lines = rawTable.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    // Expect header, separator, rows...
    const rowLines = lines.slice(2); // skip header + separator
    const newTasks: Task[] = [];
    rowLines.forEach(line => {
      if (!line.startsWith('|')) return;
      const cols = line.split('|').map(c => c.trim());
      // cols: [ '', '1', 'Task name', 'Cat', 'Urgency', 'Links', 'Duration', '' ]
      if (cols.length < 7) return;
      const numStr = cols[1];
      const number = parseInt(numStr, 10);
      if (!number) return;
      const name = cols[2] || '';
      const category = cols[3] || '';
      const urgency = cols[4] || '';
      const links = cols[5] || '';
      // Duration column ignored on import (freshly derived from tracking)
      // If existing task with same number keep its accumulated time.
      const existing = tasks.find(t => t.number === number);
      newTasks.push({
        id: existing?.id || crypto.randomUUID(),
        number,
        name,
        category,
        urgency,
        links,
        totalMs: existing ? existing.totalMs : 0,
        running: existing ? existing.running : false,
        startedAt: existing?.startedAt,
      });
    });
    // Stop any tasks not present anymore
    setTasks(newTasks);
    // Adjust active id
    if (!newTasks.some(t => t.id === activeId)) setActiveId(null);
  }, [rawTable, tasks, activeId]);

  // Live updating of running task's displayed duration
  useEffect(() => {
    const tick = () => {
      setTasks(ts => ts.map(t => {
        if (!t.running || !t.startedAt) return t;
        return { ...t }; // trigger re-render; displayed duration computed on the fly
      }));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  function startTask(id: string) {
    setTasks(ts => ts.map(t => {
      if (t.id === id) {
        if (t.running) return t; // already running
        return { ...t, running: true, startedAt: Date.now() };
      }
      // pause others
      if (t.running && t.startedAt) {
        const delta = Date.now() - t.startedAt;
    // log session for previous running task
    addSession({ id: crypto.randomUUID(), taskId: t.id, taskName: t.name, category: t.category, start: t.startedAt, end: Date.now(), durationMs: delta });
        return { ...t, running: false, totalMs: t.totalMs + delta, startedAt: undefined };
      }
      return t;
    }));
    setActiveId(id);
  try { localStorage.setItem('learningActiveId', id); } catch {}
  setTimeout(recomputeMetrics, 0);
  }

  function pauseTask(id: string) {
    setTasks(ts => ts.map(t => {
      if (t.id === id && t.running && t.startedAt) {
        const delta = Date.now() - t.startedAt;
    addSession({ id: crypto.randomUUID(), taskId: t.id, taskName: t.name, category: t.category, start: t.startedAt, end: Date.now(), durationMs: delta });
        return { ...t, running: false, totalMs: t.totalMs + delta, startedAt: undefined };
      }
      return t;
    }));
    if (activeId === id) setActiveId(null);
  try { localStorage.removeItem('learningActiveId'); } catch {}
  setTimeout(recomputeMetrics, 0);
  }

  function resetTask(id: string) {
    setTasks(ts => ts.map(t => {
      if (t.id === id) {
        if (t.running && t.startedAt) {
          const delta = Date.now() - t.startedAt;
          addSession({ id: crypto.randomUUID(), taskId: t.id, taskName: t.name, category: t.category, start: t.startedAt, end: Date.now(), durationMs: delta });
        }
        return { ...t, totalMs: 0, running: false, startedAt: undefined };
      }
      return t;
    }));
    if (activeId === id) setActiveId(null);
    try { localStorage.removeItem('learningActiveId'); } catch {}
    setTimeout(recomputeMetrics, 0);
  }

  function applyTodayAdjustment() {
    setAdjustments(prev => ({ ...prev, [today]: tempAdjustmentMin * 60000 }));
    // Recompute after state updates flush
    setTimeout(recomputeMetrics, 0);
  }

  function clearTodayAdjustment() {
    setAdjustments(prev => { const copy = { ...prev }; delete copy[today]; return copy; });
    setTempAdjustmentMin(0);
    setTimeout(recomputeMetrics, 0);
  }

  // Removed zeroToday in favor of a unified full reset (resetAllDurations) triggered from the Quick button.

  function resetAllDurations() {
    // Stop any running task without logging a session (intentional full reset)
    setTasks(ts => ts.map(t => ({ ...t, running: false, startedAt: undefined, totalMs: 0 })));
    setActiveId(null);
    try { localStorage.removeItem('learningActiveId'); } catch {}
    // Clear all stored sessions so daily metrics also reset to 0 (unless adjustments applied)
    try { localStorage.setItem('learningSessions', '[]'); } catch {}
    setTimeout(recomputeMetrics, 0);
  }

  const todayTaskBreakdown = useCallback(() => {
    const sessions = loadSessions();
    const map: Record<string, number> = {};
    const todaySessions = sessions.filter(s => isSameDay(s.start, Date.now()));
    todaySessions.forEach(s => { map[s.taskId] = (map[s.taskId] || 0) + s.durationMs; });
    tasks.forEach(t => {
      if (t.running && t.startedAt && isSameDay(t.startedAt, Date.now())) {
        map[t.id] = (map[t.id] || 0) + (Date.now() - t.startedAt);
      }
    });
    return Object.entries(map).map(([taskId, ms]) => {
      const task = tasks.find(t => t.id === taskId);
      return { id: taskId, name: task?.name || task?.number?.toString() || 'Task', ms };
    }).sort((a,b) => b.ms - a.ms);
  }, [tasks]);

  // Persist activeId changes
  useEffect(() => {
    if (!loaded) return;
    if (activeId) {
      try { localStorage.setItem('learningActiveId', activeId); } catch {}
    } else {
      try { localStorage.removeItem('learningActiveId'); } catch {}
    }
  }, [activeId, loaded]);

  // Publish active task to Activity panel
  useEffect(() => {
    const active = tasks.find(t => t.id === activeId);
    if (active) {
      const elapsed = active.running && active.startedAt ? active.totalMs + (Date.now() - active.startedAt) : active.totalMs;
      upsertProcess({
        id: activityProcessId,
        type: 'generic',
        label: active.name || `Task #${active.number}`,
        status: active.running ? 'running' : 'paused',
        meta: {
          number: active.number,
          category: active.category,
          urgency: active.urgency,
          elapsedMs: elapsed
        },
        actions: [
          {
            id: 'toggle',
            label: active.running ? 'Pause' : 'Resume',
            kind: 'primary',
            run: () => active.running ? pauseTask(active.id) : startTask(active.id)
          },
          {
            id: 'reset',
            label: 'Reset',
            kind: 'secondary',
            run: () => resetTask(active.id)
          }
        ],
        updatedAt: Date.now()
      });
    // Register current runners
    registerActionRunner(activityProcessId, 'toggle', () => active.running ? pauseTask(active.id) : startTask(active.id));
    registerActionRunner(activityProcessId, 'reset', () => resetTask(active.id));
    } else {
      removeProcess(activityProcessId);
    }
  }, [tasks, activeId, upsertProcess, removeProcess, registerActionRunner]);

  // Periodically refresh activity process timestamp & elapsed while running
  useEffect(() => {
    const interval = setInterval(() => {
      const active = tasks.find(t => t.id === activeId);
      if (!active) return;
      const elapsed = active.running && active.startedAt ? active.totalMs + (Date.now() - active.startedAt) : active.totalMs;
      upsertProcess({
        id: activityProcessId,
        type: 'generic',
        label: active.name || `Task #${active.number}`,
        status: active.running ? 'running' : 'paused',
        meta: { number: active.number, category: active.category, urgency: active.urgency, elapsedMs: elapsed },
        updatedAt: Date.now()
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [tasks, activeId, upsertProcess]);

  function exportTable() {
    const header = '| No. | Task name | Cat | Urgency | Links | Duration |';
    const sep = '| --- | --------- | --- | ------- | ----- | -------- |';
    const rows = tasks
      .sort((a,b) => a.number - b.number)
      .map(t => {
        const elapsed = t.running && t.startedAt ? t.totalMs + (Date.now() - t.startedAt) : t.totalMs;
        return `| ${t.number} | ${t.name} | ${t.category || ''} | ${t.urgency || ''} | ${t.links || ''} | ${formatDuration(elapsed)} |`;
      });
    setRawTable([header, sep, ...rows].join('\n'));
  }

  return (
    <section className="space-y-6">
      <div className="card p-4 space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-3">Daily Focus
          <span className="text-sm font-normal text-[color:var(--muted)]">Goal {dailyGoalMinutes}m</span>
        </h2>
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <div className="text-3xl font-bold tabular-nums">{Math.round(dailyTotalMs/60000)}m</div>
            <div className="text-xs uppercase tracking-wide text-[color:var(--muted)]">Today</div>
          </div>
          <div>
            <div className="text-3xl font-bold tabular-nums">{streak}</div>
            <div className="text-xs uppercase tracking-wide text-[color:var(--muted)]">Streak</div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wide text-[color:var(--muted)]">Daily Goal (min)</label>
            <input type="number" min={0} className="w-24 rounded border border-[color:var(--border)] bg-transparent px-2 py-1 text-sm"
              value={dailyGoalMinutes} onChange={e=>setDailyGoalMinutes(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wide text-[color:var(--muted)]">Adjustment (min)</label>
            <div className="flex gap-2 items-center">
              <input type="number" className="w-24 rounded border border-[color:var(--border)] bg-transparent px-2 py-1 text-sm" value={tempAdjustmentMin} onChange={e=>setTempAdjustmentMin(Number(e.target.value))} />
              <button type="button" onClick={applyTodayAdjustment} className="px-2 py-1 text-[10px] rounded border border-[color:var(--border)] bg-white/5 hover:bg-white/10">Apply</button>
              {todayAdjustmentMs !== 0 && <button type="button" onClick={clearTodayAdjustment} className="px-2 py-1 text-[10px] rounded border border-[color:var(--border)] bg-white/5 hover:bg-white/10">Clear</button>}
            </div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="w-full h-2 rounded bg-black/30 overflow-hidden">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${Math.min(100, (dailyTotalMs/60000)/ (dailyGoalMinutes||1) * 100)}%` }} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wide text-[color:var(--muted)]">Quick</label>
            <button type="button" onClick={resetAllDurations} className="px-2 py-1 text-[10px] rounded border border-[color:var(--border)] bg-white/5 hover:bg-white/10">Reset All Durations</button>
          </div>
        </div>
      </div>
      <div className="card space-y-4">
        <h1 className="text-2xl md:text-3xl font-semibold">Learning Helper</h1>
        <p className="text-[color:var(--muted)] text-sm">Paste or edit your markdown task table below, then Parse. Track time per task with start/pause; data persists locally.</p>
        <div className="flex flex-wrap gap-2">
          <a href="/learning/dashboard" className="px-3 py-1 text-xs rounded border border-[color:var(--border)] bg-white/5 hover:bg-white/10">Open Dashboard →</a>
        </div>
        <textarea
          className="w-full min-h-40 text-sm font-mono rounded border border-[color:var(--border)] bg-[color:var(--surface)] p-2 resize-y"
          value={rawTable}
          onChange={e => setRawTable(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={parseTable} className="px-3 py-1 text-xs rounded border border-[color:var(--border)] bg-white/5 hover:bg-white/10">Parse</button>
          <button type="button" onClick={exportTable} className="px-3 py-1 text-xs rounded border border-[color:var(--border)] bg-white/5 hover:bg-white/10">Export Durations → Table</button>
        </div>
      </div>
      <p className="text-[10px] leading-relaxed text-[color:var(--muted)] mt-1">
        Daily total includes completed sessions plus currently running task time (only if started today). Table durations are cumulative overall, so sums can differ. <button type="button" onClick={() => setShowTodayBreakdown(s=>!s)} className="underline hover:no-underline">{showTodayBreakdown? 'Hide':'Show'} breakdown</button>
      </p>
      {showTodayBreakdown && (
        <div className="mt-2 rounded border border-[color:var(--border)] p-2 bg-white/5 max-w-xl">
          <div className="text-[10px] uppercase tracking-wide mb-1 opacity-70">Today Task Breakdown</div>
          <ul className="space-y-0.5 text-xs">
            {todayTaskBreakdown().map(r => (
              <li key={r.id} className="flex justify-between tabular-nums"><span className="truncate max-w-[160px]" title={r.name}>{r.name}</span><span>{formatDuration(r.ms)}</span></li>
            ))}
            {todayTaskBreakdown().length === 0 && <li className="opacity-60">No focus yet today.</li>}
          </ul>
        </div>
      )}
      <div className="card space-y-4">
        <h2 className="text-xl font-semibold">Tasks</h2>
        {tasks.length === 0 && <p className="text-sm text-[color:var(--muted)]">No tasks parsed yet.</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-[color:var(--border)]">
                <th className="py-1 pr-2">#</th>
                <th className="py-1 pr-2">Task</th>
                <th className="py-1 pr-2">Cat</th>
                <th className="py-1 pr-2">Urgency</th>
                <th className="py-1 pr-2">Links</th>
                <th className="py-1 pr-2">Duration</th>
                <th className="py-1 pr-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.sort((a,b) => a.number - b.number).map(t => {
                const elapsed = t.running && t.startedAt ? t.totalMs + (Date.now() - t.startedAt) : t.totalMs;
                return (
                  <tr key={t.id} className={`border-b border-[color:var(--border)] ${t.running ? 'bg-blue-500/10' : ''}`}>
                    <td className="py-1 pr-2 tabular-nums w-10">{t.number}</td>
                    <td className="py-1 pr-2 max-w-[200px] truncate" title={t.name}>{t.name || <span className="opacity-50">(untitled)</span>}</td>
                    <td className="py-1 pr-2 text-[color:var(--muted)]">{t.category}</td>
                    <td className="py-1 pr-2 text-[color:var(--muted)]">{t.urgency}</td>
                    <td className="py-1 pr-2 text-[color:var(--muted)] max-w-[160px] truncate" title={t.links}>{t.links}</td>
                    <td className="py-1 pr-2 font-mono text-xs tabular-nums">{formatDuration(elapsed)}</td>
                    <td className="py-1 pr-2 space-x-1 whitespace-nowrap">
                      {!t.running && <button onClick={() => startTask(t.id)} className="px-2 py-0.5 text-[10px] rounded border border-[color:var(--border)] hover:bg-white/10">Start</button>}
                      {t.running && <button onClick={() => pauseTask(t.id)} className="px-2 py-0.5 text-[10px] rounded border border-[color:var(--border)] hover:bg-white/10">Pause</button>}
                      <button onClick={() => resetTask(t.id)} className="px-2 py-0.5 text-[10px] rounded border border-[color:var(--border)] hover:bg-white/10">Reset</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}