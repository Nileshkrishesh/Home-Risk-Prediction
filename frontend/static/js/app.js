/**
 * app.js - Client-side controller for Home Credit Risk Tool (GCI Global 2025)
 */

let debounceTimer = null;
let currentApplicantId = null;

document.addEventListener('DOMContentLoaded', () => {
  bindFormEvents();
  loadSubmissions();
  setupApplicantSearch();
  setupPresets();
  setupMoreOptionsToggle();
  
  // Initial calculation on page load
  runPrediction();
  if (window.lucide) lucide.createIcons();
});

function bindFormEvents() {
  const inputs = document.querySelectorAll('.watch-input');
  inputs.forEach(input => {
    input.addEventListener('input', () => {
      const range = document.getElementById(`${input.id}_range`);
      if (range && range.value !== input.value) {
        range.value = input.value;
      }
      triggerDebouncedPrediction();
    });
  });

  const ranges = document.querySelectorAll('.watch-range');
  ranges.forEach(range => {
    range.addEventListener('input', () => {
      const input = document.getElementById(range.id.replace('_range', ''));
      if (input) {
        input.value = range.value;
      }
      triggerDebouncedPrediction();
    });
  });

  const calcBtn = document.getElementById('btn-calculate');
  if (calcBtn) {
    calcBtn.addEventListener('click', runPrediction);
  }
}

function setupMoreOptionsToggle() {
  const toggleBtn = document.getElementById('toggle-more-options');
  const moreContainer = document.getElementById('more-options-container');
  if (toggleBtn && moreContainer) {
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const isHidden = moreContainer.classList.contains('hidden');
      if (isHidden) {
        moreContainer.classList.remove('hidden');
        toggleBtn.textContent = '— Fewer attributes';
      } else {
        moreContainer.classList.add('hidden');
        toggleBtn.textContent = '+ Advanced attributes (Car age, Children, Inquiries)';
      }
    });
  }
}

function setupPresets() {
  const buttons = document.querySelectorAll('[data-preset]');
  buttons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const p = e.currentTarget.getAttribute('data-preset');
      loadPresetData(p);
    });
  });
}

function loadPresetData(presetKey) {
  currentApplicantId = null;
  hideSubmissionComparison();

  if (presetKey === 'prime') {
    setValues({
      AMT_INCOME_TOTAL: 270000,
      AMT_CREDIT: 600000,
      AMT_ANNUITY: 28000,
      NAME_CONTRACT_TYPE: 'Cash loans',
      calc_age_years: 50,
      calc_employed_years: 10,
      NAME_EDUCATION_TYPE: 'Higher education',
      EXT_SOURCE_2: 0.72,
      OWN_CAR_AGE: 3,
      CNT_CHILDREN: 0,
      AMT_REQ_CREDIT_BUREAU_YEAR: 1
    });
  } else if (presetKey === 'average') {
    setValues({
      AMT_INCOME_TOTAL: 157500,
      AMT_CREDIT: 520000,
      AMT_ANNUITY: 26000,
      NAME_CONTRACT_TYPE: 'Cash loans',
      calc_age_years: 37,
      calc_employed_years: 4,
      NAME_EDUCATION_TYPE: 'Secondary / secondary special',
      EXT_SOURCE_2: 0.52,
      OWN_CAR_AGE: 8,
      CNT_CHILDREN: 1,
      AMT_REQ_CREDIT_BUREAU_YEAR: 2
    });
  } else if (presetKey === 'high_risk') {
    setValues({
      AMT_INCOME_TOTAL: 90000,
      AMT_CREDIT: 480000,
      AMT_ANNUITY: 32000,
      NAME_CONTRACT_TYPE: 'Cash loans',
      calc_age_years: 23,
      calc_employed_years: 0.5,
      NAME_EDUCATION_TYPE: 'Lower secondary',
      EXT_SOURCE_2: 0.28,
      OWN_CAR_AGE: 18,
      CNT_CHILDREN: 2,
      AMT_REQ_CREDIT_BUREAU_YEAR: 7
    });
  }
  runPrediction();
}

function setValues(dict) {
  Object.keys(dict).forEach(key => {
    const el = document.getElementById(key);
    if (el) {
      el.value = dict[key];
      const rangeEl = document.getElementById(`${key}_range`);
      if (rangeEl) rangeEl.value = dict[key];
    }
  });
}

