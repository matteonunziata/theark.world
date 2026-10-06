-- Courts online. A second padel court, a price per court, and a public page
-- where anyone books and pays for a court (/courts): the slot is held for
-- twenty minutes while they pay on Stripe, then booked. Open matches let a
-- person book a court, say their level, and have others join and pay their
-- share. Members get their discount and can still settle at reception.

-- Courts -------------------------------------------------------------------

alter table public.courts
  add column price numeric(14, 2) check (price >= 0),
  add column currency text not null default 'CRC' check (currency in ('CRC', 'USD')),
  add column description text,
  add column max_players smallint not null default 4 check (max_players between 2 and 8);

update public.courts set name = 'Padel court 1' where name = 'Padel court' and sport = 'padel';
update public.courts set position = 2 where sport = 'pickleball';
insert into public.courts (name, sport, position)
select 'Padel court 2', 'padel', 1
where not exists (select 1 from public.courts where sport = 'padel' and name <> 'Padel court 1');

-- Placeholder prices per one-hour slot, to be set in Schedule → Courts → Manage courts.
update public.courts set price = case sport when 'padel' then 20000 else 12000 end where price is null;
update public.courts set
  description = case sport
    when 'padel' then 'Panoramic glass court, lights for evening play. Rackets and balls at reception.'
    else 'Regulation court with lights. Paddles and balls at reception.'
  end
where description is null;

-- Bookings -----------------------------------------------------------------

alter table public.court_bookings
  drop constraint court_bookings_status_check,
  add constraint court_bookings_status_check
    check (status in ('held', 'booked', 'cancelled', 'expired')),
  drop constraint court_bookings_source_check,
  add constraint court_bookings_source_check check (source in ('staff', 'portal', 'web')),
  add column paid boolean not null default false,
  add column paid_at timestamptz,
  add column amount numeric(14, 2) check (amount >= 0),
  add column currency text not null default 'CRC' check (currency in ('CRC', 'USD')),
  add column token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  add column open_match boolean not null default false,
  add column level numeric(3, 1) check (level between 0 and 7),
  add column level_min numeric(3, 1) check (level_min between 0 and 7),
  add column level_max numeric(3, 1) check (level_max between 0 and 7),
  add column spots smallint check (spots between 2 and 8),
  add column held_until timestamptz,
  add constraint court_bookings_open_match_check
    check (not open_match or (level is not null and spots is not null and amount is not null));

-- A hold counts as taken until it expires.
alter table public.court_bookings drop constraint court_bookings_no_overlap;
alter table public.court_bookings add constraint court_bookings_no_overlap exclude using gist (
  court_id with =,
  tsrange(date + start_time, date + end_time) with &&
) where (status in ('booked', 'held'));

-- The people in a booking. The person who booked is the host; in an open
-- match others join. Everyone who pays online pays through their own row.
create table public.court_players (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.court_bookings (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  email extensions.citext,
  phone text,
  level numeric(3, 1) check (level between 0 and 7),
  host boolean not null default false,
  status text not null default 'in' check (status in ('held', 'in', 'out', 'expired')),
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  paid boolean not null default false,
  paid_at timestamptz,
  token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  held_until timestamptz,
  created_at timestamptz not null default now()
);
create index court_players_booking_idx on public.court_players (booking_id);
create index court_players_contact_idx on public.court_players (contact_id) where contact_id is not null;

alter table public.court_players enable row level security;
create policy "Staff manage court players" on public.court_players
  for all to authenticated
  using (public.has_role('admin', 'lead', 'sales', 'facilitator'))
  with check (public.has_role('admin', 'lead', 'sales', 'facilitator'));

-- Courts have their own line in Finance.
insert into public.business_lines (name, color, position)
select 'Courts', 'sea', 7
where not exists (select 1 from public.business_lines where name = 'Courts');

-- Payments can be for a court (one row per player who paid).
alter table public.payments
  drop constraint payments_kind_check,
  add constraint payments_kind_check check (kind in ('pass', 'membership', 'ticket', 'court')),
  add column court_booking_id uuid references public.court_bookings (id) on delete set null,
  add column court_player_id uuid references public.court_players (id) on delete set null;
create index payments_court_booking_idx on public.payments (court_booking_id) where court_booking_id is not null;

-- Helpers ------------------------------------------------------------------

-- Holds that were never paid are released.
create or replace function public.expire_court_holds()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.court_players set status = 'expired' where status = 'held' and held_until < now();
  update public.court_bookings set status = 'expired' where status = 'held' and held_until < now();
$$;

-- Local time now, in the organization's time zone.
create or replace function public.org_now()
returns timestamp
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone timezone) from public.org_settings;
$$;

