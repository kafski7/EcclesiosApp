import type { BookSummary } from "@ecclesios/shared";

/** Cover image, or a typographic cover when the seller hasn't uploaded one. */
export function BookCover({
  b,
  size = "md",
}: {
  b: Pick<BookSummary, "title" | "authorName" | "coverUrl">;
  size?: "sm" | "md" | "lg";
}) {
  if (b.coverUrl)
    return (
      <img src={b.coverUrl} alt="" className={`book-cover book-cover-${size}`} loading="lazy" />
    );
  return (
    <span className={`book-cover book-cover-${size} book-cover-blank`} aria-hidden>
      <b>{b.title}</b>
      <small>{b.authorName}</small>
    </span>
  );
}
