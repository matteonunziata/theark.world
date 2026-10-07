-- Review membership applications in the memberships admin, and give everyone
-- who applies one free day pass.

alter table public.memberships drop constraint memberships_source_check;
alter table public.memberships add constraint memberships_source_check
  check (source in ('stripe', 'staff', 'team', 'import', 'application'));

alter table public.membership_applications
  add column free_pass_id uuid references public.memberships (id) on delete set null,
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references public.team_members (id) on delete set null;

create or replace function public.apply_for_membership(
  p_first text, p_last text, p_email text, p_phone text,
  p_plan text, p_invited_by text,
  p_building text, p_why text, p_contributing text,
  p_drawn_to text[], p_invites text[],
  p_source text, p_medium text, p_campaign text,
  p_tried_day_pass boolean default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  cid uuid;
  aid uuid;
  e text := lower(trim(p_email));
  full_name text := trim(trim(coalesce(p_first, '')) || ' ' || trim(coalesce(p_last, '')));
  plan_name text;
  pid uuid;
begin
  if length(trim(coalesce(p_first, ''))) = 0 or length(trim(coalesce(p_last, ''))) = 0 then
    raise exception 'Tell us your first and last name.';
  end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'That email doesn’t look right.'; end if;
  if length(trim(coalesce(p_phone, ''))) < 6 then raise exception 'Add your WhatsApp number.'; end if;
  plan_name := case p_plan
    when 'month' then '1 month' when 'quarter' then '3 months'
    when 'half' then '6 months' when 'year' then 'Annual' end;
  if plan_name is null then raise exception 'Choose a membership.'; end if;
  -- A month is for people who've already spent a day here.
  if p_plan = 'month' and p_tried_day_pass is not true then
    raise exception 'Come for a day on a day pass first, then apply for a month.';
  end if;
  if length(trim(coalesce(p_building, ''))) = 0 or length(trim(coalesce(p_why, ''))) = 0
     or length(trim(coalesce(p_contributing, ''))) = 0 then
    raise exception 'Answer the three questions about what you bring.';
  end if;

  select id into cid from public.contacts where email = e limit 1;
  if cid is null then
    insert into public.contacts (name, email, phone, source, lead_brand,
                                 utm_source, utm_medium, utm_campaign, show_in_directory)
    values (left(full_name, 200), e, left(trim(p_phone), 60),
            coalesce(nullif(p_source, ''), 'Membership application'),
            (select key from public.marketing_brands where key = 'membership'),
            nullif(p_source, ''), nullif(p_medium, ''), nullif(p_campaign, ''), false)
    returning id into cid;
  else
    -- One application per person per hour; a double click shouldn't make two.
    select id into aid from public.membership_applications
      where contact_id = cid and created_at > now() - interval '1 hour'
      order by created_at desc limit 1;
    if aid is not null then return aid; end if;
    update public.contacts set
      phone = coalesce(phone, left(trim(p_phone), 60)),
      lead_brand = coalesce(lead_brand, (select key from public.marketing_brands where key = 'membership'))
    where id = cid;
  end if;

  insert into public.membership_applications
    (contact_id, plan, tried_day_pass, invited_by, building, why_join, contributing, drawn_to, invites)
  values (cid, p_plan, p_tried_day_pass, nullif(left(trim(coalesce(p_invited_by, '')), 200), ''),
          left(trim(p_building), 4000), left(trim(p_why), 4000), left(trim(p_contributing), 4000),
          coalesce((select array_agg(left(trim(x), 60)) from unnest(p_drawn_to) x where trim(x) <> ''), '{}'),
          coalesce((select array_agg(left(trim(x), 120)) from unnest(p_invites) x where trim(x) <> ''), '{}'))
  returning id into aid;

  -- Everyone who applies gets one free day pass, once: it waits for their
  -- first check-in, like a paid one, and is usable for 90 days.
  if exists (select 1 from public.membership_tiers where key = 'day')
     and not exists (select 1 from public.memberships where contact_id = cid and source = 'application') then
    insert into public.memberships (contact_id, tier, status, activate_by, source)
    values (cid, 'day', 'unused', public.org_today() + 90, 'application')
    returning id into pid;
    update public.membership_applications set free_pass_id = pid where id = aid;
  end if;

  -- Move them to Applied, unless they're already further along.
  insert into public.contact_stages (contact_id, pipeline, stage)
  values (cid, 'memberships', 'applied')
  on conflict (contact_id, pipeline) do update set stage = 'applied'
    where public.contact_stages.stage in ('waitlist', 'invited');

  insert into public.contact_notes (contact_id, body)
  values (cid,
    'Applied for membership (' || plan_name || ')' ||
    case when p_tried_day_pass then E'\nHas visited on a day pass' else '' end ||
    coalesce(E'\nInvited by: ' || nullif(trim(coalesce(p_invited_by, '')), ''), '') ||
    E'\n\nWhat they’re building:\n' || trim(p_building) ||
    E'\n\nWhy The ARK:\n' || trim(p_why) ||
    E'\n\nWhat they’d bring:\n' || trim(p_contributing) ||
    coalesce(E'\n\nDrawn to: ' || nullif(array_to_string(p_drawn_to, ', '), ''), '') ||
    coalesce(E'\nWould invite: ' || nullif(array_to_string(p_invites, ', '), ''), ''));

  return aid;
end $$;

revoke all on function public.apply_for_membership(text, text, text, text, text, text, text, text, text, text[], text[], text, text, text, boolean) from public;
grant execute on function public.apply_for_membership(text, text, text, text, text, text, text, text, text, text[], text[], text, text, text, boolean) to anon, authenticated;

-- Approve, decline or mark an application as being reviewed. Approving moves
-- the person to Approved in the Memberships pipeline (unless already paid &
-- active); it doesn't grant a membership, they pay for that.
create or replace function public.review_application(p_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  a public.membership_applications;
begin
  if p_status not in ('new', 'reviewing', 'approved', 'declined') then
    raise exception 'Unknown status.' using errcode = 'P0001';
  end if;
  select * into a from public.membership_applications where id = p_id;
  if not found then raise exception 'Application not found.' using errcode = 'P0001'; end if;
  if not (public.has_role('admin', 'sales') and public.can_write_contact(a.contact_id)) then
    raise exception 'You can''t review this application.' using errcode = '42501';
  end if;

  update public.membership_applications set
    status = p_status,
    reviewed_at = case when p_status = 'new' then null else now() end,
    reviewed_by = case when p_status = 'new' then null else public.current_staff_id() end
  where id = p_id;

  if p_status = 'approved' then
    insert into public.contact_stages (contact_id, pipeline, stage)
    values (a.contact_id, 'memberships', 'approved')
    on conflict (contact_id, pipeline) do update set stage = 'approved', updated_at = now()
      where public.contact_stages.stage <> 'active';
  elsif p_status = 'reviewing' then
    insert into public.contact_stages (contact_id, pipeline, stage)
    values (a.contact_id, 'memberships', 'screening')
    on conflict (contact_id, pipeline) do update set stage = 'screening', updated_at = now()
      where public.contact_stages.stage in ('waitlist', 'invited', 'applied');
  end if;
end $$;

revoke all on function public.review_application(uuid, text) from public, anon;
grant execute on function public.review_application(uuid, text) to authenticated;
