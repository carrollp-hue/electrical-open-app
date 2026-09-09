(() => {
  const previousLoad = load;
  load = async function () {
    await previousLoad();
    const { data, error } = await client.from('fixtures').select('id, is_oom_qualifying');
    // The app remains usable while the accompanying Supabase upgrade is being
    // applied; the option becomes active as soon as the column is available.
    window.electricalOpenOomQualifyingAvailable = !error;
    if (error) {
      document.querySelectorAll('.fixture-qualification, .fixture-qualification-note').forEach(element => element.remove());
      return;
    }
    const qualifying = new Map((data || []).map(item => [item.id, item.is_oom_qualifying !== false]));
    state.fixtures.forEach(fixture => { fixture.is_oom_qualifying = qualifying.get(fixture.id) !== false; });
    render();
  };

  const previousFixtures = fixtures;
  fixtures = function (fixtureId) {
    let markup = previousFixtures(fixtureId);
    const fixture = fixtureId && state.fixtures.find(item => item.id === fixtureId);
    if (fixture && fixture.is_oom_qualifying === false && !markup.includes('non-qualifying-fixture-note')) {
      markup = markup.replace(/(<h1>[\s\S]*?<\/h1>)/, '$1<p class="intro non-qualifying-fixture-note"><strong>(*) Non-qualifying fixture:</strong> scorecards and handicap differentials count, but no Order of Merit points or fixture winner cut are awarded.</p>');
    }
    return markup;
  };

  const previousFixtureRow = fixtureRow;
  fixtureRow = function (fixture) {
    const markup = previousFixtureRow(fixture);
    if (fixture?.is_oom_qualifying !== false) return markup;
    const name = esc(fixture.name);
    return markup.replace(`>${name}</strong>`, `>${name} (*)</strong>`);
  };

  function wireCreateForm() {
    if (window.electricalOpenOomQualifyingAvailable === false) return;
    const form = document.querySelector('#add-fixture-form');
    if (!form || form.dataset.oomExclusionReady) return;
    form.dataset.oomExclusionReady = 'true';
    form.insertAdjacentHTML('beforeend', '<label class="fixture-qualification"><input name="is_oom_qualifying" type="checkbox" checked> Qualifies for Order of Merit and fixture winner cut</label><p class="intro fixture-qualification-note">Clear this for a played fixture that should affect handicaps only.</p>');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const data = new FormData(form);
      const fixture = {
        name: data.get('name').trim(), competition_name: data.get('competition_name')?.trim() || null,
        fixture_date: data.get('fixture_date'), tee_time: data.get('tee_time'), format: data.get('format'),
        status: 'draft'
      };
      if (window.electricalOpenOomQualifyingAvailable) fixture.is_oom_qualifying = data.get('is_oom_qualifying') === 'on';
      const { error } = await client.from('fixtures').insert(fixture);
      if (error) return message(error.message, true);
      await load();
      location.hash = '#admin/fixtures';
      message(!window.electricalOpenOomQualifyingAvailable || data.get('is_oom_qualifying') === 'on' ? 'Fixture created.' : 'Non-qualifying fixture created. It will not award OOM points or a fixture winner cut.');
    }, true);
  }

  const wire = () => {
    if (window.electricalOpenOomQualifyingAvailable === false) document.querySelectorAll('.fixture-qualification, .fixture-qualification-note').forEach(element => element.remove());
    wireCreateForm();
  };
  new MutationObserver(wire).observe(app, { childList: true, subtree: true });
  wire();
})();
