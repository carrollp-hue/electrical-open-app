(() => {
  const effectiveIndex = (fixtureId, playerId) => {
    const participant = (state.fixtureParticipants || []).find(item => item.fixture_id === fixtureId && item.player_id === playerId);
    if (participant?.handicap_index_override != null) return Number(participant.handicap_index_override);
    const society = snapshot(playerId)?.index_value, club = state.memberDirectory.find(item => item.id === playerId)?.club_handicap;
    const values = [society, club].filter(value => value != null).map(Number);
    return values.length ? Math.min(...values) : null;
  };
  const applyEffectiveIndex = () => {
    const fixtureId = document.querySelector('#scorecard-fixture')?.value, playerId = document.querySelector('#scorecard-player')?.value;
    const fixture = state.fixtures.find(item => item.id === fixtureId), course = setup(fixture?.course_setup_id), target = document.querySelector('#scorecard-fields');
    const index = effectiveIndex(fixtureId, playerId);
    if (!fixture || !course || index == null || !target?.dataset.courseSetupId) return;
    const courseHcap = courseHandicap(index, course), playingHcap = playingHandicap(index, fixture, course);
    target.dataset.courseHandicap = courseHcap;
    target.dataset.playingHandicap = playingHcap;
    target.querySelector('.scorecard-summary')?.replaceChildren(Object.assign(document.createElement('span'), { textContent: `Index ${index.toFixed(1)} · Course ${courseHcap}` }), Object.assign(document.createElement('strong'), { textContent: `Playing handicap ${playingHcap}` }));
    updateScorecardTotals();
  };
  const wire = () => {
    const form = document.querySelector('#scorecard-form');
    if (!form || form.dataset.effectiveIndexReady) return;
    form.dataset.effectiveIndexReady = 'true';
    document.querySelector('#scorecard-fixture')?.addEventListener('change', () => setTimeout(applyEffectiveIndex, 0));
    document.querySelector('#scorecard-player')?.addEventListener('change', () => setTimeout(applyEffectiveIndex, 0));
    form.addEventListener('submit', () => {
      const fixtureId = document.querySelector('#scorecard-fixture')?.value, playerId = document.querySelector('#scorecard-player')?.value, saved = snapshot(playerId), index = effectiveIndex(fixtureId, playerId);
      if (!saved || index == null) return;
      const original = saved.index_value;
      saved.index_value = index;
      setTimeout(() => { saved.index_value = original; }, 0);
    }, true);
  };
  new MutationObserver(wire).observe(document.querySelector('#app'), { childList: true, subtree: true });
  wire();
})();
