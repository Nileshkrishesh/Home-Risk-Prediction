import os
import sys

# Prevent matplotlib caching and memory overhead on Windows Python 3.13
os.environ.setdefault('MPLCONFIGDIR', os.environ.get('TEMP', os.path.expanduser('~')))
if 'matplotlib' not in sys.modules:
    sys.modules['matplotlib'] = None

import json
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, List

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BASE_DIR, "models")

class RiskPredictor:
    def __init__(self):
        self.model_path = os.path.join(MODELS_DIR, "lgbm_default_risk.joblib")
        self.metadata_path = os.path.join(MODELS_DIR, "model_metadata.json")
        self.model = None
        self.metadata = {}
        self.load()

    def load(self):
        if os.path.exists(self.model_path):
            self.model = joblib.load(self.model_path)
        if os.path.exists(self.metadata_path):
            with open(self.metadata_path, "r", encoding="utf-8") as f:
                self.metadata = json.load(f)

    def engineer_row(self, row_dict: Dict[str, Any]) -> pd.DataFrame:
        df = pd.DataFrame([row_dict])
        
        # Numeric conversions
        for col in df.columns:
            if col in self.metadata.get("categorical_columns", []):
                continue
            try:
                df[col] = pd.to_numeric(df[col])
            except Exception:
                pass
                
        # Outlier handling
        if "OWN_CAR_AGE" in df.columns and pd.notna(df["OWN_CAR_AGE"].iloc[0]):
            val = float(df["OWN_CAR_AGE"].iloc[0])
            if val >= 60:
                df.loc[0, "OWN_CAR_AGE"] = np.nan
                df.loc[0, "OWN_CAR_AGE_GROUP"] = np.nan
            else:
                df.loc[0, "OWN_CAR_AGE_GROUP"] = val // 10
        else:
            df["OWN_CAR_AGE_GROUP"] = np.nan

        if "CNT_CHILDREN" in df.columns and pd.notna(df["CNT_CHILDREN"].iloc[0]):
            if float(df["CNT_CHILDREN"].iloc[0]) >= 6:
                df.loc[0, "CNT_CHILDREN"] = np.nan

        # Financial ratios
        income = float(df["AMT_INCOME_TOTAL"].iloc[0]) if "AMT_INCOME_TOTAL" in df and pd.notna(df["AMT_INCOME_TOTAL"].iloc[0]) else np.nan
        credit = float(df["AMT_CREDIT"].iloc[0]) if "AMT_CREDIT" in df and pd.notna(df["AMT_CREDIT"].iloc[0]) else np.nan
        annuity = float(df["AMT_ANNUITY"].iloc[0]) if "AMT_ANNUITY" in df and pd.notna(df["AMT_ANNUITY"].iloc[0]) else np.nan
        goods = float(df["AMT_GOODS_PRICE"].iloc[0]) if "AMT_GOODS_PRICE" in df and pd.notna(df["AMT_GOODS_PRICE"].iloc[0]) else np.nan

        df["LOG_AMT_INCOME_TOTAL"] = np.log1p(income) if pd.notna(income) and income > 0 else np.nan
        
        ext_cols = ["EXT_SOURCE_1", "EXT_SOURCE_2", "EXT_SOURCE_3"]
        ext_vals = [float(df[c].iloc[0]) for c in ext_cols if c in df and pd.notna(df[c].iloc[0])]
        df["EXT_MEAN"] = np.mean(ext_vals) if ext_vals else np.nan
        df["EXT_STD"] = np.std(ext_vals) if len(ext_vals) > 1 else 0.0

        df["ANNUITY_INCOME_RATIO"] = (annuity / income) if pd.notna(annuity) and pd.notna(income) and income > 0 else np.nan
        df["CREDIT_TERM"] = (credit / annuity) if pd.notna(credit) and pd.notna(annuity) and annuity > 0 else np.nan
        df["CREDIT_INCOME_RATIO"] = (credit / income) if pd.notna(credit) and pd.notna(income) and income > 0 else np.nan
        df["GOODS_CREDIT_RATIO"] = (goods / credit) if pd.notna(goods) and pd.notna(credit) and credit > 0 else np.nan

        if "DAYS_BIRTH" in df and pd.notna(df["DAYS_BIRTH"].iloc[0]):
            df["AGE_YEARS"] = -float(df["DAYS_BIRTH"].iloc[0]) / 365.25
        else:
            df["AGE_YEARS"] = np.nan

        if "DAYS_EMPLOYED" in df and pd.notna(df["DAYS_EMPLOYED"].iloc[0]):
            emp = -float(df["DAYS_EMPLOYED"].iloc[0]) / 365.25
            df["EMPLOYED_YEARS"] = emp if emp >= 0 else np.nan
            if pd.notna(df["AGE_YEARS"].iloc[0]) and df["AGE_YEARS"].iloc[0] > 0 and pd.notna(df["EMPLOYED_YEARS"].iloc[0]):
                df["EMPLOYED_TO_AGE_RATIO"] = df["EMPLOYED_YEARS"].iloc[0] / df["AGE_YEARS"].iloc[0]
            else:
                df["EMPLOYED_TO_AGE_RATIO"] = np.nan
        else:
            df["EMPLOYED_YEARS"] = np.nan
            df["EMPLOYED_TO_AGE_RATIO"] = np.nan

        bureau_cols = ["AMT_REQ_CREDIT_BUREAU_HOUR", "AMT_REQ_CREDIT_BUREAU_MON", "AMT_REQ_CREDIT_BUREAU_QRT", "AMT_REQ_CREDIT_BUREAU_YEAR"]
        b_sum = sum(float(df[c].iloc[0]) for c in bureau_cols if c in df and pd.notna(df[c].iloc[0]))
        df["BUREAU_ENQUIRIES_TOTAL"] = b_sum

        # Categoricals
        for cat_col in self.metadata.get("categorical_columns", []):
            if cat_col in df:
                df[cat_col] = df[cat_col].astype("category")

        feature_names = self.metadata.get("feature_names", [])
        for f in feature_names:
            if f not in df.columns:
                df[f] = np.nan
                
        return df[feature_names]

    def predict_single(self, applicant_data: Dict[str, Any]) -> Dict[str, Any]:
        if self.model is None:
            self.load()
            if self.model is None:
                raise RuntimeError("Model file not loaded.")

        processed_row = self.engineer_row(applicant_data)
        prob = float(self.model.predict_proba(processed_row)[0, 1])
        prob_pct = round(prob * 100, 2)

        if prob < 0.08:
            tier = "Low Risk"
            badge = "low"
            recommendation = "Approved - Prime Terms"
            rec_desc = "Low default risk. Eligible for standard or prime rates."
        elif prob < 0.15:
            tier = "Moderate Risk"
            badge = "moderate"
            recommendation = "Approved - Standard Terms"
            rec_desc = "Moderate default risk aligned with market averages."
        elif prob < 0.25:
            tier = "Elevated Risk"
            badge = "elevated"
            recommendation = "Manual Review / Conditional"
            rec_desc = "Above-average default indicator. Requires secondary review or co-signer."
        else:
            tier = "High Risk"
            badge = "high"
            recommendation = "Declined"
            rec_desc = "High statistical likelihood of default."

        factors = self._compute_explanations(applicant_data, processed_row)

        financial_summary = {
            "credit_income_ratio": round(float(processed_row["CREDIT_INCOME_RATIO"].iloc[0]), 2) if pd.notna(processed_row["CREDIT_INCOME_RATIO"].iloc[0]) else None,
            "annuity_income_ratio_pct": round(float(processed_row["ANNUITY_INCOME_RATIO"].iloc[0]) * 100, 1) if pd.notna(processed_row["ANNUITY_INCOME_RATIO"].iloc[0]) else None,
            "credit_term_months": round(float(processed_row["CREDIT_TERM"].iloc[0]), 1) if pd.notna(processed_row["CREDIT_TERM"].iloc[0]) else None,
            "external_rating_mean": round(float(processed_row["EXT_MEAN"].iloc[0]), 3) if pd.notna(processed_row["EXT_MEAN"].iloc[0]) else None,
            "applicant_age_years": round(float(processed_row["AGE_YEARS"].iloc[0]), 1) if pd.notna(processed_row["AGE_YEARS"].iloc[0]) else None,
            "employment_years": round(float(processed_row["EMPLOYED_YEARS"].iloc[0]), 1) if pd.notna(processed_row["EMPLOYED_YEARS"].iloc[0]) else None,
        }

        return {
            "probability": prob,
            "probability_percent": prob_pct,
            "risk_tier": tier,
            "risk_badge": badge,
            "recommendation": recommendation,
            "recommendation_description": rec_desc,
            "financial_summary": financial_summary,
            "factors": factors
        }

    def _compute_explanations(self, raw_input: Dict[str, Any], processed_df: pd.DataFrame) -> Dict[str, List[Dict[str, Any]]]:
        positive_factors = []
        risk_drivers = []

        ext_mean = processed_df["EXT_MEAN"].iloc[0]
        if pd.notna(ext_mean):
            if ext_mean > 0.55:
                positive_factors.append({
                    "factor": "External Bureau Rating",
                    "value": f"{ext_mean:.3f}",
                    "impact": "Score is well above the median for default cases (0.40)"
                })
            elif ext_mean < 0.40:
                risk_drivers.append({
                    "factor": "Low External Bureau Rating",
                    "value": f"{ext_mean:.3f}",
                    "impact": "Score falls below the safe borrower benchmark (0.50+)"
                })

        dti = processed_df["ANNUITY_INCOME_RATIO"].iloc[0]
        if pd.notna(dti):
            if dti > 0.25:
                risk_drivers.append({
                    "factor": "High Debt Burden (Annuity / Income)",
                    "value": f"{dti*100:.1f}%",
                    "impact": "Monthly payment represents an elevated share of income"
                })
            elif dti < 0.15:
                positive_factors.append({
                    "factor": "Comfortable Payment Coverage",
                    "value": f"{dti*100:.1f}%",
                    "impact": "Loan annuity is under 15% of annual income"
                })

        emp_years = processed_df["EMPLOYED_YEARS"].iloc[0]
        if pd.notna(emp_years):
            if emp_years >= 5:
                positive_factors.append({
                    "factor": "Employment Stability",
                    "value": f"{emp_years:.1f} years",
                    "impact": "Long tenure at current job (> 5 years)"
                })
            elif emp_years < 1:
                risk_drivers.append({
                    "factor": "Short Employment Tenure",
                    "value": f"{emp_years:.1f} years",
                    "impact": "Under 1 year in current role"
                })

        age = processed_df["AGE_YEARS"].iloc[0]
        if pd.notna(age):
            if age >= 45:
                positive_factors.append({
                    "factor": "Applicant Age Bracket",
                    "value": f"{age:.1f} yrs",
                    "impact": "Borrowers aged 45+ historically exhibit lower default rates"
                })
            elif age < 28:
                risk_drivers.append({
                    "factor": "Early Career Borrower",
                    "value": f"{age:.1f} yrs",
                    "impact": "Borrowers under 28 show higher statistical default rates"
                })

        b_enquiries = processed_df["BUREAU_ENQUIRIES_TOTAL"].iloc[0]
        if pd.notna(b_enquiries):
            if b_enquiries > 5:
                risk_drivers.append({
                    "factor": "Recent Credit Inquiries",
                    "value": f"{int(b_enquiries)} checks",
                    "impact": "Multiple credit bureau checks over the past year"
                })
            elif b_enquiries <= 1:
                positive_factors.append({
                    "factor": "Minimal Credit Inquiries",
                    "value": f"{int(b_enquiries)} checks",
                    "impact": "Clean inquiry history over recent quarters"
                })

        if not positive_factors:
            positive_factors.append({
                "factor": "Standard Application Parameters",
                "value": "Eligible",
                "impact": "Meets baseline criteria"
            })
        if not risk_drivers:
            risk_drivers.append({
                "factor": "No Severe Negative Flags",
                "value": "Clean",
                "impact": "No critical risk triggers detected"
            })

        return {
            "strengths": positive_factors,
            "risk_drivers": risk_drivers
        }

predictor = RiskPredictor()
