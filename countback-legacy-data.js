// Supply countback calculations with stored playing handicaps for older cards
// that did not persist per-hole Stableford values or stroke allocations.
(() => {
  const baseLoad = load;
  load = async function () {
    await baseLoad();
    const [{ data: entries, error: entryError }, { data: scores, error: scoreError }] = await Promise.all([
      client.from('fixture_entries').select('id, playing_handicap'),
      client.from('hole_scores').select('fixture_entry_id, hole_number, gross_score, handicap_strokes, stableford_points')
    ]);
    if (entryError || scoreError) throw (entryError || scoreError);
    const handicaps = new Map((entries || []).map(entry => [entry.id, entry.playing_handicap]));
    state.entries = state.entries.map(entry => ({ ...entry, playing_handicap: handicaps.get(entry.id) }));
    state.holeScores = scores || [];
    render();
  };

  fixtureCountback = function (entryId) {
    const entry = state.entries.find(item => item.id === entryId);
    const fixture = state.fixtures.find(item => item.id === entry?.fixture_id);
    const course = setup(fixture?.course_setup_id);
    const scores = (state.holeScores || []).filter(item => item.fixture_entry_id === entryId);
    const points = score => {
      if (score.stableford_points != null) return Number(score.stableford_points);
      const hole = holes(course?.id).find(item => item.hole_number === score.hole_number);
      if (!hole || score.gross_score == null) return null;
      const strokes = score.handicap_strokes != null
        ? Number(score.handicap_strokes)
        : entry?.playing_handicap != null ? handicapStrokes(Number(entry.playing_handicap), hole.stroke_index) : null;
      return strokes == null ? null : Math.max(0, 2 + Number(hole.par) - (Number(score.gross_score) - strokes));
    };
    const total = (from, to) => {
      const values = scores.filter(item => item.hole_number >= from && item.hole_number <= to).map(points);
      return values.length && values.every(value => value != null) ? values.reduce((sum, value) => sum + value, 0) : null;
    };
    const single = hole => points(scores.find(item => item.hole_number === hole) || {});
    return [total(10, 18), total(13, 18), total(16, 18), single(18), total(1, 9), total(4, 9), total(7, 9), single(9)];
  };
})();
