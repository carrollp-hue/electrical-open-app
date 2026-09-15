(() => {
  const isParticipantAdmin = () => location.hash === '#admin/participants';
  const dateToday = () => new Date().toISOString().slice(0, 10);
  const eligibleFixtures = () => state.fixtures
    .filter(fixture => !['completed', 'published', 'archived'].includes(fixture.status))
    .sort((a, b) => `${a.fixture_date}${a.tee_time || ''}`.localeCompare(`${b.fixture_date}${b.tee_time || ''}`));

  function arrange() {
    if (!isParticipantAdmin()) return;
    const fixtures = eligibleFixtures();
    if (!fixtures.length) return;
    if (!window.electricalOpenParticipantFixture) {
      const next = fixtures.find(fixture => fixture.fixture_date >= dateToday()) || fixtures[0];
      window.electricalOpenParticipantFixture = next.id;
      render();
      return;
    }
    const select = document.querySelector('#participant-fixture-select');
    if (!select || select.dataset.dateOrdered) return;
    const blank = [...select.options].find(option => !option.value);
    const byId = new Map([...select.options].filter(option => option.value).map(option => [option.value, option]));
    select.replaceChildren(blank, ...fixtures.map(fixture => byId.get(fixture.id)).filter(Boolean));
    select.value = window.electricalOpenParticipantFixture;
    select.dataset.dateOrdered = 'true';
  }

  new MutationObserver(arrange).observe(app, { childList: true, subtree: true });
  window.addEventListener('hashchange', arrange);
  arrange();
})();
