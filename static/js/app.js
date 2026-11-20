/**
 * app.js - Unified Client Controller for Home Credit Risk Hub (GCI Global 2025)
 * Handles both the Hub Overview (index.html) and Prediction Studio (predict.html).
 */

const CIRCUMFERENCE = 251.2; // 2 * PI * 40
let debounceTimer = null;
let currentApplicantId = null;

// Determine API endpoint
function getApiUrl(path) {
  return path;
}

document.addEventListener('DOMContentLoaded', () => {
  checkBackendHealth();

  // If on Overview Hub (index.html)
  if (document.getElementById('submissions-tbody') || document.getElementById('hub-applicant-input')) {
    loadSubmissions();
    setupHubSearch();
  }

  // If on Prediction Studio (predict.html)
  if (document.getElementById('btn-calculate')) {
    bindFormEvents();
    setupApplicantSearch();
    setupPresets();
    setupMoreOptionsToggle();
    setupCopySummary();
    setupResetButton();

    // Check if SK_ID_CURR was passed via URL parameter (?id=171202)
    const urlParams = new URLSearchParams(window.location.search);
    const queryId = urlParams.get('id');
    if (queryId) {
      const searchInput = document.getElementById('input-applicant-id');
      if (searchInput) searchInput.value = queryId;
      loadApplicantById(queryId);
    } else {
      // Run initial baseline prediction
      runPrediction();
    }
  }

  if (window.lucide) {
    lucide.createIcons();
  }
});

/**
 * Health check & warmup badge
 */
async function checkBackendHealth() {
  const badgeEl = document.getElementById('backend-status-badge');
  try {
    const resp = await fetch(getApiUrl('/api/health'));
    if (resp.ok) {
      if (badgeEl) {
        badgeEl.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200';
        badgeEl.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> API Online';
      }
    } else {
      throw new Error('API warming up');
    }
  } catch (err) {
    if (badgeEl) {
      badgeEl.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200';
      badgeEl.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Waking API (~25s)...';
      setTimeout(checkBackendHealth, 8000);
    }
  }
}

/**
 * =====================================================================
 * Prediction Studio Functions (predict.html)
 * =====================================================================
 */

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

function triggerDebouncedPrediction() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runPrediction, 160);
}

function getFormData() {
  const getVal = (id, defaultVal = null) => {
    const el = document.getElementById(id);
    if (!el || el.value === '') return defaultVal;
    return isNaN(el.value) ? el.value : parseFloat(el.value);
  };

  const age = getVal('calc_age_years', 45);
  const emp = getVal('calc_employed_years', 8);
  const ext = getVal('EXT_SOURCE_2', 0.65);

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
    OWN_CAR_AGE: getVal('OWN_CAR_AGE', 4),
    CNT_CHILDREN: getVal('CNT_CHILDREN', 0),
    AMT_REQ_CREDIT_BUREAU_YEAR: getVal('AMT_REQ_CREDIT_BUREAU_YEAR', 1)
  };
}

