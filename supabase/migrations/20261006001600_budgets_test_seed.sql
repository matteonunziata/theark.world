-- Test data for Budgets & Payments: two sectors, one sector manager each, and
-- one budget admin. All named "TEST" so they are easy to find and remove.
-- The emails are placeholders: a person can sign in as one of them only if a
-- Google account with that @theark.world address exists. To try it with real
-- people, set a teammate's Division and Finance role in Settings > Team.

insert into public.divisions (name, description, color)
select 'TEST – Farm sector', 'Test sector for Budgets & Payments', 'leaf'
where not exists (select 1 from public.divisions where name = 'TEST – Farm sector');

insert into public.divisions (name, description, color)
select 'TEST – Events sector', 'Test sector for Budgets & Payments', 'sun'
where not exists (select 1 from public.divisions where name = 'TEST – Events sector');

insert into public.team_members (email, name, title, type, role, finance_role, division_id)
select 'test.farm.manager@theark.world', 'TEST Farm manager', 'Sector manager (test)',
       'team', 'lead', 'sector_manager',
       (select id from public.divisions where name = 'TEST – Farm sector')
where not exists (select 1 from public.team_members where email = 'test.farm.manager@theark.world');

insert into public.team_members (email, name, title, type, role, finance_role, division_id)
select 'test.events.manager@theark.world', 'TEST Events manager', 'Sector manager (test)',
       'team', 'lead', 'sector_manager',
       (select id from public.divisions where name = 'TEST – Events sector')
where not exists (select 1 from public.team_members where email = 'test.events.manager@theark.world');

-- Budget admin through the Finance role only: access level stays Division lead.
insert into public.team_members (email, name, title, type, role, finance_role)
select 'test.finance.admin@theark.world', 'TEST Finance admin', 'Budget admin (test)',
       'team', 'lead', 'admin'
where not exists (select 1 from public.team_members where email = 'test.finance.admin@theark.world');
