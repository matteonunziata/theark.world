"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type ActionResult, fail, field, friendly, ok } from "@/lib/action-result";
import { staffOrThrow } from "@/lib/auth";
import { siteUrl } from "@/lib/email";
import {
  fromCrLocal,
  isBrand,
  isChannel,
  STAGES,
  slug,
  toCrLocal,
  withUtm,
} from "@/lib/marketing";
import { marketingEmailReady, runAutomation, sendCampaign, sendTest } from "@/lib/marketing-email";

const team = () => staffOrThrow("admin", "marketing");
const done = (message: string, path = "/marketing") => {
  revalidatePath(path, "layout");
  return ok(message);
};
const brandsOf = (data: FormData) => data.getAll("brands").map(String).filter(isBrand);
const ids = (data: FormData, name: string) =>
  data.getAll(name).map(String).filter((v) => /^[0-9a-f-]{36}$/.test(v));
const int = (data: FormData, name: string) => {
  const v = field(data, name);
  return v === null ? null : Math.max(0, Math.round(Number(v))) || 0;
};

// Strategy -------------------------------------------------------------------

const STRATEGY_FIELDS = ["story", "audience", "key_messages", "pillars", "tone", "channels", "goals"] as const;

export async function saveStrategy(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase, staff } = await team();
  const brand = field(data, "brand");
  if (!isBrand(brand)) return fail("Pick a brand.");
  const row = Object.fromEntries(STRATEGY_FIELDS.map((f) => [f, field(data, f)]));
  const { error } = await supabase
    .from("brand_strategies")
    .update({ ...row, updated_by: staff.id, updated_at: new Date().toISOString() })
    .eq("brand", brand);
  if (error) return fail(friendly(error));
  return done("Strategy saved");
}

export async function addReference(brand: string, ref: { path?: string; url?: string; caption?: string }) {
  const { supabase, staff } = await team();
  if (!isBrand(brand)) return fail("Pick a brand.");
  const url = ref.url?.trim();
  if (url && !/^https?:\/\/\S+$/.test(url)) return fail("Links start with https://");
  if (!ref.path && !url) return fail("Add a photo or a link.");
  const { error } = await supabase.from("brand_refs").insert({
    brand,
    path: ref.path ?? null,
    url: url || null,
    caption: ref.caption?.trim() || null,
    created_by: staff.id,
  });
  if (error) return fail(friendly(error));
  return done("Added to the moodboard");
}

export async function removeReference(id: string) {
  const { supabase } = await team();
  const { data: r } = await supabase.from("brand_refs").select("path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("brand_refs").delete().eq("id", id);
  if (error) return fail(friendly(error));
  if (r?.path && !r.path.startsWith("/") && !r.path.startsWith("https://")) {
    await supabase.storage.from("marketing").remove([r.path]);
  }
  return done("Removed");
}

// Assets ---------------------------------------------------------------------

export async function saveAsset(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase, staff } = await team();
  const id = field(data, "id");
  if (data.get("intent") === "delete" && id) {
    const { data: a } = await supabase.from("marketing_assets").select("path").eq("id", id).maybeSingle();
    const { error } = await supabase.from("marketing_assets").delete().eq("id", id);
    if (error) return fail(friendly(error));
    if (a?.path && !a.path.startsWith("/") && !a.path.startsWith("https://")) {
      await supabase.storage.from("marketing").remove([a.path]);
    }
    return done("Asset deleted");
  }
  const kind = field(data, "kind");
  if (kind !== "photo" && kind !== "video" && kind !== "copy") return fail("Choose photo, video or copy.");
  const title = field(data, "title");
  if (!title) return fail("Give it a title.");
  const path = field(data, "path");
  const body = field(data, "body");
  if (kind !== "copy" && !path) return fail("Upload the file first.");
  if (kind === "copy" && !body) return fail("Write the copy.");
  const row = {
    title,
    kind,
    path: kind === "copy" ? null : path,
    body: kind === "copy" ? body : field(data, "body"),
    brands: brandsOf(data),
    tags: (field(data, "tags") ?? "")
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 20),
  };
  const { error } = id
    ? await supabase.from("marketing_assets").update(row).eq("id", id)
    : await supabase.from("marketing_assets").insert({ ...row, created_by: staff.id });
  if (error) return fail(friendly(error));
  return done(id ? "Asset saved" : "Added to the library");
}

