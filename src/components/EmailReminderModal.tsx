import { Mail, X } from 'lucide-react';
import type { PersonaTheme } from '@/types';
import { EmailReminderForm } from '@/components/EmailReminderForm';

interface EmailReminderModalProps {
  open: boolean;
  t: PersonaTheme;
  onClose: () => void;
}

/**
 * The daily reminder as a sheet, opened from the permanent row on any screen. It holds the same
 * form the Today area used to show inline, so a man can set it up without leaving what he was doing.
 */
export function EmailReminderModal({ open, t, onClose }: EmailReminderModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl animate-slide-up max-h-[85vh] overflow-y-auto chat-scroll border"
        style={{ backgroundColor: t.bg, borderColor: `${t.border}99` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b sticky top-0 rounded-t-2xl z-10"
          style={{ borderColor: `${t.border}66`, backgroundColor: t.bg }}
        >
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4" style={{ color: t.accent }} />
            <h2
              className="text-sm font-bold font-display uppercase tracking-wide"
              style={{ color: t.textBright }}
            >
              Daily Reminder
            </h2>
          </div>
          <button onClick={onClose} className="transition-colors" style={{ color: t.textDim }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-5">
          <EmailReminderForm t={t} />
        </div>
      </div>
    </div>
  );
}
