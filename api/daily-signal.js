/**
 * 한투 봇 — 시세·순위
 * 본문: 🔵🟢🔴 + 순위 + 종목 + %
 * 보조: >+10% 🔥 / <-10% 🌧️ / 그외 ⭐
 * 가격: 한국어 달러 + 상승/하락
 */
const https = require('https');
const CONFIG = require('../lib/config');
const { periodLabels, parseYmd } = require('../lib/period-labels');
const { buildRankings } = require('../lib/rankings');
const { getAccessToken } = require('../lib/kis-token');
const { getUsdKrwRate } = require('../lib/fx');
const { getRealPositions } = require('../lib/balance');
const { sendMessage, sendMessageWithButtons } = require('../lib/telegram');
const { buildEtfButtonRows } = require('../lib/etf-profiles');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fmtPct(v) {
  if (v == null || Number.isNaN(v)) return '-';
  return (v >= 0 ? `+${v}` : `${v}`) + '%';
}

/** 보조줄: +10% 초과 🔥, -10% 미만 🌧️, 나머지 ⭐ */
function subLineMark(pct) {
  if (pct == null || Number.isNaN(pct)) return '⭐';
  const n = Number(pct);
  if (n > 10) return '🔥';
  if (n < -10) return '🌧️';
  return '⭐';
}

function fmtDollar(v) {
  if (v == null || Number.isNaN(v)) return '-';
  return Number(v).toFixed(2) + '달러';
}

function fmtDollarDiffKo(v) {
  if (v == null || Number.isNaN(v)) return '-';
  if (v > 0) return '상승 +' + Number(v).toFixed(2) + '달러';
  if (v < 0) return '하락 -' + Math.abs(Number(v)).toFixed(2) + '달러';
  return '보합 0달러';
}

function fmtKrwFromUsd(usd, fx) {
  if (usd == null || !fx || !(fx > 0)) return '-';
  const krw = Number(usd) * fx;
  const abs = Math.abs(krw);
  const sign = krw < 0 ? '-' : '';
  if (abs >= 1e12) return sign + (abs / 1e12).toFixed(2) + '조원';
  if (abs >= 1e8) return sign + (abs / 1e8).toFixed(1) + '억';
  if (abs >= 1e4) return sign + Math.round(abs / 1e4) + '만원';
  return sign + Math.round(abs).toLocaleString('ko-KR') + '원';
}

function formatReturnBlock(title, periodText, list) {
  if (!list.length) return `${title} (${periodText})\n  (데이터 없음)`;
  const lines = list.map((x) => {
    const main = `  ${x.emoji || '⚪'} ${x.rank}. ${x.ticker} ${fmtPct(x.value)}`;
    if (x.price0 == null || x.price1 == null) return main;
    const mag = subLineMark(x.value);
    const sub =
      `\n     ${mag} ${fmtDollar(x.price0)} → ${fmtDollar(x.price1)} (${fmtDollarDiffKo(x.priceDiff)})`;
    return main + sub;
  });
  return `${title} (${periodText})\n${lines.join('\n')}`;
}

function formatVolumeBlock(title, periodText, list, fxRate) {
  if (!list.length) return `${title} (${periodText})\n  (데이터 없음)`;
  const lines = list.map((x) => {
    const main = `  ${x.emoji || '⚪'} ${x.rank}. ${x.ticker} ${fmtPct(x.value)}`;
    const mag = subLineMark(x.value);
    const periodKrw = fmtKrwFromUsd(x.amtSum, fxRate);
    const absDiff = x.amtDiff == null ? null : Math.abs(x.amtDiff);
    const diffLabel =
      x.amtDiff == null
        ? '-'
        : x.amtDiff > 0
          ? '증가 ' + fmtKrwFromUsd(absDiff, fxRate)
          : x.amtDiff < 0
            ? '감소 ' + fmtKrwFromUsd(absDiff, fxRate)
            : '보합';
    const sub = `\n     ${mag} 기간 ${periodKrw} · ${diffLabel}`;
    return main + sub;
  });
  return `${title} (${periodText})\n${lines.join('\n')}`;
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
  return Object.values(map).sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );
}

async function fetchAllBars(token) {
  const seriesMap = {};
  for (const item of CONFIG.WATCH_LIST || []) {
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

async function sendTelegramSafe(text) {
  const MAX = 3500;
  const chunks = [];
  if (text.length <= MAX) chunks.push(text);
  else {
    let rest = text;
    while (rest.length > 0) {
      chunks.push(rest.slice(0, MAX));
      rest = rest.slice(MAX);
    }
  }
  const results = [];
  for (const chunk of chunks) {
    results.push(await sendMessage(chunk));
    await sleep(300);
  }
  return results;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const token = await getAccessToken();

    const fx = await getUsdKrwRate(token);
    const fxRate = fx && fx.rate > 0 ? fx.rate : null;
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
      `본문: 🔵일주월+  🟢혼재  🔴해당-`,
      `보조: 🔥증감>10%  🌧️하락<-10%  ⭐그외`,
      ``,
      formatCash(fx),
      ``,
      formatHoldings(positions),
      ``,
      `미국 레버리지 수익률 TOP${topN}`,
      formatReturnBlock('일', labels.day, ranks.returnRank.day),
      formatReturnBlock('주', labels.week, ranks.returnRank.week),
      formatReturnBlock('월', labels.month, ranks.returnRank.month),
      formatReturnBlock('연', labels.year, ranks.returnRank.year),
      ``,
      `거래대금 증감 TOP${topN}`,
      formatVolumeBlock('일', labels.day, ranks.volumeRank.day, fxRate),
      formatVolumeBlock('주', labels.week, ranks.volumeRank.week, fxRate),
      formatVolumeBlock('월', labels.month, ranks.volumeRank.month, fxRate),
      formatVolumeBlock('연', labels.year, ranks.volumeRank.year, fxRate),
    ].join('\n');

    let telegram = null;
    let telegramError = null;
    try {
      telegram = await sendTelegramSafe(msg);
      await sleep(400);
      const tickers = (CONFIG.WATCH_LIST || []).map((x) => x.ticker);
      await sendMessageWithButtons(
        '종목 버튼을 누르면 섹터·성향·주요 익스포저를 볼 수 있습니다.',
        buildEtfButtonRows(tickers)
      );
    } catch (e) {
      telegramError = e.message;
      console.error('telegram', e.message);
    }

    res.status(200).json({
      success: true,
      telegramOk: !telegramError,
      telegramError,
      labels: {
        day: labels.day,
        week: labels.week,
        month: labels.month,
        year: labels.year,
      },
      positionCount: Object.keys(positions).length,
      fx: { rate: fx.rate, changePct: fx.changePct },
      msgLength: msg.length,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: e.message });
  }
};
