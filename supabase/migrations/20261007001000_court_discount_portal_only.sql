-- The member discount on courts applies only when a signed-in member books in
-- the members portal (user decision, 2026-10-07). The public page, signed in or
-- not, charges the full price. The portal sends portal: true.

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
  -- The member discount is for booking in the members portal, nowhere else.
  v_portal boolean := me is not null and coalesce((p ->> 'portal')::boolean, false);
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

  v_amount := public.court_price(c.id, v_minutes, case when v_portal then v_contact end);
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
      case when v_portal then 'portal' else 'web' end, v_status, v_until, v_amount, c.currency,
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
