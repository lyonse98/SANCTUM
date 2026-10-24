import { describe, it, expect, beforeEach } from 'vitest';
import {
  shouldShowInstallPrompt,
  snoozeInstallPrompt,
  markInstallValueMoment,
} from './retention';

function makeStorage(): Storage {
  const store: Record<string, string> = {};
  Object.defineProperties(store, {
    getItem: { value: (k: string) => (k in store ? store[k] : null) },
    setItem: { value: (k: string, v: string) => { store[k] = String(v); } },
    removeItem: { value: (k: string) => { delete store[k]; } },
    clear: { value: () => { Object.keys(store).forEach((k) => delete store[k]); } },
  });
  return store as unknown as Storage;
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(), configurable: true });
  // Node has no window/matchMedia: isStandaloneDisplay() must safely read as false.
  Object.defineProperty(globalThis, 'window', { value: undefined, configurable: true });
});

describe('install prompt gating', () => {
  it('stays hidden before the third visit', () => {
    localStorage.setItem('sanctum_visit_count', '2');
    expect(shouldShowInstallPrompt()).toBe(false);
  });

  it('shows from the third visit', () => {
    localStorage.setItem('sanctum_visit_count', '3');
    expect(shouldShowInstallPrompt()).toBe(true);
  });

  it('a dismissal snoozes rather than banning forever', () => {
    localStorage.setItem('sanctum_visit_count', '5');
    snoozeInstallPrompt(14);
    expect(shouldShowInstallPrompt()).toBe(false);
    // Simulate the snooze expiring.
    localStorage.setItem('sanctum_install_snooze_until', String(Date.now() - 1000));
    expect(shouldShowInstallPrompt()).toBe(true);
  });

  it('the legacy "prompted forever" flag becomes one snooze, not a ban', () => {
    localStorage.setItem('sanctum_visit_count', '9');
    localStorage.setItem('sanctum_install_prompted', 'true');
    expect(shouldShowInstallPrompt()).toBe(false);
    expect(localStorage.getItem('sanctum_install_prompted')).toBeNull();
    localStorage.setItem('sanctum_install_snooze_until', String(Date.now() - 1000));
    expect(shouldShowInstallPrompt()).toBe(true);
  });

  it('an examen value moment asks on any visit', () => {
    localStorage.setItem('sanctum_visit_count', '1');
    markInstallValueMoment();
    expect(shouldShowInstallPrompt()).toBe(true);
  });

  it('never asks once the installed flag is set', () => {
    localStorage.setItem('sanctum_visit_count', '12');
    localStorage.setItem('sanctum_installed', 'true');
    expect(shouldShowInstallPrompt()).toBe(false);
  });
});
