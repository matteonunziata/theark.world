-- Budgets & Payments: sector isolation, status rules, audit trail, storage.
-- One transaction that rolls back, so it is safe to run on the live project:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/budgets.sql
-- or paste it into the Supabase MCP execute_sql. Any failed check raises an
-- exception naming the rule that broke.

begin;

create temp table _ids (k text primary key, id uuid) on commit drop;
grant all on _ids to anon, authenticated;

create or replace function pg_temp.id(k text) returns uuid language sql as
  $$ select id from _ids where _ids.k = $1 $$;

create or replace function pg_temp.act_as(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    coalesce(json_build_object('sub', uid, 'role', 'authenticated')::text, ''),
    true);
  if uid is null then
    execute 'set local role anon';
  else
    execute 'set local role authenticated';
  end if;
end $$;

create or replace function pg_temp.expect(ok boolean, what text) returns void
language plpgsql as $$
begin
  if ok is not true then raise exception 'BUDGET TEST failed: %', what; end if;
end $$;

-- The statement must be refused (and, when given, with a message like `msg`).
create or replace function pg_temp.fails(stmt text, what text, msg text default null)
returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if msg is not null and sqlerrm not like msg then
      raise exception 'BUDGET TEST failed: % was refused with the wrong error: %', what, sqlerrm;
    end if;
    return;
  end;
  raise exception 'BUDGET TEST failed: % should have been refused', what;
end $$;

-- Fixtures -----------------------------------------------------------------------

insert into _ids
select r, gen_random_uuid()
from unnest(array[
  'mgr_a', 'mgr_b', 'fin_admin', 'full_admin', 'plain',
  'div_a', 'div_b',
  'b_month', 'b_proj', 'b_other', 'line_m', 'line_p', 'line_o',
  'prov', 'acct_a', 'acct_admin', 'req', 'mv', 'mv_usd', 'fb'
]) r;

insert into public.divisions (id, name) values
  (pg_temp.id('div_a'), 'Sector A'), (pg_temp.id('div_b'), 'Sector B');

insert into auth.users (id, email, aud, role, instance_id)
select id, k || '@theark.world', 'authenticated', 'authenticated',
  '00000000-0000-0000-0000-000000000000'
from _ids where k in ('mgr_a', 'mgr_b', 'fin_admin', 'full_admin', 'plain');

insert into public.team_members (email, name, role, finance_role, division_id) values
  ('mgr_a@theark.world', 'Manager A', 'lead', 'sector_manager', pg_temp.id('div_a')),
  ('mgr_b@theark.world', 'Manager B', 'lead', 'sector_manager', pg_temp.id('div_b')),
  ('fin_admin@theark.world', 'Finance admin', 'lead', 'admin', null),
  ('full_admin@theark.world', 'Full admin', 'admin', null, null),
  ('plain@theark.world', 'Plain lead', 'lead', null, pg_temp.id('div_a'));

select pg_temp.expect(
  (select count(*) from public.team_members where user_id is not null
     and email in ('mgr_a@theark.world','mgr_b@theark.world','fin_admin@theark.world',
                   'full_admin@theark.world','plain@theark.world')) = 5,
  'fixture team members link to their users');

-- Sector isolation: budgets ---------------------------------------------------------

select pg_temp.act_as(pg_temp.id('mgr_a'));
insert into public.budgets (id, division_id, name, type, period_month)
values (pg_temp.id('b_month'), pg_temp.id('div_a'), 'A monthly', 'monthly', date_trunc('month', current_date)::date);
select pg_temp.fails(
  format($f$insert into public.budgets (division_id, name, type, period_month)
    values (%L, 'Sneaky', 'monthly', date_trunc('month', current_date)::date)$f$, pg_temp.id('div_b')),
  'a manager creating a budget in another sector');
select pg_temp.fails(
  format($f$insert into public.budgets (division_id, name, type, period_month, status)
    values (%L, 'Pre-approved', 'monthly', date_trunc('month', current_date)::date, 'approved')$f$, pg_temp.id('div_a')),
  'creating a budget that is already approved');
reset role;
select pg_temp.expect((select created_by is not null from public.budgets where id = pg_temp.id('b_month')),
  'the creator is recorded');

