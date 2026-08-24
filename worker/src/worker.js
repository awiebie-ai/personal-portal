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
const GOV_US_KV_KEY = 'gov-us';
const JEWISH_KV_KEY = 'jewish';
const CATHOLIC_KV_KEY = 'catholic';
const ISLAMIC_KV_KEY = 'islamic';
const HINDU_KV_KEY = 'hindu';
const BUDDHIST_KV_KEY = 'buddhist';
const GOODNEWS_KV_KEY = 'goodnews';
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

// Right-column "Judaism" card: pooled headlines across five Jewish/Israeli
// outlets, mirroring the gov cards' cheap approach (feed title + trimmed
// feed description, no per-article Claude summarization). Times of Israel
// and Chabad.org both sit behind Cloudflare bot protection that blocks some
// non-browser traffic, so each feed is fetched independently and a failure
// there just means fewer candidates from that source, not a blank card.
const JEWISH_HEADLINE_COUNT = 7;
// Card shows one item at a time and trims to fit via fitText() in
// script.js, so this just needs to be generous enough that the real
// constraint is always the rendered box, not this cap.
const JEWISH_SUMMARY_MAX = 500;
const JEWISH_FEEDS = [
  { name: 'JTA', url: 'https://www.jta.org/feed', count: 3 },
  { name: 'The Times of Israel', url: 'https://www.timesofisrael.com/feed/', count: 2 },
  { name: 'The Jerusalem Post', url: 'https://www.jpost.com/rss/rssfeedsfrontpage.aspx', count: 3 },
  { name: 'Arutz Sheva', url: 'https://www.israelnationalnews.com/Rss.aspx', count: 2 },
  { name: 'Chabad.org', url: 'https://www.chabad.org/tools/rss/dailystudy_podcast.xml', count: 1 }
];

// Right-column "Catholicism" card, same pattern as the Judaism card above.
// OSV News sits behind Cloudflare bot protection like ToI/Chabad.org do.
// National Catholic Register's <description> is just the literal word
// "news" (real text lives in <content:encoded>), handled in
// catholicCandidateSummary below. USCCB's feed is fetched separately with a
// regex extractor instead of the shared XMLParser — its escaped-HTML
// descriptions across ~50 items trip fast-xml-parser's entity-expansion
// guard the same way the Congressional Record feed's did.
const CATHOLIC_HEADLINE_COUNT = 7;
const CATHOLIC_SUMMARY_MAX = 500;
const CATHOLIC_FEEDS = [
  { name: 'Vatican News', url: 'https://www.vaticannews.va/en.rss.xml', count: 3 },
  { name: 'Catholic News Agency', url: 'https://www.catholicnewsagency.com/rss/news.xml', count: 3 },
  { name: 'OSV News', url: 'https://www.osvnews.com/feed/', count: 2 },
  { name: 'National Catholic Register', url: 'https://www.ncregister.com/feeds/general-news.xml', count: 2 }
];
const USCCB_FEED_URL = 'https://www.usccb.org/news.rss';
const USCCB_ITEM_COUNT = 1;

// Right-column "Islam" card, same pattern as the two religion cards above.
// Al Arabiya English's feed consistently returns a 403 "access denied" page
// (a WAF block, not a bad URL) from this dev environment, tolerated the
// same way as OSV News/ToI/Chabad. Religion News Service's feed covers all
// religions, so its candidates are filtered down to ones actually tagged or
// titled Islam/Muslim before being pooled. Middle East Eye ships its
// <description> as escaped HTML with the headline repeated in a leading
// <h2> and packs enough entities across 20 items to trip fast-xml-parser's
// entity-expansion guard (same issue as USCCB above), so it's fetched with
// its own regex extractor instead of the shared XMLParser.
const ISLAMIC_HEADLINE_COUNT = 7;
const ISLAMIC_SUMMARY_MAX = 500;
const ISLAM_KEYWORDS = /islam|muslim/i;
const ISLAMIC_FEEDS = [
  { name: 'Al Jazeera English', url: 'https://www.aljazeera.com/xml/rss/all.xml', count: 3 },
  { name: 'Religion News Service', url: 'https://religionnews.com/feed/', count: 3, filterIslam: true },
  { name: 'Al Arabiya English', url: 'https://english.alarabiya.net/tools/rss', count: 2 },
  { name: 'MuslimMatters.org', url: 'https://muslimmatters.org/feed/', count: 1 }
];
const MEE_FEED_URL = 'https://www.middleeasteye.net/rss';
const MEE_ITEM_COUNT = 3;

