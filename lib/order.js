/**
 * 해외주식 매도 주문 (반자동용)
 * 주의: 실제 주문 API 호출 함수
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

/**
 * 해외주식 매도 (시장가)
 * @param {Object} params
 * @param {string} params.ticker - 예: TQQQ
 * @param {number} params.qty - 수량
 * @param {string} params.excd - NAS / AMS / NYS
 * @param {boolean} params.dryRun - true면 실제 주문 안 함 (기본 true)
 */
async function sellOverseas({ ticker, qty, excd = 'NAS', dryRun = true }) {
  const appKey = process.env.KIS_API_KEY;
  const appSecret = process.env.KIS_API_SECRET;
  const account = process.env.KIS_ACCOUNT;

  if (!appKey || !appSecret || !account) {
    throw new Error('KIS 환경변수 없음');
  }

  if (!ticker || !qty || qty <= 0) {
    throw new Error('종목/수량이 올바르지 않습니다');
  }

  // 안전장치: 기본은 모의(dryRun)
  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      message: `[모의] ${ticker} ${qty}주 매도 주문 시뮬레이션`,
      ticker,
      qty,
      excd
    };
  }

  const cano = account.substring(0, 8);
  const acnt = account.substring(8);
  const accessToken = await getAccessToken(appKey, appSecret);

  // 해외주식 주문 body
  // OVRS_ORD_UNPR = 0 에 가깝게 시장가 처리 (증권사별 차이 있을 수 있음)
  const body = {
    CANO: cano,
    ACNT_PRDT_CD: acnt,
    OVRS_EXCG_CD: excd === 'NAS' ? 'NASD' : (excd === 'NYS' ? 'NYSE' : 'AMEX'),
    PDNO: ticker,
    ORD_QTY: String(qty),
    OVRS_ORD_UNPR: '0',
    ORD_SVR_DVSN_CD: '0',
    ORD_DVSN: '00' // 지정가/시장가 구분은 계좌·문서 확인 필요
  };

  const postData = JSON.stringify(body);

  const result = await new Promise((resolve, reject) => {
    const options = {
      hostname: 'openapi.koreainvestment.com',
      port: 9443,
      path: '/uapi/overseas-stock/v1/trading/order',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'appkey': appKey,
        'appsecret': appSecret,
        'tr_id': 'TTTT1006U', // 미국 매도 (실전). 모의는 다를 수 있음
        'Content-Length': Buffer.byteLength(postData)
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
    req.write(postData);
    req.end();
  });

  return {
    success: result.rt_cd === '0',
    dryRun: false,
    raw: result,
    message: result.msg1 || '',
    ticker,
    qty
  };
}

module.exports = {
  sellOverseas
};
