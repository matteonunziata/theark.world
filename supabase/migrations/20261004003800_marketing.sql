-- Marketing: brand strategy, content pipeline and asset library, social
-- planner, email campaigns with one automation, and lead sources.
-- Admins and the new "marketing" role (the content strategist) manage it.

-- The marketing role ---------------------------------------------------------
alter table public.team_members drop constraint team_members_role_check;
alter table public.team_members add constraint team_members_role_check
  check (role in ('admin', 'lead', 'sales', 'facilitator', 'security', 'shop', 'crew', 'marketing'));

create or replace function public.is_marketing()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.has_role('admin', 'marketing'); $$;
revoke all on function public.is_marketing() from public, anon;
grant execute on function public.is_marketing() to authenticated, service_role;

-- Brands ----------------------------------------------------------------------
create table public.marketing_brands (
  key text primary key,
  name text not null,
  color text not null,
  position int not null default 0
);
insert into public.marketing_brands (key, name, color, position) values
  ('farm', 'Farm', 'leaf', 1),
  ('arkadia', 'Arkadia', 'sun', 2),
  ('ark', 'The ARK', 'sea', 3),
  ('courts', 'Courts', 'clay', 4),
  ('membership', 'Membership', 'plum', 5);

-- Strategy, one page per brand ---------------------------------------------------
create table public.brand_strategies (
  brand text primary key references public.marketing_brands (key) on delete cascade,
  story text,
  audience text,
  key_messages text,
  pillars text,
  tone text,
  channels text,
  goals text,
  updated_by uuid references public.team_members (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.brand_strategies (brand) select key from public.marketing_brands;

-- Moodboard: uploaded images and links.
create table public.brand_refs (
  id uuid primary key default gen_random_uuid(),
  brand text not null references public.marketing_brands (key) on delete cascade,
  path text,
  url text,
  caption text,
  created_by uuid references public.team_members (id) on delete set null,
  created_at timestamptz not null default now(),
  check (path is not null or url is not null)
);

-- Asset library -------------------------------------------------------------------
create table public.marketing_assets (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  kind text not null check (kind in ('photo', 'video', 'copy')),
  path text,          -- in the public "marketing" bucket, or a site path / https URL
  body text,          -- for copy
  brands text[] not null default '{}',
  tags text[] not null default '{}',
  created_by uuid references public.team_members (id) on delete set null,
  created_at timestamptz not null default now(),
  check (kind = 'copy' or path is not null)
);
create index marketing_assets_brands_idx on public.marketing_assets using gin (brands);

-- Content pipeline -------------------------------------------------------------------
create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  brief text,
  brands text[] not null default '{}',
  stage text not null default 'idea'
    check (stage in ('idea', 'production', 'review', 'approved', 'published')),
  assignee_id uuid references public.team_members (id) on delete set null,
  due_date date,
  stage_changed_at timestamptz not null default now(),
  published_at timestamptz,
  created_by uuid references public.team_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index content_items_brands_idx on public.content_items using gin (brands);

create table public.content_item_assets (
  item_id uuid not null references public.content_items (id) on delete cascade,
  asset_id uuid not null references public.marketing_assets (id) on delete cascade,
  primary key (item_id, asset_id)
);

create table public.content_comments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.content_items (id) on delete cascade,
  author_id uuid references public.team_members (id) on delete set null,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

-- Keep stage_changed_at and published_at right whatever changes the stage.
create or replace function public.content_stage_stamp()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    if new.stage = 'published' then
      new.published_at := coalesce(new.published_at, now());
    elsif tg_op = 'UPDATE' then
      new.published_at := null;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger content_stage_stamp before insert or update on public.content_items
  for each row execute function public.content_stage_stamp();

-- Social planner ---------------------------------------------------------------------
create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  caption text not null default '',
  brands text[] not null default '{}',
  channels text[] not null default '{}'
    check (channels <@ array['instagram', 'facebook', 'tiktok', 'linkedin', 'whatsapp', 'youtube']),
  scheduled_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'ready', 'published')),
  published_at timestamptz,
  link text,          -- the link in the post, with UTM tags added
  content_item_id uuid references public.content_items (id) on delete set null,
  -- Engagement, typed in by hand after publishing.
  reach int check (reach >= 0),
  likes int check (likes >= 0),
  comments int check (comments >= 0),
  shares int check (shares >= 0),
  saves int check (saves >= 0),
  created_by uuid references public.team_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index social_posts_when_idx on public.social_posts (scheduled_at);