select pg_temp.act_as(pg_temp.id('mgr_b'));
insert into public.budgets (id, division_id, name, type, start_date, end_date)
values (pg_temp.id('b_other'), pg_temp.id('div_b'), 'B project', 'project', current_date, current_date + 30);
insert into public.budget_lines (id, budget_id, category, planned_crc)
values (pg_temp.id('line_o'), pg_temp.id('b_other'), 'B stuff', 1000);
select pg_temp.expect((select count(*) from public.budgets) = 1, 'manager B sees only their own budget');
select pg_temp.expect((select count(*) from public.budgets where id = pg_temp.id('b_month')) = 0,
  'manager B cannot read sector A budgets');
reset role;

select pg_temp.act_as(pg_temp.id('plain'));
select pg_temp.expect((select count(*) from public.budgets) = 0, 'someone without a finance role sees no budgets');
select pg_temp.fails(
  format($f$insert into public.budgets (division_id, name, type, period_month)
    values (%L, 'Nope', 'monthly', date_trunc('month', current_date)::date)$f$, pg_temp.id('div_a')),
  'a person without a finance role creating a budget');
reset role;

select pg_temp.act_as(pg_temp.id('fin_admin'));
select pg_temp.expect((select count(*) from public.budgets) = 2, 'a budget admin sees every sector');
reset role;

-- Lines, salaries, and "nothing before approval" --------------------------------------

select pg_temp.act_as(pg_temp.id('mgr_a'));
select pg_temp.fails(
  format($f$insert into public.budget_lines (budget_id, category, planned_crc) values (%L, 'Staff salaries', 5000)$f$, pg_temp.id('b_month')),
  'a salary line', '%Salaries%');
select pg_temp.fails(
  format($f$insert into public.budget_lines (budget_id, category, planned_crc) values (%L, 'Sneaky', 5000)$f$, pg_temp.id('b_other')),
  'adding a line to another sector''s budget');
insert into public.budget_lines (id, budget_id, category, planned_crc, planned_usd)
values (pg_temp.id('line_m'), pg_temp.id('b_month'), 'Supplies', 100000, 200);
select pg_temp.fails(
  format($f$insert into public.budget_movements (budget_id, line_id, movement_date, amount, description, receipt_path)
    values (%L, %L, current_date, 500, 'Too early', 'x/y.pdf')$f$, pg_temp.id('b_month'), pg_temp.id('line_m')),
  'logging a movement before approval', '%approved%');
select pg_temp.fails(
  format($f$update public.budgets set status = 'approved' where id = %L$f$, pg_temp.id('b_month')),
  'a manager approving their own budget', '%status change%');
update public.budgets set status = 'pending' where id = pg_temp.id('b_other');
update public.budgets set status = 'pending' where id = pg_temp.id('b_month');
select pg_temp.fails(
  format($f$update public.budget_lines set planned_crc = 1 where id = %L$f$, pg_temp.id('line_m')),
  'editing a line once the budget is pending', '%draft%');
select pg_temp.fails(
  format($f$update public.budgets set name = 'Renamed' where id = %L$f$, pg_temp.id('b_month')),
  'renaming a pending budget', '%draft%');
reset role;

-- A budget with no lines can't be submitted.
select pg_temp.act_as(pg_temp.id('mgr_a'));
insert into _ids values ('b_empty', gen_random_uuid());
insert into public.budgets (id, division_id, name, type, period_month)
values (pg_temp.id('b_empty'), pg_temp.id('div_a'), 'Empty', 'monthly', date_trunc('month', current_date)::date);
select pg_temp.fails(
  format($f$update public.budgets set status = 'pending' where id = %L$f$, pg_temp.id('b_empty')),
  'submitting a budget with no lines', '%at least one line%');
delete from public.budgets where id = pg_temp.id('b_empty');
select pg_temp.expect((select count(*) from public.budgets where id = pg_temp.id('b_empty')) = 0,
  'a draft budget can be deleted');
reset role;

-- Approval --------------------------------------------------------------------------------

select pg_temp.act_as(pg_temp.id('fin_admin'));
select pg_temp.fails(
  format($f$update public.budgets set status = 'rejected' where id = %L$f$, pg_temp.id('b_month')),
  'rejecting without a comment', '%why%');
update public.budgets set status = 'approved', review_comment = 'Looks good'
where id = pg_temp.id('b_month');
reset role;
select pg_temp.expect(
  (select approved_by is not null and approved_at is not null and review_comment = 'Looks good'
   from public.budgets where id = pg_temp.id('b_month')),
  'approval records who, when and the comment');

