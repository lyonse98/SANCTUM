export type Role = 'system' | 'user' | 'assistant';

export type PersonaId = 'joseph' | 'david' | 'paul' | 'augustine' | 'ignatius' | 'peter' | 'moses' | 'therese';

export type TabId = 'today' | 'companions' | 'church' | 'workshop' | 'help';

export interface Message {
  role: Role;
  content: string;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  /** 'gospel' marks a system card carrying today's readings as context. It is not a
   *  message the user typed: it is excluded from persisted history and from the API
   *  history of ordinary sends, and is passed to the model only when he taps Reflect. */
  kind?: 'gospel';
  /** True once the man has tapped Reflect on a gospel card. */
  reflected?: boolean;
}

export interface PresetChip {
  id: string;
  label: string;
  icon: string;
  prompt: string;
}

export interface PersonaTheme {
  bg: string;
  bgGradient: string;
  card: string;
  cardHover: string;
  border: string;
  borderLight: string;
  accent: string;
  accentBright: string;
  accentDark: string;
  accentRgba: (alpha: number) => string;
  text: string;
  textBright: string;
  textMuted: string;
  textDim: string;
  glow: string;
}

export interface Persona {
  id: PersonaId;
  name: string;
  title: string;
  era: string;
  portrait: string;
  tagline: string;
  struggles: string[];
  description: string;
  systemPrompt: string;
  presets: PresetChip[];
  theme: PersonaTheme;
}

/**
 * The five utilities that appear at the foot of every screen. Gathered into one object so a page
 * can pass them along in a single prop instead of five, and so the row has one shape to render.
 */
export interface UtilityActions {
  onOpenSettings: () => void;
  onShareInvite: () => void;
  onOpenFeedback: () => void;
  onOpenAbout: () => void;
  onOpenReminder: () => void;
}
