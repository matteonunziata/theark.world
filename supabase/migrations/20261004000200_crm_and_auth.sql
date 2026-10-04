-- CRM (contacts, notes, pipelines, sequences) and the sign-in rules.

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'contact'
    check (type in ('contact', 'member', 'steward')),
  name text not null check (length(trim(name)) > 0),
  email extensions.citext unique,
  phone text,
  instagram text,
  location text,
  source text,
  interests text[] not null default '{}',
  tier text check (tier in (
    'founding', 'standard', 'annual', 'ambassador', 'day', 'week'
  )),
  membership_status text not null default 'active'
    check (membership_status in ('active', 'upcoming', 'paused', 'expired')),
  member_since date,
  renews_on date,
  lot text,
  resident boolean not null default false,
  owner_id uuid references public.team_members (id) on delete set null,
  user_id uuid unique references auth.users (id) on delete set null,
  created_by uuid references public.team_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contacts_owner_idx on public.contacts (owner_id);
create trigger contacts_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();

create table public.contact_notes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  author_id uuid references public.team_members (id) on delete set null,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create index contact_notes_contact_idx on public.contact_notes (contact_id);

create table public.contact_stages (
  contact_id uuid not null references public.contacts (id) on delete cascade,
  pipeline text not null check (pipeline in ('memberships', 'estate')),
  stage text not null,
  updated_at timestamptz not null default now(),
  primary key (contact_id, pipeline),
  check (
    (pipeline = 'memberships' and stage in (
      'waitlist', 'invited', 'applied', 'screening', 'approved', 'active'
    ))
    or (pipeline = 'estate' and stage in (
      'lead', 'qualified', 'visit', 'offer', 'reserved', 'contract', 'closed'
    ))
  )
);
create trigger contact_stages_updated_at before update on public.contact_stages
  for each row execute function public.set_updated_at();

create table public.pipeline_assignments (
  team_member_id uuid not null
    references public.team_members (id) on delete cascade,
  pipeline text not null check (pipeline in ('memberships', 'estate')),
  primary key (team_member_id, pipeline)
);

create table public.sequences (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger sequences_updated_at before update on public.sequences
  for each row execute function public.set_updated_at();

create table public.sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.sequences (id) on delete cascade,
  position int not null check (position >= 0),
  channel text not null default 'email' check (channel in ('email', 'whatsapp')),
  delay_days int not null default 0 check (delay_days >= 0),
  subject text,
  body text not null check (length(trim(body)) > 0),
  unique (sequence_id, position)
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  sequence_id uuid not null references public.sequences (id) on delete cascade,
  started_on date not null default current_date,
  status text not null default 'active'
    check (status in ('active', 'stopped', 'completed')),
  created_at timestamptz not null default now()
);
create unique index enrollments_one_active
  on public.enrollments (contact_id, sequence_id) where status = 'active';

create table public.enrollment_sends (
  enrollment_id uuid not null
    references public.enrollments (id) on delete cascade,
  step_position int not null,
  sent_on date not null default current_date,
  sent_by uuid references public.team_members (id) on delete set null,
  primary key (enrollment_id, step_position)
);

-- Access helpers -------------------------------------------------------------

