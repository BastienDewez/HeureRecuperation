/* =====================================================================
   Solde d'heures — application statique (GitHub Pages)
   - Lit data/HeureAdmin.xlsx directement dans le navigateur (SheetJS)
   - Vérifie le nom + code personnel via data/agents.json (codes hachés)
   - Affiche le solde du mois en cours et l'historique des mois précédents
   ===================================================================== */

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin',
                    'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

const state = {
  agentsCreds: null,   // { "Nom Prénom": "sha256hash" }
  workbookData: null,  // { "2026": { "Nom Prénom": { report: {label, value}, months: {Janvier: value|null, ...} } } }
  years: [],
  currentAgent: null,
  currentYear: null,
};

const el = (id) => document.getElementById(id);

init();

async function init() {
  wireLoginForm();
  wireLogout();

  try {
    const [creds, workbook] = await Promise.all([
      loadAgentCreds(),
      loadWorkbook(),
    ]);
    state.agentsCreds = creds;
    state.workbookData = workbook.data;
    state.years = workbook.years;

    populateAgentSelect(Object.keys(creds).sort((a, b) => a.localeCompare(b, 'fr')));
    el('load-status').hidden = true;
  } catch (err) {
    console.error(err);
    showFatal(err.message || String(err));
  }
}

/* ---------------------------------------------------------------------
   Chargement des données
   ------------------------------------------------------------------- */

async function loadAgentCreds() {
  const res = await fetch('data/agents.json', { cache: 'no-store' });
  if (!res.ok) throw new Error("Impossible de charger data/agents.json (code " + res.status + ").");
  return res.json();
}

async function loadWorkbook() {
  const res = await fetch('data/HeureAdmin.xlsx', { cache: 'no-store' });
  if (!res.ok) throw new Error("Impossible de charger data/HeureAdmin.xlsx (code " + res.status + ").");
  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', raw: true });

  const data = {};
  const years = [];

  wb.SheetNames.forEach((sheetName) => {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
    if (!rows.length) return;

    const header = rows[0];
    const reportLabel = header[1] || 'Solde initial';
    const monthCols = header.slice(2); // noms de mois tels qu'écrits dans le fichier

    const yearData = {};
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const agentName = row[0];
      if (!agentName || typeof agentName !== 'string') continue;

      const reportRaw = row[1];
      const months = {};
      monthCols.forEach((monthName, idx) => {
        if (!monthName) return;
        const raw = row[2 + idx];
        months[monthName] = numericOrNull(raw);
      });

      yearData[agentName.trim()] = {
        report: { label: reportLabel, value: numericOrNull(reportRaw) },
        months,
      };
    }

    data[sheetName] = yearData;
    years.push(sheetName);
  });

  years.sort((a, b) => b.localeCompare(a)); // plus récent d'abord
  return { data, years };
}

function numericOrNull(v) {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  return null;
}

/* ---------------------------------------------------------------------
   Écran de connexion
   ------------------------------------------------------------------- */

function populateAgentSelect(names) {
  const select = el('agent-select');
  names.forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
}

function wireLoginForm() {
  el('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    el('login-error').hidden = true;

    const name = el('agent-select').value;
    const pin = el('pin-input').value.trim();
    if (!name || !pin) return;

    const expectedHash = state.agentsCreds[name];
    const enteredHash = await sha256(pin);

    if (!expectedHash || enteredHash !== expectedHash) {
      el('login-error').hidden = false;
      return;
    }

    sessionStorage.setItem('solde-agent', name);
    showDashboard(name);
  });
}

