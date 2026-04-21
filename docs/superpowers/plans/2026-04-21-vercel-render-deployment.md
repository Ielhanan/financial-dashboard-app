# Vercel + Render Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the Financial Dashboard — FastAPI backend on Render, Next.js frontend on Vercel — from the existing monorepo.

**Architecture:** `render.yaml` at repo root declares the backend Web Service; Vercel connects to the `frontend/` subdirectory. The frontend reads `NEXT_PUBLIC_API_URL` at build time; the backend reads `FINANCIAL_API_KEY` and `CORS_ORIGINS` from Render env vars.

**Tech Stack:** FastAPI + uvicorn (Render), Next.js 14 (Vercel), GitHub (source)

---

## Files

| Action | Path | Purpose |
|---|---|---|
| Create | `render.yaml` | Declarative Render service config |
| Create | `backend/runtime.txt` | Pin Python version for Render |
| Verify | `backend/app/config.py` | `CORS_ORIGINS` already env-configurable |
| Verify | `frontend/src/lib/api.ts` | WebSocket URL derivation already correct |

---

### Task 1: Add `runtime.txt` for Python version

**Files:**
- Create: `backend/runtime.txt`

- [ ] **Step 1: Create the file**

```
python-3.10.11
```

Save as `backend/runtime.txt` — Render reads this to select the Python runtime.

- [ ] **Step 2: Verify the file exists**

```bash
cat backend/runtime.txt
```

Expected output: `python-3.10.11`

- [ ] **Step 3: Commit**

```bash
git add backend/runtime.txt
git commit -m "chore: pin Python version for Render"
```

---

### Task 2: Add `render.yaml`

**Files:**
- Create: `render.yaml` (repo root)

- [ ] **Step 1: Create the file**

```yaml
services:
  - type: web
    name: financial-dashboard-api
    runtime: python
    rootDir: backend
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: FINANCIAL_API_KEY
        sync: false
      - key: CORS_ORIGINS
        sync: false
```

Save as `render.yaml` at the repo root.

`sync: false` means Render will prompt you to set these values in the dashboard — they are never stored in the repo.

- [ ] **Step 2: Verify the file is at the repo root**

```bash
cat render.yaml
```

Expected: the YAML above printed to stdout.

- [ ] **Step 3: Commit and push**

```bash
git add render.yaml
git commit -m "chore: add Render deployment config"
git push
```

Expected: push succeeds, branch `master` is up to date on GitHub.

---

### Task 3: Create Render Web Service (manual steps)

**Files:** none (dashboard configuration)

- [ ] **Step 1: Go to [render.com](https://render.com) and sign in**

- [ ] **Step 2: Click "New +" → "Web Service"**

- [ ] **Step 3: Connect your GitHub repo**

Select the `FinanicalDashboard` repository. If it's not listed, click "Configure GitHub App" and grant access.

- [ ] **Step 4: Configure the service**

Render should auto-detect `render.yaml`. If it does, it will pre-fill the settings. Verify:

| Field | Value |
|---|---|
| Name | `financial-dashboard-api` |
| Root Directory | `backend` |
| Runtime | `Python` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Instance Type | `Free` |

- [ ] **Step 5: Set environment variables**

In the "Environment" section, add:

| Key | Value |
|---|---|
| `FINANCIAL_API_KEY` | Your FMP API key (from `backend/.env`) |
| `CORS_ORIGINS` | `["https://placeholder.vercel.app"]` (update after Vercel deploy) |

- [ ] **Step 6: Click "Create Web Service"**

Wait for the build and deploy to complete (~2-3 min). The deploy log should end with:

```
INFO:     Application startup complete.
```

- [ ] **Step 7: Copy the service URL**

It will be something like `https://financial-dashboard-api.onrender.com`. Save this — you'll need it for Vercel.

- [ ] **Step 8: Verify the backend is live**

Open in browser or run:

```bash
curl https://financial-dashboard-api.onrender.com/health
```

Expected response:

```json
{"status": "ok"}
```

---

### Task 4: Deploy Frontend on Vercel (manual steps)

**Files:** none (dashboard configuration)

- [ ] **Step 1: Go to [vercel.com](https://vercel.com) and sign in**

- [ ] **Step 2: Click "Add New..." → "Project"**

- [ ] **Step 3: Import the GitHub repo**

Select `FinanicalDashboard`. If not listed, configure the Vercel GitHub App.

- [ ] **Step 4: Configure the project**

| Field | Value |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | `Next.js` (auto-detected) |
| Build Command | leave default (`next build`) |
| Output Directory | leave default |

- [ ] **Step 5: Set environment variable**

In the "Environment Variables" section:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://financial-dashboard-api.onrender.com` (your Render URL from Task 3 Step 7) |

- [ ] **Step 6: Click "Deploy"**

Wait for the build to complete (~1-2 min). You'll see a green "Congratulations" screen with your Vercel URL, e.g. `https://financial-dashboard.vercel.app`.

- [ ] **Step 7: Copy the Vercel URL**

Save it — you'll update CORS on Render next.

---

### Task 5: Update CORS on Render with the real Vercel URL

**Files:** none (env var update in Render dashboard)

- [ ] **Step 1: Go to your Render service dashboard**

Navigate to `financial-dashboard-api` → "Environment".

- [ ] **Step 2: Update `CORS_ORIGINS`**

Change the value from the placeholder to your real Vercel URL:

```
["https://financial-dashboard.vercel.app"]
```

Replace `financial-dashboard.vercel.app` with your actual Vercel domain.

- [ ] **Step 3: Save and wait for redeploy**

Render will automatically redeploy when you save env var changes. Wait for:

```
INFO:     Application startup complete.
```

---

### Task 6: Smoke test the full deployment

**Files:** none

- [ ] **Step 1: Open the Vercel URL in your browser**

Navigate to `https://financial-dashboard.vercel.app` (your URL).

- [ ] **Step 2: Search for a ticker**

Type `AAPL` in the search bar and press Enter. All modules should populate with data.

- [ ] **Step 3: Verify WebSocket (MarketPerformanceCard)**

The MarketPerformanceCard should show live data and update every ~3 seconds without a page refresh.

- [ ] **Step 4: Verify no CORS errors**

Open browser DevTools → Console. There should be no CORS errors. If you see:

```
Access to fetch at 'https://....onrender.com' from origin 'https://....vercel.app' has been blocked by CORS policy
```

Go back to Task 5 and verify the `CORS_ORIGINS` value exactly matches your Vercel URL (no trailing slash).

- [ ] **Step 5: Note cold start behavior**

If the backend was idle for 15+ minutes (Render free tier), the first request may take ~30 seconds. This is expected. Subsequent requests are fast.
