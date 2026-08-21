create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin') $$;

drop policy if exists "Members see published fixtures" on public.fixtures;
create policy "Members see published fixtures" on public.fixtures for select to authenticated
using (status in ('published', 'completed', 'archived') or public.is_staff());

drop policy if exists "Members see permitted results" on public.fixture_entries;
create policy "Members see permitted results" on public.fixture_entries for select to authenticated using (
  public.is_staff()
  or exists (select 1 from public.players p where p.id = player_id and p.profile_id = auth.uid())
  or exists (select 1 from public.fixtures f where f.id = fixture_id and f.status in ('published', 'completed', 'archived'))
);

drop policy if exists "Members view permitted hole scores" on public.hole_scores;
create policy "Members view permitted hole scores" on public.hole_scores for select to authenticated using (
  public.is_staff()
  or exists (
    select 1 from public.fixture_entries e
    join public.players p on p.id = e.player_id
    join public.fixtures f on f.id = e.fixture_id
    where e.id = fixture_entry_id and (p.profile_id = auth.uid() or f.status in ('published', 'completed', 'archived'))
  )
);

create or replace function public.commit_fixture(p_fixture_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Administrator access is required'; end if;
  if not exists (select 1 from public.fixtures where id = p_fixture_id and scores_finalized_at is not null and status <> 'archived') then
    raise exception 'Finalize the fixture before committing it';
  end if;
  if not exists (select 1 from public.fixture_participants where fixture_id = p_fixture_id) then
    raise exception 'Add at least one participant before committing the fixture';
  end if;
  if exists (
    select 1 from public.fixture_participants fp
    left join public.fixture_entries e on e.fixture_id = fp.fixture_id and e.player_id = fp.player_id
    where fp.fixture_id = p_fixture_id
      and (e.id is null or (e.score_status = 'completed' and (select count(*) from public.hole_scores hs where hs.fixture_entry_id = e.id) <> 18))
  ) then
    raise exception 'Every participant needs a complete scorecard or a Non Return before committing';
  end if;
  update public.fixtures
  set status = 'completed', published_at = coalesce(published_at, now())
  where id = p_fixture_id;
end $$;

revoke all on function public.commit_fixture(uuid) from public;
grant execute on function public.commit_fixture(uuid) to authenticated;
