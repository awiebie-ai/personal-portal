import { XMLParser } from 'fast-xml-parser';

const FEEDS = [
  'https://www.cbsnews.com/latest/rss/main',
  'https://feeds.nbcnews.com/nbcnews/public/news',
  'https://abcnews.go.com/abcnews/topstories'
];

const HEADLINE_COUNT = 9;
const CANDIDATES_PER_FEED = 5; // pull extras so filtering/dedup can still hit HEADLINE_COUNT
const KV_KEY = 'headlines';
const GITHUB_KV_KEY = 'github';
const TODOIST_KV_KEY = 'todoist';
const CALENDAR_KV_KEY = 'calendar';
const WEATHER_KV_KEY = 'weather';
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

// Fixed two-city list — no geocoding step, so Open-Meteo needs no API key.
const WEATHER_CITIES = [
  { id: 'cabo-rojo', name: 'Cabo Rojo, PR', lat: 18.0866, lon: -67.1457 },
  { id: 'griffin', name: 'Griffin, GA', lat: 33.2468, lon: -84.2641 }
];

// WMO weather codes (Open-Meteo's `weather_code`) collapsed into the
// handful of icon buckets the frontend actually draws.
const WEATHER_CODES = {
  0: { label: 'Clear sky', icon: 'sun' },
  1: { label: 'Mostly clear', icon: 'sun-cloud' },
  2: { label: 'Partly cloudy', icon: 'sun-cloud' },
  3: { label: 'Overcast', icon: 'cloud' },
  45: { label: 'Fog', icon: 'fog' },
  48: { label: 'Freezing fog', icon: 'fog' },
  51: { label: 'Light drizzle', icon: 'rain' },
  53: { label: 'Drizzle', icon: 'rain' },
  55: { label: 'Dense drizzle', icon: 'rain' },
  56: { label: 'Freezing drizzle', icon: 'rain' },
  57: { label: 'Freezing drizzle', icon: 'rain' },
  61: { label: 'Light rain', icon: 'rain' },
  63: { label: 'Rain', icon: 'rain' },
  65: { label: 'Heavy rain', icon: 'rain' },
  66: { label: 'Freezing rain', icon: 'rain' },
  67: { label: 'Freezing rain', icon: 'rain' },
  71: { label: 'Light snow', icon: 'snow' },
  73: { label: 'Snow', icon: 'snow' },
  75: { label: 'Heavy snow', icon: 'snow' },
  77: { label: 'Snow grains', icon: 'snow' },
  80: { label: 'Rain showers', icon: 'rain' },
  81: { label: 'Rain showers', icon: 'rain' },
  82: { label: 'Violent rain showers', icon: 'rain' },
  85: { label: 'Snow showers', icon: 'snow' },
  86: { label: 'Snow showers', icon: 'snow' },
  95: { label: 'Thunderstorm', icon: 'storm' },
  96: { label: 'Thunderstorm with hail', icon: 'storm' },
  99: { label: 'Thunderstorm with hail', icon: 'storm' }
};

// Fixed, ordered list so the portfolio always leads with this project.
// Repos are private, so this must stay server-side behind GITHUB_TOKEN.
const GITHUB_REPOS = [
  { owner: 'awiebie-ai', repo: 'personal-portal' },
  { owner: 'awiebie-ai', repo: 'prompt-eng-interactive-tutorial' }
];

// Todoist's fixed named-color palette (API returns the name, not a hex value).
const TODOIST_COLORS = {
  berry_red: '#b8256f', red: '#db4035', orange: '#ff9933', yellow: '#fad000',
  olive_green: '#afb83b', lime_green: '#7ecc49', green: '#299438', mint_green: '#6accbc',
  teal: '#158fad', sky_blue: '#14aaf5', light_blue: '#96c3eb', blue: '#4073ff',
  grape: '#884dff', violet: '#af38eb', lavender: '#eb96eb', magenta: '#e05194',
  salmon: '#ff8d85', charcoal: '#808080', grey: '#b8b8b8', taupe: '#ccac93'
};

