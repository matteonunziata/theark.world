"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  type ActionResult,
  fail,
  field,
  friendly,
  ok,
} from "@/lib/action-result";
import { budgetsOrThrow } from "@/lib/auth";
import { fmtMoney } from "@/lib/shop";

const done = (message: string) => {
  revalidatePath("/finance", "layout");
  return ok(message);
};

const money = (data: FormData, name: string) => {
  const n = Number(field(data, name));
  return Number.isFinite(n) ? n : NaN;
};

const cur = (data: FormData) => (field(data, "currency") === "USD" ? "USD" : "CRC");

/** Postgres rule messages ("Nothing can be logged until…") are written to be read. */
const dbFail = (error: { code?: string; message?: string }) => {
  if (error.code === "23503") return fail("That is still in use, so it can’t be removed.");
  return fail(friendly(error));
};

// Budgets ----------------------------------------------------------------------------

export async function saveBudget(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase, staff, isAdmin } = await budgetsOrThrow();
  const id = field(data, "id");

  if (data.get("intent") === "delete" && id) {
    const { error } = await supabase.from("budgets").delete().eq("id", id);
    if (error) return dbFail(error);
    revalidatePath("/finance", "layout");
    redirect("/finance/budgets");
  }

  const name = field(data, "name");
  if (!name) return fail("Give the budget a name.");
  const type = field(data, "type");
  if (type !== "monthly" && type !== "project") return fail("Choose Monthly or Project.");

  const month = field(data, "period_month");
  const start = field(data, "start_date");
  const end = field(data, "end_date");
  if (type === "monthly" && !(month && /^\d{4}-\d{2}$/.test(month))) {
    return fail("Pick the month this budget covers.");
  }
  if (type === "project") {
    if (!start || !end) return fail("Set the project’s start and end dates.");
    if (end < start) return fail("The end date can’t be before the start date.");
  }

  const divisionId = isAdmin ? field(data, "division_id") : staff.division_id;
  if (!divisionId) {
    return fail(
      isAdmin
        ? "Choose the sector this budget belongs to."
        : "You’re not assigned to a sector yet. Ask an admin to set it in Settings → Team.",
    );
  }

  const row = {
    name,
    type,
    period_month: type === "monthly" ? `${month}-01` : null,
    start_date: type === "project" ? start : null,
    end_date: type === "project" ? end : null,
  };

  if (id) {
    const { error } = await supabase.from("budgets").update(row).eq("id", id);
    if (error) return dbFail(error);
    return done("Budget saved");
  }
  const { data: created, error } = await supabase
    .from("budgets")
    .insert({ ...row, division_id: divisionId, created_by: staff.id })
    .select("id")
    .single();
  if (error) return dbFail(error);
  revalidatePath("/finance", "layout");
  redirect(`/finance/budgets/${created.id}`);
}

export async function saveLine(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase } = await budgetsOrThrow();
  const id = field(data, "id");

  if (data.get("intent") === "delete" && id) {
    const { error } = await supabase.from("budget_lines").delete().eq("id", id);
    if (error) return dbFail(error);
    return done("Line removed");
  }

  const budgetId = field(data, "budget_id");
  const category = field(data, "category");
  if (!budgetId) return fail("Something went wrong. Reload and try again.");
  if (!category) return fail("Name the category, e.g. Seeds or Sound system.");
  const planned = money(data, "planned_crc");
  if (!(planned >= 0)) return fail("Enter the planned amount in colones.");
  const usdRaw = field(data, "planned_usd");
  const usd = usdRaw === null ? null : Number(usdRaw);
  if (usd !== null && !(usd >= 0)) return fail("The dollar amount must be zero or more.");

  const row = { category, planned_crc: planned, planned_usd: usd };
  const { error } = id
    ? await supabase.from("budget_lines").update(row).eq("id", id)
    : await supabase.from("budget_lines").insert({ ...row, budget_id: budgetId });
  if (error) return dbFail(error);
  return done(id ? "Line saved" : "Line added");
}

/** Status moves. The database decides who may do which; it explains when it says no. */
async function setStatus(id: string, status: string, comment?: string | null) {
  const { supabase } = await budgetsOrThrow();
  const { error } = await supabase
    .from("budgets")
    .update({ status, review_comment: comment ?? null })
    .eq("id", id);
  return error;
}

export async function submitBudget(id: string): Promise<ActionResult> {
  const error = await setStatus(id, "pending");
  return error ? dbFail(error) : done("Sent for approval");
}

export async function reopenBudget(id: string): Promise<ActionResult> {
  const error = await setStatus(id, "draft");
  return error ? dbFail(error) : done("Back to draft");
}

export async function closeBudget(id: string): Promise<ActionResult> {
  const error = await setStatus(id, "closed");
  return error ? dbFail(error) : done("Budget closed");
}

