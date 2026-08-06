/**
 * 시세 조회 - 한국투자증권 해외주식 현재가
 * tr_id: HHDFS00000300
 */

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

function inquirePrice(accessToken, appKey, appSecret, ticker) {
  return new Promise((resolve, reject) => {
    const path = `/uapi/overseas-price/v1/quotations/price?AUTH=&EXCD=NAS&SYMB=${ticker}`;

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
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function getOnePrice(ticker, accessToken, appKey, appSecret) {
  try {
    const data = await inquirePrice(accessToken, appKey, appSecret, ticker);

    if (data.rt_cd !== '0') {
      console.error(`${ticker} 시세 오류:`, data.msg1 || data);
      return { price: 0, prevClose: 0, change: 0, currency: 'USD', name: ticker };
    }

    const out = data.output || {};
    const price = parseFloat(out.last || 0);
    const prevClose = parseFloat(out.base || 0);
    const change = parseFloat(out.rate || 0);

    return {
      price: Number(price.toFixed(2)),
      prevClose: Number(prevClose.toFixed(2)),
      change: Number(change.toFixed(2)),
      currency: 'USD',
      name: ticker
    };
  } catch (e) {
    console.error(`${ticker} 시세 예외:`, e.message);
    return { price: 0, prevClose: 0, change: 0, currency: 'USD', name: ticker };
  }
}

async function getPrices(tickers) {
  const appKey = process.env.KIS_API_KEY;
  const appSecret = process.env.KIS_API_SECRET;

  if (!appKey || !appSecret) {
    throw new Error('KIS_API_KEY / KIS_API_SECRET 환경변수가 없습니다.');
  }

  const accessToken = await getAccessToken(appKey, appSecret);
  const results = {};

  for (const ticker of tickers) {
    results[ticker] = await getOnePrice(ticker, accessToken, appKey, appSecret);
    await new Promise(r => setTimeout(r, 250)); // API 부하 방지
  }

  return results;
}

module.exports = { getPrices, getOnePrice };
