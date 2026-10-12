-- Guesty both ways, always. Stays booked here are sent to the Guesty calendar
-- as blocked nights. To free the right nights again when a stay moves to other
-- dates or is deleted, remember the range that was sent (last night included)
-- and queue it for release.
alter table public.stays
  add column guesty_pushed_from date,
  add column guesty_pushed_to date;

update public.stays
set guesty_pushed_from = check_in, guesty_pushed_to = check_out - 1
where guesty_pushed_at is not null;

create table public.guesty_frees (
  id uuid primary key default gen_random_uuid(),
  listing_id text not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now()
);
alter table public.guesty_frees enable row level security;
create policy guesty_frees_admin on public.guesty_frees
  using (public.has_role('admin')) with check (public.has_role('admin'));

create or replace function public.stays_guesty_release() returns trigger
language plpgsql security definer set search_path = public as $$
declare listing text;
begin
  if old.guesty_pushed_at is null or old.guesty_pushed_from is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'UPDATE'
     and new.lot_id = old.lot_id and new.check_in = old.check_in and new.check_out = old.check_out then
    return new;
  end if;
  select guesty_listing_id into listing from public.lots where id = old.lot_id;
  if listing is not null then
    insert into public.guesty_frees (listing_id, start_date, end_date)
    values (listing, old.guesty_pushed_from, old.guesty_pushed_to);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  -- Moved: the new dates still need sending.
  new.guesty_pushed_at := null;
  new.guesty_pushed_from := null;
  new.guesty_pushed_to := null;
  return new;
end $$;

create trigger stays_guesty_release_upd before update on public.stays
  for each row execute function public.stays_guesty_release();
create trigger stays_guesty_release_del before delete on public.stays
  for each row execute function public.stays_guesty_release();

-- Both ways is the default for a Guesty connection that hasn't been made yet.
update public.integrations set direction = 'both' where key = 'guesty' and connected_at is null;
