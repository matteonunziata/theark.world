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

const NUMS = [
  "membership",
  "events",
  "shop",
  "fnb",
  "land",
  "other",
  "expenses",
  "cash",
  "ar",
  "ap",
] as const;

export async function saveMonth(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const month = field(data, "month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return fail("Pick a month.");
  const row: Record<string, number | string | null> = {
    month: `${month}-01`,
    notes: field(data, "notes"),
    cash_date: field(data, "cash_date"),
  };
  for (const k of NUMS) {
    const v = field(data, k);
    if (v !== null && (Number.isNaN(Number(v)) || Number(v) < 0)) {
      return fail("Amounts need to be zero or more.");
    }
    row[k] = v === null ? null : Number(v);
  }
  const { error } = await supabase
    .from("finance_months")
    .upsert(row as { month: string });
  if (error) return fail(friendly(error));
  revalidatePath("/finance");
  return ok(`${monthLabel(month)} saved`);
}
