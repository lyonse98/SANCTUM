import { useRef, useEffect, useState } from 'react';
import { DailyQuote } from '@/components/DailyQuote';
import { SaintOfDayCard } from '@/components/SaintOfDayCard';
import { SeasonBackdrop } from '@/components/SeasonBackdrop';
import { TodayHero } from '@/components/TodayHero';
import { EveningExamen } from '@/components/EveningExamen';
import { UtilitiesRow } from '@/components/UtilitiesRow';
import { getSeasonTheme, getSeasonAccentColor } from '@/lib/seasonTheme';
import { AUDIO_PM_START_HOUR } from '@/lib/narratorCore';
import type { Audience, Persona, UtilityActions } from '@/types';
import { PRIVACY_SHORT } from '@/lib/privacyCopy';
import { MISSION_LINE, MISSION_ATTRIBUTION } from '@/lib/mission';

interface HomeScreenProps {
  audience: Audience;
  onReflectWithCompanion: (message: string) => void;
  onOpenExamen: () => void;
  /** Today's saint, when they are in the cast, opens their companion. */
  onOpenCompanion: (persona: Persona) => void;
  /** The Examen's onward doors. */
  onOpenConfession: () => void;
  onOpenHelp: () => void;
  /** A push tap on the examen focus lands here: reveal the Examen whatever the hour. */
  forceExamen?: boolean;
  onConsumeForceExamen?: () => void;
  utilities: UtilityActions;
}

/**
 * The Today area — the app's front door. The Gospel leads and the saint follows it in full view;
 * neither is hidden behind a disclosure, because a man should be able to see what the day holds
 * without hunting for it. The day closes where Ignatius would close it: the Evening Examen
 * belongs to this screen, appearing as the day turns (from the PM hour the audio day already
 * keeps) — or whenever it is asked for, by the Gospel card's quiet button or a reminder's tap.
 * It rests as one expandable row; the checklist opens only when it is tapped open (or when a
 * reminder lands on it). The utilities close the page as an ordinary card.
 */
export function HomeScreen({ audience, onReflectWithCompanion, onOpenExamen, onOpenCompanion, onOpenConfession, onOpenHelp, forceExamen, onConsumeForceExamen, utilities }: HomeScreenProps) {
  const gospelRef = useRef<HTMLDivElement>(null);
  const examenRef = useRef<HTMLDivElement>(null);
  const seasonTheme = getSeasonTheme(new Date(), audience);
  const seasonAccent = getSeasonAccentColor();

  const isEvening = new Date().getHours() >= AUDIO_PM_START_HOUR;
  const [examenRevealed, setExamenRevealed] = useState(false);
  const showExamen = isEvening || examenRevealed || Boolean(forceExamen);
  // Bumped whenever the Examen is asked for by name — the section opens itself.
  const [examenSignal, setExamenSignal] = useState(0);

  useEffect(() => {
    if (window.location.hash !== '#daily-gospel') return;
    gospelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  // A reminder's tap reveals the Examen already open, and walks the eye to it,
  // whatever the hour on the clock says.
  useEffect(() => {
    if (!forceExamen) return;
    setExamenSignal((s) => s + 1);
    const id = setTimeout(() => {
      examenRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      onConsumeForceExamen?.();
    }, 350);
    return () => clearTimeout(id);
  }, [forceExamen, onConsumeForceExamen]);

  const revealExamen = () => {
    onOpenExamen();
    setExamenRevealed(true);
    setExamenSignal((s) => s + 1);
    setTimeout(() => examenRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  };

  return (
    <div className="absolute inset-0 overflow-y-auto chat-scroll bg-forge-bg">
      <SeasonBackdrop />
      <div className="relative z-10 min-h-full flex flex-col items-center px-5 py-8 pb-16 max-w-2xl mx-auto">
        {/* The thesis, inscribed over the door — quiet, static, the same every day.
            It frames everything below it without competing with the day's content. */}
        <div className="w-full text-center mb-5">
          <p className="font-display italic text-[13px] leading-snug text-forge-text-muted">
            {MISSION_LINE}
          </p>
          <p className="text-[9px] uppercase tracking-[0.25em] text-forge-text-dim mt-1">
            {MISSION_ATTRIBUTION}
          </p>
        </div>

        <div className="w-full mb-6">
          <TodayHero t={seasonTheme} accent={seasonAccent} audience={audience} onOpenHelp={onOpenHelp} />
        </div>

        {/* Daily Gospel — the day's anchor */}
        <div ref={gospelRef} className="w-full mb-5">
          <DailyQuote
            t={seasonTheme}
            audience={audience}
            onOpenExamen={revealExamen}
            onReflectWithCompanion={onReflectWithCompanion}
          />
        </div>

        {/* Saint of the day — always in view, right where the Gospel leads */}
        <div className="w-full mb-5">
          <SaintOfDayCard t={seasonTheme} audience={audience} onOpenCompanion={onOpenCompanion} />
        </div>

        {/* The Evening Examen — the day's closing movement, in its home on Today.
            Present from the PM hour as one expandable row; a tap on the reminder
            lands it already open, and the Gospel card's button brings it forward,
            open, at any hour. */}
        {showExamen && (
          <div ref={examenRef} className="w-full mb-5 animate-fade-in">
            <EveningExamen
              t={seasonTheme}
              audience={audience}
              onOpenConfession={onOpenConfession}
              onOpenHelp={onOpenHelp}
              forceOpen={Boolean(forceExamen)}
              openSignal={examenSignal}
            />
          </div>
        )}

        <UtilitiesRow t={seasonTheme} utilities={utilities} className="mb-4" />

        <p className="text-[11px] text-forge-text-dim text-center mt-4 leading-relaxed max-w-xs">
          Sanctum is a spiritual companion, not a licensed therapist. In crisis? Call or text 988 (US). {PRIVACY_SHORT}
        </p>
      </div>
    </div>
  );
}
