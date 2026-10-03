import type { HymnMedia, HymnTune } from "@ecclesios/shared";
import { youTubeEmbedUrl } from "@ecclesios/shared/domain";
import { ArrowLeft, Download, FileText, Headphones, Lock, Music, Play, Youtube } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiClientError } from "@/lib/api";
import { formatDuration, MEDIA_LABEL, mediaUrl, useHymn } from "@/lib/hymnal";

/** One hymn (functionality §3.6): numbers in each book, lyrics, and every tune with its media (D-026). */
export function HymnPage() {
  const { slug } = useParams();
  const q = useHymn(slug);
  const [tuneId, setTuneId] = useState<string | null>(null);

  if (q.isPending) return <p className="content-narrow mx-auto muted small">Loading…</p>;
  if (q.isError)
    return (
      <div className="content-narrow mx-auto card rail-card">
        {q.error instanceof ApiClientError && q.error.code === "HYMN_NOT_FOUND" ? "We couldn't find that hymn." : "This hymn could not be loaded."}
      </div>
    );
  const h = q.data;
  const tune = h.tunes.find((t) => t.id === tuneId) ?? h.tunes[0];

  return (
    <div className="content-narrow mx-auto flex flex-col gap-4">
      <Link to="/hymnal" className="link">
        <ArrowLeft className="ic" aria-hidden /> Hymnal
      </Link>

      <header className="card hymn-head">
        {h.numbers.length ? (
          <div className="lit-chips">
            {h.numbers.map((n) => (
              <span key={n.book} className="chip chip-burgundy" title={n.bookName}>
                {n.book} {n.number}
              </span>
            ))}
          </div>
        ) : null}
        <h1>{h.title}</h1>
        {h.author ? <p className="small muted">Words: {h.author}</p> : null}
        {h.tags.length ? <p className="small muted mt-1">{h.tags.join(" · ")}</p> : null}
      </header>

      <article className="card hymn-verses" aria-label="Words">
        {h.verses.map((v, i) => (
          <div key={i} className={`stanza${v.label === "R" ? " refrain" : ""}`}>
            <b>{v.label === "R" ? "R." : v.label}</b>
            <div>
              {v.lines.map((l, j) => (
                <div key={j}>{l}</div>
              ))}
            </div>
          </div>
        ))}
        {h.source ? <p className="all-credits">{h.source}</p> : null}
      </article>

      {h.tunes.length ? (
        <section className="card tune-card" aria-label="Music">
          {h.tunes.length > 1 ? (
            <div className="rt-bar" role="tablist" aria-label="Tunes" style={{ marginTop: 0, marginBottom: 14 }}>
              {h.tunes.map((t) => (
                <button key={t.id} type="button" role="tab" className="rt" aria-selected={t.id === tune?.id} onClick={() => setTuneId(t.id)}>
                  {t.name}
                </button>
              ))}
            </div>
          ) : null}
          {tune ? <TuneMedia tune={tune} /> : null}
        </section>
      ) : null}
    </div>
  );
}

function TuneMedia({ tune }: { tune: HymnTune }) {
  return (
    <>
      <h2 className="rail-title">
        <Music className="ic inline -mt-1 mr-1" aria-hidden />
        {tune.name}
      </h2>
      {tune.composer || tune.meter ? (
        <p className="small muted mb-2">{[tune.composer, tune.meter].filter(Boolean).join(" · ")}</p>
      ) : null}
      {tune.media.length ? (
        <ul>
          {tune.media.map((m) => (
            <MediaRow key={m.id} m={m} />
          ))}
        </ul>
      ) : (
        <p className="small muted">No recordings or notation for this tune yet.</p>
      )}
    </>
  );
}

const ICON = { AUDIO: Headphones, MIDI: Music, STAFF_PDF: FileText, SOLFA_PDF: FileText, YOUTUBE: Youtube } as const;

function MediaRow({ m }: { m: HymnMedia }) {
  const Icon = ICON[m.kind];
  const [src, setSrc] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const open = async (download: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      const { url } = await mediaUrl(m.id, download);
      if (m.kind === "AUDIO" && !download) setSrc(url);
      else window.open(url, "_blank", "noopener");
    } catch (e) {
      setErr(e instanceof ApiClientError && e.code === "MEDIA_LOCKED" ? "For subscribers." : "Couldn't open the file.");
    } finally {
      setBusy(false);
    }
  };

  const title = (
    <span className="grow">
      <b className="text-sm">{m.label}</b>
      <span className="small muted ml-2">
        {MEDIA_LABEL[m.kind]}
        {m.durationSec ? ` · ${formatDuration(m.durationSec)}` : ""}
        {m.isDefault ? " · default" : ""}
      </span>
      {err ? <span className="small block" style={{ color: "var(--danger)" }}>{err}</span> : null}
    </span>
  );

  if (!m.available)
    return (
      <li className="media-row locked">
        <Lock className="ic" aria-hidden />
        {title}
        <span className="chip chip-gold">Subscribers</span>
      </li>
    );

  return (
    <li className="media-row" style={{ flexWrap: "wrap" }}>
      <Icon className="ic" aria-hidden />
      {title}
      {m.kind === "AUDIO" ? (
        src ? null : (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void open(false)} disabled={busy}>
            <Play className="ic" aria-hidden /> Play
          </button>
        )
      ) : m.kind === "YOUTUBE" ? (
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowVideo((v) => !v)}>
          {showVideo ? "Hide" : "Watch"}
        </button>
      ) : (
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void open(m.kind === "MIDI")} disabled={busy}>
          {m.kind === "MIDI" ? <Download className="ic" aria-hidden /> : <FileText className="ic" aria-hidden />}
          {m.kind === "MIDI" ? "Download" : "Open"}
        </button>
      )}
      {src ? <audio src={src} controls autoPlay preload="none" style={{ flexBasis: "100%" }} /> : null}
      {showVideo && m.youtubeId ? (
        // YouTube's terms: the player stays visible (no audio-only playback of YouTube) — D-026.
        <div className="yt-frame" style={{ flexBasis: "100%" }}>
          <iframe
            src={youTubeEmbedUrl(m.youtubeId)}
            title={m.label}
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : null}
    </li>
  );
}
