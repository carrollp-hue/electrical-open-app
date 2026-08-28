(() => {
  // The original entry query predates saved playing handicaps. Enrich entries
  // after each normal load so completed scorecards use the value used on the day.
  const previousLoad = load;
  load = async function () {
    await previousLoad();
    const { data, error } = await client.from('fixture_entries').select('id, handicap_index_at_entry, playing_handicap');
    if (error) throw error;
    const values = new Map((data || []).map(item => [item.id, item]));
    state.entries.forEach(entry => Object.assign(entry, values.get(entry.id) || {}));
    render();
  };

  const previousFixtures = fixtures;
  fixtures = function (fixtureId) {
    let markup = previousFixtures(fixtureId);
    const fixture = fixtureId && state.fixtures.find(item => item.id === fixtureId);
    if (!fixture || ['draft', 'scheduled'].includes(fixture.status)) return markup;
    const pcc = Number(fixture.playing_conditions_adjustment || 0);
    const pccText = `PCC applied: ${pcc > 0 ? '+' : ''}${pcc}`;
    if (!markup.includes('fixture-pcc')) markup = markup.replace(/(<p class="intro">Par [\s\S]*?<\/p>)/, `$1<p class="fixture-pcc">${pccText}</p>`);
    return markup;
  };

  // Older completed cards may not contain the saved playing handicap. Derive a
  // display-only fallback from the index used on entry and the saved course tee.
  const previousFixtureCard = loadFixtureScorecard;
  loadFixtureScorecard = async function (entry, fixture, course) {
    if (entry?.playing_handicap == null && entry?.handicap_index_at_entry != null && fixture && course) entry.playing_handicap = playingHandicap(entry.handicap_index_at_entry, fixture, course);
    await previousFixtureCard(entry, fixture, course);
  };
  const previousHandicapCard = loadHandicapScorecard;
  loadHandicapScorecard = async function (entry, course) {
    if (entry?.playing_handicap == null && entry?.handicap_index_at_entry != null && course) {
      const fixture = state.fixtures.find(item => item.id === entry.fixture_id);
      if (fixture) entry.playing_handicap = playingHandicap(entry.handicap_index_at_entry, fixture, course);
    }
    await previousHandicapCard(entry, course);
  };

  const addSeasonYearStarter = () => {
    if (location.hash !== '#admin/members' || document.querySelector('#start-season-year')) return;
    const selectedYear = Number(window.electricalOpenSeasonYear || new Date().getFullYear());
    const selectedCard = document.querySelector('.admin-card');
    if (!selectedCard) return;
    const control = document.createElement('div');
    control.className = 'season-year-starter';
    control.innerHTML = `<label>Set up another season year<input id="start-season-year" type="number" min="2020" max="2100" value="${selectedYear + 1}"></label><button class="secondary" type="button">Open year</button>`;
    selectedCard.querySelector('h2')?.insertAdjacentElement('afterend', control);
    control.querySelector('button').addEventListener('click', () => {
      const year = Number(control.querySelector('input').value);
      if (!Number.isInteger(year) || year < 2020 || year > 2100) return;
      window.electricalOpenSeasonYear = year;
      render();
    });
  };

  const tidyFixtureOverride = () => {
    const card = document.querySelector('#participant-handicap-overrides');
    if (!card || card.dataset.tidyReady) return;
    card.dataset.tidyReady = 'true';
    const heading = card.querySelector('h2');
    if (!heading) return;
    const content = [...card.children].filter(child => child !== heading);
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'secondary fixture-override-toggle'; heading.append(' ', button);
    const setCollapsed = collapsed => { content.forEach(item => { item.hidden = collapsed; }); button.textContent = collapsed ? 'Expand' : 'Minimise'; button.setAttribute('aria-expanded', String(!collapsed)); };
    setCollapsed(true);
    button.addEventListener('click', () => setCollapsed(button.getAttribute('aria-expanded') !== 'true'));
    const message = card.parentElement?.querySelector('#admin-message');
    if (message) card.parentElement.insertBefore(card, message);
  };

  const wire = () => { addSeasonYearStarter(); tidyFixtureOverride(); };
  new MutationObserver(wire).observe(app, { childList: true, subtree: true });
  window.addEventListener('hashchange', wire);
  wire();
})();
