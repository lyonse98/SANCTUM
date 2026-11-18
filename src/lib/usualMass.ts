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