async function runPrediction() {
  const payload = getFormData();
  try {
    const resp = await fetch(getApiUrl('/api/predict'), {
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
  
  // Update Numeric Probability
  const probEl = document.getElementById('res-prob');
  if (probEl) probEl.textContent = `${prob.toFixed(1)}%`;

  // Update Circular Gauge
  const gaugeCircle = document.getElementById('gauge-meter-circle');
  if (gaugeCircle) {
    const offset = Math.max(0, CIRCUMFERENCE - (Math.min(prob, 100) / 100) * CIRCUMFERENCE);
    gaugeCircle.style.strokeDashoffset = offset;

    let color = '#10b981'; // emerald
    if (prob >= 25) color = '#ef4444'; // red
    else if (prob >= 15) color = '#f97316'; // orange
    else if (prob >= 8) color = '#f59e0b'; // amber
    gaugeCircle.style.stroke = color;
  }

  // Linear Spectrum Meter Fill
  const meterFill = document.getElementById('res-meter-fill');
  if (meterFill) {
    meterFill.style.width = `${Math.min(prob, 100)}%`;
    if (prob < 8) meterFill.style.backgroundColor = '#10b981';
    else if (prob < 15) meterFill.style.backgroundColor = '#f59e0b';
    else if (prob < 25) meterFill.style.backgroundColor = '#f97316';
    else meterFill.style.backgroundColor = '#ef4444';
  }

  // Underwriting Decision Badge
  const badgeEl = document.getElementById('res-badge');
  if (badgeEl) {
    let badgeClass = 'badge-status-low';
    if (prob >= 25) badgeClass = 'badge-status-high';
    else if (prob >= 15) badgeClass = 'badge-status-elevated';
    else if (prob >= 8) badgeClass = 'badge-status-moderate';

    badgeEl.className = `inline-block px-3 py-1 rounded-full text-xs font-semibold ${badgeClass}`;
    badgeEl.textContent = `${res.risk_tier} — ${res.recommendation}`;
  }

  // Financial Health Metrics
  const f = res.financial_summary || {};
  setText('res-dti', f.annuity_income_ratio_pct ? `${f.annuity_income_ratio_pct}%` : '—');
  setText('res-credit-income', f.credit_income_ratio ? `${f.credit_income_ratio}x` : '—');
  setText('res-term', f.credit_term_months ? `${f.credit_term_months} mos` : '—');

  // Decision Factors List
  const factorsList = document.getElementById('res-factors');
  if (factorsList) {
    factorsList.innerHTML = '';
    const items = [
      ...(res.factors.strengths || []).map(s => ({ ...s, positive: true })),
      ...(res.factors.risk_drivers || []).map(r => ({ ...r, positive: false }))
    ].slice(0, 4);

    if (items.length === 0) {
      factorsList.innerHTML = '<li class="text-xs text-slate-400 italic">Balanced credit profile with neutral indicators.</li>';
    } else {
      items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'text-xs text-slate-700 flex items-start gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100';
        const icon = item.positive 
          ? '<span class="text-emerald-600 font-bold text-sm leading-none">&check;</span>' 
          : '<span class="text-amber-600 font-bold text-sm leading-none">&excl;</span>';
        li.innerHTML = `
          ${icon}
          <div>
            <span class="font-semibold text-slate-900">${item.factor}:</span>
            <span class="text-slate-600 ml-1">${item.impact} (${item.value})</span>
          </div>
        `;
        factorsList.appendChild(li);
      });
    }
  }
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
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

function setupMoreOptionsToggle() {
  const toggleBtn = document.getElementById('toggle-more-options');
  const moreContainer = document.getElementById('more-options-container');
  if (toggleBtn && moreContainer) {
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const isHidden = moreContainer.classList.contains('hidden');
      if (isHidden) {
        moreContainer.classList.remove('hidden');
        toggleBtn.textContent = '— Fewer Advanced Attributes';
      } else {
        moreContainer.classList.add('hidden');
        toggleBtn.textContent = '+ Advanced Attributes (Car Age, Children, Recent Bureau Inquiries)';
      }
    });
  }
}

function setupApplicantSearch() {
  const searchInput = document.getElementById('input-applicant-id');
  const searchBtn = document.getElementById('btn-search-id');

  const execute = () => {
    const id = searchInput ? searchInput.value.trim() : '';
    if (id) loadApplicantById(id);
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
      if (searchInput) searchInput.value = id;
      loadApplicantById(id);
    });
  });
}

async function loadApplicantById(id) {
  const searchBtn = document.getElementById('btn-search-id');
  try {
    if (searchBtn) searchBtn.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Loading...';
    if (window.lucide) lucide.createIcons();

    const resp = await fetch(getApiUrl(`/api/applicant/${id}`));
    if (!resp.ok) {
      alert(`Applicant ID #${id} not found in input/test.csv.`);
      return;
    }
    const data = await resp.json();
    currentApplicantId = id;
    populateFromTest(data.data);
    showSubmissionComparison(data.submission_predictions, data.live_prediction);
    runPrediction();
  } catch (err) {
    console.error(err);
    alert('Error fetching applicant data.');
  } finally {
    if (searchBtn) {
      searchBtn.innerHTML = '<span>Lookup & Score</span>';
      if (window.lucide) lucide.createIcons();
    }
  }
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
  // Live Active LightGBM
  compList.innerHTML += `
    <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-mono font-bold shadow-sm">
      <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
      Active LightGBM: ${live.probability_percent.toFixed(1)}%
    </span>
  `;

  // Output Submission files
  Object.keys(preds || {}).forEach(k => {
    compList.innerHTML += `
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white text-slate-800 border border-indigo-200 text-xs font-mono font-medium shadow-xs">
        <span class="text-slate-400">${k}:</span>
        <strong>${preds[k]}%</strong>
      </span>
    `;
  });

  compBox.classList.remove('hidden');
}

function hideSubmissionComparison() {
  const compBox = document.getElementById('comparison-box');
  if (compBox) compBox.classList.add('hidden');
}

