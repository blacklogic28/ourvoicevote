# OurVoiceVote — Daily News Engine Setup

This is a one-time setup. After it's done, the **Today's News** section on the site
refreshes itself **every day at ~9:00 AM Central** with no work from you.

## How it works (30-second version)

```
GitHub Action (runs daily 9 AM CT)
  → runs scripts/generate-news.mjs
     → asks Claude (with live web search) for today's non-partisan, sourced digest
     → writes news.json
  → commits news.json → Netlify auto-deploys → live site updates
```

The website reads `news.json` in the browser and shows the national digest plus a
"pick your state" selector. **You never edit the news by hand.**

---

## Files in this project

| File | What it is |
|---|---|
| `index.html` | The site (now includes the **Today's News** section + nav link) |
| `news.json` | The current news data (generated; do not hand-edit) |
| `scripts/generate-news.mjs` | The daily generator (Node, no dependencies) |
| `.github/workflows/daily-news.yml` | The 9 AM scheduler |
| `NEWS_ENGINE_SETUP.md` | This file |

Make sure all of these are committed to the GitHub repo
(`blacklogic28/ourvoicevote`). On GitHub's web editor you can create a file in a
folder by typing the path, e.g. `scripts/generate-news.mjs`, in the filename box.

---

## Step 1 — Get an Anthropic API key

1. Go to **https://console.anthropic.com** → sign in.
2. **Billing** → add a small amount of credit (a few dollars lasts a long time —
   see Cost below).
3. **API Keys** → **Create Key** → copy it (starts with `sk-ant-...`).

## Step 2 — Add the key to GitHub (this is the secret you approved)

1. Open **https://github.com/blacklogic28/ourvoicevote**
2. **Settings** → **Secrets and variables** → **Actions**
3. **New repository secret**
   - **Name:** `ANTHROPIC_API_KEY`
   - **Secret:** paste your `sk-ant-...` key
4. **Add secret**.

> The key is stored encrypted and is only visible to the Action. It never appears
> on the website or in the code.

## Step 3 — Make sure Actions are enabled

1. Repo → **Actions** tab. If prompted, click **"I understand my workflows, enable them."**
2. You should see a workflow named **Daily News**.

## Step 4 — Test it now (don't wait until 9 AM)

1. **Actions** tab → **Daily News** → **Run workflow** → **Run workflow**.
2. Wait ~1-3 minutes. A green check means it worked and it committed a fresh
   `news.json`.
3. Hard-refresh the live site and scroll to **Today's News**.

If the run fails (red X), click it to read the log. The most common cause is a
missing or out-of-credit `ANTHROPIC_API_KEY`. **A failed run never breaks the
site** — it just leaves the previous `news.json` in place.

---

## Cost

One run per day = one Claude request (with web search). Add credit and forget it.
If you want to spend less, set the model to a cheaper one:

- Repo → **Settings → Secrets and variables → Actions → Variables → New variable**
  - **Name:** `ANTHROPIC_MODEL`
  - **Value:** `claude-haiku-4-5` (cheapest) or `claude-sonnet-4-6` (mid)
- Then in `.github/workflows/daily-news.yml`, uncomment the `ANTHROPIC_MODEL` line.

Default model is `claude-opus-4-8` (highest quality).

## Changing the time

In `.github/workflows/daily-news.yml`, the line `- cron: '0 14 * * *'` is the
schedule in **UTC**. `14` = 9 AM Central in summer (CDT). GitHub cron ignores
daylight saving, so in winter (CST) it runs at 8 AM; change `14` to `15` if you
want a strict 9 AM year-round. You can also just press **Run workflow** anytime
to refresh on demand.

## Non-partisan guarantee

The generator is instructed (and the output is validated) to:
- report only verifiable facts — never whether something is good/bad,
- attribute every item to a named source **with a working link**,
- cover developments across the spectrum,
- write short original summaries (no copied article text).

Any item missing a source link is dropped automatically. If too little is
verifiable, the run fails safely and the prior `news.json` stays up. States with
no verified item that day simply show live-source links in the selector.