-- Monthly: movements -------------------------------------------------------------------------

select pg_temp.act_as(pg_temp.id('mgr_a'));
select pg_temp.fails(
  format($f$insert into public.budget_movements (budget_id, line_id, movement_date, amount, description, receipt_path)
    values (%L, %L, current_date, 500, 'No receipt', '')$f$, pg_temp.id('b_month'), pg_temp.id('line_m')),
  'a movement without a receipt');
insert into public.budget_movements (id, budget_id, line_id, movement_date, amount, description, receipt_path)
values (pg_temp.id('mv'), pg_temp.id('b_month'), pg_temp.id('line_m'), current_date, 30000, 'Seeds',
  pg_temp.id('div_a')::text || '/' || pg_temp.id('b_month')::text || '/receipt/seeds.pdf');
insert into public.budget_movements (id, budget_id, line_id, movement_date, amount, currency, description, receipt_path)
values (pg_temp.id('mv_usd'), pg_temp.id('b_month'), pg_temp.id('line_m'), current_date, 10, 'USD', 'Tools',
  pg_temp.id('div_a')::text || '/' || pg_temp.id('b_month')::text || '/receipt/tools.pdf');
select pg_temp.expect(
  (select movements_crc from public.budget_line_totals where line_id = pg_temp.id('line_m'))
    = 30000 + 10 * (select usd_crc_rate from public.org_settings),
  'dollar movements are converted at the Settings rate');
update public.budget_movements set amount = 1 where id = pg_temp.id('mv');
select pg_temp.expect((select count(*) from public.budget_events where budget_id = pg_temp.id('b_month')) >= 4,
  'the sector can read its own history');
reset role;
select pg_temp.expect((select amount = 30000 from public.budget_movements where id = pg_temp.id('mv')),
  'a manager cannot edit a logged movement');
select pg_temp.expect((select status = 'draft' from public.budgets where id = pg_temp.id('b_other')),
  'a manager cannot submit another sector''s budget');

select pg_temp.expect(
  (select count(*) from public.budget_events
   where budget_id = pg_temp.id('b_month') and entity = 'budget'
     and to_status in ('draft', 'pending', 'approved') and actor_name is not null) >= 2,
  'status changes are logged with who made them');

select pg_temp.act_as(pg_temp.id('mgr_b'));
select pg_temp.expect((select count(*) from public.budget_movements) = 0, 'manager B cannot see sector A movements');
select pg_temp.expect((select count(*) from public.budget_lines) = 1, 'manager B sees only their own lines');
select pg_temp.expect((select count(*) from public.budget_line_totals where budget_id = pg_temp.id('b_month')) = 0,
  'manager B cannot see sector A totals');
select pg_temp.expect((select count(*) from public.budget_events where budget_id = pg_temp.id('b_month')) = 0,
  'manager B cannot see sector A history');
select pg_temp.fails(
  format($f$insert into public.budget_movements (budget_id, line_id, movement_date, amount, description, receipt_path)
    values (%L, %L, current_date, 500, 'Sneaky', 'x/y.pdf')$f$, pg_temp.id('b_month'), pg_temp.id('line_m')),
  'manager B logging against sector A');
select pg_temp.fails(
  $f$insert into public.budget_events (entity, entity_id, budget_id, division_id, to_status)
     select 'budget', id, id, division_id, 'approved' from public.budgets limit 1$f$,
  'writing the audit trail by hand');
reset role;

-- Project: providers, bank accounts, payment requests ------------------------------------------

select pg_temp.act_as(pg_temp.id('mgr_a'));
insert into public.budgets (id, division_id, name, type, start_date, end_date)
values (pg_temp.id('b_proj'), pg_temp.id('div_a'), 'A project', 'project', current_date, current_date + 60);
insert into public.budget_lines (id, budget_id, category, planned_crc)
values (pg_temp.id('line_p'), pg_temp.id('b_proj'), 'Build', 1000000);
update public.budgets set status = 'pending' where id = pg_temp.id('b_proj');
insert into public.providers (id, name) values (pg_temp.id('prov'), 'Constructora Pura Vida');
insert into public.provider_bank_accounts (id, provider_id, division_id, bank, account_holder, account_number)
values (pg_temp.id('acct_a'), pg_temp.id('prov'), pg_temp.id('div_a'), 'BAC', 'Pura Vida SA', 'CR05015202001026284066');
select pg_temp.fails(
  format($f$insert into public.provider_bank_accounts (provider_id, division_id, bank, account_holder, account_number)
    values (%L, %L, 'BAC', 'X', '1')$f$, pg_temp.id('prov'), pg_temp.id('div_b')),
  'adding a bank account in another sector''s name');
