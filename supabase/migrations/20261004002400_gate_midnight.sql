-- The one-hour rule compared times of day, so a session starting before 1am
-- looked "too early" all day. Compare full local timestamps instead.

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
        and public.org_now() < r.session_date + o.start_time - interval '1 hour' then 'early'
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
    and public.org_now() < r.session_date + o.start_time - interval '1 hour' then
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
