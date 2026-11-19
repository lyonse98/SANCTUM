import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { CompanionAvatar } from '@/components/CompanionAvatar';
import {
  composeIntakeSeed,
  initialIntakeState,
  intakeQuestions,
  intakeReducer,
  type IntakeAction,
  type IntakeState,
} from '@/lib/companionIntake';
import { PRINT_SERIF, PRINT_STAMP_CLASS } from '@/lib/print';
import type { Audience, Persona } from '@/types';

interface CompanionIntakeProps {
  persona: Persona;
  audience: Audience;
  /** The intake ended with at least one answer: send the composed seed as the conversation's first message. */
  onSeed: (text: string) => void;
  /** The intake ended with nothing answered: leave the plain empty state standing. */
  onSkip: () => void;
}

/**
 * The companion intake (Erik, Nov 19, 2026), standing where the bare
 * empty state stood when a conversation begins. It reads as the start
 * of the conversation it is: the companion's stamped name over each
 * question, the person's answers under their own "You", one question
 * at a time. The flow itself — what a chip does, what the own-words
 * escape does, what the seed says — lives in companionIntake, pure and
 * tested; this component only holds it for the length of the asking.
 * Nothing here is persisted: close the conversation mid-intake and the
 * partial answers are simply gone, which is what the privacy line at
 * its head promises.
 */
