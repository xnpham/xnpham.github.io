import PomodoroTimer from '@/components/PomodoroTimer';

export const metadata = {
  title: 'Pomodoro Timer'
};

export default function PomodoroPage() {
  return (
    <section className="card space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold">Pomodoro Timer</h1>
      <p className="text-[color:var(--muted)] text-sm">Focus using the Pomodoro technique. Configure durations, play music, and stay on track.</p>
      <PomodoroTimer />
    </section>
  );
}
