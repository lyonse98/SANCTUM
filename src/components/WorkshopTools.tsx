import { useState, useEffect } from 'react';
import {
  Wrench,
  Wind,
  Eye,
  Hand,
  Ear,
  Flame,
  Moon,
  Zap,
  Car,
  WifiOff,
  ScrollText,
  type LucideIcon,
} from 'lucide-react';
import type { Persona, PersonaTheme } from '@/types';
import { LazyColdStart, LazyDriveway } from '@/components/LazyTools';
import { ExamenChecklist } from '@/components/ExamenChecklist';
import { BreathPacer } from '@/components/BreathPacer';
import { RuleOfLife } from '@/components/RuleOfLife';

interface WorkshopToolsProps {
  theme: PersonaTheme;
  initialTool?: string | null;
  onConsumeTool?: () => void;
}

type ToolId = 'cold-start' | 'breathing' | 'grounding' | 'driveway' | 'examen' | 'rule';

interface Tool {
  id: ToolId;
  label: string;
  icon: LucideIcon;
  desc: string;
}

/**
 * The Workshop has two purposes that share a screen but not a mood. The first five tools are for a
 * bad moment — panic, spiral, the walk in the door — and a man in that state should see every one
 * of them at once and need a single tap. The sixth is for an ordinary morning, and it is the only
 * one he can come back to when nothing is wrong.
 *
 * Splitting them into two labelled groups lets the eye sort them automatically, so the screen stops
 * reading as a grid of six equal buttons. Collapsing either group would hurt the acute case — a man
 * in panic cannot be made to expand a menu first — so both stay open.
 */
const HARD_MOMENT: Tool[] = [
  { id: 'cold-start', label: 'Cold Start', icon: Zap, desc: '60-second panic interrupter' },
  { id: 'breathing', label: 'Breathing', icon: Wind, desc: 'Box, sigh, and 4-7-8' },
  { id: 'grounding', label: '5-4-3-2-1', icon: Eye, desc: 'Come back to the room' },
  { id: 'driveway', label: 'Driveway', icon: Car, desc: 'Reset before you walk in' },
];

const ORDINARY_DAY: Tool[] = [
  { id: 'examen', label: 'Examen', icon: Moon, desc: 'Evening review with the Gospel' },
  { id: 'rule', label: 'Rule of Life', icon: ScrollText, desc: 'The few things you do daily' },
];

const ALL_TOOLS = [...HARD_MOMENT, ...ORDINARY_DAY];
const VALID_TOOLS = ALL_TOOLS.map((tool) => tool.id);

export function WorkshopTools({ theme, initialTool, onConsumeTool }: WorkshopToolsProps) {
  const [activeTool, setActiveTool] = useState<ToolId>('breathing');
  const t = theme;

  useEffect(() => {
    if (!initialTool) return;
    if ((VALID_TOOLS as string[]).includes(initialTool)) {
      setActiveTool(initialTool as ToolId);
    }
    onConsumeTool?.();
  }, [initialTool, onConsumeTool]);

  const active = ALL_TOOLS.find((tool) => tool.id === activeTool) ?? ALL_TOOLS[1];

  return (
    <div className="w-full">
      {/* Section header */}
      <div className="flex items-center justify-center gap-3 mb-4">
        <div className="w-8 h-px" style={{ backgroundColor: '#C6BCAB' }} />
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4" style={{ color: '#635C51' }} />
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] font-display" style={{ color: '#635C51' }}>
            Offline Tools
          </span>
        </div>
        <div className="w-8 h-px" style={{ backgroundColor: '#C6BCAB' }} />
      </div>

      {/* Offline badge */}
      <div className="flex justify-center mb-5">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: '#F3EEE7', borderColor: '#DCD3C5', color: '#756D61' }}
        >
          <WifiOff className="w-3 h-3" />
          100% On-Device — Works Offline
        </span>
      </div>

      {/* For a hard moment */}
      <SectionLabel t={t}>For a hard moment</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
        {HARD_MOMENT.map((tool) => (
          <ToolButton key={tool.id} tool={tool} active={activeTool === tool.id} t={t} onSelect={setActiveTool} />
        ))}
      </div>

      {/* For the ordinary day */}
      <SectionLabel t={t}>For the ordinary day</SectionLabel>
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        {ORDINARY_DAY.map((tool) => (
          <ToolButton key={tool.id} tool={tool} active={activeTool === tool.id} t={t} onSelect={setActiveTool} />
        ))}
      </div>

      {/* Active tool */}
      <div
        key={active.id}
        className="rounded-xl border p-4 animate-fade-in"
        style={{ backgroundColor: '#FBF8F3', borderColor: '#DCD3C5' }}
      >
        {active.id === 'cold-start' && <LazyColdStart t={t} />}
        {active.id === 'breathing' && <BreathPacer t={t} />}
        {active.id === 'grounding' && <SensoryChecklist t={t} />}
        {active.id === 'driveway' && <LazyDriveway t={t} />}
        {active.id === 'examen' && <ExamenChecklist t={t} />}
        {active.id === 'rule' && <RuleOfLife t={t} />}
      </div>
    </div>
  );
}

