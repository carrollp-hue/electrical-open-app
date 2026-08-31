(() => {
  const sync = details => {
    const summary = details.querySelector('summary');
    if (summary) summary.setAttribute('aria-expanded', String(details.open));
  };

  const toggle = event => {
    const summary = event.target.closest('details.countback-card > summary');
    if (!summary) return;
    const details = summary.parentElement;
    if (!(details instanceof HTMLDetailsElement)) return;

    // Do this on the initial press.  Installed-phone browsers can interpret
    // a tap in a scrollable fixture view as a gesture and omit the native
    // details click that would otherwise expand this section.
    event.preventDefault();
    event.stopPropagation();
    details.open = !details.open;
    sync(details);
    details.dataset.countbackPressedAt = String(Date.now());
  };

  document.addEventListener('pointerdown', toggle, true);
  document.addEventListener('click', event => {
    const summary = event.target.closest('details.countback-card > summary');
    if (!summary) return;
    const details = summary.parentElement;
    if (!(details instanceof HTMLDetailsElement)) return;
    if (Date.now() - Number(details.dataset.countbackPressedAt || 0) < 800) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    toggle(event);
  }, true);

  new MutationObserver(() => document.querySelectorAll('details.countback-card').forEach(sync))
    .observe(document.querySelector('#app'), { childList: true, subtree: true });
  document.querySelectorAll('details.countback-card').forEach(sync);
})();
