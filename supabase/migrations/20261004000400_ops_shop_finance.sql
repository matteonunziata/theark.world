-- Operations tasks, farm shop, and finance (admin-only).

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text,
  assignee_id uuid references public.team_members (id) on delete set null,
  division_id uuid references public.divisions (id) on delete set null,
  priority text not null default 'medium'
    check (priority in ('urgent', 'high', 'medium', 'low')),
  kind text not null default 'task'
    check (kind in ('task', 'maintenance', 'purchase', 'event')),
  due_date date,
  location text,
  status text not null default 'backlog'
    check (status in ('backlog', 'next', 'doing', 'review', 'done')),
  position double precision not null default 0,
  completed_at timestamptz,
  created_by uuid references public.team_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_assignee_idx on public.tasks (assignee_id);
create index tasks_division_idx on public.tasks (division_id);

create or replace function public.tasks_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  if new.status = 'done' and new.completed_at is null then
    new.completed_at = now();
  elsif new.status <> 'done' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;
create trigger tasks_before_write before insert or update on public.tasks
  for each row execute function public.tasks_before_write();

alter table public.tasks enable row level security;

create policy "Read tasks" on public.tasks
  for select to authenticated using (
    public.has_role('admin')
    or (public.has_role('lead') and division_id = public.staff_division())
    or assignee_id = public.current_staff_id()
    or created_by = public.current_staff_id()
  );
create policy "Staff add tasks" on public.tasks
  for insert to authenticated with check (
    public.is_staff() and created_by = public.current_staff_id()
  );
create policy "Update tasks" on public.tasks
  for update to authenticated
  using (
    public.has_role('admin')
    or (public.has_role('lead') and division_id = public.staff_division())
    or assignee_id = public.current_staff_id()
    or created_by = public.current_staff_id()
  )
  with check (public.is_staff());
create policy "Delete tasks" on public.tasks
  for delete to authenticated using (
    public.has_role('admin')
    or (public.has_role('lead') and division_id = public.staff_division())
    or created_by = public.current_staff_id()
  );

-- Farm shop ------------------------------------------------------------------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  category text not null default 'Other',
  unit text,
  price numeric(14, 2) not null check (price >= 0),
  member_price numeric(14, 2) check (member_price >= 0),
  stock numeric(12, 2) not null default 0 check (stock >= 0),
  low_at numeric(12, 2) not null default 0,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  type text not null check (type in ('sale', 'restock', 'adjusted')),
  delta numeric(12, 2) not null check (delta <> 0),
  by_id uuid references public.team_members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index stock_movements_product_idx
  on public.stock_movements (product_id, created_at desc);

-- Keep products.stock in step with the ledger (never below zero).
create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.products
  set stock = greatest(0, stock + new.delta)
  where id = new.product_id;
  return new;
end;
$$;
create trigger stock_movements_apply after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

alter table public.products enable row level security;
alter table public.stock_movements enable row level security;

create policy "Read products" on public.products
  for select to authenticated using (public.has_role('admin', 'lead', 'shop'));
create policy "Write products" on public.products
  for all to authenticated
  using (public.has_role('admin', 'shop'))
  with check (public.has_role('admin', 'shop'));

create policy "Read stock" on public.stock_movements
  for select to authenticated using (public.has_role('admin', 'lead', 'shop'));
create policy "Record stock" on public.stock_movements
  for insert to authenticated with check (
    public.has_role('admin', 'shop') and by_id = public.current_staff_id()
  );

-- Finance (admin only, enforced here, not just in the UI) --------------------

create table public.finance_months (
  month date primary key check (extract(day from month) = 1),
  membership numeric(14, 2),
  events numeric(14, 2),
  shop numeric(14, 2),
  fnb numeric(14, 2),
  land numeric(14, 2),
  other numeric(14, 2),
  expenses numeric(14, 2),
  cash numeric(14, 2),
  cash_date date,
  ar numeric(14, 2),
  ap numeric(14, 2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger finance_months_updated_at before update on public.finance_months
  for each row execute function public.set_updated_at();

alter table public.finance_months enable row level security;

create policy "Admins only" on public.finance_months
  for all to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- Paid ticket sales for a month, also admin only.
create or replace function public.ticket_sales_for_month(p_month date)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role('admin') then
    raise exception 'Finance is restricted.' using errcode = '42501';
  end if;
  return coalesce((
    select sum(t.price)
    from public.registrations r
    join public.ticket_types t on t.id = r.ticket_type_id
    where r.paid
      and date_trunc('month', r.session_date) = date_trunc('month', p_month)
  ), 0);
end;
$$;
revoke execute on function public.ticket_sales_for_month(date) from anon, public;
grant execute on function public.ticket_sales_for_month(date) to authenticated;

-- Dashboard counts any staff member may see.
create or replace function public.dashboard_counts()
returns table (
  active_members bigint,
  active_team bigint,
  divisions bigint,
  offerings bigint,
  open_tasks bigint,
  overdue_tasks bigint,
  tasks bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.contacts
      where tier is not null and membership_status = 'active'),
    (select count(*) from public.team_members where status = 'active'),
    (select count(*) from public.divisions),
    (select count(*) from public.offerings),
    (select count(*) from public.tasks where status <> 'done'),
    (select count(*) from public.tasks
      where status <> 'done' and due_date < public.org_today()),
    (select count(*) from public.tasks)
  where public.is_staff();
$$;
revoke execute on function public.dashboard_counts() from anon, public;
grant execute on function public.dashboard_counts() to authenticated;
