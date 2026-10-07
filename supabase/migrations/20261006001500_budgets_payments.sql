-- Budgets & Payments (inside Finance).
--
-- A sector is a division. Sector managers (team_members.finance_role) see only
-- their own division's budgets; admins see every sector. Isolation is enforced
-- here with RLS, the rules about statuses in triggers, and the audit trail is
-- written by triggers so it can't be skipped.

-- Who can do what ------------------------------------------------------------

alter table public.team_members
  add column finance_role text
  check (finance_role in ('sector_manager', 'admin'));

-- 'admin' for ARK OS admins and for anyone given Finance role "Admin".
create or replace function public.budget_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when role = 'admin' or finance_role = 'admin' then 'admin'
              else finance_role end
  from public.team_members
  where user_id = auth.uid() and status = 'active';
$$;

create or replace function public.is_budget_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.budget_role() = 'admin', false);
$$;

create or replace function public.has_budget_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.budget_role() is not null;
$$;

create or replace function public.can_access_sector(d uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.is_budget_admin()
    or exists (
      select 1 from public.team_members t
      where t.user_id = auth.uid()
        and t.status = 'active'
        and t.finance_role = 'sector_manager'
        and t.division_id is not null
        and t.division_id = d
    ),
    false);
$$;

-- Colones for an amount in either currency, at the rate in Settings.
create or replace function public.to_crc(amount numeric, cur text)
returns numeric
language sql
stable
set search_path = ''
as $$
  select case when cur = 'USD'
    then round(amount * (select usd_crc_rate from public.org_settings), 2)
    else amount end;
$$;

-- Providers and bank accounts ---------------------------------------------------

create table public.providers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  contact text,
  notes text,
  created_by uuid references public.team_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger providers_updated_at before update on public.providers
  for each row execute function public.set_updated_at();

-- division_id is the sector that added the account; null means admins only.
create table public.provider_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  division_id uuid references public.divisions (id) on delete set null,
  bank text not null check (length(trim(bank)) > 0),
  account_holder text not null check (length(trim(account_holder)) > 0),
  account_number text not null check (length(trim(account_number)) > 0),
  currency text not null default 'CRC' check (currency in ('CRC', 'USD')),
  created_by uuid references public.team_members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index provider_bank_accounts_provider_idx
  on public.provider_bank_accounts (provider_id);

-- Budgets and lines ------------------------------------------------------------------

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  division_id uuid not null references public.divisions (id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  type text not null check (type in ('monthly', 'project')),
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'approved', 'rejected', 'closed')),
  period_month date check (period_month is null or period_month = date_trunc('month', period_month)::date),
  start_date date,
  end_date date,
  review_comment text,
  created_by uuid references public.team_members (id) on delete set null,
  submitted_at timestamptz,
  approved_by uuid references public.team_members (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budgets_period check (
    (type = 'monthly' and period_month is not null and start_date is null and end_date is null)
    or (type = 'project' and period_month is null and start_date is not null
        and end_date is not null and end_date >= start_date)
  )
);
create index budgets_division_idx on public.budgets (division_id);
create index budgets_status_idx on public.budgets (status);

create table public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets (id) on delete cascade,
  category text not null check (length(trim(category)) > 0),
  planned_crc numeric(14, 2) not null default 0 check (planned_crc >= 0),
  planned_usd numeric(14, 2) check (planned_usd is null or planned_usd >= 0),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index budget_lines_budget_idx on public.budget_lines (budget_id);

-- Monthly budgets: spending already done, with its receipt.
create table public.budget_movements (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets (id) on delete cascade,
  line_id uuid not null references public.budget_lines (id) on delete cascade,
  movement_date date not null,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'CRC' check (currency in ('CRC', 'USD')),
  amount_crc numeric(14, 2) not null,
  description text not null check (length(trim(description)) > 0),
  provider_id uuid references public.providers (id) on delete set null,
  receipt_path text not null check (length(trim(receipt_path)) > 0),
  receipt_name text,
  created_by uuid references public.team_members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index budget_movements_line_idx on public.budget_movements (line_id);
create index budget_movements_budget_idx on public.budget_movements (budget_id);

-- Project budgets: the manager asks, an admin pays.
create table public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets (id) on delete cascade,
  line_id uuid not null references public.budget_lines (id) on delete cascade,
  provider_id uuid not null references public.providers (id) on delete restrict,
  provider_account_id uuid not null
    references public.provider_bank_accounts (id) on delete restrict,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'CRC' check (currency in ('CRC', 'USD')),
  amount_crc numeric(14, 2) not null,
  due_date date,
  milestone text,
  invoice_path text,
  invoice_name text,
  status text not null default 'requested'
    check (status in ('requested', 'paid', 'rejected')),
  reject_reason text,
  requested_by uuid references public.team_members (id) on delete set null,
  requested_at timestamptz not null default now(),
  paid_by uuid references public.team_members (id) on delete set null,
  paid_at timestamptz,
  paid_on date,
  payment_receipt_path text,
  payment_receipt_name text,
  updated_at timestamptz not null default now()
);
create index payment_requests_budget_idx on public.payment_requests (budget_id);
create index payment_requests_line_idx on public.payment_requests (line_id);
create index payment_requests_open_idx on public.payment_requests (status)
  where status = 'requested';

