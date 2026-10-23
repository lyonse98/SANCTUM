/**
 * A rule of life: the few things a man has decided to do every day, ticked off each day. It is
 * the one tool in the Workshop for a good day rather than a bad one — everything else there is
 * for a moment of trouble, and a rule is for the ordinary morning after morning.
 *
 * The practices are a fixed menu, not something he writes. That keeps them distinct from each
 * other, keeps the whole thing working offline with nothing to store but the choices, and spares
 * him the blank page — which is where most rules of life die.
 *
 * They are grouped into three parts — toward God, toward the work of his hands, and toward the
 * people he loves — because that is the traditional shape of a rule, and because a flat list of
 * twelve blurs together. A man picking five from three labelled groups sees what he is choosing.
 *
 * The secular practices are admitted only when they support the spiritual life: sleep, deep work,
 * training the body. Each is worded so the reason a praying man would do it is on the face of it.
 * "Drink water" does not belong here; "a soft man prays soft prayers" does.
 */

const RULE_KEY = 'sanctum_rule_of_life';
const CHECKS_KEY = 'sanctum_rule_checks';

/** Five is the ceiling on purpose. A rule you cannot remember is not a rule. */
export const MAX_RULE_PRACTICES = 5;

export type RuleGroup = 'god' | 'work' | 'people';

export interface UniversalPractice {
  key: string;
  label: string;
  detail: string;
  group: RuleGroup;
}

export const RULE_GROUPS: { id: RuleGroup; label: string; blurb: string }[] = [
  { id: 'god', label: 'Toward God', blurb: 'The root. Everything else is downstream of this.' },
  { id: 'work', label: 'The Work of Your Hands', blurb: 'The body and the day. A soft man prays soft prayers.' },
  { id: 'people', label: 'The People You Love', blurb: 'The home, the wife, the brother. Where the rule becomes flesh.' },
];

export const UNIVERSAL_PRACTICES: UniversalPractice[] = [
  // ── Toward God ──
  { key: 'gospel', label: 'The Day’s Gospel', detail: 'Read the readings for today', group: 'god' },
  { key: 'examen', label: 'Evening Examen', detail: 'Five minutes reviewing the day before bed', group: 'god' },
  { key: 'rosary', label: 'The Rosary', detail: 'One decade, or all five if the day allows', group: 'god' },
  { key: 'silence', label: 'Silence', detail: 'Five minutes with no phone, no input, no noise', group: 'god' },
  { key: 'fast', label: 'Give Something Up', detail: 'One thing denied daily, and known', group: 'god' },
  { key: 'thanks', label: 'Name One Gift', detail: 'Thank God for one specific thing, out loud', group: 'god' },

  // ── The Work of Your Hands ──
  { key: 'body', label: 'Move the Body', detail: 'Twenty minutes of hard walking or lifting — a soft man prays soft prayers', group: 'work' },
  { key: 'sleep', label: 'Sleep by Midnight', detail: 'A tired man has no reserve for prayer, for his wife, or for the fight', group: 'work' },
  { key: 'deepwork', label: 'One Hour of Deep Work', detail: 'The hardest thing first, before the phone, before email — give God the first fruits of the mind', group: 'work' },
  { key: 'work', label: 'Do the Work in Front of You', detail: 'No complaining. Finish the next thing. Offering the ordinary is prayer', group: 'work' },

  // ── The People You Love ──
  { key: 'present', label: 'Be Present at Home', detail: 'Phone in the drawer when you walk in the door', group: 'people' },
  { key: 'wife', label: 'Love Your Wife', detail: 'One deliberate act of love for her today', group: 'people' },
  { key: 'children', label: 'Bless Your Children', detail: 'A word, a prayer, or your hands on them', group: 'people' },
  { key: 'brother', label: 'Check On a Man', detail: 'Text one man and ask how he is really doing', group: 'people' },
];

const PRACTICE_BY_KEY = new Map(UNIVERSAL_PRACTICES.map((p) => [p.key, p]));

export function practiceFor(key: string): UniversalPractice | undefined {
  return PRACTICE_BY_KEY.get(key);
}

/**
 * Reads the chosen practices back as whole entries, dropping any key that is no longer in the
 * menu. That way a rule written against an older list can never leave a blank row on the screen.
 */
export function loadRule(): string[] {
  try {
    const raw = localStorage.getItem(RULE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((k): k is string => typeof k === 'string' && PRACTICE_BY_KEY.has(k))
      .slice(0, MAX_RULE_PRACTICES);
  } catch {
    return [];
  }
}

export function saveRule(keys: string[]): void {
  try {
    localStorage.setItem(RULE_KEY, JSON.stringify(keys.slice(0, MAX_RULE_PRACTICES)));
  } catch {
    // Storage unavailable (private mode, quota). The rule simply does not persist.
  }
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * Ticks are kept per day and reset when the date turns over, so a rule is a daily practice rather
 * than a checklist that is either permanently done or permanently guilt-inducing.
 */
export function loadTodayChecks(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(CHECKS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { date?: string; checks?: Record<string, boolean> };
    if (parsed.date !== todayKey() || !parsed.checks || typeof parsed.checks !== 'object') return {};
    return parsed.checks;
  } catch {
    return {};
  }
}

export function saveTodayChecks(checks: Record<string, boolean>): void {
  try {
    localStorage.setItem(CHECKS_KEY, JSON.stringify({ date: todayKey(), checks }));
  } catch {
    // As above — nothing to do if storage is unavailable.
  }
}
