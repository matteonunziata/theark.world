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
import { COLORS, ROLES, TYPES } from "@/lib/roles";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function saveTeamMember(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const id = field(data, "id");

  if (data.get("intent") === "delete" && id) {
    if (await isLastAdmin(supabase, id)) {
      return fail("You can’t remove the last admin.");
    }
    const { error } = await supabase.from("team_members").delete().eq("id", id);
    if (error) return fail(friendly(error));
    revalidatePath("/settings", "layout");
    return ok("Team member removed");
  }

  const name = field(data, "name");
  const email = field(data, "email")?.toLowerCase() ?? null;
  const type = field(data, "type") ?? "team";
  // Security staff see the security console and facilitators their classes, nothing else.
  const role =
    type === "security" ? "security" : type === "facilitator" ? "facilitator" : (field(data, "role") ?? "lead");
  const status = field(data, "status") === "inactive" ? "inactive" : "active";
  if (!name) return fail("Enter a name.");
  if (email && !EMAIL.test(email)) return fail("Enter a valid email.");
  if (!ROLES.some((r) => r.key === role)) return fail("Choose an access level.");
  if (!TYPES.some((t) => t[0] === type)) return fail("Choose a type.");
  if (
    field(data, "finance_role") === "sector_manager" &&
    !field(data, "division_id")
  ) {
    return fail("A sector manager needs a division. Pick one under Division.");
  }

  if (id && (role !== "admin" || status !== "active")) {
    if (await isLastAdmin(supabase, id)) {
      return fail("Keep at least one active admin.");
    }
  }

  const row = {
    name,
    email,
    role,
    type,
    status,
    title: field(data, "title"),
    division_id: field(data, "division_id"),
    finance_role: ["sector_manager", "admin"].includes(field(data, "finance_role") ?? "")
      ? field(data, "finance_role")
      : null,
    responsibilities: field(data, "responsibilities"),
    phone: field(data, "phone"),
    start_date: field(data, "start_date"),
  };
  const { error } = id
    ? await supabase.from("team_members").update(row).eq("id", id)
    : await supabase.from("team_members").insert(row);
  if (error) {
    if (error.code === "23505") return fail("Someone on the team already has that email.");
    return fail(friendly(error));
  }
  revalidatePath("/settings", "layout");
  return ok(id ? "Changes saved" : `${name} added`);
}

async function isLastAdmin(
  supabase: Awaited<ReturnType<typeof staffOrThrow>>["supabase"],
  id: string,
) {
  const { data } = await supabase
    .from("team_members")
    .select("id")
    .eq("role", "admin")
    .eq("status", "active");
  return (data ?? []).length === 1 && data?.[0].id === id;
}

export async function saveDivision(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const id = field(data, "id");

  if (data.get("intent") === "delete" && id) {
    const { error } = await supabase.from("divisions").delete().eq("id", id);
    if (error) return fail(friendly(error));
    revalidatePath("/settings", "layout");
    return ok("Division removed");
  }

  const name = field(data, "name");
  const color = field(data, "color") ?? "leaf";
  if (!name) return fail("Enter a name.");
  if (!COLORS.includes(color as (typeof COLORS)[number])) {
    return fail("Choose a color.");
  }
  const row = {
    name,
    color,
    description: field(data, "description"),
    lead_id: field(data, "lead_id"),
  };
  const { error } = id
    ? await supabase.from("divisions").update(row).eq("id", id)
    : await supabase.from("divisions").insert(row);
  if (error) return fail(friendly(error));
  revalidatePath("/settings", "layout");
  return ok(id ? "Changes saved" : `${name} added`);
}

const SUGGESTED = [
  {
    name: "Memberships",
    color: "leaf",
    description: "Waitlist, applications, member sales, and onboarding.",
  },
  {
    name: "Programming",
    color: "sun",
    description: "Classes, workshops, events, and facilitators.",
  },
  {
    name: "Real estate",
    color: "clay",
    description: "Land sales, owners, and residents.",
  },
  {
    name: "Farm & shop",
    color: "leaf",
    description: "The farm, harvests, and farm shop.",
  },
  {
    name: "Operations & maintenance",
    color: "slate",
    description: "Grounds, facilities, crews, and security.",
  },
  {
    name: "Tech & CRM",
    color: "sea",
    description: "Systems, automations, and data.",
  },
  {
    name: "Hospitality",
    color: "plum",
    description: "Food & beverage, guests, and the house.",
  },
];

export async function addSuggestedDivisions(): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const { error } = await supabase.from("divisions").insert(SUGGESTED);
  if (error) return fail(friendly(error));
  revalidatePath("/settings", "layout");
  return ok("Divisions added");
}

export async function saveOrg(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const name = field(data, "name");
  if (!name) return fail("Enter a name.");
  const currency = field(data, "currency") === "USD" ? "USD" : "CRC";
  const c2 = field(data, "currency2");
  const rate = Number(field(data, "usd_crc_rate") ?? 0);
  if (!(rate > 0)) return fail("Enter the exchange rate, colones per dollar.");
  const { error } = await supabase
    .from("org_settings")
    .update({
      name,
      location: field(data, "location") ?? "Santa Teresa, Costa Rica",
      currency,
      currency2: c2 === "USD" || c2 === "CRC" ? c2 : null,
      usd_crc_rate: rate,
      timezone: field(data, "timezone") ?? "America/Costa_Rica",
      language: field(data, "language") === "es" ? "es" : "en",
      email: field(data, "email"),
      sinpe_number: field(data, "sinpe_number"),
    })
    .eq("id", true);
  if (error) return fail(friendly(error));
  revalidatePath("/", "layout");
  return ok("Organization saved");
}

export async function saveCity(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin", "lead");
  const id = field(data, "id");
  if (data.get("intent") === "delete" && id) {
    const { error } = await supabase.from("cities").delete().eq("id", id);
    if (error) return fail(friendly(error));
    revalidatePath("/", "layout");
    return ok("City removed");
  }
  const name = field(data, "name");
  if (!name) return fail("Enter a name.");
  const row = {
    name,
    country: field(data, "country"),
    blurb: field(data, "blurb"),
    cover_path: field(data, "cover_path"),
    active: data.get("active") !== "no",
  };
  const { error } = id
    ? await supabase.from("cities").update(row).eq("id", id)
    : await supabase.from("cities").insert({ ...row, position: 50 });
  if (error) return fail(friendly(error));
  revalidatePath("/", "layout");
  return ok(id ? "City saved" : `${name} added`);
}
