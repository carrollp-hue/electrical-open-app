// Make countback evidence visible on an unfinished fixture, even with fewer
// than five scored players. It remains provisional until the fixture is finalised.
(() => {
  const countbackScores = new Map();
  const pendingFixtures = new Set();

  const fillCountback = (fixtureId, card, scores) => {
    const entriesByName = new Map(state.entries
      .filter(entry => entry.fixture_id === fixtureId)
      .map(entry => [String(entry.player_name || '').trim(), entry]));
    const isStandalone = card.classList.contains('precommit-countback-card');
    const valuesFor = entryId => {
      const score = scores.find(item => item.fixture_entry_id === entryId);
      return score ? [score.back_nine, score.last_six, score.last_three, score.hole_eighteen, score.front_nine, score.front_six, score.front_three, score.hole_nine] : [];
    };
    card.querySelectorAll('tbody tr').forEach(row => {
      const cells = Array.from(row.children);
      const playerCell = cells[isStandalone ? 0 : 1];
      const entry = entriesByName.get(String(playerCell?.textContent || '').trim());
      if (!entry) return;
      valuesFor(entry.id).forEach((value, index) => {
        const cell = cells[(isStandalone ? 2 : 3) + index];
        if (cell) cell.textContent = value == null ? '—' : String(value);
      });
    });

    // The official positions remain unset until commitment, but place the
    // on-screen fixture list in the same provisional order for checking.
    const countbackByName = new Map(Array.from(card.querySelectorAll('tbody tr')).map(row => {
      const cells = Array.from(row.children);
      const offset = isStandalone ? 0 : 1;
      return [String(cells[offset]?.textContent || '').trim(), {
        points: Number(cells[offset + 1]?.textContent),
        values: cells.slice(offset + 2).map(cell => Number(cell.textContent))
      }];
    }));
    const rankedCountback = [...countbackByName.entries()].sort((first, second) => {
      const points = second[1].points - first[1].points;
      if (points) return points;
      for (let index = 0; index < first[1].values.length; index += 1) {
        const difference = second[1].values[index] - first[1].values[index];
        if (difference) return difference;
      }
      return first[0].localeCompare(second[0]);
    });
    rankedCountback.forEach(([name], index) => {
      const row = Array.from(card.querySelectorAll('tbody tr')).find(item => String(item.children[isStandalone ? 0 : 1]?.textContent || '').trim() === name);
      if (row?.children[0]) row.children[0].textContent = String(index + 1);
    });

    const resultsTable = document.querySelector('#app .section:not(.countback-card) .table');
    if (!resultsTable) return;
    const rows = Array.from(resultsTable.querySelectorAll('tbody tr')).map(row => {
      const countback = countbackByName.get(String(row.children[1]?.textContent || '').trim());
      return countback ? { row, ...countback } : null;
    }).filter(Boolean);
    if (!rows.length) return;
    const compare = (first, second) => {
      const points = second.points - first.points;
      if (points) return points;
      for (let index = 0; index < first.values.length; index += 1) {
        const difference = Number(second.values[index] ?? -1) - Number(first.values[index] ?? -1);
        if (difference) return difference;
      }
      return String(first.row.children[1]?.textContent).localeCompare(String(second.row.children[1]?.textContent));
    };
    const scored = rows.filter(item => Number.isFinite(item.points)).sort(compare);
    const unscored = rows.filter(item => !Number.isFinite(item.points));
    const body = resultsTable.querySelector('tbody');
    scored.forEach((item, index) => {
      if (item.row.children[0]) item.row.children[0].textContent = String(index + 1);
      body.append(item.row);
    });
    unscored.forEach(item => body.append(item.row));
    const positionHeading = resultsTable.querySelector('thead th:first-child');
    if (positionHeading) positionHeading.textContent = 'PROV.';
    requestAnimationFrame(() => scored.forEach((item, index) => {
      if (item.row.isConnected && item.row.children[0]) item.row.children[0].textContent = String(index + 1);
    }));
    // Some fixture enhancements redraw immediately after this module. Apply
    // the visible provisional top five once that redraw has completed.
    setTimeout(() => {
      const liveCard = document.querySelector('.countback-card');
      const liveTable = document.querySelector('#app .section:not(.countback-card) .table');
      if (!liveCard || !liveTable) return;
      const order = Array.from(liveCard.querySelectorAll('tbody tr')).map(row => String(row.children[1]?.textContent || '').trim());
      const liveBody = liveTable.querySelector('tbody');
      const liveRows = Array.from(liveBody.rows);
      const orderedRows = order.map(name => liveRows.find(row => String(row.children[1]?.textContent || '').trim() === name)).filter(Boolean);
      const firstOther = liveRows.find(row => !orderedRows.includes(row));
      orderedRows.forEach((row, index) => {
        if (row.children[0]) row.children[0].textContent = String(index + 1);
        liveBody.insertBefore(row, firstOther || null);
      });
    }, 100);
  };

  const enrichCountback = async (fixtureId, card) => {
    if (countbackScores.has(fixtureId)) {
      fillCountback(fixtureId, card, countbackScores.get(fixtureId));
      return;
    }
    if (pendingFixtures.has(fixtureId)) return;
    pendingFixtures.add(fixtureId);
    const { data, error } = await client.rpc('fixture_provisional_countbacks', { p_fixture_id: fixtureId });
    if (error) {
      pendingFixtures.delete(fixtureId);
      return;
    }
    pendingFixtures.delete(fixtureId);
    countbackScores.set(fixtureId, data || []);
    const latestCard = document.querySelector('.countback-card:not(.precommit-countback-card)') || document.querySelector('.precommit-countback-card');
    if (latestCard) fillCountback(fixtureId, latestCard, data || []);
  };

  const render = () => {
    const appRoot = document.querySelector('#app');
    const match = location.hash.match(/^#fixtures\/([^/]+)$/);
    if (!appRoot || !match || appRoot.querySelector('.precommit-countback-card')) return;
    const fixture = state.fixtures.find(item => item.id === match[1]);
    if (!fixture || fixture.status === 'completed') return;

    const existing = appRoot.querySelector('details.countback-card');
    if (existing) {
      if (existing.dataset.precommitLabelled === 'true') return;
      existing.dataset.precommitLabelled = 'true';
      const summary = existing.querySelector('summary strong');
      const note = existing.querySelector('.intro');
      if (summary) summary.textContent = 'Provisional countback — before commitment';
      if (note) note.textContent = 'These figures are based on entered official scorecards. Check tied totals from left to right before finalising the fixture.';
      enrichCountback(fixture.id, existing);
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
    enrichCountback(fixture.id, appRoot.querySelector('.precommit-countback-card'));
  };

  new MutationObserver(render).observe(document.querySelector('#app'), { childList: true, subtree: true });
  window.addEventListener('hashchange', render);
  render();
})();
