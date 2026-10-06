-- Memberships are rows, not fields on the contact. One row per pass, term or
-- subscription, so a person can hold this month's membership and a day pass
-- for a friend's visit next month at once, and nothing overwrites anything.
-- The four columns on contacts (tier, membership_status, member_since,
-- renews_on) stay as a display cache of the current row, kept by trigger.
-- Access is decided from the rows and today's date in Costa Rica, so an
-- expired pass stops working at midnight without anyone touching it.
--
-- Day and week passes have no start date when bought: the clock starts at
-- the first check-in at the gate, and an unused pass must be used within 90
-- days (user decisions, 2026-10-05). Memberships of a month or longer keep
-- a start date. Only memberships open the members portal; pass holders get
-- the gate and the day's classes.

-- The table ------------------------------------------------------------------------

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  tier text not null references public.membership_tiers (key) on update cascade,
  -- unused: a pass waiting for its first check-in. cancelled: a subscription
  -- that won't renew but runs to ends_on. revoked: ended early (refund, staff).
  status text not null default 'active'
    check (status in ('unused', 'active', 'paused', 'cancelled', 'revoked')),
  starts_on date,
  -- Inclusive. Null means open-ended (team, ambassador, comped).
  ends_on date,
  -- Passes: the last day the first check-in can happen.
  activate_by date,
  activated_at timestamptz,
  activated_by uuid references public.team_members (id) on delete set null,
  source text not null default 'staff'
    check (source in ('stripe', 'staff', 'team', 'import')),
  payment_id uuid references public.payments (id) on delete set null,
  stripe_subscription_id text unique,
  stripe_customer_id text,
  cancelled_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text,
  notes text,
  created_by uuid references public.team_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_on is not null or status in ('unused', 'revoked')),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index memberships_contact_idx on public.memberships (contact_id);
create index memberships_payment_idx on public.memberships (payment_id) where payment_id is not null;

create trigger memberships_updated_at
  before update on public.memberships
  for each row execute function public.set_updated_at();

alter table public.memberships enable row level security;

-- Staff who can read the person read their memberships; members read their own.
-- Writes go through the functions below (and the Stripe recorder).
create policy "Read memberships" on public.memberships
  for select to authenticated
  using (public.can_read_contact(contact_id) or contact_id = public.current_member_contact_id());

-- Every scan is logged, let in or not. One admitted entry per person per day.
alter table public.gate_entries
  add column membership_id uuid references public.memberships (id) on delete set null,
  add column result text not null default 'admitted'
    check (result in ('admitted', 'checked_in', 'paused', 'not_started', 'expired', 'inactive', 'not_found')),
  add column kind text not null default 'pass' check (kind in ('pass', 'ticket', 'guest'));
create index gate_entries_contact_day_idx on public.gate_entries (contact_id, entered_at desc) where result = 'admitted';

-- A payment link of its own, so sharing it never shares the pass.
alter table public.contacts
  add column pay_token text unique
    default replace(gen_random_uuid()::text, '-', '')
      || replace(gen_random_uuid()::text, '-', '');
update public.contacts set pay_token = default where pay_token is null;
alter table public.contacts alter column pay_token set not null;

-- Which row is current ---------------------------------------------------------------

-- 0 covers the day, 1 paused, 2 unused pass still usable, 3 starts later,
-- 4 over (expired, or a pass never used in time), 9 revoked.
create or replace function public.membership_bucket(m public.memberships, d date)
returns int
language sql
immutable
set search_path = ''
as $$
  select case
    when m.status = 'revoked' then 9
    when m.status in ('active', 'cancelled') and m.starts_on <= d
      and (m.ends_on is null or m.ends_on >= d) then 0
    when m.status = 'paused' and m.starts_on <= d
      and (m.ends_on is null or m.ends_on >= d) then 1
    when m.status = 'unused' and m.activate_by >= d then 2
    when m.status in ('active', 'cancelled', 'paused') and m.starts_on > d then 3
    else 4
  end;
$$;

create or replace function public.membership_covers(m public.memberships, d date)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select public.membership_bucket(m, d) = 0;
$$;

-- The row that matters most for a person on a day: one that covers it,
-- else a paused one, else an unused pass, else the next to start, else the
-- most recent. Memberships come before passes; among passes the one that
-- must be used first.
create or replace function public.current_membership(cid uuid, d date)
returns public.memberships
language sql
stable
security definer
set search_path = ''
as $$
  select m
  from public.memberships m
  join public.membership_tiers t on t.key = m.tier
  where m.contact_id = cid and m.status <> 'revoked'
  order by public.membership_bucket(m, d),
    (t.period in ('day', 'week')),
    m.activate_by asc nulls first,
    m.ends_on desc nulls first,
    m.created_at desc
  limit 1;
$$;

-- Through the gate today: any pass or membership covering today.
create or replace function public.has_access_today(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.contact_id = cid and public.membership_covers(m, public.org_today())
  );
$$;

-- The members portal: a membership of a month or longer that hasn't ended.
-- One that starts later counts too, so a new member can book their first
-- class before they arrive. Paused members keep the portal, not the gate.
create or replace function public.is_portal_member(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    join public.membership_tiers t on t.key = m.tier
    where m.contact_id = cid
      and m.status in ('active', 'paused', 'cancelled')
      and t.period not in ('day', 'week')
      and (m.ends_on is null or m.ends_on >= public.org_today())
  );
