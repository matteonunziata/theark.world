-- Membership pricing by term, with a rack rate and a friends & family rate,
-- and guest passes: members invite guests by name, phone and email, up to a
-- monthly allowance set on their tier.

alter table public.membership_tiers
  add column price_ff numeric(14, 2) check (price_ff >= 0),
  add column guest_passes smallint not null default 0 check (guest_passes >= 0);

alter table public.membership_tiers drop constraint membership_tiers_period_check;
alter table public.membership_tiers add constraint membership_tiers_period_check
  check (period in ('day', 'week', 'month', 'quarter', 'half', 'year', 'once'));

-- The price list (rack / F&F, colones), from the team's rate card.
update public.membership_tiers set name = 'Monthly', price = 130000, price_ff = 100000,
  guest_passes = 4, position = 0 where key = 'standard';
insert into public.membership_tiers (key, name, price, price_ff, period, guest_passes, description, position)
values
  ('quarter', '3 months', 340000, 270000, 'quarter', 4, 'Three months at the club.', 1),
  ('half', '6 months', 630000, 500000, 'half', 4, 'Six months at the club.', 2)
on conflict (key) do update set price = excluded.price, price_ff = excluded.price_ff,
  period = excluded.period, guest_passes = excluded.guest_passes;
update public.membership_tiers set price = 1100000, price_ff = 900000, guest_passes = 8,
  position = 3 where key = 'annual';
update public.membership_tiers set price = 20000, price_ff = 15000, guest_passes = 0,
  position = 4 where key = 'day';
update public.membership_tiers set price = 50000, price_ff = 40000, guest_passes = 0,
  position = 5 where key = 'week';
update public.membership_tiers set guest_passes = 4, position = 6 where key = 'founding';
update public.membership_tiers set guest_passes = 4, position = 7 where key = 'ambassador';

-- Which rate a member pays.
alter table public.contacts
  add column rate text not null default 'rack' check (rate in ('rack', 'ff'));

-- Guest passes ---------------------------------------------------------------------

create table public.guest_passes (
  id uuid primary key default gen_random_uuid(),
  host_contact_id uuid not null references public.contacts (id) on delete cascade,
  guest_name text not null check (length(trim(guest_name)) > 0),
  phone text,
  email extensions.citext,
  visit_date date not null,
  token text not null unique
    default replace(gen_random_uuid()::text, '-', '')
      || replace(gen_random_uuid()::text, '-', ''),
  status text not null default 'invited' check (status in ('invited', 'used', 'cancelled')),
  used_at timestamptz,
  used_by uuid references public.team_members (id) on delete set null,
  created_by uuid references public.team_members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index guest_passes_host_idx on public.guest_passes (host_contact_id, visit_date);
create index guest_passes_date_idx on public.guest_passes (visit_date);

alter table public.guest_passes enable row level security;
create policy "Staff read guest passes" on public.guest_passes
  for select to authenticated
  using (public.has_role('admin', 'lead', 'sales', 'security', 'facilitator'));
create policy "Admins and sales manage guest passes" on public.guest_passes
  for all to authenticated
  using (public.has_role('admin', 'sales'))
  with check (public.has_role('admin', 'sales'));

-- Allowance for a member in the month of a date.
create or replace function public.guest_allowance(p_contact_id uuid, p_month date)
returns table (allowed int, used int)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(t.guest_passes, 0)::int,
    (select count(*) from public.guest_passes g
      where g.host_contact_id = c.id and g.status <> 'cancelled'
        and date_trunc('month', g.visit_date) = date_trunc('month', p_month))::int
  from public.contacts c
  left join public.membership_tiers t on t.key = c.tier
  where c.id = p_contact_id;
$$;
revoke execute on function public.guest_allowance(uuid, date) from anon, public;

-- The signed-in member: this month's and next month's allowance, and their guests.
create or replace function public.my_guests()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select public.current_member_contact_id() as id)
  select json_build_object(
    'this_month', (select row_to_json(a) from public.guest_allowance((select id from me), public.org_today()) a),
    'next_month', (select row_to_json(a) from public.guest_allowance((select id from me),
      (date_trunc('month', public.org_today()) + interval '1 month')::date) a),
    'guests', coalesce((
      select json_agg(json_build_object(
        'id', g.id, 'guest_name', g.guest_name, 'phone', g.phone, 'email', g.email,
        'visit_date', g.visit_date, 'token', g.token, 'status', g.status, 'used_at', g.used_at
      ) order by g.visit_date desc, g.created_at desc)
      from public.guest_passes g
      where g.host_contact_id = (select id from me)
        and g.visit_date >= public.org_today() - 60
    ), '[]'::json)
  )
  where (select id from me) is not null;
