-- Stripe (test mode until launch). People pay on Stripe Checkout for day and
-- week passes, membership terms and event tickets; when Stripe confirms the
-- payment, record_stripe_payment() does everything that follows in one go:
-- finds or adds the person, starts the pass or extends the membership, marks
-- the ticket paid, adds the income to Finance and keeps a payments row.
-- Only the server (service role) records payments; staff read them.

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'stripe' check (provider in ('stripe')),
  kind text not null check (kind in ('pass', 'membership', 'ticket')),
  status text not null default 'paid' check (status in ('paid', 'refunded')),
  contact_id uuid references public.contacts (id) on delete set null,
  registration_id uuid references public.registrations (id) on delete set null,
  tier text references public.membership_tiers (key) on update cascade on delete set null,
  name text,
  email extensions.citext,
  description text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null check (currency in ('CRC', 'USD')),
  -- What a pass or membership payment covers.
  starts_on date,
  ends_on date,
  finance_entry_id uuid references public.finance_entries (id) on delete set null,
  refunded_amount numeric(14, 2) not null default 0 check (refunded_amount >= 0),
  session_id text not null unique,
  payment_intent text unique,
  live boolean not null default false,
  paid_at timestamptz not null default now(),
  refunded_at timestamptz,
  created_at timestamptz not null default now()
);
create index payments_paid_idx on public.payments (paid_at desc);
create index payments_contact_idx on public.payments (contact_id) where contact_id is not null;
create index payments_registration_idx on public.payments (registration_id) where registration_id is not null;

alter table public.payments enable row level security;

-- Admins see every payment; CRM staff see the payments of people they can read.
create policy "Staff read payments" on public.payments
  for select to authenticated
  using (public.has_role('admin') or (contact_id is not null and public.can_read_contact(contact_id)));
-- No insert, update or delete policies: only record_stripe_payment() and
-- refund_stripe_payment() write here, as the service role.

