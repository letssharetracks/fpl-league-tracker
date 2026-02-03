// Cloudflare Worker for API-Football proxy with caching and logging
// Deploy this to Cloudflare Workers (e.g., api-football-proxy.dom-mackie.workers.dev)
// Requires KV namespace binding: API_LOGS

const API_FOOTBALL_KEY = 'cf0bff11890d2b352abe3e100cf5c800';
const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';
const CACHE_TTL = 60; // Cache for 60 seconds
const MAX_LOGS = 100; // Keep last 100 logs

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    // View logs endpoint
    if (action === 'logs') {
      return await getLogs(env, corsHeaders);
    }

    // Clear logs endpoint
    if (action === 'clear-logs') {
      return await clearLogs(env, corsHeaders);
    }

    const endpoint = url.searchParams.get('endpoint');

    if (!endpoint) {
      return new Response(JSON.stringify({ error: 'Missing endpoint parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Allow fixtures and fixtures/events endpoints
    const allowedEndpoints = ['fixtures', 'fixtures/events'];
    const endpointBase = endpoint.split('?')[0];
    if (!allowedEndpoints.some(allowed => endpointBase.startsWith(allowed))) {
      await addLog(env, ctx, 'BLOCKED', endpoint, null, 'Endpoint not allowed');
      return new Response(JSON.stringify({ error: 'Endpoint not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Check cache first
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), request);
    let cachedResponse = await cache.match(cacheKey);

    if (cachedResponse) {
      await addLog(env, ctx, 'CACHE_HIT', endpoint, null, 'Served from cache');
      const headers = new Headers(cachedResponse.headers);
      headers.set('X-Cache', 'HIT');
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        headers,
      });
    }

    // Fetch from API-Football
    try {
      const apiUrl = `${API_FOOTBALL_BASE}/${endpoint}`;
      const apiResponse = await fetch(apiUrl, {
        headers: {
          'x-apisports-key': API_FOOTBALL_KEY,
        },
      });

      const data = await apiResponse.json();

      // Log the API call with result summary
      const resultCount = data.results || 0;
      const goalCount = countGoals(data, endpoint);
      await addLog(env, ctx, 'API_CALL', endpoint, {
        results: resultCount,
        goals: goalCount,
        hasData: resultCount > 0
      });

      // Create response with CORS headers
      const response = new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${CACHE_TTL}`,
          'X-Cache': 'MISS',
          ...corsHeaders,
        },
      });

      // Store in cache
      ctx.waitUntil(cache.put(cacheKey, response.clone()));

      return response;
    } catch (error) {
      await addLog(env, ctx, 'ERROR', endpoint, null, error.message);
      return new Response(JSON.stringify({ error: 'Failed to fetch from API-Football' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  },
};

// Count goals in response for logging
function countGoals(data, endpoint) {
  if (!data.response) return 0;

  if (endpoint.includes('events')) {
    // Count goal events
    return data.response.filter(e => e.type === 'Goal').length;
  } else {
    // Count total goals from fixtures
    return data.response.reduce((sum, f) => {
      return sum + (f.goals?.home || 0) + (f.goals?.away || 0);
    }, 0);
  }
}

// Add log entry to KV
async function addLog(env, ctx, type, endpoint, data, error = null) {
  if (!env.API_LOGS) {
    console.log('KV not bound, skipping log:', type, endpoint);
    return;
  }

  const log = {
    timestamp: new Date().toISOString(),
    type,
    endpoint,
    data,
    error
  };

  try {
    // Get existing logs
    const existing = await env.API_LOGS.get('logs', 'json') || [];

    // Add new log at start, keep only MAX_LOGS
    existing.unshift(log);
    if (existing.length > MAX_LOGS) {
      existing.length = MAX_LOGS;
    }

    // Save back to KV (use waitUntil to not block response)
    ctx.waitUntil(env.API_LOGS.put('logs', JSON.stringify(existing)));
  } catch (e) {
    console.error('Failed to write log:', e);
  }
}

// Get logs from KV
async function getLogs(env, corsHeaders) {
  if (!env.API_LOGS) {
    return new Response(JSON.stringify({
      error: 'KV not configured. Add API_LOGS binding in Cloudflare dashboard.',
      help: 'Workers > your-worker > Settings > Variables > KV Namespace Bindings'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const logs = await env.API_LOGS.get('logs', 'json') || [];
    return new Response(JSON.stringify({
      count: logs.length,
      logs: logs
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

// Clear logs
async function clearLogs(env, corsHeaders) {
  if (!env.API_LOGS) {
    return new Response(JSON.stringify({ error: 'KV not configured' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  await env.API_LOGS.put('logs', JSON.stringify([]));
  return new Response(JSON.stringify({ success: true, message: 'Logs cleared' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
