import { Link } from "react-router-dom";

/** Sidebar brand: the official Ecclesios favicon + wordmark. */
export function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link to="/" className="brand" aria-label="Ecclesios home" onClick={onNavigate}>
      <img src="ecclesios-favicon-gold.png" alt="Ecclesios favicon" className="brand-mark" />
      <span className="brand-name">Ecclesios</span>
    </Link>
  );
}
