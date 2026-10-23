import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { getCurrentSeason } from '@/data/liturgicalCalendar';
import { getDailyVisual } from '@/lib/liturgicalVisuals';
import type { FeastRank } from '@/data/feastDays';

const RANK_LABEL: Record<FeastRank, string> = {
  solemnity: 'Solemnity',
  feast: 'Feast',
  memorial: 'Memorial',
};

export function SeasonBadge() {
  const season = useMemo(() => getCurrentSeason(), []);
  const visual = getDailyVisual();

  return (
    <div
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest"
      style={{
        backgroundColor: `${visual.accent}${visual.feastName ? '1F' : '15'}`,
        borderColor: `${visual.accent}${visual.feastName ? '60' : '40'}`,
        color: visual.accent,
      }}
    >
      {visual.feastName ? (
        <>
          <Sparkles className="w-3 h-3" />
          <span>{visual.feastName}</span>
          {visual.feastRank && (
            <span style={{ opacity: 0.7 }}>· {RANK_LABEL[visual.feastRank]}</span>
          )}
        </>
      ) : (
        <>
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: visual.accent }}
          />
          {season.name}
        </>
      )}
    </div>
  );
}

export { getCurrentSeason };