-- Audit trail: every status change, who, when. Written only by triggers.
create table public.budget_events (
  id uuid primary key default gen_random_uuid(),
  entity text not null check (entity in ('budget', 'payment_request', 'movement')),
  entity_id uuid not null,
  budget_id uuid not null references public.budgets (id) on delete cascade,
  division_id uuid not null,
  from_status text,
  to_status text not null,
  comment text,
  actor_id uuid references public.team_members (id) on delete set null,
  actor_name text,
  created_at timestamptz not null default now()
);
create index budget_events_budget_idx on public.budget_events (budget_id, created_at);

create table public.finance_feedback (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references public.team_members (id) on delete set null,
  staff_name text,
  division_id uuid references public.divisions (id) on delete set null,
  page text,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

-- Helpers that read around RLS (no recursion) ------------------------------------------

create or replace function public.budget_division(b uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select division_id from public.budgets where id = b;
$$;

create or replace function public.budget_status(b uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select status from public.budgets where id = b;
$$;

-- A bank account is visible to admins, to the sector that added it, and to a
-- sector that has a payment request using it.
create or replace function public.can_see_bank_account(acc uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_budget_admin()
    or exists (
      select 1 from public.provider_bank_accounts a
      where a.id = acc and public.can_access_sector(a.division_id))
    or exists (
      select 1 from public.payment_requests r
      join public.budgets b on b.id = r.budget_id
      where r.provider_account_id = acc and public.can_access_sector(b.division_id));
$$;

-- The sector a storage path belongs to: {division_id}/{budget_id}/...
create or replace function public.budget_path_sector(p text)
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

-- Audit writer (only the triggers below call it).
create or replace function public.log_budget_event(
  p_entity text, p_id uuid, p_budget uuid,
  p_from text, p_to text, p_comment text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.budget_events
    (entity, entity_id, budget_id, division_id, from_status, to_status,
     comment, actor_id, actor_name)
  select p_entity, p_id, p_budget, b.division_id, p_from, p_to, p_comment,
         t.id, t.name
  from public.budgets b
  left join public.team_members t on t.user_id = auth.uid()
  where b.id = p_budget;
end;
$$;

-- Rules: budgets -------------------------------------------------------------------------

create or replace function public.budgets_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.current_staff_id();
  adm boolean := public.is_budget_admin();
  v_comment text := nullif(trim(new.review_comment), '');
begin
  new.updated_at := now();
  -- Migrations and the service role (no signed-in user) skip the status rules.
  if auth.uid() is null then return new; end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'A new budget starts as a draft.';
    end if;
    new.created_by := me;
    new.submitted_at := null;
    new.approved_by := null;
    new.approved_at := null;
    new.review_comment := null;
    return new;
  end if;

  if new.division_id <> old.division_id and not adm then
    raise exception 'You can’t move a budget to another sector.';
  end if;
  new.created_by := old.created_by;
  new.submitted_at := old.submitted_at;
  new.approved_by := old.approved_by;
  new.approved_at := old.approved_at;
  new.review_comment := old.review_comment;

  if new.status = old.status then
    if old.status <> 'draft'
       and (new.name, new.type, new.period_month, new.start_date, new.end_date, new.division_id)
           is distinct from
           (old.name, old.type, old.period_month, old.start_date, old.end_date, old.division_id)
    then
      raise exception 'Only draft budgets can be edited.';
    end if;
    return new;
  end if;

  if old.status = 'draft' and new.status = 'pending' then
    if not exists (select 1 from public.budget_lines where budget_id = new.id) then
      raise exception 'Add at least one line before sending for approval.';
    end if;
    new.submitted_at := now();
    new.approved_by := null;
    new.approved_at := null;
    new.review_comment := null;
  elsif old.status = 'pending' and new.status = 'draft' then
    null;  -- recalled by the sector
  elsif old.status = 'rejected' and new.status = 'draft' then
    null;  -- revised after a rejection
  elsif old.status = 'pending' and new.status in ('approved', 'rejected') then
    if not adm then
      raise exception 'Only an admin can approve or reject a budget.';
    end if;
    if new.status = 'rejected' and v_comment is null then
      raise exception 'Say why it was rejected, so the sector can fix it.';
    end if;
    new.review_comment := v_comment;
    if new.status = 'approved' then
      new.approved_by := me;
      new.approved_at := now();
    end if;
  elsif old.status = 'approved' and new.status = 'closed' then
    if not adm then
      raise exception 'Only an admin can close a budget.';
    end if;
  else
    raise exception 'That status change isn’t allowed.';
  end if;
  return new;
end;
$$;
create trigger budgets_guard before insert or update on public.budgets
  for each row execute function public.budgets_guard();

create or replace function public.budgets_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_budget_event('budget', new.id, new.id, null, new.status, null);
  elsif new.status is distinct from old.status then
    perform public.log_budget_event('budget', new.id, new.id, old.status, new.status,
      case when old.status = 'pending' then new.review_comment end);
  end if;
  return null;
end;
$$;
create trigger budgets_log after insert or update on public.budgets
  for each row execute function public.budgets_log();

-- Rules: lines are editable only while the budget is a draft ------------------------------

create or replace function public.budget_lines_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  st text;
begin
  if tg_op <> 'DELETE' then
    if new.category ~* '(salar|payroll|sueldo|planilla)' then
      raise exception 'Salaries are excluded from sector budgets.';
    end if;
  end if;
  if auth.uid() is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    st := public.budget_status(old.budget_id);
    -- st is null when the whole draft budget is being deleted.
    if st is not null and st <> 'draft' then
      raise exception 'Lines can only be changed while the budget is a draft.';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and new.budget_id <> old.budget_id then
    raise exception 'A line can’t move to another budget.';
  end if;
  st := public.budget_status(new.budget_id);
  if st is distinct from 'draft' then
    raise exception 'Lines can only be changed while the budget is a draft.';
  end if;
  return new;
end;
$$;
create trigger budget_lines_guard before insert or update or delete on public.budget_lines
  for each row execute function public.budget_lines_guard();

-- Rules: movements -------------------------------------------------------------------------

create or replace function public.budget_movements_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.budgets;
begin
  select * into b from public.budgets where id = new.budget_id;
  if b.id is null or b.status <> 'approved' then
    raise exception 'Nothing can be logged until the budget is approved.';
  end if;
  if b.type <> 'monthly' then
    raise exception 'Log expenses on a Monthly budget. On a Project budget, request a payment.';
  end if;
  if not exists (select 1 from public.budget_lines
                 where id = new.line_id and budget_id = new.budget_id) then
    raise exception 'Choose one of this budget’s lines.';
  end if;
  new.amount_crc := public.to_crc(new.amount, new.currency);
  if auth.uid() is not null then
    new.created_by := public.current_staff_id();
  end if;
  return new;
end;
$$;
create trigger budget_movements_guard before insert on public.budget_movements
  for each row execute function public.budget_movements_guard();

create or replace function public.budget_movements_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.log_budget_event('movement', new.id, new.budget_id, null, 'logged', null);
  return null;
end;
$$;
create trigger budget_movements_log after insert on public.budget_movements
  for each row execute function public.budget_movements_log();

-- Rules: payment requests -----------------------------------------------------------------

create or replace function public.payment_requests_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.budgets;
begin
  new.updated_at := now();

  if tg_op = 'INSERT' then
    select * into b from public.budgets where id = new.budget_id;
    if b.id is null or b.status <> 'approved' then
      raise exception 'Nothing can be requested until the budget is approved.';
    end if;
    if b.type <> 'project' then
      raise exception 'Payment requests go on a Project budget. On a Monthly budget, log the expense.';
    end if;
    if not exists (select 1 from public.budget_lines
                   where id = new.line_id and budget_id = new.budget_id) then
      raise exception 'Choose one of this budget’s lines.';
    end if;
    if not exists (select 1 from public.provider_bank_accounts
                   where id = new.provider_account_id and provider_id = new.provider_id) then
      raise exception 'That bank account doesn’t belong to this provider.';
    end if;
    if auth.uid() is not null and not public.can_see_bank_account(new.provider_account_id) then
      raise exception 'Choose one of your sector’s bank accounts for this provider.';
    end if;
    new.status := 'requested';
    new.amount_crc := public.to_crc(new.amount, new.currency);
    new.requested_at := now();
    new.requested_by := case when auth.uid() is null then new.requested_by
                             else public.current_staff_id() end;
    new.paid_by := null;
    new.paid_at := null;
    new.paid_on := null;
    new.payment_receipt_path := null;
    new.payment_receipt_name := null;
    new.reject_reason := null;
    return new;
  end if;

  -- Update: only an admin, and only to pay or reject a request that is open.
  if auth.uid() is not null and not public.is_budget_admin() then
    raise exception 'Only an admin can pay or reject a request.';
  end if;
  if old.status <> 'requested' then
    raise exception 'This request is already %.', old.status;
  end if;
  new.budget_id := old.budget_id;
  new.line_id := old.line_id;
  new.provider_id := old.provider_id;
  new.provider_account_id := old.provider_account_id;
  new.amount := old.amount;
  new.currency := old.currency;
  new.amount_crc := old.amount_crc;
  new.requested_by := old.requested_by;
  new.requested_at := old.requested_at;

  if new.status = 'paid' then
    if nullif(trim(coalesce(new.payment_receipt_path, '')), '') is null then
      raise exception 'Upload the payment receipt first.';
    end if;
    new.paid_by := public.current_staff_id();
    new.paid_at := now();
    new.paid_on := coalesce(new.paid_on, public.org_today());
    new.reject_reason := null;
  elsif new.status = 'rejected' then
    new.paid_by := null;
    new.paid_at := null;
    new.paid_on := null;
    new.payment_receipt_path := null;
    new.payment_receipt_name := null;
  else
    raise exception 'Mark the request paid or rejected.';
  end if;
  return new;
end;
$$;
create trigger payment_requests_guard before insert or update on public.payment_requests
  for each row execute function public.payment_requests_guard();

create or replace function public.payment_requests_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_budget_event('payment_request', new.id, new.budget_id, null, new.status, null);
  elsif new.status is distinct from old.status then
    perform public.log_budget_event('payment_request', new.id, new.budget_id,
      old.status, new.status, new.reject_reason);
  end if;
  return null;
end;
$$;
create trigger payment_requests_log after insert or update on public.payment_requests
  for each row execute function public.payment_requests_log();

-- Totals per line (planned lives on the line; used comes from here) ---------------------------
-- security_invoker: callers only see totals for lines RLS lets them see.

create view public.budget_line_totals with (security_invoker = true) as
select
  l.id as line_id,
  l.budget_id,
  coalesce((select sum(m.amount_crc) from public.budget_movements m
            where m.line_id = l.id), 0) as movements_crc,
  coalesce((select sum(r.amount_crc) from public.payment_requests r
            where r.line_id = l.id and r.status = 'paid'), 0) as paid_crc,
  coalesce((select sum(r.amount_crc) from public.payment_requests r
            where r.line_id = l.id and r.status = 'requested'), 0) as requested_crc
from public.budget_lines l;

-- Row level security ----------------------------------------------------------------------------

alter table public.providers enable row level security;
alter table public.provider_bank_accounts enable row level security;
alter table public.budgets enable row level security;
alter table public.budget_lines enable row level security;
alter table public.budget_movements enable row level security;
alter table public.payment_requests enable row level security;
alter table public.budget_events enable row level security;
alter table public.finance_feedback enable row level security;

-- Providers: the directory is shared by everyone with a finance role.
create policy "Finance roles read providers" on public.providers
  for select to authenticated using (public.has_budget_access());
create policy "Finance roles add providers" on public.providers
  for insert to authenticated with check (public.has_budget_access());
create policy "Admins or the adder edit providers" on public.providers
  for update to authenticated
  using (public.is_budget_admin() or created_by = public.current_staff_id())
  with check (public.is_budget_admin() or created_by = public.current_staff_id());
create policy "Admins delete providers" on public.providers
  for delete to authenticated using (public.is_budget_admin());

-- Bank accounts: admins, the sector that added them, and sectors that use them.
create policy "See permitted bank accounts" on public.provider_bank_accounts
  for select to authenticated using (public.can_see_bank_account(id));
create policy "Add bank accounts" on public.provider_bank_accounts
  for insert to authenticated
  with check (
    public.is_budget_admin()
    or (division_id is not null and public.can_access_sector(division_id))
  );
create policy "Edit own sector bank accounts" on public.provider_bank_accounts
  for update to authenticated
  using (public.is_budget_admin() or public.can_access_sector(division_id))
  with check (public.is_budget_admin() or public.can_access_sector(division_id));
create policy "Delete own sector bank accounts" on public.provider_bank_accounts
  for delete to authenticated
  using (public.is_budget_admin() or public.can_access_sector(division_id));

-- Budgets and everything under them: one sector's people, plus admins.
create policy "Sector reads budgets" on public.budgets
  for select to authenticated using (public.can_access_sector(division_id));
create policy "Sector creates draft budgets" on public.budgets
  for insert to authenticated
  with check (public.can_access_sector(division_id) and status = 'draft');
create policy "Sector updates budgets" on public.budgets
  for update to authenticated
  using (public.can_access_sector(division_id))
  with check (public.can_access_sector(division_id));
create policy "Sector deletes drafts" on public.budgets
  for delete to authenticated
  using (public.can_access_sector(division_id) and status = 'draft');

create policy "Sector reads lines" on public.budget_lines
  for select to authenticated
  using (public.can_access_sector(public.budget_division(budget_id)));
create policy "Sector adds lines" on public.budget_lines
  for insert to authenticated
  with check (public.can_access_sector(public.budget_division(budget_id)));
create policy "Sector edits lines" on public.budget_lines
  for update to authenticated
  using (public.can_access_sector(public.budget_division(budget_id)))
  with check (public.can_access_sector(public.budget_division(budget_id)));
create policy "Sector deletes lines" on public.budget_lines
  for delete to authenticated
  using (public.can_access_sector(public.budget_division(budget_id)));

-- Movements are a record of spending: the sector adds them, only admins correct them.
create policy "Sector reads movements" on public.budget_movements
  for select to authenticated
  using (public.can_access_sector(public.budget_division(budget_id)));
create policy "Sector logs movements" on public.budget_movements
  for insert to authenticated
  with check (public.can_access_sector(public.budget_division(budget_id)));
create policy "Admins correct movements" on public.budget_movements
  for update to authenticated
  using (public.is_budget_admin()) with check (public.is_budget_admin());
create policy "Admins delete movements" on public.budget_movements
  for delete to authenticated using (public.is_budget_admin());

create policy "Sector reads requests" on public.payment_requests
  for select to authenticated
  using (public.can_access_sector(public.budget_division(budget_id)));
create policy "Sector makes requests" on public.payment_requests
  for insert to authenticated
  with check (public.can_access_sector(public.budget_division(budget_id)));
create policy "Admins pay or reject requests" on public.payment_requests
  for update to authenticated
  using (public.is_budget_admin()) with check (public.is_budget_admin());

-- History: readable by the sector; no one writes it by hand.
create policy "Sector reads history" on public.budget_events
  for select to authenticated using (public.can_access_sector(division_id));

create policy "Finance roles leave feedback" on public.finance_feedback
  for insert to authenticated
  with check (public.has_budget_access() and staff_id = public.current_staff_id());
create policy "Admins read feedback" on public.finance_feedback
  for select to authenticated using (public.is_budget_admin());
create policy "Admins delete feedback" on public.finance_feedback
  for delete to authenticated using (public.is_budget_admin());

-- Receipts and invoices: a private bucket, one folder per sector -----------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('budgets', 'budgets', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;

create policy "Sector reads budget files" on storage.objects
  for select to authenticated
  using (bucket_id = 'budgets'
    and public.can_access_sector(public.budget_path_sector(name)));
create policy "Sector uploads budget files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'budgets'
    and public.can_access_sector(public.budget_path_sector(name)));
create policy "Admins replace budget files" on storage.objects
  for update to authenticated
  using (bucket_id = 'budgets' and public.is_budget_admin());
create policy "Admins delete budget files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'budgets' and public.is_budget_admin());

-- Grants: signed-in only ------------------------------------------------------------------------

revoke all on public.providers, public.provider_bank_accounts, public.budgets,
  public.budget_lines, public.budget_movements, public.payment_requests,
  public.budget_events, public.finance_feedback, public.budget_line_totals
  from anon;
grant select on public.budget_line_totals to authenticated;

revoke all on function
  public.budget_role(), public.is_budget_admin(), public.has_budget_access(),
  public.can_access_sector(uuid), public.budget_division(uuid),
  public.budget_status(uuid), public.can_see_bank_account(uuid),
  public.budget_path_sector(text)
  from public, anon;
grant execute on function
  public.budget_role(), public.is_budget_admin(), public.has_budget_access(),
  public.can_access_sector(uuid), public.budget_division(uuid),
  public.budget_status(uuid), public.can_see_bank_account(uuid),
  public.budget_path_sector(text)
  to authenticated;
revoke all on function public.log_budget_event(text, uuid, uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.to_crc(numeric, text) from public, anon;
grant execute on function public.to_crc(numeric, text) to authenticated;
