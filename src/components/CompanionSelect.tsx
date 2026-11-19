import { useState } from 'react';
import { ChevronRight, Compass, Pin, PinOff } from 'lucide-react';
import { personasForAudience } from '@/personas';
import { loadFavoriteCompanion, saveFavoriteCompanion } from '@/lib/favoriteCompanion';
import { CompanionAvatar } from '@/components/CompanionAvatar';
import { CompanionRouter } from '@/components/CompanionRouter';
import { PrintPageHead } from '@/components/PrintPageHead';
import { CrisisLine } from '@/components/CrisisLine';
import { UtilitiesLine } from '@/components/UtilitiesLine';
import { PRINT_PLATE_CLASS, PRINT_SERIF } from '@/lib/print';
import { COMPANION_PORTRAYAL_LINE } from '@/lib/privacyCopy';
import { SeasonBackdrop } from '@/components/SeasonBackdrop';
import type { Audience, Persona, PersonaTheme, UtilityActions } from '@/types';

interface CompanionSelectProps {
  audience: Audience;
  onSelect: (persona: Persona) => void;
  onBack: () => void;
  theme: PersonaTheme;
  /** The housekeeping actions, fired from the utilities line at the foot of the page. */
  utilities: UtilityActions;
}

/**
 * The companions index in the printed page's language (Stage 2 of the
 * re-skin, Erik, Nov 14, 2026): the page opens with the quiz — "Not sure
 * who to talk to?" — as its head, and below it the company set as a
 * contents list. Each companion is a ruled plate: their portrait in a
 * circular medallion (the portraits stay, Erik's ruling), the name, and
 * their counsel line — the needs they speak to — as the entry's hint.
 * The browse-by-need tag cloud is gone as a surface (Erik's ruling, same
 * day): the needs data still lives on the cast and still routes the
 * quiz; it is simply no longer a wall of tags over the company. The
 * column is a leaf of the track's paper, as on Today.
 */
const ROW_CLASS =
  'w-full min-h-[48px] flex items-start gap-3 px-3.5 py-3 text-left transition-opacity hover:opacity-80 active:opacity-60';

