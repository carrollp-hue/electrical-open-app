(() => {
  const addInvitationCard = () => {
    const panel = document.querySelector('#app .admin-panel');
    if (!state.isAdmin || !panel || location.hash !== '#admin/members' || document.querySelector('#invite-member-form')) return;
    const availablePlayers = state.memberDirectory.filter(player => !player.profile_id && !player.is_guest).sort((a, b) => a.surname.localeCompare(b.surname) || a.first_name.localeCompare(b.first_name));
    const options = availablePlayers.map(player => `<option value="${player.id}">${esc(player.surname).toUpperCase()}, ${esc(player.first_name)}</option>`).join('');
    panel.insertAdjacentHTML('afterbegin', `<div class="admin-card"><h2>Invite app member</h2><p>Highest-admin only. This creates and links a login account, then sends an eight-digit account-setup code. The member chooses their own password.</p><form class="admin-form" id="invite-member-form"><label>Player<select name="player_id" required><option value="">Select an unlinked player</option>${options}</select></label><label>Email address<input name="email" type="email" autocomplete="email" required></label><button class="primary" type="submit">Send account setup code</button></form><p class="admin-message" id="invite-member-message"></p></div>`);
    document.querySelector('#invite-member-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button');
      const output = document.querySelector('#invite-member-message');
      button.disabled = true;
      output.textContent = 'Creating account…';
      const data = new FormData(form);
      const player = state.memberDirectory.find(item => item.id === data.get('player_id'));
      const { error } = await client.functions.invoke('invite-member', { body: { player_id: data.get('player_id'), email: data.get('email')?.trim(), display_name: player ? `${player.first_name} ${player.surname}` : '' } });
      button.disabled = false;
      if (error) { output.textContent = error.message; output.style.color = '#b42318'; return; }
      output.style.color = '';
      output.textContent = 'Invitation sent. The member must use “Set up invited account” on the sign-in screen and enter the eight-digit code.';
      await load();
      location.hash = '#admin/members';
    });
  };
  new MutationObserver(addInvitationCard).observe(document.querySelector('#app'), { childList: true, subtree: true });
  addInvitationCard();
})();
