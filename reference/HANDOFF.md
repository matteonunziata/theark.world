# ARK OS: handoff to a real codebase

## What this is
ARK OS is the operating system for The ARK (Santa Teresa, Costa Rica): a gated real estate community, members club, events and classes, and farm shop. `prototype.html` is a working single-file prototype (vanilla JS, shared key-value store). It is the visual and behavioral reference. Rebuild it properly; do not wrap it.

## Target stack
Next.js (App Router) + TypeScript + Tailwind, Supabase (Postgres, Auth, Storage, row-level security), deployed on Vercel.

## Hard requirements (not possible in the prototype)
1. Sign in with Google only. Only `@theark.world` accounts may sign in or be invited. Enforce server-side (Supabase auth hook or middleware checking the verified email domain), not just in the UI. Reject everyone else.
2. Roles from the prototype: admin, division lead, sales, facilitator, security, shop staff, maintenance crew. Enforce with RLS. Finance data is admin-only at the database level.
3. Members get a separate login to the members portal (schedule + member directory only). Members are not @theark.world, so use a different auth path (email magic link) with a strict role.
4. Event/class tickets: when someone books, email them a ticket with a QR code. Security scans the QR at the gate and sees valid / used / expired, and can check them in. Send via Resend or Postmark.
5. Public deployment on Vercel with a staging URL for testing.

## Modules in the prototype (all working)
Dashboard (setup checklist), Settings (team, divisions, access levels, organization), Events & classes (recurring classes, one-off events, facilitator assignment, ticket types with payment links, week schedule, per-session bookings, cancel single sessions, shareable links, cover photos), Members portal (live schedule, event pages, booking), Operations (task pipeline Backlog > Next up > In progress > Review > Done with drag and drop, priority, assignee, due dates), Finance (monthly revenue by line, expenses, AR, AP, cash, 6-month chart), CRM (contacts with type contact/member/steward, profile pages with notes, interests, tier, pipeline stages, sequence enrollment; Memberships and Real estate pipelines; email and WhatsApp sequences with AI drafting; send queue), Members directory (active members, cards link to CRM profile).

## Data model (collections in the prototype)
team, divisions, org (settings/org), offerings (classes+events), registrations (bookings), tasks, finance (doc id = YYYY-MM), contacts (embedded notes, stages, enrollments), sequences (embedded steps).

## Not built yet (specified, code for some in `pending-features-reference.js`)
- Farm shop: products, categories, member price, stock, low-stock alerts, quick sale/restock ledger.
- Ticket page with QR + gate check-in list ("Today's check-ins").
- Members portal tab with member directory.
- Ask AI button on every page (answers from the app's own data).
- Sample data loader/remover.
- Contacts as one list with filter pills (Everyone / Contacts / Members / Stewards).
- Real estate module (lots, deals), gate access for residents/guests/crews (PassKit), class check-in with facilitator pay tiers.

## Business rules
- Currency CRC primary, USD alongside. Languages: English first, Spanish-ready.
- Membership: Founding 100,000 CRC/month (50 spots), Standard 130,000 CRC/month, 200 members cap for 2026. Jungle Ventures members 30% off for life.
- Pause: none on 1/3/6-month terms; annual gets one free month; beyond that $50/month.
- Voice for all copy and AI drafts: invitation, not sales. Plain, warm, no hype, no exclamation marks.

## How to work
1. Read `prototype.html` first. Propose the schema and RLS plan, then stop for approval.
2. Build in this order: auth + roles + settings/team, CRM, events/classes + tickets + QR, operations, farm shop, finance, members portal, AI features.
3. Keep DECISIONS.md and OPEN_QUESTIONS.md. Write tests for the auth domain restriction and RLS.
