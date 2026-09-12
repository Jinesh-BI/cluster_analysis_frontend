# cluster-analysis-ui — frontend, step 2 of 2

## Run it locally

```
npm install
cp .env.example .env.local   # point VITE_API_BASE_URL at your local backend
npm run dev
```

## Pages

- **/login** — username + password, same accounts you create via Django
<<<<<<< HEAD
  admin (RM) or the Managers page (OMs).
=======
  admin (RM) or the Managers page (ARM).
>>>>>>> d65d33381f79f50adf3130d0e99d30aefda10aad
- **/** — Page 1: cluster grid, sorted by first activity date, checklist
  dots on each card (green = pass, clay-red = fail), farmer count + acres
  in the footer.
- **/clusters/:id** — Page 2: stat row (farmers / acres / fill rate),
  checklist detail, the calendar heatmap (click a day to open the
  drill-down panel on the right), farmer list, and — for Admin/RM only —
  an "Assign to…" control.
- **/managers** — Admin/RM only: create an Assistant Regional Manager
  account and see the existing list.

Everything is responsive by default (CSS grid + flex, no fixed widths),
since Assistant Regional Managers are expected to use this on their phones.

## Deploying to clusters.phala.work

1. `VITE_API_BASE_URL` is baked in at build time, so set it in `.env.local`
   (or your CI's env) to wherever the Django API actually lives before
   running `npm run build`.
2. `npm run build` produces a static `dist/` folder — that's the whole
   deliverable, no Node process needed in production.
3. Point an Nginx server block for `clusters.phala.work` at that `dist/`
   folder as its root, with a catch-all rewrite to `index.html` (needed
   because this is a client-side-routed SPA — react-router, not real
   pages — so a hard refresh on `/clusters/12` needs to still resolve to
   `index.html`):
   ```
   location / {
     try_files $uri /index.html;
   }
   ```
4. Make sure `django-cors-headers` (if that's what you use) allows
   `https://clusters.phala.work` as an origin on the API side, since the
   frontend and API are on different subdomains.

## What's intentionally simple/left out for now

- No component library, no CSS framework — plain CSS with a small set of
  variables in `styles.css`, per "no flashy things."
- No token refresh — DRF tokens don't expire by default, so this just
  logs someone out if a request 401s. Fine for an internal tool; revisit
  if you add token expiry later.
- The "Assign to…" list on the detail page doesn't yet filter out ARMs
  already assigned elsewhere — it just lists everyone; only really matters
  once you have many ARMs, easy to add a search box then.
