/**
 * 일봉 데이터 조회 + 이동평균 계산
 * tr_id: HHDFS76240000
 */

const https = require('https');
const CONFIG = require('./config');

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
          else reject(new Error('Token 발급 실패'));
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
 * 일봉 조회
 * @param {string} ticker
 * @param {string} excd - NAS / AMS / NYS
 * @param {string} accessToken
 */
function fetchDaily(accessToken, appKey, appSecret, ticker, excd) {
  return new Promise((resolve, reject) => {
    // GUBN=0 일봉, BYMD=오늘 기준 과거 조회
    const path = `/uapi/overseas-price/v1/quotations/dailyprice?AUTH=&EXCD=${excd}&SYMB=${ticker}&GUBN=0&BYMD=&MODP=1`;

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
        'tr_id': 'HHDFS76240000'
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
 * 이동평균 계산
 * closes: 최신 → 과거 순 또는 과거 → 최신 순 모두 가능하도록 처리
 */
function calcMA(closes, period) {
  if (!closes || closes.length < period) return null;
  const slice = closes.slice(0, period); // 앞에서 period개
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

/**
 * 일봉 배열 정리
 * 반환: [{ date, open, high, low, close, volume }, ...] (최신일 먼저)
 */
function normalizeDaily(raw) {
  const rows = raw.output2 || raw.output || [];
  if (!Array.isArray(rows)) return [];

  const list = rows.map(r => ({
    date: r.xymd || r.date || '',
    open: parseFloat(r.open || 0),
    high: parseFloat(r.high || 0),
    low: parseFloat(r.low || 0),
    close: parseFloat(r.clos || r.close || 0),
    volume: parseFloat(r.tvol || r.volume || 0)
  })).filter(r => r.close > 0);

  // 날짜 내림차순(최신 먼저) 정렬
  list.sort((a, b) => (b.date > a.date ? 1 : -1));
  return list;
}

/**
 * 종목 1개의 일봉 + 이동평균
 */
async function getDailyIndicators(ticker, accessToken, appKey, appSecret) {
  const excd = CONFIG.tickers[ticker]?.excd || 'NAS';
  const raw = await fetchDaily(accessToken, appKey, appSecret, ticker, excd);

  if (raw.rt_cd !== '0') {
    return {
      ticker,
      ok: false,
      message: raw.msg1 || '일봉 조회 실패',
      daily: [],
      ma35: null,
      ma240: null,
      lastClose: null
    };
  }

  const daily = normalizeDaily(raw);
  const closes = daily.map(d => d.close);

  const ma35 = calcMA(closes, 35);
  const ma240 = calcMA(closes, 240);
  const lastClose = closes[0] || null;

  // 최근 10일 종가가 240MA 아래인지 카운트
  let below240Days = 0;
  if (ma240 && daily.length >= 10) {
    for (let i = 0; i < 10; i++) {
      if (daily[i].close < ma240) below240Days++;
      else break; // 연속이 아니면 중단
    }
  }

  // 단순 ATH (조회된 기간 내 최고가)
  const ath = daily.length ? Math.max(...daily.map(d => d.high)) : null;
  const isNearAth = ath && lastClose ? (lastClose >= ath * 0.98) : false;

  return {
    ticker,
    ok: true,
    dailyCount: daily.length,
    lastClose,
    ma35: ma35 ? Number(ma35.toFixed(2)) : null,
    ma240: ma240 ? Number(ma240.toFixed(2)) : null,
    below240Days,
    ath: ath ? Number(ath.toFixed(2)) : null,
    isNearAth,
    aboveMa35: ma35 && lastClose ? lastClose >= ma35 : null,
    aboveMa240: ma240 && lastClose ? lastClose >= ma240 : null
  };
}

/**
 * 여러 종목 일봉 지표
 */
async function getAllDailyIndicators(tickers) {
  const appKey = process.env.KIS_API_KEY;
  const appSecret = process.env.KIS_API_SECRET;

  if (!appKey || !appSecret) {
    throw new Error('KIS 환경변수 없음');
  }

  const accessToken = await getAccessToken(appKey, appSecret);
  const results = {};

  for (const ticker of tickers) {
    results[ticker] = await getDailyIndicators(ticker, accessToken, appKey, appSecret);
    await new Promise(r => setTimeout(r, 800)); // rate limit 방지
  }

  return results;
}

module.exports = {
  getDailyIndicators,
  getAllDailyIndicators,
  calcMA
};
