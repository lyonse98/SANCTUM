import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ExternalLink,
  Loader2,
  Share2,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';
import { quoteForDay } from '@/data/quotes';
import { fetchDailyReadings, type DailyReadings } from '@/lib/readings';
import { fetchReadingsBundle } from '@/lib/readingsBundle';
import { contentDate, contentDateKey } from '@/lib/dayBoundary';
import { getFeastForDate, type FeastRank } from '@/data/feastDays';
import {
  fetchPassageVerses,
  fetchReadingTexts,
  type Passage,
  type PassageVerses,
  type ReadingTexts,
} from '@/lib/bible';
import { pickKeyVerse, type KeyVerse } from '@/lib/keyVerse';
import {
  fetchReflection,
  nextReflectionFetch,
  reflectionDisplay,
  type Reflection,
} from '@/lib/reflection';
import { PRINT_PLATE_CLASS, PRINT_SERIF, PRINT_STAMP_CLASS } from '@/lib/print';
import { scaledBodyPx, useReadingSize } from '@/lib/readingSize';
import { ListenBar } from '@/components/ListenBar';
import { TailorToday, type TailorReflectRequest } from '@/components/TailorToday';
import { DailyGospelShareModal } from '@/components/DailyGospelShareModal';
import type { Audience, PersonaTheme } from '@/types';

const FEAST_RANK_LABEL: Record<FeastRank, string> = {
  solemnity: 'Solemnity',
  feast: 'Feast',
  memorial: 'Memorial',
  'optional-memorial': 'Optional Memorial',
};
function feastRankLabel(rank: FeastRank): string {
  return FEAST_RANK_LABEL[rank];
}

interface DailyQuoteProps {
  t: PersonaTheme;
  audience: Audience;
  onReflectWithCompanion?: (prompt: string) => void;
  /** Opens the reminder form — handed to the Listen bar for its one-time post-listen line. */
  onOpenReminder?: () => void;
  /**
   * Settings' "Edit Tailor profile" lands here (Erik, Nov 18, 2026):
   * while true, the card opens its Tailor panel with the standing-
   * profile editor open, then consumes the request via the callback.
   */
  tailorProfileOpen?: boolean;
  onConsumeTailorProfileOpen?: () => void;
  /**
   * The tailor-ready poke's landing (Nov 18, 2026): while true, the card
   * opens its Tailor panel — the finished devotional the poke announced —
   * then consumes the request via the callback.
   */
  tailorOpen?: boolean;
  onConsumeTailorOpen?: () => void;
}

/** The two doors share the printed page's one plate class — equals, by construction. */
const DOOR_CLASS = PRINT_PLATE_CLASS;

type CardPanel = 'none' | 'tailor';

export interface ReadingRow {
  label: string;
  citation: string | null;
  passage: Passage | null | undefined;
}

/**
 * The day's readings in lectionary order — First, Psalm, Second (only on the
 * days that have one), Gospel — as the card's body. Rows are keyed by their
 * lectionary citation; a row exists only when the day actually has that
 * reading, so a weekday without a Second Reading simply has three rows.
 */
export function orderedReadingRows(readings: DailyReadings, texts: ReadingTexts | null): ReadingRow[] {
  return (
    [
      { label: 'First Reading', citation: readings.firstReading, passage: texts?.first },
      { label: 'Responsorial Psalm', citation: readings.psalm, passage: texts?.psalm },
      { label: 'Second Reading', citation: readings.secondReading, passage: texts?.second },
      { label: 'Gospel', citation: readings.gospel, passage: texts?.gospel },
    ] as ReadingRow[]
  ).filter((row) => row.citation);
}

