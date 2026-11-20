import type { PersonaTheme } from '@/types';
import { PRINT_SERIF } from '@/lib/print';
import { ACCESS_BLOCKED_MESSAGE } from '@/lib/accessToken';
import { ACCESS_URL } from '@/lib/accessRequest';

interface AccessBlockedNoteProps {
  t: PersonaTheme;
  className?: string;
}

/**
 * The testing-season gate's answer, as a surface shows it (Nov 20,
 * 2026): one calm line in the print register and a plain link to the
 * request page. No error styling, no codes, nothing red — the costly
 * doors are simply for the testing circle right now, and the rest of
 * the app stands untouched around this note. Shared by the Tailor
 * panel and the evening close, rather than a sentence copied from
 * surface to surface, free to drift. (The companion chat carries the
 * same line as text, its address written out — a chat bubble has no
 * links to give.)
 */
export function AccessBlockedNote({ t, className }: AccessBlockedNoteProps) {
  return (
    <p
      data-access-blocked
      className={`text-[13px] leading-relaxed ${className ?? ''}`}
      style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}
    >
      {ACCESS_BLOCKED_MESSAGE}{' '}
      <a
        href={ACCESS_URL}
        className="underline underline-offset-2"
        style={{ color: t.accent }}
      >
        Request access
      </a>
      .
    </p>
  );
}
