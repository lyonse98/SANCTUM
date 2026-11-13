import { useEffect, useState } from 'react';
import { ArrowLeft, Church } from 'lucide-react';
import type { Audience, PersonaTheme, UtilityActions } from '@/types';
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
  /** Opens the Pray door on a named section (a companion's rosary link, a reminder's tap). */
  initialPraySection?: PraySection | null;
  onConsumePraySection?: () => void;
  audience: Audience;
  /** The season's theme — so the page wears the day's colour, not a fixed palette. */
  seasonTheme: PersonaTheme;
}

/**
 * Pocket Church's doors after the re-cut (Erik's approval, Nov 12, 2026):
 * PRAY, CONFESSION, ASK — three doors and nothing else on this page. Lectio
 * Divina and the Rule of Life both left the app as identifiable surfaces the
 * same day; their components stay in the repo, unwired, and the landings
 * that once named them now resolve to the Gospel on Today and to this page.
 */
export type ChurchTab = 'pray' | 'confession' | 'ask';

/** Inside the Pray door: the Rosary first, then the prayer library. */
export type PraySection = 'rosary' | 'prayers';

const TABS: { id: ChurchTab; label: string }[] = [
  { id: 'pray', label: 'Pray' },
  { id: 'confession', label: 'Confession' },
  { id: 'ask', label: 'Ask' },
];

const VALID_TABS = TABS.map((tab) => tab.id);

export function PocketChurchPage({ onBack, initialTab, onConsumeTab, initialPraySection, onConsumePraySection, utilities, audience, seasonTheme }: PocketChurchPageProps) {
  // A landing (a companion's link, a reminder's tap) names its door up front:
  // the page opens there directly rather than flashing the default door first.
  // The consume effects below still clear the request once it has landed.
  const [activeTab, setActiveTab] = useState<ChurchTab>(initialTab ?? 'pray');
  const [praySection, setPraySection] = useState<PraySection>(initialPraySection ?? 'rosary');
  const t = seasonTheme;

  // A companion can send a man straight to the door he needs.
  useEffect(() => {
    if (!initialTab) return;
    if ((VALID_TABS as string[]).includes(initialTab)) {
      setActiveTab(initialTab);
    }
    onConsumeTab?.();
  }, [initialTab, onConsumeTab]);

  useEffect(() => {
    if (!initialPraySection) return;
    setActiveTab('pray');
    setPraySection(initialPraySection);
    onConsumePraySection?.();
  }, [initialPraySection, onConsumePraySection]);

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
            Three doors: pray, prepare for Confession, or ask the Catechism a question. The faith in your pocket.
          </p>
        </div>

        {/* The three doors */}
        <div className="w-full flex gap-1.5 mb-5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border"
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
          {activeTab === 'pray' && (
            <div>
              {/* Inside Pray: the Rosary first, the library beside it. */}
              <div className="flex gap-1.5 mb-4">
                {(
                  [
                    { id: 'rosary', label: 'The Rosary' },
                    { id: 'prayers', label: 'Prayer Library' },
                  ] as { id: PraySection; label: string }[]
                ).map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setPraySection(section.id)}
                    className="flex-1 px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all border"
                    style={
                      praySection === section.id
                        ? { backgroundColor: t.accentRgba(0.12), color: t.accent, borderColor: t.accentRgba(0.35) }
                        : { backgroundColor: `${t.border}33`, color: t.textDim, borderColor: `${t.border}66` }
                    }
                  >
                    {section.label}
                  </button>
                ))}
              </div>
              {praySection === 'rosary' ? <RosaryPrayer t={t} /> : <PrayerLibrary t={t} />}
            </div>
          )}
          {activeTab === 'confession' && <ConfessionGuide t={t} audience={audience} />}
          {activeTab === 'ask' && <PocketCatechism t={t} audience={audience} defaultMode="ask" />}
        </div>

        <UtilitiesRow t={t} utilities={utilities} className="mt-6" />

        <p className="text-[10px] text-center mt-6 leading-relaxed max-w-xs" style={{ color: t.textDim }}>
          Pocket Church is for faith formation, not sacramental absolution. For the sacraments, see a priest.
        </p>
      </div>
    </div>
  );
}
