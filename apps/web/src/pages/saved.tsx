import type { SavedItem } from "@ecclesios/shared";
import { Bookmark, BookOpen, GraduationCap, Library, Mic, Music } from "lucide-react";
import { Link } from "react-router-dom";
import { SignInLink } from "@/components/auth/sign-in-link";
import { EngageBar } from "@/components/engage/engage-bar";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useSaved } from "@/lib/engage";
import { savedHref } from "@/lib/you";
import { shortDate } from "@/lib/news";
import { useSession } from "@/stores/session";

const GROUPS: { kind: SavedItem["kind"]; label: string; icon: typeof Bookmark }[] = [
  { kind: "POST", label: "Explore", icon: BookOpen },
  { kind: "TEACHING", label: "Teachings", icon: GraduationCap },
  { kind: "EPISODE", label: "Podcast episodes", icon: Mic },
  { kind: "HYMN", label: "Hymns", icon: Music },
  { kind: "BOOK", label: "Books", icon: Library },
];

/** The member's saved posts, teachings, episodes and hymns (D-035). Private to them. */
export function SavedPage() {
  const principal = useSession((s) => s.principal);
  const q = useSaved();
  if (principal?.kind !== "member")
    return (
      <div className="content-narrow mx-auto card rail-card">
        <SignInLink /> to see the things you've saved.
      </div>
    );
  const items = q.data?.items ?? [];
  return (
    <div className="content-narrow mx-auto">
      <header className="page-head">
        <h1 className="page-title">Saved</h1>
        <p className="page-sub">Only you can see what you save.</p>
      </header>
      {q.isPending ? <Skeleton variant="rows" count={4} label="Loading saved items" /> : null}
      {q.isError ? (
        <ErrorState
          title="Your saved items could not be loaded"
          error={q.error}
          onRetry={() => q.refetch()}
          retrying={q.isRefetching}
        />
      ) : null}
      {q.isSuccess && !items.length ? (
        <EmptyState icon={Bookmark} title="Nothing saved yet">
          Tap Save on a post, teaching, episode, hymn or book to keep it here.
        </EmptyState>
      ) : null}
      {GROUPS.map(({ kind, label, icon: Icon }) => {
        const group = items.filter((i) => i.kind === kind);
        if (!group.length) return null;
        return (
          <section key={kind} className="mb-5" aria-label={label}>
            <h2 className="rail-title mb-2 flex items-center gap-2">
              <Icon className="ic" style={{ color: "var(--accent-600)" }} aria-hidden /> {label}
            </h2>
            <ul className="flex flex-col gap-2">
              {group.map((i) => (
                <li key={i.id} className="card rail-card">
                  <Link to={savedHref(i)} className="block">
                    <b>{i.title}</b>
                    <small className="muted block">
                      {[i.subtitle, `saved ${shortDate(i.savedAt)}`].filter(Boolean).join(" · ")}
                    </small>
                  </Link>
                  <EngageBar kind={i.kind} id={i.id} title={i.title} href={savedHref(i)} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
