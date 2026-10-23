import { useState } from 'react';
import {
  ArrowLeft,
  Church,
  Compass,
  HeartPulse,
  Users,
  ExternalLink,
  MessageSquareQuote,
  X,
  Heart,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';
import type { PersonaTheme, UtilityActions } from '@/types';
import { UtilitiesRow } from '@/components/UtilitiesRow';
import { HELP_DISCLAIMER, HELP_SECTIONS, type HelpIconKey } from '@/lib/realHelp';

interface FindHelpPageProps {
  t: PersonaTheme;
  utilities: UtilityActions;
  accent?: string;
  onBack: () => void;
}

const ICONS: Record<HelpIconKey, LucideIcon> = {
  church: Church,
  compass: Compass,
  heart: HeartPulse,
  users: Users,
  marriage: Heart,
  recovery: RotateCcw,
};

/**
 * Hands the man to a real person. Deliberately prominent: it is the one screen that
 * keeps Sanctum honest, so it is reachable from the home toolbar, the chat, and crisis.
 */
export function FindHelpPage({ t, utilities, accent, onBack }: FindHelpPageProps) {
  const a = accent ?? t.accent;

  return (
    <div className="absolute inset-0 overflow-y-auto chat-scroll" style={{ backgroundColor: t.bg }}>
      <div className="min-h-full flex flex-col items-center px-5 py-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="w-full flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all active:scale-95"
            style={{ backgroundColor: t.card, borderColor: `${t.border}99`, color: t.textMuted }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs font-bold font-display uppercase tracking-wide">Back</span>
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center border"
              style={{ backgroundColor: `${a}1F`, borderColor: `${a}4D` }}
            >
              <Users className="w-4 h-4" style={{ color: a }} />
            </div>
            <h1 className="text-lg font-bold font-display uppercase tracking-wide" style={{ color: t.textBright }}>
              Find Real Help
            </h1>
          </div>
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all active:scale-90 border"
            style={{ backgroundColor: t.card, color: t.textMuted, borderColor: `${t.border}99` }}
            aria-label="Close"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Honest banner — the sentence clergy will look for */}
        <div
          className="w-full rounded-xl border p-4 mb-5 animate-fade-in"
          style={{ backgroundColor: `${a}0F`, borderColor: `${a}33` }}
        >
          <p className="text-sm leading-relaxed text-center font-medium" style={{ color: t.text }}>
            {HELP_DISCLAIMER}
          </p>
        </div>

        <p className="text-xs leading-relaxed text-center mb-6 max-w-md" style={{ color: t.textMuted }}>
          Six doors out of this app. Pick the one that fits what you are carrying right now.
        </p>

        {/* Sections */}
        <div className="w-full space-y-4">
          {HELP_SECTIONS.map((section, index) => (
            <HelpSectionCard key={section.id} section={section} t={t} accent={a} index={index} />
          ))}
        </div>

        <UtilitiesRow t={t} utilities={utilities} className="mt-6" />

        <p className="text-[10px] text-center mt-6 leading-relaxed max-w-xs" style={{ color: t.textDim }}>
          In crisis right now? Call or text 988 (US), or findahelpline.com outside the US.
        </p>
      </div>
    </div>
  );
}

interface HelpSectionCardProps {
  section: (typeof HELP_SECTIONS)[number];
  t: PersonaTheme;
  accent: string;
  index: number;
}

function HelpSectionCard({ section, t, accent, index }: HelpSectionCardProps) {
  const [showScript, setShowScript] = useState(false);
  const Icon = ICONS[section.icon];

  return (
    <div
      className="rounded-2xl border overflow-hidden animate-slide-up"
      style={{
        backgroundColor: t.card,
        borderColor: `${t.border}99`,
        animationDelay: `${index * 60}ms`,
        animationFillMode: 'backwards',
      }}
    >
      {/* Card header */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border"
          style={{ backgroundColor: `${accent}1A`, borderColor: `${accent}3D` }}
        >
          <Icon className="w-5 h-5" style={{ color: accent }} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold font-display uppercase tracking-wide leading-tight" style={{ color: t.textBright }}>
            {section.title}
          </h2>
          <p className="text-[11px] font-medium mt-0.5" style={{ color: accent }}>
            {section.tagline}
          </p>
        </div>
      </div>

      {/* Why it matters — always visible, this is the part that earns trust */}
      <div className="px-4 pb-3">
        <p className="text-xs leading-relaxed" style={{ color: t.textMuted }}>
          {section.why}
        </p>
      </div>

      {/* The words to say — progressive disclosure */}
      <div className="px-4 pb-3">
        <button
          onClick={() => setShowScript((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all active:scale-[0.98]"
          style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}80` }}
        >
          <MessageSquareQuote className="w-4 h-4 flex-shrink-0" style={{ color: accent }} />
          <span className="text-xs font-bold flex-1 text-left" style={{ color: t.text }}>
            {section.scriptLabel}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: t.textDim }}>
            {showScript ? 'Hide' : 'Show'}
          </span>
        </button>
        {showScript && (
          <div
            className="mt-2 rounded-lg border p-3 animate-fade-in"
            style={{ backgroundColor: `${accent}0D`, borderColor: `${accent}2E` }}
          >
            <p className="text-xs leading-relaxed italic" style={{ color: t.text }}>
              {section.script}
            </p>
          </div>
        )}
      </div>

      {/* Links */}
      <div className="px-4 pb-4 space-y-2">
        {section.links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all active:scale-[0.98]"
            style={{ backgroundColor: `${accent}0A`, borderColor: `${accent}2E` }}
          >
            <ExternalLink className="w-4 h-4 flex-shrink-0" style={{ color: accent }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold" style={{ color: t.textBright }}>
                {link.label}
              </p>
              <p className="text-[11px] leading-tight" style={{ color: t.textDim }}>
                {link.detail}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
