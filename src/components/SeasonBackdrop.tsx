import { Flame, Star, Cross, Sunrise, Sprout, Crown, type LucideIcon } from 'lucide-react';
import type { LiturgicalSeason } from '@/data/liturgicalCalendar';
import { getDailyVisual } from '@/lib/liturgicalVisuals';

interface SeasonVisual {
  photo: string;
  icon: LucideIcon;
}

const VISUALS: Record<LiturgicalSeason, SeasonVisual> = {
  advent: {
    photo:
      'https://images.pexels.com/photos/14745924/pexels-photo-14745924.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    icon: Flame,
  },
  christmas: {
    photo:
      'https://images.pexels.com/photos/29928471/pexels-photo-29928471.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    icon: Star,
  },
  lent: {
    photo:
      'https://images.pexels.com/photos/15846818/pexels-photo-15846818.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    icon: Cross,
  },
  easter: {
    photo:
      'https://images.pexels.com/photos/10615213/pexels-photo-10615213.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    icon: Sunrise,
  },
  'ordinary-1': {
    photo:
      'https://images.pexels.com/photos/7568326/pexels-photo-7568326.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    icon: Sprout,
  },
  'ordinary-2': {
    photo:
      'https://images.pexels.com/photos/7568326/pexels-photo-7568326.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    icon: Sprout,
  },
};

export function SeasonBackdrop() {
  const visual = getDailyVisual();
  const { intensity } = visual;
  const Icon = intensity >= 3 ? Crown : VISUALS[visual.season]?.icon ?? Sprout;
  const photo = VISUALS[visual.season]?.photo ?? VISUALS['ordinary-1'].photo;

  // Stronger, not louder. The floor is raised so the image reads as an image and the glyph reads as
  // a mark, but the ceiling stays bounded so the surface remains calm at 6am. Each notch up the
  // rank ladder still deepens the colour, brightens the photo, and enlarges the glyph.
  const photoOpacity = 0.32 + intensity * 0.05;
  const washStrength = 0.26 + intensity * 0.055;
  const glyphOpacity = 0.1 + intensity * 0.015;
  const glyphSize = 280 + intensity * 44;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Season or feast photograph — visible enough to read as an image, not so loud it competes */}
      <div
        className="absolute inset-x-0 top-0 h-[480px] bg-cover bg-center transition-opacity duration-700"
        style={{
          backgroundImage: `url(${photo})`,
          opacity: photoOpacity,
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 58%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 58%, transparent 100%)',
          filter: intensity >= 2 ? 'saturate(1.12) contrast(1.08)' : 'saturate(0.98)',
        }}
      />

      {/* Liturgical colour wash */}
      <div
        className="absolute inset-x-0 top-0 h-[560px]"
        style={{
          background: `radial-gradient(ellipse at 50% -10%, ${visual.accent}${alpha(washStrength)} 0%, ${visual.accent}1C 42%, transparent 68%)`,
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[320px]"
        style={{
          background: `radial-gradient(ellipse at 50% 110%, ${visual.accent}1C 0%, transparent 65%)`,
        }}
      />

      {/* Oversized glyph — a mark on the page, not a watermark. Heavy enough to be seen. */}
      <div
        className="absolute -top-8 right-2 select-none font-display leading-none"
        style={{ fontSize: `${glyphSize}px`, color: visual.accent, opacity: glyphOpacity }}
      >
        {visual.glyph}
      </div>

      {/* Icon mark, lower half — heavier stroke than before, still restrained */}
      <div
        className="absolute bottom-10 left-4 select-none"
        style={{ color: visual.accent, opacity: 0.09 + intensity * 0.012 }}
      >
        <Icon className="w-56 h-56" strokeWidth={1.2} />
      </div>

      {/* Solemnities and feasts: an architectural top band and heavy corner brackets, in place of
          the filigree flourishes. Stone and iron, not lace. */}
      {intensity >= 2 && (
        <>
          <div
            className="absolute inset-x-0 top-0 h-28"
            style={{
              background: `linear-gradient(180deg, ${visual.accent}36 0%, transparent 100%)`,
              borderBottom: `2px solid ${visual.accent}55`,
            }}
          />
          <CornerBracket position="top-left" color={visual.accent} />
          <CornerBracket position="top-right" color={visual.accent} />
        </>
      )}

      {/* Solemnities only: a second band of rays from the top */}
      {intensity >= 3 && (
        <div
          className="absolute inset-x-0 top-0 h-64"
          style={{
            background: `repeating-conic-gradient(from 200deg at 50% -20%, ${visual.accent}00 0deg, ${visual.accent}1F 4deg, ${visual.accent}00 8deg)`,
            maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.7), transparent 85%)',
            WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0.7), transparent 85%)',
          }}
        />
      )}
    </div>
  );
}

/** A heavy architectural bracket — two strokes meeting at a corner. Replaces the ❦ filigree. */
function CornerBracket({
  position,
  color,
}: {
  position: 'top-left' | 'top-right';
  color: string;
}) {
  const base = 'absolute top-3 select-none';
  const sideClass = position === 'top-left' ? 'left-3' : 'right-3';
  const stroke = `2px solid ${color}80`;
  return (
    <span
      className={`${base} ${sideClass}`}
      style={{ width: '20px', height: '20px', borderTop: stroke, borderLeft: position === 'top-left' ? stroke : undefined, borderRight: position === 'top-right' ? stroke : undefined }}
    />
  );
}

/** 0.26 -> "42" — converts an opacity float to the hex alpha suffix used in CSS colour strings. */
function alpha(value: number): string {
  const hex = Math.round(Math.min(1, Math.max(0, value)) * 255)
    .toString(16)
    .padStart(2, '0');
  return hex.toUpperCase();
}
