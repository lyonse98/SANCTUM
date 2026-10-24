import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Quote } from 'lucide-react';
import { SAINTS, type SaintOfDay } from '@/data/saints';
import { getFeastForDate } from '@/data/feastDays';
import { fetchReadingsBundle } from '@/lib/readingsBundle';
import { isPersonCelebration, shouldMirrorCelebration } from '@/lib/celebration';
import type { PersonaTheme } from '@/types';

function getSaintForDay(date: Date = new Date()): SaintOfDay | null {
  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return SAINTS.find((s) => s.feastDate === mmdd) ?? null;
}

/**
 * When the saints list has no entry for today, fall back to the feast calendar — so the card
 * always matches the day's actual celebration rather than showing a random rotating saint.
 */
function getSaintFromFeast(date: Date = new Date()): SaintOfDay | null {
  const feast = getFeastForDate(date);
  if (!feast) return null;
  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return {
    name: feast.name,
    feastDate: mmdd,
    shortBio: feast.note,
    struggles: [],
  };
}

function getFallbackSaint(date: Date = new Date()): SaintOfDay {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000,
  );
  return SAINTS[dayOfYear % SAINTS.length];
}

function slugify(name: string): string {
  return name
    .replace(/^(St\.|Saint)\s+/i, '')
    .replace(/[^a-zA-Z\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

function wikiUrl(name: string): string {
  return `https://en.wikipedia.org/wiki/${slugify(name)}`;
}

interface SaintOfDayCardProps {
  t: PersonaTheme;
}

function normalizeSaintName(name: string): string {
  return name.toLowerCase().replace(/^(st\.|saint|blessed)\s+/i, '').replace(/[^a-z ]/g, '').trim();
}

function namesMatch(a: string, b: string): boolean {
  const na = normalizeSaintName(a);
  const nb = normalizeSaintName(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}



export function SaintOfDayCard({ t }: SaintOfDayCardProps) {
  const localSaint = useMemo(() => getSaintForDay() ?? getSaintFromFeast() ?? getFallbackSaint(), []);
  const [celebrationSaint, setCelebrationSaint] = useState<SaintOfDay | null>(null);

  // One observance per day, and the lectionary's celebration wins: the readings header
  // and this card used to name two different saints for the same day (Oct 24, 2026: the
  // lectionary said St. Anthony Mary Claret, the local list said St. Kaleb of Ethiopia).
  // Erik's rule: mirror whatever the day's memorial, feast, or solemnity is — saint or
  // not — and only when the day has no named observance (a plain weekday or an
  // ordinary Sunday) fall back to the local saint lists. A mirrored celebration borrows
  // the local entry's bio only when it is genuinely the same saint.
  useEffect(() => {
    let active = true;
    void (async () => {
      const bundle = await fetchReadingsBundle();
      if (!active || !bundle?.citations.celebration) return;
      const celebration = bundle.citations.celebration;
      if (!shouldMirrorCelebration(celebration)) return;
      if (namesMatch(celebration, localSaint.name)) return;
      const mmdd = `${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
      const richer = SAINTS.find((entry) => namesMatch(entry.name, celebration));
      setCelebrationSaint(
        richer ?? {
          name: celebration,
          feastDate: mmdd,
          shortBio: isPersonCelebration(celebration)
            ? 'Named in today’s liturgical calendar.'
            : 'The Church’s celebration for today.',
          struggles: [],
        },
      );
    })();
    return () => { active = false; };
  }, [localSaint]);

  const saint = celebrationSaint ?? localSaint;
  const url = wikiUrl(saint.name);
  const initial = saint.name === 'All Saints' || saint.name === 'All Souls'
    ? saint.name.charAt(0)
    : (saint.name.replace(/^(St\.|Saint|Immaculate|Our Lady of)\s+/i, '').charAt(0) || saint.name.charAt(0));

  return (
    <div
      className="w-full rounded-xl border overflow-hidden transition-all duration-300"
      style={{
        backgroundColor: `${t.card}90`,
        borderColor: `${t.accentRgba(0.25)}`,
      }}
    >
      {/* Header band */}
      <div
        className="px-4 pt-4 pb-3"
        style={{ background: `linear-gradient(180deg, ${t.accentRgba(0.06)} 0%, transparent 100%)` }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 border"
            style={{
              backgroundColor: t.accentRgba(0.1),
              borderColor: t.accentRgba(0.25),
            }}
          >
            <span className="text-xl font-bold font-display" style={{ color: t.accent }}>
              {initial}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: t.accent }}>
              {celebrationSaint && !isPersonCelebration(saint.name) ? 'Today’s Celebration' : 'Saint of the Day'}
            </span>
            <h3 className="text-base font-bold font-display leading-tight mt-0.5" style={{ color: t.textBright }}>
              {saint.name}
            </h3>
            {saint.feastDate && (
              <span className="text-[10px] mt-0.5 inline-block" style={{ color: t.textDim }}>
                Feast: {saint.feastDate.replace('-', '/')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pb-4">
        <p className="text-xs leading-relaxed mb-3" style={{ color: t.textMuted }}>
          {saint.shortBio}
        </p>

        {saint.quote && (
          <div
            className="flex items-start gap-2 rounded-lg px-3 py-2.5 border mb-3"
            style={{
              backgroundColor: t.accentRgba(0.05),
              borderColor: t.accentRgba(0.15),
            }}
          >
            <Quote className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: t.accent, opacity: 0.7 }} />
            <p className="text-xs italic leading-relaxed" style={{ color: t.text }}>
              &ldquo;{saint.quote}&rdquo;
            </p>
          </div>
        )}

        {saint.struggles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {saint.struggles.slice(0, 4).map((s) => (
              <span
                key={s}
                className="text-[10px] px-2 py-0.5 rounded-full border font-medium"
                style={{
                  color: t.textDim,
                  borderColor: `${t.border}99`,
                }}
              >
                {s}
              </span>
            ))}
          </div>
        )}

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-lg text-xs font-bold border transition-all active:scale-95"
          style={{
            backgroundColor: t.accentRgba(0.1),
            borderColor: t.accentRgba(0.3),
            color: t.accent,
          }}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Read the Full Story
        </a>
      </div>
    </div>
  );
}
