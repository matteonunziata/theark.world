-- Integrations: other systems ARK OS keeps in step with. The first is
-- GoHighLevel (GHL), connected with a private integration token from the
-- sub-account. Settings → Integrations. Admin only; the token is read on the
-- server and never sent to the browser.

create table public.integrations (
  key text primary key check (key in ('ghl')),
  enabled boolean not null default false,
  -- GHL sub-account (location) the contacts live in.
  location_id text,
  -- Private integration token. Null until connected.
  secret text,
  -- Which way contacts flow: ARK OS → GHL, GHL → ARK OS, or both.
  direction text not null default 'both'
    check (direction in ('both', 'push', 'pull')),
  -- Tag put on every contact ARK OS sends, so they're easy to find in GHL.
  tag text not null default 'ark-os' check (length(trim(tag)) > 0),
  -- Shared key in the webhook address GHL posts to.
  webhook_secret text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  connected_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger integrations_updated_at before update on public.integrations
  for each row execute function public.set_updated_at();
insert into public.integrations (key) values ('ghl');

-- Which record in the other system each contact is.
create table public.integration_links (
  provider text not null references public.integrations (key) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  external_id text not null,
  synced_at timestamptz not null default now(),
  primary key (provider, contact_id),
  unique (provider, external_id)
);

-- What happened, newest first on the integration page.
create table public.integration_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null references public.integrations (key) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  kind text not null check (kind in ('test', 'sync', 'push', 'webhook')),
  ok boolean not null default true,
  detail text not null,
  contact_id uuid references public.contacts (id) on delete set null,
  created_at timestamptz not null default now()
);
create index integration_events_provider_idx
  on public.integration_events (provider, created_at desc);

alter table public.integrations enable row level security;
alter table public.integration_links enable row level security;
alter table public.integration_events enable row level security;

create policy "Admins manage integrations" on public.integrations
  for all to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "Admins manage links" on public.integration_links
  for all to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));
-- Anyone who can see a contact can see that it's linked.
create policy "Contact readers see links" on public.integration_links
  for select to authenticated using (public.can_read_contact(contact_id));

create policy "Admins read events" on public.integration_events
  for select to authenticated using (public.has_role('admin'));
create policy "Admins add events" on public.integration_events
  for insert to authenticated with check (public.has_role('admin'));
