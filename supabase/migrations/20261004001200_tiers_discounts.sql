-- Membership tiers and discounts, editable by admins.

create table public.membership_tiers (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  name text not null check (length(trim(name)) > 0),
  price numeric(14, 2) check (price >= 0),
  currency text not null default 'CRC' check (currency in ('CRC', 'USD')),
  period text not null default 'month'
    check (period in ('day', 'week', 'month', 'year', 'once')),
  spots int check (spots > 0),
  description text,
  perks text[] not null default '{}',
  pause_rule text,
  position int not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger membership_tiers_updated_at before update on public.membership_tiers
  for each row execute function public.set_updated_at();

insert into public.membership_tiers (key, name, price, period, spots, description, perks, pause_rule, position) values
  ('founding', 'Founding', 100000, 'month', 50,
   'The first fifty. The lowest rate, kept for life.',
   '{"All classes included","Cowork, spa deck and courts","Member price at the farm shop","Founding members evenings"}',
   'No pause on 1, 3 or 6-month terms. Annual: one free month, then $50 a month.', 0),
  ('standard', 'Standard', 130000, 'month', null,
   'Full membership of the club.',
   '{"All classes included","Cowork, spa deck and courts","Member price at the farm shop"}',
   'No pause on 1, 3 or 6-month terms. Annual: one free month, then $50 a month.', 1),
  ('annual', 'Annual', null, 'year', null, 'A year up front.', '{}',
   'One free month of pause, then $50 a month.', 2),
  ('ambassador', 'Ambassador', null, 'month', null, 'By invitation.', '{}', null, 3),
  ('day', 'Day pass', null, 'day', null, 'One day at the club.', '{}', null, 4),
  ('week', 'Week pass', null, 'week', null, 'A week at the club.', '{}', null, 5);

create table public.discounts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  percent numeric(5, 2) not null check (percent > 0 and percent <= 100),
  lifetime boolean not null default false,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.discounts (name, percent, lifetime, description) values
  ('Jungle Ventures', 30, true, 'Jungle Ventures members, 30% off for life.');

alter table public.contacts drop constraint contacts_tier_check;
alter table public.contacts
  add constraint contacts_tier_fkey foreign key (tier)
  references public.membership_tiers (key) on update cascade on delete set null;
alter table public.contacts
  add column discount_id uuid references public.discounts (id) on delete set null;
create index contacts_discount_idx on public.contacts (discount_id);

alter table public.org_settings add column member_cap int default 200;

alter table public.membership_tiers enable row level security;
alter table public.discounts enable row level security;

create policy "Staff and members read tiers" on public.membership_tiers
  for select to authenticated using (public.is_staff() or public.is_member());
create policy "Admins write tiers" on public.membership_tiers
  for all to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "Staff read discounts" on public.discounts
  for select to authenticated using (public.is_staff());
create policy "Admins write discounts" on public.discounts
  for all to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- Spots taken per tier (active members), for anyone who can see tiers.
create or replace function public.tier_counts()
returns table (tier text, active bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select c.tier, count(*) from public.contacts c
  where c.tier is not null and c.membership_status = 'active'
    and (public.is_staff() or public.is_member())
  group by c.tier;
$$;
revoke execute on function public.tier_counts() from anon, public;
grant execute on function public.tier_counts() to authenticated;
