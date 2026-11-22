(() => {
  if (!('serviceWorker' in navigator)) return;

  let pageStartedAt = Date.now();
  let reloadedForUpdate = false;

  const showUpdateNotice = () => {
    if (document.querySelector('.app-update-notice')) return;
    const notice = document.createElement('aside');
    notice.className = 'app-update-notice';
    notice.setAttribute('role', 'status');
    notice.innerHTML = 'A new version is ready.<button type="button">Reload now</button>';
    notice.querySelector('button').addEventListener('click', () => window.location.reload());
    document.body.appendChild(notice);
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadedForUpdate) return;
    reloadedForUpdate = true;
    // An update found while the app is first opening is safe to apply without
    // interrupting score entry. Later updates are announced instead.
    if (Date.now() - pageStartedAt < 5000) window.location.reload();
    else showUpdateNotice();
  });

  navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' })
    .then(registration => {
      registration.update().catch(() => {});
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            if (Date.now() - pageStartedAt < 5000) return;
            showUpdateNotice();
          }
        });
      });
    })
    .catch(() => {});
})();
