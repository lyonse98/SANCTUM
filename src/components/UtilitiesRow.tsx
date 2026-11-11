import {
  Share2,
  MessageSquarePlus,
  Info,
  Bell,
  type LucideIcon,
} from 'lucide-react';
import type { PersonaTheme, UtilityActions } from '@/types';

interface UtilitiesRowProps {
  t: PersonaTheme;
  utilities: UtilityActions;
  className?: string;
}

const ITEMS: { key: keyof UtilityActions; label: string; icon: LucideIcon; hint: string }[] = [
  { key: 'onOpenAbout', label: 'About', icon: Info, hint: 'About Sanctum, and a note for church leaders' },
  { key: 'onShareInvite', label: 'Share', icon: Share2, hint: 'Share Sanctum with a friend' },
  { key: 'onOpenFeedback', label: 'Feedback', icon: MessageSquarePlus, hint: 'Send feedback or report a bug' },
  { key: 'onOpenReminder', label: 'Reminder', icon: Bell, hint: 'A daily notification that opens the part of Sanctum you chose' },
];

/**
 * The four in-the-moment actions that are not destinations, in the same place on every screen
 * of Sanctum: About, Share, Feedback, and the daily reminder. They sit at the foot of each page
 * as an ordinary card, so they are always findable without a second bar stacked on the ribbon —
 * one strip of navigation at the bottom is a pattern people already understand, and two is a
 * puzzle.
 *
 * Settings is no longer one of them. It graduated to a permanent home of its own — the fifth
 * slot of the tab ribbon (the action that lets Today sit dead centre) and the gear in the
 * companion-chat header — so it does not need a third door here. The UtilityActions object still
 * carries onOpenSettings for those two callers; this row simply no longer renders it.
 *
 * Four equal columns, the same width and the same centering as the tab ribbon above them. Every
 * page that holds this row already shares the ribbon's container width, so the two strips line
 * up edge to edge. The labels are set a notch smaller than the ribbon's to keep the longest ones
 * (Reminder, Feedback) whole in a quarter of a phone's width.
 */
export function UtilitiesRow({ t, utilities, className = '' }: UtilitiesRowProps) {
  return (
    <nav aria-label="Sanctum utilities" className={`w-full ${className}`}>
      <div className="grid grid-cols-4 gap-1">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={utilities[item.key]}
              aria-label={item.hint}
              title={item.hint}
              className="flex flex-col items-center gap-1 px-1 py-2.5 rounded-xl border transition-all duration-200 active:scale-95"
              style={{ backgroundColor: t.card, borderColor: `${t.border}99`, color: t.textMuted }}
            >
              <Icon className="w-4 h-4" strokeWidth={1.9} />
              <span className="text-[8px] font-bold uppercase tracking-wide">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
