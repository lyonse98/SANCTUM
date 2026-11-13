import {
  Bell,
  Church,
  HeartHandshake,
  Info,
  MessageSquarePlus,
  Settings as SettingsIcon,
  Share2,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { PersonaTheme, TabId, UtilityActions } from '@/types';

interface MenuSheetProps {
  open: boolean;
  t: PersonaTheme;
  onClose: () => void;
  /** The three destinations the sheet holds — Today is home, never a menu row. */
  onNavigate: (view: TabId) => void;
  utilities: UtilityActions;
}

interface GoEntry {
  key: 'companions' | 'church' | 'help';
  label: string;
  hint: string;
  icon: LucideIcon;
}

const GO_ENTRIES: GoEntry[] = [
  { key: 'companions', label: 'Companions', hint: 'Talk through today with a saint', icon: Users },
  { key: 'church', label: 'Pocket Church', hint: 'Pray · Confession · Ask', icon: Church },
  { key: 'help', label: 'Real Help', hint: 'Priests, counselors, crisis lines', icon: HeartHandshake },
];

/**
 * The menu sheet (Erik, Nov 13, 2026 — the "core diet"): with the bottom tab
 * bar gone, everything that is not Today lives here, in two groups. GO holds
 * the three destinations — Real Help rendered with exactly the same weight as
 * the others, neither hidden nor alarmed; the crisis content itself stays at
 * the top inside Real Help, as it already is. APP holds the housekeeping that
 * used to sit in the foot-of-page utilities row: Settings, Reminders,
 * Feedback, About, Share — the existing modals and flows, unchanged.
 */
export function MenuSheet({ open, t, onClose, onNavigate, utilities }: MenuSheetProps) {
  if (!open) return null;

  const appEntries: { key: string; label: string; icon: LucideIcon; action: () => void }[] = [
    { key: 'settings', label: 'Settings', icon: SettingsIcon, action: utilities.onOpenSettings },
    { key: 'reminders', label: 'Reminders', icon: Bell, action: utilities.onOpenReminder },
    { key: 'feedback', label: 'Feedback', icon: MessageSquarePlus, action: utilities.onOpenFeedback },
    { key: 'about', label: 'About', icon: Info, action: utilities.onOpenAbout },
    { key: 'share', label: 'Share', icon: Share2, action: utilities.onShareInvite },
  ];

  const rowStyle: React.CSSProperties = {
    backgroundColor: t.card,
    borderColor: `${t.border}99`,
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
      <button
        aria-label="Close the menu"
        onClick={onClose}
        className="absolute inset-0 w-full h-full bg-black/60 backdrop-blur-sm cursor-default"
      />
      <div
        className="absolute bottom-0 inset-x-0 max-w-2xl mx-auto rounded-t-2xl border-t animate-slide-up px-5 pt-4"
        style={{
          backgroundColor: t.bg,
          borderColor: t.border,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <p
            className="text-sm font-bold font-display uppercase tracking-[0.18em]"
            style={{ color: t.textBright }}
          >
            Menu
          </p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg flex items-center justify-center border transition-all active:scale-95"
            style={{ backgroundColor: t.card, borderColor: `${t.border}99`, color: t.textMuted }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[9px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: t.textDim }}>
          Go
        </p>
        <div className="space-y-2 mb-5" data-menu-group="go">
          {GO_ENTRIES.map((entry) => {
            const Icon = entry.icon;
            return (
              <button
                key={entry.key}
                data-menu-entry={entry.key}
                onClick={() => {
                  onClose();
                  onNavigate(entry.key);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all active:scale-[0.99]"
                style={rowStyle}
              >
                <Icon className="w-5 h-5 flex-shrink-0" style={{ color: t.accent }} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold" style={{ color: t.textBright }}>
                    {entry.label}
                  </span>
                  <span className="block text-[11px]" style={{ color: t.textDim }}>
                    {entry.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-[9px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: t.textDim }}>
          App
        </p>
        <div className="space-y-2" data-menu-group="app">
          {appEntries.map((entry) => {
            const Icon = entry.icon;
            return (
              <button
                key={entry.key}
                data-menu-entry={entry.key}
                onClick={() => {
                  onClose();
                  entry.action();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all active:scale-[0.99]"
                style={rowStyle}
              >
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: t.textMuted }} />
                <span className="text-sm font-medium" style={{ color: t.text }}>
                  {entry.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