// Right-column "Hinduism" card, same pattern as the three religion cards
// above. Hindu American Foundation's <description> is just WordPress's
// "The post ... appeared first on ..." boilerplate with no real excerpt, so
// it falls back to the title (same `|| title` fallback every card here
// already uses). ISKCON News's feed is unusually large (~2.5MB, 1000 items)
// since it doesn't truncate, so it's fetched with a regex extractor that
// stops scanning as soon as it has enough items, rather than paying to
// parse the whole thing through the shared XMLParser. Hindu-blog.com is a
// Blogger/Atom feed (feed/entry, not rss/channel/item), reached via its
// Feedburner URL since Workers' fetch would otherwise need to follow a
// redirect to get there. (Patheos' Hindu channel was dropped — its feed's
// most recent post was from 2021, too dormant to be useful here.)
const HINDU_HEADLINE_COUNT = 7;
const HINDU_SUMMARY_MAX = 500;
const HINDU_FEEDS = [
  { name: 'Hindu Press International', url: 'https://www.hinduismtoday.com/hpi/feed/', count: 3 },
  { name: 'Hindu American Foundation', url: 'https://www.hinduamerican.org/feed/', count: 2 }
];
const ISKCON_FEED_URL = 'https://iskconnews.org/feed/';
const ISKCON_ITEM_COUNT = 3;
const HINDU_BLOG_FEED_URL = 'http://feeds.feedburner.com/hindublog';
const HINDU_BLOG_ITEM_COUNT = 2;

// Right-column "Buddhism" card, same pattern as the four religion cards
// above. The Buddhist Channel and Patheos' Buddhist channel were both
// dropped: buddhistchannel.tv has no working recency-ordered feed (its only
// discoverable RSS URL is an 11MB dump of its entire undated article
// archive under a generic phpwcms placeholder title, not a real headline
// feed), and Patheos' Buddhist blog is marked dormant in its own page
// markup — same issue that got Patheos dropped from the Hindu card.
// Religion Unplugged covers all religions, so its candidates are filtered
// down to ones tagged or titled Buddhism/Buddhist first. Buddhistdoor
// Global's feed is valid but currently returns zero items — kept in the
// pool anyway since a feed with nothing to give just contributes nothing,
// costing this card little if it stays empty and nothing if it recovers.
const BUDDHIST_HEADLINE_COUNT = 7;
const BUDDHIST_SUMMARY_MAX = 500;
const BUDDHISM_KEYWORDS = /buddh/i;
const BUDDHIST_FEEDS = [
  { name: 'Lion’s Roar', url: 'https://www.lionsroar.com/feed/', count: 3 },
  { name: 'Tricycle', url: 'https://tricycle.org/feed/', count: 3 },
  { name: 'Religion Unplugged', url: 'https://religionunplugged.com/news?format=rss', count: 2, filterBuddhism: true },
  { name: 'Buddhistdoor Global', url: 'https://www.buddhistdoor.net/feed/', count: 2 }
];

// Center-column "Good News" cover-flow card: pooled highlights across five
// solutions-journalism/feel-good outlets, same pooling pattern as the
// religion cards above. Sunny Skyz's <description> is just a lead image
// with no text and no richer field to fall back to (unlike Catholic's
// content:encoded), so it relies on the shared `|| title` fallback below.
const GOODNEWS_HEADLINE_COUNT = 8;
const GOODNEWS_SUMMARY_MAX = 400;
const GOODNEWS_FEEDS = [
  { name: 'Good News Network', url: 'https://www.goodnewsnetwork.org/feed/', count: 3 },
  { name: 'Positive News', url: 'https://www.positive.news/feed/', count: 2 },
  { name: 'Reasons to Be Cheerful', url: 'https://reasonstobecheerful.world/feed/', count: 2 },
  { name: 'Upworthy', url: 'https://www.upworthy.com/feed/', count: 2 },
  { name: 'Sunny Skyz', url: 'https://www.sunnyskyz.com/rss_tebow.php', count: 2 }
];

// Left-column "U.S. Government" card: top 3 items from each of the three
// branches. Sourced straight from official .gov/.gov-adjacent feeds — no
// Claude summarization here, just cleaned-up excerpts, to keep this card
// cheap and simple per the original spec.
const GOV_BRANCH_ITEM_COUNT = 3;
// Cards show one story at a time (see gov-body in script.js) rather than a
// scrollable list, so there's much more room per item than the old 220-char
// cap assumed.
const GOV_SUMMARY_MAX = 500;
const WHITEHOUSE_FEED_URL = 'https://www.whitehouse.gov/news/feed/';
const CONGRESS_RECORD_FEED_URL = 'https://www.govinfo.gov/rss/crec.xml';
// Term index in this URL is fixed by SCOTUS (25 = October Term 2025); bump
// to 26 once October Term 2026 opinions start posting.
const SCOTUS_OPINIONS_URL = 'https://www.supremecourt.gov/opinions/slipopinion/25';

// Left-column "PRC Government" card. Neither Xinhua nor the State Council
// publish a live RSS feed any more (Xinhua's old feeds are frozen circa
// 2017-2020), so both are scraped straight from their English-language
// listing pages, same approach as the SCOTUS table above.
const GOV_CN_KV_KEY = 'gov-cn';
const GOV_CN_SOURCE_ITEM_COUNT = 5; // 2 sources x 5 = 10 items total
const XINHUA_CHINA_URL = 'https://english.news.cn/china/index.htm';
const STATE_COUNCIL_NEWS_URL = 'https://english.www.gov.cn/news';

