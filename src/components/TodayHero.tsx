import { useEffect, useMemo, useState } from 'react';
import { Church } from 'lucide-react';
import { SeasonBadge } from '@/components/SeasonBadge';
import { getCurrentSeason } from '@/data/liturgicalCalendar';
import { getDailyVisual } from '@/lib/liturgicalVisuals';
import { getFeastArt, getFeastEmblem } from '@/lib/feastArt';
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
 * The masthead for the Today area. It exists to make the front door feel like a place he has
 * arrived at rather than a list he has scrolled to: the season's colour, the hour of his day,
 * and the one thing worth doing — all above the Gospel card, in a single glance.
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
      <div
        className="absolute inset-x-0 -top-8 h-40 pointer-events-none"
        aria-hidden="true"
        style={{ background: `radial-gradient(ellipse at 50% 30%, ${accent}26 0%, transparent 68%)` }}
      />

      <div className="relative">
        {feastArt && (
          <figure
            className="relative w-full h-48 rounded-2xl overflow-hidden mb-5 border text-left"
            style={{ borderColor: t.accentRgba(0.35), boxShadow: `0 14px 34px -14px ${t.accent}66` }}
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
                className="inline-block text-[9px] font-bold uppercase tracking-[0.22em] px-2 py-0.5 rounded-full border mb-1.5"
                style={{ color: '#FFF6E8', borderColor: 'rgba(255,246,232,0.55)', backgroundColor: 'rgba(24,14,10,0.35)' }}
              >
                {feastArt.feast.rank}
              </span>
              <p className="font-display text-[22px] leading-tight" style={{ color: '#FFFBF2' }}>
                {feastArt.feast.name}
              </p>
              <p className="text-[10px] uppercase tracking-[0.18em] mt-0.5" style={{ color: 'rgba(255,246,232,0.85)' }}>
                {feastArt.feast.motif}
              </p>
            </figcaption>
          </figure>
        )}

        {feastEmblem && (
          <figure
            className="relative w-full rounded-2xl border mb-5 px-4 py-6"
            style={{
              borderColor: t.accentRgba(0.35),
              background: `linear-gradient(180deg, ${t.accentRgba(0.07)} 0%, transparent 100%)`,
            }}
          >
            <span
              className="inline-block text-[9px] font-bold uppercase tracking-[0.22em] px-2 py-0.5 rounded-full border mb-2"
              style={{ color: t.accent, borderColor: t.accentRgba(0.4), backgroundColor: t.accentRgba(0.08) }}
            >
              {feastEmblem.rank}
            </span>
            <div className="text-6xl leading-none mb-2" style={{ color: accent }} aria-hidden="true">
              {feastEmblem.glyph}
            </div>
            <figcaption>
              <p className="font-display text-[22px] leading-tight" style={{ color: t.textBright }}>
                {feastEmblem.name}
              </p>
              <p className="text-[10px] uppercase tracking-[0.18em] mt-0.5" style={{ color: t.textDim }}>
                {feastEmblem.motif}
              </p>
            </figcaption>
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

        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center border mx-auto mb-3"
          style={{
            backgroundColor: `${accent}14`,
            borderColor: `${accent}45`,
            boxShadow: `0 8px 24px -12px ${accent}99`,
          }}
        >
          <Church className="w-6 h-6" style={{ color: accent }} strokeWidth={2.2} />
        </div>

        <h1 className="text-3xl font-bold text-forge-text-bright font-display uppercase tracking-wide mb-1">
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

        <div
          className="mt-4 rounded-xl border px-4 py-3 text-left"
          style={{ backgroundColor: t.accentRgba(0.06), borderColor: t.accentRgba(0.28) }}
        >
          <p
            className="text-[9px] font-bold uppercase tracking-[0.2em] mb-1"
            style={{ color: t.accent }}
          >
            One thing today
          </p>
          <p className="text-xs leading-relaxed" style={{ color: t.textMuted }}>
            Read the Gospel below, then sit with it alongside a companion. That is the whole ask.
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
