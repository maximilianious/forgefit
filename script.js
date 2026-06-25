// ── State ─────────────────────────────────────────────
const selections = {
  level: null,
  days: null,
  duration: null,
  equipment: [],
  goal: null,
};

// ── Screen navigation ─────────────────────────────────
function goTo(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

// ── Chip selection ────────────────────────────────────
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const group = chip.dataset.group;
    const value = chip.dataset.value;
    const isMulti = chip.closest('.chip-group')?.classList.contains('multi');

    if (isMulti) {
      // Toggle in array
      const idx = selections[group].indexOf(value);
      if (idx === -1) {
        selections[group].push(value);
        chip.classList.add('selected');
      } else {
        selections[group].splice(idx, 1);
        chip.classList.remove('selected');
      }
    } else {
      // Single select – clear siblings
      document.querySelectorAll(`.chip[data-group="${group}"]`).forEach(c => c.classList.remove('selected'));
      selections[group] = value;
      chip.classList.add('selected');
    }
  });
});

// ── Form validation & submit ──────────────────────────
async function submitForm() {
  const sport = document.getElementById('sport').value.trim();
  const injuries = document.getElementById('injuries').value.trim();
  const errorEl = document.getElementById('form-error');

  if (!sport || !selections.level || !selections.days || !selections.goal) {
    errorEl.classList.remove('hidden');
    return;
  }
  errorEl.classList.add('hidden');

  const equipment = selections.equipment.length > 0
    ? selections.equipment.join(', ')
    : 'No equipment (bodyweight only)';

  const duration = selections.duration || '60 minutes';

  goTo('screen-loading');

  try {
    const plan = await generatePlan({ sport, equipment, injuries, duration });
    renderResults(plan, { sport, equipment, injuries, duration });
    goTo('screen-results');
  } catch (err) {
    renderError(err.message);
    goTo('screen-results');
  }
}

// ── AI plan generation ────────────────────────────────
async function generatePlan({ sport, equipment, injuries, duration }) {
  const prompt = `You are an expert personal trainer and sports conditioning coach.

Create a detailed weekly workout plan for this athlete:
- Sport / activity: ${sport}
- Fitness level: ${selections.level}
- Goal: ${selections.goal}
- Days per week: ${selections.days}
- Session length: ${duration}
- Available equipment: ${equipment}
${injuries ? `- Injuries / limitations: ${injuries}` : ''}

Return ONLY valid JSON. No markdown, no code fences, no extra text. Use this exact structure:

{
  "planTitle": "Short descriptive plan title",
  "overview": "2-3 sentence overview of the approach and why it suits this athlete",
  "days": [
    {
      "day": "Day 1",
      "focus": "e.g. Upper Body Strength",
      "exercises": [
        {
          "name": "Exercise name",
          "sets": "3",
          "reps": "10-12",
          "note": "Optional short coaching tip"
        }
      ]
    }
  ],
  "generalTips": "2-3 sentences of overall advice on recovery, nutrition, or progression"
}

Make exactly ${selections.days} day entries. Tailor every exercise to the sport, equipment, and level.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1800,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Failed to generate plan. Try again.');
  }

  const data = await response.json();
  const text = data.content?.find(b => b.type === 'text')?.text || '';

  // Strip any accidental markdown fences
  const clean = text.replace(/```json|```/gi, '').trim();
  const parsed = JSON.parse(clean);
  return parsed;
}

// ── Render results ────────────────────────────────────
function renderResults(plan, meta) {
  const container = document.getElementById('results-body');

  const equipment = meta.equipment === 'No equipment (bodyweight only)'
    ? 'Bodyweight'
    : meta.equipment.length > 30 ? meta.equipment.slice(0, 30) + '…' : meta.equipment;

  container.innerHTML = `
    <div class="plan-summary">
      <div class="summary-item">
        <span class="summary-label">Sport</span>
        <span class="summary-value">${meta.sport}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Level</span>
        <span class="summary-value">${selections.level}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Days</span>
        <span class="summary-value">${selections.days}× / week</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Session</span>
        <span class="summary-value">${meta.duration}</span>
      </div>
    </div>

    ${plan.overview ? `<div class="notes-card"><strong>Plan Overview</strong>${plan.overview}</div>` : ''}

    ${plan.days.map(day => `
      <div class="day-card">
        <div class="day-card-header">
          <span class="day-badge">${day.day}</span>
          <span class="day-title">${day.focus}</span>
        </div>
        <div class="day-card-body">
          ${day.exercises.map(ex => `
            <div class="exercise-row">
              <div>
                <div class="exercise-name">${ex.name}</div>
                ${ex.note ? `<div class="exercise-note">${ex.note}</div>` : ''}
              </div>
              <div class="exercise-detail">${ex.sets}×${ex.reps}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('')}

    ${plan.generalTips ? `<div class="notes-card"><strong>Coach's Notes</strong>${plan.generalTips}</div>` : ''}
  `;
}

function renderError(message) {
  document.getElementById('results-body').innerHTML = `
    <div class="error-card">
      <strong>Something went wrong</strong><br><br>
      ${message}<br><br>
      Go back and try again.
    </div>
  `;
}

// ── PWA service worker registration ──────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
