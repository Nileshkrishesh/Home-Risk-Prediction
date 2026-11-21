/**
 * Home Credit Risk AI — Production JavaScript Controller
 * Clean, Commercial Machine Learning Workflow
 */

let lastPredictionResult = null;
let currentApplicantId = null;

function getApiUrl(path) {
  return path;
}

document.addEventListener('DOMContentLoaded', () => {
  initHealthCheck();
  initFormInteractivity();
  initPresets();
  initApplicantSearch();
  initActionButtons();
  initKeyboardShortcuts();
  renderHistory();

  // Run initial baseline prediction on page load
  runPrediction();

  if (window.lucide) {
    lucide.createIcons();
  }
});

/**
 * Check backend status and warming up state
 */
async function initHealthCheck() {
  const badge = document.getElementById('backend-status-badge');
  try {
    const res = await fetch(getApiUrl('/api/health'));
    if (res.ok) {
      if (badge) {
        badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200';
        badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span><span>Engine Online</span>';
      }
    } else {
      throw new Error('API warming up');
    }
  } catch (err) {
    if (badge) {
      badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200';
      badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span><span>Connecting (~25s)...</span>';
      setTimeout(initHealthCheck, 8000);
    }
  }
}

/**
 * Form inputs & range sync
 */
function initFormInteractivity() {
  const extSlider = document.getElementById('EXT_SOURCE_2_range');
  const extNum = document.getElementById('EXT_SOURCE_2');

  if (extSlider && extNum) {
    extSlider.addEventListener('input', () => {
      extNum.value = parseFloat(extSlider.value).toFixed(2);
    });
    extNum.addEventListener('input', () => {
      const v = parseFloat(extNum.value);
      if (!isNaN(v) && v >= 0 && v <= 1) {
        extSlider.value = v;
      }
    });
  }

  // Handle form submission
  const form = document.getElementById('prediction-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      runPrediction();
    });
  }

  const resetBtn = document.getElementById('btn-reset-form');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      currentApplicantId = null;
      hideComparisonBox();
      loadPreset('average');
    });
  }
}

/**
 * Collect and validate input feature dictionary
 */
function collectFormData() {
  const getVal = (id, def = 0) => {
    const el = document.getElementById(id);
    if (!el || el.value === '') return def;
    const v = parseFloat(el.value);
    return isNaN(v) ? el.value : v;
  };

  const age = getVal('calc_age_years', 45);
  const emp = getVal('calc_employed_years', 8);

  const income = getVal('AMT_INCOME_TOTAL', 180000);
  const credit = getVal('AMT_CREDIT', 500000);
  const annuity = getVal('AMT_ANNUITY', 25000);

  if (income <= 0 || credit <= 0 || annuity <= 0) {
    alert('Please enter valid positive amounts for Income, Credit, and Annuity.');
    return null;
  }

  return {
    AMT_INCOME_TOTAL: income,
    AMT_CREDIT: credit,
    AMT_ANNUITY: annuity,
    AMT_GOODS_PRICE: getVal('AMT_GOODS_PRICE', credit),
    NAME_CONTRACT_TYPE: document.getElementById('NAME_CONTRACT_TYPE')?.value || 'Cash loans',
    CODE_GENDER: document.getElementById('CODE_GENDER')?.value || 'M',
    NAME_INCOME_TYPE: document.getElementById('NAME_INCOME_TYPE')?.value || 'Working',
    NAME_EDUCATION_TYPE: document.getElementById('NAME_EDUCATION_TYPE')?.value || 'Higher education',
    NAME_FAMILY_STATUS: document.getElementById('NAME_FAMILY_STATUS')?.value || 'Married',
    NAME_HOUSING_TYPE: document.getElementById('NAME_HOUSING_TYPE')?.value || 'House / apartment',
    DAYS_BIRTH: -Math.round(age * 365.25),
    DAYS_EMPLOYED: -Math.round(emp * 365.25),
    EXT_SOURCE_1: getVal('EXT_SOURCE_1', 0.55),
    EXT_SOURCE_2: getVal('EXT_SOURCE_2', 0.65),
    EXT_SOURCE_3: getVal('EXT_SOURCE_3', 0.58),
    OWN_CAR_AGE: getVal('OWN_CAR_AGE', 4),
    CNT_CHILDREN: getVal('CNT_CHILDREN', 0),
    CNT_FAM_MEMBERS: getVal('CNT_FAM_MEMBERS', 2),
    AMT_REQ_CREDIT_BUREAU_YEAR: getVal('AMT_REQ_CREDIT_BUREAU_YEAR', 1),
    OCCUPATION_TYPE: document.getElementById('OCCUPATION_TYPE')?.value || 'Managers',
    ORGANIZATION_TYPE: document.getElementById('ORGANIZATION_TYPE')?.value || 'Business Entity Type 3'
  };
}

