import { useState } from 'react';
import { ArrowLeft, Compass, Users } from 'lucide-react';
import { PERSONAS } from '@/personas';
import { CompanionRouter } from '@/components/CompanionRouter';
import { UtilitiesRow } from '@/components/UtilitiesRow';
import { SeasonBackdrop } from '@/components/SeasonBackdrop';
import type { Persona, PersonaId, PersonaTheme, UtilityActions } from '@/types';

interface CompanionSelectProps {
  onSelect: (persona: Persona) => void;
  onBack: () => void;
  utilities: UtilityActions;
  theme: PersonaTheme;
}

export function CompanionSelect({ onSelect, onBack, utilities, theme }: CompanionSelectProps) {
  const [hoveredId, setHoveredId] = useState<PersonaId | null>(null);
  const [routerOpen, setRouterOpen] = useState(false);
  const defaultTheme = theme;

  return (
    <div className="absolute inset-0 overflow-y-auto chat-scroll" style={{ backgroundColor: defaultTheme.bg }}>
      <SeasonBackdrop />
      <div className="relative z-10 min-h-full flex flex-col items-center px-5 py-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="w-full flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all active:scale-95"
            style={{ backgroundColor: defaultTheme.card, borderColor: `${defaultTheme.border}99`, color: defaultTheme.textMuted }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs font-bold font-display uppercase tracking-wide">Back</span>
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center border"
              style={{ backgroundColor: defaultTheme.accentRgba(0.12), borderColor: defaultTheme.accentRgba(0.3) }}
            >
              <Users className="w-4 h-4" style={{ color: defaultTheme.accent }} />
            </div>
            <h1 className="text-lg font-bold font-display uppercase tracking-wide" style={{ color: defaultTheme.textBright }}>
              Companions
            </h1>
          </div>
          <div className="w-20" />
        </div>

        <p className="text-sm leading-relaxed text-center max-w-sm mx-auto mb-5" style={{ color: defaultTheme.textMuted }}>
          Each one has walked the road you're on. Answer three quick questions to find your fit, or pick a voice yourself.
        </p>

        {/* Three-question quiz */}
        <button
          onClick={() => setRouterOpen(true)}
          className="w-full mb-6 flex items-center gap-3 px-4 py-3 rounded-xl border transition-all active:scale-[0.98] group"
          style={{
            backgroundColor: `${defaultTheme.border}26`,
            borderColor: `${defaultTheme.border}80`,
          }}
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border"
            style={{ backgroundColor: defaultTheme.accentRgba(0.08), borderColor: defaultTheme.accentRgba(0.2) }}
          >
            <Compass className="w-5 h-5" style={{ color: defaultTheme.accent }} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold font-display" style={{ color: defaultTheme.textBright }}>
              Not sure who to talk to?
            </p>
            <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: defaultTheme.textDim }}>
              Answer three quick questions and we'll point you to the right companion.
            </p>
          </div>
        </button>

        {/* Companion grid */}
        <div className="w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PERSONAS.map((persona) => {
              const isHovered = hoveredId === persona.id;
              return (
                <button
                  key={persona.id}
                  onClick={() => onSelect(persona)}
                  onMouseEnter={() => setHoveredId(persona.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className="group relative overflow-hidden rounded-xl border transition-all duration-300 text-left animate-fade-in"
                  style={{
                    background: isHovered ? persona.theme.cardHover : persona.theme.card,
                    borderColor: isHovered ? persona.theme.accentRgba(0.4) : persona.theme.border,
                  }}
                >
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{ background: persona.theme.glow }}
                  />
                  <div className="relative h-32 overflow-hidden">
                    <img
                      src={persona.portrait}
                      alt={persona.name}
                      loading="lazy"
                      decoding="async"
                      width={760}
                      height={415}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      style={{ filter: 'contrast(1.1) saturate(0.9)' }}
                    />
                    <div
                      className="absolute inset-0"
                      style={{ background: `linear-gradient(180deg, transparent 0%, ${persona.theme.bg}CC 100%)` }}
                    />
                  </div>

                  <div className="relative p-4 pt-2">
                    <div className="flex items-baseline gap-2 mb-1">
                      <h3
                        className="text-base font-bold font-display uppercase tracking-wide transition-colors duration-300"
                        style={{ color: isHovered ? persona.theme.textBright : persona.theme.text }}
                      >
                        {persona.name}
                      </h3>
                      <span
                        className="text-[10px] uppercase tracking-widest font-medium transition-colors duration-300"
                        style={{ color: isHovered ? persona.theme.accent : persona.theme.textDim }}
                      >
                        {persona.title}
                      </span>
                    </div>
                    <p
                      className="text-xs leading-relaxed mb-2 transition-colors duration-300"
                      style={{ color: isHovered ? persona.theme.textMuted : persona.theme.textDim }}
                    >
                      {persona.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {persona.struggles.map((struggle) => (
                        <span
                          key={struggle}
                          className="text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors duration-300"
                          style={{
                            color: isHovered ? persona.theme.accent : persona.theme.textDim,
                            borderColor: isHovered ? persona.theme.accentRgba(0.3) : persona.theme.border,
                            backgroundColor: isHovered ? persona.theme.accentRgba(0.06) : 'transparent',
                          }}
                        >
                          {struggle}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div
                    className="absolute bottom-0 left-0 h-0.5 transition-all duration-300"
                    style={{ width: isHovered ? '100%' : '0%', background: persona.theme.accent }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <UtilitiesRow t={defaultTheme} utilities={utilities} className="mt-6" />

        <p className="text-[11px] text-center mt-6 leading-relaxed max-w-xs" style={{ color: defaultTheme.textDim }}>
          You can switch companions anytime. Each one brings a different voice, different tools, and a different light.
        </p>
      </div>

      <CompanionRouter
        t={defaultTheme}
        open={routerOpen}
        onClose={() => setRouterOpen(false)}
        onSelect={onSelect}
      />
    </div>
  );
}
