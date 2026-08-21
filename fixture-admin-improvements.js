(() => {
  const escHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  const currentIndex = person => {
    if (person?.is_guest) return person.guest_handicap_index;
    const society = snapshot(person?.id)?.index_value, club = person?.club_handicap;
    const values = [society, club].filter(value => value != null).map(Number);
    return values.length ? Math.min(...values) : null;
  };
  const fixtureParticipant = (fixtureId, playerId) => (state.fixtureParticipants || []).find(item => item.fixture_id === fixtureId && item.player_id === playerId);
  const activeFixtures = () => state.fixtures.filter(item => !['published', 'archived', 'completed'].includes(item.status));
  const decimalOrNull = value => value === '' || value == null ? null : Number(value);
  const integerOrNull = value => value === '' || value == null ? null : Number(value);

  const attachCourse = async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const { error } = await client.from('fixtures').update({ course_setup_id: data.get('course_setup_id'), handicap_allowance: Number(data.get('handicap_allowance')) }).eq('id', data.get('fixture_id'));
    if (error) return message(error.message, true);
    await load();
    location.hash = '#admin/course';
    message('Saved course tee attached to this fixture.');
  };

  const saveOverride = async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const handicapIndex = decimalOrNull(data.get('handicap_index_override'));
    const { error } = await client.from('fixture_participants').update({
      handicap_index_override: handicapIndex,
      playing_handicap_override: integerOrNull(data.get('playing_handicap_override')),
    }).eq('fixture_id', data.get('fixture_id')).eq('player_id', data.get('player_id'));
    if (error) return message(error.message, true);
    const participantRow = fixtureParticipant(data.get('fixture_id'), data.get('player_id'));
    if (participantRow?.is_guest && handicapIndex != null) {
      const { error: guestError } = await client.from('players').update({ guest_handicap_index: handicapIndex, guest_handicap_updated_at: new Date().toISOString() }).eq('id', data.get('player_id'));
      if (guestError) return message(guestError.message, true);
    }
    await load();
    location.hash = '#admin/participants';
    message('Fixture handicap override saved.');
  };

  const addReturningGuest = async event => {
    event.preventDefault();
    const button = event.submitter;
    if (!button?.value) return;
    const form = event.currentTarget, fixtureId = new FormData(form).get('fixture_id'), person = state.memberDirectory.find(item => item.id === button.value);
    const index = decimalOrNull(button.dataset.index);
    const { error } = await client.from('fixture_participants').upsert({ fixture_id: fixtureId, player_id: person.id, handicap_index_override: index, is_guest: true }, { onConflict: 'fixture_id,player_id' });
    if (error) return message(error.message, true);
    await load(); location.hash = '#admin/participants'; message(`${person.first_name} ${person.surname} added using their saved guest index.`);
  };

  const saveGuest = async event => {
    event.preventDefault(); event.stopImmediatePropagation();
    const data = new FormData(event.currentTarget), rawFirst = data.get('first_name').trim(), rawSurname = data.get('surname').trim(), first = rawFirst ? `${rawFirst[0].toUpperCase()}${rawFirst.slice(1).toLowerCase()}` : '', surname = rawSurname.toUpperCase(), index = Number(data.get('handicap_index'));
    let person = state.memberDirectory.find(item => item.is_guest && item.first_name.toLowerCase() === first.toLowerCase() && item.surname.toLowerCase() === surname.toLowerCase());
    if (person) {
      const { error } = await client.from('players').update({ guest_handicap_index: index, guest_handicap_updated_at: new Date().toISOString() }).eq('id', person.id);
      if (error) return message(error.message, true);
    } else {
      const { data: guest, error } = await client.from('players').insert({ first_name: first, surname, active: true, is_guest: true, guest_handicap_index: index, guest_handicap_updated_at: new Date().toISOString() }).select('id, first_name, surname, is_guest, guest_handicap_index').single();
      if (error) return message(error.message, true);
      person = guest;
    }
    const { error } = await client.from('fixture_participants').upsert({ fixture_id: data.get('fixture_id'), player_id: person.id, handicap_index_override: index, is_guest: true }, { onConflict: 'fixture_id,player_id' });
    if (error) return message(error.message, true);
    await load(); location.hash = '#admin/participants'; message(`${first} ${surname} added as a guest. Their index is saved for future fixtures.`);
  };

  const improveCourseTab = () => {
    if (location.hash !== '#admin/course' || !document.querySelector('#course-library-card') || document.querySelector('#saved-course-attach')) return;
    document.querySelectorAll('.admin-card').forEach(card => {
      const heading = card.querySelector('h2')?.textContent || '';
      if (heading === 'Attach course details' || heading === '18-hole scorecard setup') card.hidden = true;
    });
    const setups = state.courseSetups.map(item => `<option value="${item.id}">${escHtml(item.courses?.name)} · ${escHtml(item.tee_name)} · Rating ${item.course_rating} / Slope ${item.slope_rating}</option>`).join('');
    const card = document.createElement('div'); card.className = 'admin-card'; card.id = 'saved-course-attach';
    card.innerHTML = `<h2>Attach saved course setup</h2><p>Choose the reviewed course and tee version for a fixture. Use Scorecard Scan/Upload above for both scanned and manual course setup.</p><form class="admin-form" id="attach-saved-course-form"><label>Fixture<select name="fixture_id" required><option value="">Select fixture</option>${activeFixtures().map(item => `<option value="${item.id}">${escHtml(item.fixture_date)} · ${escHtml(item.name)}</option>`).join('')}</select></label><label>Course and tee<select name="course_setup_id" required><option value="">Select reviewed course tee</option>${setups}</select></label><label>Handicap allowance<select name="handicap_allowance"><option value="1">100%</option><option value="0.95">95%</option><option value="0.85">85%</option></select></label><button class="primary" type="submit">Attach to fixture</button></form></div>`;
    document.querySelector('#course-library-card').insertAdjacentElement('afterend', card);
    card.querySelector('form').addEventListener('submit', attachCourse);
  };

  const improveParticipantTab = () => {
    if (location.hash !== '#admin/participants' || document.querySelector('#participant-handicap-overrides')) return;
    const fixtureId = document.querySelector('#participant-fixture-select')?.value;
    if (!fixtureId) return;
    const fixture = state.fixtures.find(item => item.id === fixtureId), course = setup(fixture?.course_setup_id);
    const selected = (state.fixtureParticipants || []).filter(item => item.fixture_id === fixtureId).sort((a, b) => `${a.players?.surname}`.localeCompare(`${b.players?.surname}`));
    const card = document.createElement('div'); card.className = 'admin-card'; card.id = 'participant-handicap-overrides';
    card.innerHTML = `<h2>Fixture handicaps</h2><p>Current index is shown for reference. Optional overrides apply to this fixture only; leave a field blank to use the current calculation.</p><div class="table-responsive"><table class="table"><thead><tr><th>Player</th><th>Current index</th><th>Fixture index</th><th>Playing</th><th>Override</th></tr></thead><tbody>${selected.map(item => { const person = state.memberDirectory.find(member => member.id === item.player_id) || item.players, current = currentIndex(person), index = item.handicap_index_override ?? current, calculated = course && index != null ? playingHandicap(index, fixture, course) : null, playing = item.playing_handicap_override ?? calculated; return `<tr><td>${escHtml(person?.first_name)} ${escHtml(person?.surname)}${item.is_guest ? ' (Guest)' : ''}</td><td>${current == null ? '—' : Number(current).toFixed(1)}</td><td>${index == null ? '—' : Number(index).toFixed(1)}</td><td>${playing ?? '—'}</td><td><form class="fixture-override-form"><input type="hidden" name="fixture_id" value="${fixtureId}"><input type="hidden" name="player_id" value="${item.player_id}"><input name="handicap_index_override" type="number" min="-10" max="54" step="0.1" placeholder="Index" value="${item.handicap_index_override ?? ''}"><input name="playing_handicap_override" type="number" min="-10" max="28" step="1" placeholder="Playing" value="${item.playing_handicap_override ?? ''}"><button class="secondary" type="submit">Save</button></form></td></tr>`; }).join('') || '<tr><td colspan="5">No participants selected.</td></tr>'}</tbody></table></div>`;
    const selectedCard = [...document.querySelectorAll('.admin-card')].find(item => item.querySelector('h2')?.textContent === 'Selected participants');
    selectedCard?.insertAdjacentElement('afterend', card);
    card.querySelectorAll('.fixture-override-form').forEach(form => form.addEventListener('submit', saveOverride));
    const guests = state.memberDirectory.filter(item => item.is_guest && !selected.some(entry => entry.player_id === item.id)).sort((a,b) => a.surname.localeCompare(b.surname) || a.first_name.localeCompare(b.first_name));
    if (guests.length) {
      const returning = document.createElement('div'); returning.className = 'admin-card'; returning.id = 'returning-guest-list';
      returning.innerHTML = `<h2>Returning guests available to add</h2><p>Guests are retained automatically with their last recorded handicap index.</p><form class="returning-guest-form"><input type="hidden" name="fixture_id" value="${fixtureId}"><table class="table"><tbody>${guests.map(person => `<tr><td>${escHtml(person.surname).toUpperCase()}, ${escHtml(person.first_name)}</td><td>${person.guest_handicap_index == null ? '—' : Number(person.guest_handicap_index).toFixed(1)}</td><td><button class="secondary" type="submit" value="${person.id}" data-index="${person.guest_handicap_index ?? ''}">Add</button></td></tr>`).join('')}</tbody></table></form>`;
      card.insertAdjacentElement('afterend', returning);
      returning.querySelector('form').addEventListener('submit', addReturningGuest);
    }
    const guestForm = document.querySelector('#add-guest-form');
    if (guestForm && !guestForm.dataset.reusableGuestReady) { guestForm.dataset.reusableGuestReady = 'true'; guestForm.addEventListener('submit', saveGuest, true); }
  };

  const renameTabs = () => {
    document.querySelectorAll('.admin-tab').forEach(tab => {
      if (tab.getAttribute('href') === '#admin/course') tab.textContent = 'Course Setup';
      if (tab.getAttribute('href') === '#admin/participants') tab.textContent = 'Participants & Handicaps';
    });
  };

  const enrichDirectory = async () => {
    const [{ data, error }, { data: participantData, error: participantError }] = await Promise.all([
      client.from('players').select('id, guest_handicap_index, guest_handicap_updated_at').eq('active', true),
      client.from('fixture_participants').select('fixture_id, player_id, playing_handicap_override'),
    ]);
    if (error || participantError) return;
    const values = new Map(data.map(item => [item.id, item]));
    state.memberDirectory = state.memberDirectory.map(item => ({ ...item, ...(values.get(item.id) || {}) }));
    state.players = state.players.map(item => ({ ...item, ...(values.get(item.id) || {}) }));
    state.fixtureParticipants = state.fixtureParticipants.map(item => ({ ...item, ...(participantData.find(value => value.fixture_id === item.fixture_id && value.player_id === item.player_id) || {}) }));
  };

  const applyFixturePlayingOverrides = () => {
    const match = location.hash.match(/^#fixtures\/([^/]+)$/);
    if (!match) return;
    const fixture = state.fixtures.find(item => item.id === match[1]);
    if (!fixture) return;
    const participants = (state.fixtureParticipants || []).filter(item => item.fixture_id === fixture.id && item.playing_handicap_override != null);
    if (!participants.length) return;
    const tables = [...document.querySelectorAll('.table')];
    const resultTable = tables.find(table => [...table.querySelectorAll('thead th')].some(header => header.textContent.trim() === 'Playing'));
    if (!resultTable) return;
    const headers = [...resultTable.querySelectorAll('thead th')].map(header => header.textContent.trim());
    const playerColumn = headers.indexOf('Player'), playingColumn = headers.indexOf('Playing');
    if (playerColumn < 0 || playingColumn < 0) return;
    resultTable.querySelectorAll('tbody tr').forEach(row => {
      const playerText = row.children[playerColumn]?.textContent.replace(' (Guest)', '').trim();
      const participant = participants.find(item => `${item.players?.first_name || ''} ${item.players?.surname || ''}`.trim() === playerText);
      if (participant && row.children[playingColumn] && row.children[playingColumn].textContent !== String(participant.playing_handicap_override)) row.children[playingColumn].textContent = participant.playing_handicap_override;
    });
  };
  const wire = () => { renameTabs(); improveCourseTab(); improveParticipantTab(); applyFixturePlayingOverrides(); };
  const baseLoad = load;
  load = async function () { await baseLoad(); await enrichDirectory(); render(); };
  new MutationObserver(wire).observe(document.querySelector('#app'), { childList: true, subtree: true });
  window.addEventListener('hashchange', wire);
  wire();
})();
