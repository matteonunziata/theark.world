export const schoolPhoto = (path: string | null | undefined) =>
  path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/school/${path}`
    : null;

/** Whole years between a birthdate and today (both YYYY-MM-DD). */
export function age(birthdate: string | null | undefined, today: string) {
  if (!birthdate) return null;
  const [y, m, d] = birthdate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

export const firstName = (s: { name: string; preferred_name?: string | null }) =>
  s.preferred_name || s.name.split(" ")[0];
