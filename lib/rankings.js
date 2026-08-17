/**
 * 일봉 기준 수익률·거래대금 증감 순위 + 색 아이콘
 */
const { parseYmd } = require('./period-labels');

function toNum(v) {
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function sortBars(bars) {
  return [...bars].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

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
  };
}

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
 * 일·주·월 기준 색
 * 🔵 세 구간 모두 +
 * 🟢 혼재 (일부만 +)
 * 🔴 해당 값이 - 이거나 세 구간 모두 -
 * ⚪ 데이터 부족
 */
function styleEmoji(dayVal, weekVal, monthVal, focusVal) {
  if (focusVal != null && focusVal < 0) return '🔴';
  const signs = [dayVal, weekVal, monthVal].map((v) =>
    v == null ? null : v >= 0
  );
  const known = signs.filter((s) => s !== null);
  if (!known.length) return '⚪';
  if (known.every((s) => s === true)) return '🔵';
  if (known.every((s) => s === false)) return '🔴';
  return '🟢';
}

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
      emojiRet: styleEmoji(day.ret, week.ret, month.ret, null),
      emojiVol: styleEmoji(day.amountChg, week.amountChg, month.amountChg, null),
    });
  }

  function top(key, field, n, emojiField) {
    return rows
      .filter((r) => r[key][field] != null)
      .sort((a, b) => b[key][field] - a[key][field])
      .slice(0, n)
      .map((r, i) => ({
        rank: i + 1,
        ticker: r.ticker,
        value: r[key][field],
        emoji: styleEmoji(
          r.day[field === 'ret' ? 'ret' : 'amountChg'],
          r.week[field === 'ret' ? 'ret' : 'amountChg'],
          r.month[field === 'ret' ? 'ret' : 'amountChg'],
          r[key][field]
        ),
      }));
  }

  const n = 10;
  return {
    returnRank: {
      day: top('day', 'ret', n),
      week: top('week', 'ret', n),
      month: top('month', 'ret', n),
      year: top('year', 'ret', n),
    },
    volumeRank: {
      day: top('day', 'amountChg', n),
      week: top('week', 'amountChg', n),
      month: top('month', 'amountChg', n),
      year: top('year', 'amountChg', n),
    },
  };
}

module.exports = {
  sortBars,
  calcDay,
  calcWindow,
  buildRankings,
  styleEmoji,
  toNum,
};
