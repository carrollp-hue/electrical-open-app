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
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'secondary';
    deleteButton.textContent = '🗑 Delete fixture';
    deleteButton.style.cssText = 'color:#dc2626;border-color:#dc2626;margin-top:4px;';
    form.append(deleteButton);
    deleteButton.addEventListener('click', async () => {
      const fixture = state.fixtures.find(item => item.id === fixtureSelect.value);
      if (!fixture) return message('Choose a fixture to delete.', true);
      if (['published', 'completed', 'archived'].includes(fixture.status)) return message('Completed or published fixtures are protected and cannot be deleted.', true);
      if (!window.confirm(`Permanently delete ${fixture.name} on ${fixture.fixture_date}?\n\nThis removes its participant list, scorecards and drafts. It cannot be undone.`)) return;
      const { error } = await client.from('fixtures').delete().eq('id', fixture.id);
      if (error) return message(error.message, true);
      await load();
      location.hash = '#admin/fixtures';
      message('Fixture deleted. The player and saved course records were kept.');
    });
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