create table public.social_post_assets (
  post_id uuid not null references public.social_posts (id) on delete cascade,
  asset_id uuid not null references public.marketing_assets (id) on delete cascade,
  position int not null default 0,
  primary key (post_id, asset_id)
);

-- Email ---------------------------------------------------------------------------------
alter table public.contacts
  add column email_opt_out boolean not null default false,
  add column waitlist_at timestamptz,
  add column lead_brand text references public.marketing_brands (key) on delete set null,
  add column utm_source text,
  add column utm_medium text,
  add column utm_campaign text;

create table public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  brands text[] not null default '{}',
  list_key text not null default 'waitlist'
    check (list_key in ('waitlist', 'applicants', 'members', 'attendees')),
  subject text not null default '',
  body text not null default '',
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'sent')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid references public.team_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'scheduled' or scheduled_at is not null)
);

-- The one automation: waitlist signup → welcome → application link after N days.
create table public.email_automations (
  key text primary key,
  name text not null,
  active boolean not null default false,
  welcome_subject text not null default '',
  welcome_body text not null default '',
  followup_days int not null default 3 check (followup_days between 0 and 60),
  followup_subject text not null default '',
  followup_body text not null default '',
  application_url text,
  updated_at timestamptz not null default now()
);
insert into public.email_automations
  (key, name, active, welcome_subject, welcome_body, followup_days, followup_subject, followup_body, application_url)
values (
  'waitlist', 'Waitlist welcome', false,
  'You’re on the list',
  E'Hi {{first_name}},\n\nThank you for joining the waitlist for The ARK. We keep the membership small, so we take time to get to know everyone.\n\nOver the next few days we''ll send you a little more about life here: the farm, the courts, Arkadia and the people who make it.\n\nThe ARK team',
  3,
  'Your invitation to apply',
  E'Hi {{first_name}},\n\nWhen you''re ready, here is the application. It takes about ten minutes, and there are no wrong answers.\n\n[[Apply to The ARK|{{application_url}}]]\n\nIf you''d like to visit first, reply to this email and we''ll find a day.\n\nThe ARK team',
  'https://theark.world/apply'
);

-- Every marketing email sent, with what happened to it (from Resend webhooks).
create table public.email_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.email_campaigns (id) on delete cascade,
  automation_step text check (automation_step in ('welcome', 'followup')),
  contact_id uuid references public.contacts (id) on delete set null,
  email extensions.citext not null,
  resend_id text unique,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'test')),
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint email_sends_kind_check
    check (((campaign_id is null) <> (automation_step is null)) = (status <> 'test'))
);
-- Each address gets a campaign once, and each person each automation step
-- once. Test sends carry neither, so they never block the real one.
alter table public.email_sends add constraint email_sends_campaign_once unique (campaign_id, email);
alter table public.email_sends add constraint email_sends_step_once unique (automation_step, contact_id);

