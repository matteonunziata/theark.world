# Phase 2: capture and section mapping

Captured from https://theark.world on 2026-10-12 with Playwright. Each page folder holds:

- `content.md`: copy and structure as markdown (headings, links, image references).
- `full-text.txt`: a plain-text dump of the whole page, as a backstop. Use it when `content.md` misses text inside nested card layouts.
- `accordions.md`: every question and answer from collapsed accordions (FAQ, home, fractional ownership).
- `meta.json`: title, description, OG tags, path, CTA links, forms and the images with their source URLs.
- `assets/`: downloaded images and PDFs.
- `screenshot.png`: one full-page screenshot, to see which sections exist. It is not a design reference.
- `form-steps.json`: the field-by-field walk of the multi-step forms (stewardship application, contribute).

## Facts that apply to every page

- **Title, description and OG tags are the same site-wide on the live site** (the home page text, "The ARK - Regenerative Village in Santa Teresa, Costa Rica"). No page has its own SEO metadata. I'll write a title and description per page from the page's own copy, in the form `<Page> — The ARK, Santa Teresa`. Say if you want something different.
- **Forms:** on the live site they submit through GoHighLevel (the press form posts to a GHL webhook, and the others use the GHL embed script). **Per your instruction nothing goes to GHL.** Every form on the new pages uses your own pattern (`useActionState` plus a server action that emails the team inbox, with the honeypot).
- **Site chrome:** the live site has a promo bar ("Stage 3 pricing · next 8 lots · Download brochure"), a six-item menu (Shop, Stewardship, The Village, Visit, Contribute, Story) and a dark footer with a "Become a Steward" brochure form. The new pages use your nav and footer from the style guide.
- **Third-party widgets** that appear on several pages: a Google reviews carousel (the `★★★★★` quotes), a Playtomic link, and WhatsApp group links. Links are kept as they are. The reviews are copy, so I'd render them as quote cards (see the unmatched sections below).
- **Links to pages we are not building** (`/ark-farm`, `thearkfarm.shop`, `/ark-pass`, `/webinar`, `/ark-ventures`): see the open questions below.

## Mapping, page by page

Pattern names are from `reference/style-guide.md`. "Hero (image)", "Hero (dark)", "Section head", "Card grid", "Photo card", "Plan card", "Numbered steps", "Timeline", "Checklist", "Members band", "FAQ", "Filter pills" and "Enquiry form" already exist in your built pages. Items marked **NO MATCH** need your approval.

### `/titled-lot-ownership`: "You Dream It, We Build It"

