/**
 * The printed-page format (Stage 1 of the re-skin, Erik, Nov 14, 2026).
 *
 * Sanctum's surfaces are re-set as a book of hours: paper ground, hairline
 * and double rules in place of card boxes and shadows, small-caps labels in
 * the calendar-owned accent, and the serif display voice leading. The serif
 * is the same stack Women's Mode already speaks in (see the
 * [data-audience='women'] .font-display rule in index.css) — Georgia and the
 * system serifs, nothing fetched. In the print surfaces it leads on both
 * tracks; the rest of the app keeps its current skin until Stage 2.
 */
export const PRINT_SERIF = "Georgia, 'Iowan Old Style', 'Times New Roman', serif";

/**
 * The one affordance treatment for tappable entries on the printed page
 * (Erik's revision, Nov 14, 2026). Stage 1 set the doors and the contents
 * rows as bare printed lines with dotted leaders, and they did not read as
 * tappable — a first-time user could not tell they were buttons. So every
 * entry now sits on a ruled plate: a full frame in the day's border tone
 * over a faint paper-shade fill (both supplied inline from the theme,
 * beside this class), a full-width press target at least 48px tall, the
 * name set as a clear action label, a weighted accent chevron at the right
 * edge (rendered by the caller), and an opacity shift under press. Still a
 * contents page — but a contents page whose entries are plainly doors.
 * The two Ways on the Gospel section and the three More of Sanctum rows
 * share this class, so the treatment is one by construction.
 */
export const PRINT_PLATE_CLASS =
  'w-full min-h-[48px] flex items-center gap-2.5 px-3.5 py-3 text-left transition-opacity hover:opacity-80 active:opacity-60';