function getFormData() {
  const getVal = (id, defaultVal = null) => {
    const el = document.getElementById(id);
    if (!el || el.value === '') return defaultVal;
    return isNaN(el.value) ? el.value : parseFloat(el.value);
  };

  const age = getVal('calc_age_years', 40);
  const emp = getVal('calc_employed_years', 4);
  const ext = getVal('EXT_SOURCE_2', 0.50);

  return {
    AMT_INCOME_TOTAL: getVal('AMT_INCOME_TOTAL', 180000),
    AMT_CREDIT: getVal('AMT_CREDIT', 500000),
    AMT_ANNUITY: getVal('AMT_ANNUITY', 25000),
    AMT_GOODS_PRICE: getVal('AMT_CREDIT', 500000),
    NAME_CONTRACT_TYPE: getVal('NAME_CONTRACT_TYPE', 'Cash loans'),
    NAME_EDUCATION_TYPE: getVal('NAME_EDUCATION_TYPE', 'Higher education'),
    DAYS_BIRTH: -Math.round(age * 365.25),
    DAYS_EMPLOYED: -Math.round(emp * 365.25),
    EXT_SOURCE_1: ext,
    EXT_SOURCE_2: ext,
    EXT_SOURCE_3: ext,
    OWN_CAR_AGE: getVal('OWN_CAR_AGE', 5),
    CNT_CHILDREN: getVal('CNT_CHILDREN', 0),
    AMT_REQ_CREDIT_BUREAU_YEAR: getVal('AMT_REQ_CREDIT_BUREAU_YEAR', 1)
  };
}

function triggerDebouncedPrediction() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runPrediction, 180);
}

async function runPrediction() {
  const payload = getFormData();
  try {
    const resp = await fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) return;
    const res = await resp.json();
    renderResult(res);
  } catch (err) {
    console.error('Prediction failed:', err);
  }
}

function renderResult(res) {
  const prob = res.probability_percent;
  const probEl = document.getElementById('res-prob');
  if (probEl) probEl.textContent = `${prob.toFixed(1)}%`;

  // Progress Bar
  const meterFill = document.getElementById('res-meter-fill');
  if (meterFill) {
    meterFill.style.width = `${Math.min(prob, 100)}%`;
    if (prob < 8) meterFill.style.backgroundColor = '#10b981';
    else if (prob < 15) meterFill.style.backgroundColor = '#f59e0b';
    else if (prob < 25) meterFill.style.backgroundColor = '#f97316';
    else meterFill.style.backgroundColor = '#ef4444';
  }

  // Badge
  const badgeEl = document.getElementById('res-badge');
  if (badgeEl) {
    let badgeClass = 'badge-status-low';
    if (prob >= 25) badgeClass = 'badge-status-high';
    else if (prob >= 15) badgeClass = 'badge-status-elevated';
    else if (prob >= 8) badgeClass = 'badge-status-moderate';

    badgeEl.className = `inline-block px-2.5 py-0.5 rounded text-xs font-semibold ${badgeClass}`;
    badgeEl.textContent = `${res.risk_tier} — ${res.recommendation}`;
  }

  // Financial Metrics
  const f = res.financial_summary || {};
  setText('res-dti', f.annuity_income_ratio_pct ? `${f.annuity_income_ratio_pct}%` : '—');
  setText('res-credit-income', f.credit_income_ratio ? `${f.credit_income_ratio}x` : '—');
  setText('res-term', f.credit_term_months ? `${f.credit_term_months} mos` : '—');

  // Factors List
  const factorsList = document.getElementById('res-factors');
  if (factorsList) {
    factorsList.innerHTML = '';
    const items = [
      ...(res.factors.strengths || []).map(s => ({ ...s, positive: true })),
      ...(res.factors.risk_drivers || []).map(r => ({ ...r, positive: false }))
    ].slice(0, 4);

    items.forEach(item => {
      const li = document.createElement('li');
      li.className = 'text-xs text-slate-600 flex items-start gap-1.5';
      const icon = item.positive 
        ? '<span class="text-emerald-600 font-bold">&check;</span>' 
        : '<span class="text-amber-600 font-bold">&bull;</span>';
      li.innerHTML = `${icon} <span><strong>${item.factor}:</strong> ${item.impact} (${item.value})</span>`;
      factorsList.appendChild(li);
    });
  }
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setupApplicantSearch() {
  const searchInput = document.getElementById('input-applicant-id');
  const searchBtn = document.getElementById('btn-search-id');

  const execute = async () => {
    const id = searchInput.value.trim();
    if (!id) return;
    try {
      searchBtn.textContent = 'Searching...';
      const resp = await fetch(`/api/applicant/${id}`);
      if (!resp.ok) {
        alert(`Applicant ID ${id} not found in input/test.csv.`);
        return;
      }
      const data = await resp.json();
      currentApplicantId = id;
      populateFromTest(data.data);
      showSubmissionComparison(data.submission_predictions, data.live_prediction);
      runPrediction();
    } catch (err) {
      console.error(err);
      alert('Error fetching applicant.');
    } finally {
      searchBtn.textContent = 'Lookup & Score';
    }
  };

  if (searchBtn) searchBtn.addEventListener('click', execute);
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') execute();
    });
  }

  document.querySelectorAll('[data-sample-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-sample-id');
      searchInput.value = id;
      execute();
    });
  });
}

