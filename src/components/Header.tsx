import {
  Eye,
  EyeOff,
  MoreVertical,
  Trash2,
  Settings as SettingsIcon,
  ChevronDown,
  Shield,
  Home,
  HeartHandshake,
  MessageSquare,
  Info,
} from 'lucide-react';
import { COMPANION_PORTRAYAL_SHORT } from '@/lib/privacyCopy';
import { PRINT_SERIF } from '@/lib/print';
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
  onFindHelp: () => void;
  onFeedback: () => void;
  onOpenAbout: () => void;
}

// The chat header, slimmed (Nov 20, 2026, Erik): the page is the
// conversation. The bar carries only who you're speaking with (with the
// switcher) and one "more actions" menu — every door (incognito, home,
// find help, clear, emergency disconnect, settings, feedback, about)
// lives in that menu, named in words instead of five cryptic icon
// buttons competing with the chat. The old persistent disclaimer bar
// is gone: the portrayal tag rides the name line, and the
// not-a-therapist + 988 line sits once, quietly, under the input.
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
  onFindHelp,
  onFeedback,
  onOpenAbout,
}: HeaderProps) {
  const t = persona.theme;
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!switcherOpen && !menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (switcherOpen && switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [switcherOpen, menuOpen]);

  const handlePick = (p: Persona) => {
    setSwitcherOpen(false);
    if (p.id !== persona.id) onSelectPersona(p);
  };

  const menuItem = (
    label: string,
    Icon: typeof Home,
    action: () => void,
    ariaLabel?: string,
  ) => (
    <button
      key={label}
      onClick={() => {
        setMenuOpen(false);
        action();
      }}
      aria-label={ariaLabel ?? label}
      className="w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left"
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = t.cardHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <Icon className="w-4 h-4 flex-shrink-0" style={{ color: t.textMuted }} />
      <span className="text-[13px] font-medium" style={{ color: t.text }}>
        {label}
      </span>
    </button>
  );

  return (
    <header
      className="sticky top-0 z-30 backdrop-blur-md border-b"
      style={{ backgroundColor: `${t.bg}F2`, borderColor: `${t.border}99` }}
    >
      <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
        <div className="relative flex items-center gap-3 group" ref={switcherRef}>
          <button
            onClick={() => {
              setMenuOpen(false);
              setSwitcherOpen((p) => !p);
            }}
            className="flex items-center gap-3"
            title="Switch companion"
          >
            <div className="relative">
              <div
                className="rounded-full shadow-md overflow-hidden"
                style={{ backgroundColor: t.card }}
              >
                <CompanionAvatar personaId={persona.id} theme={t} size={40} />
              </div>
              <div
                className="absolute -inset-0.5 rounded-full blur-md -z-10"
                style={{ backgroundColor: t.glow }}
              />
            </div>
            <div className="flex flex-col leading-tight text-left">
              <h1
                className="text-base font-bold tracking-tight"
                style={{ fontFamily: PRINT_SERIF, color: t.textBright }}
              >
                {persona.name}
              </h1>
              <div className="flex items-center gap-1">
                <span
                  className="text-[12px] uppercase tracking-[0.2em] font-medium stamped"
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
                <p className="text-[12px] font-bold uppercase tracking-[0.2em]" style={{ color: t.textDim }}>
                  Switch Companion
                </p>
              </div>
              <div className="py-1 max-h-[60vh] overflow-y-auto chat-scroll">
                {PERSONAS.filter((p) => p.audience === persona.audience).map((p) => (
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
                      <p className="text-xs font-bold tracking-wide" style={{ fontFamily: PRINT_SERIF, color: p.theme.textBright }}>
                        {p.name}
                      </p>
                      <p className="text-[12px] truncate" style={{ fontFamily: PRINT_SERIF, color: p.theme.textDim }}>
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
                  <span className="text-[12px] font-medium">Back to home</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Home is the one button that stays visible (Nov 20, 2026,
              Erik): it's the way out of the conversation, and a way out
              shouldn't be buried in a menu. */}
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

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => {
                setSwitcherOpen(false);
                setMenuOpen((p) => !p);
              }}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 active:scale-90 border"
              style={{
                backgroundColor: t.card,
                color: t.textMuted,
                borderColor: `${t.border}99`,
              }}
              aria-label="More actions"
              title="More actions"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div
                className="absolute top-full right-0 mt-2 w-64 rounded-xl border shadow-2xl overflow-hidden animate-fade-in z-40"
                style={{ backgroundColor: t.bg, borderColor: t.border }}
              >
                <div className="py-1">
                  {/* Incognito lives in the menu too (Nov 20, 2026, Erik):
                      the bar carries nothing but the companion and the
                      menu. Its state is written in the item, and while
                      it's on, the not-saved banner under the header is
                      the standing cue. */}
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onToggleIncognito();
                    }}
                    aria-label={incognito ? 'Incognito mode on' : 'Incognito mode off'}
                    className="w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = t.cardHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {incognito
                      ? <EyeOff className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} />
                      : <Eye className="w-4 h-4 flex-shrink-0" style={{ color: t.textMuted }} />}
                    <span className="text-[13px] font-medium flex-1" style={{ color: t.text }}>
                      Incognito mode
                    </span>
                    <span
                      className="text-[12px] font-bold uppercase tracking-wider"
                      style={{ color: incognito ? t.accent : t.textDim }}
                    >
                      {incognito ? 'On' : 'Off'}
                    </span>
                  </button>
                  {menuItem('Find a priest or director', HeartHandshake, onFindHelp)}
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onClear();
                    }}
                    aria-label="Clear this conversation"
                    className="w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = t.cardHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Trash2 className="w-4 h-4 flex-shrink-0" style={{ color: t.textMuted }} />
                    <span className="text-[13px] font-medium" style={{ color: t.text }}>
                      Clear this conversation
                    </span>
                  </button>
                  {menuItem('Emergency disconnect', Shield, onPanic)}
                </div>
                <div className="py-1 border-t" style={{ borderColor: `${t.border}66` }}>
                  {menuItem('Settings', SettingsIcon, onOpenSettings)}
                  {menuItem('Send feedback', MessageSquare, onFeedback)}
                  {menuItem('About Sanctum', Info, onOpenAbout)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
