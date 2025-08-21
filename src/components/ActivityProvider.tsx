"use client";
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

export type ActivityAction = {
  id: string;            // unique within process
  label: string;         // button label
  run: () => void;       // execute action
  kind?: 'primary' | 'secondary' | 'danger';
};

export type ActivityProcess = {
  id: string;                // unique key
  type: 'pomodoro' | 'video' | 'generic';
  label: string;             // short label
  status?: string;           // running | paused | playing | etc
  meta?: Record<string, any>; // arbitrary extra fields (secondsLeft, mode, etc)
  actions?: ActivityAction[]; // interactive controls
  updatedAt: number;         // epoch ms
};

interface ActivityContextValue {
  processes: ActivityProcess[];
  upsertProcess: (p: ActivityProcess) => void;
  removeProcess: (id: string) => void;
  clear: () => void;
  invokeAction: (processId: string, actionId: string) => void;
  registerActionRunner: (processId: string, actionId: string, runner: () => void) => void;
}

const ActivityContext = createContext<ActivityContextValue | null>(null);

export function ActivityProvider({ children }: { children: React.ReactNode }) {
  const [processes, setProcesses] = useState<ActivityProcess[]>([]);
  // Registry so actions still callable after original component unmounts
  const actionRegistry = useRef<Record<string, Record<string, () => void>>>({});

  const upsertProcess = useCallback((p: ActivityProcess) => {
    setProcesses(prev => {
      const idx = prev.findIndex(x => x.id === p.id);
      if (idx === -1) return [...prev, p];
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...p };
      return copy;
    });
  }, []);

  const removeProcess = useCallback((id: string) => {
    setProcesses(prev => prev.filter(p => p.id !== id));
  }, []);

  const clear = useCallback(() => setProcesses([]), []);

  const registerActionRunner = useCallback((processId: string, actionId: string, runner: () => void) => {
    actionRegistry.current[processId] = actionRegistry.current[processId] || {};
    actionRegistry.current[processId][actionId] = runner;
  }, []);

  const invokeAction = useCallback((processId: string, actionId: string) => {
    const fn = actionRegistry.current[processId]?.[actionId];
    if (fn) fn();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      try {
        // Pomodoro polling snapshot
        const raw = localStorage.getItem('pomodoroSettings');
        if (raw) {
          try {
            const data = JSON.parse(raw);
            if (data && typeof data.workMinutes === 'number' && typeof data.breakMinutes === 'number') {
              const now = Date.now();
              let secondsLeft: number | null = null;
              if (data.isRunning && data.targetEpoch) {
                secondsLeft = Math.max(0, Math.round((data.targetEpoch - now) / 1000));
              } else if (!data.isRunning && typeof data.remainingSeconds === 'number') {
                secondsLeft = data.remainingSeconds;
              } else if (data.mode === 'work' || data.mode === 'break') {
                secondsLeft = (data.mode === 'work' ? data.workMinutes : data.breakMinutes) * 60;
              }
              if (secondsLeft != null) {
                upsertProcess({
                  id: 'pomodoro-main',
                  type: 'pomodoro',
                  label: 'Pomodoro Timer',
                  status: data.isRunning ? 'running' : 'paused',
                  meta: { secondsLeft, mode: data.mode },
                  actions: [
                    { id: 'toggle', label: data.isRunning ? 'Pause' : 'Resume', kind: 'primary', run: () => {} },
                    { id: 'reset', label: 'Reset', kind: 'secondary', run: () => {} }
                  ],
                  updatedAt: Date.now()
                });
                // Register / refresh action runners (idempotent)
                registerActionRunner('pomodoro-main', 'toggle', () => {
                  try {
                    const r2 = localStorage.getItem('pomodoroSettings');
                    if (!r2) return;
                    const p2 = JSON.parse(r2) || {};
                    if (p2.isRunning) {
                      // Pause: capture remaining time
                      if (p2.targetEpoch) {
                        const rem = Math.max(0, Math.round((p2.targetEpoch - Date.now()) / 1000));
                        p2.remainingSeconds = rem;
                      }
                      p2.isRunning = false;
                      p2.targetEpoch = null;
                    } else {
                      const base = p2.remainingSeconds ?? ((p2.mode === 'work' ? p2.workMinutes : p2.breakMinutes) * 60);
                      p2.isRunning = true;
                      p2.targetEpoch = Date.now() + base * 1000;
                      delete p2.remainingSeconds;
                    }
                    localStorage.setItem('pomodoroSettings', JSON.stringify(p2));
                  } catch {}
                });
                registerActionRunner('pomodoro-main', 'reset', () => {
                  try {
                    const r2 = localStorage.getItem('pomodoroSettings');
                    if (!r2) return;
                    const p2 = JSON.parse(r2) || {};
                    p2.isRunning = false;
                    p2.mode = 'work';
                    p2.targetEpoch = null;
                    p2.remainingSeconds = (p2.workMinutes || 25) * 60;
                    localStorage.setItem('pomodoroSettings', JSON.stringify(p2));
                  } catch {}
                });
              }
            }
          } catch {}
        }
        // Learning active
        const tasksRaw = localStorage.getItem('learningTasks');
        const activeId = localStorage.getItem('learningActiveId');
        if (tasksRaw && activeId) {
          const tasks = JSON.parse(tasksRaw);
          const active = Array.isArray(tasks) ? tasks.find((t: any) => t.id === activeId) : null;
          if (active && active.running) {
            const nowMs = Date.now();
            const elapsed = active.startedAt ? active.totalMs + (nowMs - active.startedAt) : active.totalMs;
            upsertProcess({
              id: 'learning-active-task',
              type: 'generic',
              label: active.name || `Task #${active.number}`,
              status: 'running',
              meta: { number: active.number, category: active.category, urgency: active.urgency, elapsedMs: elapsed },
              actions: [
                { id: 'toggle', label: 'Pause', kind: 'primary', run: () => {} },
                { id: 'reset', label: 'Reset', kind: 'secondary', run: () => {} }
              ],
              updatedAt: Date.now()
            });
            registerActionRunner('learning-active-task', 'toggle', () => {
              try {
                const rawT = localStorage.getItem('learningTasks');
                if (!rawT) return;
                const list = JSON.parse(rawT);
                if (!Array.isArray(list)) return;
                const now2 = Date.now();
                const updated = list.map((t: any) => {
                  if (t.id === activeId) {
                    if (t.running && t.startedAt) {
                      const delta = now2 - t.startedAt;
                      return { ...t, running: false, totalMs: t.totalMs + delta, startedAt: undefined };
                    } else {
                      return { ...t, running: true, startedAt: now2 };
                    }
                  }
                  if (t.running && t.startedAt) {
                    const delta = now2 - t.startedAt;
                    return { ...t, running: false, totalMs: t.totalMs + delta, startedAt: undefined };
                  }
                  return t;
                });
                localStorage.setItem('learningTasks', JSON.stringify(updated));
                if (!updated.find((t: any) => t.id === activeId && t.running)) {
                  localStorage.removeItem('learningActiveId');
                }
              } catch {}
            });
            registerActionRunner('learning-active-task', 'reset', () => {
              try {
                const rawT = localStorage.getItem('learningTasks');
                if (!rawT) return;
                const list = JSON.parse(rawT);
                if (!Array.isArray(list)) return;
                const updated = list.map((t: any) => t.id === activeId ? { ...t, totalMs: 0, running: false, startedAt: undefined } : t);
                localStorage.setItem('learningTasks', JSON.stringify(updated));
                localStorage.removeItem('learningActiveId');
              } catch {}
            });
          } else {
            // Not running or not found => remove process
            removeProcess('learning-active-task');
          }
        } else {
          // No active id => ensure removal
          removeProcess('learning-active-task');
        }
      } catch {}
    }, 1000);
    return () => clearInterval(interval);
  }, [upsertProcess, registerActionRunner, removeProcess]);
  return (
    <ActivityContext.Provider value={{ processes, upsertProcess, removeProcess, clear, invokeAction, registerActionRunner }}>
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity() {
  const ctx = useContext(ActivityContext);
  if (!ctx) throw new Error('useActivity must be used within ActivityProvider');
  return ctx;
}
