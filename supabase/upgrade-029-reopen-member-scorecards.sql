-- Allows only a full administrator to reopen one submitted half of a paired scorecard.
-- Scores are kept, but its submitted timestamp is cleared so it awaits resubmission.
create or replace function public.reopen_member_scorecard_half(
  p_fixture_id uuid,
  p_scorer_player_id uuid,
  p_half text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Full administrator access is required to reopen a scorecard';
  end if;
  if p_half not in ('own', 'marked') then
    raise exception 'Scorecard half must be own or marked';
  end if;
  if p_half = 'own' then
    update public.member_scorecards
    set own_status = 'draft', own_submitted_at = null
    where fixture_id = p_fixture_id and scorer_player_id = p_scorer_player_id and own_status = 'submitted';
  else
    update public.member_scorecards
    set marked_status = 'draft', marked_submitted_at = null
    where fixture_id = p_fixture_id and scorer_player_id = p_scorer_player_id and marked_status = 'submitted';
  end if;
  if not found then
    raise exception 'That submitted scorecard half could not be found';
  end if;
end;
$$;

revoke all on function public.reopen_member_scorecard_half(uuid, uuid, text) from public;
grant execute on function public.reopen_member_scorecard_half(uuid, uuid, text) to authenticated;
