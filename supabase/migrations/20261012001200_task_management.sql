-- Operations task management: planned hours and start time, amenity or
-- lot/house location, subtasks, comments, the on-site flow (clock in, before
-- photos, after photos, materials, clock out), and money kept away from
-- employees (rates, labour cost, material prices, budget requests).

alter table public.tasks
  add column planned_hours numeric(6, 2) check (planned_hours is null or planned_hours > 0),
  add column start_time time,
  add column amenity_id uuid references public.amenities (id) on delete set null,
  add constraint tasks_one_place check (amenity_id is null or lot_id is null);

-- Who can see a task, and who leads it ---------------------------------------

create or replace function public.can_see_task(t uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tasks k
    where k.id = t
      and (
        public.has_role('admin')
        or (public.has_role('lead') and k.division_id = public.staff_division())
        or k.assignee_id = public.current_staff_id()
        or k.created_by = public.current_staff_id()
        or (k.lot_id is not null and public.is_estate_staff())
      )
  );
$$;

-- Admins, and the lead of the task's division.
create or replace function public.can_manage_task(t uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tasks k
    where k.id = t
      and (
        public.has_role('admin')
        or (public.has_role('lead') and k.division_id = public.staff_division())
      )
  );
$$;
revoke execute on function public.can_see_task(uuid), public.can_manage_task(uuid) from anon, public;
grant execute on function public.can_see_task(uuid), public.can_manage_task(uuid) to authenticated;

-- Subtasks and comments -------------------------------------------------------

create table public.task_subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  done boolean not null default false,
  position int not null default 0,
  created_by uuid references public.team_members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index task_subtasks_task_idx on public.task_subtasks (task_id);
alter table public.task_subtasks enable row level security;
create policy "See subtasks" on public.task_subtasks
  for select to authenticated using (public.can_see_task(task_id));
create policy "Add subtasks" on public.task_subtasks
  for insert to authenticated with check (public.can_see_task(task_id));
create policy "Change subtasks" on public.task_subtasks
  for update to authenticated using (public.can_see_task(task_id)) with check (public.can_see_task(task_id));
create policy "Remove subtasks" on public.task_subtasks
  for delete to authenticated using (public.can_see_task(task_id));

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid references public.team_members (id) on delete set null,
  kind text not null default 'comment' check (kind in ('comment', 'lead_ping')),
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create index task_comments_task_idx on public.task_comments (task_id, created_at);
alter table public.task_comments enable row level security;
create policy "See comments" on public.task_comments
  for select to authenticated using (public.can_see_task(task_id));
create policy "Write comments" on public.task_comments
  for insert to authenticated
  with check (public.can_see_task(task_id) and author_id = public.current_staff_id());
create policy "Remove comments" on public.task_comments
  for delete to authenticated
  using (author_id = public.current_staff_id() or public.can_manage_task(task_id));

-- On-site flow ----------------------------------------------------------------

create table public.task_time (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  staff_id uuid not null references public.team_members (id) on delete cascade,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  minutes int check (minutes is null or minutes >= 0),
  manual boolean not null default false,   -- time typed in by hand
  note text,
  created_at timestamptz not null default now()
);
create index task_time_task_idx on public.task_time (task_id);
-- One person can be clocked in on one task at a time.
create unique index task_time_one_open_idx on public.task_time (staff_id) where clock_out is null;
alter table public.task_time enable row level security;
create policy "See time" on public.task_time
  for select to authenticated using (public.can_see_task(task_id));

create or replace function public.task_time_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.clock_out is not null then
    new.minutes := greatest(0, round(extract(epoch from (new.clock_out - new.clock_in)) / 60))::int;
  end if;
  return new;
end;
$$;
create trigger task_time_before_write before insert or update on public.task_time
  for each row execute function public.task_time_before_write();

create table public.task_photos (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  kind text not null check (kind in ('before', 'after')),
  path text not null check (length(trim(path)) > 0),
  uploaded_by uuid references public.team_members (id) on delete set null,
  manual boolean not null default false,   -- added by hand after the fact
  created_at timestamptz not null default now()
);
create index task_photos_task_idx on public.task_photos (task_id, created_at);
alter table public.task_photos enable row level security;
create policy "See photos" on public.task_photos
  for select to authenticated using (public.can_see_task(task_id));
create policy "Managers remove photos" on public.task_photos
  for delete to authenticated using (public.can_manage_task(task_id));