function wireLogout() {
  el('logout-btn').addEventListener('click', () => {
    sessionStorage.removeItem('solde-agent');
    el('pin-input').value = '';
    setScreen('screen-login');
  });
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ---------------------------------------------------------------------
   Tableau de bord
   ------------------------------------------------------------------- */

function showDashboard(agentName) {
  state.currentAgent = agentName;

  const availableYears = state.years.filter((y) => state.workbookData[y][agentName]);
  if (!availableYears.length) {
    el('dash-name').textContent = agentName;
    el('hero-card').hidden = true;
    el('report-chip').hidden = true;
    el('punch-row').innerHTML = '';
    el('ledger-body').innerHTML = '';
    el('dash-empty').hidden = false;
    setScreen('screen-dashboard');
    return;
  }

  state.currentYear = availableYears[0];
  el('dash-empty').hidden = true;
  el('hero-card').hidden = false;

  const yearPicker = el('year-picker');
  const yearSelect = el('year-select');
  yearSelect.innerHTML = '';
  availableYears.forEach((y) => {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    yearSelect.appendChild(opt);
  });
  yearPicker.hidden = availableYears.length <= 1;
  yearSelect.onchange = () => {
    state.currentYear = yearSelect.value;
    renderYear(agentName, state.currentYear);
  };

  el('dash-name').textContent = agentName;
  renderYear(agentName, state.currentYear);
  setScreen('screen-dashboard');
}

function renderYear(agentName, year) {
  const record = state.workbookData[year][agentName];
  const months = record.months;

  const filledMonths = MONTHS_FR.filter((m) => Object.prototype.hasOwnProperty.call(months, m));
  const withData = filledMonths.filter((m) => months[m] !== null);
  const lastMonth = withData[withData.length - 1] || null;

  // --- Carte principale : dernier solde connu ---
  if (lastMonth) {
    const hours = months[lastMonth] * 24;
    el('hero-label').textContent = `Solde au 30/${lastMonth} ${year}`;
    el('hero-value').textContent = formatSignedDuration(hours);
    el('hero-value').className = 'hero-value' + (hours < 0 ? ' negative' : '');
    const idx = withData.length - 2 >= 0 ? withData[withData.length - 2] : null;
    if (idx) {
      const diff = hours - months[idx] * 24;
      el('hero-sub').textContent = `${diff >= 0 ? '+' : ''}${formatSignedDuration(diff)} par rapport à ${idx}`;
    } else {
      el('hero-sub').textContent = '';
    }
  } else {
    el('hero-label').textContent = `Année ${year}`;
    el('hero-value').textContent = '—';
    el('hero-value').className = 'hero-value';
    el('hero-sub').textContent = 'Aucune donnée mensuelle pour cette année.';
  }

  // --- Solde reporté ---
  const reportChip = el('report-chip');
  if (record.report && record.report.value !== null) {
    reportChip.hidden = false;
    el('report-date').textContent = record.report.label;
    el('report-value').textContent = formatSignedDuration(record.report.value * 24);
  } else {
    reportChip.hidden = true;
  }

  // --- Bande de pointage (tuiles par mois) ---
  const punchRow = el('punch-row');
  punchRow.innerHTML = '';
  filledMonths.forEach((m) => {
    const v = months[m];
    const tile = document.createElement('div');
    tile.className = 'punch-tile' + (m === lastMonth ? ' is-current' : '');
    const valueClass = v === null ? 'empty' : (v < 0 ? 'negative' : 'positive');
    tile.innerHTML = `<p class="m">${m.slice(0, 3)}</p><p class="v ${valueClass}">${v === null ? '—' : formatSignedDuration(v * 24)}</p>`;
    punchRow.appendChild(tile);
  });

  // --- Registre détaillé ---
  const body = el('ledger-body');
  body.innerHTML = '';
  let prevHours = record.report && record.report.value !== null ? record.report.value * 24 : null;

  filledMonths.forEach((m) => {
    const v = months[m];
    const tr = document.createElement('tr');
    if (m === lastMonth) tr.className = 'current-row';

    const hours = v === null ? null : v * 24;
    const diff = (hours !== null && prevHours !== null) ? hours - prevHours : null;

    const tdMonth = document.createElement('td');
    tdMonth.textContent = `${m} ${year}`;

    const tdValue = document.createElement('td');
    tdValue.textContent = hours === null ? '—' : formatSignedDuration(hours);
    if (hours !== null) tdValue.className = hours < 0 ? 'negative' : 'positive';

    const tdDiff = document.createElement('td');
    tdDiff.textContent = diff === null ? '—' : `${diff >= 0 ? '+' : ''}${formatSignedDuration(diff)}`;
    if (diff !== null) tdDiff.className = diff < 0 ? 'negative' : 'positive';

    tr.append(tdMonth, tdValue, tdDiff);
    body.appendChild(tr);

    if (hours !== null) prevHours = hours;
  });
}

/* ---------------------------------------------------------------------
   Utilitaires
   ------------------------------------------------------------------- */

function formatSignedDuration(hoursDecimal) {
  const sign = hoursDecimal < 0 ? '-' : '';
  const abs = Math.abs(hoursDecimal);
  const totalMinutes = Math.round(abs * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${sign}${h}:${String(m).padStart(2, '0')}`;
}

function setScreen(id) {
  ['screen-login', 'screen-dashboard', 'screen-fatal'].forEach((s) => {
    el(s).hidden = s !== id;
  });
}

function showFatal(message) {
  el('fatal-message').textContent = message;
  setScreen('screen-fatal');
}

/* Reprise de session dans l'onglet en cours */
window.addEventListener('load', () => {
  const saved = sessionStorage.getItem('solde-agent');
  if (saved) {
    const check = setInterval(() => {
      if (state.workbookData) {
        clearInterval(check);
        if (state.workbookData && Object.values(state.workbookData).some((y) => y[saved])) {
          showDashboard(saved);
        }
      }
    }, 50);
  }
});
