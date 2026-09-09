(() => {
  const route = () => location.hash === '#admin/members';
  const escHtml = value => String(value ?? '').replace(/[&<'"]/g, c => ({ '&': '&amp;', '<': '&lt;', "'": '&#39;', '"': '&quot;' })[c]);
  const currentYear = () => Number(window.electricalOpenMeritYear || new Date().getFullYear());

  async function isAdministrator() {
    const { data } = await client.from('user_roles').select('role');
    return (data || []).some(item => item.role === 'admin');
  }

  function standings(year) {
    const historical = new Set(state.fixtures.filter(item => item.is_historical || item.status === 'archived').map(item => item.id));
    const members = new Set((state.seasonMembers || []).filter(item => Number(item.season_year) === year).map(item => item.player_id));
    const totals = new Map();
    state.entries.filter(entry => entry.fixture_date?.startsWith(String(year)) && !historical.has(entry.fixture_id) && members.has(entry.player_id)).forEach(entry => {
      const row = totals.get(entry.player_id) || { playerId: entry.player_id, name: entry.player_name, points: 0 };
      row.points += Number(entry.order_of_merit_points || 0);
      totals.set(entry.player_id, row);
    });
    return [...totals.values()].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  }

  async function addControl() {
    if (!route() || document.querySelector('#season-oom-winner-cut') || !await isAdministrator() || !route()) return;
    const panel = document.querySelector('.admin-panel');
    if (!panel || document.querySelector('#season-oom-winner-cut')) return;
    const card = document.createElement('section');
    card.className = 'admin-card'; card.id = 'season-oom-winner-cut';
    const render = async year => {
      year = Number(year || currentYear());
      const rows = standings(year);
      const { data: applied } = await client.from('season_order_of_merit_winner_cuts').select('season_year, player_id, amount, players(first_name, surname)').eq('season_year', year).maybeSingle();
      card.innerHTML = `<h2>End-of-season Order of Merit winner cut</h2><p>Apply the one-off −1.0 winner cut once the season winner is confirmed. It updates the current society index and future fixtures only; committed fixture results stay unchanged.</p><form class="admin-form" id="season-oom-cut-form"><label>Season year<input name="season_year" type="number" min="2020" max="2100" value="${year}" required></label>${applied ? `<p class="intro"><strong>Already applied:</strong> ${escHtml(applied.players?.first_name)} ${escHtml(applied.players?.surname)} (${Number(applied.amount).toFixed(1)} shot).</p>` : rows.length ? `<label>Confirmed Order of Merit winner<select name="player_id" required><option value="">Choose the confirmed winner</option>${rows.map(row => `<option value="${row.playerId}">${escHtml(row.name)} — ${row.points} OOM points</option>`).join('')}</select></label><p class="intro">Only a player tied for the highest OOM points can be chosen. Select the confirmed winner manually if there is a tie.</p><button class="primary" type="submit">Apply −1.0 winner cut</button>` : '<p class="intro">No current-season Order of Merit results are available yet.</p>'}</form><p class="admin-message" aria-live="polite"></p>`;
      card.querySelector('[name=season_year]')?.addEventListener('change', event => render(event.target.value));
      card.querySelector('form')?.addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.currentTarget, data = new FormData(form), message = card.querySelector('.admin-message');
        if (!window.confirm('Apply a permanent −1.0 Order of Merit winner cut? Committed fixtures will not change.')) return;
        const { error } = await client.rpc('apply_season_order_of_merit_winner_cut', { p_season_year: Number(data.get('season_year')), p_player_id: data.get('player_id') });
        if (error) { message.textContent = error.message; message.classList.add('error'); return; }
        await load();
        await render(Number(data.get('season_year')));
      });
    };
    panel.append(card);
    await render();
  }

  new MutationObserver(addControl).observe(app, { childList: true, subtree: true });
  window.addEventListener('hashchange', addControl);
  addControl();
})();
