-- Gate rules.
-- Tickets: green only on the session day, from one hour before the start.
-- Member passes: a QR per member. Valid at any hour while the membership
-- covers today: day passes on their day, week passes for seven days, other
-- tiers until renews_on (or while active when there's no end date).

create or replace function public.org_now()
returns timestamp
language sql
stable
security definer
set search_path = ''
as $$
  select now() at time zone timezone from public.org_settings;
$$;
grant execute on function public.org_now() to anon, authenticated;

-- Tickets ------------------------------------------------------------------------

drop function if exists public.ticket_by_token(text);
create function public.ticket_by_token(p_token text)
returns table (
  registration_id uuid,
  offering_id uuid,
  title text,
  kind text,
  session_date date,
  start_time time,
  end_time time,
  location text,
  facilitator text,
  holder text,
  ticket_name text,
  price numeric,
  currency text,
  paid boolean,
  checked_in_at timestamptz,
  state text,
  can_check_in boolean,
  gate_opens time
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, o.id, o.title, o.kind, r.session_date, o.start_time,
    o.end_time, o.location, f.name, r.name, t.name, t.price, t.currency,
    r.paid, r.checked_in_at,
    case
      when exists (
        select 1 from public.session_cancellations c
        where c.offering_id = o.id and c.session_date = r.session_date
      ) then 'cancelled'
      when r.checked_in_at is not null then 'used'
      when r.session_date < public.org_today() then 'expired'
      when r.session_date > public.org_today() then 'upcoming'
      when o.start_time is not null
        and public.org_now()::time < o.start_time - interval '1 hour' then 'early'
      else 'valid'
    end,
    public.can_check_in(o.id),
    case when o.start_time is not null
      then (o.start_time - interval '1 hour')::time end
  from public.registrations r
  join public.offerings o on o.id = r.offering_id
  left join public.team_members f on f.id = o.facilitator_id
  left join public.ticket_types t on t.id = r.ticket_type_id
  where r.qr_token = p_token;
$$;
grant execute on function public.ticket_by_token(text) to anon, authenticated;

create or replace function public.check_in(p_token text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.registrations;
  o public.offerings;
  v_at timestamptz;
begin
  select * into r from public.registrations where qr_token = p_token for update;
  if not found then
    raise exception 'Ticket not found.' using errcode = 'P0001';
  end if;
  if not public.can_check_in(r.offering_id) then
    raise exception 'You can''t check people in.' using errcode = '42501';
  end if;
  if r.checked_in_at is not null then
    return r.checked_in_at;
  end if;
  if r.session_date <> public.org_today() then
    raise exception 'This ticket is for %.', to_char(r.session_date, 'Mon DD')
      using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.session_cancellations
    where offering_id = r.offering_id and session_date = r.session_date
  ) then
    raise exception 'This session was cancelled.' using errcode = 'P0001';
  end if;
  select * into o from public.offerings where id = r.offering_id;
  if o.start_time is not null
    and public.org_now()::time < o.start_time - interval '1 hour' then
    raise exception 'Too early. Entry opens at %.',
      to_char(o.start_time - interval '1 hour', 'FMHH12:MI AM')
      using errcode = 'P0001';
  end if;
  update public.registrations
  set checked_in_at = now(), checked_in_by = public.current_staff_id()
  where id = r.id
  returning checked_in_at into v_at;
  return v_at;
end;
$$;

-- Member passes ---------------------------------------------------------------------

alter table public.contacts
  add column pass_token text unique
    default replace(gen_random_uuid()::text, '-', '')
      || replace(gen_random_uuid()::text, '-', '');
update public.contacts set pass_token = default where pass_token is null;
alter table public.contacts alter column pass_token set not null;

create table public.gate_entries (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts (id) on delete cascade,
  entered_at timestamptz not null default now(),
  logged_by uuid references public.team_members (id) on delete set null
);
create index gate_entries_at_idx on public.gate_entries (entered_at desc);
alter table public.gate_entries enable row level security;
create policy "Gate staff read entries" on public.gate_entries
  for select to authenticated
  using (public.has_role('admin', 'lead', 'facilitator', 'security'));

create or replace function public.can_work_gate()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin', 'lead', 'facilitator', 'security');
$$;
grant execute on function public.can_work_gate() to authenticated;

create or replace function public.pass_by_token(p_token text)
returns table (
  contact_id uuid,
  holder text,
  tier text,
  tier_name text,
  period text,
  membership_status text,
  valid_from date,
  valid_until date,
  state text,
  can_log boolean,
  is_mine boolean,
  last_entry_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with p as (
    select c.*, t.name as tname, coalesce(t.period, 'month') as tperiod,
      c.member_since as vfrom,
      case
        when c.renews_on is not null then c.renews_on
        when t.period in ('day', 'once') then c.member_since
        when t.period = 'week' then c.member_since + 6
      end as vuntil
    from public.contacts c
    left join public.membership_tiers t on t.key = c.tier
    where c.pass_token = p_token and length(p_token) >= 32
  )
  select p.id, p.name, p.tier, p.tname, p.tperiod, p.membership_status,
    p.vfrom, p.vuntil,
    case
      when p.tier is null then 'inactive'
      when p.membership_status = 'paused' then 'paused'
      when p.membership_status <> 'active' then 'inactive'
      when p.tperiod in ('day', 'once', 'week') and p.vfrom is null
        and p.renews_on is null then 'no_date'
      when p.vfrom is not null and p.vfrom > public.org_today() then 'not_started'
      when p.vuntil is not null and p.vuntil < public.org_today() then 'expired'
      else 'valid'
    end,
    public.can_work_gate(),
    p.user_id is not null and p.user_id = auth.uid(),
    (select max(e.entered_at) from public.gate_entries e
      where e.contact_id = p.id and public.can_work_gate())
  from p;
$$;
grant execute on function public.pass_by_token(text) to anon, authenticated;

create or replace function public.log_pass_entry(p_token text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
  v_at timestamptz;
begin
  if not public.can_work_gate() then
    raise exception 'You can''t log entries at the gate.' using errcode = '42501';
  end if;
  select * into v from public.pass_by_token(p_token);
  if not found then
    raise exception 'Pass not found.' using errcode = 'P0001';
  end if;
  if v.state <> 'valid' then
    raise exception 'This pass isn''t valid today.' using errcode = 'P0001';
  end if;
  insert into public.gate_entries (contact_id, logged_by)
  values (v.contact_id, public.current_staff_id())
  returning entered_at into v_at;
  return v_at;
end;
$$;
revoke execute on function public.log_pass_entry(text) from anon, public;
grant execute on function public.log_pass_entry(text) to authenticated;

-- The signed-in member's pass token.
create or replace function public.my_pass_token()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select pass_token from public.contacts
  where id = public.current_member_contact_id();
$$;
revoke execute on function public.my_pass_token() from anon, public;
grant execute on function public.my_pass_token() to authenticated;
