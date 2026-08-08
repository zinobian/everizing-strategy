/**
 * USD/KRW 환율 조회
 * accessToken을 넘기면 새로 발급하지 않음
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

function inquireUsdKrw(accessToken, appKey, appSecret) {
  return new Promise((resolve, reject) => {
    const path =
      '/uapi/overseas-price/v1/quotations/inquire-daily-chartprice' +
      '?FID_COND_MRKT_DIV_CODE=X' +
      '&FID_INPUT_ISCD=FX@KRWKFTC' +
      '&FID_INPUT_DATE_1=20200101' +
      '&FID_INPUT_DATE_2=20301231' +
      '&FID_PERIOD_DIV_CODE=D';

    const options = {
      hostname: 'openapi.koreainvestment.com',
      port: 9443,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        appkey: appKey,
        appsecret: appSecret,
        tr_id: 'FHKST03030100'
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

/**
 * @param {string|null} accessToken - 있으면 재사용
 */
async function getUsdKrwRate(accessToken = null) {
  const appKey = process.env.KIS_API_KEY;
  const appSecret = process.env.KIS_API_SECRET;

  if (!appKey || !appSecret) {
    return { ok: false, rate: null, prev: null, change: null, message: '환경변수 없음' };
  }

  try {
    const token = accessToken || (await getAccessToken(appKey, appSecret));
    const raw = await inquireUsdKrw(token, appKey, appSecret);

    if (raw.rt_cd !== '0') {
      return {
        ok: false,
        rate: null,
        prev: null,
        change: null,
        message: raw.msg1 || '환율 조회 실패',
        raw
      };
    }

    const o1 = raw.output1 || {};
    const rate = parseFloat(o1.ovrs_nmix_prpr || 0);
    const prev = parseFloat(o1.ovrs_nmix_prdy_clpr || 0);
    const change = rate && prev ? rate - prev : null;
    const changePct = rate && prev ? ((rate - prev) / prev) * 100 : null;

    return {
      ok: rate > 0,
      rate: rate || null,
      prev: prev || null,
      change: change != null ? Number(change.toFixed(2)) : null,
      changePct: changePct != null ? Number(changePct.toFixed(2)) : null,
      message: rate > 0 ? 'ok' : '환율 값 없음',
      raw
    };
  } catch (e) {
    return {
      ok: false,
      rate: null,
      prev: null,
      change: null,
      message: e.message
    };
  }
}

module.exports = {
  getUsdKrwRate,
  getAccessToken
};
