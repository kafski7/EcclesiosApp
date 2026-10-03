import { useId } from "react";

/**
 * Large Ecclesios cross for the auth screen, drawn the way x.com draws its X:
 * a solid shape, a thin light outline, and a soft radial-gradient stroke on top (D-013).
 * Outer and inner crosses with evenodd fill give the double-line "hollow" look.
 */
const CROSS =
  "M192 2H288V120H416V216H288V488H192V216H64V120H192Z " +
  "M216 26V144H88V192H216V464H264V192H392V144H264V26Z";

export function BrandMark({ className }: { className?: string }) {
  const gradId = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 480 490"
      fill="none"
      role="img"
      aria-label="Ecclesios"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <radialGradient id={gradId} cx="325" cy="367" r="220" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E9C879" />
          <stop offset="1" stopColor="#C59B27" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={CROSS} fillRule="evenodd" fill="var(--primary)" />
      <path d={CROSS} fillRule="evenodd" stroke="#fff" strokeWidth={3} strokeLinejoin="round" />
      <path
        d={CROSS}
        fillRule="evenodd"
        stroke={`url(#${gradId})`}
        strokeWidth={3}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Small mark for the form column (shown when the big panel is hidden on narrow screens). */
export function SmallMark() {
  return (
    <svg viewBox="0 0 480 490" aria-hidden className="auth-small-mark">
      <path d={CROSS} fillRule="evenodd" fill="var(--primary)" />
    </svg>
  );
}