$$;
revoke execute on function public.my_guests() from anon, public;
grant execute on function public.my_guests() to authenticated;

create or replace function public.invite_guest(
  p_name text, p_phone text, p_email text, p_visit_date date
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_host uuid := public.current_member_contact_id();
  v_allowed int;
  v_used int;
  v_token text;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
begin
  if v_host is null then
    raise exception 'Only members can invite guests.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'Enter your guest''s name.' using errcode = 'P0001';
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email, or leave it empty.' using errcode = 'P0001';
  end if;
  if nullif(trim(coalesce(p_phone, '')), '') is null and v_email is null then
    raise exception 'Add a phone number or an email so we can send the pass.' using errcode = 'P0001';
  end if;
  if p_visit_date is null or p_visit_date < public.org_today()
    or p_visit_date > public.org_today() + 60 then
    raise exception 'Choose a day in the next two months.' using errcode = 'P0001';
  end if;

  -- One invite at a time per member, so two taps can't overspend the allowance.
  perform 1 from public.contacts where id = v_host for update;
  select allowed, used into v_allowed, v_used from public.guest_allowance(v_host, p_visit_date);
  if v_allowed = 0 then
    raise exception 'Your membership doesn''t include guest passes.' using errcode = 'P0001';
  end if;
  if v_used >= v_allowed then
    raise exception 'You''ve used all % guest passes for %.', v_allowed, to_char(p_visit_date, 'FMMonth')
      using errcode = 'P0001';
  end if;

  insert into public.guest_passes (host_contact_id, guest_name, phone, email, visit_date)
  values (v_host, trim(p_name), nullif(trim(coalesce(p_phone, '')), ''), v_email, p_visit_date)
  returning token into v_token;
  return v_token;
end;
$$;
revoke execute on function public.invite_guest(text, text, text, date) from anon, public;
grant execute on function public.invite_guest(text, text, text, date) to authenticated;

create or replace function public.cancel_guest(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.guest_passes set status = 'cancelled'
  where id = p_id and status = 'invited'
    and host_contact_id = public.current_member_contact_id();
  if not found then
    raise exception 'That invite can''t be cancelled.' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.cancel_guest(uuid) from anon, public;
grant execute on function public.cancel_guest(uuid) to authenticated;

-- What the guest's link shows, and what security sees when they scan it.
create or replace function public.guest_pass_by_token(p_token text)
returns table (
  guest_name text,
  host_name text,
  visit_date date,
  status text,
  state text,
  used_at timestamptz,
  can_log boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.guest_name, c.name, g.visit_date, g.status,
    case
      when g.status = 'cancelled' then 'cancelled'
      when g.status = 'used' then 'used'
      when g.visit_date > public.org_today() then 'upcoming'
      when g.visit_date < public.org_today() then 'expired'
      else 'valid'
    end,
    g.used_at,
    public.can_work_gate()
  from public.guest_passes g
  join public.contacts c on c.id = g.host_contact_id
  where g.token = p_token and length(p_token) >= 32;
$$;
grant execute on function public.guest_pass_by_token(text) to anon, authenticated;

create or replace function public.use_guest_pass(p_token text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.guest_passes;
  v_at timestamptz;
begin
  if not public.can_work_gate() then
    raise exception 'You can''t let guests in.' using errcode = '42501';
  end if;
  select * into g from public.guest_passes where token = p_token for update;
  if not found then
    raise exception 'Guest pass not found.' using errcode = 'P0001';
  end if;
  if g.status = 'used' then
    return g.used_at;
  end if;
  if g.status = 'cancelled' or g.visit_date <> public.org_today() then
    raise exception 'This guest pass isn''t valid today.' using errcode = 'P0001';
  end if;
  update public.guest_passes
  set status = 'used', used_at = now(), used_by = public.current_staff_id()
  where id = g.id
  returning used_at into v_at;
  return v_at;
end;
$$;
revoke execute on function public.use_guest_pass(text) from anon, public;
grant execute on function public.use_guest_pass(text) to authenticated;
