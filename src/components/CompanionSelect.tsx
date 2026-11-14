import { useState } from 'react';
import { ChevronRight, Compass } from 'lucide-react';
import { personasForAudience } from '@/personas';
import { CompanionAvatar } from '@/components/CompanionAvatar';
import { CompanionRouter } from '@/components/CompanionRouter';
import { PrintPageHead } from '@/components/PrintPageHead';
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

        <p className="text-sm leading-relaxed text-center max-w-sm mx-auto mb-5" style={{ fontFamily: PRINT_SERIF, color: defaultTheme.textMuted }}>
          Each one has walked the road you're on. Answer three quick questions to find your fit, or pick a voice yourself.
        </p>

        <p className="text-[11px] leading-relaxed text-center max-w-sm mx-auto -mt-3 mb-5" style={{ fontFamily: PRINT_SERIF, color: defaultTheme.textDim }}>
          {COMPANION_PORTRAYAL_LINE}
        </p>

        {/* The head of the page — the three-question quiz, on the plate. */}
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
            <span className="block text-[11px] leading-relaxed mt-0.5" style={{ fontFamily: PRINT_SERIF, color: defaultTheme.textDim }}>
              Answer three quick questions and we'll point you to the right companion.
            </span>
          </span>
          <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: defaultTheme.accent }} strokeWidth={2.5} aria-hidden="true" />
        </button>

        {/* The company, as a contents list — portrait medallion, name,
            the counsel line as the hint. */}
        <div className="w-full space-y-2">
          {cast.map((persona) => (
            <button
              key={persona.id}
              onClick={() => onSelect(persona)}
              className={ROW_CLASS}
              style={{ border: `1px solid ${defaultTheme.border}`, backgroundColor: `${defaultTheme.border}1F` }}
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
                    className="text-[9px] uppercase tracking-widest font-bold"
                    style={{ color: defaultTheme.textDim }}
                  >
                    {persona.title}
                  </span>
                </span>
                <span
                  className="block text-[11px] leading-snug mt-0.5"
                  style={{ fontFamily: PRINT_SERIF, color: defaultTheme.textMuted }}
                >
                  {persona.description}
                </span>
                <span
                  className="block text-[10px] italic mt-1"
                  style={{ fontFamily: PRINT_SERIF, color: defaultTheme.textDim }}
                >
                  {needsOf(persona).join(' · ')}
                </span>
              </span>
              <ChevronRight className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: defaultTheme.accent }} strokeWidth={2.5} aria-hidden="true" />
            </button>
          ))}
        </div>

        <p className="text-[11px] text-center mt-6 leading-relaxed max-w-xs" style={{ fontFamily: PRINT_SERIF, color: defaultTheme.textDim }}>
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
