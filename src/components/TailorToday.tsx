import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Clapperboard,
  Eraser,
  Headphones,
  Loader2,
  Mic,
  Music,
  Newspaper,
  Pause,
  Play,
  Quote,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Target,
  Video,
  X,
} from 'lucide-react';
import type { Audience, PersonaTheme } from '@/types';
import {
  TAILOR_FOCUSES,
  TAILOR_SEARCH_KINDS,
  TAILOR_SEARCH_KIND_LABELS,
  TAILOR_STATES,
  TAILOR_TONES,
  type TailorFocus,
  type TailorSearchKind,
  type TailorState,
  type TailorTone,
} from '@/data/tailorBank';
import { tailorOffered } from '@/lib/tailorAccess';
import {
  MEDIA_KIND_LABELS,
  getOrBuildTailored,
  loadTodaysTailored,
  mediaActionLabel,
  tailorAudioUrl,
  tailorCreditLine,
  tailorProgressLines,
  type TailorIntake,
  type TailoredDevotional,
} from '@/lib/tailor';
import { shareEntryFromDevotional, writeTailorShare } from '@/lib/tailorShare';
import {
  EMPTY_TAILOR_PROFILE,
  SEASONS_OF_LIFE,
  battlesForAudience,
  eraseTailorProfile,
  loadTailorProfile,
  profileDefaults,
  profileForRequest,
  saveTailorProfile,
  type TailorProfile,
} from '@/lib/tailorProfile';

interface TailorTodayProps {
  t: PersonaTheme;
  audience: Audience;
  /** The readings bundle's date — the devotional built is for the Gospel on screen. */
  dateKey: string;
  /**
   * Panel mode (the Way-1 tiles, Nov 13, 2026): the tile on the Gospel card is
   * the door, so the panel opens straight on the intake form instead of
   * rendering a second "Tailor today" button of its own.
   */
  startOpen?: boolean;
}

