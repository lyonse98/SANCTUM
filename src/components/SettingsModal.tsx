import { useState, useEffect } from 'react';
import { X, ShieldAlert, Lock, MessageSquare, BarChart3, Download, Users, Eraser, Type, PenLine, Star, Church } from 'lucide-react';
import { useFeedback } from '@/components/FeedbackProvider';
import { isAnalyticsEnabled, setAnalyticsEnabled } from '@/lib/analytics';
import { PRIVACY_PARAGRAPH, analyticsCopy } from '@/lib/privacyCopy';
import { eraseTailorProfile, hasTailorProfile } from '@/lib/tailorProfile';
import { READING_SIZES, loadReadingSize, saveReadingSize, type ReadingSize } from '@/lib/readingSize';
import { READER_NAME_MAX, loadReaderName, saveReaderName } from '@/lib/readerName';
import { loadPatronSaint, patronFeastLabel, savePatronSaint } from '@/lib/patronSaint';
import { loadParishPatron, saveParishPatron } from '@/lib/parishPatron';
import { USUAL_MASS_PARISH_MAX, formatMassTime, loadParishReminders, loadUsualMass, saveParishReminders, saveUsualMass, type ReminderLead, type UsualMassDay } from '@/lib/usualMass';
import { loadPushReminder, syncParishReminders } from '@/lib/push';
import { SAINTS, type SaintOfDay } from '@/data/saints';
import { PatronPlate } from '@/components/PatronPlate';
import type { Audience, Persona } from '@/types';
import { InstallModal } from '@/components/InstallInstructions';
import { CrisisLine } from '@/components/CrisisLine';

