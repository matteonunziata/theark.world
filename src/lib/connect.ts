// Who a member might want to meet: people who spend time in the same
// cities first, then shared interests. Only people open to connecting are
// suggested.

export type DirEntry = {
  id: string;
  name: string;
  tier: string | null;
  city_id: string | null;
  cities: string[];
  bio: string | null;
  interests: string[];
  instagram: string | null;
  /** Only shared by members who are open to connecting. */
  phone: string | null;
  photo_path: string | null;
  open_to_connect: boolean;
  is_me: boolean;
};

const norm = (s: string) => s.trim().toLowerCase();

/** The items of b that also appear in a, ignoring case. */
export function shared(a: string[], b: string[]) {
  const mine = new Set(a.map(norm));
  return b.filter((x) => mine.has(norm(x)));
}

export const sharedInterests = shared;

export function suggestions(
  people: DirEntry[],
  me: { id: string; interests: string[]; cities: string[] } | null,
  limit = 6,
) {
  return people
    .filter((p) => !p.is_me && p.open_to_connect && p.id !== me?.id)
    .map((p) => {
      const interests = shared(me?.interests ?? [], p.interests);
      const cities = shared(me?.cities ?? [], p.cities);
      return {
        p,
        shared: interests,
        cities,
        score: cities.length * 3 + interests.length * 2 + (p.bio ? 0.5 : 0),
      };
    })
    .filter((x) => x.cities.length > 0 || x.shared.length > 0)
    .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name))
    .slice(0, limit);
}

export function reason(s: { shared: string[]; cities: string[] }) {
  const parts: string[] = [];
  if (s.shared.length) parts.push(`Both into ${s.shared.slice(0, 2).join(" and ")}`);
  if (s.cities.length) parts.push(`both spend time in ${s.cities.slice(0, 2).join(" and ")}`);
  const r = parts.join(", ");
  return r.charAt(0).toUpperCase() + r.slice(1);
}

const PALETTE = ["#21402D", "#1F6E7A", "#A65A3A", "#6E4A7E", "#C99A1E", "#3E7A55"];
export const avatarColor = (id: string) =>
  PALETTE[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % PALETTE.length];

/** "santa teresa, Lisbon ,NYC" → ["santa teresa", "Lisbon", "NYC"], at most n. */
export const splitList = (s: string | null | undefined, n = 12) =>
  String(s ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, n);