$$;

revoke all on function public.membership_bucket(public.memberships, date) from public, anon, authenticated;
revoke all on function public.membership_covers(public.memberships, date) from public, anon, authenticated;
revoke all on function public.current_membership(uuid, date) from public, anon, authenticated;
grant execute on function public.has_access_today(uuid) to anon, authenticated;
grant execute on function public.is_portal_member(uuid) to anon, authenticated;

-- The cache on contacts ------------------------------------------------------------

-- Only this function may change tier, membership_status, member_since and
-- renews_on on a contact; a trigger puts any other change back.
create or replace function public.refresh_contact_membership(cid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d date := public.org_today();
  m public.memberships;
  b int;
  v_period text;
begin
  m := public.current_membership(cid, d);
  perform set_config('ark.membership_sync', 'on', true);
  if m.id is null then
    update public.contacts set
      tier = null, membership_status = 'active', member_since = null, renews_on = null
    where id = cid
      and (tier is not null or member_since is not null or renews_on is not null
        or membership_status <> 'active');
  else
    b := public.membership_bucket(m, d);
    select period into v_period from public.membership_tiers where key = m.tier;
    update public.contacts set
      tier = m.tier,
      membership_status = case b
        when 0 then 'active' when 1 then 'paused'
        when 2 then 'upcoming' when 3 then 'upcoming'
        else 'expired' end,
      member_since = m.starts_on,
      renews_on = m.ends_on,
      type = case when type = 'contact' and v_period not in ('day', 'week') then 'member' else type end
    where id = cid;
  end if;
  perform set_config('ark.membership_sync', 'off', true);
end;
$$;
revoke all on function public.refresh_contact_membership(uuid) from public, anon, authenticated;

create or replace function public.memberships_refresh_cache()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.refresh_contact_membership(old.contact_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.contact_id <> old.contact_id) then
    perform public.refresh_contact_membership(new.contact_id);
  end if;
  return null;
end;
$$;
create trigger memberships_refresh_cache
  after insert or update or delete on public.memberships
  for each row execute function public.memberships_refresh_cache();

create or replace function public.guard_membership_cache()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('ark.membership_sync', true), 'off') <> 'on' then
    new.tier := old.tier;
    new.membership_status := old.membership_status;
    new.member_since := old.member_since;
    new.renews_on := old.renews_on;
  end if;
  return new;
end;
$$;
create trigger contacts_guard_membership_cache
  before update of tier, membership_status, member_since, renews_on on public.contacts
  for each row execute function public.guard_membership_cache();

-- A contact added with a tier (imports, sample data, tests) gets a
-- membership row from those fields; from then on the row is the truth.
create or replace function public.contact_insert_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  d date := public.org_today();
  v_from date;
  v_to date;
begin
  if new.tier is null then return new; end if;
  v_from := coalesce(new.member_since, d);
  select case
      when new.membership_status = 'expired' then least(coalesce(new.renews_on, d - 1), d - 1)
      when t.period = 'day' then coalesce(new.renews_on, v_from)
      when t.period = 'week' then coalesce(new.renews_on, v_from + 6)
      else new.renews_on
    end into v_to
  from public.membership_tiers t where t.key = new.tier;
  if v_to is not null and v_to < v_from then v_from := v_to; end if;
  insert into public.memberships (contact_id, tier, status, starts_on, ends_on, source, created_by)
  values (new.id, new.tier,
    case when new.membership_status = 'paused' then 'paused' else 'active' end,
    v_from, v_to,
    case when new.tier = 'team' then 'team' else 'import' end, new.created_by);
  return new;
end;
$$;
create trigger contacts_insert_membership
  after insert on public.contacts
  for each row execute function public.contact_insert_membership();

