-- Classes, events, tickets, bookings, and gate check-in.
-- Classes are members-only; events can be open to everyone.

create table public.offerings (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('class', 'event')),
  title text not null check (length(trim(title)) > 0),
  description text,
  facilitator_id uuid references public.team_members (id) on delete set null,
  location text,
  repeat text not null default 'none' check (repeat in ('weekly', 'none')),
  start_date date not null,
  end_date date,
  days smallint[] not null default '{}',
  start_time time,
  end_time time,
  capacity int check (capacity > 0),
  access text not null default 'members'
    check (access in ('members', 'everyone')),
  status text not null default 'published'
    check (status in ('published', 'draft')),
  cover_path text,
  created_by uuid references public.team_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind = 'event' or access = 'members'),
  check (end_time is null or start_time is null or end_time > start_time),
  check (repeat = 'none' or cardinality(days) > 0),
  check (end_date is null or end_date >= start_date)
);
create index offerings_facilitator_idx on public.offerings (facilitator_id);
create trigger offerings_updated_at before update on public.offerings
  for each row execute function public.set_updated_at();

create table public.session_cancellations (
  offering_id uuid not null references public.offerings (id) on delete cascade,
  session_date date not null,
  created_at timestamptz not null default now(),
  primary key (offering_id, session_date)
);

create table public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.offerings (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  price numeric(14, 2) not null default 0 check (price >= 0),
  currency text not null default 'CRC' check (currency in ('CRC', 'USD')),
  qty int check (qty > 0),
  payment_link text check (payment_link is null or payment_link ~ '^https://'),
  position int not null default 0
);
create index ticket_types_offering_idx on public.ticket_types (offering_id);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.offerings (id) on delete cascade,
  session_date date not null,
  ticket_type_id uuid references public.ticket_types (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  email extensions.citext,
  paid boolean not null default false,
  source text not null default 'staff'
    check (source in ('staff', 'portal', 'public')),
  qr_token text not null unique
    default replace(gen_random_uuid()::text, '-', '')
      || replace(gen_random_uuid()::text, '-', ''),
  checked_in_at timestamptz,
  checked_in_by uuid references public.team_members (id) on delete set null,
  ticket_emailed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (offering_id, session_date, email)
);
create index registrations_session_idx
  on public.registrations (offering_id, session_date);
create index registrations_date_idx on public.registrations (session_date);

-- Does an offering run on a date (ignoring cancellations)?
create or replace function public.occurs_on(o public.offerings, d date)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when o.repeat = 'none' then d = o.start_date
    else d >= o.start_date
      and (o.end_date is null or d <= o.end_date)
      and extract(dow from d)::smallint = any (o.days)
  end;
$$;

