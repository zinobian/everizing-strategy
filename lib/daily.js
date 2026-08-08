/**
 * 일봉 데이터 조회 + 이동평균 + 월봉10
 * 여러 번 조회해서 200~300일 확보
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

function fetchDaily(accessToken, appKey, appSecret, ticker, excd, bymd = '') {
  return new Promise((resolve, reject) => {
    const path = `/uapi/overseas-price/v1/quotations/dailyprice?AUTH=&EXCD=${excd}&SYMB=${ticker}&GUBN=0&BYMD=${bymd}&MODP=1`;

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

function calcMA(closes, period) {
  if (!closes || closes.length < period) return null;
  const slice = closes.slice(0, period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

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
  })).filter(r => r.close > 0 && r.date);

  return list;
}

function mergeDaily(list) {
  const map = {};
  for (const d of list) {
    map[d.date] = d;
  }
  return Object.values(map).sort((a, b) => (b.date > a.date ? 1 : -1));
}

function calcMonthly10(daily) {
  if (!daily || daily.length < 20) return null;

  const byMonth = {};
  for (const d of daily) {
    if (!d.date || d.date.length < 6) continue;
    const ym = d.date.slice(0, 6);
    if (!byMonth[ym]) byMonth[ym] = d.close;
  }

  const months = Object.keys(byMonth).sort().reverse();
  if (months.length < 10) return null;

  const last10 = months.slice(0, 10).map(m => byMonth[m]);
  const avg = last10.reduce((a, b) => a + b, 0) / 10;
  return Number(avg.toFixed(2));
}

function shiftDateYYYYMMDD(yyyymmdd, daysBack) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return '';
  const y = parseInt(yyyymmdd.slice(0, 4), 10);
  const m = parseInt(yyyymmdd.slice(4, 6), 10) - 1;
  const d = parseInt(yyyymmdd.slice(6, 8), 10);
  const dt = new Date(Date.UTC(y, m, d));
  dt.setUTCDate(dt.getUTCDate() - daysBack);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

/**
 * 일봉 최대 3번 조회해서 이어붙이기
 */
async function fetchDailyExtended(accessToken, appKey, appSecret, ticker, excd) {
  let all = [];
  let bymd = '';

  for (let i = 0; i < 3; i++) {
    const raw = await fetchDaily(accessToken, appKey, appSecret, ticker, excd, bymd);
    if (raw.rt_cd !== '0') break;

    const part = normalizeDaily(raw);
    if (part.length === 0) break;

    all = all.concat(part);
    const oldest = part[part.length - 1]?.date || part[0]?.date;
    if (!oldest) break;

    bymd = shiftDateYYYYMMDD(oldest, 1);
    await new Promise(r => setTimeout(r, 500));
  }

  return mergeDaily(all);
}

async function getDailyIndicators(ticker, accessToken, appKey, appSecret) {
  const excd = CONFIG.tickers[ticker]?.excd || 'NAS';

  let daily = [];
  try {
    daily = await fetchDailyExtended(accessToken, appKey, appSecret, ticker, excd);
  } catch (e) {
    return {
      ticker,
      ok: false,
      message: e.message,
      dailyCount: 0,
      lastClose: null,
      ma35: null,
      ma240: null,
      monthly10: null,
      below240Days: 0,
      ath: null,
      aboveMonthly10: null
    };
  }

  if (daily.length === 0) {
    return {
      ticker,
      ok: false,
      message: '일봉 없음',
      dailyCount: 0,
      lastClose: null,
      ma35: null,
      ma240: null,
      monthly10: null,
      below240Days: 0,
      ath: null,
      aboveMonthly10: null
    };
  }

  const closes = daily.map(d => d.close);
  const ma35 = calcMA(closes, 35);
  const ma240 = calcMA(closes, 240);
  const monthly10 = calcMonthly10(daily);
  const lastClose = closes[0] || null;

  let below240Days = 0;
  if (ma240 && daily.length >= 10) {
    for (let i = 0; i < 10; i++) {
      if (daily[i].close < ma240) below240Days++;
      else break;
    }
  }

  const ath = Math.max(...daily.map(d => d.high));

  return {
    ticker,
    ok: true,
    dailyCount: daily.length,
    lastClose,
    ma35: ma35 ? Number(ma35.toFixed(2)) : null,
    ma240: ma240 ? Number(ma240.toFixed(2)) : null,
    monthly10,
    below240Days,
    ath: ath ? Number(ath.toFixed(2)) : null,
    isNearAth: lastClose >= ath * 0.98,
    aboveMa35: ma35 != null ? lastClose >= ma35 : null,
    aboveMa240: ma240 != null ? lastClose >= ma240 : null,
    aboveMonthly10: monthly10 != null ? lastClose >= monthly10 : null
  };
}

async function getAllDailyIndicators(tickers) {
  const appKey = process.env.KIS_API_KEY;
  const appSecret = process.env.KIS_API_SECRET;
  if (!appKey || !appSecret) throw new Error('KIS 환경변수 없음');

  const accessToken = await getAccessToken(appKey, appSecret);
  const results = {};

  for (const ticker of tickers) {
    results[ticker] = await getDailyIndicators(ticker, accessToken, appKey, appSecret);
    await new Promise(r => setTimeout(r, 800));
  }

  return results;
}

module.exports = {
  getDailyIndicators,
  getAllDailyIndicators,
  calcMA,
  calcMonthly10
};
