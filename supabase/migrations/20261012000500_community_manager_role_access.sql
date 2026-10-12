-- Community manager access level, and editable page access per level.
-- A role with no row here uses the defaults in src/lib/roles.ts.

alter table public.team_members drop constraint team_members_role_check;
alter table public.team_members add constraint team_members_role_check
  check (role in ('admin', 'lead', 'sales', 'facilitator', 'security', 'shop', 'crew', 'marketing', 'community_manager'));

create table public.role_access (
  role text primary key
    check (role in ('lead', 'sales', 'facilitator', 'security', 'shop', 'crew', 'marketing', 'community_manager')),
  modules text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.role_access enable row level security;

create policy role_access_read on public.role_access
  for select to authenticated using (public.staff_role() is not null);
create policy role_access_admin on public.role_access
  for all to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));