create table public.task_materials (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  unit text,
  source text not null check (source in ('used', 'bought')),
  created_by uuid references public.team_members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index task_materials_task_idx on public.task_materials (task_id);
alter table public.task_materials enable row level security;
create policy "See materials" on public.task_materials
  for select to authenticated using (public.can_see_task(task_id));
create policy "Remove materials" on public.task_materials
  for delete to authenticated
  using (created_by = public.current_staff_id() or public.can_manage_task(task_id));

-- What a material cost: leads and admins only.
create table public.task_material_costs (
  material_id uuid primary key references public.task_materials (id) on delete cascade,
  amount numeric(14, 2) not null check (amount >= 0)   -- colones
);
alter table public.task_material_costs enable row level security;
create policy "Managers see material costs" on public.task_material_costs
  for select to authenticated
  using (exists (select 1 from public.task_materials m
                 where m.id = material_id and public.can_manage_task(m.task_id)));

-- Pay and bill rate per person (colones an hour): admins, and leads for their division.
create table public.staff_rates (
  staff_id uuid primary key references public.team_members (id) on delete cascade,
  pay_rate numeric(12, 2) check (pay_rate >= 0),
  bill_rate numeric(12, 2) check (bill_rate >= 0),
  updated_at timestamptz not null default now()
);
alter table public.staff_rates enable row level security;
create policy "See rates" on public.staff_rates
  for select to authenticated
  using (
    public.has_role('admin')
    or (public.has_role('lead') and exists (
      select 1 from public.team_members t
      where t.id = staff_id and t.division_id = public.staff_division()))
  );
create policy "Admins set rates" on public.staff_rates
  for all to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- Budget requests from a task: a lead asks, an admin decides.
create table public.task_budget_requests (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),      -- colones
  reason text not null check (length(trim(reason)) > 0),
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected')),
  requested_by uuid references public.team_members (id) on delete set null,
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.team_members (id) on delete set null,
  reviewed_at timestamptz,
  review_comment text
);
create index task_budget_requests_task_idx on public.task_budget_requests (task_id);
alter table public.task_budget_requests enable row level security;
create policy "See budget requests" on public.task_budget_requests
  for select to authenticated using (public.can_manage_task(task_id));
create policy "Leads request budget" on public.task_budget_requests
  for insert to authenticated
  with check (public.can_manage_task(task_id) and requested_by = public.current_staff_id()
              and status = 'requested');
create policy "Admins decide budget requests" on public.task_budget_requests
  for update to authenticated
  using (public.has_role('admin') or public.is_budget_admin())
  with check (public.has_role('admin') or public.is_budget_admin());

-- The flow, as functions so the order can't be skipped -------------------------

