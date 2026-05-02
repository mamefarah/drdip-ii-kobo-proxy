export default async function handler(req, res) {
  // CORS headers - allow all origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'public, max-age=60');

  // Handle OPTIONS requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  // Extract query parameters
  const { token, server, asset } = req.query;

  // Validate required parameters
  if (!token || !server || !asset) {
    return res.status(400).json({
      error: 'Missing required parameters: token, server, asset',
      example: '?token=YOUR_TOKEN&server=https://kf.kobotoolbox.org&asset=ASSET_UID'
    });
  }

  // Validate token format (should be hex string, 32+ chars)
  if (!/^[a-f0-9]{32,}$/i.test(token)) {
    return res.status(400).json({
      error: 'Invalid token format. Token should be a 32+ character hex string.'
    });
  }

  // Validate asset UID format
  if (!/^[a-zA-Z0-9_-]+$/.test(asset)) {
    return res.status(400).json({
      error: 'Invalid asset UID format'
    });
  }

  // Validate server URL
  if (!server.startsWith('https://') && !server.startsWith('http://')) {
    return res.status(400).json({
      error: 'Server URL must start with https:// or http://'
    });
  }

  try {
    // Build the KoboToolbox API URL
    const koboUrl = `${server}/api/v2/assets/${asset}/data.json?limit=30000`;

    console.log(`Proxying request to: ${koboUrl}`);

    // Make request to KoboToolbox API with token
    const koboResponse = await fetch(koboUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${token}`,
        'Accept': 'application/json',
        'User-Agent': 'DRDIP-II-Dashboard/1.0'
      },
      timeout: 30000
    });

    // Handle error responses from KoboToolbox
    if (!koboResponse.ok) {
      const errorText = await koboResponse.text();
      console.error(`KoboToolbox API error: ${koboResponse.status} - ${errorText}`);

      if (koboResponse.status === 401) {
        return res.status(401).json({
          error: 'Authentication failed. Token is invalid or expired.',
          hint: 'Regenerate your token at: KoboToolbox → Account Settings → Security → API Token'
        });
      }

      if (koboResponse.status === 404) {
        return res.status(404).json({
          error: 'Asset not found. Check your asset UID.',
          assetUID: asset
        });
      }

      return res.status(koboResponse.status).json({
        error: `KoboToolbox API returned status ${koboResponse.status}`,
        message: errorText.substring(0, 200)
      });
    }

    // Parse JSON response
    const data = await koboResponse.json();

    // Return data to client
    return res.status(200).json(data);

  } catch (error) {
    console.error('Proxy error:', error);

    // Handle specific error types
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return res.status(504).json({
        error: 'Request timeout. KoboToolbox server took too long to respond.'
      });
    }

    if (error.message.includes('ECONNREFUSED')) {
      return res.status(503).json({
        error: 'Unable to connect to KoboToolbox server. Service may be unavailable.'
      });
    }

    return res.status(500).json({
      error: 'Server error',
      message: error.message,
      type: error.name
    });
  }
}
