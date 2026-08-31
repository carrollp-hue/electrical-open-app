(() => {
  const navigation = document.querySelector('#main-nav');
  if (!navigation) return;

  // Keep the persistent bottom navigation independent of whichever detail
  // screen is currently rendering inside #app.  Some installed-web-app
  // browsers can drop the normal anchor click after a touch gesture on a
  // scrollable result table, so route it explicitly as a safety net.
  navigation.addEventListener('click', event => {
    const link = event.target.closest('a[data-route]');
    if (!link || !navigation.contains(link)) return;
    const target = link.getAttribute('href');
    if (!target || location.hash === target) return;
    event.preventDefault();
    location.hash = target;
  }, true);
})();
