/**
 * 시세 조회 (Stooq 사용 - API 키 불필요)
 */

const https = require('https');

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

/**
 * 한 종목 시세 (Stooq)
 * 예: TQQQ → tqqq.us
 */
async function getOnePrice(ticker) {
  try {
    const symbol = `${ticker.toLowerCase()}.us`;
    const url = `https://stooq.com/q/l/?s=${symbol}&f=sd2t2ohlcv&h&e=csv`;

    const text = await fetchText(url);
    // CSV 예시: Symbol,Date,Time,Open,High,Low,Close,Volume
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      return { price: 0, prevClose: 0, change: 0, currency: 'USD', name: ticker };
    }

    const cols = lines[1].split(',');
    // cols: Symbol, Date, Time, Open, High, Low, Close, Volume
    const price = parseFloat(cols[6]) || 0;
    const open = parseFloat(cols[3]) || 0;
    const change = open ? ((price - open) / open) * 100 : 0;

    return {
      price: Number(price.toFixed(2)),
      prevClose: Number(open.toFixed(2)),
      change: Number(change.toFixed(2)),
      currency: 'USD',
      name: ticker
    };
  } catch (e) {
    console.error(`${ticker} 시세 오류:`, e.message);
    return { price: 0, prevClose: 0, change: 0, currency: 'USD', name: ticker };
  }
}

async function getPrices(tickers) {
  const results = {};
  for (const ticker of tickers) {
    results[ticker] = await getOnePrice(ticker);
  }
  return results;
}

module.exports = { getPrices, getOnePrice };
