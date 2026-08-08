/**
 * 한투 해외주식 잔고 조회
 * accessToken을 넘기면 재발급하지 않음
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

function inquireOverseasBalance(accessToken, appKey, appSecret, cano, acnt) {
  return new Promise((resolve, reject) => {
    const path = `/uapi/overseas-stock/v1/trading/inquire-present-balance?CANO=${cano}&ACNT_PRDT_CD=${acnt}&WCRC_FRCR_DVSN_CD=02&NATN_CD=840&TR_MKET_CD=00&INQR_DVSN_CD=00`;

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
        tr_id: 'CTRP6504R'
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

function parsePositions(balanceData) {
  const positions = {};
  const rows = balanceData.output1 || balanceData.output || [];
  if (!Array.isArray(rows)) return positions;

  for (const row of rows) {
    const ticker = (row.ovrs_pdno || row.pdno || row.item_cd || '').toUpperCase();
    const qty = parseFloat(row.ovrs_cblc_qty || row.hldg_qty || row.qty || 0);
    const avgPrice = parseFloat(row.pchs_avg_pric || row.avg_unpr || row.pchs_avg_pricx || 0);

    if (ticker && qty > 0) {
      positions[ticker] = { qty, avgPrice };
    }
  }
  return positions;
}

/**
 * @param {string|null} accessToken 있으면 재사용
 */
async function getRealPositions(accessToken = null) {
  const appKey = process.env.KIS_API_KEY;
  const appSecret = process.env.KIS_API_SECRET;
  const account = process.env.KIS_ACCOUNT;

  if (!appKey || !appSecret || !account) {
    throw new Error('KIS 환경변수 없음');
  }

  const cano = account.substring(0, 8);
  const acnt = account.substring(8);

  const token = accessToken || (await getAccessToken(appKey, appSecret));
  const data = await inquireOverseasBalance(token, appKey, appSecret, cano, acnt);

  if (data.rt_cd !== '0') {
    return {
      success: false,
      positions: {},
      raw: data,
      message: data.msg1 || '잔고 조회 결과 없음'
    };
  }

  const positions = parsePositions(data);

  return {
    success: true,
    positions,
    raw: data,
    message: Object.keys(positions).length === 0 ? '보유 종목 없음' : '잔고 조회 성공'
  };
}

module.exports = {
  getRealPositions,
  parsePositions,
  getAccessToken
};
