-- Several meals, on several days, in one payment.
-- A booking_order groups the registrations made in one checkout (one per meal
-- and day). Paying the order marks them all paid and confirms every hold. The
-- order table has no policies: only the service role and the security-definer
-- functions below touch it.
create table public.booking_orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.booking_orders enable row level security;

alter table public.registrations
  add column order_id uuid references public.booking_orders (id) on delete set null;
create index registrations_order_idx on public.registrations (order_id) where order_id is not null;

alter table public.payments
  add column order_id uuid references public.booking_orders (id) on delete set null;

-- record_stripe_payment: a ticket payment may name an order instead of one
-- registration. refund_stripe_payment: a full refund of an order frees them all.
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
  v_order uuid := nullif(p ->> 'order_id', '')::uuid;
  v_player uuid := nullif(p ->> 'court_player_id', '')::uuid;
  v_booking uuid;
  v_tier text := nullif(p ->> 'tier', '');
  v_desc text := coalesce(nullif(trim(coalesce(p ->> 'description', '')), ''), 'Payment');
  v_today date := public.org_today();
  v_start date := greatest(coalesce(nullif(p ->> 'start_date', '')::date, public.org_today()), public.org_today());
  v_existing public.payments;
  t public.membership_tiers;
  pl public.court_players;
  v_prev date;
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
  if v_kind not in ('pass', 'membership', 'ticket', 'court') then
    raise exception 'Unknown payment kind %.', v_kind using errcode = 'P0001';
  end if;

  -- The webhook and the return page can arrive together; one records it.
  perform pg_advisory_xact_lock(hashtextextended('stripe:' || v_session, 0));
  select * into v_existing from public.payments where session_id = v_session;
  if found then
    return query select v_existing.id, v_existing.contact_id, false;
    return;
  end if;

  -- An order pays several bookings at once; the payment points at the first.
  if v_order is not null and v_reg is null then
    select r.id into v_reg from public.registrations r
    where r.order_id = v_order order by r.session_date, r.created_at limit 1;
  end if;

  -- Who paid.
  if v_contact is null and v_reg is not null then
    select r.contact_id into v_contact from public.registrations r where r.id = v_reg;
  end if;
  if v_kind = 'court' then
    if v_player is null then
      raise exception 'A court payment needs its player.' using errcode = 'P0001';
    end if;
    select * into pl from public.court_players where id = v_player for update;
    if not found then
      raise exception 'Unknown court player %.', v_player using errcode = 'P0001';
    end if;
    v_booking := pl.booking_id;
    v_contact := coalesce(v_contact, pl.contact_id);
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
    perform 1 from public.contacts where id = v_contact for update;
  end if;

  if v_kind = 'pass' then
    if t.period not in ('day', 'week') then
      raise exception '% isn''t a pass.', t.name using errcode = 'P0001';
    end if;
  elsif v_kind = 'membership' then
    v_months := case t.period
      when 'month' then 1 when 'quarter' then 3 when 'half' then 6 when 'year' then 12
    end;
    if v_months is null then
      raise exception '% can''t be paid as a membership term.', t.name using errcode = 'P0001';
    end if;
    -- Paid while a membership still runs: the new term follows it.
    select max(m.ends_on) into v_prev
    from public.memberships m
    join public.membership_tiers mt on mt.key = m.tier
    where m.contact_id = v_contact and m.status in ('active', 'cancelled', 'paused')
      and mt.period not in ('day', 'week') and m.tier <> 'team'
      and m.ends_on is not null and m.ends_on >= v_start;
    v_starts := case when v_prev is not null then v_prev + 1 else v_start end;
    v_ends := (v_starts + make_interval(months => v_months))::date - 1;
  elsif v_kind = 'ticket' then
    if v_reg is null then
      raise exception 'A ticket payment needs its booking.' using errcode = 'P0001';
    end if;
  end if;

  -- Finance. Ticket and court income isn't linked to the person: the booking
  -- already shows on their profile, so linking both would count it twice.
  select id into v_line from public.business_lines
  where name = case v_kind
    when 'ticket' then 'Events & experiences'
    when 'court' then 'Courts'
    else 'Memberships' end
  order by position limit 1;
  insert into public.finance_entries (
    kind, entry_date, business_line_id, category, party, description,
    amount, currency, method, reference, status, contact_id
  ) values (
    'income', v_today, v_line,
    case v_kind when 'ticket' then 'Tickets' when 'court' then 'Court bookings' else 'Membership dues' end,
    coalesce(v_name, nullif(v_email, '')), v_desc,
    v_amount, v_currency, 'card', coalesce(v_intent, v_session), 'paid',
    case when v_kind in ('ticket', 'court') then null else v_contact end
  ) returning id into v_entry;

  insert into public.payments (
    kind, contact_id, registration_id, order_id, court_booking_id, court_player_id, tier, name, email, description,
    amount, currency, starts_on, ends_on, finance_entry_id,
    session_id, payment_intent, live
  ) values (
    v_kind, v_contact, v_reg, v_order, v_booking, v_player,
    case when v_kind in ('ticket', 'court') then null else v_tier end,
    v_name, nullif(v_email, ''), v_desc,
    v_amount, v_currency, v_starts, v_ends, v_entry,
    v_session, v_intent, coalesce((p ->> 'live')::boolean, false)
  ) returning id into v_id;

  if v_kind = 'pass' then
    insert into public.memberships (contact_id, tier, status, activate_by, source, payment_id)
    values (v_contact, t.key, 'unused', v_today + 90, 'stripe', v_id);
  elsif v_kind = 'membership' then
    insert into public.memberships (contact_id, tier, status, starts_on, ends_on, source, payment_id)
    values (v_contact, t.key, 'active', v_starts, v_ends, 'stripe', v_id);
    insert into public.contact_stages (contact_id, pipeline, stage)
    values (v_contact, 'memberships', 'active')
    on conflict (contact_id, pipeline) do update set stage = 'active', updated_at = now();
  elsif v_kind = 'court' then
    update public.court_players
    set paid = true, paid_at = now(), status = 'in', held_until = null
    where id = v_player;
    begin
      update public.court_bookings b set
        status = case when b.status in ('held', 'booked', 'expired') then 'booked' else b.status end,
        held_until = null,
        paid = (select coalesce(sum(x.amount) filter (where x.paid), 0) >= coalesce(b.amount, 0)
                from public.court_players x where x.booking_id = b.id),
        paid_at = case when b.paid_at is null then now() else b.paid_at end
      where b.id = v_booking;
    exception when exclusion_violation then
      -- The hold ran out and someone else took the slot while they were
      -- paying. The payment is kept so the team can refund it.
      update public.court_bookings
      set notes = concat_ws(E'\n', notes, 'Paid after the hold expired and the slot was taken. Refund from Stripe.')
      where id = v_booking;
    end;
  elsif v_order is not null then
    update public.registrations set paid = true where order_id = v_order;
  else
    update public.registrations set paid = true where id = v_reg;
  end if;

  return query select v_id, v_contact, true;
