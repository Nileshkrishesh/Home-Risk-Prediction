/**
 * app.js - Main Controller for Home Credit Default Risk Dashboard
 */

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

const App = {
  metadata: null,
  submissionsData: null,
  columnsData: [],

  async init() {
    this.setupTabs();
    PredictorModule.init();
    await this.fetchInitialData();
    this.setupApplicantSearch();
    this.setupDictionarySearch();
  },

  setupTabs() {
    const tabButtons = document.querySelectorAll('[data-tab-target]');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-tab-target');

        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(section => {
          section.classList.add('hidden');
        });
        const activeSection = document.getElementById(targetId);
        if (activeSection) {
          activeSection.classList.remove('hidden');
        }
      });
    });
  },

  async fetchInitialData() {
    try {
      // 1. Fetch Metadata
      const metaResp = await fetch('/api/metadata');
      if (metaResp.ok) {
        this.metadata = await metaResp.json();
        this.renderModelBenchmarks(this.metadata.benchmarks);
        const info = this.metadata.model_info;
        const valAucEl = document.getElementById('header-val-auc');
        if (valAucEl && info.val_auc) {
          valAucEl.textContent = `LightGBM (ROC-AUC: ${info.val_auc})`;
        }
      }

      // 2. Fetch Submissions
      const subResp = await fetch('/api/submissions');
      if (subResp.ok) {
        this.submissionsData = await subResp.json();
        this.renderSubmissionsTable(this.submissionsData.submissions);
      }

      // 3. Fetch Column Descriptions
      const colResp = await fetch('/api/columns');
      if (colResp.ok) {
        const colJson = await colResp.json();
        this.columnsData = colJson.columns || [];
        this.renderDataDictionary(this.columnsData);
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  },

  renderModelBenchmarks(benchmarks) {
    const tbody = document.getElementById('benchmarks-table-body');
    if (!tbody || !benchmarks) return;
    tbody.innerHTML = '';

    benchmarks.forEach(item => {
      const isTop = item.model.includes('Current App') || item.model.includes('Ensemble');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="font-medium ${isTop ? 'text-blue-900 font-semibold' : 'text-gray-900'}">
          ${item.model}
          ${item.model.includes('Current App') ? '<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-100 text-blue-800">Current</span>' : ''}
        </td>
        <td class="font-mono text-sm ${isTop ? 'text-emerald-700 font-bold' : 'text-gray-700'}">
          ${item.val_auc.toFixed(4)}
        </td>
        <td class="text-xs text-gray-500">${item.notes}</td>
      `;
      tbody.appendChild(tr);
    });
  },

  renderSubmissionsTable(submissions) {
    const tbody = document.getElementById('submissions-table-body');
    if (!tbody || !submissions) return;
    tbody.innerHTML = '';

    Object.keys(submissions).forEach(key => {
      const sub = submissions[key];
      const isFinal = sub.filename === 'submissionFinal.csv';
      const tr = document.createElement('tr');
      if (isFinal) tr.className = 'bg-blue-50/50';

      tr.innerHTML = `
        <td class="font-medium text-gray-900">
          ${sub.filename}
          ${isFinal ? '<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-100 text-blue-800">Final</span>' : ''}
        </td>
        <td class="text-xs text-gray-600">${sub.rows.toLocaleString()}</td>
        <td class="font-mono text-sm font-semibold text-gray-800">${sub.mean_pct}%</td>
        <td class="font-mono text-sm text-gray-700">${sub.median_pct}%</td>
        <td class="font-mono text-sm text-gray-700">${sub.p90_pct}%</td>
        <td>
          <a href="/api/download-submission?name=${sub.filename}" class="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 font-medium">
            Download CSV &rarr;
          </a>
        </td>
      `;
      tbody.appendChild(tr);
    });
  },

  setupApplicantSearch() {
    const searchBtn = document.getElementById('btn-applicant-search');
    const searchInput = document.getElementById('input-applicant-id');
    const resultBox = document.getElementById('applicant-result-card');

    const executeSearch = async () => {
      const id = searchInput.value.trim();
      if (!id) return;
      try {
        searchBtn.disabled = true;
        searchBtn.textContent = 'Searching...';
        const resp = await fetch(`/api/applicant/${id}`);
        if (!resp.ok) {
          alert(`Applicant ID ${id} was not found in input/test.csv.`);
          return;
        }
        const data = await resp.json();
        this.renderApplicantResult(data);
        resultBox.classList.remove('hidden');
      } catch (err) {
        console.error(err);
        alert('Failed to lookup applicant.');
      } finally {
        searchBtn.disabled = false;
        searchBtn.textContent = 'Lookup';
      }
    };

    if (searchBtn) searchBtn.addEventListener('click', executeSearch);
    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') executeSearch();
      });
    }

    document.querySelectorAll('[data-applicant-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-applicant-id');
        searchInput.value = id;
        executeSearch();
      });
    });
  },

  renderApplicantResult(appData) {
    const d = appData.data;
    const preds = appData.submission_predictions;
    const live = appData.live_prediction;

    document.getElementById('app-res-id').textContent = appData.sk_id_curr;

    const badgeEl = document.getElementById('app-live-badge');
    let badgeClass = 'badge-low';
    if (live.probability_percent >= 25) badgeClass = 'badge-high';
    else if (live.probability_percent >= 15) badgeClass = 'badge-elevated';
    else if (live.probability_percent >= 8) badgeClass = 'badge-moderate';

    badgeEl.className = `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeClass}`;
    badgeEl.textContent = `${live.risk_tier} (${live.probability_percent.toFixed(1)}%)`;

    // Attributes
    document.getElementById('app-res-income').textContent = `$${Number(d.AMT_INCOME_TOTAL).toLocaleString()}`;
    document.getElementById('app-res-credit').textContent = `$${Number(d.AMT_CREDIT).toLocaleString()}`;
    document.getElementById('app-res-annuity').textContent = `$${Number(d.AMT_ANNUITY).toLocaleString()}`;
    document.getElementById('app-res-contract').textContent = d.NAME_CONTRACT_TYPE;
    document.getElementById('app-res-education').textContent = d.NAME_EDUCATION_TYPE;
    document.getElementById('app-res-gender').textContent = d.CODE_GENDER === 'F' ? 'Female' : 'Male';
    document.getElementById('app-res-age').textContent = `${Math.round(-d.DAYS_BIRTH / 365.25)} yrs`;
    document.getElementById('app-res-ext-mean').textContent = live.financial_summary.external_rating_mean ? live.financial_summary.external_rating_mean.toFixed(3) : 'N/A';

    // Model comparison rows
    const tbody = document.getElementById('app-predictions-tbody');
    tbody.innerHTML = '';

    // Active Model
    tbody.innerHTML += `
      <tr class="bg-blue-50/50">
        <td class="font-medium text-blue-900">Current LightGBM Model</td>
        <td class="font-mono font-bold text-blue-900">${live.probability_percent.toFixed(1)}%</td>
        <td class="text-xs text-blue-700">Real-time inference</td>
      </tr>
    `;

    // Submission files
    Object.keys(preds).forEach(subFile => {
      tbody.innerHTML += `
        <tr>
          <td class="font-medium text-gray-800">${subFile}</td>
          <td class="font-mono font-semibold text-gray-800">${preds[subFile]}%</td>
          <td class="text-xs text-gray-500">Submission file output</td>
        </tr>
      `;
    });

    const loadBtn = document.getElementById('btn-load-into-calculator');
    loadBtn.onclick = () => {
      PredictorModule.populateForm(d);
      PredictorModule.runPrediction();
      document.querySelector('[data-tab-target="tab-calculator"]').click();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  },

  setupDictionarySearch() {
    const searchInput = document.getElementById('dict-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtered = this.columnsData.filter(col =>
          col.column.toLowerCase().includes(query) || col.description.toLowerCase().includes(query)
        );
        this.renderDataDictionary(filtered);
      });
    }
  },

  renderDataDictionary(columns) {
    const tbody = document.getElementById('dict-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (columns.length === 0) {
      tbody.innerHTML = `<tr><td colspan="2" class="py-6 text-center text-gray-500 text-sm">No matching columns found</td></tr>`;
      return;
    }

    columns.forEach(col => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="font-mono text-xs font-semibold text-gray-900 whitespace-nowrap">${col.column}</td>
        <td class="text-xs text-gray-600 leading-relaxed">${col.description}</td>
      `;
      tbody.appendChild(tr);
    });
  }
};
