(function (root) {
  function round1(value) { return Math.round((value + Number.EPSILON) * 10) / 10; }
  function numeric(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
  function ruleForCount(count) {
    if (count < 4) return { used: 1, adjustment: -2 };
    if (count === 4) return { used: 1, adjustment: -1 };
    if (count === 5) return { used: 1, adjustment: 0 };
    if (count === 6) return { used: 2, adjustment: -1 };
    if (count <= 8) return { used: 2, adjustment: 0 };
    if (count <= 11) return { used: 3, adjustment: 0 };
    return { used: 4, adjustment: 0 };
  }
  function calculate(input) {
    const qualifyingRounds = (input.rounds || [])
      .map(round => ({ ...round, differential: numeric(round.scoreDifferential), indexAtEntry: numeric(round.handicapIndexAtEntry), esr: numeric(round.esrAdjustment) || 0, winnerCut: numeric(round.winnerCut) || 0 }))
      .filter(round => round.differential !== null)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 12);
    if (!qualifyingRounds.length) return { index: null, reason: 'No qualifying score differentials', rounds: [] };
    const lows = qualifyingRounds.map(round => round.differential).sort((a, b) => a - b);
    const rule = ruleForCount(qualifyingRounds.length);
    const selected = lows.slice(0, rule.used);
    const preCapIndex = round1(selected.reduce((total, value) => total + value, 0) / selected.length + rule.adjustment);
    const historicalIndices = qualifyingRounds.map(round => round.indexAtEntry).filter(value => value !== null);
    const baselineIndex = historicalIndices.length ? Math.min(...historicalIndices) : null;
    const softCap = baselineIndex === null ? null : baselineIndex + 3;
    const hardCap = baselineIndex === null ? null : baselineIndex + 5;
    const softCapReduction = softCap !== null && preCapIndex > softCap ? (preCapIndex - softCap) / 2 : 0;
    // The workbook displays the soft-cap calculation but applies only the hard cap to Calc Index.
    const calculatedIndex = round1(hardCap === null ? preCapIndex : Math.min(preCapIndex, hardCap));
    const clubHandicap = numeric(input.clubHandicap);
    const committeeAdjustment = numeric(input.committeeAdjustment) || 0;
    const scoreAdjustments = qualifyingRounds.reduce((total, round) => total + round.esr + round.winnerCut, 0);
    const indexBeforeRound = clubHandicap === null ? calculatedIndex : Math.min(clubHandicap, calculatedIndex);
    return {
      index: round1(indexBeforeRound + committeeAdjustment - scoreAdjustments),
      qualifyingRoundCount: qualifyingRounds.length,
      rule,
      selectedDifferentials: selected,
      preCapIndex,
      baselineIndex,
      softCap,
      hardCap,
      softCapReduction: round1(softCapReduction),
      calculatedIndex,
      clubHandicap,
      committeeAdjustment,
      scoreAdjustments: round1(scoreAdjustments),
      rounds: qualifyingRounds
    };
  }
  const api = { calculate, ruleForCount };
  if (typeof module !== 'undefined') module.exports = api;
  root.ElectricalOpenHandicap = api;
})(typeof window === 'undefined' ? globalThis : window);
