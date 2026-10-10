"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, fail, field, friendly, ok } from "@/lib/action-result";
import { staffOrThrow } from "@/lib/auth";

const done = (message: string) => {
  revalidatePath("/estate/stewards");
  revalidatePath("/crm", "layout");
  return ok(message);
};

type Change = "activate" | "deactivate" | "suspend" | "unsuspend";

/** Admins move a steward between active, not active and suspended. The database checks the rules. */
export async function changeStewardStatus(contactId: string, change: Change, reason: string): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const why = reason.trim() || null;
  if (change === "suspend" && !why) return fail("Say which rule was broken.");
  const { error } =
    change === "activate"
      ? await supabase.rpc("steward_activate", { p_contact: contactId })
      : change === "deactivate"
        ? await supabase.rpc("steward_deactivate", { p_contact: contactId, p_reason: why })
        : change === "suspend"
          ? await supabase.rpc("steward_suspend", { p_contact: contactId, p_reason: why! })
          : await supabase.rpc("steward_unsuspend", { p_contact: contactId, p_reason: why });
  if (error) return fail(friendly(error));
  return done(
    { activate: "Activated. The 48-month clock has started.", deactivate: "Set to not active", suspend: "Suspended", unsuspend: "Suspension lifted" }[change],
  );
}

export async function saveAgreement(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const contactId = field(data, "contact_id");
  if (!contactId) return fail("Missing steward.");
  const signed = field(data, "signed_at");
  const { error } = await supabase.rpc("steward_set_agreement", {
    p_contact: contactId,
    p_signed: signed,
    p_path: signed ? field(data, "file_path") : null,
    p_name: signed ? field(data, "file_name") : null,
  });
  if (error) return fail(friendly(error));
  return done(signed ? "Agreement recorded" : "Agreement cleared");
}