// Left-column "Russian Government" card. Unlike Xinhua/State Council, both
// of these still run real, current RSS/Atom feeds with usable descriptions
// already inline — no per-article scraping needed. Note: plain http (not
// https) — the https listeners on these hosts don't reliably terminate TLS
// for outside traffic.
const GOV_RU_KV_KEY = 'gov-ru';
const GOV_RU_SOURCE_ITEM_COUNT = 5; // 2 sources x 5 = 10 items total
const KREMLIN_FEED_URL = 'http://en.kremlin.ru/events/president/news/feed';
const GOVERNMENT_RU_FEED_URL = 'http://government.ru/en/news/rss/';

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
      const [headlines, github, todoist, calendar, weather, govUs, govCn, govRu, jewish, catholic, islamic, hindu, buddhist, goodNews] = await Promise.all([
        env.HEADLINES_KV.get(KV_KEY, 'json'),
        env.HEADLINES_KV.get(GITHUB_KV_KEY, 'json'),
        env.HEADLINES_KV.get(TODOIST_KV_KEY, 'json'),
        env.HEADLINES_KV.get(CALENDAR_KV_KEY, 'json'),
        env.HEADLINES_KV.get(WEATHER_KV_KEY, 'json'),
        env.HEADLINES_KV.get(GOV_US_KV_KEY, 'json'),
        env.HEADLINES_KV.get(GOV_CN_KV_KEY, 'json'),
        env.HEADLINES_KV.get(GOV_RU_KV_KEY, 'json'),
        env.HEADLINES_KV.get(JEWISH_KV_KEY, 'json'),
        env.HEADLINES_KV.get(CATHOLIC_KV_KEY, 'json'),
        env.HEADLINES_KV.get(ISLAMIC_KV_KEY, 'json'),
        env.HEADLINES_KV.get(HINDU_KV_KEY, 'json'),
        env.HEADLINES_KV.get(BUDDHIST_KV_KEY, 'json'),
        env.HEADLINES_KV.get(GOODNEWS_KV_KEY, 'json')
      ]);
      return jsonResponse({ status: 'ok', headlines, github, todoist, calendar, weather, govUs, govCn, govRu, jewish, catholic, islamic, hindu, buddhist, goodNews }, 200);
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

    if (url.pathname === '/gov/us') {
      return jsonResponse(await getCached(env, GOV_US_KV_KEY), 200);
    }

    if (url.pathname === '/gov/cn') {
      return jsonResponse(await getCached(env, GOV_CN_KV_KEY), 200);
    }

    if (url.pathname === '/gov/ru') {
      return jsonResponse(await getCached(env, GOV_RU_KV_KEY), 200);
    }

    if (url.pathname === '/religion/jewish') {
      return jsonResponse(await getCached(env, JEWISH_KV_KEY), 200);
    }

    if (url.pathname === '/religion/catholic') {
      return jsonResponse(await getCached(env, CATHOLIC_KV_KEY), 200);
    }

    if (url.pathname === '/religion/islamic') {
      return jsonResponse(await getCached(env, ISLAMIC_KV_KEY), 200);
    }

    if (url.pathname === '/religion/hindu') {
      return jsonResponse(await getCached(env, HINDU_KV_KEY), 200);
    }

    if (url.pathname === '/religion/buddhist') {
      return jsonResponse(await getCached(env, BUDDHIST_KV_KEY), 200);
    }

    if (url.pathname === '/good-news') {
      return jsonResponse(await getCached(env, GOODNEWS_KV_KEY), 200);
    }

    return jsonResponse(await getCached(env, KV_KEY), 200);
  },

  // Cloudflare cron triggers only run on fixed UTC times, but "7:00 AM/PM
  // Eastern" shifts by an hour across the DST switch. Rather than juggle
  // transition dates, both the EDT and EST equivalents of each target hour
  // (11:00/12:00 UTC for 7 AM, 23:00/00:00 UTC for 7 PM) are registered as
  // triggers in wrangler.toml, and this handler only actually refreshes on
  // whichever one currently lands at 7 AM or 7 PM America/New_York.
  async scheduled(event, env, ctx) {
    const hour = +new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23'
    }).format(new Date());
    if (hour !== 7 && hour !== 19) return;
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
    refreshWeather(env),
    refreshGovUs(env),
    refreshGovCn(env),
    refreshGovRu(env),
    refreshJewish(env),
    refreshCatholic(env),
    refreshIslamic(env),
    refreshHindu(env),
    refreshBuddhist(env),
    refreshGoodNews(env)
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

async function refreshGovUs(env) {
  try {
    const [whiteHouse, congress, scotus] = await Promise.all([
      fetchWhiteHouseReleases(),
      fetchCongressRecord(),
      fetchScotusOpinions()
    ]);
    const branches = [
      { name: 'White House', items: whiteHouse },
      { name: 'Congress', items: congress },
      { name: 'Supreme Court', items: scotus }
    ];
    await env.HEADLINES_KV.put(GOV_US_KV_KEY, JSON.stringify({ status: 'ok', updatedAt: new Date().toISOString(), branches }));
  } catch (err) {
    console.error('gov-us refresh failed', err);
  }
}

