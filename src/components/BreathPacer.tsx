import { useRef, useEffect, useState, useCallback } from 'react';
import { Wind, Play, Pause, RotateCcw } from 'lucide-react';
import type { PersonaTheme } from '@/types';
import { useAudio } from '@/lib/audio';

type Phase = 'inhale' | 'hold-full' | 'exhale' | 'hold-empty' | 'double-inhale' | 'double-hold';

interface Preset {
  id: string;
  label: string;
  description: string;
  phases: { type: Phase; duration: number }[];
}

const PRESETS: Preset[] = [
  {
    id: 'physiological-sigh',
    label: 'Physiological Sigh',
    description: 'Double inhale through the nose, long exhale through the mouth. Fastest way to calm the nervous system.',
    phases: [
      { type: 'double-inhale', duration: 2 },
      { type: 'double-hold', duration: 1 },
      { type: 'exhale', duration: 6 },
    ],
  },
  {
    id: 'box',
    label: 'Tactical Box',
    description: '4-4-4-4. Used by operators to lock in under pressure. Equal inhale, hold, exhale, hold.',
    phases: [
      { type: 'inhale', duration: 4 },
      { type: 'hold-full', duration: 4 },
      { type: 'exhale', duration: 4 },
      { type: 'hold-empty', duration: 4 },
    ],
  },
  {
    id: '4-7-8',
    label: '4-7-8 Deep Relax',
    description: 'Inhale 4, hold 7, exhale 8. Dr. Weil\'s protocol for falling asleep or dropping anxiety fast.',
    phases: [
      { type: 'inhale', duration: 4 },
      { type: 'hold-full', duration: 7 },
      { type: 'exhale', duration: 8 },
    ],
  },
];

const PHASE_LABELS: Record<Phase, string> = {
  inhale: 'Breathe In',
  'hold-full': 'Hold',
  exhale: 'Breathe Out',
  'hold-empty': 'Hold',
  'double-inhale': 'Double Inhale',
  'double-hold': 'Hold',
};

interface BreathPacerProps {
  t: PersonaTheme;
}

export function BreathPacer({ t }: BreathPacerProps) {
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [presetIdx, setPresetIdx] = useState(1);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);
  const [displayTime, setDisplayTime] = useState(0);
  const [displayPhase, setDisplayPhase] = useState<Phase>('inhale');

  const audio = useAudio();
  const preset = PRESETS[presetIdx];

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseIdxRef = useRef(0);
  const presetRef = useRef(preset);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const advancePhase = useCallback(() => {
    const p = presetRef.current;
    const next = (phaseIdxRef.current + 1) % p.phases.length;
    phaseIdxRef.current = next;
    if (next === 0) setCycleCount((c) => c + 1);
    setPhaseIdx(next);
    setDisplayPhase(p.phases[next].type);
    setDisplayTime(p.phases[next].duration);
    audio.playTone('tick');
  }, [audio]);

  useEffect(() => {
    if (!active || paused) return;

    const phase = presetRef.current.phases[phaseIdxRef.current];
    setDisplayTime(phase.duration);
    setDisplayPhase(phase.type);

    timerRef.current = setInterval(() => {
      setDisplayTime((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => stopTimer();
  }, [active, paused, phaseIdx, stopTimer]);

  useEffect(() => {
    if (!active || paused) return;
    if (displayTime !== 0) return;

    advancePhase();
  }, [displayTime, active, paused, advancePhase]);

  const handleStart = () => {
    setActive(true);
    setPaused(false);
    setPhaseIdx(0);
    setCycleCount(0);
    phaseIdxRef.current = 0;
    setDisplayPhase(preset.phases[0].type);
    setDisplayTime(preset.phases[0].duration);
    audio.playTone('start');
  };

  const handlePause = () => {
    setPaused((p) => {
      const next = !p;
      if (next) {
        stopTimer();
      }
      return next;
    });
  };

  const handleStop = () => {
    stopTimer();
    setActive(false);
    setPaused(false);
    setPhaseIdx(0);
    setCycleCount(0);
    phaseIdxRef.current = 0;
    setDisplayPhase(preset.phases[0].type);
    setDisplayTime(preset.phases[0].duration);
  };

  const handlePresetChange = (idx: number) => {
    handleStop();
    setPresetIdx(idx);
    presetRef.current = PRESETS[idx];
  };

  const phaseLabel = PHASE_LABELS[displayPhase];
  const totalPhases = preset.phases.length;

  return (
    <div className="rounded-xl p-4 border" style={{ backgroundColor: t.card, borderColor: `${t.border}66` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wind className="w-4 h-4" style={{ color: t.accent }} />
          <h3 className="text-sm font-bold font-display uppercase tracking-wide" style={{ color: t.textBright }}>Breath Pacer</h3>
        </div>
        {cycleCount > 0 && (
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: t.textDim }}>
            {cycleCount} {cycleCount === 1 ? 'cycle' : 'cycles'}
          </span>
        )}
      </div>

      {/* Preset selector */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto scrollbar-hide">
        {PRESETS.map((p, i) => (
          <button
            key={p.id}
            onClick={() => handlePresetChange(i)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all border"
            style={i === presetIdx
              ? { backgroundColor: t.accentRgba(0.15), color: t.accent, borderColor: t.accentRgba(0.4) }
              : { backgroundColor: `${t.border}40`, color: t.textDim, borderColor: `${t.border}66` }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <p className="text-[11px] leading-relaxed mb-4" style={{ color: t.textDim }}>{preset.description}</p>

      {/* Phase display */}
      <div className="flex flex-col items-center mb-4">
        {active ? (
          <>
            <p className="text-xl font-bold font-display uppercase tracking-wide mb-2 animate-fade-in" style={{ color: t.accent }}>
              {phaseLabel}
            </p>
            <span className="text-5xl font-bold tabular-nums" style={{ color: t.textBright }}>
              {displayTime}
            </span>
            <p className="text-xs mt-1" style={{ color: t.textDim }}>seconds</p>
            <div className="flex gap-1.5 mt-3">
              {preset.phases.map((p, i) => (
                <div
                  key={i}
                  className="h-1.5 w-8 rounded-full transition-all"
                  style={{
                    backgroundColor: i === phaseIdx
                      ? t.accent
                      : i < phaseIdx
                        ? t.accentRgba(0.4)
                        : `${t.border}66`,
                  }}
                />
              ))}
            </div>
            <p className="text-[10px] mt-2" style={{ color: t.textDim }}>
              Phase {phaseIdx + 1} of {totalPhases}
            </p>
          </>
        ) : (
          <div className="py-6 text-center">
            <Wind className="w-10 h-10 mx-auto mb-2" style={{ color: t.accentRgba(0.5) }} />
            <p className="text-xs" style={{ color: t.textDim }}>Press Begin to start</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {!active ? (
          <button onClick={handleStart} className="flex-1 py-2.5 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{ backgroundColor: t.accent, color: '#ffffff' }}>
            <Play className="w-3.5 h-3.5" /> Begin
          </button>
        ) : (
          <button onClick={handlePause} className="flex-1 py-2.5 rounded-lg text-xs font-bold border transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{ backgroundColor: t.accentRgba(0.15), borderColor: t.accentRgba(0.4), color: t.accent }}>
            {paused ? <><Play className="w-3.5 h-3.5" /> Resume</> : <><Pause className="w-3.5 h-3.5" /> Pause</>}
          </button>
        )}
        {active && (
          <button onClick={handleStop} className="px-3 py-2.5 rounded-lg text-xs font-bold border transition-all active:scale-95"
            style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}66`, color: t.textDim }}>
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
