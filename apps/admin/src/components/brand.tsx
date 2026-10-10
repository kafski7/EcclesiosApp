import { useState } from "react";

/**
 * Kit .brand (admin.html): the cropped monstrance favicon + wordmark + "Church Management" (D-048).
 * Gold on the dark console sidebar, burgundy on the light sign-in card. Falls back to the drawn
 * cross if the image can't load (a missing file must never show a broken image or its path).
 */
export function Brand({
  sub = "Church Management",
  dark = true,
}: {
  sub?: string;
  dark?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="brand" style={dark ? undefined : { padding: 0 }}>
      {failed ? (
        <svg
          className="brand-cross"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M12 3v18M6.5 8.5h11" />
        </svg>
      ) : (
        <img
          src={dark ? "/ecclesios-favicon-gold.png" : "/ecclesios-favicon-burgundy.png"}
          alt=""
          width={32}
          height={32}
          className="brand-mark"
          onError={() => setFailed(true)}
        />
      )}
      <span className="brand-col">
        <span className="brand-name" style={{ fontSize: 20 }}>
          Ecclesios
        </span>
        <span className="brand-sub">{sub}</span>
      </span>
    </span>
  );
}

export function FullPageSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="cms-auth" role="status" aria-live="polite">
      <span className="small muted">{label}</span>
    </div>
  );
}

export function StateBadge({ state }: { state: string }) {
  const text: Record<string, string> = {
    ACTIVE: "Active",
    TRIAL: "Trial",
    EXPIRED: "Expired",
    NONE: "Not subscribed",
  };
  return (
    <span className={`state state-${state}`}>
      <span className="chip-dot" />
      {text[state] ?? state}
    </span>
  );
}

export const initials = (s: string) =>
  s
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
