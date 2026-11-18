/**
 * predictor.js - Real-time underwriting risk calculator
 */

const PredictorModule = {
  debounceTimer: null,

  init() {
    this.bindInputs();
    this.bindPresets();
    this.loadPreset('prime');
  },

  bindInputs() {
    const inputs = document.querySelectorAll('.calc-input');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        const rangeTarget = document.getElementById(`${input.id}_range`);
        if (rangeTarget && rangeTarget.value !== input.value) {
          rangeTarget.value = input.value;
        }
        this.debouncedPredict();
      });
    });

    const ranges = document.querySelectorAll('.calc-range');
    ranges.forEach(range => {
      range.addEventListener('input', () => {
        const inputTarget = document.getElementById(range.id.replace('_range', ''));
        if (inputTarget) {
          inputTarget.value = range.value;
        }
        this.debouncedPredict();
      });
    });

    const calculateBtn = document.getElementById('btn-run-prediction');
    if (calculateBtn) {
      calculateBtn.addEventListener('click', () => this.runPrediction());
    }
  },

  bindPresets() {
    const presetSelect = document.getElementById('preset-selector');
    if (presetSelect) {
      presetSelect.addEventListener('change', (e) => {
        this.loadPreset(e.target.value);
      });
    }

    const presetButtons = document.querySelectorAll('[data-preset]');
    presetButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const presetKey = e.currentTarget.getAttribute('data-preset');
        if (presetSelect) presetSelect.value = presetKey;
        this.loadPreset(presetKey);
      });
    });
  },

  loadPreset(presetKey) {
    let payload = {};
    if (presetKey === 'prime') {
      payload = {
        NAME_CONTRACT_TYPE: 'Cash loans',
        CODE_GENDER: 'F',
        CNT_CHILDREN: 0,
        AMT_INCOME_TOTAL: 270000,
        AMT_CREDIT: 600000,
        AMT_ANNUITY: 28000,
        AMT_GOODS_PRICE: 540000,
        NAME_INCOME_TYPE: 'Commercial associate',
        NAME_EDUCATION_TYPE: 'Higher education',
        NAME_FAMILY_STATUS: 'Married',
        NAME_HOUSING_TYPE: 'House / apartment',
        DAYS_BIRTH: -18250, // 50 years old
        DAYS_EMPLOYED: -3650, // 10 years employed
        DAYS_REGISTRATION: -4000,
        DAYS_ID_PUBLISH: -2500,
        OWN_CAR_AGE: 3,
        OCCUPATION_TYPE: 'Managers',
        CNT_FAM_MEMBERS: 2,
        REGION_RATING_CLIENT: 1,
        ORGANIZATION_TYPE: 'Business Entity Type 3',
        EXT_SOURCE_1: 0.68,
        EXT_SOURCE_2: 0.72,
        EXT_SOURCE_3: 0.75,
        DAYS_LAST_PHONE_CHANGE: -1200,
        AMT_REQ_CREDIT_BUREAU_HOUR: 0,
        AMT_REQ_CREDIT_BUREAU_MON: 0,
        AMT_REQ_CREDIT_BUREAU_QRT: 0,
        AMT_REQ_CREDIT_BUREAU_YEAR: 1
      };
    } else if (presetKey === 'moderate') {
      payload = {
        NAME_CONTRACT_TYPE: 'Cash loans',
        CODE_GENDER: 'M',
        CNT_CHILDREN: 1,
        AMT_INCOME_TOTAL: 157500,
        AMT_CREDIT: 520000,
        AMT_ANNUITY: 26000,
        AMT_GOODS_PRICE: 450000,
        NAME_INCOME_TYPE: 'Working',
        NAME_EDUCATION_TYPE: 'Secondary / secondary special',
        NAME_FAMILY_STATUS: 'Married',
        NAME_HOUSING_TYPE: 'House / apartment',
        DAYS_BIRTH: -13500, // 37 years old
        DAYS_EMPLOYED: -1460, // 4 years employed
        DAYS_REGISTRATION: -2800,
        DAYS_ID_PUBLISH: -1800,
        OWN_CAR_AGE: 8,
        OCCUPATION_TYPE: 'Laborers',
        CNT_FAM_MEMBERS: 3,
        REGION_RATING_CLIENT: 2,
        ORGANIZATION_TYPE: 'Business Entity Type 3',
        EXT_SOURCE_1: 0.45,
        EXT_SOURCE_2: 0.52,
        EXT_SOURCE_3: 0.48,
        DAYS_LAST_PHONE_CHANGE: -650,
        AMT_REQ_CREDIT_BUREAU_HOUR: 0,
        AMT_REQ_CREDIT_BUREAU_MON: 1,
        AMT_REQ_CREDIT_BUREAU_QRT: 1,
        AMT_REQ_CREDIT_BUREAU_YEAR: 2
      };
    } else if (presetKey === 'high_risk') {
      payload = {
        NAME_CONTRACT_TYPE: 'Cash loans',
        CODE_GENDER: 'M',
        CNT_CHILDREN: 2,
        AMT_INCOME_TOTAL: 90000,
        AMT_CREDIT: 480000,
        AMT_ANNUITY: 32000,
        AMT_GOODS_PRICE: 420000,
        NAME_INCOME_TYPE: 'Working',
        NAME_EDUCATION_TYPE: 'Lower secondary',
        NAME_FAMILY_STATUS: 'Single / not married',
        NAME_HOUSING_TYPE: 'Rented apartment',
        DAYS_BIRTH: -8400, // 23 years old
        DAYS_EMPLOYED: -200, // ~6 months employed
        DAYS_REGISTRATION: -500,
        DAYS_ID_PUBLISH: -350,
        OWN_CAR_AGE: 18,
        OCCUPATION_TYPE: 'Laborers',
        CNT_FAM_MEMBERS: 3,
        REGION_RATING_CLIENT: 3,
        ORGANIZATION_TYPE: 'Construction',
        EXT_SOURCE_1: 0.22,
        EXT_SOURCE_2: 0.28,
        EXT_SOURCE_3: 0.19,
        DAYS_LAST_PHONE_CHANGE: -45,
        AMT_REQ_CREDIT_BUREAU_HOUR: 1,
        AMT_REQ_CREDIT_BUREAU_MON: 3,
        AMT_REQ_CREDIT_BUREAU_QRT: 4,
        AMT_REQ_CREDIT_BUREAU_YEAR: 7
      };
    }

    this.populateForm(payload);
    this.runPrediction();
  },

  populateForm(data) {
    Object.keys(data).forEach(key => {
      const el = document.getElementById(key);
      if (el) {
        el.value = data[key];
        const rangeEl = document.getElementById(`${key}_range`);
        if (rangeEl) rangeEl.value = data[key];
      }
    });

    if (data.DAYS_BIRTH) {
      const ageInput = document.getElementById('calc_age_years');
      if (ageInput) ageInput.value = Math.round(-data.DAYS_BIRTH / 365.25);
    }
    if (data.DAYS_EMPLOYED) {
      const empInput = document.getElementById('calc_employed_years');
      if (empInput) empInput.value = Math.max(0, Math.round(-data.DAYS_EMPLOYED / 365.25 * 10) / 10);
    }
  },

  getFormData() {
    const data = {};
    const inputs = document.querySelectorAll('.calc-input');
    inputs.forEach(input => {
      const val = input.value;
      if (val === '' || val === null) {
        data[input.id] = null;
      } else if (!isNaN(val) && input.tagName !== 'SELECT') {
        data[input.id] = parseFloat(val);
      } else {
        data[input.id] = val;
      }
    });

    const ageEl = document.getElementById('calc_age_years');
    if (ageEl && ageEl.value) {
      data['DAYS_BIRTH'] = -Math.round(parseFloat(ageEl.value) * 365.25);
    }

    const empEl = document.getElementById('calc_employed_years');
    if (empEl && empEl.value) {
      data['DAYS_EMPLOYED'] = -Math.round(parseFloat(empEl.value) * 365.25);
    }

    return data;
  },

  debouncedPredict() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.runPrediction();
    }, 250);
  },

  async runPrediction() {
    const payload = this.getFormData();
    try {
      const resp = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error('Prediction API error');
      const res = await resp.json();
      this.updateUI(res);
    } catch (err) {
      console.error('Prediction error:', err);
    }
  },

  updateUI(result) {
    const probPct = result.probability_percent;
    const probEl = document.getElementById('score-prob-value');
    if (probEl) probEl.textContent = `${probPct.toFixed(1)}%`;

    // Update simple horizontal progress bar
    const barFill = document.getElementById('risk-progress-bar');
    if (barFill) {
      barFill.style.width = `${Math.min(probPct, 100)}%`;
      if (probPct < 8) {
        barFill.style.backgroundColor = '#10b981'; // Green
      } else if (probPct < 15) {
        barFill.style.backgroundColor = '#f59e0b'; // Amber
      } else if (probPct < 25) {
        barFill.style.backgroundColor = '#f97316'; // Orange
      } else {
        barFill.style.backgroundColor = '#ef4444'; // Red
      }
    }

    // Update Decision Badge
    const badgeEl = document.getElementById('decision-badge');
    const recTextEl = document.getElementById('decision-recommendation');
    const descEl = document.getElementById('decision-description');

    if (badgeEl) {
      let badgeClass = 'badge-low';
      if (probPct >= 25) badgeClass = 'badge-high';
      else if (probPct >= 15) badgeClass = 'badge-elevated';
      else if (probPct >= 8) badgeClass = 'badge-moderate';

      badgeEl.className = `inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${badgeClass}`;
      badgeEl.textContent = result.risk_tier;
    }

    if (recTextEl) recTextEl.textContent = result.recommendation;
    if (descEl) descEl.textContent = result.recommendation_description;

    // Financial Indicators
    const f = result.financial_summary || {};
    this.setText('metric-dti', f.annuity_income_ratio_pct ? `${f.annuity_income_ratio_pct}%` : '—');
    this.setText('metric-credit-income', f.credit_income_ratio ? `${f.credit_income_ratio}x` : '—');
    this.setText('metric-credit-term', f.credit_term_months ? `${f.credit_term_months} mos` : '—');
    this.setText('metric-ext-mean', f.external_rating_mean ? f.external_rating_mean.toFixed(3) : '—');

    // Render Factors
    this.renderFactors('positive-factors-list', result.factors.strengths, 'text-emerald-700', 'bg-emerald-50', 'border-emerald-200');
    this.renderFactors('risk-factors-list', result.factors.risk_drivers, 'text-amber-800', 'bg-amber-50', 'border-amber-200');
  },

  setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  },

  renderFactors(containerId, factors, textColor, bgColor, borderColor) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!factors || factors.length === 0) {
      container.innerHTML = `<li class="text-xs text-gray-500 italic">No significant factors noted</li>`;
      return;
    }

    factors.forEach(item => {
      const li = document.createElement('li');
      li.className = `p-2.5 rounded border ${bgColor} ${borderColor} text-xs flex flex-col gap-0.5`;
      li.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="font-medium ${textColor}">${item.factor}</span>
          <span class="font-mono text-gray-700 font-semibold">${item.value}</span>
        </div>
        <div class="text-[11px] text-gray-600">${item.impact}</div>
      `;
      container.appendChild(li);
    });
  }
};
