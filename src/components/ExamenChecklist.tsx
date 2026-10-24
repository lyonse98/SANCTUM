import { useState, useEffect, useCallback, useMemo } from 'react';
import { Moon, Check, RotateCcw, Flame, BookOpen } from 'lucide-react';
import type { PersonaTheme } from '@/types';
import { DAILY_QUOTES } from '@/data/quotes';
import { getExamenStreak, recordExamenComplete } from '@/lib/retention';

interface ExamenChecklistProps {
  t: PersonaTheme;
}

const EXAMEN_STEPS = [
  { id: 'gratitude', label: 'Gratitude', prompt: 'Name one gift from today — however small. A meal. A moment. A person.' },
  { id: 'gospel', label: 'Today\'s Gospel', prompt: 'Read the Gospel above. Where did it meet your day? What moment from today does it illuminate?' },
  { id: 'awareness', label: 'Awareness', prompt: 'Where did you feel God\'s presence today? In what moment were you most alive, most yourself?' },
  { id: 'shadow', label: 'Shadow & Friction', prompt: 'Where did things go wrong? What moment brought shame, anger, or friction? Be honest — no excuses.' },
  { id: 'contrition', label: 'Contrition', prompt: 'Own the one thing you did wrong. Name it plainly. Ask the Father for mercy. Not a feeling — a decision.' },
  { id: 'resolve', label: 'Resolve', prompt: 'What is one concrete step for tomorrow? Not a list — one thing. Commit to it.' },
];

const STORAGE_KEY = 'sanctum_examen';

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function loadState(): { date: string; checks: Record<string, boolean> } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: '', checks: {} };
    return JSON.parse(raw) as { date: string; checks: Record<string, boolean> };
  } catch {
    return { date: '', checks: {} };
  }
}

function saveState(checks: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: getTodayKey(), checks }));
  } catch {
    // ignore
  }
}

function getQuoteForDay(date: Date = new Date()) {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000,
  );
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
}

export function ExamenChecklist({ t }: ExamenChecklistProps) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [streakRecorded, setStreakRecorded] = useState(false);
  const streak = useMemo(() => getExamenStreak(), []);
  const todayQuote = useMemo(() => getQuoteForDay(), []);

  useEffect(() => {
    const stored = loadState();
    if (stored.date === getTodayKey()) {
      setChecks(stored.checks);
    } else {
      setChecks({});
      saveState({});
    }
  }, []);

  const toggle = useCallback((id: string) => {
    setChecks((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveState(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setChecks({});
    saveState({});
    setStreakRecorded(false);
  }, []);

  const completedCount = Object.values(checks).filter(Boolean).length;
  const allDone = completedCount === EXAMEN_STEPS.length;

  useEffect(() => {
    if (allDone && !streakRecorded) {
      const result = recordExamenComplete();
      setStreakRecorded(true);
      if (result.isNew && result.streak > 1) {
        // Streak incremented — could show a toast but keeping it simple
      }
    }
  }, [allDone, streakRecorded]);

  const currentStreak = streakRecorded ? Math.max(streak, 1) : streak;

  return (
    <div className="rounded-xl p-4 border" style={{ backgroundColor: t.card, borderColor: `${t.border}66` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Moon className="w-4 h-4" style={{ color: t.accent }} />
          <h3 className="text-sm font-bold font-display uppercase tracking-wide" style={{ color: t.textBright }}>Evening Examen</h3>
        </div>
        <div className="flex items-center gap-3">
          {currentStreak > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: t.accent }}>
              <Flame className="w-3 h-3" />
              {currentStreak} day{currentStreak !== 1 ? 's' : ''}
            </span>
          )}
          {completedCount > 0 && (
            <button onClick={reset} className="flex items-center gap-1 text-[11px] transition-colors" style={{ color: t.textDim }}>
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Today's Gospel — integrated */}
      <div
        className="rounded-lg px-3 py-3 border mb-4"
        style={{ backgroundColor: t.accentRgba(0.05), borderColor: t.accentRgba(0.15) }}
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <BookOpen className="w-3 h-3" style={{ color: t.accent, opacity: 0.7 }} />
          <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color: t.accent }}>
            Today's Gospel
          </span>
        </div>
        <p className="text-xs italic leading-relaxed mb-1.5" style={{ color: t.textBright }}>
          &ldquo;{todayQuote.text}&rdquo;
        </p>
        <p className="text-[10px] font-medium" style={{ color: t.textDim }}>
          — {todayQuote.author}{todayQuote.source && <span className="opacity-70">, {todayQuote.source}</span>}
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-1.5 mb-4">
        {EXAMEN_STEPS.map((s) => (
          <div key={s.id} className="h-1 flex-1 rounded-full transition-all" style={{ backgroundColor: checks[s.id] ? t.accent : `${t.border}66` }} />
        ))}
      </div>

      <div className="space-y-2">
        {EXAMEN_STEPS.map((step, i) => {
          const isChecked = checks[step.id] || false;
          return (
            <div key={step.id}>
              <button onClick={() => toggle(step.id)}
                className="w-full flex items-start gap-3 px-3 py-3 rounded-lg border transition-all text-left active:scale-[0.98]"
                style={isChecked
                  ? { backgroundColor: t.accentRgba(0.1), borderColor: t.accentRgba(0.3) }
                  : { backgroundColor: `${t.border}40`, borderColor: `${t.border}4D` }}>
                <div className="w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                  style={isChecked ? { backgroundColor: t.accent, borderColor: t.accent, color: '#fff' } : { borderColor: t.borderLight, color: 'transparent' }}>
                  {isChecked && <Check className="w-3 h-3" strokeWidth={3} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: t.accent }}>{i + 1}</span>
                    <span className="text-xs font-bold font-display uppercase tracking-wide" style={{ color: isChecked ? t.textBright : t.text }}>{step.label}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed" style={{ color: isChecked ? t.textMuted : t.textDim }}>{step.prompt}</p>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {allDone && (
        <div className="mt-3 text-center text-xs font-medium animate-fade-in" style={{ color: t.accent }}>
          Rest now. You fought today. You owned what was yours. Sleep in peace.
        </div>
      )}

      <p className="text-[11px] text-center leading-relaxed mt-3" style={{ color: t.textDim }}>
        St. Ignatius' six-step examen, anchored in today's Gospel. Resets each night so you start fresh.
      </p>
    </div>
  );
}
