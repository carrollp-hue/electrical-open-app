(() => {
  const committedStatuses = new Set(['completed', 'published', 'archived']);

  const number = value => Number(value || 0);
  const display = value => Number(value).toFixed(1);

  const addDifferential = async (entry, fixture, course, route) => {
    if (!entry || !fixture || !course || !committedStatuses.has(fixture.status)) return;
    if (location.hash !== route || document.querySelector('.score-differential-card')) return;

    const { data, error } = await client
      .from('fixture_entries')
      .select('adjusted_gross_score, score_differential, handicap_index_at_entry, score_status')
      .eq('id', entry.id)
      .single();

    if (error || !data || location.hash !== route || document.querySelector('.score-differential-card')) return;

    const scorecard = app.querySelector('.section');
    if (!scorecard) return;

    const isNonReturn = data.score_status === 'non_return';
    const differential = data.score_differential;
    if (differential == null) return;

    const content = isNonReturn
      ? `<p class="intro">Non Return: the differential is the handicap index used for the fixture plus 5.0.</p>
         <p class="differential-formula">${display(data.handicap_index_at_entry)} + 5.0 = <strong>${display(differential)}</strong></p>`
      : `<dl class="differential-values">
           <div><dt>Adjusted gross score</dt><dd>${data.adjusted_gross_score ?? '—'}</dd></div>
           <div><dt>Course rating</dt><dd>${display(course.course_rating)}</dd></div>
           <div><dt>PCC</dt><dd>${number(fixture.playing_conditions_adjustment) > 0 ? '+' : ''}${number(fixture.playing_conditions_adjustment)}</dd></div>
           <div><dt>Slope rating</dt><dd>${course.slope_rating}</dd></div>
         </dl>
         <p class="differential-formula">(${data.adjusted_gross_score} − ${display(course.course_rating)} − ${number(fixture.playing_conditions_adjustment)}) × 113 ÷ ${course.slope_rating} = <strong>${display(differential)}</strong></p>`;

    scorecard.insertAdjacentHTML('afterend', `<section class="section score-differential-card"><h2>Score differential</h2>${content}<p class="differential-note">Calculated from the completed 18-hole scorecard and rounded to one decimal place.</p></section>`);
  };

  const originalFixtureScorecard = loadFixtureScorecard;
  loadFixtureScorecard = async function (entry, fixture, course) {
    await originalFixtureScorecard(entry, fixture, course);
    await addDifferential(entry, fixture, course, `#scorecard/${entry.id}`);
  };

  const originalHandicapScorecard = loadHandicapScorecard;
  loadHandicapScorecard = async function (entry, course) {
    await originalHandicapScorecard(entry, course);
    const fixture = state.fixtures.find(item => item.id === entry.fixture_id);
    await addDifferential(entry, fixture, course, `#handicap/${entry.id}`);
  };
})();