/**
 * Execute actual ML prediction via POST /api/predict
 */
async function runPrediction() {
  const payload = collectFormData();
  if (!payload) return;

  const btn = document.getElementById('btn-run-prediction');
  const btnText = document.getElementById('btn-predict-text');
  const panel = document.getElementById('prediction-result-panel');

  try {
    if (btn) {
      btn.disabled = true;
      if (btnText) btnText.textContent = 'Executing LightGBM Model...';
    }

    const res = await fetch(getApiUrl('/api/predict'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Server error occurred during prediction.');
    }

    const data = await res.json();
    lastPredictionResult = {
      timestamp: new Date().toLocaleTimeString(),
      applicantId: currentApplicantId,
      input: payload,
      output: data
    };

    renderPredictionResult(data);
    saveToHistory(lastPredictionResult);

    if (panel) {
      panel.classList.remove('animate-result');
      void panel.offsetWidth; // Trigger reflow
      panel.classList.add('animate-result');
    }

  } catch (err) {
    console.error('Prediction failed:', err);
    alert('Prediction error: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      if (btnText) btnText.textContent = 'Run Prediction';
    }
    if (window.lucide) lucide.createIcons();
  }
}

/**
 * Render dynamic ML model output on the results panel
 */
function renderPredictionResult(data) {
  const prob = data.probability_percent;
  const probDec = data.probability;
  const tier = data.risk_tier;
  const badge = data.risk_badge;

  // 1. Primary Probability
  const probEl = document.getElementById('res-prob-pct');
  const decEl = document.getElementById('res-prob-dec');
  if (probEl) probEl.textContent = `${prob.toFixed(2)}%`;
  if (decEl) decEl.textContent = `(p = ${probDec.toFixed(4)})`;

  // 2. Status Badge & Recommendation
  const badgeEl = document.getElementById('res-badge');
  const recEl = document.getElementById('res-recommendation');
  const recDescEl = document.getElementById('res-recommendation-desc');

  let badgeClass = 'badge-low';
  let dotColor = 'bg-emerald-500';
  let meterColor = 'bg-emerald-500';
  let spectrumLabel = 'Prime Range (< 8%)';

  if (tier === 'Moderate Risk') {
    badgeClass = 'badge-moderate';
    dotColor = 'bg-amber-500';
    meterColor = 'bg-amber-500';
    spectrumLabel = 'Standard Market Benchmark (8% - 15%)';
  } else if (tier === 'Elevated Risk') {
    badgeClass = 'badge-elevated';
    dotColor = 'bg-orange-500';
    meterColor = 'bg-orange-500';
    spectrumLabel = 'Elevated Risk Threshold (15% - 25%)';
  } else if (tier === 'High Risk') {
    badgeClass = 'badge-high';
    dotColor = 'bg-rose-500';
    meterColor = 'bg-rose-500';
    spectrumLabel = 'Subprime / High Default Risk (> 25%)';
  }

  if (badgeEl) {
    badgeEl.className = `badge-status ${badgeClass}`;
    badgeEl.innerHTML = `<span class="w-2 h-2 rounded-full ${dotColor}"></span><span>${tier}</span>`;
  }

  if (recEl) {
    recEl.textContent = data.recommendation;
  }
  if (recDescEl) {
    recDescEl.textContent = data.recommendation_description;
  }

  // 3. Spectrum Meter Bar
  const meterFill = document.getElementById('res-meter-fill');
  const specLabelEl = document.getElementById('res-spectrum-label');
  if (meterFill) {
    meterFill.style.width = `${Math.min(prob, 100)}%`;
    meterFill.className = `risk-meter-fill ${meterColor}`;
  }
  if (specLabelEl) {
    specLabelEl.textContent = spectrumLabel;
  }

  // 4. Financial Indicators
  const f = data.financial_summary || {};
  setText('res-dti', f.annuity_income_ratio_pct != null ? `${f.annuity_income_ratio_pct}%` : '—');
  setText('res-lti', f.credit_income_ratio != null ? `${f.credit_income_ratio}x` : '—');
  setText('res-term', f.credit_term_months != null ? `${f.credit_term_months} mos` : '—');

  // 5. Decision Factors List
  const container = document.getElementById('res-factors-container');
  if (container) {
    container.innerHTML = '';
    const strengths = (data.factors?.strengths || []).map(s => ({ ...s, isStrength: true }));
    const risks = (data.factors?.risk_drivers || []).map(r => ({ ...r, isStrength: false }));
    const allFactors = [...strengths, ...risks].slice(0, 4);

    if (allFactors.length === 0) {
      container.innerHTML = '<div class="text-xs text-slate-400 italic p-2 bg-slate-50 rounded">Balanced profile with neutral market benchmarks.</div>';
    } else {
      allFactors.forEach(item => {
        const div = document.createElement('div');
        div.className = `factor-item ${item.isStrength ? 'strength' : 'risk'}`;
        const icon = item.isStrength
          ? '<i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600 shrink-0 mt-0.5"></i>'
          : '<i data-lucide="alert-triangle" class="w-4 h-4 text-amber-600 shrink-0 mt-0.5"></i>';
        
        div.innerHTML = `
          ${icon}
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-1">
              <span class="font-bold text-slate-800">${item.factor}</span>
              <span class="font-mono font-semibold text-slate-700 text-[11px]">${item.value}</span>
            </div>
            <p class="text-slate-500 text-[11px] mt-0.5">${item.impact}</p>
          </div>
        `;
        container.appendChild(div);
      });
    }
  }

  // 6. Active Applicant Indicator
  const appIndicator = document.getElementById('active-applicant-indicator');
  if (appIndicator) {
    appIndicator.textContent = currentApplicantId ? `Applicant #${currentApplicantId}` : 'Custom Simulation';
  }
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/**
 * Scenario Profile Presets
 */
function initPresets() {
  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('[data-preset]').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      const p = e.currentTarget.getAttribute('data-preset');
      loadPreset(p);
    });
  });
}

