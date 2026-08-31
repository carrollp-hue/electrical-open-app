(() => {
  const enforceAdminAccess = () => {
    const canAdminister = Boolean(state.isStaff || state.isMembershipAdmin || state.isAdmin);
    document.querySelector('#admin-nav').hidden = true;
    const adminQuick = document.querySelector('#admin-quick');
    if (adminQuick) adminQuick.hidden = !canAdminister;
    if (window.electricalOpenAdminAccessReady && !canAdminister && location.hash.startsWith('#admin')) location.hash = '#home';
  };
  const guardedLoad = load;
  load = async function () {
    await guardedLoad();
    enforceAdminAccess();
  };
  window.addEventListener('hashchange', enforceAdminAccess);
  new MutationObserver(enforceAdminAccess).observe(document.querySelector('#app'), { childList: true, subtree: true });
  enforceAdminAccess();
})();
