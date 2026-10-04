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

export type ScheduleEntry = {
  id: string;
  weekday: number | null;
  on_date: string | null;
  start_time: string;
  end_time: string;
  title: string;
  location: string | null;
  teacher?: string | null;
  notes: string | null;
};

/** What's on for a date: the weekly rhythm for that weekday plus anything set for the date itself. */
export function scheduleFor<T extends Pick<ScheduleEntry, "weekday" | "on_date" | "start_time">>(entries: T[], date: string) {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return entries
    .filter((e) => (e.on_date ? e.on_date === date : e.weekday === dow))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}