// Todoist priority is 1-4 with 4 = "P1" (most urgent, red) and 1 = "P4" (no color).
const TODOIST_PRIORITY_COLORS = { 4: '#d1453b', 3: '#eb8909', 2: '#246fe0', 1: '#808080' };

const TASK_COUNT = 8;
const CALENDAR_EVENT_COUNT = 10;
const CALENDAR_WINDOW_DAYS = 45; // how far ahead to expand recurring events

const LANGUAGE_COLORS = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  'Jupyter Notebook': '#DA5B0B',
  Go: '#00ADD8',
  Rust: '#dea584',
  Java: '#b07219',
  Ruby: '#701516',
  PHP: '#4F5D95',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600'
};

// Phrases that show up when a site blocks non-browser fetches instead of
// serving the article (paywalls, bot checks). Treated as "no article text".
const BLOCK_PATTERNS = /enable (javascript|js)|disable.*ad ?blocker|subscribe to (read|continue)|sign in to (read|continue)|create a free account/i;

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    // Manual refresh, e.g. `curl "https://.../refresh?secret=..."`, for
    // forcing a run outside the daily cron (dashboard's cron test UI isn't
    // reliably reachable across Cloudflare's dashboard versions).
    const url = new URL(request.url);
    if (url.pathname === '/refresh') {
      if (!env.REFRESH_SECRET || url.searchParams.get('secret') !== env.REFRESH_SECRET) {
        return jsonResponse({ status: 'error', message: 'unauthorized' }, 401);
      }
      await refreshAll(env);
      const [headlines, github, todoist, calendar, weather] = await Promise.all([
        env.HEADLINES_KV.get(KV_KEY, 'json'),
        env.HEADLINES_KV.get(GITHUB_KV_KEY, 'json'),
        env.HEADLINES_KV.get(TODOIST_KV_KEY, 'json'),
        env.HEADLINES_KV.get(CALENDAR_KV_KEY, 'json'),
        env.HEADLINES_KV.get(WEATHER_KV_KEY, 'json')
      ]);
      return jsonResponse({ status: 'ok', headlines, github, todoist, calendar, weather }, 200);
    }

    if (url.pathname === '/github') {
      return jsonResponse(await getCached(env, GITHUB_KV_KEY), 200);
    }

    if (url.pathname === '/todoist') {
      return jsonResponse(await getCached(env, TODOIST_KV_KEY), 200);
    }

    if (url.pathname === '/calendar') {
      return jsonResponse(await getCached(env, CALENDAR_KV_KEY), 200);
    }

    if (url.pathname === '/weather') {
      return jsonResponse(await getCached(env, WEATHER_KV_KEY), 200);
    }

    return jsonResponse(await getCached(env, KV_KEY), 200);
  },

  // Cloudflare cron triggers only run on fixed UTC times, but "7:00 AM
  // Eastern" shifts by an hour across the DST switch. Rather than juggle
  // transition dates, both the EDT and EST equivalents (11:00 and 12:00 UTC)
  // are registered as triggers below, and this handler only actually
  // refreshes on whichever one currently lands at 7 AM America/New_York.
  async scheduled(event, env, ctx) {
    const hour = +new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23'
    }).format(new Date());
    if (hour !== 7) return;
    ctx.waitUntil(refreshAll(env));
  }
};

async function getCached(env, key) {
  const cached = await env.HEADLINES_KV.get(key, 'json');
  return cached || { status: 'pending', items: [] };
}

async function refreshAll(env) {
  await Promise.allSettled([
    refreshHeadlines(env),
    refreshGithub(env),
    refreshTodoist(env),
    refreshCalendar(env),
    refreshWeather(env)
  ]);
}

// Each refresh leaves the previous cached value in place on failure, rather
// than overwriting it with an error, so a transient upstream outage doesn't
// blank out a card until the next successful run.
async function refreshGithub(env) {
  try {
    const items = await fetchGithubRepos(env);
    await env.HEADLINES_KV.put(GITHUB_KV_KEY, JSON.stringify({ status: 'ok', updatedAt: new Date().toISOString(), items }));
  } catch (err) {
    console.error('github refresh failed', err);
  }
}

