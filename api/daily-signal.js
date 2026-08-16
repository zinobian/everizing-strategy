/**
 * 한투 봇 — 시세·잔고·3배 순위 전용 (에버라이징 매매 규칙 없음)
 */
const https = require('https');
const CONFIG = require('../lib/config');
const { periodLabels, parseYmd } = require('../lib/period-labels');
const { buildRankings } = require('../lib/rankings');
const { getAccessToken } = require('../lib/kis-token');
const { getUsdKrwRate } = require('../lib/fx');
const { getRealPositions } = require('../lib/balance');
const { sendMessage } = require('../lib/telegram');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fmtPct(v) {
  if (v == null || Number.isNaN(v)) return '-';
  return (v >= 0 ? `+${v}` : `${v}`) + '%';
}

function formatRankBlock(title, periodText, list) {
  const lines = list.length
    ? list.map((x) => `  ${x.rank}. ${x.ticker} ${fmtPct(x.value)}`).join('\n')
    : '  (데이터 없음)';
  return `${title} (${periodText})\n${lines}`;
}

function formatHoldings(positions) {
  const keys = Object.keys(positions || {});
  if (!keys.length) return '📦 보유 종목\n  없음';
  const lines = keys.map((t) => {
    const p = positions[t];
    return `  ${t} ${p.qty}주 · 평단 ${p.avgPrice}`;
  });
  return `📦 보유 종목\n${lines.join('\n')}`;
}

function formatCash(fx) {
  const rate =
    fx && fx.rate != null
      ? `${fx.rate} (전일대비 ${fx.changePct != null ? fmtPct(fx.changePct) : '-'})`
      : '-';
  return `💵 환율\n  USD/KRW: ${rate}`;
}

function httpsGetJson(path, token, appKey, appSecret, trId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'openapi.koreainvestment.com',
      port: 9443,
      path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        appkey: appKey,
        appsecret: appSecret,
        tr_id: trId,
      },
      rejectUnauthorized: false,
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
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

function normalizeDaily(raw) {
  const rows = raw.output2 || raw.output || [];
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => ({
      date: r.xymd || r.date || '',
      close: parseFloat(r.clos || r.close || r.last || 0),
      volume: parseFloat(r.tvol || r.volume || 0),
      amount: parseFloat(r.tamt || 0) || undefined,
    }))
    .filter((r) => r.close > 0 && r.date);
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

async function fetchDailyBars(token, ticker, excd) {
  const appKey = process.env.KIS_API_KEY;
  const appSecret = process.env.KIS_API_SECRET;
  let all = [];
  let bymd = '';

  for (let i = 0; i < 3; i++) {
    const path =
      `/uapi/overseas-price/v1/quotations/dailyprice` +
      `?AUTH=&EXCD=${excd}&SYMB=${ticker}&GUBN=0&BYMD=${bymd}&MODP=1`;
    const raw = await httpsGetJson(path, token, appKey, appSecret, 'HHDFS76240000');
    if (raw.rt_cd !== '0') break;
    const part = normalizeDaily(raw);
    if (!part.length) break;
    all = all.concat(part);
    const oldest = part[part.length - 1]?.date || part[0]?.date;
    if (!oldest) break;
    bymd = shiftDateYYYYMMDD(oldest, 1);
    await sleep(CONFIG.API_GAP_MS || 350);
  }

  const map = {};
  for (const d of all) map[d.date] = d;
  return Object.values(map).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

async function fetchAllBars(token) {
  const seriesMap = {};
  const list = CONFIG.WATCH_LIST || [];
  for (const item of list) {
    try {
      seriesMap[item.ticker] = await fetchDailyBars(
        token,
        item.ticker,
        item.excd || 'NAS'
      );
    } catch (e) {
      console.error('bars fail', item.ticker, e.message);
      seriesMap[item.ticker] = [];
    }
    await sleep(CONFIG.API_GAP_MS || 350);
  }
  return seriesMap;
}

function resolveAsOf(seriesMap) {
  let maxD = null;
  for (const bars of Object.values(seriesMap)) {
    for (const b of bars || []) {
      const d = parseYmd(b.date);
      if (d && (!maxD || d > maxD)) maxD = d;
    }
  }
  return maxD || new Date();
}

/** 텔레그램 4096자 제한 → 나눠 전송 */
async function sendTelegramSafe(text) {
  const MAX = 3500;
  const chunks = [];
  if (text.length <= MAX) {
    chunks.push(text);
  } else {
    let rest = text;
    while (rest.length > 0) {
      chunks.push(rest.slice(0, MAX));
      rest = rest.slice(MAX);
    }
  }

  const results = [];
  for (const chunk of chunks) {
    const r = await sendMessage(chunk);
    results.push(r);
    await sleep(300);
  }
  return results;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const token = await getAccessToken();

    const fx = await getUsdKrwRate(token);
    await sleep(CONFIG.API_GAP_MS || 350);

    let positions = {};
    try {
      const bal = await getRealPositions(token);
      positions = bal.positions || {};
    } catch (e) {
      console.error('balance', e.message);
    }
    await sleep(CONFIG.API_GAP_MS || 350);

    const seriesMap = await fetchAllBars(token);
    const asOf = resolveAsOf(seriesMap);
    const labels = periodLabels(asOf);
    const ranks = buildRankings(seriesMap, labels);
    const topN = CONFIG.RANK_TOP || 10;

    const msg = [
      `한투 시세 리포트`,
      `기준: ${labels.day}`,
      ``,
      formatCash(fx),
      ``,
      formatHoldings(positions),
      ``,
      `미국 레버리지 수익률 TOP${topN}`,
      formatRankBlock('일', labels.day, ranks.returnRank.day),
      formatRankBlock('주', labels.week, ranks.returnRank.week),
      formatRankBlock('월', labels.month, ranks.returnRank.month),
      formatRankBlock('연', labels.year, ranks.returnRank.year),
      ``,
      `거래대금 증감 TOP${topN}`,
      formatRankBlock('일', labels.day, ranks.volumeRank.day),
      formatRankBlock('주', labels.week, ranks.volumeRank.week),
      formatRankBlock('월', labels.month, ranks.volumeRank.month),
      formatRankBlock('연', labels.year, ranks.volumeRank.year),
    ].join('\n');

    let telegram = null;
    let telegramError = null;
    try {
      telegram = await sendTelegramSafe(msg);
    } catch (e) {
      telegramError = e.message;
      console.error('telegram', e.message);
    }

    res.status(200).json({
      success: true,
      telegramOk: !telegramError,
      telegramError,
      telegram,
      labels: {
        day: labels.day,
        week: labels.week,
        month: labels.month,
        year: labels.year,
      },
      returnRank: ranks.returnRank,
      volumeRank: ranks.volumeRank,
      positionCount: Object.keys(positions).length,
      fx: { rate: fx.rate, changePct: fx.changePct },
      msgLength: msg.length,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: e.message });
  }
};
