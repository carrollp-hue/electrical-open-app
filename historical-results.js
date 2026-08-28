// Historical imports pre-date fixture_participants.  Their fixture_entries are
// still authoritative and must remain visible in the fixtures/results view.
function fixtures(fixtureId) {
  const fixture = state.fixtures.find(item => item.id === fixtureId);
  if (!fixture) {
    const isHistorical = item => Boolean(item.is_historical);
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

  people.sort((a, b) => {
    const aPosition = a.entry?.competition_position, bPosition = b.entry?.competition_position;
    if (aPosition != null || bPosition != null) return (aPosition ?? Number.MAX_SAFE_INTEGER) - (bPosition ?? Number.MAX_SAFE_INTEGER) || nameFor(a).localeCompare(nameFor(b));
    if (hasScores) return Number(b.entry?.stableford_points ?? -1) - Number(a.entry?.stableford_points ?? -1) || nameFor(a).localeCompare(nameFor(b));
    return nameFor(a).localeCompare(nameFor(b));
  });

  const rows = people.map(item => {
    const entry = item.entry, index = indexFor(item), name = nameFor(item);
    const playerCell = entry?.id ? `<button class="text-link scorecard-result-link" type="button" data-open-official-scorecard="${entry.id}">${esc(name)}${item.is_guest ? ' (Guest)' : ''}</button>` : `${esc(name)}${item.is_guest ? ' (Guest)' : ''}`;
    return `<tr><td>${entry?.competition_position ?? '—'}</td><td>${playerCell}</td><td>${index == null ? '—' : Number(index).toFixed(1)}</td><td>${course && index != null ? playingHandicap(index, fixture, course) : '—'}</td><td>${entry ? (entry.gross_score == null ? 'NR' : entry.gross_score) : '—'}</td><td>${entry?.nett_score ?? '—'}</td><td>${entry?.stableford_points ?? '—'}</td><td>${entry?.order_of_merit_points ?? '—'}</td></tr>`;
  }).join('');

  return `<p class="eyebrow">${date(fixture.fixture_date)}</p><h1>${esc(fixture.name)}${fixture.competition_name ? ` – ${esc(fixture.competition_name)}` : ''}</h1>${course ? `<p class="intro">Par ${course.par} · Slope ${course.slope_rating} · Course rating ${course.course_rating}</p>` : ''}<section class="section"><div class="table-responsive"><table class="table"><thead><tr><th>Pos</th><th>Player</th><th>Index</th><th>Playing</th><th>Gross</th><th>Nett</th><th>Pts</th><th>OOM</th></tr></thead><tbody>${rows || '<tr><td colspan="8">No participants added.</td></tr>'}</tbody></table></div>${hasScores && people.some(item => item.entry?.competition_position == null) ? '<p class="intro">Finalise results to apply the countback and Order of Merit positions.</p>' : ''}</section>`;
}