-- Staff set a membership from the CRM drawer. Changing the tier ends the
-- current membership yesterday and starts the new one; "No membership"
-- revokes whatever is current or waiting.
create or replace function public.set_membership(
  p_contact uuid, p_tier text, p_status text, p_starts date, p_ends date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  d date := public.org_today();
  cur public.memberships;
  t public.membership_tiers;
  v_status text;
  v_from date;
  v_to date;
  v_id uuid;
begin
  if not public.can_write_contact(p_contact) then
    raise exception 'You can''t change this person''s membership.' using errcode = '42501';
  end if;
  cur := public.current_membership(p_contact, d);

  if nullif(trim(coalesce(p_tier, '')), '') is null then
    update public.memberships set
      status = 'revoked', revoked_at = now(), revoke_reason = 'Removed in the CRM'
    where contact_id = p_contact and status <> 'revoked'
      and public.membership_bucket(memberships, d) in (0, 1, 2, 3);
    return null;
  end if;

  select * into t from public.membership_tiers where key = p_tier;
  if not found then
    raise exception 'Unknown tier %.', p_tier using errcode = 'P0001';
  end if;

  v_status := case p_status when 'paused' then 'paused' else 'active' end;
  v_from := coalesce(p_starts, case when cur.id is not null and cur.tier = p_tier then cur.starts_on end, d);
  v_to := p_ends;
  if p_status = 'upcoming' then
    if p_starts is null or p_starts <= d then
      raise exception 'Give the date the membership starts.' using errcode = 'P0001';
    end if;
  elsif p_status = 'expired' then
    v_to := least(coalesce(p_ends, d - 1), d - 1);
    if v_from > v_to then v_from := v_to; end if;
  elsif v_to is null and t.period in ('day', 'week') then
    v_to := case when t.period = 'week' then v_from + 6 else v_from end;
  end if;
  if v_to is not null and v_to < v_from then
    raise exception 'The end date is before the start date.' using errcode = 'P0001';
  end if;

  if cur.id is not null and cur.tier = p_tier and cur.status <> 'revoked' then
    update public.memberships set
      status = v_status, starts_on = v_from, ends_on = v_to,
      activate_by = null,
      activated_at = coalesce(activated_at, case when cur.status = 'unused' then now() end),
      activated_by = coalesce(activated_by, case when cur.status = 'unused' then public.current_staff_id() end)
    where id = cur.id
    returning id into v_id;
    return v_id;
  end if;

  -- A different tier: the covering membership ends yesterday (or is
  -- revoked if it only just started), passes are left alone.
  if cur.id is not null and public.membership_bucket(cur, d) in (0, 1) then
    select * into t from public.membership_tiers where key = cur.tier;
    if t.period not in ('day', 'week') then
      if cur.starts_on < d then
        update public.memberships set ends_on = d - 1 where id = cur.id;
      else
        update public.memberships set status = 'revoked', revoked_at = now(), revoke_reason = 'Replaced in the CRM'
        where id = cur.id;
      end if;
    end if;
  end if;

  insert into public.memberships (contact_id, tier, status, starts_on, ends_on, source, created_by)
  values (p_contact, p_tier, v_status, v_from, v_to, 'staff', public.current_staff_id())
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.set_membership(uuid, text, text, date, date) from public, anon;
grant execute on function public.set_membership(uuid, text, text, date, date) to authenticated;

-- Once a day (the cron), so cached statuses roll over at midnight.
create or replace function public.refresh_membership_caches()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  cid uuid;
  n int := 0;
begin
  for cid in
    select distinct contact_id from public.memberships
    union
    select id from public.contacts where tier is not null
  loop
    perform public.refresh_contact_membership(cid);
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.refresh_membership_caches() from public, anon, authenticated;
grant execute on function public.refresh_membership_caches() to service_role;

-- Who's a member now ----------------------------------------------------------------

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.contacts c
    where c.user_id = auth.uid() and public.is_portal_member(c.id)
  );
$$;

create or replace function public.current_member_contact_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id from public.contacts c
  where c.user_id = auth.uid() and public.is_portal_member(c.id);
$$;

