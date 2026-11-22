alter table public.players
  add column if not exists is_test boolean not null default false;

drop policy if exists "Members may view the player directory" on public.players;
create policy "Members may view the player directory" on public.players
  for select to authenticated
  using (not is_test or profile_id = auth.uid() or public.is_staff());

do $$
declare
  v_player_id uuid;
begin
  select p.id
    into v_player_id
    from public.players p
    join auth.users u on u.id = p.profile_id
   where lower(u.email) = 'electricalgolfsociety@gmail.com'
   limit 1;

  if v_player_id is null then
    select id
      into v_player_id
      from public.players
     where lower(first_name) = 'test'
       and lower(surname) = 'member'
     limit 1;
  end if;

  if v_player_id is null then
    raise exception 'Test Member player record was not found.';
  end if;

  update public.players
     set is_test = true
   where id = v_player_id;

  delete from public.season_members
   where player_id = v_player_id;
end $$;