function loadPreset(key) {
  currentApplicantId = null;
  hideComparisonBox();

  const presets = {
    prime: {
      AMT_INCOME_TOTAL: 270000,
      AMT_CREDIT: 600000,
      AMT_ANNUITY: 28000,
      AMT_GOODS_PRICE: 600000,
      NAME_CONTRACT_TYPE: 'Cash loans',
      CODE_GENDER: 'M',
      NAME_INCOME_TYPE: 'Working',
      NAME_EDUCATION_TYPE: 'Higher education',
      NAME_FAMILY_STATUS: 'Married',
      NAME_HOUSING_TYPE: 'House / apartment',
      calc_age_years: 50,
      calc_employed_years: 10,
      EXT_SOURCE_1: 0.65,
      EXT_SOURCE_2: 0.72,
      EXT_SOURCE_3: 0.68,
      OWN_CAR_AGE: 3,
      CNT_CHILDREN: 0,
      CNT_FAM_MEMBERS: 2,
      AMT_REQ_CREDIT_BUREAU_YEAR: 1,
      OCCUPATION_TYPE: 'Managers',
      ORGANIZATION_TYPE: 'Bank'
    },
    average: {
      AMT_INCOME_TOTAL: 180000,
      AMT_CREDIT: 500000,
      AMT_ANNUITY: 25000,
      AMT_GOODS_PRICE: 500000,
      NAME_CONTRACT_TYPE: 'Cash loans',
      CODE_GENDER: 'M',
      NAME_INCOME_TYPE: 'Working',
      NAME_EDUCATION_TYPE: 'Secondary / secondary special',
      NAME_FAMILY_STATUS: 'Married',
      NAME_HOUSING_TYPE: 'House / apartment',
      calc_age_years: 45,
      calc_employed_years: 8,
      EXT_SOURCE_1: 0.55,
      EXT_SOURCE_2: 0.65,
      EXT_SOURCE_3: 0.58,
      OWN_CAR_AGE: 4,
      CNT_CHILDREN: 0,
      CNT_FAM_MEMBERS: 2,
      AMT_REQ_CREDIT_BUREAU_YEAR: 1,
      OCCUPATION_TYPE: 'Core staff',
      ORGANIZATION_TYPE: 'Business Entity Type 3'
    },
    high_risk: {
      AMT_INCOME_TOTAL: 90000,
      AMT_CREDIT: 480000,
      AMT_ANNUITY: 32000,
      AMT_GOODS_PRICE: 480000,
      NAME_CONTRACT_TYPE: 'Cash loans',
      CODE_GENDER: 'F',
      NAME_INCOME_TYPE: 'Working',
      NAME_EDUCATION_TYPE: 'Lower secondary',
      NAME_FAMILY_STATUS: 'Single / not married',
      NAME_HOUSING_TYPE: 'Rented apartment',
      calc_age_years: 23,
      calc_employed_years: 0.5,
      EXT_SOURCE_1: 0.25,
      EXT_SOURCE_2: 0.28,
      EXT_SOURCE_3: 0.30,
      OWN_CAR_AGE: 18,
      CNT_CHILDREN: 2,
      CNT_FAM_MEMBERS: 3,
      AMT_REQ_CREDIT_BUREAU_YEAR: 7,
      OCCUPATION_TYPE: 'Laborers',
      ORGANIZATION_TYPE: 'Self-employed'
    }
  };

  const p = presets[key] || presets.average;
  Object.keys(p).forEach(k => {
    const el = document.getElementById(k);
    if (el) el.value = p[k];
  });

  const range = document.getElementById('EXT_SOURCE_2_range');
  if (range && p.EXT_SOURCE_2) range.value = p.EXT_SOURCE_2;

  runPrediction();
}

