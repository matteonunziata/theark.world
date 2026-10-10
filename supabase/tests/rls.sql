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
  'marketing', 'member', 'outsider', 'division', 'other_division'
]) r;

insert into public.divisions (id, name) values
  (pg_temp.id('division'), 'Test division'),
  (pg_temp.id('other_division'), 'Other division');

insert into auth.users (id, email, aud, role, instance_id)
select id, k || '@theark.world', 'authenticated', 'authenticated',
  '00000000-0000-0000-0000-000000000000'
from _ids
where k in ('admin', 'lead', 'sales', 'facilitator', 'security', 'shop',
  'crew', 'marketing', 'outsider');

insert into public.team_members (email, name, role, division_id)
select k || '@theark.world', 'Test ' || k, k, pg_temp.id('division')
from _ids
where k in ('admin', 'lead', 'sales', 'facilitator', 'security', 'shop', 'crew', 'marketing');

-- Team members inserted after their auth user still get linked.
select pg_temp.expect(
  (select count(*) from public.team_members
   where email like '%@theark.world' and user_id is not null
     and name like 'Test %') = 8,
  'team members link to existing auth users by email');

insert into public.contacts (id, name, email, tier) values
  (gen_random_uuid(), 'Owned by sales', 'owned@example.com', null),
  (gen_random_uuid(), 'Someone else', 'else@example.com', null),
  (gen_random_uuid(), 'Test member', 'member@example.com', 'standard');
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
  (date_trunc('month', current_date)::date, 1000)
on conflict (month) do nothing;

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
select pg_temp.expect(pg_temp.hook('email', 'admin@theark.world') = '{}',
  'hook allows team members by email link');
select pg_temp.expect(pg_temp.hook('email', 'not-on-team@theark.world') ? 'error',
  'hook rejects email links for theark.world addresses not on the team');
select pg_temp.expect(pg_temp.hook('github', 'admin@theark.world') ? 'error',
  'hook rejects other providers');

-- Finance: admin only ----------------------------------------------------------

select pg_temp.act_as(pg_temp.id('admin'));
select pg_temp.expect((select count(*) from public.finance_months) >= 1,
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
  (select array_agg(title order by title) from public.offerings
   where title in ('Members class', 'Open event', 'Draft event'))
    = array['Members class', 'Open event'],
  'member sees published offerings, not drafts');
select pg_temp.expect(
  'Test member' = any (select name from public.member_directory())
  and 'Owned by sales' <> all (select name from public.member_directory()),
  'member directory lists active members only');
select pg_temp.expect((select count(*) from public.team_members) = 0,
  'member cannot read team records');
reset role;

select pg_temp.act_as(null);
select pg_temp.expect(
  (select array_agg(title) from public.offerings
   where title in ('Members class', 'Open event', 'Draft event'))
    = array['Open event'],
  'anon sees only published open events');
select pg_temp.expect(
  not exists (select 1 from public.offerings where kind = 'class'),
  'anon sees no classes');
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

-- Event setup: schedule, gallery, booking cut-off ---------------------------------------

insert into public.event_schedule_items (offering_id, day, start_time, title)
select id, public.org_today() + 3, '10:00', 'Opening' from public.offerings where title = 'Open event';
insert into public.event_images (offering_id, path)
select id, 'test.jpg' from public.offerings where title = 'Open event';

select pg_temp.act_as(null);
select pg_temp.expect((select count(*) from public.event_schedule_items) = 1, 'anon sees the schedule of a published event');
select pg_temp.expect((select count(*) from public.event_images) = 1, 'anon sees the gallery of a published event');
do $$ begin
  begin
    insert into public.event_schedule_items (offering_id, day, start_time, title)
    select id, public.org_today(), '09:00', 'Sneaky' from public.offerings where title = 'Open event';
    raise exception 'RLS test failed: anon added a schedule item';
  exception when insufficient_privilege or check_violation then null; end;
end $$;
reset role;

update public.offerings set booking_closes_at = public.org_now() - interval '1 hour' where title = 'Open event';
do $$ begin
  begin
    insert into public.registrations (offering_id, session_date, name, email, source)
    select id, public.org_today() + 5, 'Late', 'late@example.com', 'public' from public.offerings where title = 'Open event';
    raise exception 'RLS test failed: booked online after the cut-off';
  exception when raise_exception then
    if sqlerrm like 'RLS test failed%' then raise; end if;
    if sqlerrm <> 'Registration closed.' then raise; end if;
  end;
end $$;
insert into public.registrations (offering_id, session_date, name, email, source)
select id, public.org_today() + 5, 'Staff add', 'staffadd@example.com', 'staff' from public.offerings where title = 'Open event';
delete from public.registrations where email = 'staffadd@example.com';
update public.offerings set booking_closes_at = null where title = 'Open event';
delete from public.event_schedule_items; delete from public.event_images;

-- Tickets: sales windows, release order, add-ons, seats --------------------------------------

insert into public.offerings (kind, title, start_date, status, access, repeat, capacity)
values ('event', 'Ticket logic', public.org_today() + 3, 'published', 'everyone', 'none', 5);
insert into public.ticket_types (offering_id, name, price, qty, kind, position)
select id, 'Early Bird', 10000, 2, 'main', 0 from public.offerings where title = 'Ticket logic';
insert into public.ticket_types (offering_id, name, price, kind, position, unlocks_after_ticket_id)
select o.id, 'General', 15000, 'main', 1, t.id
from public.offerings o join public.ticket_types t on t.offering_id = o.id and t.name = 'Early Bird'
where o.title = 'Ticket logic';
insert into public.ticket_types (offering_id, name, price, kind, position, max_per_order)
select id, 'Lunch', 5000, 'addon', 2, 3 from public.offerings where title = 'Ticket logic';
insert into public.ticket_types (offering_id, name, price, kind, position, sales_start)
select id, 'Later', 1, 'main', 3, public.org_now() + interval '1 day' from public.offerings where title = 'Ticket logic';

create or replace function pg_temp.try_book(who text, items jsonb) returns text
language plpgsql as $$
begin
  perform public.book_tickets(
    (select id from public.offerings where title = 'Ticket logic'),
    public.org_today() + 3, who, who || '@example.com', null, items);
  return 'ok';
exception when raise_exception then return sqlerrm;
end $$;
create or replace function pg_temp.item(nm text, q int) returns jsonb
language sql as $$
  select jsonb_build_object('ticket_type_id', (select id from public.ticket_types where name = nm
    and offering_id = (select id from public.offerings where title = 'Ticket logic')), 'qty', q) $$;

select pg_temp.act_as(null);
select pg_temp.expect(pg_temp.try_book('a1', jsonb_build_array(pg_temp.item('General', 1))) = 'General isn''t available yet.',
  'a ticket that opens when another sells out stays shut');
select pg_temp.expect(pg_temp.try_book('a2', jsonb_build_array(pg_temp.item('Lunch', 1))) like 'Choose a main ticket first%',
  'an add-on cannot be booked alone');
select pg_temp.expect(pg_temp.try_book('a3', jsonb_build_array(pg_temp.item('Later', 1))) = 'Later isn''t on sale yet.',
  'a ticket before its sales start cannot be booked');
select pg_temp.expect(pg_temp.try_book('a4', jsonb_build_array(pg_temp.item('Lunch', 4), pg_temp.item('Early Bird', 1))) like 'You can book up to 3%',
  'the per-order limit holds');
select pg_temp.expect(pg_temp.try_book('b1', jsonb_build_array(pg_temp.item('Early Bird', 2), pg_temp.item('Lunch', 2))) = 'ok',
  'two main tickets and an add-on book together');
