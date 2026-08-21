(() => {
  const today = () => new Date().toISOString().slice(0, 10);
  const escHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  const allCourses = () => [...new Set((state.courseSetups || []).map(item => item.courses?.name).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const scorecardRows = holes => Array.from({ length: 18 }, (_, index) => {
    const hole = holes?.find(item => Number(item.hole_number) === index + 1) || {};
    return `<tr><td>${index + 1}</td><td><input name="par_${index + 1}" type="number" min="3" max="6" value="${hole.par ?? ''}" required></td><td><input name="si_${index + 1}" type="number" min="1" max="18" value="${hole.stroke_index ?? ''}" required></td></tr>`;
  }).join('');

  const reviewForm = (data = {}) => {
    const teeOptions = (data.tees || []).filter(item => item?.name);
    const teeControl = teeOptions.length
      ? `<label>Choose tee first<select name="tee_name" id="scanned-tee-select" required>${teeOptions.map(tee => `<option value="${escHtml(tee.name)}" ${tee.name === data.tee_name ? 'selected' : ''}>${escHtml(tee.name)}</option>`).join('')}</select></label>`
      : '<label>Tee colour / name<input name="tee_name" placeholder="Yellow" required></label>';
    return `<form class="admin-form course-review-form" id="course-review-form">
      <h3>Review extracted course data</h3>
      <p>Choose the tee first, then check every value against the card before saving. You can correct any value. Nothing changes on past fixtures.</p>
      <div class="field-row"><label>Course name<input name="course_name" value="${escHtml(data.course_name || '')}" required></label>${teeControl}</div>
      <div class="field-row"><label>Effective from<input name="effective_from" type="date" value="${escHtml(data.effective_from || today())}" required></label><label>Course rating<input name="course_rating" type="number" min="50" max="85" step="0.1" value="${data.course_rating ?? ''}" required></label></div>
      <div class="field-row"><label>Slope rating<input name="slope_rating" type="number" min="55" max="155" value="${data.slope_rating ?? ''}" required></label><label>Total par<input name="par" type="number" min="54" max="80" value="${data.par ?? ''}" required></label></div>
      <div class="table-responsive course-review-table"><table class="table"><thead><tr><th>Hole</th><th>Par</th><th>SI</th></tr></thead><tbody>${scorecardRows(data.holes)}</tbody></table></div>
      <button class="primary" type="submit">Save reviewed course tee</button>
    </form>`;
  };

  const inject = () => {
    if (location.hash !== '#admin/course' || document.querySelector('#course-library-card')) return;
    const panel = document.querySelector('.admin-panel');
    if (!panel) return;
    const names = allCourses();
    const card = document.createElement('div');
    card.className = 'admin-card';
    card.id = 'course-library-card';
    card.innerHTML = `<h2>Scorecard setup: scan or manual</h2>
      <p>Select the course, photograph or upload its blank scorecard, then review the detected tee, ratings and holes before saving a dated version. If scanning is unavailable, use the manual option below to create exactly the same saved setup.</p>
      <form class="admin-form" id="course-scan-form">
        <label>Course<input name="course_name" list="course-library-names" placeholder="Choose or enter a course" required></label>
        <datalist id="course-library-names">${names.map(name => `<option value="${escHtml(name)}"></option>`).join('')}</datalist>
        <label>Blank scorecard image<input name="scorecard_image" type="file" accept="image/*" capture="environment" required></label>
        <label>New course details apply from<input name="effective_from" type="date" value="${today()}" required></label>
        <button class="primary" type="submit">Scan and review scorecard</button>
      </form>
      <button class="secondary" type="button" id="manual-course-review">Create scorecard manually</button>
      <div id="course-scan-message" class="admin-message"></div>
      <div id="course-review"></div>
      <section class="course-library-existing"><h3>Saved course tees</h3><div id="course-library-list">Loading saved setups…</div></section>`;
    panel.prepend(card);
    document.querySelector('#course-scan-form')?.addEventListener('submit', scanCard);
    document.querySelector('#manual-course-review')?.addEventListener('click', () => {
      document.querySelector('#course-review').innerHTML = reviewForm({ effective_from: today() });
      bindReview();
    });
    loadVersions();
  };

  const setMessage = (text, error = false) => {
    const target = document.querySelector('#course-scan-message');
    if (target) { target.textContent = text; target.style.color = error ? '#b42318' : ''; }
  };

  async function scanCard(event) {
    event.preventDefault();
    const form = event.currentTarget, file = form.elements.scorecard_image.files?.[0];
    if (!file) return setMessage('Choose a scorecard image first.', true);
    if (file.size > 6 * 1024 * 1024) return setMessage('Please use a photo smaller than 6 MB.', true);
    setMessage('Reading scorecard…');
    const imageData = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
    const { data, error } = await client.functions.invoke('scan-scorecard', { body: { image_data_url: imageData } });
    if (error) {
      let detail = error.message || 'Could not scan the scorecard.';
      try { detail = (await error.context?.json())?.error || detail; } catch (_) { /* The gateway did not provide a JSON body. */ }
      return setMessage(detail, true);
    }
    if (data?.error) return setMessage(data.error, true);
    const extracted = data.extracted || {};
    extracted.course_name = form.elements.course_name.value.trim();
    extracted.effective_from = form.elements.effective_from.value;
    extracted.tees = extracted.tees?.filter(item => item?.name) || [];
    if (!extracted.tees.length) extracted.tees = [{ name: '', course_rating: extracted.course_rating, slope_rating: extracted.slope_rating, par: extracted.par, holes: extracted.holes }];
    renderScannedTee(extracted, extracted.tees[0].name);
    setMessage('Scan complete. Choose the tee, then review and correct the values below before saving.');
  }

  function renderScannedTee(scan, teeName) {
    const tee = scan.tees.find(item => item.name === teeName) || scan.tees[0];
    document.querySelector('#course-review').innerHTML = reviewForm({ ...scan, ...tee, tee_name: tee.name });
    bindReview(scan);
  }

  function bindReview(scan) {
    document.querySelector('#course-review-form')?.addEventListener('submit', saveVersion);
    document.querySelector('#scanned-tee-select')?.addEventListener('change', event => renderScannedTee(scan, event.target.value));
  }

  async function saveVersion(event) {
    event.preventDefault();
    const form = event.currentTarget, data = new FormData(form);
    const card = Array.from({ length: 18 }, (_, index) => ({
      hole_number: index + 1,
      par: Number(data.get(`par_${index + 1}`)),
      stroke_index: Number(data.get(`si_${index + 1}`)),
    }));
    const strokeIndexes = card.map(item => item.stroke_index);
    if (new Set(strokeIndexes).size !== 18 || strokeIndexes.some(value => value < 1 || value > 18)) return setMessage('Use each stroke index from 1 to 18 exactly once.', true);
    if (card.reduce((total, item) => total + item.par, 0) !== Number(data.get('par'))) return setMessage('The hole pars must add up to Total par.', true);
    setMessage('Saving dated course tee…');
    const { data: course, error: courseError } = await client.from('courses').upsert({ name: data.get('course_name').trim() }, { onConflict: 'name' }).select('id').single();
    if (courseError) return setMessage(courseError.message, true);
    const setup = { course_id: course.id, tee_name: data.get('tee_name').trim(), effective_from: data.get('effective_from'), course_rating: Number(data.get('course_rating')), slope_rating: Number(data.get('slope_rating')), par: Number(data.get('par')) };
    const { data: saved, error: setupError } = await client.from('course_setups').insert(setup).select('id').single();
    if (setupError) return setMessage(setupError.message.includes('effective_from') ? 'Run the Course & tee versions SQL upgrade before testing this feature.' : setupError.message, true);
    const { error: holesError } = await client.from('course_holes').insert(card.map(item => ({ ...item, course_setup_id: saved.id })));
    if (holesError) return setMessage(holesError.message, true);
    await load();
    location.hash = '#admin/course';
    setMessage('New dated tee version saved. Existing fixtures still use their original setup.');
  }

  async function loadVersions() {
    const target = document.querySelector('#course-library-list');
    if (!target) return;
    const { data, error } = await client.from('course_setups').select('id, tee_name, course_rating, slope_rating, par, effective_from, retired_on, courses(name)').order('effective_from', { ascending: false });
    if (error) { target.textContent = 'Run the Course & tee versions SQL upgrade to show dated setup history.'; return; }
    target.innerHTML = data?.length ? `<table class="table"><thead><tr><th>Course</th><th>Tee</th><th>From</th><th>Rating / slope</th></tr></thead><tbody>${data.map(item => `<tr><td>${escHtml(item.courses?.name)}</td><td>${escHtml(item.tee_name)}</td><td>${escHtml(item.effective_from)}</td><td>${item.course_rating} / ${item.slope_rating}</td></tr>`).join('')}</tbody></table>` : 'No saved course tees yet.';
  }

  new MutationObserver(inject).observe(document.querySelector('#app'), { childList: true, subtree: true });
  window.addEventListener('hashchange', inject);
  inject();
})();