/**
 * Real Test Applicant Search (input/test.csv)
 */
function initApplicantSearch() {
  const input = document.getElementById('input-applicant-id');
  const btn = document.getElementById('btn-search-id');

  const executeSearch = async (id) => {
    if (!id) return;
    try {
      if (btn) btn.textContent = 'Loading...';
      const res = await fetch(getApiUrl(`/api/applicant/${id}`));
      if (!res.ok) {
        alert(`Applicant #${id} not found in test dataset.`);
        return;
      }
      const data = await res.json();
      currentApplicantId = id;
      populateTestApplicant(data.data);
      showComparisonBox(data.submission_predictions, data.live_prediction);
      runPrediction();
    } catch (err) {
      console.error(err);
      alert('Error loading applicant data.');
    } finally {
      if (btn) btn.textContent = 'Load & Score';
    }
  };

  if (btn && input) {
    btn.addEventListener('click', () => executeSearch(input.value.trim()));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') executeSearch(input.value.trim());
    });
  }

  document.querySelectorAll('[data-sample-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-sample-id');
      if (input) input.value = id;
      executeSearch(id);
    });
  });
}

function populateTestApplicant(d) {
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el && val != null) el.value = val;
  };

  setVal('AMT_INCOME_TOTAL', d.AMT_INCOME_TOTAL);
  setVal('AMT_CREDIT', d.AMT_CREDIT);
  setVal('AMT_ANNUITY', d.AMT_ANNUITY);
  setVal('AMT_GOODS_PRICE', d.AMT_GOODS_PRICE || d.AMT_CREDIT);
  setVal('NAME_CONTRACT_TYPE', d.NAME_CONTRACT_TYPE);
  setVal('CODE_GENDER', d.CODE_GENDER);
  setVal('NAME_INCOME_TYPE', d.NAME_INCOME_TYPE);
  setVal('NAME_EDUCATION_TYPE', d.NAME_EDUCATION_TYPE);
  setVal('NAME_FAMILY_STATUS', d.NAME_FAMILY_STATUS);
  setVal('NAME_HOUSING_TYPE', d.NAME_HOUSING_TYPE);
  setVal('calc_age_years', Math.round(-d.DAYS_BIRTH / 365.25));
  setVal('calc_employed_years', Math.max(0, Math.round(-d.DAYS_EMPLOYED / 365.25 * 10) / 10));
  setVal('EXT_SOURCE_1', d.EXT_SOURCE_1 ? Number(d.EXT_SOURCE_1).toFixed(2) : 0.55);
  setVal('EXT_SOURCE_2', d.EXT_SOURCE_2 ? Number(d.EXT_SOURCE_2).toFixed(2) : 0.50);
  setVal('EXT_SOURCE_3', d.EXT_SOURCE_3 ? Number(d.EXT_SOURCE_3).toFixed(2) : 0.50);
  setVal('OWN_CAR_AGE', d.OWN_CAR_AGE || 0);
  setVal('CNT_CHILDREN', d.CNT_CHILDREN || 0);
  setVal('CNT_FAM_MEMBERS', d.CNT_FAM_MEMBERS || 2);
  setVal('AMT_REQ_CREDIT_BUREAU_YEAR', d.AMT_REQ_CREDIT_BUREAU_YEAR || 1);
  setVal('OCCUPATION_TYPE', d.OCCUPATION_TYPE || 'Laborers');
  setVal('ORGANIZATION_TYPE', d.ORGANIZATION_TYPE || 'Business Entity Type 3');

  const range = document.getElementById('EXT_SOURCE_2_range');
  if (range && d.EXT_SOURCE_2) range.value = d.EXT_SOURCE_2;
}

