// Cloudflare Worker for API-Football proxy with caching
// Deploy this to Cloudflare Workers (e.g., api-football-proxy.dom-mackie.workers.dev)

const API_FOOTBALL_KEY = 'cf0bff11890d2b352abe3e100cf5c800';
const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';
const CACHE_TTL = 60; // Cache for 60 seconds

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    const url = new URL(request.url);
    const endpoint = url.searchParams.get('endpoint');

    if (!endpoint) {
      return new Response(JSON.stringify({ error: 'Missing endpoint parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Only allow specific endpoints
    const allowedEndpoints = ['fixtures'];
    const endpointBase = endpoint.split('?')[0].replace('/', '');
    if (!allowedEndpoints.includes(endpointBase)) {
      return new Response(JSON.stringify({ error: 'Endpoint not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Check cache first
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), request);
    let cachedResponse = await cache.match(cacheKey);

    if (cachedResponse) {
      console.log('Cache HIT for:', endpoint);
      // Add header to indicate cache hit
      const headers = new Headers(cachedResponse.headers);
      headers.set('X-Cache', 'HIT');
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        headers,
      });
    }

    console.log('Cache MISS for:', endpoint);

    // Fetch from API-Football
    try {
      const apiUrl = `${API_FOOTBALL_BASE}/${endpoint}`;
      const apiResponse = await fetch(apiUrl, {
        headers: {
          'x-apisports-key': API_FOOTBALL_KEY,
        },
      });

      const data = await apiResponse.json();

      // Create response with CORS headers
      const response = new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': `public, max-age=${CACHE_TTL}`,
          'X-Cache': 'MISS',
        },
      });

      // Store in cache (clone response since it can only be read once)
      ctx.waitUntil(cache.put(cacheKey, response.clone()));

      return response;
    } catch (error) {
      console.error('API-Football error:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch from API-Football' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  },
};
