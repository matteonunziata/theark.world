-- Every player in a booking can share the join link, not just the person who booked.
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
      'share_token', b.share_token,
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