export async function reviewBudget(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const id = field(data, "id");
  const decision = field(data, "decision");
  if (!id || (decision !== "approved" && decision !== "rejected")) {
    return fail("Choose approve or reject.");
  }
  const error = await setStatus(id, decision, field(data, "comment"));
  return error
    ? dbFail(error)
    : done(decision === "approved" ? "Budget approved" : "Budget rejected");
}

// Movements (Monthly budgets) -------------------------------------------------------------

/** Used so far vs planned for one line, in colones. */
async function lineStanding(
  supabase: Awaited<ReturnType<typeof budgetsOrThrow>>["supabase"],
  lineId: string,
  type: "monthly" | "project",
) {
  const [{ data: line }, { data: t }] = await Promise.all([
    supabase.from("budget_lines").select("category, planned_crc").eq("id", lineId).single(),
    supabase.from("budget_line_totals").select("*").eq("line_id", lineId).single(),
  ]);
  if (!line || !t) return null;
  const spent =
    type === "monthly"
      ? Number(t.movements_crc)
      : Number(t.paid_crc) + Number(t.requested_crc);
  return { category: line.category, planned: Number(line.planned_crc), spent };
}

/** A heads-up, never a block: the entry is saved either way. */
const overNote = (s: { category: string; planned: number; spent: number } | null) =>
  s && s.spent > s.planned
    ? ` Heads up: “${s.category}” is now ${fmtMoney(s.spent - s.planned, "CRC")} over its planned ${fmtMoney(s.planned, "CRC")}.`
    : "";

export async function logMovement(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase } = await budgetsOrThrow();
  const budgetId = field(data, "budget_id");
  const lineId = field(data, "line_id");
  if (!budgetId) return fail("Something went wrong. Reload and try again.");
  if (!lineId) return fail("Choose which line this was spent against.");
  const amount = money(data, "amount");
  if (!(amount > 0)) return fail("Enter an amount above zero.");
  const date = field(data, "movement_date");
  if (!date) return fail("Pick the date it was spent.");
  const description = field(data, "description");
  if (!description) return fail("Say what it was for.");
  const receipt = field(data, "receipt_path");
  if (!receipt) return fail("Attach the receipt. It’s required.");

  const { error } = await supabase.from("budget_movements").insert({
    budget_id: budgetId,
    line_id: lineId,
    movement_date: date,
    amount,
    currency: cur(data),
    amount_crc: amount, // replaced by the database at the Settings rate
    description,
    provider_id: field(data, "provider_id"),
    receipt_path: receipt,
    receipt_name: field(data, "receipt_name"),
  });
  if (error) return dbFail(error);
  return done(`Expense logged.${overNote(await lineStanding(supabase, lineId, "monthly"))}`);
}

// Payment requests (Project budgets) -----------------------------------------------------------

export async function requestPayment(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase } = await budgetsOrThrow();
  const budgetId = field(data, "budget_id");
  const lineId = field(data, "line_id");
  if (!budgetId) return fail("Something went wrong. Reload and try again.");
  if (!lineId) return fail("Choose which line this is for.");
  const providerId = field(data, "provider_id");
  if (!providerId) return fail("Choose the provider.");
  const accountId = field(data, "provider_account_id");
  if (!accountId) return fail("Choose the provider’s bank account, or add one first.");
  const amount = money(data, "amount");
  if (!(amount > 0)) return fail("Enter an amount above zero.");

  const { error } = await supabase.from("payment_requests").insert({
    budget_id: budgetId,
    line_id: lineId,
    provider_id: providerId,
    provider_account_id: accountId,
    amount,
    currency: cur(data),
    amount_crc: amount, // replaced by the database at the Settings rate
    due_date: field(data, "due_date"),
    milestone: field(data, "milestone"),
    invoice_path: field(data, "invoice_path"),
    invoice_name: field(data, "invoice_name"),
  });
  if (error) return dbFail(error);
  return done(`Payment requested.${overNote(await lineStanding(supabase, lineId, "project"))}`);
}

export async function payRequest(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase, isAdmin } = await budgetsOrThrow();
  if (!isAdmin) return fail("Only an admin can pay a request.");
  const id = field(data, "id");
  if (!id) return fail("Something went wrong. Reload and try again.");
  const receipt = field(data, "payment_receipt_path");
  if (!receipt) return fail("Upload the payment receipt first.");
  const { error } = await supabase
    .from("payment_requests")
    .update({
      status: "paid",
      payment_receipt_path: receipt,
      payment_receipt_name: field(data, "payment_receipt_name"),
      paid_on: field(data, "paid_on"),
    })
    .eq("id", id);
  if (error) return dbFail(error);
  return done("Marked paid");
}