async function refreshTodoist(env) {
  try {
    const items = await fetchTodoistTasks(env);
    await env.HEADLINES_KV.put(TODOIST_KV_KEY, JSON.stringify({ status: 'ok', updatedAt: new Date().toISOString(), items }));
  } catch (err) {
    console.error('todoist refresh failed', err);
  }
}

async function refreshCalendar(env) {
  try {
    const items = await fetchCalendarEvents(env);
    await env.HEADLINES_KV.put(CALENDAR_KV_KEY, JSON.stringify({ status: 'ok', updatedAt: new Date().toISOString(), items }));
  } catch (err) {
    console.error('calendar refresh failed', err);
  }
}

async function refreshWeather(env) {
  try {
    const items = await fetchWeatherCities();
    await env.HEADLINES_KV.put(WEATHER_KV_KEY, JSON.stringify({ status: 'ok', updatedAt: new Date().toISOString(), items }));
  } catch (err) {
    console.error('weather refresh failed', err);
  }
}

// Parsed as UTC so the weekday is derived purely from the "YYYY-MM-DD"
// components Open-Meteo returns, with no local-timezone shift involved.
function weekdayShort(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

async function fetchWeatherCities() {
  const results = [];
  for (const city of WEATHER_CITIES) {
    try {
      const params = new URLSearchParams({
        latitude: city.lat,
        longitude: city.lon,
        current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m',
        daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
        temperature_unit: 'fahrenheit',
        wind_speed_unit: 'mph',
        timezone: 'auto'
      });
      const res = await fetch('https://api.open-meteo.com/v1/forecast?' + params.toString());
      if (!res.ok) throw new Error('weather fetch failed: ' + res.status);
      const data = await res.json();
      const meta = WEATHER_CODES[data.current.weather_code] || { label: 'Unknown', icon: 'cloud' };

      // Skip index 0 (today, already covered by the current-conditions
      // block above) and take the next 3 days.
      const forecast = data.daily.time.slice(1, 4).map((dateStr, i) => {
        const dayIndex = i + 1;
        const dayMeta = WEATHER_CODES[data.daily.weather_code[dayIndex]] || { label: 'Unknown', icon: 'cloud' };
        return {
          day: weekdayShort(dateStr),
          icon: dayMeta.icon,
          condition: dayMeta.label,
          highF: Math.round(data.daily.temperature_2m_max[dayIndex]),
          lowF: Math.round(data.daily.temperature_2m_min[dayIndex]),
          rainChance: Math.round(data.daily.precipitation_probability_max[dayIndex])
        };
      });

      results.push({
        id: city.id,
        name: city.name,
        tempF: Math.round(data.current.temperature_2m),
        feelsLikeF: Math.round(data.current.apparent_temperature),
        humidity: Math.round(data.current.relative_humidity_2m),
        windMph: Math.round(data.current.wind_speed_10m),
        condition: meta.label,
        icon: meta.icon,
        highF: Math.round(data.daily.temperature_2m_max[0]),
        lowF: Math.round(data.daily.temperature_2m_min[0]),
        forecast: forecast
      });
    } catch (err) {
      console.error('weather fetch failed', city.id, err);
    }
  }
  return results;
}

async function refreshHeadlines(env) {
  const parser = new XMLParser({ ignoreAttributes: false });
  const candidates = [];

  for (const feedUrl of FEEDS) {
    try {
      const res = await fetch(feedUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const xml = await res.text();
      const data = parser.parse(xml);
      const rawItems = data?.rss?.channel?.item || [];
      const items = Array.isArray(rawItems) ? rawItems : [rawItems];

      items
        .filter((item) => !/\/video\//i.test(String(item.link || ''))) // skip live-video stubs
        .slice(0, CANDIDATES_PER_FEED)
        .forEach((item) => {
          candidates.push({
            title: stripHtml(String(item.title || '')),
            link: String(item.link || ''),
            description: stripHtml(String(item.description || ''))
          });
        });
    } catch (err) {
      console.error('feed fetch failed', feedUrl, err);
    }
  }

  const deduped = dedupeByTitle(candidates).slice(0, HEADLINE_COUNT);

  const summarized = [];
  for (const item of deduped) {
    let summary = item.description || item.title;
    try {
      let articleText = await fetchArticleText(item.link);
      if (BLOCK_PATTERNS.test(articleText) || articleText.length < 200) {
        articleText = ''; // blocked or too thin to be real article body
      }
      if (articleText) {
        summary = await summarizeWithClaude(env, item.title, articleText);
      }
    } catch (err) {
      console.error('summarize failed', item.link, err);
    }
    summarized.push({ title: item.title, summary, link: item.link });
  }

  await env.HEADLINES_KV.put(KV_KEY, JSON.stringify({
    status: 'ok',
    updatedAt: new Date().toISOString(),
    items: summarized
  }));
}

async function fetchGithubRepos(env) {
  const headers = {
    Authorization: 'Bearer ' + env.GITHUB_TOKEN,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'personal-portal-worker',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  const results = [];
  for (const { owner, repo } of GITHUB_REPOS) {
    try {
      const [repoRes, commitsRes] = await Promise.all([
        fetch('https://api.github.com/repos/' + owner + '/' + repo, { headers }),
        fetch('https://api.github.com/repos/' + owner + '/' + repo + '/commits?per_page=1', { headers })
      ]);
      if (!repoRes.ok) throw new Error('repo fetch failed: ' + repoRes.status);
      const repoData = await repoRes.json();

      let latestCommit = null;
      if (commitsRes.ok) {
        const commits = await commitsRes.json();
        if (Array.isArray(commits) && commits[0]) {
          latestCommit = {
            message: commits[0].commit.message.split('\n')[0],
            date: commits[0].commit.committer.date
          };
        }
      }

      results.push({
        name: repoData.name,
        fullName: repoData.full_name,
        description: repoData.description || '',
        url: repoData.html_url,
        language: repoData.language,
        languageColor: LANGUAGE_COLORS[repoData.language] || '#8b949e',
        visibility: repoData.private ? 'Private' : 'Public',
        openIssues: repoData.open_issues_count,
        updatedAt: repoData.pushed_at,
        latestCommit
      });
    } catch (err) {
      console.error('github fetch failed', owner, repo, err);
    }
  }
  return results;
}

// Requires TODOIST_API_TOKEN, set via `wrangler secret put TODOIST_API_TOKEN`.
// Todoist retired the old rest/v2 endpoints in favor of a unified api/v1,
// whose list endpoints return { results, next_cursor } instead of a bare array.
async function fetchTodoistTasks(env) {
  const headers = { Authorization: 'Bearer ' + env.TODOIST_API_TOKEN };

  const [tasksRes, projectsRes] = await Promise.all([
    fetch('https://api.todoist.com/api/v1/tasks', { headers }),
    fetch('https://api.todoist.com/api/v1/projects', { headers })
  ]);
  if (!tasksRes.ok) throw new Error('todoist tasks fetch failed: ' + tasksRes.status);

  const tasksBody = await tasksRes.json();
  const tasks = tasksBody.results || [];
  const projectsBody = projectsRes.ok ? await projectsRes.json() : { results: [] };
  const projects = projectsBody.results || [];
  const projectById = {};
  projects.forEach((p) => { projectById[p.id] = p; });

  // Due-but-undated tasks sort last; otherwise earliest due date first,
  // then higher priority first as a tiebreaker.
  tasks.sort((a, b) => {
    const aDate = a.due ? a.due.date : null;
    const bDate = b.due ? b.due.date : null;
    if (aDate && bDate && aDate !== bDate) return aDate < bDate ? -1 : 1;
    if (aDate && !bDate) return -1;
    if (!aDate && bDate) return 1;
    return b.priority - a.priority;
  });

  return tasks.slice(0, TASK_COUNT).map((task) => {
    const project = projectById[task.project_id];
    return {
      id: task.id,
      content: task.content,
      url: 'https://todoist.com/showTask?id=' + task.id,
      priority: task.priority,
      priorityColor: TODOIST_PRIORITY_COLORS[task.priority] || TODOIST_PRIORITY_COLORS[1],
      due: task.due ? normalizeDue(task.due) : null,
      project: project ? { name: project.name, color: TODOIST_COLORS[project.color] || '#b8b8b8' } : null
    };
  });
}

// Todoist's api/v1 packs a due time straight into `date` (e.g. "2026-08-18T16:00:00",
// no offset — a floating local time, confirmed via its sibling `timezone: null` field)
// instead of the old v2 split between a bare date and a separate `datetime`. Split it
// back out so the frontend's { date: 'YYYY-MM-DD', datetime: string|null } contract holds.
function normalizeDue(due) {
  if (due.date && due.date.includes('T')) {
    return { date: due.date.slice(0, 10), datetime: due.date };
  }
  return { date: due.date, datetime: null };
}

// Requires FASTMAIL_ICS_URL, set via `wrangler secret put FASTMAIL_ICS_URL`.
// This is a private feed URL (contains an access token) — never exposed to the client.
async function fetchCalendarEvents(env) {
  const res = await fetch(env.FASTMAIL_ICS_URL, { headers: { 'User-Agent': 'personal-portal-worker' } });
  if (!res.ok) throw new Error('calendar fetch failed: ' + res.status);
  const ics = await res.text();

  const now = new Date();
  const windowEnd = new Date(now.getTime() + CALENDAR_WINDOW_DAYS * 86400000);

  const events = parseIcsEvents(ics)
    .flatMap((event) => expandOccurrences(event, now, windowEnd))
    .filter((occ) => occ.end > now)
    .sort((a, b) => a.start - b.start)
    .slice(0, CALENDAR_EVENT_COUNT);

  return events.map((occ) => ({
    uid: occ.uid,
    title: occ.title,
    start: occ.start.toISOString(),
    end: occ.end.toISOString(),
    allDay: occ.allDay,
    location: occ.location || null
  }));
}

function dedupeByTitle(items) {
  const kept = [];
  items.forEach((item) => {
    const isDup = kept.some((existing) => titleSimilarity(existing.title, item.title) > 0.4);
    if (!isDup) kept.push(item);
  });
  return kept;
}

function titleSimilarity(a, b) {
  const wordsOf = (t) => new Set(
    t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3)
  );
  const wa = wordsOf(a);
  const wb = wordsOf(b);
  if (!wa.size || !wb.size) return 0;
  let overlap = 0;
  wa.forEach((w) => { if (wb.has(w)) overlap += 1; });
  const union = new Set([...wa, ...wb]).size;
  return overlap / union;
}

async function fetchArticleText(url) {
  if (!url) return '';
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return '';

  let text = '';
  await new HTMLRewriter()
    .on('p', {
      text(chunk) {
        text += chunk.text;
      }
    })
    .transform(res)
    .arrayBuffer(); // drains the stream so the handlers above actually run

  return text.replace(/\s+/g, ' ').trim().slice(0, 6000); // cap input size sent to Claude
}

async function summarizeWithClaude(env, title, articleText) {
  const prompt =
    'Summarize the key points of this news article in 2-3 concise sentences. ' +
    'Be neutral and factual, and focus on what happened and why it matters. ' +
    "Do not mention the outlet's name. " +
    'Respond with plain prose only: no markdown, no headers, no bullet points, no preamble.\n\n' +
    'Headline: ' + title + '\n\n' +
    'Article text:\n' + articleText;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!res.ok) {
    throw new Error('Claude API error: ' + res.status + ' ' + (await res.text()));
  }
  const data = await res.json();
  const text = (data.content && data.content[0] && data.content[0].text || '').trim();
  // Defensive cleanup in case the model still opens with a heading despite instructions.
  return text.replace(/^#+\s*summary\s*\n+/i, '').trim() || title;
}

function stripHtml(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, '')).trim();
}

// Some feeds (e.g. CBS) HTML-escape text inside CDATA blocks, which XML
// parsers correctly leave untouched — so entities like &#039; survive
// straight through unless decoded here.
function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, function (_, dec) { return String.fromCodePoint(parseInt(dec, 10)); })
    .replace(/&#x([0-9a-fA-F]+);/g, function (_, hex) { return String.fromCodePoint(parseInt(hex, 16)); })
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

// ---- Minimal iCalendar (RFC 5545) parsing ----
// Handles the subset real-world calendar exports use: unfolded property
// lines, VALUE=DATE (all-day) vs. DATE-TIME (with Z or TZID), and RRULE
// expansion for DAILY/WEEKLY/MONTHLY/YEARLY with INTERVAL/COUNT/UNTIL/BYDAY.
// Exotic recurrence rules (BYSETPOS, BYMONTHDAY combos, RECURRENCE-ID
// overrides) are intentionally out of scope for a personal dashboard.

function parseIcsEvents(ics) {
  const unfolded = ics.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').replace(/\r\n/g, '\n');
  const blocks = unfolded.split('BEGIN:VEVENT').slice(1);

  return blocks.map((block) => {
    const body = block.split('END:VEVENT')[0];
    const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);

    const props = {};
    const exdates = [];
    lines.forEach((line) => {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) return;
      const rawName = line.slice(0, colonIdx);
      const value = line.slice(colonIdx + 1);
      const [name, ...paramParts] = rawName.split(';');
      const params = {};
      paramParts.forEach((p) => {
        const [k, v] = p.split('=');
        if (k) params[k] = v;
      });

      if (name === 'EXDATE') {
        value.split(',').forEach((v) => exdates.push(parseIcsDate(v.trim(), params).date.getTime()));
        return;
      }
      props[name] = { value, params };
    });

    if (!props.DTSTART || !props.SUMMARY) return null;
    if (props.STATUS && props.STATUS.value === 'CANCELLED') return null;

    const dtstart = parseIcsDate(props.DTSTART.value, props.DTSTART.params);
    let dtend;
    if (props.DTEND) {
      dtend = parseIcsDate(props.DTEND.value, props.DTEND.params).date;
    } else if (props.DURATION) {
      dtend = new Date(dtstart.date.getTime() + parseIcsDuration(props.DURATION.value));
    } else {
      dtend = new Date(dtstart.date.getTime() + (dtstart.allDay ? 86400000 : 3600000));
    }

    return {
      uid: props.UID ? props.UID.value : props.SUMMARY.value + dtstart.date.getTime(),
      title: props.SUMMARY.value.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/gi, ' '),
      location: props.LOCATION ? props.LOCATION.value.replace(/\\,/g, ',').replace(/\\;/g, ';') : '',
      allDay: dtstart.allDay,
      start: dtstart.date,
      end: dtend,
      durationMs: dtend.getTime() - dtstart.date.getTime(),
      rrule: props.RRULE ? props.RRULE.value : null,
      exdates
    };
  }).filter(Boolean);
}

