-- Active Stewardship: status with history, the signed agreement, the 48-month
-- profit-share clock (derived from active_since), and gate access for stewards.
-- Active = agreement signed AND fees current (no property invoice more than
-- grace_days overdue). Leaving active for any reason clears active_since.

create table public.steward_rules (
  id boolean primary key default true check (id),
  grace_days int not null default 30 check (grace_days >= 0),
  months_to_eligible int not null default 48 check (months_to_eligible > 0),
  auto_activate boolean not null default false   -- false: an admin confirms activation
);
insert into public.steward_rules default values;

create table public.stewardships (
  contact_id uuid primary key references public.contacts (id) on delete cascade,
  status text not null default 'inactive' check (status in ('active', 'inactive', 'suspended')),
  agreement_signed_at date,
  agreement_path text,        -- private 'stewardship' bucket
  agreement_name text,
  active_since date,
  status_reason text,
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check ((status = 'active') = (active_since is not null))
);

create table public.steward_status_history (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  from_status text,
  to_status text not null,
  source text not null check (source in ('admin', 'steward', 'system')),
  changed_by uuid references public.team_members (id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);
create index steward_status_history_idx on public.steward_status_history (contact_id, created_at desc);

alter table public.steward_rules enable row level security;
alter table public.stewardships enable row level security;
alter table public.steward_status_history enable row level security;
-- Reads only. Every change goes through the functions below, which write the history.
create policy "Signed-in users read the rules" on public.steward_rules
  for select to authenticated using (true);
create policy "Admins change the rules" on public.steward_rules
  for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));
create policy "Estate staff read stewardships" on public.stewardships
  for select to authenticated using (public.is_estate_staff());
create policy "Stewards read their own" on public.stewardships
  for select to authenticated using (contact_id = public.current_member_contact_id());
create policy "Estate staff read history" on public.steward_status_history
  for select to authenticated using (public.is_estate_staff());

-- Everyone linked to a property has a stewardship row.
insert into public.stewardships (contact_id)
select distinct contact_id from public.property_stewards on conflict do nothing;

create or replace function public.ensure_stewardship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.stewardships (contact_id) values (new.contact_id) on conflict do nothing;
  return new;
end $$;
create trigger property_stewards_ensure_stewardship
  after insert on public.property_stewards
  for each row execute function public.ensure_stewardship();

-- Signed agreements: private.
insert into storage.buckets (id, name, public) values ('stewardship', 'stewardship', false)
on conflict (id) do nothing;
create policy "Estate staff read stewardship files" on storage.objects
  for select to authenticated using (bucket_id = 'stewardship' and public.is_estate_staff());
create policy "Admins upload stewardship files" on storage.objects
  for insert to authenticated with check (bucket_id = 'stewardship' and public.has_role('admin'));
create policy "Admins replace stewardship files" on storage.objects
  for update to authenticated using (bucket_id = 'stewardship' and public.has_role('admin'));
create policy "Admins delete stewardship files" on storage.objects
  for delete to authenticated using (bucket_id = 'stewardship' and public.has_role('admin'));

-- No property invoice more than grace_days past due.
create or replace function public.steward_fees_ok(p_contact uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.finance_entries f, public.steward_rules r
    where f.contact_id = p_contact and f.kind = 'income' and f.lot_id is not null
      and f.status = 'unpaid' and f.due_date < public.org_today() - r.grace_days
  );
$$;
revoke all on function public.steward_fees_ok(uuid) from public, anon, authenticated;