function showComparisonBox(preds, live) {
  const box = document.getElementById('comparison-box');
  const items = document.getElementById('comparison-items');
  if (!box || !items) return;

  items.innerHTML = `
    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-600 text-white font-mono text-xs font-semibold">
      Active LightGBM: ${live.probability_percent.toFixed(2)}%
    </span>
  `;

  Object.keys(preds || {}).forEach(k => {
    items.innerHTML += `
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white text-slate-800 border border-indigo-200 font-mono text-xs">
        <span class="text-slate-500">${k}:</span>
        <strong class="text-slate-900">${preds[k]}%</strong>
      </span>
    `;
  });

  box.classList.remove('hidden');
}

function hideComparisonBox() {
  const box = document.getElementById('comparison-box');
  if (box) box.classList.add('hidden');
}

/**
 * Action Buttons: Copy Assessment & Export JSON
 */
function initActionButtons() {
  const copyBtn = document.getElementById('btn-copy-assessment');
  const copyLabel = document.getElementById('copy-btn-label');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (!lastPredictionResult) return;
      const res = lastPredictionResult.output;
      const f = res.financial_summary || {};
      const text = `=== Home Credit Risk Underwriting Assessment ===
Applicant: ${currentApplicantId ? '#' + currentApplicantId : 'Custom Simulation'}
Default Probability: ${res.probability_percent}%
Risk Tier: ${res.risk_tier}
Recommendation: ${res.recommendation} (${res.recommendation_description})
Financial Indicators:
- Debt-to-Income (DTI): ${f.annuity_income_ratio_pct}%
- Credit-to-Income: ${f.credit_income_ratio}x
- Estimated Term: ${f.credit_term_months} months
- External Rating Mean: ${f.external_rating_mean}
LightGBM Model: AUC 0.7554 | 44 Features Engineered
Generated: ${new Date().toLocaleString()}`;

      navigator.clipboard.writeText(text).then(() => {
        if (copyLabel) {
          copyLabel.textContent = 'Copied!';
          setTimeout(() => { copyLabel.textContent = 'Copy Report'; }, 2000);
        }
      });
    });
  }

  const exportBtn = document.getElementById('btn-export-json');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      if (!lastPredictionResult) return;
      const jsonStr = JSON.stringify(lastPredictionResult, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `risk-assessment-${currentApplicantId || 'simulation'}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const clearHistBtn = document.getElementById('btn-clear-history');
  if (clearHistBtn) {
    clearHistBtn.addEventListener('click', () => {
      localStorage.removeItem('hc_risk_history');
      renderHistory();
    });
  }
}

/**
 * Session Prediction History
 */
function saveToHistory(record) {
  try {
    let hist = JSON.parse(localStorage.getItem('hc_risk_history') || '[]');
    hist.unshift({
      id: record.applicantId ? `#${record.applicantId}` : 'Custom',
      prob: record.output.probability_percent,
      tier: record.output.risk_tier,
      time: record.timestamp,
      input: record.input
    });
    hist = hist.slice(0, 6);
    localStorage.setItem('hc_risk_history', JSON.stringify(hist));
    renderHistory();
  } catch (e) {
    console.error(e);
  }
}

