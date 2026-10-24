import { useRef, useEffect } from 'react';
import { DailyQuote } from '@/components/DailyQuote';
import { SaintOfDayCard } from '@/components/SaintOfDayCard';
import { SeasonBackdrop } from '@/components/SeasonBackdrop';
import { TodayHero } from '@/components/TodayHero';
import { UtilitiesRow } from '@/components/UtilitiesRow';
import { getSeasonTheme, getSeasonAccentColor } from '@/lib/seasonTheme';
import type { UtilityActions } from '@/types';
import { PRIVACY_SHORT } from '@/lib/privacyCopy';

interface HomeScreenProps {
  onReflectWithCompanion: (message: string) => void;
  onOpenExamen: () => void;
  utilities: UtilityActions;
}

/**
 * The Today area — the app's front door. The Gospel leads and the saint follows it in full view;
 * neither is hidden behind a disclosure, because a man should be able to see what the day holds
 * without hunting for it. The five utilities close the page as an ordinary card.
 */
export function HomeScreen({ onReflectWithCompanion, onOpenExamen, utilities }: HomeScreenProps) {
  const gospelRef = useRef<HTMLDivElement>(null);
  const seasonTheme = getSeasonTheme();
  const seasonAccent = getSeasonAccentColor();

  useEffect(() => {
    if (window.location.hash !== '#daily-gospel') return;
    gospelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  return (
    <div className="absolute inset-0 overflow-y-auto chat-scroll bg-forge-bg">
      <SeasonBackdrop />
      <div className="relative z-10 min-h-full flex flex-col items-center px-5 py-8 pb-16 max-w-2xl mx-auto">
        <div className="w-full mb-6">
          <TodayHero t={seasonTheme} accent={seasonAccent} />
        </div>

        {/* Daily Gospel — the day's anchor */}
        <div ref={gospelRef} className="w-full mb-5">
          <DailyQuote
            t={seasonTheme}
            onOpenExamen={onOpenExamen}
            onReflectWithCompanion={onReflectWithCompanion}
          />
        </div>

        {/* Saint of the day — always in view, right where the Gospel leads */}
        <div className="w-full mb-5">
          <SaintOfDayCard t={seasonTheme} />
        </div>

        <UtilitiesRow t={seasonTheme} utilities={utilities} className="mb-4" />

        <p className="text-[11px] text-forge-text-dim text-center mt-4 leading-relaxed max-w-xs">
          Sanctum is a spiritual companion, not a licensed therapist. In crisis? Call or text 988 (US). {PRIVACY_SHORT}
        </p>
      </div>
    </div>
  );
}
