-- Membership applications from /ark-membership/apply. Passes are bought
-- straight away; monthly and longer memberships start with this application.

create table public.membership_applications (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  plan text not null check (plan in ('month', 'quarter', 'half', 'year')),
  invited_by text,
  building text not null,
  why_join text not null,
  contributing text not null,
  drawn_to text[] not null default '{}',
  invites text[] not null default '{}',
  status text not null default 'new' check (status in ('new', 'reviewing', 'approved', 'declined')),
  created_at timestamptz not null default now()
);
create index membership_applications_contact_idx on public.membership_applications (contact_id);

alter table public.membership_applications enable row level security;

create policy "Staff read applications" on public.membership_applications
  for select to authenticated using (public.can_read_contact(contact_id));
create policy "Sales update applications" on public.membership_applications
  for update to authenticated
  using (public.has_role('admin', 'sales') and public.can_write_contact(contact_id))
  with check (public.has_role('admin', 'sales') and public.can_write_contact(contact_id));
create policy "Admins delete applications" on public.membership_applications
  for delete to authenticated using (public.has_role('admin'));

create or replace function public.apply_for_membership(
  p_first text, p_last text, p_email text, p_phone text,
  p_plan text, p_invited_by text,
  p_building text, p_why text, p_contributing text,
  p_drawn_to text[], p_invites text[],
  p_source text, p_medium text, p_campaign text
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
    (contact_id, plan, invited_by, building, why_join, contributing, drawn_to, invites)
  values (cid, p_plan, nullif(left(trim(coalesce(p_invited_by, '')), 200), ''),
          left(trim(p_building), 4000), left(trim(p_why), 4000), left(trim(p_contributing), 4000),
          coalesce((select array_agg(left(trim(x), 60)) from unnest(p_drawn_to) x where trim(x) <> ''), '{}'),
          coalesce((select array_agg(left(trim(x), 120)) from unnest(p_invites) x where trim(x) <> ''), '{}'))
  returning id into aid;

  -- Move them to Applied, unless they're already further along.
  insert into public.contact_stages (contact_id, pipeline, stage)
  values (cid, 'memberships', 'applied')
  on conflict (contact_id, pipeline) do update set stage = 'applied'
    where public.contact_stages.stage in ('waitlist', 'invited');

  insert into public.contact_notes (contact_id, body)
  values (cid,
    'Applied for membership (' || plan_name || ')' ||
    coalesce(E'\nInvited by: ' || nullif(trim(coalesce(p_invited_by, '')), ''), '') ||
    E'\n\nWhat they’re building:\n' || trim(p_building) ||
    E'\n\nWhy The ARK:\n' || trim(p_why) ||
    E'\n\nWhat they’d bring:\n' || trim(p_contributing) ||
    coalesce(E'\n\nDrawn to: ' || nullif(array_to_string(p_drawn_to, ', '), ''), '') ||
    coalesce(E'\nWould invite: ' || nullif(array_to_string(p_invites, ', '), ''), ''));

  return aid;
end $$;

revoke all on function public.apply_for_membership(text, text, text, text, text, text, text, text, text, text[], text[], text, text, text) from public;
grant execute on function public.apply_for_membership(text, text, text, text, text, text, text, text, text, text[], text[], text, text, text) to anon, authenticated;
