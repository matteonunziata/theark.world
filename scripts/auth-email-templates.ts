// Writes the Supabase Auth email templates in the ARK look.
// Run: bun scripts/auth-email-templates.ts
// Then paste each file into Supabase → Authentication → Emails.
import { writeFileSync } from "node:fs";
import { arkEmail } from "../src/lib/email-template";

const origin = "{{ .SiteURL }}";
const signIn = (heading: string, intro: string) =>
  arkEmail({
    origin,
    preheader: "Your sign-in link for The ARK. It works once and expires in an hour.",
    eyebrow: "Sign in",
    heading,
    body: `<p style="margin:0 0 18px">${intro}</p>`,
    cta: { label: "Sign in to The ARK", href: "{{ .ConfirmationURL }}" },
    footnote:
      "The link works once and expires in an hour. If you didn’t ask for it, you can ignore this email.",
  });

const files: Record<string, string> = {
  "magic-link.html": signIn(
    "Your sign-in link",
    "Tap the button to sign in. You can open it on your phone or your computer.",
  ),
  "confirm-signup.html": signIn(
    "Welcome to The ARK",
    "Tap the button to finish signing in for the first time. You can open it on any device.",
  ),
};
for (const [name, html] of Object.entries(files)) {
  writeFileSync(`supabase/templates/${name}`, html);
  console.log(`supabase/templates/${name}`);
}
