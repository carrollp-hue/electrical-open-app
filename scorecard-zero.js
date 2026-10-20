// Shared comparison rules for submitted scorecards. Zero denotes a pickup.
(() => {
  const isScore = value => value !== null && value !== undefined && value !== '' && Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 20;
  const strokes = (handicap, strokeIndex) => {
    const sign = handicap < 0 ? -1 : 1;
    const absolute = Math.abs(handicap);
    return sign * (Math.floor(absolute / 18) + (strokeIndex <= absolute % 18 ? 1 : 0));
  };
  const equal = (first, second, hole, playingHandicap) => {
    if (!isScore(first) || !isScore(second)) return false;
    const a = Number(first), b = Number(second);
    if (a === b) return true;
    if (a !== 0 && b !== 0) return false;
    if (!hole || playingHandicap == null || !Number.isInteger(Number(playingHandicap))) return false;
    const par = Number(hole.par), si = Number(hole.stroke_index);
    if (!Number.isInteger(par) || !Number.isInteger(si) || si < 1 || si > 18) return false;
    return (a === 0 ? b : a) === par + 2 + strokes(Number(playingHandicap), si);
  };
  const differences = (first, second, courseHoles, playingHandicap) => {
    if (!Array.isArray(first) || !Array.isArray(second) || first.length !== 18 || second.length !== 18) return null;
    return first.map((value, index) => equal(value, second[index], courseHoles?.[index], playingHandicap) ? null : index + 1).filter(Boolean);
  };
  const holeScore = (entered, hole, playingHandicap) => {
    if (!isScore(entered) || !hole || playingHandicap == null || !Number.isInteger(Number(playingHandicap)) || Number(playingHandicap) > 28) return null;
    const value = Number(entered), par = Number(hole.par), si = Number(hole.stroke_index);
    if (!Number.isInteger(par) || !Number.isInteger(si) || si < 1 || si > 18) return null;
    const playingStrokes = strokes(Number(playingHandicap), si);
    const gross = value === 0 ? par + 2 + playingStrokes : value;
    const nett = gross - playingStrokes;
    return { gross, nett, points: value === 0 ? 0 : Math.max(0, 2 + par - nett), adjusted: value === 0 ? par + 2 + playingStrokes : Math.min(value, par + 2 + playingStrokes) };
  };
  window.electricalOpenScorecardZero = Object.freeze({ equal, differences, strokes, holeScore });
})();
