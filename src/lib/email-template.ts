// The one look for every email The ARK sends: tickets, workflow messages,
// sign-in links, passes. Table layout and inline styles, because that's what
// email clients render reliably. Pure functions, so tests and the auth
// template script can use them too.

export const BRAND = {
  bg: "#F1F3EF",
  card: "#FFFFFF",
  canopy: "#21402D",
  canopyInk: "#E7EEE6",
  canopyMuted: "#A9BCAE",
  ink: "#1C2620",
  muted: "#5B6960",
  line: "#D6DDD3",
  sea: "#1F6E7A",
  leafSoft: "#E8ECE5",
  display: "'Bricolage Grotesque','Avenir Next',Helvetica,Arial,sans-serif",
  body: "Figtree,'Avenir Next',Helvetica,Arial,sans-serif",
};

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const linkify = (html: string) =>
  html.replace(
    /(^|[^"=])(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g,
    `$1<a href="$2" style="color:${BRAND.sea}">$2</a>`,
  );

const inline = (text: string) =>
  linkify(esc(text)).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");

const safeUrl = (u: string) => (/^https:\/\/[^\s"'<>]+$/.test(u) ? u : null);

/**
 * A workflow message (as typed in the editor) to email HTML. Plain text works
 * as is; a few marks add structure:
 *   ## Heading
 *   **bold**
 *   - bullet (one per line)
 *   ![description](https://…image)
 *   [[Button text|https://…]]
 */
export function textToHtml(text: string) {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((para) => {
      const block = para.trim();
      const img = block.match(/^!\[([^\]]*)\]\((\S+)\)$/);
      if (img && safeUrl(img[2])) {
        return `<p style="margin:0 0 16px"><img src="${img[2]}" alt="${esc(img[1])}" width="460" style="display:block;width:100%;max-width:460px;height:auto;border:0;border-radius:12px"></p>`;
      }
      const btn = block.match(/^\[\[([^|\]]+)\|(\S+)\]\]$/);
      if (btn && safeUrl(btn[2])) return `<div style="margin:6px 0 18px">${button(btn[1].trim(), btn[2])}</div>`;
      const h = block.match(/^#{1,3}\s+(.+)$/);
      if (h) {
        return `<h2 style="margin:22px 0 8px;font-family:${BRAND.display};font-size:20px;line-height:1.25;color:${BRAND.ink}">${inline(h[1])}</h2>`;
      }
      const lines = block.split("\n");
      if (lines.every((l) => /^[-•]\s+/.test(l))) {
        return `<ul style="margin:0 0 16px;padding-left:20px">${lines
          .map((l) => `<li style="margin:0 0 6px">${inline(l.replace(/^[-•]\s+/, ""))}</li>`)
          .join("")}</ul>`;
      }
      return `<p style="margin:0 0 14px">${inline(block)}</p>`;
    })
    .join("");
}

/** The same message as plain text, for the text part of the email and WhatsApp. */
export function textToPlain(text: string) {
  return text
    .replace(/^!\[([^\]]*)\]\((\S+)\)$/gm, "$2")
    .replace(/^\[\[([^|\]]+)\|(\S+)\]\]$/gm, "$1: $2")
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1");
}

export function button(label: string, href: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 4px"><tr>
<td style="background:${BRAND.canopy};border-radius:999px">
<a href="${href}" style="display:inline-block;padding:13px 26px;font-family:${BRAND.body};font-size:15px;font-weight:600;color:${BRAND.canopyInk};text-decoration:none;border-radius:999px">${esc(label)}</a>
</td></tr></table>`;
}

/** A soft panel for details (date, place, code). Rows are [label, value html]. */
export function detailRows(rows: [string, string][]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.leafSoft};border-radius:12px;margin:4px 0 18px">
${rows
  .map(
    ([k, v], i) => `<tr><td style="padding:${i ? 0 : 14}px 16px ${i === rows.length - 1 ? 14 : 8}px;font-size:12px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:.06em;width:90px;vertical-align:top">${esc(k)}</td>
<td style="padding:${i ? 0 : 14}px 16px ${i === rows.length - 1 ? 14 : 8}px 0;font-size:15px;color:${BRAND.ink}">${v}</td></tr>`,
  )
  .join("")}
</table>`;
}

export type EmailParts = {
  /** Absolute origin, for the logo and footer links. */
  origin: string;
  orgName?: string;
  /** Hidden preview line shown in the inbox list. */
  preheader?: string;
  /** Small label above the heading, e.g. "Your ticket". */
  eyebrow?: string;
  heading?: string;
  /** Main content, already HTML. */
  body: string;
  cta?: { label: string; href: string };
  /** Small print under the card. */
  footnote?: string;
};

export function arkEmail(p: EmailParts) {
  const org = p.orgName ?? "The ARK";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>${esc(p.heading ?? org)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.bg};-webkit-font-smoothing:antialiased">
${p.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(p.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg}"><tr><td align="center" style="padding:32px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="background:${BRAND.canopy};border-radius:20px 20px 0 0;padding:26px 30px 22px">
<img src="${p.origin}/brand/ark-lockup-light.png" width="140" height="37" alt="${esc(org)}" style="display:block;border:0;height:37px;width:140px">
</td></tr>
<tr><td style="background:${BRAND.canopy};padding:0 30px"><div style="height:3px;width:46px;background:${BRAND.canopyMuted};border-radius:2px;opacity:.6"></div></td></tr>
<tr><td style="background:${BRAND.canopy};height:18px;line-height:18px;font-size:0">&nbsp;</td></tr>
<tr><td style="background:${BRAND.card};border-radius:0 0 20px 20px;padding:30px 30px 28px;font-family:${BRAND.body};font-size:16px;line-height:1.55;color:${BRAND.ink}">
${p.eyebrow ? `<p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${BRAND.sea}">${esc(p.eyebrow)}</p>` : ""}
${p.heading ? `<h1 style="margin:0 0 16px;font-family:${BRAND.display};font-size:26px;line-height:1.15;letter-spacing:-.01em;color:${BRAND.ink}">${esc(p.heading)}</h1>` : ""}
${p.body}
${p.cta ? button(p.cta.label, p.cta.href) : ""}
</td></tr>
<tr><td align="center" style="padding:22px 20px 0;font-family:${BRAND.body};font-size:12px;line-height:1.6;color:${BRAND.muted}">
<img src="${p.origin}/brand/ark-mark-dark.png" width="28" height="28" alt="" style="display:block;margin:0 auto 8px;border:0;opacity:.8">
${p.footnote ? `${p.footnote}<br>` : ""}${esc(org)} · Santa Teresa, Costa Rica
</td></tr>
</table></td></tr></table></body></html>`;
}