// Content pipeline ------------------------------------------------------------

export async function saveItem(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase, staff } = await team();
  const id = field(data, "id");
  if (data.get("intent") === "delete" && id) {
    const { error } = await supabase.from("content_items").delete().eq("id", id);
    if (error) return fail(friendly(error));
    return done("Item deleted");
  }
  const title = field(data, "title");
  if (!title) return fail("Give it a title.");
  const stage = field(data, "stage") ?? "idea";
  if (!STAGES.some((s) => s[0] === stage)) return fail("Choose a stage.");
  const row = {
    title,
    brief: field(data, "brief"),
    brands: brandsOf(data),
    stage,
    assignee_id: field(data, "assignee_id"),
    due_date: field(data, "due_date"),
  };
  const res = id
    ? await supabase.from("content_items").update(row).eq("id", id).select("id").single()
    : await supabase.from("content_items").insert({ ...row, created_by: staff.id }).select("id").single();
  if (res.error) return fail(friendly(res.error));
  const itemId = res.data.id;
  const assets = ids(data, "asset_ids");
  await supabase.from("content_item_assets").delete().eq("item_id", itemId);
  if (assets.length) {
    const { error } = await supabase
      .from("content_item_assets")
      .insert(assets.map((asset_id) => ({ item_id: itemId, asset_id })));
    if (error) return fail(friendly(error));
  }
  return done(id ? "Item saved" : "Item added");
}

export async function moveItem(id: string, stage: string): Promise<ActionResult> {
  const { supabase } = await team();
  if (!STAGES.some((s) => s[0] === stage)) return fail("Choose a stage.");
  const { error } = await supabase.from("content_items").update({ stage }).eq("id", id);
  if (error) return fail(friendly(error));
  revalidatePath("/marketing", "layout");
  return ok("");
}

export async function addComment(itemId: string, body: string): Promise<ActionResult> {
  const { supabase, staff } = await team();
  if (!body.trim()) return fail("Write a comment first.");
  const { error } = await supabase
    .from("content_comments")
    .insert({ item_id: itemId, body: body.trim(), author_id: staff.id });
  if (error) return fail(friendly(error));
  return done("Comment added");
}

// Social ----------------------------------------------------------------------

export async function savePost(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase, staff } = await team();
  const id = field(data, "id");
  if (data.get("intent") === "delete" && id) {
    const { error } = await supabase.from("social_posts").delete().eq("id", id);
    if (error) return fail(friendly(error));
    return done("Post deleted");
  }
  const when = field(data, "when");
  if (!when || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when)) return fail("Pick a date and time.");
  const channels = data.getAll("channels").map(String).filter(isChannel);
  if (!channels.length) return fail("Pick at least one channel.");
  const status = field(data, "status") ?? "draft";
  if (!["draft", "ready", "published"].includes(status)) return fail("Choose a status.");
  const brands = brandsOf(data);
  const caption = field(data, "caption") ?? "";
  let link = field(data, "link");
  if (link) {
    if (!/^https?:\/\/\S+$/.test(link)) return fail("The link should start with https://");
    link = withUtm(link, {
      source: channels[0],
      medium: "social",
      campaign: slug(caption.split("\n")[0] || "post") || "post",
      content: brands[0],
    });
  }
  const row = {
    caption,
    brands,
    channels,
    scheduled_at: fromCrLocal(when),
    status,
    link,
    content_item_id: field(data, "content_item_id"),
    reach: int(data, "reach"),
    likes: int(data, "likes"),
    comments: int(data, "comments"),
    shares: int(data, "shares"),
    saves: int(data, "saves"),
    updated_at: new Date().toISOString(),
  };
  const res = id
    ? await supabase.from("social_posts").update(row).eq("id", id).select("id, published_at").single()
    : await supabase.from("social_posts").insert({ ...row, created_by: staff.id }).select("id, published_at").single();
  if (res.error) return fail(friendly(res.error));
  const postId = res.data.id;
  if (status === "published" && !res.data.published_at) {
    await supabase.from("social_posts").update({ published_at: new Date().toISOString() }).eq("id", postId);
  } else if (status !== "published" && res.data.published_at) {
    await supabase.from("social_posts").update({ published_at: null }).eq("id", postId);
  }
  const assets = ids(data, "asset_ids");
  await supabase.from("social_post_assets").delete().eq("post_id", postId);
  if (assets.length) {
    const { error } = await supabase
      .from("social_post_assets")
      .insert(assets.map((asset_id, position) => ({ post_id: postId, asset_id, position })));
    if (error) return fail(friendly(error));
  }
  return done(id ? "Post saved" : "Post planned");
}

