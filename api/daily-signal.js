/**
 * 한투 봇 — 일일 시세·잔고·3배 순위 (에버라이징 매매 규칙 없음)
 * Vercel: /api/daily-signal
 */
const CONFIG = require('../lib/config');
const { periodLabels, parseYmd } = require('../lib/period-labels');
const { buildRankings, toNum } = require('../lib/rankings');

// ----- 프로젝트에 맞게 경로만 조정 -----
// 예: const { getAccessToken } = require('../lib/kis-auth');
//     const { getOverseasPrice, getDailyBars, getFx, getBalance } = require('../lib/kis');
const kis = require('../lib/kis'); // getAccessToken, fetchDailyBars, fetchPrice, fetchFx, fetchOverseasBalance, sendTelegram

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fmtPct(v) {
  if (v == null || Number.isNaN(v)) return '-';
  const s = v >= 0 ? `+${v}` : `${v}`;
  return `${s}%`;
}

function formatRankBlock(title, periodText, list) {
  const lines = list.length
    ? list.map((x) => `  ${x.rank}. ${x.ticker} ${fmtPct(x.value)}`).join('\n')
    : '  (데이터 없음)';
  return `${title} (${periodText})\n${lines}`;
}

function formatHoldings(balance) {
  if (!balance || !balance.positions || !balance.positions.length) {
    return '📦 보유 종목\n  없음';
  }
  const lines = balance.positions.map((p) => {
    const pnl = p.pnl != null ? fmtPct(p.returnPct) : '';
    return `  ${p.ticker} ${p.qty}주 · 평가 ${Number(p.evalAmount || 0).toLocaleString()} · ${pnl}`;
  });
  return `📦 보유 종목\n${lines.join('\n')}`;
}

function formatCash(balance, fx) {
  const krw = balance?.cashKrw != null ? Number(balance.cashKrw).toLocaleString() : '-';
  const usd = balance?.cashUsd != null ? Number(balance.cashUsd).toLocaleString() : '-';
  const rate =
    fx && fx.rate != null
      ? `${fx.rate} (전일대비 ${fx.changePct != null ? fmtPct(fx.changePct) : '-'})`
      : '-';
  return `💵 현금·환율\n  원화: ${krw}\n  달러: ${usd}\n  환율: ${rate}`;
}

async function fetchAllBars(token) {
  const map = {};
  for (const item of CONFIG.WATCH_LIST) {
    try {
      const bars = await kis.fetchDailyBars(token, item.ticker, item.excd || 'NAS');
      // bars: [{ date:'YYYYMMDD', close, volume, amount? }, ...]
      map[item.ticker] = bars || [];
    } catch (e) {
      console.error('bars fail', item.ticker, e.message);
      map[item.ticker] = [];
    }
    await sleep(CONFIG.API_GAP_MS);
  }
  return map;
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

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const token = await kis.getAccessToken();

    // 1) 환율
    let fx = { rate: null, changePct: null };
    try {
      fx = await kis.fetchFx(token);
    } catch (e) {
      console.error('fx', e.message);
    }
    await sleep(CONFIG.API_GAP_MS);

    // 2) 잔고·보유 (입출금/보유 유지)
    let balance = { cashKrw: null, cashUsd: null, positions: [] };
    try {
      balance = await kis.fetchOverseasBalance(token);
    } catch (e) {
      console.error('balance', e.message);
    }
    await sleep(CONFIG.API_GAP_MS);

    // 3) 일봉 → 순위
    const seriesMap = await fetchAllBars(token);
    const asOf = resolveAsOf(seriesMap);
    const labels = periodLabels(asOf);
    const ranks = buildRankings(seriesMap, labels);

    // 4) 메시지 (매매 규칙·승인 버튼 없음)
    const msg = [
      `📋 한투 시세 리포트`,
      `기준 거래일 근사: ${labels.day}`,
      ``,
      formatCash(balance, fx),
      ``,
      formatHoldings(balance),
      ``,
      `📊 미국 레버리지 수익률 TOP${CONFIG.RANK_TOP}`,
      formatRankBlock('• 일', labels.day, ranks.returnRank.day),
      formatRankBlock('• 주', labels.week, ranks.returnRank.week),
      formatRankBlock('• 월', labels.month, ranks.returnRank.month),
      formatRankBlock('• 연', labels.year, ranks.returnRank.year),
      ``,
      `💰 거래대금 증감 TOP${CONFIG.RANK_TOP}`,
      formatRankBlock('• 일', labels.day, ranks.volumeRank.day),
      formatRankBlock('• 주', labels.week, ranks.volumeRank.week),
      formatRankBlock('• 월', labels.month, ranks.volumeRank.month),
      formatRankBlock('• 연', labels.year, ranks.volumeRank.year),
    ].join('\n');

    if (typeof kis.sendTelegram === 'function') {
      await kis.sendTelegram(msg);
    }

    res.status(200).json({
      success: true,
      labels: {
        day: labels.day,
        week: labels.week,
        month: labels.month,
        year: labels.year,
      },
      returnRank: ranks.returnRank,
      volumeRank: ranks.volumeRank,
      balanceSummary: {
        cashKrw: balance.cashKrw,
        cashUsd: balance.cashUsd,
        positionCount: (balance.positions || []).length,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: e.message });
  }
};
