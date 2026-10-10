import { useId } from "react";
import { MONSTRANCE_PATH, MONSTRANCE_TRANSFORM, MONSTRANCE_VIEWBOX } from "./monstrance-path";

/**
 * The full Ecclesios monstrance for the sign-in panel (D-047), replacing the D-013 cross.
 * Drawn inline (not <img>) so it takes a gold gradient fill; a soft radiance glows behind it
 * (CSS, off for reduced motion).
 */
export function BrandMark({ className }: { className?: string }) {
  const gradId = `mg-${useId().replace(/:/g, "")}`;
  return (
    <span className={`monstrance ${className ?? ""}`.trim()}>
      <span className="monstrance-glow" aria-hidden />
      <svg viewBox={MONSTRANCE_VIEWBOX} role="img" aria-label="Ecclesios" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Light at the top (the host), deepening towards the base. The source path is drawn
              upside down (scale y −1), so the gradient runs bottom → top in its own box. */}
          <linearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#E9C879" />
            <stop offset="0.45" stopColor="#C59B27" />
            <stop offset="1" stopColor="#8C6D14" />
          </linearGradient>
        </defs>
        <g transform={MONSTRANCE_TRANSFORM} fill={`url(#${gradId})`} stroke="none">
          <path d={MONSTRANCE_PATH} />
        </g>
      </svg>
    </span>
  );
}

/** Small mark above the form on narrow screens: the cropped favicon (D-047). */
export function SmallMark() {
  return <img src="/ecclesios-favicon-burgundy.png" alt="" className="auth-small-mark" />;
}
