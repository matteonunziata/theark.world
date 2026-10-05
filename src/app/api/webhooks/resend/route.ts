import { Resend } from "resend";
import type { TablesUpdate } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

// Resend tells us what happened to each marketing email: delivered, opened,
// clicked, bounced, marked as spam. Set the webhook in Resend to
// {site}/api/webhooks/resend and put its signing secret in RESEND_WEBHOOK_SECRET.

const COLUMN: Record<string, "delivered_at" | "opened_at" | "clicked_at" | "bounced_at" | "unsubscribed_at"> = {
  "email.delivered": "delivered_at",
  "email.opened": "opened_at",
  "email.clicked": "clicked_at",
  "email.bounced": "bounced_at",
  "email.complained": "unsubscribed_at",
};

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const admin = createAdminClient();
  if (!secret || !admin) return new Response("Not configured", { status: 503 });

  const payload = await request.text();
  let event: ReturnType<Resend["webhooks"]["verify"]>;
  try {
    event = new Resend(process.env.RESEND_API_KEY).webhooks.verify({
      payload,
      headers: {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
      webhookSecret: secret,
    });
  } catch {
    return new Response("Bad signature", { status: 400 });
  }

  const column = COLUMN[event.type];
  if (!column || !("email_id" in event.data)) return new Response("Ignored");
  const emailId = event.data.email_id;
  const at = new Date(event.created_at ?? Date.now()).toISOString();

  // Keep the first time each thing happened.
  const { data: send } = await admin
    .from("email_sends")
    .update({ [column]: at } as TablesUpdate<"email_sends">)
    .eq("resend_id", emailId)
    .is(column, null)
    .select("email")
    .maybeSingle();
  // Spam complaints count as unsubscribing.
  if (send && event.type === "email.complained") {
    await admin.from("contacts").update({ email_opt_out: true }).eq("email", send.email);
  }
  return new Response("OK");
}
