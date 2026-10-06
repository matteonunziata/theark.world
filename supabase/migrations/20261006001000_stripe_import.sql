-- Import past Stripe payments. Settings → Integrations → Stripe → "Import
-- past payments" reads every successful charge in the Stripe account and
-- hands each one to import_stripe_charge(), which records it once (keyed on
-- the charge id): a payments row (source 'import', kind 'other'), an income
-- entry in Finance on the day it was paid, its refunds as Refunds expenses,
-- and Stripe's fee added to that month's "Stripe fees" expense. The person is
-- linked when their email is already in the CRM; nobody new is added.
-- Charges made through ARK OS's own checkout are skipped (they are recorded
-- by record_stripe_payment()).

alter table public.payments alter column session_id drop not null;
alter table public.payments
  add column charge_id text unique,
  add column source text not null default 'checkout' check (source in ('checkout', 'import')),
  add column fee numeric(14, 2) check (fee >= 0),
  add column fee_currency text check (fee_currency in ('CRC', 'USD'));
alter table public.payments drop constraint payments_kind_check;
alter table public.payments add constraint payments_kind_check
  check (kind in ('pass', 'membership', 'ticket', 'court', 'other'));
alter table public.payments add constraint payments_has_stripe_id
  check (session_id is not null or charge_id is not null);
create index payments_source_idx on public.payments (source, paid_at desc);

create or replace function public.import_stripe_charge(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_charge text := nullif(trim(coalesce(p ->> 'charge_id', '')), '');
  v_intent text := nullif(trim(coalesce(p ->> 'payment_intent', '')), '');
  v_email text := lower(trim(coalesce(p ->> 'email', '')));
  v_name text := nullif(trim(coalesce(p ->> 'name', '')), '');
  v_amount numeric := (p ->> 'amount')::numeric;
  v_currency text := upper(coalesce(p ->> 'currency', ''));
  v_paid_at timestamptz := (p ->> 'paid_at')::timestamptz;
  v_day date := (p ->> 'paid_on')::date;
  v_desc text := coalesce(nullif(trim(coalesce(p ->> 'description', '')), ''), 'Stripe payment');
  v_fee numeric := coalesce((p ->> 'fee')::numeric, 0);
  v_fee_cur text := upper(coalesce(p ->> 'fee_currency', ''));
  v_contact uuid;
  v_line uuid;
  v_other uuid;
  v_entry uuid;
  v_id uuid;
  v_refunded numeric := 0;
  v_last_refund timestamptz;
  v_month text;
  r jsonb;
begin
  if v_charge is null or v_amount is null or v_amount <= 0 or v_paid_at is null or v_day is null then
    raise exception 'A charge needs an id, an amount and a date.' using errcode = 'P0001';
  end if;
  if v_currency not in ('CRC', 'USD') then
    raise exception 'Only colones and dollars can be imported.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('stripe-charge:' || v_charge, 0));
  if exists (
    select 1 from public.payments
    where charge_id = v_charge or (v_intent is not null and payment_intent = v_intent)
  ) then
    return jsonb_build_object('status', 'skipped');
  end if;

  if v_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    select id into v_contact from public.contacts where email = v_email::extensions.citext;
  end if;

  select id into v_other from public.business_lines where name = 'Other' order by position limit 1;
  select id into v_line from public.business_lines where name = p ->> 'line' order by position limit 1;

  insert into public.finance_entries (
    kind, entry_date, business_line_id, category, party, description,
    amount, currency, method, reference, status, paid_on, contact_id
  ) values (
    'income', v_day, coalesce(v_line, v_other), nullif(p ->> 'category', ''),
    coalesce(v_name, nullif(v_email, '')), v_desc,
    v_amount, v_currency, 'card', v_charge, 'paid', v_day, v_contact
  ) returning id into v_entry;

  -- Refunds, each once (a later refund.created webhook finds the same reference).
  for r in select * from jsonb_array_elements(coalesce(p -> 'refunds', '[]'::jsonb)) loop
    if (r ->> 'amount')::numeric > 0 and not exists (
      select 1 from public.finance_entries
      where kind = 'expense' and category = 'Refunds' and reference = r ->> 'id'
    ) then
      insert into public.finance_entries (
        kind, entry_date, business_line_id, category, party, description,
        amount, currency, method, reference, status, paid_on
      ) values (
        'expense', (r ->> 'refunded_on')::date, coalesce(v_line, v_other), 'Refunds',
        coalesce(v_name, nullif(v_email, '')), 'Refund: ' || v_desc,
        (r ->> 'amount')::numeric, v_currency, 'card', r ->> 'id', 'paid', (r ->> 'refunded_on')::date
      );
    end if;
    v_refunded := v_refunded + (r ->> 'amount')::numeric;
    v_last_refund := greatest(v_last_refund, (r ->> 'refunded_at')::timestamptz);
  end loop;

  -- Stripe's fee, added to one expense per month and currency.
  if v_fee > 0 and v_fee_cur in ('CRC', 'USD') then
    v_month := to_char(v_day, 'YYYY-MM');
    -- Charges are imported several at a time; one month's total is written by one at a time.
    perform pg_advisory_xact_lock(hashtextextended('stripe-fees:' || v_month || ':' || v_fee_cur, 0));
    update public.finance_entries
      set amount = amount + v_fee
      where kind = 'expense' and category = 'Stripe fees'
        and reference = 'stripe-fees:' || v_month || ':' || v_fee_cur;
    if not found then
      insert into public.finance_entries (
        kind, entry_date, business_line_id, category, party, description,
        amount, currency, method, reference, status, paid_on
      ) values (
        'expense', (date_trunc('month', v_day) + interval '1 month - 1 day')::date, v_other,
        'Stripe fees', 'Stripe', 'Stripe fees, ' || to_char(v_day, 'FMMonth YYYY'),
        v_fee, v_fee_cur, 'card', 'stripe-fees:' || v_month || ':' || v_fee_cur, 'paid',
        (date_trunc('month', v_day) + interval '1 month - 1 day')::date
      );
    end if;
  end if;

  insert into public.payments (
    kind, source, contact_id, name, email, description, amount, currency,
    finance_entry_id, charge_id, payment_intent, live, paid_at,
    refunded_amount, status, refunded_at, fee, fee_currency
  ) values (
    'other', 'import', v_contact, v_name, nullif(v_email, ''), v_desc, v_amount, v_currency,
    v_entry, v_charge, v_intent, coalesce((p ->> 'live')::boolean, false), v_paid_at,
    least(v_refunded, v_amount),
    case when v_refunded >= v_amount then 'refunded' else 'paid' end,
    case when v_refunded >= v_amount then v_last_refund end,
    nullif(v_fee, 0), case when v_fee > 0 and v_fee_cur in ('CRC', 'USD') then v_fee_cur end
  ) returning id into v_id;

  return jsonb_build_object('status', 'imported', 'linked', v_contact is not null, 'payment_id', v_id);
end;
$$;

revoke all on function public.import_stripe_charge(jsonb) from public, anon, authenticated;
grant execute on function public.import_stripe_charge(jsonb) to service_role;
