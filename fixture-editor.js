(() => {
  const wireFixtureEditor = () => {
    const form = document.querySelector('#schedule-form');
    const fixtureSelect = form?.querySelector('[name="fixture_id"]');
    if (!form || !fixtureSelect || form.dataset.fixtureEditorReady) return;
    form.dataset.fixtureEditorReady = 'true';
    fixtureSelect.insertAdjacentHTML('afterend', '<label>Course name<input name="name" required></label>');
    const fill = () => {
      const fixture = state.fixtures.find(item => item.id === fixtureSelect.value);
      if (!fixture) return;
      form.elements.name.value = fixture.name || '';
      form.elements.competition_name.value = fixture.competition_name || '';
      form.elements.fixture_date.value = fixture.fixture_date || '';
      form.elements.tee_time.value = fixture.tee_time || '';
    };
    fixtureSelect.addEventListener('change', fill);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const data = new FormData(form);
      const { error } = await client.from('fixtures').update({ name: data.get('name').trim(), competition_name: data.get('competition_name').trim() || null, fixture_date: data.get('fixture_date'), tee_time: data.get('tee_time') }).eq('id', data.get('fixture_id'));
      if (error) return message(error.message, true);
      await load();
      location.hash = '#admin/fixtures';
      message('Fixture updated.');
    }, true);
  };
  new MutationObserver(wireFixtureEditor).observe(document.querySelector('#app'), { childList: true, subtree: true });
  wireFixtureEditor();
})();
