import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Only for sending sign-in links. The regular browser client uses PKCE,
 * which ties the link to the browser that asked for it: open the email on
 * a phone, or in the mail app's own browser, and sign-in fails. With the
 * implicit flow the link carries the session itself, so it works on any
 * device. `/auth/confirm` picks the session up and stores it in cookies.
 */
export function createLinkClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        flowType: "implicit",
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
