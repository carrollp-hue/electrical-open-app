(() => {
  const openDefaultAdminPage = () => {
    if (location.hash !== '#admin') return;
    history.replaceState(null, '', '#admin/members');
    if (document.querySelector('.admin-panel')) render();
  };

  window.addEventListener('hashchange', () => setTimeout(openDefaultAdminPage, 0));
  setTimeout(openDefaultAdminPage, 0);
})();
