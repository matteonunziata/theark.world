@AGENTS.md

# The ARK (theark.world)

ARK OS: web app with a public landing page and a logged-in product.

## Stack
- Next.js 16 (App Router, `src/` dir, Turbopack), React 19, TypeScript
- Tailwind CSS v4
- Supabase (auth + Postgres) via `@supabase/ssr`
- Deploys to Vercel
- Package manager: `bun`

## Commands
```bash
bun run dev    # http://localhost:3000
bun run build
bun run lint
bunx tsc --noEmit
```

## What this is
ARK OS runs The ARK (Santa Teresa, Costa Rica): community, members club, events and classes, farm shop, land. `reference/prototype.html` is the visual and behavioral reference; `reference/HANDOFF.md` has the brief and business rules. Read `DECISIONS.md` and `OPEN_QUESTIONS.md` before changing behavior, and add to them.

Build order: auth + roles + settings, CRM, events/tickets/QR, operations, farm shop, finance, members portal, AI.

## Conventions
- Supabase clients: `src/lib/supabase/client.ts` (browser), `server.ts` (Server Components / Actions), `proxy.ts` (session refresh).
- Next 16 renamed Middleware to Proxy: `src/proxy.ts`.
- Env vars live in `.env.local` (see `.env.example`).
- Database changes go in `supabase/migrations/` and are applied with the Supabase MCP (`apply_migration`). Every table has RLS; roles come from `team_members.role` via `public.staff_role()` / `public.has_role(...)`. Re-run `supabase/tests/rls.sql` after policy changes and regenerate `src/lib/database.types.ts`.
- Staff pages live in `src/app/(staff)/` and start with `requireStaff("<module>")`; server actions use `staffOrThrow(...)`. Nav per role is in `src/lib/roles.ts`.
- Styling: the prototype's classes (`src/app/ark.css`), additions in `src/app/ark-app.css`. Forms use `<Drawer>` + server actions returning `ActionResult`.
- Copy voice: invitation, not sales. Plain, warm, no hype, no exclamation marks.
- Supabase project: `theark` (ID `iwqxscsejpnsxfxxnmun`, us-east-1, org "ubild").
