# Render Deployment Guide

Step-by-step instructions for deploying the **Home Credit Default Risk (GCI Global 2025)** web application on [Render](https://render.com) for free.

---

## 📋 Pre-Deployment Checklist

The project includes all required deployment files:

| File | Purpose |
| :--- | :--- |
| [`requirements.txt`](file:///d:/Users/Nilesh%20gupta/Downloads/competition-20260508T170036Z-3-001-20261118T193652Z-1-001/competition-20260508T170036Z-3-001/competition/requirements.txt) | Python dependencies (`Flask`, `gunicorn`, `lightgbm`, `pandas`, `scikit-learn`) |
| [`wsgi.py`](file:///d:/Users/Nilesh%20gupta/Downloads/competition-20260508T170036Z-3-001-20261118T193652Z-1-001/competition-20260508T170036Z-3-001/competition/wsgi.py) | Production WSGI application entrypoint |
| [`Procfile`](file:///d:/Users/Nilesh%20gupta/Downloads/competition-20260508T170036Z-3-001-20261118T193652Z-1-001/competition-20260508T170036Z-3-001/competition/Procfile) | Defines web process command: `web: gunicorn wsgi:app` |
| [`render.yaml`](file:///d:/Users/Nilesh%20gupta/Downloads/competition-20260508T170036Z-3-001-20261118T193652Z-1-001/competition-20260508T170036Z-3-001/competition/render.yaml) | Render Blueprint for 1-click automatic configuration |
| [`.gitignore`](file:///d:/Users/Nilesh%20gupta/Downloads/competition-20260508T170036Z-3-001-20261118T193652Z-1-001/competition-20260508T170036Z-3-001/competition/.gitignore) | Excludes unnecessary files and large raw training CSVs |
| `models/` | Contains the serialized LightGBM model pipeline (`lgbm_default_risk.joblib`) |

---

## 🚀 Deployment Instructions

### Step 1: Push Project to GitHub

1. Open PowerShell / Terminal in the project directory:
   ```bash
   cd "d:\Users\Nilesh gupta\Downloads\competition-20260508T170036Z-3-001-20261118T193652Z-1-001\competition-20260508T170036Z-3-001\competition"
   ```

2. Initialize Git, add files, and make your first commit:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Home Credit Default Risk GCI Global Web App"
   ```

3. Create a new repository on [GitHub](https://github.com/new) (e.g. `home-credit-risk-gci`).

4. Link the repository and push:
   ```bash
   git branch -M main
   git remote add origin https://github.com/<YOUR-GITHUB-USERNAME>/home-credit-risk-gci.git
   git push -u origin main
   ```

---

### Step 2: Deploy on Render

#### Option A: Manual Web Service Setup (Recommended & Simple)

1. Go to [dashboard.render.com](https://dashboard.render.com/) and sign in (using GitHub).
2. Click **New +** at the top right and select **Web Service**.
3. Choose **Build and deploy from a Git repository** $\rightarrow$ Click **Next**.
4. Select your GitHub repository (`home-credit-risk-gci`).
5. Configure the web service with these settings:

| Field | Setting |
| :--- | :--- |
| **Name** | `home-credit-risk-gci` *(or any preferred name)* |
| **Region** | `Oregon (US West)` or `Frankfurt (EU)` *(any nearby region)* |
| **Branch** | `main` |
| **Root Directory** | *(Leave blank)* |
| **Runtime** | `Python 3` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `gunicorn wsgi:app` |
| **Instance Type** | **Free** ($0/month) |

6. Click **Advanced** $\rightarrow$ Add Environment Variable:
   - **Key**: `PYTHON_VERSION`
   - **Value**: `3.11.9`
7. Click **Create Web Service**.

---

#### Option B: 1-Click Blueprint Setup (Using `render.yaml`)

1. Go to [dashboard.render.com/blueprints](https://dashboard.render.com/blueprints).
2. Click **New Blueprint Instance**.
3. Connect your GitHub repository.
4. Render will read `render.yaml` automatically and configure the build command, start command, and port.
5. Click **Apply**.

---

## ⏱️ Build & Launch

- Render will automatically provision an environment, run `pip install -r requirements.txt`, and start the Gunicorn web server.
- The deployment process takes roughly **1 to 2 minutes**.
- Once deployed, your service status will display **`Live`** with a green badge.
- Your app is now live at:
  ```
  https://home-credit-risk-gci.onrender.com
  ```

---

## 💡 Important Production Notes

1. **Free Tier Inactivity Sleep**:
   - Render's free tier spins down instances after **15 minutes** of no traffic.
   - When someone visits after a sleep period, the first request may take **30 to 50 seconds** to wake up the server (subsequent requests will be instantaneous).
2. **Memory Footprint**:
   - The serialized LightGBM model pipeline only consumes ~120MB of RAM, well within Render's free 512MB RAM ceiling.
3. **Continuous Deployment**:
   - Every time you push changes to your GitHub `main` branch, Render will automatically rebuild and deploy the latest version with zero downtime.
