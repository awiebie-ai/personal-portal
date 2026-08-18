import { XMLParser } from 'fast-xml-parser';

const FEEDS = [
  'https://www.cbsnews.com/latest/rss/main',
  'https://feeds.nbcnews.com/nbcnews/public/news',
  'https://abcnews.go.com/abcnews/topstories'
];

const HEADLINE_COUNT = 9;
const CANDIDATES_PER_FEED = 5; // pull extras so filtering/dedup can still hit HEADLINE_COUNT
const KV_KEY = 'headlines';
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

// Fixed, ordered list so the portfolio always leads with this project.
// Repos are private, so this must stay server-side behind GITHUB_TOKEN.
const GITHUB_REPOS = [
  { owner: 'awiebie-ai', repo: 'personal-portal' },
  { owner: 'awiebie-ai', repo: 'prompt-eng-interactive-tutorial' }
];

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
      await refreshHeadlines(env);
      const fresh = await env.HEADLINES_KV.get(KV_KEY, 'json');
      return jsonResponse(fresh, 200);
    }

    if (url.pathname === '/github') {
      const items = await fetchGithubRepos(env);
      return jsonResponse({ status: 'ok', items }, 200);
    }

    const cached = await env.HEADLINES_KV.get(KV_KEY, 'json');
    if (!cached) {
      return jsonResponse({ status: 'pending', items: [] }, 200);
    }
    return jsonResponse(cached, 200);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(refreshHeadlines(env));
  }
};

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