create or replace function public.record_stripe_payment(p jsonb)
returns table (payment_id uuid, contact_id uuid, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_session text := nullif(trim(coalesce(p ->> 'session_id', '')), '');
  v_intent text := nullif(trim(coalesce(p ->> 'payment_intent', '')), '');
  v_kind text := p ->> 'kind';
  v_email text := lower(trim(coalesce(p ->> 'email', '')));
  v_name text := nullif(trim(coalesce(p ->> 'name', '')), '');
  v_amount numeric := (p ->> 'amount')::numeric;
  v_currency text := upper(coalesce(p ->> 'currency', 'CRC'));
  v_contact uuid := nullif(p ->> 'contact_id', '')::uuid;
  v_reg uuid := nullif(p ->> 'registration_id', '')::uuid;
  v_tier text := nullif(p ->> 'tier', '');
  v_desc text := coalesce(nullif(trim(coalesce(p ->> 'description', '')), ''), 'Payment');
  v_today date := public.org_today();
  v_start date := greatest(coalesce(nullif(p ->> 'start_date', '')::date, public.org_today()), public.org_today());
  v_existing public.payments;
  t public.membership_tiers;
  cur public.membership_tiers;
  c public.contacts;
  v_starts date;
  v_ends date;
  v_months int;
  v_line uuid;
  v_entry uuid;
  v_id uuid;
begin
  if v_session is null then
    raise exception 'Missing Checkout session.' using errcode = 'P0001';
  end if;
  if v_kind not in ('pass', 'membership', 'ticket') then
    raise exception 'Unknown payment kind %.', v_kind using errcode = 'P0001';
  end if;

  -- The webhook and the return page can arrive together; one records it.
  perform pg_advisory_xact_lock(hashtextextended('stripe:' || v_session, 0));
  select * into v_existing from public.payments where session_id = v_session;
  if found then
    return query select v_existing.id, v_existing.contact_id, false;
    return;
  end if;

  -- Who paid.
  if v_contact is null and v_reg is not null then
    select r.contact_id into v_contact from public.registrations r where r.id = v_reg;
  end if;
  if v_contact is null and v_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    select x.id into v_contact from public.contacts x where x.email = v_email::extensions.citext;
  end if;
  if v_contact is null and v_kind in ('pass', 'membership') then
    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'A pass or membership payment needs an email.' using errcode = 'P0001';
    end if;
    insert into public.contacts (name, email, type, source)
    values (coalesce(v_name, split_part(v_email, '@', 1)), v_email, 'contact', 'Stripe')
    returning id into v_contact;
  end if;

  if v_kind in ('pass', 'membership') then
    select * into t from public.membership_tiers where key = v_tier;
    if not found then
      raise exception 'Unknown tier %.', v_tier using errcode = 'P0001';
    end if;
    select * into c from public.contacts where id = v_contact for update;
    select * into cur from public.membership_tiers where key = c.tier;
  end if;

  if v_kind = 'pass' then
    if t.period not in ('day', 'week') then
      raise exception '% isn''t a pass.', t.name using errcode = 'P0001';
    end if;
    v_starts := v_start;
    v_ends := case when t.period = 'week' then v_start + 6 else v_start end;
    if c.membership_status = 'active' and cur.key is not null
      and cur.period not in ('day', 'week', 'once')
      and (c.renews_on is null or c.renews_on >= v_ends) then
      -- Already a member for those days: the payment is kept, the membership left alone.
      null;
    elsif c.membership_status = 'active' and cur.period in ('day', 'week')
      and c.member_since is not null and c.renews_on is not null
      and c.renews_on >= v_starts - 1 and c.member_since <= v_ends + 1 then
      -- A pass that runs into the new one: one stretch from the first day to the last.
      update public.contacts set
        tier = case when cur.period = 'week' and t.period = 'day' then cur.key else t.key end,
        member_since = least(c.member_since, v_starts),
        renews_on = greatest(c.renews_on, v_ends)
      where id = v_contact;
    else
      update public.contacts set
        tier = t.key, membership_status = 'active',
        member_since = v_starts, renews_on = v_ends
      where id = v_contact;
    end if;

  elsif v_kind = 'membership' then
    v_months := case t.period
      when 'month' then 1 when 'quarter' then 3 when 'half' then 6 when 'year' then 12
    end;
    if v_months is null then
      raise exception '% can''t be paid as a membership term.', t.name using errcode = 'P0001';
    end if;
    -- Paying before the renewal date extends from it; otherwise the term starts today.
    v_starts := case
      when c.tier = t.key and c.membership_status = 'active'
        and c.renews_on is not null and c.renews_on >= v_today then c.renews_on
      else v_today
    end;
    v_ends := (v_starts + make_interval(months => v_months))::date;
    update public.contacts set
      tier = t.key, membership_status = 'active',
      member_since = coalesce(c.member_since, v_today),
      renews_on = v_ends
    where id = v_contact;
    insert into public.contact_stages (contact_id, pipeline, stage)
    values (v_contact, 'memberships', 'active')
    on conflict (contact_id, pipeline) do update set stage = 'active', updated_at = now();

  else
    if v_reg is null then
      raise exception 'A ticket payment needs its booking.' using errcode = 'P0001';
    end if;
    update public.registrations set paid = true where id = v_reg;
  end if;

  -- Finance. Ticket income isn't linked to the person: the paid booking
  -- already shows on their profile, so linking both would count it twice.
  select id into v_line from public.business_lines
  where name = case when v_kind = 'ticket' then 'Events & experiences' else 'Memberships' end
  order by position limit 1;
  insert into public.finance_entries (
    kind, entry_date, business_line_id, category, party, description,
    amount, currency, method, reference, status, contact_id
  ) values (
    'income', v_today, v_line,
    case when v_kind = 'ticket' then 'Tickets' else 'Membership dues' end,
    coalesce(v_name, nullif(v_email, '')), v_desc,
    v_amount, v_currency, 'card', coalesce(v_intent, v_session), 'paid',
    case when v_kind = 'ticket' then null else v_contact end
  ) returning id into v_entry;

  insert into public.payments (
    kind, contact_id, registration_id, tier, name, email, description,
    amount, currency, starts_on, ends_on, finance_entry_id,
    session_id, payment_intent, live
  ) values (
    v_kind, v_contact, v_reg, case when v_kind = 'ticket' then null else v_tier end,
    v_name, nullif(v_email, ''), v_desc,
    v_amount, v_currency, v_starts, v_ends, v_entry,
    v_session, v_intent, coalesce((p ->> 'live')::boolean, false)
  ) returning id into v_id;

  return query select v_id, v_contact, true;
end;
$$;

-- A refund from the Stripe dashboard (one call per Stripe refund, so a
-- redelivered event is ignored). Finance gets the money going out; once the
-- whole amount is back, the payment is marked refunded and a ticket goes back
-- to unpaid. Passes and memberships are left for staff to change, since a
-- refund may be partial or a goodwill gesture.
create or replace function public.refund_stripe_payment(
  p_intent text, p_refund_id text, p_amount numeric, p_currency text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  pay public.payments;
  f public.finance_entries;
begin
  select * into pay from public.payments where payment_intent = p_intent for update;
  if not found then
    return null;
  end if;
  if exists (
    select 1 from public.finance_entries
    where kind = 'expense' and category = 'Refunds' and reference = p_refund_id
  ) then
    return pay.id;
  end if;
  select * into f from public.finance_entries where id = pay.finance_entry_id;
  insert into public.finance_entries (
    kind, entry_date, business_line_id, category, party, description,
    amount, currency, method, reference, status
  ) values (
    'expense', public.org_today(), f.business_line_id, 'Refunds', f.party,
    'Refund: ' || pay.description, p_amount, upper(p_currency), 'card', p_refund_id, 'paid'
  );
  update public.payments set
    refunded_amount = refunded_amount + p_amount,
    status = case when refunded_amount + p_amount >= amount then 'refunded' else status end,
    refunded_at = case when refunded_amount + p_amount >= amount then now() else refunded_at end
  where id = pay.id;
  if pay.kind = 'ticket' and pay.registration_id is not null
    and pay.refunded_amount + p_amount >= pay.amount then
    update public.registrations set paid = false where id = pay.registration_id;
  end if;
  return pay.id;
end;
$$;

revoke all on function public.record_stripe_payment(jsonb) from public, anon, authenticated;
revoke all on function public.refund_stripe_payment(text, text, numeric, text) from public, anon, authenticated;
grant execute on function public.record_stripe_payment(jsonb) to service_role;
grant execute on function public.refund_stripe_payment(text, text, numeric, text) to service_role;
