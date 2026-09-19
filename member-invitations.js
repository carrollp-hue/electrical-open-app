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
      // Use the existing session directly. Refreshing it here redraws the
      // Admin page and can interrupt an in-flight invitation on mobile.
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        button.disabled = false;
        showMessage('Your session has expired. Please sign out and sign in again, then retry.', 'error');
        return;
      }
      button.disabled = false;
      let response;
      let responseBody;
      try {
        response = await fetch(`${config.supabaseUrl}/functions/v1/invite-member`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
            apikey: config.supabasePublishableKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ player_id: data.get('player_id'), email: data.get('email')?.trim(), display_name: player ? `${player.first_name} ${player.surname}` : '' })
        });
        responseBody = await response.json().catch(() => ({}));
      } catch (_) {
        showMessage('Could not reach the invitation service. Check your connection, refresh the app, and try again.', 'error');
        return;
      }
      if (!response.ok) {
        let detail = responseBody?.error || responseBody?.message || `The invitation service returned ${response.status}.`;
        try {
          detail = String(detail);
        } catch (_) { /* The server response is optional. */ }
        showMessage(`Invitation failed: ${detail}`, 'error');
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
