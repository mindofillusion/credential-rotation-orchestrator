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
  result: document.querySelector('#result'),
  identityTitle: document.querySelector('#identity-title'),
  identityFingerprint: document.querySelector('#identity-fingerprint'),
  workshopTemplates: document.querySelector('#workshop-templates'),
  createTemplate: document.querySelector('#create-template'),
  createResult: document.querySelector('#create-result'),
  importTemplate: document.querySelector('#import-template'),
  importResult: document.querySelector('#import-result'),
  trustKey: document.querySelector('#trust-key'),
  trustResult: document.querySelector('#trust-result')
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

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function renderTemplates(templates) {
  const rows = templates.map((template) => `
    <article class="list-item">
      <div class="item-main">
        <strong>${escapeHtml(template.id)}</strong>
        <span>v${escapeHtml(template.version)} · ${escapeHtml(template.origins.join(', '))}</span>
      </div>
      <span class="trust">${escapeHtml(template.trust)}</span>
    </article>`).join('');
  elements.templates.innerHTML = rows || '<p class="empty">Aucun template installé.</p>';
  elements.workshopTemplates.innerHTML = templates.length ? templates.map((template) => `
    <article class="list-item">
      <div class="item-main">
        <strong>${escapeHtml(template.id)} <span>v${escapeHtml(template.version)}</span></strong>
        <span>${escapeHtml(template.trust)} · expire ${escapeHtml(new Date(template.expiresAt).toLocaleDateString('fr-FR'))}</span>
      </div>
      <button class="export-button" type="button" data-export-id="${escapeHtml(template.id)}" data-export-version="${escapeHtml(template.version)}">Exporter</button>
    </article>`).join('') : '<p class="empty">Aucun template installé.</p>';
}

async function loadOverview() {
  const data = await api('/api/overview');
  elements.mode.textContent = data.mode === 'simulation' ? 'Simulation' : data.mode;
  elements.vault.textContent = data.vault.connected ? `${data.vault.adapter} connecté` : 'déconnecté';
  elements.templateCount.textContent = String(data.templates.length);
  elements.accountCount.textContent = String(data.accounts.length);
  elements.identityTitle.textContent = data.identity.keyId;
  elements.identityFingerprint.textContent = data.identity.fingerprint;
  renderTemplates(data.templates);
  eventHistory = data.events;
  renderEvents();
}

for (const button of document.querySelectorAll('[data-view]')) {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('active', item === button));
    document.querySelectorAll('[data-page]').forEach((page) => { page.hidden = page.dataset.page !== button.dataset.view; });
  });
}

elements.run.addEventListener('click', async () => {
  elements.run.disabled = true;
  elements.result.textContent = 'Simulation en cours…';
  try {
    const result = await api('/api/simulations/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ outcome: elements.outcome.value })
    });
    elements.result.textContent = `État : ${result.status} · site modifié : ${result.remoteChanged ? 'oui' : 'non'} · coffre mis à jour : ${result.vaultUpdated ? 'oui' : 'non'}`;
  } catch (error) {
    elements.result.textContent = `Erreur : ${error.message}`;
  } finally {
    elements.run.disabled = false;
  }
});

elements.createTemplate.addEventListener('submit', async (event) => {
  event.preventDefault();
  elements.createResult.textContent = 'Validation et signature en cours…';
  try {
    const created = await api('/api/templates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: document.querySelector('#template-id').value.trim(),
        version: document.querySelector('#template-version').value.trim(),
        allowedOrigins: [document.querySelector('#template-origin').value.trim()],
        steps: JSON.parse(document.querySelector('#template-steps').value)
      })
    });
    elements.createResult.textContent = `Signé et installé · SHA-256 du bundle : ${created.bundleSha256}`;
    await loadOverview();
  } catch (error) {
    elements.createResult.textContent = `Refusé : ${error.message}`;
  }
});

elements.importTemplate.addEventListener('submit', async (event) => {
  event.preventDefault();
  elements.importResult.textContent = 'Vérification en cours…';
  try {
    const imported = await api('/api/templates/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        expectedSha256: document.querySelector('#bundle-sha').value.trim().toLowerCase(),
        bundle: JSON.parse(document.querySelector('#bundle-json').value)
      })
    });
    elements.importResult.textContent = `Importé : ${imported.summary.id} v${imported.summary.version}`;
    await loadOverview();
  } catch (error) {
    elements.importResult.textContent = `Refusé : ${error.message}`;
  }
});

elements.trustKey.addEventListener('submit', async (event) => {
  event.preventDefault();
  elements.trustResult.textContent = 'Vérification de la clé…';
  try {
    const trusted = await api('/api/trust/keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        keyId: document.querySelector('#trust-key-id').value.trim(),
        expectedFingerprint: document.querySelector('#trust-fingerprint').value.trim().toLowerCase(),
        publicKeyPem: document.querySelector('#trust-pem').value.trim()
      })
    });
    elements.trustResult.textContent = `Clé approuvée : ${trusted.fingerprint}`;
  } catch (error) {
    elements.trustResult.textContent = `Refusée : ${error.message}`;
  }
});

elements.workshopTemplates.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-export-id]');
  if (!button) return;
  try {
    const query = new URLSearchParams({ id: button.dataset.exportId, version: button.dataset.exportVersion });
    const exported = await api(`/api/templates/export?${query}`);
    const blob = new Blob([`${JSON.stringify(exported.bundle, null, 2)}\n`], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${button.dataset.exportId}-${button.dataset.exportVersion}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    elements.importResult.textContent = `Exporté · SHA-256 : ${exported.bundleSha256}`;
  } catch (error) {
    elements.importResult.textContent = `Export impossible : ${error.message}`;
  }
});

const stream = new EventSource('/api/events/stream');
stream.onmessage = (message) => {
  eventHistory.unshift(JSON.parse(message.data));
  renderEvents();
};
for (const type of ['credential.rotation.started', 'credential.rotation.succeeded', 'credential.rotation.failed', 'credential.rotation.state_ambiguous', 'template.installed', 'template.signer.trusted']) {
  stream.addEventListener(type, (message) => {
    eventHistory.unshift(JSON.parse(message.data));
    renderEvents();
    if (type.startsWith('template.')) loadOverview().catch(() => {});
  });
}

loadOverview().catch((error) => {
  elements.mode.textContent = 'Indisponible';
  elements.result.textContent = `Impossible de charger l’application : ${error.message}`;
});
