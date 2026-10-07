-- Hospitality: the cleaning schedule and the kitchen inventory.
-- Same gate as the rest of Hospitality (admin, division lead, sales).

create table public.cleaning_tasks (
  id uuid primary key default gen_random_uuid(),
  area text not null check (length(trim(area)) > 0),   -- "Kitchen", "Bathrooms"
  task text not null check (length(trim(task)) > 0),   -- "Mop floors"
  days smallint[] not null default '{}'
    check (days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]), -- 0 = Monday … 6 = Sunday
  time_slot text,                                      -- "Morning", "After checkout"
  assignee text,
  notes text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger cleaning_tasks_updated_at before update on public.cleaning_tasks
  for each row execute function public.set_updated_at();

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  category text not null default 'Other',
  unit text not null default 'units',                  -- "kg", "bottles"
  on_hand numeric(12, 2) not null default 0 check (on_hand >= 0),
  reorder_at numeric(12, 2) not null default 0 check (reorder_at >= 0), -- "low" at or below this
  target numeric(12, 2) not null default 0 check (target >= 0),         -- stock up to this
  supplier text,
  notes text,
  counted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger inventory_items_updated_at before update on public.inventory_items
  for each row execute function public.set_updated_at();

alter table public.cleaning_tasks enable row level security;
alter table public.inventory_items enable row level security;

create policy "Estate staff" on public.cleaning_tasks
  for all to authenticated
  using (public.is_estate_staff()) with check (public.is_estate_staff());
create policy "Estate staff" on public.inventory_items
  for all to authenticated
  using (public.is_estate_staff()) with check (public.is_estate_staff());
