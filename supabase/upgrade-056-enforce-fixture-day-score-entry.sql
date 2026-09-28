-- Member paired scorecards may be entered only on the fixture day.  Staff
-- retain access so they can correct, verify and complete results afterwards.
update public.fixtures
set score_entry_day_only = true
where score_entry_day_only = false;

create or replace function public.validate_member_scorecard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_enabled boolean;
  v_day_only boolean;
  v_fixture_date date;
begin
  select member_scoring_enabled, score_entry_day_only, fixture_date
  into v_enabled, v_day_only, v_fixture_date
  from public.fixtures
  where id = new.fixture_id;

  if not coalesce(v_enabled, false) and not public.is_staff() then
    raise exception 'Member score entry is not enabled for this fixture';
  end if;

  if coalesce(v_day_only, false)
    and (now() at time zone 'Europe/London')::date <> v_fixture_date
    and not public.is_staff() then
    raise exception 'Member score entry is available only on the fixture day';
  end if;

  if new.scorer_player_id = new.marked_player_id then
    raise exception 'You cannot mark your own scorecard';
  end if;
  if not public.is_staff() and new.scorer_player_id <> public.current_player_id() then
    raise exception 'You may only enter your own paired scorecard';
  end if;
  if not exists (select 1 from public.fixture_participants where fixture_id = new.fixture_id and player_id = new.scorer_player_id) then
    raise exception 'You must be a participant in this fixture';
  end if;
  if new.marked_player_id is not null and not exists (select 1 from public.fixture_participants where fixture_id = new.fixture_id and player_id = new.marked_player_id) then
    raise exception 'Player A must be a participant in this fixture';
  end if;
  if new.own_status = 'submitted' and (jsonb_typeof(new.own_scores) <> 'array' or jsonb_array_length(new.own_scores) <> 18) then
    raise exception 'Enter all 18 of your scores before submitting';
  end if;
  if new.own_status = 'submitted' and exists (
    select 1 from jsonb_array_elements_text(new.own_scores) as score(value)
    where score.value is null or score.value !~ '^(?:0|[1-9]|1[0-9]|20)$'
  ) then raise exception 'Your scorecard contains an invalid hole score'; end if;
  if new.marked_status = 'submitted' and (new.marked_player_id is null or jsonb_typeof(new.marked_scores) <> 'array' or jsonb_array_length(new.marked_scores) <> 18) then
    raise exception 'Choose Player A and enter all 18 scores before submitting';
  end if;
  if new.marked_status = 'submitted' and exists (
    select 1 from jsonb_array_elements_text(new.marked_scores) as score(value)
    where score.value is null or score.value !~ '^(?:0|[1-9]|1[0-9]|20)$'
  ) then raise exception 'Player A scorecard contains an invalid hole score'; end if;
  if TG_OP = 'UPDATE' and not public.is_staff() then
    if old.own_status = 'submitted' and (new.own_scores is distinct from old.own_scores or new.own_status is distinct from old.own_status) then
      raise exception 'Your submitted scorecard is locked; ask a score administrator to amend it';
    end if;
    if old.marked_status = 'submitted' and (new.marked_scores is distinct from old.marked_scores or new.marked_player_id is distinct from old.marked_player_id or new.marked_status is distinct from old.marked_status) then
      raise exception 'Your submitted marker scorecard is locked; ask a score administrator to amend it';
    end if;
  end if;
  new.updated_at := now();
  if new.own_status = 'submitted' and new.own_submitted_at is null then new.own_submitted_at := now(); end if;
  if new.marked_status = 'submitted' and new.marked_submitted_at is null then new.marked_submitted_at := now(); end if;
  return new;
end $$;