export function DailyQuote({ t, audience, onReflectWithCompanion, onOpenReminder, tailorProfileOpen, onConsumeTailorProfileOpen, tailorOpen, onConsumeTailorOpen }: DailyQuoteProps) {
  // The reading size (Erik, Nov 18, 2026): the card's devotional body
  // text — the key verse, the full readings, the reflection, the
  // challenge — is set at the reader's chosen size; labels and doors
  // keep theirs. Standard is the size the card has always worn.
  const readingSize = useReadingSize();
  const bodyPx = (base: number) => scaledBodyPx(base, readingSize);
  const quote = useMemo(() => quoteForDay(contentDate(), audience), [audience]);
  const feast = useMemo(() => getFeastForDate(contentDate()), []);
  // Rubrication (the printed-page re-skin, Erik, Nov 14, 2026): on feasts and
  // solemnities the day's name and the Gospel's drop cap take the calendar's
  // accent; memorials and ordinary days stay quiet. The calendar still owns
  // the accent itself — this only decides where it is spent.
  const rubricated = feast?.rank === 'feast' || feast?.rank === 'solemnity';
  const [readings, setReadings] = useState<DailyReadings | null>(null);
  const [gospelVerses, setGospelVerses] = useState<PassageVerses | null>(null);
  const [allTexts, setAllTexts] = useState<ReadingTexts | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAll, setLoadingAll] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [panel, setPanel] = useState<CardPanel>('none');
  // Settings' profile request (Erik, Nov 18, 2026): the flag opens the
  // Tailor panel and bumps the nonce the panel's editor listens for,
  // then the request is consumed — Settings is one tap away from the
  // same editor the intake carries, never a second one.
  const [profileOpenSignal, setProfileOpenSignal] = useState(0);
  useEffect(() => {
    if (!tailorProfileOpen) return;
    setPanel('tailor');
    setProfileOpenSignal((n) => n + 1);
    onConsumeTailorProfileOpen?.();
  }, [tailorProfileOpen, onConsumeTailorProfileOpen]);
  // The tailor-ready poke's landing: the panel alone, no editor — the
  // tap promised something to listen to, not something to fill in.
  useEffect(() => {
    if (!tailorOpen) return;
    setPanel('tailor');
    onConsumeTailorOpen?.();
  }, [tailorOpen, onConsumeTailorOpen]);
  // A spent signal is spent: once the panel closes, the nonce resets,
  // so a later ordinary opening of the door never inherits the request.
  useEffect(() => {
    if (panel === 'none' && profileOpenSignal !== 0) setProfileOpenSignal(0);
  }, [panel, profileOpenSignal]);
  const [expanded, setExpanded] = useState(false);
  const [staleDate, setStaleDate] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      // Primary path: the server-assembled, day-cached bundle — for the
      // content day (Play 7), which before 04:00 is still yesterday.
      const bundle = await fetchReadingsBundle(contentDate());
      if (!active) return;
      if (bundle) {
        setReadings(bundle.citations);
        setGospelVerses(bundle.gospelVerses);
        setAllTexts(bundle.texts);
        if (bundle.stale) setStaleDate(bundle.staleDate ?? bundle.citations.date);
        setLoading(false);
        return;
      }
      // Fallback: the old direct path (client calls the lectionary + Bible APIs itself).
      const citations = await fetchDailyReadings(contentDate());
      if (!active) return;
      setReadings(citations);
      if (citations?.gospel) {
        const verses = await fetchPassageVerses(citations.gospel);
        if (!active) return;
        setGospelVerses(verses);
      }
      if (active) {
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // The key verse is the card's collapsed face again (Erik, Nov 13, 2026
  // evening — the pre-diet arrangement restored): the most quotable line of
  // the day's Gospel, picked by the deterministic scorer in lib/keyVerse.
  // The share card also paints from it, exactly as before.
  const keyVerse: KeyVerse | null = useMemo(
    () => (gospelVerses ? pickKeyVerse(gospelVerses) : null),
    [gospelVerses],
  );
  // The day's date key, computed locally at mount — the content day's key
  // (Play 7), the same day the readings bundle keys its request by — so the
  // reflection fetch below targets the same day the bundle will, without
  // waiting for the bundle to say so.
  const [localDateKey] = useState(() => contentDateKey());
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const [reflectionFor, setReflectionFor] = useState<string | null>(null);
  const [reflectionAudience, setReflectionAudience] = useState<Audience | null>(null);
  const [reflectionBusyFor, setReflectionBusyFor] = useState<string | null>(null);
  const [reflectionBusyAudience, setReflectionBusyAudience] = useState<Audience | null>(null);
  const reflectionFetchSeq = useRef(0);

  // The reflection is pre-generated server-side from the day's readings, the way a
  // homily would read them — not yanked from a single verse — and it answers fast.
  // The readings bundle can be slow (its fallback assembles the day from third-party
  // APIs in sequence), so the reflection fetch fires in parallel with the readings
  // load, keyed to the locally computed date, instead of waiting behind it. When the
  // bundle does resolve, its date is authoritative: if it differs (a midnight edge,
  // or a stale bundle), the reflection realigns to the bundle's date — the reflection
  // shown always matches the Gospel shown. The settled state is a (date, audience)
  // pair, so a track switch in Settings owes the new track its own fetch: the other
  // track's reflection — facet included — is never displayed here. The coordination
  // rules live with the fetcher (nextReflectionFetch / reflectionDisplay in lib/reflection).
  useEffect(() => {
    const want = nextReflectionFetch(
      {
        settledFor: reflectionFor,
        inFlightFor: reflectionBusyFor,
        settledAudience: reflectionAudience,
        inFlightAudience: reflectionBusyAudience,
      },
      localDateKey,
      readings?.date ?? null,
      audience,
    );
    if (!want) return;
    const seq = ++reflectionFetchSeq.current;
    setReflectionBusyFor(want);
    setReflectionBusyAudience(audience);
    void (async () => {
      const result = await fetchReflection(want, audience);
      if (reflectionFetchSeq.current !== seq) return;
      setReflection(result);
      setReflectionFor(want);
      setReflectionAudience(audience);
      setReflectionBusyFor(null);
      setReflectionBusyAudience(null);
    })();
  }, [localDateKey, readings, reflectionFor, reflectionBusyFor, reflectionAudience, reflectionBusyAudience, audience]);

  // What the reflection block may show right now: the settled reflection once it
  // belongs to the day — and the track — on display, a pending state while a fetch
  // (or the realigning fetch) is outstanding — never another date's reflection,
  // and never the other track's.
  const shown = reflectionDisplay(
    {
      settledFor: reflectionFor,
      inFlightFor: reflectionBusyFor,
      settledAudience: reflectionAudience,
      inFlightAudience: reflectionBusyAudience,
      value: reflection,
    },
    readings?.date ?? null,
    audience,
  );

  // The challenge stands here unmarked (Erik, Nov 19, 2026): the
  // lived-mark testimony moved to Tonight, at the day's close —
  // the morning proposes, the evening answers. The journal and the
  // Kept shelf are untouched; only the marking's home moved.

  const loadAllTexts = async (): Promise<ReadingTexts | null> => {
    if (allTexts) return allTexts;
    if (!readings) return null;
    setLoadingAll(true);
    const texts = await fetchReadingTexts({
      firstReading: readings.firstReading,
      psalm: readings.psalm,
      secondReading: readings.secondReading,
      gospel: readings.gospel,
    });
    setAllTexts(texts);
    setLoadingAll(false);
    return texts;
  };

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) void loadAllTexts();
  };

  // The full-text fetch fires in the background as soon as the citations land,
  // so expanding the readings — and building the companion reflection prompt —
  // never waits on it.
  useEffect(() => {
    if (readings && !allTexts && !loadingAll) {
      void loadAllTexts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readings]);

  // The readings block both companion prompts open with: the day's
  // readings, entire, in lectionary order — the card's own Reflect
  // door and the Tailor panel's door share this head, word for word.
  const buildReadingsLines = (texts: ReadingTexts | null): string[] => {
    const lines: string[] = [];
    const celebration = readings?.celebration ? ` — ${readings.celebration}` : '';
    lines.push(`Today the Church reads the following${celebration}:`);

    const add = (label: string, citation: string | null | undefined, passage: Passage | null | undefined) => {
      if (!citation) return;
      lines.push(`\n${label}: ${citation}`);
      if (passage?.text) lines.push(`"${passage.text}"`);
    };

    add('First Reading', readings?.firstReading, texts?.first);
    add('Psalm', readings?.psalm, texts?.psalm);
    add('Second Reading', readings?.secondReading, texts?.second);
    add('Gospel', readings?.gospel, texts?.gospel);

    if (!readings) {
      lines.push(`"${quote.text}" — ${quote.author}${quote.source ? ', ' + quote.source : ''}`);
    }

    return lines;
  };

  const buildReflectionPrompt = (texts: ReadingTexts | null) => {
    const lines = buildReadingsLines(texts);
    lines.push(
      `\nReflect on these readings through your eyes. What do they mean for ${audience === 'women' ? 'a woman' : 'a man'} walking the road today? What truth do they uncover, and what do they ask of ${audience === 'women' ? 'her' : 'him'}?`,
    );
    return lines.join('\n');
  };

  const handleReflectWithCompanion = async () => {
    if (!onReflectWithCompanion || preparing) return;
    setPreparing(true);
    // Send the whole day's readings, not just the key verse.
    const texts = allTexts ?? (await loadAllTexts());
    setPreparing(false);
    onReflectWithCompanion(buildReflectionPrompt(texts));
  };

  /**
   * The Tailor panel's Reflect prompt (Erik, Nov 19, 2026): the same
   * readings head, then the built devotional's own words — its
   * reflection, its challenge, the word from the tradition when one
   * was found — and an ask to go further with them. The request the
   * panel hands over carries nothing else: the morning's sentence,
   * the profile, the passage and the media pick never ride into a chat.
   */
  const buildTailoredReflectionPrompt = (texts: ReadingTexts | null, request: TailorReflectRequest) => {
    const lines = buildReadingsLines(texts);
    lines.push('\nThis morning a devotional was tailored for my day from these readings. Its reflection:');
    lines.push(`"${request.reflect}"`);
    lines.push('\nIts challenge:');
    lines.push(`"${request.challenge}"`);
    if (request.traditionQuote) {
      lines.push(`\nAnd a word from the tradition — ${request.traditionQuote.author}: "${request.traditionQuote.text}"`);
    }
    lines.push(
      `\nHelp me reflect further on this devotional — what it asks of ${audience === 'women' ? 'a woman' : 'a man'} walking the road today, and how to live it.`,
    );
    return lines.join('\n');
  };

  const handleReflectTailoredWithCompanion = async (request: TailorReflectRequest) => {
    if (!onReflectWithCompanion || preparing) return;
    setPreparing(true);
    const texts = allTexts ?? (await loadAllTexts());
    setPreparing(false);
    onReflectWithCompanion(buildTailoredReflectionPrompt(texts, request));
  };

  // Citations come from the lectionary, texts from the Bible fetch; a row
  // whose text could not be supplied still shows its citation, so the day is
  // never silently short a reading.
  const orderedReadings = readings ? orderedReadingRows(readings, allTexts) : [];

  // The key verse opens with a drop cap, the way a printed Gospel does — the
  // first letter set large in the serif voice, rubricated on the days the
  // calendar marks. A verse that opens with punctuation keeps its plain face.
  const kvText = keyVerse?.text ?? '';
  const kvDropCap = /^[A-Za-z]/.test(kvText);

  return (
    <div className="w-full px-1 py-1">
      <div
        className="flex items-center justify-between gap-2 pb-2 mb-3"
        style={{ borderBottom: `1px solid ${t.border}` }}
      >
        <span
          className="text-[12px] font-bold uppercase tracking-[0.2em]"
          style={{ fontFamily: PRINT_SERIF, color: t.accent }}
        >
          Today&rsquo;s Gospel
        </span>
        <span className="flex items-center gap-2 min-w-0">
          {readings?.season && (
            <span className="text-[12px] uppercase tracking-widest font-bold truncate" style={{ color: t.textDim }}>
              {readings.season}
            </span>
          )}
        </span>
      </div>

      {/* The day's celebration, named beside its rank — except on an
          optional memorial (Erik, Nov 18, 2026): the day's name stands
          nowhere on the card's default face that day; it is named only
          inside the expanded readings below, and in the narration. */}
      {readings?.celebration && feast?.rank !== 'optional-memorial' && (
        <div className="flex items-baseline gap-2 mb-3">
          <span
            className="text-[12px] uppercase tracking-widest font-bold flex-shrink-0"
            style={{ color: t.accent }}
          >
            {feast ? feastRankLabel(feast.rank) : 'Today'}
          </span>
          <p
            className="text-[13px]"
            style={{
              fontFamily: PRINT_SERIF,
              fontWeight: rubricated ? 700 : 600,
              color: rubricated ? t.accent : t.textMuted,
            }}
          >
            {readings.celebration}
          </p>
        </div>
      )}

      {/* The program (Stage 1 of the printed-page re-skin, Erik, Nov 14,
          2026): Listen stands at the head of the Gospel section as the
          day's program strip — the same Listen bar, its length, its seek
          slider — instead of behind a tile. It mounts when the day's
          readings land, exactly as the tile's panel did. */}
      {!loading && readings?.date && (
        <ListenBar t={t} dateKey={readings.date} citation={readings.gospel ?? null} audience={audience} onOpenReminder={onOpenReminder} />
      )}

      {!loading && staleDate && (
        <p className="text-[13px] mb-3" style={{ color: t.textDim }}>
          Showing the readings for {new Date(`${staleDate}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })} — today&rsquo;s could not be loaded.
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-2" style={{ color: t.textDim }}>
          <Loader2 className="w-3 h-3 animate-spin" />
          <span className="text-[12px]">Loading today&rsquo;s Gospel&hellip;</span>
        </div>
      )}

      {/* The verse to sit with — the card's collapsed face (Erik, Nov 13, 2026
          evening, restoring the arrangement he preferred): before anything is
          expanded, the card defaults to the most quotable part of the Gospel.
          The full readings — all of them, in lectionary order — live behind
          the expander directly beneath it (Erik's order, Nov 14, 2026). */}
      {!loading && readings && keyVerse && (
        <>
          <p className="text-[12px] uppercase tracking-widest font-bold mb-1.5" style={{ color: t.textDim }}>
            The Gospel &middot; {keyVerse.citation}
          </p>
          <p
            className="leading-relaxed mb-3"
            style={{
              fontFamily: PRINT_SERIF,
              color: t.textBright,
              fontSize: bodyPx(17),
              // A short verse still gives the floated cap its full height.
              minHeight: kvDropCap ? '2.55em' : undefined,
            }}
          >
            {kvDropCap ? (
              <>
                <span
                  style={{
                    float: 'left',
                    fontSize: '3.05em',
                    lineHeight: 0.82,
                    paddingRight: '0.1em',
                    paddingTop: '0.04em',
                    fontWeight: 600,
                    color: rubricated ? t.accent : t.textBright,
                  }}
                >
                  {kvText.charAt(0)}
                </span>
                {kvText.slice(1)}
              </>
            ) : (
              kvText
            )}
          </p>
        </>
      )}

      {/* Offline fallback — only when the readings themselves could not be
          loaded at all: a word for the day stands in, as it always has. */}
      {!loading && !readings && (
        <>
          <p className="text-[12px] uppercase tracking-widest font-bold mb-1" style={{ color: t.textDim }}>
            A word for today
          </p>
          <p
            className="italic leading-relaxed mb-2"
            style={{ fontFamily: PRINT_SERIF, color: t.textBright, fontSize: bodyPx(14) }}
          >
            &ldquo;{quote.text}&rdquo;
          </p>
          <p className="text-[12px] mb-3 font-medium" style={{ color: t.textDim }}>
            — {quote.author}
            {quote.source && <span className="opacity-70">, {quote.source}</span>}
          </p>
        </>
      )}

      {/* The full readings, directly under the verse (Erik's order,
          Nov 14, 2026): snippet, then the readings entire, then the
          reflection and the challenge. The toggle and its expanded
          section — all of them, in lectionary order, First, Psalm,
          Second where the day has one, and the Gospel last, the way
          they are heard at Mass — moved up here from the card's foot;
          the state and the labels are unchanged. */}
      {!loading && readings && (
        <button
          onClick={toggleExpanded}
          aria-expanded={expanded}
          className="w-full flex items-center justify-center gap-1 text-[12px] font-bold uppercase tracking-widest mt-3 transition-opacity hover:opacity-70"
          style={{ color: t.accent }}
        >
          {expanded ? 'Hide the full readings' : 'Read the full readings'}
          <ChevronDown
            className="w-3 h-3 transition-transform"
            style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
          />
        </button>
      )}

      {expanded && readings && (
        <div className="space-y-4 pt-3 mt-3 border-t animate-fade-in" style={{ borderColor: `${t.border}66` }}>
          {/* An optional memorial is named here, and only here on the
              card (Erik, Nov 18, 2026): one quiet line at the head of
              the readings the reader chose to open. */}
          {feast?.rank === 'optional-memorial' && (
            <p
              data-optional-memorial-line
              className="text-[12px] italic"
              style={{ fontFamily: PRINT_SERIF, color: t.textDim }}
            >
              {feastRankLabel(feast.rank)} of {feast.name}
            </p>
          )}

          {loadingAll && !allTexts && (
            <div className="flex items-center gap-2" style={{ color: t.textDim }}>
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-[12px]">Loading the day&rsquo;s readings&hellip;</span>
            </div>
          )}

          {orderedReadings
            .filter((row) => row.passage?.text)
            .map((row) => (
              <div key={row.label}>
                <p className="text-[12px] uppercase tracking-widest font-bold mb-1" style={{ color: t.accent }}>
                  {row.label} &middot; {row.passage!.citation}
                </p>
                <p
                  className="leading-relaxed"
                  style={{ fontFamily: PRINT_SERIF, color: row.label === 'Gospel' ? t.textBright : t.text, fontSize: bodyPx(14) }}
                >
                  {row.passage!.text}
                </p>
                {row.label === 'Gospel' && (
                  <p className="text-[12px] mt-1.5" style={{ color: t.textDim }}>
                    Text: {row.passage!.translation === 'douayrheims' ? 'Douay-Rheims' : 'World English Bible'} (public domain).
                  </p>
                )}
              </div>
            ))}

          {/* Citations the translation could not supply — named, never dropped. */}
          {orderedReadings
            .filter((row) => !row.passage?.text)
            .map((row) => (
              <p key={row.label} className="text-[12px]" style={{ color: t.textDim }}>
                {row.label}: {row.citation}
                {loadingAll ? ' — loading…' : ''}
              </p>
            ))}

          {readings.usccbLink && (
            <a
              href={readings.usccbLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12px] font-bold transition-opacity hover:opacity-70"
              style={{ color: t.accent }}
            >
              <BookOpen className="w-3 h-3" />
              Official reading text
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}

          <button
            onClick={() => setExpanded(false)}
            className="w-full flex items-center justify-center gap-1 text-[12px] transition-opacity hover:opacity-70"
            style={{ color: t.textDim }}
          >
            <X className="w-3 h-3" />
            <span>Close</span>
          </button>
        </div>
      )}

      {/* Reflect and challenge — pre-generated server-side from the day's readings.
          Renders on the reflection's own state, fetched in parallel with the readings:
          a slow readings path no longer holds a ready reflection hostage. In the
          printed page each wears its label as a stamped heading above its
          paragraph — Reflect (with its facet) and Challenge — so the block's
          height follows the text at every width and every day's length. */}
      {(shown.value || shown.pending) && (
        <div className="space-y-3 mt-4 mb-3">
          {shown.pending && !shown.value ? (
            <div className="flex items-center gap-2" style={{ color: t.textDim }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-[12px]">Preparing today&rsquo;s reflection&hellip;</span>
            </div>
          ) : shown.value ? (
            <>
              <div>
                <p
                  className={`${PRINT_STAMP_CLASS} mb-1`}
                  style={{ fontFamily: PRINT_SERIF, color: t.accent }}
                >
                  Reflect{shown.value.facet ? ` \u00b7 ${shown.value.facet}` : ''}
                </p>
                <p className="leading-relaxed" style={{ fontFamily: PRINT_SERIF, color: t.textMuted, fontSize: bodyPx(13) }}>
                  {shown.value.reflect}
                </p>
              </div>
              <div>
                <p
                  className={`${PRINT_STAMP_CLASS} mb-1`}
                  style={{ fontFamily: PRINT_SERIF, color: t.accent }}
                >
                  Challenge
                </p>
                <p className="leading-relaxed" style={{ fontFamily: PRINT_SERIF, color: t.text, fontSize: bodyPx(13) }}>
                  {shown.value.challenge}
                </p>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* The other two Ways (Way 1, Erik, Nov 13, 2026) — Listen now
          stands at the head of the section as the program; Tailor Today
          and Reflect remain as doors with their exact behaviour. Stage 1
          set them as bare printed lines and they did not read as
          tappable (Erik's revision, Nov 14, 2026), so each now sits on
          the shared ruled plate — frame, paper-shade fill, accent
          chevron — with the dotted leader kept as the contents page's
          signature between the name and its hint. Tailor opens its
          panel in the space directly beneath the plates; Reflect walks
          to the companions with the day's readings in hand.
          The Tailor door's round trip (Erik, Nov 18, 2026): retired in
          the morning's dedupe in favour of a plate in Today's stack,
          restored the same evening at Erik's word — the card door is
          Tailor's one entry on Today again, the stack plate gone. An
          evening swap that turned this door into "Close the day" was
          tried and reverted the same night at Erik's ruling: the door
          is Tailor at every hour — a first-time arrival at night must
          still find the devotional — and "Close the day" lives in
          exactly one place, Tonight's own PM plate. */}
      {!loading && readings?.date && (
        <>
          <div role="group" aria-label="Ways into today's Gospel" className="space-y-2">
            <button
              data-tile="tailor"
              onClick={() => setPanel((p) => (p === 'tailor' ? 'none' : 'tailor'))}
              aria-expanded={panel === 'tailor'}
              aria-label="Tailor today — a devotional for your day"
              className={DOOR_CLASS}
              style={{ border: `1px solid ${t.border}`, backgroundColor: `${t.border}1F` }}
            >
              <span
                className="text-[12px] font-bold uppercase tracking-wide flex-shrink-0"
                style={{ fontFamily: PRINT_SERIF, color: t.textBright }}
              >
                Tailor Today
              </span>
              <span
                aria-hidden="true"
                className="flex-1"
                style={{ borderBottom: `1px dotted ${t.textDim}` }}
              />
              <span
                className="text-[12px] italic flex-shrink-0"
                style={{ fontFamily: PRINT_SERIF, color: t.textDim }}
              >
                For your day
              </span>
              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} strokeWidth={2.5} aria-hidden="true" />
            </button>
            <button
              data-tile="reflect"
              onClick={handleReflectWithCompanion}
              disabled={preparing}
              aria-label="Reflect with a Companion"
              className={DOOR_CLASS}
              style={{ border: `1px solid ${t.border}`, backgroundColor: `${t.border}1F`, opacity: preparing ? 0.6 : 1 }}
            >
              {preparing && (
                <Loader2 className="w-3.5 h-3.5 animate-spin self-center flex-shrink-0" style={{ color: t.accent }} />
              )}
              <span
                className="text-[12px] font-bold uppercase tracking-wide flex-shrink-0"
                style={{ fontFamily: PRINT_SERIF, color: t.textBright }}
              >
                Reflect
              </span>
              <span
                aria-hidden="true"
                className="flex-1"
                style={{ borderBottom: `1px dotted ${t.textDim}` }}
              />
              <span
                className="text-[12px] italic flex-shrink-0"
                style={{ fontFamily: PRINT_SERIF, color: t.textDim }}
              >
                {preparing ? 'Gathering the readings…' : 'With a companion'}
              </span>
              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} strokeWidth={2.5} aria-hidden="true" />
            </button>
          </div>

          {/* The panel — the existing Tailor intake, reused whole, in
              the space under the plates. */}
          {panel === 'tailor' && (
            <TailorToday t={t} audience={audience} dateKey={readings.date} startOpen profileOpenSignal={profileOpenSignal} onReflectWithCompanion={onReflectWithCompanion ? handleReflectTailoredWithCompanion : undefined} />
          )}

          {/* Share is a flywheel piece (Nov 13, 2026): a full-width secondary
              button in the card's own flow, under the tiles — present to
              every eye, styled like a card action and never like the call to
              action: no glow, no heavy border. */}
          <button
            data-share-gospel
            onClick={() => setShareOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border transition-all active:scale-[0.98] mt-3"
            style={{ backgroundColor: `${t.border}33`, borderColor: `${t.border}99`, color: t.textMuted }}
          >
            <Share2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-[12px] font-bold uppercase tracking-wide">Share today&rsquo;s Gospel</span>
          </button>
        </>
      )}

      <DailyGospelShareModal
        open={shareOpen}
        t={t}
        season={readings?.season}
        celebration={readings?.celebration}
        keyVerse={keyVerse}
        reflection={shown.value}
        dateKey={readings?.date ?? null}
        audience={audience}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}
