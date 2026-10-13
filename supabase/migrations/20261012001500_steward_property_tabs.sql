-- Steward property page tabs: Maintenance detail, Budgets, Hospitality, Billing, Notes.
-- Everything a steward reads goes through functions that check owns_lot(), which
-- already requires an ACTIVE stewardship. Money is in colones.

-- Shared notes between the steward and the team ---------------------------------

create table public.property_notes (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.lots (id) on delete cascade,
  author_kind text not null check (author_kind in ('steward', 'team')),
  author_name text not null,
  author_staff_id uuid references public.team_members (id) on delete set null,
  author_contact_id uuid references public.contacts (id) on delete set null,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create index property_notes_lot_idx on public.property_notes (lot_id, created_at desc);
alter table public.property_notes enable row level security;
create policy "Estate staff read property notes" on public.property_notes
  for select to authenticated using (public.is_estate_staff());
create policy "Estate staff write property notes" on public.property_notes
  for insert to authenticated
  with check (public.is_estate_staff() and author_kind = 'team' and author_staff_id = public.current_staff_id());
create policy "Estate staff delete own property notes" on public.property_notes
  for delete to authenticated
  using (public.is_estate_staff() and (author_staff_id = public.current_staff_id() or public.has_role('admin')));
revoke all on public.property_notes from anon, public;
grant select, insert, delete on public.property_notes to authenticated;

create or replace function public.my_property_notes(p_lot uuid)
returns table (id uuid, author_kind text, author_name text, body text, created_at timestamptz, mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select n.id, n.author_kind, n.author_name, n.body, n.created_at,
    n.author_contact_id = public.current_active_steward_id()
  from public.property_notes n
  where n.lot_id = p_lot and public.owns_lot(p_lot)
  order by n.created_at desc;
$$;

create or replace function public.owner_add_note(p_lot uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare me uuid := public.current_active_steward_id(); v_name text;
begin
  if not public.owns_lot(p_lot) then raise exception 'Not your property.' using errcode = 'P0001'; end if;
  if length(trim(coalesce(p_body, ''))) = 0 then raise exception 'Write a note first.' using errcode = 'P0001'; end if;
  select name into v_name from public.contacts where id = me;
  insert into public.property_notes (lot_id, author_kind, author_name, author_contact_id, body)
  values (p_lot, 'steward', coalesce(v_name, 'Steward'), me, trim(p_body));
end $$;

create or replace function public.owner_delete_note(p_note uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.property_notes n
  where n.id = p_note and n.author_kind = 'steward'
    and n.author_contact_id = public.current_active_steward_id() and public.owns_lot(n.lot_id);
$$;

-- Budgets the steward approves ----------------------------------------------------

create table public.property_budgets (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.lots (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  details text,
  amount numeric(14, 2) not null check (amount > 0),      -- colones
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  requested_by uuid references public.team_members (id) on delete set null,
  requested_at timestamptz not null default now(),
  decided_by uuid references public.contacts (id) on delete set null,
  decided_at timestamptz,
  decision_comment text
);
create index property_budgets_lot_idx on public.property_budgets (lot_id, requested_at desc);
alter table public.property_budgets enable row level security;
create policy "Estate staff read property budgets" on public.property_budgets
  for select to authenticated using (public.is_estate_staff());
create policy "Estate staff ask for property budgets" on public.property_budgets
  for insert to authenticated
  with check (public.is_estate_staff() and status = 'pending' and requested_by = public.current_staff_id());
-- A request can be withdrawn while nobody has answered it.
create policy "Estate staff withdraw pending property budgets" on public.property_budgets
  for delete to authenticated using (public.is_estate_staff() and status = 'pending');
revoke all on public.property_budgets from anon, public;
grant select, insert, delete on public.property_budgets to authenticated;

create or replace function public.my_property_budgets(p_lot uuid)
returns table (
  id uuid, title text, details text, amount numeric, status text, task_title text,
  requested_at timestamptz, requested_by_name text, decided_at timestamptz, decision_comment text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.title, b.details, b.amount, b.status, t.title,
    b.requested_at, tm.name, b.decided_at, b.decision_comment
  from public.property_budgets b
  left join public.tasks t on t.id = b.task_id
  left join public.team_members tm on tm.id = b.requested_by
  where b.lot_id = p_lot and public.owns_lot(p_lot)
  order by (b.status = 'pending') desc, coalesce(b.decided_at, b.requested_at) desc;
$$;

create or replace function public.owner_decide_budget(p_budget uuid, p_approve boolean, p_comment text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare b public.property_budgets;
begin
  select * into b from public.property_budgets where id = p_budget for update;
  if not found or not public.owns_lot(b.lot_id) then
    raise exception 'Not your property.' using errcode = 'P0001';
  end if;
  if b.status <> 'pending' then
    raise exception 'This budget has already been answered.' using errcode = 'P0001';
  end if;
  update public.property_budgets set
    status = case when p_approve then 'approved' else 'declined' end,
    decided_by = public.current_active_steward_id(),
    decided_at = now(),
    decision_comment = nullif(trim(coalesce(p_comment, '')), '')
  where id = p_budget;
end $$;

-- Maintenance detail: hours, materials, photos, and the charge at bill rate -------

create or replace function public.my_property_work_detail(p_lot uuid)
returns table (
  task_id uuid, hours numeric, labour numeric, materials_cost numeric, charge numeric,
  materials jsonb, photos jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id,
    round(coalesce(tt.minutes, 0) / 60.0, 2),
    round(coalesce(tt.labour, 0), 2),
    round(coalesce(mc.cost, 0), 2),
    -- Time and materials when the crew logged them; the older flat cost otherwise.
    round(case when coalesce(tt.minutes, 0) > 0 or coalesce(mc.cost, 0) > 0
               then coalesce(tt.labour, 0) + coalesce(mc.cost, 0)
               else coalesce(case when t.currency = 'CRC' then t.cost end, 0) end, 2),
    coalesce(mt.items, '[]'::jsonb),
    coalesce(ph.items, '[]'::jsonb)
  from public.tasks t
  left join lateral (
    select sum(e.minutes) as minutes, sum(e.minutes / 60.0 * coalesce(r.bill_rate, 0)) as labour
    from public.task_time e left join public.staff_rates r on r.staff_id = e.staff_id
    where e.task_id = t.id and e.clock_out is not null
  ) tt on true
  left join lateral (
    select sum(c.amount) as cost
    from public.task_materials m join public.task_material_costs c on c.material_id = m.id
    where m.task_id = t.id
  ) mc on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('name', m.name, 'quantity', m.quantity, 'unit', m.unit,
      'source', m.source) order by m.created_at) as items
    from public.task_materials m where m.task_id = t.id
  ) mt on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('kind', p.kind, 'path', p.path) order by p.created_at) as items
    from public.task_photos p where p.task_id = t.id
  ) ph on true
  where t.lot_id = p_lot and t.owner_visible and public.owns_lot(p_lot);
$$;

-- Stewards see the photos on their own property's tasks.
create policy "Stewards see their property task photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'task-photos'
    and exists (
      select 1 from public.tasks t
      where t.id = public.task_path_id(name) and t.lot_id is not null and t.owner_visible
        and public.owns_lot(t.lot_id)
    )
  );

-- Hospitality: stays with who is in the house and the passes their guests hold ----

create or replace function public.my_property_hospitality(p_lot uuid)
returns table (
  id uuid, guest_name text, guests smallint, check_in date, check_out date, status text,
  source text, phase text, passes jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, split_part(s.guest_name, ' ', 1), s.guests, s.check_in, s.check_out, s.status, s.source,
    case when s.status = 'cancelled' then 'cancelled'
         when s.check_out <= public.org_today() then 'checked_out'
         when s.check_in <= public.org_today() then 'in_house'
         else 'upcoming' end,
    coalesce((
      select jsonb_agg(jsonb_build_object('tier', ti.name, 'from', m.starts_on, 'until', m.ends_on,
        'status', m.status) order by m.starts_on)
      from public.memberships m join public.membership_tiers ti on ti.key = m.tier
      where s.contact_id is not null and m.contact_id = s.contact_id
        and ti.period in ('day', 'week') and m.status <> 'revoked'
        and coalesce(m.starts_on, m.created_at::date) between s.check_in and s.check_out
    ), '[]'::jsonb)
  from public.stays s
  where s.lot_id = p_lot and s.kind = 'guest' and public.owns_lot(p_lot)
    and s.check_out >= public.org_today() - 365
  order by s.check_in desc;
$$;

-- Billing: what The ARK has invoiced the steward for this property ------------------

create or replace function public.my_property_invoices(p_lot uuid)
returns table (
  id uuid, description text, category text, amount numeric, status text,
  entry_date date, due_date date, paid_on date
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, f.description, f.category, f.amount, f.status, f.entry_date, f.due_date, f.paid_on
  from public.finance_entries f
  where f.lot_id = p_lot and f.kind = 'income' and f.status <> 'draft'
    and f.contact_id = public.current_active_steward_id() and public.owns_lot(p_lot)
  order by f.entry_date desc;
$$;

revoke execute on function
  public.my_property_notes(uuid), public.owner_add_note(uuid, text), public.owner_delete_note(uuid),
  public.my_property_budgets(uuid), public.owner_decide_budget(uuid, boolean, text),
  public.my_property_work_detail(uuid), public.my_property_hospitality(uuid),
  public.my_property_invoices(uuid)
  from anon, public;
grant execute on function
  public.my_property_notes(uuid), public.owner_add_note(uuid, text), public.owner_delete_note(uuid),
  public.my_property_budgets(uuid), public.owner_decide_budget(uuid, boolean, text),
  public.my_property_work_detail(uuid), public.my_property_hospitality(uuid),
  public.my_property_invoices(uuid)
  to authenticated;
