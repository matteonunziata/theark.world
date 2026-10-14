-- Courts rework (2026-10-14).
-- One price list (court lengths and equipment, VAT included), half-hour blocks,
-- lengths of 1, 1½ and 3 hours only, open and private matches, named players,
-- equipment, a payment ledger (card, cash in colones or dollars, SINPE) with
-- the VAT part kept apart, moving a booking, and check-in with the community
-- manager. Existing bookings keep their rows, lengths and prices.

-- Prices and settings: one place -----------------------------------------------

create table public.court_prices (
  key text primary key,
  kind text not null check (kind in ('court', 'equipment')),
  label text not null,
  minutes smallint check (minutes is null or minutes in (60, 90, 180)),
  price numeric(14, 2) not null check (price >= 0),
  active boolean not null default true,
  position int not null default 0,
  check ((kind = 'court') = (minutes is not null))
);
insert into public.court_prices (key, kind, label, minutes, price, position) values
  ('court_60', 'court', '1 hour', 60, 20000, 0),
  ('court_90', 'court', '1½ hours', 90, 30000, 1),
  ('court_180', 'court', '3 hours', 180, 40000, 2),
  ('balls', 'equipment', 'Balls', null, 6000, 10),
  ('overgrip', 'equipment', 'Overgrip', null, 2500, 11),
  ('racket', 'equipment', 'Racket', null, 3500, 12),
  ('premium_racket', 'equipment', 'Premium racket', null, 5000, 13);

-- Staff-only settings: the VAT included in every price, and the dollar rate for cash.
create table public.court_config (
  key text primary key,
  value numeric not null
);
insert into public.court_config values ('vat_percent', 13), ('usd_crc_rate', 455);

alter table public.court_prices enable row level security;
alter table public.court_config enable row level security;
create policy "Anyone reads court prices" on public.court_prices
  for select to anon, authenticated using (true);
create policy "Admins and leads manage court prices" on public.court_prices
  for all to authenticated
  using (public.has_role('admin', 'lead')) with check (public.has_role('admin', 'lead'));
create policy "Staff read court settings" on public.court_config
  for select to authenticated using (public.is_staff());
create policy "Admins and leads manage court settings" on public.court_config
  for all to authenticated
  using (public.has_role('admin', 'lead')) with check (public.has_role('admin', 'lead'));

-- The VAT part of a price that already includes it.
create or replace function public.court_vat(p_amount numeric)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select round(p_amount - p_amount / (1 + (select value from public.court_config where key = 'vat_percent') / 100), 2);
$$;

-- Finance reports can sum the VAT of each entry.
alter table public.finance_entries add column vat_amount numeric(14, 2) check (vat_amount >= 0);

-- Courts: half-hour blocks --------------------------------------------------------

update public.courts set slot_minutes = 30;
alter table public.courts alter column slot_minutes set default 30;

-- Bookings ----------------------------------------------------------------------

alter table public.court_bookings
  add column kind text not null default 'booking' check (kind in ('booking', 'class')),
  add column private_pay text check (private_pay in ('whole', 'split')),
  add column share_token text not null unique default encode(extensions.gen_random_bytes(12), 'hex'),
  add column moves_used smallint not null default 0 check (moves_used between 0 and 2),
  add column credit numeric(14, 2) not null default 0 check (credit >= 0),
  add column started_at timestamptz,
  add column started_by uuid references public.team_members (id) on delete set null,
  add column override_reason text,
  add column override_by uuid references public.team_members (id) on delete set null,
  add column override_at timestamptz;

alter table public.court_players
  add column checked_in_at timestamptz,
  add column checked_in_by uuid references public.team_members (id) on delete set null;

-- Equipment: the person who takes it pays for it. The price is saved when it's added.
create table public.court_equipment (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.court_bookings (id) on delete cascade,
  player_id uuid not null references public.court_players (id) on delete cascade,
  item text not null references public.court_prices (key) on update cascade,
  label text not null,
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  source text not null default 'booking' check (source in ('booking', 'guest', 'staff')),
  added_by uuid references public.team_members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index court_equipment_booking_idx on public.court_equipment (booking_id);
create index court_equipment_player_idx on public.court_equipment (player_id);

-- Every payment toward a court: who paid, how much, how, and who took it.
create table public.court_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.court_bookings (id) on delete cascade,
  player_id uuid references public.court_players (id) on delete set null,
  amount numeric(14, 2) not null check (amount > 0),         -- colones counted toward what is owed
  method text not null check (method in ('card_online', 'card_reader', 'cash_crc', 'cash_usd', 'sinpe', 'other')),
  amount_usd numeric(14, 2),                                  -- dollars handed over, for cash_usd
  usd_rate numeric(10, 2),                                    -- colones per dollar used
  vat_amount numeric(14, 2) not null default 0,
  taken_by uuid references public.team_members (id) on delete set null,
  payment_id uuid references public.payments (id) on delete set null,
  finance_entry_id uuid references public.finance_entries (id) on delete set null,
  note text,
  refunded boolean not null default false,
  created_at timestamptz not null default now()
);
create index court_payments_booking_idx on public.court_payments (booking_id);
create index court_payments_player_idx on public.court_payments (player_id);

alter table public.court_equipment enable row level security;
alter table public.court_payments enable row level security;
create policy "Staff manage court equipment" on public.court_equipment
  for all to authenticated
  using (public.has_role('admin', 'lead', 'sales', 'facilitator'))
  with check (public.has_role('admin', 'lead', 'sales', 'facilitator'));
create policy "Staff read court payments" on public.court_payments
  for select to authenticated
  using (public.has_role('admin', 'lead', 'sales', 'facilitator'));
-- Court payments are written only by the functions below and the Stripe trigger.

-- Money helpers -------------------------------------------------------------------

