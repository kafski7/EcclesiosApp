/**
 * Home right rail scrolls WITH the page and then sticks (docs/social.md §7, D-046) — no inner
 * scroll bar. The rail is `position: sticky`; only its `top` changes as the page scrolls:
 *
 * - scrolling down, the rail moves up with the page until its last card is on screen, then stays;
 * - scrolling up, it moves down with the page until its first card is under the top bar, then stays;
 * - a rail shorter than the screen just stays under the top bar.
 *
 * Pure, so it is unit-tested; the DOM wiring is in components/home/use-sticky-rail.ts.
 */
export interface RailBox {
  /** Space taken by the sticky top bar plus a gap (px). */
  header: number;
  /** Gap kept below the rail's last card (px). */
  bottomGap: number;
  viewport: number;
  railHeight: number;
}

/** Highest (least negative) and lowest `top` the rail may take. */
export function topRange(b: RailBox): { max: number; min: number } {
  const max = b.header;
  const min = Math.min(max, b.viewport - b.railHeight - b.bottomGap);
  return { max, min };
}

/** The rail's `top` after the page scrolls by `delta` px (positive = down). */
export function nextTop(prev: number, delta: number, b: RailBox): number {
  const { max, min } = topRange(b);
  return Math.round(Math.min(max, Math.max(min, prev - delta)));
}
