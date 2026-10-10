-- The maintenance log on a property is a query over Operations tasks, not a
-- separate record. Tasks gain a property link, a type, a cost and who did it.

alter table public.tasks
  add column lot_id uuid references public.lots (id) on delete set null,
  add column maint_category text
    check (maint_category in ('repair', 'garden', 'pool', 'cleaning', 'inspection', 'build', 'other')),
  add column cost numeric(14, 2) check (cost >= 0),
  add column currency text not null default 'CRC' check (currency in ('CRC', 'USD')),
  add column done_by text,                       -- a contractor or company, when not on the team
  add column owner_visible boolean not null default true;
create index tasks_lot_idx on public.tasks (lot_id) where lot_id is not null;

-- Entries from the old log become tasks.
insert into public.tasks (
  title, description, kind, maint_category, status, due_date, completed_at,
  cost, currency, done_by, lot_id, created_by, created_at
)
select m.title, m.details, 'maintenance', m.category,
  case m.status when 'open' then 'backlog' when 'scheduled' then 'next' else 'done' end,
  m.performed_on,
  case when m.status = 'done' then m.performed_on::timestamptz end,
  m.cost, m.currency, m.done_by, m.lot_id, m.created_by, m.created_at
from public.lot_maintenance m;

alter table public.lot_maintenance rename to lot_maintenance_archive;

-- Estate staff read and update the tasks linked to a property (the normal task
-- rules only let admins, division leads, assignees and creators in).
create policy "Estate staff read property tasks" on public.tasks
  for select to authenticated
  using (lot_id is not null and public.is_estate_staff());
create policy "Estate staff update property tasks" on public.tasks
  for update to authenticated
  using (lot_id is not null and public.is_estate_staff())
  with check (public.is_staff());

-- What an owner sees of the work on their property.
create or replace function public.my_property_work(p_lot uuid)
returns table (
  id uuid, title text, category text, status text, on_date date,
  done_by text, cost numeric, currency text, details text
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.title, coalesce(t.maint_category, 'other'),
    case t.status when 'done' then 'done' when 'doing' then 'in_progress'
      when 'review' then 'in_progress' else 'open' end,
    coalesce((t.completed_at at time zone (select timezone from public.org_settings))::date,
      t.due_date, t.created_at::date),
    coalesce(t.done_by, tm.name), t.cost, t.currency, t.description
  from public.tasks t
  left join public.team_members tm on tm.id = t.assignee_id
  where t.lot_id = p_lot and t.owner_visible and public.owns_lot(p_lot)
  order by (t.status = 'done'), coalesce(t.completed_at::date, t.due_date, t.created_at::date) desc;
$$;
revoke execute on function public.my_property_work(uuid) from anon, public;
grant execute on function public.my_property_work(uuid) to authenticated;

-- Asking the team for work creates a task on the Operations board.
create or replace function public.owner_request_work(
  p_lot uuid, p_title text, p_category text, p_details text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare lot public.lots;
begin
  if not public.owns_lot(p_lot) then raise exception 'Not your property.'; end if;
  if length(trim(coalesce(p_title, ''))) = 0 then raise exception 'Say what you need.'; end if;
  select * into lot from public.lots where id = p_lot;
  insert into public.tasks (title, description, kind, maint_category, status, lot_id, location)
  values (
    trim(p_title),
    trim('Requested by the owner in the portal. ' || coalesce(p_details, '')),
    'maintenance',
    case when p_category in ('repair', 'garden', 'pool', 'cleaning', 'inspection', 'other')
         then p_category else 'repair' end,
    'backlog', p_lot, coalesce(lot.name, 'Lot ' || lot.code)
  );
end $$;
