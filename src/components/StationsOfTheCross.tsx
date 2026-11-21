import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Cross } from 'lucide-react';
import { PRINT_SERIF, PRINT_STAMP_CLASS } from '@/lib/print';
import type { PersonaTheme } from '@/types';
import { PRAYERS } from '@/data/prayers';
import {
  STATIONS,
  STATIONS_VERSICLE,
  STATIONS_RESPONSE,
  STATIONS_OPENING_RUBRIC,
  STATIONS_PREPARATORY_PRAYER,
  STATIONS_CLOSING_RUBRIC,
  STATIONS_CLOSING_PRAYER_TITLE,
  STATIONS_CLOSING_PRAYER,
  STATIONS_FINAL_RUBRIC,
} from '@/data/stations';

interface StationsOfTheCrossProps {
  t: PersonaTheme;
}

/** The Act of Contrition from the one shared shelf — the booklet opens by
 *  directing the reader to make one; the words are the library's own. */
const ACT_OF_CONTRITION = PRAYERS.find((p) => p.title === 'Act of Contrition')?.text ?? '';

type Phase =
  | { kind: 'opening' }
  | { kind: 'station'; index: number }
  | { kind: 'closing' };

/** Opening, fourteen stations, closing. */
function totalSteps(): number {
  return 1 + STATIONS.length + 1;
}

function phaseFromStep(step: number): Phase {
  if (step === 0) return { kind: 'opening' };
  if (step >= totalSteps() - 1) return { kind: 'closing' };
  return { kind: 'station', index: step - 1 };
}

/**
 * The Way of the Cross in the Pray door (Pocket Church audit, Nov 20, 2026,
 * item 3), stepped the way the Rosary is stepped: one station on the leaf
 * at a time, in St. Alphonsus Liguori's received form — versicle, his
 * consideration, his prayer, the traditional prayers, and the Stabat Mater
 * verse that carries the reader to the next station.
 */
