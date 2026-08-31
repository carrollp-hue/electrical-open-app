(() => {
  const originalHome = home;
  home = function () {
    const updates = (state.appNotifications || []).slice(0, 5);
    const updateList = updates.length
      ? `<table class="table"><tbody>${updates.map(update => `<tr><td><strong>${esc(update.title)}</strong><br><span>${esc(update.body)}</span><br><small>${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(update.created_at))}</small></td><td>${update.url ? `<a class="text-link" href="#${String(update.url).split('#')[1] || 'home'}">View</a>` : ''}</td></tr>`).join('')}</tbody></table>`
      : '<p class="intro">No recent updates.</p>';
    return `${originalHome()}<section class="section"><div class="section-head"><h2>Latest updates</h2><span class="pill">Notifications</span></div>${updateList}</section>`;
  };

  const loadWithHomeNotifications = load;
  load = async function () {
    await loadWithHomeNotifications();
    const { data, error } = await client.from('app_notifications').select('title, body, url, created_at').order('created_at', { ascending: false }).limit(5);
    if (!error) state.appNotifications = data || [];
    render();
  };

  client.from('app_notifications').select('title, body, url, created_at').order('created_at', { ascending: false }).limit(5).then(({ data }) => {
    state.appNotifications = data || [];
    if (location.hash === '#home' || !location.hash) render();
  });
})();