function truncateSummary(text, maxLen) {
  const limit = maxLen || GOV_SUMMARY_MAX;
  // WordPress-fed sources (e.g. JTA) prefix "The post ... appeared first on
  // ..." with a bare "--" separator line, which the first replace alone
  // leaves dangling.
  const clean = text.replace(/\s*The post.*$/is, '').replace(/\s*--\s*$/, '').trim();
  if (clean.length <= limit) return clean;
  return clean.slice(0, limit).replace(/\s+\S*$/, '') + '…';
}

async function fetchWhiteHouseReleases() {
  const parser = new XMLParser({ ignoreAttributes: false });
  const res = await fetch(WHITEHOUSE_FEED_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const xml = await res.text();
  const data = parser.parse(xml);
  const rawItems = data?.rss?.channel?.item || [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];

  return items.slice(0, GOV_BRANCH_ITEM_COUNT).map((item) => ({
    title: stripHtml(String(item.title || '')),
    summary: truncateSummary(stripHtml(String(item.description || ''))),
    link: String(item.link || '')
  }));
}

// govinfo's "new items" feed isn't ordered by the Record's own date, so it's
// re-sorted by pubDate here to actually surface the most recent editions.
async function fetchCongressRecord() {
  const parser = new XMLParser({ ignoreAttributes: false });
  const res = await fetch(CONGRESS_RECORD_FEED_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  // <description> in this feed is just a list of PDF/metadata download
  // links (unused below) but packs enough &nbsp;-style entities across 100
  // items to blow fast-xml-parser's entity-expansion guard. Strip it
  // before parsing rather than raising the parser's limit.
  const xml = (await res.text()).replace(/<description>[\s\S]*?<\/description>/g, '');
  const data = parser.parse(xml);
  const rawItems = data?.rss?.channel?.item || [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];

  const sorted = items
    .map((item) => ({
      title: stripHtml(String(item.title || '')),
      link: String(item.link || ''),
      pubDate: new Date(item.pubDate || 0)
    }))
    .sort((a, b) => b.pubDate - a.pubDate);

  return sorted.slice(0, GOV_BRANCH_ITEM_COUNT).map((item) => {
    const dateMatch = /\(([^)]+)\)\s*$/.exec(item.title);
    return {
      title: 'Congressional Record — ' + (dateMatch ? dateMatch[1] : item.title),
      summary: 'Official daily record of proceedings and debate in the U.S. House and Senate.',
      link: item.link
    };
  });
}

// supremecourt.gov has no working RSS feed for opinions, so this scrapes the
// slip-opinion table directly (server-rendered HTML, newest row first). The
// row regex mirrors the fixed markup GET /opinions/slipopinion/<term> emits.
async function fetchScotusOpinions() {
  const res = await fetch(SCOTUS_OPINIONS_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();

  const rowRe = /<tr>\s*<td[^>]*>\d*<\/td>\s*<td[^>]*>([\d/]+)<\/td>\s*<td[^>]*>[^<]*<\/td>\s*<td[^>]*><a href='([^']+)'[^>]*title="([^"]*)">([^<]+)<\/a>/g;

  const results = [];
  let match;
  while ((match = rowRe.exec(html)) && results.length < GOV_BRANCH_ITEM_COUNT) {
    const [, date, href, title, caseName] = match;
    results.push({
      title: decodeEntities(caseName) + ' (' + date + ')',
      summary: truncateSummary(decodeEntities(title)),
      link: href.startsWith('http') ? href : 'https://www.supremecourt.gov' + href
    });
  }
  return results;
}

async function refreshGovCn(env) {
  try {
    const [xinhua, stateCouncil] = await Promise.all([
      fetchXinhuaArticles(),
      fetchStateCouncilArticles()
    ]);
    const branches = [
      { name: 'Xinhua', items: xinhua },
      { name: 'The State Council', items: stateCouncil }
    ];
    await env.HEADLINES_KV.put(GOV_CN_KV_KEY, JSON.stringify({ status: 'ok', updatedAt: new Date().toISOString(), branches }));
  } catch (err) {
    console.error('gov-cn refresh failed', err);
  }
}

