-- Save a sequence and its steps in one transaction (runs with the caller's
-- permissions, so RLS still decides who may write).

create or replace function public.save_sequence(
  p_id uuid,
  p_name text,
  p_description text,
  p_steps jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := p_id;
begin
  if jsonb_typeof(p_steps) <> 'array' or jsonb_array_length(p_steps) = 0 then
    raise exception 'Add at least one step with a message.' using errcode = 'P0001';
  end if;

  if v_id is null then
    insert into public.sequences (name, description)
    values (p_name, p_description)
    returning id into v_id;
  else
    update public.sequences
    set name = p_name, description = p_description
    where id = v_id;
    if not found then
      raise exception 'Sequence not found.' using errcode = 'P0001';
    end if;
    delete from public.sequence_steps where sequence_id = v_id;
  end if;

  insert into public.sequence_steps
    (sequence_id, position, channel, delay_days, subject, body)
  select v_id, (s.ord - 1)::int,
    coalesce(s.step ->> 'channel', 'email'),
    greatest(0, coalesce((s.step ->> 'delay_days')::int, 0)),
    nullif(trim(s.step ->> 'subject'), ''),
    s.step ->> 'body'
  from jsonb_array_elements(p_steps) with ordinality as s(step, ord);

  return v_id;
end;
$$;
revoke execute on function public.save_sequence(uuid, text, text, jsonb)
  from anon, public;
grant execute on function public.save_sequence(uuid, text, text, jsonb)
  to authenticated;
