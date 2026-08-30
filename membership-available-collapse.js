(() => {
  const originalRender = render;
  render = function () {
    originalRender();
    const panel = document.querySelector('.admin-panel');
    if (location.hash !== '#admin/members' || !panel) return;
    const card = Array.from(panel.querySelectorAll('.admin-card')).find(item => item.querySelector('h2')?.textContent.trim() === 'Players available to add');
    if (!card || card.dataset.collapseReady) return;

    card.dataset.collapseReady = 'true';
    const heading = card.querySelector('h2');
    const content = Array.from(card.children).filter(item => item !== heading);
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'secondary collapse-control';
    toggle.textContent = 'Expand';
    toggle.setAttribute('aria-expanded', 'false');
    heading.append(' ', toggle);

    const setExpanded = expanded => {
      content.forEach(item => { item.hidden = !expanded; });
      toggle.textContent = expanded ? 'Minimise' : 'Expand';
      toggle.setAttribute('aria-expanded', String(expanded));
    };
    setExpanded(false);
    toggle.addEventListener('click', () => setExpanded(toggle.getAttribute('aria-expanded') !== 'true'));
  };

  setTimeout(() => { if (session) render(); }, 0);
})();
