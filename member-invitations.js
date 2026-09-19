(() => {
  const addInvitationCard = () => {
    const panel = document.querySelector('#app .admin-panel');
    if (!state.isAdmin || !panel || location.hash !== '#admin/members' || document.querySelector('#invite-member-form')) return;
    const availablePlayers = state.memberDirectory.filter(player => !player.profile_id && !player.is_guest).sort((a, b) => a.surname.localeCompare(b.surname) || a.first_name.localeCompare(b.first_name));
    const options = availablePlayers.map(player => `<option value="${player.id}">${esc(player.surname).toUpperCase()}, ${esc(player.first_name)}</option>`).join('');
    const savedMessage = window.electricalOpenInviteMessage || { text: '', type: '' };
    panel.insertAdjacentHTML('afterbegin', `<div class="admin-card"><h2>Invite app member</h2><p>Highest-admin only. This creates and links a login account, then sends an eight-digit account-setup code. The member chooses their own password.</p><form class="admin-form" id="invite-member-form"><label>Player<select name="player_id" required><option value="">Select an unlinked player</option>${options}</select></label><label>Email address<input name="email" type="email" autocomplete="email" required></label><button class="primary" type="submit">Send account setup code</button></form><p class="admin-message${savedMessage.type ? ` ${savedMessage.type}` : ''}" id="invite-member-message" role="${savedMessage.type === 'error' ? 'alert' : 'status'}" aria-live="polite">${esc(savedMessage.text)}</p></div>`);
    document.querySelector('#invite-member-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button');
      const showMessage = (message, type = '') => {
        window.electricalOpenInviteMessage = { text: message, type };
        // Refreshing an auth session can redraw the Admin view. Always find
        // the current message element rather than updating the old form.
        const output = document.querySelector('#invite-member-message');
        if (!output) return;
        output.textContent = message;
        output.className = `admin-message${type ? ` ${type}` : ''}`;
        output.setAttribute('role', type === 'error' ? 'alert' : 'status');
      };
      button.disabled = true;
      showMessage('Creating account…');
      const data = new FormData(form);
      const player = state.memberDirectory.find(item => item.id === data.get('player_id'));
      // Refresh the session immediately before calling the protected function.
      // Admin pages can remain open for a while, leaving an otherwise valid
      // account with an expired bearer token for this one request.
      const { error: refreshError } = await client.auth.refreshSession();
      if (refreshError) {
        button.disabled = false;
        showMessage('Your session has expired. Please sign out and sign in again, then retry.', 'error');
        return;
      }
      const { error } = await client.functions.invoke('invite-member', { body: { player_id: data.get('player_id'), email: data.get('email')?.trim(), display_name: player ? `${player.first_name} ${player.surname}` : '' } });
      button.disabled = false;
      if (error) {
        let detail = error.message;
        try {
          const response = error.context;
          const body = response && typeof response.json === 'function' ? await response.clone().json() : null;
          detail = body?.error || body?.message || detail;
        } catch (_) { /* The response body is optional for network errors. */ }
        showMessage(detail === 'Failed to send a request to the Edge Function'
          ? 'Could not reach the invitation service. Please refresh the app and try again.'
          : `Invitation failed: ${detail}`, 'error');
        return;
      }
      showMessage('Invitation sent. The member must use “Set up invited account” on the sign-in screen and enter the eight-digit code.', 'success');
      await load();
      location.hash = '#admin/members';
    });
  };
  new MutationObserver(addInvitationCard).observe(document.querySelector('#app'), { childList: true, subtree: true });
  addInvitationCard();
})();
