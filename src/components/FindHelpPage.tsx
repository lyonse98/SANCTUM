import { useState } from 'react';
import {
  Church,
  Compass,
  HeartPulse,
  Users,
  ExternalLink,
  MessageSquareQuote,
  Heart,
  RotateCcw,
  Scroll,
  type LucideIcon,
} from 'lucide-react';
import type { Audience, PersonaTheme, UtilityActions } from '@/types';
import { SeasonBackdrop } from '@/components/SeasonBackdrop';
import { UtilitiesLine } from '@/components/UtilitiesLine';
import { PrintPageHead } from '@/components/PrintPageHead';
import { CrisisCard } from '@/components/CrisisCard';
import { PRINT_SERIF, PRINT_STAMP_CLASS } from '@/lib/print';
import { HELP_DISCLAIMER, HELP_SECTIONS, getHelpSections, type HelpIconKey } from '@/lib/realHelp';

interface FindHelpPageProps {
  t: PersonaTheme;
  audience: Audience;
  accent?: string;
  onBack: () => void;
  /** The funnel back to prayer — the foot of Real Help points into Pocket Church. */
  onPrayNow?: () => void;
  /** The housekeeping actions, fired from the utilities line at the foot of the page. */
  utilities: UtilityActions;
}

const ICONS: Record<HelpIconKey, LucideIcon> = {
  church: Church,
  confession: Scroll,
  compass: Compass,
  heart: HeartPulse,
  users: Users,
  marriage: Heart,
  recovery: RotateCcw,
};

/**
 * Hands the man to a real person. Deliberately prominent: it is the one screen that
 * keeps Sanctum honest, so it is reachable from the home toolbar, the chat, and crisis.
 *
 * Stage 2 of the printed-page re-skin (Nov 14, 2026) sets the page as a leaf
 * under the shared chapter head, and Erik's split of the same day stands the
 * doors apart: the crisis card first, rubricated, its content verbatim; then
 * Mass and Confession as their own entries (they were one lumped card), then
 * the director, the therapist, the group, and the rest — every link and line
 * the page has ever carried, re-mapped, none dropped.
 */
export function FindHelpPage({ t, audience, accent, onBack, onPrayNow, utilities }: FindHelpPageProps) {
  const sections = getHelpSections(audience);
  const a = accent ?? t.accent;

  return (
    <div className="absolute inset-0 overflow-y-auto chat-scroll" style={{ backgroundColor: t.bg }}>
      <SeasonBackdrop />
      <div
        className="relative z-10 min-h-full flex flex-col items-center px-5 py-6 max-w-2xl mx-auto"
        style={{
          backgroundColor: t.card,
          borderLeft: `1px solid ${t.border}`,
          borderRight: `1px solid ${t.border}`,
        }}
      >
        <PrintPageHead t={t} title="Find Real Help" onBack={onBack} withClose />

        {/* The first door — crisis, rubricated, the app's own card verbatim. */}
        <div className="w-full mb-5">
          <CrisisCard theme={t} />
        </div>

        {/* Honest banner — the sentence clergy will look for */}
        <div
          className="w-full border p-4 mb-5 animate-fade-in"
          style={{ backgroundColor: `${a}0F`, borderColor: `${a}33` }}
        >
          <p className="text-sm leading-relaxed text-center font-medium" style={{ fontFamily: PRINT_SERIF, color: t.text }}>
            {HELP_DISCLAIMER}
          </p>
        </div>

        <p className="text-xs leading-relaxed text-center mb-6 max-w-md" style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}>
          Eight doors out of this app. Pick the one that fits what you are carrying right now.
        </p>

        {/* Sections — real help only: people, not tools (Erik's ruling, Nov 12, 2026.
            The quick wellness tools were removed from the app altogether; this page
            hands the user to a priest, a director, a therapist, a group.) */}
        <div className="w-full">
          {sections.map((section, index) => (
            <HelpSectionCard key={section.id} section={section} t={t} accent={a} index={index} />
          ))}
        </div>

        {onPrayNow && (
          <button
            onClick={onPrayNow}
            className="mt-6 min-h-[48px] flex items-center justify-center gap-2 px-4 py-3 border transition-opacity hover:opacity-80 active:opacity-60 w-full"
            style={{ backgroundColor: `${a}0F`, borderColor: `${a}33`, color: a }}
          >
            <Church className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wide" style={{ fontFamily: PRINT_SERIF }}>Pray now · Pocket Church</span>
          </button>
        )}

        <p className="text-[10px] text-center mt-6 leading-relaxed max-w-xs" style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>
          In crisis right now? Call or text 988 (US), or findahelpline.com outside the US.
        </p>

        <UtilitiesLine t={t} utilities={utilities} className="mt-6" />
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
    <section
      className="animate-slide-up pt-5 pb-6"
      style={{
        borderTop: index === 0 ? `3px double ${t.border}` : `1px solid ${t.border}`,
        animationDelay: `${index * 60}ms`,
        animationFillMode: 'backwards',
      }}
    >
      {/* Section head — the door's name, stamped tagline under it. */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-11 h-11 flex items-center justify-center flex-shrink-0 border"
          style={{ backgroundColor: `${accent}1A`, borderColor: `${accent}3D` }}
        >
          <Icon className="w-5 h-5" style={{ color: accent }} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold leading-tight" style={{ fontFamily: PRINT_SERIF, color: t.textBright }}>
            {section.title}
          </h2>
          <p className={`${PRINT_STAMP_CLASS} mt-1`} style={{ fontFamily: PRINT_SERIF, color: accent }}>
            {section.tagline}
          </p>
        </div>
      </div>

      {/* Why it matters — always visible, this is the part that earns trust */}
      <p className="text-xs leading-relaxed mb-3" style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}>
        {section.why}
      </p>

      {/* The words to say — progressive disclosure. An entry with no script
          of its own (Mass, after the split) simply stands without one. */}
      {section.script && (
        <div className="mb-3">
          <button
            onClick={() => setShowScript((v) => !v)}
            aria-expanded={showScript}
            className="w-full min-h-[48px] flex items-center gap-2 px-3 py-2.5 border transition-opacity hover:opacity-80 active:opacity-60"
            style={{ backgroundColor: `${t.border}1F`, borderColor: t.border }}
          >
            <MessageSquareQuote className="w-4 h-4 flex-shrink-0" style={{ color: accent }} />
            <span className="text-xs font-bold flex-1 text-left" style={{ fontFamily: PRINT_SERIF, color: t.text }}>
              {section.scriptLabel}
            </span>
            <span className={PRINT_STAMP_CLASS} style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>
              {showScript ? 'Hide' : 'Show'}
            </span>
          </button>
          {showScript && (
            <div
              className="mt-2 border p-3 animate-fade-in"
              style={{ backgroundColor: `${accent}0D`, borderColor: `${accent}2E` }}
            >
              <p className="text-xs leading-relaxed italic" style={{ fontFamily: PRINT_SERIF, color: t.text }}>
                {section.script}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Links — ruled plates out of the app. */}
      <div className="space-y-2">
        {section.links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[48px] flex items-center gap-3 px-3 py-2.5 border transition-opacity hover:opacity-80 active:opacity-60"
            style={{ backgroundColor: `${accent}0A`, borderColor: `${accent}2E` }}
          >
            <ExternalLink className="w-4 h-4 flex-shrink-0" style={{ color: accent }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold" style={{ fontFamily: PRINT_SERIF, color: t.textBright }}>
                {link.label}
              </p>
              <p className="text-[11px] leading-tight" style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>
                {link.detail}
              </p>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
