-- Access-rule tests. Runs in one transaction and rolls back, so it is safe to
-- run against the live project:  bun run test:db
-- Any failed check raises an exception naming the rule that broke.

begin;

create temp table _ids (k text primary key, id uuid) on commit drop;
grant all on _ids to anon, authenticated;

create or replace function pg_temp.id(k text) returns uuid language sql as
  $$ select id from _ids where _ids.k = $1 $$;

-- Pretend to be a signed-in user (or anon when uid is null).
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
  if ok is not true then raise exception 'RLS test failed: %', what; end if;
end $$;

-- Fixtures ---------------------------------------------------------------------

insert into _ids
select r, gen_random_uuid()
from unnest(array[
  'admin', 'lead', 'sales', 'facilitator', 'security', 'shop', 'crew',
  'member', 'outsider', 'division', 'other_division'
]) r;

insert into public.divisions (id, name) values
  (pg_temp.id('division'), 'Test division'),
  (pg_temp.id('other_division'), 'Other division');

insert into auth.users (id, email, aud, role, instance_id)
select id, k || '@theark.world', 'authenticated', 'authenticated',
  '00000000-0000-0000-0000-000000000000'
from _ids
where k in ('admin', 'lead', 'sales', 'facilitator', 'security', 'shop',
  'crew', 'outsider');

insert into public.team_members (email, name, role, division_id)
select k || '@theark.world', 'Test ' || k, k, pg_temp.id('division')
from _ids
where k in ('admin', 'lead', 'sales', 'facilitator', 'security', 'shop', 'crew');

-- Team members inserted after their auth user still get linked.
select pg_temp.expect(
  (select count(*) from public.team_members
   where email like '%@theark.world' and user_id is not null
     and name like 'Test %') = 7,
  'team members link to existing auth users by email');

insert into public.contacts (id, name, email, tier) values
  (gen_random_uuid(), 'Owned by sales', 'owned@example.com', null),
  (gen_random_uuid(), 'Someone else', 'else@example.com', null),
  (gen_random_uuid(), 'Test member', 'member@example.com', 'founding');
update public.contacts set owner_id = (
  select id from public.team_members where email = 'sales@theark.world'
) where email = 'owned@example.com';

-- A member signs up by magic link after their contact exists.
insert into auth.users (id, email, aud, role, instance_id)
values (pg_temp.id('member'), 'member@example.com', 'authenticated',
  'authenticated', '00000000-0000-0000-0000-000000000000');

insert into public.offerings (id, kind, title, start_date, access, status,
  facilitator_id, capacity)
values
  (gen_random_uuid(), 'event', 'Open event', public.org_today() + 3,
    'everyone', 'published', null, 1),
  (gen_random_uuid(), 'class', 'Members class', public.org_today() + 3,
    'members', 'published',
    (select id from public.team_members where email = 'facilitator@theark.world'),
    null),
  (gen_random_uuid(), 'event', 'Draft event', public.org_today() + 3,
    'everyone', 'draft', null, null);

insert into public.finance_months (month, membership) values
  (date_trunc('month', current_date)::date, 1000);

insert into public.tasks (title, division_id, assignee_id) values
  ('In my division', pg_temp.id('division'), null),
  ('Other division', pg_temp.id('other_division'), null),
  ('Assigned to crew', pg_temp.id('other_division'),
    (select id from public.team_members where email = 'crew@theark.world'));

insert into public.products (name, price, stock) values ('Eggs', 3000, 10);

-- Sign-in hook -----------------------------------------------------------------

create or replace function pg_temp.hook(provider text, email text,
  hd text default null) returns jsonb language sql as $$
  select public.hook_before_user_created(jsonb_build_object(
    'user', jsonb_build_object(
      'email', email,
      'app_metadata', jsonb_build_object('provider', provider),
      'user_metadata', case when hd is null then '{}'::jsonb
        else jsonb_build_object('custom_claims', jsonb_build_object('hd', hd))
      end)));
$$;

select pg_temp.expect(pg_temp.hook('google', 'admin@theark.world') = '{}',
  'hook allows a team member with a theark.world Google account');