create or replace function public.is_facilitator_of(oid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('facilitator') and exists (
    select 1 from public.offerings
    where id = oid and facilitator_id = public.current_staff_id()
  );
$$;

create or replace function public.can_manage_offering(oid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin', 'lead') or public.is_facilitator_of(oid);
$$;

-- Who can see an offering: staff all; members published; public open events.
create or replace function public.can_view_offering(oid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_staff() or exists (
    select 1 from public.offerings o
    where o.id = oid and o.status = 'published'
      and (public.is_member() or (o.kind = 'event' and o.access = 'everyone'))
  );
$$;

-- Facilitator names for published offerings (no contact details).
create or replace function public.facilitator_names()
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct t.id, t.name
  from public.team_members t
  join public.offerings o on o.facilitator_id = t.id
  where o.status = 'published';
$$;
grant execute on function public.facilitator_names() to anon, authenticated;

-- RLS ------------------------------------------------------------------------

alter table public.offerings enable row level security;
alter table public.session_cancellations enable row level security;
alter table public.ticket_types enable row level security;
alter table public.registrations enable row level security;

create policy "View offerings" on public.offerings
  for select to anon, authenticated using (public.can_view_offering(id));
create policy "Leads add offerings" on public.offerings
  for insert to authenticated with check (public.has_role('admin', 'lead'));
create policy "Manage offerings" on public.offerings
  for update to authenticated
  using (public.can_manage_offering(id))
  with check (
    public.has_role('admin', 'lead')
    or facilitator_id = public.current_staff_id()
  );
create policy "Leads delete offerings" on public.offerings
  for delete to authenticated using (public.has_role('admin', 'lead'));

create policy "View cancellations" on public.session_cancellations
  for select to anon, authenticated
  using (public.can_view_offering(offering_id));
create policy "Manage cancellations" on public.session_cancellations
  for all to authenticated
  using (public.can_manage_offering(offering_id))
  with check (public.can_manage_offering(offering_id));

create policy "View tickets" on public.ticket_types
  for select to anon, authenticated
  using (public.can_view_offering(offering_id));
create policy "Manage tickets" on public.ticket_types
  for all to authenticated
  using (public.can_manage_offering(offering_id))
  with check (public.can_manage_offering(offering_id));

create policy "Read registrations" on public.registrations
  for select to authenticated using (
    public.has_role('admin', 'lead', 'sales')
    or public.is_facilitator_of(offering_id)
    or (public.has_role('security') and session_date = public.org_today())
    or user_id = auth.uid()
  );
create policy "Staff add registrations" on public.registrations
  for insert to authenticated with check (
    public.can_manage_offering(offering_id) and source = 'staff'
  );
create policy "Staff update registrations" on public.registrations
  for update to authenticated
  using (public.can_manage_offering(offering_id))
  with check (public.can_manage_offering(offering_id));
create policy "Staff remove registrations" on public.registrations
  for delete to authenticated
  using (public.can_manage_offering(offering_id));

-- Booking (members and the public) ---------------------------------------------
-- Locks the offering so two people can't take the last spot.

create or replace function public.book_session(
  p_offering_id uuid,
  p_session_date date,
  p_name text,
  p_email text,
  p_ticket_type_id uuid default null
)
returns table (registration_id uuid, qr_token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.offerings;
  t public.ticket_types;
  member_id uuid := public.current_member_contact_id();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text := trim(coalesce(p_name, ''));
  taken int;
  has_tickets boolean;
begin
  select * into o from public.offerings where id = p_offering_id for update;
  if not found or o.status <> 'published' then
    raise exception 'This isn''t available to book.' using errcode = 'P0001';
  end if;

  if member_id is null and not (o.kind = 'event' and o.access = 'everyone') then
    raise exception 'Only members can book this. Sign in to the members portal.'
      using errcode = 'P0001';
  end if;

  if member_id is not null then
    select c.name, lower(c.email::text) into v_name, v_email
    from public.contacts c where c.id = member_id;
  end if;

  if v_name = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter your name and a valid email.' using errcode = 'P0001';
  end if;

  if p_session_date < public.org_today()
    or not public.occurs_on(o, p_session_date)
    or exists (
      select 1 from public.session_cancellations
      where offering_id = o.id and session_date = p_session_date
    ) then
    raise exception 'That date isn''t on the schedule.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.registrations
    where offering_id = o.id and session_date = p_session_date
      and email = v_email::extensions.citext
  ) then
    raise exception 'You''re already booked for this session.'
      using errcode = 'P0001';
  end if;

  select count(*) into taken from public.registrations
  where offering_id = o.id and session_date = p_session_date;
  if o.capacity is not null and taken >= o.capacity then
    raise exception 'Sorry, this session just filled up.' using errcode = 'P0001';
  end if;

  select exists (select 1 from public.ticket_types where offering_id = o.id)
    into has_tickets;

  if p_ticket_type_id is not null then
    select * into t from public.ticket_types
    where id = p_ticket_type_id and offering_id = o.id;
    if not found then
      raise exception 'Choose a ticket.' using errcode = 'P0001';
    end if;
    if t.qty is not null and (
      select count(*) from public.registrations
      where ticket_type_id = t.id and session_date = p_session_date
    ) >= t.qty then
      raise exception 'That ticket just sold out.' using errcode = 'P0001';
    end if;
  elsif has_tickets and member_id is null then
    raise exception 'Choose a ticket.' using errcode = 'P0001';
  end if;

  return query
  insert into public.registrations as r (
    offering_id, session_date, ticket_type_id, contact_id, user_id,
    name, email, source
  ) values (
    o.id, p_session_date, p_ticket_type_id, member_id,
    case when member_id is not null then auth.uid() end,
    v_name, v_email,
    case when member_id is not null then 'portal' else 'public' end
  )
  returning r.id, r.qr_token;
end;
$$;
grant execute on function public.book_session(uuid, date, text, text, uuid)
  to anon, authenticated;

-- Ticket lookup by QR token ------------------------------------------------------

create or replace function public.can_check_in(oid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin', 'lead', 'security')
    or public.is_facilitator_of(oid);
$$;

create or replace function public.ticket_by_token(p_token text)
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
  can_check_in boolean
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
      else 'valid'
    end,
    public.can_check_in(o.id)
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
  update public.registrations
  set checked_in_at = now(), checked_in_by = public.current_staff_id()
  where id = r.id
  returning checked_in_at into v_at;
  return v_at;
end;
$$;
revoke execute on function public.check_in(text) from anon, public;
grant execute on function public.check_in(text) to authenticated;

-- Cover photos -------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

create policy "Staff upload covers" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'covers' and public.has_role('admin', 'lead', 'facilitator'));
create policy "Staff replace covers" on storage.objects
  for update to authenticated
  using (bucket_id = 'covers' and public.has_role('admin', 'lead', 'facilitator'));
create policy "Staff delete covers" on storage.objects
  for delete to authenticated
  using (bucket_id = 'covers' and public.has_role('admin', 'lead', 'facilitator'));