-- What a court costs for this many minutes: the price per slot, less the
-- person's member discount when they're an active member with one.
create or replace function public.court_price(p_court uuid, p_minutes int, p_contact uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select round(
    coalesce(c.price, 0) * (p_minutes::numeric / c.slot_minutes)
      * (1 - coalesce(d.percent, 0) / 100),
    case when c.currency = 'USD' then 2 else 0 end)
  from public.courts c
  left join public.contacts x
    on x.id = p_contact and x.membership_status = 'active' and x.tier is not null
  left join public.discounts d on d.id = x.discount_id and d.active
  where c.id = p_court;
$$;

-- Checks a slot can be booked and returns when it ends. Same rules for
-- members, staff-made web bookings and the public page.
create or replace function public.court_slot_end(c public.courts, p_date date, p_start time, p_minutes int)
returns time
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date := public.org_today();
  now_local time := public.org_now()::time;
  e time;
begin
  if p_minutes is null or p_minutes < c.slot_minutes or p_minutes > 120
    or p_minutes % c.slot_minutes <> 0 then
    raise exception 'Pick a length from the list.';
  end if;
  if p_date is null or p_date < today or p_date > today + 14 then
    raise exception 'Courts can be booked up to two weeks ahead.';
  end if;
  e := p_start + make_interval(mins => p_minutes);
  if p_start < c.open_time or e > c.close_time
    or extract(epoch from (p_start - c.open_time))::int % (c.slot_minutes * 60) <> 0 then
    raise exception 'Pick one of the listed times.';
  end if;
  if p_date = today and p_start <= now_local then
    raise exception 'That time has passed.';
  end if;
  if public.court_class_at(c.id, p_date, p_start, e) is not null then
    raise exception 'There’s a class on that court then.';
  end if;
  return e;
end;
$$;

-- Public reads ------------------------------------------------------------

-- The courts people can book, with prices.
create or replace function public.public_courts()
returns table (
  id uuid, name text, sport text, open_time time, close_time time, slot_minutes smallint,
  price numeric, currency text, description text, max_players smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  select id, name, sport, open_time, close_time, slot_minutes, price, currency, description, max_players
  from public.courts
  where active
  order by position, name;
$$;

-- One day at the courts for anyone: taken slots (no names), classes held
-- there, and open matches people can join (host's first name, level range,
-- how many are in, the share to pay).
create or replace function public.public_court_day(p_date date)
returns table (
  court_id uuid, start_time time, end_time time, kind text, title text,
  booking_id uuid, open_match boolean, level_min numeric, level_max numeric,
  spots int, players int, host text, share numeric, currency text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.court_id, b.start_time, b.end_time, 'booking', null::text,
    case when b.open_match and b.status = 'booked' then b.id end,
    b.open_match and b.status = 'booked',
    case when b.open_match then b.level_min end,
    case when b.open_match then b.level_max end,
    case when b.open_match then b.spots::int end,
    case when b.open_match then
      (select count(*)::int from public.court_players p
       where p.booking_id = b.id and (p.status = 'in' or (p.status = 'held' and p.held_until > now())))
    end,
    case when b.open_match then split_part(trim(b.name), ' ', 1) end,
    case when b.open_match then
      round(b.amount / b.spots, case when b.currency = 'USD' then 2 else 0 end)
    end,
    b.currency
  from public.court_bookings b
  where b.date = p_date
    and (b.status = 'booked' or (b.status = 'held' and b.held_until > now()))
  union all
  select c.id, o.start_time, o.end_time, 'class', o.title,
    null, false, null, null, null, null, null, null, null
  from public.courts c
  cross join public.offerings o
  where c.active
    and o.status = 'published'
    and o.location ilike '%court%'
    and o.start_time is not null and o.end_time is not null
    and public.occurs_on(o, p_date)
    and not exists (
      select 1 from public.session_cancellations x
      where x.offering_id = o.id and x.session_date = p_date
    )
    and (
      (o.title ilike '%padel%' and c.sport = 'padel')
      or (o.title ilike '%pickleball%' and c.sport = 'pickleball')
      or (o.title not ilike '%padel%' and o.title not ilike '%pickleball%')
    );
$$;

-- Open matches still looking for players, over the booking window.
create or replace function public.public_open_matches()
returns table (
  booking_id uuid, court text, sport text, date date, start_time time, end_time time,
  level_min numeric, level_max numeric, spots int, players int, host text, share numeric, currency text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, c.name, c.sport, b.date, b.start_time, b.end_time,
    b.level_min, b.level_max, b.spots::int,
    (select count(*)::int from public.court_players p
     where p.booking_id = b.id and (p.status = 'in' or (p.status = 'held' and p.held_until > now()))),
    split_part(trim(b.name), ' ', 1),
    round(b.amount / b.spots, case when b.currency = 'USD' then 2 else 0 end),
    b.currency
  from public.court_bookings b
  join public.courts c on c.id = b.court_id
  where b.open_match and b.status = 'booked'
    and (b.date + b.start_time) > public.org_now()
    and b.date <= public.org_today() + 14
  order by b.date, b.start_time;
$$;

-- Everything one booking page needs, by the host's booking token or a
-- player's own token. Names are first names only.
create or replace function public.court_booking_by_token(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  b public.court_bookings;
  c public.courts;
  you public.court_players;
begin
  select * into b from public.court_bookings where token = p_token;
  if found then
    select * into you from public.court_players where booking_id = b.id and host order by created_at limit 1;
  else
    select * into you from public.court_players where token = p_token;
    if not found then return null; end if;
    select * into b from public.court_bookings where id = you.booking_id;
  end if;
  select * into c from public.courts where id = b.court_id;
  return jsonb_build_object(
    'booking', jsonb_build_object(
      'id', b.id, 'court', c.name, 'sport', c.sport, 'date', b.date,
      'start_time', b.start_time, 'end_time', b.end_time, 'status', b.status,
      'open_match', b.open_match, 'level_min', b.level_min, 'level_max', b.level_max,
      'spots', b.spots, 'amount', b.amount, 'currency', b.currency, 'paid', b.paid,
      'host', split_part(trim(b.name), ' ', 1), 'notes', b.notes,
      'held_until', b.held_until,
      'cancellable', b.status in ('booked', 'held')
        and (b.date + b.start_time) >= public.org_now() + interval '24 hours'
    ),
    'you', case when you.id is null then null else jsonb_build_object(
      'id', you.id, 'token', you.token, 'host', you.host, 'status', you.status,
      'amount', you.amount, 'paid', you.paid, 'name', you.name, 'email', you.email,
      'level', you.level
    ) end,
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', split_part(trim(p.name), ' ', 1), 'level', p.level, 'host', p.host,
        'status', p.status, 'paid', p.paid) order by p.host desc, p.created_at)
      from public.court_players p
      where p.booking_id = b.id and (p.status = 'in' or (p.status = 'held' and p.held_until > now()))
    ), '[]'::jsonb)
  );
end;
$$;

-- Public writes -----------------------------------------------------------

-- Hold a court for someone (a visitor on /courts, or a signed-in member).
-- Paying online: the slot is held for 20 minutes and booked when Stripe
-- confirms. "reception": booked now, settled at the desk (the app allows this
-- for members, and for everyone while Stripe is off).
-- Returns {id, token, player_token, amount, currency, status}.
create or replace function public.hold_court(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.courts;
  me uuid := public.current_member_contact_id();
  v_name text := nullif(trim(coalesce(p ->> 'name', '')), '');
  v_email text := lower(trim(coalesce(p ->> 'email', '')));
  v_phone text := nullif(trim(coalesce(p ->> 'phone', '')), '');
  v_date date := nullif(p ->> 'date', '')::date;
  v_start time := nullif(p ->> 'start', '')::time;
  v_minutes int := coalesce(nullif(p ->> 'minutes', '')::int, 60);
  v_open boolean := coalesce((p ->> 'open_match')::boolean, false);
  v_level numeric := nullif(p ->> 'level', '')::numeric;
  v_spots int := nullif(p ->> 'spots', '')::int;
  v_players int := nullif(p ->> 'players', '')::int;
  v_pay text := coalesce(nullif(p ->> 'pay', ''), 'online');
  v_contact uuid;
  v_amount numeric;
  v_share numeric;
  v_status text;
  v_until timestamptz;
  e time;
  b public.court_bookings;
  pl public.court_players;
begin
  perform public.expire_court_holds();
  select * into c from public.courts where id = nullif(p ->> 'court_id', '')::uuid and active;
  if not found then raise exception 'That court isn’t available.'; end if;
  if v_name is null then raise exception 'Tell us your name.'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'That email doesn’t look right.'; end if;
  if v_pay not in ('online', 'reception') then raise exception 'Pick how to pay.'; end if;
  e := public.court_slot_end(c, v_date, v_start, v_minutes);
  if v_open then
    if v_level is null or v_level < 0 or v_level > 7 then
      raise exception 'Pick your level for an open match.';
    end if;
    if v_spots is null or v_spots < 2 or v_spots > c.max_players then
      raise exception 'An open match takes 2 to % players.', c.max_players;
    end if;
    v_players := v_spots;
  elsif v_players is not null and (v_players < 1 or v_players > 8) then
    v_players := null;
  end if;

  -- The person: the signed-in member, or found (or added) by email.
  v_contact := me;
  if v_contact is null then
    select id into v_contact from public.contacts where email = v_email::extensions.citext limit 1;
  end if;
  if v_contact is null then
    insert into public.contacts (name, email, phone, type, source)
    values (v_name, v_email, v_phone, 'contact', 'Courts')
    returning id into v_contact;
  end if;

  if (select count(*) from public.court_bookings
      where contact_id = v_contact and date = v_date and status in ('booked', 'held')) >= 2 then
    raise exception 'You can book two slots a day.';
  end if;

  v_amount := public.court_price(c.id, v_minutes, v_contact);
  v_share := case when v_open
    then round(v_amount / v_spots, case when c.currency = 'USD' then 2 else 0 end)
    else v_amount end;
  if v_share = 0 then v_pay := 'reception'; end if;
  v_status := case when v_pay = 'online' then 'held' else 'booked' end;
  v_until := case when v_pay = 'online' then now() + interval '20 minutes' end;

  begin
    insert into public.court_bookings (
      court_id, date, start_time, end_time, contact_id, name, email, phone, players, notes,
      source, status, held_until, amount, currency, open_match, level, level_min, level_max, spots
    ) values (
      c.id, v_date, v_start, e, v_contact, v_name, v_email, v_phone, v_players,
      nullif(trim(coalesce(p ->> 'notes', '')), ''),
      case when me is not null then 'portal' else 'web' end, v_status, v_until, v_amount, c.currency,
      v_open, v_level,
      case when v_open then greatest(0, coalesce(nullif(p ->> 'level_min', '')::numeric, v_level - 1)) end,
      case when v_open then least(7, coalesce(nullif(p ->> 'level_max', '')::numeric, v_level + 1)) end,
      case when v_open then v_spots end
    ) returning * into b;
  exception when exclusion_violation then
    raise exception 'Someone just took that slot. Pick another.';
  end;

  insert into public.court_players (booking_id, contact_id, name, email, phone, level, host, status, amount, held_until)
  values (b.id, v_contact, v_name, v_email, v_phone, v_level, true,
    case when v_pay = 'online' then 'held' else 'in' end, v_share, v_until)
  returning * into pl;

  return jsonb_build_object(
    'id', b.id, 'token', b.token, 'player_token', pl.token,
    'amount', v_share, 'currency', c.currency, 'status', b.status
  );
end;
$$;

-- Join an open match as one player. Pays their share online (held 20
-- minutes) or, when the share is nothing, is in straight away.
-- Returns {id, token, booking_token, amount, currency, status}.
create or replace function public.join_court_match(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.court_bookings;
  c public.courts;
  me uuid := public.current_member_contact_id();
  v_name text := nullif(trim(coalesce(p ->> 'name', '')), '');
  v_email text := lower(trim(coalesce(p ->> 'email', '')));
  v_phone text := nullif(trim(coalesce(p ->> 'phone', '')), '');
  v_level numeric := nullif(p ->> 'level', '')::numeric;
  v_pay text := coalesce(nullif(p ->> 'pay', ''), 'online');
  v_contact uuid;
  v_share numeric;
  v_in int;
  pl public.court_players;
begin
  perform public.expire_court_holds();
  select * into b from public.court_bookings
  where id = nullif(p ->> 'booking_id', '')::uuid and open_match and status = 'booked'
  for update;
  if not found then raise exception 'That match isn’t open any more.'; end if;
  select * into c from public.courts where id = b.court_id;
  if v_name is null then raise exception 'Tell us your name.'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'That email doesn’t look right.'; end if;
  if v_pay not in ('online', 'reception') then raise exception 'Pick how to pay.'; end if;
  if (b.date + b.start_time) <= public.org_now() then raise exception 'That match has started.'; end if;
  if v_level is null or v_level < b.level_min or v_level > b.level_max then
    raise exception 'This match is for levels % to %.', b.level_min, b.level_max;
  end if;
  select count(*) into v_in from public.court_players
  where booking_id = b.id and status in ('in', 'held');
  if v_in >= b.spots then raise exception 'That match is full.'; end if;
  if exists (select 1 from public.court_players
             where booking_id = b.id and status in ('in', 'held') and email = v_email::extensions.citext) then
    raise exception 'You’re already in this match.';
  end if;

  v_contact := me;
  if v_contact is null then
    select id into v_contact from public.contacts where email = v_email::extensions.citext limit 1;
  end if;
  if v_contact is null then
    insert into public.contacts (name, email, phone, type, source)
    values (v_name, v_email, v_phone, 'contact', 'Courts')
    returning id into v_contact;
  end if;

  v_share := round(b.amount / b.spots, case when b.currency = 'USD' then 2 else 0 end);
  if v_share = 0 then v_pay := 'reception'; end if;

  insert into public.court_players (booking_id, contact_id, name, email, phone, level, host, status, amount, held_until)
  values (b.id, v_contact, v_name, v_email, v_phone, v_level, false,
    case when v_pay = 'online' then 'held' else 'in' end, v_share,
    case when v_pay = 'online' then now() + interval '20 minutes' end)
  returning * into pl;

  return jsonb_build_object(
    'id', pl.id, 'token', pl.token, 'booking_token', b.token,
    'amount', v_share, 'currency', b.currency, 'status', pl.status
  );
end;
$$;

-- Cancel with a booking token (the host cancels the court, up to 24 hours
-- before) or a player token (leave a match: any time while it isn't full,
-- otherwise up to 24 hours before). Money already paid is refunded by the
-- team from Stripe.
create or replace function public.cancel_court_by_token(p_token text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.court_bookings;
  pl public.court_players;
  v_in int;
  cutoff timestamp := public.org_now() + interval '24 hours';
begin
  perform public.expire_court_holds();
  select * into b from public.court_bookings where token = p_token;
  if found then
    if b.status not in ('booked', 'held') then raise exception 'That booking is already cancelled.'; end if;
    if (b.date + b.start_time) < cutoff then
      raise exception 'Bookings can be cancelled up to 24 hours before. For anything later, message us.';
    end if;
    update public.court_bookings set status = 'cancelled' where id = b.id;
    update public.court_players set status = 'out' where booking_id = b.id and status in ('in', 'held');
    return 'booking';
  end if;

  select * into pl from public.court_players where token = p_token;
  if not found then raise exception 'We couldn’t find that booking.'; end if;
  if pl.host then
    -- The host's own row: cancelling the whole booking is the host's call.
    select * into b from public.court_bookings where id = pl.booking_id;
    return public.cancel_court_by_token(b.token);
  end if;
  if pl.status not in ('in', 'held') then raise exception 'You’ve already left this match.'; end if;
  select * into b from public.court_bookings where id = pl.booking_id;
  if (b.date + b.start_time) <= public.org_now() then raise exception 'That match has started.'; end if;
  select count(*) into v_in from public.court_players where booking_id = b.id and status in ('in', 'held');
  if v_in >= b.spots and (b.date + b.start_time) < cutoff then
    raise exception 'The match is full, so you can leave up to 24 hours before. For anything later, message us.';
  end if;
  update public.court_players set status = 'out' where id = pl.id;
  return 'player';
end;
$$;

-- Members' functions, now with price, hold expiry and a player row ----------

create or replace function public.court_day(p_date date)
returns table (id uuid, court_id uuid, start_time time, end_time time, mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.court_id, b.start_time, b.end_time,
    b.contact_id is not null and b.contact_id = public.current_member_contact_id()
  from public.court_bookings b
  where b.date = p_date
    and (b.status = 'booked' or (b.status = 'held' and b.held_until > now()))
    and (public.is_member() or public.is_staff());
$$;

create or replace function public.book_court(p_court uuid, p_date date, p_start time)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.current_member_contact_id();
  p public.contacts;
  r jsonb;
begin
  if me is null then raise exception 'Court booking is for members.'; end if;
  select * into p from public.contacts where id = me;
  if p.email is null then raise exception 'Add your email under Me first.'; end if;
  r := public.hold_court(jsonb_build_object(
    'court_id', p_court, 'date', p_date, 'start', p_start, 'minutes',
    (select slot_minutes from public.courts where id = p_court),
    'name', p.name, 'email', p.email, 'phone', p.phone, 'pay', 'reception'));
  return (r ->> 'id')::uuid;
end;
$$;

drop function if exists public.my_court_bookings();
create or replace function public.my_court_bookings()
returns table (
  id uuid, court text, date date, start_time time, end_time time,
  token text, player_token text, amount numeric, currency text, paid boolean, open_match boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, c.name, b.date, b.start_time, b.end_time, b.token,
    (select p.token from public.court_players p where p.booking_id = b.id and p.host limit 1),
    b.amount, b.currency, b.paid, b.open_match
  from public.court_bookings b join public.courts c on c.id = b.court_id
  where b.contact_id = public.current_member_contact_id()
    and b.status = 'booked'
    and b.date >= public.org_today()
  order by b.date, b.start_time;
$$;

-- Stripe -------------------------------------------------------------------

-- record_stripe_payment learns the court kind (on top of the memberships
-- version): the player's row is paid and in, the booking goes from held to
-- booked, and the court is marked paid once everyone's share is in. Court
-- income isn't linked to the person (their booking already shows on their
-- profile).
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
  v_player uuid := nullif(p ->> 'court_player_id', '')::uuid;
  v_booking uuid;
  v_tier text := nullif(p ->> 'tier', '');
  v_desc text := coalesce(nullif(trim(coalesce(p ->> 'description', '')), ''), 'Payment');
  v_today date := public.org_today();
  v_start date := greatest(coalesce(nullif(p ->> 'start_date', '')::date, public.org_today()), public.org_today());
  v_existing public.payments;
  t public.membership_tiers;
  pl public.court_players;
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
  if v_kind not in ('pass', 'membership', 'ticket', 'court') then
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
  if v_kind = 'court' then
    if v_player is null then
      raise exception 'A court payment needs its player.' using errcode = 'P0001';
    end if;
    select * into pl from public.court_players where id = v_player for update;
    if not found then
      raise exception 'Unknown court player %.', v_player using errcode = 'P0001';
    end if;
    v_booking := pl.booking_id;
    v_contact := coalesce(v_contact, pl.contact_id);
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
  elsif v_kind = 'ticket' then
    if v_reg is null then
      raise exception 'A ticket payment needs its booking.' using errcode = 'P0001';
    end if;
  end if;

  -- Finance. Ticket and court income isn't linked to the person: the booking
  -- already shows on their profile, so linking both would count it twice.
  select id into v_line from public.business_lines
  where name = case v_kind
    when 'ticket' then 'Events & experiences'
    when 'court' then 'Courts'
    else 'Memberships' end
  order by position limit 1;
  insert into public.finance_entries (
    kind, entry_date, business_line_id, category, party, description,
    amount, currency, method, reference, status, contact_id
  ) values (
    'income', v_today, v_line,
    case v_kind when 'ticket' then 'Tickets' when 'court' then 'Court bookings' else 'Membership dues' end,
    coalesce(v_name, nullif(v_email, '')), v_desc,
    v_amount, v_currency, 'card', coalesce(v_intent, v_session), 'paid',
    case when v_kind in ('ticket', 'court') then null else v_contact end
  ) returning id into v_entry;

  insert into public.payments (
    kind, contact_id, registration_id, court_booking_id, court_player_id, tier, name, email, description,
    amount, currency, starts_on, ends_on, finance_entry_id,
    session_id, payment_intent, live
  ) values (
    v_kind, v_contact, v_reg, v_booking, v_player,
    case when v_kind in ('ticket', 'court') then null else v_tier end,
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
  elsif v_kind = 'court' then
    update public.court_players
    set paid = true, paid_at = now(), status = 'in', held_until = null
    where id = v_player;
    begin
      update public.court_bookings b set
        status = case when b.status in ('held', 'booked', 'expired') then 'booked' else b.status end,
        held_until = null,
        paid = (select coalesce(sum(x.amount) filter (where x.paid), 0) >= coalesce(b.amount, 0)
                from public.court_players x where x.booking_id = b.id),
        paid_at = case when b.paid_at is null then now() else b.paid_at end
      where b.id = v_booking;
    exception when exclusion_violation then
      -- The hold ran out and someone else took the slot while they were
      -- paying. The payment is kept so the team can refund it.
      update public.court_bookings
      set notes = concat_ws(E'\n', notes, 'Paid after the hold expired and the slot was taken. Refund from Stripe.')
      where id = v_booking;
    end;
  else
    update public.registrations set paid = true where id = v_reg;
  end if;

  return query select v_id, v_contact, true;
end;
$$;

-- A full refund ends what was bought that moment (user decision); for a court
-- it takes the player out of the match, and cancels the booking when it was
-- the host's. A partial refund only posts to Finance.
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
  pl public.court_players;
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
    if pay.kind = 'court' and pay.court_player_id is not null then
      select * into pl from public.court_players where id = pay.court_player_id;
      update public.court_players set paid = false, status = 'out' where id = pl.id;
      if pl.host then
        update public.court_bookings set status = 'cancelled', paid = false where id = pl.booking_id;
        update public.court_players set status = 'out'
        where booking_id = pl.booking_id and status in ('in', 'held');
      else
        update public.court_bookings set paid = false where id = pl.booking_id;
      end if;
    end if;
    update public.memberships set
      status = 'revoked', revoked_at = now(), revoke_reason = 'Refunded on Stripe'
    where payment_id = pay.id and status <> 'revoked';
  end if;
  return pay.id;
end;
$$;

-- Grants -------------------------------------------------------------------

revoke all on function public.expire_court_holds() from public, anon, authenticated;
revoke all on function public.org_now() from public, anon;
revoke all on function public.court_price(uuid, int, uuid) from public, anon;
revoke all on function public.court_slot_end(public.courts, date, time, int) from public, anon, authenticated;
revoke all on function public.public_courts() from public;
revoke all on function public.public_court_day(date) from public;
revoke all on function public.public_open_matches() from public;
revoke all on function public.court_booking_by_token(text) from public;
revoke all on function public.hold_court(jsonb) from public;
revoke all on function public.join_court_match(jsonb) from public;
revoke all on function public.cancel_court_by_token(text) from public;
revoke all on function public.my_court_bookings() from public, anon;
grant execute on function public.org_now() to authenticated;
grant execute on function public.court_price(uuid, int, uuid) to authenticated;
grant execute on function public.public_courts() to anon, authenticated;
grant execute on function public.public_court_day(date) to anon, authenticated;
grant execute on function public.public_open_matches() to anon, authenticated;
grant execute on function public.court_booking_by_token(text) to anon, authenticated;
grant execute on function public.hold_court(jsonb) to anon, authenticated;
grant execute on function public.join_court_match(jsonb) to anon, authenticated;
grant execute on function public.cancel_court_by_token(text) to anon, authenticated;
grant execute on function public.my_court_bookings() to authenticated;