function setupCopySummary() {
  const copyBtn = document.getElementById('btn-copy-summary');
  const copyText = document.getElementById('copy-btn-text');
  if (!copyBtn) return;

  copyBtn.addEventListener('click', () => {
    const prob = document.getElementById('res-prob')?.textContent || '';
    const badge = document.getElementById('res-badge')?.textContent.trim() || '';
    const dti = document.getElementById('res-dti')?.textContent || '';
    const cti = document.getElementById('res-credit-income')?.textContent || '';
    const term = document.getElementById('res-term')?.textContent || '';

    const summary = `Home Credit Default Risk Assessment (GCI Global 2025)
Applicant: ${currentApplicantId ? '#' + currentApplicantId : 'Custom Simulation'}
Default Probability: ${prob}
Status: ${badge}
DTI Ratio: ${dti} | Credit/Income: ${cti} | Loan Term: ${term}`;

    navigator.clipboard.writeText(summary).then(() => {
      if (copyText) {
        copyText.textContent = 'Copied to Clipboard!';
        setTimeout(() => { copyText.textContent = 'Copy Risk Assessment Summary'; }, 2000);
      }
    });
  });
}

function setupResetButton() {
  const resetBtn = document.getElementById('btn-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      currentApplicantId = null;
      hideSubmissionComparison();
      loadPresetData('average');
    });
  }
}

/**
 * =====================================================================
 * Hub Overview Functions (index.html)
 * =====================================================================
 */

function setupHubSearch() {
  const input = document.getElementById('hub-applicant-input');
  const btn = document.getElementById('hub-applicant-btn');
  const preview = document.getElementById('hub-preview-card');

  const executeHubSearch = async (id) => {
    if (!id) return;
    try {
      if (btn) btn.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Searching...';
      if (window.lucide) lucide.createIcons();

      const resp = await fetch(getApiUrl(`/api/applicant/${id}`));
      if (!resp.ok) {
        alert(`Applicant ID #${id} not found in input/test.csv`);
        return;
      }
      const data = await resp.json();
      const d = data.data;
      const live = data.live_prediction;

      // Populate preview card
      setText('hub-preview-id', `Applicant #${id}`);
      setText('hub-preview-income', `$${Number(d.AMT_INCOME_TOTAL).toLocaleString()}`);
      setText('hub-preview-credit', `$${Number(d.AMT_CREDIT).toLocaleString()}`);
      setText('hub-preview-annuity', `$${Number(d.AMT_ANNUITY).toLocaleString()}`);
      setText('hub-preview-ext', d.EXT_SOURCE_2 ? Number(d.EXT_SOURCE_2).toFixed(3) : '0.500');

      const riskBadge = document.getElementById('hub-preview-risk');
      if (riskBadge && live) {
        riskBadge.textContent = `${live.probability_percent.toFixed(1)}% Risk (${live.risk_tier})`;
      }

      const link = document.getElementById('hub-preview-link');
      if (link) {
        link.href = `predict.html?id=${id}`;
      }

      if (preview) preview.classList.remove('hidden');
    } catch (err) {
      console.error(err);
      alert('Error looking up applicant.');
    } finally {
      if (btn) {
        btn.innerHTML = '<i data-lucide="search" class="w-3.5 h-3.5"></i> <span>Lookup Applicant</span>';
        if (window.lucide) lucide.createIcons();
      }
    }
  };

  if (btn && input) {
    btn.addEventListener('click', () => executeHubSearch(input.value.trim()));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') executeHubSearch(input.value.trim());
    });
  }

  document.querySelectorAll('[data-hub-sample]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-hub-sample');
      if (input) input.value = id;
      executeHubSearch(id);
    });
  });
}

async function loadSubmissions() {
  try {
    const resp = await fetch(getApiUrl('/api/submissions'));
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
        <td class="font-bold text-slate-900 flex items-center gap-2">
          <span>${s.filename}</span>
          ${isFinal ? '<span class="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">Final Benchmark</span>' : ''}
        </td>
        <td class="text-xs text-slate-500 mono-num">${s.rows.toLocaleString()}</td>
        <td class="mono-num text-xs font-bold text-slate-900">${s.mean_pct}%</td>
        <td class="mono-num text-xs text-slate-600">${s.median_pct}%</td>
        <td>
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-700 border border-slate-200">
            P75: ${s.p75_pct}%
          </span>
        </td>
        <td>
          <a href="${getApiUrl('/api/download-submission?name=' + s.filename)}" class="text-xs text-indigo-600 hover:text-indigo-800 font-bold inline-flex items-center gap-1">
            Download CSV &rarr;
          </a>
        </td>
      `;
      tbody.appendChild(tr);
    });
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('Failed to load submissions:', err);
  }
}
