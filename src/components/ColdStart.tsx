import { useState, useEffect, useRef, useCallback } from 'react';
import { Zap, Check, ChevronRight, Play, RotateCcw } from 'lucide-react';
import type { PersonaTheme } from '@/types';
import { useAudio } from '@/lib/audio';

interface ColdStartProps {
  t: PersonaTheme;
}

const COLD_START_STEPS = [
  {
    title: 'Physical Shock',
    instruction: 'Splash ice-cold water on your face. Or hold an ice cube in your hand until it melts.',
    detail: 'This activates the mammalian dive reflex — it forces your heart rate down and snaps your nervous system out of a panic loop. Do it now. Don\'t think. Just do it.',
    duration: 15,
  },
  {
    title: 'Postural Reset',
    instruction: 'Stand up. Roll your shoulders back. Open your chest. Lift your chin.',
    detail: 'Your body was curled into a defensive posture. You need to physically break it. Stand tall. Plant your feet. You are not prey — you are a man with a fight on your hands.',
    duration: 10,
  },
  {
    title: 'Tactical Breath',
    instruction: 'In for 4 — hold for 4 — out for 4 — hold for 4. Follow the timer.',
    detail: 'Box breathing. It shuts down the stress response in under a minute. Breathe with the count.',
    duration: 16,
  },
  {
    title: 'Anchor Scripture',
    instruction: '"Be still, and know that I am God." — Psalm 46:10',
    detail: 'Read it three times. Let it sink in. You are not God. You do not have to hold this together. He is. You just have to be still and let Him.',
    duration: 20,
  },
];

const BREATH_PHASES = ['Breathe In', 'Hold', 'Breathe Out', 'Hold'];

export function ColdStart({ t }: ColdStartProps) {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [countdown, setCountdown] = useState(COLD_START_STEPS[0].duration);
  const [breathPhaseIdx, setBreathPhaseIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breathTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audio = useAudio();

  const stop = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (breathTimerRef.current) { clearInterval(breathTimerRef.current); breathTimerRef.current = null; }
  }, []);

  const reset = useCallback(() => {
    stop();
    setStarted(false);
    setStep(0);
    setCountdown(COLD_START_STEPS[0].duration);
    setBreathPhaseIdx(0);
  }, [stop]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  useEffect(() => {
    if (!started) return;

    const current = COLD_START_STEPS[step];
    setCountdown(current.duration);

    if (step === 2) {
      setBreathPhaseIdx(0);
      audio.playTone('phase');
      breathTimerRef.current = setInterval(() => {
        setBreathPhaseIdx((prev) => {
          const next = (prev + 1) % BREATH_PHASES.length;
          audio.playTone('phase');
          return next;
        });
      }, 4000);
    }

    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) return 0;
        return c - 1;
      });
    }, 1000);

    return () => stop();
  }, [started, step]);

  useEffect(() => {
    if (!started) return;
    if (countdown !== 0) return;

    stop();
    if (step < COLD_START_STEPS.length - 1) {
      audio.playTone('complete');
      setStep(step + 1);
    } else {
      audio.playTone('complete');
    }
  }, [countdown, started, step, stop, audio]);

  const current = COLD_START_STEPS[step];
  const isLast = step === COLD_START_STEPS.length - 1;
  const isBreathStep = step === 2;
  const isComplete = isLast && countdown === 0;

  const handleBegin = () => {
    setStarted(true);
    audio.playTone('start');
  };

  const handleSkip = () => {
    stop();
    if (step < COLD_START_STEPS.length - 1) {
      audio.playTone('phase');
      setStep(step + 1);
    } else {
      reset();
    }
  };

  return (
    <div className="rounded-xl p-4 border" style={{ backgroundColor: t.card, borderColor: `${t.border}66` }}>
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4" style={{ color: t.accent }} />
        <h3 className="text-sm font-bold font-display uppercase tracking-wide" style={{ color: t.textBright }}>Cold Start</h3>
      </div>

      {!started ? (
        <div className="text-center py-2">
          <p className="text-sm leading-relaxed mb-2" style={{ color: t.text }}>
            You're in a spiral. This will get you out in under 60 seconds.
          </p>
          <p className="text-xs leading-relaxed mb-5" style={{ color: t.textDim }}>
            Four steps: cold water, stand tall, box breathing, and a Scripture to anchor you. Follow the prompts. Don't think. Just do.
          </p>
          <div className="space-y-1.5 mb-5 text-left">
            {COLD_START_STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: `${t.border}40` }}>
                <span className="text-[10px] font-bold w-5 text-center" style={{ color: t.accent }}>{i + 1}</span>
                <span className="text-xs" style={{ color: t.textMuted }}>{s.title}</span>
              </div>
            ))}
          </div>
          <button onClick={handleBegin} className="w-full py-3 rounded-lg text-sm font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{ backgroundColor: t.accent, color: '#ffffff' }}>
            <Play className="w-4 h-4" /> Begin Cold Start
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5 mb-5">
            {COLD_START_STEPS.map((_, i) => (
              <div key={i} className="h-1 flex-1 rounded-full transition-all" style={{ backgroundColor: i <= step ? t.accent : `${t.border}66` }} />
            ))}
          </div>

          <div className="text-center mb-4">
            <p className="text-[10px] uppercase tracking-[0.15em] font-bold mb-1" style={{ color: t.accent }}>
              Step {step + 1} of {COLD_START_STEPS.length}
            </p>
            <h3 className="text-lg font-bold mb-2" style={{ color: t.textBright }}>{current.title}</h3>
            <p className="text-sm leading-relaxed mb-3" style={{ color: t.text }}>{current.instruction}</p>
          </div>

          {isBreathStep && (
            <div className="text-center mb-4">
              <p className="text-lg font-bold mb-1" style={{ color: t.accent }}>
                {BREATH_PHASES[breathPhaseIdx]}
              </p>
              <p className="text-[11px] leading-relaxed" style={{ color: t.textDim }}>{current.detail}</p>
            </div>
          )}

          {!isBreathStep && (
            <div className="rounded-lg p-3 mb-4" style={{ backgroundColor: `${t.border}40` }}>
              <p className="text-xs leading-relaxed" style={{ color: t.textMuted }}>{current.detail}</p>
            </div>
          )}

          <div className="flex items-center justify-center gap-3 mb-4">
            <span
              key={countdown}
              className="text-4xl font-bold tabular-nums animate-pulse-countdown"
              style={{ color: t.accent }}
            >
              {countdown}
            </span>
            <span className="text-xs" style={{ color: t.textDim }}>seconds</span>
          </div>

          {isComplete ? (
            <div className="space-y-2">
              <button onClick={reset} className="w-full py-3 rounded-lg text-sm font-bold transition-all active:scale-95"
                style={{ backgroundColor: t.accent, color: '#ffffff' }}>
                <span className="flex items-center justify-center gap-2"><Check className="w-4 h-4" /> You're Steady</span>
              </button>
              <button onClick={reset} className="w-full py-2 rounded-lg text-xs font-bold border transition-all active:scale-95 flex items-center justify-center gap-1.5"
                style={{ backgroundColor: t.accentRgba(0.15), borderColor: t.accentRgba(0.4), color: t.accent }}>
                <RotateCcw className="w-3.5 h-3.5" /> Start Over
              </button>
            </div>
          ) : (
            <button onClick={handleSkip}
              className="w-full py-2.5 rounded-lg text-xs font-bold border transition-all active:scale-95 flex items-center justify-center gap-1.5"
              style={{ backgroundColor: t.accentRgba(0.15), borderColor: t.accentRgba(0.4), color: t.accent }}>
              Skip Step <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