-- Sales see contacts they own or that sit in a pipeline they're assigned to.
create or replace function public.can_read_contact(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin', 'lead')
    or (public.has_role('sales') and exists (
      select 1 from public.contacts c
      where c.id = cid and (
        c.owner_id = public.current_staff_id()
        or exists (
          select 1
          from public.contact_stages s
          join public.pipeline_assignments a
            on a.pipeline = s.pipeline
           and a.team_member_id = public.current_staff_id()
          where s.contact_id = c.id
        )
      )
    ));
$$;

create or replace function public.can_write_contact(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin')
    or (public.has_role('sales') and public.can_read_contact(cid));
$$;

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.contacts
    where user_id = auth.uid()
      and tier is not null
      and membership_status = 'active'
  );
$$;

create or replace function public.current_member_contact_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.contacts
  where user_id = auth.uid()
    and tier is not null
    and membership_status = 'active';
$$;

-- Members' directory: names only.
create or replace function public.member_directory()
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name from public.contacts c
  where (public.is_member() or public.is_staff())
    and c.tier is not null
    and c.membership_status = 'active'
  order by c.name;
$$;
revoke execute on function public.member_directory() from anon, public;
grant execute on function public.member_directory() to authenticated;

-- RLS ------------------------------------------------------------------------

alter table public.contacts enable row level security;
alter table public.contact_notes enable row level security;
alter table public.contact_stages enable row level security;
alter table public.pipeline_assignments enable row level security;
alter table public.sequences enable row level security;
alter table public.sequence_steps enable row level security;
alter table public.enrollments enable row level security;
alter table public.enrollment_sends enable row level security;

create policy "Read contacts" on public.contacts
  for select to authenticated using (public.can_read_contact(id));
create policy "Admins and sales add contacts" on public.contacts
  for insert to authenticated with check (
    public.has_role('admin')
    or (public.has_role('sales') and owner_id = public.current_staff_id())
  );
create policy "Write contacts" on public.contacts
  for update to authenticated
  using (public.can_write_contact(id))
  with check (
    public.has_role('admin')
    or (public.has_role('sales') and owner_id = public.current_staff_id())
  );
create policy "Admins delete contacts" on public.contacts
  for delete to authenticated using (public.has_role('admin'));

create policy "Read notes" on public.contact_notes
  for select to authenticated using (public.can_read_contact(contact_id));
create policy "Add notes" on public.contact_notes
  for insert to authenticated with check (
    public.can_write_contact(contact_id)
    and author_id = public.current_staff_id()
  );
create policy "Admins delete notes" on public.contact_notes
  for delete to authenticated using (public.has_role('admin'));

create policy "Read stages" on public.contact_stages
  for select to authenticated using (public.can_read_contact(contact_id));
create policy "Write stages" on public.contact_stages
  for all to authenticated
  using (public.can_write_contact(contact_id))
  with check (public.can_write_contact(contact_id));

create policy "Staff read assignments" on public.pipeline_assignments
  for select to authenticated using (public.is_staff());
create policy "Admins write assignments" on public.pipeline_assignments
  for all to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "Read sequences" on public.sequences
  for select to authenticated using (public.has_role('admin', 'lead', 'sales'));
create policy "Write sequences" on public.sequences
  for all to authenticated
  using (public.has_role('admin', 'sales'))
  with check (public.has_role('admin', 'sales'));

create policy "Read steps" on public.sequence_steps
  for select to authenticated using (public.has_role('admin', 'lead', 'sales'));
create policy "Write steps" on public.sequence_steps
  for all to authenticated
  using (public.has_role('admin', 'sales'))
  with check (public.has_role('admin', 'sales'));

create policy "Read enrollments" on public.enrollments
  for select to authenticated using (public.can_read_contact(contact_id));
create policy "Write enrollments" on public.enrollments
  for all to authenticated
  using (public.can_write_contact(contact_id))
  with check (public.can_write_contact(contact_id));

create policy "Read sends" on public.enrollment_sends
  for select to authenticated using (
    public.can_read_contact(
      (select contact_id from public.enrollments where id = enrollment_id)
    )
  );
create policy "Write sends" on public.enrollment_sends
  for all to authenticated
  using (
    public.can_write_contact(
      (select contact_id from public.enrollments where id = enrollment_id)
    )
  )
  with check (
    public.can_write_contact(
      (select contact_id from public.enrollments where id = enrollment_id)
    )
  );

-- Sign-in rules (Supabase "before user created" hook) ------------------------
-- Google: only @theark.world, and only people added in Settings > Team.
-- Email magic link: only contacts with an active membership, never staff.

create or replace function public.is_ark_email(email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(coalesce(email, '')) ~ '^[^@\s]+@theark\.world$';
$$;

create or replace function public.auth_reject(message text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'error', jsonb_build_object('http_code', 403, 'message', message)
  );
$$;

create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  provider text := event -> 'user' -> 'app_metadata' ->> 'provider';
  email text := lower(coalesce(event -> 'user' ->> 'email', ''));
  hd text := event -> 'user' -> 'user_metadata' -> 'custom_claims' ->> 'hd';
begin
  if provider = 'google' then
    if public.is_ark_email(email) is not true
      or coalesce(hd, 'theark.world') <> 'theark.world' then
      return public.auth_reject(
        'Sign in with your @theark.world Google account.'
      );
    end if;
    if not exists (
      select 1 from public.team_members
      where lower(team_members.email::text) = email and status = 'active'
    ) then
      return public.auth_reject(
        'You haven''t been added to ARK OS yet. Ask an admin to add you in Settings, Team.'
      );
    end if;
    return '{}'::jsonb;
  end if;

  if provider = 'email' then
    if public.is_ark_email(email) then
      return public.auth_reject('Team members sign in with Google.');
    end if;
    if not exists (
      select 1 from public.contacts
      where lower(contacts.email::text) = email
        and tier is not null
        and membership_status = 'active'
    ) then
      return public.auth_reject(
        'This email isn''t on an active membership. Write to us and we''ll sort it out.'
      );
    end if;
    return '{}'::jsonb;
  end if;

  return public.auth_reject('This sign-in method isn''t available.');
end;
$$;

grant execute on function public.hook_before_user_created(jsonb)
  to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb)
  from authenticated, anon, public;

-- When an auth user is created, link them to their team or member record.
create or replace function public.link_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.team_members set user_id = new.id
  where lower(email::text) = lower(new.email) and user_id is null;
  update public.contacts set user_id = new.id
  where lower(email::text) = lower(new.email) and user_id is null
    and not public.is_ark_email(new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.link_new_auth_user();

-- And the other way round: a contact added after their login exists.
create or replace function public.link_contact_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is not null and new.user_id is null
    and not public.is_ark_email(new.email::text) then
    select u.id into new.user_id
    from auth.users u
    where lower(u.email) = lower(new.email::text);
  end if;
  return new;
end;
$$;

create trigger contacts_link_user
  before insert or update of email on public.contacts
  for each row execute function public.link_contact_user();
