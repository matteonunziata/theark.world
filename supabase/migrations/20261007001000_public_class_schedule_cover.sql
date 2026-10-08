-- The public class timetable also returns each class's cover photo (the same
-- offerings.cover_path the members portal shows), so the join page can show it.
drop function if exists public.public_class_schedule();
create function public.public_class_schedule()
returns table (
  id uuid,
  title text,
  days integer[],
  start_time time,
  end_time time,
  location text,
  facilitator text,
  cover_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.title, o.days::integer[], o.start_time, o.end_time, o.location, t.name::text, o.cover_path
  from public.offerings o
  left join public.team_members t on t.id = o.facilitator_id
  where o.kind = 'class'
    and o.status = 'published'
    and o.repeat = 'weekly'
    and o.start_date <= current_date + 30
    and (o.end_date is null or o.end_date >= current_date)
  order by o.start_time nulls last, o.title;
$$;

revoke all on function public.public_class_schedule() from public;
grant execute on function public.public_class_schedule() to anon, authenticated;
