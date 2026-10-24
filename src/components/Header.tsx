import {
  Eye,
  EyeOff,
  Trash2,
  Settings as SettingsIcon,
  ChevronDown,
  Shield,
  Home,
} from 'lucide-react';
import { COMPANION_PORTRAYAL_SHORT } from '@/lib/privacyCopy';
import { CompanionAvatar } from '@/components/CompanionAvatar';
import { PERSONAS } from '@/personas';
import type { Persona } from '@/types';
import { useState, useRef, useEffect } from 'react';

interface HeaderProps {
  persona: Persona;
  onSwitchPersona: () => void;
  onSelectPersona: (p: Persona) => void;
  incognito: boolean;
  onToggleIncognito: () => void;
  onClear: () => void;
  onOpenSettings: () => void;
  onPanic: () => void;
  onGoHome: () => void;
}

export function Header({
  persona,
  onSwitchPersona,
  onSelectPersona,
  incognito,
  onToggleIncognito,
  onClear,
  onOpenSettings,
  onPanic,
  onGoHome,
}: HeaderProps) {
  const t = persona.theme;
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!switcherOpen) return;
    const handler = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [switcherOpen]);

  const handlePick = (p: Persona) => {
    setSwitcherOpen(false);
    if (p.id !== persona.id) onSelectPersona(p);
  };

  return (
    <>
    <header
      className="sticky top-0 z-30 backdrop-blur-md border-b"
      style={{ backgroundColor: `${t.bg}F2`, borderColor: `${t.border}99` }}
    >
      <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
        <div className="relative flex items-center gap-3 group" ref={switcherRef}>
          <button
            onClick={() => setSwitcherOpen((p) => !p)}
            className="flex items-center gap-3"
            title="Switch companion"
          >
            <div className="relative">
              <div
                className="rounded-lg shadow-md border overflow-hidden"
                style={{ backgroundColor: t.card, borderColor: t.borderLight }}
              >
                <CompanionAvatar personaId={persona.id} theme={t} size={40} />
              </div>
              <div
                className="absolute -inset-0.5 rounded-lg blur-md -z-10"
                style={{ backgroundColor: t.glow }}
              />
            </div>
            <div className="flex flex-col leading-tight text-left">
              <h1
                className="text-base font-bold tracking-tight font-display uppercase"
                style={{ color: t.textBright }}
              >
                {persona.name}
              </h1>
              <div className="flex items-center gap-1">
                <span
                  className="text-[9px] uppercase tracking-[0.2em] font-medium stamped"
                  style={{ color: t.textDim }}
                >
                  {persona.title} {'\u00B7'} {COMPANION_PORTRAYAL_SHORT}
                </span>
                <ChevronDown
                  className={`w-2.5 h-2.5 transition-transform duration-200 ${switcherOpen ? 'rotate-180' : ''}`}
                  style={{ color: t.textDim }}
                />
              </div>
            </div>
          </button>

          {switcherOpen && (
            <div
              className="absolute top-full left-0 mt-2 w-72 rounded-xl border shadow-2xl overflow-hidden animate-fade-in z-40"
              style={{ backgroundColor: t.bg, borderColor: t.border }}
            >
              <div className="px-3 py-2 border-b" style={{ borderColor: `${t.border}66` }}>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: t.textDim }}>
                  Switch Companion
                </p>
              </div>
              <div className="py-1 max-h-[60vh] overflow-y-auto chat-scroll">
                {PERSONAS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handlePick(p)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left"
                    style={{
                      backgroundColor: p.id === persona.id ? p.theme.accentRgba(0.08) : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (p.id !== persona.id) e.currentTarget.style.backgroundColor = p.theme.cardHover;
                    }}
                    onMouseLeave={(e) => {
                      if (p.id !== persona.id) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <CompanionAvatar personaId={p.id} theme={p.theme} size={32} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold font-display uppercase tracking-wide" style={{ color: p.theme.textBright }}>
                        {p.name}
                      </p>
                      <p className="text-[10px] truncate" style={{ color: p.theme.textDim }}>
                        {p.tagline}
                      </p>
                    </div>
                  </button>
                ))}
                <button
                  onClick={() => { setSwitcherOpen(false); onSwitchPersona(); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 border-t transition-colors text-left"
                  style={{ borderColor: `${t.border}66`, color: t.textDim }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = t.cardHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <Home className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-medium">Back to home</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onGoHome}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 active:scale-90 border"
            style={{
              backgroundColor: t.card,
              color: t.textMuted,
              borderColor: `${t.border}99`,
            }}
            aria-label="Back to home"
            title="Back to home"
          >
            <Home className="w-4 h-4" />
          </button>

          <button
            onClick={onPanic}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 active:scale-90 border"
            style={{
              backgroundColor: t.card,
              color: t.textMuted,
              borderColor: `${t.border}99`,
            }}
            aria-label="Emergency disconnect"
            title="Emergency disconnect — wipes all data and exits"
          >
            <Shield className="w-4 h-4" />
          </button>

          <button
            onClick={onToggleIncognito}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 active:scale-90 border"
            style={
              incognito
                ? {
                    backgroundColor: t.accentRgba(0.15),
                    color: t.accent,
                    borderColor: t.accentRgba(0.4),
                  }
                : {
                    backgroundColor: t.card,
                    color: t.textMuted,
                    borderColor: `${t.border}99`,
                  }
            }
            aria-label={incognito ? 'Incognito mode on' : 'Incognito mode off'}
            title={incognito ? 'Incognito ON — history not saved' : 'Incognito OFF'}
          >
            {incognito ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>

          <button
            onClick={onClear}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 active:scale-90 border"
            style={{
              backgroundColor: t.card,
              color: t.textMuted,
              borderColor: `${t.border}99`,
            }}
            aria-label="Clear conversation"
            title="Clear conversation"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenSettings}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 active:scale-90 border relative"
            style={{
              backgroundColor: t.card,
              color: t.textMuted,
              borderColor: `${t.border}99`,
            }}
            aria-label="Settings"
            title="Settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Persistent disclaimer bar */}
      <div
        className="px-4 py-1 border-t text-center"
        style={{ borderColor: `${t.border}66`, backgroundColor: `${t.bg}80` }}
      >
        <p className="text-[9px] leading-relaxed" style={{ color: t.textDim }}>
          For historical, philosophical, and personal reflection only. Not licensed therapy, spiritual direction, or Sacramental Absolution.
        </p>
      </div>
    </header>
    </>
  );
}
