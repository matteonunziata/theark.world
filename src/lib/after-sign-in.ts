import type { User } from "@supabase/supabase-js";

/**
 * Where to go once an emailed link or code has been used. Emailing the
 * address proves it once; people who haven't set a password yet are offered
 * one so the next sign-in is just email and password. Safe to skip.
 */
export function afterEmailSignIn(user: User | null, next: string) {
  if (user?.user_metadata?.has_password) return next;
  return `/auth/password?next=${encodeURIComponent(next)}`;
}
