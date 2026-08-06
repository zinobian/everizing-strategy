/**
 * 시세 조회 (야후 파이낸스 사용)
 * 미국 주식/ETF 현재가와 전일 종가를 가져옵니다.
 */

const https = require('https');

/**
 * 여러 종목 시세를 한 번에 가져오기
 * @param {string[]} tickers - 예: ['TQQQ', 'SOXL', 'GDXU']
 * @returns {Promise<Object>} - { TQQQ: { price, prevClose, change }, ... }
 */
async function getPrices(tickers) {
  const results = {};

  // 야후 파이낸스는 여러 종목을 콤마로 묶어서 요청 가능
  const symbolStr = tickers.join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbolStr}`;

  const data = await new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('시세 데이터 파싱 실패'));
        }
      });
    }).on('error', reject);
  });

  const quotes = data?.quoteResponse?.result || [];

  for (const q of quotes) {
    results[q.symbol] = {
      price: q.regularMarketPrice || 0,
      prevClose: q.regularMarketPreviousClose || 0,
      change: q.regularMarketChangePercent || 0,
      currency: q.currency || 'USD',
      name: q.shortName || q.symbol
    };
  }

  // 요청했는데 결과가 없는 종목 처리
  for (const t of tickers) {
    if (!results[t]) {
      results[t] = { price: 0, prevClose: 0, change: 0, currency: 'USD', name: t };
    }
  }

  return results;
}

module.exports = { getPrices };
