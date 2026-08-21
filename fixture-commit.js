(() => {
  const refreshCommitControls = () => {
    const completedIds = new Set(state.fixtures.filter(item => item.status === 'completed').map(item => item.id));
    if (location.hash === '#admin/participants' && completedIds.has(window.electricalOpenParticipantFixture)) {
      window.electricalOpenParticipantFixture = undefined;
      render();
      return;
    }
    document.querySelectorAll('#app select[name="fixture_id"], #participant-fixture-select').forEach(select => [...select.options].forEach(option => { if (completedIds.has(option.value)) option.remove(); }));
    const panel = document.querySelector('#app .admin-panel');
    if (!state.isAdmin || !panel || location.hash !== '#admin/scores' || document.querySelector('#commit-fixture-form')) return;
    const options = state.fixtures.filter(item => !['completed', 'archived'].includes(item.status)).map(item => `<option value="${item.id}">${date(item.fixture_date)} · ${esc(item.name)}</option>`).join('');
    panel.insertAdjacentHTML('beforeend', `<div class="admin-card"><h2>Commit fixture</h2><p>Committing is final. All participants must have a complete scorecard or a Non Return, and results must be finalized.</p><form class="admin-form" id="commit-fixture-form"><label>Fixture<select name="fixture_id" required><option value="">Select finalized fixture</option>${options}</select></label><button class="primary" type="submit">Commit fixture</button></form></div>`);
    document.querySelector('#commit-fixture-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      if (!window.confirm('Commit this fixture? It will no longer appear in the admin fixture lists.')) return;
      const data = new FormData(event.currentTarget), fixtureId = data.get('fixture_id'), pcc = data.get('playing_conditions_adjustment');
      if (pcc !== null) {
        const { error: finalizeError } = await client.rpc('finalize_fixture_differentials', { p_fixture_id: fixtureId, p_playing_conditions: Number(pcc) });
        if (finalizeError) return message(finalizeError.message, true);
      }
      const { error } = await client.rpc('commit_fixture', { p_fixture_id: fixtureId });
      if (error) return message(error.message, true);
      await load();
      location.hash = '#admin/scores';
      message('Fixture committed and removed from admin fixture lists.');
    });
  };
  const originalLoad = load;
  load = async function () {
    await originalLoad();
    const { data } = await client.from('user_roles').select('role');
    state.isAdmin = Boolean(data?.some(item => item.role === 'admin'));
    render();
    refreshCommitControls();
  };
  new MutationObserver(refreshCommitControls).observe(document.querySelector('#app'), { childList: true, subtree: true });
  refreshCommitControls();
})();