select pg_temp.expect(pg_temp.try_book('b2', jsonb_build_array(pg_temp.item('Early Bird', 1))) = 'Early Bird just sold out.',
  'a sold-out ticket cannot be booked');
select pg_temp.expect(pg_temp.try_book('b3', jsonb_build_array(pg_temp.item('General', 3))) = 'ok',
  'the next ticket opens once the first sells out');
select pg_temp.expect(pg_temp.try_book('b4', jsonb_build_array(pg_temp.item('General', 1))) = 'Sorry, this session just filled up.',
  'seats, not bookings, count against capacity');
reset role;
select pg_temp.expect((select sum(taken) from public.session_counts(
  (select id from public.offerings where title = 'Ticket logic'), public.org_today(), public.org_today() + 5)) = 5,
  'add-ons take no seat in the counts');
delete from public.offerings where title = 'Ticket logic';

-- Registrations: add by hand, edit, cancel ---------------------------------------------------

insert into public.offerings (kind, title, start_date, status, access, repeat, capacity)
values ('event', 'Registration admin', public.org_today() + 3, 'published', 'everyone', 'none', 3);
insert into public.ticket_types (offering_id, name, price, kind, position)
select id, 'GA', 10000, 'main', 0 from public.offerings where title = 'Registration admin';

select pg_temp.act_as(pg_temp.id('outsider'));
do $$
begin
  begin
    perform public.staff_save_registration(
      (select id from public.offerings where title = 'Registration admin'), null,
      public.org_today() + 3, 'Eve', null, null, '[]'::jsonb, false);
    raise exception 'RLS test failed: someone outside the team added a booking';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select pg_temp.act_as(pg_temp.id('admin'));
create temp table _reg (id uuid, token text) on commit drop;
grant all on _reg to authenticated;
insert into _reg
select s.registration_id, s.qr_token from public.staff_save_registration(
  (select id from public.offerings where title = 'Registration admin'), null,
  public.org_today() + 3, 'Ana', 'ana@example.com', '+506 8888 0000',
  jsonb_build_array(jsonb_build_object('ticket_type_id',
    (select id from public.ticket_types where name = 'GA' and offering_id = (select id from public.offerings where title = 'Registration admin')), 'qty', 2)),
  true) s;
select pg_temp.expect((select seats from public.registrations where id = (select id from _reg)) = 2,
  'staff add books the seats');
do $$
begin
  begin
    perform public.staff_save_registration(
      (select id from public.offerings where title = 'Registration admin'), null,
      public.org_today() + 3, 'Bo', null, null,
      jsonb_build_array(jsonb_build_object('ticket_type_id',
        (select id from public.ticket_types where name = 'GA' and offering_id = (select id from public.offerings where title = 'Registration admin')), 'qty', 2)),
      false);
    raise exception 'RLS test failed: staff add went past capacity without an override';
  exception when raise_exception then
    if sqlerrm like 'RLS test failed%' then raise; end if;
  end;
end $$;
select public.staff_set_registration_cancelled((select id from _reg), true);
select pg_temp.expect((select status from public.registrations where id = (select id from _reg)) = 'cancelled',
  'staff can cancel a booking');
select pg_temp.expect(not public.registration_live((select r from public.registrations r where r.id = (select id from _reg))),
  'a cancelled booking is not live');
select pg_temp.expect((select coalesce(sum(taken), 0) from public.session_counts(
  (select id from public.offerings where title = 'Registration admin'), public.org_today(), public.org_today() + 5)) = 0,
  'a cancelled booking frees its seats');
do $$
begin
  begin
    perform public.check_in((select token from _reg));
    raise exception 'RLS test failed: a cancelled ticket was checked in';
  exception when raise_exception then
    if sqlerrm like 'RLS test failed%' then raise; end if;
  end;
end $$;
select public.staff_set_registration_cancelled((select id from _reg), false);
select pg_temp.expect((select status from public.registrations where id = (select id from _reg)) = 'confirmed',
  'staff can restore a cancelled booking');
reset role;
delete from public.offerings where title = 'Registration admin';

-- Check-in ---------------------------------------------------------------------------

update public.offerings set start_date = public.org_today()
where title = 'Open event';
update public.registrations set session_date = public.org_today()
where email = 'guest@example.com';

select pg_temp.act_as(pg_temp.id('security'));
select pg_temp.expect(
  not exists (select 1 from public.registrations
              where session_date <> public.org_today()),
  'security reads only today''s bookings');
