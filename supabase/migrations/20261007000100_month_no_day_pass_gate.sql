-- A one-month membership no longer needs a paid day pass first: applying
-- brings a free one, emailed to the applicant. User decision, 2026-10-07.
-- p_tried_day_pass stays as an optional argument so the signature is unchanged.

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
    case when p_tried_day_pass is true then E'\nHas visited on a day pass' else '' end ||
    coalesce(E'\nInvited by: ' || nullif(trim(coalesce(p_invited_by, '')), ''), '') ||
    E'\n\nWhat they’re building:\n' || trim(p_building) ||
    E'\n\nWhy The ARK:\n' || trim(p_why) ||
    E'\n\nWhat they’d bring:\n' || trim(p_contributing) ||
    coalesce(E'\n\nDrawn to: ' || nullif(array_to_string(p_drawn_to, ', '), ''), '') ||
    coalesce(E'\nWould invite: ' || nullif(array_to_string(p_invites, ', '), ''), ''));

  return aid;
end $$;
