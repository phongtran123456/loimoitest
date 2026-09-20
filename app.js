(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const ids = ['library', 'coffee', 'movie', 'study', 'park', 'food'];
  const icons = {
    library: '<path d="M3 5h7c2 0 2 2 2 2s0-2 2-2h7v15h-7c-2 0-2 1-2 1s0-1-2-1H3Z"/><path d="M12 7v14"/>',
    coffee: '<path d="M4 8h12v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z"/><path d="M16 9h2a3 3 0 0 1 0 6h-2M7 2v3m5-3v3M3 22h15"/>',
    movie: '<rect x="3" y="5" width="18" height="16" rx="1"/><path d="M3 10h18M7 5l4 5m3-5 4 5M3 5l16-3 1 3"/>',
    study: '<path d="m3 9 9-5 9 5-9 5-9-5Zm4 3v6c3 3 7 3 10 0v-6m4-3v9"/>',
    park: '<path d="m12 2-6 8h3l-5 7h6v5h4v-5h6l-5-7h3Z"/>',
    food: '<path d="M5 2v7m3-7v7M2 2v7c0 4 6 4 6 0M5 12v10M18 2c-4 3-4 9 0 10v10m0-20v10"/>'
  };
  const state = {
    view: 'invitation',
    selected: new Set(['coffee']),
    dodges: 0,
    error: '',
    result: null
  };
  let lastDodge = -Infinity;
  let ready = false;
  const t = (key, params) => window.eazoI18n.t(key, params);

  function localDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function updateDateMinimum() {
    $('#date').min = localDate(new Date());
  }

  function createActivities() {
    const fragment = document.createDocumentFragment();
    ids.forEach((id) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'activity';
      button.dataset.id = id;
      // Only fixed, internal icon paths are inserted as markup. User input is always text.
      button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[id]}</svg><span class="activity-label"></span><svg class="tick" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>`;
      fragment.appendChild(button);
    });
    $('#activities').appendChild(fragment);
  }

  function renderActivities() {
    document.querySelectorAll('.activity').forEach((button) => {
      button.setAttribute('aria-pressed', String(state.selected.has(button.dataset.id)));
      button.querySelector('.activity-label').textContent = t(`activities.${button.dataset.id}`);
    });
  }

  function renderHint() {
    const hint = state.dodges === 0 ? 'default' : `dodge${Math.min(state.dodges, 3)}`;
    $('#hint').textContent = t(`invite.hints.${hint}`);
  }

  function renderError() {
    const error = $('#error');
    error.hidden = !state.error;
    error.textContent = state.error ? t(`errors.${state.error}`) : '';
  }

  function clearError() {
    state.error = '';
    $('#date').removeAttribute('aria-invalid');
    $('#time').removeAttribute('aria-invalid');
    $('#activities').removeAttribute('aria-invalid');
    renderError();
  }

  function renderSummary() {
    if (!state.result) return;
    const locale = window.eazoI18n.getLocale();
    const meeting = new Date(`${state.result.date}T${state.result.time}`);
    $('#result-date').textContent = new Intl.DateTimeFormat(locale, {
      day: 'numeric', month: 'long', year: 'numeric'
    }).format(meeting);
    $('#result-time').textContent = new Intl.DateTimeFormat(locale, {
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).format(meeting);
    $('#result-activities').textContent = [
      ...ids.filter((id) => state.result.activities.includes(id)).map((id) => t(`activities.${id}`)),
      ...(state.result.custom ? [state.result.custom] : [])
    ].join(' · ');
  }

  function render() {
    renderActivities();
    renderHint();
    renderError();
    renderSummary();
  }

  function resetNoPosition() {
    const button = $('#no');
    button.classList.add('resetting');
    button.style.left = '';
    button.style.top = '';
    requestAnimationFrame(() => button.classList.remove('resetting'));
  }

  function show(view) {
    state.view = view;
    document.querySelectorAll('.view').forEach((section) => {
      section.hidden = section.id !== view;
    });
    if (view === 'planner') updateDateMinimum();
    if (view === 'invitation') {
      state.dodges = 0;
      lastDodge = -Infinity;
      resetNoPosition();
      renderHint();
    }
    requestAnimationFrame(() => {
      $(`#${view} h1, #${view} h2`).focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  }

  function dodge(event) {
    if (event.cancelable) event.preventDefault();
    if (!ready || state.view !== 'invitation') return;
    const now = performance.now();
    if (now - lastDodge < 140) return;
    lastDodge = now;

    const stage = $('#playground');
    const button = $('#no');
    const yes = $('#yes');
    const box = stage.getBoundingClientRect();
    const maxX = Math.max(0, stage.clientWidth - button.offsetWidth);
    const maxY = Math.max(0, stage.clientHeight - button.offsetHeight);
    const hasPointer = Number.isFinite(event.clientX) && (event.clientX !== 0 || event.clientY !== 0);
    const pointerX = hasPointer ? event.clientX - box.left : button.offsetLeft + button.offsetWidth / 2;
    const pointerY = hasPointer ? event.clientY - box.top : button.offsetTop + button.offsetHeight / 2;
    const candidates = [];

    for (const y of [1, maxY]) {
      for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
        const x = maxX * fraction;
        const overlapsYes = x < yes.offsetLeft + yes.offsetWidth + 8 &&
          x + button.offsetWidth > yes.offsetLeft - 8 &&
          y < yes.offsetTop + yes.offsetHeight + 8 &&
          y + button.offsetHeight > yes.offsetTop - 8;
        if (overlapsYes) continue;
        const moved = Math.hypot(x - button.offsetLeft, y - button.offsetTop);
        const distance = Math.hypot(x + button.offsetWidth / 2 - pointerX, y + button.offsetHeight / 2 - pointerY);
        candidates.push({ x, y, score: distance + (moved > 30 ? 25 : -150) });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    const destination = candidates[0];
    if (destination) {
      button.style.left = `${destination.x}px`;
      button.style.top = `${destination.y}px`;
    }
    state.dodges += 1;
    renderHint();
  }

  function submitPlan(event) {
    event.preventDefault();
    clearError();
    const date = $('#date').value;
    const time = $('#time').value;
    const custom = $('#custom').value.trim();
    const meeting = new Date(`${date}T${time}`);

    if (!date || !time || !Number.isFinite(meeting.getTime())) {
      state.error = 'required';
      const missing = !date ? $('#date') : $('#time');
      missing.setAttribute('aria-invalid', 'true');
      renderError();
      missing.focus();
      return;
    }
    // Reject invalid, past, or non-existent local times (for example during DST changes).
    const validTime = `${String(meeting.getHours()).padStart(2, '0')}:${String(meeting.getMinutes()).padStart(2, '0')}`;
    if (localDate(meeting) !== date || validTime !== time || meeting <= new Date()) {
      state.error = 'future';
      $('#date').setAttribute('aria-invalid', 'true');
      $('#time').setAttribute('aria-invalid', 'true');
      renderError();
      $('#date').focus();
      return;
    }
    if (state.selected.size === 0 && !custom) {
      state.error = 'activity';
      $('#activities').setAttribute('aria-invalid', 'true');
      renderError();
      $('#activities button').focus();
      return;
    }
    state.result = { date, time, activities: [...state.selected], custom };
    renderSummary();
    show('summary');
  }

  async function initialize() {
    await window.eazoI18n.ready;
    createActivities();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    updateDateMinimum();
    $('#date').value = localDate(tomorrow);

    $('#yes').addEventListener('click', () => show('planner'));
    $('#back').addEventListener('click', () => show('invitation'));
    $('#edit').addEventListener('click', () => {
      clearError();
      show('planner');
    });
    $('#restart').addEventListener('click', () => show('invitation'));
    $('#no').addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse' || event.pointerType === 'pen') dodge(event);
    });
    $('#no').addEventListener('pointerdown', dodge);
    // Keyboard activation keeps the joke without a focus trap; Tab still leaves this button.
    $('#no').addEventListener('click', dodge);
    $('#activities').addEventListener('click', (event) => {
      const button = event.target.closest('.activity');
      if (!button) return;
      const id = button.dataset.id;
      if (state.selected.has(id)) state.selected.delete(id);
      else state.selected.add(id);
      renderActivities();
      clearError();
    });
    $('#plan-form').addEventListener('submit', submitPlan);
    ['#date', '#time', '#custom'].forEach((selector) => {
      $(selector).addEventListener('input', clearError);
    });
    window.addEventListener('eazo:localechange', () => {
      render();
      if (state.view === 'invitation') resetNoPosition();
    });
    window.addEventListener('resize', () => {
      if (state.view === 'invitation') resetNoPosition();
    });
    window.addEventListener('focus', updateDateMinimum);
    render();
    ready = true;
    document.documentElement.dataset.appReady = 'true';
  }

  initialize();
})();
