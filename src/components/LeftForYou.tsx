import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { PRINT_SERIF, PRINT_STAMP_CLASS } from '@/lib/print';
import { contentDate, contentDateKey } from '@/lib/dayBoundary';
import { nextSeasonTurn, seasonInstanceKey } from '@/lib/seasonTurns';
import { saintLineFor } from '@/lib/narratorCore';
import { PRAYERS } from '@/data/prayers';
import { fetchDailyReadings } from '@/lib/readings';
import { fetchPassageVerses } from '@/lib/bible';
import { pickKeyVerse } from '@/lib/keyVerse';
import { PERSONAS, personasForAudience } from '@/personas';
import {
  eligibleLetterPersona,
  fetchCompanionLetter,
  letterFramingLine,
  markLetterShown,
  pendingLetter,
  storeLetter,
  type StoredLetter,
} from '@/lib/letters';
import {
  hashKey,
  isGiftDay,
  loadGiftState,
  pickQuestion,
  recordGiftDismissed,
  recordGiftShown,
  recordQuestionShown,
  selectGift,
} from '@/lib/giftSlot';
import type { Audience, PersonaTheme } from '@/types';

interface LeftForYouProps {
  t: PersonaTheme;
  audience: Audience;
  onOpenCompanion: (personaId: string) => void;
}

type RenderedGift =
  | { kind: 'letter-pending'; letter: StoredLetter }
  | { kind: 'letter-new'; letter: StoredLetter }
  | { kind: 'anticipation'; beginsText: string }
  | { kind: 'saint'; text: string }
  | { kind: 'question'; personaId: string; personaName: string; question: string }
  | { kind: 'reflection'; title: string | null; text: string; citation: string | null };

function prayerForDate(dateKey: string): { title: string; text: string } {
  const short = PRAYERS.filter((p) => p.text.length < 400);
  const pool = short.length ? short : PRAYERS;
  const chosen = pool[hashKey(dateKey) % pool.length];
  return { title: chosen.title, text: chosen.text };
}

function personaNameFor(id: string): string {
  return PERSONAS.find((p) => p.id === id)?.name ?? id;
}

