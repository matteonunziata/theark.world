# Public site style guide

Derived from the pages already built: **Courts** (`/courts`), **Memberships** (`/ark-membership`), **Stay** (`/stay`) and **Events** (`/whats-on`). The live site (theark.world, GHL Vibe) supplies content only. All design comes from this guide.

## 0. Findings that shape the work

1. **There is no shared public component library.** Each page owns its CSS file and class prefix, and repeats the same tokens:
   - Courts: `.crts-*` in `courts/courts.css`
   - Memberships: `.ms-*` in `ark-membership/membership.css`
   - Events: `.evp` (nested CSS) in `whats-on/events.css`
   - Stay: `.evp.hsp`, reusing the Events CSS and adding `stay/stay.css`
   
   The "components" below are repeating section patterns, not importable React components. A new page should either reuse the Events base (`.evp`, as Stay does) or declare its own prefix with the tokens below. It must not invent new tokens.
2. **No public Farm Shop page exists.** The only shop in the repo is `/portal/shop` (members only, `portal/shop.css`, portal `--pv-*` palette). It is a different design language, so it is not a reference for public pages. See the open question in Phase 1.
3. **Every public page is hand-composed** in one `page.tsx`: inline nav, hero, sections, footer. There is no shared header or footer component.

## 1. Tokens

| Token | Value | Use |
|---|---|---|
| forest / primary | `#2F4F3E` (hover `#24402F`) | headings, primary buttons, dark sections |
| cream / ground | `#F4F5F1` | page background (Events and Memberships add a faint 45° hatch texture) |
| panel / paper | `#E6EBE5` | alternate section background |
| white | `#FFFFFF` | cards, form shells, "white" sections |
| ink | `#10211A` | body text |
| muted / muted-2 | `#3E4E46` / `#4A5A52` | secondary text |
| gold / accent | `#E3B341` (hover `#D6A535`) | accent button, eyebrow on dark, badges (Memberships uses `#D4A663`) |
| eyebrow | `#6B5310` | eyebrow on light backgrounds |
| on-dark | `#E7EEE9`, muted `#C9D6CE`, faint `#A9BAB0` | text on forest |
| hairline | `rgba(47,79,62,.22)` | borders, `.5px` |
| field border | `rgba(47,79,62,.45)` | inputs |
| placeholder | `#DCE3DC` | empty image wells |

- **Type:** Playfair Display for h1–h3 (weight 400, never bold). DM Sans for everything else. Load with `<ArkFonts />` at the top of each page.
- **Sizes:** body 17–18px, line-height 1.7–1.8. h1 `clamp(46px, 6vw, 76px)`. h2 `clamp(30px, 4vw, 48px)`. h3 22–30px. Card text 16px.
- **Eyebrow:** 13–14px, uppercase, `.16em` tracking, rust `#6B5310` (gold on dark).
- **Radii:** 16px for boxes and cards, 10px for buttons and tags (Memberships uses 12px buttons).
- **Spacing:** section padding `clamp(56px, 8vw, 112px)` vertical and 2rem (or `clamp(16px, 4vw, 48px)`) horizontal. Content width `max-width: 1400px`, centred in `.wrap`. Inner gaps are 16, 24, 32, 40 or 56px.
- **Borders:** `.5px solid var(--hairline)`. Cards are flat, with no shadows.
- **Focus:** `2px` gold outline, `2px` offset.
- **Motion:** minimal. Button hover colour (`.2s`), image zoom `scale(1.04)` over `.6s` on Spaces cards. No scroll animations.
- **Images:** `object-fit: cover`, rounded 16px, fixed heights (240–260px) or `aspect-ratio: 4/3`. Heroes use a full-bleed `<Image fill priority>` with a forest gradient overlay (`rgba(24,44,33,.5–.85)`) and a text-shadow on copy.
- **Responsive:** flex-wrap with `flex: 1 1 <basis>` and `grid auto-fit minmax(...)`. Nav links hide under about 820px.

## 2. Page skeleton

```
<main className="<prefix>">
  <ArkFonts />
  <header>  nav </header>
  hero → sections… → closing band → form section → <footer className="dark">
</main>
```

- **Metadata:** `title: { absolute: "<Page> — The ARK, Santa Teresa" }` plus a one-sentence `description`.
- **Nav:** sticky or static bar on cream with a bottom hairline. `<Logo tone="dark" height={40} />` on the left. Anchor links in uppercase 13px with `.08em` tracking in the middle. On the right, "Sign in" and a small primary button. A signed-in member sees a single "Sign in" button to the portal, and staff see "Staff view".
- **Footer:** `.dark`, `<Logo kind="mark" tone="light" height={32}>` and "Santa Teresa, Costa Rica" on the left. Three or four links on the right (Membership, Courts, Stay, Sign in), 14px in on-dark-faint.

