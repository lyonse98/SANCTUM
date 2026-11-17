import { useEffect, useState } from 'react';
import { ChevronRight, Church, Moon } from 'lucide-react';
import { PRINT_PLATE_CLASS, PRINT_SERIF } from '@/lib/print';
import { fetchReflection } from '@/lib/reflection';
import { contentDate, contentDateKey, contentNow, shiftDateKey } from '@/lib/dayBoundary';
import { readTailorMeta } from '@/lib/tailor';
import { loadTonightsClose } from '@/lib/tailorPm';
import { TailorPm } from '@/components/TailorPm';
import {
  gratitudeForDate,
  honestLookLine,
  loadTonightResolve,
  saveTonightResolve,
  tailorEchoLine,
} from '@/lib/tonight';
import { recordCoreAct } from '@/lib/daysPrayed';
import { fetchDailyReadings } from '@/lib/readings';
import { fetchPassageVerses } from '@/lib/bible';
import { pickKeyVerse, type KeyVerse } from '@/lib/keyVerse';
import { getFeastForDate } from '@/data/feastDays';
import { getAdventStart, getCurrentSeason } from '@/data/liturgicalCalendar';
import { getHelpSections } from '@/lib/realHelp';
import type { Audience, PersonaTheme } from '@/types';

interface TonightClosingProps {
  t: PersonaTheme;
  audience: Audience;
  /** Walks to the Real Help surface — the Saturday block's Mass entry leads there. */
  onOpenHelp?: () => void;
}

// ── Tomorrow at Mass: the Sunday intention, on this device only ─────────────

/** The prefix of the Sunday intention keys — under sanctum_, so the wipe takes them. */
export const MASS_INTENTION_PREFIX = 'sanctum_mass_intention_';

/** The intention key for one Sunday, named by that Sunday's date key. */
export function massIntentionKey(sundayKey: string): string {
  return `${MASS_INTENTION_PREFIX}${sundayKey}`;
}

export function loadMassIntention(sundayKey: string): string {
  try {
    return localStorage.getItem(massIntentionKey(sundayKey)) ?? '';
  } catch {
    return '';
  }
}

/**
 * Keeps Sunday's intention on this device only. It is a preparation
 * note, written by the user's own hand for tomorrow's Mass — nothing
 * about the day itself is kept with it, and clearing the line clears it.
 */
export function saveMassIntention(sundayKey: string, text: string): void {
  try {
    const trimmed = text.trim();
    if (!trimmed) localStorage.removeItem(massIntentionKey(sundayKey));
    else localStorage.setItem(massIntentionKey(sundayKey), trimmed);
  } catch {
    // storage unavailable — the evening still reads; the note just isn't kept
  }
}

const ADVENT_SUNDAY_ORDINALS = ['First', 'Second', 'Third', 'Fourth'];

/**
 * Tomorrow's celebration name for the Saturday block: the calendar's own
 * name first when the day carries a feast or solemnity (data/feastDays —
 * Gaudete, Christ the King), then the lectionary's celebration for the
 * day when the readings path supplies it, then the season's own Sunday
 * name ("First Sunday of Advent" in Advent, a Sunday of the season
 * elsewhere). A memorial that happens to share the Sunday's date yields:
 * the Sunday is the day's celebration, as at Mass.
 */
export function sundayCelebrationName(sunday: Date, readingsCelebration?: string | null): string {
  const feast = getFeastForDate(sunday);
  if (feast && (feast.rank === 'feast' || feast.rank === 'solemnity')) return feast.name;
  if (readingsCelebration) return readingsCelebration;
  const season = getCurrentSeason(sunday);
  if (season.season === 'advent') {
    const start = getAdventStart(sunday.getFullYear());
    const week = Math.floor((sunday.getTime() - start.getTime()) / (7 * 86400000));
    const ordinal = ADVENT_SUNDAY_ORDINALS[week];
    if (ordinal) return `${ordinal} Sunday of Advent`;
  }
  return `Sunday in ${season.name}`;
}

/**
 * Tonight — the day's closing on Today (Erik's ruling, Nov 12, 2026). The
 * Examen retired as an on-screen tool: its movements — gratitude, one honest
 * look, one resolve — are the SHAPE of this section, not a labeled checklist.
 * Everything here is composed on the device from pieces the day already
 * carried (the morning's challenge, the tailored devotional's
 * stated focus). Nothing is checked, streaked, or scored; the section reads
 * in under thirty seconds. The one thing it keeps is tomorrow's resolve,
 * written by the user's own hand and stored on this device only. Stage 1 of
 * the printed-page re-skin (Nov 14, 2026) sets it as the page's closing
 * section, under a double rule — contents and the resolve input unchanged.
 */
