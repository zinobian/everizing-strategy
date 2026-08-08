const { getDailyIndicators } = require('../lib/daily');
const { evaluateAll } = require('../lib/rules');
const https = require('https');

function getAccessToken(appKey, appSecret) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      grant_type: 'client_credentials',
      appkey: appKey,
      appsecret: appSecret
    });

    const options = {
      hostname: 'openapi.koreainvestment.com',
      port: 9443,
      path: '/oauth2/tokenP',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.access_token) resolve(json.access_token);
          else reject(new Error('Token 발급 실패: ' + JSON.stringify(json)));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    const positions = {
      TQQQ: { qty: 20, avgPrice: 60.0 },
      SOXL: { qty: 10, avgPrice: 110.0 }
    };

    const tickers = Object.keys(positions);
    const appKey = process.env.KIS_API_KEY;
    const appSecret = process.env.KIS_API_SECRET;

    // 토큰 1번만 발급
    const accessToken = await getAccessToken(appKey, appSecret);

    const dailies = {};
    const prices = {};

    for (const t of tickers) {
      const d = await getDailyIndicators(t, accessToken, appKey, appSecret);
      dailies[t] = d;
      prices[t] = {
        price: d.lastClose || 0,
        prevClose: 0,
        change: 0
      };
      await new Promise(r => setTimeout(r, 800));
    }

    const evaluations = evaluateAll(positions, prices, dailies);

    return res.status(200).json({
      success: true,
      time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      evaluations
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
