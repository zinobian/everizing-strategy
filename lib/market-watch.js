/**
 * 3배 레버리지 추적 유니버스 + 시세
 * 수익률·거래량 TOP10 계산용
 */

const https = require('https');

/** 3배 롱 추적 목록 (확정 18종) */
const WATCH_LIST = [
  { ticker: 'TQQQ', name: '나스닥100 3x', excd: 'NAS' },
  { ticker: 'SOXL', name: '반도체 3x', excd: 'AMS' },
  { ticker: 'SPXL', name: 'S&P500 3x', excd: 'AMS' },
  { ticker: 'UPRO', name: 'S&P500 3x', excd: 'AMS' },
  { ticker: 'TECL', name: '기술 3x', excd: 'AMS' },
  { ticker: 'FAS', name: '금융 3x', excd: 'AMS' },
  { ticker: 'TNA', name: '소형주 3x', excd: 'AMS' },
  { ticker: 'FNGU', name: 'FANG+ 3x', excd: 'AMS' },
  { ticker: 'BULZ', name: 'FANG혁신 3x', excd: 'AMS' },
  { ticker: 'GDXU', name: '금광 3x', excd: 'AMS' },
  { ticker: 'DFEN', name: '방산 3x', excd: 'AMS' },
  { ticker: 'UTSL', name: '유틸리티 3x', excd: 'AMS' },
  { ticker: 'LABU', name: '바이오 3x', excd: 'AMS' },
  { ticker: 'KORU', name: '한국 3x', excd: 'AMS' },
  { ticker: 'YINN', name: '중국 3x', excd: 'AMS' },
  { ticker: 'UDOW', name: '다우 3x', excd: 'AMS' },
  { ticker: 'CURE', name: '헬스케어 3x', excd: 'AMS' },
  { ticker: 'HIBL', name: '고베타 3x', excd: 'AMS' }
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

/**
 * 현재가 + 등락 + 거래량(가능 시)
 */
async function getWatchQuotes(accessToken, appKey, appSecret) {
  const results = [];

  for (const item of WATCH_LIST) {
    const raw = await inquirePrice(accessToken, appKey, appSecret, item.ticker, item.excd);
    await new Promise(r => setTimeout(r, 400));

    if (raw.rt_cd === '0' && raw.output) {
      const o = raw.output;
      const price = parseFloat(o.last || o.base || 0);
      const prev = parseFloat(o.base || 0);
      const rate = parseFloat(o.rate || 0);
      const volume = parseFloat(o.tvol || o.pvol || 0);

      results.push({
        ticker: item.ticker,
        name: item.name,
        price,
        prev,
        changePct: rate || (prev ? ((price - prev) / prev) * 100 : 0),
        volume: volume || 0,
        ok: price > 0
      });
    } else {
      results.push({
        ticker: item.ticker,
        name: item.name,
        price: null,
        changePct: null,
        volume: 0,
        ok: false
      });
    }
  }

  return results;
}

/** 간단한 TOP N (값 기준 내림차순) */
function topN(list, key, n = 10) {
  return [...list]
    .filter(x => x.ok && x[key] != null && !Number.isNaN(x[key]))
    .sort((a, b) => b[key] - a[key])
    .slice(0, n);
}

/**
 * 당일 등락·거래량 TOP (1차)
 * 일·주·월·연 수익률은 daily 히스토리 연동 후 확장
 */
function buildDayRankings(quotes) {
  return {
    returnDay: topN(quotes, 'changePct', 10),
    volumeDay: topN(quotes, 'volume', 10)
  };
}

function formatRankBlock(title, rows, valueKey, suffix = '%') {
  if (!rows || rows.length === 0) return '';
  let msg = `▶ ${title}\n`;
  rows.forEach((r, i) => {
    const v = r[valueKey];
    if (valueKey === 'volume') {
      msg += `${i + 1}. ${r.ticker}\n`;
    } else {
      const sign = v >= 0 ? '+' : '';
      msg += `${i + 1}. ${r.ticker}  ${sign}${Number(v).toFixed(2)}${suffix}\n`;
    }
  });
  msg += `\n`;
  return msg;
}

function formatWatchBlock(quotes) {
  if (!quotes || quotes.length === 0) return '';

  const day = buildDayRankings(quotes);
  let msg = `📊 <b>3배 레버리지 순위</b>\n`;
  msg += `※ 추적 ${WATCH_LIST.length}종 · TOP10 · 3배만\n\n`;
  msg += formatRankBlock('수익률 · 일', day.returnDay, 'changePct', '%');
  msg += formatRankBlock('거래량 · 일', day.volumeDay, 'volume', '');
  msg += `<i>주·월·연은 다음 단계에서 연결</i>\n\n`;
  return msg;
}

module.exports = {
  WATCH_LIST,
  getWatchQuotes,
  buildDayRankings,
  topN,
  formatWatchBlock,
  formatRankBlock
};
