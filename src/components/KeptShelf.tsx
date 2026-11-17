import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { PRINT_PLATE_CLASS, PRINT_SERIF, PRINT_STAMP_CLASS } from '@/lib/print';
import {
  keptDaysBetween,
  loadKeptDays,
  loadMonthExamenSeen,
  markMonthExamenSeen,
  monthExamenCandidate,
  type MonthExamenCandidate,
} from '@/lib/keptDays';
import { keptWeeks, weekIsKept, weekRangeOf, type KeptWeek } from '@/lib/keptWeeks';
import { loadDaysPrayedDates } from '@/lib/daysPrayed';
import { letterFramingLine, listLetters } from '@/lib/letters';
import { listChallengesLived } from '@/lib/challengesLived';
import { fetchDailyReadings } from '@/lib/readings';
import { sundayCelebrationName } from '@/components/TonightClosing';
import type { Audience, PersonaTheme } from '@/types';

interface KeptShelfProps {
  t: PersonaTheme;
  audience: Audience;
  /** The content day this Tonight belongs to, YYYY-MM-DD. */
  dateKey: string;
}

function dateOfKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map((part) => Number(part));
  return new Date(y, (m || 1) - 1, d || 1);
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sunday, Nov 16" — the day named the way a journal page names it. */
function readableDay(dateKey: string): string {
  const d = dateOfKey(dateKey);
  return `${WEEKDAY_NAMES[d.getDay()]}, ${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`;
}

/** "Nov 9 – Nov 15" — a week's span, both ends named in full. */
function spanLabel(week: KeptWeek): string {
  const start = dateOfKey(week.weekStartKey);
  const end = dateOfKey(week.weekEndKey);
  return `${MONTH_ABBR[start.getMonth()]} ${start.getDate()} – ${MONTH_ABBR[end.getMonth()]} ${end.getDate()}`;
}

/**
 * One kept week's card: its span, its Sunday's celebration name, and —
 * when the readings path answers — its Sunday's Gospel citation. The
 * fetch is per card and the cards are few; a silent absence is the
 * graceful state, never an error shown.
 */
function KeptWeekCard({ t, week }: { t: PersonaTheme; week: KeptWeek }) {
  const [sundayDate] = useState(() => dateOfKey(week.sundayKey));
  const [celebration, setCelebration] = useState(() => sundayCelebrationName(sundayDate));
  const [gospel, setGospel] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void fetchDailyReadings(sundayDate).then((readings) => {
      if (!live || !readings) return;
      setCelebration(sundayCelebrationName(sundayDate, readings.celebration));
      if (readings.gospel) setGospel(readings.gospel);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week.sundayKey]);

  return (
    <div
      className="px-3.5 py-3 mb-2"
      style={{ backgroundColor: `${t.border}1F`, border: `1px solid ${t.border}` }}
    >
      <p className="text-[13px] font-bold" style={{ fontFamily: PRINT_SERIF, color: t.textBright }}>
        {spanLabel(week)}
      </p>
      <p className="text-[12px] mt-0.5" style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}>
        {celebration}
      </p>
      {gospel && (
        <p className="text-[12px] mt-0.5" style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>
          Sunday&rsquo;s Gospel &middot; {gospel}
        </p>
      )}
    </div>
  );
}

/**
 * The Kept shelf (incentives build, Nov 16, 2026) — the foot of Tonight,
 * where what Sanctum has kept for the user is given back: this week's
 * pages on a Sunday, last month's pages as an examen when the month
 * held enough of them, the kept weeks, and the journal of kept days.
 *
 * Everything here only ever gives back. Nothing counts down, expires,
 * resets, or compares; a section stands only when it has something to
 * hand over, and the whole shelf renders nothing over a void. All of it
 * is read from this device — kept days, prayed days, the examen's seen
 * mark — and none of it leaves the device.
 *
 * The foot of the shelf holds the lived challenges (a journal, listed,
 * never totalled) and the companions' letters, kept to be re-read.
 */
