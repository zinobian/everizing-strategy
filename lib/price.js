/**
 * 시세 조회 (야후 차트 API 사용 - 더 안정적)
 */

const https = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('JSON 파싱 실패'));
        }
      });
    }).on('error', reject);
  });
}

/**
 * 한 종목 시세 가져오기
 */
async function getOnePrice(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d`;
    const data = await fetchJson(url);

    const result = data?.chart?.result?.[0];
    if (!result) {
      return { price: 0, prevClose: 0, change: 0, currency: 'USD', name: ticker };
    }

    const meta = result.meta || {};
    const price = meta.regularMarketPrice || 0;
    const prevClose = meta.chartPreviousClose || meta.previousClose || 0;
    const change = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;

    return {
      price: Number(price.toFixed(2)),
      prevClose: Number(prevClose.toFixed(2)),
      change: Number(change.toFixed(2)),
      currency: meta.currency || 'USD',
      name: meta.symbol || ticker
    };
  } catch (e) {
    console.error(`${ticker} 시세 오류:`, e.message);
    return { price: 0, prevClose: 0, change: 0, currency: 'USD', name: ticker };
  }
}

/**
 * 여러 종목 시세 가져오기
 */
async function getPrices(tickers) {
  const results = {};

  // 너무 빠르게 요청하지 않도록 순차 처리
  for (const ticker of tickers) {
    results[ticker] = await getOnePrice(ticker);
  }

  return results;
}

module.exports = { getPrices, getOnePrice };
