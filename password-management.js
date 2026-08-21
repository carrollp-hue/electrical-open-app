(() => {
  const config = window.ELECTRICAL_OPEN_CONFIG;
  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
  const dialog = document.querySelector('#password-dialog');
  const form = document.querySelector('#password-form');
  const title = document.querySelector('#password-title');
  const intro = document.querySelector('#password-intro');
  const email = document.querySelector('#reset-email');
  const code = document.querySelector('#reset-code');
  const password = document.querySelector('#new-password');
  const confirm = document.querySelector('#confirm-password');
  const message = document.querySelector('#password-message');
  const submit = document.querySelector('#password-submit');
  let mode = 'reset';
  let forced = false;
  let requiresProfileClear = false;
  let resetEmail = '';
  let verificationType = 'recovery';

  const setMessage = (text, error = false) => {
    message.textContent = text;
    message.classList.toggle('error', error);
  };
  const isRecoveryLink = () => new URLSearchParams(location.search).get('reset-password') === 'true' || /(?:^|[&#])type=(?:recovery|invite)(?:&|$)/.test(location.hash);
  const show = (nextMode, mustChange = false) => {
    mode = nextMode;
    forced = mustChange;
    form.reset();
    setMessage('');
    const isReset = mode === 'reset', isInvite = mode === 'invite', isCode = mode === 'code';
    title.textContent = isReset ? 'Reset password' : isInvite ? 'Set up invited account' : isCode ? 'Enter account code' : 'Choose a new password';
    intro.textContent = isReset ? 'Enter your email and we will send an eight-digit reset code.' : isInvite ? 'Enter the email address used for your invitation.' : isCode ? `Enter the eight-digit code sent to ${resetEmail}.` : 'Choose a new password to continue to the society app.';
    email.hidden = !(isReset || isInvite);
    code.parentElement.hidden = !isCode;
    password.parentElement.hidden = isReset || isCode;
    confirm.parentElement.hidden = isReset || isCode;
    email.parentElement.style.display = isReset || isInvite ? 'grid' : 'none';
    code.parentElement.style.display = isCode ? 'grid' : 'none';
    password.parentElement.style.display = isReset || isCode ? 'none' : 'grid';
    confirm.parentElement.style.display = isReset || isCode ? 'none' : 'grid';
    email.required = isReset || isInvite;
    code.required = isCode;
    password.required = !isReset && !isCode;
    confirm.required = !isReset && !isCode;
    submit.textContent = isReset ? 'Send reset code' : isInvite ? 'Continue' : isCode ? 'Verify code' : 'Save new password';
    if (!dialog.open) dialog.showModal();
  };
  const addForgotPasswordLink = () => {
    const loginForm = document.querySelector('#login-form');
    if (!loginForm || loginForm.querySelector('#forgot-password')) return;
    loginForm.insertAdjacentHTML('beforeend', '<button class="text-button" type="button" id="forgot-password">Forgot password?</button><button class="text-button" type="button" id="set-up-invited-account">Set up invited account</button>');
    document.querySelector('#forgot-password').addEventListener('click', () => show('reset'));
    document.querySelector('#set-up-invited-account').addEventListener('click', () => show('invite'));
  };
  const checkForcedChange = async () => {
    const { data: { user } } = await client.auth.getUser();
    if (!user) return;
    if (isRecoveryLink()) return show('change', true);
    const { data: profile } = await client.from('profiles').select('password_change_required').eq('id', user.id).maybeSingle();
    if (profile?.password_change_required) {
      requiresProfileClear = true;
      show('change', true);
    }
  };
  window.electricalOpenPasswordRecovery = () => {
    sessionStorage.removeItem('electricalOpenPasswordRecovery');
    show('change', true);
  };

  document.querySelector('#password-close')?.addEventListener('click', () => {
    if (!forced) dialog.close();
  });
  dialog.addEventListener('cancel', event => {
    if (forced) event.preventDefault();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    submit.disabled = true;
    try {
      if (mode === 'reset') {
        resetEmail = email.value.trim();
        verificationType = 'recovery';
        const { error } = await client.auth.resetPasswordForEmail(resetEmail);
        if (error) throw error;
        show('code');
        setMessage('Enter the code from the email.');
        return;
      }
      if (mode === 'invite') {
        resetEmail = email.value.trim();
        verificationType = 'invite';
        show('code');
        return;
      }
      if (mode === 'code') {
        if (!/^\d{8}$/.test(code.value)) throw new Error('Enter the eight-digit code from the email.');
        const { error } = await client.auth.verifyOtp({ email: resetEmail, token: code.value, type: verificationType });
        if (error) throw error;
        show('change', true);
        setMessage('Code verified. Choose your new password.');
        return;
      }
      if (password.value.length < 12) throw new Error('Use at least 12 characters for your password.');
      if (password.value !== confirm.value) throw new Error('The passwords do not match.');
      const { error } = await client.auth.updateUser({ password: password.value });
      if (error) throw error;
      const { data: { user } } = await client.auth.getUser();
      if (user && requiresProfileClear) {
        const { error: profileError } = await client.from('profiles').update({ password_change_required: false }).eq('id', user.id);
        if (profileError) throw profileError;
      }
      history.replaceState(null, '', `${location.pathname}${location.search}`);
      dialog.close();
      forced = false;
      requiresProfileClear = false;
      await window.load?.();
    } catch (error) {
      setMessage(error.message || 'Could not update your password.', true);
    } finally {
      submit.disabled = false;
    }
  });

  new MutationObserver(addForgotPasswordLink).observe(document.body, { childList: true, subtree: true });
  addForgotPasswordLink();
  if (sessionStorage.getItem('electricalOpenPasswordRecovery') === 'true') {
    sessionStorage.removeItem('electricalOpenPasswordRecovery');
    show('change', true);
  } else checkForcedChange();
  client.auth.onAuthStateChange((event, nextSession) => {
    if (event === 'PASSWORD_RECOVERY') window.electricalOpenPasswordRecovery();
    else if (nextSession) checkForcedChange();
  });
})();
