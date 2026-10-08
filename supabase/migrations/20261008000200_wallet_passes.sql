-- Which Pass2U wallet pass belongs to which ticket / member pass / guest pass,
-- so tapping "Add to Wallet" twice reuses one pass instead of making two.
-- Only the server (service role) reads or writes it: RLS on, no policies.

create table public.wallet_passes (
  kind text not null check (kind in ('t', 'p', 'g')),
  token text not null,
  pass2u_id text not null,
  created_at timestamptz not null default now(),
  primary key (kind, token)
);

alter table public.wallet_passes enable row level security;
