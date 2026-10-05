"use server";

import { revalidatePath } from "next/cache";
import {
  type ActionResult,
  fail,
  field,
  friendly,
  ok,
} from "@/lib/action-result";
import { staffOrThrow } from "@/lib/auth";
import { monthLabel } from "@/lib/dates";
import { DOC_KINDS, METHODS } from "@/lib/finance";

const done = (message: string) => {
  revalidatePath("/finance", "layout");
  return ok(message);
};

export async function saveEntry(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase, staff } = await staffOrThrow("admin");
  const id = field(data, "id");

  if (data.get("intent") === "delete" && id) {
    const { data: e } = await supabase
      .from("finance_entries")
      .select("file_path")
      .eq("id", id)
      .single();
    const { error } = await supabase.from("finance_entries").delete().eq("id", id);
    if (error) return fail(friendly(error));
    if (e?.file_path) await supabase.storage.from("finance").remove([e.file_path]);
    return done("Entry deleted");
  }

  const kind = field(data, "kind");
  if (kind !== "income" && kind !== "expense") return fail("Choose income or expense.");
  const amount = Number(field(data, "amount"));
  if (!(amount > 0)) return fail("Enter an amount above zero.");
  const date = field(data, "entry_date");
  if (!date) return fail("Pick a date.");
  const status = field(data, "status") === "unpaid" ? "unpaid" : "paid";
  const method = field(data, "method");
  const docKind = field(data, "doc_kind");

  const row = {
    kind,
    entry_date: date,
    amount,
    currency: field(data, "currency") === "USD" ? "USD" : "CRC",
    business_line_id: field(data, "business_line_id"),
    category: field(data, "category"),
    party: field(data, "party"),
    contact_id: kind === "income" ? field(data, "contact_id") : null,
    description: field(data, "description"),
    method: METHODS.some((m) => m[0] === method) ? method : null,
    reference: field(data, "reference"),
    status,
    due_date: status === "unpaid" ? field(data, "due_date") : null,
    doc_kind: DOC_KINDS.some((d) => d[0] === docKind) ? docKind : null,
    file_path: field(data, "file_path"),
    file_name: field(data, "file_name"),
  };

  const { error } = id
    ? await supabase.from("finance_entries").update(row).eq("id", id)
    : await supabase
        .from("finance_entries")
        .insert({ ...row, created_by: staff.id });
  if (error) return fail(friendly(error));
  const what = kind === "income" ? "Income" : "Expense";
  return done(id ? `${what} saved` : `${what} added`);
}

export async function markPaid(id: string): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const { error } = await supabase
    .from("finance_entries")
    .update({ status: "paid" })
    .eq("id", id);
  if (error) return fail(friendly(error));
  return done("Marked as paid");
}

/** Cash in the bank at a point in the month, plus notes. */
export async function saveCash(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const month = field(data, "month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return fail("Pick a month.");
  const cash = field(data, "cash");
  if (cash !== null && Number.isNaN(Number(cash))) return fail("Enter a number.");
  const { error } = await supabase.from("finance_months").upsert({
    month: `${month}-01`,
    cash: cash === null ? null : Number(cash),
    cash_date: field(data, "cash_date"),
    notes: field(data, "notes"),
  });
  if (error) return fail(friendly(error));
  return done(`${monthLabel(month)} saved`);
}

export async function saveLine(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const id = field(data, "id");
  if (data.get("intent") === "delete" && id) {
    const { error } = await supabase.from("business_lines").delete().eq("id", id);
    if (error) return fail(friendly(error));
    return done("Business line removed");
  }
  const name = field(data, "name");
  if (!name) return fail("Enter a name.");
  const row = {
    name,
    color: field(data, "color") ?? "slate",
    active: data.get("active") !== null || !id,
  };
  if (id) {
    const { error } = await supabase.from("business_lines").update(row).eq("id", id);
    if (error) return fail(friendly(error));
  } else {
    const { count } = await supabase
      .from("business_lines")
      .select("id", { count: "exact", head: true });
    const { error } = await supabase
      .from("business_lines")
      .insert({ ...row, position: count ?? 0 });
    if (error) return fail(friendly(error));
  }
  return done(id ? "Business line saved" : `${name} added`);
}
