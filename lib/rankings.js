/**
 * 일봉 기준 수익률·거래대금 증감 순위
 * bars: [{ date:'YYYYMMDD', close, volume, amount? }] 최신→과거 또는 과거→최신 모두 허용
 */
const { parseYmd } = require('./period-labels');

function toNum(v) {
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** 날짜 오름차순 정렬 */
function sortBars(bars) {
  return [...bars].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/**
 * @returns {{ ret: number|null, volChg: number|null, amountChg: number|null }}
 */
function calcWindow(barsAsc, startDate, endDate) {
  if (!barsAsc.length) {
    return { ret: null, volChg: null, amountChg: null };
  }

  const inRange = barsAsc.filter((b) => {
    const t = parseYmd(b.date);
    return t && t >= startDate && t <= endDate;
  });

  if (inRange.length < 1) {
    return { ret: null, volChg: null, amountChg: null };
  }

  const first = inRange[0];
  const last = inRange[inRange.length - 1];
  const c0 = toNum(first.close);
  const c1 = toNum(last.close);
  const ret = c0 > 0 ? ((c1 - c0) / c0) * 100 : null;

  // 거래량: 구간 합 vs 직전 동일 길이 구간 합 (증감율)
  const volSum = inRange.reduce((s, b) => s + toNum(b.volume), 0);
  const amtSum = inRange.reduce(
    (s, b) => s + (toNum(b.amount) || toNum(b.close) * toNum(b.volume)),
    0
  );

  const spanMs = endDate - startDate;
  const prevEnd = new Date(startDate.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - spanMs);
  const prevRange = barsAsc.filter((b) => {
    const t = parseYmd(b.date);
    return t && t >= prevStart && t <= prevEnd;
  });
  const prevVol = prevRange.reduce((s, b) => s + toNum(b.volume), 0);
  const prevAmt = prevRange.reduce(
    (s, b) => s + (toNum(b.amount) || toNum(b.close) * toNum(b.volume)),
    0
  );

  const volChg = prevVol > 0 ? ((volSum - prevVol) / prevVol) * 100 : null;
  const amountChg = prevAmt > 0 ? ((amtSum - prevAmt) / prevAmt) * 100 : null;

  return {
    ret: ret != null ? Number(ret.toFixed(2)) : null,
    volChg: volChg != null ? Number(volChg.toFixed(2)) : null,
    amountChg: amountChg != null ? Number(amountChg.toFixed(2)) : null,
    amountKrwHint: amtSum, // 달러 거래대금 근사 (환율은 상위에서)
  };
}

/**
 * 일 = 마지막 봉 vs 그 전 봉
 */
function calcDay(barsAsc) {
  if (barsAsc.length < 2) {
    return { ret: null, volChg: null, amountChg: null };
  }
  const a = barsAsc[barsAsc.length - 2];
  const b = barsAsc[barsAsc.length - 1];
  const c0 = toNum(a.close);
  const c1 = toNum(b.close);
  const ret = c0 > 0 ? Number((((c1 - c0) / c0) * 100).toFixed(2)) : null;
  const v0 = toNum(a.volume);
  const v1 = toNum(b.volume);
  const volChg = v0 > 0 ? Number((((v1 - v0) / v0) * 100).toFixed(2)) : null;
  const amt0 = toNum(a.amount) || c0 * v0;
  const amt1 = toNum(b.amount) || c1 * v1;
  const amountChg =
    amt0 > 0 ? Number((((amt1 - amt0) / amt0) * 100).toFixed(2)) : null;
  return { ret, volChg, amountChg };
}

/**
 * labels: periodLabels() 결과
 * seriesMap: { TQQQ: bars[], ... }
 */
function buildRankings(seriesMap, labels) {
  const rows = [];

  for (const [ticker, bars] of Object.entries(seriesMap)) {
    const asc = sortBars(bars || []);
    if (!asc.length) continue;

    const day = calcDay(asc);
    const week = calcWindow(asc, labels._weekStart, labels._end);
    const month = calcWindow(asc, labels._monthStart, labels._end);
    const year = calcWindow(asc, labels._yearStart, labels._end);

    rows.push({
      ticker,
      day,
      week,
      month,
      year,
    });
  }

  function top(key, field, n = 10) {
    return rows
      .filter((r) => r[key][field] != null)
      .sort((a, b) => b[key][field] - a[key][field])
      .slice(0, n)
      .map((r, i) => ({
        rank: i + 1,
        ticker: r.ticker,
        value: r[key][field],
      }));
  }

  return {
    returnRank: {
      day: top('day', 'ret'),
      week: top('week', 'ret'),
      month: top('month', 'ret'),
      year: top('year', 'ret'),
    },
    volumeRank: {
      day: top('day', 'amountChg'),
      week: top('week', 'amountChg'),
      month: top('month', 'amountChg'),
      year: top('year', 'amountChg'),
    },
  };
}

/** 색/이모지: 일·주·월 부호 (연 제외) */
function styleEmoji(retDay, retWeek, retMonth) {
  const signs = [retDay, retWeek, retMonth].map((v) =>
    v == null ? null : v >= 0
  );
  if (signs.some((s) => s === false)) {
    // 하나라도 마이너스
    if (signs.every((s) => s === false)) return '🔴';
    return '🟢'; // 혼재
  }
  if (signs.every((s) => s === true)) return '🔵';
  return '⚪';
}

module.exports = {
  sortBars,
  calcDay,
  calcWindow,
  buildRankings,
  styleEmoji,
  toNum,
};
