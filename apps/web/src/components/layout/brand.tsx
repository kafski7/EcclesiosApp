import { Link } from "react-router-dom";

/** Kit .brand: gold cross (kit #i-logo path), serif wordmark. */
export function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link to="/" className="brand" aria-label="Ecclesios home" onClick={onNavigate}>
      <svg className="brand-cross" viewBox="0 0 24 24" aria-hidden>
        <path
          d="M12 3v18M7 7.8h10M9.4 21h5.2"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      </svg>
      <span className="brand-name">Ecclesios</span>
    </Link>
  );
}
