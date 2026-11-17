import { useEffect, useState } from 'react';
import { ChevronRight, Loader2, MoonStar } from 'lucide-react';
import { PRINT_PLATE_CLASS, PRINT_SERIF, PRINT_STAMP_CLASS } from '@/lib/print';
import type { TailorMorningRecord } from '@/lib/tailor';
import {
  EVENING_STATES,
  buildCloseOfDay,
  loadTonightsClose,
  type EveningState,
  type TailorPmPackage,
} from '@/lib/tailorPm';
import { recordCoreAct } from '@/lib/daysPrayed';
import { recordKeptDay } from '@/lib/keptDays';
import type { Audience, PersonaTheme } from '@/types';

interface TailorPmProps {
  t: PersonaTheme;
  audience: Audience;
  dateKey: string;
  /** This morning's intake, from the device's own record — the twin needs a morning to close. */
  morning: TailorMorningRecord;
}

/**
 * Close the day — the Tailor PM twin's surface (Nov 14, 2026). It lives in
 * Tonight's closing, and only there: TonightClosing renders it solely when
 * this morning's Tailor build exists on the device, because the twin needs
 * a morning to close. One plate opens it; one tap on the dusk word builds
 * it (the function's allowance is one close per day); the package then
 * reads as a quiet night page — the reckoning, the closing prayer, the
 * line to carry into sleep — and is kept on the device for the night, so
 * re-opening reads it back instead of rebuilding. Print voice throughout,
 * matching Tonight and Tailor as they now stand. No audio in v1.
 */
export function TailorPm({ t, audience, dateKey, morning }: TailorPmProps) {
  const [open, setOpen] = useState(false);
  const [built, setBuilt] = useState<TailorPmPackage | null>(
    () => loadTonightsClose(dateKey, audience)?.evening ?? null,
  );
  const [building, setBuilding] = useState<EveningState | null>(null);
  const [failed, setFailed] = useState(false);

  // The Kept shelf's page for this day (incentives build, Nov 16, 2026):
  // a close already on the device — including one written before the
  // shelf existed — becomes a kept day on mount, its carry line the
  // day's page. Quiet: no visible change here.
  useEffect(() => {
    const cached = loadTonightsClose(dateKey, audience);
    if (cached) recordKeptDay(dateKey, cached.evening.carry);
  }, [dateKey, audience]);

  const onChoose = async (eveningState: EveningState) => {
    if (building || built) return;
    setBuilding(eveningState);
    setFailed(false);
    try {
      const evening = await buildCloseOfDay(dateKey, audience, morning, eveningState);
      setBuilt(evening);
      // The day is closed: one of the day's core acts (Play 4).
      recordCoreAct('tonight');
      // And the day is kept: its carry line becomes the day's page.
      recordKeptDay(dateKey, evening.carry);
    } catch {
      setFailed(true);
    } finally {
      setBuilding(null);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`${PRINT_PLATE_CLASS} mt-3.5`}
        style={{ backgroundColor: `${t.border}1F`, border: `1px solid ${t.border}` }}
      >
        <MoonStar className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} />
        <span className="flex-1">
          <span
            className="block text-[13px] font-bold"
            style={{ fontFamily: PRINT_SERIF, color: t.textBright }}
          >
            Close the day
          </span>
          <span className="block text-[12px] mt-0.5" style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}>
            {built
              ? 'Tonight\u2019s closing is written — read it back.'
              : 'This morning\u2019s devotional, reckoned against the day it became.'}
          </span>
        </span>
        <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} />
      </button>
    );
  }

  return (
    <div className="mt-3.5 pt-3.5" style={{ borderTop: `1px solid ${t.border}` }}>
      <p className={PRINT_STAMP_CLASS} style={{ fontFamily: PRINT_SERIF, color: t.accent }}>
        Close the day
      </p>

      {built ? (
        <div className="mt-2.5">
          <p
            className="text-[13px] leading-relaxed"
            style={{ fontFamily: PRINT_SERIF, color: t.text }}
          >
            {built.reflect}
          </p>
          <p className={`${PRINT_STAMP_CLASS} mt-4 mb-1.5`} style={{ color: t.textDim }}>
            Closing prayer
          </p>
          <p
            className="text-[13px] italic leading-relaxed"
            style={{ fontFamily: PRINT_SERIF, color: t.text }}
          >
            {built.prayer}
          </p>
          <p
            className="text-[13px] leading-relaxed mt-4 pt-3"
            style={{
              fontFamily: PRINT_SERIF,
              color: t.textBright,
              borderTop: `1px solid ${t.border}`,
            }}
          >
            {built.carry}
          </p>
        </div>
      ) : (
        <div className="mt-2.5">
          <p
            className="text-[12px] leading-relaxed mb-3"
            style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}
          >
            This morning you said how the day was coming in, and the devotional was written
            toward it. Tonight, one word for how the day actually went — and the day is
            closed against the morning.
          </p>
          <div className="space-y-1.5">
            {EVENING_STATES.map((s) => (
              <button
                key={s.id}
                onClick={() => void onChoose(s.id)}
                disabled={building !== null}
                className={PRINT_PLATE_CLASS}
                style={{ backgroundColor: `${t.border}1F`, border: `1px solid ${t.border}` }}
              >
                <span
                  className="text-[13px] font-medium flex-1"
                  style={{ fontFamily: PRINT_SERIF, color: t.text }}
                >
                  {s.label}
                </span>
                {building === s.id ? (
                  <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" style={{ color: t.accent }} />
                ) : (
                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} />
                )}
              </button>
            ))}
          </div>
          {building && (
            <p
              className="text-[12px] italic mt-2.5"
              style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}
            >
              Writing tonight&rsquo;s close&hellip;
            </p>
          )}
          {failed && (
            <p
              className="text-[13px] italic mt-2.5"
              style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}
            >
              Tonight&rsquo;s closing could not be written just now. The day is still
              yours to hand over — try again in a moment.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