/** Move a post to another day, keeping its time of day. */
export async function reschedulePost(id: string, date: string): Promise<ActionResult> {
  const { supabase } = await team();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Pick a day.");
  const { data: p } = await supabase.from("social_posts").select("scheduled_at, status").eq("id", id).single();
  if (!p) return fail("Post not found.");
  if (p.status === "published") return fail("Published posts stay where they are.");
  const time = toCrLocal(p.scheduled_at).slice(11, 16);
  const { error } = await supabase
    .from("social_posts")
    .update({ scheduled_at: fromCrLocal(`${date}T${time}`), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail(friendly(error));
  revalidatePath("/marketing", "layout");
  return ok("Moved");
}

export async function markPublished(id: string): Promise<ActionResult> {
  const { supabase } = await team();
  const { error } = await supabase
    .from("social_posts")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail(friendly(error));
  return done("Marked as published");
}

// Email -----------------------------------------------------------------------

const LIST_KEYS = ["waitlist", "applicants", "members", "attendees"];

export async function createCampaign(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase, staff } = await team();
  const name = field(data, "name");
  if (!name) return fail("Name the campaign.");
  const list = field(data, "list_key") ?? "waitlist";
  if (!LIST_KEYS.includes(list)) return fail("Choose a list.");
  const { data: c, error } = await supabase
    .from("email_campaigns")
    .insert({ name, list_key: list, brands: brandsOf(data), created_by: staff.id })
    .select("id")
    .single();
  if (error) return fail(friendly(error));
  revalidatePath("/marketing", "layout");
  redirect(`/marketing/email/${c.id}`);
}

export async function saveCampaign(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await team();
  const id = field(data, "id");
  if (!id) return fail("Campaign not found.");
  if (data.get("intent") === "delete") {
    const { error } = await supabase.from("email_campaigns").delete().eq("id", id).neq("status", "sent");
    if (error) return fail(friendly(error));
    revalidatePath("/marketing", "layout");
    redirect("/marketing/email");
  }
  const name = field(data, "name");
  if (!name) return fail("Name the campaign.");
  const list = field(data, "list_key") ?? "waitlist";
  if (!LIST_KEYS.includes(list)) return fail("Choose a list.");
  const { error } = await supabase
    .from("email_campaigns")
    .update({
      name,
      list_key: list,
      brands: brandsOf(data),
      subject: field(data, "subject") ?? "",
      body: field(data, "body") ?? "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("status", ["draft", "scheduled"]);
  if (error) return fail(friendly(error));
  return done("Campaign saved");
}

const noEmail = () => fail("Email isn’t set up yet. Add RESEND_API_KEY to send.");

export async function testCampaign(id: string): Promise<ActionResult> {
  const { supabase, staff } = await team();
  if (!marketingEmailReady()) return noEmail();
  if (!staff.email) return fail("Your team profile has no email to send the test to.");
  const { data: c } = await supabase.from("email_campaigns").select("*").eq("id", id).single();
  if (!c) return fail("Campaign not found.");
  if (!c.subject.trim() || !c.body.trim()) return fail("Save a subject and a message first.");
  try {
    await sendTest(supabase, { to: staff.email, name: staff.name, subject: c.subject, body: c.body, utmCampaign: slug(c.name) }, await siteUrl());
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn’t send the test.");
  }
  return ok(`Test sent to ${staff.email}`);
}

export async function sendCampaignNow(id: string): Promise<ActionResult> {
  const { supabase } = await team();
  if (!marketingEmailReady()) return noEmail();
  try {
    const n = await sendCampaign(supabase, id, await siteUrl());
    revalidatePath("/marketing", "layout");
    return ok(`Sent to ${n} ${n === 1 ? "person" : "people"}`);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn’t send the campaign.");
  }
}

export async function scheduleCampaign(id: string, when: string | null): Promise<ActionResult> {
  const { supabase } = await team();
  if (when === null) {
    const { error } = await supabase
      .from("email_campaigns")
      .update({ status: "draft", scheduled_at: null })
      .eq("id", id)
      .eq("status", "scheduled");
    if (error) return fail(friendly(error));
    return done("Back to draft");
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when)) return fail("Pick a date and time.");
  const at = fromCrLocal(when);
  if (new Date(at) < new Date()) return fail("Pick a time in the future.");
  const { data: c } = await supabase.from("email_campaigns").select("subject, body").eq("id", id).single();
  if (!c?.subject.trim() || !c.body.trim()) return fail("Save a subject and a message first.");
  const { error } = await supabase
    .from("email_campaigns")
    .update({ status: "scheduled", scheduled_at: at })
    .eq("id", id)
    .in("status", ["draft", "scheduled"]);
  if (error) return fail(friendly(error));
  return done("Campaign scheduled");
}

export async function saveAutomation(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await team();
  const url = field(data, "application_url");
  if (url && !/^https:\/\/\S+$/.test(url)) return fail("The application link should start with https://");
  const { error } = await supabase
    .from("email_automations")
    .update({
      active: data.get("active") === "on",
      welcome_subject: field(data, "welcome_subject") ?? "",
      welcome_body: field(data, "welcome_body") ?? "",
      followup_days: Math.min(60, Math.max(0, Number(field(data, "followup_days") ?? 3) || 0)),
      followup_subject: field(data, "followup_subject") ?? "",
      followup_body: field(data, "followup_body") ?? "",
      application_url: url,
      updated_at: new Date().toISOString(),
    })
    .eq("key", "waitlist");
  if (error) return fail(friendly(error));
  return done("Automation saved");
}

export async function testAutomation(step: "welcome" | "followup"): Promise<ActionResult> {
  const { supabase, staff } = await team();
  if (!marketingEmailReady()) return noEmail();
  if (!staff.email) return fail("Your team profile has no email to send the test to.");
  const { data: a } = await supabase.from("email_automations").select("*").eq("key", "waitlist").single();
  if (!a) return fail("Automation not found.");
  const subject = step === "welcome" ? a.welcome_subject : a.followup_subject;
  const body = step === "welcome" ? a.welcome_body : a.followup_body;
  if (!subject.trim() || !body.trim()) return fail("Save a subject and a message first.");
  try {
    await sendTest(
      supabase,
      { to: staff.email, name: staff.name, subject, body, utmCampaign: `waitlist-${step}`, applicationUrl: a.application_url },
      await siteUrl(),
    );
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn’t send the test.");
  }
  return ok(`Test sent to ${staff.email}`);
}

/** Send whatever the automation has due now, instead of waiting for the daily run. */
export async function runAutomationNow(): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  if (!marketingEmailReady()) return noEmail();
  const n = await runAutomation(supabase, await siteUrl());
  revalidatePath("/marketing", "layout");
  return ok(n ? `Sent ${n} ${n === 1 ? "email" : "emails"}` : "Nothing due right now");
}
