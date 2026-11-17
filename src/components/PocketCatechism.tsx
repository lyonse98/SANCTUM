import { BookOpen } from 'lucide-react';
import { PRINT_SERIF, PRINT_STAMP_CLASS } from '@/lib/print';
import type { Audience, PersonaTheme } from '@/types';
import { CatechismQA } from '@/components/CatechismQA';

interface PocketCatechismProps {
  t: PersonaTheme;
  audience: Audience;
}

/**
 * The Ask door (Pocket Church build, Erik's approval, Nov 14, 2026): one
 * door, one action. The Catechism opens directly on the question surface —
 * Ask Aquinas — and the two reading surfaces that used to stand beside it
 * (the pillars browse, the objections bank) are gone as surfaces. Their
 * data stays in src/data/catechism.ts: the objections' own questions seed
 * the starter questions in the Ask surface, and the bank may serve the
 * chat again. What a man does here is ask.
 */
export function PocketCatechism({ t, audience }: PocketCatechismProps) {
  return (
    <div className="px-1 pt-4" style={{ borderTop: `3px double ${t.border}`, fontFamily: PRINT_SERIF }}>
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="w-4 h-4" style={{ color: t.accent }} />
        <h3 className={PRINT_STAMP_CLASS} style={{ color: t.accent }}>
          Catechism
        </h3>
      </div>

      <p className="text-[12px] leading-relaxed mb-3" style={{ color: t.textDim }}>
        The Catechism as a question surface — ask, and the answer is grounded in the text itself.
      </p>

      <CatechismQA t={t} audience={audience} />
    </div>
  );
}
