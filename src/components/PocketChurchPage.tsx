import { useEffect, useState } from 'react';
import { ArrowLeft, Church } from 'lucide-react';
import type { PersonaTheme, UtilityActions } from '@/types';
import { UtilitiesRow } from '@/components/UtilitiesRow';
import { SeasonBackdrop } from '@/components/SeasonBackdrop';
import { PrayerLibrary } from '@/components/PrayerLibrary';
import { ConfessionGuide } from '@/components/ConfessionGuide';
import { PocketCatechism } from '@/components/PocketCatechism';
import { RosaryPrayer } from '@/components/RosaryPrayer';

interface PocketChurchPageProps {
  onBack: () => void;
  utilities: UtilityActions;
  initialTab?: ChurchTab | null;
  onConsumeTab?: () => void;
  onReflectWithCompanion?: (prompt: string) => void;
  /** A companion's tool:lectio link opens the session without a tap on the button. */
  autoOpenLectio?: boolean;
  onConsumeLectio?: () => void;
  /** The season's theme — so the page wears the day's colour, not a fixed palette. */
  seasonTheme: PersonaTheme;
}

export type ChurchTab = 'prayer' | 'rosary' | 'confession' | 'catechism';

const TABS: { id: ChurchTab; label: string }[] = [
  { id: 'prayer', label: 'Prayers' },
  { id: 'rosary', label: 'Rosary' },
  { id: 'confession', label: 'Confession' },
  { id: 'catechism', label: 'Catechism' },
];

const VALID_TABS = TABS.map((tab) => tab.id);

export function PocketChurchPage({ onBack, initialTab, onConsumeTab, utilities, onReflectWithCompanion, autoOpenLectio, onConsumeLectio, seasonTheme }: PocketChurchPageProps) {
  const [activeTab, setActiveTab] = useState<ChurchTab>('prayer');
  const t = seasonTheme;

  // A companion can send a man straight to the section he needs.
  useEffect(() => {
    if (!initialTab) return;
    if ((VALID_TABS as string[]).includes(initialTab)) {
      setActiveTab(initialTab);
    }
    onConsumeTab?.();
  }, [initialTab, onConsumeTab]);

  return (
    <div className="absolute inset-0 overflow-y-auto chat-scroll" style={{ backgroundColor: t.bg }}>
      <SeasonBackdrop />
      <div className="relative z-10 min-h-full flex flex-col items-center px-5 py-6 max-w-2xl mx-auto">
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
              style={{ backgroundColor: t.accentRgba(0.12), borderColor: t.accentRgba(0.3) }}
            >
              <Church className="w-4 h-4" style={{ color: t.accent }} />
            </div>
            <h1 className="text-lg font-bold font-display uppercase tracking-wide" style={{ color: t.textBright }}>
              Pocket Church
            </h1>
          </div>
          <div className="w-20" />
        </div>

        {/* Intro */}
        <div className="w-full text-center mb-6">
          <p className="text-sm leading-relaxed max-w-sm mx-auto" style={{ color: t.textMuted }}>
            Prayers, the Rosary, Confession prep, and a Catechism you can ask questions. The faith in your pocket.
          </p>
        </div>

        {/* Tab selector */}
        <div className="w-full flex gap-1.5 mb-5 overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border"
              style={
                activeTab === tab.id
                  ? { backgroundColor: t.accentRgba(0.15), color: t.accent, borderColor: t.accentRgba(0.4) }
                  : { backgroundColor: `${t.border}40`, color: t.textDim, borderColor: `${t.border}80` }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="w-full">
          {activeTab === 'prayer' && (
            <PrayerLibrary
              t={t}
              onReflectWithCompanion={onReflectWithCompanion}
              autoOpenLectio={autoOpenLectio}
              onConsumeLectio={onConsumeLectio}
            />
          )}
          {activeTab === 'rosary' && <RosaryPrayer t={t} />}
          {activeTab === 'confession' && <ConfessionGuide t={t} />}
          {activeTab === 'catechism' && <PocketCatechism t={t} />}
        </div>

        <UtilitiesRow t={t} utilities={utilities} className="mt-6" />

        <p className="text-[10px] text-center mt-6 leading-relaxed max-w-xs" style={{ color: t.textDim }}>
          Pocket Church is for faith formation, not sacramental absolution. For the sacraments, see a priest.
        </p>
      </div>
    </div>
  );
}