export function TonightClosing({ t, audience, onOpenHelp }: TonightClosingProps) {
  const [now] = useState(() => new Date());
  // The closing belongs to the content day (Play 7): before the 04:00 flip
  // it is still last night's closing, keyed to yesterday's date.
  const dateKey = contentDateKey(now);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [resolve, setResolve] = useState<string>(() => {
    const stored = loadTonightResolve();
    return stored && stored.date === dateKey ? stored.text : '';
  });

  // The tailored morning, remembered: read once from the on-device tailor meta.
  const [tailorMeta] = useState(() => readTailorMeta(dateKey, audience));
  const tailorFocus = tailorMeta?.focus ?? null;

  // The evening cue (Play 4, retention build Nov 16, 2026): the content
  // day's own tailor record decides — a morning build exists and tonight's
  // close has not been written yet, so the evening says so plainly, here
  // in the app only. The plate at the foot of this section is the close
  // itself; this line is how a morning-only user finds it.
  const contentKey = contentDateKey(now);
  const [cueMeta] = useState(() => readTailorMeta(contentKey, audience));
  const [pmCloseDone] = useState(() => Boolean(loadTonightsClose(contentKey, audience)));
  const showEveningCue = Boolean(cueMeta?.morning) && !pmCloseDone;

  // Tomorrow at Mass (Play 8): on Saturday — the content day's Saturday,
  // so the small hours of Sunday still belong to this evening — Tonight
  // also looks one day ahead, to Sunday's Mass.
  const isSaturday = contentDate(now).getDay() === 6;
  const sundayKey = shiftDateKey(contentKey, 1);
  const [sundayDate] = useState(() => {
    const [y, m, d] = sundayKey.split('-').map((part) => Number(part));
    return new Date(y, (m || 1) - 1, d || 1);
  });
  const [celebrationName, setCelebrationName] = useState(() => sundayCelebrationName(sundayDate));
  const [sundayVerse, setSundayVerse] = useState<KeyVerse | null>(null);
  const [massIntention, setMassIntention] = useState(() => loadMassIntention(sundayKey));
  const massSection = getHelpSections(audience).find((s) => s.id === 'mass');

  useEffect(() => {
    let live = true;
    void fetchReflection(dateKey, audience).then((r) => {
      if (live && r?.challenge) setChallenge(r.challenge);
    });
    return () => {
      live = false;
    };
  }, [dateKey, audience]);

  // Sunday's name and Gospel, by the by-date readings path — the same
  // explicit-date serving the rest of the app uses, aimed one day ahead.
  useEffect(() => {
    if (!isSaturday) return;
    let live = true;
    void (async () => {
      const readings = await fetchDailyReadings(sundayDate);
      if (!live || !readings) return;
      setCelebrationName(sundayCelebrationName(sundayDate, readings.celebration));
      if (readings.gospel) {
        const verses = await fetchPassageVerses(readings.gospel);
        if (live && verses) setSundayVerse(pickKeyVerse(verses));
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSaturday, sundayKey]);

  const onResolveChange = (value: string) => {
    setResolve(value);
    // Dated by the content day it was written in, so a resolve typed at
    // 01:30 is last night's — and surfaces the morning that follows it.
    saveTonightResolve(value, contentNow(now));
    // A resolve written is the day closed in the user's own hand — one of
    // the day's core acts (Play 4). An emptied line records nothing.
    if (value.trim()) recordCoreAct('tonight');
  };

  const onMassIntentionChange = (value: string) => {
    setMassIntention(value);
    saveMassIntention(sundayKey, value);
  };

  return (
    <div className="px-1 pt-4" style={{ borderTop: `3px double ${t.border}` }}>
      <div className="flex items-center gap-2.5 mb-3">
        <Moon className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} />
        <span
          className="text-sm font-bold uppercase tracking-wide"
          style={{ fontFamily: PRINT_SERIF, color: t.textBright }}
        >
          Tonight
        </span>
      </div>

      <p
        className="text-[13px] italic leading-relaxed mb-2.5"
        style={{ fontFamily: PRINT_SERIF, color: t.text }}
      >
        {gratitudeForDate(dateKey)}
      </p>

      {showEveningCue && (
        <p
          data-evening-cue
          className="text-xs leading-relaxed mb-2.5 px-3 py-2.5"
          style={{
            fontFamily: PRINT_SERIF,
            color: t.text,
            border: `1px solid ${t.border}`,
            backgroundColor: `${t.border}1F`,
          }}
        >
          This morning you tailored today&rsquo;s devotional. Tonight it can be closed
          against the day it became — <span className="font-bold">Close the day</span> stands
          at the foot of this section.
        </p>
      )}

      {tailorFocus && (
        <p
          className="text-xs leading-relaxed mb-2.5"
          style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}
        >
          {tailorEchoLine(tailorFocus)}
        </p>
      )}

      {challenge && (
        <p
          className="text-xs leading-relaxed mb-3.5"
          style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}
        >
          {honestLookLine(challenge)}
        </p>
      )}

      <label
        htmlFor="tonight-resolve"
        className="block text-[10px] font-bold uppercase tracking-[0.15em] mb-1.5"
        style={{ color: t.textDim }}
      >
        One resolve for tomorrow
      </label>
      <input
        id="tonight-resolve"
        type="text"
        value={resolve}
        onChange={(e) => onResolveChange(e.target.value)}
        placeholder="One thing, kept small enough to keep."
        className="w-full bg-transparent border-b pb-1.5 text-[13px] leading-relaxed outline-none"
        style={{ fontFamily: PRINT_SERIF, borderColor: `${t.border}99`, color: t.text }}
      />

      {/* Tomorrow at Mass — the Saturday edition's look ahead (Play 8).
          Tomorrow's celebration, one verse of its Gospel to carry in, and
          one intention in the user's own words, kept on this device only
          as preparation. The Mass door of Real Help stands here in its
          own words, with the way onward to the full surface. */}
      {isSaturday && (
        <div data-tomorrow-at-mass className="mt-4 pt-3.5" style={{ borderTop: `1px solid ${t.border}` }}>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1.5"
            style={{ fontFamily: PRINT_SERIF, color: t.accent }}
          >
            Tomorrow at Mass
          </p>
          <p
            className="text-[15px] font-semibold leading-snug mb-2"
            style={{ fontFamily: PRINT_SERIF, color: t.textBright }}
          >
            {celebrationName}
          </p>

          {sundayVerse && (
            <div className="mb-3">
              <p className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: t.textDim }}>
                Sunday&rsquo;s Gospel &middot; {sundayVerse.citation}
              </p>
              <p
                className="text-[13px] italic leading-relaxed"
                style={{ fontFamily: PRINT_SERIF, color: t.text }}
              >
                {sundayVerse.text}
              </p>
            </div>
          )}

          <label
            htmlFor="mass-intention"
            className="block text-[10px] font-bold uppercase tracking-[0.15em] mb-1.5"
            style={{ color: t.textDim }}
          >
            Bring to Mass tomorrow:
          </label>
          <input
            id="mass-intention"
            type="text"
            value={massIntention}
            onChange={(e) => onMassIntentionChange(e.target.value)}
            placeholder="One intention, in your own words."
            className="w-full bg-transparent border-b pb-1.5 text-[13px] leading-relaxed outline-none mb-3"
            style={{ fontFamily: PRINT_SERIF, borderColor: `${t.border}99`, color: t.text }}
          />

          {massSection && (
            <div data-mass-entry>
              <p className="text-[13px] font-bold" style={{ fontFamily: PRINT_SERIF, color: t.textBright }}>
                {massSection.title}
              </p>
              <p className="text-[11px] mb-2" style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}>
                {massSection.tagline}
              </p>
              {onOpenHelp && (
                <button
                  onClick={onOpenHelp}
                  className={PRINT_PLATE_CLASS}
                  style={{ backgroundColor: `${t.border}1F`, border: `1px solid ${t.border}` }}
                >
                  <Church className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} />
                  <span className="flex-1">
                    <span className="block text-[12px] font-bold" style={{ fontFamily: PRINT_SERIF, color: t.text }}>
                      Real Help · Mass
                    </span>
                    <span className="block text-[10px]" style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>
                      Find a parish and its Mass times
                    </span>
                  </span>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Close the day (the Tailor PM twin, Nov 14, 2026): only when this
          morning's Tailor build exists on the device — the meta's morning
          record is the twin's whole material. No morning build, no plate. */}
      {tailorMeta?.morning && (
        <TailorPm t={t} audience={audience} dateKey={dateKey} morning={tailorMeta.morning} />
      )}
    </div>
  );
}
