import { useCallback, useState } from 'react';
import { ScrollText, Check, Plus, X, RotateCcw, Pencil } from 'lucide-react';
import type { PersonaTheme } from '@/types';
import {
  loadRule,
  saveRule,
  loadTodayChecks,
  saveTodayChecks,
  practiceFor,
  RULE_GROUPS,
  UNIVERSAL_PRACTICES,
  MAX_RULE_PRACTICES,
  type RuleGroup,
} from '@/lib/ruleOfLife';

interface RuleOfLifeProps {
  t: PersonaTheme;
}

/**
 * The one tool in the Workshop meant for an ordinary day. Everything else there is for trouble —
 * panic, spiral, the walk in the door. A rule of life is the opposite: a few things decided in
 * advance, done in the ordinary morning, and ticked off without ceremony.
 *
 * He picks from a fixed list of practices rather than writing his own. A blank page is where most
 * rules die, and a written-in rule tends to duplicate one already on the list. Choosing is the
 * whole act; the only thing kept is which ones he chose, on his own device.
 */
export function RuleOfLife({ t }: RuleOfLifeProps) {
  const [chosen, setChosen] = useState<string[]>(() => loadRule());
  const [checks, setChecks] = useState<Record<string, boolean>>(() => loadTodayChecks());
  // A man with no rule yet lands straight in the picking state — an empty list is not a tool.
  const [editing, setEditing] = useState(() => loadRule().length === 0);

  const doneCount = chosen.filter((k) => checks[k]).length;
  const allDone = chosen.length > 0 && doneCount === chosen.length;
  const atLimit = chosen.length >= MAX_RULE_PRACTICES;

  const commit = useCallback((next: string[]) => {
    setChosen(next);
    saveRule(next);
  }, []);

  const toggleCheck = useCallback((key: string) => {
    setChecks((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveTodayChecks(next);
      return next;
    });
  }, []);

  const resetToday = useCallback(() => {
    setChecks({});
    saveTodayChecks({});
  }, []);

  const add = useCallback(
    (key: string) => {
      if (chosen.length >= MAX_RULE_PRACTICES || chosen.includes(key)) return;
      commit([...chosen, key]);
    },
    [chosen, commit],
  );

  const remove = useCallback(
    (key: string) => {
      commit(chosen.filter((k) => k !== key));
      setChecks((prev) => {
        const next = { ...prev };
        delete next[key];
        saveTodayChecks(next);
        return next;
      });
    },
    [chosen, commit],
  );

  const available = UNIVERSAL_PRACTICES.filter((p) => !chosen.includes(p.key));

  return (
    <div className="rounded-xl p-4 border" style={{ backgroundColor: t.card, borderColor: `${t.border}66` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ScrollText className="w-4 h-4" style={{ color: t.accent }} />
          <h3
            className="text-sm font-bold font-display uppercase tracking-wide"
            style={{ color: t.textBright }}
          >
            Rule of Life
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {chosen.length > 0 && (
            <button
              onClick={() => setEditing((v) => !v)}
              className="flex items-center gap-1 text-[11px] transition-colors"
              style={{ color: editing ? t.accent : t.textDim }}
            >
              <Pencil className="w-3 h-3" />
              {editing ? 'Done' : 'Edit'}
            </button>
          )}
          {doneCount > 0 && !editing && (
            <button
              onClick={resetToday}
              className="flex items-center gap-1 text-[11px] transition-colors"
              style={{ color: t.textDim }}
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
        </div>
      </div>

      {chosen.length === 0 && (
        <p className="text-xs leading-relaxed mb-4" style={{ color: t.textMuted }}>
          A rule of life is a few things you have decided to do every day, written down so you stop
          deciding them at six in the morning. Pick up to five, from the three parts below. Five you
          actually keep beats twenty you do not.
        </p>
      )}

      {/* Progress — only meaningful once there is a rule to keep */}
      {chosen.length > 0 && !editing && (
        <div className="flex items-center gap-1.5 mb-4">
          {chosen.map((key) => (
            <div
              key={key}
              className="h-1 flex-1 rounded-full transition-all"
              style={{ backgroundColor: checks[key] ? t.accent : `${t.border}66` }}
            />
          ))}
        </div>
      )}

      {/* The rule itself — one tap to tick, each day. Grouped by part even in the kept view, so the
          shape of the rule stays visible: this is toward God, this is the work, this is the people. */}
      {!editing && chosen.length > 0 && (
        <div className="space-y-4">
          {RULE_GROUPS.map((group) => {
            const groupChosen = chosen
              .map((k) => practiceFor(k))
              .filter((p): p is NonNullable<typeof p> => p != null && p.group === group.id);
            if (groupChosen.length === 0) return null;
            return (
              <div key={group.id}>
                <p
                  className="text-[10px] uppercase tracking-widest font-bold mb-2"
                  style={{ color: t.textDim }}
                >
                  {group.label}
                </p>
                <div className="space-y-2">
                  {groupChosen.map((practice) => {
                    const isChecked = checks[practice.key] || false;
                    return (
                      <button
                        key={practice.key}
                        onClick={() => toggleCheck(practice.key)}
                        className="w-full flex items-start gap-3 px-3 py-3 rounded-lg border transition-all text-left active:scale-[0.98]"
                        style={
                          isChecked
                            ? { backgroundColor: t.accentRgba(0.1), borderColor: t.accentRgba(0.3) }
                            : { backgroundColor: `${t.border}40`, borderColor: `${t.border}4D` }
                        }
                      >
                        <div
                          className="w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                          style={
                            isChecked
                              ? { backgroundColor: t.accent, borderColor: t.accent, color: '#ffffff' }
                              : { borderColor: t.borderLight, color: 'transparent' }
                          }
                        >
                          {isChecked && <Check className="w-3 h-3" strokeWidth={3} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-xs font-bold font-display uppercase tracking-wide mb-0.5"
                            style={{
                              color: isChecked ? t.textMuted : t.textBright,
                              textDecoration: isChecked ? 'line-through' : 'none',
                              opacity: isChecked ? 0.6 : 1,
                            }}
                          >
                            {practice.label}
                          </p>
                          <p
                            className="text-[11px] leading-relaxed"
                            style={{ color: t.textDim, opacity: isChecked ? 0.6 : 1 }}
                          >
                            {practice.detail}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Choosing the practices — grouped into the three parts of a rule */}
      {editing && (
        <div className="space-y-5">
          {chosen.length > 0 && (
            <div>
              <p
                className="text-[10px] uppercase tracking-widest font-bold mb-2"
                style={{ color: t.textDim }}
              >
                Your rule
              </p>
              <div className="space-y-2">
                {chosen.map((key) => {
                  const practice = practiceFor(key);
                  if (!practice) return null;
                  return (
                    <div
                      key={key}
                      className="flex items-start gap-3 px-3 py-2.5 rounded-lg border"
                      style={{ backgroundColor: t.accentRgba(0.06), borderColor: t.accentRgba(0.25) }}
                    >
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-xs font-bold font-display uppercase tracking-wide"
                          style={{ color: t.textBright }}
                        >
                          {practice.label}
                        </p>
                        <p className="text-[11px] leading-relaxed" style={{ color: t.textDim }}>
                          {practice.detail}
                        </p>
                      </div>
                      <button
                        onClick={() => remove(key)}
                        aria-label={`Remove ${practice.label}`}
                        className="flex-shrink-0 transition-colors active:scale-90"
                        style={{ color: t.textDim }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {atLimit ? (
            <p className="text-[11px] text-center leading-relaxed pt-1" style={{ color: t.textDim }}>
              Five is the limit. A rule you cannot hold in your head is not a rule — remove one
              before you add another.
            </p>
          ) : (
            <div className="space-y-5">
              {RULE_GROUPS.map((group: { id: RuleGroup; label: string; blurb: string }) => {
                const groupAvailable = available.filter((p) => p.group === group.id);
                if (groupAvailable.length === 0) return null;
                return (
                  <div key={group.id}>
                    <p
                      className="text-[10px] uppercase tracking-widest font-bold mb-0.5"
                      style={{ color: t.accent }}
                    >
                      {group.label}
                    </p>
                    <p className="text-[10px] leading-relaxed mb-2" style={{ color: t.textDim }}>
                      {group.blurb}
                    </p>
                    <div className="space-y-1.5">
                      {groupAvailable.map((practice) => (
                        <button
                          key={practice.key}
                          onClick={() => add(practice.key)}
                          className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all active:scale-[0.98]"
                          style={{ backgroundColor: `${t.border}33`, borderColor: `${t.border}80` }}
                        >
                          <Plus className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: t.accent }} />
                          <span className="flex-1 min-w-0">
                            <span className="block text-xs font-bold" style={{ color: t.textBright }}>
                              {practice.label}
                            </span>
                            <span className="block text-[11px] leading-snug" style={{ color: t.textDim }}>
                              {practice.detail}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {allDone && !editing && (
        <div className="mt-3 text-center text-xs font-medium animate-fade-in" style={{ color: t.accent }}>
          All of it kept today. That is the whole work — done quietly, again and again.
        </div>
      )}

      <p className="text-[11px] text-center leading-relaxed mt-3" style={{ color: t.textDim }}>
        Kept on your device, never sent anywhere. The ticks reset each morning so you start even.
      </p>
    </div>
  );
}
