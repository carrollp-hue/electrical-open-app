// Three-card society-handicap assessment for players without a current index.
(() => {
  const assessmentEntries = playerId => state.entries.filter(entry =>
    entry.player_id === playerId && entry.handicap_index_at_entry == null && entry.gross_score != null
  );

  const baseParticipantAdmin = participantAdmin;
  participantAdmin = function () {
    const page = baseParticipantAdmin();
    const fixtureId = window.electricalOpenParticipantFixture || state.fixtures.find(item => !['published', 'archived'].includes(item.status))?.id || state.fixtures[0]?.id;
    const fixture = state.fixtures.find(item => item.id === fixtureId);
    if (!fixture) return page;
    const card = `<div class="admin-card provisional-player-card"><h2>Add player without a handicap</h2><p>Use this for a new society player. Their first three verified 18-hole cards are assessment cards: each hole is capped at par + 2 and they do not compete for prizes or Order of Merit points. A society index is issued after the third card; fixture playing handicap remains capped at 28.</p><form class="admin-form" id="add-provisional-player-form"><input type="hidden" name="fixture_id" value="${fixture.id}"><div class="field-row"><label>First name<input name="first_name" required></label><label>Surname<input name="surname" required></label></div><button class="primary" type="submit">Add provisional player</button></form></div>`;
    return page.replace('<p class="admin-message" id="admin-message"></p>', `${card}<p class="admin-message" id="admin-message"></p>`);
  };

  const baseScorecardInputs = scorecardInputs;
  scorecardInputs = function () {
    baseScorecardInputs();
    const target = document.querySelector('#scorecard-fields');
    const fixture = state.fixtures.find(item => item.id === document.querySelector('#scorecard-fixture')?.value);
    const playerId = document.querySelector('#scorecard-player')?.value;
    const person = state.memberDirectory.find(item => item.id === playerId);
    const course = setup(fixture?.course_setup_id);
    const card = holes(course?.id);
    if (!target || !fixture || !person || person.is_guest || snapshot(playerId) || card.length !== 18) return;

    const assessmentNumber = Math.min(assessmentEntries(playerId).length + 1, 3);
    target.innerHTML = `<div class="scorecard-summary provisional-summary"><span>Provisional assessment card ${assessmentNumber} of 3</span><strong>Par + 2 maximum per hole</strong></div><p class="intro">No playing handicap or Stableford points apply until all three assessment cards are complete.</p><div class="scorecard-grid"><div>Hole</div><div>Par</div><div>SI</div><div>Gross</div><div>Adjusted</div><div></div>${card.map(hole => `<div>${hole.hole_number}</div><div>${hole.par}</div><div>${hole.stroke_index}</div><input aria-label="Hole ${hole.hole_number} gross shots" name="gross_${hole.hole_number}" type="number" min="1" max="20" inputmode="numeric" required><div data-adjusted="${hole.hole_number}">—</div><div></div>`).join('')}<div class="scorecard-total">Total</div><div class="scorecard-total">${course.par}</div><div></div><div class="scorecard-total" data-total="gross">—</div><div class="scorecard-total" data-total="adjusted">—</div><div></div></div>`;
    target.dataset.provisional = 'true';
    target.dataset.courseSetupId = course.id;
    target.querySelectorAll('input').forEach(input => input.addEventListener('input', updateProvisionalTotals));
  };

  function updateProvisionalTotals() {
    const target = document.querySelector('#scorecard-fields');
    const course = setup(target?.dataset.courseSetupId);
    if (!target || !course) return;
    const card = holes(course.id);
    let grossTotal = 0, adjustedTotal = 0, complete = true;
    card.forEach(hole => {
      const gross = numberOrNull(target.querySelector(`[name="gross_${hole.hole_number}"]`)?.value);
      const adjusted = gross == null ? null : Math.min(gross, Number(hole.par) + 2);
      const cell = target.querySelector(`[data-adjusted="${hole.hole_number}"]`);
      if (cell) cell.textContent = adjusted == null ? '—' : adjusted;
      if (gross == null) complete = false;
      else { grossTotal += gross; adjustedTotal += adjusted; }
    });
    target.querySelector('[data-total="gross"]').textContent = complete ? grossTotal : '—';
    target.querySelector('[data-total="adjusted"]').textContent = complete ? adjustedTotal : '—';
  }

  async function saveProvisionalScorecard(form) {
    const data = new FormData(form);
    const fixture = state.fixtures.find(item => item.id === data.get('fixture_id'));
    const course = setup(fixture?.course_setup_id);
    const card = holes(course?.id);
    const scores = card.map(hole => ({ hole, gross: numberOrNull(data.get(`gross_${hole.hole_number}`)) }));
    if (!fixture || !course || card.length !== 18 || scores.some(item => item.gross == null)) return message('Enter a gross score for all 18 holes.', true);
    const playerId = data.get('player_id');
    const grossScore = scores.reduce((sum, item) => sum + item.gross, 0);
    const adjustedGross = scores.reduce((sum, item) => sum + Math.min(item.gross, Number(item.hole.par) + 2), 0);
    const { data: entry, error } = await client.from('fixture_entries').upsert({
      fixture_id: fixture.id, player_id: playerId, handicap_index_at_entry: null,
      course_handicap: 0, playing_handicap: 0, gross_score: grossScore,
      nett_score: null, stableford_points: null, adjusted_gross_score: adjustedGross,
      score_differential: null, esr_adjustment: 0, winner_cut: 0, order_of_merit_points: 0
    }, { onConflict: 'fixture_id,player_id' }).select('id').single();
    if (error) return message(error.message, true);
    const remove = await client.from('hole_scores').delete().eq('fixture_entry_id', entry.id);
    if (remove.error) return message(remove.error.message, true);
    const saved = await client.from('hole_scores').insert(scores.map(item => ({
      fixture_entry_id: entry.id, hole_number: item.hole.hole_number, gross_score: item.gross,
      handicap_strokes: 0, nett_score: item.gross, stableford_points: 0
    })));
    if (saved.error) return message(saved.error.message, true);
    await load();
    location.hash = '#admin/scores';
    message(`Assessment card ${assessmentEntries(playerId).length} of 3 saved. It is excluded from prizes and Order of Merit.`);
  }

  document.addEventListener('submit', async event => {
    const form = event.target;
    if (form.id === 'add-provisional-player-form') {
      event.preventDefault(); event.stopImmediatePropagation();
      const data = new FormData(form), first = data.get('first_name').trim(), surname = data.get('surname').trim();
      const { data: playerData, error: playerError } = await client.from('players').insert({ first_name: first, surname, active: true, is_guest: false }).select('id').single();
      if (playerError) return message(playerError.message, true);
      const fixture = state.fixtures.find(item => item.id === data.get('fixture_id'));
      const participant = await client.from('fixture_participants').upsert({ fixture_id: data.get('fixture_id'), player_id: playerData.id, is_guest: false });
      if (participant.error) return message(participant.error.message, true);
      const member = await client.from('season_members').upsert({ season_year: Number(fixture.fixture_date.slice(0, 4)), player_id: playerData.id }, { onConflict: 'season_year,player_id' });
      if (member.error) return message(member.error.message, true);
      await load(); location.hash = '#admin/participants'; message(`${first} ${surname} added as a provisional player.`);
    }
    if (form.id === 'scorecard-form' && document.querySelector('#scorecard-fields')?.dataset.provisional === 'true') {
      event.preventDefault(); event.stopImmediatePropagation(); await saveProvisionalScorecard(form);
    }
  }, true);
})();