select pg_temp.expect(public.check_in(
  (select qr_token from public.registrations where email = 'guest@example.com')
) is not null, 'security checks in a valid ticket');
update public.registrations set paid = true;
reset role;
select pg_temp.expect(
  not exists (select 1 from public.registrations
              where paid and email = 'guest@example.com'),
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

-- Facilitator roster and member photos ----------------------------------------------

select pg_temp.act_as(pg_temp.id('facilitator'));
select pg_temp.expect((select count(*) from public.session_roster(
  (select id from public.offerings where title = 'Members class'),
  public.org_today() + 3)) = 1, 'facilitators see who booked their class');
select pg_temp.expect((select count(*) from public.session_roster(
  (select id from public.offerings where title = 'Open event'),
  public.org_today())) = 0, 'facilitators do not see other sessions'' rosters');
reset role;
select pg_temp.act_as(pg_temp.id('shop'));
select pg_temp.expect((select count(*) from public.session_roster(
  (select id from public.offerings where title = 'Members class'),
  public.org_today() + 3)) = 0, 'shop staff do not see class rosters');
reset role;

select pg_temp.act_as(pg_temp.id('member'));
select public.set_my_photo(pg_temp.id('member')::text || '/me.jpg');
select pg_temp.expect(public.my_photo() = pg_temp.id('member')::text || '/me.jpg',
  'members set their own photo');
do $$
begin
  perform public.set_my_photo(gen_random_uuid()::text || '/me.jpg');
  raise exception 'RLS test failed: member used someone else''s photo path';
exception when raise_exception then
  if sqlerrm like 'RLS test failed%' then raise; end if;
end $$;
reset role;
select pg_temp.expect(public.hook_before_user_created(
  '{"user":{"email":"nobody.facilitates@example.com","app_metadata":{"provider":"email"}}}') ? 'error',
  'email sign-in still needs a facilitator record or a membership');

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
select pg_temp.expect(
  (public.shop_report(current_date - 1, current_date + 1)->'totals'->>'orders')::int = 1
  and (public.shop_report(current_date - 1, current_date + 1)->'totals'->>'revenue')::numeric = 9000,
  'shop sees the sales report at the product price');
reset role;

select pg_temp.act_as(pg_temp.id('sales'));
select pg_temp.expect(
  (public.shop_report(current_date - 1, current_date + 1)->'totals'->>'orders')::int = 0,
  'sales cannot see the sales report');
reset role;

select pg_temp.act_as(pg_temp.id('sales'));
select pg_temp.expect((select count(*) from public.products) = 0,
  'sales cannot read the shop');
reset role;

-- Sales can work contacts in pipelines they're assigned to.
insert into public.pipeline_assignments (team_member_id, pipeline)
select id, 'memberships' from public.team_members where email = 'sales@theark.world';
insert into public.contact_stages (contact_id, pipeline, stage)
select id, 'memberships', 'waitlist' from public.contacts where email = 'else@example.com';
select pg_temp.act_as(pg_temp.id('sales'));
update public.contacts set location = 'Edited by sales' where email = 'else@example.com';
reset role;
select pg_temp.expect(
  exists (select 1 from public.contacts
          where email = 'else@example.com' and location = 'Edited by sales'),
  'sales edits contacts in an assigned pipeline');

-- Feed and messages ------------------------------------------------------------
insert into _ids values ('member2', gen_random_uuid());
insert into public.contacts (name, email, tier) values
  ('Second member', 'member2@example.com', 'standard'),
  ('Closed member', 'closed@example.com', 'standard');
update public.contacts set open_to_connect = false where email = 'closed@example.com';
insert into auth.users (id, email, aud, role, instance_id)
values (pg_temp.id('member2'), 'member2@example.com', 'authenticated',
  'authenticated', '00000000-0000-0000-0000-000000000000');

select pg_temp.act_as(pg_temp.id('member'));
insert into public.posts (author_contact_id, body)
values (public.current_member_contact_id(), 'Hello from member one');
do $$
begin
  insert into public.posts (author_contact_id, body)
  values ((select id from public.member_directory() where name = 'Second member'), 'Impersonation');
  raise exception 'RLS test failed: member posted as someone else';
exception when insufficient_privilege then null;
end $$;
insert into public.messages (sender_id, recipient_id, body)
values (public.current_member_contact_id(),
  (select id from public.member_directory() where name = 'Second member'), 'Hi two');
select pg_temp.expect(
  not public.can_message((select id from public.member_directory() where name = 'Closed member')),
  'members cannot message people closed to it');
reset role;

select pg_temp.act_as(pg_temp.id('member2'));
select pg_temp.expect((select count(*) from public.messages) = 1,
  'recipient reads the message');
select pg_temp.expect(
  exists (select 1 from public.feed() where body = 'Hello from member one'),
  'members read the feed');
reset role;

select pg_temp.act_as(pg_temp.id('outsider'));
select pg_temp.expect((select count(*) from public.posts) = 0, 'outsider cannot read posts');
select pg_temp.expect((select count(*) from public.feed()) = 0, 'outsider gets an empty feed');
select pg_temp.expect((select count(*) from public.messages) = 0, 'outsider cannot read messages');
reset role;

select pg_temp.act_as(pg_temp.id('admin'));
select pg_temp.expect((select count(*) from public.messages) = 0,
  'staff cannot read members'' private messages');
reset role;

-- Finance ledger: admins only ------------------------------------------------------

select pg_temp.act_as(pg_temp.id('admin'));
insert into public.finance_entries (kind, amount, description)
values ('expense', 1000, 'Test expense');
select pg_temp.expect((select count(*) from public.finance_entries where description = 'Test expense') = 1,
  'admins add and read ledger entries');
select pg_temp.expect((select count(*) from public.business_lines) > 0, 'admins read business lines');
reset role;

select pg_temp.act_as(pg_temp.id('lead'));
select pg_temp.expect((select count(*) from public.finance_entries) = 0, 'leads cannot read the ledger');
select pg_temp.expect((select count(*) from public.business_lines) = 0, 'leads cannot read business lines');
reset role;

-- Arkadia: admins and the school division only; families via the private link --

insert into _ids values ('school', gen_random_uuid()), ('teacher', gen_random_uuid()), ('student', gen_random_uuid());
insert into public.divisions (id, name, is_school) values (pg_temp.id('school'), 'Test school', true);
insert into auth.users (id, email, aud, role, instance_id)
values (pg_temp.id('teacher'), 'teacher@theark.world', 'authenticated', 'authenticated',
  '00000000-0000-0000-0000-000000000000');
insert into public.team_members (email, name, role, division_id)
values ('teacher@theark.world', 'Test teacher', 'facilitator', pg_temp.id('school'));
insert into public.students (id, name, about, staff_notes, share_token)
values (pg_temp.id('student'), 'Test student', 'Loves frogs', 'Peanut allergy', repeat('a', 64));

select pg_temp.act_as(pg_temp.id('teacher'));
select pg_temp.expect(public.is_school_staff(), 'school division staff are school staff');
select pg_temp.expect((select count(*) from public.students where name = 'Test student') = 1,
  'teachers read students');
insert into public.student_updates (student_id, author_id, body, shared)
values (pg_temp.id('student'), public.current_staff_id(), 'Shared update', true),
       (pg_temp.id('student'), public.current_staff_id(), 'Staff-only update', false);
reset role;

select pg_temp.act_as(pg_temp.id('facilitator'));
select pg_temp.expect(not public.is_school_staff(), 'facilitators outside the school are not school staff');
select pg_temp.expect((select count(*) from public.students) = 0, 'other staff cannot read students');
select pg_temp.expect((select count(*) from public.student_updates) = 0, 'other staff cannot read updates');
reset role;

select pg_temp.act_as(null);
select pg_temp.expect((select count(*) from public.students) = 0, 'anon cannot read students');
select pg_temp.expect(
  (public.student_page(repeat('a', 64)) ->> 'about') = 'Loves frogs',
  'families read the profile through the link');
select pg_temp.expect(
  json_array_length(public.student_page(repeat('a', 64)) -> 'updates') = 1,
  'families see only shared updates');
select pg_temp.expect(
  public.student_page(repeat('a', 64))::text not like '%Peanut%',
  'staff notes never reach the family page');
select pg_temp.expect(public.student_page(repeat('b', 64)) is null, 'a wrong link shows nothing');
select pg_temp.expect(public.student_page('a') is null, 'short tokens are rejected');
reset role;

-- Arkadia timetable: school staff edit it; families see it on the family page --

select pg_temp.act_as(pg_temp.id('teacher'));
insert into public.school_schedule (title, weekday, start_time, end_time, notes)
values ('Test circle', 1, '08:00', '08:30', 'Bring a hat');
reset role;

select pg_temp.act_as(pg_temp.id('facilitator'));
select pg_temp.expect((select count(*) from public.school_schedule) = 0, 'other staff cannot read the timetable');
reset role;

select pg_temp.act_as(null);
select pg_temp.expect(
  public.student_page(repeat('a', 64))::text like '%Test circle%',
  'families see whole-school timetable entries');
reset role;

-- Real estate and hospitality: admin, lead and sales only ---------------------------

select pg_temp.act_as(pg_temp.id('sales'));
insert into public.lots (id, code, status, in_hospitality, min_nights)
values (gen_random_uuid(), 'TEST-1', 'available', true, 1);
insert into public.lot_household (lot_id, name)
select id, 'Test resident' from public.lots where code = 'TEST-1';
insert into public.stays (lot_id, guest_name, check_in, check_out)
select id, 'Test guest', public.org_today() + 30, public.org_today() + 33 from public.lots where code = 'TEST-1';
select pg_temp.expect((select count(*) from public.lots where code = 'TEST-1') = 1, 'sales manage lots');
reset role;

do $$
begin
  insert into public.stays (lot_id, guest_name, check_in, check_out)
  select id, 'Clash', public.org_today() + 31, public.org_today() + 32 from public.lots where code = 'TEST-1';
  raise exception 'RLS test failed: overlapping confirmed stays were allowed';
exception when exclusion_violation then null;
end $$;
insert into public.stays (lot_id, guest_name, check_in, check_out)
select id, 'Back to back', public.org_today() + 33, public.org_today() + 35 from public.lots where code = 'TEST-1';
insert into public.stays (lot_id, guest_name, status, check_in, check_out)
select id, 'Overlapping inquiry', 'inquiry', public.org_today() + 31, public.org_today() + 32 from public.lots where code = 'TEST-1';

select pg_temp.act_as(pg_temp.id('crew'));
select pg_temp.expect((select count(*) from public.lots) = 0, 'crew cannot read lots');
select pg_temp.expect((select count(*) from public.stays) = 0, 'crew cannot read stays');
reset role;

select pg_temp.act_as(pg_temp.id('member'));
select pg_temp.expect((select count(*) from public.lots) = 0, 'members cannot read lots');
select pg_temp.expect((select count(*) from public.lot_household) = 0, 'members cannot read households');
reset role;

select pg_temp.act_as(null);
select pg_temp.expect((select count(*) from public.stays) = 0, 'anon cannot read stays');
reset role;

-- Member passes: anyone with the link sees the state; only gate staff log entries --

select set_config('test.pass', (select pass_token from public.contacts
  where email = 'member@example.com'), true);
select pg_temp.act_as(null);
select pg_temp.expect(
  (select state from public.pass_by_token(current_setting('test.pass'))) = 'valid',
  'an active member''s pass is valid');
select pg_temp.expect(
  not (select can_log from public.pass_by_token(current_setting('test.pass'))),
  'anon cannot log entries');
select pg_temp.expect(
  (select count(*) from public.pass_by_token('short')) = 0, 'short pass tokens are rejected');
reset role;

select pg_temp.act_as(pg_temp.id('member'));
select pg_temp.expect(
  public.my_pass_token() = current_setting('test.pass'),
  'members get their own pass');
do $$
begin
  perform public.gate_check_in(current_setting('test.pass'));
  raise exception 'RLS test failed: a member checked themselves in at the gate';
exception when insufficient_privilege then null;
end $$;
reset role;

select pg_temp.act_as(pg_temp.id('security'));
select pg_temp.expect(
  (select ok from public.gate_check_in(current_setting('test.pass'))),
  'security checks a member in');
select pg_temp.expect(
  (select state from public.gate_check_in(current_setting('test.pass'))) = 'checked_in'
  and not (select ok from public.gate_check_in(current_setting('test.pass'))),
  'a second check-in the same day is refused');
select pg_temp.expect(
  (select state from public.pass_by_token(current_setting('test.pass'))) = 'checked_in',
  'the pass reads checked in for the rest of the day');
-- Security can't read contacts, so the person comes from the pass itself.
select pg_temp.expect(
  (select count(*) from public.gate_entries e
   where e.contact_id = (select contact_id from public.pass_by_token(current_setting('test.pass')))
     and e.result = 'admitted') = 1
  and (select count(*) from public.gate_entries e
   where e.contact_id = (select contact_id from public.pass_by_token(current_setting('test.pass')))
     and e.result = 'checked_in') >= 1,
  'security reads gate entries, refused scans included');
select pg_temp.expect(
  (select count(*) from public.gate_search('Test mem')) = 1, 'security finds a pass by name');
reset role;

select pg_temp.act_as(pg_temp.id('sales'));
select pg_temp.expect((select count(*) from public.gate_entries) = 0, 'sales cannot read gate entries');
reset role;

-- Day passes: no portal, start at the first check-in, one check-in a day, then over --

insert into public.contacts (name, email) values ('Day Tripper', 'day@example.com');
insert into public.memberships (contact_id, tier, status, activate_by, source)
select id, 'day', 'unused', public.org_today() + 90, 'stripe'
from public.contacts where email = 'day@example.com';
select set_config('test.day', (select pass_token from public.contacts where email = 'day@example.com'), true);
select pg_temp.expect(
  not public.is_portal_member((select id from public.contacts where email = 'day@example.com')),
  'a pass holder is not a portal member');
select pg_temp.expect(public.sign_in_check('day@example.com') is not null, 'a pass holder cannot sign in');
select pg_temp.expect(pg_temp.hook('email', 'day@example.com') ? 'error', 'hook rejects pass holders');
select pg_temp.expect(
  (select membership_status = 'upcoming' and tier = 'day' from public.contacts where email = 'day@example.com'),
  'an unused pass shows as upcoming on the contact');
select pg_temp.act_as(null);
select pg_temp.expect(
  (select state from public.pass_by_token(current_setting('test.day'))) = 'unused',
  'an unused pass is ready for its first visit');
reset role;
select pg_temp.act_as(pg_temp.id('security'));
select pg_temp.expect(
  (select ok from public.gate_check_in(current_setting('test.day'))),
  'the first check-in starts a day pass');
select pg_temp.expect(
  not (select ok from public.gate_check_in(current_setting('test.day'))),
  'a day pass cannot be used twice');
reset role;
select pg_temp.expect(
  (select m.starts_on = public.org_today() and m.ends_on = public.org_today() and m.status = 'active'
   from public.memberships m join public.contacts c on c.id = m.contact_id where c.email = 'day@example.com'),
  'a day pass runs for that day only');
select pg_temp.expect(
  public.has_access_today((select id from public.contacts where email = 'day@example.com')),
  'a pass holder has access on the day');
-- A week pass used eight days ago ended the day before yesterday.
update public.memberships m set tier = 'week', starts_on = public.org_today() - 8, ends_on = public.org_today() - 2
from public.contacts c where c.id = m.contact_id and c.email = 'day@example.com';
select pg_temp.act_as(pg_temp.id('security'));
select pg_temp.expect(
  (select state = 'expired' and valid_until = public.org_today() - 2
   from public.pass_by_token(current_setting('test.day'))),
  'an old week pass reads expired with its last day');
select pg_temp.expect(
  not (select ok from public.gate_check_in(current_setting('test.day'))),
  'an expired pass is refused');
reset role;
select pg_temp.expect(
  (select membership_status from public.contacts where email = 'day@example.com') = 'expired',
  'the contact shows expired once the pass is over');
-- A pass never used in time.
update public.memberships m set status = 'unused', starts_on = null, ends_on = null, activate_by = public.org_today() - 1
from public.contacts c where c.id = m.contact_id and c.email = 'day@example.com';
select pg_temp.act_as(null);
select pg_temp.expect(
  (select state from public.pass_by_token(current_setting('test.day'))) = 'expired',
  'an unused pass past its use-by date is over');
reset role;

-- Staff set memberships through set_membership; the columns on contacts are a cache --

select pg_temp.act_as(pg_temp.id('admin'));
select pg_temp.expect(
  public.set_membership((select id from public.contacts where email = 'owned@example.com'),
    'standard', 'active', null, null) is not null,
  'admins set a membership');
select pg_temp.expect(
  public.is_portal_member((select id from public.contacts where email = 'owned@example.com')),
  'a set membership opens the portal');
update public.contacts set tier = null where email = 'owned@example.com';
select pg_temp.expect(
  (select tier from public.contacts where email = 'owned@example.com') = 'standard',
  'the cached tier cannot be changed by hand');
-- Two statements: a stable check in the same statement would still see the
-- snapshot from before the revoke.
select pg_temp.expect(
  public.set_membership((select id from public.contacts where email = 'owned@example.com'),
    '', 'active', null, null) is null,
  '"No membership" returns nothing to point at');
select pg_temp.expect(
  not public.is_portal_member((select id from public.contacts where email = 'owned@example.com')),
  'no membership revokes what is current');
reset role;
select pg_temp.act_as(pg_temp.id('member'));
do $$
begin
  perform public.set_membership((select id from public.contacts where email = 'owned@example.com'),
    'standard', 'active', null, null);
  raise exception 'RLS test failed: a member set a membership';
exception when insufficient_privilege then null;
end $$;
reset role;

-- Guest passes: members invite within their monthly allowance; only security lets guests in --

update public.membership_tiers set guest_passes = 2 where key = 'standard';
select pg_temp.act_as(pg_temp.id('member'));
select set_config('test.guest1', public.invite_guest('Guest One', '+506 1', null, public.org_today()), true);
select set_config('test.guest2', public.invite_guest('Guest Two', null, 'two@example.com', public.org_today()), true);
do $$
begin
  perform public.invite_guest('Guest Three', '+506 3', null, public.org_today());
  raise exception 'RLS test failed: a member went over their guest allowance';
exception when raise_exception then
  if sqlerrm like 'RLS test failed%' then raise; end if;
end $$;
select pg_temp.expect(
  ((public.my_guests() -> 'this_month' ->> 'used')::int) = 2,
  'members see how many guest passes they''ve used');
do $$
begin
  perform public.use_guest_pass(current_setting('test.guest1'));
  raise exception 'RLS test failed: a member let a guest in';
exception when insufficient_privilege then null;
end $$;
reset role;

select pg_temp.act_as(pg_temp.id('member2'));
do $$
begin
  perform public.cancel_guest((select id from public.guest_passes where token = current_setting('test.guest1')));
  raise exception 'RLS test failed: a member cancelled someone else''s guest';
exception when raise_exception then
  if sqlerrm like 'RLS test failed%' then raise; end if;
end $$;
select pg_temp.expect(json_array_length(public.my_guests() -> 'guests') = 0, 'members only see their own guests');
reset role;

select pg_temp.act_as(null);
select pg_temp.expect(
  (select state from public.guest_pass_by_token(current_setting('test.guest1'))) = 'valid'
  and not (select can_log from public.guest_pass_by_token(current_setting('test.guest1'))),
  'anyone with the link sees the guest pass, but can''t let them in');
select pg_temp.expect((select count(*) from public.guest_passes) = 0, 'anon cannot list guest passes');
reset role;

select pg_temp.act_as(pg_temp.id('security'));
select pg_temp.expect(public.use_guest_pass(current_setting('test.guest1')) is not null, 'security lets a guest in');
select pg_temp.expect(
  (select state from public.guest_pass_by_token(current_setting('test.guest1'))) = 'used',
  'a guest pass works once');
select pg_temp.expect((select count(*) from public.todays_guests()) = 2, 'security sees today''s guests');
reset role;

-- Public listings: only published homes, never owners or guests ----------------------

update public.lots set listing_published = true, max_guests = 4, nightly_rate = 100 where code = 'TEST-1';
select pg_temp.act_as(null);
select pg_temp.expect(
  exists (select 1 from public.public_listings() where title = 'Lot TEST-1'),
  'published homes show on the public site');
select pg_temp.expect(
  not (select available from public.public_listings(public.org_today() + 31, public.org_today() + 32, 2) where title = 'Lot TEST-1'),
  'booked nights show as not free');
select pg_temp.expect(
  public.public_listing((select id from public.public_listings() where title = 'Lot TEST-1'))::text not like '%Test guest%',
  'the public page never shows guest names');
select pg_temp.expect((select count(*) from public.listing_photos) = 0, 'anon cannot read listing photos directly');
select pg_temp.expect(
  public.request_stay((select id from public.public_listings() where title = 'Lot TEST-1'),
    public.org_today() + 40, public.org_today() + 42, 2, 'Visitor', 'visitor@example.com', null, null) is not null,
  'the public can request free dates');
do $$
begin
  perform public.request_stay((select id from public.public_listings() where title = 'Lot TEST-1'),
    public.org_today() + 31, public.org_today() + 32, 2, 'Visitor', 'visitor@example.com', null, null);
  raise exception 'RLS test failed: the public requested booked nights';
exception when raise_exception then
  if sqlerrm like 'RLS test failed%' then raise; end if;
end $$;
do $$
begin
  perform public.request_stay((select id from public.public_listings() where title = 'Lot TEST-1'),
    public.org_today() + 50, public.org_today() + 52, 9, 'Visitor', 'visitor@example.com', null, null);
  raise exception 'RLS test failed: the public booked over capacity';
exception when raise_exception then
  if sqlerrm like 'RLS test failed%' then raise; end if;
end $$;
reset role;

update public.lots set listing_published = false where code = 'TEST-1';
select pg_temp.act_as(null);
select pg_temp.expect(
  not exists (select 1 from public.public_listings() where title = 'Lot TEST-1'),
  'unpublished homes are hidden');
reset role;

-- Arkadia family members from the CRM ---------------------------------------------

select pg_temp.act_as(pg_temp.id('teacher'));
select pg_temp.expect(
  exists (select 1 from public.school_contact_search('Someone') where name = 'Someone else'),
  'school staff can search contacts for family members');
select pg_temp.expect(
  public.school_add_guardian(pg_temp.id('student'), null, 'New parent', 'Mother', 'newparent@example.com', null) is not null,
  'school staff add a new family member');
reset role;
select pg_temp.expect(
  exists (select 1 from public.contacts where email = 'newparent@example.com' and source = 'Arkadia family'),
  'a new family member becomes a CRM contact');
select pg_temp.expect(
  (select contact_id from public.student_guardians where name = 'New parent')
    = (select id from public.contacts where email = 'newparent@example.com'),
  'the family member is linked to their contact');

select pg_temp.act_as(pg_temp.id('facilitator'));
select pg_temp.expect(
  (select count(*) from public.school_contact_search('Someone')) = 0,
  'staff outside the school cannot search contacts this way');
do $$
begin
  perform public.school_add_guardian(pg_temp.id('student'), null, 'Sneaky', null, null, null);
  raise exception 'RLS test failed: non-school staff added a family member';
exception when raise_exception then
  if sqlerrm like 'RLS test failed%' then raise; end if;
end $$;
reset role;

-- Courts: staff book for anyone; members book their own slots ------------------

insert into _ids values ('court', gen_random_uuid());
insert into public.courts (id, name, sport, open_time, close_time, slot_minutes, price)
values (pg_temp.id('court'), 'TEST court', 'padel', '06:00', '08:00', 30, 10000);

select pg_temp.act_as(pg_temp.id('member'));
select pg_temp.expect(public.my_court_discount() = 10, 'a Monthly member gets the tier''s 10% off courts');
select pg_temp.expect(
  public.court_price(pg_temp.id('court'), 60, public.current_member_contact_id()) = 18000,
  'court prices carry the tier discount');
select pg_temp.expect(
  public.book_court(pg_temp.id('court'), public.org_today() + 3, '06:00') is not null,
  'members book a free slot');
select pg_temp.expect(
  public.book_court(pg_temp.id('court'), public.org_today() + 3, '07:00') is not null,
  'members book a second slot the same day');
do $$
begin
  perform public.book_court(pg_temp.id('court'), public.org_today() + 3, '07:30');
  raise exception 'RLS test failed: a member booked three slots in a day';
exception when raise_exception then
  if sqlerrm like 'RLS test failed%' then raise; end if;
end $$;
do $$
begin
  perform public.book_court(pg_temp.id('court'), public.org_today() + 3, '06:10');
  raise exception 'RLS test failed: a member booked an off-grid time';
exception when raise_exception then
  if sqlerrm like 'RLS test failed%' then raise; end if;
end $$;
do $$
begin
  perform public.book_court(pg_temp.id('court'), public.org_today() + 20, '06:00');
  raise exception 'RLS test failed: a member booked more than two weeks ahead';
exception when raise_exception then
  if sqlerrm like 'RLS test failed%' then raise; end if;
end $$;
select pg_temp.expect((select count(*) from public.court_bookings) = 0,
  'members cannot read the bookings table directly');
select pg_temp.expect(
  (select count(*) from public.court_day(public.org_today() + 3) where mine) = 2,
  'members see their own slots in the day view');
select pg_temp.expect((select count(*) from public.my_court_bookings()) = 2,
  'members list their upcoming court bookings');
select public.cancel_court_booking((select id from public.my_court_bookings() order by start_time limit 1));
select pg_temp.expect((select count(*) from public.my_court_bookings()) = 1, 'members cancel their own booking');
reset role;

select pg_temp.act_as(pg_temp.id('outsider'));
do $$
begin
  perform public.book_court(pg_temp.id('court'), public.org_today() + 3, '06:30');
  raise exception 'RLS test failed: a non-member booked a court';
exception when raise_exception then
  if sqlerrm like 'RLS test failed%' then raise; end if;
end $$;
reset role;

select pg_temp.act_as(pg_temp.id('facilitator'));
insert into public.court_bookings (court_id, date, start_time, end_time, name)
values (pg_temp.id('court'), public.org_today() + 3, '06:00', '06:30', 'Walk-in');
select pg_temp.expect((select count(*) from public.court_bookings where court_id = pg_temp.id('court')) >= 2,
  'facilitators book and read courts');
do $$
begin
  insert into public.court_bookings (court_id, date, start_time, end_time, name)
  values (pg_temp.id('court'), public.org_today() + 3, '07:00', '07:30', 'Clash');
  raise exception 'RLS test failed: two bookings overlap on one court';
exception when exclusion_violation then null;
end $$;
reset role;

select pg_temp.act_as(pg_temp.id('shop'));
select pg_temp.expect((select count(*) from public.court_bookings) = 0, 'shop staff cannot read court bookings');
reset role;

-- Marketing ----------------------------------------------------------------------

select pg_temp.act_as(pg_temp.id('marketing'));
insert into public.content_items (title, brands) values ('Test item', '{farm}');
insert into public.social_posts (caption, channels, scheduled_at) values ('Test post', '{instagram}', now());
insert into public.email_campaigns (name) values ('Test campaign');
select pg_temp.expect((select count(*) from public.content_items where title = 'Test item') = 1,
  'marketing manages content');
select pg_temp.expect((select count(*) from public.contacts) = 0,
  'marketing cannot read the CRM');
select pg_temp.expect((select count(*) from public.marketing_list('members')) >= 1,
  'marketing sees list members through marketing_list');
select pg_temp.expect((select count(*) from public.finance_entries) = 0,
  'marketing cannot read finance');
reset role;

do $$
declare r text;
begin
  foreach r in array array['lead', 'sales', 'facilitator', 'shop', 'crew', 'security', 'member'] loop
    perform pg_temp.act_as(pg_temp.id(r));
    perform pg_temp.expect((select count(*) from public.content_items) = 0, r || ' cannot read marketing content');
    perform pg_temp.expect((select count(*) from public.email_campaigns) = 0, r || ' cannot read campaigns');
    perform pg_temp.expect((select count(*) from public.marketing_list('members')) = 0, r || ' gets no marketing lists');
    perform pg_temp.expect((select count(*) from public.marketing_leads(current_date - 30, current_date)) = 0, r || ' gets no lead data');
    reset role;
  end loop;
end $$;

select pg_temp.act_as(pg_temp.id('admin'));
select pg_temp.expect((select count(*) from public.email_campaigns where name = 'Test campaign') = 1,
  'admins see marketing');
reset role;

select pg_temp.act_as(null);
select pg_temp.expect(public.join_waitlist('Signup Test', 'signup.test@example.com', null, 'farm', 'instagram', 'social', 'test') is not null,
  'anyone can join the waitlist');
select pg_temp.expect((select count(*) from public.content_items) = 0, 'anon cannot read marketing content');
reset role;
select pg_temp.expect((select stage from public.contact_stages s join public.contacts c on c.id = s.contact_id
  where c.email = 'signup.test@example.com') = 'waitlist', 'signups land on the membership waitlist');

-- Membership applications: anyone can apply, only staff can read them.
select pg_temp.act_as(null);
select pg_temp.expect(public.apply_for_membership('Apply', 'Test', 'apply.test@example.com', '+506 8888 0000',
  'quarter', null, 'Building', 'Why', 'Bring', array['Co-Work'], array['Ana'], '', '', '') is not null,
  'anyone can apply for membership');
select pg_temp.expect((select count(*) from public.membership_applications) = 0, 'anon cannot read applications');
reset role;
select pg_temp.expect((select stage from public.contact_stages s join public.contacts c on c.id = s.contact_id
  where c.email = 'apply.test@example.com') = 'applied', 'applicants land on Applied');

do $$
declare r text;
begin
  foreach r in array array['shop', 'crew', 'member'] loop
    perform pg_temp.act_as(pg_temp.id(r));
    perform pg_temp.expect((select count(*) from public.membership_applications) = 0, r || ' cannot read applications');
    reset role;
  end loop;
end $$;

select pg_temp.act_as(pg_temp.id('admin'));
select pg_temp.expect((select count(*) from public.membership_applications a join public.contacts c on c.id = a.contact_id
  where c.email = 'apply.test@example.com') = 1, 'admins read applications');
reset role;

-- Team members are members too (the eight above plus the Arkadia teacher).
select pg_temp.expect(
  (select count(*) from public.contacts c join public.team_members t on t.email = c.email
   where t.name like 'Test %' and c.tier = 'annual' and c.membership_status = 'active')
    = (select count(*) from public.team_members where name like 'Test %' and status = 'active'),
  'every active team member gets an Annual membership');
select pg_temp.act_as(pg_temp.id('admin'));
select pg_temp.expect(public.is_member(), 'staff count as members in the portal');
reset role;
update public.team_members set status = 'inactive' where email = 'crew@theark.world';
select pg_temp.expect(
  not public.is_portal_member((select id from public.contacts where email = 'crew@theark.world'))
  and (select tier from public.contacts where email = 'crew@theark.world') is null,
  'leaving the team ends the Team membership');

-- Integrations ---------------------------------------------------------------

select pg_temp.act_as(pg_temp.id('admin'));
update public.integrations set location_id = 'loc_test', secret = 'pit-test', enabled = true where key = 'ghl';
select pg_temp.expect((select secret from public.integrations where key = 'ghl') = 'pit-test',
  'admins manage integrations');
insert into public.integration_links (provider, contact_id, external_id)
select 'ghl', id, 'ghl_' || email from public.contacts where email in ('owned@example.com', 'else@example.com');
insert into public.integration_events (provider, direction, kind, detail) values ('ghl', 'out', 'test', 'ok');
-- The live project has real sync events, so count only the one above.
select pg_temp.expect((select count(*) from public.integration_events where kind = 'test' and detail = 'ok') = 1,
  'admins log integration events');
-- Slack shares the table: a token, a default channel and per-kind rules.
update public.integrations
set secret = 'xoxb-test', channel = '#ark-os', enabled = true,
    rules = '{"booking": {"on": true, "channel": "#front-desk"}}'::jsonb
where key = 'slack';
select pg_temp.expect((select rules->'booking'->>'channel' from public.integrations where key = 'slack') = '#front-desk',
  'admins manage Slack rules');
insert into public.integration_events (provider, direction, kind, detail) values ('slack', 'out', 'notify', 'ok');
select pg_temp.expect((select count(*) from public.integration_events where provider = 'slack' and kind = 'notify' and detail = 'ok') = 1,
  'admins log Slack posts');
reset role;

select pg_temp.act_as(pg_temp.id('sales'));
select pg_temp.expect((select count(*) from public.integrations) = 0, 'sales cannot read integration tokens');
select pg_temp.expect((select count(*) from public.integration_events) = 0, 'sales cannot read integration events');
-- Sales own 'owned' and work 'else' in their pipeline, so they see those two links.
select pg_temp.expect((select count(*) from public.integration_links where external_id like 'ghl_%@example.com') = 2,
  'sales see links only for contacts they can read');
do $$
begin
  update public.integrations set enabled = false where key = 'ghl';
  if exists (select 1 from public.integrations) then
    raise exception 'RLS test failed: sales changed an integration';
  end if;
end $$;
reset role;

do $$
declare r text;
begin
  foreach r in array array['lead', 'facilitator', 'shop', 'crew', 'security', 'marketing', 'member'] loop
    perform pg_temp.act_as(pg_temp.id(r));
    perform pg_temp.expect((select count(*) from public.integrations) = 0, r || ' cannot read integrations');
    perform pg_temp.expect((select count(*) from public.integration_events) = 0, r || ' cannot read integration events');
    reset role;
  end loop;
end $$;

-- Guesty listings: admins manage, estate staff read, others nothing.
select pg_temp.act_as(pg_temp.id('admin'));
insert into public.guesty_listings (id, title) values ('gl_test', 'Test cabin');
reset role;
select pg_temp.act_as(pg_temp.id('sales'));
select pg_temp.expect((select count(*) from public.guesty_listings where id = 'gl_test') = 1,
  'estate staff read Guesty listings');
do $$
begin
  update public.guesty_listings set title = 'Changed' where id = 'gl_test';
  if exists (select 1 from public.guesty_listings where id = 'gl_test' and title = 'Changed') then
    raise exception 'RLS test failed: sales changed a Guesty listing';
  end if;
end $$;
reset role;
select pg_temp.act_as(pg_temp.id('shop'));
select pg_temp.expect((select count(*) from public.guesty_listings) = 0, 'shop cannot read Guesty listings');
reset role;

-- Onboarding, WhatsApp and who's going ------------------------------------------------

update public.contacts set phone = '+50688880001', cities = array['Santa Teresa', 'Lisbon']
where email = 'member2@example.com';
insert into public.registrations (offering_id, session_date, contact_id, name, source)
select id, public.org_today() + 3, (select id from public.contacts where email = 'member2@example.com'),
  'Second member', 'portal'
from public.offerings where title = 'Open event';
insert into public.registrations (offering_id, session_date, name, email, source)
select id, public.org_today() + 3, 'Walk-in guest', 'guest@example.com', 'public'
from public.offerings where title = 'Open event';

select pg_temp.act_as(pg_temp.id('member'));
select pg_temp.expect(
  (select phone from public.member_directory() where name = 'Second member') = '+50688880001'
  and (select cities from public.member_directory() where name = 'Second member') = array['Santa Teresa', 'Lisbon'],
  'members open to connecting share their WhatsApp number and cities');
select pg_temp.expect(
  (select phone from public.member_directory() where name = 'Closed member') is null
  and (select instagram from public.member_directory() where name = 'Closed member') is null,
  'members closed to connecting keep their number private');
select pg_temp.expect(
  (select array_agg(name) from public.session_attendees(
    (select id from public.offerings where title = 'Open event'),
    public.org_today(), public.org_today() + 30)) = array['Second member'],
  'members see which directory members are going, never public guests');
select pg_temp.expect((select onboarded_at from public.my_member_profile()) is null,
  'a new member has not onboarded yet');
select public.complete_my_onboarding('Test member', '+50688880002', '@testmember', 'Hello',
  array['Santa Teresa'], true);
select pg_temp.expect(
  (select onboarded_at is not null and phone = '+50688880002' and cities = array['Santa Teresa']
   from public.my_member_profile()),
  'finishing onboarding saves the profile and marks the member onboarded');
select public.update_my_profile('Test member', '+50688880002', 'Hello again', array['surfing'],
  array['Santa Teresa', 'Berlin'], null, true, true);
select pg_temp.expect(
  (select bio = 'Hello again' and cities = array['Santa Teresa', 'Berlin'] from public.my_member_profile()),
  'members update their own profile');
do $$
begin
  perform public.update_my_profile('', null, null, '{}', '{}', null, true, true);
  raise exception 'RLS test failed: a blank name was accepted';
exception when raise_exception then null;
end $$;
reset role;

select pg_temp.act_as(null);
do $$
begin
  perform public.session_attendees(
    (select id from public.offerings where title = 'Open event'),
    public.org_today(), public.org_today() + 30);
  raise exception 'RLS test failed: anon can list attendees';
exception when insufficient_privilege then null;
end $$;
reset role;

select pg_temp.act_as(pg_temp.id('outsider'));
select pg_temp.expect(
  (select count(*) from public.session_attendees(
    (select id from public.offerings where title = 'Open event'),
    public.org_today(), public.org_today() + 30)) = 0,
  'people outside the membership see no attendees');
reset role;

select pg_temp.act_as(pg_temp.id('facilitator'));
select pg_temp.expect(
  (select count(*) from public.session_attendees(
    (select id from public.offerings where title = 'Open event'),
    public.org_today(), public.org_today() + 30)) = 1,
  'staff see who is going too');
reset role;

-- Stripe payments: only the server (service role) records them; staff read them.
insert into public.payments (kind, contact_id, name, email, description, amount, currency, session_id)
select 'membership', id, name, email, 'Test payment', 130000, 'CRC', 'cs_test_rls'
from public.contacts where email = 'member@example.com';

select pg_temp.act_as(pg_temp.id('admin'));
select pg_temp.expect(
  (select count(*) from public.payments where session_id = 'cs_test_rls') = 1,
  'admins read payments');
do $$
begin
  perform public.record_stripe_payment('{"session_id": "cs_x", "kind": "pass"}');
  raise exception 'RLS test failed: staff can record a payment';
exception when insufficient_privilege then null;
end $$;
reset role;

select pg_temp.act_as(pg_temp.id('shop'));
select pg_temp.expect((select count(*) from public.payments) = 0,
  'shop staff can''t read payments');
reset role;

select pg_temp.act_as(pg_temp.id('member'));
select pg_temp.expect((select count(*) from public.payments) = 0,
  'members can''t read payments, even their own');
do $$
begin
  insert into public.payments (kind, description, amount, currency, session_id)
  values ('pass', 'Free pass', 0, 'CRC', 'cs_forged');
  raise exception 'RLS test failed: a member forged a payment';
exception when insufficient_privilege then null;
end $$;
reset role;

select pg_temp.act_as(null);
do $$
begin
  perform public.record_stripe_payment('{"session_id": "cs_x", "kind": "pass"}');
  raise exception 'RLS test failed: anon can record a payment';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  perform public.refund_stripe_payment('pi_x', 're_x', 1, 'CRC');
  raise exception 'RLS test failed: anon can refund a payment';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  perform public.import_stripe_charge('{"charge_id": "ch_x", "amount": 1, "currency": "USD"}');
  raise exception 'RLS test failed: anon can import a Stripe charge';
exception when insufficient_privilege then null;
end $$;
reset role;

-- Courts online: anyone holds a court, joins an open match, cancels by token ---

select pg_temp.act_as(null);
select pg_temp.expect((select count(*) from public.public_courts() where name = 'TEST court') = 1,
  'visitors see the courts');
-- The TEST court is 06:00–08:00 in 30-minute slots; the member booked 06:00 and
-- the facilitator 06:00–06:30 above, so 07:00 is free.
insert into _ids values ('web_hold', (
  public.hold_court(jsonb_build_object(
    'court_id', pg_temp.id('court'), 'date', public.org_today() + 3, 'start', '07:00', 'minutes', 60,
    'name', 'Web Visitor', 'email', 'visitor@example.com', 'open_match', true, 'level', 2.5, 'spots', 4,
    'pay', 'online')) ->> 'id')::uuid);
select pg_temp.expect(
  (select status from public.court_bookings where id = pg_temp.id('web_hold')) is null,
  'visitors cannot read bookings directly');
reset role;
select pg_temp.expect(
  (select status from public.court_bookings where id = pg_temp.id('web_hold')) = 'held',
  'a web booking paid online starts as a hold');
select pg_temp.expect(
  (select count(*) from public.court_players where booking_id = pg_temp.id('web_hold') and host and status = 'held') = 1,
  'the host gets a held player row');
select pg_temp.expect(
  (select source from public.contacts where email = 'visitor@example.com') = 'Courts',
  'a visitor joins the CRM from the courts page');
-- A held slot blocks others.
select pg_temp.act_as(null);
do $$
begin
  perform public.hold_court(jsonb_build_object(
    'court_id', pg_temp.id('court'), 'date', public.org_today() + 3, 'start', '07:30', 'minutes', 30,
    'name', 'Other Visitor', 'email', 'other@example.com', 'pay', 'online'));
  raise exception 'RLS test failed: a visitor booked over a held slot';
exception when raise_exception then
  if sqlerrm like 'RLS test failed%' then raise; end if;
end $$;
-- Visitors see it as taken but not open (the host hasn't paid).
select pg_temp.expect(
  (select count(*) from public.public_court_day(public.org_today() + 3)
   where court_id = pg_temp.id('court') and start_time = '07:00' and kind = 'booking' and not open_match) = 1,
  'a hold shows as taken, not as an open match');
reset role;
-- Stripe says it's paid: the server records it, the booking is booked and the match opens.
select public.record_stripe_payment(jsonb_build_object(
  'session_id', 'cs_test_court', 'payment_intent', 'pi_test_court', 'kind', 'court',
  'email', 'visitor@example.com', 'name', 'Web Visitor', 'amount', 5000, 'currency', 'CRC',
  'court_player_id', (select id from public.court_players where booking_id = pg_temp.id('web_hold') and host),
  'description', 'TEST court'));
select pg_temp.expect(
  (select status from public.court_bookings where id = pg_temp.id('web_hold')) = 'booked',
  'a court payment books the held slot');
select pg_temp.expect(
  (select count(*) from public.payments where kind = 'court' and court_booking_id = pg_temp.id('web_hold')) = 1,
  'court payments are kept');
select pg_temp.expect(
  (select count(*) from public.public_open_matches() where booking_id = pg_temp.id('web_hold') and players = 1 and spots = 4) = 1,
  'a paid open match is listed for others');
-- Someone joins at the right level, someone at the wrong level can't.
select pg_temp.act_as(null);
do $$
begin
  perform public.join_court_match(jsonb_build_object(
    'booking_id', pg_temp.id('web_hold'), 'name', 'Too Good', 'email', 'pro@example.com', 'level', 5.5, 'pay', 'reception'));
  raise exception 'RLS test failed: a player outside the level range joined';
exception when raise_exception then
  if sqlerrm like 'RLS test failed%' then raise; end if;
end $$;
insert into _ids values ('web_join', (
  public.join_court_match(jsonb_build_object(
    'booking_id', pg_temp.id('web_hold'), 'name', 'Joiner One', 'email', 'joiner@example.com', 'level', 3.5, 'pay', 'reception')) ->> 'token'));
select pg_temp.expect(
  (select count(*) from public.public_open_matches() where booking_id = pg_temp.id('web_hold') and players = 2) = 1,
  'joining counts the player');
select pg_temp.expect(
  (public.court_booking_by_token((select id::text from _ids where k = 'web_join')) -> 'you' ->> 'host') = 'false',
  'a player token opens their own page');
select pg_temp.expect(
  jsonb_array_length(public.court_booking_by_token((select id::text from _ids where k = 'web_join')) -> 'players') = 2,
  'the booking page lists the players');
select pg_temp.expect(public.cancel_court_by_token((select id::text from _ids where k = 'web_join')) = 'player',
  'a player leaves a match that is not full');
select pg_temp.expect(
  public.cancel_court_by_token((select token from public.court_bookings where id = pg_temp.id('web_hold'))) = 'booking',
  'the host cancels the booking by token');
do $$
begin
  perform public.cancel_court_by_token('not-a-token');
  raise exception 'RLS test failed: an unknown token cancelled something';
exception when raise_exception then
  if sqlerrm like 'RLS test failed%' then raise; end if;
end $$;
reset role;
select pg_temp.expect(
  (select status from public.court_bookings where id = pg_temp.id('web_hold')) = 'cancelled',
  'the cancelled booking is marked cancelled');

-- Meals: a hold until paid --------------------------------------------------------------
insert into _ids values ('lunch', gen_random_uuid()), ('meal', gen_random_uuid());
insert into public.offerings (id, kind, title, start_date, access, status, capacity)
values (pg_temp.id('lunch'), 'event', 'Lunch', public.org_today(), 'everyone', 'published', 2);
insert into public.ticket_types (id, offering_id, name, price, currency, pay_first, position)
values (pg_temp.id('meal'), pg_temp.id('lunch'), 'Lunch', 6000, 'CRC', true, 0);

select pg_temp.act_as(null);
select set_config('test.meal', (select qr_token from public.book_session(pg_temp.id('lunch'), public.org_today(), 'Diner', 'diner@example.com', pg_temp.id('meal'))), true);
select pg_temp.expect((select state from public.ticket_by_token(current_setting('test.meal'))) = 'unpaid', 'a meal booking waits for payment');
select pg_temp.expect((select sum(taken) from public.session_counts(pg_temp.id('lunch'), public.org_today(), public.org_today())) = 1, 'a live hold takes a spot');
reset role;
select pg_temp.expect((select status = 'held' and hold_until > now() from public.registrations where qr_token = current_setting('test.meal')), 'the hold has a time limit');

select pg_temp.act_as(pg_temp.id('security'));
do $$
begin
  perform public.check_in(current_setting('test.meal'));
  raise exception 'RLS test failed: an unpaid meal was checked in';
exception when raise_exception then
  if sqlerrm like 'RLS test failed%' then raise; end if;
end $$;
reset role;

update public.registrations set paid = true where qr_token = current_setting('test.meal');
select pg_temp.expect((select status = 'confirmed' and hold_until is null from public.registrations where qr_token = current_setting('test.meal')), 'payment confirms the hold');

select pg_temp.act_as(null);
select set_config('test.meal2', (select qr_token from public.book_session(pg_temp.id('lunch'), public.org_today(), 'Late', 'late@example.com', pg_temp.id('meal'))), true);
reset role;
update public.registrations set hold_until = now() - interval '1 minute' where qr_token = current_setting('test.meal2');
select pg_temp.expect((select state from public.ticket_by_token(current_setting('test.meal2'))) = 'lapsed', 'an unpaid hold lapses');
select pg_temp.expect((select sum(taken) from public.session_counts(pg_temp.id('lunch'), public.org_today(), public.org_today())) = 1, 'a lapsed hold frees its spot');
select pg_temp.act_as(null);
select pg_temp.expect((select count(*) from public.book_session(pg_temp.id('lunch'), public.org_today(), 'Late', 'late@example.com', pg_temp.id('meal'))) = 1, 'the same person can book again after a lapse');
reset role;

-- Farm shop Checkout ----------------------------------------------------------
select pg_temp.act_as(pg_temp.id('shop'));
select pg_temp.expect((select count(*) from public.checkout_customers('zz')) >= 0, 'shop staff can search customers');
select pg_temp.act_as(pg_temp.id('sales'));
select pg_temp.expect((select count(*) from public.checkout_customers('zz')) = 0, 'sales staff get no customer search through Checkout');
select pg_temp.expect((select count(*) from public.sales) >= 0, 'CRM roles can read sales');
do $$ begin
  begin
    perform public.checkout_sale(null, '[]'::jsonb, 'cash', null, 1);
    raise exception 'RLS test failed: a sales-role user ran Checkout';
  exception when sqlstate '42501' then null; end;
end $$;
select pg_temp.act_as(pg_temp.id('marketing'));
select pg_temp.expect((select count(*) from public.sales) = 0 and (select count(*) from public.sale_payments) = 0, 'marketing cannot read sales');
reset role;

select 'All RLS tests passed' as result;

rollback;