select pg_temp.expect(
  pg_temp.hook('google', 'admin@theark.world', 'theark.world') = '{}',
  'hook allows matching hd claim');
select pg_temp.expect(pg_temp.hook('google', 'someone@gmail.com') ? 'error',
  'hook rejects non-theark.world Google accounts');
select pg_temp.expect(
  pg_temp.hook('google', 'admin@theark.world.evil.com') ? 'error',
  'hook rejects look-alike domains');
select pg_temp.expect(
  pg_temp.hook('google', 'admin@theark.world', 'evil.com') ? 'error',
  'hook rejects a mismatched Workspace domain');
select pg_temp.expect(
  pg_temp.hook('google', 'not-on-team@theark.world') ? 'error',
  'hook rejects theark.world accounts not added to Team');
select pg_temp.expect(pg_temp.hook('email', 'member@example.com') = '{}',
  'hook allows active members by magic link');
select pg_temp.expect(pg_temp.hook('email', 'owned@example.com') ? 'error',
  'hook rejects contacts without a membership');
select pg_temp.expect(pg_temp.hook('email', 'admin@theark.world') ? 'error',
  'hook rejects staff using magic link');
select pg_temp.expect(pg_temp.hook('github', 'admin@theark.world') ? 'error',
  'hook rejects other providers');

-- Finance: admin only ----------------------------------------------------------

select pg_temp.act_as(pg_temp.id('admin'));
select pg_temp.expect((select count(*) from public.finance_months) = 1,
  'admin reads finance');
reset role;

do $$
declare r text;
begin
  foreach r in array array['lead', 'sales', 'facilitator', 'security', 'shop',
    'crew', 'member', 'outsider'] loop
    perform pg_temp.act_as(pg_temp.id(r));
    perform pg_temp.expect(
      (select count(*) from public.finance_months) = 0,
      r || ' cannot read finance');
    begin
      perform public.ticket_sales_for_month(current_date);
      raise exception 'RLS test failed: % can call ticket_sales_for_month', r;
    exception when insufficient_privilege then null;
    end;
    reset role;
  end loop;
end $$;

select pg_temp.act_as(null);
select pg_temp.expect((select count(*) from public.finance_months) = 0,
  'anon cannot read finance');
reset role;

-- Outsiders (signed in, not on the team) see nothing -----------------------------

select pg_temp.act_as(pg_temp.id('outsider'));
select pg_temp.expect((select count(*) from public.team_members) = 0,
  'outsider cannot read team');
select pg_temp.expect((select count(*) from public.contacts) = 0,
  'outsider cannot read contacts');
select pg_temp.expect((select count(*) from public.tasks) = 0,
  'outsider cannot read tasks');
reset role;

-- CRM ------------------------------------------------------------------------------

select pg_temp.act_as(pg_temp.id('sales'));
select pg_temp.expect(
  (select array_agg(name) from public.contacts) = array['Owned by sales'],
  'sales sees only contacts they own');
reset role;

select pg_temp.act_as(pg_temp.id('lead'));
select pg_temp.expect((select count(*) from public.contacts) >= 3,
  'lead reads all contacts');
update public.contacts set name = 'Changed' where email = 'else@example.com';
select pg_temp.expect(
  not exists (select 1 from public.contacts where name = 'Changed'),
  'lead cannot edit contacts');
reset role;

do $$
declare r text;
begin
  foreach r in array array['facilitator', 'security', 'shop', 'crew', 'member']
  loop
    perform pg_temp.act_as(pg_temp.id(r));
    perform pg_temp.expect((select count(*) from public.contacts) = 0,
      r || ' cannot read contacts');
    reset role;
  end loop;
end $$;

-- Members portal -----------------------------------------------------------------

select pg_temp.act_as(pg_temp.id('member'));
select pg_temp.expect(
  (select array_agg(title order by title) from public.offerings)
    = array['Members class', 'Open event'],
  'member sees published offerings, not drafts');
select pg_temp.expect(
  (select array_agg(name) from public.member_directory()) = array['Test member'],
  'member directory lists active members');