// Xinhua's China index mixes today's stories in with older "evergreen"
// features, so items are sorted by the date embedded in their own URL
// (../YYYYMMDD/.../c.html) rather than trusted on page order.
async function fetchXinhuaArticles() {
  const res = await fetch(XINHUA_CHINA_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const rowRe = /<a href="(\.\.\/(\d{8})\/[^"]+)"[^>]*>([^<]{8,})<\/a>/g;

  const seen = new Set();
  const candidates = [];
  let match;
  while ((match = rowRe.exec(html))) {
    const [, href, date, title] = match;
    if (seen.has(href)) continue;
    seen.add(href);
    candidates.push({ date, title: decodeEntities(title.trim()), link: 'https://english.news.cn/' + href.replace(/^\.\.\//, '') });
  }
  candidates.sort((a, b) => b.date.localeCompare(a.date));

  return fillArticleSummaries(candidates.slice(0, GOV_CN_SOURCE_ITEM_COUNT));
}

async function fetchStateCouncilArticles() {
  const res = await fetch(STATE_COUNCIL_NEWS_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const rowRe = /<a shape="rect" href="(\/\/english\.www\.gov\.cn\/news\/(\d{6})\/(\d{2})\/content_[^"]+)">([^<]{8,})<\/a>/g;

  const seen = new Set();
  const candidates = [];
  let match;
  while ((match = rowRe.exec(html))) {
    const [, href, yearMonth, day, title] = match;
    if (seen.has(href)) continue;
    seen.add(href);
    candidates.push({ date: yearMonth + day, title: decodeEntities(title.trim()), link: 'https:' + href });
  }
  candidates.sort((a, b) => b.date.localeCompare(a.date));

  return fillArticleSummaries(candidates.slice(0, GOV_CN_SOURCE_ITEM_COUNT));
}

async function fillArticleSummaries(items) {
  const results = [];
  for (const item of items) {
    let summary = '';
    try {
      summary = truncateSummary(await fetchArticleParagraphs(item.link));
    } catch (err) {
      console.error('article fetch failed', item.link, err);
    }
    results.push({ title: item.title, summary: summary || item.title, link: item.link });
  }
  return results;
}

// Separate from fetchArticleText below (used by the main headlines card,
// which feeds Claude and tolerates noisy input) because these sites'
// templates put boilerplate ("Source: Xinhua", the State Council's "App"
// download link, an inline date-injection <script>) inside <p> tags
// themselves, which would otherwise leak into a summary nobody summarizes.
async function fetchArticleParagraphs(url) {
  if (!url) return '';
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return '';

  let text = '';
  let skipParagraph = false;
  let insideScript = false;
  await new HTMLRewriter()
    .on('script', {
      element(el) {
        insideScript = true;
        el.onEndTag(() => { insideScript = false; });
      }
    })
    .on('p', {
      element(el) {
        const cls = el.getAttribute('class') || '';
        skipParagraph = /^(source|editor|time)$/i.test(cls) || /^Top_/i.test(cls);
      },
      text(chunk) {
        if (!skipParagraph && !insideScript) text += chunk.text;
      }
    })
    .transform(res)
    .arrayBuffer();

  return text.replace(/\s+/g, ' ').trim();
}

async function refreshGovRu(env) {
  try {
    const [kremlin, governmentRu] = await Promise.all([
      fetchKremlinNews(),
      fetchGovernmentRuNews()
    ]);
    const branches = [
      { name: 'The Kremlin', items: kremlin },
      { name: 'Government of Russia', items: governmentRu }
    ];
    await env.HEADLINES_KV.put(GOV_RU_KV_KEY, JSON.stringify({ status: 'ok', updatedAt: new Date().toISOString(), branches }));
  } catch (err) {
    console.error('gov-ru refresh failed', err);
  }
}

// Atom feed, not RSS — entries live at feed.entry. <summary> is just a lead
// image's alt caption with no real text; the actual article body lives in
// <content> instead, entity-escaped (&lt;p&gt;...). Extracted with a regex
// per entry rather than the shared XMLParser: parsing <content> for all 20
// entries in one pass blows fast-xml-parser's entity-expansion guard, same
// issue as the Congressional Record feed above.
async function fetchKremlinNews() {
  const res = await fetch(KREMLIN_FEED_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const xml = await res.text();
  const entryBlocks = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];

  return entryBlocks.slice(0, GOV_RU_SOURCE_ITEM_COUNT).map((block) => {
    const titleRaw = (/<title>([\s\S]*?)<\/title>/.exec(block) || [, ''])[1];
    const linkRaw = (/<link href="([^"]+)"/.exec(block) || [, ''])[1];
    const contentRaw = (/<content[^>]*>([\s\S]*?)<\/content>/.exec(block) || [, ''])[1];
    const idRaw = (/<id>([\s\S]*?)<\/id>/.exec(block) || [, ''])[1];
    const title = stripHtml(decodeEntities(titleRaw));
    const content = stripHtml(decodeEntities(contentRaw)).replace(/\s+/g, ' ').trim();
    return {
      title,
      summary: truncateSummary(content) || title,
      link: linkRaw || idRaw
    };
  });
}

