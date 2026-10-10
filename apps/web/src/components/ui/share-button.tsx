import { Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { shareLink, shareNote } from "@/lib/engage";

/**
 * Share on its own, for things that can't be liked or saved — a day's readings, a saint,
 * a Bible passage, a news item (docs/social.md §9.2–9.3, §9.9, D-045). Works signed out.
 */
export function ShareButton({
  title,
  href,
  label = "Share",
  className = "btn btn-outline btn-sm",
}: {
  title: string;
  /** In-app path of the thing being shared. */
  href: string;
  label?: string;
  className?: string;
}) {
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const share = async () => {
    const text = shareNote(await shareLink(title, href));
    clearTimeout(timer.current);
    setNote(text);
    if (text) timer.current = setTimeout(() => setNote(null), 2500);
  };
  return (
    <span className="share-wrap">
      <button type="button" className={className} onClick={() => void share()}>
        <Share2 className="ic" aria-hidden /> {label}
      </button>
      <span className="eng-note" role="status" aria-live="polite">
        {note}
      </span>
    </span>
  );
}
