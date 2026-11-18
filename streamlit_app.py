import os
import sys
import pandas as pd
import streamlit as st

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend.predictor import predictor
from backend.data_service import data_service

st.set_page_config(
    page_title="Home Credit Default Risk",
    layout="wide"
)

st.title("Home Credit Default Risk")
st.caption("Model Evaluation & Loan Risk Assessment (GCI Global 2025 Competition / Kaggle)")

tab_calc, tab_applicant, tab_subs, tab_dict = st.tabs([
    "Risk Calculator", 
    "Applicant Lookup", 
    "Submissions & Benchmarks", 
    "Data Dictionary"
])

# ==================== TAB 1: RISK CALCULATOR ====================
with tab_calc:
    st.subheader("Applicant Risk Scoring")

    preset_choice = st.selectbox(
        "Load Sample Profile:",
        ["Sample A: Prime Applicant (Low Risk)", "Sample B: Average Applicant (Moderate Risk)", "Sample C: Subprime Applicant (High Risk)"]
    )

    if "Prime" in preset_choice:
        d_income, d_credit, d_annuity, d_goods = 270000, 600000, 28000, 540000
        d_gender, d_edu, d_income_type, d_status = "F", "Higher education", "Commercial associate", "Married"
        d_age, d_emp, d_car = 50, 10.0, 3
        d_ext1, d_ext2, d_ext3 = 0.68, 0.72, 0.75
    elif "Average" in preset_choice:
        d_income, d_credit, d_annuity, d_goods = 157500, 520000, 26000, 450000
        d_gender, d_edu, d_income_type, d_status = "M", "Secondary / secondary special", "Working", "Married"
        d_age, d_emp, d_car = 37, 4.0, 8
        d_ext1, d_ext2, d_ext3 = 0.45, 0.52, 0.48
    else:
        d_income, d_credit, d_annuity, d_goods = 90000, 480000, 32000, 420000
        d_gender, d_edu, d_income_type, d_status = "M", "Lower secondary", "Working", "Single / not married"
        d_age, d_emp, d_car = 23, 0.5, 18
        d_ext1, d_ext2, d_ext3 = 0.22, 0.28, 0.19

    c1, c2, c3 = st.columns(3)
    with c1:
        st.markdown("**Loan Details**")
        contract_type = st.selectbox("Contract Type", ["Cash loans", "Revolving loans"])
        income_total = st.number_input("Annual Income ($)", value=d_income, step=5000)
        credit_amt = st.number_input("Credit Amount ($)", value=d_credit, step=10000)
        annuity_amt = st.number_input("Annual Annuity ($)", value=d_annuity, step=1000)
        goods_price = st.number_input("Goods Price ($)", value=d_goods, step=10000)

    with c2:
        st.markdown("**Applicant Details**")
        gender = st.selectbox("Gender", ["F", "M"], index=0 if d_gender == "F" else 1)
        edu_options = ["Higher education", "Secondary / secondary special", "Incomplete higher", "Lower secondary", "Academic degree"]
        edu = st.selectbox("Education", edu_options, index=edu_options.index(d_edu) if d_edu in edu_options else 0)
        income_options = ["Working", "Commercial associate", "Pensioner", "State servant"]
        inc_type = st.selectbox("Income Type", income_options, index=income_options.index(d_income_type) if d_income_type in income_options else 0)
        age_years = st.slider("Age (Years)", 18, 70, d_age)
        emp_years = st.slider("Employment (Years)", 0.0, 40.0, float(d_emp), step=0.5)

    with c3:
        st.markdown("**Credit Bureau Scores**")
        ext1 = st.slider("EXT_SOURCE_1", 0.0, 1.0, float(d_ext1), step=0.01)
        ext2 = st.slider("EXT_SOURCE_2", 0.0, 1.0, float(d_ext2), step=0.01)
        ext3 = st.slider("EXT_SOURCE_3", 0.0, 1.0, float(d_ext3), step=0.01)
        bureau_year = st.number_input("Inquiries Last Year", value=1, min_value=0)

    payload = {
        "NAME_CONTRACT_TYPE": contract_type,
        "CODE_GENDER": gender,
        "CNT_CHILDREN": 0,
        "AMT_INCOME_TOTAL": income_total,
        "AMT_CREDIT": credit_amt,
        "AMT_ANNUITY": annuity_amt,
        "AMT_GOODS_PRICE": goods_price,
        "NAME_INCOME_TYPE": inc_type,
        "NAME_EDUCATION_TYPE": edu,
        "NAME_FAMILY_STATUS": d_status,
        "NAME_HOUSING_TYPE": "House / apartment",
        "DAYS_BIRTH": -int(age_years * 365.25),
        "DAYS_EMPLOYED": -int(emp_years * 365.25),
        "DAYS_REGISTRATION": -2500,
        "DAYS_ID_PUBLISH": -2000,
        "OWN_CAR_AGE": d_car,
        "OCCUPATION_TYPE": "Laborers",
        "CNT_FAM_MEMBERS": 2,
        "REGION_RATING_CLIENT": 2,
        "ORGANIZATION_TYPE": "Business Entity Type 3",
        "EXT_SOURCE_1": ext1,
        "EXT_SOURCE_2": ext2,
        "EXT_SOURCE_3": ext3,
        "DAYS_LAST_PHONE_CHANGE": -500,
        "AMT_REQ_CREDIT_BUREAU_HOUR": 0,
        "AMT_REQ_CREDIT_BUREAU_MON": 0,
        "AMT_REQ_CREDIT_BUREAU_QRT": 0,
        "AMT_REQ_CREDIT_BUREAU_YEAR": bureau_year
    }

    result = predictor.predict_single(payload)
    prob_pct = result["probability_percent"]

    st.markdown("---")
    st.markdown("### Risk Assessment Result")
    r1, r2, r3, r4 = st.columns(4)
    r1.metric("Predicted Default Probability", f"{prob_pct:.1f}%")
    r2.metric("Risk Classification", result["risk_tier"])
    r3.metric("Debt-to-Income (DTI)", f"{result['financial_summary'].get('annuity_income_ratio_pct', 'N/A')}%")
    r4.metric("Credit-to-Income", f"{result['financial_summary'].get('credit_income_ratio', 'N/A')}x")

    st.info(f"**Recommendation:** {result['recommendation']} — {result['recommendation_description']}")

    st.markdown("**Key Factors:**")
    f1, f2 = st.columns(2)
    with f1:
        st.markdown("*Positive Drivers:*")
        for item in result["factors"]["strengths"]:
            st.write(f"- **{item['factor']}** ({item['value']}): {item['impact']}")
    with f2:
        st.markdown("*Risk Drivers:*")
        for item in result["factors"]["risk_drivers"]:
            st.write(f"- **{item['factor']}** ({item['value']}): {item['impact']}")

