import { useRef, useEffect, useState } from 'react';
import { ArrowRight, HeartHandshake } from 'lucide-react';
import { DailyQuote } from '@/components/DailyQuote';
import { ReminderCard } from '@/components/ReminderCard';
import { SeasonBackdrop } from '@/components/SeasonBackdrop';
import { TodayHero } from '@/components/TodayHero';
import { TonightClosing } from '@/components/TonightClosing';
import { getSeasonTheme, getSeasonAccentColor } from '@/lib/seasonTheme';
import { AUDIO_PM_START_HOUR } from '@/lib/narratorCore';
import { morningResolve } from '@/lib/tonight';
import type { Audience } from '@/types';
import { PRIVACY_SHORT } from '@/lib/privacyCopy';
import { MISSION_LINE, MISSION_ATTRIBUTION } from '@/lib/mission';

interface HomeScreenProps {
  audience: Audience;
  onReflectWithCompanion: (message: string) => void;
  onOpenHelp: () => void;
  /** Opens the shell's reminder modal — the reminder card and the post-listen line both lead there. */
  onOpenReminder: () => void;
  /** A push tap on the examen focus lands here: show the Tonight closing whatever the hour. */
  forceTonight?: boolean;
  onConsumeForceTonight?: () => void;
}

/**
 * The Today area — the app's only home since the core diet (Erik, Nov 13,
 * 2026). The Gospel card carries the day: the readings as its body, the
 * reflection, and the three equal doors into it. The saint of the day no
 * longer holds a card of his own here — he survives in the Gospel card's
 * header line (the day's celebration and its rank) and in the Tonight
 * closing's saint line; the standalone saint card's component stays in
 * the repo, unwired, like the other retired surfaces. The day closes the way the examen
 * taught it to — gratitude, one honest look, one resolve — as a short closing
 * section titled simply "Tonight", appearing as the day turns (from the PM
 * hour the audio day already keeps) or whenever a reminder's tap asks for it.
 * It is a shape, not a tool: nothing on it is checked or scored. One quiet
 * line at the foot keeps Real Help in view — help should never be only
 * behind a menu.
 */
export function HomeScreen({ audience, onReflectWithCompanion, onOpenHelp, onOpenReminder, forceTonight, onConsumeForceTonight }: HomeScreenProps) {
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
            onOpenReminder={onOpenReminder}
          />
        </div>

        {/* The reminder's flywheel face (Nov 13, 2026): an invitation with a
            fourteen-day dismiss until one is set, then one quiet line naming
            it — prominent, not pushy. */}
        <div className="w-full mb-5">
          <ReminderCard t={seasonTheme} onOpenReminder={onOpenReminder} />
        </div>

        {/* Tonight — the day's closing, in its home on Today. Present from the
            PM hour; a reminder's tap lands the eye on it at any hour. */}
        {showTonight && (
          <div ref={tonightRef} className="w-full mb-5 animate-fade-in">
            <TonightClosing t={seasonTheme} audience={audience} />
          </div>
        )}

        {/* Real Help stays in view at the foot of Today — one quiet line, so
            a hard moment never has to go hunting through the menu. */}
        <button
          onClick={onOpenHelp}
          className="w-full flex items-center justify-center gap-2 text-center transition-opacity hover:opacity-70 mb-4"
        >
          <HeartHandshake className="w-3.5 h-3.5 flex-shrink-0" style={{ color: seasonAccent }} />
          <span className="text-[11px] font-medium text-forge-text-muted">
            Need real help? A priest, a counselor, or a crisis line —
          </span>
          <ArrowRight className="w-3 h-3 flex-shrink-0" style={{ color: seasonAccent }} />
        </button>

        <p className="text-[11px] text-forge-text-dim text-center mt-4 leading-relaxed max-w-xs">
          Sanctum is a spiritual companion, not a licensed therapist. In crisis? Call or text 988 (US). {PRIVACY_SHORT}
        </p>
      </div>
    </div>
  );
}