export async function rejectRequest(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase, isAdmin } = await budgetsOrThrow();
  if (!isAdmin) return fail("Only an admin can reject a request.");
  const id = field(data, "id");
  if (!id) return fail("Something went wrong. Reload and try again.");
  const { error } = await supabase
    .from("payment_requests")
    .update({ status: "rejected", reject_reason: field(data, "reason") })
    .eq("id", id);
  if (error) return dbFail(error);
  return done("Request rejected");
}

// Providers ----------------------------------------------------------------------------------------

export async function saveProvider(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase, staff, isAdmin } = await budgetsOrThrow();
  const id = field(data, "id");

  if (data.get("intent") === "delete" && id) {
    if (!isAdmin) return fail("Only an admin can remove a provider.");
    const { error } = await supabase.from("providers").delete().eq("id", id);
    if (error) return dbFail(error);
    return done("Provider removed");
  }

  const name = field(data, "name");
  if (!name) return fail("Enter the provider’s name.");
  const row = { name, contact: field(data, "contact"), notes: field(data, "notes") };
  if (id) {
    const { error } = await supabase.from("providers").update(row).eq("id", id);
    if (error) return dbFail(error);
    return done("Provider saved");
  }
  const { data: created, error } = await supabase
    .from("providers")
    .insert({ ...row, created_by: staff.id })
    .select("id")
    .single();
  if (error) return dbFail(error);

  // A first bank account can be added in the same step.
  const bank = field(data, "bank");
  const number = field(data, "account_number");
  if (bank || number) {
    const res = await insertAccount(supabase, staff, isAdmin, created.id, data);
    if (!res.ok) return fail(`Provider added, but the bank account wasn’t: ${res.error}`);
  }
  return done(`${name} added`);
}

async function insertAccount(
  supabase: Awaited<ReturnType<typeof budgetsOrThrow>>["supabase"],
  staff: Awaited<ReturnType<typeof budgetsOrThrow>>["staff"],
  isAdmin: boolean,
  providerId: string,
  data: FormData,
): Promise<ActionResult> {
  const bank = field(data, "bank");
  const holder = field(data, "account_holder");
  const number = field(data, "account_number");
  if (!bank || !holder || !number) {
    return fail("Add the bank, the account holder and the account or IBAN number.");
  }
  // A sector's accounts are visible to that sector; an admin can leave it admin-only.
  const division = isAdmin ? field(data, "division_id") : staff.division_id;
  if (!isAdmin && !division) return fail("You’re not assigned to a sector yet.");
  const { error } = await supabase.from("provider_bank_accounts").insert({
    provider_id: providerId,
    division_id: division,
    bank,
    account_holder: holder,
    account_number: number,
    currency: cur(data),
    created_by: staff.id,
  });
  return error ? dbFail(error) : ok("");
}

export async function saveBankAccount(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase, staff, isAdmin } = await budgetsOrThrow();
  const id = field(data, "id");

  if (data.get("intent") === "delete" && id) {
    const { error } = await supabase.from("provider_bank_accounts").delete().eq("id", id);
    if (error) return dbFail(error);
    return done("Bank account removed");
  }

  if (id) {
    const bank = field(data, "bank");
    const holder = field(data, "account_holder");
    const number = field(data, "account_number");
    if (!bank || !holder || !number) {
      return fail("Add the bank, the account holder and the account or IBAN number.");
    }
    const { error } = await supabase
      .from("provider_bank_accounts")
      .update({ bank, account_holder: holder, account_number: number, currency: cur(data) })
      .eq("id", id);
    if (error) return dbFail(error);
    return done("Bank account saved");
  }

  const providerId = field(data, "provider_id");
  if (!providerId) return fail("Something went wrong. Reload and try again.");
  const res = await insertAccount(supabase, staff, isAdmin, providerId, data);
  return res.ok ? done("Bank account added") : res;
}

// Feedback ----------------------------------------------------------------------------------------------

export async function sendFeedback(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase, staff } = await budgetsOrThrow();
  const body = field(data, "body");
  if (!body) return fail("Write a few words first.");
  const { error } = await supabase.from("finance_feedback").insert({
    staff_id: staff.id,
    staff_name: staff.name,
    division_id: staff.division_id,
    page: field(data, "page"),
    body,
  });
  if (error) return dbFail(error);
  return ok("Thank you. Your feedback was sent.");
}

export async function deleteFeedback(id: string): Promise<ActionResult> {
  const { supabase, isAdmin } = await budgetsOrThrow();
  if (!isAdmin) return fail("Only an admin can remove feedback.");
  const { error } = await supabase.from("finance_feedback").delete().eq("id", id);
  if (error) return dbFail(error);
  revalidatePath("/finance/feedback");
  return ok("Removed");
}
