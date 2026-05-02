module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'public, max-age=60');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, server, asset } = req.query;

  if (!token || !server || !asset) {
    return res.status(400).json({ error: 'Missing: token, server, asset' });
  }

  try {
    const koboUrl = `${server}/api/v2/assets/${asset}/data.json?limit=30000`;
    const koboResponse = await fetch(koboUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${token}`,
        'Accept': 'application/json',
        'User-Agent': 'DRDIP-II-Dashboard/1.0'
      }
    });

    if (!koboResponse.ok) {
      const errorText = await koboResponse.text();
      return res.status(koboResponse.status).json({
        error: `KoboToolbox error: ${koboResponse.status}`,
        message: errorText.substring(0, 100)
      });
    }

    const data = await koboResponse.json();
    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({
      error: 'Server error',
      message: error.message
    });
  }
};