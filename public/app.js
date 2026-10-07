const elements = {
  mode: document.querySelector('#mode'),
  vault: document.querySelector('#vault-state'),
  templates: document.querySelector('#templates'),
  templateCount: document.querySelector('#template-count'),
  accountCount: document.querySelector('#account-count'),
  ambiguousCount: document.querySelector('#ambiguous-count'),
  events: document.querySelector('#events'),
  run: document.querySelector('#run'),
  outcome: document.querySelector('#outcome'),
  result: document.querySelector('#result')
};

let eventHistory = [];

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function eventTone(type) {
  if (type.includes('failed') || type.includes('invalid')) return 'error';
  if (type.includes('ambiguous') || type.includes('required')) return 'warning';
  return '';
}

function renderEvents() {
  const unique = [...new Map(eventHistory.map((event) => [event.id, event])).values()];
  eventHistory = unique.slice(0, 50);
  elements.ambiguousCount.textContent = String(eventHistory.filter((event) => event.type.endsWith('state_ambiguous')).length);
  elements.events.innerHTML = eventHistory.length
    ? eventHistory.map((event) => `
      <article class="event ${eventTone(event.type)}">
        <div>
          <strong>${escapeHtml(event.type)}</strong>
          <span>${escapeHtml(event.subject)} · ${escapeHtml(new Date(event.time).toLocaleString('fr-FR'))}</span>
        </div>
      </article>`).join('')
    : '<p class="empty">Aucun événement pour le moment.</p>';
}

async function loadOverview() {
  const response = await fetch('/api/overview');
  const data = await response.json();
  elements.mode.textContent = data.mode === 'simulation' ? 'Simulation' : data.mode;
  elements.vault.textContent = data.vault.connected ? `${data.vault.adapter} connecté` : 'déconnecté';
  elements.templateCount.textContent = String(data.templates.length);
  elements.accountCount.textContent = String(data.accounts.length);
  elements.templates.innerHTML = data.templates.map((template) => `
    <article class="list-item">
      <div class="item-main">
        <strong>${escapeHtml(template.id)}</strong>
        <span>v${escapeHtml(template.version)} · ${escapeHtml(template.origins.join(', '))}</span>
      </div>
      <span class="trust">${escapeHtml(template.trust)}</span>
    </article>`).join('');
  eventHistory = data.events;
  renderEvents();
}

elements.run.addEventListener('click', async () => {
  elements.run.disabled = true;
  elements.result.textContent = 'Simulation en cours…';
  try {
    const response = await fetch('/api/simulations/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ outcome: elements.outcome.value })
    });
    const result = await response.json();
    elements.result.textContent = `État : ${result.status} · site modifié : ${result.remoteChanged ? 'oui' : 'non'} · coffre mis à jour : ${result.vaultUpdated ? 'oui' : 'non'}`;
  } catch (error) {
    elements.result.textContent = `Erreur : ${error.message}`;
  } finally {
    elements.run.disabled = false;
  }
});

const stream = new EventSource('/api/events/stream');
stream.onmessage = (message) => {
  eventHistory.unshift(JSON.parse(message.data));
  renderEvents();
};
for (const type of ['credential.rotation.started', 'credential.rotation.succeeded', 'credential.rotation.failed', 'credential.rotation.state_ambiguous']) {
  stream.addEventListener(type, (message) => {
    eventHistory.unshift(JSON.parse(message.data));
    renderEvents();
  });
}

loadOverview().catch((error) => {
  elements.mode.textContent = 'Indisponible';
  elements.result.textContent = `Impossible de charger l’application : ${error.message}`;
});
