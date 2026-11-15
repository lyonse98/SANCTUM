import { useEffect, useState } from 'react';
import type { Audience, PersonaTheme, UtilityActions } from '@/types';
import { SeasonBackdrop } from '@/components/SeasonBackdrop';
import { UtilitiesLine } from '@/components/UtilitiesLine';
import { PrintPageHead } from '@/components/PrintPageHead';
import { PRINT_CHOSEN_FILL_ALPHA, PRINT_SERIF, PRINT_STAMP_CLASS } from '@/lib/print';
import { PrayerLibrary } from '@/components/PrayerLibrary';
import { ConfessionGuide } from '@/components/ConfessionGuide';
import { PocketCatechism } from '@/components/PocketCatechism';
import { RosaryPrayer } from '@/components/RosaryPrayer';

interface PocketChurchPageProps {
  onBack: () => void;
  initialTab?: ChurchTab | null;
  onConsumeTab?: () => void;
  /** Opens the Pray door on a named section (a companion's rosary link, a reminder's tap). */
  initialPraySection?: PraySection | null;
  onConsumePraySection?: () => void;
  audience: Audience;
  /** The season's theme — so the page wears the day's colour, not a fixed palette. */
  seasonTheme: PersonaTheme;
  /** The housekeeping actions, fired from the utilities line at the foot of the page. */
  utilities: UtilityActions;
}

/**
 * Pocket Church's doors after the re-cut (Erik's approval, Nov 12, 2026):
 * PRAY, CONFESSION, ASK — three doors and nothing else on this page. Lectio
 * Divina and the Rule of Life both left the app as identifiable surfaces the
 * same day; their components stay in the repo, unwired, and the landings
 * that once named them now resolve to the Gospel on Today and to this page.
 *
 * Stage 2 of the printed-page re-skin (Nov 14, 2026) sets the page as a
 * leaf of the day's paper under the shared chapter head, and the three
 * doors as ruled plates in the day's accent — the open door wears the
 * accent frame, wash, and voice. The doors, their order, and everything
 * behind them are unchanged.
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

export function PocketChurchPage({ onBack, initialTab, onConsumeTab, initialPraySection, onConsumePraySection, audience, seasonTheme, utilities }: PocketChurchPageProps) {
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
      <div
        className="relative z-10 min-h-full flex flex-col items-center px-5 py-6 max-w-2xl mx-auto"
        style={{
          backgroundColor: t.card,
          borderLeft: `1px solid ${t.border}`,
          borderRight: `1px solid ${t.border}`,
        }}
      >
        <PrintPageHead t={t} title="Pocket Church" onBack={onBack} />

        {/* Intro */}
        <div className="w-full text-center mb-6">
          <p className="text-sm leading-relaxed max-w-sm mx-auto" style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}>
            Three doors: pray, prepare for Confession, or ask the Catechism a question. The faith in your pocket.
          </p>
        </div>

        {/* The three doors — ruled plates; the open door wears the accent. */}
        <div className="w-full flex gap-2 mb-5" role="tablist" aria-label="Pocket Church doors">
          {TABS.map((tab) => {
            const open = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={open}
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 min-h-[48px] px-3 py-2.5 transition-opacity hover:opacity-80 active:opacity-60"
                style={{
                  border: `1px solid ${open ? t.accent : t.border}`,
                  backgroundColor: open ? `${t.accent}${PRINT_CHOSEN_FILL_ALPHA}` : `${t.border}1F`,
                }}
              >
                <span
                  className={PRINT_STAMP_CLASS}
                  style={{ fontFamily: PRINT_SERIF, color: open ? t.accent : t.textDim }}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="w-full">
          {activeTab === 'pray' && (
            <div>
              {/* Inside Pray: the Rosary first, the library beside it. */}
              <div className="flex gap-2 mb-4">
                {(
                  [
                    { id: 'rosary', label: 'The Rosary' },
                    { id: 'prayers', label: 'Prayer Library' },
                  ] as { id: PraySection; label: string }[]
                ).map((section) => {
                  const open = praySection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setPraySection(section.id)}
                      aria-pressed={open}
                      className="flex-1 min-h-[44px] px-3 py-2 transition-opacity hover:opacity-80 active:opacity-60"
                      style={{
                        border: `1px solid ${open ? t.accent : t.border}`,
                        backgroundColor: open ? `${t.accent}${PRINT_CHOSEN_FILL_ALPHA}` : `${t.border}14`,
                      }}
                    >
                      <span
                        className="text-[11px] font-bold uppercase tracking-widest"
                        style={{ fontFamily: PRINT_SERIF, color: open ? t.accent : t.textDim }}
                      >
                        {section.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {praySection === 'rosary' ? <RosaryPrayer t={t} /> : <PrayerLibrary t={t} />}
            </div>
          )}
          {activeTab === 'confession' && <ConfessionGuide t={t} audience={audience} />}
          {activeTab === 'ask' && <PocketCatechism t={t} audience={audience} defaultMode="ask" />}
        </div>

        <p className="text-[10px] text-center mt-6 leading-relaxed max-w-xs" style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>
          Pocket Church is for faith formation, not sacramental absolution. For the sacraments, see a priest.
        </p>

        <UtilitiesLine t={t} utilities={utilities} className="mt-6" />
      </div>
    </div>
  );
}
