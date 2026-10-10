import { AlertCircle, Inbox, Loader2, RotateCw, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { errorText } from "@/lib/states";

export { errorText };

/**
 * Loading / empty / error / load-more for every data-driven page (docs/social.md §11.4, D-043).
 * One look everywhere; every error offers Try again.
 */

type SkeletonVariant = "list" | "cards" | "rows" | "grid" | "page";

/** Placeholder shaped like what's coming. Announced once as "Loading …" to screen readers. */
export function Skeleton({
  variant = "list",
  count = 3,
  label = "Loading",
}: {
  variant?: SkeletonVariant;
  count?: number;
  label?: string;
}) {
  return (
    <div className={`sk sk-${variant}`} role="status" aria-live="polite">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: variant === "page" ? 1 : count }, (_, i) => (
        <div key={i} className="sk-item" aria-hidden>
          {variant === "grid" ? <div className="sk-block sk-cover" /> : null}
          {variant === "cards" ? <div className="sk-line sk-kicker" /> : null}
          <div className="sk-line sk-title" />
          {variant !== "rows" ? <div className="sk-line" /> : null}
          {variant === "page" || variant === "cards" ? <div className="sk-line sk-short" /> : null}
          {variant === "page" ? (
            <>
              <div className="sk-line" />
              <div className="sk-line" />
              <div className="sk-line sk-short" />
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Nothing to show yet — say why, and what to do next. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  children,
  action,
  compact = false,
}: {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`card state${compact ? " state-compact" : ""}`}>
      <Icon className="ic state-ic" aria-hidden />
      <div className="state-body">
        <p className="state-title">{title}</p>
        {children ? <div className="state-text">{children}</div> : null}
        {action ? <div className="state-action">{action}</div> : null}
      </div>
    </div>
  );
}

/** Something went wrong — explain briefly and offer Try again (social.md §10.3, §11.4). */
export function ErrorState({
  title = "Something went wrong",
  error,
  message,
  onRetry,
  retrying = false,
  compact = false,
}: {
  title?: string;
  error?: unknown;
  /** Shown when the error has nothing more useful to say. */
  message?: string;
  onRetry?: () => unknown;
  retrying?: boolean;
  compact?: boolean;
}) {
  const text = errorText(error, message ?? "Please try again.");
  return (
    <div className={`card state state-error${compact ? " state-compact" : ""}`} role="alert">
      <AlertCircle className="ic state-ic" aria-hidden />
      <div className="state-body">
        <p className="state-title">{title}</p>
        <p className="state-text">{text}</p>
        {onRetry ? (
          <div className="state-action">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => void onRetry()}
              disabled={retrying}
            >
              {retrying ? (
                <Loader2 className="ic animate-spin" aria-hidden />
              ) : (
                <RotateCw className="ic" aria-hidden />
              )}
              {retrying ? "Trying…" : "Try again"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** "More …" under a paged list, with its own error and retry. */
export function LoadMore({
  q,
  label = "Load more",
}: {
  q: {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isFetchNextPageError?: boolean;
    fetchNextPage: () => unknown;
  };
  label?: string;
}) {
  if (q.isFetchNextPageError)
    return (
      <div className="load-more" role="alert">
        <p className="small muted">The next page could not be loaded.</p>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => void q.fetchNextPage()}
          disabled={q.isFetchingNextPage}
        >
          <RotateCw className="ic" aria-hidden /> Try again
        </button>
      </div>
    );
  if (!q.hasNextPage) return null;
  return (
    <div className="load-more">
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => void q.fetchNextPage()}
        disabled={q.isFetchingNextPage}
        aria-busy={q.isFetchingNextPage}
      >
        {q.isFetchingNextPage ? (
          <>
            <Loader2 className="ic animate-spin" aria-hidden /> Loading…
          </>
        ) : (
          label
        )}
      </button>
    </div>
  );
}