function parseIcsDate(value, params) {
  if (params.VALUE === 'DATE' || /^\d{8}$/.test(value)) {
    const y = +value.slice(0, 4), mo = +value.slice(4, 6), d = +value.slice(6, 8);
    return { date: new Date(Date.UTC(y, mo - 1, d)), allDay: true };
  }
  const m = /^(\d{8})T(\d{6})(Z)?$/.exec(value);
  if (!m) return { date: new Date(value), allDay: false };
  const [, datePart, timePart, isUtc] = m;
  if (isUtc) {
    const y = +datePart.slice(0, 4), mo = +datePart.slice(4, 6), d = +datePart.slice(6, 8);
    const h = +timePart.slice(0, 2), mi = +timePart.slice(2, 4), s = +timePart.slice(4, 6);
    return { date: new Date(Date.UTC(y, mo - 1, d, h, mi, s)), allDay: false };
  }
  if (params.TZID) {
    return { date: zonedTimeToUtc(datePart, timePart, params.TZID), allDay: false };
  }
  // Floating time with no zone info — treat as UTC (best effort).
  const y = +datePart.slice(0, 4), mo = +datePart.slice(4, 6), d = +datePart.slice(6, 8);
  const h = +timePart.slice(0, 2), mi = +timePart.slice(2, 4), s = +timePart.slice(4, 6);
  return { date: new Date(Date.UTC(y, mo - 1, d, h, mi, s)), allDay: false };
}

