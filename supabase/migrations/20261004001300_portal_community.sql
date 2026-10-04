-- Members portal v2: cities, experiences and expeditions, member profiles,
-- a community feed, and direct messages between members.

-- Cities -------------------------------------------------------------------------

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  country text,
  blurb text,
  cover_path text,
  is_home boolean not null default false,
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index cities_one_home on public.cities (is_home) where is_home;

insert into public.cities (name, country, blurb, is_home, position) values
  ('Santa Teresa', 'Costa Rica',
   'Home. Jungle to the waterline, the farm, the shala, and the people who make it.',
   true, 0);

alter table public.cities enable row level security;
create policy "Everyone reads cities" on public.cities
  for select to anon, authenticated using (active or public.is_staff());
create policy "Admins and leads write cities" on public.cities
  for all to authenticated
  using (public.has_role('admin', 'lead')) with check (public.has_role('admin', 'lead'));

-- Offerings: more kinds, a city, multi-day expeditions --------------------------

alter table public.offerings drop constraint offerings_kind_check;
alter table public.offerings add constraint offerings_kind_check
  check (kind in ('class', 'event', 'experience', 'expedition'));
alter table public.offerings drop constraint offerings_check;
alter table public.offerings add constraint offerings_class_members_only
  check (kind <> 'class' or access = 'members');
alter table public.offerings
  add column city_id uuid references public.cities (id) on delete set null;
update public.offerings set city_id = (select id from public.cities where is_home);
create index offerings_city_idx on public.offerings (city_id);

