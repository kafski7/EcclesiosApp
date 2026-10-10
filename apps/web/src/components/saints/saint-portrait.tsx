import { medalInitials } from "@/lib/saints";

/** Portrait from object storage (D-026), or the burgundy medal with initials when there is none. */
export function SaintPortrait({
  name,
  imageUrl,
  size,
}: {
  name: string;
  imageUrl: string | null;
  size: "lg" | "sm";
}) {
  const cls = size === "lg" ? "saint-photo" : "saint-mini-medal";
  if (imageUrl)
    return <img src={imageUrl} alt="" className={`${cls} object-cover`} loading="lazy" />;
  return (
    <span className={`${cls} saint-medal`} aria-hidden>
      {medalInitials(name)}
    </span>
  );
}
