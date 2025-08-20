"use client";
import { useCallback, useEffect, useRef, useState } from 'react';

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
      const savedTable = localStorage.getItem('learningTasksRawTable');
      if (savedTable) setRawTable(savedTable);
    } catch {}
  }, []);

  // Persist tasks + raw input
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem('learningTasks', JSON.stringify(tasks)); } catch {}
  }, [tasks]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem('learningTasksRawTable', rawTable); } catch {}
  }, [rawTable]);

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
        return { ...t, running: false, totalMs: t.totalMs + delta, startedAt: undefined };
      }
      return t;
    }));
    setActiveId(id);
  }

  function pauseTask(id: string) {
    setTasks(ts => ts.map(t => {
      if (t.id === id && t.running && t.startedAt) {
        const delta = Date.now() - t.startedAt;
        return { ...t, running: false, totalMs: t.totalMs + delta, startedAt: undefined };
      }
      return t;
    }));
    if (activeId === id) setActiveId(null);
  }

  function resetTask(id: string) {
    setTasks(ts => ts.map(t => t.id === id ? { ...t, totalMs: 0, running: false, startedAt: undefined } : t));
    if (activeId === id) setActiveId(null);
  }

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
      <div className="card space-y-4">
        <h1 className="text-2xl md:text-3xl font-semibold">Learning Helper</h1>
        <p className="text-[color:var(--muted)] text-sm">Paste or edit your markdown task table below, then Parse. Track time per task with start/pause; data persists locally.</p>
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