function SectionLabel({ t, children }: { t: PersonaTheme; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-2.5">
      <span
        className="text-[10px] font-bold uppercase tracking-[0.18em] font-display"
        style={{ color: t.textDim }}
      >
        {children}
      </span>
      <span className="flex-1 h-px" style={{ backgroundColor: `${t.border}66` }} />
    </div>
  );
}

function ToolButton({
  tool,
  active,
  t,
  onSelect,
}: {
  tool: Tool;
  active: boolean;
  t: PersonaTheme;
  onSelect: (id: ToolId) => void;
}) {
  const Icon = tool.icon;
  return (
    <button
      onClick={() => onSelect(tool.id)}
      className="rounded-xl p-3 border text-center transition-all duration-200 active:scale-95"
      style={{
        backgroundColor: active ? t.accentRgba(0.08) : '#F5F1EA',
        borderColor: active ? t.accentRgba(0.35) : '#DCD3C5',
      }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2 border transition-colors"
        style={{
          backgroundColor: active ? t.accentRgba(0.12) : '#FFFFFF',
          borderColor: active ? t.accentRgba(0.3) : '#DCD3C5',
        }}
      >
        <Icon className="w-5 h-5" strokeWidth={active ? 2.3 : 2} style={{ color: active ? t.accent : '#635C51' }} />
      </div>
      <p
        className="text-[11px] font-bold font-display uppercase tracking-wide mb-0.5"
        style={{ color: active ? t.textBright : '#3A352E' }}
      >
        {tool.label}
      </p>
      <p className="text-[9px] leading-tight" style={{ color: '#756D61' }}>
        {tool.desc}
      </p>
    </button>
  );
}

// ─── 5-4-3-2-1 SENSORY CHECKLIST ─────────────────────────────

interface SensoryItem {
  id: string;
  label: string;
  count: number;
  icon: React.ReactNode;
  placeholder: string;
}

const SENSORY_ITEMS: SensoryItem[] = [
  { id: 'see', label: 'See', count: 5, icon: <Eye className="w-3.5 h-3.5" />, placeholder: '5 things you can see' },
  { id: 'feel', label: 'Feel', count: 4, icon: <Hand className="w-3.5 h-3.5" />, placeholder: '4 things you can feel' },
  { id: 'hear', label: 'Hear', count: 3, icon: <Ear className="w-3.5 h-3.5" />, placeholder: '3 things you can hear' },
  { id: 'smell', label: 'Smell', count: 2, icon: <Flame className="w-3.5 h-3.5" />, placeholder: '2 things you can smell' },
  { id: 'breathe', label: 'Deep Breath', count: 1, icon: <Wind className="w-3.5 h-3.5" />, placeholder: '1 slow, deep breath' },
];

function SensoryChecklist({ t }: { t: PersonaTheme }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  const reset = () => setChecked({});
  const completedCount = Object.values(checked).filter(Boolean).length;
  const allDone = completedCount === SENSORY_ITEMS.length;

  return (
    <div className="rounded-xl p-4 border" style={{ backgroundColor: t.card, borderColor: `${t.border}66` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4" style={{ color: t.accent }} />
          <span className="text-sm font-bold font-display uppercase tracking-wide" style={{ color: t.textBright }}>5-4-3-2-1 Grounding</span>
        </div>
        {completedCount > 0 && <button onClick={reset} className="text-[11px] transition-colors" style={{ color: t.textDim }}>Reset</button>}
      </div>
      <div className="space-y-1.5">
        {SENSORY_ITEMS.map((item) => {
          const isChecked = checked[item.id] || false;
          return (
            <button key={item.id} onClick={() => toggle(item.id)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all active:scale-[0.98]"
              style={isChecked ? { backgroundColor: t.accentRgba(0.1), borderColor: t.accentRgba(0.3) } : { backgroundColor: `${t.border}66`, borderColor: `${t.border}4D` }}>
              <div className="w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all"
                style={isChecked ? { backgroundColor: t.accent, borderColor: t.accent, color: '#ffffff' } : { borderColor: t.borderLight, color: 'transparent' }}>
                {isChecked && <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </div>
              <span className="flex-shrink-0" style={{ color: t.accent, opacity: isChecked ? 1 : 0.6 }}>{item.icon}</span>
              <span className="text-xs font-medium flex-1 text-left" style={isChecked ? { color: t.text, textDecoration: 'line-through', opacity: 0.5 } : { color: t.textMuted }}>{item.placeholder}</span>
            </button>
          );
        })}
      </div>
      {allDone && <div className="mt-3 text-center text-xs font-medium animate-fade-in" style={{ color: t.accent }}>Steady. You're back in the room. Now handle the one thing in front of you.</div>}
      <p className="text-[11px] text-center leading-relaxed mt-3" style={{ color: t.textDim }}>Name what your senses pick up. Pulls the mind out of the spiral and back into the body.</p>
    </div>
  );
}
