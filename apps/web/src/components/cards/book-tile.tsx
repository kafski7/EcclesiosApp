import type { BookSummary } from "@ecclesios/shared";
import { Link } from "react-router-dom";
import { BookCover } from "@/components/books/book-cover";
import { EngageBar } from "@/components/engage/engage-bar";
import { formatPrice } from "@/lib/books";

/** Book in a grid: cover, title, author, price or "In your library" (D-036, D-043). */
export function BookTile({ b }: { b: BookSummary }) {
  const href = `/books/${b.slug}`;
  return (
    <li className="book-tile">
      <Link to={href} className="block">
        <BookCover b={b} />
        <b className="book-title">{b.title}</b>
        <small className="muted block">{b.authorName}</small>
        <span className={`book-price${b.priceMinor === 0 ? " free" : ""}`}>
          {b.owned ? "In your library" : formatPrice(b.priceMinor, b.currency)}
        </span>
      </Link>
      <EngageBar kind="BOOK" id={b.id} title={b.title} href={href} />
    </li>
  );
}