create or replace function public.sign_in_check(p_email text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when lower(trim(coalesce(p_email, ''))) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
      then 'Enter a valid email.'
    when exists (
      select 1 from public.team_members t
      where lower(t.email::text) = lower(trim(p_email)) and t.status = 'active'
    ) or exists (
      select 1 from public.contacts c
      where lower(c.email::text) = lower(trim(p_email)) and public.is_portal_member(c.id)
    ) then null
    when public.is_ark_email(lower(trim(p_email)))
      then 'You haven’t been added to ARK OS yet. Ask an admin to add you in Settings, Team.'
    else 'We couldn’t find that email on the team or on an active membership. Write to us and we’ll sort it out.'
  end;
$$;

create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider text := event -> 'user' -> 'app_metadata' ->> 'provider';
  v_email text := lower(coalesce(event -> 'user' ->> 'email', ''));
  v_hd text := event -> 'user' -> 'user_metadata' -> 'custom_claims' ->> 'hd';
begin
  if v_provider = 'google' then
    if public.is_ark_email(v_email) is not true
      or coalesce(v_hd, 'theark.world') <> 'theark.world' then
      return public.auth_reject(
        'Sign in with your @theark.world Google account.'
      );
    end if;
    if not exists (
      select 1 from public.team_members t
      where lower(t.email::text) = v_email and t.status = 'active'
    ) then
      return public.auth_reject(
        'You haven''t been added to ARK OS yet. Ask an admin to add you in Settings, Team.'
      );
    end if;
    return '{}'::jsonb;
  end if;

  if v_provider = 'email' then
    if exists (
      select 1 from public.team_members t
      where lower(t.email::text) = v_email and t.status = 'active'
    ) or exists (
      select 1 from public.contacts c
      where lower(c.email::text) = v_email and public.is_portal_member(c.id)
    ) then
      return '{}'::jsonb;
    end if;
    return public.auth_reject(
      'We couldn''t find that email on the team or on an active membership. Write to us and we''ll sort it out.'
    );
  end if;

  return public.auth_reject('This sign-in method isn''t available.');
end;
$$;

-- Shop member prices: anyone covered today, passes included.
create or replace function public.is_active_member(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin', 'lead', 'shop') and public.has_access_today(cid);
$$;

create or replace function public.member_directory()
returns table (
  id uuid, name text, tier text, city_id uuid, cities text[], bio text,
  interests text[], instagram text, phone text, photo_path text,
  open_to_connect boolean, is_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.tier, c.city_id, c.cities, c.bio, c.interests,
    case when c.open_to_connect then c.instagram end,
    case when c.open_to_connect then c.phone end,
    c.photo_path,
    c.open_to_connect,
    c.id = public.current_member_contact_id()
  from public.contacts c
  where (public.is_member() or public.is_staff())
    and public.is_portal_member(c.id)
    and (c.show_in_directory or c.id = public.current_member_contact_id())
  order by c.name;
$$;

create or replace function public.session_attendees(p_offering_id uuid, p_from date, p_to date)
returns table (session_date date, id uuid, name text, photo_path text, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (r.session_date, c.id)
    r.session_date, c.id, c.name, c.photo_path,
    c.id = public.current_member_contact_id()
  from public.registrations r
  join public.contacts c on c.id = r.contact_id
  where (public.is_member() or public.is_staff())
    and r.offering_id = p_offering_id
    and r.session_date between p_from and p_to
    and public.is_portal_member(c.id)
    and (c.show_in_directory or c.id = public.current_member_contact_id())
  order by r.session_date, c.id;
$$;

create or replace function public.can_message(recipient uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_member_contact_id() is not null
    and recipient <> public.current_member_contact_id()
    and public.is_portal_member(recipient)
    and exists (
      select 1 from public.contacts r
      where r.id = recipient
        and (r.open_to_connect or exists (
          select 1 from public.messages m
          where m.sender_id = recipient
            and m.recipient_id = public.current_member_contact_id()
        ))
    );
$$;

create or replace function public.marketing_list(p_list text)
returns table (contact_id uuid, name text, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (lower(x.email::text)) x.contact_id, x.name, x.email::text
  from (
    select c.id as contact_id, c.name, c.email
    from public.contacts c
    where p_list in ('waitlist', 'applicants')
      and exists (
        select 1 from public.contact_stages s
        where s.contact_id = c.id and s.pipeline = 'memberships'
          and s.stage = any (case p_list when 'waitlist' then array['waitlist']
                                         else array['invited', 'applied', 'screening'] end))
    union all
    select c.id, c.name, c.email
    from public.contacts c
    where p_list = 'members' and public.is_portal_member(c.id)
    union all
    select r.contact_id, coalesce(c.name, r.name), coalesce(c.email, r.email)
    from public.registrations r
    left join public.contacts c on c.id = r.contact_id
    where p_list = 'attendees'
  ) x
  where public.is_marketing()
    and x.email is not null
    and not exists (
      select 1 from public.contacts o
      where o.email = x.email and o.email_opt_out
    )
  order by lower(x.email::text), x.contact_id nulls last;
$$;

create or replace function public.dashboard_counts()
returns table (
  active_members bigint, active_team bigint, divisions bigint, offerings bigint,
  open_tasks bigint, overdue_tasks bigint, tasks bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(distinct m.contact_id) from public.memberships m
      join public.membership_tiers t on t.key = m.tier
      where t.period not in ('day', 'week') and public.membership_covers(m, public.org_today())),
    (select count(*) from public.team_members where status = 'active'),
    (select count(*) from public.divisions),
    (select count(*) from public.offerings),
    (select count(*) from public.tasks where status <> 'done'),
    (select count(*) from public.tasks
      where status <> 'done' and due_date < public.org_today()),
    (select count(*) from public.tasks)
  where public.is_staff();
$$;

create or replace function public.tier_counts()
returns table (tier text, active bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select m.tier, count(distinct m.contact_id) from public.memberships m
  where public.membership_covers(m, public.org_today())
    and (public.is_staff() or public.is_member())
  group by m.tier;
$$;

create or replace function public.session_roster(p_offering_id uuid, p_date date)
returns table (
  registration_id uuid, name text, photo_path text, tier text, is_member boolean,
  source text, paid boolean, qr_token text, checked_in_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, coalesce(c.name, r.name), c.photo_path, c.tier,
    coalesce(public.has_access_today(c.id), false),
    r.source, r.paid, r.qr_token, r.checked_in_at
  from public.registrations r
  left join public.contacts c on c.id = r.contact_id
  where r.offering_id = p_offering_id
    and r.session_date = p_date
    and (
      public.can_check_in(p_offering_id)
      or public.has_role('admin', 'lead', 'sales')
    )
  order by lower(coalesce(c.name, r.name));
$$;

-- Everyone on the team is also a member: one Team membership row each,
-- ended the day they leave.
create or replace function public.sync_team_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cid uuid;
  d date := public.org_today();
begin
  if new.email is null then return new; end if;
  select id into cid from public.contacts where email = new.email limit 1;

  if new.status = 'active' then
    if cid is null then
      insert into public.contacts (name, email, type, source, show_in_directory)
      values (new.name, new.email, 'member', 'Team', false)
      returning id into cid;
    end if;
    if not exists (
      select 1 from public.memberships m
      where m.contact_id = cid and m.tier = 'team' and m.status = 'active'
        and (m.ends_on is null or m.ends_on >= d)
    ) then
      insert into public.memberships (contact_id, tier, status, starts_on, source)
      values (cid, 'team', 'active', d, 'team');
    end if;
  elsif cid is not null then
    update public.memberships set status = 'revoked', revoked_at = now(), revoke_reason = 'Left the team'
    where contact_id = cid and tier = 'team' and status = 'active' and starts_on >= d;
    update public.memberships set ends_on = d - 1
    where contact_id = cid and tier = 'team' and status = 'active'
      and starts_on < d and (ends_on is null or ends_on >= d);
  end if;
  return new;
end;
$$;

-- Payments ----------------------------------------------------------------------------

-- A pass bought on Stripe waits, unused, for its first check-in. A
-- membership term starts on the chosen day, or the day after the current
-- term ends when paid early. Both are their own rows.
create or replace function public.record_stripe_payment(p jsonb)
returns table (payment_id uuid, contact_id uuid, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_session text := nullif(trim(coalesce(p ->> 'session_id', '')), '');
  v_intent text := nullif(trim(coalesce(p ->> 'payment_intent', '')), '');
  v_kind text := p ->> 'kind';
  v_email text := lower(trim(coalesce(p ->> 'email', '')));
  v_name text := nullif(trim(coalesce(p ->> 'name', '')), '');
  v_amount numeric := (p ->> 'amount')::numeric;
  v_currency text := upper(coalesce(p ->> 'currency', 'CRC'));
  v_contact uuid := nullif(p ->> 'contact_id', '')::uuid;
  v_reg uuid := nullif(p ->> 'registration_id', '')::uuid;
  v_tier text := nullif(p ->> 'tier', '');
  v_desc text := coalesce(nullif(trim(coalesce(p ->> 'description', '')), ''), 'Payment');
  v_today date := public.org_today();
  v_start date := greatest(coalesce(nullif(p ->> 'start_date', '')::date, public.org_today()), public.org_today());
  v_existing public.payments;
  t public.membership_tiers;
  v_prev date;
  v_starts date;
  v_ends date;
  v_months int;
  v_line uuid;
  v_entry uuid;
  v_id uuid;
begin
  if v_session is null then
    raise exception 'Missing Checkout session.' using errcode = 'P0001';
  end if;
  if v_kind not in ('pass', 'membership', 'ticket') then
    raise exception 'Unknown payment kind %.', v_kind using errcode = 'P0001';
  end if;

  -- The webhook and the return page can arrive together; one records it.
  perform pg_advisory_xact_lock(hashtextextended('stripe:' || v_session, 0));
  select * into v_existing from public.payments where session_id = v_session;
  if found then
    return query select v_existing.id, v_existing.contact_id, false;
    return;
  end if;

  -- Who paid.
  if v_contact is null and v_reg is not null then
    select r.contact_id into v_contact from public.registrations r where r.id = v_reg;
  end if;
  if v_contact is null and v_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    select x.id into v_contact from public.contacts x where x.email = v_email::extensions.citext;
  end if;
  if v_contact is null and v_kind in ('pass', 'membership') then
    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'A pass or membership payment needs an email.' using errcode = 'P0001';
    end if;
    insert into public.contacts (name, email, type, source)
    values (coalesce(v_name, split_part(v_email, '@', 1)), v_email, 'contact', 'Stripe')
    returning id into v_contact;
  end if;

  if v_kind in ('pass', 'membership') then
    select * into t from public.membership_tiers where key = v_tier;
    if not found then
      raise exception 'Unknown tier %.', v_tier using errcode = 'P0001';
    end if;
    perform 1 from public.contacts where id = v_contact for update;
  end if;

  if v_kind = 'pass' then
    if t.period not in ('day', 'week') then
      raise exception '% isn''t a pass.', t.name using errcode = 'P0001';
    end if;
  elsif v_kind = 'membership' then
    v_months := case t.period
      when 'month' then 1 when 'quarter' then 3 when 'half' then 6 when 'year' then 12
    end;
    if v_months is null then
      raise exception '% can''t be paid as a membership term.', t.name using errcode = 'P0001';
    end if;
    -- Paid while a membership still runs: the new term follows it.
    select max(m.ends_on) into v_prev
    from public.memberships m
    join public.membership_tiers mt on mt.key = m.tier
    where m.contact_id = v_contact and m.status in ('active', 'cancelled', 'paused')
      and mt.period not in ('day', 'week') and m.tier <> 'team'
      and m.ends_on is not null and m.ends_on >= v_start;
    v_starts := case when v_prev is not null then v_prev + 1 else v_start end;
    v_ends := (v_starts + make_interval(months => v_months))::date - 1;
  else
    if v_reg is null then
      raise exception 'A ticket payment needs its booking.' using errcode = 'P0001';
    end if;
  end if;

  -- Finance. Ticket income isn't linked to the person: the paid booking
  -- already shows on their profile, so linking both would count it twice.
  select id into v_line from public.business_lines
  where name = case when v_kind = 'ticket' then 'Events & experiences' else 'Memberships' end
  order by position limit 1;
  insert into public.finance_entries (
    kind, entry_date, business_line_id, category, party, description,
    amount, currency, method, reference, status, contact_id
  ) values (
    'income', v_today, v_line,
    case when v_kind = 'ticket' then 'Tickets' else 'Membership dues' end,
    coalesce(v_name, nullif(v_email, '')), v_desc,
    v_amount, v_currency, 'card', coalesce(v_intent, v_session), 'paid',
    case when v_kind = 'ticket' then null else v_contact end
  ) returning id into v_entry;

  insert into public.payments (
    kind, contact_id, registration_id, tier, name, email, description,
    amount, currency, starts_on, ends_on, finance_entry_id,
    session_id, payment_intent, live
  ) values (
    v_kind, v_contact, v_reg, case when v_kind = 'ticket' then null else v_tier end,
    v_name, nullif(v_email, ''), v_desc,
    v_amount, v_currency, v_starts, v_ends, v_entry,
    v_session, v_intent, coalesce((p ->> 'live')::boolean, false)
  ) returning id into v_id;

  if v_kind = 'pass' then
    insert into public.memberships (contact_id, tier, status, activate_by, source, payment_id)
    values (v_contact, t.key, 'unused', v_today + 90, 'stripe', v_id);
  elsif v_kind = 'membership' then
    insert into public.memberships (contact_id, tier, status, starts_on, ends_on, source, payment_id)
    values (v_contact, t.key, 'active', v_starts, v_ends, 'stripe', v_id);
    insert into public.contact_stages (contact_id, pipeline, stage)
    values (v_contact, 'memberships', 'active')
    on conflict (contact_id, pipeline) do update set stage = 'active', updated_at = now();
  else
    update public.registrations set paid = true where id = v_reg;
  end if;

  return query select v_id, v_contact, true;
end;
$$;

-- A full refund ends what was bought that moment (user decision). A partial
-- refund only posts to Finance.
create or replace function public.refund_stripe_payment(
  p_intent text, p_refund_id text, p_amount numeric, p_currency text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  pay public.payments;
  f public.finance_entries;
  v_full boolean;
begin
  select * into pay from public.payments where payment_intent = p_intent for update;
  if not found then
    return null;
  end if;
  if exists (
    select 1 from public.finance_entries
    where kind = 'expense' and category = 'Refunds' and reference = p_refund_id
  ) then
    return pay.id;
  end if;
  select * into f from public.finance_entries where id = pay.finance_entry_id;
  insert into public.finance_entries (
    kind, entry_date, business_line_id, category, party, description,
    amount, currency, method, reference, status
  ) values (
    'expense', public.org_today(), f.business_line_id, 'Refunds', f.party,
    'Refund: ' || pay.description, p_amount, upper(p_currency), 'card', p_refund_id, 'paid'
  );
  v_full := pay.refunded_amount + p_amount >= pay.amount;
  update public.payments set
    refunded_amount = refunded_amount + p_amount,
    status = case when v_full then 'refunded' else status end,
    refunded_at = case when v_full then now() else refunded_at end
  where id = pay.id;
  if v_full then
    if pay.kind = 'ticket' and pay.registration_id is not null then
      update public.registrations set paid = false where id = pay.registration_id;
    end if;
    update public.memberships set
      status = 'revoked', revoked_at = now(), revoke_reason = 'Refunded on Stripe'
    where payment_id = pay.id and status <> 'revoked';
  end if;
  return pay.id;
end;
$$;

-- Activity on the profile: memberships from the rows, visits only when let in.
create or replace function public.contact_activity(cid uuid)
returns table (
  at timestamptz, area text, title text, detail text, amount numeric,
  currency text, status text, link text
)
language sql
stable
security definer
set search_path = ''
as $$
  with c as (
    select * from public.contacts where id = cid and public.can_read_contact(cid)
  )
  select coalesce(m.starts_on::timestamp at time zone 'America/Costa_Rica', m.created_at), 'Membership',
         case
           when t.period in ('day', 'week') and m.status = 'unused' then coalesce(t.name, 'Pass') || ' bought, not used yet'
           when t.period in ('day', 'week') then coalesce(t.name, 'Pass')
           else 'Membership started'
         end,
         coalesce(t.name, m.tier) || coalesce(', ' || to_char(m.starts_on, 'Mon DD')
           || coalesce(' to ' || to_char(m.ends_on, 'Mon DD'), ', open-ended'), ''),
         null::numeric, null::text, m.status, null::text
  from c join public.memberships m on m.contact_id = c.id
  left join public.membership_tiers t on t.key = m.tier

  union all
  select f.entry_date::timestamp at time zone 'America/Costa_Rica', coalesce(bl.name, 'Payment'),
         coalesce(nullif(f.description, ''), nullif(f.category, ''), 'Payment'),
         nullif(concat_ws(', ', f.category, f.reference), ''),
         f.amount, f.currency, f.status, null
  from c join public.finance_entries f on f.contact_id = c.id and f.kind = 'income'
  left join public.business_lines bl on bl.id = f.business_line_id

  union all
  select m.created_at, 'Farm shop',
         p.name || case when -m.delta <> 1 then ' × ' || trim(to_char(-m.delta, 'FM999990.##')) else '' end,
         p.unit, m.amount, 'CRC', 'paid', null
  from c join public.stock_movements m on m.contact_id = c.id and m.type = 'sale'
  join public.products p on p.id = m.product_id

  union all
  select (r.session_date + coalesce(o.start_time, '00:00')) at time zone 'America/Costa_Rica', 'Classes & events',
         o.title,
         nullif(concat_ws(', ', tt.name, case when r.checked_in_at is not null then 'came' end), ''),
         nullif(tt.price, 0), tt.currency,
         case when r.paid then 'paid' else 'booked' end,
         '/t/' || r.qr_token || '?look=1'
  from c join public.registrations r
    on r.contact_id = c.id or (r.contact_id is null and c.email is not null and r.email = c.email)
  join public.offerings o on o.id = r.offering_id
  left join public.ticket_types tt on tt.id = r.ticket_type_id

  union all
  select (s.check_in + time '15:00') at time zone 'America/Costa_Rica', 'Hospitality',
         coalesce(l.listing_title, l.home_name, l.name, 'Lot ' || l.code),
         (s.check_out - s.check_in) || ' nights, ' || s.guests || ' guests',
         nullif(s.total, 0), s.currency,
         case when s.status = 'confirmed' and s.paid then 'paid' else s.status end,
         '/hospitality/' || l.id
  from c join public.stays s
    on (s.contact_id = c.id or (s.contact_id is null and c.email is not null and s.email = c.email))
   and s.kind = 'guest'
  join public.lots l on l.id = s.lot_id

  union all
  select (b.date + b.start_time) at time zone 'America/Costa_Rica', 'Courts', ct.name,
         to_char(b.start_time, 'HH24:MI') || '–' || to_char(b.end_time, 'HH24:MI'),
         null, null, b.status, null
  from c join public.court_bookings b on b.contact_id = c.id
  join public.courts ct on ct.id = b.court_id

  union all
  select g.visit_date::timestamp at time zone 'America/Costa_Rica', 'Guests', 'Invited ' || g.guest_name, null,
         null, null, g.status, null
  from c join public.guest_passes g on g.host_contact_id = c.id

  union all
  select e.entered_at, 'Visits', 'Came in', null, null, null, null, null
  from c join public.gate_entries e on e.contact_id = c.id and e.result = 'admitted'

  order by 1 desc
  limit 500;
$$;

-- The gate ----------------------------------------------------------------------------

-- What the gate needs to know about a person today.
create or replace function public.gate_state(cid uuid)
returns table (
  membership_id uuid, tier text, tier_name text, period text, state text,
  valid_from date, valid_until date, activate_by date, checked_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d date := public.org_today();
  m public.memberships;
  t public.membership_tiers;
  b int;
  v_in timestamptz;
begin
  m := public.current_membership(cid, d);
  if m.id is null then
    return query select null::uuid, null::text, null::text, null::text, 'inactive'::text,
      null::date, null::date, null::date, null::timestamptz;
    return;
  end if;
  select * into t from public.membership_tiers where key = m.tier;
  b := public.membership_bucket(m, d);
  select max(e.entered_at) into v_in
  from public.gate_entries e
  where e.contact_id = cid and e.result = 'admitted'
    and (e.entered_at at time zone (select timezone from public.org_settings))::date = d;
  return query select m.id, m.tier, t.name, t.period,
    case b
      when 0 then case when v_in is not null then 'checked_in' else 'valid' end
      when 1 then 'paused'
      when 2 then 'unused'
      when 3 then 'not_started'
      else 'expired'
    end::text,
    m.starts_on, m.ends_on, m.activate_by, v_in;
end;
$$;
revoke all on function public.gate_state(uuid) from public, anon, authenticated;

drop function if exists public.pass_by_token(text);
create function public.pass_by_token(p_token text)
returns table (
  contact_id uuid, membership_id uuid, holder text, photo_path text,
  tier text, tier_name text, period text, state text,
  valid_from date, valid_until date, activate_by date,
  checked_in_at timestamptz, last_entry_at timestamptz,
  can_log boolean, is_mine boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, s.membership_id, c.name, c.photo_path,
    s.tier, s.tier_name, s.period, s.state,
    s.valid_from, s.valid_until, s.activate_by, s.checked_in_at,
    (select max(e.entered_at) from public.gate_entries e
      where e.contact_id = c.id and e.result = 'admitted' and public.can_work_gate()),
    public.can_work_gate(),
    c.user_id is not null and c.user_id = auth.uid()
  from public.contacts c
  cross join lateral public.gate_state(c.id) s
  where c.pass_token = p_token and length(p_token) >= 32;
$$;
grant execute on function public.pass_by_token(text) to anon, authenticated;

-- A scan that came up red is logged too (once per two minutes per person,
-- so a refresh doesn't double it). Green scans are logged by the check-in.
create or replace function public.log_gate_scan(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
begin
  if not public.can_work_gate() then
    raise exception 'You can''t work the gate.' using errcode = '42501';
  end if;
  select * into p from public.pass_by_token(p_token);
  if not found then
    if not exists (
      select 1 from public.gate_entries e
      where e.contact_id is null and e.result = 'not_found' and e.entered_at > now() - interval '2 minutes'
    ) then
      insert into public.gate_entries (contact_id, logged_by, result, kind)
      values (null, public.current_staff_id(), 'not_found', 'pass');
    end if;
    return;
  end if;
  if p.state in ('valid', 'unused') then return; end if;
  if exists (
    select 1 from public.gate_entries e
    where e.contact_id = p.contact_id and e.result = p.state
      and e.entered_at > now() - interval '2 minutes'
  ) then
    return;
  end if;
  insert into public.gate_entries (contact_id, membership_id, logged_by, result, kind)
  values (p.contact_id, p.membership_id, public.current_staff_id(), p.state, 'pass');
end;
$$;
revoke all on function public.log_gate_scan(text) from public, anon;
grant execute on function public.log_gate_scan(text) to authenticated;

-- Security taps Check in. An unused pass starts today; a valid one is let
-- in; anything else is logged as refused. Twice in a day is refused too.
create or replace function public.gate_check_in(p_token text)
returns table (ok boolean, state text, entered_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  d date := public.org_today();
  c public.contacts;
  s record;
  v_at timestamptz;
begin
  if not public.can_work_gate() then
    raise exception 'You can''t work the gate.' using errcode = '42501';
  end if;
  select * into c from public.contacts
  where pass_token = p_token and length(p_token) >= 32
  for update;
  if not found then
    insert into public.gate_entries (contact_id, logged_by, result, kind)
    values (null, public.current_staff_id(), 'not_found', 'pass');
    return query select false, 'not_found'::text, null::timestamptz;
    return;
  end if;
  select * into s from public.gate_state(c.id);
  if s.state = 'unused' then
    update public.memberships set
      status = 'active', starts_on = d,
      ends_on = case when s.period = 'week' then d + 6 else d end,
      activated_at = now(), activated_by = public.current_staff_id()
    where id = s.membership_id;
  elsif s.state <> 'valid' then
    insert into public.gate_entries (contact_id, membership_id, logged_by, result, kind)
    values (c.id, s.membership_id, public.current_staff_id(), s.state, 'pass');
    return query select false, s.state::text, s.checked_in_at;
    return;
  end if;
  insert into public.gate_entries (contact_id, membership_id, logged_by, result, kind)
  values (c.id, s.membership_id, public.current_staff_id(), 'admitted', 'pass')
  returning gate_entries.entered_at into v_at;
  return query select true, 'admitted'::text, v_at;
end;
$$;
revoke all on function public.gate_check_in(text) from public, anon;
grant execute on function public.gate_check_in(text) to authenticated;

drop function if exists public.log_pass_entry(text);

-- Security finds a pass by name, phone or email when the QR won't scan.
-- Only what the gate needs comes back.
create or replace function public.gate_search(q text)
returns table (
  contact_id uuid, name text, photo_path text, phone_hint text, pass_token text,
  tier_name text, state text, valid_until date
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.photo_path,
    case when c.phone is not null then '…' || right(regexp_replace(c.phone, '\D', '', 'g'), 4) end,
    c.pass_token, s.tier_name, s.state, s.valid_until
  from public.contacts c
  cross join lateral public.gate_state(c.id) s
  where public.can_work_gate()
    and length(trim(q)) >= 2
    and (c.name ilike '%' || trim(q) || '%'
      or c.email::text ilike '%' || trim(q) || '%'
      or regexp_replace(c.phone, '\D', '', 'g') like '%' || regexp_replace(q, '\D', '', 'g') || '%'
        and length(regexp_replace(q, '\D', '', 'g')) >= 4)
  order by (s.state in ('valid', 'unused', 'checked_in')) desc, c.name
  limit 10;
$$;
revoke all on function public.gate_search(text) from public, anon;
grant execute on function public.gate_search(text) to authenticated;

-- A lost or shared pass gets a new code; the old one stops working at once.
create or replace function public.rotate_pass_token(p_contact uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if not (public.can_write_contact(p_contact) or public.has_role('security')) then
    raise exception 'You can''t replace this pass.' using errcode = '42501';
  end if;
  update public.contacts set
    pass_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  where id = p_contact
  returning pass_token into v_token;
  return v_token;
end;
$$;
revoke all on function public.rotate_pass_token(uuid) from public, anon;
grant execute on function public.rotate_pass_token(uuid) to authenticated;

create or replace function public.rotate_my_pass_token()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  update public.contacts set
    pass_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  where id = public.current_member_contact_id()
  returning pass_token into v_token;
  if v_token is null then
    raise exception 'Only members can replace their pass.' using errcode = '42501';
  end if;
  return v_token;
end;
$$;
revoke all on function public.rotate_my_pass_token() from public, anon;
grant execute on function public.rotate_my_pass_token() to authenticated;

-- Bring the current contacts over ------------------------------------------------------

insert into public.memberships (contact_id, tier, status, starts_on, ends_on, source, created_at)
select c.id, c.tier,
  case when c.membership_status = 'paused' then 'paused' else 'active' end,
  least(coalesce(c.member_since, c.created_at::date),
    case when c.membership_status = 'expired' then least(coalesce(c.renews_on, public.org_today() - 1), public.org_today() - 1)
         else coalesce(c.member_since, c.created_at::date) end),
  case
    when c.membership_status = 'expired' then least(coalesce(c.renews_on, public.org_today() - 1), public.org_today() - 1)
    when t.period = 'day' then coalesce(c.renews_on, coalesce(c.member_since, c.created_at::date))
    when t.period = 'week' then coalesce(c.renews_on, coalesce(c.member_since, c.created_at::date) + 6)
    else c.renews_on
  end,
  case when c.tier = 'team' then 'team' else 'import' end,
  c.created_at
from public.contacts c
join public.membership_tiers t on t.key = c.tier
where c.tier is not null;

select public.refresh_membership_caches();