function renderHistory() {
  const container = document.getElementById('history-container');
  if (!container) return;

  try {
    const hist = JSON.parse(localStorage.getItem('hc_risk_history') || '[]');
    if (hist.length === 0) {
      container.innerHTML = '<div class="p-3 text-center text-slate-400 text-xs italic">No predictions in current session yet.</div>';
      return;
    }

    container.innerHTML = '';
    hist.forEach((h, idx) => {
      const row = document.createElement('div');
      row.className = 'p-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer';
      
      let badgeColor = 'text-emerald-700 bg-emerald-50';
      if (h.tier === 'Moderate Risk') badgeColor = 'text-amber-700 bg-amber-50';
      else if (h.tier === 'Elevated Risk') badgeColor = 'text-orange-700 bg-orange-50';
      else if (h.tier === 'High Risk') badgeColor = 'text-rose-700 bg-rose-50';

      row.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="font-mono font-semibold text-slate-800">${h.id}</span>
          <span class="text-[10px] text-slate-400 font-mono">${h.time}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="font-mono font-bold text-slate-900">${h.prob.toFixed(2)}%</span>
          <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold ${badgeColor}">${h.tier}</span>
        </div>
      `;
      row.addEventListener('click', () => {
        if (h.input) {
          populateFromHistory(h.input);
          runPrediction();
        }
      });
      container.appendChild(row);
    });
  } catch (e) {
    console.error(e);
  }
}

function populateFromHistory(input) {
  Object.keys(input).forEach(k => {
    const el = document.getElementById(k);
    if (el) el.value = input[k];
  });
  if (input.DAYS_BIRTH) {
    const ageEl = document.getElementById('calc_age_years');
    if (ageEl) ageEl.value = Math.round(-input.DAYS_BIRTH / 365.25);
  }
  if (input.DAYS_EMPLOYED) {
    const empEl = document.getElementById('calc_employed_years');
    if (empEl) empEl.value = Math.max(0, Math.round(-input.DAYS_EMPLOYED / 365.25 * 10) / 10);
  }
}

/**
 * Keyboard shortcuts (Ctrl+Enter to Predict)
 */
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runPrediction();
    }
  });
}
