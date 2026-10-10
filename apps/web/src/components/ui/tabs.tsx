import { useRef, type KeyboardEvent } from "react";

/**
 * Tabs with the WAI-ARIA keyboard pattern (docs/social.md §12, D-044/D-045): ←/→/Home/End move and
 * select, only the selected tab is in the Tab order, each tab controls one panel.
 * Used by Home (For you / Following), Readings and hymn tunes. Styling stays with the caller.
 */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  panelId,
  label,
  barClass = "feed-tabs",
  tabClass = "feed-tab",
}: {
  tabs: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  /** id of the panel element; tabs get ids `${panelId}-tab-${id}`. */
  panelId: string;
  label: string;
  barClass?: string;
  tabClass?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const n = tabs.length;
    const to =
      e.key === "ArrowRight"
        ? (i + 1) % n
        : e.key === "ArrowLeft"
          ? (i - 1 + n) % n
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : null;
    if (to === null) return;
    e.preventDefault();
    onChange(tabs[to]!.id);
    refs.current[to]?.focus();
  };
  return (
    <div className={barClass} role="tablist" aria-label={label}>
      {tabs.map((t, i) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={tabId(panelId, t.id)}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={panelId}
            tabIndex={on ? 0 : -1}
            className={`${tabClass}${on ? " active" : ""}`}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export const tabId = (panelId: string, id: string) => `${panelId}-tab-${id}`;
