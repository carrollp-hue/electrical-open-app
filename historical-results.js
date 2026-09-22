// Historical imports pre-date fixture_participants.  Their fixture_entries are
// still authoritative and must remain visible in the fixtures/results view.
function fixtures(fixtureId) {
  if (fixtureId === 'historical') {
    const historical = state.fixtures.filter(item => item.is_historical || item.status === 'archived').sort((a, b) => `${b.fixture_date}${b.tee_time || ''}`.localeCompare(`${a.fixture_date}${a.tee_time || ''}`));
    const years = [...new Set(historical.map(item => item.fixture_date.slice(0, 4)))].sort((a, b) => Number(b) - Number(a));
    return `<p class="eyebrow">Society archive</p><h1>Historical results</h1><p class="intro">Imported historic results are retained for viewing only and do not affect current handicaps or Order of Merit.</p><p>${link('fixtures', 'Back to Fixtures & results')}</p>${historical.length ? years.map(year => `<section class="section"><h2>${year}</h2>${historical.filter(item => item.fixture_date.startsWith(year)).map(fixtureRow).join('')}</section>`).join('') : empty('No historical fixtures are available.')}`;
  }
  const fixture = state.fixtures.find(item => item.id === fixtureId);
  if (!fixture) {
    // Older historical imports are archived even where their historic flag was
    // not retained. Treat both forms as archive-only, never as live results.
    const isHistorical = item => Boolean(item.is_historical) || item.status === 'archived';
    const isCompleted = item => ['completed', 'published', 'archived'].includes(item.status);
    const byDate = (a, b) => `${a.fixture_date}${a.tee_time || ''}`.localeCompare(`${b.fixture_date}${b.tee_time || ''}`);
    const groupedByYear = list => {
      const years = [...new Set(list.map(item => item.fixture_date.slice(0, 4)))].sort((a, b) => Number(b) - Number(a));
      return years.map(year => `<div class="fixture-year-group"><h3 class="fixture-year-heading">${year}</h3>${list.filter(item => item.fixture_date.startsWith(year)).map(fixtureRow).join('')}</div>`).join('');
    };
    const future = state.fixtures.filter(item => !isHistorical(item) && !isCompleted(item)).sort(byDate);
    const completed = state.fixtures.filter(item => !isHistorical(item) && isCompleted(item)).sort((a, b) => byDate(b, a));
    const historicalCount = state.fixtures.filter(isHistorical).length;
    return `<p class="eyebrow">Society calendar</p><h1>Fixtures & results</h1><section class="section fixture-list-section"><div class="fixture-list-heading"><h2>Fixtures</h2><span>Upcoming</span></div>${future.length ? groupedByYear(future) : empty('No upcoming fixtures.')}</section><div class="fixture-results-divider" aria-hidden="true"></div><section class="section fixture-list-section results-list-section"><div class="fixture-list-heading"><h2>Results</h2><span>Completed</span></div>${completed.length ? groupedByYear(completed) : empty('No completed fixtures yet.')}</section>${historicalCount ? `<section class="section historical-archive-link"><h2>Historical results</h2><p>Browse ${historicalCount} verified archived fixture${historicalCount === 1 ? '' : 's'} with gross, nett and Stableford points.</p>${link('fixtures/historical', 'Open historical archive')}</section>` : ''}`;
  }

  const course = setup(fixture.course_setup_id);
  const registered = (state.fixtureParticipants || []).filter(item => item.fixture_id === fixture.id);
  const recorded = state.entries.filter(item => item.fixture_id === fixture.id);
  const usingHistoricalEntries = !registered.length && recorded.length;
  const people = (usingHistoricalEntries ? recorded.map(entry => ({ player_id: entry.player_id, entry, historical: true })) : registered.map(item => ({ ...item, entry: recorded.find(score => score.player_id === item.player_id) })));
  const nameFor = item => item.historical ? item.entry.player_name : `${item.players?.first_name || ''} ${item.players?.surname || ''}`.trim();
  const indexFor = item => item.handicap_index_override ?? item.entry?.handicap_index_at_entry ?? snapshot(item.player_id)?.index_value;
  const hasScores = people.some(item => item.entry);
  const provisionalCountbacks = new Map((fixture.status !== 'completed' ? (state.provisionalCountbacks?.[fixture.id] || []) : [])
    .map(score => [score.fixture_entry_id, score]));
  const countbackKeys = ['back_nine', 'last_six', 'last_three', 'hole_eighteen', 'front_nine', 'front_six', 'front_three', 'hole_nine'];
  const compareCountback = (first, second) => {
    const points = Number(second?.stableford_points ?? -1) - Number(first?.stableford_points ?? -1);
    if (points) return points;
    for (const key of countbackKeys) {
      const difference = Number(second?.[key] ?? -1) - Number(first?.[key] ?? -1);
      if (difference) return difference;
    }
    return 0;
  };

  people.sort((a, b) => {
    // A committed fixture has an official position already calculated and
    // saved by the database. It is the single source of truth for results.
    if (fixture.status === 'completed') {
      return Number(a.entry?.competition_position ?? Number.MAX_SAFE_INTEGER) - Number(b.entry?.competition_position ?? Number.MAX_SAFE_INTEGER)
        || nameFor(a).localeCompare(nameFor(b));
    }
    if (provisionalCountbacks.size) {
      const aPoints = Number(a.entry?.stableford_points ?? -1);
      const bPoints = Number(b.entry?.stableford_points ?? -1);
      if (aPoints !== bPoints) return bPoints - aPoints;
      // Only the top five provisional places can receive Order of Merit
      // points, so countback is used there and not for lower tied scores.
      const higherScores = people.filter(item => Number(item.entry?.stableford_points ?? -1) > aPoints).length;
      if (higherScores < 5) {
        const provisionalDifference = compareCountback(provisionalCountbacks.get(a.entry?.id), provisionalCountbacks.get(b.entry?.id));
        if (provisionalDifference) return provisionalDifference;
      }
      return nameFor(a).localeCompare(nameFor(b));
    }
    const aPosition = a.entry?.competition_position, bPosition = b.entry?.competition_position;
    if (hasScores) return Number(b.entry?.order_of_merit_points ?? 0) - Number(a.entry?.order_of_merit_points ?? 0) || Number(b.entry?.stableford_points ?? -1) - Number(a.entry?.stableford_points ?? -1) || (aPosition ?? Number.MAX_SAFE_INTEGER) - (bPosition ?? Number.MAX_SAFE_INTEGER) || nameFor(a).localeCompare(nameFor(b));
    return nameFor(a).localeCompare(nameFor(b));
  });

  const provisionalRanks = new Map();
  if (provisionalCountbacks.size) {
    people.forEach((item, index) => {
      const summary = provisionalCountbacks.get(item.entry?.id);
      if (!summary) return;
      const points = Number(item.entry.stableford_points);
      const firstWithPoints = people.findIndex(candidate => Number(candidate.entry?.stableford_points) === points);
      provisionalRanks.set(item.entry.id, `*${index < 5 ? index + 1 : firstWithPoints + 1}`);
    });
  }

  const rows = people.map(item => {
    const entry = item.entry, index = indexFor(item), name = nameFor(item);
    // Use a normal hash link here rather than a delegated button action. The
    // results renderer is replaced by this file, so a real link remains
    // dependable on both desktop and mobile when opening an official card.
    const playerCell = entry?.id ? `<a class="text-link scorecard-result-link" href="#scorecard/${entry.id}">${esc(name)}${item.is_guest ? ' (Guest)' : ''}</a>` : `${esc(name)}${item.is_guest ? ' (Guest)' : ''}`;
    const provisionalRank = entry?.id ? provisionalRanks.get(entry.id) : null;
    const position = entry?.competition_position ?? provisionalRank ?? '—';
    return `<tr><td>${position}</td><td>${playerCell}</td><td>${index == null ? '—' : Number(index).toFixed(1)}</td><td>${course && index != null ? playingHandicap(index, fixture, course) : '—'}</td><td>${entry ? (entry.gross_score == null ? 'NR' : entry.gross_score) : '—'}</td><td>${entry?.nett_score ?? '—'}</td><td>${entry?.stableford_points ?? '—'}</td><td>${entry?.order_of_merit_points ?? '—'}</td></tr>`;
  }).join('');

  const scored = people.filter(item => item.entry?.gross_score != null && item.entry?.stableford_points != null);
  const fifthPoints = scored[4]?.entry?.stableford_points;
  const countbackPeople = fifthPoints == null ? [] : scored.filter((item, index) => index < 5 || Number(item.entry.stableford_points) === Number(fifthPoints));
  const countbackTitle = fixture.status === 'completed' ? 'Countback confirmation' : 'Provisional countback — before commitment';
  const countbackNote = fixture.status === 'completed'
    ? 'Top five and anyone tied with fifth are shown. Official positions are saved when the fixture is committed.'
    : 'These figures are based on entered official scorecards. Check tied totals from left to right before finalising the fixture.';
  const countback = countbackPeople.length && typeof fixtureCountback === 'function' ? `<details class="section countback-card"><summary><strong>${countbackTitle}</strong></summary><p class="intro">${countbackNote}</p><div class="table-responsive"><table class="table"><thead><tr><th>Pos</th><th>Player</th><th>Pts</th><th>10–18</th><th>13–18</th><th>16–18</th><th>18</th><th>1–9</th><th>4–9</th><th>7–9</th><th>9</th></tr></thead><tbody>${countbackPeople.map(item => { const values = fixtureCountback(item.entry.id).map(value => value == null ? '—' : value); return `<tr><td>${item.entry.competition_position ?? '—'}</td><td>${esc(nameFor(item))}</td><td>${item.entry.stableford_points}</td>${values.map(value => `<td>${value}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div></details>` : '';

  return `<p class="eyebrow">${date(fixture.fixture_date)}</p><h1>${esc(fixture.name)}${fixture.competition_name ? ` – ${esc(fixture.competition_name)}` : ''}</h1>${course ? `<p class="intro">Par ${course.par} · Slope ${course.slope_rating} · Course rating ${course.course_rating}</p>` : ''}<section class="section"><div class="table-responsive"><table class="table"><thead><tr><th>${provisionalCountbacks.size ? 'PROV.' : 'Pos'}</th><th>Player</th><th>Index</th><th>Playing</th><th>Gross</th><th>Nett</th><th>Pts</th><th>OOM</th></tr></thead><tbody>${rows || '<tr><td colspan="8">No participants added.</td></tr>'}</tbody></table></div>${hasScores && people.some(item => item.entry?.competition_position == null) ? '<p class="intro">Finalise results to apply the countback and Order of Merit positions.</p>' : ''}</section>${countback}`;
}

// Completed results are rendered before the asynchronous display add-ons run.
// Populate the confirmation table directly from the persisted per-hole points
// after every fixture redraw, so it cannot fall back to empty placeholders.
async function fillSavedCompletedCountback() {
  const fixtureId = (location.hash.match(/^#fixtures\/([^/]+)/) || [])[1];
  const fixture = fixtureId && state.fixtures.find(item => item.id === fixtureId);
  const card = document.querySelector('.countback-card');
  if (!fixture || fixture.status !== 'completed' || !card || card.dataset.savedValuesReady === fixtureId || card.dataset.savedValuesLoading === fixtureId) return;
  const entryIds = [...card.querySelectorAll('a[href^="#scorecard/"]')]
    .map(anchor => anchor.getAttribute('href')?.split('/')[1])
    .filter(Boolean);
  if (!entryIds.length) return;
  card.dataset.savedValuesLoading = fixtureId;
  const { data, error } = await client.from('hole_scores')
    .select('fixture_entry_id, hole_number, stableford_points')
    .in('fixture_entry_id', entryIds);
  if (error) { card.dataset.savedValuesError = error.message; delete card.dataset.savedValuesLoading; return; }
  const valuesFor = entryId => {
    const scores = (data || []).filter(score => score.fixture_entry_id === entryId);
    const total = (from, to) => {
      const values = scores.filter(score => score.hole_number >= from && score.hole_number <= to).map(score => score.stableford_points);
      return values.length === to - from + 1 && values.every(value => value != null) ? values.reduce((sum, value) => sum + Number(value), 0) : null;
    };
    const single = hole => scores.find(score => score.hole_number === hole)?.stableford_points ?? null;
    return [total(10, 18), total(13, 18), total(16, 18), single(18), total(1, 9), total(4, 9), total(7, 9), single(9)];
  };
  card.querySelectorAll('tbody tr').forEach(row => {
    const entryId = row.querySelector('a[href^="#scorecard/"]')?.getAttribute('href')?.split('/')[1];
    if (!entryId) return;
    const cells = [...row.children];
    valuesFor(entryId).forEach((value, index) => { if (cells[index + 3]) cells[index + 3].textContent = value == null ? '—' : String(value); });
  });
  card.dataset.savedValuesReady = fixtureId;
  delete card.dataset.savedValuesLoading;
}

const renderHistoricalResults = render;
render = function () {
  renderHistoricalResults();
  setTimeout(() => { fillSavedCompletedCountback(); }, 0);
};
