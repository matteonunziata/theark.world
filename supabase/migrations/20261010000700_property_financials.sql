-- Property financials live in the finance ledger (finance_entries) so Finance
-- AR/AP and the totals pick them up. A row linked to a property (lot_id) is in
-- colones. Income = owed to The ARK by a steward; expense = owed to a steward.
-- Drafts are not owed yet: they stay out of every list and total until sent.

alter table public.finance_entries
  add column lot_id uuid references public.lots (id) on delete set null,
  add column period_start date,
  add column period_end date;
create index finance_entries_lot_idx on public.finance_entries (lot_id) where lot_id is not null;

alter table public.finance_entries drop constraint finance_entries_status_check;
alter table public.finance_entries add constraint finance_entries_status_check
  check (status in ('paid', 'unpaid', 'draft'));
alter table public.finance_entries add constraint finance_entries_property_crc
  check (lot_id is null or currency = 'CRC');

create or replace function public.finance_entries_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  if new.status = 'paid' and new.paid_on is null then
    new.paid_on = coalesce(
      case when tg_op = 'UPDATE' and old.status in ('unpaid', 'draft') then public.org_today() end,
      new.entry_date
    );
  elsif new.status in ('unpaid', 'draft') then
    new.paid_on = null;
  end if;
  return new;
end;
$$;

-- Drafts stay off the CRM activity feed.
do $$
declare d text;
begin
  select pg_get_functiondef('public.contact_activity(uuid)'::regprocedure) into d;
  d := replace(d,
    'on f.contact_id = c.id and f.kind = ''income''',
    'on f.contact_id = c.id and f.kind = ''income'' and f.status <> ''draft''');
  execute d;
end $$;

-- True when the steward has no overdue property invoice.
create or replace function public.steward_fees_current(p_contact uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_estate_staff() or p_contact = public.current_member_contact_id() then
      not exists (
        select 1 from public.finance_entries f
        where f.contact_id = p_contact and f.kind = 'income' and f.lot_id is not null
          and f.status = 'unpaid' and f.due_date < public.org_today()
      )
  end;
$$;
revoke execute on function public.steward_fees_current(uuid) from anon, public;
grant execute on function public.steward_fees_current(uuid) to authenticated;

-- Fees-current flag and open balances for one steward, in colones (CRM profile).
create or replace function public.steward_finance(p_contact uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.is_estate_staff() then json_build_object(
    'fees_current', public.steward_fees_current(p_contact),
    -- Amounts are ledger figures: admins only.
    'owed_to_ark', case when public.has_role('admin') then coalesce((select sum(amount) from public.finance_entries
      where contact_id = p_contact and kind = 'income' and lot_id is not null and status = 'unpaid'), 0) end,
    'owed_to_steward', case when public.has_role('admin') then coalesce((select sum(amount) from public.finance_entries
      where contact_id = p_contact and kind = 'expense' and lot_id is not null and status = 'unpaid'), 0) end
  ) end;
$$;
revoke execute on function public.steward_finance(uuid) from anon, public;
grant execute on function public.steward_finance(uuid) to authenticated;
