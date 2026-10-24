import { ArrowLeft, Wrench, X } from 'lucide-react';
import type { PersonaTheme, UtilityActions } from '@/types';
import { WorkshopTools } from '@/components/WorkshopTools';
import { UtilitiesRow } from '@/components/UtilitiesRow';
import { SeasonBackdrop } from '@/components/SeasonBackdrop';

interface WorkshopPageProps {
  onBack: () => void;
  utilities: UtilityActions;
  initialTool?: string | null;
  onConsumeTool?: () => void;
  seasonTheme: PersonaTheme;
}

export function WorkshopPage({ onBack, initialTool, onConsumeTool, utilities, seasonTheme }: WorkshopPageProps) {
  const t = seasonTheme;

  return (
    <div className="absolute inset-0 overflow-y-auto chat-scroll" style={{ backgroundColor: t.bg }}>
      <SeasonBackdrop />
      <div className="relative z-10 min-h-full flex flex-col items-center px-5 py-6 max-w-2xl mx-auto">
        {/* Header bar */}
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
              style={{ backgroundColor: t.accentRgba(0.12), borderColor: t.accentRgba(0.3) }}
            >
              <Wrench className="w-4 h-4" style={{ color: t.accent }} />
            </div>
            <h1 className="text-lg font-bold font-display uppercase tracking-wide" style={{ color: t.textBright }}>
              The Workshop
            </h1>
          </div>
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all active:scale-90 border"
            style={{ backgroundColor: t.card, color: t.textMuted, borderColor: `${t.border}99` }}
            aria-label="Close workshop"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Intro copy */}
        <div className="w-full text-center mb-6">
          <p className="text-sm leading-relaxed max-w-sm mx-auto" style={{ color: t.textMuted }}>
            Offline tools for grounding, stillness, and strength. No conversation needed —
            these work anytime, with no limits.
          </p>
        </div>

        {/* Tools */}
        <div className="w-full">
          <WorkshopTools
            theme={seasonTheme}
            initialTool={initialTool}
            onConsumeTool={onConsumeTool}
          />
        </div>

        <UtilitiesRow t={t} utilities={utilities} className="mt-6" />

        <p className="text-[10px] text-center mt-6 leading-relaxed max-w-xs" style={{ color: t.textDim }}>
          Sanctum is a spiritual companion, not a licensed therapist. In crisis? Call or text 988 (US).
        </p>
      </div>
    </div>
  );
}
