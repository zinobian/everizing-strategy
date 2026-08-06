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
          else reject(new Error(JSON.stringify(json)));
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

function testPrice(accessToken, appKey, appSecret, ticker, excd) {
  return new Promise((resolve) => {
    const path = `/uapi/overseas-price/v1/quotations/price?AUTH=&EXCD=${excd}&SYMB=${ticker}`;

    const options = {
      hostname: 'openapi.koreainvestment.com',
      port: 9443,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'appkey': appKey,
        'appsecret': appSecret,
        'tr_id': 'HHDFS00000300'
      },
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({
            ticker,
            excd,
            rt_cd: json.rt_cd,
            msg1: json.msg1,
            price: json.output?.last || null
          });
        } catch (e) {
          resolve({ ticker, excd, error: e.message });
        }
      });
    });

    req.on('error', (e) => resolve({ ticker, excd, error: e.message }));
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    const appKey = process.env.KIS_API_KEY;
    const appSecret = process.env.KIS_API_SECRET;
    const accessToken = await getAccessToken(appKey, appSecret);

    const targets = ['SOXL', 'GDXU', 'AGQ', 'DFEN'];
    const exchanges = ['NAS', 'NYS', 'AMS'];
    const results = [];

    for (const ticker of targets) {
      for (const excd of exchanges) {
        const r = await testPrice(accessToken, appKey, appSecret, ticker, excd);
        results.push(r);
        await new Promise(r => setTimeout(r, 300));
      }
    }

    return res.status(200).json({ success: true, results });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