# ==================== TAB 2: APPLICANT LOOKUP ====================
with tab_applicant:
    st.subheader("Lookup Test Applicant")
    sk_id = st.number_input("Enter SK_ID_CURR", value=171202, step=1)

    if st.button("Lookup Applicant"):
        app_info = data_service.lookup_applicant(int(sk_id))
        if app_info:
            live = predictor.predict_single(app_info["data"])
            st.success(f"Applicant #{sk_id} Loaded | Predicted Risk: {live['probability_percent']:.1f}% ({live['risk_tier']})")

            st.markdown("**Model Predictions Comparison**")
            pred_data = [{"Model / File": "Current LightGBM", "Predicted Probability": f"{live['probability_percent']:.1f}%", "Type": "Live"}]
            for sub_name, p in app_info["submission_predictions"].items():
                pred_data.append({"Model / File": sub_name, "Predicted Probability": f"{p}%", "Type": "File"})
            st.table(pd.DataFrame(pred_data))

            st.markdown("**Applicant Details**")
            st.json(app_info["data"])
        else:
            st.error(f"Applicant #{sk_id} not found in test dataset.")

# ==================== TAB 3: SUBMISSIONS ====================
with tab_subs:
    st.subheader("Competition Submissions")
    sub_data = data_service.get_submissions_comparison()

    sub_rows = []
    for fname, info in sub_data["submissions"].items():
        sub_rows.append({
            "File": fname,
            "Rows": info["rows"],
            "Mean Risk (%)": info["mean_pct"],
            "Median (%)": info["median_pct"],
            "90th Percentile (%)": info["p90_pct"]
        })
    st.table(pd.DataFrame(sub_rows))

    st.subheader("Model Validation ROC-AUC Benchmarks")
    benchmarks_df = pd.DataFrame(predictor.metadata.get("benchmarks", []))
    st.table(benchmarks_df)

# ==================== TAB 4: DATA DICTIONARY ====================
with tab_dict:
    st.subheader("Feature Dictionary")
    cols = data_service.get_column_descriptions()
    if cols:
        st.dataframe(pd.DataFrame(cols), use_container_width=True)