-- The one place status changes. Writes the history; clears or starts the clock.
create or replace function public.steward_move(p_contact uuid, p_to text, p_source text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare s public.stewardships;
begin
  select * into s from public.stewardships where contact_id = p_contact for update;
  if not found then raise exception 'That person isn''t a steward.' using errcode = 'P0001'; end if;
  if s.status = p_to then return; end if;
  update public.stewardships set
    status = p_to,
    active_since = case when p_to = 'active' then public.org_today() end,
    status_reason = nullif(trim(coalesce(p_reason, '')), ''),
    status_changed_at = now()
  where contact_id = p_contact;
  insert into public.steward_status_history (contact_id, from_status, to_status, source, changed_by, reason)
  values (p_contact, s.status, p_to, p_source,
    case when p_source = 'admin' then public.current_staff_id() end,
    nullif(trim(coalesce(p_reason, '')), ''));
end $$;
revoke all on function public.steward_move(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.steward_activate(p_contact uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare s public.stewardships;
begin
  if not public.has_role('admin') then raise exception 'Only admins can activate a steward.' using errcode = '42501'; end if;
  select * into s from public.stewardships where contact_id = p_contact;
  if not found then raise exception 'That person isn''t a steward.' using errcode = 'P0001'; end if;
  if s.status = 'suspended' then raise exception 'Lift the suspension first.' using errcode = 'P0001'; end if;
  if s.agreement_signed_at is null then raise exception 'The Active Stewardship Agreement isn''t signed yet.' using errcode = 'P0001'; end if;
  if not public.steward_fees_ok(p_contact) then raise exception 'Fees aren''t current.' using errcode = 'P0001'; end if;
  perform public.steward_move(p_contact, 'active', 'admin', null);
end $$;
revoke all on function public.steward_activate(uuid) from public, anon;
grant execute on function public.steward_activate(uuid) to authenticated;

create or replace function public.steward_deactivate(p_contact uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('admin') then raise exception 'Only admins can deactivate a steward.' using errcode = '42501'; end if;
  if (select status from public.stewardships where contact_id = p_contact) = 'suspended' then
    raise exception 'They are suspended. Lift the suspension first.' using errcode = 'P0001';
  end if;
  perform public.steward_move(p_contact, 'inactive', 'admin', p_reason);
end $$;
revoke all on function public.steward_deactivate(uuid, text) from public, anon;
grant execute on function public.steward_deactivate(uuid, text) to authenticated;

create or replace function public.steward_suspend(p_contact uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('admin') then raise exception 'Only admins can suspend a steward.' using errcode = '42501'; end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'Say which rule was broken.' using errcode = 'P0001'; end if;
  perform public.steward_move(p_contact, 'suspended', 'admin', p_reason);
end $$;
revoke all on function public.steward_suspend(uuid, text) from public, anon;
grant execute on function public.steward_suspend(uuid, text) to authenticated;

-- Lifting a suspension leaves them inactive; an admin activates them again.
create or replace function public.steward_unsuspend(p_contact uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('admin') then raise exception 'Only admins can lift a suspension.' using errcode = '42501'; end if;
  if (select status from public.stewardships where contact_id = p_contact) <> 'suspended' then return; end if;
  perform public.steward_move(p_contact, 'inactive', 'admin', p_reason);
end $$;
revoke all on function public.steward_unsuspend(uuid, text) from public, anon;
grant execute on function public.steward_unsuspend(uuid, text) to authenticated;

-- A steward steps back on their own.
create or replace function public.steward_deactivate_self(p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare me uuid := public.current_member_contact_id();
begin
  if me is null or not exists (select 1 from public.stewardships where contact_id = me and status = 'active') then
    raise exception 'You''re not an active steward.' using errcode = 'P0001';
  end if;
  perform public.steward_move(me, 'inactive', 'steward', p_reason);
end $$;
revoke all on function public.steward_deactivate_self(text) from public, anon;
grant execute on function public.steward_deactivate_self(text) to authenticated;

create or replace function public.steward_set_agreement(p_contact uuid, p_signed date, p_path text, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('admin') then raise exception 'Only admins can record the agreement.' using errcode = '42501'; end if;
  update public.stewardships set agreement_signed_at = p_signed,
    agreement_path = nullif(p_path, ''), agreement_name = nullif(p_name, '')
  where contact_id = p_contact;
  perform public.reconcile_stewards();
end $$;
revoke all on function public.steward_set_agreement(uuid, date, text, text) from public, anon;
grant execute on function public.steward_set_agreement(uuid, date, text, text) to authenticated;

-- Daily (and when the admin list opens): drop anyone who lost active status, and
-- activate eligible stewards if the rules say so. Never touches suspended stewards.
create or replace function public.reconcile_stewards()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare r record; n int := 0; auto boolean;
begin
  if auth.uid() is not null and not public.has_role('admin') then
    raise exception 'Only admins can do that.' using errcode = '42501';
  end if;
  select auto_activate into auto from public.steward_rules;
  for r in select * from public.stewardships where status = 'active' loop
    if r.agreement_signed_at is null then
      perform public.steward_move(r.contact_id, 'inactive', 'system', 'The agreement is no longer on file.'); n := n + 1;
    elsif not public.steward_fees_ok(r.contact_id) then
      perform public.steward_move(r.contact_id, 'inactive', 'system',
        'A property invoice is more than ' || (select grace_days from public.steward_rules) || ' days overdue.'); n := n + 1;
    end if;
  end loop;
  if auto then
    for r in select s.* from public.stewardships s where s.status = 'inactive'
      and s.agreement_signed_at is not null
      -- Someone who stepped back (or was deactivated) stays inactive until an admin says so.
      and coalesce((select h.source from public.steward_status_history h
        where h.contact_id = s.contact_id order by h.created_at desc limit 1), 'system') = 'system'
    loop
      if public.steward_fees_ok(r.contact_id) then
        perform public.steward_move(r.contact_id, 'active', 'system', 'Signed and fees current.'); n := n + 1;
      end if;
    end loop;
  end if;
  return n;
end $$;
revoke all on function public.reconcile_stewards() from public, anon;
grant execute on function public.reconcile_stewards() to authenticated, service_role;

-- The admin list.
create or replace function public.stewards_overview()
returns table (
  contact_id uuid, name text, email text, status text, active_since date,
  agreement_signed_at date, fees_current boolean, fees_ok boolean, properties int, status_reason text
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.contact_id, c.name, c.email::text, s.status, s.active_since, s.agreement_signed_at,
    public.steward_fees_current(s.contact_id), public.steward_fees_ok(s.contact_id),
    (select count(*)::int from public.property_stewards p where p.contact_id = s.contact_id),
    s.status_reason
  from public.stewardships s join public.contacts c on c.id = s.contact_id
  where public.is_estate_staff()
  order by c.name;
$$;
revoke all on function public.stewards_overview() from public, anon;
grant execute on function public.stewards_overview() to authenticated;

-- Gate: every steward with a property gets in, whatever their status (even
-- suspended) and whether or not they're a member. A member's own pass is used
-- when there is one; this only fills the gap.
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
  steward boolean := exists (select 1 from public.property_stewards where contact_id = cid);
begin
  select max(e.entered_at) into v_in
  from public.gate_entries e
  where e.contact_id = cid and e.result = 'admitted'
    and (e.entered_at at time zone (select timezone from public.org_settings))::date = d;
  m := public.current_membership(cid, d);
  if m.id is not null then
    select * into t from public.membership_tiers where key = m.tier;
    b := public.membership_bucket(m, d);
  end if;
  if steward and (m.id is null or b not in (0, 2)) then
    return query select m.id, null::text, 'Steward'::text, 'steward'::text,
      case when v_in is not null then 'checked_in' else 'valid' end::text,
      null::date, null::date, null::date, v_in;
    return;
  end if;
  if m.id is null then
    return query select null::uuid, null::text, null::text, null::text, 'inactive'::text,
      null::date, null::date, null::date, null::timestamptz;
    return;
  end if;
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