select pg_temp.fails(
  format($f$insert into public.payment_requests (budget_id, line_id, provider_id, provider_account_id, amount)
    values (%L, %L, %L, %L, 1000)$f$, pg_temp.id('b_proj'), pg_temp.id('line_p'), pg_temp.id('prov'), pg_temp.id('acct_a')),
  'requesting a payment before approval', '%approved%');
reset role;

select pg_temp.act_as(pg_temp.id('full_admin'));
update public.budgets set status = 'approved' where id = pg_temp.id('b_proj');
insert into public.provider_bank_accounts (id, provider_id, division_id, bank, account_holder, account_number)
values (pg_temp.id('acct_admin'), pg_temp.id('prov'), null, 'BCR', 'Admin only', '999');
reset role;

select pg_temp.act_as(pg_temp.id('mgr_a'));
select pg_temp.fails(
  format($f$insert into public.payment_requests (budget_id, line_id, provider_id, provider_account_id, amount)
    values (%L, %L, %L, %L, 1000)$f$, pg_temp.id('b_month'), pg_temp.id('line_m'), pg_temp.id('prov'), pg_temp.id('acct_a')),
  'a payment request on a Monthly budget', '%Project%');
select pg_temp.fails(
  format($f$insert into public.payment_requests (budget_id, line_id, provider_id, provider_account_id, amount)
    values (%L, %L, %L, %L, 1000)$f$, pg_temp.id('b_proj'), pg_temp.id('line_p'), pg_temp.id('prov'), pg_temp.id('acct_admin')),
  'using a bank account the sector can''t see');
insert into public.payment_requests (id, budget_id, line_id, provider_id, provider_account_id, amount, milestone, status, paid_by)
values (pg_temp.id('req'), pg_temp.id('b_proj'), pg_temp.id('line_p'), pg_temp.id('prov'), pg_temp.id('acct_a'),
  400000, 'Foundations', 'paid', null);
select pg_temp.expect((select status = 'requested' from public.payment_requests where id = pg_temp.id('req')),
  'a new request always starts as requested');
select pg_temp.expect((select requested_crc from public.budget_line_totals where line_id = pg_temp.id('line_p')) = 400000,
  'a request counts against its line');
select pg_temp.expect((select count(*) from public.provider_bank_accounts) = 1,
  'the sector sees only the bank account it can use');
update public.payment_requests set status = 'paid', payment_receipt_path = 'x' where id = pg_temp.id('req');
reset role;
select pg_temp.expect((select status = 'requested' and paid_at is null from public.payment_requests where id = pg_temp.id('req')),
  'a sector manager cannot mark a request paid');

select pg_temp.act_as(pg_temp.id('mgr_b'));
select pg_temp.expect((select count(*) from public.providers) = 1, 'the provider directory is shared');
select pg_temp.expect((select count(*) from public.provider_bank_accounts) = 0,
  'another sector cannot see bank accounts');
select pg_temp.expect((select count(*) from public.payment_requests) = 0, 'another sector cannot see requests');
select pg_temp.fails(
  format($f$insert into public.payment_requests (budget_id, line_id, provider_id, provider_account_id, amount)
    values (%L, %L, %L, %L, 1)$f$, pg_temp.id('b_proj'), pg_temp.id('line_p'), pg_temp.id('prov'), pg_temp.id('acct_a')),
  'another sector requesting against sector A');
reset role;

select pg_temp.act_as(pg_temp.id('fin_admin'));
select pg_temp.expect((select count(*) from public.provider_bank_accounts) = 2, 'a budget admin sees every bank account');
select pg_temp.fails(
  format($f$update public.payment_requests set status = 'paid' where id = %L$f$, pg_temp.id('req')),
  'marking paid without the payment receipt', '%receipt%');
