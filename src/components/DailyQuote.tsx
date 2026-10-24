import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  Target,
  X,
  Users,
  BookOpen,
  ExternalLink,
  Loader2,
  ChevronDown,
  Quote,
  Share2,
} from 'lucide-react';
import { DAILY_QUOTES } from '@/data/quotes';
import { fetchDailyReadings, type DailyReadings } from '@/lib/readings';
import { fetchReadingsBundle } from '@/lib/readingsBundle';
import { getFeastForDate, type FeastRank } from '@/data/feastDays';
import {
  fetchPassageVerses,
  fetchReadingTexts,
  type Passage,
  type PassageVerses,
  type ReadingTexts,
} from '@/lib/bible';
import { pickKeyVerse, type KeyVerse } from '@/lib/keyVerse';
import { fetchReflection, type Reflection } from '@/lib/reflection';
import { DailyGospelShareModal } from '@/components/DailyGospelShareModal';
import type { PersonaTheme } from '@/types';

const FEAST_RANK_LABEL: Record<FeastRank, string> = {
  solemnity: 'Solemnity',
  feast: 'Feast',
  memorial: 'Memorial',
};
function feastRankLabel(rank: FeastRank): string {
  return FEAST_RANK_LABEL[rank];
}

function getQuoteForDay(date: Date = new Date()) {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000,
  );
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
}

interface DailyQuoteProps {
  t: PersonaTheme;
  onOpenExamen?: () => void;
  onReflectWithCompanion?: (prompt: string) => void;
}

