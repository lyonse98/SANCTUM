import { PRINT_SERIF } from '@/lib/print';

interface CrisisLineProps {
  /** The quiet colour the sentence wears on the surface it stands on. */
  muted: string;
  /** The colour the number itself wears — brighter, so the tap reads. */
  bright: string;
  className?: string;
}

/**
 * The canonical crisis line — one sentence, the same everywhere it stands:
 * "In crisis? Call or text 988 — free, day or night", the number a real
 * tel: link at a readable size. It first stood at the head of Today (audit
 * W-1, Nov 16, 2026). Erik then placed it deliberately (Nov 18, 2026): at
 * the head of the other rooms a person in trouble might open — Companions,
 * About, Settings, Pocket Church — and at the FOOT of Today only, the
 * under-masthead line retired at his word ("only bottom; not needed for
 * a devotional"). One shared component, rather than a sentence copied
 * from page to page, free to drift.
 */
export function CrisisLine({ muted, bright, className }: CrisisLineProps) {
  return (
    <p
      data-crisis-line
      className={`text-center text-[13px] ${className ?? ''}`}
      style={{ fontFamily: PRINT_SERIF, color: muted }}
    >
      In crisis? Call or text{' '}
      <a
        href="tel:988"
        className="font-bold underline underline-offset-2"
        style={{ color: bright }}
      >
        988
      </a>{' '}
      — free, day or night.
    </p>
  );
}
