const els = {
  appMode: document.getElementById('app-mode'),
  appNetwork: document.getElementById('app-network'),
  appHealth: document.getElementById('app-health'),
  transferForm: document.getElementById('transfer-form'),
  settlementForm: document.getElementById('settlement-form'),
  auditForm: document.getElementById('audit-form'),
  createResult: document.getElementById('create-result'),
  settlementResult: document.getElementById('settlement-result'),
  auditResult: document.getElementById('audit-result'),
  transfersList: document.getElementById('transfers-list'),
  settlementComplianceId: document.getElementById('settlementComplianceId'),
  auditLookupValue: document.getElementById('auditLookupValue'),
  refreshTransfersBtn: document.getElementById('refresh-transfers-btn'),
  seedDemoBtn: document.getElementById('seed-demo-btn')
};

const demoValues = {
  originatorName: 'Carlos Silva',
  originatorAccount: 'BRX-1001',
  beneficiaryName: 'Li Wei Trading Co.',
  beneficiaryAccount: 'CP-7781',
  declaredAmount: '0.00010000',
  assetSymbol: 'LBTC',
  sendingInstitution: 'Brazil Exchange',
  settlementInstitution: 'BSOS',
  receivingInstitution: 'Corridor Partner',
  purpose: 'Cross-border trade settlement demo',
  currencyContext: 'Brazil to Asia corridor — Liquid testnet demo'
};

function setResult(el, html, type = 'muted') {
  el.className = `result-box ${type === 'success' ? 'result-success' : type === 'error' ? 'result-error' : 'muted-box'}`;
  el.innerHTML = html;
}

async function apiFetch(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.error || data.details || `Request failed with status ${response.status}`);
  }
  return data;
}

function formatBadge(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'verified' || normalized === 'settled') {
    return `<span class="badge ok">${status}</span>`;
  }
  if (normalized === 'mismatch' || normalized === 'failed') {
    return `<span class="badge error">${status}</span>`;
  }
  return `<span class="badge pending">${status || 'pending'}</span>`;
}

async function loadConfig() {
  try {
    const [health, config] = await Promise.all([
      apiFetch('/api/health'),
      apiFetch('/api/config')
    ]);

    els.appMode.textContent = config.mode;
    els.appNetwork.textContent = config.network;
    els.appHealth.textContent = health.success ? 'Online' : 'Unknown';
  } catch (error) {
    els.appHealth.textContent = 'Offline';
    setResult(els.createResult, `<strong>Could not reach backend.</strong><br>${error.message}`, 'error');
  }
}

async function loadTransfers() {
  try {
    const data = await apiFetch('/api/transfers?limit=10');
    if (!data.transfers?.length) {
      els.transfersList.innerHTML = '<div class="transfer-item"><h3>No records yet</h3><p class="transfer-meta">Create a compliance record to begin.</p></div>';
      return;
    }

    els.transfersList.innerHTML = data.transfers.map((transfer) => `
      <article class="transfer-item">
        <h3>${transfer.compliance_record_id}</h3>
        <div class="transfer-meta">
          <span><strong>Originator:</strong> ${transfer.originator_name}</span>
          <span><strong>Beneficiary:</strong> ${transfer.beneficiary_name}</span>
          <span><strong>Amount:</strong> ${transfer.declared_amount} ${transfer.asset_symbol}</span>
          <span><strong>Status:</strong> ${formatBadge(transfer.status)}</span>
          <span><strong>Verification:</strong> ${formatBadge(transfer.verification_status)}</span>
          ${transfer.liquid_txid ? `<span><strong>Txid:</strong> ${transfer.liquid_txid}</span>` : ''}
        </div>
      </article>
    `).join('');
  } catch (error) {
    els.transfersList.innerHTML = `<div class="transfer-item"><h3>Could not load transfers</h3><p class="transfer-meta">${error.message}</p></div>`;
  }
}

function seedDemoForm() {
  Object.entries(demoValues).forEach(([key, value]) => {
    const input = els.transferForm.elements.namedItem(key);
    if (input) input.value = value;
  });
}

els.seedDemoBtn.addEventListener('click', seedDemoForm);
els.refreshTransfersBtn.addEventListener('click', loadTransfers);

els.transferForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(els.transferForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    setResult(els.createResult, 'Creating compliance record...', 'muted');
    const data = await apiFetch('/api/transfers/create', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    els.settlementComplianceId.value = data.compliance_record_id;
    els.auditLookupValue.value = data.compliance_record_id;

    setResult(
      els.createResult,
      `<strong>Compliance record created.</strong><br>
       <strong>ID:</strong> ${data.compliance_record_id}<br>
       <strong>Status:</strong> ${data.record.status}<br>
       <strong>Amount:</strong> ${data.record.declared_amount} ${data.record.asset_symbol}`,
      'success'
    );

    await loadTransfers();
  } catch (error) {
    setResult(els.createResult, `<strong>Create failed.</strong><br>${error.message}`, 'error');
  }
});

els.settlementForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(els.settlementForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    setResult(els.settlementResult, 'Sending settlement...', 'muted');
    const data = await apiFetch('/api/settlement/send', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    els.auditLookupValue.value = data.compliance_record_id;

    setResult(
      els.settlementResult,
      `<strong>Settlement sent successfully.</strong><br>
       <strong>Compliance ID:</strong> ${data.compliance_record_id}<br>
       <strong>Txid:</strong> ${data.liquid_txid}<br>
       <strong>Destination:</strong> ${data.destination_address}<br>
       <strong>Verified amount:</strong> ${data.verified_amount}<br>
       <strong>Verification:</strong> ${data.verification_status}<br>
       <strong>Mode:</strong> ${data.mode}`,
      'success'
    );

    await loadTransfers();
  } catch (error) {
    setResult(els.settlementResult, `<strong>Settlement failed.</strong><br>${error.message}`, 'error');
  }
});

els.auditForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const value = els.auditLookupValue.value.trim();
  if (!value) return;

  try {
    setResult(els.auditResult, 'Loading audit record...', 'muted');
    const data = await apiFetch(`/api/audit/${encodeURIComponent(value)}`);
    const audit = data.audit;

    setResult(
      els.auditResult,
      `<pre>${JSON.stringify(audit, null, 2)}</pre>`,
      audit.amount_match ? 'success' : 'error'
    );
  } catch (error) {
    setResult(els.auditResult, `<strong>Lookup failed.</strong><br>${error.message}`, 'error');
  }
});

seedDemoForm();
await loadConfig();
await loadTransfers();
