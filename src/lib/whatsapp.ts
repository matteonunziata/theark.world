// WhatsApp Business (Meta Cloud API). Business-initiated messages must use an
// approved template, so the guest pass goes out as one. Configured by env:
// WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and optionally
// WHATSAPP_GUEST_TEMPLATE (default "guest_pass") and WHATSAPP_TEMPLATE_LANG (default "en").
// The template body takes four variables: {{1}} guest first name, {{2}} host,
// {{3}} the day, {{4}} the pass link.

export const whatsappConfigured = () =>
  !!process.env.WHATSAPP_ACCESS_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID;

/** Digits only, with Costa Rica's +506 added to a local 8-digit number. */
export function waNumber(phone: string) {
  const d = phone.replace(/\D/g, "").replace(/^00/, "");
  return d.length === 8 ? `506${d}` : d;
}

export async function sendGuestPassWhatsApp(g: {
  phone: string;
  guest: string;
  host: string;
  day: string;
  url: string;
}) {
  if (!whatsappConfigured()) return false;
  const to = waNumber(g.phone);
  if (to.length < 9) return false;
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: process.env.WHATSAPP_GUEST_TEMPLATE || "guest_pass",
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" },
          components: [
            {
              type: "body",
              parameters: [g.guest.trim().split(/\s+/)[0] || "there", g.host, g.day, g.url].map((text) => ({
                type: "text",
                text,
              })),
            },
          ],
        },
      }),
    });
    if (!res.ok) console.error("WhatsApp send failed", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("WhatsApp send failed", e);
    return false;
  }
}
