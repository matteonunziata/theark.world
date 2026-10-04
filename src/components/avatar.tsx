export const initials = (n: string | null | undefined) =>
  String(n || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

export function Avatar({
  name,
  color = "var(--slate)",
  className = "av",
}: {
  name: string;
  color?: string;
  className?: string;
}) {
  return (
    <span className={className} style={{ background: color }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
