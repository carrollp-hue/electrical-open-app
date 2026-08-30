(() => {
  const originalLoad = load;
  load = async function () {
    await originalLoad();
    const { data: roles, error: rolesError } = await client.from('user_roles').select('role');
    if (rolesError) throw rolesError;
    state.canApproveClubHandicapRemovals = (roles || []).some(item => ['membership_admin', 'admin'].includes(item.role));
    state.clubHandicapRemovalRequests = [];
    if (state.canApproveClubHandicapRemovals) {
      const { data, error } = await client.rpc('list_club_handicap_removal_requests');
      if (error) throw error;
      state.clubHandicapRemovalRequests = data || [];
    }
    render();
  };

  const originalHandicap = handicap;
  handicap = function (roundId) {
    const page = originalHandicap(roundId);
    if (roundId || !player()?.club_handicap) return page;
    const request = `<section class="section club-handicap-removal"><h2>Leaving your golf club?</h2><p>If you no longer hold a club handicap, ask a membership administrator to remove it. Your society index will then be used.</p><p class="form-message" id="club-handicap-removal-message"></p><button class="secondary" type="button" id="request-club-handicap-removal">Request club handicap removal</button></section>`;
    return page.replace('</section>', '</section>' + request);
  };

  const originalRender = render;
  render = function () {
    originalRender();
    document.querySelector('#request-club-handicap-removal')?.addEventListener('click', requestRemoval);
    addAdminRequests();
  };

  function addAdminRequests() {
    const panel = document.querySelector('.admin-panel');
    if (location.hash !== '#admin/members' || !panel || document.querySelector('#club-handicap-removal-requests')) return;
    const requests = state.clubHandicapRemovalRequests || [];
    const rows = requests.length ? requests.map(request => `<tr><td>${esc(request.surname).toUpperCase()}, ${esc(request.first_name)}<br><span>Club handicap ${Number(request.club_handicap).toFixed(1)} · requested ${date(request.requested_at)}</span></td><td><button class="secondary" type="button" data-approve-club-removal="${request.request_id}">Remove club handicap</button></td></tr>`).join('') : '<tr><td>No pending removal requests.</td></tr>';
    panel.insertAdjacentHTML('beforeend', `<div class="admin-card" id="club-handicap-removal-requests"><h2>Club handicap removal requests</h2><table class="table"><tbody>${rows}</tbody></table></div>`);
    document.querySelectorAll('[data-approve-club-removal]').forEach(button => button.addEventListener('click', () => approveRemoval(button)));
  }

  async function requestRemoval() {
    if (!window.confirm('Send a request to remove your club handicap? A membership administrator must approve it.')) return;
    const { error } = await client.rpc('request_my_club_handicap_removal');
    const target = document.querySelector('#club-handicap-removal-message');
    if (error) { if (target) target.textContent = error.message; return; }
    if (target) target.textContent = 'Request sent to the membership administrators.';
    document.querySelector('#request-club-handicap-removal')?.setAttribute('disabled', 'disabled');
  }

  async function approveRemoval(button) {
    if (!window.confirm('Remove this member’s club handicap? Their society index will be used from now on.')) return;
    const { error } = await client.rpc('approve_club_handicap_removal', { p_request_id: button.dataset.approveClubRemoval });
    if (error) return message(error.message, true);
    await load(); location.hash = '#admin/members'; message('Club handicap removed and request approved.');
  }

  setTimeout(() => { if (session) load().catch(error => login(error.message)); }, 0);
})();
