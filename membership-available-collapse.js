(() => {
  const originalRender = render;
  render = function () {
    originalRender();
    enhance();
  };

  const isMembersPage = () => ['#admin', '#admin/members'].includes(location.hash);
  function enhance() {
    const panel = document.querySelector('.admin-panel');
    if (!isMembersPage() || !panel) return;
    const card = panel.querySelector('#season-member-add-form')?.closest('.admin-card');
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
  }

  new MutationObserver(enhance).observe(document.querySelector('#app'), { childList: true, subtree: true });
  window.addEventListener('hashchange', () => setTimeout(enhance, 0));
  setTimeout(enhance, 0);
})();
