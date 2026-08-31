(() => {
  const navigation = document.querySelector('#main-nav');
  if (!navigation) return;

  // Keep the persistent bottom navigation independent of whichever detail
  // screen is currently rendering inside #app.  Some installed-web-app
  // browsers can drop the normal anchor click after a touch gesture on a
  // scrollable result table, so route it explicitly as a safety net.
  const navigate = event => {
    const link = event.target.closest('a[data-route]');
    if (!link || !navigation.contains(link)) return;
    if (event.type === 'pointerdown' && event.button !== 0) return;
    const target = link.getAttribute('href');
    if (!target || location.hash === target) return;
    event.preventDefault();
    event.stopPropagation();
    location.hash = target;
  };

  // Handle the press itself as well as click.  This keeps the persistent bar
  // usable when an installed app turns a tap in a scrollable fixture/result
  // view into a gesture and never dispatches the later click event.
  navigation.addEventListener('pointerdown', navigate, true);
  navigation.addEventListener('click', navigate, true);
})();
