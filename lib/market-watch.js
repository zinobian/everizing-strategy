/**
 * 3배 레버리지 18종 · 일/주/월/연 수익률·거래량 TOP10
 */

const https = require('https');

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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function formatVol(n) {
  if (!n || n <= 0) return '-';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
}

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
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve({ rt_cd: '1' }); }
      });
    });
    req.on('error', () => resolve({ rt_cd: '1' }));
    req.end();
  });
}

/** 일봉 (최신 n개에 가깝게, 1페이지) */
function inquireDaily(accessToken, appKey, appSecret, ticker, excd) {
  return new Promise((resolve) => {
    const path =
      `/uapi/overseas-price/v1/quotations/dailyprice?AUTH=&EXCD=${excd}&SYMB=${ticker}&GUBN=0&BYMD=&MODP=1`;
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
        tr_id: 'HHDFS76240000'
      },
      rejectUnauthorized: false
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve({ rt_cd: '1', output2: [] }); }
      });
    });
    req.on('error', () => resolve({ rt_cd: '1', output2: [] }));
    req.end();
  });
}

function parseBars(raw) {
  const rows = raw.output2 || raw.output1 || [];
  if (!Array.isArray(rows)) return [];
  // 보통 최신→과거 또는 과거→최신. 날짜 정렬
  const bars = rows.map(r => ({
    date: r.xymd || r.basi_dt || '',
    close: parseFloat(r.clos || r.close || r.ovrs_nmix_prpr || 0),
    volume: parseFloat(r.tvol || r.acml_vol || r.pvol || 0)
  })).filter(b => b.close > 0);

  bars.sort((a, b) => (a.date < b.date ? -1 : 1)); // 오래된 → 최신
  return bars;
}

function retFromBars(bars, tradingDays) {
  if (!bars.length) return null;
  const last = bars[bars.length - 1];
  const idx = Math.max(0, bars.length - 1 - tradingDays);
  const prev = bars[idx];
  if (!prev || !prev.close) return null;
  return ((last.close - prev.close) / prev.close) * 100;
}

function volSum(bars, tradingDays) {
  if (!bars.length) return 0;
  const slice = bars.slice(Math.max(0, bars.length - tradingDays));
  return slice.reduce((s, b) => s + (b.volume || 0), 0);
}

async function getWatchQuotes(accessToken, appKey, appSecret) {
  const results = [];

  for (const item of WATCH_LIST) {
    const raw = await inquirePrice(accessToken, appKey, appSecret, item.ticker, item.excd);
    await sleep(350);

    let price = 0, prev = 0, rate = 0, volume = 0;
    if (raw.rt_cd === '0' && raw.output) {
      const o = raw.output;
      price = parseFloat(o.last || o.base || 0);
      prev = parseFloat(o.base || 0);
      rate = parseFloat(o.rate || 0);
      volume = parseFloat(o.tvol || o.pvol || 0);
    }

    // 일봉 → 주·월·연
    const dailyRaw = await inquireDaily(accessToken, appKey, appSecret, item.ticker, item.excd);
    await sleep(350);
    const bars = parseBars(dailyRaw);

    const retDay = rate || (prev ? ((price - prev) / prev) * 100 : null);
    const retWeek = retFromBars(bars, 5);
    const retMonth = retFromBars(bars, 21);
    const retYear = retFromBars(bars, Math.min(252, Math.max(0, bars.length - 1)));

    const volDay = volume || (bars.length ? bars[bars.length - 1].volume : 0);
    const volWeek = volSum(bars, 5);
    const volMonth = volSum(bars, 21);
    const volYear = volSum(bars, Math.min(252, bars.length));

    results.push({
      ticker: item.ticker,
      name: item.name,
      price,
      ok: price > 0,
      retDay,
      retWeek,
      retMonth,
      retYear,
      volDay,
      volWeek,
      volMonth,
      volYear
    });
  }

  return results;
}

function topN(list, key, n = 10) {
  return [...list]
    .filter(x => x.ok && x[key] != null && !Number.isNaN(x[key]))
    .sort((a, b) => b[key] - a[key])
    .slice(0, n);
}

function formatRankBlock(title, rows, key, isVol = false) {
  if (!rows || rows.length === 0) return `▶ ${title}\n(데이터 없음)\n\n`;
  let msg = `▶ ${title}\n`;
  rows.forEach((r, i) => {
    if (isVol) {
      msg += `${i + 1}. ${r.ticker}  ${formatVol(r[key])}\n`;
    } else {
      const v = r[key];
      const sign = v >= 0 ? '+' : '';
      msg += `${i + 1}. ${r.ticker}  ${sign}${Number(v).toFixed(2)}%\n`;
    }
  });
  return msg + '\n';
}

function formatWatchBlock(quotes) {
  if (!quotes || quotes.length === 0) return '';

  let msg = `📊 <b>3배 레버리지 순위</b>\n`;
  msg += `※ 추적 ${WATCH_LIST.length}종 · TOP10 · 3배만\n\n`;

  msg += formatRankBlock('수익률 · 일', topN(quotes, 'retDay'), 'retDay');
  msg += formatRankBlock('수익률 · 주', topN(quotes, 'retWeek'), 'retWeek');
  msg += formatRankBlock('수익률 · 월', topN(quotes, 'retMonth'), 'retMonth');
  msg += formatRankBlock('수익률 · 연', topN(quotes, 'retYear'), 'retYear');

  msg += formatRankBlock('거래량 · 일', topN(quotes, 'volDay'), 'volDay', true);
  msg += formatRankBlock('거래량 · 주', topN(quotes, 'volWeek'), 'volWeek', true);
  msg += formatRankBlock('거래량 · 월', topN(quotes, 'volMonth'), 'volMonth', true);
  msg += formatRankBlock('거래량 · 연', topN(quotes, 'volYear'), 'volYear', true);

  return msg;
}

module.exports = {
  WATCH_LIST,
  getWatchQuotes,
  formatWatchBlock,
  topN
};
