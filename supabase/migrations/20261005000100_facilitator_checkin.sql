-- Facilitator sign-in, member photos, and the class roster facilitators
-- check people in from.

-- Member photos ------------------------------------------------------------------

alter table public.contacts add column photo_path text;

-- Public bucket, like covers. Paths are random, and members write only
-- inside a folder named after their own user id.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Members upload their photo" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Members replace their photo" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Members remove their photo" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create or replace function public.set_my_photo(p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.current_member_contact_id();
  v_path text := nullif(trim(coalesce(p_path, '')), '');
begin
  if me is null then
    raise exception 'Only members can add a profile photo.' using errcode = '42501';
  end if;
  if v_path is not null and split_part(v_path, '/', 1) <> auth.uid()::text then
    raise exception 'Upload the photo again.' using errcode = 'P0001';
  end if;
  update public.contacts set photo_path = v_path where id = me;
end;
$$;
revoke execute on function public.set_my_photo(text) from anon, public;
grant execute on function public.set_my_photo(text) to authenticated;

-- Roster ---------------------------------------------------------------------------
-- Who's booked into one session, with their photo. Facilitators can't read
-- the CRM, so this returns only what the door needs.

create or replace function public.session_roster(p_offering_id uuid, p_date date)
returns table (
  registration_id uuid,
  name text,
  photo_path text,
  tier text,
  is_member boolean,
  source text,
  paid boolean,
  qr_token text,
  checked_in_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, coalesce(c.name, r.name), c.photo_path, c.tier,
    coalesce(c.tier is not null and c.membership_status = 'active', false),
    r.source, r.paid, r.qr_token, r.checked_in_at
  from public.registrations r
  left join public.contacts c on c.id = r.contact_id
  where r.offering_id = p_offering_id
    and r.session_date = p_date
    and (
      public.can_check_in(p_offering_id)
      or public.has_role('admin', 'lead', 'sales')
    )
  order by lower(coalesce(c.name, r.name));
$$;
revoke execute on function public.session_roster(uuid, date) from anon, public;
grant execute on function public.session_roster(uuid, date) to authenticated;

-- Facilitator sign-in -------------------------------------------------------------
-- Facilitators often don't have an @theark.world address, so an active team
-- member with the facilitator role can sign in by email link with any email.

create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider text := event -> 'user' -> 'app_metadata' ->> 'provider';
  v_email text := lower(coalesce(event -> 'user' ->> 'email', ''));
  v_hd text := event -> 'user' -> 'user_metadata' -> 'custom_claims' ->> 'hd';
begin
  if v_provider = 'google' then
    if public.is_ark_email(v_email) is not true
      or coalesce(v_hd, 'theark.world') <> 'theark.world' then
      return public.auth_reject(
        'Sign in with your @theark.world Google account.'
      );
    end if;
    if not exists (
      select 1 from public.team_members t
      where lower(t.email::text) = v_email and t.status = 'active'
    ) then
      return public.auth_reject(
        'You haven''t been added to ARK OS yet. Ask an admin to add you in Settings, Team.'
      );
    end if;
    return '{}'::jsonb;
  end if;

  if v_provider = 'email' then
    if exists (
      select 1 from public.team_members t
      where lower(t.email::text) = v_email
        and t.status = 'active' and t.role = 'facilitator'
    ) then
      return '{}'::jsonb;
    end if;
    if public.is_ark_email(v_email) then
      return public.auth_reject('Team members sign in with Google.');
    end if;
    if not exists (
      select 1 from public.contacts c
      where lower(c.email::text) = v_email
        and c.tier is not null
        and c.membership_status = 'active'
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

-- The signed-in member's own photo, for the portal profile.
create or replace function public.my_photo()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select photo_path from public.contacts
  where id = public.current_member_contact_id();
$$;
revoke execute on function public.my_photo() from anon, public;
grant execute on function public.my_photo() to authenticated;
