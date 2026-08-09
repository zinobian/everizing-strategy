/**
 * 한투 Access Token 캐시 (Upstash Redis)
 * 1분당 1회 제한(EGW00133) 완화
 */

const https = require('https');
const { loadState, saveState } = require('./store');

const SAFETY_SEC = 300; // 만료 5분 전 갱신

function requestNewToken(appKey, appSecret) {
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
          if (json.access_token) {
            resolve({
              token: json.access_token,
              expiresIn: json.expires_in || 86400
            });
          } else {
            reject(new Error('Token 발급 실패: ' + JSON.stringify(json)));
          }
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

/**
 * 캐시된 토큰 반환 (없거나 임박하면 재발급)
 */
async function getAccessToken(appKey, appSecret) {
  const key = appKey || process.env.KIS_API_KEY;
  const secret = appSecret || process.env.KIS_API_SECRET;

  try {
    const state = await loadState();
    const cache = state.kisToken;
    const now = Date.now();

    if (cache && cache.token && cache.expiresAt && cache.expiresAt - now > SAFETY_SEC * 1000) {
      return cache.token;
    }
  } catch (e) {
    console.error('token cache read:', e.message);
  }

  const issued = await requestNewToken(key, secret);
  const expiresAt = Date.now() + (issued.expiresIn * 1000);

  try {
    const state = await loadState();
    state.kisToken = {
      token: issued.token,
      expiresAt,
      updatedAt: new Date().toISOString()
    };
    await saveState(state);
  } catch (e) {
    console.error('token cache write:', e.message);
  }

  return issued.token;
}

module.exports = {
  getAccessToken,
  requestNewToken
};
