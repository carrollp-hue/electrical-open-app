(() => {
  const sameScores = (first, second) => Array.isArray(first) && Array.isArray(second) && first.length === 18 && second.length === 18 && first.every((value, index) => Number(value) === Number(second[index]));
  const displayName = person => `${person?.first_name || ''} ${person?.surname || ''}`.trim() || 'Unknown player';
  const participantFor = (fixtureId, playerId) => (state.fixtureParticipants || []).find(item => item.fixture_id === fixtureId && item.player_id === playerId);
  const nearest = value => value < 0 ? Math.ceil(value - .5) : Math.floor(value + .5);
  const playingFor = (fixture, course, playerId) => {
    const participant = participantFor(fixture.id, playerId), index = participant?.handicap_index_override ?? snapshot(playerId)?.index_value;
    if (index == null || !course) return null;
    const courseHandicap = nearest((Number(index) * Number(course.slope_rating) / 113) + Number(course.course_rating) - Number(course.par));
    return participant?.playing_handicap_override ?? Math.min(28, nearest(courseHandicap * Number(fixture.handicap_allowance || 1)));
  };
  const scoreTotals = (scores, playing, course) => {
    if (!Array.isArray(scores) || scores.length !== 18 || playing == null) return null;
    let gross = 0, nett = 0, points = 0;
    const card = holes(course.id);
    if (card.length !== 18) return null;
    card.forEach((hole, index) => {
      const shot = Number(scores[index]);
      const strokes = Math.floor(playing / 18) + (Number(hole.stroke_index) <= playing % 18 ? 1 : 0);
      gross += shot; nett += shot - strokes; points += Math.max(0, 2 + Number(hole.par) - (shot - strokes));
    });
    return { gross, nett, points };
  };
  const currentFixtureId = () => (location.hash.match(/^#fixtures\/([^/]+)/) || [])[1];

  const provisionalCandidates = (cards, playerId) => {
    const own = cards.find(card => card.scorer_player_id === playerId && card.own_status === 'submitted');
    const markers = cards.filter(card => card.marked_player_id === playerId && card.marked_status === 'submitted');
    const ownCandidate = own && { scores: own.own_scores, playing: own.own_playing_handicap, source: 'own' };
    const markerCandidates = markers.map(card => ({ scores: card.marked_scores, playing: card.marked_playing_handicap, source: 'marker' }));
    if (!ownCandidate && !markerCandidates.length) return null;
    if (!ownCandidate) return { ...markerCandidates[0], verified: false, conflict: markerCandidates.some(item => !sameScores(item.scores, markerCandidates[0].scores)), note: 'Awaiting player card' };
    if (!markerCandidates.length) return { ...ownCandidate, verified: false, conflict: false, note: 'Awaiting marker' };
    const conflict = markerCandidates.some(item => !sameScores(item.scores, ownCandidate.scores));
    if (conflict) return { ...markerCandidates[0], verified: false, conflict: true, note: 'Scores differ' };
    return { ...ownCandidate, verified: true, conflict: false, note: 'Verified' };
  };

  const hydrateLiveResults = async fixtureId => {
    const fixture = state.fixtures.find(item => item.id === fixtureId), course = setup(fixture?.course_setup_id);
    const table = document.querySelector('#app .table');
    if (!fixture || !course || !table || (!state.isStaff && !participantFor(fixtureId, player()?.id))) return;
    const { data: cards, error } = await client.rpc('fixture_paired_scorecards_for_results', { p_fixture_id: fixtureId });
    if (error) return;
    const people = (state.fixtureParticipants || []).filter(item => item.fixture_id === fixtureId).map(item => {
      const entry = state.entries.find(itemEntry => itemEntry.fixture_id === fixtureId && itemEntry.player_id === item.player_id);
      const provisional = entry ? null : provisionalCandidates(cards || [], item.player_id);
      const totals = provisional && scoreTotals(provisional.scores, provisional.playing ?? playingFor(fixture, course, item.player_id), course);
      return { ...item, entry, provisional, totals };
    });
    people.sort((a, b) => Number(b.entry?.stableford_points ?? b.totals?.points ?? -1) - Number(a.entry?.stableford_points ?? a.totals?.points ?? -1) || `${a.players?.surname}`.localeCompare(`${b.players?.surname}`));
    const header = table.querySelector('thead');
    if (!header || header.textContent.replace(/\s+/g, ' ').trim().indexOf('OOM') < 0) return;
    const rows = people.map(item => {
      const index = item.handicap_index_override ?? snapshot(item.player_id)?.index_value;
      const official = item.entry;
      const provisional = item.provisional, totals = item.totals;
      const result = official ? { gross: official.gross_score, nett: official.nett_score, points: official.stableford_points, position: official.competition_position, oom: fixture.status === 'completed' ? official.order_of_merit_points : '—' } : totals ? { gross: totals.gross, nett: totals.nett, points: totals.points, position: '—', oom: '—' } : { gross: '—', nett: '—', points: '—', position: '—', oom: '—' };
      const rowClass = provisional?.conflict ? 'provisional-result provisional-conflict' : provisional && !provisional.verified ? 'provisional-result' : '';
      const flag = provisional?.conflict ? ' <span class="result-warning" title="Submitted scores differ">!</span>' : '';
      const playerName = `${esc(displayName(item.players))}${item.is_guest ? ' (Guest)' : ''}`;
      const playerCell = official?.id ? `<a class="text-link" href="#scorecard/${official.id}">${playerName}</a>` : playerName;
      return `<tr class="${rowClass}"><td>${result.position ?? '—'}</td><td>${playerCell}${flag}</td><td>${index == null ? '—' : Number(index).toFixed(1)}</td><td>${index == null ? '—' : playingFor(fixture, course, item.player_id)}</td><td>${result.gross == null ? 'NR' : result.gross}</td><td>${result.nett ?? '—'}</td><td>${result.points ?? '—'}</td><td>${result.oom}</td></tr>`;
    }).join('');
    table.querySelector('tbody').innerHTML = rows;
    if (!document.querySelector('#live-results-note')) table.insertAdjacentHTML('afterend', '<p class="intro" id="live-results-note">Submitted member scores are provisional until verified. A red ! means the submitted cards differ. Order of Merit points are awarded only when the fixture is committed.</p>');
  };

  const showFinishChecklist = async fixtureId => {
    const list = document.querySelector('#finish-fixture-checklist');
    if (!fixtureId || !list) return;
    list.innerHTML = '<p>Checking official scorecards…</p>';
    const { data, error } = await client.from('fixture_entries').select('id, player_id, score_status').eq('fixture_id', fixtureId);
    if (error) return void (list.innerHTML = '<p>Unable to check scorecard status.</p>');
    const entries = new Map((data || []).map(item => [item.player_id, item]));
    const entryIds = (data || []).map(item => item.id);
    const scores = entryIds.length ? await client.from('hole_scores').select('fixture_entry_id').in('fixture_entry_id', entryIds) : { data: [] };
    const counts = (scores.data || []).reduce((map, item) => map.set(item.fixture_entry_id, (map.get(item.fixture_entry_id) || 0) + 1), new Map());
    const people = (state.fixtureParticipants || []).filter(item => item.fixture_id === fixtureId).sort((a, b) => `${a.players?.surname}`.localeCompare(`${b.players?.surname}`));
    list.innerHTML = `<h3>Official scorecard checklist</h3>${people.map(item => { const entry = entries.get(item.player_id), complete = entry?.score_status === 'completed' && counts.get(entry.id) === 18, nr = entry?.score_status === 'non_return'; return `<div class="finish-check-row"><span>${esc(displayName(item.players))}${item.is_guest ? ' (Guest)' : ''}</span>${complete ? '<strong class="finish-ok">Official scorecard complete</strong>' : nr ? '<strong class="finish-ok">Non Return</strong>' : `<span class="finish-actions"><button class="secondary" type="button" data-finish-score="${item.player_id}">Enter score</button><button class="secondary" type="button" data-finish-nr="${item.player_id}">Record NR</button></span>`}</div>`; }).join('')}`;
  };
  const improveFinishWorkflow = () => {
    const panel = document.querySelector('#app .admin-panel'), card = document.querySelector('#non-return-form')?.closest('.admin-card');
    if (!state.isStaff || location.hash !== '#admin/scores' || !panel || !card) return;
    if (card.id !== 'finish-fixture-card') {
      card.id = 'finish-fixture-card';
      card.querySelector('h2').textContent = 'Finish fixture';
      card.insertAdjacentHTML('afterbegin', `<p>Enter official paper scorecards or NRs here. Member cards shown on the fixture page are verification evidence only.</p><label>Fixture checklist<select id="finish-fixture-select"><option value="">Select fixture</option>${state.fixtures.filter(item => !['completed', 'archived'].includes(item.status)).map(item => `<option value="${item.id}">${date(item.fixture_date)} · ${esc(item.name)}</option>`).join('')}</select></label><div id="finish-fixture-checklist"><p>Select a fixture to see outstanding official scorecards.</p></div>`);
    }
    const commitForm = document.querySelector('#commit-fixture-form');
    if (commitForm) { const commitCard = commitForm.closest('.admin-card'); card.append(commitForm); commitCard?.remove(); }
    const select = document.querySelector('#finish-fixture-select');
    if (select?.dataset.bound) return;
    select.dataset.bound = 'true';
    select.addEventListener('change', event => showFinishChecklist(event.target.value));
    card.addEventListener('click', event => {
      const score = event.target.closest('[data-finish-score]'), nr = event.target.closest('[data-finish-nr]'), fixtureId = select?.value;
      if (!fixtureId || (!score && !nr)) return;
      const formSelect = document.querySelector(score ? '#scorecard-fixture' : '#non-return-fixture');
      const playerSelect = document.querySelector(score ? '#scorecard-player' : '#non-return-player');
      formSelect.value = fixtureId; formSelect.dispatchEvent(new Event('change'));
      setTimeout(() => { playerSelect.value = (score || nr).dataset.finishScore || (score || nr).dataset.finishNr; playerSelect.dispatchEvent(new Event('change')); playerSelect.closest('form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 0);
    });
  };
  const refresh = () => { improveFinishWorkflow(); const id = currentFixtureId(); if (id) setTimeout(() => hydrateLiveResults(id), 0); };
  const originalRender = render;
  render = function () { originalRender(); refresh(); };
  window.addEventListener('hashchange', refresh);
  new MutationObserver(improveFinishWorkflow).observe(document.querySelector('#app'), { childList: true, subtree: true });
  refresh();
})();
