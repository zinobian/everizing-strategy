/**
 * 3배 레버리지 18종 · 일/주/월/연 수익률·거래량 TOP10
 * 거래량: 한글 단위 주수 + 원화 거래대금
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

/** 주수 → 한글 단위 */
function formatShares(n) {
  if (!n || n <= 0) return '-';
  if (n >= 1e8) {
    const eok = n / 1e8;
    return (eok >= 10 ? eok.toFixed(1) : eok.toFixed(2)) + '억 주';
  }
  if (n >= 1e4) {
    const man = n / 1e4;
    if (man >= 100) return Math.round(man).toLocaleString('ko-KR') + '만 주';
    if (man >= 10) return man.toFixed(1) + '만 주';
    return man.toFixed(2) + '만 주';
  }
  return Math.round(n).toLocaleString('ko-KR') + '주';
}

/** 원화 금액 → 조/억 */
function formatKrwMoney(n) {
  if (!n || n <= 0) return '-';
  if (n >= 1e12) {
    const jo = n / 1e12;
    return '약 ' + (jo >= 10 ? jo.toFixed(1) : jo.toFixed(2)) + '조원';
  }
  if (n >= 1e8) {
    const eok = n / 1e8;
    return '약 ' + (eok >= 10 ? Math.round(eok) : eok.toFixed(1)) + '억원';
  }
  if (n >= 1e4) return '약 ' + Math.round(n / 1e4).toLocaleString('ko-KR') + '만원';
  return '약 ' + Math.round(n).toLocaleString('ko-KR') + '원';
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
  const bars = rows.map(r => ({
    date: r.xymd || r.basi_dt || '',
    close: parseFloat(r.clos || r.close || r.ovrs_nmix_prpr || 0),
    volume: parseFloat(r.tvol || r.acml_vol || r.pvol || 0)
  })).filter(b => b.close > 0);
  bars.sort((a, b) => (a.date < b.date ? -1 : 1));
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

function formatReturnBlock(title, rows, key) {
  if (!rows || rows.length === 0) return `▶ ${title}\n(데이터 없음)\n\n`;
  let msg = `▶ ${title}\n`;
  rows.forEach((r, i) => {
    const v = r[key];
    const sign = v >= 0 ? '+' : '';
    msg += `${i + 1}. ${r.ticker}  ${sign}${Number(v).toFixed(2)}%\n`;
  });
  return msg + '\n';
}

/** 거래량: 주수 한글 + 원화 거래대금 */
function formatVolumeBlock(title, rows, volKey, fxRate) {
  if (!rows || rows.length === 0) return `▶ ${title}\n(데이터 없음)\n\n`;
  let msg = `▶ ${title}\n`;
  rows.forEach((r, i) => {
    const shares = r[volKey] || 0;
    const shareText = formatShares(shares);
    let krwText = '';
    if (fxRate && r.price && shares > 0) {
      // 기간 합산 주수는 평균가 근사로 현재가 사용
      const krw = shares * r.price * fxRate;
      krwText = `  |  ${formatKrwMoney(krw)}`;
    }
    msg += `${i + 1}. ${r.ticker}  ${shareText}${krwText}\n`;
  });
  return msg + '\n';
}

/**
 * @param {Array} quotes
 * @param {number} fxRate - USD/KRW (없으면 원화 생략)
 */
function formatWatchBlock(quotes, fxRate = 0) {
  if (!quotes || quotes.length === 0) return '';

  let msg = `📊 <b>3배 레버리지 순위</b>\n`;
  msg += `※ 추적 ${WATCH_LIST.length}종 · TOP10 · 3배만\n\n`;

  msg += formatReturnBlock('수익률 · 일', topN(quotes, 'retDay'), 'retDay');
  msg += formatReturnBlock('수익률 · 주', topN(quotes, 'retWeek'), 'retWeek');
  msg += formatReturnBlock('수익률 · 월', topN(quotes, 'retMonth'), 'retMonth');
  msg += formatReturnBlock('수익률 · 연', topN(quotes, 'retYear'), 'retYear');

  msg += formatVolumeBlock('거래량 · 일', topN(quotes, 'volDay'), 'volDay', fxRate);
  msg += formatVolumeBlock('거래량 · 주', topN(quotes, 'volWeek'), 'volWeek', fxRate);
  msg += formatVolumeBlock('거래량 · 월', topN(quotes, 'volMonth'), 'volMonth', fxRate);
  msg += formatVolumeBlock('거래량 · 연', topN(quotes, 'volYear'), 'volYear', fxRate);

  return msg;
}

module.exports = {
  WATCH_LIST,
  getWatchQuotes,
  formatWatchBlock,
  topN
};
