/* eslint-disable @next/next/no-img-element -- small static brand PNGs */

/** The ARK logo. "light" is cream for dark backgrounds, "dark" is ARK green. */
export function Logo({
  tone = "light",
  kind = "lockup",
  height = 28,
  className,
}: {
  tone?: "light" | "dark";
  kind?: "lockup" | "mark";
  height?: number;
  className?: string;
}) {
  const ratio = kind === "lockup" ? 2868 / 761 : 1;
  return (
    <img
      src={`/brand/ark-${kind}-${tone}.png`}
      alt={kind === "lockup" ? "The ARK" : ""}
      width={Math.round(height * ratio)}
      height={height}
      className={className}
      style={{ display: "block", height, width: "auto" }}
    />
  );
}
