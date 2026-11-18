import os
import sys

# Prevent matplotlib caching/memory overhead on Windows Python 3.13
os.environ.setdefault('MPLCONFIGDIR', os.environ.get('TEMP', os.path.expanduser('~')))
if 'matplotlib' not in sys.modules:
    sys.modules['matplotlib'] = None

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import pandas as pd
from flask import Flask, request, jsonify, render_template, send_file
from flask_cors import CORS

from backend.predictor import predictor
from backend.data_service import data_service

app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, "frontend", "templates"),
    static_folder=os.path.join(BASE_DIR, "frontend", "static")
)
CORS(app)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "model_loaded": predictor.model is not None,
        "model_type": predictor.metadata.get("model_type", "Unknown"),
        "validation_auc": predictor.metadata.get("validation_auc", 0.0)
    })

@app.route("/api/metadata", methods=["GET"])
def get_metadata():
    return jsonify({
        "model_info": {
            "type": predictor.metadata.get("model_type"),
            "val_auc": predictor.metadata.get("validation_auc"),
            "brier_score": predictor.metadata.get("brier_score"),
            "log_loss": predictor.metadata.get("log_loss"),
            "num_features": predictor.metadata.get("num_features"),
            "training_samples": predictor.metadata.get("training_samples"),
        },
        "feature_importances": predictor.metadata.get("feature_importances", [])[:20],
        "categorical_options": predictor.metadata.get("categorical_options", {}),
        "presets": predictor.metadata.get("presets", {}),
        "benchmarks": predictor.metadata.get("benchmarks", []),
        "stats_summary": predictor.metadata.get("stats_summary", {})
    })

@app.route("/api/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json(force=True)
        if not data:
            return jsonify({"error": "No input data provided"}), 400
        result = predictor.predict_single(data)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/eda", methods=["GET"])
def get_eda():
    try:
        stats = data_service.get_eda_stats()
        return jsonify(stats)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/submissions", methods=["GET"])
def get_submissions():
    try:
        data = data_service.get_submissions_comparison()
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/applicant/<int:sk_id_curr>", methods=["GET"])
def get_applicant(sk_id_curr):
    try:
        app_data = data_service.lookup_applicant(sk_id_curr)
        if not app_data:
            return jsonify({"error": f"Applicant {sk_id_curr} not found in test dataset"}), 404
        
        prediction = predictor.predict_single(app_data["data"])
        app_data["live_prediction"] = prediction
        return jsonify(app_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/columns", methods=["GET"])
def get_columns():
    try:
        cols = data_service.get_column_descriptions()
        return jsonify({"columns": cols})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/batch-predict", methods=["POST"])
def batch_predict():
    try:
        if "file" in request.files:
            file = request.files["file"]
            df = pd.read_csv(file.stream)
        else:
            test_path = os.path.join(BASE_DIR, "input", "test.csv")
            df = pd.read_csv(test_path, nrows=500)
            
        if "SK_ID_CURR" not in df.columns:
            return jsonify({"error": "CSV must contain SK_ID_CURR column"}), 400

        scores = []
        for _, row in df.iterrows():
            pred = predictor.predict_single(row.to_dict())
            scores.append(pred["probability"])

        df_out = pd.DataFrame({
            "SK_ID_CURR": df["SK_ID_CURR"],
            "TARGET": scores
        })

        preview = df_out.head(10).to_dict(orient="records")
        return jsonify({
            "total_scored": len(df_out),
            "mean_risk_pct": round(float(df_out["TARGET"].mean()) * 100, 2),
            "max_risk_pct": round(float(df_out["TARGET"].max()) * 100, 2),
            "min_risk_pct": round(float(df_out["TARGET"].min()) * 100, 2),
            "preview": preview
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/download-submission", methods=["GET"])
def download_submission():
    sub_name = request.args.get("name", "submissionFinal.csv")
    sub_path = os.path.join(BASE_DIR, "output", sub_name)
    if os.path.exists(sub_path):
        return send_file(sub_path, as_attachment=True, download_name=sub_name)
    return jsonify({"error": f"Submission {sub_name} not found"}), 404

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