/** Day-of-week names in the server's numbering: index 0 is Sunday. */
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The reminder-lead choices, as the reader sees them: off, or minutes ahead. */
const LEAD_OPTIONS: { value: ReminderLead | null; label: string }[] = [
  { value: null, label: 'Off' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hr' },
  { value: 120, label: '2 hrs' },
];

interface SettingsModalProps {
  open: boolean;
  audience: Audience;
  onAudienceChange: (audience: Audience) => void;
  onClose: () => void;
  onOpenTerms?: () => void;
  /** Opens a companion's chat — the patron plate's way onward when the patron is a companion. */
  onOpenCompanion?: (persona: Persona) => void;
  /**
   * Opens Today at the Gospel card's Tailor panel with the standing-
   * profile editor open (Erik, Nov 18, 2026) — the same editor the
   * Tailor intake carries, one tap from here.
   */
  onEditTailorProfile?: () => void;
}

export function SettingsModal({ open, audience, onAudienceChange, onClose, onOpenTerms, onOpenCompanion, onEditTailorProfile }: SettingsModalProps) {
  const feedback = useFeedback();
  const [analyticsOn, setAnalyticsOn] = useState(() => isAnalyticsEnabled());
  const [installOpen, setInstallOpen] = useState(false);
  // The Tailor profile erase shows only when this track actually has one —
  // re-checked each time the sheet opens, since the profile is edited in the
  // Tailor panel, not here.
  const [tailorProfileExists, setTailorProfileExists] = useState(false);

  // The reader's own settings (Erik, Nov 18, 2026) — reading size, the
  // name, the year's patron, the usual Mass. All live on this device;
  // each is re-read when the sheet opens, since some are also touched
  // from the players and the Tailor panel.
  const [readingSize, setReadingSize] = useState<ReadingSize>(() => loadReadingSize());
  const [nameValue, setNameValue] = useState('');
  const [patron, setPatron] = useState<SaintOfDay | null>(null);
  const [patronPickerOpen, setPatronPickerOpen] = useState(false);
  const [patronQuery, setPatronQuery] = useState('');
  const [parishPatron, setParishPatron] = useState<SaintOfDay | null>(null);
  const [parishPatronPickerOpen, setParishPatronPickerOpen] = useState(false);
  const [parishPatronQuery, setParishPatronQuery] = useState('');
  const [massParish, setMassParish] = useState('');
  const [massTime, setMassTime] = useState('');
  const [massDay, setMassDay] = useState<UsualMassDay>('sunday');
  const [massSaved, setMassSaved] = useState(false);
  // The parish reminder settings (Nov 18, 2026): the parish's Confession
  // day and hour, and how far ahead of Mass and Confession a poke may
  // come. They live beside the usual Mass, on this device only.
  const [confDay, setConfDay] = useState<number | null>(null);
  const [confTime, setConfTime] = useState('');
  const [massLead, setMassLead] = useState<ReminderLead | null>(null);
  const [confLead, setConfLead] = useState<ReminderLead | null>(null);
  const [parishSaved, setParishSaved] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    if (open) {
      setAnalyticsOn(isAnalyticsEnabled());
      setTailorProfileExists(hasTailorProfile(audience));
      setReadingSize(loadReadingSize());
      setNameValue(loadReaderName() ?? '');
      setPatron(loadPatronSaint());
      setPatronPickerOpen(false);
      setPatronQuery('');
      setParishPatron(loadParishPatron());
      setParishPatronPickerOpen(false);
      setParishPatronQuery('');
      const mass = loadUsualMass();
      setMassParish(mass?.parish ?? '');
      setMassTime(mass?.time ?? '');
      setMassDay(mass?.day ?? 'sunday');
      setMassSaved(Boolean(mass));
      const reminders = loadParishReminders();
      setConfDay(reminders.confessionDay);
      setConfTime(reminders.confessionTime ?? '');
      setMassLead(reminders.massReminderLead);
      setConfLead(reminders.confessionReminderLead);
      setParishSaved(false);
      setPushEnabled(loadPushReminder().enabled);
    }
  }, [open, audience]);

  if (!open) return null;

  const getVar = (name: string) => `var(${name})`;
  const card = getVar('--p-card');
  const border = getVar('--p-border');
  const accent = getVar('--p-accent');
  const textBright = getVar('--p-text-bright');
  const textMuted = getVar('--p-text-muted');
  const textDim = getVar('--p-text-dim');

  const borderRgba50 = 'color-mix(in srgb, var(--p-border) 50%, transparent)';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl animate-slide-up max-h-[85vh] overflow-y-auto chat-scroll border"
        style={{ backgroundColor: card, borderColor: `${border}99` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b sticky top-0 rounded-t-2xl"
          style={{ borderColor: `${border}66`, backgroundColor: card }}
        >
          <h2 className="text-sm font-bold font-display uppercase tracking-wide" style={{ color: textBright }}>Settings</h2>
          <button onClick={onClose} className="transition-colors" style={{ color: textDim }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">

          {/* The crisis line at the head of the sheet (Erik, Nov 18, 2026) —
              above every setting, the same canonical line as everywhere. */}
          <CrisisLine muted={textMuted} bright={textBright} />

          {/* The track switch. Switching closes any open companion and returns to
              Today; each companion's conversation is kept separately on-device. */}
          <div className="rounded-lg p-3 border" style={{ backgroundColor: borderRgba50, borderColor: borderRgba50 }}>
            <div className="flex items-start gap-2">
              <Users className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }} />
              <div className="flex-1">
                <p className="text-[12px] font-bold uppercase tracking-wide mb-1" style={{ color: textBright }}>
                  Your Track
                </p>
                <p className="text-[13px] leading-relaxed mb-2" style={{ color: textMuted }}>
                  Sanctum is kept for men and for women — different companions, reflections, and
                  examinations for the life being lived. Switching closes your current companion and
                  returns to Today; every companion&rsquo;s conversation stays saved separately on this device.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: 'men', label: 'For Men' },
                    { id: 'women', label: 'For Women' },
                  ] as const).map((opt) => {
                    const selected = audience === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => { if (!selected) onAudienceChange(opt.id); }}
                        aria-pressed={selected}
                        className="py-2 px-2 rounded-lg border text-[12px] font-bold uppercase tracking-wide transition-all"
                        style={{
                          backgroundColor: selected ? accent : 'transparent',
                          borderColor: accent,
                          color: selected ? '#fff' : textMuted,
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>


          {/* The reader's own settings (Erik, Nov 18, 2026): the reading
              size, the name, the year's patron, the usual Mass — each
              kept on this device only, each invisible until it is set. */}
          <div className="pt-2 space-y-3">
            <div className="rounded-lg p-3 border" style={{ backgroundColor: borderRgba50, borderColor: borderRgba50 }}>
              <div className="flex items-start gap-2">
                <Type className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }} />
                <div className="flex-1">
                  <p className="text-[12px] font-bold uppercase tracking-wide mb-1" style={{ color: textBright }}>
                    Reading Size
                  </p>
                  <p className="text-[13px] leading-relaxed mb-2" style={{ color: textMuted }}>
                    The size of the day&rsquo;s readings, reflection, and closing — set it where your
                    eyes rest. Kept on this device only.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {READING_SIZES.map((opt) => {
                      const selected = readingSize === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => { setReadingSize(opt.id); saveReadingSize(opt.id); }}
                          aria-pressed={selected}
                          className="py-2 px-2 rounded-lg border text-[12px] font-bold uppercase tracking-wide transition-all"
                          style={{
                            backgroundColor: selected ? accent : 'transparent',
                            borderColor: accent,
                            color: selected ? '#fff' : textMuted,
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg p-3 border" style={{ backgroundColor: borderRgba50, borderColor: borderRgba50 }}>
              <div className="flex items-start gap-2">
                <PenLine className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }} />
                <div className="flex-1">
                  <p className="text-[12px] font-bold uppercase tracking-wide mb-1" style={{ color: textBright }}>
                    Your Name
                  </p>
                  <p className="text-[13px] leading-relaxed mb-2" style={{ color: textMuted }}>
                    What Sanctum may call you. Kept only on this device — a companion is handed the
                    name itself, in a chat or in a letter, and nothing more.
                  </p>
                  <input
                    type="text"
                    value={nameValue}
                    maxLength={READER_NAME_MAX}
                    onChange={(e) => setNameValue(e.target.value)}
                    onBlur={() => saveReaderName(nameValue)}
                    placeholder="Your name, if you like"
                    aria-label="Your name"
                    className="w-full bg-transparent border rounded-lg px-3 py-2 text-[13px] leading-relaxed outline-none"
                    style={{ borderColor: accent, color: textBright }}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg p-3 border" style={{ backgroundColor: borderRgba50, borderColor: borderRgba50 }}>
              <div className="flex items-start gap-2">
                <Star className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }} />
                <div className="flex-1">
                  <p className="text-[12px] font-bold uppercase tracking-wide mb-1" style={{ color: textBright }}>
                    Patron Saint for the Year
                  </p>
                  <p className="text-[13px] leading-relaxed mb-2" style={{ color: textMuted }}>
                    The old custom: one patron for the year. Sanctum marks their feast when it
                    comes, and keeps them one tap away. Kept on this device only.
                  </p>
                  {patron && !patronPickerOpen && (
                    <div className="mb-2">
                      <PatronPlate
                        patron={patron}
                        audience={audience}
                        colors={{
                          border,
                          fill: 'transparent',
                          card,
                          textBright,
                          textMuted,
                          textDim,
                          accent,
                        }}
                        onOpenCompanion={onOpenCompanion ? (p) => { onClose(); onOpenCompanion(p); } : undefined}
                      />
                    </div>
                  )}
                  {patronPickerOpen ? (
                    <div>
                      <input
                        type="text"
                        value={patronQuery}
                        onChange={(e) => setPatronQuery(e.target.value)}
                        placeholder="Search the saints"
                        aria-label="Search the saints"
                        className="w-full bg-transparent border rounded-lg px-3 py-2 text-[13px] leading-relaxed outline-none mb-2"
                        style={{ borderColor: accent, color: textBright }}
                      />
                      <div className="max-h-56 overflow-y-auto chat-scroll space-y-1">
                        {SAINTS.filter((s) => s.name.toLowerCase().includes(patronQuery.trim().toLowerCase())).map((saint, i) => (
                          <button
                            key={`${saint.name}-${saint.feastDate}-${i}`}
                            onClick={() => { setPatron(saint); savePatronSaint(saint); setPatronPickerOpen(false); }}
                            className="w-full flex items-baseline justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition-opacity hover:opacity-70"
                            style={{ backgroundColor: borderRgba50 }}
                          >
                            <span className="text-[13px] font-semibold" style={{ color: textBright }}>{saint.name}</span>
                            <span className="text-[12px] flex-shrink-0" style={{ color: textDim }}>{patronFeastLabel(saint)}</span>
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setPatronPickerOpen(false)}
                        className="w-full mt-2 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wide transition-opacity hover:opacity-70"
                        style={{ color: textMuted }}
                      >
                        Close the list
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPatronPickerOpen(true)}
                        className="flex-1 py-2 px-2 rounded-lg border text-[12px] font-bold uppercase tracking-wide transition-all"
                        style={{ backgroundColor: 'transparent', borderColor: accent, color: textMuted }}
                      >
                        {patron ? 'Choose another' : 'Choose a patron'}
                      </button>
                      {patron && (
                        <button
                          onClick={() => { setPatron(null); savePatronSaint(null); }}
                          className="py-2 px-3 rounded-lg border text-[12px] font-bold uppercase tracking-wide transition-all"
                          style={{ backgroundColor: 'transparent', borderColor: accent, color: textMuted }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-lg p-3 border" style={{ backgroundColor: borderRgba50, borderColor: borderRgba50 }}>
              <div className="flex items-start gap-2">
                <Church className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }} />
                <div className="flex-1">
                  <p className="text-[12px] font-bold uppercase tracking-wide mb-1" style={{ color: textBright }}>
                    Your Parish&rsquo;s Patron
                  </p>
                  <p className="text-[13px] leading-relaxed mb-2" style={{ color: textMuted }}>
                    The patron saint of your parish. When their feast comes, Sanctum keeps it on
                    your Today — your parish&rsquo;s day, marked quietly as yours. Kept on this
                    device only.
                    {massParish.trim() && (
                      <> Your parish, from My Usual Mass below: <span style={{ color: textBright }}>{massParish.trim()}</span>.</>
                    )}
                  </p>
                  {parishPatron && !parishPatronPickerOpen && (
                    <div className="mb-2">
                      <PatronPlate
                        patron={parishPatron}
                        audience={audience}
                        eyebrow="Your parish's patron"
                        colors={{
                          border,
                          fill: 'transparent',
                          card,
                          textBright,
                          textMuted,
                          textDim,
                          accent,
                        }}
                        onOpenCompanion={onOpenCompanion ? (p) => { onClose(); onOpenCompanion(p); } : undefined}
                      />
                    </div>
                  )}
                  {parishPatronPickerOpen ? (
                    <div>
                      <input
                        type="text"
                        value={parishPatronQuery}
                        onChange={(e) => setParishPatronQuery(e.target.value)}
                        placeholder="Search the saints"
                        aria-label="Search the saints for your parish's patron"
                        className="w-full bg-transparent border rounded-lg px-3 py-2 text-[13px] leading-relaxed outline-none mb-2"
                        style={{ borderColor: accent, color: textBright }}
                      />
                      <div className="max-h-56 overflow-y-auto chat-scroll space-y-1">
                        {SAINTS.filter((s) => s.name.toLowerCase().includes(parishPatronQuery.trim().toLowerCase())).map((saint, i) => (
                          <button
                            key={`${saint.name}-${saint.feastDate}-${i}`}
                            onClick={() => { setParishPatron(saint); saveParishPatron(saint); setParishPatronPickerOpen(false); }}
                            className="w-full flex items-baseline justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition-opacity hover:opacity-70"
                            style={{ backgroundColor: borderRgba50 }}
                          >
                            <span className="text-[13px] font-semibold" style={{ color: textBright }}>{saint.name}</span>
                            <span className="text-[12px] flex-shrink-0" style={{ color: textDim }}>{patronFeastLabel(saint)}</span>
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setParishPatronPickerOpen(false)}
                        className="w-full mt-2 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wide transition-opacity hover:opacity-70"
                        style={{ color: textMuted }}
                      >
                        Close the list
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setParishPatronPickerOpen(true)}
                        className="flex-1 py-2 px-2 rounded-lg border text-[12px] font-bold uppercase tracking-wide transition-all"
                        style={{ backgroundColor: 'transparent', borderColor: accent, color: textMuted }}
                      >
                        {parishPatron ? 'Choose another' : 'Choose the patron'}
                      </button>
                      {parishPatron && (
                        <button
                          onClick={() => { setParishPatron(null); saveParishPatron(null); }}
                          className="py-2 px-3 rounded-lg border text-[12px] font-bold uppercase tracking-wide transition-all"
                          style={{ backgroundColor: 'transparent', borderColor: accent, color: textMuted }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-lg p-3 border" style={{ backgroundColor: borderRgba50, borderColor: borderRgba50 }}>
              <div className="flex items-start gap-2">
                <Church className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }} />
                <div className="flex-1">
                  <p className="text-[12px] font-bold uppercase tracking-wide mb-1" style={{ color: textBright }}>
                    My Usual Mass
                  </p>
                  <p className="text-[13px] leading-relaxed mb-2" style={{ color: textMuted }}>
                    Your parish and your usual Mass. The evening before it, Tonight looks ahead to
                    it by name. Kept on this device only — nothing about attendance is ever kept.
                  </p>
                  <input
                    type="text"
                    value={massParish}
                    maxLength={USUAL_MASS_PARISH_MAX}
                    onChange={(e) => { setMassParish(e.target.value); setMassSaved(false); }}
                    placeholder="Parish name"
                    aria-label="Parish name"
                    className="w-full bg-transparent border rounded-lg px-3 py-2 text-[13px] leading-relaxed outline-none mb-2"
                    style={{ borderColor: accent, color: textBright }}
                  />
                  <div className="flex gap-2 mb-2">
                    <input
                      type="time"
                      value={massTime}
                      onChange={(e) => { setMassTime(e.target.value); setMassSaved(false); }}
                      aria-label="Mass time"
                      className="bg-transparent border rounded-lg px-3 py-2 text-[13px] leading-relaxed outline-none"
                      style={{ borderColor: accent, color: textBright }}
                    />
                    <div className="grid grid-cols-2 gap-2 flex-1">
                      {([
                        { id: 'sunday', label: 'Sunday' },
                        { id: 'saturday', label: 'Sat vigil' },
                      ] as const).map((opt) => {
                        const selected = massDay === opt.id;
                        return (
                          <button
                            key={opt.id}
                            onClick={() => { setMassDay(opt.id); setMassSaved(false); }}
                            aria-pressed={selected}
                            className="py-2 px-2 rounded-lg border text-[12px] font-bold uppercase tracking-wide transition-all"
                            style={{
                              backgroundColor: selected ? accent : 'transparent',
                              borderColor: accent,
                              color: selected ? '#fff' : textMuted,
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {/* The parish's Confession hour and the reminder leads
                      (Nov 18, 2026). Days and times only — what reaches
                      the server is never the parish's name. */}
                  <p className="text-[12px] font-bold uppercase tracking-wide mt-3 mb-1" style={{ color: textBright }}>
                    Parish Confession
                  </p>
                  <div className="flex gap-2 mb-2">
                    <select
                      value={confDay === null ? '' : String(confDay)}
                      onChange={(e) => { setConfDay(e.target.value === '' ? null : Number(e.target.value)); setParishSaved(false); }}
                      aria-label="Confession day"
                      className="bg-transparent border rounded-lg px-3 py-2 text-[13px] leading-relaxed outline-none flex-1"
                      style={{ borderColor: accent, color: textBright }}
                    >
                      <option value="">No set day</option>
                      {WEEKDAY_NAMES.map((name, i) => (
                        <option key={name} value={i}>{name}</option>
                      ))}
                    </select>
                    <input
                      type="time"
                      value={confTime}
                      onChange={(e) => { setConfTime(e.target.value); setParishSaved(false); }}
                      aria-label="Confession time"
                      className="bg-transparent border rounded-lg px-3 py-2 text-[13px] leading-relaxed outline-none"
                      style={{ borderColor: accent, color: textBright }}
                    />
                  </div>
                  {([
                    { label: 'Mass reminder', value: massLead, set: setMassLead },
                    { label: 'Confession reminder', value: confLead, set: setConfLead },
                  ] as const).map((row) => (
                    <div key={row.label} className="mb-2">
                      <p className="text-[12px] uppercase tracking-widest font-bold mb-1" style={{ color: textMuted }}>
                        {row.label}
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        {LEAD_OPTIONS.map((opt) => {
                          const selected = row.value === opt.value;
                          return (
                            <button
                              key={opt.label}
                              onClick={() => { row.set(opt.value); setParishSaved(false); }}
                              aria-pressed={selected}
                              className="py-2 px-1 rounded-lg border text-[12px] font-bold uppercase tracking-wide transition-all"
                              style={{
                                backgroundColor: selected ? accent : 'transparent',
                                borderColor: accent,
                                color: selected ? '#fff' : textMuted,
                              }}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {(massLead !== null || confLead !== null) && (
                    <p className="text-[13px] leading-relaxed mb-2" style={{ color: textMuted }}>
                      {pushEnabled
                        ? 'Rides your Sanctum notifications — the parish name never leaves this phone.'
                        : 'Reminders begin once notifications are on. They ride your Sanctum notifications — the parish name never leaves this phone.'}
                    </p>
                  )}
                  {parishSaved && (
                    <p className="text-[13px] leading-relaxed mb-2" style={{ color: textMuted }}>
                      Reminder settings kept on this device.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        saveParishReminders({
                          confessionDay: confDay,
                          confessionTime: confTime || null,
                          massReminderLead: massLead,
                          confessionReminderLead: confLead,
                          driveTime: loadParishReminders().driveTime,
                        });
                        setParishSaved(true);
                        if (massParish.trim() && massTime) {
                          saveUsualMass({ parish: massParish, time: massTime, day: massDay });
                          setMassSaved(true);
                        }
                        void syncParishReminders();
                      }}
                      className="flex-1 py-2 px-2 rounded-lg border text-[12px] font-bold uppercase tracking-wide transition-all"
                      style={{ backgroundColor: 'transparent', borderColor: accent, color: textMuted }}
                    >
                      {massSaved ? `Kept — ${formatMassTime(massTime)} at ${massParish.trim()}` : 'Keep this Mass'}
                    </button>
                    {massSaved && (
                      <button
                        onClick={() => { saveUsualMass(null); setMassParish(''); setMassTime(''); setMassDay('sunday'); setMassSaved(false); void syncParishReminders(); }}
                        className="py-2 px-3 rounded-lg border text-[12px] font-bold uppercase tracking-wide transition-all"
                        style={{ backgroundColor: 'transparent', borderColor: accent, color: textMuted }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 space-y-3">
            <div className="rounded-lg p-3 border" style={{ backgroundColor: borderRgba50, borderColor: borderRgba50 }}>
              <div className="flex items-start gap-2">
                <BarChart3 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }} />
                <div className="flex-1">
                  <p className="text-[12px] font-bold uppercase tracking-wide mb-1" style={{ color: textBright }}>
                    Usage Analytics
                  </p>
                  <p className="text-[13px] leading-relaxed mb-2" style={{ color: textMuted }}>
{analyticsCopy(audience)}
                  </p>
                  <button
                    onClick={() => {
                      const next = !analyticsOn;
                      setAnalyticsOn(next);
                      setAnalyticsEnabled(next);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all"
                    style={{ backgroundColor: analyticsOn ? accent : 'transparent', borderColor: accent, color: analyticsOn ? '#fff' : textMuted }}
                  >
                    <span className="text-[12px] font-bold uppercase tracking-wide">
                      {analyticsOn ? 'Analytics On' : 'Analytics Off'}
                    </span>
                    <span className="text-[12px]">{analyticsOn ? 'Tap to turn off' : 'Tap to turn on'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-lg p-3 border" style={{ backgroundColor: borderRgba50, borderColor: borderRgba50 }}>
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }} />
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-wide mb-1" style={{ color: textBright }}>
                    Not a Therapy Service
                  </p>
                  <p className="text-[13px] leading-relaxed" style={{ color: textMuted }}>
                    This is a spiritual companion, not a licensed therapist or medical professional. If you are in
                    crisis, call or text <span className="font-bold">988</span> (US). For domestic violence, call{' '}
                    <span className="font-bold">1-800-799-7233</span>. If outside the US, visit findahelpline.com.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg p-3 border" style={{ backgroundColor: borderRgba50, borderColor: borderRgba50 }}>
              <div className="flex items-start gap-2">
                <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }} />
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-wide mb-1" style={{ color: textBright }}>
                    Your Privacy
                  </p>
                  <p className="text-[13px] leading-relaxed" style={{ color: textMuted }}>
{PRIVACY_PARAGRAPH}
                  </p>
                </div>
              </div>
            </div>

            {/* The Tailor profile, editable from here (Erik, Nov 18,
                2026): the entry opens Today at the Tailor panel with
                the standing-profile editor open — the same editor,
                bound to the same on-device store, not a second one.
                The erase stands under it, behind its has-profile
                guard, exactly as before. */}
            <div className="rounded-lg p-3 border" style={{ backgroundColor: borderRgba50, borderColor: borderRgba50 }}>
              <div className="flex items-start gap-2">
                <Eraser className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }} />
                <div className="flex-1">
                  <p className="text-[12px] font-bold uppercase tracking-wide mb-1" style={{ color: textBright }}>
                    Your Tailor Profile
                  </p>
                  <p className="text-[13px] leading-relaxed mb-2" style={{ color: textMuted }}>
                    Your standing Tailor Today profile — your season of life, the battles you
                    named, your goal, the voices you listen to, your North Star — is kept on
                    this device only. Edit it here whenever you like; it is the same profile
                    Tailor Today keeps, in the same place.
                  </p>
                  <button
                    data-edit-tailor-profile
                    onClick={() => { onClose(); onEditTailorProfile?.(); }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-all mb-2"
                    style={{ backgroundColor: 'transparent', borderColor: accent, color: textMuted }}
                  >
                    <PenLine className="w-3.5 h-3.5" />
                    <span className="text-[12px] font-bold uppercase tracking-wide">Edit Tailor profile</span>
                  </button>
                  {tailorProfileExists && (
                    <button
                      onClick={() => {
                        eraseTailorProfile(audience);
                        setTailorProfileExists(false);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-all"
                      style={{ backgroundColor: 'transparent', borderColor: accent, color: textMuted }}
                    >
                      <Eraser className="w-3.5 h-3.5" />
                      <span className="text-[12px] font-bold uppercase tracking-wide">Erase Tailor profile</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-1 space-y-2">
            <button
              onClick={() => setInstallOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium border transition-all"
              style={{
                backgroundColor: borderRgba50,
                borderColor: borderRgba50,
                color: textMuted,
              }}
            >
              <Download className="w-3.5 h-3.5" />
              Add Sanctum to your Home Screen
            </button>

            <button
              onClick={() => { onClose(); feedback?.openFeedback('settings'); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium border transition-all"
              style={{
                backgroundColor: borderRgba50,
                borderColor: borderRgba50,
                color: textMuted,
              }}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Feedback / Bug Report
            </button>

            <button
              onClick={() => { onClose(); onOpenTerms?.(); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium border transition-all"
              style={{
                backgroundColor: borderRgba50,
                borderColor: borderRgba50,
                color: textMuted,
              }}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Terms & Privacy Disclaimer
            </button>
          </div>
        </div>
      </div>
      {installOpen && (
        <InstallModal
          cardBackground={card}
          tokens={{
            accent,
            accentSoft: borderRgba50,
            border,
            textBright,
            text: `var(--p-text)`,
            textMuted,
            textDim,
          }}
          onClose={() => setInstallOpen(false)}
        />
      )}
    </div>
  );
}
