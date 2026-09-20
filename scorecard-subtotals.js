// Add Out/In summaries to the staff scorecard-entry grid.
(() => {
  const baseScorecardInputs = scorecardInputs;
  const baseUpdateScorecardTotals = updateScorecardTotals;

  const subtotalRow = (key, label) => {
    const template = document.createElement('template');
    template.innerHTML = `
      <div class="scorecard-subtotal">${label}</div>
      <div class="scorecard-subtotal" data-scorecard-subtotal="${key}-par">—</div>
      <div class="scorecard-subtotal"></div>
      <div class="scorecard-subtotal" data-scorecard-subtotal="${key}-gross">—</div>
      <div class="scorecard-subtotal" data-scorecard-subtotal="${key}-nett">—</div>
      <div class="scorecard-subtotal" data-scorecard-subtotal="${key}-points">—</div>`;
    return template.content;
  };

  const addSubtotals = () => {
    const grid = document.querySelector('#scorecard-fields .scorecard-grid');
    if (!grid || grid.querySelector('[data-scorecard-subtotal]')) return;
    const cells = [...grid.children];
    const firstHoleTenCell = cells[6 + 9 * 6];
    const total = grid.querySelector('.scorecard-total');
    if (!firstHoleTenCell || !total) return;
    grid.insertBefore(subtotalRow('out', 'Out'), firstHoleTenCell);
    grid.insertBefore(subtotalRow('in', 'In'), total);
  };

  const updateSubtotals = () => {
    const target = document.querySelector('#scorecard-fields');
    const course = setup(target?.dataset.courseSetupId);
    if (!target || !course) return;
    const playingHandicap = Number(target.dataset.playingHandicap);
    const scorecardHoles = holes(course.id);
    const set = (section, field, value) => {
      const cell = target.querySelector(`[data-scorecard-subtotal="${section}-${field}"]`);
      if (cell) cell.textContent = value == null ? '—' : value;
    };
    [['out', 0, 9], ['in', 9, 18]].forEach(([section, from, to]) => {
      const sectionHoles = scorecardHoles.slice(from, to);
      const entered = sectionHoles.map(hole => ({
        hole,
        gross: numberOrNull(target.querySelector(`[name="gross_${hole.hole_number}"]`)?.value)
      }));
      const scored = entered.filter(item => item.gross != null);
      const totals = scored.reduce((result, item) => {
        const nett = item.gross - handicapStrokes(playingHandicap, item.hole.stroke_index);
        result.gross += item.gross;
        result.nett += nett;
        result.points += Math.max(0, 2 + item.hole.par - nett);
        return result;
      }, { gross: 0, nett: 0, points: 0 });
      set(section, 'par', sectionHoles.reduce((sum, hole) => sum + Number(hole.par), 0));
      set(section, 'gross', scored.length ? totals.gross : null);
      set(section, 'nett', scored.length ? totals.nett : null);
      set(section, 'points', scored.length ? totals.points : null);
    });
  };

  scorecardInputs = function () {
    baseScorecardInputs();
    addSubtotals();
    updateSubtotals();
  };
  updateScorecardTotals = function () {
    baseUpdateScorecardTotals();
    updateSubtotals();
  };
})();