export function CompanionSelect({ audience, onSelect, onBack, theme, utilities }: CompanionSelectProps) {
  const cast = personasForAudience(audience);
  const [routerOpen, setRouterOpen] = useState(false);
  const defaultTheme = theme;

  // The favorite companion (Erik, Nov 18, 2026): one pin per track, kept
  // on this device. The pinned companion stands at the head of the page
  // as its own plate, one tap from the conversation; the pin itself is
  // set or cleared by the small control on each companion's row.
  const [favoriteId, setFavoriteId] = useState<string | null>(() => loadFavoriteCompanion(audience));
  const favorite = favoriteId ? (cast.find((p) => p.id === favoriteId) ?? null) : null;
  const togglePin = (persona: Persona) => {
    const next = favoriteId === persona.id ? null : persona.id;
    setFavoriteId(next);
    saveFavoriteCompanion(audience, next);
  };

  // The counsel line — both casts carry their needs, in their own
  // register: her companions carry `issues`, written for her; his carry
  // the `struggles` they have always carried. The line is the entry's
  // hint now, where the chips used to sit.
  const needsOf = (p: Persona) => (audience === 'women' ? (p.issues ?? p.struggles) : p.struggles);

  return (
    <div className="absolute inset-0 overflow-y-auto chat-scroll" style={{ backgroundColor: defaultTheme.bg }}>
      <SeasonBackdrop />
      <div
        className="relative z-10 min-h-full flex flex-col items-center px-5 py-6 max-w-2xl mx-auto"
        style={{
          backgroundColor: defaultTheme.card,
          borderLeft: `1px solid ${defaultTheme.border}`,
          borderRight: `1px solid ${defaultTheme.border}`,
        }}
      >
        <PrintPageHead t={defaultTheme} title="Companions" onBack={onBack} />

        {/* The crisis line stands at the head of the room (Erik, Nov 18,
            2026) — the first thing on the surface, above the quiz and the
            list, for the visitor who came here in trouble. */}
        <CrisisLine muted={defaultTheme.textMuted} bright={defaultTheme.textBright} className="w-full mb-5" />

        {/* Your companion — the pinned one, at the very top (Erik,
            Nov 18, 2026): the plate resumes the conversation in one
            tap. Nothing renders here when no companion is pinned. */}
        {favorite && (
          <button
            data-favorite-companion
            onClick={() => onSelect(favorite)}
            className={`${PRINT_PLATE_CLASS} mb-6`}
            style={{ border: `1px solid ${defaultTheme.accent}`, backgroundColor: `${defaultTheme.border}1F` }}
          >
            <span className="portrait-arch-banner flex-shrink-0 rounded-full overflow-hidden">
              <CompanionAvatar personaId={favorite.id} theme={favorite.theme} size={44} />
            </span>
            <span className="flex-1 min-w-0">
              <span
                className="block text-[12px] font-bold uppercase tracking-[0.2em]"
                style={{ fontFamily: PRINT_SERIF, color: defaultTheme.accent }}
              >
                Your companion
              </span>
              <span className="block text-[15px] font-semibold mt-0.5" style={{ fontFamily: PRINT_SERIF, color: defaultTheme.textBright }}>
                {favorite.name}
              </span>
              <span className="block text-[13px] leading-snug" style={{ fontFamily: PRINT_SERIF, color: defaultTheme.textMuted }}>
                Pick up the conversation where it stands.
              </span>
            </span>
            <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: defaultTheme.accent }} strokeWidth={2.5} aria-hidden="true" />
          </button>
        )}

        <p className="text-sm leading-relaxed text-center max-w-sm mx-auto mb-5" style={{ fontFamily: PRINT_SERIF, color: defaultTheme.textMuted }}>
          Each one has walked the road you're on. Answer four quick questions to find your fit, or pick a voice yourself.
        </p>

        <p className="text-[13px] leading-relaxed text-center max-w-sm mx-auto -mt-3 mb-5" style={{ fontFamily: PRINT_SERIF, color: defaultTheme.textDim }}>
          {COMPANION_PORTRAYAL_LINE}
        </p>

        {/* The head of the page — the four-question quiz, on the plate. */}
        <button
          onClick={() => setRouterOpen(true)}
          className={`${PRINT_PLATE_CLASS} mb-6`}
          style={{ border: `1px solid ${defaultTheme.border}`, backgroundColor: `${defaultTheme.border}1F` }}
        >
          <Compass className="w-5 h-5 flex-shrink-0" style={{ color: defaultTheme.accent }} />
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-semibold" style={{ fontFamily: PRINT_SERIF, color: defaultTheme.textBright }}>
              Not sure who to talk to?
            </span>
            <span className="block text-[13px] leading-relaxed mt-0.5" style={{ fontFamily: PRINT_SERIF, color: defaultTheme.textDim }}>
              Answer four quick questions and we'll point you to the right companion.
            </span>
          </span>
          <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: defaultTheme.accent }} strokeWidth={2.5} aria-hidden="true" />
        </button>

        {/* The company, as a contents list — portrait medallion, name,
            the counsel line as the hint. */}
        <div className="w-full space-y-2">
          {cast.map((persona) => (
            <div
              key={persona.id}
              className="flex items-stretch"
              style={{ border: `1px solid ${defaultTheme.border}`, backgroundColor: `${defaultTheme.border}1F` }}
            >
              <button
                onClick={() => onSelect(persona)}
                className={`${ROW_CLASS} flex-1`}
              >
                {/* The medallion — the portrait in its frame. The frame
                    class is the one the select screen has always worn:
                    a circle on his track, the cathedral arch on hers. */}
                <span className="portrait-arch-banner flex-shrink-0 rounded-full overflow-hidden mt-0.5">
                  <CompanionAvatar personaId={persona.id} theme={persona.theme} size={44} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-baseline gap-2 flex-wrap">
                    <span
                      className="text-[15px] font-semibold"
                      style={{ fontFamily: PRINT_SERIF, color: defaultTheme.textBright }}
                    >
                      {persona.name}
                    </span>
                    <span
                      className="text-[12px] uppercase tracking-widest font-bold"
                      style={{ color: defaultTheme.textDim }}
                    >
                      {persona.title}
                    </span>
                  </span>
                  <span
                    className="block text-[13px] leading-snug mt-0.5"
                    style={{ fontFamily: PRINT_SERIF, color: defaultTheme.textMuted }}
                  >
                    {persona.description}
                  </span>
                  <span
                    className="block text-[12px] italic mt-1"
                    style={{ fontFamily: PRINT_SERIF, color: defaultTheme.textDim }}
                  >
                    {needsOf(persona).join(' · ')}
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: defaultTheme.accent }} strokeWidth={2.5} aria-hidden="true" />
              </button>
              {/* The pin — the row's one small control (Erik, Nov 18,
                  2026): pin this companion to the head of the page, or
                  clear the pin. Quiet by design; the plate at the top
                  is where the pin speaks. */}
              <button
                onClick={() => togglePin(persona)}
                aria-pressed={favoriteId === persona.id}
                aria-label={favoriteId === persona.id ? `Unpin ${persona.name}` : `Pin ${persona.name} as your companion`}
                title={favoriteId === persona.id ? 'Your companion — tap to unpin' : 'Make this your companion'}
                className="flex-shrink-0 px-2.5 flex items-start pt-3.5 transition-opacity hover:opacity-70"
                style={{ color: favoriteId === persona.id ? defaultTheme.accent : defaultTheme.textDim }}
              >
                {favoriteId === persona.id
                  ? <PinOff className="w-4 h-4" aria-hidden="true" />
                  : <Pin className="w-4 h-4" aria-hidden="true" />}
              </button>
            </div>
          ))}
        </div>

        <p className="text-[13px] text-center mt-6 leading-relaxed max-w-xs" style={{ fontFamily: PRINT_SERIF, color: defaultTheme.textDim }}>
          You can switch companions anytime. Each one brings a different voice, different tools, and a different light.
        </p>

        <UtilitiesLine t={defaultTheme} utilities={utilities} className="mt-8" />
      </div>

      <CompanionRouter
        t={defaultTheme}
        audience={audience}
        open={routerOpen}
        onClose={() => setRouterOpen(false)}
        onSelect={onSelect}
      />
    </div>
  );
}
