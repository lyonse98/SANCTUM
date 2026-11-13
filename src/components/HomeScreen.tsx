import { useRef, useEffect, useState } from 'react';
import { DailyQuote } from '@/components/DailyQuote';
import { SaintOfDayCard } from '@/components/SaintOfDayCard';
import { SeasonBackdrop } from '@/components/SeasonBackdrop';
import { TodayHero } from '@/components/TodayHero';
import { TonightClosing } from '@/components/TonightClosing';
import { UtilitiesRow } from '@/components/UtilitiesRow';
import { getSeasonTheme, getSeasonAccentColor } from '@/lib/seasonTheme';
import { AUDIO_PM_START_HOUR } from '@/lib/narratorCore';
import { morningResolve } from '@/lib/tonight';
import type { Audience, Persona, UtilityActions } from '@/types';
import { PRIVACY_SHORT } from '@/lib/privacyCopy';
import { MISSION_LINE, MISSION_ATTRIBUTION } from '@/lib/mission';

interface HomeScreenProps {
  audience: Audience;
  onReflectWithCompanion: (message: string) => void;
  /** Today's saint, when they are in the cast, opens their companion. */
  onOpenCompanion: (persona: Persona) => void;
  onOpenHelp: () => void;
  /** A push tap on the examen focus lands here: show the Tonight closing whatever the hour. */
  forceTonight?: boolean;
  onConsumeForceTonight?: () => void;
  utilities: UtilityActions;
}

/**
 * The Today area — the app's front door. The Gospel leads and the saint follows it in full view;
 * neither is hidden behind a disclosure, because a man should be able to see what the day holds
 * without hunting for it. The day closes the way the examen taught it to — gratitude, one honest
 * look, one resolve — as a short closing section titled simply "Tonight", appearing as the day
 * turns (from the PM hour the audio day already keeps) or whenever a reminder's tap asks for it.
 * It is a shape, not a tool: nothing on it is checked or scored. The utilities close the page as
 * an ordinary card.
 */
export function HomeScreen({ audience, onReflectWithCompanion, onOpenCompanion, onOpenHelp, forceTonight, onConsumeForceTonight, utilities }: HomeScreenProps) {
  const gospelRef = useRef<HTMLDivElement>(null);
  const tonightRef = useRef<HTMLDivElement>(null);
  const seasonTheme = getSeasonTheme(new Date(), audience);
  const seasonAccent = getSeasonAccentColor();

  const isEvening = new Date().getHours() >= AUDIO_PM_START_HOUR;
  const showTonight = isEvening || Boolean(forceTonight);

  // Last night's resolve, in small text over the morning — until midday, then gone.
  const [lastNightsResolve, setLastNightsResolve] = useState<string | null>(null);
  useEffect(() => {
    setLastNightsResolve(morningResolve(new Date()));
  }, []);

  useEffect(() => {
    if (window.location.hash !== '#daily-gospel') return;
    gospelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  // A reminder's tap brings the closing into view and walks the eye to it,
  // whatever the hour on the clock says.
  useEffect(() => {
    if (!forceTonight) return;
    const id = setTimeout(() => {
      tonightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      onConsumeForceTonight?.();
    }, 350);
    return () => clearTimeout(id);
  }, [forceTonight, onConsumeForceTonight]);

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

        {/* Last night's resolve — one small line over the morning, gone by midday. */}
        {lastNightsResolve && (
          <p className="w-full text-center text-[11px] italic text-forge-text-dim mb-5 animate-fade-in">
            Last night&rsquo;s resolve: {lastNightsResolve}
          </p>
        )}

        <div className="w-full mb-6">
          <TodayHero t={seasonTheme} accent={seasonAccent} audience={audience} onOpenHelp={onOpenHelp} />
        </div>

        {/* Daily Gospel — the day's anchor */}
        <div ref={gospelRef} className="w-full mb-5">
          <DailyQuote
            t={seasonTheme}
            audience={audience}
            onReflectWithCompanion={onReflectWithCompanion}
          />
        </div>

        {/* Saint of the day — always in view, right where the Gospel leads */}
        <div className="w-full mb-5">
          <SaintOfDayCard t={seasonTheme} audience={audience} onOpenCompanion={onOpenCompanion} />
        </div>

        {/* Tonight — the day's closing, in its home on Today. Present from the
            PM hour; a reminder's tap lands the eye on it at any hour. */}
        {showTonight && (
          <div ref={tonightRef} className="w-full mb-5 animate-fade-in">
            <TonightClosing t={seasonTheme} audience={audience} />
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
