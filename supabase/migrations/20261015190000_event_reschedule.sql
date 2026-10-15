-- Reschedule one booking to another date of the same event ------------------------------------
-- Used from Event analytics. The booking keeps its tickets, price and payment; only the date
-- moves. Capacity and ticket stock for the new date still hold unless p_override is set
-- (the team sometimes has to squeeze someone in after an event is cancelled or moved).
create or replace function public.staff_reschedule_registration(
  p_registration_id uuid,
  p_session_date date,
  p_override boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.registrations;
  o public.offerings;
  it record;
  taken int;
begin
  select * into r from public.registrations where id = p_registration_id for update;
  if not found then
    raise exception 'That booking no longer exists.' using errcode = 'P0001';
  end if;
  if not public.can_manage_offering(r.offering_id) then
    raise exception 'You can''t change bookings for this.' using errcode = '42501';
  end if;
  if p_session_date is null then
    raise exception 'Pick a date.' using errcode = 'P0001';
  end if;
  if r.status = 'cancelled' then
    raise exception 'Restore this booking before moving it.' using errcode = 'P0001';
  end if;
  if r.checked_in_at is not null then
    raise exception 'This guest is already checked in.' using errcode = 'P0001';
  end if;
  if r.session_date = p_session_date then
    return;
  end if;
  if exists (
    select 1 from public.session_cancellations
    where offering_id = r.offering_id and session_date = p_session_date
  ) then
    raise exception 'That date was cancelled.' using errcode = 'P0001';
  end if;

  select * into o from public.offerings where id = r.offering_id for update;
  if not p_override then
    if o.capacity is not null then
      select coalesce(sum(x.seats), 0) into taken from public.registrations x
      where x.offering_id = r.offering_id and x.session_date = p_session_date
        and public.registration_live(x) and x.id <> r.id;
      if taken + r.seats > o.capacity then
        raise exception 'Only % spots left on that date.', greatest(0, o.capacity - taken)
          using errcode = 'P0001';
      end if;
    end if;
    for it in
      select t.id, t.name, t.qty as stock, i.qty
      from public.registration_items i
      join public.ticket_types t on t.id = i.ticket_type_id
      where i.registration_id = r.id and t.qty is not null
    loop
      if public.ticket_taken(it.id, p_session_date) + it.qty > it.stock then
        raise exception 'Only % left of % on that date.',
          greatest(0, it.stock - public.ticket_taken(it.id, p_session_date)), it.name
          using errcode = 'P0001';
      end if;
    end loop;
  end if;

  update public.registrations set session_date = p_session_date where id = r.id;
exception when unique_violation then
  raise exception 'That person is already booked for that date.' using errcode = 'P0001';
end;
$$;
revoke execute on function public.staff_reschedule_registration(uuid, date, boolean) from public, anon;
grant execute on function public.staff_reschedule_registration(uuid, date, boolean) to authenticated;
