import type { PersonaId } from '@/types';

const PERSONA_KEY = 'sanctum_persona';

export function loadPersonaId(): PersonaId | null {
  try {
    const raw = localStorage.getItem(PERSONA_KEY);
    if (!raw) return null;
    return raw as PersonaId;
  } catch {
    return null;
  }
}

export function savePersonaId(id: PersonaId): void {
  try {
    localStorage.setItem(PERSONA_KEY, id);
  } catch {
    // ignore
  }
}
