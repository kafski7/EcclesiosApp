import { Minus, Plus } from "lucide-react";
import { SCALE_MAX, SCALE_MIN, scalePercent } from "@/lib/reader";
import { useReaderPrefs } from "@/stores/reader";

/**
 * A− / A+ for reading views (docs/social.md §11.2, D-045). One size for every reader;
 * the current size is announced politely and the middle button resets it.
 */
export function TextSize({ className = "" }: { className?: string }) {
  const { scale, bigger, smaller, reset } = useReaderPrefs();
  return (
    <div className={`text-size ${className}`} role="group" aria-label="Text size">
      <button
        type="button"
        className="icon-btn"
        onClick={smaller}
        disabled={scale <= SCALE_MIN}
        aria-label="Smaller text"
      >
        <Minus className="ic" aria-hidden />
      </button>
      <button
        type="button"
        className="text-size-value"
        onClick={reset}
        aria-label={`Text size ${scalePercent(scale)}. Reset`}
        title="Reset text size"
      >
        <span aria-live="polite">{scalePercent(scale)}</span>
      </button>
      <button
        type="button"
        className="icon-btn"
        onClick={bigger}
        disabled={scale >= SCALE_MAX}
        aria-label="Larger text"
      >
        <Plus className="ic" aria-hidden />
      </button>
    </div>
  );
}

/** Style for a reading view's wrapper: sets --read-scale (and the Bible's older --bible-scale). */
export function useReadScale(): Record<string, number> {
  const scale = useReaderPrefs((s) => s.scale);
  return { "--read-scale": scale, "--bible-scale": scale };
}
