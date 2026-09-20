// Make countback evidence visible on an unfinished fixture, even with fewer
// than five scored players. It remains provisional until the fixture is finalised.
(() => {
  const render = () => {
    const appRoot = document.querySelector('#app');
    const match = location.hash.match(/^#fixtures\/([^/]+)$/);
    if (!appRoot || !match || appRoot.querySelector('.precommit-countback-card')) return;
    const fixture = state.fixtures.find(item => item.id === match[1]);
    if (!fixture || fixture.status === 'completed') return;

    const existing = appRoot.querySelector('details.countback-card');
    if (existing) {
      const summary = existing.querySelector('summary strong');
      const note = existing.querySelector('.intro');
      if (summary) summary.textContent = 'Provisional countback — before commitment';
      if (note) note.textContent = 'These figures are based on entered official scorecards. Check tied totals from left to right before finalising the fixture.';
      return;
    }

    const entries = state.entries
      .filter(entry => entry.fixture_id === fixture.id && entry.gross_score != null && entry.stableford_points != null)
      .sort((a, b) => Number(b.stableford_points) - Number(a.stableford_points) || `${a.player_name}`.localeCompare(`${b.player_name}`));
    if (!entries.length) return;

    const rows = entries.map(entry => {
      const values = fixtureCountback(entry.id).map(value => value == null ? '—' : value);
      return `<tr><td>${esc(entry.player_name)}</td><td>${entry.stableford_points}</td>${values.map(value => `<td>${value}</td>`).join('')}</tr>`;
    }).join('');
    appRoot.insertAdjacentHTML('beforeend', `<details class="section countback-card precommit-countback-card"><summary><strong>Provisional countback — before commitment</strong></summary><p class="intro">These figures are based on entered official scorecards. Check tied totals from left to right before finalising the fixture.</p><div class="table-responsive"><table class="table"><thead><tr><th>Player</th><th>Pts</th><th>10–18</th><th>13–18</th><th>16–18</th><th>18</th><th>1–9</th><th>4–9</th><th>7–9</th><th>9</th></tr></thead><tbody>${rows}</tbody></table></div></details>`);
  };

  new MutationObserver(render).observe(document.querySelector('#app'), { childList: true, subtree: true });
  window.addEventListener('hashchange', render);
  render();
})();
