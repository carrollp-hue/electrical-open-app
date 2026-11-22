-- Remove the disposable test login again after invitation-link testing.
-- Preserve the player record so it can be invited afresh.

do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower('electricalgolfsociety@gmail.com');

  if v_user_id is null then
    raise exception 'Test login electricalgolfsociety@gmail.com was not found.';
  end if;

  update public.players set profile_id = null where profile_id = v_user_id;
  delete from public.push_subscriptions where profile_id = v_user_id;
  delete from public.user_roles where user_id = v_user_id;
  delete from public.profiles where id = v_user_id;
  delete from auth.users where id = v_user_id;
end;
$$;
