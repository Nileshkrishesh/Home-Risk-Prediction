# Vercel Frontend Deployment Guide

How to deploy the frontend of **Home Credit Default Risk (GCI Global 2025)** on [Vercel](https://vercel.com) with automatic API routing to your Render backend.

---

## 🏗️ Architecture

```
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│         Vercel (Frontend)       │           │         Render (Backend)        │
│  https://<project>.vercel.app   │           │ https://<project>.onrender.com  │
│                                 │           │                                 │
│   • HTML, CSS, JavaScript       │           │   • Flask Python Server         │
│   • Instant Global CDN          │   /api/*  │   • LightGBM ML Pipeline        │
│   • vercel.json rewrites ───────┼──────────>│   • Real-time Model Inference   │
└─────────────────────────────────┘ (proxied) └─────────────────────────────────┘
```

- **Frontend on Vercel**: Hosted globally on Vercel's high-speed Edge network.
- **Backend on Render**: Hosts the Python Flask server & LightGBM model pipeline.
- **`vercel.json` Rewrites**: Vercel transparently proxies `/api/*` requests to your Render backend—**zero CORS errors**.

---

## 🚀 2-Minute Deployment Steps

### Step 1: Push Changes to GitHub

Run in PowerShell / Terminal:
```bash
cd "d:\Users\Nilesh gupta\Downloads\competition-20260508T170036Z-3-001-20261118T193652Z-1-001\competition-20260508T170036Z-3-001\competition"

git add -A
git commit -m "Configure frontend for Vercel with Render API proxy"
git push origin main
```

---

### Step 2: Import Project on Vercel

1. Go to [**vercel.com**](https://vercel.com) and log in with your GitHub account.
2. Click **Add New...** (top right) $\rightarrow$ **Project**.
3. Select your repository: **`Nileshkrishesh/Home-Risk-Prediction`** and click **Import**.

---

### Step 3: Deploy (Zero Configuration Needed)

Vercel will automatically detect `index.html` and `vercel.json`:
- **Framework Preset**: `Other` (default)
- **Root Directory**: `./` (default)
- **Build & Output Settings**: Leave as default (no build step needed)

Click **Deploy**!

In **~10 seconds**, your frontend will be live at:
```
https://home-risk-prediction.vercel.app
```

---

## ⚙️ Configuration Files Included

| File | Purpose |
| :--- | :--- |
| [`index.html`](file:///d:/Users/Nilesh%20gupta/Downloads/competition-20260508T170036Z-3-001-20261118T193652Z-1-001/competition-20260508T170036Z-3-001/competition/index.html) | Root entrypoint for Vercel static hosting |
| [`static/`](file:///d:/Users/Nilesh%20gupta/Downloads/competition-20260508T170036Z-3-001-20261118T193652Z-1-001/competition-20260508T170036Z-3-001/competition/static) | Styles (`static/css/style.css`) and logic (`static/js/app.js`) |
| [`vercel.json`](file:///d:/Users/Nilesh%20gupta/Downloads/competition-20260508T170036Z-3-001-20261118T193652Z-1-001/competition-20260508T170036Z-3-001/competition/vercel.json) | Rewrites `/api/:match*` to `https://home-risk-prediction.onrender.com/api/:match*` |

---

## 🔧 Updating the Backend URL

If your Render service URL changes, simply update the destination in [`vercel.json`](file:///d:/Users/Nilesh%20gupta/Downloads/competition-20260508T170036Z-3-001-20261118T193652Z-1-001/competition-20260508T170036Z-3-001/competition/vercel.json):

```json
{
  "version": 2,
  "rewrites": [
    {
      "source": "/api/:match*",
      "destination": "https://<YOUR-RENDER-APP-NAME>.onrender.com/api/:match*"
    }
  ]
}
```
Push the commit to GitHub, and Vercel will automatically redeploy in seconds!
