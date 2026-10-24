/**
 * How the Saint of the Day card treats the lectionary's celebration string.
 *
 * Erik's rule: the card at the bottom mirrors whatever the day's memorial, feast, or
 * solemnity is — the same name the readings header shows — and only when the day has
 * no named observance (a plain weekday or an ordinary Sunday) does it fall back to a
 * saint from the local lists. These predicates draw that line.
 */

/** Person-like celebrations (a saint's feast) vs day/season names ("29th Sunday..."). */
export function isPersonCelebration(name: string): boolean {
  return /^(st\.|saint|blessed|our lady|all saints|all souls|the holy)/i.test(name.trim());
}

/** Plain ferias and ordinary Sundays: a season label, not a named observance. */
export function isPlainWeekdayCelebration(name: string): boolean {
  const n = name.trim();
  return (
    /(monday|tuesday|wednesday|thursday|friday|saturday|sunday) of the\b/i.test(n) ||
    /sunday in ordinary time/i.test(n) ||
    /\bweek (in|of) (ordinary time|advent|lent|easter)\b/i.test(n)
  );
}

/** True when the card should mirror the celebration instead of falling back to a saint. */
export function shouldMirrorCelebration(name: string | null | undefined): boolean {
  if (!name) return false;
  return !isPlainWeekdayCelebration(name);
}

/**
 * Which celebration the card may mirror. The server bundle wins only when it is
 * actually today's bundle — a stale bundle (served when the function is unreachable)
 * carries a previous day's celebration, and mirroring that would swap one wrong
 * saint for another. Otherwise the direct readings path answers, the same path the
 * readings header uses.
 */
export function resolveCelebrationName(opts: {
  bundleCelebration?: string | null;
  bundleDate?: string | null;
  todayKey: string;
  directCelebration?: string | null;
}): string | null {
  if (opts.bundleCelebration && opts.bundleDate === opts.todayKey) {
    return opts.bundleCelebration;
  }
  return opts.directCelebration ?? null;
}