create or replace function public.court_balance(p_booking uuid)
returns table (court numeric, equipment numeric, paid numeric, owed numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select b.a, e.s, p.s, b.a + e.s - p.s
  from (select coalesce(amount, 0) as a from public.court_bookings where id = p_booking) b,
    (select coalesce(sum(unit_price), 0) as s from public.court_equipment where booking_id = p_booking) e,
    (select coalesce(sum(amount), 0) as s from public.court_payments where booking_id = p_booking and not refunded) p;
$$;

-- What one player still owes: their share and equipment, less what they paid.
create or replace function public.court_player_due(p_player uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select pl.amount
    + coalesce((select sum(unit_price) from public.court_equipment where player_id = pl.id), 0)
    - coalesce((select sum(amount) from public.court_payments where player_id = pl.id and not refunded), 0)
  from public.court_players pl where pl.id = p_player;
$$;

-- Keep the paid flags in step with the ledger.
create or replace function public.recompute_court(p_booking uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owed numeric;
begin
  update public.court_players p
  set paid = x.settled,
      paid_at = case when x.settled then coalesce(p.paid_at, now()) else null end
  from (
    select pl.id, public.court_player_due(pl.id) <= 0 as settled
    from public.court_players pl where pl.booking_id = p_booking
  ) x
  where p.id = x.id;
  select owed into v_owed from public.court_balance(p_booking);
  update public.court_bookings
  set paid = coalesce(v_owed, 0) <= 0,
      paid_at = case when coalesce(v_owed, 0) <= 0 then coalesce(paid_at, now()) else null end
  where id = p_booking;
end;
$$;

-- Prices ------------------------------------------------------------------------

-- What a court costs for this many minutes, less the member's portal discount.
create or replace function public.court_price(p_court uuid, p_minutes int, p_contact uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select round(cp.price * (1 - coalesce(public.court_discount_for(p_contact), 0) / 100))
  from public.court_prices cp
  where cp.kind = 'court' and cp.minutes = p_minutes and cp.active;
$$;

-- Checks a slot can be booked and returns when it ends. Lengths come from the
-- price list (1, 1½ and 3 hours); start times follow the court's half-hour grid.
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
  if p_minutes is null or not exists (
    select 1 from public.court_prices where kind = 'court' and minutes = p_minutes and active
  ) then
    raise exception 'Pick a length from the list.';
  end if;
  if p_date is null or p_date < today or p_date > today + 14 then
    raise exception 'Courts can be booked up to two weeks ahead.';
  end if;
  if p_start is null then raise exception 'Pick one of the listed times.'; end if;
  e := p_start + make_interval(mins => p_minutes);
  if e <= p_start or p_start < c.open_time or e > c.close_time
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

-- Start times that are free on a court for a length, for the move form.
create or replace function public.court_free_starts(
  p_court uuid, p_date date, p_minutes int, p_ignore uuid default null
)
returns setof time
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.courts;
  t time;
  e time;
begin
  select * into c from public.courts where id = p_court and active;
  if not found then return; end if;
  t := c.open_time;
  while t + make_interval(mins => p_minutes) <= c.close_time loop
    e := t + make_interval(mins => p_minutes);
    begin
      perform public.court_slot_end(c, p_date, t, p_minutes);
      if not exists (
        select 1 from public.court_bookings b
        where b.court_id = c.id and b.date = p_date
          and (b.status = 'booked' or (b.status = 'held' and b.held_until > now()))
          and (p_ignore is null or b.id <> p_ignore)
          and b.start_time < e and b.end_time > t
      ) then
        return next t;
      end if;
    exception when others then
      null;
    end;
    t := t + make_interval(mins => c.slot_minutes);
  end loop;
end;
$$;

-- The courts people can book, with the court prices from the price list.
drop function public.public_courts();
create function public.public_courts()
returns table (
  id uuid, name text, sport text, open_time time, close_time time, slot_minutes smallint,
  price numeric, price_90 numeric, price_180 numeric, currency text, description text, max_players smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.sport, c.open_time, c.close_time, c.slot_minutes,
    (select price from public.court_prices where kind = 'court' and minutes = 60 and active),
    (select price from public.court_prices where kind = 'court' and minutes = 90 and active),
    (select price from public.court_prices where kind = 'court' and minutes = 180 and active),
    'CRC'::text, c.description, c.max_players
  from public.courts c
  where c.active
  order by c.position, c.name;
$$;

create or replace function public.public_court_prices()
returns table (key text, kind text, label text, minutes smallint, price numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select key, kind, label, minutes, price from public.court_prices where active order by position;
$$;

-- People -----------------------------------------------------------------------

-- Find a person by email, or add them as a new contact from the courts. Their
-- phone is kept when we had none.
create or replace function public.court_person(p_name text, p_email text, p_phone text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_id uuid;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return null; end if;
  select id into v_id from public.contacts where email = v_email::extensions.citext limit 1;
  if v_id is null then
    insert into public.contacts (name, email, phone, type, source)
    values (p_name, v_email, nullif(trim(coalesce(p_phone, '')), ''), 'contact', 'Courts')
    returning id into v_id;
  else
    update public.contacts set phone = nullif(trim(coalesce(p_phone, '')), '')
    where id = v_id and (phone is null or trim(phone) = '') and nullif(trim(coalesce(p_phone, '')), '') is not null;
  end if;
  return v_id;
end;
$$;

-- Do two phone numbers match? Digits only, last eight (so +506 or not doesn't matter).
create or replace function public.court_phone_matches(p_a text, p_b text)
returns boolean
language sql
immutable
as $$
  select length(regexp_replace(coalesce(p_a, ''), '\D', '', 'g')) >= 6
    and right(regexp_replace(coalesce(p_a, ''), '\D', '', 'g'), 8) = right(regexp_replace(coalesce(p_b, ''), '\D', '', 'g'), 8);
$$;

-- Equipment ---------------------------------------------------------------------

-- Add equipment for one player: [{key, qty}]. Saves the price as it is now.
create or replace function public.court_add_equipment(
  p_booking uuid, p_player uuid, p_items jsonb, p_source text, p_by uuid
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  q int;
  pr public.court_prices;
  total numeric := 0;
begin
  for r in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    q := least(10, greatest(0, coalesce(nullif(r.value ->> 'qty', '')::int, 1)));
    continue when q = 0;
    select * into pr from public.court_prices where key = r.value ->> 'key' and kind = 'equipment' and active;
    if not found then raise exception 'That equipment isn’t available.'; end if;
    for i in 1..q loop
      insert into public.court_equipment (booking_id, player_id, item, label, unit_price, source, added_by)
      values (p_booking, p_player, pr.key, pr.label, pr.price, p_source, p_by);
      total := total + pr.price;
    end loop;
  end loop;
  return total;
end;
$$;

-- Public reads --------------------------------------------------------------------

-- One day at the courts for anyone: taken slots (no names), classes and blocks
-- held there, and open matches people can join.
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
    case when b.open then b.id end,
    b.open,
    case when b.open then b.level_min end,
    case when b.open then b.level_max end,
    case when b.open then b.spots::int end,
    case when b.open then
      (select count(*)::int from public.court_players p
       where p.booking_id = b.id and (p.status = 'in' or (p.status = 'held' and p.held_until > now())))
    end,
    case when b.open then split_part(trim(b.name), ' ', 1) end,
    case when b.open then
      round(b.amount / b.spots, case when b.currency = 'USD' then 2 else 0 end)
    end,
    b.currency
  from (
    -- An open match is only shown as one once the host has paid.
    select x.*, x.open_match and x.status = 'booked' as open
    from public.court_bookings x
    where x.date = p_date and x.kind = 'booking'
      and (x.status = 'booked' or (x.status = 'held' and x.held_until > now()))
  ) b
  union all
  select k.court_id, k.start_time, k.end_time, 'class', k.name,
    null, false, null, null, null, null, null, null, null
  from public.court_bookings k
  where k.date = p_date and k.kind = 'class' and k.status = 'booked'
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

-- What one share of a match costs, and whether a match can be joined, by the
-- join link (private or open) or by the id of an open match.
create or replace function public.court_join_info(p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  b public.court_bookings;
  c public.courts;
  v_in int;
  v_spots int;
begin
  select * into b from public.court_bookings
  where kind = 'booking' and status = 'booked'
    and (share_token = p_key or (open_match and id::text = p_key));
  if not found then return null; end if;
  select * into c from public.courts where id = b.court_id;
  v_spots := coalesce(b.spots, b.players, 4);
  select count(*)::int into v_in from public.court_players
  where booking_id = b.id and (status = 'in' or (status = 'held' and held_until > now()));
  return jsonb_build_object(
    'booking_id', b.id, 'court', c.name, 'sport', c.sport, 'date', b.date,
    'start_time', b.start_time, 'end_time', b.end_time,
    'host', split_part(trim(b.name), ' ', 1),
    'open_match', b.open_match, 'private_pay', b.private_pay,
    'level_min', b.level_min, 'level_max', b.level_max,
    'spots', v_spots, 'players', v_in, 'currency', b.currency,
    'share', case when b.private_pay = 'whole' then 0
             else round(coalesce(b.amount, 0) / v_spots, case when b.currency = 'USD' then 2 else 0 end) end,
    'closed', (b.date + b.start_time) <= public.org_now() or b.started_at is not null,
    'full', v_in >= v_spots
  );
end;
$$;

-- Everything one booking page needs, by the host's booking token or a
-- player's own token. Names are first names only, and nobody sees who else paid.
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
  v_due numeric;
  v_outside boolean;
  v_movable boolean;
begin
  select * into b from public.court_bookings where token = p_token and kind = 'booking';
  if found then
    select * into you from public.court_players where booking_id = b.id and host order by created_at limit 1;
  else
    select * into you from public.court_players where token = p_token;
    if not found then return null; end if;
    select * into b from public.court_bookings where id = you.booking_id and kind = 'booking';
    if not found then return null; end if;
  end if;
  select * into c from public.courts where id = b.court_id;
  v_due := greatest(0, coalesce(public.court_player_due(you.id), 0));
  v_outside := b.open_match and exists (
    select 1 from public.court_players pl
    where pl.booking_id = b.id and not pl.host and pl.status = 'in'
      and exists (select 1 from public.court_payments x where x.player_id = pl.id and not x.refunded));
  v_movable := you.host and b.status = 'booked' and b.started_at is null and b.moves_used < 2
    and (b.date + b.start_time) >= public.org_now() + interval '3 hours' and not v_outside;
  return jsonb_build_object(
    'booking', jsonb_build_object(
      'id', b.id, 'court', c.name, 'court_id', c.id, 'sport', c.sport, 'date', b.date,
      'start_time', b.start_time, 'end_time', b.end_time, 'status', b.status,
      'minutes', (extract(epoch from (b.end_time - b.start_time)) / 60)::int,
      'open_match', b.open_match, 'private_pay', b.private_pay,
      'level_min', b.level_min, 'level_max', b.level_max,
      'spots', coalesce(b.spots, b.players, 1), 'amount', b.amount, 'currency', b.currency,
      'host', split_part(trim(b.name), ' ', 1), 'notes', b.notes,
      'held_until', b.held_until,
      'share_token', case when you.host then b.share_token end,
      'moves_used', b.moves_used, 'movable', v_movable,
      'started', b.started_at is not null,
      'has_phone', nullif(trim(coalesce(b.phone, '')), '') is not null,
      'cancellable', b.status in ('booked', 'held') and b.started_at is null
        and (b.date + b.start_time) >= public.org_now() + interval '24 hours'
    ),
    'you', jsonb_build_object(
      'id', you.id, 'token', you.token, 'host', you.host, 'status', you.status,
      'amount', you.amount, 'due', v_due, 'paid', v_due <= 0,
      'name', you.name, 'email', you.email, 'level', you.level,
      'equipment', coalesce((
        select jsonb_agg(jsonb_build_object('label', e.label, 'price', e.unit_price) order by e.created_at)
        from public.court_equipment e where e.player_id = you.id), '[]'::jsonb)
    ),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', split_part(trim(p.name), ' ', 1), 'level', p.level, 'host', p.host,
        'status', p.status) order by p.host desc, p.created_at)
      from public.court_players p
      where p.booking_id = b.id and (p.status = 'in' or (p.status = 'held' and p.held_until > now()))
    ), '[]'::jsonb)
  );
end;
$$;

-- Public writes -------------------------------------------------------------------

-- Hold a court (a visitor on /courts, a signed-in member, or staff booking for
-- someone). Paying online: held 20 minutes while they pay on Stripe, then booked.
-- "reception": booked now, settled at the desk. A booking is an open match
-- (listed publicly, joiners pay their share) or private (join link only; the
-- host pays the whole court or splits it). Returns
-- {id, token, player_token, share_token, amount, currency, status}.
create or replace function public.hold_court(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.courts;
  me uuid := public.current_member_contact_id();
  v_staff boolean := coalesce((p ->> 'staff')::boolean, false);
  v_staff_id uuid;
  v_name text := nullif(trim(coalesce(p ->> 'name', '')), '');
  v_email text := lower(trim(coalesce(p ->> 'email', '')));
  v_phone text := nullif(trim(coalesce(p ->> 'phone', '')), '');
  v_date date := nullif(p ->> 'date', '')::date;
  v_start time := nullif(p ->> 'start', '')::time;
  v_minutes int := coalesce(nullif(p ->> 'minutes', '')::int, 60);
  v_open boolean := coalesce((p ->> 'open_match')::boolean, false);
  v_level numeric := nullif(p ->> 'level', '')::numeric;
  v_spots int := coalesce(nullif(p ->> 'spots', '')::int, 4);
  v_split text := coalesce(nullif(p ->> 'private_pay', ''), 'split');
  v_pay text := coalesce(nullif(p ->> 'pay', ''), 'online');
  v_portal boolean := me is not null and coalesce((p ->> 'portal')::boolean, false);
  v_friends jsonb := case when jsonb_typeof(p -> 'friends') = 'array' then p -> 'friends' else '[]'::jsonb end;
  v_equip jsonb := case when jsonb_typeof(p -> 'equipment') = 'array' then p -> 'equipment' else '[]'::jsonb end;
  v_contact uuid;
  v_amount numeric;
  v_share numeric;
  v_host_amount numeric;
  v_equip_total numeric;
  v_due numeric;
  v_status text;
  v_until timestamptz;
  e time;
  b public.court_bookings;
  pl public.court_players;
  f record;
  f_name text;
  f_email text;
  f_phone text;
  f_contact uuid;
begin
  perform public.expire_court_holds();
  if v_staff then
    if not public.has_role('admin', 'lead', 'sales', 'facilitator') then raise exception 'Staff only.'; end if;
    v_staff_id := public.current_staff_id();
    v_pay := 'reception';
    me := null;  -- staff book for someone else, not for their own member profile
  end if;
  select * into c from public.courts where id = nullif(p ->> 'court_id', '')::uuid and active;
  if not found then raise exception 'That court isn’t available.'; end if;
  if v_name is null then raise exception 'Tell us your name.'; end if;
  if not v_staff or v_email <> '' then
    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'That email doesn’t look right.'; end if;
  end if;
  if not v_staff and length(regexp_replace(coalesce(v_phone, ''), '\D', '', 'g')) < 7 then
    raise exception 'Add a phone number (WhatsApp) so we can reach you.';
  end if;
  if v_pay not in ('online', 'reception') then raise exception 'Pick how to pay.'; end if;
  if v_spots not in (2, 4) then raise exception 'A match is for 2 players (singles) or 4 (doubles).'; end if;
  if not v_open and v_split not in ('whole', 'split') then raise exception 'Choose whether you pay the whole court or split it.'; end if;
  e := public.court_slot_end(c, v_date, v_start, v_minutes);
  if v_open then
    if v_level is null or v_level < 0 or v_level > 7 then
      raise exception 'Pick your level for an open match.';
    end if;
    v_friends := '[]'::jsonb;
  elsif jsonb_array_length(v_friends) > v_spots - 1 then
    raise exception 'That’s more friends than the match has spots.';
  end if;

  -- The person: the signed-in member, a contact staff picked, or found (or added) by email.
  -- (a signed-in member books as themselves only when the email is theirs)
  v_contact := case when me is not null and exists (
    select 1 from public.contacts where id = me and email = nullif(v_email, '')::extensions.citext) then me end;
  if v_contact is null and v_staff then v_contact := nullif(p ->> 'contact_id', '')::uuid; end if;
  if v_contact is null then v_contact := public.court_person(v_name, v_email, v_phone); end if;

  if not v_staff and v_contact is not null and (select count(*) from public.court_bookings
      where contact_id = v_contact and date = v_date and status in ('booked', 'held') and kind = 'booking') >= 2 then
    raise exception 'You can book two slots a day.';
  end if;

  v_amount := public.court_price(c.id, v_minutes, case when v_portal then v_contact end);
  if v_amount is null then raise exception 'Pick a length from the list.'; end if;
  v_share := round(v_amount / v_spots);
  v_host_amount := case when not v_open and v_split = 'whole' then v_amount else v_amount - v_share * (v_spots - 1) end;
  select coalesce(sum(cp.price * least(10, greatest(0, coalesce(nullif(e2.value ->> 'qty', '')::int, 1)))), 0)
  into v_equip_total
  from jsonb_array_elements(v_equip) e2
  join public.court_prices cp on cp.key = e2.value ->> 'key' and cp.kind = 'equipment' and cp.active;
  v_due := v_host_amount + v_equip_total;
  if v_due = 0 then v_pay := 'reception'; end if;
  v_status := case when v_pay = 'online' then 'held' else 'booked' end;
  v_until := case when v_pay = 'online' then now() + interval '20 minutes' end;

  begin
    insert into public.court_bookings (
      court_id, date, start_time, end_time, contact_id, name, email, phone, players, notes,
      source, status, held_until, amount, currency, open_match, private_pay, level, level_min, level_max, spots, created_by
    ) values (
      c.id, v_date, v_start, e, v_contact, v_name, nullif(v_email, ''), v_phone, v_spots,
      nullif(trim(coalesce(p ->> 'notes', '')), ''),
      case when v_staff then 'staff' when v_portal then 'portal' else 'web' end, v_status, v_until, v_amount, c.currency,
      v_open, case when v_open then null else v_split end, v_level,
      case when v_open then greatest(0, coalesce(nullif(p ->> 'level_min', '')::numeric, v_level - 1)) end,
      case when v_open then least(7, coalesce(nullif(p ->> 'level_max', '')::numeric, v_level + 1)) end,
      v_spots, v_staff_id
    ) returning * into b;
  exception when exclusion_violation then
    raise exception 'Someone just took that slot. Pick another.';
  end;

  insert into public.court_players (booking_id, contact_id, name, email, phone, level, host, status, amount, held_until)
  values (b.id, v_contact, v_name, nullif(v_email, ''), v_phone, v_level, true,
    case when v_pay = 'online' then 'held' else 'in' end, v_host_amount, v_until)
  returning * into pl;

  -- Friends the host typed in: named, and they owe their share on a split.
  for f in select * from jsonb_array_elements(v_friends) loop
    f_name := nullif(trim(coalesce(f.value ->> 'name', '')), '');
    f_email := lower(trim(coalesce(f.value ->> 'email', '')));
    f_phone := nullif(trim(coalesce(f.value ->> 'phone', '')), '');
    if f_name is null then raise exception 'Every friend needs a name.'; end if;
    if not v_staff then
      if f_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Add an email for %.', f_name; end if;
      if length(regexp_replace(coalesce(f_phone, ''), '\D', '', 'g')) < 7 then raise exception 'Add a phone number for %.', f_name; end if;
    end if;
    f_contact := public.court_person(f_name, f_email, f_phone);
    insert into public.court_players (booking_id, contact_id, name, email, phone, host, status, amount)
    values (b.id, f_contact, f_name, nullif(f_email, ''), f_phone, false, 'in',
      case when v_split = 'whole' then 0 else v_share end);
  end loop;

  perform public.court_add_equipment(b.id, pl.id, v_equip, case when v_staff then 'staff' else 'booking' end, v_staff_id);
  perform public.recompute_court(b.id);

  return jsonb_build_object(
    'id', b.id, 'token', b.token, 'player_token', pl.token, 'share_token', b.share_token,
    'amount', v_due, 'currency', c.currency, 'status', b.status
  );
end;
$$;

-- Join a match as one player, from the public listing or a join link. The share
-- is paid online (held 20 minutes); on a private match where the host pays the
-- whole court there's nothing to pay and the player is in straight away.
-- Everyone gives name, email and phone. Returns {id, token, amount, currency, status}.
create or replace function public.join_court_match(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.court_bookings;
  me uuid := public.current_member_contact_id();
  v_name text := nullif(trim(coalesce(p ->> 'name', '')), '');
  v_email text := lower(trim(coalesce(p ->> 'email', '')));
  v_phone text := nullif(trim(coalesce(p ->> 'phone', '')), '');
  v_level numeric := nullif(p ->> 'level', '')::numeric;
  v_pay text := coalesce(nullif(p ->> 'pay', ''), 'online');
  v_equip jsonb := case when jsonb_typeof(p -> 'equipment') = 'array' then p -> 'equipment' else '[]'::jsonb end;
  v_key_id uuid;
  v_contact uuid;
  v_share numeric;
  v_equip_total numeric;
  v_in int;
  v_spots int;
  pl public.court_players;
begin
  perform public.expire_court_holds();
  begin
    v_key_id := nullif(p ->> 'booking_id', '')::uuid;
  exception when others then
    v_key_id := null;
  end;
  select * into b from public.court_bookings
  where kind = 'booking' and status = 'booked'
    and ((open_match and id = v_key_id) or share_token = nullif(p ->> 'share_token', ''))
  for update;
  if not found then raise exception 'That match isn’t open any more.'; end if;
  v_spots := coalesce(b.spots, b.players, 4);
  if v_name is null then raise exception 'Tell us your name.'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'That email doesn’t look right.'; end if;
  if length(regexp_replace(coalesce(v_phone, ''), '\D', '', 'g')) < 7 then
    raise exception 'Add a phone number (WhatsApp) so we can reach you.';
  end if;
  if v_pay not in ('online', 'reception') then raise exception 'Pick how to pay.'; end if;
  if (b.date + b.start_time) <= public.org_now() or b.started_at is not null then
    raise exception 'That match has started.';
  end if;
  if b.open_match and (v_level is null or v_level < b.level_min or v_level > b.level_max) then
    raise exception 'This match is for levels % to %.', b.level_min, b.level_max;
  end if;
  select count(*) into v_in from public.court_players
  where booking_id = b.id and status in ('in', 'held');
  if v_in >= v_spots then raise exception 'That match is full.'; end if;
  if exists (select 1 from public.court_players
             where booking_id = b.id and status in ('in', 'held') and email = v_email::extensions.citext) then
    raise exception 'You’re already in this match.';
  end if;

  v_contact := case when me is not null and exists (
    select 1 from public.contacts where id = me and email = v_email::extensions.citext) then me end;
  if v_contact is null then v_contact := public.court_person(v_name, v_email, v_phone); end if;

  v_share := case when b.private_pay = 'whole' then 0 else round(b.amount / v_spots) end;
  select coalesce(sum(cp.price * least(10, greatest(0, coalesce(nullif(e2.value ->> 'qty', '')::int, 1)))), 0)
  into v_equip_total
  from jsonb_array_elements(v_equip) e2
  join public.court_prices cp on cp.key = e2.value ->> 'key' and cp.kind = 'equipment' and cp.active;
  if v_share + v_equip_total = 0 then v_pay := 'reception'; end if;

  insert into public.court_players (booking_id, contact_id, name, email, phone, level, host, status, amount, held_until)
  values (b.id, v_contact, v_name, v_email, v_phone, v_level, false,
    case when v_pay = 'online' then 'held' else 'in' end, v_share,
    case when v_pay = 'online' then now() + interval '20 minutes' end)
  returning * into pl;

  perform public.court_add_equipment(b.id, pl.id, v_equip, 'guest', null);
  perform public.recompute_court(b.id);

  return jsonb_build_object(
    'id', pl.id, 'token', pl.token,
    'amount', v_share + v_equip_total, 'currency', b.currency, 'status', pl.status
  );
end;
$$;

-- Add equipment to your own booking page (the host's or a player's token).
create or replace function public.add_court_equipment_by_token(p_token text, p_items jsonb)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.court_bookings;
  pl public.court_players;
  v_total numeric;
begin
  select * into b from public.court_bookings where token = p_token and kind = 'booking';
  if found then
    select * into pl from public.court_players where booking_id = b.id and host order by created_at limit 1;
  else
    select * into pl from public.court_players where token = p_token;
    if not found then raise exception 'We couldn’t find that booking.'; end if;
    select * into b from public.court_bookings where id = pl.booking_id;
  end if;
  if b.status not in ('booked', 'held') or b.started_at is not null or b.date < public.org_today() then
    raise exception 'This booking is over, so equipment can’t be added.';
  end if;
  if pl.status not in ('in', 'held') then raise exception 'You’re not in this match.'; end if;
  v_total := public.court_add_equipment(b.id, pl.id, p_items, case when pl.host then 'booking' else 'guest' end, null);
  perform public.recompute_court(b.id);
  return v_total;
end;
$$;

-- Cancel with a booking token (the host cancels the court, up to 24 hours
-- before, after confirming the phone number on the booking) or a player token
-- (leave a match). Money already paid is refunded by the team.
drop function public.cancel_court_by_token(text);
create function public.cancel_court_by_token(p_token text, p_phone text default null)
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
  select * into b from public.court_bookings where token = p_token and kind = 'booking';
  if not found then
    select * into pl from public.court_players where token = p_token;
    if not found then raise exception 'We couldn’t find that booking.'; end if;
    select * into b from public.court_bookings where id = pl.booking_id;
    if not pl.host then
      if pl.status not in ('in', 'held') then raise exception 'You’ve already left this match.'; end if;
      if (b.date + b.start_time) <= public.org_now() or b.started_at is not null then raise exception 'That match has started.'; end if;
      select count(*) into v_in from public.court_players where booking_id = b.id and status in ('in', 'held');
      if v_in >= coalesce(b.spots, 4) and (b.date + b.start_time) < cutoff then
        raise exception 'The match is full, so you can leave up to 24 hours before. For anything later, message us.';
      end if;
      update public.court_players set status = 'out' where id = pl.id;
      return 'player';
    end if;
  end if;
  if b.status not in ('booked', 'held') then raise exception 'That booking is already cancelled.'; end if;
  if b.started_at is not null then raise exception 'The game has already started.'; end if;
  if nullif(trim(coalesce(b.phone, '')), '') is not null and not public.court_phone_matches(p_phone, b.phone) then
    raise exception 'That phone number doesn’t match the one on the booking.';
  end if;
  if (b.date + b.start_time) < cutoff then
    raise exception 'Bookings can be cancelled up to 24 hours before. For anything later, message us.';
  end if;
  update public.court_bookings set status = 'cancelled' where id = b.id;
  update public.court_players set status = 'out' where booking_id = b.id and status in ('in', 'held');
  return 'booking';
end;
$$;

-- Moving a booking -----------------------------------------------------------------

-- The rules for moving, once we know who is asking. Up to 3 hours before the
-- start, twice at most. One UPDATE frees the old slot and takes the new one, so
-- nobody can slip in between (the overlap constraint checks the new range).
-- Same length: what's paid carries over. Longer: the extra is owed (split across
-- players on a split booking, else by the host). Shorter: no refund, the
-- difference is noted as a credit for staff.
create or replace function public.court_move_core(p_id uuid, p_date date, p_start time, p_minutes int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.court_bookings;
  c public.courts;
  e time;
  new_total numeric;
  v_share numeric;
  v_spots int;
  v_paid numeric;
  v_eq numeric;
  v_credit numeric;
  v_owed numeric;
begin
  perform public.expire_court_holds();
  select * into b from public.court_bookings where id = p_id for update;
  if not found or b.status <> 'booked' or b.kind <> 'booking' then
    raise exception 'That booking can’t be moved.';
  end if;
  if b.started_at is not null then raise exception 'The game has already started.'; end if;
  if b.moves_used >= 2 then raise exception 'This booking has already been moved twice.'; end if;
  if (b.date + b.start_time) < public.org_now() + interval '3 hours' then
    raise exception 'Bookings can be moved up to 3 hours before the start. For anything later, message us.';
  end if;
  if b.open_match and exists (
    select 1 from public.court_players pl
    where pl.booking_id = b.id and not pl.host and pl.status = 'in'
      and exists (select 1 from public.court_payments x where x.player_id = pl.id and not x.refunded)
  ) then
    raise exception 'Someone has joined and paid, so this match can’t be moved. Message us.';
  end if;
  select * into c from public.courts where id = b.court_id;
  e := public.court_slot_end(c, p_date, p_start, p_minutes);
  if p_date = b.date and p_start = b.start_time and e = b.end_time then
    raise exception 'That’s the time you already have.';
  end if;
  new_total := public.court_price(c.id, p_minutes, case when b.source = 'portal' then b.contact_id end);
  if new_total is null then raise exception 'Pick a length from the list.'; end if;

  begin
    update public.court_bookings
    set date = p_date, start_time = p_start, end_time = e, amount = new_total, moves_used = moves_used + 1
    where id = b.id;
  exception when exclusion_violation then
    raise exception 'Someone just took that slot. Pick another.';
  end;

  -- A different length changes what each player owes.
  if new_total is distinct from b.amount then
    v_spots := coalesce(b.spots, b.players, 1);
    if b.open_match or b.private_pay = 'split' then
      v_share := round(new_total / v_spots);
      update public.court_players set amount = v_share
      where booking_id = b.id and not host and status in ('in', 'held');
      update public.court_players set amount = new_total - v_share * (v_spots - 1)
      where booking_id = b.id and host;
    else
      update public.court_players set amount = new_total where booking_id = b.id and host;
    end if;
  end if;

  select coalesce(sum(amount), 0) into v_paid from public.court_payments where booking_id = b.id and not refunded;
  select coalesce(sum(unit_price), 0) into v_eq from public.court_equipment where booking_id = b.id;
  v_credit := greatest(0, v_paid - (new_total + v_eq));
  update public.court_bookings
  set credit = v_credit,
      notes = case when v_credit > b.credit
        then concat_ws(E'\n', notes, 'Moved to a shorter time: credit of ₡' || to_char(v_credit, 'FM999,999,999') || ' for staff to settle.')
        else notes end
  where id = b.id;
  perform public.recompute_court(b.id);
  select owed into v_owed from public.court_balance(b.id);

  return jsonb_build_object(
    'date', p_date, 'start_time', p_start, 'end_time', e, 'minutes', p_minutes,
    'amount', new_total, 'credit', v_credit, 'owed', greatest(v_owed, 0),
    'moves_left', 2 - (b.moves_used + 1)
  );
end;
$$;

-- Move with the private link: the person confirms the phone number on the booking.
create or replace function public.move_court_booking(
  p_token text, p_phone text, p_date date, p_start time, p_minutes int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.court_bookings;
  pl public.court_players;
begin
  select * into b from public.court_bookings where token = p_token and kind = 'booking';
  if not found then
    select * into pl from public.court_players where token = p_token;
    if not found then raise exception 'We couldn’t find that booking.'; end if;
    if not pl.host then raise exception 'Only the person who booked can move it.'; end if;
    select * into b from public.court_bookings where id = pl.booking_id;
  end if;
  if nullif(trim(coalesce(b.phone, '')), '') is null then
    raise exception 'This booking has no phone number on it. Message us to move it.';
  end if;
  if not public.court_phone_matches(p_phone, b.phone) then
    raise exception 'That phone number doesn’t match the one on the booking.';
  end if;
  return public.court_move_core(b.id, p_date, p_start, p_minutes);
end;
$$;

-- Move from the members' app: the signed-in member must be the one who booked.
create or replace function public.move_my_court_booking(p_id uuid, p_date date, p_start time, p_minutes int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.court_bookings
    where id = p_id and contact_id is not null and contact_id = public.current_member_contact_id()
  ) then
    raise exception 'Only the person who booked can move it.';
  end if;
  return public.court_move_core(p_id, p_date, p_start, p_minutes);
end;
$$;

-- Members -------------------------------------------------------------------------

-- The legacy one-click booking now takes the shortest length.
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
    'court_id', p_court, 'date', p_date, 'start', p_start, 'minutes', 60,
    'name', p.name, 'email', p.email, 'phone', coalesce(p.phone, '0000000'), 'pay', 'reception',
    'private_pay', 'whole', 'spots', 4));
  return (r ->> 'id')::uuid;
end;
$$;

drop function public.my_court_bookings();
create function public.my_court_bookings()
returns table (
  id uuid, court text, date date, start_time time, end_time time,
  token text, player_token text, amount numeric, currency text, paid boolean, open_match boolean,
  court_id uuid, minutes int, share_token text, private_pay text, spots int, movable boolean, due numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, c.name, b.date, b.start_time, b.end_time, b.token,
    (select p.token from public.court_players p where p.booking_id = b.id and p.host limit 1),
    b.amount, b.currency,
    (select owed <= 0 from public.court_balance(b.id)),
    b.open_match, b.court_id,
    (extract(epoch from (b.end_time - b.start_time)) / 60)::int,
    b.share_token, b.private_pay, coalesce(b.spots, b.players, 1),
    b.moves_used < 2 and b.started_at is null and (b.date + b.start_time) >= public.org_now() + interval '3 hours'
      and not (b.open_match and exists (
        select 1 from public.court_players pl
        where pl.booking_id = b.id and not pl.host and pl.status = 'in'
          and exists (select 1 from public.court_payments x where x.player_id = pl.id and not x.refunded))),
    (select greatest(owed, 0) from public.court_balance(b.id))
  from public.court_bookings b join public.courts c on c.id = b.court_id
  where b.contact_id = public.current_member_contact_id()
    and b.status = 'booked' and b.kind = 'booking'
    and b.date >= public.org_today()
  order by b.date, b.start_time;
$$;

-- Stripe payments land in the ledger -----------------------------------------------

-- A court payment recorded by record_stripe_payment() becomes a ledger row, with
-- its VAT part, and the Finance entry learns its VAT.
create or replace function public.court_payment_to_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.court_booking_id is null or new.currency <> 'CRC' then return new; end if;
  insert into public.court_payments (booking_id, player_id, amount, method, vat_amount, payment_id, finance_entry_id)
  values (new.court_booking_id, new.court_player_id, new.amount, 'card_online', public.court_vat(new.amount), new.id, new.finance_entry_id);
  update public.finance_entries set vat_amount = public.court_vat(new.amount) where id = new.finance_entry_id;
  perform public.recompute_court(new.court_booking_id);
  return new;
end;
$$;
create trigger payments_court_ledger after insert on public.payments
  for each row when (new.kind = 'court') execute function public.court_payment_to_ledger();

create or replace function public.court_payment_refunded()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.court_payments set refunded = true where payment_id = new.id;
  if new.court_booking_id is not null then perform public.recompute_court(new.court_booking_id); end if;
  return new;
end;
$$;
create trigger payments_court_refund after update of status on public.payments
  for each row when (new.kind = 'court' and new.status = 'refunded' and old.status is distinct from new.status)
  execute function public.court_payment_refunded();

-- Card payments already made become ledger rows.
insert into public.court_payments (booking_id, player_id, amount, method, vat_amount, payment_id, finance_entry_id, refunded, created_at)
select p.court_booking_id, p.court_player_id, p.amount, 'card_online', public.court_vat(p.amount), p.id,
  p.finance_entry_id, p.status = 'refunded', p.paid_at
from public.payments p
where p.kind = 'court' and p.court_booking_id is not null and p.currency = 'CRC' and p.amount > 0;
update public.finance_entries f set vat_amount = public.court_vat(f.amount)
where f.id in (select finance_entry_id from public.court_payments where finance_entry_id is not null);
-- Bookings ticked "paid" by hand before, with no payment behind them, keep their paid state.
insert into public.court_payments (booking_id, amount, method, vat_amount, note)
select b.id, b.amount, 'other', public.court_vat(b.amount), 'Marked paid before payments were recorded'
from public.court_bookings b
where b.paid and coalesce(b.amount, 0) > 0
  and not exists (select 1 from public.court_payments x where x.booking_id = b.id);

-- Community manager and staff ---------------------------------------------------------

-- The whole day for the staff schedule: every booking, who is in, what each owes
-- and has paid, equipment and payments. Staff only.
create or replace function public.staff_court_day(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('admin', 'lead', 'sales', 'facilitator') then raise exception 'Staff only.'; end if;
  perform public.expire_court_holds();
  return coalesce((
    select jsonb_agg(x.j order by x.st)
    from (
      select b.start_time as st, jsonb_build_object(
        'id', b.id, 'court_id', b.court_id, 'kind', b.kind, 'status', b.status,
        'name', b.name, 'email', b.email, 'phone', b.phone, 'contact_id', b.contact_id,
        'start_time', b.start_time, 'end_time', b.end_time,
        'open_match', b.open_match, 'private_pay', b.private_pay,
        'spots', coalesce(b.spots, b.players, 1),
        'level_min', b.level_min, 'level_max', b.level_max,
        'notes', b.notes, 'source', b.source, 'currency', b.currency,
        'amount', coalesce(b.amount, 0), 'credit', b.credit, 'moves_used', b.moves_used,
        'share_token', b.share_token, 'started_at', b.started_at,
        'override_reason', b.override_reason, 'override_at', b.override_at,
        'override_by', (select name from public.team_members where id = b.override_by),
        'equipment_total', eq.total, 'paid_total', pd.total,
        'owed', coalesce(b.amount, 0) + eq.total - pd.total,
        'state', case when b.kind = 'class' then 'class'
                      when coalesce(b.amount, 0) + eq.total - pd.total <= 0 and b.status = 'booked' then 'green'
                      else 'red' end,
        'players', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', pl.id, 'name', pl.name, 'email', pl.email, 'phone', pl.phone, 'host', pl.host,
            'status', pl.status, 'level', pl.level, 'share', pl.amount,
            'checked_in_at', pl.checked_in_at,
            'named', nullif(trim(pl.name), '') is not null and nullif(trim(coalesce(pl.email::text, '')), '') is not null
                     and nullif(trim(coalesce(pl.phone, '')), '') is not null,
            'equipment', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'label', e.label, 'price', e.unit_price) order by e.created_at)
                                   from public.court_equipment e where e.player_id = pl.id), '[]'::jsonb),
            'equipment_total', coalesce((select sum(unit_price) from public.court_equipment where player_id = pl.id), 0),
            'paid', coalesce((select sum(amount) from public.court_payments where player_id = pl.id and not refunded), 0),
            'owed', public.court_player_due(pl.id)
          ) order by pl.host desc, pl.created_at)
          from public.court_players pl
          where pl.booking_id = b.id and (pl.status = 'in' or (pl.status = 'held' and pl.held_until > now()))
        ), '[]'::jsonb),
        'payments', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', cp.id, 'amount', cp.amount, 'method', cp.method, 'amount_usd', cp.amount_usd,
            'usd_rate', cp.usd_rate, 'vat_amount', cp.vat_amount, 'refunded', cp.refunded,
            'created_at', cp.created_at, 'note', cp.note,
            'player', (select name from public.court_players where id = cp.player_id),
            'taken_by', (select name from public.team_members where id = cp.taken_by)
          ) order by cp.created_at)
          from public.court_payments cp where cp.booking_id = b.id
        ), '[]'::jsonb)
      ) as j
      from public.court_bookings b
      cross join lateral (select coalesce(sum(unit_price), 0) as total from public.court_equipment where booking_id = b.id) eq
      cross join lateral (select coalesce(sum(amount), 0) as total from public.court_payments where booking_id = b.id and not refunded) pd
      where b.date = p_date and (b.status = 'booked' or (b.status = 'held' and b.held_until > now()))
    ) x
  ), '[]'::jsonb);
