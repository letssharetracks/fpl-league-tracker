// Netlify Function to proxy FPL API calls - eliminates CORS issues and is faster
const https = require('https');

exports.handler = async (event) => {
    // Get the FPL API path from query parameter
    const path = event.queryStringParameters?.path;

    if (!path) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing path parameter' })
        };
    }

    // Validate path starts with expected FPL API routes
    const allowedPaths = [
        '/api/bootstrap-static/',
        '/api/entry/',
        '/api/leagues-classic/',
        '/api/event/',
        '/api/fixtures/'
    ];

    const isAllowed = allowedPaths.some(allowed => path.startsWith(allowed));
    if (!isAllowed) {
        return {
            statusCode: 403,
            body: JSON.stringify({ error: 'Path not allowed' })
        };
    }

    const url = `https://fantasy.premierleague.com${path}`;

    try {
        const data = await fetchWithTimeout(url, 15000);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=30', // Cache for 30 seconds
                'Access-Control-Allow-Origin': '*'
            },
            body: data
        };
    } catch (error) {
        console.error('FPL API Error:', error.message);
        return {
            statusCode: 502,
            body: JSON.stringify({ error: 'Failed to fetch from FPL API', message: error.message })
        };
    }
};

function fetchWithTimeout(url, timeout) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'FPL-League-Tracker/1.0'
            }
        }, (res) => {
            let data = '';

            res.on('data', chunk => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        });

        req.on('error', reject);

        req.setTimeout(timeout, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}
