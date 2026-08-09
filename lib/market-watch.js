/**
 * 관심 3배(레버리지) ETF 간단 시세
 * 한투 해외 현재가 조회
 */

const https = require('https');

// 관심 종목 (시총 TOP 대체용 고정 리스트)
const WATCH_LIST = [
  { ticker: 'TQQQ', name: '나스닥100 3x', excd: 'NAS' },
  { ticker: 'SOXL', name: '반도체 3x', excd: 'AMS' },
  { ticker: 'UPRO', name: 'S&P500 3x', excd: 'AMS' },
  { ticker: 'TNA', name: '소형주 3x', excd: 'AMS' },
  { ticker: 'FAS', name: '금융 3x', excd: 'AMS' },
  { ticker: 'LABU', name: '바이오 3x', excd: 'AMS' },
  { ticker: 'DFEN', name: '방산 3x', excd: 'AMS' },
  { ticker: 'GDXU', name: '금광 3x', excd: 'AMS' },
  { ticker: 'AGQ', name: '은 2x', excd: 'AMS' },
  { ticker: 'UBOT', name: '로봇/AI 2x', excd: 'AMS' }
];

function inquirePrice(accessToken, appKey, appSecret, ticker, excd) {
  return new Promise((resolve) => {
    const path = `/uapi/overseas-price/v1/quotations/price?AUTH=&EXCD=${excd}&SYMB=${ticker}`;
    const options = {
      hostname: 'openapi.koreainvestment.com',
      port: 9443,
      path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        appkey: appKey,
        appsecret: appSecret,
        tr_id: 'HHDFS00000300'
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
          resolve({ rt_cd: '1', msg1: e.message });
        }
      });
    });
    req.on('error', () => resolve({ rt_cd: '1', msg1: 'network' }));
    req.end();
  });
}

async function getWatchQuotes(accessToken, appKey, appSecret) {
  const results = [];

  for (const item of WATCH_LIST) {
    const raw = await inquirePrice(accessToken, appKey, appSecret, item.ticker, item.excd);
    await new Promise(r => setTimeout(r, 350));

    if (raw.rt_cd === '0' && raw.output) {
      const o = raw.output;
      const price = parseFloat(o.last || o.base || 0);
      const prev = parseFloat(o.base || 0);
      const rate = parseFloat(o.rate || 0);
      results.push({
        ticker: item.ticker,
        name: item.name,
        price,
        prev,
        changePct: rate || (prev ? ((price - prev) / prev) * 100 : 0),
        ok: price > 0
      });
    } else {
      results.push({
        ticker: item.ticker,
        name: item.name,
        price: null,
        changePct: null,
        ok: false
      });
    }
  }

  return results;
}

function formatWatchBlock(quotes) {
  if (!quotes || quotes.length === 0) return '';

  let msg = `📡 <b>레버리지 관심종목</b>\n`;
  for (const q of quotes) {
    if (!q.ok) {
      msg += `· ${q.ticker}  조회실패\n`;
      continue;
    }
    const sign = q.changePct >= 0 ? '+' : '';
    msg += `· <b>${q.ticker}</b> $${Number(q.price).toFixed(2)}  ${sign}${Number(q.changePct).toFixed(2)}%\n`;
  }
  msg += `\n`;
  return msg;
}

module.exports = {
  WATCH_LIST,
  getWatchQuotes,
  formatWatchBlock
};