function fmt(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** A chip row for the profile editor — one visual language, single or multi. */
function ChipRow({
  t,
  options,
  isOn,
  onToggle,
}: {
  t: PersonaTheme;
  options: { id: string; label: string }[];
  isOn: (id: string) => boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const on = isOn(opt.id);
        return (
          <button
            key={opt.id}
            onClick={() => onToggle(opt.id)}
            aria-pressed={on}
            className="px-2.5 py-1.5 rounded-full border text-[10px] font-bold transition-all active:scale-95"
            style={{
              backgroundColor: on ? t.accentRgba(0.16) : `${t.border}33`,
              borderColor: on ? t.accent : `${t.border}99`,
              color: on ? t.accent : t.textMuted,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The standing profile editor (Nov 13, 2026): the season a person is in,
 * kept on this device only, edited here and erased here. The erase is a
 * two-step act — the first tap arms it, the second carries it out — the
 * same deliberate posture the app takes toward anything it keeps for you.
 */
function TailorProfileEditor({
  t,
  audience,
  onSaved,
}: {
  t: PersonaTheme;
  audience: Audience;
  onSaved: (profile: TailorProfile) => void;
}) {
  const [draft, setDraft] = useState<TailorProfile>(() => loadTailorProfile(audience));
  const [confirmingErase, setConfirmingErase] = useState(false);
  const [savedNote, setSavedNote] = useState(false);

  useEffect(() => {
    setDraft(loadTailorProfile(audience));
    setConfirmingErase(false);
  }, [audience]);

  const hasAnything =
    draft.seasonOfLife !== null ||
    draft.ongoingBattles.length > 0 ||
    draft.standingGoal.trim().length > 0 ||
    draft.mediaPrefs.length > 0 ||
    draft.defaultTone !== null;

  const labelStyle: React.CSSProperties = { color: t.textDim };
  const fieldLabel = 'block text-[9px] uppercase tracking-widest font-bold mb-1.5';

  return (
    <div className="space-y-3">
      <div>
        <span className={fieldLabel} style={labelStyle}>Season of life</span>
        <ChipRow
          t={t}
          options={SEASONS_OF_LIFE[audience]}
          isOn={(id) => draft.seasonOfLife === id}
          onToggle={(id) => setDraft((d) => ({ ...d, seasonOfLife: d.seasonOfLife === id ? null : id }))}
        />
      </div>

      <div>
        <span className={fieldLabel} style={labelStyle}>Battles you carry in this season</span>
        <ChipRow
          t={t}
          options={battlesForAudience(audience).map((b) => ({ id: b, label: b }))}
          isOn={(id) => draft.ongoingBattles.includes(id)}
          onToggle={(id) =>
            setDraft((d) => ({
              ...d,
              ongoingBattles: d.ongoingBattles.includes(id)
                ? d.ongoingBattles.filter((b) => b !== id)
                : [...d.ongoingBattles, id],
            }))
          }
        />
      </div>

      <label className="block">
        <span className={fieldLabel} style={labelStyle}>A standing goal — one line</span>
        <input
          value={draft.standingGoal}
          onChange={(e) => setDraft((d) => ({ ...d, standingGoal: e.target.value.slice(0, 120) }))}
          placeholder={audience === 'women' ? 'Become a patient mother.' : 'Become a patient father.'}
          className="w-full text-xs rounded-lg px-3 py-2.5 border focus:outline-none"
          style={{ backgroundColor: `${t.border}33`, borderColor: `${t.border}99`, color: t.text }}
        />
      </label>

      <div>
        <span className={fieldLabel} style={labelStyle}>What lifts you — kinds it may go and find</span>
        <ChipRow
          t={t}
          options={TAILOR_SEARCH_KINDS.map((k) => ({ id: k, label: TAILOR_SEARCH_KIND_LABELS[k] }))}
          isOn={(id) => draft.mediaPrefs.includes(id as TailorSearchKind)}
          onToggle={(id) =>
            setDraft((d) => ({
              ...d,
              mediaPrefs: d.mediaPrefs.includes(id as TailorSearchKind)
                ? d.mediaPrefs.filter((k) => k !== id)
                : [...d.mediaPrefs, id as TailorSearchKind],
            }))
          }
        />
      </div>

      <div>
        <span className={fieldLabel} style={labelStyle}>Usually, from God you want</span>
        <ChipRow
          t={t}
          options={TAILOR_TONES}
          isOn={(id) => draft.defaultTone === id}
          onToggle={(id) =>
            setDraft((d) => ({ ...d, defaultTone: d.defaultTone === id ? null : (id as TailorTone) }))
          }
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => {
            saveTailorProfile(audience, draft);
            onSaved(draft);
            setSavedNote(true);
            setConfirmingErase(false);
          }}
          className="flex-1 px-3 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-wide transition-all active:scale-[0.98]"
          style={{ backgroundColor: t.accentRgba(0.14), borderColor: t.accent, color: t.accent }}
        >
          {savedNote ? 'Saved — kept on this device' : 'Save profile'}
        </button>
        {hasAnything && (
          <button
            onClick={() => {
              if (!confirmingErase) {
                setConfirmingErase(true);
                return;
              }
              eraseTailorProfile(audience);
              setDraft({ ...EMPTY_TAILOR_PROFILE });
              onSaved({ ...EMPTY_TAILOR_PROFILE });
              setConfirmingErase(false);
              setSavedNote(false);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-wide transition-all active:scale-[0.98]"
            style={{
              backgroundColor: `${t.border}33`,
              borderColor: confirmingErase ? t.accent : `${t.border}99`,
              color: confirmingErase ? t.accent : t.textMuted,
            }}
          >
            <Eraser className="w-3 h-3" />
            {confirmingErase ? 'Tap again to erase' : 'Erase profile'}
          </button>
        )}
      </div>
      <p className="text-[10px] leading-relaxed" style={{ color: t.textDim }}>
        Kept on this device only — never on a server. It stays until you change it, erase it,
        or clear the app&rsquo;s data.
      </p>
    </div>
  );
}

/**
 * Tailor Today — the personalized devotional (Nov 12, 2026). The free Listen
 * above is the Church's morning, the same for everyone; this is YOUR morning:
 * the same readings, entire and verbatim, one passage chosen for your stated
 * need, the reflection and challenge re-aimed at the morning you described,
 * and the day's narrator reading it. There is no companion lens — companions
 * are text-only and live in their chats (Erik, Nov 12, 2026). The build
 * happens on the server in memory and is never stored there — the result
 * lives on this device only (see lib/tailor).
 */
export function TailorToday({ t, audience, dateKey, startOpen = false }: TailorTodayProps) {
  const offered = tailorOffered();

  const [view, setView] = useState<'idle' | 'form' | 'building' | 'done' | 'error'>(startOpen ? 'form' : 'idle');
  const [devotional, setDevotional] = useState<TailoredDevotional | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [state, setState] = useState<TailorState>('steady');
  const [focus, setFocus] = useState<TailorFocus>('today');
  const [tone, setTone] = useState<TailorTone>('comfort');
  const [freeText, setFreeText] = useState('');

  // The standing profile: loaded once per track, its defaults lean the
  // morning's opening answers, and its snapshot rides with the build. The
  // prefill happens once — the morning's own taps are never overridden.
  const [profile, setProfile] = useState<TailorProfile>(() => loadTailorProfile(audience));
  const [profileOpen, setProfileOpen] = useState(false);
  const prefilledFor = useRef<Audience | null>(null);
  useEffect(() => {
    const loaded = loadTailorProfile(audience);
    setProfile(loaded);
    if (prefilledFor.current !== audience) {
      prefilledFor.current = audience;
      const defaults = profileDefaults(loaded);
      if (defaults.state) setState(defaults.state);
      if (defaults.focus) setFocus(defaults.focus);
      if (loaded.defaultTone) setTone(loaded.defaultTone);
    }
  }, [audience]);

  // The build's staged progress — client-side rotation over honest stages.
  const [progressIdx, setProgressIdx] = useState(0);
  useEffect(() => {
    if (view !== 'building') return;
    setProgressIdx(0);
    const lines = tailorProgressLines(focus);
    const id = setInterval(() => {
      setProgressIdx((i) => Math.min(i + 1, lines.length - 1));
    }, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // If today's build already exists on this device, the card offers it back —
  // playing it again never touches the server.
  useEffect(() => {
    let active = true;
    void (async () => {
      const existing = await loadTodaysTailored(dateKey, audience);
      if (active && existing) {
        setDevotional(existing);
        setView('done');
      }
    })();
    return () => {
      active = false;
    };
  }, [dateKey, audience]);

  // The completed build's two shareable pieces — the supplement passage and
  // the word from the tradition — are copied to the share shelf's on-device
  // store, so the Gospel card can offer them without reopening this cache.
  // Only those pieces are copied (see lib/tailorShare); the morning's intake
  // never leaves this component.
  useEffect(() => {
    if (!devotional) return;
    writeTailorShare(dateKey, audience, shareEntryFromDevotional(devotional));
  }, [devotional, dateKey, audience]);

  // ── Playback (a plain single stream — the tailored render is one file) ──
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!devotional) return;
    const url = tailorAudioUrl(devotional);
    urlRef.current = url;
    const el = new Audio(url);
    audioRef.current = el;
    const onTime = () => setElapsed(el.currentTime);
    const onMeta = () => setDuration(Number.isFinite(el.duration) ? el.duration : devotional.audioSeconds);
    const onEnd = () => setPlaying(false);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('ended', onEnd);
    setElapsed(0);
    setPlaying(false);
    return () => {
      el.pause();
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('ended', onEnd);
      URL.revokeObjectURL(url);
      if (urlRef.current === url) urlRef.current = null;
    };
  }, [devotional]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  const restart = () => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = 0;
    void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  const build = async () => {
    const intake: TailorIntake = {
      state,
      focus,
      tone,
      freeText: freeText.trim(),
      profile: profileForRequest(audience, profile),
    };
    setView('building');
    setError(null);
    try {
      const { devotional: built } = await getOrBuildTailored(dateKey, audience, intake);
      setDevotional(built);
      setView('done');
    } catch {
      // A calm line, here only — the free devotional above is never touched.
      setError('The tailored devotional could not be built just now. Everything above still stands.');
      setView('error');
    }
  };

  if (!offered) return null;

  const selectStyle: React.CSSProperties = {
    backgroundColor: `${t.border}33`,
    borderColor: `${t.border}99`,
    color: t.text,
  };

  return (
    <div className="mt-3 pt-3 border-t" style={{ borderColor: `${t.border}66` }}>
      {view === 'idle' && (
        <button
          onClick={() => setView('form')}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border transition-all active:scale-[0.98]"
          style={{ backgroundColor: `${t.border}33`, borderColor: `${t.border}99`, color: t.textMuted }}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-wide">Tailor today</span>
        </button>
      )}

      {(view === 'form' || view === 'error') && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: t.textDim }}>
              Tailor today
            </p>
            <button
              onClick={() => setView(devotional ? 'done' : 'idle')}
              aria-label="Close"
              className="transition-opacity hover:opacity-70"
              style={{ color: t.textDim }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[11px] leading-relaxed mb-3" style={{ color: t.textMuted }}>
            Say how this morning is, and today&rsquo;s devotional is re-aimed at it — the same
            readings, a passage for your need, a word from the tradition, and the day&rsquo;s
            narrator reading it for you. What you write for a morning is never stored on a
            server; the devotional lives on this device only.
          </p>

          <label className="block mb-2.5">
            <span className="block text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: t.textDim }}>
              How are you coming in?
            </span>
            <select
              value={state}
              onChange={(e) => setState(e.target.value as TailorState)}
              className="w-full text-xs rounded-lg px-3 py-2.5 border focus:outline-none"
              style={selectStyle}
            >
              {TAILOR_STATES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>

          <label className="block mb-2.5">
            <span className="block text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: t.textDim }}>
              What&rsquo;s today about?
            </span>
            <select
              value={focus}
              onChange={(e) => setFocus(e.target.value as TailorFocus)}
              className="w-full text-xs rounded-lg px-3 py-2.5 border focus:outline-none"
              style={selectStyle}
            >
              {TAILOR_FOCUSES.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </label>

          <label className="block mb-2.5">
            <span className="block text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: t.textDim }}>
              What do you want from God today?
            </span>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as TailorTone)}
              className="w-full text-xs rounded-lg px-3 py-2.5 border focus:outline-none"
              style={selectStyle}
            >
              {TAILOR_TONES.map((tn) => (
                <option key={tn.id} value={tn.id}>{tn.label}</option>
              ))}
            </select>
          </label>

          <label className="block mb-2.5">
            <span className="block text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: t.textDim }}>
              In your own words <span className="normal-case tracking-normal font-medium">(optional)</span>
            </span>
            <input
              value={freeText}
              onChange={(e) => setFreeText(e.target.value.slice(0, 200))}
              placeholder="Big review at 2. Feeling behind."
              className="w-full text-xs rounded-lg px-3 py-2.5 border focus:outline-none"
              style={selectStyle}
            />
          </label>

          {/* The standing profile — collapsed until wanted; it leans every
              morning without being asked again, and it lives here, on the
              device, under the user's own hand. */}
          <div className="mb-3 rounded-lg border px-3 py-2.5" style={{ borderColor: `${t.border}66` }}>
            <button
              onClick={() => setProfileOpen((o) => !o)}
              aria-expanded={profileOpen}
              className="w-full flex items-center justify-between transition-opacity hover:opacity-70"
            >
              <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color: t.textDim }}>
                Your standing profile
              </span>
              <span className="text-[10px]" style={{ color: t.textDim }}>
                {profileOpen ? 'Close' : profileForRequest(audience, profile) ? 'Set — edit' : 'Not set'}
              </span>
            </button>
            {profileOpen && (
              <div className="pt-3 animate-fade-in">
                <TailorProfileEditor t={t} audience={audience} onSaved={setProfile} />
              </div>
            )}
          </div>

          {view === 'error' && error && (
            <p className="text-[11px] leading-relaxed mb-3" style={{ color: t.textMuted }}>{error}</p>
          )}

          <button
            onClick={build}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all active:scale-[0.98]"
            style={{ backgroundColor: t.accentRgba(0.14), borderColor: t.accent, color: t.accent }}
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wide">Build my devotional</span>
          </button>
        </div>
      )}

      {view === 'building' && (
        <div className="flex items-center justify-center gap-2 py-4" style={{ color: t.textDim }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-[11px]">{tailorProgressLines(focus)[progressIdx]}</span>
        </div>
      )}

      {view === 'done' && devotional && (
        <div className="animate-fade-in">
          <p className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: t.textDim }}>
            Your tailored devotional
          </p>
          <p className="text-[11px] font-medium mb-3" style={{ color: t.accent }}>
            {tailorCreditLine(devotional)}
          </p>

          {/* The play bar — distinct from the free Listen above it. */}
          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl border mb-3"
            style={{ backgroundColor: t.accentRgba(0.08), borderColor: t.accentRgba(0.3) }}
          >
            <button
              onClick={togglePlay}
              aria-label={playing ? 'Pause your tailored devotional' : 'Play your tailored devotional'}
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
              style={{ backgroundColor: t.accent, color: '#ffffff' }}
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${t.border}80` }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    backgroundColor: t.accent,
                    width: duration > 0 ? `${Math.min(100, (elapsed / duration) * 100)}%` : '0%',
                  }}
                />
              </div>
              <p className="text-[10px] mt-1" style={{ color: t.textDim }}>
                {fmt(elapsed)} / {fmt(duration || devotional.audioSeconds)}
              </p>
            </div>
            <button
              onClick={restart}
              aria-label="Restart"
              className="transition-opacity hover:opacity-70 flex-shrink-0"
              style={{ color: t.textDim }}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 mb-3">
            <div className="flex items-start gap-2.5">
              <BookOpen className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: t.accent, opacity: 0.7 }} />
              <div>
                <p className="text-[9px] uppercase tracking-widest font-bold mb-0.5" style={{ color: t.textDim }}>
                  A word for today · {devotional.passage.citation}
                </p>
                <p className="text-xs leading-relaxed italic" style={{ color: t.textMuted }}>
                  {devotional.passage.text}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: t.accent, opacity: 0.7 }} />
              <div>
                <p className="text-[9px] uppercase tracking-widest font-bold mb-0.5" style={{ color: t.textDim }}>
                  Reflect · tailored for you
                </p>
                <p className="text-xs leading-relaxed" style={{ color: t.textMuted }}>{devotional.reflect}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Target className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: t.accent, opacity: 0.7 }} />
              <div>
                <p className="text-[9px] uppercase tracking-widest font-bold mb-0.5" style={{ color: t.textDim }}>
                  Challenge · tailored for you
                </p>
                <p className="text-xs leading-relaxed" style={{ color: t.text }}>{devotional.challenge}</p>
              </div>
            </div>
            {devotional.traditionQuote && (
              <div className="flex items-start gap-2.5">
                <Quote className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: t.accent, opacity: 0.7 }} />
                <div>
                  <p className="text-[9px] uppercase tracking-widest font-bold mb-0.5" style={{ color: t.textDim }}>
                    A word from the tradition · {devotional.traditionQuote.author}
                  </p>
                  <p className="text-xs leading-relaxed italic" style={{ color: t.textMuted }}>
                    &ldquo;{devotional.traditionQuote.text}&rdquo;
                  </p>
                </div>
              </div>
            )}
          </div>

          <a
            href={devotional.media.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all active:scale-[0.98] mb-2"
            style={{ backgroundColor: `${t.border}33`, borderColor: `${t.border}99` }}
          >
            {devotional.media.kind === 'film' ? (
              <Clapperboard className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} />
            ) : devotional.media.kind === 'podcast' ? (
              <Headphones className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} />
            ) : devotional.media.kind === 'talk' ? (
              <Mic className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} />
            ) : devotional.media.kind === 'video' ? (
              <Video className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} />
            ) : devotional.media.kind === 'article' ? (
              <Newspaper className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} />
            ) : devotional.media.kind === 'book' ? (
              <BookOpen className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} />
            ) : (
              <Music className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} />
            )}
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-medium truncate" style={{ color: t.text }}>
                {devotional.media.title}
              </span>
              <span className="block text-[10px]" style={{ color: t.textDim }}>
                {MEDIA_KIND_LABELS[devotional.media.kind]} · {devotional.media.creator} · {mediaActionLabel(devotional.media)}
              </span>
              {devotional.media.why && (
                <span className="block text-[10px] italic" style={{ color: t.textDim }}>
                  {devotional.media.why}
                </span>
              )}
            </span>
          </a>

          <button
            onClick={() => setView('form')}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-opacity hover:opacity-70"
            style={{ color: t.textDim }}
          >
            <RefreshCw className="w-3 h-3" />
            Rebuild for a different morning
          </button>
        </div>
      )}
    </div>
  );
}
