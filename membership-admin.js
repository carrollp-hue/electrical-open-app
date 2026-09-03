(() => {
  const restrictMembershipAdmin = () => {
    if (!state.isMembershipAdmin || state.isAdmin) return;
    if (/^#admin\/(course|scores)$/.test(location.hash)) {
      location.hash = '#admin/members';
      return;
    }
    document.querySelectorAll('.admin-tabs a').forEach(tab => { if (!['#admin/members', '#admin/fixtures', '#admin/participants'].includes(tab.getAttribute('href'))) tab.remove(); });
    // Membership administrators must not edit club handicaps or special
    // adjustments directly, but they do need to see member removal requests.
    document.querySelectorAll('.admin-card').forEach(card => {
      if (/^club handicap\s*\/\s*special adjustment$/i.test(card.querySelector('h2')?.textContent?.trim() || '')) card.remove();
    });
  };
  const membershipLoad = load;
  load = async function () {
    await membershipLoad();
    const { data } = await client.from('user_roles').select('role');
    state.isMembershipAdmin = Boolean(data?.some(item => item.role === 'membership_admin'));
    if (state.isMembershipAdmin) state.isStaff = true;
    window.electricalOpenAdminAccessReady = true;
    render();
    restrictMembershipAdmin();
  };
  const initialiseMembershipAccess = async () => {
    const { data } = await client.from('user_roles').select('role');
    state.isMembershipAdmin = Boolean(data?.some(item => item.role === 'membership_admin'));
    if (state.isMembershipAdmin) state.isStaff = true;
    window.electricalOpenAdminAccessReady = true;
    restrictMembershipAdmin();
    if (location.hash.startsWith('#admin') && Array.isArray(state.memberDirectory)) render();
  };
  window.addEventListener('hashchange', restrictMembershipAdmin);
  new MutationObserver(restrictMembershipAdmin).observe(document.querySelector('#app'), { childList: true, subtree: true });
  restrictMembershipAdmin();
  initialiseMembershipAccess();
})();
