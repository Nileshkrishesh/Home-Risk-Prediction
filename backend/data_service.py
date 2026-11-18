import os
import json
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT_DIR = os.path.join(BASE_DIR, "input")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
CACHE_FILE = os.path.join(BASE_DIR, "models", "eda_cache.json")

class DataService:
    def __init__(self):
        self._test_index = None
        self._test_df = None
        self._submissions_cache = None

    def get_column_descriptions(self) -> List[Dict[str, str]]:
        excel_path = os.path.join(BASE_DIR, "HomeCredit_columns_description.xlsx")
        if os.path.exists(excel_path):
            df = pd.read_excel(excel_path)
            return [{"column": str(row["Row"]), "description": str(row["Description"])} for _, row in df.iterrows()]
        return []

    def get_eda_stats(self) -> Dict[str, Any]:
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass

        train_path = os.path.join(INPUT_DIR, "train.csv")
        if not os.path.exists(train_path):
            return {}

        cols_to_load = [
            "TARGET", "CODE_GENDER", "NAME_EDUCATION_TYPE", "NAME_INCOME_TYPE", 
            "NAME_CONTRACT_TYPE", "DAYS_BIRTH", "AMT_INCOME_TOTAL", "AMT_CREDIT", 
            "AMT_ANNUITY", "EXT_SOURCE_1", "EXT_SOURCE_2", "EXT_SOURCE_3"
        ]
        df = pd.read_csv(train_path, usecols=cols_to_load)
        total_rows = len(df)
        defaulters = int((df["TARGET"] == 1).sum())
        repayers = int((df["TARGET"] == 0).sum())
        default_rate = round(float(defaulters / total_rows) * 100, 2)

        def calc_rates(col):
            grouped = df.groupby(col)["TARGET"].agg(["count", "mean"]).reset_index()
            grouped = grouped[grouped["count"] >= 50].sort_values("mean", ascending=False)
            return [
                {
                    "category": str(r[col]),
                    "count": int(r["count"]),
                    "default_rate": round(float(r["mean"]) * 100, 2)
                }
                for _, r in grouped.iterrows()
            ]

        by_education = calc_rates("NAME_EDUCATION_TYPE")
        by_income_type = calc_rates("NAME_INCOME_TYPE")
        by_gender = calc_rates("CODE_GENDER")
        by_contract = calc_rates("NAME_CONTRACT_TYPE")

        # Age group analysis
        df["AGE_YEARS"] = (-df["DAYS_BIRTH"] / 365.25).round().astype(int)
        df["AGE_GROUP"] = pd.cut(df["AGE_YEARS"], bins=[18, 30, 40, 50, 60, 100], labels=["20-29", "30-39", "40-49", "50-59", "60+"])
        by_age = calc_rates("AGE_GROUP")

        # Distribution comparison for EXT_SOURCE_2
        ext2_clean = df[["TARGET", "EXT_SOURCE_2"]].dropna()
        bins = np.linspace(0, 1, 11)
        ext2_repayers, _ = np.histogram(ext2_clean[ext2_clean["TARGET"] == 0]["EXT_SOURCE_2"], bins=bins)
        ext2_defaulters, _ = np.histogram(ext2_clean[ext2_clean["TARGET"] == 1]["EXT_SOURCE_2"], bins=bins)
        
        # Normalize to percentage
        ext2_repayers_pct = (ext2_repayers / len(ext2_clean[ext2_clean["TARGET"] == 0]) * 100).round(1).tolist()
        ext2_defaulters_pct = (ext2_defaulters / len(ext2_clean[ext2_clean["TARGET"] == 1]) * 100).round(1).tolist()
        bin_labels = [f"{bins[i]:.1f}-{bins[i+1]:.1f}" for i in range(len(bins)-1)]

        result = {
            "summary": {
                "total_applicants": total_rows,
                "defaulters": defaulters,
                "repayers": repayers,
                "overall_default_rate_pct": default_rate
            },
            "by_education": by_education,
            "by_income_type": by_income_type,
            "by_gender": by_gender,
            "by_contract": by_contract,
            "by_age": by_age,
            "ext2_distribution": {
                "labels": bin_labels,
                "repayers": ext2_repayers_pct,
                "defaulters": ext2_defaulters_pct
            }
        }

        try:
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2)
        except Exception:
            pass

        return result

    def get_submissions_comparison(self) -> Dict[str, Any]:
        if self._submissions_cache is not None:
            return self._submissions_cache

        files = [
            "submissionFinal.csv",
            "submission.csv",
            "Submission(1).csv",
            "submissi0n.csv"
        ]
        
        subs_data = {}
        bins = [0.0, 0.05, 0.10, 0.15, 0.20, 0.30, 0.50, 1.0]
        bin_labels = ["0-5%", "5-10%", "10-15%", "15-20%", "20-30%", "30-50%", "50%+"]
        
        dfs = {}
        for f in files:
            fp = os.path.join(OUTPUT_DIR, f)
            if os.path.exists(fp):
                df = pd.read_csv(fp)
                dfs[f] = df
                targets = df["TARGET"]
                hist, _ = np.histogram(targets, bins=bins)
                hist_pct = (hist / len(targets) * 100).round(2).tolist()
                
                subs_data[f] = {
                    "filename": f,
                    "rows": len(df),
                    "mean_pct": round(float(targets.mean()) * 100, 2),
                    "std_pct": round(float(targets.std()) * 100, 2),
                    "min_pct": round(float(targets.min()) * 100, 3),
                    "median_pct": round(float(targets.median()) * 100, 2),
                    "p75_pct": round(float(targets.quantile(0.75)) * 100, 2),
                    "p90_pct": round(float(targets.quantile(0.90)) * 100, 2),
                    "max_pct": round(float(targets.max()) * 100, 2),
                    "distribution": {
                        "labels": bin_labels,
                        "percentages": hist_pct
                    }
                }

        # Calculate correlations between models
        correlations = []
        model_names = list(dfs.keys())
        for i in range(len(model_names)):
            for j in range(i+1, len(model_names)):
                m1, m2 = model_names[i], model_names[j]
                corr = float(dfs[m1]["TARGET"].corr(dfs[m2]["TARGET"]))
                correlations.append({
                    "model_a": m1,
                    "model_b": m2,
                    "correlation": round(corr, 4)
                })

        self._submissions_cache = {
            "submissions": subs_data,
            "correlations": correlations
        }
        return self._submissions_cache

    def lookup_applicant(self, sk_id_curr: int) -> Optional[Dict[str, Any]]:
        test_path = os.path.join(INPUT_DIR, "test.csv")
        if not os.path.exists(test_path):
            return None

        # Load test dataframe lazily or search
        if self._test_df is None:
            self._test_df = pd.read_csv(test_path)
            self._test_index = set(self._test_df["SK_ID_CURR"])

        if sk_id_curr not in self._test_index:
            return None

        row = self._test_df[self._test_df["SK_ID_CURR"] == sk_id_curr].iloc[0]
        row_dict = {col: (None if pd.isna(val) else val) for col, val in row.to_dict().items()}

        # Fetch predictions from all submission files
        predictions = {}
        files = ["submissionFinal.csv", "submission.csv", "Submission(1).csv", "submissi0n.csv"]
        for f in files:
            fp = os.path.join(OUTPUT_DIR, f)
            if os.path.exists(fp):
                # Check cache or lookup
                try:
                    df = pd.read_csv(fp)
                    sub_row = df[df["SK_ID_CURR"] == sk_id_curr]
                    if not sub_row.empty:
                        predictions[f] = round(float(sub_row["TARGET"].iloc[0]) * 100, 2)
                except Exception:
                    pass

        return {
            "sk_id_curr": sk_id_curr,
            "data": row_dict,
            "submission_predictions": predictions
        }

data_service = DataService()