end;
$$;

create or replace function public.court_staff_check()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role('admin', 'lead', 'sales', 'facilitator') then raise exception 'Staff only.'; end if;
  return public.current_staff_id();
end;
$$;

-- Put a player into a booking (fills a spot; fills in names at check-in).
create or replace function public.staff_add_court_player(
  p_booking uuid, p_name text, p_email text, p_phone text, p_contact uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.court_bookings;
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_email text := lower(trim(coalesce(p_email, '')));
  v_contact uuid := p_contact;
  v_in int;
  v_id uuid;
  v_spots int;
begin
  perform public.court_staff_check();
  select * into b from public.court_bookings where id = p_booking and kind = 'booking' for update;
  if not found or b.status <> 'booked' then raise exception 'That booking isn’t open.'; end if;
  if v_name is null then raise exception 'Enter the player’s name.'; end if;
  v_spots := coalesce(b.spots, b.players, 1);
  select count(*) into v_in from public.court_players where booking_id = b.id and status in ('in', 'held');
  if v_in >= v_spots then raise exception 'Everyone is already listed.'; end if;
  if v_contact is null then v_contact := public.court_person(v_name, v_email, p_phone); end if;
  insert into public.court_players (booking_id, contact_id, name, email, phone, host, status, amount)
  values (b.id, v_contact, v_name, nullif(v_email, ''), nullif(trim(coalesce(p_phone, '')), ''), false, 'in',
    case when b.open_match or b.private_pay = 'split' then round(coalesce(b.amount, 0) / v_spots) else 0 end)
  returning id into v_id;
  perform public.recompute_court(b.id);
  return v_id;
end;
$$;

-- Fill in or fix a player's name, email and phone.
create or replace function public.staff_update_court_player(p_player uuid, p_name text, p_email text, p_phone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  pl public.court_players;
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_email text := lower(trim(coalesce(p_email, '')));
  v_contact uuid;
begin
  perform public.court_staff_check();
  select * into pl from public.court_players where id = p_player for update;
  if not found then raise exception 'Unknown player.'; end if;
  if v_name is null then raise exception 'Enter the player’s name.'; end if;
  if v_email <> '' and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'That email doesn’t look right.'; end if;
  v_contact := coalesce(pl.contact_id, public.court_person(v_name, v_email, p_phone));
  update public.court_players
  set name = v_name, email = nullif(v_email, ''), phone = nullif(trim(coalesce(p_phone, '')), ''), contact_id = v_contact
  where id = p_player;
  if pl.host then
    update public.court_bookings
    set name = v_name, email = nullif(v_email, ''), phone = nullif(trim(coalesce(p_phone, '')), '')
    where id = pl.booking_id;
  end if;
end;
$$;

create or replace function public.staff_check_in_court_player(p_player uuid, p_in boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff uuid := public.court_staff_check();
begin
  update public.court_players
  set checked_in_at = case when p_in then coalesce(checked_in_at, now()) else null end,
      checked_in_by = case when p_in then v_staff else null end
  where id = p_player and status = 'in';
  if not found then raise exception 'That player isn’t in the booking.'; end if;
end;
$$;

create or replace function public.staff_add_court_equipment(p_booking uuid, p_player uuid, p_item text, p_qty int default 1)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff uuid := public.court_staff_check();
  b public.court_bookings;
begin
  select * into b from public.court_bookings where id = p_booking and kind = 'booking';
  if not found or b.status <> 'booked' then raise exception 'That booking isn’t open.'; end if;
  if not exists (select 1 from public.court_players where id = p_player and booking_id = p_booking and status in ('in', 'held')) then
    raise exception 'That player isn’t in the booking.';
  end if;
  perform public.court_add_equipment(p_booking, p_player, jsonb_build_array(jsonb_build_object('key', p_item, 'qty', p_qty)), 'staff', v_staff);
  perform public.recompute_court(p_booking);
end;
$$;

create or replace function public.staff_remove_court_equipment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.court_equipment;
begin
  perform public.court_staff_check();
  select * into e from public.court_equipment where id = p_id;
  if not found then return; end if;
  if exists (select 1 from public.court_bookings where id = e.booking_id and started_at is not null) then
    raise exception 'The game has started, so equipment can’t be removed.';
  end if;
  delete from public.court_equipment where id = p_id;
  perform public.recompute_court(e.booking_id);
end;
$$;

-- Take a payment at the courts. Methods: card_reader (BAC), cash_crc, cash_usd
-- (p_usd dollars, converted at the rate in court_config; both amounts are kept),
-- sinpe. The amount counted is capped at what is owed. Records the VAT part and
-- a Finance entry.
create or replace function public.staff_take_court_payment(
  p_booking uuid, p_player uuid, p_method text, p_amount numeric, p_usd numeric default null, p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff uuid := public.court_staff_check();
  b public.court_bookings;
  pl public.court_players;
  c public.courts;
  v_owed numeric;
  v_rate numeric := (select value from public.court_config where key = 'usd_crc_rate');
  v_crc numeric;
  v_credited numeric;
  v_line uuid;
  v_entry uuid;
  v_id uuid;
begin
  if p_method not in ('card_reader', 'cash_crc', 'cash_usd', 'sinpe') then raise exception 'Pick how they paid.'; end if;
  select * into b from public.court_bookings where id = p_booking and kind = 'booking' for update;
  if not found or b.status <> 'booked' then raise exception 'That booking isn’t open.'; end if;
  select * into pl from public.court_players where id = p_player and booking_id = p_booking and status in ('in', 'held');
  if not found then raise exception 'Pick the player who paid.'; end if;
  select owed into v_owed from public.court_balance(p_booking);
  if v_owed <= 0 then raise exception 'Nothing is owed on this booking.'; end if;
  if p_method = 'cash_usd' then
    if p_usd is null or p_usd <= 0 then raise exception 'Enter the dollars received.'; end if;
    v_crc := round(p_usd * v_rate);
  else
    if p_amount is null or p_amount <= 0 then raise exception 'Enter the amount.'; end if;
    if p_amount > v_owed then raise exception 'That’s more than the ₡% owed.', to_char(v_owed, 'FM999,999,999'); end if;
    v_crc := round(p_amount);
  end if;
  v_credited := least(v_crc, v_owed);
  select * into c from public.courts where id = b.court_id;

  select id into v_line from public.business_lines where name = 'Courts' order by position limit 1;
  insert into public.finance_entries (
    kind, entry_date, business_line_id, category, party, description,
    amount, currency, method, reference, status, vat_amount
  ) values (
    'income', public.org_today(), v_line, 'Court bookings', pl.name,
    c.name || ', ' || b.date || ' ' || to_char(b.start_time, 'HH24:MI') || '–' || to_char(b.end_time, 'HH24:MI')
      || case when p_method = 'cash_usd' then format(' (cash $%s at ₡%s)', p_usd, v_rate) else '' end,
    v_credited,
    'CRC',
    case p_method when 'card_reader' then 'card' when 'sinpe' then 'sinpe' else 'cash' end,
    'court:' || p_booking, 'paid', public.court_vat(v_credited)
  ) returning id into v_entry;

  insert into public.court_payments (
    booking_id, player_id, amount, method, amount_usd, usd_rate, vat_amount, taken_by, finance_entry_id, note
  ) values (
    p_booking, p_player, v_credited, p_method,
    case when p_method = 'cash_usd' then p_usd end,
    case when p_method = 'cash_usd' then v_rate end,
    public.court_vat(v_credited), v_staff, v_entry, nullif(trim(coalesce(p_note, '')), '')
  ) returning id into v_id;

  perform public.recompute_court(p_booking);
  select owed into v_owed from public.court_balance(p_booking);
  return jsonb_build_object(
    'id', v_id, 'credited', v_credited, 'received_crc', v_crc, 'usd', p_usd, 'rate', v_rate,
    'owed', greatest(v_owed, 0)
  );
end;
$$;

-- Start the game. Needs every player named and checked in and everything paid.
-- With a reason, the community manager can start anyway: who, when and why are kept.
create or replace function public.staff_start_court_game(p_booking uuid, p_override_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff uuid := public.court_staff_check();
  b public.court_bookings;
  v_required int;
  v_named int;
  v_in int;
  v_checked int;
  v_paying int;
  v_owed numeric;
  v_problems text[] := '{}';
  v_reason text := nullif(trim(coalesce(p_override_reason, '')), '');
begin
  select * into b from public.court_bookings where id = p_booking and kind = 'booking' for update;
  if not found or b.status <> 'booked' then raise exception 'That booking isn’t open.'; end if;
  if b.started_at is not null then raise exception 'The game has already started.'; end if;
  v_required := coalesce(b.spots, b.players, 1);
  select count(*) filter (where status = 'in'),
    count(*) filter (where status = 'in' and nullif(trim(name), '') is not null
      and nullif(trim(coalesce(email::text, '')), '') is not null and nullif(trim(coalesce(phone, '')), '') is not null),
    count(*) filter (where status = 'in' and checked_in_at is not null),
    count(*) filter (where status = 'held')
  into v_in, v_named, v_checked, v_paying
  from public.court_players where booking_id = b.id;
  select owed into v_owed from public.court_balance(b.id);
  if v_named < v_required then
    v_problems := v_problems || format('%s of %s players named', v_named, v_required);
  end if;
  if v_checked < v_in or v_in < v_required then
    v_problems := v_problems || format('%s of %s checked in', v_checked, v_required);
  end if;
  if v_paying > 0 then v_problems := v_problems || 'someone is still paying'; end if;
  if v_owed > 0 then
    v_problems := v_problems || ('₡' || to_char(v_owed, 'FM999,999,999') || ' still owed');
  end if;
  if cardinality(v_problems) > 0 and v_reason is null then
    raise exception 'Can’t start yet: %.', array_to_string(v_problems, '; ');
  end if;
  update public.court_bookings
  set started_at = now(), started_by = v_staff,
      override_reason = case when cardinality(v_problems) > 0
        then v_reason || ' (' || array_to_string(v_problems, '; ') || ')' end,
      override_by = case when cardinality(v_problems) > 0 then v_staff end,
      override_at = case when cardinality(v_problems) > 0 then now() end
  where id = b.id;
  return jsonb_build_object('started', true, 'override', cardinality(v_problems) > 0);
end;
$$;

-- Block a court for a class, right from the schedule. The public can't book it.
create or replace function public.staff_block_court(p_court uuid, p_date date, p_start time, p_end time, p_title text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff uuid := public.court_staff_check();
  v_id uuid;
begin
  if p_end <= p_start then raise exception 'The end must be after the start.'; end if;
  if extract(epoch from (p_start))::int % 1800 <> 0 or extract(epoch from (p_end))::int % 1800 <> 0 then
    raise exception 'Pick half-hour times.';
  end if;
  begin
    insert into public.court_bookings (court_id, date, start_time, end_time, name, kind, status, source, created_by, open_match)
    values (p_court, p_date, p_start, p_end, coalesce(nullif(trim(coalesce(p_title, '')), ''), 'Class'), 'class', 'booked', 'staff', v_staff, false)
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'Something is already booked on that court then.';
  end;
  return v_id;
end;
$$;

create or replace function public.staff_cancel_court(p_booking uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.court_staff_check();
  update public.court_bookings set status = 'cancelled' where id = p_booking and status in ('booked', 'held');
  update public.court_players set status = 'out' where booking_id = p_booking and status in ('in', 'held');
end;
$$;

-- Grants -------------------------------------------------------------------------

revoke all on function public.court_vat(numeric) from public, anon, authenticated;
revoke all on function public.court_balance(uuid) from public, anon, authenticated;
revoke all on function public.court_player_due(uuid) from public, anon, authenticated;
revoke all on function public.recompute_court(uuid) from public, anon, authenticated;
revoke all on function public.court_person(text, text, text) from public, anon, authenticated;
revoke all on function public.court_phone_matches(text, text) from public, anon, authenticated;
revoke all on function public.court_add_equipment(uuid, uuid, jsonb, text, uuid) from public, anon, authenticated;
revoke all on function public.court_move_core(uuid, date, time, int) from public, anon, authenticated;
revoke all on function public.court_staff_check() from public, anon;
revoke all on function public.court_payment_to_ledger() from public, anon, authenticated;
revoke all on function public.court_payment_refunded() from public, anon, authenticated;
revoke all on function public.court_free_starts(uuid, date, int, uuid) from public;
revoke all on function public.public_courts() from public;
revoke all on function public.public_court_prices() from public;
revoke all on function public.court_join_info(text) from public;
revoke all on function public.add_court_equipment_by_token(text, jsonb) from public;
revoke all on function public.cancel_court_by_token(text, text) from public;
revoke all on function public.move_court_booking(text, text, date, time, int) from public;
revoke all on function public.move_my_court_booking(uuid, date, time, int) from public, anon;
revoke all on function public.my_court_bookings() from public, anon;
revoke all on function public.staff_court_day(date) from public, anon;
revoke all on function public.staff_add_court_player(uuid, text, text, text, uuid) from public, anon;
revoke all on function public.staff_update_court_player(uuid, text, text, text) from public, anon;
revoke all on function public.staff_check_in_court_player(uuid, boolean) from public, anon;
revoke all on function public.staff_add_court_equipment(uuid, uuid, text, int) from public, anon;
revoke all on function public.staff_remove_court_equipment(uuid) from public, anon;
revoke all on function public.staff_take_court_payment(uuid, uuid, text, numeric, numeric, text) from public, anon;
revoke all on function public.staff_start_court_game(uuid, text) from public, anon;
revoke all on function public.staff_block_court(uuid, date, time, time, text) from public, anon;
revoke all on function public.staff_cancel_court(uuid) from public, anon;

grant execute on function public.court_free_starts(uuid, date, int, uuid) to anon, authenticated;
grant execute on function public.public_courts() to anon, authenticated;
grant execute on function public.public_court_prices() to anon, authenticated;
grant execute on function public.court_join_info(text) to anon, authenticated;
grant execute on function public.add_court_equipment_by_token(text, jsonb) to anon, authenticated;
grant execute on function public.cancel_court_by_token(text, text) to anon, authenticated;
grant execute on function public.move_court_booking(text, text, date, time, int) to anon, authenticated;
grant execute on function public.move_my_court_booking(uuid, date, time, int) to authenticated;
grant execute on function public.my_court_bookings() to authenticated;
grant execute on function public.staff_court_day(date) to authenticated;
grant execute on function public.staff_add_court_player(uuid, text, text, text, uuid) to authenticated;
grant execute on function public.staff_update_court_player(uuid, text, text, text) to authenticated;
grant execute on function public.staff_check_in_court_player(uuid, boolean) to authenticated;
grant execute on function public.staff_add_court_equipment(uuid, uuid, text, int) to authenticated;
grant execute on function public.staff_remove_court_equipment(uuid) to authenticated;
grant execute on function public.staff_take_court_payment(uuid, uuid, text, numeric, numeric, text) to authenticated;
grant execute on function public.staff_start_court_game(uuid, text) to authenticated;
grant execute on function public.staff_block_court(uuid, date, time, time, text) to authenticated;
grant execute on function public.staff_cancel_court(uuid) to authenticated;