export function KeptShelf({ t, dateKey }: KeptShelfProps) {
  const [kept] = useState(loadKeptDays);
  const [prayedDates] = useState(loadDaysPrayedDates);
  // The candidate is judged against the content day this Tonight belongs
  // to (midday of dateKey, so the 04:00 derivation lands on the same day).
  const [candidate] = useState<MonthExamenCandidate | null>(() => {
    const d = dateOfKey(dateKey);
    d.setHours(12, 0, 0, 0);
    return monthExamenCandidate(d);
  });
  const [seen, setSeen] = useState<string | null>(loadMonthExamenSeen);
  const [examenOpen, setExamenOpen] = useState(false);
  const [letters] = useState(listLetters);
  const [lived] = useState(listChallengesLived);
  const [openLetter, setOpenLetter] = useState<string | null>(null);

  // Sunday harvest: on a Sunday, this week's kept pages read back plainly.
  const isSunday = dateOfKey(dateKey).getDay() === 0;
  const { weekStartKey, weekEndKey } = weekRangeOf(dateKey);
  const harvest = isSunday ? keptDaysBetween(kept, weekStartKey, weekEndKey) : [];
  const harvestIsKeptWeek = harvest.length > 0 && weekIsKept(prayedDates, dateKey);

  const weeks = keptWeeks(prayedDates, dateKey);
  const examenOffered = Boolean(candidate) && seen !== candidate?.monthKey;

  const hasContent =
    harvest.length > 0 ||
    examenOpen ||
    examenOffered ||
    weeks.length > 0 ||
    kept.length > 0 ||
    lived.length > 0 ||
    letters.length > 0;
  if (!hasContent) return null;

  const openExamen = () => {
    if (!candidate) return;
    markMonthExamenSeen(candidate.monthKey);
    setSeen(candidate.monthKey);
    setExamenOpen(true);
  };

  const closeExamen = () => {
    if (candidate) {
      markMonthExamenSeen(candidate.monthKey);
      setSeen(candidate.monthKey);
    }
    setExamenOpen(false);
  };

  const sectionRule = { borderTop: `1px solid ${t.border}` } as const;

  return (
    <div data-kept-shelf>
      {harvest.length > 0 && (
        <div className="mt-4 pt-3.5" style={sectionRule}>
          <p className={PRINT_STAMP_CLASS} style={{ fontFamily: PRINT_SERIF, color: t.accent }}>
            This week, kept
          </p>
          <div className="mt-2.5 space-y-2.5">
            {harvest.map((entry) => (
              <p
                key={entry.dateKey}
                className="text-[13px] leading-relaxed"
                style={{ fontFamily: PRINT_SERIF, color: t.text }}
              >
                {entry.line}
              </p>
            ))}
          </div>
          {harvestIsKeptWeek && (
            <p
              className="text-[13px] leading-relaxed mt-3"
              style={{ fontFamily: PRINT_SERIF, color: t.textBright }}
            >
              A kept week.
            </p>
          )}
        </div>
      )}

      {candidate && examenOpen ? (
        <div className="mt-4 pt-3.5" style={sectionRule}>
          <p className={PRINT_STAMP_CLASS} style={{ fontFamily: PRINT_SERIF, color: t.accent }}>
            Last month, kept
          </p>
          <p
            className="text-[13px] leading-relaxed mt-2.5"
            style={{ fontFamily: PRINT_SERIF, color: t.text }}
          >
            {candidate.label}, in the lines you carried out of it.
          </p>

          <p className={`${PRINT_STAMP_CLASS} mt-4 mb-1.5`} style={{ color: t.textDim }}>
            Gratitude
          </p>
          <p className="text-[13px] leading-relaxed" style={{ fontFamily: PRINT_SERIF, color: t.text }}>
            Begin with thanks. Name what was given, plainly.
          </p>

          <p className={`${PRINT_STAMP_CLASS} mt-4 mb-1.5`} style={{ color: t.textDim }}>
            Review
          </p>
          <div className="space-y-2.5">
            {candidate.lines.map((line, i) => (
              <p
                key={i}
                className="text-[13px] leading-relaxed"
                style={{ fontFamily: PRINT_SERIF, color: t.text }}
              >
                {line}
              </p>
            ))}
          </div>

          <p className={`${PRINT_STAMP_CLASS} mt-4 mb-1.5`} style={{ color: t.textDim }}>
            Sorrow
          </p>
          <p className="text-[13px] leading-relaxed" style={{ fontFamily: PRINT_SERIF, color: t.text }}>
            Where the month fell short, say so — and take it to Confession.
          </p>

          <p className={`${PRINT_STAMP_CLASS} mt-4 mb-1.5`} style={{ color: t.textDim }}>
            Resolve
          </p>
          <p className="text-[13px] leading-relaxed" style={{ fontFamily: PRINT_SERIF, color: t.text }}>
            One thing for the month ahead, small enough to keep.
          </p>

          <button
            onClick={closeExamen}
            className="text-[12px] font-bold uppercase tracking-[0.15em] mt-4"
            style={{ fontFamily: PRINT_SERIF, color: t.accent }}
          >
            Close
          </button>
        </div>
      ) : (
        examenOffered &&
        candidate && (
          <div className="mt-4 pt-3.5" style={sectionRule}>
            <button
              onClick={openExamen}
              className={PRINT_PLATE_CLASS}
              style={{ backgroundColor: `${t.border}1F`, border: `1px solid ${t.border}` }}
            >
              <span className="flex-1">
                <span
                  className="block text-[13px] font-bold"
                  style={{ fontFamily: PRINT_SERIF, color: t.textBright }}
                >
                  Last month, kept
                </span>
                <span
                  className="block text-[12px] mt-0.5"
                  style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}
                >
                  {`${candidate.label}’s pages are here. Sit with them a while.`}
                </span>
              </span>
              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} />
            </button>
          </div>
        )
      )}

      {weeks.length > 0 && (
        <div className="mt-4 pt-3.5" style={sectionRule}>
          <p className={`${PRINT_STAMP_CLASS} mb-2.5`} style={{ fontFamily: PRINT_SERIF, color: t.accent }}>
            Kept weeks
          </p>
          {[...weeks].reverse().map((week) => (
            <KeptWeekCard key={week.weekStartKey} t={t} week={week} />
          ))}
        </div>
      )}

      {kept.length > 0 && (
        <div className="mt-4 pt-3.5" style={sectionRule}>
          <p className={`${PRINT_STAMP_CLASS} mb-2.5`} style={{ fontFamily: PRINT_SERIF, color: t.accent }}>
            Kept days
          </p>
          <div className="space-y-3.5">
            {[...kept].reverse().map((entry) => (
              <div key={entry.dateKey}>
                <p
                  className="text-[12px] font-bold"
                  style={{ fontFamily: PRINT_SERIF, color: t.textBright }}
                >
                  {readableDay(entry.dateKey)}
                </p>
                <p
                  className="text-[13px] leading-relaxed mt-0.5"
                  style={{ fontFamily: PRINT_SERIF, color: t.text }}
                >
                  {entry.line}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Challenges lived — the journal of the ones that were taken up.
          Listed in the order they were lived, never totalled: the shelf
          keeps them the way a journal does, not the way a scoreboard does. */}
      {lived.length > 0 && (
        <div className="mt-4 pt-3.5" style={sectionRule}>
          <p className={`${PRINT_STAMP_CLASS} mb-2.5`} style={{ fontFamily: PRINT_SERIF, color: t.accent }}>
            Challenges lived
          </p>
          <div className="space-y-3.5">
            {lived.map((entry) => (
              <div key={`${entry.dateKey}-${entry.source}`}>
                <p
                  className="text-[12px] font-bold"
                  style={{ fontFamily: PRINT_SERIF, color: t.textBright }}
                >
                  {readableDay(entry.dateKey)}
                </p>
                <p
                  className="text-[13px] leading-relaxed mt-0.5"
                  style={{ fontFamily: PRINT_SERIF, color: t.text }}
                >
                  {entry.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Letters — a companion's letter, once left for the user, is kept
          here to be re-read. Each stands under its writer's name and the
          day it came; the text opens on a tap and folds away again. */}
      {letters.length > 0 && (
        <div className="mt-4 pt-3.5" style={sectionRule}>
          <p className={`${PRINT_STAMP_CLASS} mb-2.5`} style={{ fontFamily: PRINT_SERIF, color: t.accent }}>
            Letters
          </p>
          <div className="space-y-2">
            {letters.map((letter) => {
              const key = `${letter.dateKey}-${letter.personaId}`;
              const open = openLetter === key;
              return (
                <div
                  key={key}
                  className="px-3.5 py-3"
                  style={{ backgroundColor: `${t.border}1F`, border: `1px solid ${t.border}` }}
                >
                  <button
                    onClick={() => setOpenLetter(open ? null : key)}
                    aria-expanded={open}
                    className="w-full text-left transition-opacity hover:opacity-80"
                  >
                    <span
                      className="block text-[13px] font-bold"
                      style={{ fontFamily: PRINT_SERIF, color: t.textBright }}
                    >
                      A letter from {letter.personaName}
                    </span>
                    <span
                      className="block text-[12px] mt-0.5"
                      style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}
                    >
                      {readableDay(letter.dateKey)} &middot; {open ? 'fold it away' : 'read it again'}
                    </span>
                  </button>
                  {open && (
                    <>
                      <p
                        className="text-[13px] leading-relaxed mt-2.5 whitespace-pre-wrap"
                        style={{ fontFamily: PRINT_SERIF, color: t.text }}
                      >
                        {letter.text}
                      </p>
                      {letterFramingLine(letter) && (
                        <p
                          className="text-[12px] mt-2"
                          style={{ fontFamily: PRINT_SERIF, color: t.textDim }}
                        >
                          {letterFramingLine(letter)}
                        </p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
