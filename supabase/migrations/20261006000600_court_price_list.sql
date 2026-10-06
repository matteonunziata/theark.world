-- Court prices by length (rate card, 2026-10-06): 1 hour 15,000, 1½ hours
-- 23,000, 2 hours 30,000 colones, padel and pickleball alike. `price` stays the
-- price of one slot; the longer lengths get their own price, and fall back to
-- slot price × length when left empty.

alter table public.courts
  add column price_90 numeric(14, 2) check (price_90 >= 0),
  add column price_120 numeric(14, 2) check (price_120 >= 0);

update public.courts set price = 15000, price_90 = 23000, price_120 = 30000, currency = 'CRC';

-- What a court costs for this many minutes, less the person's court discount.
create or replace function public.court_price(p_court uuid, p_minutes int, p_contact uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select round(
    coalesce(
      case p_minutes when 90 then c.price_90 when 120 then c.price_120 end,
      coalesce(c.price, 0) * (p_minutes::numeric / c.slot_minutes)
    ) * (1 - coalesce(public.court_discount_for(p_contact), 0) / 100),
    case when c.currency = 'USD' then 2 else 0 end)
  from public.courts c
  where c.id = p_court;
$$;

drop function public.public_courts();
create function public.public_courts()
returns table (
  id uuid, name text, sport text, open_time time, close_time time, slot_minutes smallint,
  price numeric, price_90 numeric, price_120 numeric, currency text, description text, max_players smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  select id, name, sport, open_time, close_time, slot_minutes, price, price_90, price_120,
    currency, description, max_players
  from public.courts
  where active
  order by position, name;
$$;

revoke all on function public.public_courts() from public;
grant execute on function public.public_courts() to anon, authenticated;

-- Lengths run in half-hour steps from one slot up to two hours (1, 1½, 2 hours
-- on an hourly court). Start times still follow the slot grid.
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
  step int := case when c.slot_minutes % 30 = 0 then 30 else c.slot_minutes end;
  e time;
begin
  if p_minutes is null or p_minutes < c.slot_minutes or p_minutes > 120
    or p_minutes % step <> 0 then
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
