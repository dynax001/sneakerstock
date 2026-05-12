# SneakerStock

Single-page sneaker release & resale tracker. Data lives in `sneakers.json` and is refreshed daily by a GitHub Action.

## Local preview

The page fetches `sneakers.json` at runtime, so opening `index.html` directly via `file://` will hit a CORS block and fall back to inline sample data. To preview properly:

```bash
cd sneakerstock
python3 -m http.server 8080
# then open http://localhost:8080
```

(Any static server works — `npx serve`, `php -S`, etc.)

## How the data refresh works

`scripts/refresh.js` calls [Sneaks-API](https://github.com/druv5319/Sneaks-API) — an open-source scraper for Flight Club / StockX / GOAT — pulls the top 20 popular shoes, and overwrites `sneakers.json`.

The GitHub Action in `.github/workflows/refresh-sneakers.yml` runs that script:
- **Daily at 08:00 UTC** (cron)
- **On demand** via the Actions tab → "Refresh sneaker data" → "Run workflow"

If the JSON changed, it commits and pushes back to `main`.

## First-time setup

1. Create a new repo on GitHub and push this folder.
2. Settings → Pages → Source: `Deploy from a branch` → `main` / `/ (root)`. Site is at `https://<you>.github.io/<repo>/`.
3. Settings → Actions → General → Workflow permissions → enable **"Read and write permissions"** (lets the bot push the refreshed JSON).
4. Run the workflow once manually: Actions tab → Refresh sneaker data → Run workflow. Watch the run; if green, `sneakers.json` is updated.

## Swapping the data source

`scripts/refresh.js` is structured around one adapter function (`fetchFromSneaksAPI`). To replace it:

1. Pick an API (RapidAPI marketplace → search "sneakers" → free tier; common ones are *The Sneaker Database* and *v1-sneakers*).
2. Sign up, copy your `X-RapidAPI-Key`.
3. In your GitHub repo: Settings → Secrets and variables → Actions → New repository secret → `RAPIDAPI_KEY`.
4. Add `env: { RAPIDAPI_KEY: ${{ secrets.RAPIDAPI_KEY }} }` to the "Refresh sneakers.json" step in the workflow.
5. Replace the adapter in `refresh.js` with `fetch()` calls to that API, reshape the response to match the existing object shape (id, name, brand, releaseDate, retail, resale, prev, color, upcoming, image).

The rest of the pipeline doesn't care which API you use.

## Local test before pushing

```bash
npm install
node scripts/refresh.js
```

If it errors, Sneaks-API may be broken for the moment — swap to a RapidAPI source per above. If it succeeds, `sneakers.json` will be rewritten.

## Files

- `index.html` — the single-page site (CSS + JS inline)
- `sneakers.json` — current data (committed; rewritten by the action)
- `scripts/refresh.js` — fetches new data, writes `sneakers.json`
- `.github/workflows/refresh-sneakers.yml` — scheduled action
- `package.json` — declares `sneaks-api` dependency

## Caveats

- The fallback inline array in `index.html` is what renders if the JSON fetch fails — keep it in sync if you add new fields.
- Sneaks-API is a scraper. It will break occasionally when source sites change their HTML. The action will fail loud — you'll see the red X in the Actions tab.
- This is a tracker, not a buyer. Drop notifications fire only while the page is open in a tab.
