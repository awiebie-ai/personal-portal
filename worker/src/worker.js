import snapshot from './snapshot.json';

// This worker used to refresh every card live (RSS/API fetches, Claude
// summarization, PDF text extraction) on a 7 AM / 7 PM America/New_York
// cron. The site has been frozen: snapshot.json holds the last-refreshed
// state of every card, this worker just serves it, and there is no longer
// a scheduled handler, no outbound fetches, and no secrets in use.
const ROUTES = {
  '/github': 'github',
  '/todoist': 'todoist',
  '/calendar': 'calendar',
  '/weather': 'weather',
  '/gov/us': 'gov-us',
  '/gov/cn': 'gov-cn',
  '/gov/ru': 'gov-ru',
  '/religion/jewish': 'jewish',
  '/religion/catholic': 'catholic',
  '/religion/islamic': 'islamic',
  '/religion/hindu': 'hindu',
  '/religion/buddhist': 'buddhist',
  '/good-news': 'goodnews'
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const key = ROUTES[url.pathname] || 'headlines';
    return jsonResponse(snapshot[key] || { status: 'pending', items: [] }, 200);
  }
};

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
