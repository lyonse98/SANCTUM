/**
 * My usual Mass (Erik, Nov 18, 2026): the parish and the Mass the reader
 * usually attends — name, time, and the day (Sunday, or the Saturday
 * vigil) — kept on this device only under the sanctum_ prefix (the
 * panic wipe takes it with everything else). It exists to aim Tonight's
 * Saturday look ahead at the reader's own Mass. It records nothing
 * about attendance and nothing about any actual day: it is a standing
 * preference, written by the reader's own hand, like the resolve.
 */

export const USUAL_MASS_KEY = 'sanctum_usual_mass';

/** The parish name's cap. */
export const USUAL_MASS_PARISH_MAX = 60;

export type UsualMassDay = 'sunday' | 'saturday';

export interface UsualMass {
  /** The parish's name, as the reader wrote it. */
  parish: string;
  /** The Mass time, "HH:MM" in the device's own 24-hour terms. */
  time: string;
  /** The day of the usual Mass: Sunday, or the Saturday vigil. */
  day: UsualMassDay;
}

const TIME_SHAPE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * The stored usual Mass, or null when it is not set. A record counts as
 * set only whole — parish and time together — so Tonight never prints
 * half a sentence about the reader's Mass.
 */
export function loadUsualMass(): UsualMass | null {
  try {
    const raw = localStorage.getItem(USUAL_MASS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UsualMass>;
    const parish = typeof parsed.parish === 'string' ? parsed.parish.replace(/\s+/g, ' ').trim().slice(0, USUAL_MASS_PARISH_MAX) : '';
    const time = typeof parsed.time === 'string' && TIME_SHAPE.test(parsed.time) ? parsed.time : '';
    if (!parish || !time) return null;
    return { parish, time, day: parsed.day === 'saturday' ? 'saturday' : 'sunday' };
  } catch {
    return null;
  }
}

/** Keeps the usual Mass on this device; null (or an incomplete record) clears it. */
export function saveUsualMass(mass: UsualMass | null): void {
  try {
    if (!mass) {
      localStorage.removeItem(USUAL_MASS_KEY);
      return;
    }
    const parish = mass.parish.replace(/\s+/g, ' ').trim().slice(0, USUAL_MASS_PARISH_MAX);
    if (!parish || !TIME_SHAPE.test(mass.time)) {
      localStorage.removeItem(USUAL_MASS_KEY);
      return;
    }
    const stored: UsualMass = { parish, time: mass.time, day: mass.day === 'saturday' ? 'saturday' : 'sunday' };
    localStorage.setItem(USUAL_MASS_KEY, JSON.stringify(stored));
  } catch {
    // storage unavailable — Tonight simply keeps its un-aimed look ahead
  }
}

/** The stored "HH:MM" in the reader's own format: "9:30 AM". */
export function formatMassTime(time: string): string {
  const [h, m] = time.split(':').map((part) => Number(part));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export const PARISH_REMINDERS_KEY = 'sanctum_parish_reminders';

/** The reminder leads a reader may choose, in minutes before the hour. */
export const REMINDER_LEAD_OPTIONS = [30, 60, 120] as const;
export type ReminderLead = (typeof REMINDER_LEAD_OPTIONS)[number];

export function isReminderLead(value: unknown): value is ReminderLead {
  return typeof value === 'number' && (REMINDER_LEAD_OPTIONS as readonly number[]).includes(value);
}

/**
 * The Confession-only "evening before" lead (Erik, Nov 20, 2026): one poke
 * at 7:00 PM local on the day BEFORE the parish's Confession day — the
 * night to examine, before the morning to confess. No count of minutes
 * before the Confession hour can say that, so the lead is carried as a
 * SENTINEL, -1, in the same field everywhere it travels: this store, the
 * sync body, the server's conf_lead_min column, and the dispatcher's
 * due-check (which special-cases it in pushCore). It is never a Mass
 * lead, and it is never arithmetic: any code that finds it where minutes
 * were expected must treat it as unset, which is exactly what
 * isReminderLead does with it.
 */
export const CONFESSION_EVENING_BEFORE_LEAD = -1 as const;
export type ConfessionLead = ReminderLead | typeof CONFESSION_EVENING_BEFORE_LEAD;

export function isConfessionLead(value: unknown): value is ConfessionLead {
  return isReminderLead(value) || value === CONFESSION_EVENING_BEFORE_LEAD;
}

/** The Mass reminder's lead choices, as the reader sees them: off, or minutes ahead. */
export const MASS_LEAD_OPTIONS: readonly { value: ReminderLead | null; label: string }[] = [
  { value: null, label: 'Off' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hr' },
  { value: 120, label: '2 hrs' },
];

/** The Confession reminder's lead choices — the Mass choices, plus the evening before. */
export const CONFESSION_LEAD_OPTIONS: readonly { value: ConfessionLead | null; label: string }[] = [
  ...MASS_LEAD_OPTIONS,
  { value: CONFESSION_EVENING_BEFORE_LEAD, label: 'The evening before' },
];

/**
 * The parish reminder settings (Erik, Nov 18, 2026): the parish's weekly
 * Confession day and hour, how long before Mass and Confession a poke
 * may come, and the optional drive-home hour. All of it lives on this
 * device, beside the usual Mass it belongs to. What reaches the server
 * is only ever days, times, and leads — never the parish's name, which
 * exists in the usual-Mass record above and nowhere else.
 */
export interface ParishReminders {
  /** Day of week of the parish's Confession time: 0 = Sunday … 6 = Saturday, or null. */
  confessionDay: number | null;
  /** 'HH:MM', the parish's Confession hour, or null. */
  confessionTime: string | null;
  /** Minutes before the usual Mass a poke may come, or null for no Mass reminder. */
  massReminderLead: ReminderLead | null;
  /**
   * Minutes before Confession a poke may come — or the evening-before
   * sentinel (CONFESSION_EVENING_BEFORE_LEAD) — or null for no reminder.
   */
  confessionReminderLead: ConfessionLead | null;
  /** 'HH:MM' of the optional drive-home reminder, or null when it is off. */
  driveTime: string | null;
}

export const EMPTY_PARISH_REMINDERS: ParishReminders = {
  confessionDay: null,
  confessionTime: null,
  massReminderLead: null,
  confessionReminderLead: null,
  driveTime: null,
};

function cleanDayOfWeek(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6 ? value : null;
}

function cleanTime(value: unknown): string | null {
  return typeof value === 'string' && TIME_SHAPE.test(value) ? value : null;
}

/** The stored parish reminder settings; every field null when unset or malformed. */
export function loadParishReminders(): ParishReminders {
  try {
    const raw = localStorage.getItem(PARISH_REMINDERS_KEY);
    if (!raw) return { ...EMPTY_PARISH_REMINDERS };
    const parsed = JSON.parse(raw) as Partial<ParishReminders>;
    return {
      confessionDay: cleanDayOfWeek(parsed.confessionDay),
      confessionTime: cleanTime(parsed.confessionTime),
      massReminderLead: isReminderLead(parsed.massReminderLead) ? parsed.massReminderLead : null,
      confessionReminderLead: isConfessionLead(parsed.confessionReminderLead) ? parsed.confessionReminderLead : null,
      driveTime: cleanTime(parsed.driveTime),
    };
  } catch {
    return { ...EMPTY_PARISH_REMINDERS };
  }
}

/** Keeps the parish reminder settings on this device; an all-empty record clears the key. */
export function saveParishReminders(reminders: ParishReminders): void {
  try {
    const clean: ParishReminders = {
      confessionDay: cleanDayOfWeek(reminders.confessionDay),
      confessionTime: cleanTime(reminders.confessionTime),
      massReminderLead: isReminderLead(reminders.massReminderLead) ? reminders.massReminderLead : null,
      confessionReminderLead: isConfessionLead(reminders.confessionReminderLead) ? reminders.confessionReminderLead : null,
      driveTime: cleanTime(reminders.driveTime),
    };
    if (Object.values(clean).every((v) => v === null)) {
      localStorage.removeItem(PARISH_REMINDERS_KEY);
      return;
    }
    localStorage.setItem(PARISH_REMINDERS_KEY, JSON.stringify(clean));
  } catch {
    // storage unavailable — the reminders simply stay unset
  }
}

/** The usual Mass's day of week, in the server's terms: Sunday 0 … Saturday 6. */
export function massDayOfWeek(mass: UsualMass): number {
  return mass.day === 'saturday' ? 6 : 0;
}

/**
 * Which evening carries Tonight's look ahead, and at which day it aims
 * (feature 6, Erik, Nov 18, 2026). The un-set reader keeps the standing
 * behavior exactly: the look ahead stands on Saturday, aimed at Sunday.
 * A reader whose usual Mass is the Saturday vigil gets it one evening
 * earlier — Friday, aimed at Saturday. Either way the aim is one day
 * ahead of the evening that carries it.
 */
export function massPreviewEvening(mass: UsualMass | null): { eveningDay: number; onSaturday: boolean } {
  return mass?.day === 'saturday'
    ? { eveningDay: 5, onSaturday: true }
    : { eveningDay: 6, onSaturday: false };
}