-- Non-class offerings follow the same visibility rule as events.
create or replace function public.can_view_offering(oid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_staff() or exists (
    select 1 from public.offerings o
    where o.id = oid and o.status = 'published'
      and (public.is_member() or (o.kind <> 'class' and o.access = 'everyone'))
  );
$$;

-- book_session: anyone may book open non-class offerings.
create or replace function public.book_session(
  p_offering_id uuid,
  p_session_date date,
  p_name text,
  p_email text,
  p_ticket_type_id uuid default null
)
returns table (registration_id uuid, qr_token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.offerings;
  t public.ticket_types;
  member_id uuid := public.current_member_contact_id();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text := trim(coalesce(p_name, ''));
  taken int;
  has_tickets boolean;
begin
  select * into o from public.offerings where id = p_offering_id for update;
  if not found or o.status <> 'published' then
    raise exception 'This isn''t available to book.' using errcode = 'P0001';
  end if;

  if member_id is null and not (o.kind <> 'class' and o.access = 'everyone') then
    raise exception 'Only members can book this. Sign in to the members portal.'
      using errcode = 'P0001';
  end if;

  if member_id is not null then
    select c.name, lower(c.email::text) into v_name, v_email
    from public.contacts c where c.id = member_id;
  end if;

  if v_name = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter your name and a valid email.' using errcode = 'P0001';
  end if;

  if p_session_date < public.org_today()
    or not public.occurs_on(o, p_session_date)
    or exists (
      select 1 from public.session_cancellations
      where offering_id = o.id and session_date = p_session_date
    ) then
    raise exception 'That date isn''t on the schedule.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.registrations
    where offering_id = o.id and session_date = p_session_date
      and email = v_email::extensions.citext
  ) then
    raise exception 'You''re already booked for this session.'
      using errcode = 'P0001';
  end if;

  select count(*) into taken from public.registrations
  where offering_id = o.id and session_date = p_session_date;
  if o.capacity is not null and taken >= o.capacity then
    raise exception 'Sorry, this session just filled up.' using errcode = 'P0001';
  end if;

  select exists (select 1 from public.ticket_types where offering_id = o.id)
    into has_tickets;

  if p_ticket_type_id is not null then
    select * into t from public.ticket_types
    where id = p_ticket_type_id and offering_id = o.id;
    if not found then
      raise exception 'Choose a ticket.' using errcode = 'P0001';
    end if;
    if t.qty is not null and (
      select count(*) from public.registrations
      where ticket_type_id = t.id and session_date = p_session_date
    ) >= t.qty then
      raise exception 'That ticket just sold out.' using errcode = 'P0001';
    end if;
  elsif has_tickets and member_id is null then
    raise exception 'Choose a ticket.' using errcode = 'P0001';
  end if;

  return query
  insert into public.registrations as r (
    offering_id, session_date, ticket_type_id, contact_id, user_id,
    name, email, source
  ) values (
    o.id, p_session_date, p_ticket_type_id, member_id,
    case when member_id is not null then auth.uid() end,
    v_name, v_email,
    case when member_id is not null then 'portal' else 'public' end
  )
  returning r.id, r.qr_token;
end;
$$;

-- Member profiles (what members choose to share with each other) ----------------

alter table public.contacts
  add column city_id uuid references public.cities (id) on delete set null,
  add column bio text,
  add column open_to_connect boolean not null default true,
  add column show_in_directory boolean not null default true;
create index contacts_city_idx on public.contacts (city_id);

create or replace function public.update_my_profile(
  p_bio text,
  p_interests text[],
  p_city_id uuid,
  p_instagram text,
  p_open_to_connect boolean,
  p_show_in_directory boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.current_member_contact_id();
begin
  if me is null then
    raise exception 'Only members can edit a member profile.' using errcode = '42501';
  end if;
  update public.contacts set
    bio = nullif(trim(p_bio), ''),
    interests = coalesce(p_interests, '{}'),
    city_id = p_city_id,
    instagram = nullif(trim(p_instagram), ''),
    open_to_connect = coalesce(p_open_to_connect, true),
    show_in_directory = coalesce(p_show_in_directory, true)
  where id = me;
end;
$$;
revoke execute on function public.update_my_profile(text, text[], uuid, text, boolean, boolean) from anon, public;
grant execute on function public.update_my_profile(text, text[], uuid, text, boolean, boolean) to authenticated;

-- The directory members see. Contact details stay private; members choose
-- whether to appear and whether they're open to hearing from people.
drop function public.member_directory();
create function public.member_directory()
returns table (
  id uuid,
  name text,
  tier text,
  city_id uuid,
  bio text,
  interests text[],
  instagram text,
  open_to_connect boolean,
  is_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.tier, c.city_id, c.bio, c.interests,
    case when c.open_to_connect then c.instagram end,
    c.open_to_connect,
    c.id = public.current_member_contact_id()
  from public.contacts c
  where (public.is_member() or public.is_staff())
    and c.tier is not null
    and c.membership_status = 'active'
    and (c.show_in_directory or c.id = public.current_member_contact_id())
  order by c.name;
$$;
revoke execute on function public.member_directory() from anon, public;
grant execute on function public.member_directory() to authenticated;

-- Feed ----------------------------------------------------------------------------

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_contact_id uuid references public.contacts (id) on delete cascade,
  author_staff_id uuid references public.team_members (id) on delete cascade,
  city_id uuid references public.cities (id) on delete set null,
  parent_id uuid references public.posts (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  check (num_nonnulls(author_contact_id, author_staff_id) = 1)
);
create index posts_created_idx on public.posts (created_at desc);
create index posts_parent_idx on public.posts (parent_id);

alter table public.posts enable row level security;
create policy "Members and staff read the feed" on public.posts
  for select to authenticated using (public.is_member() or public.is_staff());
create policy "Members post as themselves" on public.posts
  for insert to authenticated with check (
    (author_contact_id = public.current_member_contact_id() and author_staff_id is null)
    or (author_staff_id = public.current_staff_id() and author_contact_id is null)
  );
create policy "Authors and admins delete posts" on public.posts
  for delete to authenticated using (
    author_contact_id = public.current_member_contact_id()
    or author_staff_id = public.current_staff_id()
    or public.has_role('admin')
  );

-- Who wrote each post, without exposing the contacts table.
create or replace function public.feed(p_limit int default 60)
returns table (
  id uuid,
  parent_id uuid,
  city_id uuid,
  body text,
  created_at timestamptz,
  author_name text,
  author_contact_id uuid,
  from_team boolean,
  mine boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.parent_id, p.city_id, p.body, p.created_at,
    coalesce(c.name, t.name || ' · The ARK team'),
    p.author_contact_id,
    p.author_staff_id is not null,
    p.author_contact_id = public.current_member_contact_id()
      or p.author_staff_id = public.current_staff_id()
  from public.posts p
  left join public.contacts c on c.id = p.author_contact_id
  left join public.team_members t on t.id = p.author_staff_id
  where public.is_member() or public.is_staff()
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 200);
$$;
revoke execute on function public.feed(int) from anon, public;
grant execute on function public.feed(int) to authenticated;

-- Direct messages between members -------------------------------------------------

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.contacts (id) on delete cascade,
  recipient_id uuid not null references public.contacts (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 4000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create index messages_pair_idx on public.messages (sender_id, recipient_id, created_at);
create index messages_recipient_idx on public.messages (recipient_id, created_at);

alter table public.messages enable row level security;
create policy "Members read their messages" on public.messages
  for select to authenticated using (
    public.current_member_contact_id() in (sender_id, recipient_id)
  );
create policy "Members message members who are open to it" on public.messages
  for insert to authenticated with check (
    sender_id = public.current_member_contact_id()
    and read_at is null
    and exists (
      select 1 from public.contacts r
      where r.id = recipient_id and r.tier is not null
        and r.membership_status = 'active'
        and (r.open_to_connect or exists (
          -- you can always reply to someone who wrote to you
          select 1 from public.messages m
          where m.sender_id = recipient_id and m.recipient_id = sender_id
        ))
    )
  );
create policy "Recipients mark messages read" on public.messages
  for update to authenticated
  using (recipient_id = public.current_member_contact_id())
  with check (recipient_id = public.current_member_contact_id());

alter publication supabase_realtime add table public.messages;
