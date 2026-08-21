(() => {
  const config = window.ELECTRICAL_OPEN_CONFIG;
  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
  const form = document.querySelector('#reset-password-form');
  const status = document.querySelector('#reset-status');
  const message = document.querySelector('#reset-message');
  const password = document.querySelector('#new-password');
  const confirm = document.querySelector('#confirm-password');
  let validLink = false;

  const showError = text => { status.textContent = text; status.classList.add('error'); };
  const enableForm = () => {
    validLink = true;
    status.hidden = true;
    form.hidden = false;
  };
  const checkSession = async () => {
    const params = new URLSearchParams(location.search);
    const tokenHash = params.get('token_hash');
    if (tokenHash && params.get('type') === 'recovery') {
      const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
      if (error) {
        showError(`Supabase could not verify this reset link: ${error.message}`);
        return;
      }
    }
    const { data: { session } } = await client.auth.getSession();
    if (session) enableForm();
    else if (!validLink) showError('No recovery session was created. Request a new reset email and open its newest link.');
  };

  client.auth.onAuthStateChange((event, session) => {
    if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) enableForm();
  });
  setTimeout(checkSession, 200);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!validLink) return;
    if (password.value.length < 6) { message.textContent = 'Use at least 6 characters for your password.'; message.classList.add('error'); return; }
    if (password.value !== confirm.value) { message.textContent = 'The passwords do not match.'; message.classList.add('error'); return; }
    const button = form.querySelector('button');
    button.disabled = true;
    message.textContent = 'Saving…';
    message.classList.remove('error');
    const { error } = await client.auth.updateUser({ password: password.value });
    if (error) {
      message.textContent = error.message || 'Could not update your password.';
      message.classList.add('error');
      button.disabled = false;
      return;
    }
    await client.from('profiles').update({ password_change_required: false }).eq('id', (await client.auth.getUser()).data.user?.id);
    message.textContent = 'Password updated. You can now sign in.';
    setTimeout(() => { location.replace('./'); }, 1200);
  });
})();
