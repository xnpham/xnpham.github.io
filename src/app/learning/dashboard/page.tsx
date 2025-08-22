"use client";
import { useEffect, useMemo, useState } from 'react';

interface Session { id: string; taskId: string; taskName: string; category?: string; start: number; end: number; durationMs: number; }
interface CategoryGoal { category: string; weeklyMinutes: number; }

function loadSessions(): Session[] { if (typeof window === 'undefined') return []; try { const raw = localStorage.getItem('learningSessions'); return raw ? JSON.parse(raw) : []; } catch { return []; } }
function loadGoals(): CategoryGoal[] { if (typeof window === 'undefined') return []; try { const raw = localStorage.getItem('learningCategoryGoals'); return raw ? JSON.parse(raw) : []; } catch { return []; } }
function saveGoals(goals: CategoryGoal[]) { if (typeof window === 'undefined') return; try { localStorage.setItem('learningCategoryGoals', JSON.stringify(goals)); } catch {} }

function startOfWeek(d = new Date()) { const date = new Date(d); const day = date.getDay(); const diff = date.getDate() - day + (day===0?1:1); // Monday start
  const monday = new Date(date.setDate(diff)); monday.setHours(0,0,0,0); return monday; }

export default function LearningDashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [goals, setGoals] = useState<CategoryGoal[]>([]);
  const [newCat, setNewCat] = useState('');
  const [newGoal, setNewGoal] = useState(0);

  useEffect(()=>{ setSessions(loadSessions()); setGoals(loadGoals()); }, []);
  useEffect(()=>{ saveGoals(goals); }, [goals]);

  const weekStart = startOfWeek();
    const { weekEnd, weekSessions } = useMemo(() => {
      const end = new Date(weekStart.getTime() + 7*86400000);
      return { weekEnd: end, weekSessions: sessions.filter(s => s.start >= weekStart.getTime() && s.start < end.getTime()) };
    }, [sessions, weekStart]);

  const byCategory = useMemo(()=>{
    const m: Record<string, number> = {};
  weekSessions.forEach(s => { const c = s.category || 'Uncategorized'; m[c] = (m[c] || 0) + s.durationMs; });
    return m;
  }, [weekSessions]);

  const topTasks = useMemo(()=>{
    const aggregate: Record<string, { name: string; ms: number; category?: string; }> = {};
  weekSessions.forEach(s => { aggregate[s.taskId] = aggregate[s.taskId] || { name: s.taskName, ms: 0, category: s.category }; aggregate[s.taskId].ms += s.durationMs; });
    return Object.entries(aggregate).map(([id, v]) => ({ id, ...v })).sort((a,b)=> b.ms - a.ms).slice(0,10);
  }, [weekSessions]);

  const goalMap = useMemo(()=> Object.fromEntries(goals.map(g => [g.category, g.weeklyMinutes])), [goals]);

  const totalWeekMs = weekSessions.reduce((a,s)=>a+s.durationMs,0);

  function addGoal() { if (!newCat) return; setGoals(gs => gs.some(g=>g.category===newCat)? gs.map(g=> g.category===newCat? {...g, weeklyMinutes:newGoal}:g): [...gs,{category:newCat, weeklyMinutes:newGoal}]); setNewCat(''); setNewGoal(0); }
  function removeGoal(cat: string) { setGoals(gs=>gs.filter(g=>g.category!==cat)); }

  return (
    <section className="space-y-8">
      <div className="card p-4 space-y-4">
        <h1 className="text-2xl font-semibold">Weekly Dashboard</h1>
        <p className="text-sm text-[color:var(--muted)]">Week of {weekStart.toISOString().slice(0,10)}</p>
        <div className="text-sm flex flex-wrap gap-6">
          <div><span className="font-semibold">Total Focus:</span> {(totalWeekMs/3600000).toFixed(1)}h</div>
          <div><span className="font-semibold">Sessions:</span> {weekSessions.length}</div>
        </div>
      </div>

      <div className="card p-4 space-y-4">
        <h2 className="text-lg font-semibold">Category Progress</h2>
        <div className="space-y-3">
          {Object.entries(byCategory).sort((a,b)=> b[1]-a[1]).map(([cat, ms]) => {
            const goalMin = goalMap[cat] || 0; const goalMs = goalMin*60000; const pct = goalMs? Math.min(100, (ms/goalMs)*100): 0;
            return (
              <div key={cat} className="space-y-1">
                <div className="flex justify-between text-xs uppercase tracking-wide"><span>{cat}</span><span>{(ms/3600000).toFixed(2)}h {goalMin? `/ ${goalMin}m` : ''}</span></div>
                <div className="w-full h-2 rounded bg-black/30 overflow-hidden">
                  <div className={`h-full transition-all ${pct>=100? 'bg-green-600':'bg-blue-600'}`} style={{ width: goalMs? pct+'%':'0%' }} />
                </div>
              </div>
            );
          })}
          {Object.keys(byCategory).length===0 && <p className="text-xs text-[color:var(--muted)]">No sessions this week.</p>}
        </div>
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-semibold">Set / Update Goals</h3>
          <div className="flex flex-wrap gap-2 items-center">
            <input value={newCat} onChange={e=>setNewCat(e.target.value)} placeholder="Category" className="px-2 py-1 text-sm rounded border border-[color:var(--border)] bg-transparent" />
            <input type="number" min={0} value={newGoal} onChange={e=>setNewGoal(Number(e.target.value))} placeholder="Minutes" className="w-24 px-2 py-1 text-sm rounded border border-[color:var(--border)] bg-transparent" />
            <button onClick={addGoal} className="px-3 py-1 text-xs rounded border border-[color:var(--border)] bg-white/5 hover:bg-white/10">Save</button>
          </div>
          <ul className="text-xs space-y-1">
            {goals.map(g => (
              <li key={g.category} className="flex items-center gap-2">
                <span className="font-mono">{g.category}</span>
                <span className="opacity-70">{g.weeklyMinutes}m</span>
                <button onClick={()=>removeGoal(g.category)} className="px-2 py-0.5 text-[10px] rounded border border-[color:var(--border)] hover:bg-white/10">Remove</button>
              </li>
            ))}
            {goals.length===0 && <li className="opacity-60">No goals yet.</li>}
          </ul>
        </div>
      </div>

      <div className="card p-4 space-y-4">
        <h2 className="text-lg font-semibold">Top Tasks (This Week)</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-[color:var(--border)] text-xs uppercase tracking-wide">
              <th className="py-1 pr-2">Task</th>
              <th className="py-1 pr-2">Cat</th>
              <th className="py-1 pr-2">Time (h)</th>
            </tr>
          </thead>
          <tbody>
            {topTasks.map(t => (
              <tr key={t.id} className="border-b border-[color:var(--border)]">
                <td className="py-1 pr-2 max-w-[220px] truncate" title={t.name}>{t.name}</td>
                <td className="py-1 pr-2 text-[color:var(--muted)]">{t.category || ''}</td>
                <td className="py-1 pr-2 tabular-nums">{(t.ms/3600000).toFixed(2)}</td>
              </tr>
            ))}
            {topTasks.length===0 && <tr><td colSpan={3} className="py-2 text-xs text-[color:var(--muted)]">No data yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card p-4 space-y-4">
        <h2 className="text-lg font-semibold">Weekly Category Bars</h2>
        <div className="flex flex-wrap gap-4">
          {Object.entries(byCategory).map(([cat, ms]) => {
            const hours = ms/3600000; const goalMin = goalMap[cat]||0; const goalMs = goalMin*60000; const pct = goalMs? Math.min(100,(ms/goalMs)*100):0;
            return (
              <div key={cat} className="flex flex-col items-center w-24">
                <div className="h-40 w-8 bg-black/30 rounded flex flex-col justify-end overflow-hidden">
                  <div className={`${pct>=100? 'bg-green-600':'bg-blue-600'}`} style={{ height: goalMs? pct+'%':'0%', width:'100%' }} />
                </div>
                <div className="mt-2 text-[10px] text-center leading-tight">
                  <div className="font-medium truncate w-24">{cat}</div>
                  <div className="tabular-nums">{hours.toFixed(1)}h</div>
                </div>
              </div>
            );
          })}
          {Object.keys(byCategory).length===0 && <p className="text-xs text-[color:var(--muted)]">No categories yet.</p>}
        </div>
      </div>
    </section>
  );
}
