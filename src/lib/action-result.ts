export type ActionResult = { ok: boolean; message?: string; error?: string };

export const ok = (message: string): ActionResult => ({ ok: true, message });
export const fail = (error: string): ActionResult => ({ ok: false, error });

/** Turn a Supabase/Postgres error into something a person can act on. */
export function friendly(error: { code?: string; message?: string } | null) {
  if (!error) return "Something went wrong. Try again.";
  if (error.code === "42501" || error.code === "PGRST301") {
    return "You don’t have access to change this.";
  }
  if (error.code === "23505") return "That already exists.";
  if (error.code === "P0001" && error.message) return error.message;
  return "Couldn’t save. Check your connection and try again.";
}

/** Read a trimmed string field; empty becomes null. */
export function field(data: FormData, name: string) {
  const v = data.get(name);
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}
