// Marketing: brands, pipeline stages, channels, lists, UTM links and Costa
// Rica times. Shared by the server and the browser.

export const BRANDS = [
  { key: "farm", name: "Farm", color: "leaf" },
  { key: "arkadia", name: "Arkadia", color: "sun" },
  { key: "ark", name: "The ARK", color: "sea" },
  { key: "courts", name: "Courts", color: "clay" },
  { key: "membership", name: "Membership", color: "plum" },
] as const;
export type BrandKey = (typeof BRANDS)[number]["key"];

export const brandOf = (k: string | null | undefined) => BRANDS.find((b) => b.key === k);
export const brandName = (k: string | null | undefined) => brandOf(k)?.name ?? "—";
export const brandColor = (k: string | null | undefined) => `var(--${brandOf(k)?.color ?? "slate"})`;
export const isBrand = (k: unknown): k is BrandKey => BRANDS.some((b) => b.key === k);

/** The brand filter from a page's search params (null when "all brands"). */
export const brandParam = (v: string | string[] | undefined): BrandKey | null =>
  isBrand(v) ? v : null;

export const STAGES = [
  ["idea", "Idea"],
  ["production", "In production"],
  ["review", "Review"],
  ["approved", "Approved"],
  ["published", "Published"],
] as const;
export type Stage = (typeof STAGES)[number][0];
export const stageName = (k: string) => STAGES.find((s) => s[0] === k)?.[1] ?? k;
/** An item counts as stuck after this many days in one stage (not Published). */
export const STUCK_DAYS = 7;

export const CHANNELS = [
  ["instagram", "Instagram"],
  ["facebook", "Facebook"],
  ["tiktok", "TikTok"],
  ["linkedin", "LinkedIn"],
  ["whatsapp", "WhatsApp channel"],
  ["youtube", "YouTube"],
] as const;
export type Channel = (typeof CHANNELS)[number][0];
export const channelName = (k: string) => CHANNELS.find((c) => c[0] === k)?.[1] ?? k;
export const isChannel = (k: unknown): k is Channel => CHANNELS.some((c) => c[0] === k);

export const POST_STATUS = [
  ["draft", "Draft"],
  ["ready", "Ready to post"],
  ["published", "Published"],
] as const;
export const postStatusName = (k: string) => POST_STATUS.find((s) => s[0] === k)?.[1] ?? k;

export const LISTS = [
  ["waitlist", "Waitlist", "On the membership waitlist in the CRM"],
  ["applicants", "Applicants", "Invited to apply, applied, or in screening"],
  ["members", "Members", "Active members"],
  ["attendees", "Event attendees", "Anyone who has booked a class or event"],
] as const;
export type ListKey = (typeof LISTS)[number][0];
export const listName = (k: string) => LISTS.find((l) => l[0] === k)?.[1] ?? k;

export const ASSET_KINDS = [
  ["photo", "Photo"],
  ["video", "Video"],
  ["copy", "Copy"],
] as const;

/** Public URL of a file in the marketing bucket (site paths and https pass through). */
export const assetUrl = (path: string | null | undefined) =>
  !path
    ? null
    : path.startsWith("/") || path.startsWith("https://")
      ? path
      : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/marketing/${path}`;

export const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

/** Add UTM tags to a link, keeping any it already has. */
export function withUtm(
  url: string,
  utm: { source: string; medium: string; campaign: string; content?: string },
) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return url;
    const set = (k: string, v?: string) => v && !u.searchParams.has(k) && u.searchParams.set(k, v);
    set("utm_source", utm.source);
    set("utm_medium", utm.medium);
    set("utm_campaign", utm.campaign);
    set("utm_content", utm.content);
    return u.toString();
  } catch {
    return url;
  }
}

/** Tag every https link in an email body ([[Button|url]], [text](url) and bare links). */
export const tagLinks = (body: string, utm: Parameters<typeof withUtm>[1]) =>
  body.replace(/https?:\/\/[^\s<>()\]|"']+[^\s<>()\]|"'.,;:!?]/g, (u) => withUtm(u, utm));

// Costa Rica is UTC-6 all year (no daylight saving).
export const CR_OFFSET = "-06:00";

/** "2026-10-04T15:30" typed in Costa Rica time → ISO timestamp. */
export const fromCrLocal = (local: string) => new Date(`${local}:00${CR_OFFSET}`).toISOString();

/** ISO timestamp → "2026-10-04T15:30" in Costa Rica time (for datetime-local inputs). */
export function toCrLocal(iso: string) {
  const d = new Date(new Date(iso).getTime() - 6 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}

/** The Costa Rica calendar date (YYYY-MM-DD) of a timestamp. */
export const crDate = (iso: string) => toCrLocal(iso).slice(0, 10);

/** "3:30pm" in Costa Rica time. */
export function crTime(iso: string) {
  const [h, m] = toCrLocal(iso).slice(11, 16).split(":").map(Number);
  const ap = h >= 12 ? "pm" : "am";
  const hh = ((h + 11) % 12) + 1;
  return m ? `${hh}:${String(m).padStart(2, "0")}${ap}` : `${hh}${ap}`;
}

export const fmtCr = (iso: string, opt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) =>
  new Date(iso).toLocaleDateString("en-US", { ...opt, timeZone: "America/Costa_Rica" });

/** Merge {{first_name}}, {{name}} and {{application_url}} into a message. */
export function mergeFields(text: string, v: { name?: string | null; application_url?: string | null }) {
  const first = (v.name ?? "").trim().split(/\s+/)[0] || "there";
  return text
    .replaceAll("{{first_name}}", first)
    .replaceAll("{{name}}", v.name?.trim() || "there")
    .replaceAll("{{application_url}}", v.application_url ?? "");
}

export const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");
