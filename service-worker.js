const CACHE = "electrical-open-v124";
const ASSETS = ["./index.html", "./reset-password.html", "./styles.css", "./scorecard-layout.css", "./bottom-nav-tuning.css", "./notification-indicator.css", "./password-management.css", "./app.js", "./scorecard-effective-index.js", "./fixture-editor.js", "./scorecard-layout.js", "./scorecard-handicap-summary.js", "./profile-selection.js", "./fixture-commit.js", "./membership-admin.js", "./member-invitations.js", "./admin-access-guard.js", "./fixture-home-sections.js", "./course-library.js", "./fixture-admin-improvements.js", "./auth-token-retry.js", "./member-paired-scorecards.js", "./fixture-completion-workflow.js", "./historical-results.js", "./notifications.js", "./password-management.js", "./reset-password.js", "./help-centre.js", "./app-access-indicators.js", "./help/Electrical-Open-User-Guide.pdf", "./help/Administrator-Access-Checklist.pdf", "./help/Membership-Administrator-Guide.pdf", "./help/App-Administrator-Quick-Guide.pdf", "./supabase-config.js", "./manifest.webmanifest", "./icon.svg"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(Promise.all([
  self.clients.claim(),
  caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
])));
self.addEventListener("fetch", event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request)).then(hit => hit || fetch(event.request)));
});
self.addEventListener('push', event => { const data = event.data?.json() || {}; event.waitUntil(self.registration.showNotification(data.title || 'Electrical Open', { body: data.body || '', icon: './icon.svg', badge: './icon.svg', data: { url: data.url || '/#home' } })); });
self.addEventListener('notificationclick', event => { event.notification.close(); event.waitUntil(clients.openWindow(event.notification.data?.url || '/#home')); });
