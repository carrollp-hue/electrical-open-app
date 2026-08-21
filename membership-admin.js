(() => {
  const restrictMembershipAdmin = () => {
    if (!state.isMembershipAdmin || state.isAdmin) return;
    if (/^#admin\/(course|scores)$/.test(location.hash)) {
      location.hash = '#admin/members';
      return;
    }
    document.querySelectorAll('.admin-tabs a').forEach(tab => { if (!['#admin/members', '#admin/fixtures', '#admin/participants'].includes(tab.getAttribute('href'))) tab.remove(); });
    document.querySelectorAll('.admin-card').forEach(card => { if (/club handicap|special adjustment/i.test(card.querySelector('h2')?.textContent || '')) card.remove(); });
  };
  const membershipLoad = load;
  load = async function () {
    await membershipLoad();
    const { data } = await client.from('user_roles').select('role');
    state.isMembershipAdmin = Boolean(data?.some(item => item.role === 'membership_admin'));
    if (state.isMembershipAdmin) state.isStaff = true;
    render();
    restrictMembershipAdmin();
  };
  window.addEventListener('hashchange', restrictMembershipAdmin);
  new MutationObserver(restrictMembershipAdmin).observe(document.querySelector('#app'), { childList: true, subtree: true });
  restrictMembershipAdmin();
})();