export function StationsOfTheCross({ t }: StationsOfTheCrossProps) {
  const [step, setStep] = useState(0);

  const maxStep = totalSteps() - 1;
  const phase = useMemo(() => phaseFromStep(step), [step]);
  const station = phase.kind === 'station' ? STATIONS[phase.index] : null;
  const progress = Math.round((step / maxStep) * 100);

  const handleNext = () => setStep((s) => Math.min(s + 1, maxStep));
  const handlePrev = () => setStep((s) => Math.max(s - 1, 0));
  const handleReset = () => setStep(0);

  return (
    <div className="px-1 pt-4" style={{ borderTop: `3px double ${t.border}` }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Cross className="w-4 h-4" style={{ color: t.accent }} />
        <h3 className={PRINT_STAMP_CLASS} style={{ fontFamily: PRINT_SERIF, color: t.accent }}>
          Stations of the Cross
        </h3>
      </div>
      <p className="text-[12px] italic mb-4" style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>
        According to the method of St. Alphonsus Liguori.
      </p>

      {/* Station banner */}
      {station && phase.kind === 'station' && (
        <div
          className="px-4 py-3 mb-4 border text-center animate-fade-in"
          style={{ backgroundColor: t.accentRgba(0.06), borderColor: t.accentRgba(0.2) }}
        >
          <p className="text-[12px] uppercase tracking-widest font-bold mb-1" style={{ fontFamily: PRINT_SERIF, color: t.accent }}>
            Station {phase.index + 1} of {STATIONS.length}
          </p>
          <p className="text-sm font-bold" style={{ fontFamily: PRINT_SERIF, color: t.textBright }}>
            {station.title}
          </p>
        </div>
      )}

      {/* The leaf itself */}
      <div
        className="px-4 py-4 mb-4 border"
        style={{ backgroundColor: `${t.border}14`, borderColor: t.border }}
      >
        {phase.kind === 'opening' && (
          <>
            <p className={PRINT_STAMP_CLASS} style={{ fontFamily: PRINT_SERIF, color: t.accent }}>
              Before You Begin
            </p>
            <p className="text-[13px] italic leading-relaxed mt-2" style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>
              {STATIONS_OPENING_RUBRIC}
            </p>
            <p className="text-[12px] font-bold uppercase tracking-widest mt-4 mb-1" style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>
              Act of Contrition
            </p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ fontFamily: PRINT_SERIF, color: t.text }}>
              {ACT_OF_CONTRITION}
            </p>
            <p className="text-[12px] font-bold uppercase tracking-widest mt-4 mb-1" style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>
              Preparatory Prayer
            </p>
            <p className="text-sm leading-relaxed" style={{ fontFamily: PRINT_SERIF, color: t.text }}>
              {STATIONS_PREPARATORY_PRAYER}
            </p>
          </>
        )}

        {station && (
          <>
            <p className="text-sm leading-relaxed" style={{ fontFamily: PRINT_SERIF, color: t.text }}>
              <span className="font-bold" style={{ color: t.accent }}>V.</span> {STATIONS_VERSICLE}
            </p>
            <p className="text-sm leading-relaxed mt-1" style={{ fontFamily: PRINT_SERIF, color: t.text }}>
              <span className="font-bold" style={{ color: t.accent }}>R.</span> {STATIONS_RESPONSE}
            </p>
            <p className="text-sm leading-relaxed mt-3" style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}>
              {station.consideration}
            </p>
            <p className="text-sm leading-relaxed mt-3" style={{ fontFamily: PRINT_SERIF, color: t.text }}>
              {station.prayer}
            </p>
            <p className="text-[12px] italic mt-4" style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>
              Our Father · Hail Mary · Glory Be
            </p>
            <p className="text-sm leading-relaxed mt-1" style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}>
              <span className="font-bold" style={{ color: t.accent }}>V.</span> Lord Jesus, crucified
              <br />
              <span className="font-bold" style={{ color: t.accent }}>R.</span> Have mercy on us.
            </p>
            <p className="text-[13px] italic leading-relaxed whitespace-pre-wrap mt-3 text-center" style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>
              {station.stabatMater}
            </p>
          </>
        )}

        {phase.kind === 'closing' && (
          <>
            <p className={PRINT_STAMP_CLASS} style={{ fontFamily: PRINT_SERIF, color: t.accent }}>
              To Complete the Devotion
            </p>
            <p className="text-[13px] italic leading-relaxed mt-2" style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>
              {STATIONS_CLOSING_RUBRIC}
            </p>
            <p className="text-[12px] font-bold uppercase tracking-widest mt-4 mb-1" style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>
              {STATIONS_CLOSING_PRAYER_TITLE}
            </p>
            <p className="text-sm leading-relaxed" style={{ fontFamily: PRINT_SERIF, color: t.text }}>
              {STATIONS_CLOSING_PRAYER}
            </p>
            <p className="text-[13px] italic leading-relaxed mt-3" style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>
              {STATIONS_FINAL_RUBRIC}
            </p>
          </>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[12px] uppercase tracking-widest font-bold" style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>
            Progress
          </span>
          <span className="text-[12px] font-bold" style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>
            {progress}%
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${t.border}80` }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, backgroundColor: t.accent }}
          />
        </div>
      </div>

      {/* Controls — the Rosary's own pattern. */}
      <div className="flex items-center gap-2">
        <button
          onClick={handlePrev}
          disabled={step === 0}
          className="min-h-[48px] flex items-center gap-1 px-3 py-2.5 border transition-opacity hover:opacity-80 active:opacity-60 disabled:opacity-30"
          style={{ backgroundColor: `${t.border}1F`, borderColor: t.border, color: t.textMuted }}
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="text-xs font-bold" style={{ fontFamily: PRINT_SERIF }}>Back</span>
        </button>

        <button
          onClick={handleReset}
          className="min-h-[48px] flex items-center gap-1 px-3 py-2.5 border transition-opacity hover:opacity-80 active:opacity-60"
          style={{ backgroundColor: `${t.border}1F`, borderColor: t.border, color: t.textDim }}
          aria-label="Restart the Stations"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleNext}
          disabled={step === maxStep}
          className="flex-1 min-h-[48px] flex items-center justify-center gap-1.5 px-4 py-2.5 transition-opacity hover:opacity-90 active:opacity-70 disabled:opacity-50"
          style={{ backgroundColor: t.accent, color: '#ffffff' }}
        >
          <span className="text-xs font-bold" style={{ fontFamily: PRINT_SERIF }}>
            {step === maxStep ? 'Complete' : phase.kind === 'opening' ? 'First Station' : 'Next Station'}
          </span>
          {step < maxStep && <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {step === maxStep && (
        <p className="text-center text-xs italic mt-4 animate-fade-in" style={{ fontFamily: PRINT_SERIF, color: t.accent }}>
          You have walked the Way of the Cross. We adore Thee, O Christ, and we bless Thee.
        </p>
      )}
    </div>
  );
}
