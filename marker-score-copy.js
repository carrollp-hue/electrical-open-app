(() => {
  const wire = () => {
    const form = document.querySelector('#scorecard-form');
    if (!form || form.dataset.markerCopyReady) return;
    form.dataset.markerCopyReady = 'true';
    const fields = form.querySelector('#scorecard-fields');
    if (!fields) return;
    fields.insertAdjacentHTML('beforebegin', '<div class="marker-copy"><button type="button" class="secondary" data-marker-find>Find marker scores</button><div data-marker-options></div><p class="intro" data-marker-message aria-live="polite"></p></div>');
    const panel = form.querySelector('.marker-copy');
    const fixture = form.querySelector('#scorecard-fixture');
    const player = form.querySelector('#scorecard-player');
    const output = panel.querySelector('[data-marker-message]');
    const options = panel.querySelector('[data-marker-options]');
    let choices = [];
    let request = 0;
    const clear = () => { request++; choices = []; options.replaceChildren(); output.textContent = ''; };
    fixture.addEventListener('change', clear);
    player.addEventListener('change', clear);
    panel.querySelector('[data-marker-find]').addEventListener('click', async () => {
      const fixtureId = fixture.value, playerId = player.value;
      clear();
      if (!fixtureId || !playerId) { output.textContent = 'Choose the fixture and player first.'; return; }
      const requestId = request;
      output.textContent = 'Looking for submitted marker cards…';
      try {
        const { data, error } = await client.rpc('fixture_paired_scorecards_for_results', { p_fixture_id: fixtureId });
        if (!form.isConnected || request !== requestId || fixture.value !== fixtureId || player.value !== playerId) return;
        if (error) throw error;
        choices = (data || []).filter(card => card.marked_player_id === playerId && card.marked_status === 'submitted' && Array.isArray(card.marked_scores) && card.marked_scores.length === 18 && card.marked_scores.every(value => value !== null && value !== '' && Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 20));
        if (!choices.length) { output.textContent = 'No complete submitted marker scorecard was found for this player.'; return; }
        const label = document.createElement('label');
        label.textContent = 'Submitted by marker';
        const select = document.createElement('select');
        choices.forEach((card, index) => {
          const marker = (state.memberDirectory || []).find(person => person.id === card.scorer_player_id);
          const option = document.createElement('option');
          option.value = String(index);
          option.textContent = marker ? `${marker.first_name} ${marker.surname}` : 'Marker name unavailable';
          select.append(option);
        });
        label.append(select);
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'secondary'; button.textContent = 'Copy scores for review';
        options.replaceChildren(label, button);
        output.textContent = 'Choose a marker, then review all copied scores before saving. Nothing is saved automatically.';
        button.addEventListener('click', () => {
          if (fixture.value !== fixtureId || player.value !== playerId) return clear();
          const scores = choices[Number(select.value)]?.marked_scores;
          const inputs = Array.from({ length: 18 }, (_, index) => fields.querySelector(`[name="gross_${index + 1}"]`));
          if (!scores || inputs.some(input => !input)) { output.textContent = 'The manual scorecard is not ready. Check the course and player, then try again.'; return; }
          if (scores.some(score => Number(score) === 0) && fields.dataset.provisional === 'true') { output.textContent = 'A picked-up hole needs an established playing handicap. This assessment card cannot be copied automatically.'; return; }
          if (inputs.some(input => input.value !== '') && !window.confirm('Replace the scores currently entered in the manual scorecard? Nothing has been saved yet.')) return;
          inputs.forEach((input, index) => { input.value = String(scores[index]); input.dispatchEvent(new Event('input', { bubbles: true })); });
          output.textContent = 'Scores copied. Check every hole and the totals, then use Confirm and save scorecard when ready.';
          fields.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      } catch (_) { if (request === requestId) output.textContent = 'Unable to load marker scores. Please try again.'; }
    });
  };
  new MutationObserver(wire).observe(document.querySelector('#app'), { childList: true, subtree: true });
  wire();
})();