| Live section | Maps to |
|---|---|
| Hero with two buttons (Become a steward, Lot prices) | Hero (image) |
| An Open Window: Stage 3 pricing | Plan card (featured) |
| Your Vision Fully Supported | Split: copy and image (Stay's "included" pattern) |
| Your Home Works While You Don't | Card grid |
| Every business in the village shares its success with you | Card grid |
| Find your place on the land | Photo card |
| Only 100 families… | Members band |

### `/fractional-ownership`: "The Lowest Entry — Into The ARK"

| Live section | Maps to |
|---|---|
| Hero | Hero (image) |
| Eight homes, one shared vision (masterplan) | Split: copy and image |
| Become a Seasonal Steward | Card grid |
| Built to the highest standard | Photo cards |
| The ARK Founder, Marat Omarov | Split: copy and image |
| Your weeks. Your choice. (nightly price buttons $150–$250) | **NO MATCH**: interactive price picker |
| One simple fee, everything covered (+ 2 accordion answers) | Card grid + FAQ |
| Where things stand today | Timeline |
| Video (`#fractional-video`) | **NO MATCH**: video embed |
| Only 23 shares remaining | Members band |

### `/homes-for-sale` and `/homes-for-sale/1`–`/4`

| Live section | Maps to |
|---|---|
| Hero and four listings (Ocean and Mountain View House, Casa Lilith, Casa Trinidad, Tanit Estate) | Photo card grid (Stay's `.listing`) |
| Detail: About the property, Features & amenities | Split + Checklist |
| Detail: Gallery | **NO MATCH**: photo gallery |
| Detail: "Is Sold" notice (Casa Lilith) | Status tag on the card |
| Explore more homes, "I'm interested" | Buttons / Members band |

The four detail pages use one template with the live copy for each home.

### `/live-lot-prices`

| Live section | Maps to |
|---|---|
| Intro and currency buttons (USD, CRC, EUR, CAD, CHF, ILS) | Filter pills |
| Interactive master plan map with clickable lots | **NO MATCH**: interactive map |
| Available lots inventory table with live prices | **NO MATCH**: data table |

The lot inventory is live data on the live site. I captured the map image and the first lot (Lot 23, 5,000 m², $699,710) but not the full table. See the open questions.

### `/blog`

| Live section | Maps to |
|---|---|
| Header and nine article cards (image, title, summary, date) | Photo card grid (Events' `.event-card`) |

The live blog cards have no links to article pages, so this is a list only.

### `/philosophy`

| Live section | Maps to |
|---|---|
| H.E.A.R.T. letters and five principles | **NO MATCH**: large-letter list |
| Founder photo and quote | Split: copy and image |
| "Finite Opportunity, Infinite Happiness" | Members band |
| Reviews (★★★★★ quotes) | **NO MATCH**: quote cards |

### `/become-a-steward`

A single brochure card (title, description, Download PDF, Open in new tab). Maps to Card grid plus buttons. The PDF is hosted on GHL's file CDN. I'd copy it into `public/` so the link doesn't depend on GHL.

### `/apply-stewardship`

| Live section | Maps to |
|---|---|
| Heading and intro | Hero (dark) |
| Multi-step application | **NO MATCH**: stepper form (see below) |

### `/arkadia` (public path to be chosen, see the open questions)

| Live section | Maps to |
|---|---|
| Hero (Apply, Join WhatsApp group) | Hero (image) |
| The Heart of Arkadia: four principles | Card grid |
| Why Arkadia? and what it offers | Split + Checklist |
| Reviews | **NO MATCH**: quote cards |
| Closing call to action | Members band |

### `/ark-house`

Hero, "The Vision" copy and five photos. Maps to Hero (image), Split and Photo cards.

### `/founder-bio`

| Live section | Maps to |
|---|---|
| Marat Omarov: Upbringing, Professional life, Transition, The ARK | Split (portrait) + long-form prose column |
| Conversations & Podcasts (6 embeds) | **NO MATCH**: video and podcast embeds |

### `/faq`

Hero (dark) and four groups (General, Community & Lifestyle, Amenities & Facilities, Ownership & Legal, Building & Construction) with 47 questions. Maps to FAQ (Memberships' accordion), one per group.

### `/tenet-records`

| Live section | Maps to |
|---|---|
| Hero | Hero (image) |
| Silence. Nature. Time. | Card grid |
| 5 Grammy Awards, forty years of craft (Russell Elevado, Jeff Claeys) | Photo cards |
| Purpose-built, opening soon + studio specifications | Split + Checklist |
| Selected projects | Photo card grid |

### `/press-media`

Hero (dark), then "The ARK is a story worth telling" with the inquiry form (name, company, email, phone, audience). Maps to Hero (dark) and Enquiry form. The form emails the team inbox.

### `/contribute`

Hero (dark) and one form: name, email, WhatsApp, a choice of Host a retreat/event, Teach or Perform, or Creator opportunities, "Tell us more", "What inspires you", and five link fields (Instagram, TikTok, YouTube, Website, other). Maps to Hero (dark) and Enquiry form.

### `/` (home)

| Live section | Maps to |
|---|---|
| Hero ("More Than A Home – A Whole Life", two buttons, trust line) | Hero (image) |
| Ordinary Days — Made Extraordinary (+ stewards' countries) | Card grid / Section head |
| Ways to be a steward (three cards) | Photo cards |
| Food grown steps from your kitchen | Split (links to `/ark-farm`) |
| Arkadia, The ARK House | Split |
| From overgrazed pasture to living ecosystem + community | Split + Card grid |
| The questions everyone asks first (8 answers) | FAQ |
| Finite Opportunity, Infinite Happiness | Members band |

## Sections with no match and how I'd build them

| # | Section | Where | Proposal (in your style) |
|---|---|---|---|
| 1 | Quote cards (reviews) | home, philosophy, arkadia, homes | White card, 16px radius, hairline border, stars in gold, quote in Playfair 22px, attribution in muted 16px. Same shell as the `exp` / `info-card` cards. |
| 2 | Large-letter principles (H.E.A.R.T.) | philosophy | Reuse the Courts "levels" row: a Playfair 42px letter in forest on the left, a title and one line on the right, in a white hairline card. |
| 3 | Price picker ($150–$250/night) | fractional | A row of Filter pills (Events pattern) that updates a figure in a white card. Needs the live site's underlying numbers; I only captured the button labels. |
| 4 | Video and podcast embed | fractional, founder-bio | A 16:9 frame with 16px radius and hairline border, lazy-loaded iframe, inside a card. |
| 5 | Photo gallery | homes detail | A grid of 4:3 photos (16px radius, hover zoom like the Memberships "spaces" cards). No lightbox. |
| 6 | Lot map and inventory table | live-lot-prices | The master plan image in a rounded frame, currency Filter pills, and a white card holding a plain table with hairline rows. A static table first; live prices need a data source. |
| 7 | Multi-step application | apply-stewardship | The Enquiry form shell with a "Step 1 of N" line above the fields, a Back and a Next button, and the same honeypot and status line. One server action emailing the team inbox when the last step is sent. |

## Gaps and open questions

1. **The stewardship application has more than the two steps I could reach.** Step 1 (name, email, WhatsApp) and step 2 ("About you": date of birth, nationality, city, state, country, zip, who's joining, what you do, your story) are captured in `apply-stewardship/form-steps.json`. My automated walk could not get past step 2 without submitting for real. Do you know the remaining steps, or should I build with these two steps plus an optional "anything else" box?
2. **Live lot prices.** Do you want a static lot table copied from the live page now (and updated by hand), or a live feed from your own data later? The live page's table isn't fully captured yet.
3. **Links to pages we're not building.** The live copy links to `/ark-farm`, `thearkfarm.shop`, `/ark-pass`, `/webinar` and `/ark-ventures`. Should I keep those links as they are (pointing at the live site or the shop) or drop the buttons?
4. **Home page `/`.** Your root route redirects to login. The Phase 1 question is still open: build the home page at `/` or hold it back?
5. **Arkadia's path.** Proposed: `/about-arkadia`. OK, or another name?
6. **Per-page titles and descriptions.** The live site has none, so I'll write them. OK?
7. **Brochure PDF and form.** The footer's "Download Brochure" form collects a name and email on the live site. I'd show the PDF link directly on `/become-a-steward` and send the footer form's name and email to the team inbox, then show the PDF link. OK?
8. **Size of the capture.** The folder is about 143 MB (about 51 MB of screenshots, about 92 MB of images). I'd add the screenshots to `.gitignore` and keep the images, which I need for the build.