function populateFromTest(d) {
  setValues({
    AMT_INCOME_TOTAL: d.AMT_INCOME_TOTAL,
    AMT_CREDIT: d.AMT_CREDIT,
    AMT_ANNUITY: d.AMT_ANNUITY,
    NAME_CONTRACT_TYPE: d.NAME_CONTRACT_TYPE,
    NAME_EDUCATION_TYPE: d.NAME_EDUCATION_TYPE,
    calc_age_years: Math.round(-d.DAYS_BIRTH / 365.25),
    calc_employed_years: Math.max(0, Math.round(-d.DAYS_EMPLOYED / 365.25 * 10) / 10),
    EXT_SOURCE_2: d.EXT_SOURCE_2 || 0.50,
    OWN_CAR_AGE: d.OWN_CAR_AGE || 0,
    CNT_CHILDREN: d.CNT_CHILDREN || 0,
    AMT_REQ_CREDIT_BUREAU_YEAR: d.AMT_REQ_CREDIT_BUREAU_YEAR || 1
  });
}

function showSubmissionComparison(preds, live) {
  const compBox = document.getElementById('comparison-box');
  const compList = document.getElementById('comparison-items');
  if (!compBox || !compList) return;

  compList.innerHTML = '';
  // Live Active Model
  compList.innerHTML += `
    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-mono font-medium">
      Active LightGBM: <strong>${live.probability_percent.toFixed(1)}%</strong>
    </span>
  `;

  // Output Submission files
  Object.keys(preds).forEach(k => {
    compList.innerHTML += `
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white text-slate-700 border border-slate-200 text-xs font-mono">
        ${k}: <strong>${preds[k]}%</strong>
      </span>
    `;
  });

  compBox.classList.remove('hidden');
}

function hideSubmissionComparison() {
  const compBox = document.getElementById('comparison-box');
  if (compBox) compBox.classList.add('hidden');
}

async function loadSubmissions() {
  try {
    const resp = await fetch('/api/submissions');
    if (!resp.ok) return;
    const data = await resp.json();
    const tbody = document.getElementById('submissions-tbody');
    if (!tbody || !data.submissions) return;

    tbody.innerHTML = '';
    Object.keys(data.submissions).forEach(key => {
      const s = data.submissions[key];
      const isFinal = s.filename === 'submissionFinal.csv';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="font-medium text-slate-900 flex items-center gap-2">
          <span>${s.filename}</span>
          ${isFinal ? '<span class="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">Final Model</span>' : ''}
        </td>
        <td class="text-xs text-slate-500">${s.rows.toLocaleString()}</td>
        <td class="mono-num text-xs font-semibold text-slate-800">${s.mean_pct}%</td>
        <td class="mono-num text-xs text-slate-600">${s.median_pct}%</td>
        <td>
          <a href="/api/download-submission?name=${s.filename}" class="text-xs text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1">
            Download CSV &rarr;
          </a>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load submissions:', err);
  }
}
