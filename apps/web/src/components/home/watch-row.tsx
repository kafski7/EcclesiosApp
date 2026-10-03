import type { WatchItem } from "@ecclesios/shared";
import { youTubeEmbedUrl, youTubeThumb } from "@ecclesios/shared/domain";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, ExternalLink, Play, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ago } from "@/lib/news";

const KIND_LABEL: Record<WatchItem["kind"], string> = { EPISODE: "Podcast", POST: "Explore", HYMN: "Hymn" };

/**
 * Home "Watch" row (D-034): newest videos in a horizontal, swipeable strip. Tapping a card plays it
 * in a dialog with YouTube's visible player (no audio-only YouTube — D-026) and a link to its page.
 */
export function WatchRow({ items }: { items: readonly WatchItem[] }) {
  const strip = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const [playing, setPlaying] = useState<WatchItem | null>(null);

  const update = useCallback(() => {
    const el = strip.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update, items.length]);

  if (!items.length) return null;
  const page = (dir: 1 | -1) => strip.current?.scrollBy({ left: dir * strip.current.clientWidth * 0.85, behavior: "smooth" });

  return (
    <section className="watch-row" aria-labelledby="watch-title">
      <div className="watch-head">
        <h2 id="watch-title" className="rail-title">
          Watch
        </h2>
        <div className="flex gap-1">
          <button type="button" className="icon-btn" onClick={() => page(-1)} disabled={edges.start} aria-label="Previous videos">
            <ChevronLeft className="ic" />
          </button>
          <button type="button" className="icon-btn" onClick={() => page(1)} disabled={edges.end} aria-label="More videos">
            <ChevronRight className="ic" />
          </button>
        </div>
      </div>
      <ul ref={strip} className="watch-strip" onScroll={update}>
        {items.map((w) => (
          <li key={`${w.kind}:${w.key}`}>
            <button type="button" className="watch-card" onClick={() => setPlaying(w)} aria-label={`Play ${w.title}`}>
              <span className="watch-thumb">
                <img src={youTubeThumb(w.youtubeId)} alt="" loading="lazy" />
                <span className="watch-play" aria-hidden>
                  <Play className="ic" />
                </span>
                <span className="watch-kind">{KIND_LABEL[w.kind]}</span>
              </span>
              <b className="watch-title">{w.title}</b>
              <small className="watch-meta">
                {w.source} · {ago(w.at)}
              </small>
            </button>
          </li>
        ))}
      </ul>

      <Dialog.Root open={!!playing} onOpenChange={(o) => !o && setPlaying(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="watch-overlay" />
          <Dialog.Content className="watch-dialog" aria-describedby={undefined}>
            {playing ? (
              <>
                <div className="yt-frame" style={{ marginTop: 0 }}>
                  <iframe
                    src={`${youTubeEmbedUrl(playing.youtubeId)}?autoplay=1&rel=0`}
                    title={playing.title}
                    allow="autoplay; accelerometer; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div className="flex items-start gap-3 mt-3">
                  <div className="min-w-0 flex-1">
                    <Dialog.Title className="post-title" style={{ margin: 0 }}>
                      {playing.title}
                    </Dialog.Title>
                    <small className="muted">{playing.source}</small>
                  </div>
                  <Link to={playing.href} className="btn btn-outline btn-sm" onClick={() => setPlaying(null)}>
                    Open <ExternalLink className="ic" aria-hidden />
                  </Link>
                  <Dialog.Close className="icon-btn" aria-label="Close">
                    <X className="ic" />
                  </Dialog.Close>
                </div>
              </>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
