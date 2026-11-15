import { useEffect, useMemo, useState } from 'react';
import { Church } from 'lucide-react';
import { SeasonBadge } from '@/components/SeasonBadge';
import { getCurrentSeason } from '@/data/liturgicalCalendar';
import { getDailyVisual } from '@/lib/liturgicalVisuals';
import { getFeastArt, getFeastEmblem } from '@/lib/feastArt';
import { PRINT_SERIF } from '@/lib/print';
import type { Audience, PersonaTheme } from '@/types';

interface TodayHeroProps {
  t: PersonaTheme;
  accent: string;
  audience: Audience;
  /** The Sunday door to Real Help (Mass & Confession). */
  onOpenHelp?: () => void;
}

/** Picks a greeting from the man's own clock — the app has no idea who he is, only what time it is. */
function greetingForHour(hour: number): string {
  if (hour < 5) return 'Still awake';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Late night';
}

/**
 * The masthead for the Today area — the running head of the day's page
 * (Stage 1 of the printed-page re-skin, Erik, Nov 14, 2026). It exists to
 * make the front door feel like a place he has arrived at rather than a
 * list he has scrolled to: the season's colour and the hour of his day —
 * all above the Gospel, in a single glance.
 * The feast emblem is re-set, not removed: on feasts and solemnities the
 * rank, the day's name, and its motif stand in the print language — the
 * glyph as a decorated initial in the day's colour, the name in the serif
 * display voice — where the panel used to be. Her feast art keeps its
 * photograph, its frame flattened to the page's hairline.
 */
export function TodayHero({ t, accent, audience, onOpenHelp }: TodayHeroProps) {
  const season = useMemo(() => getCurrentSeason(), []);
  const visual = useMemo(() => getDailyVisual(), []);
  // The Illuminated Garden — non-null only on the women's track, and only on a
  // solemnity or one of Our Lady's days; null (nothing rendered) everywhere else.
  const feastArt = useMemo(() => getFeastArt(new Date(), audience), [audience]);
  // The men's counterpart — the day's emblem, large and spare, on feasts and
  // solemnities only; null on ordinary days and on the women's track.
  const feastEmblem = useMemo(() => getFeastEmblem(new Date(), audience), [audience]);
  const isSunday = useMemo(() => new Date().getDay() === 0, []);
  const [greeting, setGreeting] = useState(() => greetingForHour(new Date().getHours()));

  useEffect(() => {
    const id = setInterval(() => setGreeting(greetingForHour(new Date().getHours())), 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="masthead-motif relative w-full text-center">
      <div className="relative">
        {feastArt && (
          <figure
            className="relative w-full h-48 overflow-hidden mb-5 border text-left"
            style={{ borderColor: t.accentRgba(0.35) }}
          >
            <img
              src={feastArt.image}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: 'saturate(1.02) contrast(1.04)' }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, rgba(24,14,10,0.10) 0%, rgba(24,14,10,0.34) 52%, rgba(24,14,10,0.78) 100%)',
              }}
            />
            <figcaption className="absolute inset-x-0 bottom-0 p-4">
              <span
                className="inline-block text-[9px] font-bold uppercase tracking-[0.22em] px-2 py-0.5 border mb-1.5"
                style={{ color: '#FFF6E8', borderColor: 'rgba(255,246,232,0.55)', backgroundColor: 'rgba(24,14,10,0.35)' }}
              >
                {feastArt.feast.rank}
              </span>
              <p
                className="text-[22px] leading-tight"
                style={{ fontFamily: PRINT_SERIF, color: '#FFFBF2' }}
              >
                {feastArt.feast.name}
              </p>
              <p className="text-[10px] uppercase tracking-[0.18em] mt-0.5" style={{ color: 'rgba(255,246,232,0.85)' }}>
                {feastArt.feast.motif}
              </p>
            </figcaption>
          </figure>
        )}

        {feastEmblem && (
          <figure className="relative w-full mb-5 px-4 pt-1 pb-5">
            <div className="flex items-center justify-center gap-3 mb-3" aria-hidden="true">
              <span className="h-px w-10" style={{ backgroundColor: t.accentRgba(0.45) }} />
              <span
                className="text-[9px] font-bold uppercase tracking-[0.22em]"
                style={{ color: t.accent }}
              >
                {feastEmblem.rank}
              </span>
              <span className="h-px w-10" style={{ backgroundColor: t.accentRgba(0.45) }} />
            </div>
            <div className="text-6xl leading-none mb-2" style={{ color: accent }} aria-hidden="true">
              {feastEmblem.glyph}
            </div>
            <figcaption>
              <p
                className="text-[22px] leading-tight"
                style={{ fontFamily: PRINT_SERIF, color: accent }}
              >
                {feastEmblem.name}
              </p>
              <p className="text-[10px] uppercase tracking-[0.18em] mt-0.5" style={{ color: t.textDim }}>
                {feastEmblem.motif}
              </p>
            </figcaption>
            <div
              aria-hidden="true"
              className="mx-auto mt-4 w-24"
              style={{ borderTop: `1px solid ${t.accentRgba(0.35)}` }}
            />
          </figure>
        )}

        <div className="flex items-center justify-center gap-3 mb-3" aria-hidden="true">
          <span
            className="h-px w-12"
            style={{ background: `linear-gradient(90deg, transparent, ${accent}66)` }}
          />
          <span className="text-sm" style={{ color: accent, opacity: 0.9 }}>{visual.glyph}</span>
          <span
            className="h-px w-12"
            style={{ background: `linear-gradient(90deg, ${accent}66, transparent)` }}
          />
        </div>

        <Church className="w-5 h-5 mx-auto mb-2" style={{ color: accent }} strokeWidth={2.2} aria-hidden="true" />

        <h1
          className="text-3xl font-bold text-forge-text-bright uppercase tracking-wide mb-1"
          style={{ fontFamily: PRINT_SERIF }}
        >
          Sanctum
        </h1>
        <p className="text-[11px] text-forge-text-muted stamped mb-1" style={{ color: accent }}>
          {greeting}
        </p>

        <div className="flex flex-col items-center gap-1.5">
          <SeasonBadge />
          <p className="text-[10px] text-forge-text-dim text-center max-w-xs leading-relaxed">
            {visual.feastNote ?? season.description}
          </p>
        </div>

        {isSunday && onOpenHelp && (
          <button
            onClick={onOpenHelp}
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-70"
            style={{ color: t.accent }}
          >
            <Church className="w-3.5 h-3.5" />
            Mass today · Find a parish
          </button>
        )}
      </div>
    </header>
  );
}
