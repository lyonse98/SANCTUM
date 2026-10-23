import { useEffect, useMemo, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Loader2, BookOpen, Users, Check } from 'lucide-react';
import type { PersonaTheme } from '@/types';
import { fetchDailyReadings } from '@/lib/readings';
import { fetchPassage, type Passage } from '@/lib/bible';
import { DAILY_QUOTES } from '@/data/quotes';
import { LECTIO_STEPS, buildLectioPrompt } from '@/lib/lectio';

interface LectioDivinaProps {
  t: PersonaTheme;
  onClose: () => void;
  onReflectWithCompanion?: (prompt: string) => void;
}

function quoteForDay() {
  const date = new Date();
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000,
  );
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
}

/**
 * A guided walk through today's Gospel in the four movements of Lectio Divina.
 *
 * The Prayer tab used to be a shelf of fourteen texts in an accordion: it answered "what is this?"
 * and never "what do I do now?". This is the practice the shelf was missing — the same shape as
 * Cold Start and the Breath Pacer, but aimed at Scripture rather than at a man in trouble.
 *
 * It works offline. When the readings cannot be fetched it falls back to the day's verse rather
 * than refusing to open, because the moment a man reaches for this is often the moment he has no
 * signal.
 */
export function LectioDivina({ t, onClose, onReflectWithCompanion }: LectioDivinaProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [gospel, setGospel] = useState<Passage | null>(null);
  const [finished, setFinished] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const fallback = useMemo(() => quoteForDay(), []);

  useEffect(() => {
    let active = true;
    (async () => {
      const citations = await fetchDailyReadings();
      if (!active) return;
      if (citations?.gospel) {
        const passage = await fetchPassage(citations.gospel);
        if (!active) return;
        setGospel(passage);
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const step = LECTIO_STEPS[stepIndex];
  const isLast = stepIndex === LECTIO_STEPS.length - 1;
  const progress = Math.round(((stepIndex + 1) / LECTIO_STEPS.length) * 100);

  // The one step that asks for an answer puts the cursor in the box for him.
  useEffect(() => {
    if (step.writes && !finished) noteRef.current?.focus();
  }, [step.writes, finished]);

  const scripture = gospel?.text ?? `“${fallback.text}” — ${fallback.author}`;
  const citation = gospel?.citation ?? 'A word for today';

  const handleFinish = () => setFinished(true);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto chat-scroll rounded-2xl border p-5 animate-slide-up"
        style={{ backgroundColor: t.bg, borderColor: `${t.border}99` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" style={{ color: t.accent }} />
            <h2
              className="text-sm font-bold font-display uppercase tracking-wide"
              style={{ color: t.textBright }}
            >
              Lectio Divina
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="transition-opacity hover:opacity-70 active:scale-90"
            style={{ color: t.textDim }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12" style={{ color: t.textDim }}>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Gathering today&rsquo;s Gospel&hellip;</span>
          </div>
        ) : finished ? (
          /* The end — what he noticed, and the door onward */
          <div className="animate-fade-in">
            <div
              className="rounded-lg px-4 py-4 border mb-4"
              style={{ backgroundColor: t.accentRgba(0.06), borderColor: t.accentRgba(0.25) }}
            >
              <p
                className="text-[10px] uppercase tracking-widest font-bold mb-2"
                style={{ color: t.accent }}
              >
                What you said back
              </p>
              {note.trim() ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: t.text }}>
                  {note.trim()}
                </p>
              ) : (
                <p className="text-xs italic" style={{ color: t.textDim }}>
                  Nothing written — the prayer still happened.
                </p>
              )}
            </div>

            <p className="text-xs leading-relaxed text-center mb-4" style={{ color: t.textMuted }}>
              That is the whole practice: read, reflect, answer, rest. Take the word with you into
              the day.
            </p>

            {onReflectWithCompanion && (
              <button
                onClick={() => {
                  if (gospel) onReflectWithCompanion(buildLectioPrompt(gospel, note));
                  else onReflectWithCompanion(buildLectioPrompt({ citation, text: scripture, translation: '' }, note));
                  onClose();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all active:scale-[0.98] mb-2"
                style={{
                  backgroundColor: t.accentRgba(0.14),
                  borderColor: t.accent,
                  color: t.accent,
                }}
              >
                <Users className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wide">
                  Take it to a companion
                </span>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all active:scale-[0.98]"
              style={{ backgroundColor: `${t.border}33`, borderColor: `${t.border}99`, color: t.textMuted }}
            >
              <Check className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wide">Done</span>
            </button>
          </div>
        ) : (
          <>
            {/* Where he is in the four movements */}
            <div className="flex items-center gap-1.5 mb-4">
              {LECTIO_STEPS.map((s, i) => (
                <div key={s.key} className="flex-1">
                  <div
                    className="h-1 rounded-full transition-all duration-300"
                    style={{ backgroundColor: i <= stepIndex ? t.accent : `${t.border}66` }}
                  />
                </div>
              ))}
            </div>

            <div className="text-center mb-4">
              <p
                className="text-[10px] uppercase tracking-[0.2em] font-bold mb-0.5"
                style={{ color: t.accent }}
              >
                {step.latin}
              </p>
              <h3
                className="text-lg font-bold font-display uppercase tracking-wide"
                style={{ color: t.textBright }}
              >
                {step.label}
              </h3>
            </div>

            {/* The Scripture — shown throughout, so he never has to leave the step to look it up */}
            <div
              className="rounded-lg px-4 py-4 border mb-4"
              style={{ backgroundColor: `${t.border}33`, borderColor: `${t.border}4D` }}
            >
              <p
                className="text-[9px] uppercase tracking-widest font-bold mb-1.5"
                style={{ color: t.textDim }}
              >
                {citation}
              </p>
              <p className="text-sm leading-relaxed" style={{ color: t.textBright }}>
                {scripture}
              </p>
            </div>

            <p className="text-xs leading-relaxed mb-4" style={{ color: t.textMuted }}>
              {step.instruction}
            </p>

            {step.writes && (
              <div className="mb-4">
                <textarea
                  ref={noteRef}
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 1200))}
                  rows={4}
                  placeholder="Speak plainly. Nobody reads this but you."
                  className="w-full text-sm rounded-lg px-3 py-2.5 border focus:outline-none transition-colors resize-none"
                  style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}80`, color: t.text }}
                />
                <p className="text-[10px] mt-1.5" style={{ color: t.textDim }}>
                  Stays on this screen. Nothing is saved or sent.
                </p>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStepIndex((s) => Math.max(0, s - 1))}
                disabled={stepIndex === 0}
                className="flex items-center gap-1 px-3 py-2.5 rounded-lg border transition-all active:scale-95 disabled:opacity-30"
                style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}66`, color: t.textMuted }}
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="text-xs font-bold">Back</span>
              </button>

              <button
                onClick={() => (isLast ? handleFinish() : setStepIndex((s) => s + 1))}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg transition-all active:scale-95"
                style={{ backgroundColor: t.accent, color: '#ffffff' }}
              >
                <span className="text-xs font-bold">{isLast ? 'Finish' : 'Next'}</span>
                {!isLast && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>

            <p className="text-[10px] text-center mt-3" style={{ color: t.textDim }}>
              {progress}% &middot; about five minutes
            </p>
          </>
        )}
      </div>
    </div>
  );
}