## 3. Section patterns (the "components")

| Pattern | Look | Use it for | Where it exists |
|---|---|---|---|
| **Hero (image)** | Full-bleed photo, forest gradient, eyebrow, h1, lede, 1–2 buttons | Page entry for pages with a strong photo | Courts, Stay |
| **Hero (dark, text)** | Solid forest, eyebrow, h1, sub, button row | Pages without a hero photo | Events |
| **Hero + side card** | Copy on the left, price or featured card on the right | Pages with one key fact or offer | Courts (`crts-prices`), Events (`featured`) |
| **Section head** | Eyebrow + h2 on the left, short paragraph (max 40–42ch) on the right | Opens every content section | all |
| **Card grid** | White card, 16px radius, hairline border, h3, 16px paragraph, 24–32px padding. `grid auto-fit minmax(260–280px, 1fr)` | Info, experiences, perks, FAQ-like facts | Stay `.exp`, `.info-card`; Courts `crts-info-card` |
| **Photo card** | 4:3 or 240–260px image, h3, one line, optional meta and button | Spaces, homes, events, products | Memberships `.ms-spaces`, Stay `.listing`, Events `.event-card` |
| **Plan / price card** | White card, tag or badge, price in Playfair 40px, checklist, button. The featured one is forest with a gold button | Prices, plans | Memberships `.ms-plan`, Stay `.plan` |
| **Numbered steps** | Number in Playfair (gold on dark), bold title, one line, outlined row | How it works | Courts `crts-steps`, Memberships `.ms-how` |
| **Timeline** | Dots and a line, time in rust, Playfair title, place | A day or sequence | Memberships `.ms-day` |
| **Checklist** | Green tick icon + 16px line | Features and inclusions | Stay `.checks`, Memberships plans |
| **Members band** | Forest rounded box, h3 30px, one line, gold + ghost-light buttons | Closing call to action | Courts, Events, Stay |
| **FAQ** | `<details>`-style accordion on cream or white | Questions | Memberships |
| **Filter pills / tabs** | White pill, `.5px` border, active = forest with cream text | Filtering lists | Events, Memberships schedule |
| **Enquiry form** | `.host-form`: white 16px card, 2-col auto-fit grid, labels above fields, honeypot, status line + submit | Any contact or request | Events `HostForm`, Stay `EnquiryForm` |
| **Alternating backgrounds** | cream → panel (`#E6EBE5` + texture) → white → forest | Rhythm between sections | all |

**Buttons:** primary = forest fill, cream text. Accent = gold fill, ink text (the main button on dark backgrounds). Ghost = forest outline. Ghost-light = on-dark outline (for dark backgrounds). Small = 38px high. Default 44px or more. Button text is sentence case, 15–16px, weight 500.

## 4. Forms

- A client component using `useActionState(action, { ok: false } as ActionResult)`. The server action in `actions.ts` is marked `"use server"` and returns `ok(message)` or `fail(message)` from `@/lib/action-result`.
- Always includes the honeypot `<input name="ms_trap_x" className="hp" tabIndex={-1} aria-hidden>`. When it is filled in, the action returns a fake success.
- Validation messages are short and in sentences ("Add your name.").
- Submit emails the team inbox from `org_settings.email` via `sendEmail`. Enquiry forms store nothing. Booking forms call a Supabase RPC.
- Reply copy: "We reply within a day or two." The success text replaces the form.

## 5. Copy voice

From `CLAUDE.md`: invitation, not sales. Plain, warm, no hype, **no exclamation marks**. Use curly apostrophes (’). Prices are shown with `money()` from `@/lib/schedule`. Dates use `fmtDate` from `@/lib/dates`.

## 6. Conventions for new pages

1. Place pages under `src/app/(public)/<path>/page.tsx`, with the URL path matching the live site.
2. Pick the base: reuse the Events `.evp` CSS (as Stay does) so nav, hero, cards, band, host form and footer come for free. Add a small page CSS file for anything new.
3. Do not copy colours, fonts or spacing from the live site. Content only: copy, images, URLs, metadata and form targets.
4. Images from the live site go in `public/` (or are referenced from the existing CDN as Memberships does), through `next/image` for heroes and `<img loading="lazy">` for grids.
5. Forms follow section 4. A form that posts to an outside endpoint on the live site keeps the same destination (see Phase 2 notes).
6. A new section pattern needs approval before it is built (see the Phase 2 mapping).
