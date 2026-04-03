# IS455 Shop (Next.js · Vercel)

This is the **Vercel-deployable** version of the assignment: **Next.js 15** + **libSQL** (`@libsql/client`).

## Local development

```bash
npm install
# Ensure data/shop.db exists (copied from ../ShopWeb/Data/shop.db)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

1. Push the **repository** to GitHub.
2. In [Vercel](https://vercel.com) → **Add New Project** → import the repo.
3. Set **Root Directory** to **`web`** (important).
4. **Production database:** Vercel’s serverless runtime cannot reliably use a **writable** file-based SQLite path. For production:
   - Create a database on [Turso](https://turso.tech/) (libSQL).
   - Import your SQLite file, e.g. `turso db import <db-name> ./data/shop.db` (see Turso CLI docs).
   - In the Vercel project → **Settings → Environment Variables**, add:
     - `TURSO_DATABASE_URL` — your `libsql://...` URL  
     - `TURSO_AUTH_TOKEN` — API token  
5. Deploy. The app will use the file DB only when `TURSO_*` is **not** set (local dev).

## C# / ML.NET

The original **ASP.NET Core** app and **ML.NET** training pipeline remain under `../ShopWeb/` and `../Notebooks/`. This Next.js app uses the **same heuristic** as the C# fallback for “Run scoring” when the ML model is not loaded in Node.