function zonedTimeToUtc(datePart, timePart, tz) {
  const y = +datePart.slice(0, 4), mo = +datePart.slice(4, 6), d = +datePart.slice(6, 8);
  const h = +timePart.slice(0, 2), mi = +timePart.slice(2, 4), s = +timePart.slice(4, 6);
  const guessMs = Date.UTC(y, mo - 1, d, h, mi, s);
  let offsetMs;
  try {
    offsetMs = tzOffsetMs(tz, guessMs);
  } catch (err) {
    offsetMs = 0; // unknown TZID — fall back to UTC rather than throwing
  }
  return new Date(guessMs - offsetMs);
}

function tzOffsetMs(tz, utcMs) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const parts = {};
  dtf.formatToParts(new Date(utcMs)).forEach((p) => { parts[p.type] = p.value; });
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - utcMs;
}

function parseIcsDuration(value) {
  const m = /^([+-]?)P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value);
  if (!m) return 3600000;
  const sign = m[1] === '-' ? -1 : 1;
  const [, , weeks, days, hours, mins, secs] = m;
  const ms = ((+weeks || 0) * 7 * 86400 + (+days || 0) * 86400 + (+hours || 0) * 3600 + (+mins || 0) * 60 + (+secs || 0)) * 1000;
  return sign * ms;
}