export function DailyQuote({ t, onOpenExamen, onReflectWithCompanion }: DailyQuoteProps) {
  const quote = useMemo(() => getQuoteForDay(), []);
  const feast = useMemo(() => getFeastForDate(), []);
  const [expanded, setExpanded] = useState(false);
  const [readings, setReadings] = useState<DailyReadings | null>(null);
  const [gospelVerses, setGospelVerses] = useState<PassageVerses | null>(null);
  const [allTexts, setAllTexts] = useState<ReadingTexts | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAll, setLoadingAll] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [staleDate, setStaleDate] = useState<string | null>(null);

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

  const keyVerse: KeyVerse | null = useMemo(
    () => (gospelVerses ? pickKeyVerse(gospelVerses) : null),
    [gospelVerses],
  );
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const [reflectionLoading, setReflectionLoading] = useState(false);

  // The reflection is generated server-side from the day's readings, the way a homily
  // would read them — not yanked from a single verse. The server fetches the readings
  // and generates the reflection once per day, caching it for all subsequent users.
  useEffect(() => {
    let active = true;
    if (!readings) return;
    if (reflection || reflectionLoading) return;
    setReflectionLoading(true);
    void (async () => {
      const result = await fetchReflection(readings.date);
      if (!active) return;
      setReflection(result);
      setReflectionLoading(false);
    })();
    return () => { active = false; };
  }, [readings, reflection, reflectionLoading]);

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

  // Kick off the full-text fetch in the background once we have citations, so the
  // server-generated reflection can be built without requiring the user to expand.
  useEffect(() => {
    if (readings && !allTexts && !loadingAll) {
      void loadAllTexts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readings]);

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) void loadAllTexts();
  };

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
      '\nReflect on these readings through your eyes. What do they mean for a man walking the road today? What truth do they uncover, and what do they ask of him?',
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

  // The two quiet buttons below the main action share a row only when both are present, so a lone
  // button fills the width instead of sitting in half of it.
  const hasShare = Boolean(keyVerse || reflection);
  const hasExamen = Boolean(onOpenExamen);

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
        {readings?.season && (
          <span className="text-[8px] uppercase tracking-widest font-bold truncate" style={{ color: t.textDim }}>
            {readings.season}
          </span>
        )}
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

      {/* The verse to sit with — the heart of the passage, shown up front */}
      {!loading && keyVerse && (
        <>
          <p className="text-[9px] uppercase tracking-widest font-bold mb-1.5" style={{ color: t.textDim }}>
            The Gospel &middot; {keyVerse.citation}
          </p>
          <p className="text-[15px] leading-relaxed mb-3 font-display" style={{ color: t.textBright }}>
            {keyVerse.text}
          </p>
        </>
      )}

      {/* Offline fallback */}
      {!loading && !keyVerse && (
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

      {/* Reflect and challenge — server-generated from the day's readings, the way a homily would. */}
      {!loading && (reflection || reflectionLoading) && (
        <div className="space-y-2 mb-3">
          {reflectionLoading && !reflection ? (
            <div className="flex items-center gap-2" style={{ color: t.textDim }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-[10px]">Preparing today&rsquo;s reflection&hellip;</span>
            </div>
          ) : reflection ? (
            <>
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: t.accent, opacity: 0.7 }} />
                <div>
                  <p className="text-[9px] uppercase tracking-widest font-bold mb-0.5" style={{ color: t.textDim }}>
                    Reflect{reflection.facet ? ` \u00b7 ${reflection.facet}` : ''}
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: t.textMuted }}>{reflection.reflect}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Target className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: t.accent, opacity: 0.7 }} />
                <div>
                  <p className="text-[9px] uppercase tracking-widest font-bold mb-0.5" style={{ color: t.textDim }}>
                    Challenge
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: t.text }}>{reflection.challenge}</p>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* The one thing to do: sit with the day's readings alongside a companion. */}
      {!loading && onReflectWithCompanion && (
        <button
          onClick={handleReflectWithCompanion}
          disabled={preparing}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl border-2 transition-all active:scale-[0.98] disabled:opacity-60 animate-cta-glow"
          style={{
            backgroundColor: t.accentRgba(0.16),
            borderColor: t.accent,
            color: t.accent,
            boxShadow: `0 8px 22px -10px ${t.accent}99`,
            // The pulse takes the seasonal accent too — the keyframes' fallback
            // orange used to clash with the card every season but autumn.
            ['--cta-accent' as string]: t.accentRgba(0.55),
          } as React.CSSProperties}
        >
          {preparing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
          <span className="text-sm font-bold uppercase tracking-wide">
            {preparing ? 'Gathering the readings…' : 'Reflect with a Companion'}
          </span>
        </button>
      )}

      {/* Quieter ways to pray it — present, but not competing with the step above. */}
      {!loading && (hasShare || hasExamen) && (
        <div className={`grid gap-2 mt-2 ${hasShare && hasExamen ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {hasShare && (
            <button
              onClick={() => setShareOpen(true)}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border transition-all active:scale-[0.98]"
              style={{ backgroundColor: `${t.border}33`, borderColor: `${t.border}99`, color: t.textMuted }}
            >
              <Share2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="text-[11px] font-bold uppercase tracking-wide">Share</span>
            </button>
          )}
          {hasExamen && (
            <button
              onClick={onOpenExamen}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border transition-all active:scale-[0.98]"
              style={{ backgroundColor: `${t.border}33`, borderColor: `${t.border}99`, color: t.textMuted }}
            >
              <span className="text-[11px] font-bold uppercase tracking-wide">Evening Examen</span>
            </button>
          )}
        </div>
      )}

      {/* Expand for the full readings */}
      {!loading && (
        <button
          onClick={toggleExpanded}
          className="w-full flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest mt-3 transition-opacity hover:opacity-70"
          style={{ color: t.accent }}
        >
          {expanded ? 'Hide the full readings' : 'Read the full readings'}
          <ChevronDown
            className="w-3 h-3 transition-transform"
            style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
          />
        </button>
      )}

      {expanded && (
        <div className="space-y-3 pt-3 mt-3 border-t animate-fade-in" style={{ borderColor: `${t.border}66` }}>
          {loadingAll && (
            <div className="flex items-center gap-2" style={{ color: t.textDim }}>
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-[10px]">Loading the day&rsquo;s readings&hellip;</span>
            </div>
          )}

          {/* The Gospel in full */}
          {allTexts?.gospel?.text && (
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: t.accent }}>
                Gospel &middot; {allTexts.gospel.citation}
              </p>
              <p className="text-sm leading-relaxed" style={{ color: t.textBright }}>
                {allTexts.gospel.text}
              </p>
              <p className="text-[9px] mt-1.5" style={{ color: t.textDim }}>
                Text: {allTexts.gospel.translation === 'douayrheims' ? 'Douay-Rheims' : 'World English Bible'} (public domain).
              </p>
            </div>
          )}

          {allTexts && (
            <div className="space-y-2">
              {allTexts.first && <ReadingBlock label="First Reading" passage={allTexts.first} t={t} />}
              {allTexts.psalm && <ReadingBlock label="Responsorial Psalm" passage={allTexts.psalm} t={t} />}
              {allTexts.second && <ReadingBlock label="Second Reading" passage={allTexts.second} t={t} />}
            </div>
          )}

          {/* Citations the translation could not supply */}
          {readings && !loadingAll && (
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {(
                [
                  { label: 'First', citation: readings.firstReading, passage: allTexts?.first },
                  { label: 'Psalm', citation: readings.psalm, passage: allTexts?.psalm },
                  { label: 'Second', citation: readings.secondReading, passage: allTexts?.second },
                ] as { label: string; citation: string | null; passage: Passage | null | undefined }[]
              )
                .filter((row) => row.citation && !row.passage)
                .map((row) => (
                  <span key={row.label} className="text-[10px]" style={{ color: t.textDim }}>
                    {row.label}: {row.citation}
                  </span>
                ))}
            </div>
          )}

          {/* A voice from the tradition */}
          <div className="flex items-start gap-2.5">
            <Quote className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: t.accent, opacity: 0.7 }} />
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold mb-0.5" style={{ color: t.textDim }}>
                From the tradition &middot; {quote.author}
              </p>
              <p className="text-xs leading-relaxed italic" style={{ color: t.textMuted }}>
                &ldquo;{quote.text}&rdquo;
              </p>
            </div>
          </div>

          {readings?.usccbLink && (
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

          <button
            onClick={() => setExpanded(false)}
            className="w-full flex items-center justify-center gap-1 text-[10px] transition-opacity hover:opacity-70"
            style={{ color: t.textDim }}
          >
            <X className="w-3 h-3" />
            <span>Close</span>
          </button>
        </div>
      )}

      <DailyGospelShareModal
        open={shareOpen}
        t={t}
        season={readings?.season}
        celebration={readings?.celebration}
        keyVerse={keyVerse}
        reflection={reflection}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}

function ReadingBlock({ label, passage, t }: { label: string; passage: Passage; t: PersonaTheme }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border" style={{ borderColor: `${t.border}80`, backgroundColor: `${t.border}1F` }}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <span className="text-[9px] uppercase tracking-widest font-bold flex-shrink-0" style={{ color: t.accent }}>
          {label}
        </span>
        <span className="text-[10px] flex-1 truncate" style={{ color: t.textDim }}>
          {passage.citation}
        </span>
        <ChevronDown
          className="w-3.5 h-3.5 flex-shrink-0 transition-transform"
          style={{ color: t.textDim, transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>
      {open && (
        <p className="px-3 pb-3 text-xs leading-relaxed animate-fade-in" style={{ color: t.textMuted }}>
          {passage.text}
        </p>
      )}
    </div>
  );
}
