import { useState, useCallback, useEffect } from 'react';
import { Flame, ChevronRight, Check } from 'lucide-react';
import { PRINT_CHOSEN_FILL_ALPHA, PRINT_PLATE_CLASS, PRINT_SERIF, PRINT_STAMP_CLASS } from '@/lib/print';
import { recordCoreAct } from '@/lib/daysPrayed';
import { formatKeepsakeRange, listKeepsakes, recordKeepsake, type Keepsake } from '@/lib/keepsakes';
import {
  clearBridgeSeen,
  loadBridgeSeen,
  markBridgeSeen,
  novenaBridgeState,
  type NovenaBridgeState,
} from '@/lib/novenaBridge';
import type { Audience, PersonaTheme } from '@/types';
import { PRAYERS } from '@/data/prayers';
import {
  NOVENAS,
  novenasForTrack,
  novenaDay,
  novenaComplete,
  emptyNovenaState,
  type Novena,
  type NovenaId,
  type NovenaState,
} from '@/data/novenas';

interface NovenasProps {
  t: PersonaTheme;
  audience: Audience;
}

/**
 * The novenas (Pocket Church build, Erik's approval, Nov 14, 2026). Three
 * novenas in their traditional forms; the same prayers each day, and a
 * day marker that carries the progress. All state is on this device only:
 * `sanctum_novena_<id>` holds { startedISO, prayedDates } and
 * `sanctum_novena_<id>_intention` the intention in the pray-er's own words
 * — both under the sanctum_ prefix, so the panic wipe takes them with
 * everything else. Beginning is the first mark: the day a man first taps
 * "Mark today as prayed" is day one, and its date stamps the record.
 *
 * Completion (Play 5(a), Nov 16, 2026): the ninth day is met once with a
 * thanksgiving bridge (src/lib/novenaBridge.ts) that names the intention
 * back and turns outward — another novena, this one again for someone
 * else, or rest. The finished run is kept as a keepsake
 * (src/lib/keepsakes.ts) on the quiet Completed shelf below, and after
 * the bridge has been met the novena simply stands complete. Nothing
 * here can be lost or expire, and a missed day still changes nothing:
 * the count is the prayed dates, as it always was.
 */

const stateKey = (id: NovenaId) => `sanctum_novena_${id}`;
const intentionKey = (id: NovenaId) => `sanctum_novena_${id}_intention`;

