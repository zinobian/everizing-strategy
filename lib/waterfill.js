/**
 * 규칙4 매도금 배분: 캡 + 워터필링
 * 캡 = max(0, 해당 종목 시가평가액 - 보유 대여랏 원금 합)
 * 비중 = 일일 정액매수 금액 비율
 * 잔여 → TECL 캐쉬파킹
 */

const CONFIG = require('./config');

const PARKING_TICKER = 'TECL';

/** 메인 종목 목록 (TECL 제외, config.tickers 기준) */
function getMainTickers() {
  const keys = Object.keys(CONFIG.tickers || {});
  return keys.filter(t => t !== PARKING_TICKER);
}

function getWeight(ticker) {
  return (CONFIG.tickers?.[ticker]?.dailyBuy) || 0;
}

/**
 * @param {string} origin - 매도한 종목
 * @param {number} proceeds - 매도 대금 (USD)
 * @param {object} positions - { TQQQ: { qty, avgPrice, currentPrice }, ... }
 * @param {object} hostedByHost - { TQQQ: totalPrincipalUsd, ... } 호스트별 대여 원금 합
 */
function waterfill(origin, proceeds, positions, hostedByHost = {}) {
  if (!proceeds || proceeds <= 0) {
    return { allocations: [], parking: 0, origin };
  }

  const candidates = getMainTickers().filter(t => t !== origin);
  const weights = {};
  let totalW = 0;
  for (const t of candidates) {
    const w = getWeight(t);
    weights[t] = w;
    totalW += w;
  }
  if (totalW <= 0) {
    return { allocations: [], parking: proceeds, origin };
  }

  // 캡 계산
  const caps = {};
  for (const t of candidates) {
    const p = positions[t];
    const qty = p?.qty || 0;
    const cur = p?.currentPrice || p?.avgPrice || 0;
    const mkt = qty * cur;
    const hosted = hostedByHost[t] || 0;
    caps[t] = Math.max(0, mkt - hosted);
  }

  let remaining = proceeds;
  const got = {};
  for (const t of candidates) got[t] = 0;

  // 반복 워터필링
  let active = candidates.filter(t => caps[t] > 0.01);
  let guard = 0;
  while (remaining > 0.01 && active.length > 0 && guard < 20) {
    guard++;
    const wSum = active.reduce((s, t) => s + weights[t], 0);
    if (wSum <= 0) break;

    let overflow = 0;
    const nextActive = [];

    for (const t of active) {
      const share = remaining * (weights[t] / wSum);
      const room = caps[t] - got[t];
      if (share <= room + 0.0001) {
        got[t] += share;
      } else {
        got[t] += Math.max(0, room);
        overflow += share - Math.max(0, room);
      }
    }

    remaining = overflow;
    active = active.filter(t => caps[t] - got[t] > 0.01);
    if (overflow < 0.01) break;
  }

  const allocations = [];
  for (const t of candidates) {
    if (got[t] > 0.01) {
      allocations.push({
        host: t,
        amountUsd: Number(got[t].toFixed(2)),
        origin
      });
    }
  }

  const allocated = allocations.reduce((s, a) => s + a.amountUsd, 0);
  const parking = Number(Math.max(0, proceeds - allocated).toFixed(2));

  return { allocations, parking, origin, proceeds };
}

function formatWaterfillMessage(result) {
  if (!result) return '';
  let msg = `\n💧 <b>워터필링 배분 예정</b> (origin: ${result.origin})\n`;
  msg += `매도 대금 약 $${Number(result.proceeds || 0).toFixed(2)}\n`;
  for (const a of result.allocations || []) {
    msg += `→ ${a.host}  $${a.amountUsd}\n`;
  }
  if (result.parking > 0) {
    msg += `→ ${PARKING_TICKER} 캐쉬파킹  $${result.parking}\n`;
  }
  msg += `※ 승인 시 대여랏으로 기록 · 15일 분할 매수 예정\n`;
  return msg;
}

module.exports = {
  waterfill,
  formatWaterfillMessage,
  getMainTickers,
  PARKING_TICKER
};  
