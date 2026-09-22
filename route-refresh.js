// Several feature modules replace render(). This final listener always uses
// the completed renderer after an in-app fixture link changes the hash.
(() => {
  let pending = false;
  window.addEventListener('hashchange', () => {
    if (pending) return;
    pending = true;
    setTimeout(() => {
      pending = false;
      render();
    }, 0);
  });
})();
