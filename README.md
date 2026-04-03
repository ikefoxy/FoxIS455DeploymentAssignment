# FoxIS455 — Deployment assignment (ASP.NET Core + ML.NET)

## Deploy on **Vercel** (recommended for `*.vercel.app`)

The **`web/`** folder is a **Next.js 15** app that implements the same shop flows (customers, new order, admin history, verification queue + scoring) and deploys cleanly on Vercel.

1. Import this repo in Vercel. The repo includes a root **`vercel.json`** that runs **`npm ci`** and **`next build`** inside **`web/`**, so you can leave **Root Directory** as **`./`** and set **Framework Preset** to **Next.js** (or leave auto-detect after push).
2. **If the UI lets you set it**, **Root Directory → `web`** is still the cleanest option. If the field is missing on the first screen: open your project → **Settings** → **General** → **Root Directory** → **Edit** → enter **`web`** → save, then redeploy.
3. For **production**, add a **Turso** (libSQL) database and set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in Vercel → Environment Variables (file-based SQLite is not reliable for writes on serverless). See **`web/README.md`** for details.
4. Run **`npm install`** locally inside `web/` before pushing if you add dependencies.

The original **C# / ASP.NET** app remains in **`ShopWeb/`** for local development and coursework Part 2 (ML.NET notebook).

---

This repo satisfies **Chapter 17: Deploying ML Pipelines** using **C#** end-to-end for the notebook and training pipeline, and **Next.js** for the Vercel-hosted web UI:

- **Part 1 — Web app (`ShopWeb/`):** Razor Pages + SQLite `shop.db` + ML.NET inference that updates `orders.risk_score` and the administrator **priority queue**.
- **Part 2 — Notebook (`Notebooks/IS455_Fraud_CRISP_DM.ipynb`):** CRISP-DM workflow in **C#** via **ML.NET** (requires the Polyglot Notebooks / .NET Interactive kernel).

## Run the site locally

```bash
cd ShopWeb
dotnet run
```

Then open the HTTPS URL from the console (see `Properties/launchSettings.json`).

- **Select customer** → place a **new order** (writes `orders` + `order_items`).
- **Admin orders** → order history.
- **Priority queue** → `Run Scoring` loads `MLModels/fraud_model.zip`, scores every order, and refreshes the table (highest `risk_score` first).

### Train or refresh the fraud model

From the `ShopWeb` folder:

```bash
dotnet run -- --train-model
```

This writes `ShopWeb/MLModels/fraud_model.zip` (same pipeline family as the notebook and `ML/FraudMlPipeline.cs`). If the zip is missing at runtime, **Run Scoring** falls back to a small heuristic so the UI still works.

## Part 2 notebook (.ipynb)

1. Install [Polyglot Notebooks](https://marketplace.visualstudio.com/items?itemName=ms-dotnettools.dotnet-interactive-vscode) (or Jupyter + .NET Interactive).
2. Open `Notebooks/IS455_Fraud_CRISP_DM.ipynb`.
3. Run all cells top-to-bottom; the last cell overwrites `ShopWeb/MLModels/fraud_model.zip`.

> The generator script lives at `scripts/gen_notebook.py` if you need to regenerate the `.ipynb` after edits.

## Deploying — Vercel and this project

### Can I deploy this ASP.NET app on Vercel today?

**Not yet, in practice.** Vercel’s platform is built around Node, serverless functions, and a curated set of runtimes. **Experimental .NET / ASP.NET support** is still in progress (see [vercel/vercel#15586](https://github.com/vercel/vercel/pull/15586)). The builder package **`@vercel/dotnet` is not published to npm** right now, so a `vercel.json` that references it will **fail** on a normal Vercel project.

**When** Vercel ships .NET support, the expected shape (from their test app) is:

1. Set the Vercel project **Root Directory** to **`ShopWeb`**.
2. Add a `vercel.json` next to `Program.cs` (start from **`ShopWeb/vercel.json.example`** and rename/copy to `vercel.json`).
3. Turn on whatever environment flag Vercel documents for experimental frameworks (today that is described as **`VERCEL_USE_EXPERIMENTAL_FRAMEWORKS=1`** in the PR — confirm in current Vercel docs).

**SQLite on serverless:** Even with .NET on Vercel, **disk is ephemeral**. New orders may not persist the way they do on your laptop unless you use a **hosted database** (recommended for any serious deploy).

### What to submit for class (public HTTPS URL)

Use a host that runs **Docker** or **.NET** natively — same “connect GitHub → get a URL” flow as Vercel:

#### Option A — Render (closest to Vercel’s “import repo” flow)

1. Push this repo to **GitHub** (if it is not already).
2. Open [Render Dashboard](https://dashboard.render.com) → **New +** → **Web Service**.
3. Connect the repo, then:
   - **Runtime:** Docker
   - **Dockerfile path:** `Dockerfile` (repo root)
   - **Instance type:** Free (or paid for always-on)
4. Deploy. Render maps **port 8080** (already set in the `Dockerfile` via `ASPNETCORE_URLS`).
5. Optional: add a **persistent disk** mounted at `/app/Data` if you need `shop.db` writes to survive restarts (advanced).

This repo includes **`render.yaml`** so Render can pick up settings automatically when you use **Blueprint / infra as code**.

#### Option B — Azure App Service

Create a **Linux** Web App, runtime **.NET 10**, deploy **`ShopWeb`** publish output (ZIP or GitHub Actions). Include `Data/shop.db` and `MLModels/` in the deployment artifact.

#### Option C — Fly.io / Railway

Build from the root **`Dockerfile`** and follow their “Dockerfile deploy” wizard.

Always use **`ASPNETCORE_ENVIRONMENT=Production`** in production.

## Layout

- `ShopWeb/` — Razor Pages app, ML pipeline code, `Data/shop.db`, `MLModels/`.
- `Notebooks/IS455_Fraud_CRISP_DM.ipynb` — CRISP-DM + serialized model export.
- `Data/shop.db` — optional duplicate of the class database at repo root (the app reads `ShopWeb/Data/shop.db`).
