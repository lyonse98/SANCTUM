import { BookOpen, Users, Church, HeartHandshake, Settings as SettingsIcon, type LucideIcon } from 'lucide-react';
import type { TabId } from '@/types';

interface Tab {
  id: TabId;
  label: string;
  icon: LucideIcon;
}

/**
 * Five slots, four areas: Church and Companions on the left, Real Help and Settings on the
 * right, the Gospel lifted dead centre between them — slot three of five, so the raised
 * centre is a true centre. The raised slot is the app's front door and is drawn to be found
 * without reading: it is larger, lifted out of the ribbon, and ringed in the season's
 * colour. Its halo fires only on arrival, so the resting state stays calm. Settings is an
 * action, not a fifth area: its slot opens the settings modal and never takes the active
 * highlight. (The Workshop retired in Nov 2026 — its tools live on in Real Help, Pocket
 * Church, and Today's evening closing.)
 */
export const TABS: Tab[] = [
  { id: 'church', label: 'Church', icon: Church },
  { id: 'companions', label: 'Companions', icon: Users },
  { id: 'today', label: 'Today', icon: BookOpen },
  { id: 'help', label: 'Real Help', icon: HeartHandshake },
];

interface TabBarProps {
  active: TabId;
  onChange: (tab: TabId) => void;
  accent: string;
  cardColor: string;
  borderColor: string;
  textDim: string;
  /** Overrides the center tab's word — the Gospel in the morning, Tonight at night. */
  todayLabel?: string;
  /** Changes each time he lands on Today, which re-fires the arrival halo. */
  haloKey?: number;
  /** Opens the settings modal. The settings slot is an action, never a tab: it carries
   *  no active state and leaves the current tab's highlight where it was. */
  onOpenSettings?: () => void;
}

/**
 * Sanctum's footer ribbon: the four core areas plus the settings action, always one tap
 * away. Sits at the bottom on every size so the app reads the same on a phone as on a
 * desktop.
 */
export function TabBar({
  active,
  onChange,
  accent,
  cardColor,
  borderColor,
  textDim,
  todayLabel,
  haloKey,
  onOpenSettings,
}: TabBarProps) {
  return (
    <nav
      className="relative z-20 flex-shrink-0 border-t"
      style={{ backgroundColor: cardColor, borderColor, paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Main areas of Sanctum"
    >
      <div className="flex max-w-2xl mx-auto items-end">
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          const Icon = tab.icon;

          if (tab.id === 'today') {
            const label = todayLabel ?? tab.label;
            return (
              <button
                key={tab.id}
                data-slot={tab.id}
                onClick={() => onChange(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={`Today — the day's Gospel and the saint of the day (${label})`}
                className="flex-1 flex flex-col items-center pt-2.5 pb-3 transition-transform duration-200 active:scale-95"
              >
                <span className="relative -mt-9 flex items-center justify-center">
                  {/* Greets him each time he lands on Today, then rests. */}
                  {isActive && (
                    <span
                      key={haloKey ?? 0}
                      className="absolute rounded-full animate-tab-halo-burst"
                      aria-hidden="true"
                      style={{ width: '4rem', height: '4rem', backgroundColor: accent }}
                    />
                  )}
                  <span
                    className="relative rounded-full flex items-center justify-center border-[3px] transition-all duration-300"
                    style={{
                      width: '3.5rem',
                      height: '3.5rem',
                      background: `linear-gradient(160deg, ${accent}2E, ${cardColor})`,
                      borderColor: accent,
                      color: accent,
                      boxShadow: isActive
                        ? `0 6px 20px ${accent}70, 0 0 0 1px ${accent}40`
                        : `0 4px 14px ${accent}45`,
                    }}
                  >
                    <Icon className="w-6 h-6" strokeWidth={2.5} />
                  </span>
                </span>
                <span
                  className="text-[10px] font-bold uppercase tracking-wider mt-1.5"
                  style={{ color: accent, opacity: isActive ? 1 : 0.85 }}
                >
                  {label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              data-slot={tab.id}
              onClick={() => onChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className="flex-1 flex flex-col items-center gap-1 pt-2.5 pb-3 transition-all duration-200 active:scale-95 relative"
              style={{ color: isActive ? accent : textDim }}
            >
              {(tab.id === 'companions' || tab.id === 'help') && !isActive && (
                <span
                  className="absolute top-1 right-1/2 translate-x-[18px] w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: accent, opacity: 0.55 }}
                  aria-hidden="true"
                />
              )}
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.3 : 1.9} />
              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ opacity: isActive ? 1 : 0.8 }}
              >
                {tab.label}
              </span>
              <span
                className="h-0.5 w-5 rounded-full transition-all duration-300"
                style={{ backgroundColor: isActive ? accent : 'transparent' }}
              />
            </button>
          );
        })}
        {onOpenSettings && (
          <button
            data-slot="settings"
            onClick={onOpenSettings}
            aria-label="Settings"
            className="flex-1 flex flex-col items-center gap-1 pt-2.5 pb-3 transition-all duration-200 active:scale-95 relative"
            style={{ color: textDim }}
          >
            <SettingsIcon className="w-5 h-5" strokeWidth={1.9} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ opacity: 0.8 }}>
              Settings
            </span>
            <span className="h-0.5 w-5 rounded-full" style={{ backgroundColor: 'transparent' }} />
          </button>
        )}
      </div>
    </nav>
  );
}
