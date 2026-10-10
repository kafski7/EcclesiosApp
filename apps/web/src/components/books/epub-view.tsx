import ePub from "epubjs";
import { useEffect, useRef } from "react";

type Rendition = ReturnType<ReturnType<typeof ePub>["renderTo"]>;

/**
 * EPUB reader on epub.js (D-036). The book is fetched as bytes (so relative paths inside the EPUB
 * never hit storage directly), paginated, and reports its position as a CFI plus a percentage.
 */
export function EpubView({
  url,
  start,
  fontPercent,
  night,
  onReady,
  onMove,
  onError,
}: {
  url: string;
  start: string | null;
  fontPercent: number;
  night: boolean;
  onReady: (api: { next: () => void; prev: () => void }) => void;
  onMove: (cfi: string, percent: number) => void;
  onError: (message: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const rendition = useRef<Rendition | null>(null);

  useEffect(() => {
    let cancelled = false;
    let book: ReturnType<typeof ePub> | null = null;
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const bytes = await res.arrayBuffer();
        if (cancelled || !host.current) return;
        book = ePub(bytes);
        const r = book.renderTo(host.current, {
          width: "100%",
          height: "100%",
          flow: "paginated",
          spread: "none",
        });
        rendition.current = r;
        r.themes.register("night", { body: { background: "#16130f", color: "#e9e2d4" } });
        r.themes.register("day", { body: { background: "#fffdf8", color: "#2e2c27" } });
        await r.display(start ?? undefined);
        onReady({ next: () => void r.next(), prev: () => void r.prev() });
        await book.ready;
        await book.locations.generate(1600);
        r.on("relocated", (loc: { start: { cfi: string } }) => {
          const pct = book
            ? Math.round((book.locations.percentageFromCfi(loc.start.cfi) || 0) * 100)
            : 0;
          onMove(loc.start.cfi, Math.min(100, Math.max(0, pct)));
        });
      } catch {
        if (!cancelled) onError("This book could not be opened.");
      }
    })();
    return () => {
      cancelled = true;
      book?.destroy();
      rendition.current = null;
    };
    // Load once per URL; callbacks are read at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    rendition.current?.themes.select(night ? "night" : "day");
  }, [night]);
  useEffect(() => {
    rendition.current?.themes.fontSize(`${fontPercent}%`);
  }, [fontPercent]);

  return <div ref={host} className="epub-host" />;
}
