const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function run(initialUser, recoveryLink) {
  const elements = {};
  for (const id of ['password-dialog','password-form','password-title','password-intro','reset-email','reset-code','new-password','confirm-password','password-message','password-submit','password-close']) {
    elements[id] = { value: '', hidden: false, parentElement: { hidden: false, style: {} }, classList: { toggle() {} }, addEventListener(type, fn) { this[type] = fn; } };
  }
  const dialog = elements['password-dialog'];
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; };
  elements['password-form'].reset = () => { for (const id of ['reset-email','reset-code','new-password','confirm-password']) elements[id].value = ''; };
  let user = initialUser ? { id: 'member' } : null;
  let required = true;
  let listener;
  const client = {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      resetPasswordForEmail: async () => ({ error: null }),
      verifyOtp: async () => { user = { id: 'member' }; listener('PASSWORD_RECOVERY', { user }); return { error: null }; },
      updateUser: async () => { listener('USER_UPDATED', { user }); return { error: null }; },
      onAuthStateChange: fn => { listener = fn; }
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { password_change_required: required }, error: null }) }) }), update: () => ({ eq: async () => { required = false; return { error: null }; } }) })
  };
  const login = { querySelector: () => null, insertAdjacentHTML() {} };
  const buttons = { '#forgot-password': { addEventListener(type, fn) { this[type] = fn; } }, '#set-up-invited-account': { addEventListener() {} } };
  const context = { window: { ELECTRICAL_OPEN_CONFIG: {}, supabase: { createClient: () => client } }, document: { body: {}, querySelector: selector => selector === '#login-form' ? login : buttons[selector] || elements[selector.slice(1)] }, location: { search: recoveryLink ? '?reset-password=true' : '', hash: '', pathname: '/' }, history: { replaceState() {} }, sessionStorage: { getItem: () => null, removeItem() {} }, MutationObserver: class { observe() {} }, URLSearchParams, setTimeout };
  vm.runInNewContext(fs.readFileSync('password-management.js', 'utf8'), context);
  const tick = () => new Promise(resolve => setTimeout(resolve, 5));
  await tick();
  if (!initialUser) {
    buttons['#forgot-password'].click();
    elements['reset-email'].value = 'member@example.test';
    await elements['password-form'].submit({ preventDefault() {} });
    assert.equal(elements['password-title'].textContent, 'Enter account code');
    elements['reset-code'].value = '12345678';
    await elements['password-form'].submit({ preventDefault() {} });
    assert.equal(elements['password-title'].textContent, 'Choose a new password');
  } else assert.equal(elements['password-title'].textContent, 'Choose a new password');
  elements['new-password'].value = elements['confirm-password'].value = 'a-safe-password';
  listener('SIGNED_IN', { user });
  await tick();
  assert.equal(elements['new-password'].value, 'a-safe-password', 'sign-in event must not clear entered password');
  await elements['password-form'].submit({ preventDefault() {} });
  await tick();
  assert.equal(dialog.open, false, 'password dialog closes after saving');
  assert.equal(required, false, 'first-password flag is cleared');
}

(async () => { await run(false, false); await run(true, true); console.log('Password reset code and invitation-link flows passed.'); })().catch(error => { console.error(error); process.exitCode = 1; });