export function CompanionIntake({ persona, audience, onSeed, onSkip }: CompanionIntakeProps) {
  const t = persona.theme;
  const questions = useMemo(() => intakeQuestions(audience), [audience]);
  const [state, dispatch] = useReducer(
    (s: IntakeState, a: IntakeAction) => intakeReducer(s, a, questions),
    initialIntakeState,
  );
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const firedRef = useRef(false);

  // The intake's end is an effect, once: the composed seed goes out
  // through the ordinary send path, or — nothing answered — the plain
  // empty state takes the room back.
  useEffect(() => {
    if (!state.done || firedRef.current) return;
    firedRef.current = true;
    const seed = composeIntakeSeed(state.answers);
    if (seed) onSeed(seed);
    else onSkip();
  }, [state.done, state.answers, onSeed, onSkip]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.stepIndex, state.mode]);

  const finishNow = () => {
    if (firedRef.current) return;
    firedRef.current = true;
    const seed = composeIntakeSeed(state.answers);
    if (seed) onSeed(seed);
    else onSkip();
  };

  const current = questions[state.stepIndex];
  const answered = questions.slice(0, state.stepIndex).filter((q) => state.answers[q.id]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto chat-scroll px-5 py-5 space-y-6 max-w-2xl mx-auto w-full">
      {/* The head: who is asking, and the one plain line about where
          the answers go — nowhere but this conversation. */}
      <div className="text-center">
        <div className="flex justify-center mb-3">
          <div
            className="rounded-full shadow-xl overflow-hidden"
            style={{ backgroundColor: t.card, boxShadow: `inset 0 0 0 1.5px ${t.borderLight}` }}
          >
            <CompanionAvatar personaId={persona.id} theme={t} size={56} />
          </div>
        </div>
        <p className="text-sm leading-relaxed max-w-sm mx-auto" style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}>
          Before we begin — a few short questions, so {persona.name} knows how to listen.
        </p>
        <p className="text-[13px] leading-relaxed max-w-sm mx-auto mt-2" style={{ color: t.textDim }}>
          Your answers stay in this conversation — nothing is stored on a server.
        </p>
      </div>

      {/* What has been asked and answered so far, in the feed's own language. */}
      {answered.map((q) => (
        <div key={q.id} className="space-y-6">
          <div className="animate-fade-in">
            <p className={PRINT_STAMP_CLASS} style={{ fontFamily: PRINT_SERIF, color: t.accent }}>
              {persona.name}
            </p>
            <div className="text-sm leading-relaxed mt-1.5" style={{ fontFamily: PRINT_SERIF, color: t.text }}>
              {q.prompt}
            </div>
          </div>
          <div className="animate-fade-in ml-5 pl-4" style={{ borderLeft: `1px solid ${t.border}` }}>
            <p className={PRINT_STAMP_CLASS} style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>
              You
            </p>
            <div className="text-sm leading-relaxed whitespace-pre-wrap mt-1.5" style={{ fontFamily: PRINT_SERIF, color: t.text }}>
              {state.answers[q.id]?.display}
            </div>
          </div>
        </div>
      ))}

      {/* The question standing now. */}
      {current && !state.done && (
        <div className="animate-fade-in">
          <p className={PRINT_STAMP_CLASS} style={{ fontFamily: PRINT_SERIF, color: t.accent }}>
            {persona.name}
          </p>
          <div className="text-sm leading-relaxed mt-1.5 mb-4" style={{ fontFamily: PRINT_SERIF, color: t.text }}>
            {current.prompt}
          </div>

          {current.chips && state.mode === 'chips' ? (
            <>
              <div className="space-y-2">
                {current.chips.map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => dispatch({ type: 'chip', chip })}
                    className="w-full min-h-[48px] flex items-center justify-between px-4 py-3 border transition-opacity hover:opacity-80 active:opacity-60 text-left"
                    style={{ backgroundColor: `${t.border}1F`, borderColor: t.border, color: t.text }}
                  >
                    <span className="text-sm font-medium" style={{ fontFamily: PRINT_SERIF }}>{chip.label}</span>
                    <ChevronRight className="w-4 h-4" style={{ color: t.accent }} strokeWidth={2.5} />
                  </button>
                ))}
              </div>
              <button
                onClick={() => dispatch({ type: 'own-words' })}
                className="text-[13px] underline decoration-dotted underline-offset-4 transition-opacity hover:opacity-70 mt-3"
                style={{ color: t.textDim }}
              >
                Say it in my own words
              </button>
            </>
          ) : (
            <div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder={current.chips ? 'In your own words…' : 'Whatever you want known before we start…'}
                aria-label={current.prompt}
                className="w-full border px-3.5 py-2.5 text-sm leading-relaxed resize-none outline-none"
                style={{ backgroundColor: 'transparent', borderColor: t.border, fontFamily: PRINT_SERIF, color: t.text }}
              />
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => {
                    dispatch({ type: 'words', text: draft });
                    setDraft('');
                  }}
                  className="px-4 py-2.5 text-xs font-bold border transition-all active:scale-95"
                  style={{ backgroundColor: t.accentRgba(0.1), borderColor: t.accentRgba(0.35), color: t.accent }}
                >
                  {current.chips ? 'Continue' : 'Finish'}
                </button>
                {current.chips ? (
                  <button
                    onClick={() => {
                      dispatch({ type: 'back-to-chips' });
                      setDraft('');
                    }}
                    className="text-[13px] underline decoration-dotted underline-offset-4 transition-opacity hover:opacity-70"
                    style={{ color: t.textDim }}
                  >
                    Back to the choices
                  </button>
                ) : (
                  <button
                    onClick={() => dispatch({ type: 'words', text: '' })}
                    className="text-[13px] underline decoration-dotted underline-offset-4 transition-opacity hover:opacity-70"
                    style={{ color: t.textDim }}
                  >
                    Nothing more
                  </button>
                )}
              </div>
            </div>
          )}

          {/* The door out, standing from the first question: whatever
              has been answered goes with you; nothing answered, nothing sent. */}
          <div className="flex items-center gap-3 mt-6">
            <span className="flex-1 h-px" style={{ backgroundColor: `${t.border}66` }} />
            <button
              onClick={finishNow}
              className="text-[12px] font-bold uppercase tracking-widest transition-opacity hover:opacity-70"
              style={{ color: t.textDim }}
            >
              Just start talking
            </button>
            <span className="flex-1 h-px" style={{ backgroundColor: `${t.border}66` }} />
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