export function LeftForYou({ t, audience, onOpenCompanion }: LeftForYouProps) {
  const [gift, setGift] = useState<RenderedGift | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const shownAtRef = useRef<number | null>(null);
  const recordedRef = useRef(false);
  const dateKeyRef = useRef<string>(contentDateKey());

  useEffect(() => {
    let live = true;
    const dateKey = contentDateKey();
    dateKeyRef.current = dateKey;
    const cDate = contentDate();

    if (!isGiftDay(dateKey)) return;

    const showReflectionWithPrayerFirst = () => {
      const prayer = prayerForDate(dateKey);
      if (!live) return;
      setGift({ kind: 'reflection', title: prayer.title, text: prayer.text, citation: null });
      void (async () => {
        try {
          const readings = await fetchDailyReadings(cDate);
          if (!live || !readings?.gospel) return;
          const verses = await fetchPassageVerses(readings.gospel);
          if (!live || !verses) return;
          const verse = pickKeyVerse(verses);
          if (!live || !verse) return;
          setGift({ kind: 'reflection', title: null, text: verse.text, citation: verse.citation });
        } catch {
          // prayer already stands
        }
      })();
    };

    const renderFallback = (g: ReturnType<typeof selectGift>) => {
      if (!live) return;
      if (g.kind === 'anticipation') {
        setGift({ kind: 'anticipation', beginsText: g.anticipation.beginsText });
      } else if (g.kind === 'saint') {
        setGift({ kind: 'saint', text: g.saintLine });
      } else if (g.kind === 'question') {
        recordQuestionShown(g.personaId, dateKey);
        setGift({ kind: 'question', personaId: g.personaId, personaName: personaNameFor(g.personaId), question: g.question });
      } else {
        showReflectionWithPrayerFirst();
      }
    };

    void (async () => {
      const pending = pendingLetter();
      const inAudience = personasForAudience(audience);
      const candidate = pending ? null : eligibleLetterPersona(inAudience.map((p) => p.id));
      const turn = nextSeasonTurn(cDate);
      const anticipation = turn.daysAway > 0 && turn.daysAway <= 5 ? turn : null;
      const saintLine = saintLineFor(dateKey);
      const question = pickQuestion(dateKey, audience, inAudience, loadGiftState());

      const first = selectGift({
        dateKey,
        hasPendingLetter: Boolean(pending),
        letterCandidate: candidate,
        anticipation,
        saintLine,
        question,
        audience,
      });

      if (!live) return;

      if (first.kind === 'letter-pending' && pending) {
        setGift({ kind: 'letter-pending', letter: pending });
        return;
      }

      if (first.kind === 'letter-new') {
        const result = await fetchCompanionLetter(first.personaId, audience);
        if (!live) return;
        if (result) {
          const letter: StoredLetter = {
            personaId: first.personaId,
            personaName: personaNameFor(first.personaId),
            dateKey,
            seasonKey: seasonInstanceKey(cDate),
            text: result.text,
            shown: false,
            withGospel: result.withGospel,
            withTailor: result.withTailor,
          };
          storeLetter(letter);
          setGift({ kind: 'letter-new', letter });
          return;
        }
        const next = selectGift({
          dateKey,
          hasPendingLetter: false,
          letterCandidate: null,
          anticipation,
          saintLine,
          question,
          audience,
        });
        renderFallback(next);
        return;
      }

      renderFallback(first);
    })();

    return () => {
      live = false;
    };
    // Mount once: the decision belongs to the day the page opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!gift || dismissed || recordedRef.current) return;
    recordedRef.current = true;
    shownAtRef.current = Date.now();
    recordGiftShown(dateKeyRef.current);
    if (gift.kind === 'letter-pending' || gift.kind === 'letter-new') {
      markLetterShown(gift.letter.dateKey, gift.letter.personaId);
    }
  }, [gift, dismissed]);

  if (!gift || dismissed) return null;

  const handleDismiss = () => {
    const wasQuick = shownAtRef.current ? Date.now() - shownAtRef.current < 4000 : false;
    recordGiftDismissed(dateKeyRef.current, wasQuick);
    if (gift.kind === 'letter-pending' || gift.kind === 'letter-new') {
      markLetterShown(gift.letter.dateKey, gift.letter.personaId);
    }
    setDismissed(true);
  };

  const handleQuestionTap = () => {
    if (gift.kind !== 'question') return;
    const wasQuick = shownAtRef.current ? Date.now() - shownAtRef.current < 4000 : false;
    recordGiftDismissed(dateKeyRef.current, wasQuick);
    setDismissed(true);
    onOpenCompanion(gift.personaId);
  };

  const isQuestion = gift.kind === 'question';

  const content = (
    <>
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className={PRINT_STAMP_CLASS} style={{ fontFamily: PRINT_SERIF, color: t.accent }}>
          Left for you
        </span>
        <button
          type="button"
          aria-label="Close"
          onClick={(e) => {
            e.stopPropagation();
            handleDismiss();
          }}
          className="flex-shrink-0 transition-opacity hover:opacity-70"
          style={{ color: t.textDim }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {gift.kind === 'letter-pending' || gift.kind === 'letter-new' ? (
        <div>
          <p className="text-[13px] font-bold mb-1.5" style={{ fontFamily: PRINT_SERIF, color: t.textBright }}>
            A letter from {gift.letter.personaName}
          </p>
          <p className="text-[14px] leading-relaxed whitespace-pre-wrap" style={{ fontFamily: PRINT_SERIF, color: t.text }}>
            {gift.letter.text}
          </p>
          {letterFramingLine(gift.letter) && (
            <p className="text-[12px] mt-2" style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>
              {letterFramingLine(gift.letter)}
            </p>
          )}
        </div>
      ) : gift.kind === 'anticipation' ? (
        <p className="text-[15px] leading-relaxed" style={{ fontFamily: PRINT_SERIF, color: t.text }}>
          {gift.beginsText}
        </p>
      ) : gift.kind === 'saint' ? (
        <p className="text-[14px] leading-relaxed" style={{ fontFamily: PRINT_SERIF, color: t.text }}>
          {gift.text}
        </p>
      ) : gift.kind === 'question' ? (
        <div>
          <p className="text-[13px] font-bold mb-1" style={{ fontFamily: PRINT_SERIF, color: t.textBright }}>
            {gift.personaName} asks:
          </p>
          <p className="text-[14px] leading-relaxed" style={{ fontFamily: PRINT_SERIF, color: t.text }}>
            {gift.question}
          </p>
        </div>
      ) : (
        <div>
          {gift.citation ? (
            <p className="text-[12px] font-bold uppercase tracking-widest mb-1" style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>
              {gift.citation}
            </p>
          ) : gift.title ? (
            <p className="text-[13px] font-bold mb-1" style={{ fontFamily: PRINT_SERIF, color: t.textBright }}>
              {gift.title}
            </p>
          ) : null}
          <p className="text-[14px] italic leading-relaxed whitespace-pre-wrap" style={{ fontFamily: PRINT_SERIF, color: t.text }}>
            {gift.text}
          </p>
        </div>
      )}
    </>
  );

  const plateStyle = {
    border: `1px solid ${t.border}`,
    backgroundColor: t.card,
  } as const;

  if (isQuestion) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleQuestionTap}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleQuestionTap();
        }}
        className="px-4 py-3.5 cursor-pointer"
        style={plateStyle}
      >
        {content}
      </div>
    );
  }

  return (
    <div className="px-4 py-3.5" style={plateStyle}>
      {content}
    </div>
  );
}
