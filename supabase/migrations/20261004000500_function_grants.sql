-- Tighten who can call what. Policy helpers only need EXECUTE for the roles
-- whose policies call them; trigger functions need none.

revoke execute on function
  public.link_team_member_user(),
  public.link_new_auth_user(),
  public.link_contact_user(),
  public.apply_stock_movement()
from anon, authenticated, public;

revoke execute on function
  public.current_staff_id(),
  public.staff_role(),
  public.staff_division(),
  public.is_staff(),
  public.has_role(text[]),
  public.can_read_contact(uuid),
  public.can_write_contact(uuid),
  public.is_member(),
  public.current_member_contact_id(),
  public.is_facilitator_of(uuid),
  public.can_manage_offering(uuid),
  public.can_check_in(uuid)
from anon, public;

grant execute on function
  public.current_staff_id(),
  public.staff_role(),
  public.staff_division(),
  public.is_staff(),
  public.has_role(text[]),
  public.can_read_contact(uuid),
  public.can_write_contact(uuid),
  public.is_member(),
  public.current_member_contact_id(),
  public.is_facilitator_of(uuid),
  public.can_manage_offering(uuid),
  public.can_check_in(uuid)
to authenticated;

-- Anonymous visitors read published open events, whose policy calls this.
grant execute on function public.can_view_offering(uuid) to anon, authenticated;
