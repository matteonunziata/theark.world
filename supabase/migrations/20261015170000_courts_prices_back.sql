-- Court prices back to the earlier rate card: 1 hour 15,000, 1½ hours 23,000, 2 hours 30,000.
-- 3 hours stays on file but is switched off (turn it back on in Courts & prices).
alter table public.court_prices drop constraint court_prices_minutes_check;
alter table public.court_prices add constraint court_prices_minutes_check
  check (minutes is null or minutes in (60, 90, 120, 180));
update public.court_prices set price = 15000 where key = 'court_60';
update public.court_prices set price = 23000 where key = 'court_90';
insert into public.court_prices (key, kind, label, minutes, price, position)
values ('court_120', 'court', '2 hours', 120, 30000, 2)
on conflict (key) do update set price = 30000, active = true;
update public.court_prices set active = false, position = 3 where key = 'court_180';
