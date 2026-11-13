import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  Target,
  Users,
  BookOpen,
  ExternalLink,
  Loader2,
  Share2,
  Headphones,
} from 'lucide-react';
import { quoteForDay } from '@/data/quotes';
import { fetchDailyReadings, type DailyReadings } from '@/lib/readings';
import { fetchReadingsBundle, isoDate } from '@/lib/readingsBundle';
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
import { ListenBar } from '@/components/ListenBar';
import { TailorToday } from '@/components/TailorToday';
import { DailyGospelShareModal } from '@/components/DailyGospelShareModal';
import type { Audience, PersonaTheme } from '@/types';

const FEAST_RANK_LABEL: Record<FeastRank, string> = {
  solemnity: 'Solemnity',
  feast: 'Feast',
  memorial: 'Memorial',
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
}

/** The three Way-1 tiles share one class string — equals, by construction. */
const TILE_CLASS =
  'flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-xl border transition-all active:scale-[0.98]';

type CardPanel = 'none' | 'listen' | 'tailor';

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

export function DailyQuote({ t, audience, onReflectWithCompanion, onOpenReminder }: DailyQuoteProps) {
  const quote = useMemo(() => quoteForDay(new Date(), audience), [audience]);
  const feast = useMemo(() => getFeastForDate(), []);
  const [readings, setReadings] = useState<DailyReadings | null>(null);
  const [gospelVerses, setGospelVerses] = useState<PassageVerses | null>(null);
  const [allTexts, setAllTexts] = useState<ReadingTexts | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAll, setLoadingAll] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [staleDate, setStaleDate] = useState<string | null>(null);
  const [panel, setPanel] = useState<CardPanel>('none');

  useEffect(() => {
    let active = true;
    (async () => {
      // Primary path: the server-assembled, day-cached bundle.
      const bundle = await fetchReadingsBundle();
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
      const citations = await fetchDailyReadings();
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

  // The key verse no longer sits on the card — the full Gospel is the card's
  // body now — but the share card still paints from it, so it is still picked.
  const keyVerse: KeyVerse | null = useMemo(
    () => (gospelVerses ? pickKeyVerse(gospelVerses) : null),
    [gospelVerses],
  );
  // The day's date key, computed locally at mount with the very helper the readings
  // bundle keys its request by — so the reflection fetch below targets the same day
  // the bundle will, without waiting for the bundle to say so.
  const [localDateKey] = useState(() => isoDate(new Date()));
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const [reflectionFor, setReflectionFor] = useState<string | null>(null);
  const [reflectionBusyFor, setReflectionBusyFor] = useState<string | null>(null);
  const reflectionFetchSeq = useRef(0);

  // The reflection is pre-generated server-side from the day's readings, the way a
  // homily would read them — not yanked from a single verse — and it answers fast.
  // The readings bundle can be slow (its fallback assembles the day from third-party
  // APIs in sequence), so the reflection fetch fires in parallel with the readings
  // load, keyed to the locally computed date, instead of waiting behind it. When the
  // bundle does resolve, its date is authoritative: if it differs (a midnight edge,
  // or a stale bundle), the reflection realigns to the bundle's date — the reflection
  // shown always matches the Gospel shown. The coordination rules live with the
  // fetcher (nextReflectionFetch / reflectionDisplay in lib/reflection).
  useEffect(() => {
    const want = nextReflectionFetch(
      { settledFor: reflectionFor, inFlightFor: reflectionBusyFor },
      localDateKey,
      readings?.date ?? null,
    );
    if (!want) return;
    const seq = ++reflectionFetchSeq.current;
    setReflectionBusyFor(want);
    void (async () => {
      const result = await fetchReflection(want, audience);
      if (reflectionFetchSeq.current !== seq) return;
      setReflection(result);
      setReflectionFor(want);
      setReflectionBusyFor(null);
    })();
  }, [localDateKey, readings, reflectionFor, reflectionBusyFor]);

  // What the reflection block may show right now: the settled reflection once it
  // belongs to the day on display, a pending state while a fetch (or the realigning
  // fetch) is outstanding — never another date's reflection.
  const shown = reflectionDisplay(
    { settledFor: reflectionFor, inFlightFor: reflectionBusyFor, value: reflection },
    readings?.date ?? null,
  );

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

  // The readings are the card's body now (Nov 13, 2026), so the full-text fetch
  // fires as soon as the citations land — nothing waits for an expander that
  // no longer exists.
  useEffect(() => {
    if (readings && !allTexts && !loadingAll) {
      void loadAllTexts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readings]);

  const buildReflectionPrompt = (texts: ReadingTexts | null) => {
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

  const tileStyle = (active: boolean): React.CSSProperties => ({
    backgroundColor: `${t.border}33`,
    borderColor: active ? t.accent : `${t.border}99`,
    color: t.textMuted,
  });

  // Citations come from the lectionary, texts from the Bible fetch; a row
  // whose text could not be supplied still shows its citation, so the day is
  // never silently short a reading.
  const orderedReadings = readings ? orderedReadingRows(readings, allTexts) : [];

  return (
    <div
      className="w-full rounded-2xl border-2 p-5 transition-all duration-300"
      style={{
        backgroundColor: t.card,
        backgroundImage: `radial-gradient(ellipse at 50% 0%, ${t.accent}1F 0%, transparent 62%)`,
        borderColor: t.accentRgba(0.45),
        boxShadow: `0 10px 30px -12px ${t.accent}4D`,
      }}
    >
      <div className="flex items-center justify-between mb-3 gap-2">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border flex-shrink-0"
          style={{ color: t.accent, borderColor: t.accentRgba(0.4), backgroundColor: t.accentRgba(0.1) }}
        >
          Today&rsquo;s Gospel
        </span>
        <span className="flex items-center gap-2 min-w-0">
          {readings?.season && (
            <span className="text-[8px] uppercase tracking-widest font-bold truncate" style={{ color: t.textDim }}>
              {readings.season}
            </span>
          )}
        </span>
      </div>

      {readings?.celebration && (
        <div className="flex items-center gap-2 mb-3">
          <span
            className="text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border"
            style={{ color: t.accent, borderColor: t.accentRgba(0.3), backgroundColor: t.accentRgba(0.08) }}
          >
            {feast ? feastRankLabel(feast.rank) : 'Today'}
          </span>
          <p className="text-[11px] font-bold" style={{ color: t.textMuted }}>
            {readings.celebration}
          </p>
        </div>
      )}

      {!loading && staleDate && (
        <p className="text-[10px] mb-3" style={{ color: t.textDim }}>
          Showing the readings for {new Date(`${staleDate}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })} — today&rsquo;s could not be loaded.
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-2" style={{ color: t.textDim }}>
          <Loader2 className="w-3 h-3 animate-spin" />
          <span className="text-[10px]">Loading today&rsquo;s Gospel&hellip;</span>
        </div>
      )}

      {/* The readings are the body of the card (Erik, Nov 13, 2026): full text,
          in lectionary order, visible without expanding anything — First,
          Psalm, Second where the day has one, and the Gospel last, the way
          they are heard at Mass. */}
      {!loading && readings && (
        <div className="space-y-4 mb-4">
          {orderedReadings
            .filter((row) => row.passage?.text)
            .map((row) => (
              <div key={row.label}>
                <p className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: t.accent }}>
                  {row.label} &middot; {row.passage!.citation}
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: row.label === 'Gospel' ? t.textBright : t.text }}
                >
                  {row.passage!.text}
                </p>
                {row.label === 'Gospel' && (
                  <p className="text-[9px] mt-1.5" style={{ color: t.textDim }}>
                    Text: {row.passage!.translation === 'douayrheims' ? 'Douay-Rheims' : 'World English Bible'} (public domain).
                  </p>
                )}
              </div>
            ))}

          {/* Citations the translation could not supply — named, never dropped. */}
          {orderedReadings
            .filter((row) => !row.passage?.text)
            .map((row) => (
              <p key={row.label} className="text-[10px]" style={{ color: t.textDim }}>
                {row.label}: {row.citation}
                {loadingAll ? ' — loading…' : ''}
              </p>
            ))}

          {readings.usccbLink && (
            <a
              href={readings.usccbLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-bold transition-opacity hover:opacity-70"
              style={{ color: t.accent }}
            >
              <BookOpen className="w-3 h-3" />
              Official reading text
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      )}

      {/* Offline fallback — only when the readings themselves could not be
          loaded at all: a word for the day stands in, as it always has. */}
      {!loading && !readings && (
        <>
          <p className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: t.textDim }}>
            A word for today
          </p>
          <p className="text-sm italic leading-relaxed mb-2" style={{ color: t.textBright }}>
            &ldquo;{quote.text}&rdquo;
          </p>
          <p className="text-[11px] mb-3 font-medium" style={{ color: t.textDim }}>
            — {quote.author}
            {quote.source && <span className="opacity-70">, {quote.source}</span>}
          </p>
        </>
      )}

      {/* Reflect and challenge — pre-generated server-side from the day's readings.
          Renders on the reflection's own state, fetched in parallel with the readings:
          a slow readings path no longer holds a ready reflection hostage. */}
      {(shown.value || shown.pending) && (
        <div className="space-y-2 mb-3">
          {shown.pending && !shown.value ? (
            <div className="flex items-center gap-2" style={{ color: t.textDim }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-[10px]">Preparing today&rsquo;s reflection&hellip;</span>
            </div>
          ) : shown.value ? (
            <>
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: t.accent, opacity: 0.7 }} />
                <div>
                  <p className="text-[9px] uppercase tracking-widest font-bold mb-0.5" style={{ color: t.textDim }}>
                    Reflect{shown.value.facet ? ` \u00b7 ${shown.value.facet}` : ''}
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: t.textMuted }}>{shown.value.reflect}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Target className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: t.accent, opacity: 0.7 }} />
                <div>
                  <p className="text-[9px] uppercase tracking-widest font-bold mb-0.5" style={{ color: t.textDim }}>
                    Challenge
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: t.text }}>{shown.value.challenge}</p>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Way 1 (Erik, Nov 13, 2026): three equal tiles — Listen, Tailor Today,
          Reflect — one row, one visual language, no glow and no dominance.
          Listen and Tailor open their panels in the space directly beneath the
          row; Reflect walks to the companions with the day's readings in hand. */}
      {!loading && readings?.date && (
        <>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Ways into today's Gospel">
            <button
              data-tile="listen"
              onClick={() => setPanel((p) => (p === 'listen' ? 'none' : 'listen'))}
              aria-expanded={panel === 'listen'}
              aria-label="Listen to today's Gospel, read aloud"
              className={TILE_CLASS}
              style={tileStyle(panel === 'listen')}
            >
              <Headphones className="w-5 h-5" style={{ color: t.accent }} />
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: t.text }}>
                Listen
              </span>
              <span className="text-[9px]" style={{ color: t.textDim }}>
                Read aloud
              </span>
            </button>
            <button
              data-tile="tailor"
              onClick={() => setPanel((p) => (p === 'tailor' ? 'none' : 'tailor'))}
              aria-expanded={panel === 'tailor'}
              aria-label="Tailor today — a devotional for your day"
              className={TILE_CLASS}
              style={tileStyle(panel === 'tailor')}
            >
              <Sparkles className="w-5 h-5" style={{ color: t.accent }} />
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: t.text }}>
                Tailor Today
              </span>
              <span className="text-[9px]" style={{ color: t.textDim }}>
                For your day
              </span>
            </button>
            <button
              data-tile="reflect"
              onClick={handleReflectWithCompanion}
              disabled={preparing}
              aria-label="Reflect with a Companion"
              className={TILE_CLASS}
              style={{ ...tileStyle(false), opacity: preparing ? 0.6 : 1 }}
            >
              {preparing ? (
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: t.accent }} />
              ) : (
                <Users className="w-5 h-5" style={{ color: t.accent }} />
              )}
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: t.text }}>
                Reflect
              </span>
              <span className="text-[9px]" style={{ color: t.textDim }}>
                {preparing ? 'Gathering the readings…' : 'With a companion'}
              </span>
            </button>
          </div>

          {/* The panels — the existing Listen bar and Tailor intake, reused
              whole; only one is open at a time, in the space under the tiles. */}
          {panel === 'listen' && (
            <div className="mt-3 animate-fade-in">
              <ListenBar t={t} dateKey={readings.date} citation={readings.gospel ?? null} audience={audience} onOpenReminder={onOpenReminder} />
            </div>
          )}
          {panel === 'tailor' && (
            <TailorToday t={t} audience={audience} dateKey={readings.date} startOpen />
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
            <span className="text-[11px] font-bold uppercase tracking-wide">Share today&rsquo;s Gospel</span>
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