function todayISO(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

function loadState(id: NovenaId): NovenaState {
  try {
    const raw = localStorage.getItem(stateKey(id));
    if (!raw) return emptyNovenaState();
    const parsed = JSON.parse(raw) as Partial<NovenaState>;
    return {
      startedISO: typeof parsed.startedISO === 'string' ? parsed.startedISO : '',
      prayedDates: Array.isArray(parsed.prayedDates) ? parsed.prayedDates.filter((d) => typeof d === 'string') : [],
    };
  } catch {
    return emptyNovenaState();
  }
}

function saveState(id: NovenaId, state: NovenaState) {
  try {
    localStorage.setItem(stateKey(id), JSON.stringify(state));
  } catch {
    // ignore
  }
}

function clearState(id: NovenaId) {
  try {
    localStorage.removeItem(stateKey(id));
  } catch {
    // ignore
  }
}

function loadIntention(id: NovenaId): string {
  try {
    return localStorage.getItem(intentionKey(id)) ?? '';
  } catch {
    return '';
  }
}

function saveIntention(id: NovenaId, text: string) {
  try {
    if (text.trim()) localStorage.setItem(intentionKey(id), text.trim());
    else localStorage.removeItem(intentionKey(id));
  } catch {
    // ignore
  }
}

function clearIntention(id: NovenaId) {
  try {
    localStorage.removeItem(intentionKey(id));
  } catch {
    // ignore
  }
}

function statusLine(state: NovenaState, today: string): string {
  if (novenaComplete(state)) return 'Novena complete';
  if (state.prayedDates.length === 0) return 'Not begun';
  const base = `${state.prayedDates.length} of 9 days prayed`;
  return state.prayedDates.includes(today) ? `${base} · today` : base;
}

export function Novenas({ t, audience }: NovenasProps) {
  const novenas = novenasForTrack(audience);
  const today = todayISO();
  const [selectedId, setSelectedId] = useState<NovenaId | null>(null);
  const [states, setStates] = useState<Record<NovenaId, NovenaState>>(() => ({
    'st-joseph': loadState('st-joseph'),
    'mary-undoer-of-knots': loadState('mary-undoer-of-knots'),
    'st-jude': loadState('st-jude'),
  }));
  const [keepsakes, setKeepsakes] = useState<Keepsake[]>(() => listKeepsakes());
  const [bridgeSeen, setBridgeSeen] = useState<Record<NovenaId, string | null>>(() => ({
    'st-joseph': loadBridgeSeen('st-joseph'),
    'mary-undoer-of-knots': loadBridgeSeen('mary-undoer-of-knots'),
    'st-jude': loadBridgeSeen('st-jude'),
  }));

  const markToday = useCallback(
    (id: NovenaId) => {
      setStates((prev) => {
        const state = prev[id];
        if (novenaComplete(state) || state.prayedDates.includes(today)) return prev;
        const next: NovenaState = {
          startedISO: state.startedISO || today,
          prayedDates: [...state.prayedDates, today],
        };
        saveState(id, next);
        recordCoreAct('pray');
        return { ...prev, [id]: next };
      });
    },
    [today],
  );

  // A completed run is kept exactly once (recordKeepsake is idempotent
  // per run), whether it finished just now or before keepsakes existed.
  useEffect(() => {
    if (!selectedId) return;
    const state = states[selectedId];
    if (!novenaComplete(state)) return;
    const novena = NOVENAS.find((n) => n.id === selectedId);
    if (!novena) return;
    const next = recordKeepsake({
      arcId: selectedId,
      arcName: novena.title,
      intention: loadIntention(selectedId),
      startedISO: state.startedISO,
      completedISO: state.prayedDates[state.prayedDates.length - 1] ?? today,
    });
    setKeepsakes((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [selectedId, states, today]);

  const dismissBridge = useCallback(
    (id: NovenaId) => {
      markBridgeSeen(id, states[id].startedISO);
      setBridgeSeen((prev) => ({ ...prev, [id]: states[id].startedISO }));
    },
    [states],
  );

  const beginAgain = useCallback((id: NovenaId) => {
    clearState(id);
    clearBridgeSeen(id);
    setBridgeSeen((prev) => ({ ...prev, [id]: null }));
    setStates((prev) => ({ ...prev, [id]: emptyNovenaState() }));
  }, []);

  /** Pray this one again, for someone else: the run resets and the old intention goes with it — the keepsake already keeps it. */
  const prayAgainForAnother = useCallback(
    (id: NovenaId) => {
      beginAgain(id);
      clearIntention(id);
    },
    [beginAgain],
  );

  const selected = novenas.find((n) => n.id === selectedId) ?? null;

  return (
    <div className="px-1 pt-4" style={{ borderTop: `3px double ${t.border}`, fontFamily: PRINT_SERIF }}>
      <div className="flex items-center gap-2 mb-3">
        <Flame className="w-4 h-4" style={{ color: t.accent }} />
        <h3 className={PRINT_STAMP_CLASS} style={{ color: t.accent }}>Novenas</h3>
      </div>

      {selected === null ? (
        <div className="space-y-2">
          <p className="text-[13px] leading-relaxed mb-3" style={{ color: t.textDim }}>
            Nine days of the same prayer, for one intention. Your days and your intention stay on this device.
          </p>
          {novenas.map((novena) => (
            <button
              key={novena.id}
              onClick={() => setSelectedId(novena.id)}
              className={PRINT_PLATE_CLASS}
              style={{ border: `1px solid ${t.border}`, backgroundColor: `${t.border}1F` }}
            >
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-semibold" style={{ color: t.text }}>
                  {novena.title}
                </span>
                <span className="block text-[12px] leading-snug mt-0.5" style={{ color: t.textMuted }}>
                  {novena.patronage}
                </span>
                <span className="block text-[12px] mt-1" style={{ color: t.textDim }}>
                  {statusLine(states[novena.id], today)}
                </span>
              </span>
              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} />
            </button>
          ))}

          {/* The keepsake shelf — a quiet record of finished runs: the
              arc, its dates, and the intention in the pray-er's own
              words. A remembrance, not a tally. */}
          {keepsakes.length > 0 && (
            <div className="mt-6">
              <p className={`${PRINT_STAMP_CLASS} mb-2`} style={{ color: t.accent }}>
                Completed
              </p>
              <div className="space-y-3">
                {keepsakes.map((keepsake) => (
                  <div key={`${keepsake.arcId}-${keepsake.startedISO}`}>
                    <p className="text-xs font-semibold" style={{ color: t.text }}>
                      {keepsake.arcName}
                    </p>
                    <p className="text-[12px] mt-0.5" style={{ color: t.textDim }}>
                      {formatKeepsakeRange(keepsake.startedISO, keepsake.completedISO)}
                    </p>
                    {keepsake.intention && (
                      <p className="text-[12px] italic leading-relaxed mt-0.5" style={{ color: t.textMuted }}>
                        For: {keepsake.intention}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <NovenaLeaf
          key={selected.id}
          novena={selected}
          state={states[selected.id]}
          today={today}
          t={t}
          bridgeState={novenaBridgeState(states[selected.id], bridgeSeen[selected.id])}
          onBack={() => setSelectedId(null)}
          onMark={() => markToday(selected.id)}
          onBeginAgain={() => beginAgain(selected.id)}
          onDismissBridge={() => dismissBridge(selected.id)}
          onBeginAnother={() => {
            dismissBridge(selected.id);
            setSelectedId(null);
          }}
          onPrayAgainForAnother={() => prayAgainForAnother(selected.id)}
        />
      )}
    </div>
  );
}

interface NovenaLeafProps {
  novena: Novena;
  state: NovenaState;
  today: string;
  t: PersonaTheme;
  bridgeState: NovenaBridgeState;
  onBack: () => void;
  onMark: () => void;
  onBeginAgain: () => void;
  onDismissBridge: () => void;
  onBeginAnother: () => void;
  onPrayAgainForAnother: () => void;
}

function NovenaLeaf({
  novena,
  state,
  today,
  t,
  bridgeState,
  onBack,
  onMark,
  onBeginAgain,
  onDismissBridge,
  onBeginAnother,
  onPrayAgainForAnother,
}: NovenaLeafProps) {
  const [intention, setIntention] = useState<string>(() => loadIntention(novena.id));
  const [editingIntention, setEditingIntention] = useState(false);
  const [draft, setDraft] = useState('');

  const complete = novenaComplete(state);
  const showBridge = bridgeState === 'bridge';
  const prayedToday = state.prayedDates.includes(today);

  /** Again, for someone else: the parent resets the run; here the old intention clears and the new one is asked for. */
  const prayAgainForAnother = () => {
    onPrayAgainForAnother();
    setIntention('');
    setDraft('');
    setEditingIntention(true);
  };

  const startEditing = () => {
    setDraft(intention);
    setEditingIntention(true);
  };

  const saveDraft = () => {
    saveIntention(novena.id, draft);
    setIntention(draft.trim());
    setEditingIntention(false);
  };

  return (
    <div className="animate-fade-in">
      <button
        onClick={onBack}
        className="text-[12px] font-bold uppercase tracking-widest mb-3 transition-opacity hover:opacity-70"
        style={{ color: t.textDim }}
      >
        &lsaquo; All novenas
      </button>

      <h4 className="text-base font-semibold leading-snug" style={{ color: t.textBright }}>
        {novena.title}
      </h4>
      <p className="text-[13px] leading-relaxed mt-0.5 mb-3" style={{ color: t.textMuted }}>
        {novena.patronage}
      </p>

      {/* The intention — the pray-er's own words, on this device only. Shown
          at the head of the prayers when one is set, as the form intends:
          the novena is prayed for something, and it is named. */}
      {editingIntention ? (
        <div className="mb-4">
          <label className={`${PRINT_STAMP_CLASS} block mb-1.5`} style={{ color: t.accent }} htmlFor={`intention-${novena.id}`}>
            Your intention
          </label>
          <input
            id={`intention-${novena.id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Kept only on this device"
            className="w-full text-sm px-1 py-2 bg-transparent focus:outline-none"
            style={{ borderBottom: `1px solid ${t.border}`, color: t.text }}
            autoComplete="off"
          />
          <button
            onClick={saveDraft}
            className="mt-2 min-h-[44px] px-4 py-2 text-[12px] font-bold uppercase tracking-widest transition-opacity hover:opacity-80 active:opacity-60"
            style={{ border: `1px solid ${t.accent}`, backgroundColor: `${t.accent}${PRINT_CHOSEN_FILL_ALPHA}`, color: t.accent }}
          >
            Save intention
          </button>
        </div>
      ) : intention ? (
        <div className="flex items-start justify-between gap-2 mb-4">
          <p className="text-xs italic leading-relaxed" style={{ color: t.text }}>
            For: {intention}
          </p>
          <button
            onClick={startEditing}
            className="text-[12px] font-bold uppercase tracking-widest flex-shrink-0 transition-opacity hover:opacity-70"
            style={{ color: t.textDim }}
          >
            Edit
          </button>
        </div>
      ) : (
        <button
          onClick={startEditing}
          className="text-[12px] font-bold uppercase tracking-widest mb-4 transition-opacity hover:opacity-70"
          style={{ color: t.textDim }}
        >
          + Add your intention
        </button>
      )}

      <p className={`${PRINT_STAMP_CLASS} mb-3`} style={{ color: t.accent }}>
        {complete ? 'Novena complete.' : `Day ${novenaDay(state)} of 9`}
      </p>

      {novena.note && (
        <p className="text-[13px] italic leading-relaxed mb-3" style={{ color: t.textDim }}>
          {novena.note}
        </p>
      )}

      {/* The day's prayers — a ruled leaf: each prayer under its stamp,
          hairlines between, the shared prayers prayed from the one shelf. */}
      <div>
        {novena.blocks.map((block, i) => {
          const text = block.text ?? PRAYERS.find((p) => p.title === block.sharedTitle)?.text ?? '';
          return (
            <div
              key={`${block.label}-${i}`}
              className={i > 0 ? 'pt-3 mt-3 border-t' : ''}
              style={i > 0 ? { borderColor: `${t.border}4D` } : undefined}
            >
              <p className={`${PRINT_STAMP_CLASS} mb-1.5`} style={{ color: t.textDim }}>
                {block.label}
              </p>
              <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: t.text }}>
                {text}
              </p>
            </div>
          );
        })}
      </div>

      {showBridge ? (
        /* The Day-10 bridge: thanksgiving first — the intention named
           back — then an outward turn. Three plain choices, nothing to
           share, nothing that can be lost or expire. */
        <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${t.border}` }}>
          <p className={`${PRINT_STAMP_CLASS} mb-2`} style={{ color: t.accent }}>
            In thanksgiving
          </p>
          <p className="text-xs leading-relaxed" style={{ color: t.text }}>
            {intention ? (
              <>
                You prayed these nine days for {intention}. Thanks be to God — the novena is complete, and it is
                kept on the Completed shelf.
              </>
            ) : (
              <>These nine days are prayed, and brought to their end. Thanks be to God — the novena is complete, and it is kept on the Completed shelf.</>
            )}
          </p>
          <div className="space-y-2 mt-4">
            <button
              onClick={onBeginAnother}
              className={PRINT_PLATE_CLASS}
              style={{ border: `1px solid ${t.accent}`, backgroundColor: `${t.accent}${PRINT_CHOSEN_FILL_ALPHA}` }}
            >
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: t.accent }}>
                Begin another novena
              </span>
            </button>
            <button
              onClick={prayAgainForAnother}
              className={PRINT_PLATE_CLASS}
              style={{ border: `1px solid ${t.border}`, backgroundColor: `${t.border}1F` }}
            >
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: t.text }}>
                Pray this one again — for someone else
              </span>
            </button>
            <button
              onClick={onDismissBridge}
              className={PRINT_PLATE_CLASS}
              style={{ border: `1px solid ${t.border}`, backgroundColor: `${t.border}1F` }}
            >
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: t.text }}>
                Rest — just Today for now
              </span>
            </button>
          </div>
        </div>
      ) : complete ? (
        <button
          onClick={onBeginAgain}
          className={`${PRINT_PLATE_CLASS} justify-center mt-5`}
          style={{ border: `1px solid ${t.accent}`, backgroundColor: `${t.accent}${PRINT_CHOSEN_FILL_ALPHA}` }}
        >
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: t.accent }}>
            Begin again
          </span>
        </button>
      ) : (
        <button
          onClick={onMark}
          disabled={prayedToday}
          className={`${PRINT_PLATE_CLASS} justify-center mt-5 disabled:opacity-50`}
          style={{
            border: `1px solid ${prayedToday ? t.border : t.accent}`,
            backgroundColor: prayedToday ? `${t.border}1F` : `${t.accent}${PRINT_CHOSEN_FILL_ALPHA}`,
          }}
        >
          {prayedToday && <Check className="w-4 h-4" style={{ color: t.accent }} />}
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: prayedToday ? t.textDim : t.accent }}>
            {prayedToday ? 'Prayed today' : 'Mark today as prayed'}
          </span>
        </button>
      )}
    </div>
  );
}
