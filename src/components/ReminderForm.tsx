import { useId, useState } from 'react';
import { Bell, BellOff, Check, Loader2, AlertCircle, ShieldCheck, Send } from 'lucide-react';
import type { PersonaTheme } from '@/types';
import {
  getPushState,
  loadPushReminder,
  sendTestPoke,
  subscribeToPush,
  unsubscribeFromPush,
  updatePushPreferences,
  type PushState,
} from '@/lib/push';
import { REMINDER_FOCUS_OPTIONS, focusLabel } from '@/lib/reminderFocus';
import { InstallInstructions } from '@/components/InstallInstructions';

interface ReminderFormProps {
  t: PersonaTheme;
}

/** 'HH:MM' (24-hour, as stored) as the way a man says it: "7:00 AM". */
function formatTime(localTime: string): string {
  const [hRaw, mRaw] = localTime.split(':');
  const h = Number(hRaw);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${mRaw} ${suffix}`;
}

/**
 * The dependable reminder, as a notification. A short poke at the time he chooses, and
 * tapping it opens the part of Sanctum he picked. The notification itself carries one
 * plain sentence — a lock screen is a public place, so nothing personal is ever in it.
 *
 * The form renders a different face for each state the device can be in (install first on
 * an iPhone, a refused ask, a live subscription) so a man is never shown a control that
 * cannot work. Kept separate from the frame that holds it, like the email form before it.
 */
export function ReminderForm({ t }: ReminderFormProps) {
  const initial = loadPushReminder();
  const focusFieldId = useId();
  const timeFieldId = useId();
  const [pushState, setPushState] = useState<PushState>(() => getPushState());
  const [saved, setSaved] = useState(initial);
  const [draftFocus, setDraftFocus] = useState(initial.focus);
  const [draftTime, setDraftTime] = useState(initial.localTime);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = () => {
    const next = loadPushReminder();
    setSaved(next);
    setDraftFocus(next.focus);
    setDraftTime(next.localTime);
    setPushState(getPushState());
  };

  const handleEnable = async () => {
    setBusy(true);
    setMessage(null);
    const result = await subscribeToPush(draftFocus, draftTime);
    setBusy(false);
    setMessage({ ok: result.ok, text: result.message });
    if (result.ok) refresh();
    else setPushState(result.state);
  };

  /**
   * Changing the focus on a live reminder saves straight away — the choice is the whole
   * action. The time saves from its own button, because a time picker is fiddled with on
   * the way to a decision and the server should only hear the decision. If a save fails
   * the form snaps back to what is actually stored.
   */
  const handleFocusChange = async (focus: string) => {
    setDraftFocus(focus);
    if (pushState !== 'subscribed') return;
    setBusy(true);
    setMessage(null);
    const result = await updatePushPreferences(focus, saved.localTime);
    setBusy(false);
    setMessage({ ok: result.ok, text: result.message });
    if (result.ok) refresh();
    else setDraftFocus(saved.focus);
  };

  const handleSaveTime = async () => {
    setBusy(true);
    setMessage(null);
    const result = await updatePushPreferences(saved.focus, draftTime);
    setBusy(false);
    setMessage({ ok: result.ok, text: result.message });
    if (result.ok) refresh();
    else setDraftTime(saved.localTime);
  };

  const handleOff = async () => {
    setBusy(true);
    setMessage(null);
    const result = await unsubscribeFromPush();
    setBusy(false);
    setMessage({ ok: result.ok, text: result.message });
    refresh();
  };

  const handleTest = async () => {
    setBusy(true);
    setMessage(null);
    const result = await sendTestPoke();
    setBusy(false);
    setMessage({ ok: result.ok, text: result.message });
  };

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

  const timeField = (
    <div>
      <label
        htmlFor={timeFieldId}
        className="block text-[10px] uppercase tracking-widest font-bold mb-2"
        style={{ color: t.textDim }}
      >
        At this time
      </label>
      <input
        id={timeFieldId}
        type="time"
        value={draftTime}
        onChange={(e) => setDraftTime(e.target.value)}
        disabled={busy}
        className="w-full text-sm rounded-lg px-3 py-2.5 border focus:outline-none transition-colors disabled:opacity-60"
        style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}80`, color: t.text }}
      />
    </div>
  );

  const privacyNote = (
    <div
      className="flex items-start gap-2 mt-3 rounded-lg border px-3 py-2.5"
      style={{ backgroundColor: `${t.border}26`, borderColor: `${t.border}66` }}
    >
      <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: t.textDim }} />
      <p className="text-[10px] leading-relaxed" style={{ color: t.textDim }}>
        This is the one thing Sanctum keeps on a server: an anonymous notification address for
        this device, and these two choices — no name, no account, nothing you have written to a
        companion.
      </p>
    </div>
  );

  let body: React.ReactNode;

  if (pushState === 'not-installed') {
    body = (
      <div>
        <p className="text-[11px] leading-relaxed mb-3" style={{ color: t.textMuted }}>
          On an iPhone, notifications only reach apps that live on the Home Screen — a browser
          tab cannot be poked. Put Sanctum there first, open it from the icon, and this sheet
          will let you turn the reminder on.
        </p>
        <InstallInstructions
          tokens={{
            accent: t.accent,
            accentSoft: t.accentRgba(0.15),
            border: t.border,
            textBright: t.textBright,
            text: t.text,
            textMuted: t.textMuted,
            textDim: t.textDim,
          }}
        />
      </div>
    );
  } else if (pushState === 'unsupported') {
    body = (
      <p className="text-[11px] leading-relaxed" style={{ color: t.textMuted }}>
        This browser cannot receive notifications, so the reminder cannot reach you here. On an
        iPhone, Sanctum needs to be on the Home Screen; on a computer or an Android phone, a
        current Chrome, Edge, Firefox, or Safari will work.
      </p>
    );
  } else if (pushState === 'denied') {
    body = (
      <div>
        <p className="text-[11px] leading-relaxed mb-2" style={{ color: t.textMuted }}>
          Notifications are turned off for Sanctum, and the browser will not ask again from
          here. You can turn them back on yourself:
        </p>
        <p className="text-[11px] leading-relaxed" style={{ color: t.textMuted }}>
          On iPhone: Settings → Notifications → Sanctum → Allow Notifications. On Android or a
          computer: the lock or tune icon beside the address → site settings → Notifications →
          Allow. Then come back to this sheet.
        </p>
      </div>
    );
  } else if (pushState === 'subscribed') {
    body = (
      <div className="space-y-3">
        <div
          className="flex items-center gap-2 rounded-lg border px-3 py-2.5"
          style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}80` }}
        >
          <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: t.accent }} />
          <p className="text-xs truncate" style={{ color: t.text }}>
            On — {formatTime(saved.localTime)} · {focusLabel(saved.focus)}
          </p>
        </div>

        {focusSelect}
        {timeField}

        {draftTime !== saved.localTime && (
          <button
            onClick={() => void handleSaveTime()}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: t.accentRgba(0.14), borderColor: t.accentRgba(0.4), color: t.accent }}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span className="text-xs font-bold uppercase tracking-wide">Save the new time</span>
          </button>
        )}

        <button
          onClick={() => void handleTest()}
          disabled={busy}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-[11px] font-bold transition-all active:scale-[0.98] disabled:opacity-60"
          style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}99`, color: t.textMuted }}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Send a test notification
        </button>

        <button
          onClick={() => void handleOff()}
          disabled={busy}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-[11px] font-bold transition-all active:scale-[0.98] disabled:opacity-60"
          style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}99`, color: t.textMuted }}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellOff className="w-3.5 h-3.5" />}
          Turn off the reminder
        </button>

        {privacyNote}
      </div>
    );
  } else {
    // 'default' (never asked) or 'granted' (permission given, subscription missing)
    body = (
      <div className="space-y-3">
        <p className="text-[11px] leading-relaxed" style={{ color: t.textMuted }}>
          A short notification at the time you choose — and tapping it opens the part of
          Sanctum you picked. The notification itself says only that your Gospel and
          reflection are ready; everything it points to stays inside the app.
        </p>

        {focusSelect}
        {timeField}

        <button
          onClick={() => void handleEnable()}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-all active:scale-[0.98] disabled:opacity-50"
          style={{ backgroundColor: t.accentRgba(0.14), borderColor: t.accentRgba(0.4), color: t.accent }}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
          <span className="text-xs font-bold uppercase tracking-wide">
            {busy ? 'Setting up…' : pushState === 'granted' ? 'Finish turning on the reminder' : 'Turn on the reminder'}
          </span>
        </button>

        {privacyNote}
      </div>
    );
  }

  return (
    <div>
      {body}

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
          <p className="text-[10px] leading-relaxed" style={{ color: message.ok ? t.textMuted : '#991B1B' }}>
            {message.text}
          </p>
        </div>
      )}
    </div>
  );
}
