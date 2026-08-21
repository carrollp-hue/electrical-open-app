(() => {
  const addHandicapSummary = entry => {
    if (!entry || document.querySelector('.scorecard-handicap-summary')) return;
    const index = entry.handicap_index_at_entry;
    const playing = entry.playing_handicap;
    if (index == null && playing == null) return;
    const text = `Handicap index ${index == null ? '—' : Number(index).toFixed(1)} · Playing handicap ${playing == null ? '—' : playing}`;
    const title = document.querySelector('#app h1');
    title?.insertAdjacentHTML('afterend', `<p class="intro scorecard-handicap-summary">${text}</p>`);
  };

  const originalFixtureScorecard = loadFixtureScorecard;
  loadFixtureScorecard = async function (entry, fixture, course) {
    await originalFixtureScorecard(entry, fixture, course);
    addHandicapSummary(entry);
  };

  const originalHandicapScorecard = loadHandicapScorecard;
  loadHandicapScorecard = async function (entry, course) {
    await originalHandicapScorecard(entry, course);
    addHandicapSummary(entry);
  };
})();
