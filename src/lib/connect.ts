// Who a member might want to meet: people in the same city first, then
// shared interests. Only people open to connecting are suggested.

export type DirEntry = {
  id: string;
  name: string;
  tier: string | null;
  city_id: string | null;
  bio: string | null;
  interests: string[];
  instagram: string | null;
  open_to_connect: boolean;
  is_me: boolean;
};

const norm = (s: string) => s.trim().toLowerCase();

export function sharedInterests(a: string[], b: string[]) {
  const mine = new Set(a.map(norm));
  return b.filter((x) => mine.has(norm(x)));
}

export function suggestions(
  people: DirEntry[],
  me: { id: string; interests: string[] } | null,
  cityId: string | null,
  limit = 6,
) {
  return people
    .filter((p) => !p.is_me && p.open_to_connect && p.id !== me?.id)
    .map((p) => {
      const shared = sharedInterests(me?.interests ?? [], p.interests);
      const here = !!cityId && p.city_id === cityId;
      return { p, shared, here, score: (here ? 3 : 0) + shared.length * 2 + (p.bio ? 0.5 : 0) };
    })
    .filter((x) => x.here || x.shared.length > 0)
    .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name))
    .slice(0, limit);
}

export function reason(s: { shared: string[]; here: boolean }, cityName?: string) {
  const parts: string[] = [];
  if (s.shared.length) parts.push(`Both into ${s.shared.slice(0, 2).join(" and ")}`);
  if (s.here && cityName) parts.push(`also in ${cityName}`);
  const r = parts.join(", ");
  return r.charAt(0).toUpperCase() + r.slice(1);
}

const PALETTE = ["#21402D", "#1F6E7A", "#A65A3A", "#6E4A7E", "#C99A1E", "#3E7A55"];
export const avatarColor = (id: string) =>
  PALETTE[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % PALETTE.length];
