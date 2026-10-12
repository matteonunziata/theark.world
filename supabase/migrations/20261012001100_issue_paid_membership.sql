-- Take payment when staff issue a membership or pass: cash, SINPE, a card
-- taken at the desk (BAC) or the customer's saved Tilopay card. The membership
-- and its Finance income line are written together, once.

alter table public.finance_entries
  add column membership_id uuid references public.memberships (id) on delete set null;
create unique index finance_entries_membership_idx on public.finance_entries (membership_id) where membership_id is not null;

create or replace function public.issue_paid_membership(
  p_contact uuid, p_tier text, p_status text, p_starts date, p_ends date,
  p_method text, p_reference text, p_amount numeric, p_currency text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text;
  v_tier_name text;
begin
  if not public.can_issue_pass() then
    raise exception 'You can''t take payments.' using errcode = '42501';
  end if;
  if p_method not in ('cash', 'sinpe', 'card') then
    raise exception 'Choose how they paid.' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'There is nothing to charge for this tier.' using errcode = 'P0001';
  end if;
  v_id := public.set_membership(p_contact, p_tier, p_status, p_starts, p_ends);
  if v_id is null then return null; end if;
  select name into v_name from public.contacts where id = p_contact;
  select name into v_tier_name from public.membership_tiers where key = p_tier;
  insert into public.finance_entries (
    kind, entry_date, business_line_id, category, party, description,
    amount, currency, method, reference, status, contact_id, created_by, membership_id
  ) values (
    'income', public.org_today(),
    (select id from public.business_lines where name = 'Memberships' order by position limit 1),
    'Membership dues', v_name, coalesce(v_tier_name, p_tier) || ' (taken by staff)',
    p_amount, upper(p_currency), p_method, nullif(trim(coalesce(p_reference, '')), ''),
    'paid', p_contact, public.current_staff_id(), v_id)
  on conflict (membership_id) where membership_id is not null do nothing;
  return v_id;
end;
$$;
revoke all on function public.issue_paid_membership(uuid, text, text, date, date, text, text, numeric, text) from public, anon;
grant execute on function public.issue_paid_membership(uuid, text, text, date, date, text, text, numeric, text) to authenticated;
