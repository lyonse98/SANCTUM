import { useEffect, useState } from 'react';
import { ChevronRight, Users } from 'lucide-react';
import { personasForAudience } from '@/personas';
import { loadFavoriteCompanion } from '@/lib/favoriteCompanion';
import { CompanionAvatar } from '@/components/CompanionAvatar';
import { PRINT_PLATE_CLASS, PRINT_SERIF } from '@/lib/print';
import type { Audience, Persona, PersonaTheme, TabId } from '@/types';

interface CompanionPlateProps {
  t: PersonaTheme;
  audience: Audience;
  /** Straight into the conversation with this companion. */
  onOpenCompanion?: (persona: Persona) => void;
  /** The generic door's landing — the companions room itself. */
  onNavigate: (view: TabId) => void;
}

/**
 * The companion's presence on Today (Erik, Nov 20, 2026): companions are
 * half of this app but never acted like it — a small tab icon and a
 * contents line at the foot of the page, while Today owned the raised
 * centre and the whole first screen. This plate puts the other half in
 * the room with the day, directly under the masthead: the pinned
 * companion's face and name, one tap straight into the conversation —
 * the same plate the companions room keeps at its own head, in Today's
 * colours. With nobody pinned, the plate is the door itself (a saint to
 * talk with today) and lands on the room, so the presence is there for
 * everyone, pinned or not. Nothing here speaks for the companion: the
 * line under his name is his own tagline, the one he is introduced by
 * everywhere in the app.
 */
export function CompanionPlate({ t, audience, onOpenCompanion, onNavigate }: CompanionPlateProps) {
  const [favoriteId, setFavoriteId] = useState<string | null>(() => loadFavoriteCompanion(audience));

  // Re-read when the track changes — the pin is kept per track.
  useEffect(() => {
    setFavoriteId(loadFavoriteCompanion(audience));
  }, [audience]);

  const favorite = favoriteId
    ? (personasForAudience(audience).find((p) => p.id === favoriteId) ?? null)
    : null;

  if (favorite) {
    return (
      <button
        data-companion-plate
        onClick={() => onOpenCompanion?.(favorite)}
        className={PRINT_PLATE_CLASS}
        style={{ border: `1px solid ${t.accent}`, backgroundColor: `${t.border}1F` }}
        aria-label={`Your companion — talk with ${favorite.name}`}
      >
        <span className="portrait-arch-banner flex-shrink-0 rounded-full overflow-hidden">
          <CompanionAvatar personaId={favorite.id} theme={favorite.theme} size={44} />
        </span>
        <span className="flex-1 min-w-0">
          <span
            className="block text-[12px] font-bold uppercase tracking-[0.2em]"
            style={{ fontFamily: PRINT_SERIF, color: t.accent }}
          >
            Your companion
          </span>
          <span className="block text-[15px] font-semibold mt-0.5" style={{ fontFamily: PRINT_SERIF, color: t.textBright }}>
            {favorite.name}
          </span>
          <span className="block text-[13px] leading-snug" style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}>
            {favorite.tagline}
          </span>
        </span>
        <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} strokeWidth={2.5} aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      data-companion-plate
      onClick={() => onNavigate('companions')}
      className={PRINT_PLATE_CLASS}
      style={{ border: `1px solid ${t.border}`, backgroundColor: `${t.border}1F` }}
      aria-label="Companions — talk through today with a saint"
    >
      <span
        className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center"
        style={{ backgroundColor: `${t.accent}1A`, color: t.accent }}
        aria-hidden="true"
      >
        <Users className="w-5 h-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span
          className="block text-[12px] font-bold uppercase tracking-[0.2em]"
          style={{ fontFamily: PRINT_SERIF, color: t.accent }}
        >
          Companions
        </span>
        <span className="block text-[15px] font-semibold mt-0.5" style={{ fontFamily: PRINT_SERIF, color: t.textBright }}>
          Talk through today with a saint
        </span>
        <span className="block text-[13px] leading-snug" style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}>
          Choose a voice to walk with you.
        </span>
      </span>
      <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} strokeWidth={2.5} aria-hidden="true" />
    </button>
  );
}
