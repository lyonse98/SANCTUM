import { useId, useState } from 'react';
import { Bell, BellOff, Check, Loader2, AlertCircle, ShieldCheck, Send } from 'lucide-react';
import type { PersonaTheme } from '@/types';
import {
  DEFAULT_EVENING_TIME,
  getPushState,
  loadPushReminder,
  sendTestPoke,
  subscribeToPush,
  syncParishReminders,
  unsubscribeFromPush,
  updatePushPreferences,
  type PushState,
} from '@/lib/push';
import {
  CONFESSION_EVENING_BEFORE_LEAD,
  CONFESSION_LEAD_OPTIONS,
  MASS_LEAD_OPTIONS,
  USUAL_MASS_PARISH_MAX,
  loadParishReminders,
  loadUsualMass,
  saveParishReminders,
  saveUsualMass,
  type ConfessionLead,
  type ReminderLead,
  type UsualMassDay,
} from '@/lib/usualMass';
import { DEFAULT_FOCUS, focusLabel } from '@/lib/reminderFocus';
import { InstallInstructions } from '@/components/InstallInstructions';

/** The hour the form offers when a man first adds the drive-home reminder. */
const DEFAULT_DRIVE_TIME = '17:30';

/** Day-of-week names in the server's numbering: index 0 is Sunday. */
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
 * tapping it opens the day's Gospel. The notification itself carries one
 * plain sentence — a lock screen is a public place, so nothing personal is ever in it.
 *
 * The form renders a different face for each state the device can be in (install first on
 * an iPhone, a refused ask, a live subscription) so a man is never shown a control that
 * cannot work. Kept separate from the frame that holds it, like the email form before it.
 */
