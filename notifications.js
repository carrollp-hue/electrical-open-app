(() => {
  const config = window.ELECTRICAL_OPEN_CONFIG;
  const button = document.querySelector('#notification-button');
  const indicator = document.querySelector('#notification-indicator');
  if (!button || !indicator) return;

  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  // Opening the app is treated as acknowledging the notification badge.
  if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(() => {});
  const toUint8 = value => {
    const padded = value + '='.repeat((4 - value.length % 4) % 4);
    const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  };
  const setStatus = text => { button.textContent = text; };
  const currentSubscription = async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration?.pushManager.getSubscription() || null;
  };
  const setIndicator = (visible, active) => {
    indicator.hidden = !visible;
    indicator.dataset.enabled = active ? 'true' : 'false';
    indicator.setAttribute('aria-label', active ? 'Fixture notifications enabled' : 'Fixture notifications disabled');
  };
  const refreshNotificationState = async () => {
    if (!supported) {
      button.hidden = true;
      indicator.hidden = true;
      return null;
    }
    const subscription = await currentSubscription();
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      indicator.hidden = true;
      return { subscription, active: false };
    }
    const { data: saved } = subscription ? await client.from('push_subscriptions').select('endpoint').eq('profile_id', user.id).eq('endpoint', subscription.endpoint).maybeSingle() : { data: null };
    const active = Notification.permission === 'granted' && Boolean(saved);
    setIndicator(true, active);
    setStatus(active ? 'Turn off fixture notifications' : 'Enable fixture notifications');
    return { subscription, active };
  };

  if (!supported) {
    button.hidden = true;
    indicator.hidden = true;
    return;
  }
  refreshNotificationState();
  document.querySelector('#player-button')?.addEventListener('click', refreshNotificationState);
  window.addEventListener('focus', refreshNotificationState);

  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const notificationState = await refreshNotificationState();
      const subscription = notificationState?.subscription;
      if (notificationState?.active && subscription) {
        setStatus('Turning off…');
        const { error } = await client.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
        if (error) throw error;
        await subscription.unsubscribe();
        setIndicator(true, false);
        setStatus('Notifications turned off on this device');
        return;
      }

      if (subscription) await subscription.unsubscribe();

      if (!config.pushVapidPublicKey) throw new Error('Notifications need administrator setup');
      setStatus('Enabling…');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setIndicator(true, false);
        setStatus('Notifications not enabled');
        return;
      }
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error('Please sign in first');
      await navigator.serviceWorker.register('./service-worker.js');
      const registration = await navigator.serviceWorker.ready;
      const newSubscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toUint8(config.pushVapidPublicKey) });
      const data = newSubscription.toJSON();
      const { error } = await client.from('push_subscriptions').upsert({ profile_id: user.id, endpoint: data.endpoint, p256dh: data.keys.p256dh, auth: data.keys.auth, updated_at: new Date().toISOString() }, { onConflict: 'endpoint' });
      if (error) throw error;
      setIndicator(true, true);
      setStatus('Notifications enabled on this device');
    } catch (error) {
      const { data: { user } } = await client.auth.getUser();
      setIndicator(Boolean(user), false);
      setStatus(error.message || 'Could not update notifications');
    } finally {
      button.disabled = false;
    }
  });
  client.auth.onAuthStateChange(() => { refreshNotificationState(); });
})();
