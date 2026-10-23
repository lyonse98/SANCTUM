import type { Message, Settings } from '@/types';

const STORAGE_PREFIX = 'sanctum_chat_history_';
const SETTINGS_KEY = 'sanctum_settings';
const MAX_MESSAGES = 20;

export function loadHistory(personaId: string): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + personaId);
    if (!raw) return [];
    return JSON.parse(raw) as Message[];
  } catch {
    return [];
  }
}

export function saveHistory(personaId: string, messages: Message[]): void {
  try {
    const capped = messages.slice(-MAX_MESSAGES);
    localStorage.setItem(STORAGE_PREFIX + personaId, JSON.stringify(capped));
  } catch {
    // storage full or unavailable — silently ignore
  }
}

export function clearHistory(personaId: string): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + personaId);
  } catch {
    // ignore
  }
}

export function clearAllHistory(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(STORAGE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { model: 'gemini-3.8-flash' };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const VALID_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-2.5-pro'];
    const saved = parsed.model ?? 'gemini-3.8-flash';
    return { model: VALID_MODELS.includes(saved) ? saved : 'gemini-3.8-flash' };
  } catch {
    return { model: 'gemini-3.8-flash' };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}
