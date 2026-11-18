# Home Credit Default Risk - GCI Global 2025

A clean, modern web application for evaluating machine learning models and assessing borrower default risk for the **GCI Global 2025** In-Class Competition (Home Credit Default Risk / Kaggle).

---

## Quick Start

### Launch the Web App
Run from terminal:
```bash
python run_frontend.py
```
Or double-click [**`run_frontend.bat`**](file:///d:/Users/Nilesh%20gupta/Downloads/competition-20260508T170036Z-3-001-20261118T193652Z-1-001/competition-20260508T170036Z-3-001/competition/run_frontend.bat).

The dashboard opens automatically in your browser at: **`http://localhost:5000`**

---

## Features

1. **GCI Global 2025 Competition Tracking**:
   - Compares real-time predictions against generated competition submissions in `output/` (`submissionFinal.csv`, `submission.csv`, `Submission(1).csv`, `submissi0n.csv`).
   - Integrated LightGBM baseline model achieving **Validation ROC-AUC: 0.7554**.

2. **Test Applicant Lookup**:
   - Enter any `SK_ID_CURR` from `input/test.csv` (e.g. `171202`, `171203`, `171204`).
   - Automatically populates the applicant's test data and shows cross-model predictions side-by-side.

3. **Underwriting Risk Assessment**:
   - Key loan & borrower inputs (Income, Credit Amount, Annuity, Age, Employment, Education, External Bureau Rating).
   - Real-time default probability percentage and status badge (`Low Risk`, `Moderate Risk`, `High Risk`).
   - Key financial indicators (Debt-to-Income / DTI, Credit-to-Income, Loan Term).
   - Predictive decision drivers.

4. **Competition Submissions**:
   - Table of generated submission files with applicant counts, mean default probability, median, and direct download links.
