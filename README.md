# Personal Portal

A personal start page / dashboard: a browser-tab replacement that surfaces news, a GitHub activity feed, a task/calendar agenda, weather, government-activity trackers for three countries, five religion-news cards, a "good news" cover-flow carousel, and a bookmarks bar — all on one screen.

**Status: frozen.** This site originally refreshed itself live twice a day. It now serves a static snapshot of its last-ever refresh (captured 2026-09-15) and makes no outbound API calls. See [Frozen snapshot](#frozen-snapshot) below for why, and what it would take to make it live again.

## Layout

```
┌───────────┬─────────────────────────────────────┬───────────┐
│  🇺🇸 US Gov │                                     │ 🕎 Judaism │
│  🇨🇳 CN Gov │        hero (date/time banner)      │ 📿 Catholic│
│  🇷🇺 RU Gov │  ┌────────┬────────┬────────┬─────┐ │ 🕌 Islam   │
│           │  │  News  │ GitHub │ Agenda │ Wx  │ │ 🛕 Hindu   │
│  (left    │  └────────┴────────┴────────┴─────┘ │ 🧘 Buddhist│
│  column)  │      Good News (cover-flow carousel) │ (right    │
│           │                                       │  column)  │
└───────────┴─────────────────────────────────────┴───────────┘
        + a bookmarks nav bar across the top (Reddit, Digg, Fastmail, GitHub, Cloudflare, NPR, Perplexity, WhatsApp)
```

| Card | What it shows |
| --- | --- |
| **Top Stories** | U.S. headlines pooled from CBS News, NBC News, and ABC News, each with a short summary. |
| **GitHub** | Activity (description, primary language, latest commit) for a fixed list of repos. |
| **Agenda** | Open Todoist tasks and upcoming calendar events (from a private Fastmail ICS feed), in one togglable card. |
| **Weather** | Current conditions for two fixed cities (Cabo Rojo, PR and Griffin, GA) via Open-Meteo. |
| **Good News** | A cover-flow carousel of solutions-journalism / feel-good stories from Good News Network, The Optimist Daily, and Positive News. |
| **US / PRC / Russian Government** | The three cards in the left column: top activity from all three U.S. branches (White House, SCOTUS opinions, Congressional Record), from Chinese state media (Xinhua, State Council), and from Russian state media (Kremlin, government.ru). |
| **Judaism / Catholicism / Islam / Hinduism / Buddhism** | Five cards in the right column, each pooling headlines from several outlets covering that religion. |

Every card is a small carousel — prev/next buttons cycle through its items — styled to look like a set of desktop widgets rather than a typical webpage.

## Architecture

```
public/           Static frontend — plain HTML/CSS/JS, no build step, no framework
  index.html       Page structure (all the cards above)
  styles.css       All styling
  script.js        Fetches each card's data from the worker and renders it
  coverflow.js      Drives the "Good News" cover-flow carousel

worker/            Cloudflare Worker — the frontend's only backend
  src/worker.js     Fetch handler; routes each card to its data
  src/snapshot.json Frozen data for every card (see below)
  wrangler.toml     Worker config
```

The frontend is entirely static and can be hosted anywhere (GitHub Pages, Cloudflare Pages, Netlify, a plain file server). It talks to the worker over CORS at a fixed URL (`WORKER_URL` near the top of each function in `script.js`/`coverflow.js`), so the worker must be deployed and reachable at that URL for the cards to populate.

## Frozen snapshot

`worker/src/worker.js` used to run on a Cloudflare Cron Trigger twice a day (7:00 AM and 7:00 PM America/New_York) and, on each run:

- pulled and summarized RSS/HTML feeds for news, government activity, and religion cards (using Claude for the harder summarization, e.g. full SCOTUS opinions and Congressional Daily Digests extracted from PDF),
- pulled tasks from the Todoist API,
- pulled events from a private Fastmail calendar ICS feed,
- pulled repo activity from the GitHub API,
- and pulled weather from Open-Meteo,

then cached the result of each in Cloudflare KV for the frontend to read.

That pipeline has been removed. The worker now does nothing but serve `worker/src/snapshot.json` — a point-in-time copy of what was in KV — with no cron trigger, no KV binding, no outbound fetches, and no secrets configured. Every card on the site will always show the same content it showed the moment this was frozen, which is why the repo is safe to make public: there's no live connection to any personal account (Todoist, Fastmail, private GitHub repos, or paid APIs) left to expose.

### Making it live again (for your own fork)

If you fork this and want a live-refreshing dashboard instead of a frozen one, you'd need to:

1. Restore a `refreshAll()`-style pipeline in `worker/src/worker.js` that fetches each source and writes to KV (check `git log` on this file for the pre-freeze version as a starting point).
2. Re-add a `[[kv_namespaces]]` binding and a `[triggers]` cron schedule to `wrangler.toml`.
3. Set your own secrets with `wrangler secret put <NAME>` for whichever sources you want live — e.g. `TODOIST_API_TOKEN`, `FASTMAIL_ICS_URL` (a private ICS feed URL, from your calendar provider's "share/publish" settings), `GITHUB_TOKEN`, `ANTHROPIC_API_KEY`, `GOVINFO_API_KEY`. None of these are required just to serve the frozen snapshot.

## Running locally

**Frontend** — no build step; serve `public/` with any static file server, e.g.:

```bash
npx serve public
# or: python3 -m http.server 8000 --directory public
```

**Worker**:

```bash
cd worker
npm install
npm run dev      # wrangler dev, local worker at http://localhost:8787
npm run deploy   # wrangler deploy, ships to Cloudflare
npm run tail     # wrangler tail, streams logs from the deployed worker
```

If you point `script.js`/`coverflow.js`'s `WORKER_URL` at `http://localhost:8787` while developing, the local worker will serve the same frozen `snapshot.json` as production.

## License

No license file is included; all rights reserved by default. Add a `LICENSE` file if you want to permit reuse.
