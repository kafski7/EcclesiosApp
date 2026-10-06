import type { ReadUrl } from "@ecclesios/shared";
import { ArrowLeft, ChevronLeft, ChevronRight, Minus, Moon, Plus, Sun } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { EpubView } from "@/components/books/epub-view";
import { ApiClientError } from "@/lib/api";
import { readUrl, saveProgress, throttleLatest } from "@/lib/books";

/**
 * Reader (D-036): EPUB with pages, font size, night mode and resume; PDF in the browser viewer.
 * Light copy protection only — no download button, short-lived links, the buyer's name on the page.
 */
export function BookReaderPage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const preview = params.get("preview") === "1";
  const [r, setR] = useState<ReadUrl | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [font, setFont] = useState(() => Number(localStorage.getItem("ecclesios.reader.font")) || 100);
  const [night, setNight] = useState(() => localStorage.getItem("ecclesios.reader.night") === "1");
  const [percent, setPercent] = useState(0);
  const nav = useRef<{ next: () => void; prev: () => void } | null>(null);

  useEffect(() => {
    if (!slug) return;
    readUrl(slug, preview)
      .then((x) => {
        setR(x);
        setPercent(x.progress.percent);
      })
      .catch((e) => setError(e instanceof ApiClientError ? e.message : "This book could not be opened."));
  }, [slug, preview]);

  useEffect(() => localStorage.setItem("ecclesios.reader.font", String(font)), [font]);
  useEffect(() => localStorage.setItem("ecclesios.reader.night", night ? "1" : "0"), [night]);

  const save = useMemo(() => throttleLatest((cfi: string, pct: number) => slug && !preview && void saveProgress(slug, cfi, pct).catch(() => {}), 4000), [slug, preview]);
  useEffect(() => () => save.flush(), [save]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") nav.current?.next();
      if (e.key === "ArrowLeft") nav.current?.prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={`reader${night ? " reader-night" : ""}`} onContextMenu={(e) => e.preventDefault()}>
      <div className="reader-bar">
        <Link to={`/books/${slug}`} className="icon-btn" aria-label="Back to the book">
          <ArrowLeft className="ic" />
        </Link>
        <span className="small muted flex-1">{preview ? "Sample" : r?.format === "EPUB" ? `${percent}%` : ""}</span>
        {r?.format === "EPUB" ? (
          <>
            <button type="button" className="icon-btn" onClick={() => setFont((f) => Math.max(80, f - 10))} aria-label="Smaller text">
              <Minus className="ic" />
            </button>
            <button type="button" className="icon-btn" onClick={() => setFont((f) => Math.min(180, f + 10))} aria-label="Larger text">
              <Plus className="ic" />
            </button>
            <button type="button" className="icon-btn" onClick={() => setNight((n) => !n)} aria-label={night ? "Day mode" : "Night mode"}>
              {night ? <Sun className="ic" /> : <Moon className="ic" />}
            </button>
          </>
        ) : null}
      </div>

      {error ? <p className="card rail-card m-4">{error}</p> : null}
      {!r && !error ? <p className="muted small m-4">Opening…</p> : null}
      {r ? (
        <div className="reader-page">
          {r.format === "EPUB" ? (
            <>
              <button type="button" className="reader-turn left" onClick={() => nav.current?.prev()} aria-label="Previous page">
                <ChevronLeft className="ic" />
              </button>
              <EpubView
                url={r.url}
                start={r.progress.locator}
                fontPercent={font}
                night={night}
                onReady={(api) => (nav.current = api)}
                onMove={(cfi, pct) => {
                  setPercent(pct);
                  save(cfi, pct);
                }}
                onError={setError}
              />
              <button type="button" className="reader-turn right" onClick={() => nav.current?.next()} aria-label="Next page">
                <ChevronRight className="ic" />
              </button>
            </>
          ) : (
            // Browser PDF viewer with its toolbar hidden. Page tracking for PDFs comes with pdf.js (todo).
            <iframe className="pdf-frame" src={`${r.url}#toolbar=0&navpanes=0`} title="Book" />
          )}
          {r.watermark ? (
            <div className="reader-watermark" aria-hidden>
              {Array.from({ length: 12 }, (_, i) => (
                <span key={i}>{r.watermark}</span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