function expandOccurrences(event, windowStart, windowEnd) {
  if (!event.rrule) {
    return event.exdates.includes(event.start.getTime())
      ? []
      : [{ uid: event.uid, title: event.title, location: event.location, allDay: event.allDay, start: event.start, end: event.end }];
  }

  const rule = {};
  event.rrule.split(';').forEach((pair) => {
    const [k, v] = pair.split('=');
    if (k) rule[k] = v;
  });

  const interval = +rule.INTERVAL || 1;
  const count = rule.COUNT ? +rule.COUNT : null;
  const until = rule.UNTIL ? parseIcsDate(rule.UNTIL, {}).date : null;
  const byDay = rule.BYDAY ? rule.BYDAY.split(',') : null;
  const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

  const occurrences = [];
  let cursor = new Date(event.start.getTime());
  let iterations = 0;
  let produced = 0;
  const HARD_CAP = 2000;

  while (iterations < HARD_CAP) {
    iterations += 1;
    if (until && cursor > until) break;
    if (count !== null && produced >= count) break;
    if (cursor > windowEnd) break;

    let matches = true;
    if (rule.FREQ === 'WEEKLY' && byDay) {
      matches = byDay.includes(WEEKDAYS[cursor.getUTCDay()]);
    }

    if (matches) {
      produced += 1;
      if (cursor >= windowStart || new Date(cursor.getTime() + event.durationMs) >= windowStart) {
        if (!event.exdates.includes(cursor.getTime())) {
          occurrences.push({
            uid: event.uid + '-' + cursor.getTime(),
            title: event.title,
            location: event.location,
            allDay: event.allDay,
            start: new Date(cursor.getTime()),
            end: new Date(cursor.getTime() + event.durationMs)
          });
        }
      }
    }

    // Step the cursor. Weekly BYDAY walks day-by-day so every listed
    // weekday is visited; other rules jump straight to the next period.
    if (rule.FREQ === 'DAILY') {
      cursor = new Date(cursor.getTime() + interval * 86400000);
    } else if (rule.FREQ === 'WEEKLY') {
      if (byDay) {
        cursor = new Date(cursor.getTime() + 86400000);
        if (WEEKDAYS[cursor.getUTCDay()] === WEEKDAYS[event.start.getUTCDay()]) {
          cursor = new Date(cursor.getTime() + (interval - 1) * 7 * 86400000);
        }
      } else {
        cursor = new Date(cursor.getTime() + interval * 7 * 86400000);
      }
    } else if (rule.FREQ === 'MONTHLY') {
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + interval, cursor.getUTCDate(),
        cursor.getUTCHours(), cursor.getUTCMinutes(), cursor.getUTCSeconds()));
    } else if (rule.FREQ === 'YEARLY') {
      cursor = new Date(Date.UTC(cursor.getUTCFullYear() + interval, cursor.getUTCMonth(), cursor.getUTCDate(),
        cursor.getUTCHours(), cursor.getUTCMinutes(), cursor.getUTCSeconds()));
    } else {
      break; // unsupported FREQ
    }
  }

  return occurrences;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders() }
  });
}
