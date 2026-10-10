import { BookMarked, BookOpen, Play } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useLibrary } from "@/lib/books";
import { chapterPath } from "@/lib/bible";
import { continueItems, leftLabel, type ContinueItem } from "@/lib/continue";
import { useBiblePrefs } from "@/stores/bible";
import { usePlayer } from "@/stores/player";

/**
 * "Pick up where you left off" (docs/social.md §9.1, D-044): the episode in the mini-player,
 * books being read (members) and the last Bible chapter — newest first, at most three.
 * Hidden when there's nothing to continue.
 */
export function ContinueRow() {
  const { track, position, positionAt, open } = usePlayer();
  const lastRead = useBiblePrefs((s) => s.lastRead);
  const library = useLibrary();

  const items = continueItems({
    episode: track ? { ...track, position, at: positionAt } : null,
    books: library.data?.items ?? [],
    bible: lastRead,
  });
  if (!items.length) return null;

  return (
    <section className="card continue" aria-labelledby="continue-title">
      <h2 id="continue-title" className="rail-title">
        Pick up where you left off
      </h2>
      <ul className="continue-list">
        {items.map((it) => (
          <li key={it.key}>
            <Item it={it} onResume={() => track && open(track)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Item({ it, onResume }: { it: ContinueItem; onResume: () => void }) {
  switch (it.kind) {
    case "EPISODE":
      return (
        <button type="button" className="continue-item" onClick={onResume}>
          <Thumb src={it.episode.coverUrl} icon={<Play className="ic" aria-hidden />} />
          <span className="continue-meta">
            <small>Listening · {it.episode.podcastTitle}</small>
            <b>{it.episode.title}</b>
            <small>{it.leftSec === null ? "Resume" : `Resume · ${leftLabel(it.leftSec)}`}</small>
          </span>
        </button>
      );
    case "BOOK":
      return (
        <Link to={`/books/${it.book.slug}/read`} className="continue-item">
          <Thumb src={it.book.coverUrl} icon={<BookOpen className="ic" aria-hidden />} />
          <span className="continue-meta">
            <small>Reading · {it.book.authorName}</small>
            <b>{it.book.title}</b>
            <span className="book-progress" aria-label={`${it.book.percent}% read`}>
              <span style={{ width: `${it.book.percent}%` }} />
            </span>
          </span>
        </Link>
      );
    case "BIBLE":
      return (
        <Link to={chapterPath(it.bible.book, it.bible.chapter)} className="continue-item">
          <Thumb src={null} icon={<BookMarked className="ic" aria-hidden />} />
          <span className="continue-meta">
            <small>Bible · {it.bible.translation}</small>
            <b>
              {it.bible.bookName} {it.bible.chapter}
            </b>
            <small>Continue reading</small>
          </span>
        </Link>
      );
  }
}

function Thumb({ src, icon }: { src: string | null; icon: ReactNode }) {
  return src ? (
    <img src={src} alt="" className="continue-thumb" loading="lazy" />
  ) : (
    <span className="continue-thumb continue-thumb-icon" aria-hidden>
      {icon}
    </span>
  );
}
