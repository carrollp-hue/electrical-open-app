(() => {
  const fixtureDetail = fixtures;
  const isResult = fixture => ['completed', 'published', 'archived'].includes(fixture.status);
  const isHistorical = fixture => Boolean(fixture.is_historical);
  const byDateAscending = (a, b) => `${a.fixture_date}${a.tee_time || ''}`.localeCompare(`${b.fixture_date}${b.tee_time || ''}`);
  const today = () => new Date().toISOString().slice(0, 10);

  home = function () {
    const current = player();
    if (!current) return empty('No player is linked to this account yet.');
    const index = snapshot(current.id);
    const recentRounds = entries(current.id).slice(0, 6);
    const nextFixture = state.fixtures.filter(fixture => !isHistorical(fixture) && !isResult(fixture) && fixture.fixture_date >= today()).sort(byDateAscending)[0];
    const recentFixtures = state.fixtures.filter(fixture => !isHistorical(fixture) && isResult(fixture)).sort((a, b) => byDateAscending(b, a)).slice(0, 3);
    return `<p class="eyebrow">Member dashboard</p><h1>Hello, ${esc(current.first_name)}</h1><p class="intro"><span class="status-dot"></span>Live society data</p><section class="index-card"><p class="eyebrow">Current society index</p><div class="index">${index ? Number(index.index_value).toFixed(1) : '—'}</div><p class="index-note">${index ? 'Imported from the society handicap record' : 'No index record available'}</p></section><section class="section"><div class="section-head"><h2>Recent differentials</h2>${link('handicap', 'View history')}</div><div class="round-grid">${recentRounds.length ? recentRounds.map(item => `<div class="round">${item.score_differential == null ? '—' : Number(item.score_differential).toFixed(1)}<small>${date(item.fixture_date)}</small></div>`).join('') : empty('No rounds yet.')}</div></section><section class="section"><h2>Next upcoming fixture</h2>${nextFixture ? fixtureRow(nextFixture) : empty('No upcoming fixtures.')}</section><section class="section"><div class="section-head"><h2>Recent fixtures</h2>${link('fixtures', 'All fixtures')}</div>${recentFixtures.length ? recentFixtures.map(fixtureRow).join('') : empty('No completed fixtures yet.')}</section>`;
  };

  fixtures = function (fixtureId) {
    if (fixtureId === 'historical') {
      const historicalFixtures = state.fixtures.filter(isHistorical).sort((a, b) => byDateAscending(b, a));
      const years = [...new Set(historicalFixtures.map(fixture => fixture.fixture_date.slice(0, 4)))].sort((a, b) => Number(b) - Number(a));
      const resultTable = fixture => {
        const scores = state.entries.filter(entry => entry.fixture_id === fixture.id).sort((a, b) => Number(a.competition_position ?? 999) - Number(b.competition_position ?? 999) || Number(b.stableford_points ?? -1) - Number(a.stableford_points ?? -1) || `${a.player_name}`.localeCompare(`${b.player_name}`));
        const course = setup(fixture.course_setup_id);
        return `<details class="historical-fixture"><summary><span><strong>${esc(fixture.name)}${fixture.competition_name ? ` – ${esc(fixture.competition_name)}` : ''}</strong><small>${date(fixture.fixture_date)}</small></span><span>${scores.length} result${scores.length === 1 ? '' : 's'}</span></summary>${scores.length ? `<div class="table-responsive"><table class="table historical-results-table"><thead><tr><th>Pos</th><th>Player</th><th>Index</th><th>Playing</th><th>Gross</th><th>Nett</th><th>Pts</th><th>OOM</th></tr></thead><tbody>${scores.map(score => { const index = score.handicap_index_at_entry; return `<tr><td>${score.competition_position ?? '—'}</td><td>${esc(score.player_name)}</td><td>${index == null ? '—' : Number(index).toFixed(1)}</td><td>${course && index != null ? playingHandicap(index, fixture, course) : '—'}</td><td>${score.gross_score == null ? 'NR' : score.gross_score}</td><td>${score.nett_score ?? '—'}</td><td>${score.stableford_points ?? '—'}</td><td>${score.order_of_merit_points ?? 0}</td></tr>`; }).join('')}</tbody></table></div>` : empty('No imported result rows for this fixture.')}</details>`;
      };
      return `<p class="eyebrow">Society archive</p><h1>Historical results</h1><p class="intro">Verified historic finishing positions are retained from the original society records. These results are read-only and do not affect current handicap or Order of Merit calculations.</p><p>${link('fixtures', 'Back to Fixtures & results')}</p>${historicalFixtures.length ? years.map(year => `<section class="section"><h2>${year}</h2>${historicalFixtures.filter(fixture => fixture.fixture_date.startsWith(year)).map(resultTable).join('')}</section>`).join('') : empty('No fixtures have been marked as historical yet.')}`;
    }
    if (fixtureId) {
      const detail = fixtureDetail(fixtureId);
      const fixture = state.fixtures.find(item => item.id === fixtureId);
      const course = fixture && setup(fixture.course_setup_id);
      const card = course ? holes(course.id) : [];
      if (card.length !== 18) return detail;

      const out = card.slice(0, 9);
      const incoming = card.slice(9);
      const total = values => values.reduce((sum, hole) => sum + Number(hole.par || 0), 0);
      const nineHoleCard = (label, cardHalf) => `<div class="course-scorecard-half"><h3>${label}</h3><table class="table course-scorecard-table"><thead><tr><th>Hole</th><th>Par</th><th>SI</th></tr></thead><tbody>${cardHalf.map(hole => `<tr><td>${hole.hole_number}</td><td>${hole.par}</td><td>${hole.stroke_index}</td></tr>`).join('')}<tr class="course-scorecard-subtotal"><th>${label}</th><td>${total(cardHalf)}</td><td>—</td></tr></tbody></table></div>`;
      const scorecard = `<section class="section fixture-course-scorecard" id="fixture-course-scorecard" hidden><div class="section-head"><h2>Course scorecard</h2><span class="pill">${esc(course.tee_name)}</span></div><div class="course-scorecard-halves">${nineHoleCard('Out', out)}${nineHoleCard('In', incoming)}</div><p class="course-scorecard-total">Course par <strong>${total(card)}</strong></p></section>`;
      const button = `<button class="secondary fixture-scorecard-link" type="button" data-view-course-scorecard aria-expanded="false">View scorecard</button>`;
      return detail.replace('<h1>', '<div class="fixture-title-row"><h1>')
        .replace('</h1>', `</h1>${button}</div>`) + scorecard;
    }
    const upcoming = state.fixtures.filter(fixture => !isHistorical(fixture) && !isResult(fixture)).sort(byDateAscending);
    const results = state.fixtures.filter(fixture => !isHistorical(fixture) && isResult(fixture)).sort((a, b) => byDateAscending(b, a));
    const historicalCount = state.fixtures.filter(isHistorical).length;
    const groupedByYear = fixtureList => {
      const years = [...new Set(fixtureList.map(fixture => fixture.fixture_date.slice(0, 4)))].sort((a, b) => Number(b) - Number(a));
      return years.map(year => `<div class="fixture-year-group"><h3 class="fixture-year-heading">${year}</h3>${fixtureList.filter(fixture => fixture.fixture_date.startsWith(year)).map(fixtureRow).join('')}</div>`).join('');
    };
    return `<p class="eyebrow">Society calendar</p><h1>Fixtures & results</h1><section class="section"><h2>Fixtures</h2>${upcoming.length ? groupedByYear(upcoming) : empty('No upcoming fixtures.')}</section><section class="section"><h2>Results</h2>${results.length ? groupedByYear(results) : empty('No completed fixtures yet.')}</section>${historicalCount ? `<section class="section historical-archive-link"><h2>Historical results</h2><p>Browse ${historicalCount} verified archived fixture${historicalCount === 1 ? '' : 's'} with gross, nett and Stableford points.</p>${link('fixtures/historical', 'Open historical archive')}</section>` : ''}`;
  };

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-view-course-scorecard]');
    if (!button) return;
    const scorecard = document.querySelector('#fixture-course-scorecard');
    if (!scorecard) return;
    scorecard.hidden = !scorecard.hidden;
    button.textContent = scorecard.hidden ? 'View scorecard' : 'Hide scorecard';
    button.setAttribute('aria-expanded', String(!scorecard.hidden));
    if (!scorecard.hidden) scorecard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
})();
