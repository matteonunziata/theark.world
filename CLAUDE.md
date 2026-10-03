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

## Conventions
- Supabase clients: `src/lib/supabase/client.ts` (browser), `server.ts` (Server Components / Actions), `proxy.ts` (session refresh).
- Next 16 renamed Middleware to Proxy: `src/proxy.ts`.
- Env vars live in `.env.local` (see `.env.example`).
- Supabase project: `theark` (ID `iwqxscsejpnsxfxxnmun`, us-east-1, org "ubild").