update public.payment_requests
set status = 'paid', payment_receipt_path = pg_temp.id('div_a')::text || '/' || pg_temp.id('b_proj')::text || '/payment/r.pdf',
    amount = 1
where id = pg_temp.id('req');
reset role;
select pg_temp.expect(
  (select status = 'paid' and paid_by is not null and paid_at is not null and amount = 400000
   from public.payment_requests where id = pg_temp.id('req')),
  'paying records who and when, and the amount stays what was requested');
select pg_temp.expect(
  (select count(*) from public.budget_events
   where entity = 'payment_request' and entity_id = pg_temp.id('req')
     and to_status in ('requested', 'paid')) = 2,
  'requesting and paying are both in the history');

select pg_temp.act_as(pg_temp.id('fin_admin'));
select pg_temp.fails(
  format($f$update public.payment_requests set status = 'rejected' where id = %L$f$, pg_temp.id('req')),
  'changing a request that is already paid', '%already%');
reset role;

-- Closing -----------------------------------------------------------------------------------

select pg_temp.act_as(pg_temp.id('mgr_a'));
select pg_temp.fails(
  format($f$update public.budgets set status = 'closed' where id = %L$f$, pg_temp.id('b_month')),
  'a manager closing a budget');
reset role;
select pg_temp.act_as(pg_temp.id('fin_admin'));
update public.budgets set status = 'closed' where id = pg_temp.id('b_month');
reset role;
select pg_temp.act_as(pg_temp.id('mgr_a'));
select pg_temp.fails(
  format($f$insert into public.budget_movements (budget_id, line_id, movement_date, amount, description, receipt_path)
    values (%L, %L, current_date, 1, 'After close', 'x/y.pdf')$f$, pg_temp.id('b_month'), pg_temp.id('line_m')),
  'logging against a closed budget', '%approved%');
reset role;

-- Receipts: sector-scoped storage ---------------------------------------------------------------

select pg_temp.act_as(pg_temp.id('mgr_a'));
insert into storage.objects (bucket_id, name)
values ('budgets', pg_temp.id('div_a')::text || '/' || pg_temp.id('b_month')::text || '/receipt/ok.pdf');
select pg_temp.fails(
  format($f$insert into storage.objects (bucket_id, name) values ('budgets', %L)$f$,
    pg_temp.id('div_b')::text || '/' || pg_temp.id('b_other')::text || '/receipt/no.pdf'),
  'uploading into another sector''s folder');
select pg_temp.fails(
  $f$insert into storage.objects (bucket_id, name) values ('budgets', 'loose/file.pdf')$f$,
  'uploading outside a sector folder');
select pg_temp.expect((select count(*) from storage.objects where bucket_id = 'budgets') = 1,
  'a sector reads its own files');
reset role;
select pg_temp.act_as(pg_temp.id('mgr_b'));
select pg_temp.expect((select count(*) from storage.objects where bucket_id = 'budgets') = 0,
  'another sector cannot read those files');
reset role;
select pg_temp.act_as(pg_temp.id('fin_admin'));
select pg_temp.expect((select count(*) from storage.objects where bucket_id = 'budgets') = 1,
  'a budget admin reads every sector''s files');
reset role;

-- Feedback and roles ---------------------------------------------------------------------------------

select pg_temp.act_as(pg_temp.id('mgr_a'));
insert into public.finance_feedback (staff_id, staff_name, division_id, page, body)
values ((select id from public.team_members where email = 'mgr_a@theark.world'),
  'Manager A', pg_temp.id('div_a'), '/finance/budgets', 'Works well on my phone');
select pg_temp.expect((select count(*) from public.finance_feedback) = 0, 'a manager cannot read feedback');
select pg_temp.fails(
  format($f$insert into public.finance_feedback (staff_id, body) values (%L, 'As someone else')$f$,
    (select id from public.team_members where email = 'mgr_b@theark.world')),
  'leaving feedback as another person');
update public.team_members set finance_role = 'admin' where email = 'mgr_a@theark.world';
reset role;
select pg_temp.expect(
  (select finance_role = 'sector_manager' from public.team_members where email = 'mgr_a@theark.world'),
  'a manager cannot promote themselves');
select pg_temp.act_as(pg_temp.id('fin_admin'));
select pg_temp.expect((select count(*) from public.finance_feedback) = 1, 'a budget admin reads feedback');
reset role;

select 'All budget tests passed' as result;

rollback;
