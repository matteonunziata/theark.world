-- Flexible "When": every N weeks, monthly, or a hand-picked list of dates ----------------------
-- repeat: none | weekly | monthly | dates
-- repeat_every: every N weeks (weekly) or N months (monthly)
-- month_mode: 'date' = same day number each month, 'weekday' = same weekday position (2nd Saturday)
-- custom_dates: the dates themselves when repeat = 'dates' (start_date/end_date hold the first/last)
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.offerings'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%repeat%' and pg_get_constraintdef(oid) ilike '%weekly%'
  loop
    execute format('alter table public.offerings drop constraint %I', c);
  end loop;
end $$;

alter table public.offerings
  add constraint offerings_repeat_check check (repeat in ('none', 'weekly', 'monthly', 'dates')),
  add column if not exists repeat_every smallint not null default 1 check (repeat_every between 1 and 12),
  add column if not exists month_mode text not null default 'date' check (month_mode in ('date', 'weekday')),
  add column if not exists custom_dates date[] not null default '{}';

create or replace function public.occurs_on(o public.offerings, d date)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case o.repeat
    when 'none' then d = o.start_date
    when 'dates' then d = any (o.custom_dates)
    when 'monthly' then
      d >= o.start_date
      and (o.end_date is null or d <= o.end_date)
      and (
        (extract(year from d)::int * 12 + extract(month from d)::int)
        - (extract(year from o.start_date)::int * 12 + extract(month from o.start_date)::int)
      ) % o.repeat_every = 0
      and case o.month_mode
        when 'weekday' then
          extract(dow from d) = extract(dow from o.start_date)
          and (extract(day from d)::int - 1) / 7 = (extract(day from o.start_date)::int - 1) / 7
        else extract(day from d) = extract(day from o.start_date)
      end
    else
      d >= o.start_date
      and (o.end_date is null or d <= o.end_date)
      and extract(dow from d)::smallint = any (o.days)
      and (
        (d - (extract(isodow from d)::int - 1))
        - (o.start_date - (extract(isodow from o.start_date)::int - 1))
      ) / 7 % o.repeat_every = 0
  end;
$$;