export function ReminderForm({ t }: ReminderFormProps) {
  const initial = loadPushReminder();
  const initialParish = loadParishReminders();
  const initialMass = loadUsualMass();
  const timeFieldId = useId();
  const eveningTimeFieldId = useId();
  const driveTimeFieldId = useId();
  const [pushState, setPushState] = useState<PushState>(() => getPushState());
  const [saved, setSaved] = useState(initial);
  const [draftTime, setDraftTime] = useState(initial.localTime);
  const [draftEveningEnabled, setDraftEveningEnabled] = useState(initial.eveningTime !== null);
  const [draftEveningTime, setDraftEveningTime] = useState(initial.eveningTime ?? DEFAULT_EVENING_TIME);
  const [savedDriveTime, setSavedDriveTime] = useState(initialParish.driveTime);
  const [draftDriveEnabled, setDraftDriveEnabled] = useState(initialParish.driveTime !== null);
  const [draftDriveTime, setDraftDriveTime] = useState(initialParish.driveTime ?? DEFAULT_DRIVE_TIME);
  // The parish reminder drafts (Nov 20, 2026): the usual Mass, the
  // parish's Confession hour, and the two leads — the same settings
  // Settings carries, drafted here from the same stores.
  const [draftMassParish, setDraftMassParish] = useState(initialMass?.parish ?? '');
  const [draftMassTime, setDraftMassTime] = useState(initialMass?.time ?? '');
  const [draftMassDay, setDraftMassDay] = useState<UsualMassDay>(initialMass?.day ?? 'sunday');
  const [draftConfDay, setDraftConfDay] = useState<number | null>(initialParish.confessionDay);
  const [draftConfTime, setDraftConfTime] = useState(initialParish.confessionTime ?? '');
  const [draftMassLead, setDraftMassLead] = useState<ReminderLead | null>(initialParish.massReminderLead);
  const [draftConfLead, setDraftConfLead] = useState<ConfessionLead | null>(initialParish.confessionReminderLead);
  const [parishKept, setParishKept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  /** The evening hour the drafts currently describe: a time, or none. */
  const draftEvening = draftEveningEnabled ? draftEveningTime : null;

  /** The drive-home hour the drafts currently describe: a time, or none. */
  const draftDrive = draftDriveEnabled ? draftDriveTime : null;

  /** Keeps the drive-home hour in the parish store, beside the other parish times. */
  const persistDriveDraft = () => {
    saveParishReminders({ ...loadParishReminders(), driveTime: draftDrive });
    setSavedDriveTime(draftDrive);
  };

  /**
   * Keeps the parish drafts in their stores — the very stores Settings
   * edits, so the two surfaces can never diverge: a change made in either
   * place is the change, not a copy of it. The drive draft rides along as
   * the record's drive hour, as it does in the drive save itself. The
   * usual Mass is written only whole (name and time together), exactly as
   * Settings writes it; a half-filled Mass changes nothing.
   */
  const persistParishDraft = () => {
    saveParishReminders({
      confessionDay: draftConfDay,
      confessionTime: draftConfTime || null,
      massReminderLead: draftMassLead,
      confessionReminderLead: draftConfLead,
      driveTime: draftDrive,
    });
    setSavedDriveTime(draftDrive);
    if (draftMassParish.trim() && draftMassTime) {
      saveUsualMass({ parish: draftMassParish, time: draftMassTime, day: draftMassDay });
    }
  };

  /** The parish section's own save: the stores, the kept note, the sync. */
  const handleSaveParish = () => {
    persistParishDraft();
    setParishKept(true);
    void syncParishReminders();
  };

  const refresh = () => {
    const next = loadPushReminder();
    setSaved(next);
    setDraftTime(next.localTime);
    setDraftEveningEnabled(next.eveningTime !== null);
    setDraftEveningTime(next.eveningTime ?? DEFAULT_EVENING_TIME);
    const parish = loadParishReminders();
    setSavedDriveTime(parish.driveTime);
    setDraftDriveEnabled(parish.driveTime !== null);
    setDraftDriveTime(parish.driveTime ?? DEFAULT_DRIVE_TIME);
    const mass = loadUsualMass();
    setDraftMassParish(mass?.parish ?? '');
    setDraftMassTime(mass?.time ?? '');
    setDraftMassDay(mass?.day ?? 'sunday');
    setDraftConfDay(parish.confessionDay);
    setDraftConfTime(parish.confessionTime ?? '');
    setDraftMassLead(parish.massReminderLead);
    setDraftConfLead(parish.confessionReminderLead);
    setParishKept(false);
    setPushState(getPushState());
  };

  const handleEnable = async () => {
    setBusy(true);
    setMessage(null);
    // The parish and drive drafts go to their stores first, so the
    // subscription save's own parish sync carries them to the server in
    // the same motion.
    persistParishDraft();
    persistDriveDraft();
    const result = await subscribeToPush(DEFAULT_FOCUS, draftTime, draftEvening);
    setBusy(false);
    setMessage({ ok: result.ok, text: result.message });
    if (result.ok) refresh();
    else setPushState(result.state);
  };

  /**
   * The times save from their own button, because a time picker is fiddled with on the way
   * to a decision and the server should only hear the decision. If a save fails the form
   * snaps back to what is actually stored. (The landing needs no control at all: since
   * Nov 16, 2026 the reminder opens the day's Gospel, always.)
   */
  const handleSaveTimes = async () => {
    setBusy(true);
    setMessage(null);
    const result = await updatePushPreferences(saved.focus, draftTime, draftEvening);
    setBusy(false);
    setMessage({ ok: result.ok, text: result.message });
    if (result.ok) {
      persistParishDraft();
      persistDriveDraft();
      void syncParishReminders();
      refresh();
    } else {
      setDraftTime(saved.localTime);
      setDraftEveningEnabled(saved.eveningTime !== null);
      setDraftEveningTime(saved.eveningTime ?? DEFAULT_EVENING_TIME);
      setDraftDriveEnabled(savedDriveTime !== null);
      setDraftDriveTime(savedDriveTime ?? DEFAULT_DRIVE_TIME);
    }
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

  const timeField = (
    <div>
      <label
        htmlFor={timeFieldId}
        className="block text-[12px] uppercase tracking-widest font-bold mb-2"
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

  /**
   * The optional second poke (Nov 17, 2026): the same reminder, the same
   * Gospel landing, at an evening hour. Off unless he asks for it — the
   * toggle is the whole ask, and unticking it is the whole removal.
   */
  const eveningSection = (
    <div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={draftEveningEnabled}
          onChange={(e) => setDraftEveningEnabled(e.target.checked)}
          disabled={busy}
          className="w-4 h-4 flex-shrink-0"
          style={{ accentColor: t.accent }}
        />
        <span className="text-[13px] font-bold" style={{ color: t.text }}>
          Add an evening reminder
        </span>
      </label>
      {draftEveningEnabled && (
        <div className="mt-2">
          <label
            htmlFor={eveningTimeFieldId}
            className="block text-[12px] uppercase tracking-widest font-bold mb-2"
            style={{ color: t.textDim }}
          >
            Evening time
          </label>
          <input
            id={eveningTimeFieldId}
            type="time"
            value={draftEveningTime}
            onChange={(e) => setDraftEveningTime(e.target.value)}
            disabled={busy}
            className="w-full text-sm rounded-lg px-3 py-2.5 border focus:outline-none transition-colors disabled:opacity-60"
            style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}80`, color: t.text }}
          />
        </div>
      )}
    </div>
  );

  /**
   * The optional drive-home poke (Nov 18, 2026): its own hour, its own
   * purpose. Since Nov 20, 2026 the poke sends the man to tailor his
   * devotional for the drive home — its tap opens the Tailor build, so
   * the devotional is made for the road before the road begins.
   * Independent of the other slots by design: it may share an hour with
   * the evening reminder and still fire for its own purpose.
   */
  const driveSection = (
    <div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={draftDriveEnabled}
          onChange={(e) => setDraftDriveEnabled(e.target.checked)}
          disabled={busy}
          className="w-4 h-4 flex-shrink-0"
          style={{ accentColor: t.accent }}
        />
        <span className="text-[13px] font-bold" style={{ color: t.text }}>
          Drive-home reminder
        </span>
      </label>
      {draftDriveEnabled && (
        <div className="mt-2">
          <label
            htmlFor={driveTimeFieldId}
            className="block text-[12px] uppercase tracking-widest font-bold mb-2"
            style={{ color: t.textDim }}
          >
            Drive-home time
          </label>
          <input
            id={driveTimeFieldId}
            type="time"
            value={draftDriveTime}
            onChange={(e) => setDraftDriveTime(e.target.value)}
            disabled={busy}
            className="w-full text-sm rounded-lg px-3 py-2.5 border focus:outline-none transition-colors disabled:opacity-60"
            style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}80`, color: t.text }}
          />
          <p className="text-[13px] leading-relaxed mt-2" style={{ color: t.textMuted }}>
            For the ride home — a poke to tailor your devotional for the road.
          </p>
        </div>
      )}
    </div>
  );

  /**
   * The parish reminders (Erik, Nov 20, 2026): the usual Mass, the
   * parish's Confession hour, and how far ahead of each a poke may come.
   * They stand in Settings already; they stand here too, because this is
   * the reminder sheet — one store, two doors. Every control below reads
   * and writes the same on-device stores Settings uses and syncs through
   * the same parish sync, so the two surfaces cannot diverge. Days,
   * times, and leads are all the server ever hears; the parish's name
   * stays on this phone, here as there.
   */
  const leadButton = (
    label: string,
    selected: boolean,
    onPick: () => void,
  ) => (
    <button
      key={label}
      onClick={onPick}
      disabled={busy}
      aria-pressed={selected}
      className="py-2 px-3 rounded-lg border text-[12px] font-bold uppercase tracking-wide transition-all disabled:opacity-60"
      style={
        selected
          ? { backgroundColor: t.accentRgba(0.14), borderColor: t.accentRgba(0.4), color: t.accent }
          : { backgroundColor: `${t.border}40`, borderColor: `${t.border}80`, color: t.textMuted }
      }
    >
      {label}
    </button>
  );

  const parishSection = (
    <div>
      <p className="text-[13px] font-bold mb-1" style={{ color: t.text }}>
        Your parish
      </p>
      <p className="text-[13px] leading-relaxed mb-3" style={{ color: t.textMuted }}>
        Your usual Mass and your parish&rsquo;s Confession hour, and how far ahead of each a
        poke may come. The same settings as in Settings, kept on this device only — the
        parish name never leaves this phone.
      </p>

      <label
        className="block text-[12px] uppercase tracking-widest font-bold mb-2"
        style={{ color: t.textDim }}
      >
        Parish name
      </label>
      <input
        type="text"
        value={draftMassParish}
        maxLength={USUAL_MASS_PARISH_MAX}
        onChange={(e) => { setDraftMassParish(e.target.value); setParishKept(false); }}
        disabled={busy}
        placeholder="Parish name"
        aria-label="Parish name"
        className="w-full text-sm rounded-lg px-3 py-2.5 border focus:outline-none transition-colors disabled:opacity-60 mb-3"
        style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}80`, color: t.text }}
      />

      <label
        className="block text-[12px] uppercase tracking-widest font-bold mb-2"
        style={{ color: t.textDim }}
      >
        Usual Mass
      </label>
      <div className="flex gap-2 mb-3">
        <input
          type="time"
          value={draftMassTime}
          onChange={(e) => { setDraftMassTime(e.target.value); setParishKept(false); }}
          disabled={busy}
          aria-label="Mass time"
          className="text-sm rounded-lg px-3 py-2.5 border focus:outline-none transition-colors disabled:opacity-60"
          style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}80`, color: t.text }}
        />
        <div className="grid grid-cols-2 gap-2 flex-1">
          {([
            { id: 'sunday', label: 'Sunday' },
            { id: 'saturday', label: 'Sat vigil' },
          ] as const).map((opt) => {
            const selected = draftMassDay === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => { setDraftMassDay(opt.id); setParishKept(false); }}
                disabled={busy}
                aria-pressed={selected}
                className="py-2 px-2 rounded-lg border text-[12px] font-bold uppercase tracking-wide transition-all disabled:opacity-60"
                style={
                  selected
                    ? { backgroundColor: t.accentRgba(0.14), borderColor: t.accentRgba(0.4), color: t.accent }
                    : { backgroundColor: `${t.border}40`, borderColor: `${t.border}80`, color: t.textMuted }
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <label
        className="block text-[12px] uppercase tracking-widest font-bold mb-2"
        style={{ color: t.textDim }}
      >
        Parish Confession
      </label>
      <div className="flex gap-2 mb-3">
        <select
          value={draftConfDay === null ? '' : String(draftConfDay)}
          onChange={(e) => { setDraftConfDay(e.target.value === '' ? null : Number(e.target.value)); setParishKept(false); }}
          disabled={busy}
          aria-label="Confession day"
          className="text-sm rounded-lg px-3 py-2.5 border focus:outline-none transition-colors disabled:opacity-60 flex-1"
          style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}80`, color: t.text }}
        >
          <option value="">No set day</option>
          {WEEKDAY_NAMES.map((name, i) => (
            <option key={name} value={i}>{name}</option>
          ))}
        </select>
        <input
          type="time"
          value={draftConfTime}
          onChange={(e) => { setDraftConfTime(e.target.value); setParishKept(false); }}
          disabled={busy}
          aria-label="Confession time"
          className="text-sm rounded-lg px-3 py-2.5 border focus:outline-none transition-colors disabled:opacity-60"
          style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}80`, color: t.text }}
        />
      </div>

      <label
        className="block text-[12px] uppercase tracking-widest font-bold mb-2"
        style={{ color: t.textDim }}
      >
        Mass reminder
      </label>
      <div className="flex flex-wrap gap-2 mb-3">
        {MASS_LEAD_OPTIONS.map((opt) =>
          leadButton(opt.label, draftMassLead === opt.value, () => { setDraftMassLead(opt.value); setParishKept(false); }),
        )}
      </div>

      <label
        className="block text-[12px] uppercase tracking-widest font-bold mb-2"
        style={{ color: t.textDim }}
      >
        Confession reminder
      </label>
      <div className="flex flex-wrap gap-2">
        {CONFESSION_LEAD_OPTIONS.map((opt) =>
          leadButton(opt.label, draftConfLead === opt.value, () => { setDraftConfLead(opt.value); setParishKept(false); }),
        )}
      </div>
      {draftConfLead === CONFESSION_EVENING_BEFORE_LEAD && (
        <p className="text-[13px] leading-relaxed mt-2" style={{ color: t.textMuted }}>
          One poke at 7:00 PM the evening before Confession day.
        </p>
      )}

      {(draftMassLead !== null || draftConfLead !== null) && (
        <p className="text-[13px] leading-relaxed mt-3" style={{ color: t.textMuted }}>
          {pushState === 'subscribed'
            ? 'Rides your Sanctum notifications — the parish name never leaves this phone.'
            : 'Reminders begin once notifications are on. They ride your Sanctum notifications — the parish name never leaves this phone.'}
        </p>
      )}
      {parishKept && (
        <p className="text-[13px] leading-relaxed mt-3" style={{ color: t.textMuted }}>
          Reminder settings kept on this device.
        </p>
      )}

      <button
        onClick={handleSaveParish}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-all active:scale-[0.98] disabled:opacity-50 mt-3"
        style={{ backgroundColor: t.accentRgba(0.14), borderColor: t.accentRgba(0.4), color: t.accent }}
      >
        <Check className="w-3.5 h-3.5" />
        <span className="text-xs font-bold uppercase tracking-wide">Keep these parish reminders</span>
      </button>
    </div>
  );

  const privacyNote = (
    <div
      className="flex items-start gap-2 mt-3 rounded-lg border px-3 py-2.5"
      style={{ backgroundColor: `${t.border}26`, borderColor: `${t.border}66` }}
    >
      <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: t.textDim }} />
      <p className="text-[13px] leading-relaxed" style={{ color: t.textDim }}>
        This is the one thing Sanctum keeps on a server: an anonymous notification address for
        this device, and the reminder time, or times, you chose — no name, no account, nothing
        you have written to a companion.
      </p>
    </div>
  );

  let body: React.ReactNode;

  if (pushState === 'not-installed') {
    body = (
      <div>
        {/* The steps come first, in plain words (Play 3): a man who opened
            this sheet to set a reminder should meet the one thing he has to
            do, not a paragraph about it. The why follows the steps. */}
        <p className="text-[13px] leading-relaxed mb-3" style={{ color: t.textMuted }}>
          First, put Sanctum on your Home Screen — three taps, about ten seconds:
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
        <p className="text-[13px] leading-relaxed mt-3" style={{ color: t.textMuted }}>
          Why: on an iPhone, notifications only reach apps that live on the Home Screen — a
          browser tab cannot receive notifications. Once Sanctum is there, open it from the
          icon, and this sheet will let you turn the reminder on.
        </p>
      </div>
    );
  } else if (pushState === 'unsupported') {
    body = (
      <p className="text-[13px] leading-relaxed" style={{ color: t.textMuted }}>
        This browser cannot receive notifications, so the reminder cannot reach you here. On an
        iPhone, Sanctum needs to be on the Home Screen; on a computer or an Android phone, a
        current Chrome, Edge, Firefox, or Safari will work.
      </p>
    );
  } else if (pushState === 'denied') {
    body = (
      <div>
        <p className="text-[13px] leading-relaxed mb-2" style={{ color: t.textMuted }}>
          Notifications are turned off for Sanctum, and the browser will not ask again from
          here. You can turn them back on yourself:
        </p>
        <p className="text-[13px] leading-relaxed" style={{ color: t.textMuted }}>
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
          <p className="text-xs" style={{ color: t.text }}>
            On — {formatTime(saved.localTime)} · {focusLabel(saved.focus)}
            {saved.eveningTime ? ` · Evening ${formatTime(saved.eveningTime)}` : ''}
            {savedDriveTime ? ` · Drive home ${formatTime(savedDriveTime)}` : ''}
          </p>
        </div>

        {timeField}

        {eveningSection}

        {driveSection}

        {parishSection}

        {(draftTime !== saved.localTime || draftEvening !== saved.eveningTime || draftDrive !== savedDriveTime) && (
          <button
            onClick={() => void handleSaveTimes()}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: t.accentRgba(0.14), borderColor: t.accentRgba(0.4), color: t.accent }}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span className="text-xs font-bold uppercase tracking-wide">
              {[draftTime !== saved.localTime, draftEvening !== saved.eveningTime, draftDrive !== savedDriveTime].filter(Boolean).length > 1
                ? 'Save the new times'
                : 'Save the new time'}
            </span>
          </button>
        )}

        <button
          onClick={() => void handleTest()}
          disabled={busy}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-[12px] font-bold transition-all active:scale-[0.98] disabled:opacity-60"
          style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}99`, color: t.textMuted }}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Send a test notification
        </button>

        <button
          onClick={() => void handleOff()}
          disabled={busy}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-[12px] font-bold transition-all active:scale-[0.98] disabled:opacity-60"
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
        <p className="text-[13px] leading-relaxed" style={{ color: t.textMuted }}>
          A short notification at the time you choose — and tapping it opens today's
          Gospel. The notification itself says only that your Gospel and
          reflection are ready; everything it points to stays inside the app.
        </p>

        {timeField}

        {eveningSection}

        {driveSection}

        {parishSection}

        {/* One sentence of warning before the phone's own ask appears
            (audit W-7, Nov 16, 2026): the permission prompt is never the
            first explanation a man gets. */}
        <p className="text-[13px] leading-relaxed" style={{ color: t.textMuted }}>
          When you tap below, your phone will ask whether Sanctum may send notifications —
          that ask is only for this reminder.
        </p>

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
          <p className="text-[13px] leading-relaxed" style={{ color: message.ok ? t.textMuted : '#991B1B' }}>
            {message.text}
          </p>
        </div>
      )}
    </div>
  );
}