async function fetchGovernmentRuNews() {
  const parser = new XMLParser({ ignoreAttributes: false });
  const res = await fetch(GOVERNMENT_RU_FEED_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const xml = await res.text();
  const data = parser.parse(xml);
  const rawItems = data?.rss?.channel?.item || [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];

  return items.slice(0, GOV_RU_SOURCE_ITEM_COUNT).map((item) => {
    const title = stripHtml(String(item.title || ''));
    return {
      title,
      summary: truncateSummary(stripHtml(String(item.description || ''))) || title,
      link: String(item.link || '')
    };
  });
}

async function refreshJewish(env) {
  try {
    const items = await fetchJewishHeadlines();
    await env.HEADLINES_KV.put(JEWISH_KV_KEY, JSON.stringify({ status: 'ok', updatedAt: new Date().toISOString(), items }));
  } catch (err) {
    console.error('jewish refresh failed', err);
  }
}

// Same per-feed try/catch loop as refreshHeadlines below, so one blocked
// source (ToI and Chabad both sit behind Cloudflare bot checks that can
// reject non-browser traffic) just means fewer candidates from it rather
// than failing the whole card.
async function fetchJewishHeadlines() {
  const parser = new XMLParser({ ignoreAttributes: false });
  const candidates = [];

  for (const feed of JEWISH_FEEDS) {
    try {
      const res = await fetch(feed.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) throw new Error('feed fetch failed: ' + res.status);
      const xml = await res.text();
      const data = parser.parse(xml);
      const rawItems = data?.rss?.channel?.item || [];
      const items = Array.isArray(rawItems) ? rawItems : [rawItems];

      items.slice(0, feed.count).forEach((item) => {
        const title = stripHtml(String(item.title || ''));
        candidates.push({
          source: feed.name,
          title,
          link: String(item.link || ''),
          summary: truncateSummary(stripHtml(String(item.description || '')), JEWISH_SUMMARY_MAX) || title
        });
      });
    } catch (err) {
      console.error('jewish feed fetch failed', feed.url, err);
    }
  }

  return dedupeByTitle(candidates).slice(0, JEWISH_HEADLINE_COUNT);
}

async function refreshCatholic(env) {
  try {
    const items = await fetchCatholicHeadlines();
    await env.HEADLINES_KV.put(CATHOLIC_KV_KEY, JSON.stringify({ status: 'ok', updatedAt: new Date().toISOString(), items }));
  } catch (err) {
    console.error('catholic refresh failed', err);
  }
}

// National Catholic Register's <description> is a placeholder ("news");
// the real excerpt lives in <content:encoded>, with a lead <figure> (image
// + caption + photo credit) that would otherwise get jumbled in with the
// actual article text once tags are stripped. Vatican News appends a
// "Read all" link paragraph after the real excerpt — invisible at the old
// 170-char cap but now often within reach, so it's stripped before tags
// come off (once stripped, "Read all" is indistinguishable plain text).
function catholicCandidateSummary(item, maxLen) {
  const description = String(item.description || '').replace(/<p>\s*<a[^>]*>Read all<\/a>\s*<\/p>/gi, '');
  let raw = stripHtml(description);
  if (raw.length < 30) {
    const encoded = String(item['content:encoded'] || '').replace(/<figure[\s\S]*?<\/figure>/gi, '');
    raw = stripHtml(encoded);
  }
  return truncateSummary(raw, maxLen);
}

async function fetchCatholicHeadlines() {
  const parser = new XMLParser({ ignoreAttributes: false });
  const candidates = [];

  for (const feed of CATHOLIC_FEEDS) {
    try {
      const res = await fetch(feed.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) throw new Error('feed fetch failed: ' + res.status);
      const xml = await res.text();
      const data = parser.parse(xml);
      const rawItems = data?.rss?.channel?.item || [];
      const items = Array.isArray(rawItems) ? rawItems : [rawItems];

      items.slice(0, feed.count).forEach((item) => {
        const title = stripHtml(String(item.title || ''));
        candidates.push({
          source: feed.name,
          title,
          link: String(item.link || ''),
          summary: catholicCandidateSummary(item, CATHOLIC_SUMMARY_MAX) || title
        });
      });
    } catch (err) {
      console.error('catholic feed fetch failed', feed.url, err);
    }
  }

  try {
    candidates.push(...(await fetchUsccbNews(USCCB_ITEM_COUNT)));
  } catch (err) {
    console.error('catholic feed fetch failed', USCCB_FEED_URL, err);
  }

  return dedupeByTitle(candidates).slice(0, CATHOLIC_HEADLINE_COUNT);
}

// Regex-extracted rather than run through XMLParser: USCCB's feed packs
// escaped-HTML <description> blocks across ~50 items, enough entity
// references to trip fast-xml-parser's entity-expansion guard (same issue
// as the Congressional Record feed above, which sidesteps it by discarding
// <description> entirely — not an option here since this card wants it).
async function fetchUsccbNews(count) {
  const res = await fetch(USCCB_FEED_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error('feed fetch failed: ' + res.status);
  const xml = await res.text();
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

  return itemBlocks.slice(0, count).map((block) => {
    const titleRaw = (/<title>([\s\S]*?)<\/title>/.exec(block) || [, ''])[1];
    const linkRaw = (/<link>([\s\S]*?)<\/link>/.exec(block) || [, ''])[1];
    const descRaw = (/<description>([\s\S]*?)<\/description>/.exec(block) || [, ''])[1];
    const title = stripHtml(decodeEntities(titleRaw));
    return {
      source: 'USCCB',
      title,
      link: linkRaw.trim(),
      summary: truncateSummary(stripHtml(decodeEntities(descRaw)), CATHOLIC_SUMMARY_MAX) || title
    };
  });
}

async function refreshIslamic(env) {
  try {
    const items = await fetchIslamicHeadlines();
    await env.HEADLINES_KV.put(ISLAMIC_KV_KEY, JSON.stringify({ status: 'ok', updatedAt: new Date().toISOString(), items }));
  } catch (err) {
    console.error('islamic refresh failed', err);
  }
}

function itemIsIslamRelevant(item) {
  const rawCategory = item.category;
  const cats = Array.isArray(rawCategory) ? rawCategory : (rawCategory ? [rawCategory] : []);
  if (cats.some((c) => ISLAM_KEYWORDS.test(String(c)))) return true;
  return ISLAM_KEYWORDS.test(String(item.title || ''));
}

async function fetchIslamicHeadlines() {
  const parser = new XMLParser({ ignoreAttributes: false });
  const candidates = [];

  for (const feed of ISLAMIC_FEEDS) {
    try {
      const res = await fetch(feed.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) throw new Error('feed fetch failed: ' + res.status);
      const xml = await res.text();
      const data = parser.parse(xml);
      const rawItems = data?.rss?.channel?.item || [];
      let items = Array.isArray(rawItems) ? rawItems : [rawItems];
      if (feed.filterIslam) items = items.filter(itemIsIslamRelevant);

      items.slice(0, feed.count).forEach((item) => {
        const title = stripHtml(String(item.title || ''));
        candidates.push({
          source: feed.name,
          title,
          link: String(item.link || ''),
          summary: truncateSummary(stripHtml(String(item.description || '')), ISLAMIC_SUMMARY_MAX) || title
        });
      });
    } catch (err) {
      console.error('islamic feed fetch failed', feed.url, err);
    }
  }

  try {
    candidates.push(...(await fetchMiddleEastEyeNews(MEE_ITEM_COUNT)));
  } catch (err) {
    console.error('islamic feed fetch failed', MEE_FEED_URL, err);
  }

  return dedupeByTitle(candidates).slice(0, ISLAMIC_HEADLINE_COUNT);
}

// Regex-extracted like fetchUsccbNews above: Middle East Eye's <description>
// is escaped HTML (needs decoding before tag-stripping), with the headline
// repeated inside a leading <h2> block that's dropped here so it doesn't
// duplicate the card's own headline, and packs enough entities across 20
// items to trip fast-xml-parser's entity-expansion guard.
async function fetchMiddleEastEyeNews(count) {
  const res = await fetch(MEE_FEED_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error('feed fetch failed: ' + res.status);
  const xml = await res.text();
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

  return itemBlocks.slice(0, count).map((block) => {
    const titleRaw = (/<title>([\s\S]*?)<\/title>/.exec(block) || [, ''])[1];
    const linkRaw = (/<link>([\s\S]*?)<\/link>/.exec(block) || [, ''])[1];
    const descRaw = (/<description>([\s\S]*?)<\/description>/.exec(block) || [, ''])[1];
    const decoded = decodeEntities(descRaw).replace(/<h2>[\s\S]*?<\/h2>/i, '');
    const title = stripHtml(decodeEntities(titleRaw));
    return {
      source: 'Middle East Eye',
      title,
      link: linkRaw.trim(),
      summary: truncateSummary(stripHtml(decoded), ISLAMIC_SUMMARY_MAX) || title
    };
  });
}

async function refreshHindu(env) {
  try {
    const items = await fetchHinduHeadlines();
    await env.HEADLINES_KV.put(HINDU_KV_KEY, JSON.stringify({ status: 'ok', updatedAt: new Date().toISOString(), items }));
  } catch (err) {
    console.error('hindu refresh failed', err);
  }
}

async function fetchHinduHeadlines() {
  const parser = new XMLParser({ ignoreAttributes: false });
  const candidates = [];

  for (const feed of HINDU_FEEDS) {
    try {
      const res = await fetch(feed.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) throw new Error('feed fetch failed: ' + res.status);
      const xml = await res.text();
      const data = parser.parse(xml);
      const rawItems = data?.rss?.channel?.item || [];
      const items = Array.isArray(rawItems) ? rawItems : [rawItems];

      items.slice(0, feed.count).forEach((item) => {
        const title = stripHtml(String(item.title || ''));
        candidates.push({
          source: feed.name,
          title,
          link: String(item.link || ''),
          summary: truncateSummary(stripHtml(String(item.description || '')), HINDU_SUMMARY_MAX) || title
        });
      });
    } catch (err) {
      console.error('hindu feed fetch failed', feed.url, err);
    }
  }

  try {
    candidates.push(...(await fetchIskconNews(ISKCON_ITEM_COUNT)));
  } catch (err) {
    console.error('hindu feed fetch failed', ISKCON_FEED_URL, err);
  }

  try {
    candidates.push(...(await fetchHinduBlogPosts(HINDU_BLOG_ITEM_COUNT)));
  } catch (err) {
    console.error('hindu feed fetch failed', HINDU_BLOG_FEED_URL, err);
  }

  return dedupeByTitle(candidates).slice(0, HINDU_HEADLINE_COUNT);
}

// Regex-extracted rather than run through XMLParser: this feed doesn't cap
// its item count (~1000 items, ~2.5MB), so this stops scanning as soon as
// it has `count` items instead of building a parsed tree for the whole
// thing.
async function fetchIskconNews(count) {
  const res = await fetch(ISKCON_FEED_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error('feed fetch failed: ' + res.status);
  const xml = await res.text();

  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  const results = [];
  let match;
  while ((match = itemRe.exec(xml)) && results.length < count) {
    const block = match[1];
    const titleRaw = (/<title>([\s\S]*?)<\/title>/.exec(block) || [, ''])[1];
    const linkRaw = (/<link>([\s\S]*?)<\/link>/.exec(block) || [, ''])[1];
    const descRaw = (/<description>([\s\S]*?)<\/description>/.exec(block) || [, ''])[1];
    const title = stripHtml(decodeEntities(titleRaw));
    results.push({
      source: 'ISKCON News',
      title,
      link: linkRaw.trim(),
      summary: truncateSummary(stripHtml(decodeEntities(descRaw)), HINDU_SUMMARY_MAX) || title
    });
  }
  return results;
}

// Atom fields like <title type="text"> parse as { '#text', '@_type' }
// objects rather than plain strings once ignoreAttributes:false is on —
// same shape the Kremlin Atom feed's <summary> hits above.
function atomFieldText(field) {
  if (field && typeof field === 'object') return String(field['#text'] || '');
  return String(field || '');
}

// Hindu-blog.com is a Blogger blog: Atom (feed/entry), not RSS. Each entry
// carries three <link> elements (edit/self/alternate) — only "alternate" is
// the actual article URL.
async function fetchHinduBlogPosts(count) {
  const parser = new XMLParser({ ignoreAttributes: false });
  const res = await fetch(HINDU_BLOG_FEED_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error('feed fetch failed: ' + res.status);
  const xml = await res.text();
  const data = parser.parse(xml);
  const rawEntries = data?.feed?.entry || [];
  const entries = Array.isArray(rawEntries) ? rawEntries : [rawEntries];

  return entries.slice(0, count).map((entry) => {
    const links = Array.isArray(entry.link) ? entry.link : [entry.link];
    const altLink = links.find((l) => l && l['@_rel'] === 'alternate') || links[0] || {};
    const title = stripHtml(atomFieldText(entry.title));
    return {
      source: 'Hindu Blog',
      title,
      link: String(altLink['@_href'] || ''),
      summary: truncateSummary(stripHtml(atomFieldText(entry.summary)), HINDU_SUMMARY_MAX) || title
    };
  });
}

async function refreshBuddhist(env) {
  try {
    const items = await fetchBuddhistHeadlines();
    await env.HEADLINES_KV.put(BUDDHIST_KV_KEY, JSON.stringify({ status: 'ok', updatedAt: new Date().toISOString(), items }));
  } catch (err) {
    console.error('buddhist refresh failed', err);
  }
}

async function refreshGoodNews(env) {
  try {
    const items = await fetchGoodNewsHeadlines();
    await env.HEADLINES_KV.put(GOODNEWS_KV_KEY, JSON.stringify({ status: 'ok', updatedAt: new Date().toISOString(), items }));
  } catch (err) {
    console.error('good news refresh failed', err);
  }
}

function itemIsBuddhismRelevant(item) {
  const rawCategory = item.category;
  const cats = Array.isArray(rawCategory) ? rawCategory : (rawCategory ? [rawCategory] : []);
  if (cats.some((c) => BUDDHISM_KEYWORDS.test(String(c)))) return true;
  return BUDDHISM_KEYWORDS.test(String(item.title || ''));
}

async function fetchBuddhistHeadlines() {
  const parser = new XMLParser({ ignoreAttributes: false });
  const candidates = [];

  for (const feed of BUDDHIST_FEEDS) {
    try {
      const res = await fetch(feed.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) throw new Error('feed fetch failed: ' + res.status);
      const xml = await res.text();
      const data = parser.parse(xml);
      const rawItems = data?.rss?.channel?.item || [];
      let items = Array.isArray(rawItems) ? rawItems : [rawItems];
      if (feed.filterBuddhism) items = items.filter(itemIsBuddhismRelevant);

      items.slice(0, feed.count).forEach((item) => {
        const title = stripHtml(String(item.title || ''));
        candidates.push({
          source: feed.name,
          title,
          link: String(item.link || ''),
          summary: truncateSummary(stripHtml(String(item.description || '')), BUDDHIST_SUMMARY_MAX) || title
        });
      });
    } catch (err) {
      console.error('buddhist feed fetch failed', feed.url, err);
    }
  }

  return dedupeByTitle(candidates).slice(0, BUDDHIST_HEADLINE_COUNT);
}

async function fetchGoodNewsHeadlines() {
  const parser = new XMLParser({ ignoreAttributes: false });
  const candidates = [];

  for (const feed of GOODNEWS_FEEDS) {
    try {
      const res = await fetch(feed.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) throw new Error('feed fetch failed: ' + res.status);
      const xml = await res.text();
      const data = parser.parse(xml);
      const rawItems = data?.rss?.channel?.item || [];
      const items = Array.isArray(rawItems) ? rawItems : [rawItems];

      items.slice(0, feed.count).forEach((item) => {
        const title = stripHtml(String(item.title || ''));
        candidates.push({
          source: feed.name,
          title,
          link: String(item.link || ''),
          summary: truncateSummary(stripHtml(String(item.description || '')), GOODNEWS_SUMMARY_MAX) || title
        });
      });
    } catch (err) {
      console.error('good news feed fetch failed', feed.url, err);
    }
  }

  return dedupeByTitle(candidates).slice(0, GOODNEWS_HEADLINE_COUNT);
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
