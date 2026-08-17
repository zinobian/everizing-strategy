/**
 * 수익률·거래대금 순위 + 가격/금액 상세
 */
const { parseYmd } = require('./period-labels');

function toNum(v) {
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function sortBars(bars) {
  return [...bars].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function barAmount(b) {
  const amt = toNum(b.amount);
  if (amt > 0) return amt;
  return toNum(b.close) * toNum(b.volume);
}

function calcWindow(barsAsc, startDate, endDate) {
  const empty = {
    ret: null,
    volChg: null,
    amountChg: null,
    price0: null,
    price1: null,
    priceDiff: null,
    amtSum: null,
    prevAmt: null,
    amtDiff: null,
  };
  if (!barsAsc.length) return empty;

  const inRange = barsAsc.filter((b) => {
    const t = parseYmd(b.date);
    return t && t >= startDate && t <= endDate;
  });
  if (!inRange.length) return empty;

  const first = inRange[0];
  const last = inRange[inRange.length - 1];
  const c0 = toNum(first.close);
  const c1 = toNum(last.close);
  const ret = c0 > 0 ? ((c1 - c0) / c0) * 100 : null;

  const amtSum = inRange.reduce((s, b) => s + barAmount(b), 0);
  const volSum = inRange.reduce((s, b) => s + toNum(b.volume), 0);

  const spanMs = endDate - startDate;
  const prevEnd = new Date(startDate.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - spanMs);
  const prevRange = barsAsc.filter((b) => {
    const t = parseYmd(b.date);
    return t && t >= prevStart && t <= prevEnd;
  });
  const prevVol = prevRange.reduce((s, b) => s + toNum(b.volume), 0);
  const prevAmt = prevRange.reduce((s, b) => s + barAmount(b), 0);

  const volChg = prevVol > 0 ? ((volSum - prevVol) / prevVol) * 100 : null;
  const amountChg = prevAmt > 0 ? ((amtSum - prevAmt) / prevAmt) * 100 : null;
  const amtDiff = prevAmt > 0 || amtSum > 0 ? amtSum - prevAmt : null;

  return {
    ret: ret != null ? Number(ret.toFixed(2)) : null,
    volChg: volChg != null ? Number(volChg.toFixed(2)) : null,
    amountChg: amountChg != null ? Number(amountChg.toFixed(2)) : null,
    price0: c0 > 0 ? Number(c0.toFixed(2)) : null,
    price1: c1 > 0 ? Number(c1.toFixed(2)) : null,
    priceDiff:
      c0 > 0 && c1 > 0 ? Number((c1 - c0).toFixed(2)) : null,
    amtSum: amtSum > 0 ? amtSum : null,
    prevAmt: prevAmt > 0 ? prevAmt : null,
    amtDiff,
  };
}

function calcDay(barsAsc) {
  const empty = {
    ret: null,
    volChg: null,
    amountChg: null,
    price0: null,
    price1: null,
    priceDiff: null,
    amtSum: null,
    prevAmt: null,
    amtDiff: null,
  };
  if (barsAsc.length < 2) return empty;

  const a = barsAsc[barsAsc.length - 2];
  const b = barsAsc[barsAsc.length - 1];
  const c0 = toNum(a.close);
  const c1 = toNum(b.close);
  const ret = c0 > 0 ? Number((((c1 - c0) / c0) * 100).toFixed(2)) : null;
  const v0 = toNum(a.volume);
  const v1 = toNum(b.volume);
  const volChg = v0 > 0 ? Number((((v1 - v0) / v0) * 100).toFixed(2)) : null;
  const amt0 = barAmount(a);
  const amt1 = barAmount(b);
  const amountChg =
    amt0 > 0 ? Number((((amt1 - amt0) / amt0) * 100).toFixed(2)) : null;

  return {
    ret,
    volChg,
    amountChg,
    price0: c0 > 0 ? Number(c0.toFixed(2)) : null,
    price1: c1 > 0 ? Number(c1.toFixed(2)) : null,
    priceDiff:
      c0 > 0 && c1 > 0 ? Number((c1 - c0).toFixed(2)) : null,
    amtSum: amt1 > 0 ? amt1 : null,
    prevAmt: amt0 > 0 ? amt0 : null,
    amtDiff: amt1 - amt0,
  };
}

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

    rows.push({ ticker, day, week, month, year });
  }

  function top(key, field, n) {
    const isRet = field === 'ret';
    return rows
      .filter((r) => r[key][field] != null)
      .sort((a, b) => b[key][field] - a[key][field])
      .slice(0, n)
      .map((r, i) => {
        const cell = r[key];
        return {
          rank: i + 1,
          ticker: r.ticker,
          value: cell[field],
          emoji: styleEmoji(
            r.day[isRet ? 'ret' : 'amountChg'],
            r.week[isRet ? 'ret' : 'amountChg'],
            r.month[isRet ? 'ret' : 'amountChg'],
            cell[field]
          ),
          price0: cell.price0,
          price1: cell.price1,
          priceDiff: cell.priceDiff,
          amtSum: cell.amtSum,
          amtDiff: cell.amtDiff,
        };
      });
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
