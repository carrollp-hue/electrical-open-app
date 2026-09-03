// Explain when the lower club handicap is used and prompt members to confirm
// their club figure at least every 30 days.
const electricalOpenLoadWithClubReminder = load;
load = async function () {
  await electricalOpenLoadWithClubReminder();
  const { data, error } = await client.rpc('current_handicap_details');
  if (error) throw error;
  state.handicapDetails = data || [];
  render();
};

const electricalOpenHandicapWithClubReminder = handicap;
handicap = function (roundId) {
  const page = electricalOpenHandicapWithClubReminder(roundId);
  if (roundId) return page;

  const current = player();
  const detail = (state.handicapDetails || []).find(item => item.player_id === current?.id);
  const club = current?.club_handicap;
  const submittedAt = current?.club_handicap_submitted_at ? new Date(current.club_handicap_submitted_at) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const threeDaysFromToday = new Date(today);
  threeDaysFromToday.setDate(today.getDate() + 3);
  const upcomingFixture = (state.fixtureParticipants || [])
    .filter(item => item.player_id === current?.id)
    .map(item => state.fixtures.find(fixture => fixture.id === item.fixture_id))
    .filter(fixture => fixture && !['completed', 'published', 'archived'].includes(fixture.status))
    .filter(fixture => {
      const fixtureDate = new Date(`${fixture.fixture_date}T00:00:00`);
      return fixtureDate >= today && fixtureDate <= threeDaysFromToday;
    })
    .sort((a, b) => a.fixture_date.localeCompare(b.fixture_date))[0];
  const reminderDue = submittedAt
    && current?.profile_id === session?.user?.id
    && Date.now() - submittedAt.getTime() >= 30 * 24 * 60 * 60 * 1000
    && upcomingFixture;
  const formattedSubmitted = submittedAt ? longDate(submittedAt) : 'Not submitted';
  const clubInUse = detail?.club_handicap_used && club != null;
  const clubNotice = clubInUse ? `<p class="club-handicap-used"><strong>Club handicap in use</strong><br>Your club handicap of ${Number(club).toFixed(1)} is lower than the calculated society index of ${Number(detail.calculated_society_index).toFixed(1)}.</p>` : '';
  const reminder = reminderDue && club != null ? `<section class="section club-handicap-reminder"><h2>Confirm your club handicap</h2><p>You are playing ${esc(upcomingFixture.name)} on ${date(upcomingFixture.fixture_date)}. Your club handicap was last confirmed on ${formattedSubmitted}; update it if it has changed, or confirm the same value to keep it current.</p><form class="admin-form" id="club-handicap-self-form"><label>Club handicap<input name="club_handicap" type="number" min="0" max="54" step="0.1" inputmode="decimal" value="${Number(club).toFixed(1)}" required></label><p class="form-message" id="club-handicap-self-message"></p><button class="primary" type="submit">Confirm club handicap</button></form></section>` : '';
  const withClubNotice = page.replace('<p class="index-note">', `${clubNotice}<p class="index-note">`);
  return reminder ? withClubNotice.replace('</section>', '</section>' + reminder) : withClubNotice;
};

const electricalOpenRenderWithClubReminder = render;
render = function () {
  electricalOpenRenderWithClubReminder();
  document.querySelector('#club-handicap-self-form')?.addEventListener('submit', submitOwnClubHandicap);
};

async function submitOwnClubHandicap(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button');
  const message = form.querySelector('#club-handicap-self-message');
  const value = Number(new FormData(form).get('club_handicap'));
  button.disabled = true;
  button.textContent = 'Saving…';
  const { error } = await client.rpc('submit_my_club_handicap', { p_club_handicap: value });
  if (error) {
    message.textContent = error.message;
    message.classList.add('error');
    button.disabled = false;
    button.textContent = 'Confirm club handicap';
    return;
  }
  await load();
}

// app.js begins its first load before optional enhancement scripts are read.
// Refresh once after this script is attached so the first displayed page also
// has the extra handicap-detail data.
setTimeout(() => {
  if (session) load().catch(error => login(error.message));
}, 0);
