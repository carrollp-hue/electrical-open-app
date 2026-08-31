(() => {
  let active = null, saveTimer, activeAssignments = [];
  const fixtureFor = id => state.fixtures.find(item => item.id === id);
  const participant = (fixtureId, playerId) => (state.fixtureParticipants || []).find(item => item.fixture_id === fixtureId && item.player_id === playerId);
  const nearestHandicap = value => value < 0 ? Math.ceil(value - .5) : Math.floor(value + .5);
  const courseHandicapFor = (index, course) => nearestHandicap((Number(index) * Number(course.slope_rating) / 113) + Number(course.course_rating) - Number(course.par));
  const playingHandicapFor = (index, fixture, course) => Math.min(28, nearestHandicap(courseHandicapFor(index, course) * Number(fixture.handicap_allowance || 1)));
  const indexFor = (fixtureId, playerId) => {
    const override = participant(fixtureId, playerId)?.handicap_index_override;
    if (override != null) return Number(override);
    const person = state.memberDirectory.find(item => item.id === playerId);
    const society = state.snapshots.find(item => item.player_id === playerId)?.index_value;
    const values = [society, person?.club_handicap].filter(value => value != null).map(Number);
    return values.length ? Math.min(...values) : null;
  };
  const playingFor = (fixtureId, playerId, index, fixture, course) => {
    const override = participant(fixtureId, playerId)?.playing_handicap_override;
    return override != null ? Number(override) : playingHandicapFor(index, fixture, course);
  };
  const strokesAt = (playing, si) => Math.floor(playing / 18) + (si <= playing % 18 ? 1 : 0);
  const scores = key => [...document.querySelectorAll(`[data-paired-score="${key}"]`)].map(input => input.value === '' ? null : Number(input.value));
  const complete = values => values.length === 18 && values.every(value => Number.isInteger(value) && value >= 1 && value <= 20);
  const displayName = person => `${person?.first_name || ''} ${person?.surname || ''}`.trim();
  const initialsFor = person => `${person?.first_name?.[0] || ''}${person?.surname?.[0] || ''}`.toUpperCase() || '—';

  const updateCalculations = () => {
    const summary = document.querySelector('#paired-index-summary');
    try {
      const fixture = fixtureFor(active?.fixture_id), course = setup(fixture?.course_setup_id), current = player(), markedId = document.querySelector('#paired-player-a')?.value;
      if (!fixture || !course || !current) throw new Error('fixture, course, or signed-in player is missing');
      const ownIndex = indexFor(fixture.id, current.id), markedIndex = markedId && indexFor(fixture.id, markedId), ownPlaying = ownIndex == null ? null : playingFor(fixture.id, current.id, ownIndex, fixture, course), markedPlaying = markedIndex == null ? null : playingFor(fixture.id, markedId, markedIndex, fixture, course);
      if (summary) summary.textContent = `You: ${ownIndex?.toFixed(1) ?? '—'} index · ${ownPlaying ?? '—'} playing | Player A: ${markedIndex?.toFixed(1) ?? '—'} index · ${markedPlaying ?? '—'} playing`;
      const ownScores = scores('own'), markedScores = scores('marked');
      const totals = {
        out: { par: 0, ownShots: 0, ownPoints: 0, markedShots: 0, markedPoints: 0, ownEntered: false, markedEntered: false },
        in: { par: 0, ownShots: 0, ownPoints: 0, markedShots: 0, markedPoints: 0, ownEntered: false, markedEntered: false },
      };
      holes(course.id).forEach((hole, index) => {
        const own = ownScores[index], marked = markedScores[index];
        const ownPoints = own == null || ownPlaying == null ? null : Math.max(0, 2 + Number(hole.par) - (own - strokesAt(ownPlaying, hole.stroke_index)));
        const markedPoints = marked == null || markedPlaying == null ? null : Math.max(0, 2 + Number(hole.par) - (marked - strokesAt(markedPlaying, hole.stroke_index)));
        const half = index < 9 ? totals.out : totals.in;
        half.par += Number(hole.par);
        if (own != null) { half.ownShots += own; half.ownPoints += ownPoints || 0; half.ownEntered = true; }
        if (marked != null) { half.markedShots += marked; half.markedPoints += markedPoints || 0; half.markedEntered = true; }
        const ownCell = document.querySelector(`[data-paired-points="own-${index + 1}"]`), markedCell = document.querySelector(`[data-paired-points="marked-${index + 1}"]`);
        if (ownCell) ownCell.textContent = ownPoints ?? '—';
        if (markedCell) markedCell.textContent = markedPoints ?? '—';
      });
      const combined = {
        par: totals.out.par + totals.in.par,
        ownShots: totals.out.ownShots + totals.in.ownShots,
        ownPoints: totals.out.ownPoints + totals.in.ownPoints,
        markedShots: totals.out.markedShots + totals.in.markedShots,
        markedPoints: totals.out.markedPoints + totals.in.markedPoints,
        ownEntered: totals.out.ownEntered || totals.in.ownEntered,
        markedEntered: totals.out.markedEntered || totals.in.markedEntered,
      };
      [['out', totals.out], ['in', totals.in], ['total', combined]].forEach(([label, value]) => {
        const set = (field, content) => { const cell = document.querySelector(`#paired-${label}-${field}`); if (cell) cell.textContent = content; };
        set('par', value.par);
        set('own-shots', value.ownEntered ? value.ownShots : '—');
        set('own-points', value.ownEntered ? value.ownPoints : '—');
        set('marked-shots', value.markedEntered ? value.markedShots : '—');
        set('marked-points', value.markedEntered ? value.markedPoints : '—');
      });
      ['par', 'own-shots', 'own-points', 'marked-shots', 'marked-points'].forEach(field => {
        const source = document.querySelector(`#paired-out-${field}`), target = document.querySelector(`#paired-out-repeat-${field}`);
        if (source && target) target.textContent = source.textContent;
      });
    } catch (error) {
      console.error('Paired scorecard calculation failed:', error);
      if (summary) summary.textContent = `Points unavailable: ${error.message}`;
    }
  };

  const differences = (first = [], second = []) => first.length === 18 && second.length === 18 ? first.map((value, index) => Number(value) === Number(second[index]) ? null : index + 1).filter(Boolean) : [];
  const compare = async () => {
    const target = document.querySelector('#paired-verification'), current = player();
    if (!target || !active?.fixture_id || !current) return;
    const note = document.querySelector('#paired-comparison');
    if (note) { note.className = 'paired-comparison'; note.textContent = 'Verification compares submitted own scores with any submitted card that marks that player.'; }
    const { data, error } = await client.from('member_scorecards').select('scorer_player_id, marked_player_id, own_scores, marked_scores, own_status, marked_status').eq('fixture_id', active.fixture_id);
    if (error) return void (target.innerHTML = '<h3>Scorecard verification</h3><p>Verification is unavailable at the moment.</p>');
    const cards = data || [], nameOf = playerId => displayName(state.memberDirectory.find(person => person.id === playerId));
    const ownMarkers = cards.filter(card => card.marked_player_id === current.id && card.marked_status === 'submitted');
    let ownStatus;
    if (active.own_status !== 'submitted') ownStatus = '<li><strong>Your card:</strong> still a draft.</li>';
    else if (!ownMarkers.length) ownStatus = '<li><strong>Your card:</strong> waiting for another player to submit a card marking you.</li>';
    else {
      const conflicts = ownMarkers.flatMap(card => differences(active.own_scores, card.marked_scores).map(hole => ({ hole, marker: nameOf(card.scorer_player_id) })));
      ownStatus = conflicts.length
        ? `<li class="paired-difference"><strong>Your card: check required.</strong> ${conflicts.map(item => `Hole ${item.hole} (${esc(item.marker)})`).join(', ')}.</li>`
        : `<li class="paired-match"><strong>Your card: verified.</strong> Matches ${ownMarkers.map(card => esc(nameOf(card.scorer_player_id))).join(' and ')}.</li>`;
    }
    let markedStatus = '<li><strong>Marked player:</strong> choose a player to mark.</li>';
    if (active.marked_player_id) {
      const markedName = esc(nameOf(active.marked_player_id));
      const markedOwnCard = cards.find(card => card.scorer_player_id === active.marked_player_id && card.own_status === 'submitted');
      if (active.marked_status !== 'submitted') markedStatus = `<li><strong>${markedName}:</strong> enter and submit the marked scores first.</li>`;
      else if (!markedOwnCard) markedStatus = `<li><strong>${markedName}:</strong> waiting for their own scorecard.</li>`;
      else {
        const conflictHoles = differences(active.marked_scores, markedOwnCard.own_scores);
        markedStatus = conflictHoles.length
          ? `<li class="paired-difference"><strong>${markedName}: check required.</strong> Scores differ on hole${conflictHoles.length === 1 ? '' : 's'} ${conflictHoles.join(', ')}.</li>`
          : `<li class="paired-match"><strong>${markedName}: verified.</strong> Your marked card matches their own submitted card.</li>`;
      }
    }
    target.innerHTML = `<h3>Scorecard verification</h3><ul>${ownStatus}${markedStatus}</ul>`;
  };

  const draw = () => {
    const target = document.querySelector('#member-paired-scorecard'), fixture = fixtureFor(active?.fixture_id), course = setup(fixture?.course_setup_id), current = player();
    if (!target || !fixture || !course || !current) return;
    const claimedByOtherPlayers = new Set(activeAssignments.filter(item => item.scorer_player_id !== current.id).map(item => item.marked_player_id));
    const people = (state.fixtureParticipants || [])
      .filter(item => item.fixture_id === fixture.id && item.player_id !== current.id)
      .filter(item => item.player_id === active.marked_player_id || !claimedByOtherPlayers.has(item.player_id))
      .sort((a, b) => `${a.players?.surname}`.localeCompare(`${b.players?.surname}`));
    const ownLocked = active.own_status === 'submitted', markedLocked = active.marked_status === 'submitted', card = holes(course.id);
    target.innerHTML = `<section class="section paired-scorecard-section"><div class="section-head"><h2>Paired scorecard</h2><span class="pill">${ownLocked && markedLocked ? 'Submitted' : 'Draft'}</span></div><p class="intro">Record your score and one other participant’s score. Each participant can be marked once, so every card receives an independent check.</p><label class="paired-player-picker">Player A to mark<select id="paired-player-a" ${markedLocked ? 'disabled' : ''}><option value="">Choose Player A</option>${people.map(item => `<option value="${item.player_id}" ${item.player_id === active.marked_player_id ? 'selected' : ''}>${esc(displayName(item.players))}</option>`).join('')}</select></label><p class="paired-index-summary" id="paired-index-summary"></p><div class="table-responsive"><table class="table paired-scorecard-table"><thead><tr><th>Hole</th><th>Par</th><th>SI</th><th>Me<br><small>shots</small></th><th>Me<br><small>pts</small></th><th>A<br><small>shots</small></th><th>A<br><small>pts</small></th></tr></thead><tbody>${card.map((hole, index) => `<tr><td>${hole.hole_number}</td><td>${hole.par}</td><td>${hole.stroke_index}</td><td><input data-paired-score="own" type="number" min="1" max="20" inputmode="numeric" value="${active.own_scores?.[index] ?? ''}" ${ownLocked ? 'disabled' : ''}></td><td data-paired-points="own-${index + 1}">—</td><td><input data-paired-score="marked" type="number" min="1" max="20" inputmode="numeric" value="${active.marked_scores?.[index] ?? ''}" ${markedLocked ? 'disabled' : ''}></td><td data-paired-points="marked-${index + 1}">—</td></tr>${hole.hole_number === 9 ? '<tr class="front-nine-subtotal"><td><strong>Out</strong></td><td colspan="2"></td><td></td><td id="paired-own-total">—</td><td></td><td id="paired-marked-total">—</td></tr>' : ''}`).join('')}</tbody></table></div><div class="paired-actions"><button class="secondary" type="button" id="paired-save">Save draft</button><button class="primary" type="button" id="paired-submit" ${ownLocked && markedLocked ? 'disabled' : ''}>Review & submit</button></div><p class="paired-message" id="paired-message"></p><p class="paired-comparison" id="paired-comparison">Choose Player A before submitting. Points appear once a Player A is selected.</p></section>`;
    const subtotalRow = (label, key) => `<tr class="${key === 'out' ? 'front-nine-subtotal ' : ''}${key === 'out-repeat' ? 'scorecard-out-repeat ' : ''}paired-scorecard-subtotal ${key === 'total' ? 'paired-scorecard-total' : ''}"><td><strong>${label}</strong></td><td id="paired-${key}-par">—</td><td></td><td id="paired-${key}-own-shots">—</td><td id="paired-${key}-own-points">—</td><td id="paired-${key}-marked-shots">—</td><td id="paired-${key}-marked-points">—</td></tr>`;
    const outRow = target.querySelector('.front-nine-subtotal');
    if (outRow) outRow.outerHTML = subtotalRow('Out', 'out');
    const eighteenth = [...target.querySelectorAll('tbody tr')].find(row => row.cells[0]?.textContent.trim() === '18');
    if (eighteenth) eighteenth.insertAdjacentHTML('afterend', `${subtotalRow('In', 'in')}${subtotalRow('Out', 'out-repeat')}${subtotalRow('Total', 'total')}`);
    const marked = people.find(item => item.player_id === active.marked_player_id)?.players;
    const ownInitials = initialsFor(current), markedInitials = marked ? initialsFor(marked) : '—';
    const ownLabel = marked && ownInitials === markedInitials ? `${ownInitials} (me)` : ownInitials;
    const headings = target.querySelectorAll('thead th');
    if (headings.length === 7) {
      headings[3].innerHTML = `${esc(ownLabel)}<br><small>shots</small>`;
      headings[4].innerHTML = `${esc(ownLabel)}<br><small>pts</small>`;
      headings[5].innerHTML = `${esc(markedInitials)}<br><small>shots</small>`;
      headings[6].innerHTML = `${esc(markedInitials)}<br><small>pts</small>`;
    }
    target.querySelector('#paired-comparison')?.insertAdjacentHTML('beforebegin', '<section class="scorecard-verification" id="paired-verification"><h3>Scorecard verification</h3><p>Checking submitted cards…</p></section>');
    updateCalculations(); compare();
    document.querySelector('#paired-player-a')?.addEventListener('change', async event => {
      const previousPlayer = active.marked_player_id;
      active.own_scores = scores('own');
      active.marked_player_id = event.target.value || null;
      active.marked_scores = [];
      draw();
      if (!await save(false)) {
        active.marked_player_id = previousPlayer;
        draw();
      }
    });
    document.querySelectorAll('[data-paired-score]').forEach(input => input.addEventListener('input', () => { updateCalculations(); clearTimeout(saveTimer); saveTimer = setTimeout(() => save(false), 700); }));
    document.querySelector('#paired-save')?.addEventListener('click', () => save(false));
    document.querySelector('#paired-submit')?.addEventListener('click', () => save(true));
  };

  const save = async submit => {
    const fixture = fixtureFor(active?.fixture_id), course = setup(fixture?.course_setup_id), current = player();
    if (!fixture || !course || !current) return;
    const own = scores('own'), marked = scores('marked');
    if (submit && (!active.marked_player_id || !complete(own) || !complete(marked))) return message('Choose Player A and enter all 18 scores for both cards before submitting.', true);
    if (submit && !window.confirm('Confirm both scorecards with your playing partner before submission. Submitted cards are locked.')) return;
    const ownIndex = indexFor(fixture.id, current.id), markedIndex = active.marked_player_id && indexFor(fixture.id, active.marked_player_id);
    const payload = { fixture_id: fixture.id, scorer_player_id: current.id, marked_player_id: active.marked_player_id, own_scores: own, marked_scores: marked, own_handicap_index: ownIndex, own_course_handicap: ownIndex == null ? null : courseHandicapFor(ownIndex, course), own_playing_handicap: ownIndex == null ? null : playingFor(fixture.id, current.id, ownIndex, fixture, course), marked_handicap_index: markedIndex, marked_course_handicap: markedIndex == null ? null : courseHandicapFor(markedIndex, course), marked_playing_handicap: markedIndex == null ? null : playingFor(fixture.id, active.marked_player_id, markedIndex, fixture, course), own_status: submit ? 'submitted' : active.own_status, marked_status: submit ? 'submitted' : active.marked_status };
    const { data, error } = await client.from('member_scorecards').upsert(payload, { onConflict: 'fixture_id,scorer_player_id' }).select().single();
    if (error) { message(error.message, true); return false; }
    active = data;
    activeAssignments = activeAssignments.filter(item => item.scorer_player_id !== current.id);
    if (active.marked_player_id) activeAssignments.push({ scorer_player_id: current.id, marked_player_id: active.marked_player_id });
    if (submit) {
      draw();
    } else {
      const status = document.querySelector('#paired-message');
      if (status) status.textContent = 'Draft saved.';
    }
    return true;
  };

  const open = async fixtureId => {
    const current = player(); if (!current) return;
    const { data, error } = await client.from('member_scorecards').select('*').eq('fixture_id', fixtureId).eq('scorer_player_id', current.id).maybeSingle();
    if (error) return message(error.message, true);
    active = data || { fixture_id: fixtureId, scorer_player_id: current.id, marked_player_id: null, own_scores: [], marked_scores: [], own_status: 'draft', marked_status: 'draft' };
    const { data: assignments, error: assignmentsError } = await client.from('member_scorecards').select('scorer_player_id, marked_player_id').eq('fixture_id', fixtureId).not('marked_player_id', 'is', null);
    activeAssignments = assignmentsError ? [] : assignments || [];
    draw();
  };

  const originalFixtures = fixtures;
  fixtures = function (fixtureId) {
    const markup = originalFixtures(fixtureId), fixture = fixtureFor(fixtureId), current = player(), course = fixture && setup(fixture.course_setup_id);
    const eligible = fixture?.member_scoring_enabled && current && participant(fixture.id, current.id) && course && holes(course.id).length === 18;
    return eligible ? `${markup}<section class="section member-scorecard-entry"><h2>Enter your paired scorecard</h2><p>Record your own score and Player A’s score on the same card.</p><button class="primary" type="button" data-open-paired-scorecard="${fixture.id}">Open scorecard</button></section>` : markup;
  };
  document.addEventListener('click', event => { const button = event.target.closest('[data-open-paired-scorecard]'); if (button) location.hash = `#scorecard/${button.dataset.openPairedScorecard}`; });
  const addAdminControl = () => {
    const panel = document.querySelector('#app .admin-panel');
    if (!state.isStaff || location.hash !== '#admin/scores' || !panel || document.querySelector('#member-scoring-control')) return;
    const options = state.fixtures.filter(fixture => !['completed', 'published', 'archived'].includes(fixture.status)).map(fixture => `<option value="${fixture.id}">${date(fixture.fixture_date)} · ${esc(fixture.name)}${fixture.member_scoring_enabled ? ' (enabled)' : ''}</option>`).join('');
    panel.insertAdjacentHTML('afterbegin', `<div class="admin-card" id="member-scoring-control"><h2>Member paired scorecards</h2><p>Enable this only after the fixture participants, tee, and 18-hole scorecard are ready. Members can then save drafts and submit their own card plus Player A’s card.</p><form class="admin-form" id="member-scoring-form"><label>Fixture<select name="fixture_id" required><option value="">Select fixture</option>${options}</select></label><label class="checkbox-label"><input name="enabled" type="checkbox"> Enable member score entry</label><button class="secondary" type="submit">Save member scorecard setting</button></form></div>`);
    document.querySelector('#member-scoring-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget), fixtureId = form.get('fixture_id'), enabled = form.get('enabled') === 'on';
      const { error } = await client.from('fixtures').update({ member_scoring_enabled: enabled }).eq('id', fixtureId);
      if (error) return message(error.message, true);
      await load(); location.hash = '#admin/scores'; message(enabled ? 'Member paired scorecards enabled for this fixture.' : 'Member paired scorecards disabled for this fixture.');
    });
  };
  const nameFor = playerId => displayName(state.memberDirectory.find(person => person.id === playerId)) || 'Unknown player';
  const addReopenControl = () => {
    const panel = document.querySelector('#app .admin-panel');
    if (!state.isAdmin || location.hash !== '#admin/scores' || !panel || document.querySelector('#reopen-paired-scorecards')) return;
    const options = state.fixtures.filter(fixture => !['completed', 'published', 'archived'].includes(fixture.status)).map(fixture => `<option value="${fixture.id}">${date(fixture.fixture_date)} · ${esc(fixture.name)}</option>`).join('');
    panel.insertAdjacentHTML('beforeend', `<div class="admin-card" id="reopen-paired-scorecards"><h2>Reopen member paired scorecard</h2><p>Use this after a submitted card needs correcting. Reopen only the half that needs amendment; the member can then edit and submit it again.</p><label>Fixture<select id="reopen-paired-fixture"><option value="">Select fixture</option>${options}</select></label><div id="reopen-paired-list" class="reopen-paired-list"><p>Select a fixture to see submitted paired scorecards.</p></div></div>`);
    const fixtureSelect = document.querySelector('#reopen-paired-fixture');
    const list = document.querySelector('#reopen-paired-list');
    const showCards = async fixtureId => {
      if (!fixtureId || !list) return;
      list.innerHTML = '<p>Loading submitted paired scorecards…</p>';
      const { data, error } = await client.from('member_scorecards').select('fixture_id, scorer_player_id, marked_player_id, own_status, marked_status').eq('fixture_id', fixtureId).or('own_status.eq.submitted,marked_status.eq.submitted').order('updated_at', { ascending: false });
      if (error) { list.innerHTML = '<p>Unable to load paired scorecards.</p>'; return message(error.message, true); }
      const cards = data || [];
      list.innerHTML = cards.length ? cards.map(card => `<div class="reopen-scorecard-row"><div><strong>${esc(nameFor(card.scorer_player_id))}</strong><br><small>Marking: ${card.marked_player_id ? esc(nameFor(card.marked_player_id)) : 'No Player A selected'}</small></div><div class="reopen-scorecard-actions">${card.own_status === 'submitted' ? `<button class="secondary" type="button" data-reopen-half="own" data-reopen-fixture="${card.fixture_id}" data-reopen-scorer="${card.scorer_player_id}">Reopen own scores</button>` : '<span class="pill">Own draft</span>'}${card.marked_status === 'submitted' ? `<button class="secondary" type="button" data-reopen-half="marked" data-reopen-fixture="${card.fixture_id}" data-reopen-scorer="${card.scorer_player_id}">Reopen marked scores</button>` : '<span class="pill">Marked draft</span>'}</div></div>`).join('') : '<p>No submitted paired scorecards for this fixture.</p>';
    };
    fixtureSelect?.addEventListener('change', event => showCards(event.target.value));
    list?.addEventListener('click', async event => {
      const button = event.target.closest('[data-reopen-half]');
      if (!button) return;
      const half = button.dataset.reopenHalf, halfLabel = half === 'own' ? 'own scores' : 'marked-player scores';
      if (!window.confirm(`Reopen these ${halfLabel}? The member will be able to amend and submit this half again.`)) return;
      button.disabled = true;
      const { error } = await client.rpc('reopen_member_scorecard_half', { p_fixture_id: button.dataset.reopenFixture, p_scorer_player_id: button.dataset.reopenScorer, p_half: half });
      if (error) { button.disabled = false; return message(error.message, true); }
      message(`The ${halfLabel} were reopened. The member can now correct and resubmit them.`);
      showCards(fixtureSelect?.value);
    });
  };
  const refreshAdminControls = () => { addAdminControl(); addReopenControl(); };
  new MutationObserver(refreshAdminControls).observe(document.querySelector('#app'), { childList: true, subtree: true });
  const originalLoad = load;
  load = async function () { await originalLoad(); const { data, error } = await client.from('fixtures').select('id, member_scoring_enabled'); if (!error) { const enabled = new Map((data || []).map(item => [item.id, item.member_scoring_enabled])); state.fixtures.forEach(fixture => { fixture.member_scoring_enabled = Boolean(enabled.get(fixture.id)); }); render(); refreshAdminControls(); } };
  const originalRender = render;
  render = function () {
    if ((location.hash || '#home').startsWith('#scorecard')) {
      const current = player();
      const requestedId = location.hash.split('/')[1];
      const eligible = state.fixtures.filter(item => item.member_scoring_enabled && current && participant(item.id, current.id));
      // Result-table links use a fixture-entry ID, whereas member scoring uses a
      // fixture ID.  Leave official scorecard links to the read-only renderer.
      if (requestedId && !eligible.some(item => item.id === requestedId)) {
        app.innerHTML = fixtureScorecardDetail(requestedId);
        document.querySelectorAll('.bottom-nav a').forEach(anchor => {
          anchor.classList.toggle('active', anchor.dataset.route === 'scorecard');
        });
        return;
      }
      const fixture = (requestedId ? eligible.find(item => item.id === requestedId) : null) || eligible.sort((a, b) => `${a.fixture_date}${a.tee_time || ''}`.localeCompare(`${b.fixture_date}${b.tee_time || ''}`))[0];
      if (!fixture) {
        app.innerHTML = '<p class="eyebrow">Scorecard</p><h1>No scorecard ready</h1><p class="intro">A scorecard becomes available once an administrator has enabled it for a fixture you are playing in.</p>';
      } else {
        app.innerHTML = `<p class="eyebrow">${date(fixture.fixture_date)}</p><h1>${esc(fixture.name)}${fixture.competition_name ? ` – ${esc(fixture.competition_name)}` : ''}</h1><p class="intro"><a class="text-link" href="#fixtures/${fixture.id}">Back to fixture</a></p><div id="member-paired-scorecard"></div>`;
        setTimeout(() => open(fixture.id), 0);
      }
      document.querySelectorAll('.bottom-nav a').forEach(anchor => anchor.classList.toggle('active', anchor.dataset.route === 'scorecard'));
      return;
    }
    originalRender();
  };
  window.addEventListener('hashchange', () => {
    if (location.hash.startsWith('#scorecard')) render();
  });
  refreshAdminControls();
})();