select pg_temp.expect((select count(*) from public.team_members) = 0,
  'member cannot read team records');
reset role;

select pg_temp.act_as(null);
select pg_temp.expect(
  (select array_agg(title) from public.offerings) = array['Open event'],
  'anon sees only published open events');
reset role;

-- Booking --------------------------------------------------------------------------

select pg_temp.act_as(null);
do $$
begin
  perform public.book_session(
    (select id from public.offerings where title = 'Members class'),
    public.org_today() + 3, 'Guest', 'guest@example.com');
  raise exception 'RLS test failed: anon booked a members class';
exception when raise_exception then
  if sqlerrm like 'RLS test failed%' then raise; end if;
end $$;
select pg_temp.expect((select count(*) from public.book_session(
  (select id from public.offerings where title = 'Open event'),
  public.org_today() + 3, 'Guest', 'guest@example.com')) = 1,
  'anon books an open event');
do $$
begin
  perform public.book_session(
    (select id from public.offerings where title = 'Open event'),
    public.org_today() + 3, 'Second', 'second@example.com');
  raise exception 'RLS test failed: booked past capacity';
exception when raise_exception then
  if sqlerrm like 'RLS test failed%' then raise; end if;
end $$;
select pg_temp.expect((select count(*) from public.registrations) = 0,
  'anon cannot read registrations');
reset role;

select pg_temp.act_as(pg_temp.id('member'));
select pg_temp.expect((select count(*) from public.book_session(
  (select id from public.offerings where title = 'Members class'),
  public.org_today() + 3, null, null)) = 1,
  'member books a members class');
select pg_temp.expect(
  (select count(*) from public.registrations) = 1,
  'member sees only their own booking');
reset role;

-- Check-in ---------------------------------------------------------------------------

update public.offerings set start_date = public.org_today()
where title = 'Open event';
update public.registrations set session_date = public.org_today()
where email = 'guest@example.com';

select pg_temp.act_as(pg_temp.id('security'));
select pg_temp.expect((select count(*) from public.registrations) = 1,
  'security reads only today''s bookings');
select pg_temp.expect(public.check_in(
  (select qr_token from public.registrations where email = 'guest@example.com')
) is not null, 'security checks in a valid ticket');
update public.registrations set paid = true;
reset role;
select pg_temp.expect(
  not exists (select 1 from public.registrations where paid),
  'security cannot edit bookings directly');

select set_config('test.token', (select qr_token from public.registrations
  where email = 'guest@example.com'), true);
select pg_temp.act_as(pg_temp.id('crew'));
do $$
begin
  perform public.check_in(current_setting('test.token'));
  raise exception 'RLS test failed: crew checked someone in';
exception when insufficient_privilege then null;
end $$;
reset role;

select pg_temp.act_as(null);
select pg_temp.expect((select state from public.ticket_by_token(
  current_setting('test.token'))) = 'used',
  'ticket shows used after check-in');
reset role;

-- Operations ---------------------------------------------------------------------------

select pg_temp.act_as(pg_temp.id('lead'));
select pg_temp.expect(
  (select array_agg(title) from public.tasks) = array['In my division'],
  'lead sees their division''s tasks');
reset role;

select pg_temp.act_as(pg_temp.id('crew'));
select pg_temp.expect(
  (select array_agg(title) from public.tasks) = array['Assigned to crew'],
  'crew sees only their own tasks');
reset role;

-- Farm shop ------------------------------------------------------------------------------

select pg_temp.act_as(pg_temp.id('shop'));
insert into public.stock_movements (product_id, type, delta, by_id)
values ((select id from public.products where name = 'Eggs'), 'sale', -3,
  public.current_staff_id());
select pg_temp.expect(
  (select stock from public.products where name = 'Eggs') = 7,
  'shop records a sale and stock follows');
reset role;

select pg_temp.act_as(pg_temp.id('sales'));
select pg_temp.expect((select count(*) from public.products) = 0,
  'sales cannot read the shop');
reset role;

select 'All RLS tests passed' as result;

rollback;
