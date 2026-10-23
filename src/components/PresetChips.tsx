import type { PresetChip, Persona } from '@/types';

interface PresetChipsProps {
  presets: PresetChip[];
  onSelect: (chip: PresetChip) => void;
  disabled?: boolean;
}

export function PresetChips({ presets, onSelect, disabled }: PresetChipsProps) {
  return (
    <div
      className="px-4 py-2.5 border-b"
      style={{ borderColor: 'color-mix(in srgb, var(--p-border) 30%, transparent)' }}
    >
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {presets.map((chip) => (
          <button
            key={chip.id}
            onClick={() => onSelect(chip)}
            disabled={disabled}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:pointer-events-none border"
            style={{
              backgroundColor: 'var(--p-card)',
              borderColor: 'color-mix(in srgb, var(--p-border) 50%, transparent)',
              color: 'var(--p-text-muted)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--p-accent) 40%, transparent)';
              e.currentTarget.style.color = 'var(--p-text-bright)';
              e.currentTarget.style.backgroundColor = 'var(--p-card-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--p-border) 50%, transparent)';
              e.currentTarget.style.color = 'var(--p-text-muted)';
              e.currentTarget.style.backgroundColor = 'var(--p-card)';
            }}
          >
            <span className="text-sm">{chip.icon}</span>
            <span className="tracking-tight">{chip.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
