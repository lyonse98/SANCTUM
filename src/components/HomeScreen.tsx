import { useRef, useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { DailyQuote } from '@/components/DailyQuote';
import { ReminderCard } from '@/components/ReminderCard';
import { MoreOfSanctum } from '@/components/MoreOfSanctum';
import { UtilitiesLine } from '@/components/UtilitiesLine';
import { SeasonBackdrop } from '@/components/SeasonBackdrop';
import { TodayHero } from '@/components/TodayHero';
import { TonightClosing } from '@/components/TonightClosing';
import { DaysPrayedMark } from '@/components/DaysPrayedMark';
import { TailorToday } from '@/components/TailorToday';
import { getSeasonTheme, getSeasonAccentColor } from '@/lib/seasonTheme';
import { PRINT_PLATE_CLASS, PRINT_SERIF } from '@/lib/print';
import { AUDIO_PM_START_HOUR } from '@/lib/narratorCore';
import { morningResolve } from '@/lib/tonight';
import { DAY_START_HOUR, contentDate, contentDateKey, contentNow } from '@/lib/dayBoundary';
import { currentNovenaArc } from '@/lib/novenaProgress';
import { adventProgress } from '@/lib/seasonArcs';
import type { Audience, TabId, UtilityActions } from '@/types';
import { PRIVACY_SHORT } from '@/lib/privacyCopy';

interface HomeScreenProps {
  audience: Audience;
  onReflectWithCompanion: (message: string) => void;
  onOpenHelp: () => void;
  /** Opens the shell's reminder modal — the reminder card and the post-listen line both lead there. */
  onOpenReminder: () => void;
  /** A push tap on the examen focus lands here: show the Tonight closing whatever the hour. */
  forceTonight?: boolean;
  onConsumeForceTonight?: () => void;
  /** The housekeeping actions, fired from the utilities line at the foot of the page. */
  utilities: UtilityActions;
  /** The More of Sanctum rows walk to the three destinations. */
  onNavigate: (view: TabId) => void;
  /** Play 6c: Today's scroll position when it was last left, restored on return. */
  initialScrollTop?: number;
  /** Play 6c: reports Today's scroll position as it changes, for the scroll map. */
  onScrollTopChange?: (top: number) => void;
  /** Opens Pocket Church on the Pray door's Novenas section — the novena arc line's way onward. */
  onOpenNovenas?: () => void;
}

/**
 * The Today area — the app's only home since the core diet (Erik, Nov 13,
 * 2026). The Gospel card carries the day: the key verse as its face, the
 * full readings behind its expander, the reflection, and the three equal
 * doors into it. The saint of the day no
 * longer holds a card of his own here — he survives in the Gospel card's
 * header line (the day's celebration and its rank) and in the Tonight
 * closing's saint line; the standalone saint card's component stays in
 * the repo, unwired, like the other retired surfaces. The day closes the way the examen
 * taught it to — gratitude, one honest look, one resolve — as a short closing
 * section titled simply "Tonight", appearing as the day turns (from the PM
 * hour the audio day already keeps) or whenever a reminder's tap asks for it.
 * It is a shape, not a tool: nothing on it is checked or scored. The page
 * closes with the More of Sanctum block (Erik, Nov 13, 2026 — Option B,
 * "Foot of Today"): the three destinations as rows under the day itself,
 * Real Help among them at full weight, and the utilities line last of all.
 */
export function HomeScreen({ audience, onReflectWithCompanion, onOpenHelp, onOpenReminder, forceTonight, onConsumeForceTonight, utilities, onNavigate, initialScrollTop, onScrollTopChange, onOpenNovenas }: HomeScreenProps) {
  const gospelRef = useRef<HTMLDivElement>(null);
  const tonightRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Play 6c: returning to Today restores where the day was left, instead of
  // a full re-scroll from the top. A #daily-gospel deep link still wins —
  // its scroll effect below runs after this one and walks to the readings.
  useEffect(() => {
    if (initialScrollTop && scrollRef.current) {
      scrollRef.current.scrollTop = initialScrollTop;
    }
    // Mount only: the position handed in at mount is the saved one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const seasonTheme = getSeasonTheme(contentDate(), audience);
  const seasonAccent = getSeasonAccentColor(contentDate());

  // The retention lines (Nov 16, 2026): the content day's key for the
  // Tailor door below, the novena arc already under way on this device,
  // and Advent's own arc when the season is Advent — each read once,
  // from what the day already carries; nothing new is fetched for them.
  const [contentKey] = useState(() => contentDateKey());
  const [novenaArc] = useState(() => currentNovenaArc());
  const [advent] = useState(() => adventProgress(contentDate()));
  const [tailorOpen, setTailorOpen] = useState(false);

  // The evening is the content day's evening (Play 7): from the PM hour, and
  // still — in the small hours before the 04:00 flip — the night that belongs
  // to the day on the page, so Tonight stays reachable until the day turns.
  const nowHour = new Date().getHours();
  const isEvening = nowHour >= AUDIO_PM_START_HOUR || nowHour < DAY_START_HOUR;
  const showTonight = isEvening || Boolean(forceTonight);

  // Last night's resolve, in small text over the morning — until midday, then gone.
  const [lastNightsResolve, setLastNightsResolve] = useState<string | null>(null);
  useEffect(() => {
    setLastNightsResolve(morningResolve(contentNow()));
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
    <div
      ref={scrollRef}
      onScroll={(e) => onScrollTopChange?.(e.currentTarget.scrollTop)}
      className="absolute inset-0 overflow-y-auto chat-scroll"
      style={{ backgroundColor: seasonTheme.bg }}
    >
      <SeasonBackdrop />
      {/* The day's page (Stage 1 of the printed-page re-skin, Erik, Nov 14,
          2026): the column is a leaf of the track's paper — the theme's
          card tone, men's cool stone-beige, women's warm ivory-sand —
          standing on the track's ground, its edges ruled with hairlines.
          The stack inside is unchanged, in Erik's order, utilities last. */}
      <div
        className="relative z-10 min-h-full flex flex-col items-center px-5 py-8 pb-16 max-w-2xl mx-auto"
        style={{
          backgroundColor: seasonTheme.card,
          borderLeft: `1px solid ${seasonTheme.border}`,
          borderRight: `1px solid ${seasonTheme.border}`,
        }}
      >
        {/* Last night's resolve — one small line over the morning, gone by midday. */}
        {lastNightsResolve && (
          <p
            className="w-full text-center text-[13px] italic text-forge-text-dim mb-5 animate-fade-in"
            style={{ fontFamily: PRINT_SERIF }}
          >
            Last night&rsquo;s resolve: {lastNightsResolve}
          </p>
        )}

        <div className="w-full mb-6">
          <TodayHero t={seasonTheme} accent={seasonAccent} audience={audience} onOpenHelp={onOpenHelp} />
        </div>

        {/* The days-prayed mark — one quiet line under the masthead: the
            cumulative tally and today's flame, nothing more. */}
        <div className="w-full mb-4">
          <DaysPrayedMark t={seasonTheme} />
        </div>

        {/* The crisis line stands at the head of Today (audit W-1, Nov 16,
            2026): one tappable line under the masthead, reachable without a
            scroll — the footer's line stays, and is a link now too. */}
        <p
          className="w-full text-center text-[13px] mb-5"
          style={{ fontFamily: PRINT_SERIF, color: seasonTheme.textMuted }}
        >
          In crisis? Call or text{' '}
          <a
            href="tel:988"
            className="font-bold underline underline-offset-2"
            style={{ color: seasonTheme.textBright }}
          >
            988
          </a>{' '}
          — free, day or night.
        </p>

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

        {/* In progress — the arcs the day already carries (Plays 5b/5c):
            a novena under way on this device, and Advent itself in its
            season. One small area, quiet lines; the novena line walks to
            the Novenas section of the Pray door. */}
        {(novenaArc || advent) && (
          <div className="w-full mb-5 text-center" data-in-progress>
            <p
              className="text-[12px] font-bold uppercase tracking-[0.2em] mb-1.5"
              style={{ fontFamily: PRINT_SERIF, color: seasonTheme.textDim }}
            >
              In progress
            </p>
            {novenaArc && (
              <button
                data-novena-arc
                onClick={() => (onOpenNovenas ? onOpenNovenas() : onNavigate('church'))}
                className="block w-full text-[12px] py-1 transition-opacity hover:opacity-70"
                style={{ fontFamily: PRINT_SERIF, color: seasonTheme.textMuted }}
              >
                {novenaArc.name} &middot; day {novenaArc.dayCount} of 9
              </button>
            )}
            {advent && (
              <p
                data-advent-arc
                className="text-[12px] py-1"
                style={{ fontFamily: PRINT_SERIF, color: seasonTheme.textMuted }}
              >
                Advent &middot; day {advent.day} of {advent.totalDays}
              </p>
            )}
          </div>
        )}

        {/* Tailor Today, on Today itself (Play 4): the Gospel card's door
            stays where it is; this quiet plate is a second door into the
            same flow, so the morning's tailoring can be found from the
            page's own stack. The panel is the existing intake, whole. */}
        <div className="w-full mb-5">
          <button
            data-tailor-entry
            onClick={() => setTailorOpen((open) => !open)}
            aria-expanded={tailorOpen}
            className={PRINT_PLATE_CLASS}
            style={{ border: `1px solid ${seasonTheme.border}`, backgroundColor: `${seasonTheme.border}1F` }}
          >
            <span
              className="text-[12px] font-bold uppercase tracking-wide flex-shrink-0"
              style={{ fontFamily: PRINT_SERIF, color: seasonTheme.textBright }}
            >
              Tailor today&rsquo;s devotional
            </span>
            <span
              aria-hidden="true"
              className="flex-1"
              style={{ borderBottom: `1px dotted ${seasonTheme.textDim}` }}
            />
            <span
              className="text-[12px] italic flex-shrink-0"
              style={{ fontFamily: PRINT_SERIF, color: seasonTheme.textDim }}
            >
              For your morning
            </span>
            <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: seasonAccent }} strokeWidth={2.5} aria-hidden="true" />
          </button>
          {tailorOpen && (
            <TailorToday t={seasonTheme} audience={audience} dateKey={contentKey} startOpen />
          )}
        </div>

        {/* Tonight — the day's closing, in its home on Today. Present from the
            PM hour; a reminder's tap lands the eye on it at any hour. */}
        {showTonight && (
          <div ref={tonightRef} className="w-full mb-5 animate-fade-in">
            <TonightClosing t={seasonTheme} audience={audience} onOpenHelp={onOpenHelp} />
          </div>
        )}

        {/* More of Sanctum — the three destinations live at the foot of
            Today now (Option B): under the day, above the housekeeping.
            This block replaced the old one-line Real Help link; Real Help
            is its third row, at the same weight as the others. */}
        <div className="w-full mb-6">
          <MoreOfSanctum t={seasonTheme} onNavigate={onNavigate} />
        </div>

        <p
          className="text-[13px] text-forge-text-dim text-center leading-relaxed max-w-xs mb-5"
          style={{ fontFamily: PRINT_SERIF }}
        >
          Sanctum is a spiritual companion, not a licensed therapist. In crisis? Call or text{' '}
          <a href="tel:988" className="font-bold underline underline-offset-2">
            988
          </a>{' '}
          (US). {PRIVACY_SHORT}
        </p>

        {/* The utilities line closes the page — Settings · Reminders ·
            Feedback · About · Share, footer text, nothing more. */}
        <UtilitiesLine t={seasonTheme} utilities={utilities} />
      </div>
    </div>
  );
}
