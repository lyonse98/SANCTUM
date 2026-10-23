import { useId, useState } from 'react';
import { Mail, Check, Loader2, AlertCircle, ShieldCheck, X } from 'lucide-react';
import type { PersonaTheme } from '@/types';
import {
  loadEmailReminder,
  subscribeEmailReminder,
  unsubscribeEmailReminder,
  isValidEmail,
  type EmailReminderState,
} from '@/lib/emailReminder';
import { REMINDER_FOCUS_OPTIONS } from '@/lib/reminderFocus';

interface EmailReminderFormProps {
  t: PersonaTheme;
}

/**
 * The dependable reminder. A phone only runs an installed app's background alarms when it chooses
 * to, so a push cannot be promised — email can. All it asks for is an address and one choice: what
 * the email should point him at. No time to pick, nothing else to decide.
 *
 * The form is kept separate from whatever frame holds it (a card, a modal) so the wording and the
 * behaviour live in exactly one place.
 */
export function EmailReminderForm({ t }: EmailReminderFormProps) {
  const initial = loadEmailReminder();
  const emailFieldId = useId();
  const focusFieldId = useId();
  const [state, setState] = useState<EmailReminderState>(initial);
  const [draftEmail, setDraftEmail] = useState(initial.email);
  const [draftFocus, setDraftFocus] = useState(initial.focus);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSubscribe = async () => {
    setBusy(true);
    setMessage(null);
    const result = await subscribeEmailReminder(draftEmail, draftFocus);
    setBusy(false);
    setMessage({ ok: result.ok, text: result.message });
    if (result.ok) {
      const next = loadEmailReminder();
      setState(next);
      setDraftEmail(next.email);
      setDraftFocus(next.focus);
    }
  };

  /**
   * Changing the focus on an existing subscription saves straight away — picking a different thing
   * to be reminded about is the whole action, so asking him to then press Save would be a step for
   * its own sake. If the save fails the choice snaps back to what is actually stored, so the form
   * never shows a setting the server does not have.
   */
  const handleFocusChange = async (focus: string) => {
    const previous = state.focus;
    setDraftFocus(focus);
    setBusy(true);
    setMessage(null);
    const result = await subscribeEmailReminder(state.email, focus);
    setBusy(false);
    if (result.ok) {
      const next = loadEmailReminder();
      setState(next);
      setDraftFocus(next.focus);
      setMessage({ ok: true, text: 'Saved. That is what we will remind you about.' });
    } else {
      setDraftFocus(previous);
      setMessage({ ok: false, text: result.message });
    }
  };

  const handleUnsubscribe = async () => {
    setBusy(true);
    setMessage(null);
    const result = await unsubscribeEmailReminder(state.token);
    setBusy(false);
    setMessage({ ok: result.ok, text: result.message });
    if (result.ok) setState(loadEmailReminder());
  };

  const canSubmit = isValidEmail(draftEmail) && !busy;

  const focusSelect = (
    <div>
      <label
        htmlFor={focusFieldId}
        className="block text-[10px] uppercase tracking-widest font-bold mb-2"
        style={{ color: t.textDim }}
      >
        Remind me to
      </label>
      <select
        id={focusFieldId}
        value={draftFocus}
        onChange={(e) => void handleFocusChange(e.target.value)}
        disabled={busy}
        className="w-full text-sm rounded-lg px-3 py-2.5 border focus:outline-none transition-colors disabled:opacity-60"
        style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}80`, color: t.text }}
      >
        {REMINDER_FOCUS_OPTIONS.map((option) => (
          <option key={option.key} value={option.key} style={{ backgroundColor: t.card }}>
            {option.label}
          </option>
        ))}
      </select>
      <p className="text-[10px] leading-relaxed mt-1.5" style={{ color: t.textDim }}>
        {REMINDER_FOCUS_OPTIONS.find((o) => o.key === draftFocus)?.detail ?? ''}
      </p>
    </div>
  );

  return (
    <div>
      <p className="text-[11px] leading-relaxed mb-3" style={{ color: t.textMuted }}>
        A phone only runs an app&rsquo;s reminders when it chooses to, so a push notification cannot be
        promised. Email can. Each morning you get a short note and one link straight back into the
        app, at the part you chose.
      </p>

      {state.enabled ? (
        <div className="space-y-3">
          <div
            className="flex items-center gap-2 rounded-lg border px-3 py-2.5"
            style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}80` }}
          >
            <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: t.accent }} />
            <p className="text-xs truncate" style={{ color: t.text }}>{state.email}</p>
          </div>

          {focusSelect}

          <button
            onClick={() => void handleUnsubscribe()}
            disabled={busy}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-[11px] font-bold transition-all active:scale-[0.98] disabled:opacity-60"
            style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}99`, color: t.textMuted }}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
            Stop the emails
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label
              htmlFor={emailFieldId}
              className="block text-[10px] uppercase tracking-widest font-bold mb-2"
              style={{ color: t.textDim }}
            >
              Your email
            </label>
            <input
              id={emailFieldId}
              type="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              value={draftEmail}
              onChange={(e) => { setDraftEmail(e.target.value); setMessage(null); }}
              placeholder="you@example.com"
              disabled={busy}
              className="w-full text-sm rounded-lg px-3 py-2.5 border focus:outline-none transition-colors disabled:opacity-60"
              style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}80`, color: t.text }}
            />
          </div>

          {focusSelect}

          <button
            onClick={() => void handleSubscribe()}
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: t.accentRgba(0.14), borderColor: t.accentRgba(0.4), color: t.accent }}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
            <span className="text-xs font-bold uppercase tracking-wide">
              {busy ? 'Saving…' : 'Save my address'}
            </span>
          </button>
        </div>
      )}

      <div
        className="flex items-start gap-2 mt-3 rounded-lg border px-3 py-2.5"
        style={{ backgroundColor: `${t.border}26`, borderColor: `${t.border}66` }}
      >
        <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: t.textDim }} />
        <p className="text-[10px] leading-relaxed" style={{ color: t.textDim }}>
          This is the one thing Sanctum keeps on a server, and it is only your address and this one
          choice — no name, no account, nothing you have written to a companion. The sending side is
          not connected yet, so nothing is emailed today.
        </p>
      </div>

      {message && (
        <div
          className="flex items-start gap-2 mt-3 rounded-lg border px-3 py-2.5 animate-fade-in"
          style={
            message.ok
              ? { backgroundColor: t.accentRgba(0.08), borderColor: t.accentRgba(0.3) }
              : { backgroundColor: 'rgba(153,27,27,0.06)', borderColor: 'rgba(153,27,27,0.25)' }
          }
        >
          {message.ok ? (
            <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: t.accent }} />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#991B1B' }} />
          )}
          <p
            className="text-[10px] leading-relaxed"
            style={{ color: message.ok ? t.textMuted : '#991B1B' }}
          >
            {message.text}
          </p>
        </div>
      )}
    </div>
  );
}
