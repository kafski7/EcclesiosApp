import { Pause, Play, RotateCcw, RotateCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ApiClientError } from "@/lib/api";
import { clampSeek, formatClock, resumePosition } from "@/lib/player";
import { episodeUrl } from "@/lib/podcasts";
import { usePlayer } from "@/stores/player";

/**
 * Fixed bottom bar with the shared <audio> element (D-029). Mounted once in AppShell, so it keeps
 * playing across pages. Fetches a fresh presigned URL on start and whenever the old one expires.
 */
export function MiniPlayer() {
  const { track, playRequest, position, setPosition, close } = usePlayer();
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const lastSaved = useRef(0);
  /** One automatic re-fetch per failure (expired URL); a broken file must not loop. */
  const retried = useRef(false);

  const load = useCallback(
    async (startAt: number, autoplay: boolean) => {
      const el = audio.current;
      if (!el || !track) return;
      setLoading(true);
      setError(null);
      try {
        const { url } = await episodeUrl(track.episodeId);
        el.src = url;
        el.currentTime = startAt;
        if (autoplay) await el.play();
      } catch (e) {
        setError(
          e instanceof ApiClientError && e.code === "MEDIA_LOCKED"
            ? "This episode is for subscribers."
            : "Couldn't play this episode.",
        );
      } finally {
        setLoading(false);
      }
    },
    [track],
  );

  // A new play request (Play pressed on an episode): load and start.
  useEffect(() => {
    if (!track || !playRequest) return;
    void load(resumePosition(position, track.durationSec), true);
    // position is read once at request time on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playRequest]);

  // Lock-screen / headset controls.
  useEffect(() => {
    if (!track || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.podcastTitle,
      artwork: track.coverUrl ? [{ src: track.coverUrl, sizes: "512x512" }] : [],
    });
    const el = audio.current;
    navigator.mediaSession.setActionHandler("play", () => void el?.play());
    navigator.mediaSession.setActionHandler("pause", () => el?.pause());
    navigator.mediaSession.setActionHandler(
      "seekbackward",
      () => el && (el.currentTime = clampSeek(el.currentTime, -15, el.duration)),
    );
    navigator.mediaSession.setActionHandler(
      "seekforward",
      () => el && (el.currentTime = clampSeek(el.currentTime, 30, el.duration)),
    );
  }, [track]);

  if (!track) return <audio ref={audio} hidden />;

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (!el.src) void load(resumePosition(position, track.durationSec), true);
    else if (el.paused) void el.play();
    else el.pause();
  };
  const seek = (delta: number) => {
    const el = audio.current;
    if (el?.src) el.currentTime = clampSeek(el.currentTime, delta, el.duration);
  };
  const total = duration || track.durationSec || 0;

  return (
    <div className="mini-player" role="region" aria-label="Now playing">
      <audio
        ref={audio}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPlaying={() => {
          retried.current = false;
        }}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setCurrent(t);
          if (Math.abs(t - lastSaved.current) >= 5) {
            lastSaved.current = t;
            setPosition(t);
          }
        }}
        onEnded={() => setPosition(0)}
        // The presigned URL expired mid-episode: fetch a new one and continue where we were.
        onError={(e) => {
          if (!e.currentTarget.src || retried.current) {
            setError("Couldn't play this episode.");
            return;
          }
          retried.current = true;
          void load(e.currentTarget.currentTime, playing);
        }}
      />
      {track.coverUrl ? (
        <img src={track.coverUrl} alt="" className="mp-cover" />
      ) : (
        <span className="mp-cover saint-medal" aria-hidden>
          ♪
        </span>
      )}
      <div className="mp-meta">
        <Link to={`/podcasts/${track.podcastSlug}`} className="mp-title">
          {track.title}
        </Link>
        <span className="mp-sub">{error ?? track.podcastTitle}</span>
        <input
          type="range"
          className="mp-progress"
          min={0}
          max={total || 1}
          step={1}
          value={Math.min(current, total || 1)}
          aria-label="Position"
          aria-valuetext={`${formatClock(current)} of ${formatClock(total)}`}
          onChange={(e) => {
            const el = audio.current;
            if (el?.src) el.currentTime = Number(e.target.value);
          }}
        />
      </div>
      <span className="mp-time">
        {formatClock(current)} / {formatClock(total)}
      </span>
      <div className="mp-controls">
        <button
          type="button"
          className="icon-btn"
          onClick={() => seek(-15)}
          aria-label="Back 15 seconds"
        >
          <RotateCcw className="ic" />
        </button>
        <button
          type="button"
          className="mp-play"
          onClick={toggle}
          disabled={loading}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="ic" /> : <Play className="ic" />}
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => seek(30)}
          aria-label="Forward 30 seconds"
        >
          <RotateCw className="ic" />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => {
            audio.current?.pause();
            close();
          }}
          aria-label="Close player"
        >
          <X className="ic" />
        </button>
      </div>
    </div>
  );
}
