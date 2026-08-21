(() => {
  const normalise = value => String(value || '')
    .replace(/\s*\(Guest\)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();

  const addIndicators = () => {
    if (!/^#admin(?:\/(members|participants))?$/.test(location.hash)) return;
    const linkedPlayers = new Set((state.memberDirectory || [])
      .filter(player => player.profile_id && !player.is_guest)
      .map(player => normalise(`${player.surname}, ${player.first_name}`)));

    document.querySelectorAll('.admin-panel .table tbody tr td:first-child').forEach(cell => {
      if (cell.querySelector('.app-access-indicator') || !linkedPlayers.has(normalise(cell.textContent))) return;
      cell.insertAdjacentHTML('beforeend', ' <span class="app-access-indicator" role="img" aria-label="App access linked" title="App access linked">📱</span>');
    });
  };

  new MutationObserver(() => queueMicrotask(addIndicators)).observe(document.querySelector('#app'), { childList: true, subtree: true });
  window.addEventListener('hashchange', addIndicators);
  addIndicators();
})();
