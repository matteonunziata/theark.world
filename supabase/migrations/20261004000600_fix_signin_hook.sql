-- Rename hook variables that clashed with column names.

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
