import { useEffect, useMemo, useState } from 'react';
import { Church, Lock, Zap } from 'lucide-react';
import { SeasonBadge } from '@/components/SeasonBadge';
import { getCurrentSeason } from '@/data/liturgicalCalendar';
import { getDailyVisual } from '@/lib/liturgicalVisuals';
import type { PersonaTheme } from '@/types';

interface TodayHeroProps {
  t: PersonaTheme;
  accent: string;
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
export function TodayHero({ t, accent }: TodayHeroProps) {
  const season = useMemo(() => getCurrentSeason(), []);
  const visual = useMemo(() => getDailyVisual(), []);
  const [greeting, setGreeting] = useState(() => greetingForHour(new Date().getHours()));

  useEffect(() => {
    const id = setInterval(() => setGreeting(greetingForHour(new Date().getHours())), 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="relative w-full text-center">
      <div
        className="absolute inset-x-0 -top-8 h-40 pointer-events-none"
        aria-hidden="true"
        style={{ background: `radial-gradient(ellipse at 50% 30%, ${accent}26 0%, transparent 68%)` }}
      />

      <div className="relative">
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
        <p className="text-xs text-forge-text-muted max-w-sm mx-auto leading-relaxed mb-3">
          A private sanctuary for men seeking counsel, stillness, and strength
        </p>

        <div className="flex items-center justify-center gap-2 flex-wrap mb-4">
          <span className="text-[10px] text-forge-text-dim stamped flex items-center gap-1">
            <Lock className="w-3 h-3" /> Nothing Stored on a Server
          </span>
          <span className="text-forge-text-dim text-[10px]">•</span>
          <span className="text-[10px] text-forge-text-dim stamped flex items-center gap-1">
            <Zap className="w-3 h-3" /> No Account Needed
          </span>
        </div>

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
      </div>
    </header>
  );
}