create or replace function public.task_path_ok(p_task uuid, p_paths text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_paths is not null and cardinality(p_paths) > 0
    and not exists (select 1 from unnest(p_paths) p where split_part(p, '/', 1) <> p_task::text);
$$;

create or replace function public.task_clock_in(p_task uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.current_staff_id();
  v_id uuid;
begin
  if me is null or not public.can_see_task(p_task) then
    raise exception 'You can''t work on this task.' using errcode = '42501';
  end if;
  if exists (select 1 from public.tasks where id = p_task and status = 'done') then
    raise exception 'This task is already done.';
  end if;
  begin
    insert into public.task_time (task_id, staff_id) values (p_task, me) returning id into v_id;
  exception when unique_violation then
    raise exception 'You''re already clocked in. Clock out of that task first.';
  end;
  update public.tasks set status = 'doing' where id = p_task and status in ('backlog', 'next');
  return v_id;
end;
$$;

create or replace function public.task_add_photos(p_task uuid, p_kind text, p_paths text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare me uuid := public.current_staff_id();
begin
  if me is null or not public.can_see_task(p_task) then
    raise exception 'You can''t work on this task.' using errcode = '42501';
  end if;
  if p_kind not in ('before', 'after') then raise exception 'Unknown photo type.'; end if;
  if not public.task_path_ok(p_task, p_paths) then raise exception 'Those photos don''t belong to this task.'; end if;
  if not exists (select 1 from public.task_time where task_id = p_task and staff_id = me and clock_out is null) then
    raise exception 'Clock in first.';
  end if;
  insert into public.task_photos (task_id, kind, path, uploaded_by)
  select p_task, p_kind, p, me from unnest(p_paths) p;
end;
$$;

create or replace function public.task_clock_out(p_task uuid, p_finish boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.current_staff_id();
  e public.task_time;
begin
  select * into e from public.task_time
  where task_id = p_task and staff_id = me and clock_out is null;
  if not found then raise exception 'You''re not clocked in on this task.'; end if;
  if not exists (select 1 from public.task_photos where task_id = p_task and kind = 'before' and created_at >= e.clock_in)
     or not exists (select 1 from public.task_photos where task_id = p_task and kind = 'after' and created_at >= e.clock_in) then
    raise exception 'Add before and after photos first.';
  end if;
  update public.task_time set clock_out = now() where id = e.id;
  if p_finish then update public.tasks set status = 'done' where id = p_task; end if;
end;
$$;

-- Forgot to clock out (or never clocked in): the actual time and the photos by hand.
create or replace function public.task_log_time(
  p_task uuid, p_minutes int, p_note text, p_before text[], p_after text[], p_finish boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.current_staff_id();
  e public.task_time;
  has_before boolean;
  has_after boolean;
begin
  if me is null or not public.can_see_task(p_task) then
    raise exception 'You can''t work on this task.' using errcode = '42501';
  end if;
  if p_minutes is null or p_minutes < 1 or p_minutes > 1440 then
    raise exception 'Enter the time you worked, up to 24 hours.';
  end if;
  select * into e from public.task_time
  where task_id = p_task and staff_id = me and clock_out is null;

  has_before := coalesce(cardinality(p_before), 0) > 0
    or (e.id is not null and exists (select 1 from public.task_photos where task_id = p_task and kind = 'before' and created_at >= e.clock_in));
  has_after := coalesce(cardinality(p_after), 0) > 0
    or (e.id is not null and exists (select 1 from public.task_photos where task_id = p_task and kind = 'after' and created_at >= e.clock_in));
  if not has_before or not has_after then
    raise exception 'Add at least one before photo and one after photo.';
  end if;
  if coalesce(cardinality(p_before), 0) > 0 and not public.task_path_ok(p_task, p_before) then
    raise exception 'Those photos don''t belong to this task.';
  end if;
  if coalesce(cardinality(p_after), 0) > 0 and not public.task_path_ok(p_task, p_after) then
    raise exception 'Those photos don''t belong to this task.';
  end if;

  if e.id is not null then
    update public.task_time
      set clock_out = clock_in + make_interval(mins => p_minutes), manual = true, note = nullif(trim(p_note), '')
      where id = e.id;
  else
    insert into public.task_time (task_id, staff_id, clock_in, clock_out, manual, note)
    values (p_task, me, now() - make_interval(mins => p_minutes), now(), true, nullif(trim(p_note), ''));
  end if;
  insert into public.task_photos (task_id, kind, path, uploaded_by, manual)
  select p_task, 'before', p, me, true from unnest(coalesce(p_before, '{}')) p
  union all
  select p_task, 'after', p, me, true from unnest(coalesce(p_after, '{}')) p;
  if p_finish then update public.tasks set status = 'done' where id = p_task; end if;
end;
$$;

create or replace function public.add_task_material(
  p_task uuid, p_name text, p_quantity numeric, p_unit text, p_source text, p_amount numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.current_staff_id();
  v_id uuid;
begin
  if me is null or not public.can_see_task(p_task) then
    raise exception 'You can''t work on this task.' using errcode = '42501';
  end if;
  insert into public.task_materials (task_id, name, quantity, unit, source, created_by)
  values (p_task, trim(p_name), coalesce(p_quantity, 1), nullif(trim(p_unit), ''), p_source, me)
  returning id into v_id;
  if p_amount is not null and p_amount > 0 then
    insert into public.task_material_costs (material_id, amount) values (v_id, p_amount);
  end if;
  return v_id;
end;
$$;

-- Hours, labour cost, materials and what to bill: leads and admins only.
create or replace function public.task_cost_summary(p_task uuid)
returns table (hours numeric, labour_cost numeric, materials_cost numeric, bill_amount numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select x.* from (
    select
      coalesce(sum(e.minutes), 0) / 60.0 as hours,
      coalesce(sum(e.minutes / 60.0 * coalesce(r.pay_rate, 0)), 0) as labour_cost,
      (select coalesce(sum(c.amount), 0) from public.task_materials m
         join public.task_material_costs c on c.material_id = m.id where m.task_id = p_task) as materials_cost,
      coalesce(sum(e.minutes / 60.0 * coalesce(r.bill_rate, 0)), 0) as bill_amount
    from public.task_time e
    left join public.staff_rates r on r.staff_id = e.staff_id
    where e.task_id = p_task and e.clock_out is not null
  ) x
  where public.can_manage_task(p_task);
$$;

revoke execute on function
  public.task_clock_in(uuid), public.task_add_photos(uuid, text, text[]),
  public.task_clock_out(uuid, boolean), public.task_log_time(uuid, int, text, text[], text[], boolean),
  public.add_task_material(uuid, text, numeric, text, text, numeric), public.task_cost_summary(uuid)
  from anon, public;
grant execute on function
  public.task_clock_in(uuid), public.task_add_photos(uuid, text, text[]),
  public.task_clock_out(uuid, boolean), public.task_log_time(uuid, int, text, text[], text[], boolean),
  public.add_task_material(uuid, text, numeric, text, text, numeric), public.task_cost_summary(uuid)
  to authenticated;

revoke all on public.task_subtasks, public.task_comments, public.task_time, public.task_photos,
  public.task_materials, public.task_material_costs, public.staff_rates, public.task_budget_requests
  from anon, public;
grant select, insert, update, delete on public.task_subtasks, public.task_comments, public.task_photos,
  public.task_materials, public.task_material_costs, public.staff_rates, public.task_budget_requests,
  public.task_time to authenticated;

-- Photos: private bucket, folder = task id -------------------------------------

create or replace function public.task_path_id(p text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return split_part(p, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-photos', 'task-photos', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "See task photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'task-photos' and public.can_see_task(public.task_path_id(name)));
create policy "Upload task photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'task-photos' and public.can_see_task(public.task_path_id(name)));