end;
$$;

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
  pl public.court_players;
  v_full boolean;
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
  v_full := pay.refunded_amount + p_amount >= pay.amount;
  update public.payments set
    refunded_amount = refunded_amount + p_amount,
    status = case when v_full then 'refunded' else status end,
    refunded_at = case when v_full then now() else refunded_at end
  where id = pay.id;
  if v_full then
    if pay.kind = 'ticket' and pay.order_id is not null then
      update public.registrations set paid = false where order_id = pay.order_id;
    elsif pay.kind = 'ticket' and pay.registration_id is not null then
      update public.registrations set paid = false where id = pay.registration_id;
    end if;
    if pay.kind = 'court' and pay.court_player_id is not null then
      select * into pl from public.court_players where id = pay.court_player_id;
      update public.court_players set paid = false, status = 'out' where id = pl.id;
      if pl.host then
        update public.court_bookings set status = 'cancelled', paid = false where id = pl.booking_id;
        update public.court_players set status = 'out'
        where booking_id = pl.booking_id and status in ('in', 'held');
      else
        update public.court_bookings set paid = false where id = pl.booking_id;
      end if;
    end if;
    update public.memberships set
      status = 'revoked', revoked_at = now(), revoke_reason = 'Refunded on Stripe'
    where payment_id = pay.id and status <> 'revoked';
  end if;
  return pay.id;
end;
$$;

revoke all on function public.record_stripe_payment(jsonb) from public, anon, authenticated;
revoke all on function public.refund_stripe_payment(text, text, numeric, text) from public, anon, authenticated;
grant execute on function public.record_stripe_payment(jsonb) to service_role;
grant execute on function public.refund_stripe_payment(text, text, numeric, text) to service_role;