-- RLS --------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['brand_strategies', 'brand_refs', 'marketing_assets', 'content_items',
    'content_item_assets', 'content_comments', 'social_posts', 'social_post_assets',
    'email_campaigns', 'email_automations', 'email_sends'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "Marketing team" on public.%I for all to authenticated
      using (public.is_marketing()) with check (public.is_marketing())', t);
  end loop;
end $$;
alter table public.marketing_brands enable row level security;
create policy "Staff read brands" on public.marketing_brands for select to authenticated
  using (public.current_staff_id() is not null);
create policy "Admins edit brands" on public.marketing_brands for all to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- Storage: one public bucket for marketing photos, video and moodboards.
insert into storage.buckets (id, name, public, file_size_limit)
values ('marketing', 'marketing', true, 52428800)
on conflict (id) do nothing;
create policy "Marketing uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'marketing' and public.is_marketing());
create policy "Marketing updates" on storage.objects for update to authenticated
  using (bucket_id = 'marketing' and public.is_marketing());
create policy "Marketing deletes" on storage.objects for delete to authenticated
  using (bucket_id = 'marketing' and public.is_marketing());

-- Lists --------------------------------------------------------------------------------------
-- Who's on each list, live from the CRM and bookings. People who unsubscribed
-- and people without an email are left out.
create or replace function public.marketing_list(p_list text)
returns table (contact_id uuid, name text, email text)
language sql stable security definer set search_path = ''
as $$
  select distinct on (lower(x.email::text)) x.contact_id, x.name, x.email::text
  from (
    select c.id as contact_id, c.name, c.email
    from public.contacts c
    where p_list in ('waitlist', 'applicants')
      and exists (
        select 1 from public.contact_stages s
        where s.contact_id = c.id and s.pipeline = 'memberships'
          and s.stage = any (case p_list when 'waitlist' then array['waitlist']
                                         else array['invited', 'applied', 'screening'] end))
    union all
    select c.id, c.name, c.email
    from public.contacts c
    where p_list = 'members' and c.tier is not null and c.membership_status = 'active'
    union all
    select r.contact_id, coalesce(c.name, r.name), coalesce(c.email, r.email)
    from public.registrations r
    left join public.contacts c on c.id = r.contact_id
    where p_list = 'attendees'
  ) x
  where public.is_marketing()
    and x.email is not null
    and not exists (
      select 1 from public.contacts o
      where o.email = x.email and o.email_opt_out
    )
  order by lower(x.email::text), x.contact_id nulls last;
$$;
revoke all on function public.marketing_list(text) from public, anon;
grant execute on function public.marketing_list(text) to authenticated;

-- Public waitlist signup ------------------------------------------------------------------------
-- Adds (or finds) the person, puts them on the membership waitlist and keeps
-- where they came from. Signing up again within the hour changes nothing.
create or replace function public.join_waitlist(
  p_name text, p_email text, p_phone text,
  p_brand text, p_source text, p_medium text, p_campaign text
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  cid uuid;
  e text := lower(trim(p_email));
begin
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Tell us your name.'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'That email doesn’t look right.'; end if;

  select id into cid from public.contacts where email = e limit 1;
  if cid is null then
    insert into public.contacts (name, email, phone, source, waitlist_at, lead_brand,
                                 utm_source, utm_medium, utm_campaign, show_in_directory)
    values (trim(p_name), e, nullif(trim(p_phone), ''), coalesce(nullif(p_source, ''), 'Waitlist'),
            now(), (select key from public.marketing_brands where key = p_brand),
            nullif(p_source, ''), nullif(p_medium, ''), nullif(p_campaign, ''), false)
    returning id into cid;
  else
    if (select waitlist_at from public.contacts where id = cid) > now() - interval '1 hour' then
      return cid;
    end if;
    update public.contacts set
      waitlist_at = coalesce(waitlist_at, now()),
      phone = coalesce(phone, nullif(trim(p_phone), '')),
      lead_brand = coalesce(lead_brand, (select key from public.marketing_brands where key = p_brand)),
      utm_source = coalesce(utm_source, nullif(p_source, '')),
      utm_medium = coalesce(utm_medium, nullif(p_medium, '')),
      utm_campaign = coalesce(utm_campaign, nullif(p_campaign, ''))
    where id = cid;
  end if;

  insert into public.contact_stages (contact_id, pipeline, stage)
  values (cid, 'memberships', 'waitlist')
  on conflict (contact_id, pipeline) do nothing;
  return cid;
end $$;
revoke all on function public.join_waitlist(text, text, text, text, text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text, text, text, text, text) to anon, authenticated;

-- One-click unsubscribe from the link in a marketing email (the send id is the token).
create or replace function public.email_unsubscribe(p_send uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare s record;
begin
  select id, email into s from public.email_sends where id = p_send;
  if s.id is null then return 'unknown'; end if;
  update public.email_sends set unsubscribed_at = coalesce(unsubscribed_at, now()) where id = s.id;
  update public.contacts set email_opt_out = true where email = s.email;
  return 'ok';
end $$;
revoke all on function public.email_unsubscribe(uuid) from public;
grant execute on function public.email_unsubscribe(uuid) to anon, authenticated;

-- Waitlist signups for analytics: day, UTM tags and brand only (no names).
create or replace function public.marketing_leads(p_from date, p_to date, p_brand text default null)
returns table (day date, source text, medium text, campaign text, brand text)
language sql stable security definer set search_path = ''
as $$
  select (c.waitlist_at at time zone 'America/Costa_Rica')::date,
         coalesce(nullif(c.utm_source, ''), 'direct'),
         c.utm_medium, c.utm_campaign, c.lead_brand
  from public.contacts c
  where public.is_marketing()
    and c.waitlist_at is not null
    and (c.waitlist_at at time zone 'America/Costa_Rica')::date between p_from and p_to
    and (p_brand is null or c.lead_brand = p_brand);
$$;
revoke all on function public.marketing_leads(date, date, text) from public, anon;
grant execute on function public.marketing_leads(date, date, text) to authenticated;
