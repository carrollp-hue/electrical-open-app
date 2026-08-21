(() => {
  const existingRender = render;
  const guideCard = (title, description, file, downloadName) => `
    <article class="help-card">
      <div><h2>${title}</h2><p>${description}</p></div>
      <div class="help-actions">
        <a class="text-link" href="${file}" target="_blank" rel="noopener">View</a>
        <a class="help-download" href="${file}" download="${downloadName}">Download</a>
      </div>
    </article>`;

  help = function () {
    const administratorGuide = state.isStaff
      ? `<section class="section"><h2>Administrator resources</h2>${guideCard('Administrator access checklist', 'A quick reminder of how to give a signed-in member administrator access.', './help/Administrator-Access-Checklist.pdf', 'Electrical-Open-Administrator-Access-Checklist.pdf')}</section>`
      : '';
    return `<p class="eyebrow">Electrical Open</p><h1>Help & guides</h1><p class="intro">Open a guide in your browser or download a copy to keep on your phone.</p><section class="section"><h2>Member guide</h2>${guideCard('User and administrator guide', 'Signing in, adding the app to your phone, notifications, fixtures, scorecards and the main administrator tools.', './help/Electrical-Open-User-Guide.pdf', 'Electrical-Open-User-and-Admin-Guide.pdf')}</section>${administratorGuide}<section class="section"><div class="info-box">The guides are kept with the app so the latest versions are available wherever you use Electrical Open.</div></section>`;
  };

  render = function () {
    const route = (location.hash.slice(1) || 'home').split('/')[0];
    if (route !== 'help') return existingRender();
    app.innerHTML = help();
    document.querySelectorAll('.bottom-nav a').forEach(anchor => anchor.classList.remove('active'));
    const current = player();
    document.querySelector('#initials').textContent = current ? `${current.first_name[0]}${current.surname[0]}`.toUpperCase() : 'EO';
  };

  const renderHelpRoute = () => {
    if ((location.hash.slice(1) || 'home').split('/')[0] === 'help') render();
  };
  window.addEventListener('hashchange', renderHelpRoute);
  renderHelpRoute();
})();
