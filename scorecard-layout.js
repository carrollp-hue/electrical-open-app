(() => {
  const addFrontNineSubtotal = () => document.querySelectorAll('#app table').forEach(table => {
    const headings = [...table.querySelectorAll('thead th')].map(cell => cell.textContent.trim().toUpperCase()).join('|');
    if (headings !== 'HOLE|PAR|SI|GROSS|NETT|PTS' || table.dataset.scorecardSubtotals) return;
    table.classList.add('standard-scorecard-table');
    const rows = [...table.querySelectorAll('tbody tr')];
    const frontNine = rows.filter(row => Number(row.cells[0]?.textContent) >= 1 && Number(row.cells[0]?.textContent) <= 9);
    const backNine = rows.filter(row => Number(row.cells[0]?.textContent) >= 10 && Number(row.cells[0]?.textContent) <= 18);
    const ninth = frontNine.find(row => Number(row.cells[0]?.textContent) === 9), eighteenth = backNine.find(row => Number(row.cells[0]?.textContent) === 18);
    if (!ninth || !eighteenth || frontNine.length !== 9 || backNine.length !== 9) return;
    const subtotalRow = (label, scoreRows) => { const total = column => scoreRows.reduce((sum, row) => sum + Number(row.cells[column]?.textContent || 0), 0); const row = document.createElement('tr'); row.className = 'front-nine-subtotal'; row.innerHTML = `<td><strong>${label}</strong></td><td><strong>${total(1)}</strong></td><td></td><td><strong>${total(3)}</strong></td><td><strong>${total(4)}</strong></td><td><strong>${total(5)}</strong></td>`; return row; };
    ninth.after(subtotalRow('Out', frontNine));
    eighteenth.after(subtotalRow('In', backNine));
    table.dataset.scorecardSubtotals = 'true';
  });
  new MutationObserver(addFrontNineSubtotal).observe(document.querySelector('#app'), { childList: true, subtree: true });
  addFrontNineSubtotal();
})();
