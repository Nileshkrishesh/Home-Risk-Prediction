# Home Credit Default Risk - Frontend Guide

A clean, lightweight web interface for evaluating models and assessing applicant default risk for the Home Credit Default Risk competition (GCI Global 2025 / Kaggle).

---

## Quick Start

### 1. Web Application (Recommended)
Double-click `run_frontend.bat` or run:
```bash
python run_frontend.py
```
Opens in your browser at: **`http://localhost:5000`**

### 2. Streamlit Dashboard
Double-click `run_streamlit.bat` or run:
```bash
streamlit run streamlit_app.py
```
Opens in your browser at: **`http://localhost:8501`**

---

## Interface Layout

The interface is divided into four clean sections:

1. **Risk Calculator**:
   - Fill in loan details (amount, annuity, income, goods price) and applicant characteristics (age, employment tenure, education, car age).
   - Adjust external credit bureau scores (`EXT_SOURCE_1`, `EXT_SOURCE_2`, `EXT_SOURCE_3`).
   - Choose from quick sample profiles (Prime, Average, High Risk) or enter custom values.
   - Outputs:
     - Predicted default probability percentage.
     - Progress bar showing risk relative to market averages.
     - Decision guideline (Approved, Standard Terms, Manual Review, or Declined).
     - Financial indicators (Debt-to-Income ratio, Credit-to-Income, Term).
     - Positive factors and risk indicators breakdown.

2. **Applicant Lookup**:
   - Enter any applicant ID (`SK_ID_CURR`) from `input/test.csv` (e.g. `171202`, `171203`, `171204`).
   - Displays applicant attributes and cross-checks predictions against all generated submission files (`submissionFinal.csv`, `submission.csv`, `Submission(1).csv`, and the live model).
   - "Load Into Calculator" button allows quick parameter adjustments.

3. **Submissions & Benchmarks**:
   - Table of all submission files in `output/` with applicant counts, mean predicted risk, median, and 90th percentile.
   - Model validation ROC-AUC benchmark comparison from the tutorial notebooks (Logistic Regression, Random Forest, AdaBoost, XGBoost, LightGBM, CatBoost, and Blended Ensembles).

4. **Data Dictionary**:
   - Searchable reference table of all 34 columns with descriptions from `HomeCredit_columns_description.xlsx`.

---

## Backend API Endpoints

The Flask server provides REST endpoints:

- `POST /api/predict`: Takes applicant JSON, returns predicted probability, risk tier, ratios, and key factors.
- `GET /api/applicant/<sk_id_curr>`: Looks up test applicant and cross-references submission predictions.
- `GET /api/submissions`: Summarizes submission files in `output/`.
- `GET /api/metadata`: Returns model training metadata and validation benchmarks.
- `GET /api/columns`: Returns dictionary descriptions.
- `GET /api/download-submission?name=<filename>`: Direct CSV download.
