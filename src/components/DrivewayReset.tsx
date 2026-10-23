import { useState, useEffect, useRef, useCallback } from 'react';
import { Car, Check, ChevronRight, Play, RotateCcw } from 'lucide-react';
import type { PersonaTheme } from '@/types';
import { useAudio } from '@/lib/audio';

const RESET_STEPS = [
  {
    title: 'Arrive',
    instruction: 'Turn off the engine. Put the phone down. Sit in the silence for a moment.',
    detail: 'You are still carrying the weight of the day — the meetings, the pressure, the frustration. Before you walk through that door, you need to set it down. Not forever. Just long enough to be present for the people who matter most.',
    duration: 15,
  },
  {
    title: 'Exhale the Day',
    instruction: 'Take three slow breaths. On each exhale, release one thing from work you cannot control.',
    detail: 'Breathe in deep. On the exhale, let go of the meeting that went sideways. Breathe in. On the exhale, let go of the task you did not finish. Breathe in. On the exhale, let go of the frustration you are carrying toward someone who is not even here.',
    duration: 30,
  },
  {
    title: 'Remember Who You Are',
    instruction: '"Whatever you do, work at it with all your heart, as working for the Lord." — Colossians 3:23',
    detail: 'Your work is for Him. But your family is also for Him. The man who provides is also the man who is present. You are not just an employee walking through that door. You are a husband. A father. A son. A brother. Remember who you are.',
    duration: 20,
  },
  {
    title: 'Choose Your First Words',
    instruction: 'What is the first thing you will say when you walk in? Decide now.',
    detail: 'The first words set the tone. Not a complaint about traffic. Not a grunt. Something warm. Something that tells them you are glad to be home. Decide now. Then go.',
    duration: 15,
  },
  {
    title: 'Go',
    instruction: 'You are ready. Pick up what you need. Leave the rest in the car.',
    detail: 'Leave the stress in the car. It will be here tomorrow. What is inside that house is what matters. Go.',
    duration: 10,
  },
];

interface DrivewayResetProps {
  t: PersonaTheme;
}

export function DrivewayReset({ t }: DrivewayResetProps) {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [countdown, setCountdown] = useState(RESET_STEPS[0].duration);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audio = useAudio();

  const stop = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const reset = useCallback(() => {
    stop();
    setStarted(false);
    setStep(0);
    setCountdown(RESET_STEPS[0].duration);
  }, [stop]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  useEffect(() => {
    if (!started) return;

    const current = RESET_STEPS[step];
    setCountdown(current.duration);

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
    if (step < RESET_STEPS.length - 1) {
      audio.playTone('complete');
      setStep(step + 1);
    } else {
      audio.playTone('complete');
    }
  }, [countdown, started, step, stop, audio]);

  const current = RESET_STEPS[step];
  const isLast = step === RESET_STEPS.length - 1;
  const isComplete = isLast && countdown === 0;

  const handleBegin = () => {
    setStarted(true);
    audio.playTone('start');
  };

  const handleSkip = () => {
    stop();
    if (step < RESET_STEPS.length - 1) {
      audio.playTone('phase');
      setStep(step + 1);
    } else {
      reset();
    }
  };

  return (
    <div className="rounded-xl p-4 border" style={{ backgroundColor: t.card, borderColor: `${t.border}66` }}>
      <div className="flex items-center gap-2 mb-4">
        <Car className="w-4 h-4" style={{ color: t.accent }} />
        <h3 className="text-sm font-bold font-display uppercase tracking-wide" style={{ color: t.textBright }}>Driveway Reset</h3>
      </div>

      {!started ? (
        <div className="text-center py-2">
          <p className="text-sm leading-relaxed mb-2" style={{ color: t.text }}>
            You made it home. Before you go inside, take 90 seconds to reset.
          </p>
          <p className="text-xs leading-relaxed mb-5" style={{ color: t.textDim }}>
            Five steps to leave the workday in the car and walk in as the man your family needs.
          </p>
          <div className="space-y-1.5 mb-5 text-left">
            {RESET_STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: `${t.border}40` }}>
                <span className="text-[10px] font-bold w-5 text-center" style={{ color: t.accent }}>{i + 1}</span>
                <span className="text-xs" style={{ color: t.textMuted }}>{s.title}</span>
              </div>
            ))}
          </div>
          <button onClick={handleBegin} className="w-full py-3 rounded-lg text-sm font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{ backgroundColor: t.accent, color: '#ffffff' }}>
            <Play className="w-4 h-4" /> Begin Reset
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5 mb-5">
            {RESET_STEPS.map((_, i) => (
              <div key={i} className="h-1 flex-1 rounded-full transition-all" style={{ backgroundColor: i <= step ? t.accent : `${t.border}66` }} />
            ))}
          </div>

          <div className="text-center mb-4">
            <p className="text-[10px] uppercase tracking-[0.15em] font-bold mb-1" style={{ color: t.accent }}>
              Step {step + 1} of {RESET_STEPS.length}
            </p>
            <h3 className="text-lg font-bold mb-2" style={{ color: t.textBright }}>{current.title}</h3>
            <p className="text-sm leading-relaxed mb-3" style={{ color: t.text }}>{current.instruction}</p>
          </div>

          <div className="rounded-lg p-3 mb-4" style={{ backgroundColor: `${t.border}40` }}>
            <p className="text-xs leading-relaxed" style={{ color: t.textMuted }}>{current.detail}</p>
          </div>

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
                <span className="flex items-center justify-center gap-2"><Check className="w-4 h-4" /> Go Inside</span>
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
