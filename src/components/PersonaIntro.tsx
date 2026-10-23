import { useEffect, useState } from 'react';
import { CompanionAvatar } from '@/components/CompanionAvatar';
import type { Persona } from '@/types';

interface PersonaIntroProps {
  persona: Persona;
  onDone: () => void;
}

export function PersonaIntro({ persona, onDone }: PersonaIntroProps) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter');
  const t = persona.theme;

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 100);
    const t2 = setTimeout(() => setPhase('exit'), 1600);
    const t3 = setTimeout(onDone, 2200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onDone]);

  const iconScale = phase === 'enter' ? 'scale-50 opacity-0' : phase === 'exit' ? 'scale-110 opacity-0' : 'scale-100 opacity-100';
  const textShift = phase === 'enter' ? 'translate-y-4 opacity-0' : phase === 'exit' ? 'translate-y-0 opacity-0' : 'translate-y-0 opacity-100';
  const overlayOpacity = phase === 'exit' ? 'opacity-0' : 'opacity-100';

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center transition-opacity duration-500"
      style={{ background: t.bgGradient, backgroundColor: t.bg, opacity: overlayOpacity === 'opacity-100' ? 1 : 0 }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 45%, ${t.accentRgba(0.08)} 0%, transparent 60%)`,
        }}
      />

      {/* Expanding rings */}
      <div className="absolute" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
        <div
          className="rounded-full border transition-all duration-1000"
          style={{
            width: phase === 'enter' ? 60 : 280,
            height: phase === 'enter' ? 60 : 280,
            borderColor: t.accentRgba(phase === 'hold' ? 0.15 : 0),
            opacity: phase === 'enter' ? 0.6 : phase === 'exit' ? 0 : 0.15,
          }}
        />
      </div>
      <div className="absolute" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
        <div
          className="rounded-full border transition-all duration-1000 delay-150"
          style={{
            width: phase === 'enter' ? 40 : 200,
            height: phase === 'enter' ? 40 : 200,
            borderColor: t.accentRgba(phase === 'hold' ? 0.08 : 0),
            opacity: phase === 'enter' ? 0.4 : phase === 'exit' ? 0 : 0.08,
          }}
        />
      </div>

      <div className="relative flex flex-col items-center gap-5">
        <div
          className={`transition-all duration-700 ease-out ${iconScale}`}
        >
          <CompanionAvatar personaId={persona.id} theme={t} size={80} animate />
        </div>

        <div className={`text-center transition-all duration-700 ease-out ${textShift}`}>
          <p
            className="text-[10px] uppercase tracking-[0.3em] font-semibold mb-2"
            style={{ color: t.textDim }}
          >
            {persona.era}
          </p>
          <h1
            className="text-3xl font-bold font-display uppercase tracking-wide mb-1.5"
            style={{ color: t.textBright }}
          >
            {persona.name}
          </h1>
          <p className="text-sm italic" style={{ color: t.accent }}>
            "{persona.tagline}"
          </p>
        </div>
      </div>

      {/* Bottom progress bar */}
      <div className="absolute bottom-0 left-0 h-0.5" style={{ backgroundColor: t.accent }}>
        <div
          className="h-full transition-all ease-linear"
          style={{
            width: phase === 'enter' ? '0%' : phase === 'hold' ? '60%' : '100%',
            transitionDuration: phase === 'enter' ? '0ms' : phase === 'hold' ? '1500ms' : '600ms',
            backgroundColor: t.accentBright,
          }}
        />
      </div>
    </div>
  );
}
