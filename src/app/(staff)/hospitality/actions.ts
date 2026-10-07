"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, fail, field, friendly, ok } from "@/lib/action-result";
import { staffOrThrow } from "@/lib/auth";

const HOSPITALITY = ["admin", "lead", "sales"];

const amount = (data: FormData, name: string) => {
  const v = field(data, name);
  if (v === null) return 0;
  const n = Number(v.replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export async function saveCleaningTask(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await staffOrThrow(...HOSPITALITY);
  const id = field(data, "id");

  if (data.get("intent") === "delete" && id) {
    const { error } = await supabase.from("cleaning_tasks").delete().eq("id", id);
    if (error) return fail(friendly(error));
    revalidatePath("/hospitality/cleaning");
    return ok("Task removed");
  }

  const area = field(data, "area");
  const task = field(data, "task");
  if (!area) return fail("Enter the area, like Kitchen or Bathrooms.");
  if (!task) return fail("Enter what needs doing.");
  const days = [...new Set(data.getAll("days").map(Number))]
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    .sort();
  if (!days.length) return fail("Choose at least one day.");

  const row = {
    area,
    task,
    days,
    time_slot: field(data, "time_slot"),
    assignee: field(data, "assignee"),
    notes: field(data, "notes"),
  };
  const { error } = id
    ? await supabase.from("cleaning_tasks").update(row).eq("id", id)
    : await supabase.from("cleaning_tasks").insert(row);
  if (error) return fail(friendly(error));
  revalidatePath("/hospitality/cleaning");
  return ok(id ? "Task saved" : "Task added");
}

export async function saveInventoryItem(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await staffOrThrow(...HOSPITALITY);
  const id = field(data, "id");

  if (data.get("intent") === "delete" && id) {
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) return fail(friendly(error));
    revalidatePath("/hospitality/food/inventory");
    return ok("Item removed");
  }

  const name = field(data, "name");
  if (!name) return fail("Enter the item’s name.");
  const onHand = amount(data, "on_hand");
  const reorderAt = amount(data, "reorder_at");
  const target = amount(data, "target");
  if (onHand === null || reorderAt === null || target === null) {
    return fail("Quantities have to be numbers, zero or more.");
  }
  if (target > 0 && target < reorderAt) return fail("The stock-up level can’t be below the low level.");

  const row = {
    name,
    category: field(data, "category") ?? "Other",
    unit: field(data, "unit") ?? "units",
    on_hand: onHand,
    reorder_at: reorderAt,
    target,
    supplier: field(data, "supplier"),
    notes: field(data, "notes"),
    counted_at: new Date().toISOString(),
  };
  const { error } = id
    ? await supabase.from("inventory_items").update(row).eq("id", id)
    : await supabase.from("inventory_items").insert(row);
  if (error) return fail(friendly(error));
  revalidatePath("/hospitality/food/inventory");
  return ok(id ? "Item saved" : "Item added");
}

/** Quick recount from the table: set what's on the shelf now. */
export async function countInventoryItem(data: FormData) {
  const { supabase } = await staffOrThrow(...HOSPITALITY);
  const id = field(data, "id");
  const onHand = amount(data, "on_hand");
  if (!id || onHand === null) return;
  await supabase
    .from("inventory_items")
    .update({ on_hand: onHand, counted_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/hospitality/food/inventory");
}
